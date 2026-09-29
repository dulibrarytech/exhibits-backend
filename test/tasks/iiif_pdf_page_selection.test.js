'use strict';

/**
 * IIIF PDF page selection — `{uuid};{N}` (media-library/iiif-service.js).
 *
 * The public template renders a PDF item's preview from the IIIF image URL, and
 * an item with `pdf_open_to_page > 1` needs the image of that page. The page is
 * appended to the identifier using Cantaloupe's syntax (`{uuid};4`), which is
 * what the repository's Cantaloupe server already accepts, so the frontend
 * builds one URL shape for both image sources.
 *
 * What this pins:
 *   - the identifier grammar, including the non-canonical spellings that are
 *     rejected so one page cannot mint two cache entries;
 *   - page 1 as the identity request: `{uuid}` and `{uuid};1` must produce the
 *     same bytes and the same ETag, and must not disturb derivatives cached
 *     before page selection existed;
 *   - a selected page rendering DIFFERENT pixels from page 1 (a renderer that
 *     silently returned page 1 would pass every structural assertion);
 *   - the error contract: out of range -> 404, non-PDF -> 400, malformed -> 400.
 *
 * Model and uploads are mocked; pdfjs, canvas and sharp all run for real
 * against a generated multi-page PDF. STORAGE_PATH points the derivative cache
 * at a temp dir and is set BEFORE the service is required.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { fileURLToPath } = require('url');

const { build_multipage_pdf } = require('./helpers/multipage_pdf');

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

vi.mock('../../media-library/model', () => ({
    get_media_record: vi.fn()
}));

vi.mock('../../media-library/uploads', () => ({
    resolve_storage_path: vi.fn()
}));

const TMP_ROOT = path.join(os.tmpdir(), `iiif-pdf-page-test-${process.pid}-${Date.now()}`);
process.env.STORAGE_PATH = TMP_ROOT;

const MEDIA_MODEL = require('../../media-library/model');
const UPLOADS = require('../../media-library/uploads');
const IIIF_SERVICE = require('../../media-library/iiif-service');
const IIIF_CACHE = require('../../media-library/iiif-cache');
const PDF_RENDER = require('../../media-library/pdf-render');

const UUID = 'b1d47972-3799-49c0-8bb9-6036a754e158';
const BASE = 'https://host/exhibits-dashboard/iiif';
const PDF_PATH = path.join(TMP_ROOT, 'four-pages.pdf');
const THUMB_PATH = path.join(TMP_ROOT, 'four-pages-thumb.jpg');
const IMAGE_PATH = path.join(TMP_ROOT, 'image.png');

const PDF_STORAGE = 'documents/b1/d4/four-pages.pdf';
const THUMB_STORAGE = 'thumbnails/b1/d4/four-pages-thumb.jpg';

const pdf_record = (overrides = {}) => ({
    success: true,
    record: {
        uuid: UUID,
        media_type: 'pdf',
        storage_path: PDF_STORAGE,
        thumbnail_path: THUMB_STORAGE,
        media_width: 309,
        media_height: 400,
        updated: '2026-09-22T10:00:00Z',
        ...overrides
    }
});

const image_record = () => ({
    success: true,
    record: {
        uuid: UUID,
        media_type: 'image',
        storage_path: 'images/b1/d4/image.png',
        media_width: 64,
        media_height: 64,
        updated: '2026-09-22T10:00:00Z'
    }
});

/* Map a storage-relative path back to the temp file standing in for it. */
const resolve_storage = (relative_path) => {

    if (relative_path === PDF_STORAGE) {
        return Promise.resolve(PDF_PATH);
    }

    if (relative_path === THUMB_STORAGE) {
        return Promise.resolve(THUMB_PATH);
    }

    return Promise.resolve(IMAGE_PATH);
};

beforeAll(async () => {

    fs.mkdirSync(TMP_ROOT, { recursive: true });

    const pdf = build_multipage_pdf(4);
    fs.writeFileSync(PDF_PATH, pdf);

    /* Page 1 is served from the stored thumbnail, exactly as an upload builds it. */
    const page_one = await PDF_RENDER.render_pdf_page_boxed(pdf, 1, 400, 400);
    fs.writeFileSync(THUMB_PATH, await sharp(page_one.buffer)
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 80 })
        .toBuffer());

    fs.writeFileSync(IMAGE_PATH, await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 20, b: 30 } }
    }).png().toBuffer());
});

afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
    UPLOADS.resolve_storage_path = vi.fn(resolve_storage);
    MEDIA_MODEL.get_media_record = vi.fn().mockResolvedValue(pdf_record());
});

describe('parse_identifier — identifier grammar', () => {

    it('a bare uuid is page 1', () => {
        expect(IIIF_SERVICE.parse_identifier(UUID)).toEqual({ uuid: UUID, page: 1 });
    });

    it('accepts a canonical page selector', () => {
        expect(IIIF_SERVICE.parse_identifier(`${UUID};1`)).toEqual({ uuid: UUID, page: 1 });
        expect(IIIF_SERVICE.parse_identifier(`${UUID};4`)).toEqual({ uuid: UUID, page: 4 });
        expect(IIIF_SERVICE.parse_identifier(`${UUID};250`)).toEqual({ uuid: UUID, page: 250 });
    });

    it('is case-insensitive about the uuid, as the uuid check already is', () => {
        expect(IIIF_SERVICE.parse_identifier(`${UUID.toUpperCase()};4`)).toEqual({
            uuid: UUID.toUpperCase(),
            page: 4
        });
    });

    it.each([
        [`${UUID};0`, 'page zero'],
        [`${UUID};04`, 'leading zero — a second spelling of page 4'],
        [`${UUID};004`, 'more leading zeros'],
        [`${UUID};-1`, 'negative'],
        [`${UUID};+4`, 'signed'],
        [`${UUID};1.5`, 'decimal'],
        [`${UUID}; 4`, 'whitespace'],
        [`${UUID};abc`, 'non-numeric'],
        [`${UUID};`, 'empty selector'],
        [`${UUID};4;5`, 'two selectors'],
        [`${UUID};1234567890`, 'too many digits to be a safe integer'],
        [';4', 'no uuid'],
        ['not-a-uuid;4', 'invalid uuid'],
        ['not-a-uuid', 'invalid uuid, no selector'],
        ['', 'empty'],
        [null, 'null']
    ])('rejects %s (%s)', (identifier) => {
        expect(IIIF_SERVICE.parse_identifier(identifier)).toBeNull();
    });
});

describe('derivative cache key — page 1 stays the identity', () => {

    it('{uuid} and {uuid};1 share one variant digest', () => {
        const bare = IIIF_CACHE.variant_digest('full', 'max', '0', 'default.jpg');
        const explicit = IIIF_CACHE.variant_digest('full', 'max', '0', 'default.jpg', 1);
        expect(explicit).toBe(bare);
    });

    it('a selected page gets its own variant digest', () => {
        const page_one = IIIF_CACHE.variant_digest('full', 'max', '0', 'default.jpg', 1);
        const page_four = IIIF_CACHE.variant_digest('full', 'max', '0', 'default.jpg', 4);
        const page_five = IIIF_CACHE.variant_digest('full', 'max', '0', 'default.jpg', 5);

        expect(page_four).not.toBe(page_one);
        expect(page_five).not.toBe(page_four);
    });

    it('the page lives in the digest, not the cache path — so purge by uuid still reclaims it', () => {
        const page_four = IIIF_CACHE.derivative_path(UUID, '2026-09-22T10:00:00Z', 'full', 'max', '0', 'default.jpg', 4);
        expect(page_four).toContain(`${path.sep}${UUID}${path.sep}`);
        expect(page_four).not.toContain(';');
    });

    it('etags follow the same rule', () => {
        const bare = IIIF_CACHE.compute_etag(UUID, 'v1', 'full', 'max', '0', 'default.jpg');
        const page_one = IIIF_CACHE.compute_etag(UUID, 'v1', 'full', 'max', '0', 'default.jpg', 1);
        const page_four = IIIF_CACHE.compute_etag(UUID, 'v1', 'full', 'max', '0', 'default.jpg', 4);

        expect(page_one).toBe(bare);
        expect(page_four).not.toBe(bare);
    });
});

