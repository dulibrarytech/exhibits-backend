'use strict';

/**
 * IIIF service error-status contract (media-library/iiif-service.js).
 *
 * Guards the fix for the IIIF slice of the "HTTP 200 on error" finding: each
 * service entry point now tags its failures with an explicit `status`, and the
 * controllers return `result.status || 500` — so a genuine error is never
 * reported as a 200. This pins the status values the controllers depend on:
 *   - bad request (uuid / quality.format / rotation)      -> 400
 *   - record not found / no manifest for this media       -> 404
 *   - image source missing                                -> 404
 *   - unexpected processing/build failure                 -> 500
 *
 * Model and uploads are mocked; sharp runs for real (a garbage source triggers
 * the 500 path). STORAGE_PATH points the cache at a temp dir, set BEFORE require.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

vi.mock('../../media-library/model', () => ({
    get_media_record: vi.fn()
}));

vi.mock('../../media-library/uploads', () => ({
    resolve_storage_path: vi.fn()
}));

const TMP_ROOT = path.join(os.tmpdir(), `iiif-status-test-${process.pid}-${Date.now()}`);
process.env.STORAGE_PATH = TMP_ROOT;

const MEDIA_MODEL = require('../../media-library/model');
const UPLOADS = require('../../media-library/uploads');
const IIIF_SERVICE = require('../../media-library/iiif-service');

const UUID = 'a3f7b2c1-89d4-4e2a-b5c6-1234abcd5678';
const GOOD_SOURCE = path.join(TMP_ROOT, 'good.png');
const GARBAGE_SOURCE = path.join(TMP_ROOT, 'garbage.bin');

const found = (record) => ({ success: true, record });
const not_found = () => ({ success: false, record: null, message: 'Media record not found' });

const set_record = (resolved) => { MEDIA_MODEL.get_media_record = vi.fn().mockResolvedValue(resolved); };
const set_source = (impl) => { UPLOADS.resolve_storage_path = impl; };

beforeAll(async () => {
    const sharp = require('sharp');
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(GOOD_SOURCE, await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 20, b: 30 } }
    }).png().toBuffer());
    fs.writeFileSync(GARBAGE_SOURCE, 'this is definitely not an image');
});

afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
    set_source(vi.fn().mockResolvedValue(GOOD_SOURCE));
    set_record(found({ uuid: UUID, media_type: 'image', storage_path: 'images/a3/f7/good.png', updated: '2026-06-16T10:00:00Z' }));
});

describe('get_image — failure statuses', () => {

    it('invalid uuid -> 400', async () => {
        const r = await IIIF_SERVICE.get_image('not-a-uuid', 'full', 'max', '0', 'default.jpg');
        expect(r.success).toBe(false);
        expect(r.status).toBe(400);
    });

    it('unsupported quality/format -> 400', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.tiff');
        expect(r.status).toBe(400);
    });

    it('unsupported rotation -> 400', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '90', 'default.jpg');
        expect(r.status).toBe(400);
    });

    it('record not found -> 404', async () => {
        set_record(not_found());
        const r = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');
        expect(r.status).toBe(404);
    });

    it('image source not available -> 404', async () => {
        set_source(vi.fn().mockRejectedValue(new Error('ENOENT')));
        const r = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');
        expect(r.success).toBe(false);
        expect(r.status).toBe(404);
    });

    it('processing failure (corrupt source) -> 500', async () => {
        set_source(vi.fn().mockResolvedValue(GARBAGE_SOURCE));
        const r = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');
        expect(r.success).toBe(false);
        expect(r.status).toBe(500);
    });

    it('success carries no error status', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', '!32,32', '0', 'default.jpg');
        expect(r.success).toBe(true);
        expect(r.status).toBeUndefined();
    });

    // OWASP A04/H3 — oversized output dimensions are rejected before any source
    // read/transcode (default cap 2000px per dimension).
    it('oversized best-fit size (!50000,50000) -> 400', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', '!50000,50000', '0', 'default.jpg');
        expect(r.success).toBe(false);
        expect(r.status).toBe(400);
    });

    it('oversized exact size (5000,5000) -> 400', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', '5000,5000', '0', 'default.jpg');
        expect(r.status).toBe(400);
    });

    it('oversized width-only size (9999,) -> 400', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', '9999,', '0', 'default.jpg');
        expect(r.status).toBe(400);
    });

    it('oversized height-only size (,9999) -> 400', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', ',9999', '0', 'default.jpg');
        expect(r.status).toBe(400);
    });

    it('the cap is enforced before the record lookup', async () => {
        set_record(not_found());
        const r = await IIIF_SERVICE.get_image(UUID, 'full', '!50000,50000', '0', 'default.jpg');
        expect(r.status).toBe(400);
    });

    it('size at the cap (2000,2000) is allowed', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', '2000,2000', '0', 'default.jpg');
        expect(r.success).toBe(true);
        expect(r.status).toBeUndefined();
    });

    it('max size is not dimension-capped (serves source-bounded original)', async () => {
        const r = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');
        expect(r.success).toBe(true);
        expect(r.status).toBeUndefined();
    });
});

describe('build_manifest_for_uuid — failure statuses', () => {

    const BASE = 'https://host/exhibits-dashboard/iiif';
    const FILE = 'https://host/exhibits-dashboard';

    it('invalid uuid -> 400', async () => {
        const r = await IIIF_SERVICE.build_manifest_for_uuid('bad', BASE, FILE);
        expect(r.status).toBe(400);
    });

    it('record not found -> 404', async () => {
        set_record(not_found());
        const r = await IIIF_SERVICE.build_manifest_for_uuid(UUID, BASE, FILE);
        expect(r.status).toBe(404);
    });

    it('unsupported ingest method -> 404', async () => {
        set_record(found({ uuid: UUID, ingest_method: 'other', media_type: 'image' }));
        const r = await IIIF_SERVICE.build_manifest_for_uuid(UUID, BASE, FILE);
        expect(r.status).toBe(404);
    });

    it('unsupported media type -> 404', async () => {
        set_record(found({ uuid: UUID, ingest_method: 'upload', media_type: 'archive' }));
        const r = await IIIF_SERVICE.build_manifest_for_uuid(UUID, BASE, FILE);
        expect(r.status).toBe(404);
    });

    it('supported record -> success, no status', async () => {
        set_record(found({ uuid: UUID, ingest_method: 'upload', media_type: 'image', name: 'X', media_width: 64, media_height: 64 }));
        const r = await IIIF_SERVICE.build_manifest_for_uuid(UUID, BASE, FILE);
        expect(r.success).toBe(true);
        expect(r.status).toBeUndefined();
        expect(r.manifest).toBeTruthy();
    });
});

describe('get_info — failure statuses', () => {

    const BASE = 'https://host/exhibits-dashboard/iiif';

    it('invalid uuid -> 400', async () => {
        const r = await IIIF_SERVICE.get_info('bad', BASE);
        expect(r.status).toBe(400);
    });

    it('record not found -> 404', async () => {
        set_record(not_found());
        const r = await IIIF_SERVICE.get_info(UUID, BASE);
        expect(r.status).toBe(404);
    });

    it('success -> info, no status', async () => {
        set_record(found({ uuid: UUID, media_type: 'image', media_width: 64, media_height: 64 }));
        const r = await IIIF_SERVICE.get_info(UUID, BASE);
        expect(r.success).toBe(true);
        expect(r.status).toBeUndefined();
        expect(r.info).toBeTruthy();
    });
});
