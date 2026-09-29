'use strict';

/**
 * IIIF PDF page selection at the controller boundary.
 *
 * The service unit tests (test/tasks/iiif_pdf_page_selection.test.js) cover the
 * identifier grammar and the rendering itself. This pins the layer that used to
 * make `{uuid};4` impossible: get_iiif_image and get_iiif_info matched the path
 * parameter against a bare-UUID regex and returned 400 before the service was
 * ever called. These tests fail if that pre-flight check regresses, and they
 * pin the HTTP statuses and headers the public frontend depends on.
 *
 * The rasterizer is stubbed here, deliberately: pdf-render reaches pdfjs
 * through a dynamic import() of its ESM build, which Jest's module system
 * cannot load. Real rendering — including that a selected page differs from
 * page 1 — is covered by the Vitest suite, which can. What this file owns is
 * the wiring: identifier acceptance, statuses, headers and the ETag contract.
 */

const os = require('os');
const path = require('path');
const real_fs = require('fs');

const { build_multipage_pdf } = require('../tasks/helpers/multipage_pdf');

jest.mock('../../libs/log4', () => ({
    module: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../media-library/model', () => ({
    get_media_record: jest.fn()
}));

jest.mock('../../media-library/uploads', () => ({
    resolve_storage_path: jest.fn()
}));

/*
 * Stub rasterizer standing in for a 4-page document. Each page yields a
 * different solid colour, so "different pages produce different bytes" is a
 * real assertion about the plumbing rather than a tautology.
 */
const STUB_PAGE_COUNT = 4;

jest.mock('../../media-library/pdf-render', () => {

    const sharp = require('sharp');
    const RENDER_CODES = {
        PAGE_OUT_OF_RANGE: 'page_out_of_range',
        DOCUMENT_TOO_LARGE: 'document_too_large',
        RENDER_FAILED: 'render_failed'
    };
    const PAGE_COUNT = 4;

    const out_of_range = (page) => {
        return page > PAGE_COUNT
            ? { success: false, code: RENDER_CODES.PAGE_OUT_OF_RANGE, page_count: PAGE_COUNT }
            : null;
    };

    return {
        RENDER_CODES,
        MAX_PDF_BYTES: 100000000,
        RENDER_CONCURRENCY: 2,
        single_flight: (key, factory) => factory(),
        fit_page_to_box: (page_width, page_height, box_width, box_height) => {
            const scale = Math.min(box_width / page_width, box_height / page_height);
            return {
                scale,
                width: Math.max(1, Math.floor(page_width * scale)),
                height: Math.max(1, Math.floor(page_height * scale))
            };
        },
        get_pdf_page_count: async () => PAGE_COUNT,
        get_pdf_page_dimensions: async (buffer, page) => {
            return out_of_range(page) || { success: true, width: 612, height: 792, page_count: PAGE_COUNT };
        },
        render_pdf_page_boxed: async (buffer, page) => {

            const rejected = out_of_range(page);

            if (rejected) {
                return rejected;
            }

            return {
                success: true,
                buffer: await sharp({
                    create: { width: 309, height: 400, channels: 3, background: { r: page * 40, g: 20, b: 30 } }
                }).png().toBuffer(),
                width: 309,
                height: 400,
                page_count: PAGE_COUNT
            };
        },
    };
});

process.env.ELASTICSEARCH_HOST = process.env.ELASTICSEARCH_HOST || 'http://es.test:9200';
process.env.REPO_ELASTICSEARCH_INDEX = process.env.REPO_ELASTICSEARCH_INDEX || 'repo-test';

/* Point the derivative cache at a throwaway dir BEFORE the cache module loads. */
const TMP_ROOT = path.join(os.tmpdir(), `iiif-page-integration-${process.pid}-${Date.now()}`);
process.env.STORAGE_PATH = TMP_ROOT;

const MEDIA_MODEL = require('../../media-library/model');
const UPLOADS = require('../../media-library/uploads');
const CONTROLLER = require('../../media-library/controller');

const PDF_UUID = 'b1d47972-3799-49c0-8bb9-6036a754e158';
const PDF_PATH = path.join(TMP_ROOT, 'four-pages.pdf');
const THUMB_PATH = path.join(TMP_ROOT, 'four-pages-thumb.jpg');
const PDF_STORAGE = 'documents/b1/d4/four-pages.pdf';
const THUMB_STORAGE = 'thumbnails/b1/d4/four-pages-thumb.jpg';

const pdf_record = (overrides = {}) => ({
    uuid: PDF_UUID,
    name: 'Four page document',
    ingest_method: 'upload',
    mime_type: 'application/pdf',
    media_type: 'pdf',
    storage_path: PDF_STORAGE,
    thumbnail_path: THUMB_STORAGE,
    media_width: 309,
    media_height: 400,
    updated: '2026-09-22T10:00:00Z',
    ...overrides
});

const mock_res = () => {
    return {
        headersSent: false,
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn(),
        end: jest.fn()
    };
};

const image_request = (media_id) => ({
    params: {
        media_id,
        region: 'full',
        size: 'max',
        rotation: '0',
        quality_format: 'default.jpg'
    },
    headers: {}
});

/* Headers land in the last res.set() call that carried Content-Type. */
const sent_headers = (res) => {
    return res.set.mock.calls.map((call) => call[0]).reduce((merged, headers) => ({ ...merged, ...headers }), {});
};

