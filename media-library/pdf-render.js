/**

 Copyright 2026 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

'use strict';

/**
 * PDF page rasterizer — the single place this app turns a PDF page into pixels.
 *
 * Two callers share it:
 *
 *   - uploads.generate_pdf_thumbnail(), once per upload, for page 1;
 *   - iiif-service, on demand, for the IIIF `{uuid};{N}` page selector.
 *
 * Rendering runs on the main thread (the pdfjs legacy build has no worker in
 * Node). The semaphore below therefore does NOT reduce blocking — serialized
 * blocking work blocks for just as long. What it bounds is peak MEMORY: each
 * in-flight render holds a whole PDF buffer plus its parsed document, so the
 * cap is what keeps a handful of concurrent requests for large documents from
 * holding several hundred megabytes at once. single_flight() is the one that
 * removes work, collapsing duplicate in-flight requests for the same page.
 */

const LOGGER = require('../libs/log4');

/* Maximum concurrent renders — a memory bound (see the module comment), not a latency one. */
const RENDER_CONCURRENCY = (() => {
    const v = parseInt(process.env.IIIF_PDF_RENDER_CONCURRENCY, 10);
    return Number.isFinite(v) && v > 0 ? v : 2;
})();

/*
 * Upper bound on the size of a PDF this module will decode, so an oversized
 * document cannot be re-parsed on every request. Defaults to the upload limit,
 * so under default configuration no stored PDF can exceed it and the guard
 * never changes behavior — it only holds the line if UPLOAD_MAX is later raised
 * past what is safe to rasterize per request.
 */
const MAX_PDF_BYTES = (() => {
    const v = parseInt(process.env.IIIF_PDF_MAX_BYTES, 10);

    if (Number.isFinite(v) && v > 0) {
        return v;
    }

    return parseInt(process.env.UPLOAD_MAX, 10) || 100000000;
})();

/* Result codes returned instead of thrown, so callers can map them to HTTP statuses. */
const RENDER_CODES = Object.freeze({
    PAGE_OUT_OF_RANGE: 'page_out_of_range',
    DOCUMENT_TOO_LARGE: 'document_too_large',
    RENDER_FAILED: 'render_failed'
});

// ---------------------------------------------------------------------------
// Concurrency control
// ---------------------------------------------------------------------------

let active_renders = 0;
const render_waiters = [];

/**
 * Takes a render slot, waiting if the cap is already reached.
 * @returns {Promise<void>} Resolves once a slot is held
 */
const acquire_slot = () => {

    if (active_renders < RENDER_CONCURRENCY) {
        active_renders++;
        return Promise.resolve();
    }

    return new Promise((resolve) => render_waiters.push(resolve));
};

/**
 * Releases a render slot, handing it directly to the next waiter when there is
 * one (the count stays held on its behalf).
 * @returns {void}
 */
const release_slot = () => {

    const next = render_waiters.shift();

    if (next) {
        next();
        return;
    }

    active_renders--;
};

const in_flight = new Map();

/**
 * Runs factory() under `key`, returning the existing promise when a call for
 * the same key is already running. Used to collapse duplicate page renders: one
 * exhibit page can request the same PDF page several times at once on a cold
 * cache, and without this each request would rasterize it independently.
 *
 * The entry is removed as soon as the work settles, so this de-duplicates
 * concurrent work only — it is not a result cache (the IIIF derivative cache is).
 *
 * @param {string} key - Identity of the work being performed
 * @param {Function} factory - Zero-arg function returning a promise
 * @returns {Promise<*>} The shared result
 */
const single_flight = (key, factory) => {

    const running = in_flight.get(key);

    if (running) {
        return running;
    }

    const promise = (async () => factory())().finally(() => in_flight.delete(key));

    in_flight.set(key, promise);

    return promise;
};

// ---------------------------------------------------------------------------
// pdfjs bootstrap
// ---------------------------------------------------------------------------

let pdfjs_promise = null;

/**
 * Loads the pdfjs legacy ESM build once per process and installs the globals
 * its canvas renderer expects.
 * @returns {Promise<Object>} The pdfjs module namespace
 */
const load_pdfjs = () => {

    if (pdfjs_promise === null) {

        pdfjs_promise = (async () => {

            const { DOMMatrix } = require('@napi-rs/canvas');

            /* pdfjs' renderer reads DOMMatrix off the global object. */
            if (typeof globalThis.DOMMatrix === 'undefined') {
                globalThis.DOMMatrix = DOMMatrix;
            }

            return import('pdfjs-dist/legacy/build/pdf.mjs');
        })();
    }

    return pdfjs_promise;
};

/*
 * pdfjs ships its own decoders, fonts and character maps, but in Node it cannot
 * work out where they are — in a browser it resolves them relative to the
 * bundle. Left unset, it reports the failure only as a console warning and then
 * renders the page WITHOUT the content it could not decode, so the call still
 * succeeds and returns a blank image.
 *
 * That is not hypothetical: it is why 7 of 125 stored PDF thumbnails are pure
 * white. Those documents are JPEG 2000 scans, and decoding JPX needs the
 * OpenJPEG WASM module — without `wasmUrl` pdfjs raises
 * "JpxError: OpenJPEG failed to initialize" and paints nothing.
 *
 * `standard_fonts` and `cmaps` are the same class of problem for text-bearing
 * and CJK documents. Supplying all three is byte-for-byte identical on a
 * document that does not need them (verified), so there is no cost to a PDF
 * that was already rendering.
 */