describe('pdfjs bundled assets are locatable', () => {

    /*
     * pdfjs resolves its decoders, fonts and cmaps relative to the bundle in a
     * browser; in Node it must be told where they are. When it cannot find
     * them it reports a console warning and then renders the page WITHOUT the
     * content it failed to decode — the call still succeeds and returns a
     * blank image. That silent mode is why 7 of 125 stored PDF thumbnails were
     * pure white: they are JPEG 2000 scans, and JPX decoding needs the
     * OpenJPEG WASM module.
     *
     * A pdfjs-dist upgrade that relocates these directories would reintroduce
     * blank renders with no test failure anywhere else, so pin the paths.
     */

    const asset_path = (url) => fileURLToPath(url);

    it('points at directories that exist', () => {
        ['wasmUrl', 'standardFontDataUrl', 'cMapUrl'].forEach((key) => {
            const directory = asset_path(PDF_RENDER.PDFJS_ASSET_URLS[key]);
            expect(fs.existsSync(directory), `${key} -> ${directory}`).toBe(true);
        });
    });

    it('includes the OpenJPEG module that JPEG 2000 scans need', () => {
        const wasm_dir = asset_path(PDF_RENDER.PDFJS_ASSET_URLS.wasmUrl);
        expect(fs.existsSync(path.join(wasm_dir, 'openjpeg.wasm'))).toBe(true);
    });
});

describe('render dimensions come from the pdfjs viewport', () => {

    it('sizes from the true viewport, not from rounded page dimensions', async () => {
        /*
         * Regression pin, taken from a real stored PDF whose pages measure
         * 459.84 x 670.08pt. Fitted honestly that is 274x400; round the page
         * to 460x670 first and the same fit gives 274x399 — one pixel short,
         * which is what an earlier version advertised for an image it then
         * served at 400. Whole-number page sizes hide this entirely.
         */
        const pdf = build_multipage_pdf(2, { width: 459.84, height: 670.08 });
        const rendered = await PDF_RENDER.render_pdf_page_boxed(pdf, 2, 400, 400);

        const rounded_scale = Math.min(400 / 460, 400 / 670);
        expect(Math.floor(670 * rounded_scale)).toBe(399);

        expect(rendered.width).toBe(274);
        expect(rendered.height).toBe(400);
    });

    it('page 1 and a selected page come out at identical dimensions', async () => {
        /*
         * The upload thumbnail and the page selector share one renderer, so
         * "a selected page looks like page 1" holds exactly, not to within a
         * pixel — which is what render-large-then-downscale used to cost.
         */
        const pdf = build_multipage_pdf(2, { width: 459.84, height: 670.08 });

        const first = await PDF_RENDER.render_pdf_page_boxed(pdf, 1, 400, 400);
        const second = await PDF_RENDER.render_pdf_page_boxed(pdf, 2, 400, 400);

        expect(second.width).toBe(first.width);
        expect(second.height).toBe(first.height);
    });
});