beforeAll(async () => {

    const sharp = require('sharp');

    real_fs.mkdirSync(TMP_ROOT, { recursive: true });

    /* A real file on disk: the page path stats and reads it before rendering. */
    real_fs.writeFileSync(PDF_PATH, build_multipage_pdf(STUB_PAGE_COUNT));

    /* Page 1 is served from the stored thumbnail, as an upload leaves it. */
    real_fs.writeFileSync(THUMB_PATH, await sharp({
        create: { width: 309, height: 400, channels: 3, background: { r: 250, g: 250, b: 250 } }
    }).jpeg({ quality: 80 }).toBuffer());
});

afterAll(() => {
    real_fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
    MEDIA_MODEL.get_media_record.mockResolvedValue({ success: true, record: pdf_record() });
    UPLOADS.resolve_storage_path.mockImplementation((relative_path) => {
        return Promise.resolve(relative_path === THUMB_STORAGE ? THUMB_PATH : PDF_PATH);
    });
});

describe('get_iiif_image — `{uuid};{N}` page selector', () => {

    test('accepts a page selector instead of rejecting it as an invalid media ID', async () => {
        const res = mock_res();
        await CONTROLLER.get_iiif_image(image_request(`${PDF_UUID};4`), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledTimes(1);
        expect(Buffer.isBuffer(res.send.mock.calls[0][0])).toBe(true);
    });

    test('serves the selected page with image headers, a strong ETag and CORS', async () => {
        const res = mock_res();
        await CONTROLLER.get_iiif_image(image_request(`${PDF_UUID};4`), res);

        const headers = sent_headers(res);
        expect(headers['Content-Type']).toBe('image/jpeg');
        expect(headers['Access-Control-Allow-Origin']).toBe('*');
        expect(headers.ETag).toMatch(/^"/);
    });

    test('a bare identifier and `;1` produce the same ETag', async () => {
        const bare = mock_res();
        await CONTROLLER.get_iiif_image(image_request(PDF_UUID), bare);

        const explicit = mock_res();
        await CONTROLLER.get_iiif_image(image_request(`${PDF_UUID};1`), explicit);

        const bare_etag = sent_headers(bare).ETag;

        expect(bare_etag).toMatch(/^"/);
        expect(sent_headers(explicit).ETag).toBe(bare_etag);
    });

    test('different pages produce different bytes', async () => {
        const first = mock_res();
        await CONTROLLER.get_iiif_image(image_request(`${PDF_UUID};2`), first);

        const second = mock_res();
        await CONTROLLER.get_iiif_image(image_request(`${PDF_UUID};3`), second);

        expect(first.send.mock.calls[0][0].equals(second.send.mock.calls[0][0])).toBe(false);
    });

    test('a page past the end of the document -> 404', async () => {
        const res = mock_res();
        await CONTROLLER.get_iiif_image(image_request(`${PDF_UUID};9`), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).not.toHaveBeenCalled();
    });

    test('page selection on non-PDF media -> 400', async () => {
        MEDIA_MODEL.get_media_record.mockResolvedValue({
            success: true,
            record: pdf_record({ media_type: 'image', mime_type: 'image/png' })
        });

        const res = mock_res();
        await CONTROLLER.get_iiif_image(image_request(`${PDF_UUID};4`), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test.each([`${PDF_UUID};0`, `${PDF_UUID};04`, `${PDF_UUID};abc`, 'not-a-uuid;4'])(
        'a malformed identifier (%s) -> 400 before any record lookup',
        async (media_id) => {
            const res = mock_res();
            await CONTROLLER.get_iiif_image(image_request(media_id), res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(MEDIA_MODEL.get_media_record).not.toHaveBeenCalled();
        }
    );

    test('a conditional request for a selected page answers 304', async () => {
        const seed = mock_res();
        await CONTROLLER.get_iiif_image(image_request(`${PDF_UUID};3`), seed);

        const etag = sent_headers(seed).ETag;
        const request = image_request(`${PDF_UUID};3`);
        request.headers['if-none-match'] = etag;

        const conditional = mock_res();
        await CONTROLLER.get_iiif_image(request, conditional);

        expect(conditional.status).toHaveBeenCalledWith(304);
        expect(conditional.end).toHaveBeenCalled();
    });
});

describe('get_iiif_info — page selection is not offered here', () => {

    const info_request = (media_id) => ({
        params: { media_id },
        headers: {},
        protocol: 'https',
        get: () => 'host'
    });

    test('rejects a page selector with 400 before any record lookup', async () => {
        const res = mock_res();
        await CONTROLLER.get_iiif_info(info_request(`${PDF_UUID};4`), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(MEDIA_MODEL.get_media_record).not.toHaveBeenCalled();
    });

    test('a bare identifier is unaffected', async () => {
        const res = mock_res();
        await CONTROLLER.get_iiif_info(info_request(PDF_UUID), res);

        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe('get_iiif_file / manifest — page selection is not defined there either', () => {

    test('the file route rejects a page selector with 400', async () => {
        const res = mock_res();
        await CONTROLLER.get_iiif_file({ params: { media_id: `${PDF_UUID};4` } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(MEDIA_MODEL.get_media_record).not.toHaveBeenCalled();
    });

    test('the manifest route rejects a page selector with 400', async () => {
        const res = mock_res();
        await CONTROLLER.get_iiif_manifest({ params: { media_id: `${PDF_UUID};4` } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(MEDIA_MODEL.get_media_record).not.toHaveBeenCalled();
    });
});