const PDFJS_ASSET_URLS = (() => {

    const PATH = require('path');
    const { pathToFileURL } = require('url');
    const package_root = PATH.join(require.resolve('pdfjs-dist/package.json'), '..');

    /* pdfjs requires a trailing separator — it concatenates the file name on. */
    const asset_url = (directory) => pathToFileURL(PATH.join(package_root, directory) + PATH.sep).href;

    return {
        wasmUrl: asset_url('wasm'),
        standardFontDataUrl: asset_url('standard_fonts'),
        cMapUrl: asset_url('cmaps'),
        cMapPacked: true
    };
})();

/**
 * Opens a PDF buffer as a pdfjs document.
 *
 * isEvalSupported/useSystemFonts are pinned off: the documents are staff
 * uploads, but neither is needed to rasterize a page and both widen what
 * untrusted file content can reach.
 *
 * @param {Buffer} pdf_buffer - Source PDF bytes
 * @returns {Promise<Object>} pdfjs document proxy — the caller must destroy() it
 */
const open_document = async (pdf_buffer) => {

    const pdfjs = await load_pdfjs();

    return pdfjs.getDocument({
        data: new Uint8Array(pdf_buffer),
        isEvalSupported: false,
        useSystemFonts: false,
        ...PDFJS_ASSET_URLS
    }).promise;
};

/**
 * Guard applied before any decode.
 * @param {Buffer} pdf_buffer - Source PDF bytes
 * @returns {boolean} Whether the buffer is a decodable size
 */
const is_decodable_size = (pdf_buffer) => {
    return Buffer.isBuffer(pdf_buffer) && pdf_buffer.length > 0 && pdf_buffer.length <= MAX_PDF_BYTES;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scale factor that fits a page inside a bounding box.
 *
 * Callers must pass the page's TRUE viewport dimensions, never rounded ones.
 * Real pages are rarely whole numbers of points — a scanned page measuring
 * 459.84 x 670.08 fits to 274x400, but rounding it to 460x670 first fits to
 * 274x399. Losing that fraction on the way in is a whole pixel out the other
 * side, so the output size is taken from the scaled viewport itself
 * (viewport_dimensions) rather than recomputed from numbers passed between
 * functions.
 *
 * No upper cap on the scale: PDF content is vector, so a page whose points are
 * smaller than the box is re-rasterized at higher resolution rather than
 * upscaled, which is what the upload thumbnail already does.
 *
 * @param {number} page_width - Page width in PDF points (unrounded)
 * @param {number} page_height - Page height in PDF points (unrounded)
 * @param {number} box_width - Bounding-box width in pixels
 * @param {number} box_height - Bounding-box height in pixels
 * @returns {number} Scale factor
 */
const fit_scale = (page_width, page_height, box_width, box_height) => {
    return Math.min(box_width / page_width, box_height / page_height);
};

/**
 * Pixel dimensions of a pdfjs viewport — the one place a viewport becomes a
 * pixel count, so the renderer's canvas and the reported dimensions cannot
 * drift apart.
 * @param {Object} viewport - pdfjs viewport
 * @returns {Object} { width, height }
 */
const viewport_dimensions = (viewport) => {
    return {
        width: Math.max(1, Math.floor(viewport.width)),
        height: Math.max(1, Math.floor(viewport.height))
    };
};

/**
 * Rasterizes one page of a PDF, fitted inside a bounding box, to a PNG buffer.
 *
 * Rendered directly at the fitted scale rather than rendered large and resized
 * down: one rounding step instead of two, and vector content stays crisp. The
 * upload thumbnail and the IIIF page selector both go through here, so page 1
 * and a selected page come out at identical dimensions.
 *
 * PNG, not JPEG, because both callers re-encode with their own output settings
 * and a lossless intermediate avoids a second generation of JPEG artifacts.
 *
 * @param {Buffer} pdf_buffer - Source PDF bytes
 * @param {number} page_number - 1-based page number
 * @param {number} box_width - Bounding-box width in pixels
 * @param {number} box_height - Bounding-box height in pixels
 * @returns {Promise<Object>} { success, buffer, width, height, page_count } or { success: false, code, page_count }
 */
const render_pdf_page_boxed = async (pdf_buffer, page_number, box_width, box_height) => {

    if (!is_decodable_size(pdf_buffer)) {
        return { success: false, code: RENDER_CODES.DOCUMENT_TOO_LARGE };
    }

    await acquire_slot();

    let pdf_document = null;

    try {

        const { createCanvas } = require('@napi-rs/canvas');

        pdf_document = await open_document(pdf_buffer);

        const page_count = pdf_document.numPages;

        if (!Number.isInteger(page_number) || page_number < 1 || page_number > page_count) {
            return { success: false, code: RENDER_CODES.PAGE_OUT_OF_RANGE, page_count };
        }

        const page = await pdf_document.getPage(page_number);
        const unscaled_viewport = page.getViewport({ scale: 1.0 });
        const viewport = page.getViewport({
            scale: fit_scale(unscaled_viewport.width, unscaled_viewport.height, box_width, box_height)
        });

        const { width, height } = viewport_dimensions(viewport);
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        return {
            success: true,
            buffer: canvas.toBuffer('image/png'),
            width,
            height,
            page_count
        };

    } catch (error) {
        LOGGER.module().warn(`WARNING: [/media-library/pdf-render (render_pdf_page_boxed)] Page ${page_number} render failed: ${error.message}`);
        return { success: false, code: RENDER_CODES.RENDER_FAILED };
    } finally {

        /*
         * destroy() in finally — the failure path used to leak the parsed
         * document, which was only released when a render succeeded.
         */
        if (pdf_document !== null) {
            await pdf_document.destroy();
        }

        release_slot();
    }
};

module.exports = {
    RENDER_CODES,
    PDFJS_ASSET_URLS,
    MAX_PDF_BYTES,
    single_flight,
    render_pdf_page_boxed
};