describe('get_image — page selection', () => {

    it('serves page 1 for a bare identifier', async () => {
        const result = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');
        expect(result.success).toBe(true);
        expect(result.image.length).toBeGreaterThan(0);
    });

    it('{uuid};1 is byte-identical to {uuid}, with the same etag', async () => {
        const bare = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');
        const explicit = await IIIF_SERVICE.get_image(`${UUID};1`, 'full', 'max', '0', 'default.jpg');

        expect(explicit.success).toBe(true);
        expect(explicit.etag).toBe(bare.etag);
        expect(explicit.image.equals(bare.image)).toBe(true);
    });

    it('renders the SELECTED page, not page 1', async () => {
        const page_one = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');
        const page_four = await IIIF_SERVICE.get_image(`${UUID};4`, 'full', 'max', '0', 'default.jpg');

        expect(page_four.success).toBe(true);
        expect(page_four.image.equals(page_one.image)).toBe(false);
        expect(page_four.etag).not.toBe(page_one.etag);
    });

    it('matches page 1 dimensions, so a paged item does not out-resolve its neighbours', async () => {
        const page_one = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');
        const page_four = await IIIF_SERVICE.get_image(`${UUID};4`, 'full', 'max', '0', 'default.jpg');

        const one_metadata = await sharp(page_one.image).metadata();
        const four_metadata = await sharp(page_four.image).metadata();

        expect(four_metadata.width).toBe(one_metadata.width);
        expect(four_metadata.height).toBe(one_metadata.height);
    });

    it('caches a rendered page — the second request never reads storage', async () => {
        const first = await IIIF_SERVICE.get_image(`${UUID};3`, 'full', 'max', '0', 'default.jpg');
        expect(first.cached).toBe(false);

        UPLOADS.resolve_storage_path = vi.fn(resolve_storage);

        const second = await IIIF_SERVICE.get_image(`${UUID};3`, 'full', 'max', '0', 'default.jpg');
        expect(second.cached).toBe(true);
        expect(second.image.equals(first.image)).toBe(true);
        expect(UPLOADS.resolve_storage_path).not.toHaveBeenCalled();
    });

    it('answers a conditional request for a selected page with not_modified', async () => {
        const seed = await IIIF_SERVICE.get_image(`${UUID};2`, 'full', 'max', '0', 'default.jpg');

        const conditional = await IIIF_SERVICE.get_image(`${UUID};2`, 'full', 'max', '0', 'default.jpg', {
            if_none_match: seed.etag
        });

        expect(conditional.not_modified).toBe(true);
        expect(conditional.image).toBeNull();
    });

    it('a page past the end of the document -> 404', async () => {
        const result = await IIIF_SERVICE.get_image(`${UUID};9`, 'full', 'max', '0', 'default.jpg');
        expect(result.success).toBe(false);
        expect(result.status).toBe(404);
        expect(result.message).toContain('4 pages');
    });

    it('page selection on non-PDF media -> 400', async () => {
        MEDIA_MODEL.get_media_record = vi.fn().mockResolvedValue(image_record());

        const result = await IIIF_SERVICE.get_image(`${UUID};4`, 'full', 'max', '0', 'default.jpg');
        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
    });

    it('{uuid};1 is still valid on non-PDF media, so a caller can append it unconditionally', async () => {
        MEDIA_MODEL.get_media_record = vi.fn().mockResolvedValue(image_record());

        const result = await IIIF_SERVICE.get_image(`${UUID};1`, 'full', 'max', '0', 'default.jpg');
        expect(result.success).toBe(true);
    });

    it.each([`${UUID};0`, `${UUID};04`, `${UUID};abc`, `${UUID};-1`])(
        'a malformed identifier (%s) -> 400',
        async (identifier) => {
            const result = await IIIF_SERVICE.get_image(identifier, 'full', 'max', '0', 'default.jpg');
            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
        }
    );

    it('keeps the pre-existing validation contract', async () => {
        expect((await IIIF_SERVICE.get_image('not-a-uuid', 'full', 'max', '0', 'default.jpg')).status).toBe(400);
        expect((await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.tiff')).status).toBe(400);
        expect((await IIIF_SERVICE.get_image(UUID, 'full', 'max', '90', 'default.jpg')).status).toBe(400);
    });
});

describe('get_info — page selection is not offered here', () => {

    it('rejects a page selector, as /manifest and /file do', async () => {
        expect((await IIIF_SERVICE.get_info(`${UUID};4`, BASE)).status).toBe(400);
        expect((await IIIF_SERVICE.get_info(`${UUID};1`, BASE)).status).toBe(400);
    });

    it('a bare identifier is unaffected', async () => {
        const result = await IIIF_SERVICE.get_info(UUID, BASE);
        expect(result.success).toBe(true);
        expect(result.info.id).toBe(`${BASE}/${UUID}`);
    });
});

describe('single_flight — duplicate concurrent work collapses', () => {

    it('runs the factory once for concurrent callers on the same key', async () => {
        let calls = 0;

        const factory = async () => {
            calls++;
            await new Promise((resolve) => setTimeout(resolve, 10));
            return 'value';
        };

        const results = await Promise.all([
            PDF_RENDER.single_flight('k', factory),
            PDF_RENDER.single_flight('k', factory),
            PDF_RENDER.single_flight('k', factory)
        ]);

        expect(calls).toBe(1);
        expect(results).toEqual(['value', 'value', 'value']);
    });

    it('does not cache across calls — a later call runs again', async () => {
        let calls = 0;
        const factory = async () => { calls++; return calls; };

        await PDF_RENDER.single_flight('k2', factory);
        await PDF_RENDER.single_flight('k2', factory);

        expect(calls).toBe(2);
    });

    it('propagates a rejection and clears the key', async () => {
        const failing = async () => { throw new Error('boom'); };

        await expect(PDF_RENDER.single_flight('k3', failing)).rejects.toThrow('boom');
        await expect(PDF_RENDER.single_flight('k3', async () => 'recovered')).resolves.toBe('recovered');
    });
});
