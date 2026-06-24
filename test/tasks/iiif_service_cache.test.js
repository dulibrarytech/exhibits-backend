'use strict';

/**
 * IIIF image service cache integration (media-library/iiif-service.get_image).
 *
 * Proves the headline behavior of the derivative-cache fix:
 *  - a cache MISS transcodes once (reads the source, runs sharp);
 *  - an identical request is a cache HIT served WITHOUT re-reading the source
 *    (resolve_storage_path is not called) and returns the same bytes;
 *  - a strong ETag is returned and a matching If-None-Match yields not_modified;
 *  - bumping the record version (the `updated` timestamp) invalidates the cache
 *    (the source is read and transcoded again);
 *  - the existing validation contract (bad uuid / format / rotation) is intact.
 *
 * The model and uploads layers are mocked so no DB or real storage is involved;
 * sharp runs for real against a generated PNG. STORAGE_PATH points the cache at
 * a throwaway temp dir and is set BEFORE the service (and its cache) is required.
 * The mocked functions are reassigned fresh in beforeEach so the suite's
 * restoreMocks setting can't strip their mock methods mid-run.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

vi.mock('../../media-library/model', () => ({
    get_media_record: vi.fn()
}));

vi.mock('../../media-library/uploads', () => ({
    resolve_storage_path: vi.fn()
}));

const TMP_ROOT = path.join(os.tmpdir(), `iiif-service-test-${process.pid}-${Date.now()}`);
process.env.STORAGE_PATH = TMP_ROOT;

const MEDIA_MODEL = require('../../media-library/model');
const UPLOADS = require('../../media-library/uploads');
const IIIF_SERVICE = require('../../media-library/iiif-service');

const UUID = 'a3f7b2c1-89d4-4e2a-b5c6-1234abcd5678';
const SOURCE_PATH = path.join(TMP_ROOT, 'source.png');

const make_record = (updated) => ({
    success: true,
    record: {
        uuid: UUID,
        media_type: 'image',
        storage_path: 'images/a3/f7/source.png',
        updated
    }
});

// Fresh mocks each test (robust to the suite-wide restoreMocks/clearMocks).
const reset_source_mock = () => {
    UPLOADS.resolve_storage_path = vi.fn().mockResolvedValue(SOURCE_PATH);
};

beforeAll(async () => {
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    const png = await sharp({
        create: { width: 300, height: 200, channels: 3, background: { r: 200, g: 30, b: 30 } }
    }).png().toBuffer();
    fs.writeFileSync(SOURCE_PATH, png);
});

afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
    reset_source_mock();
    MEDIA_MODEL.get_media_record = vi.fn().mockResolvedValue(make_record('2026-06-15T10:00:00Z'));
});

describe('get_image — derivative cache', () => {

    it('transcodes on miss, then serves an identical request from cache without re-reading the source', async () => {
        const first = await IIIF_SERVICE.get_image(UUID, 'full', '!100,100', '0', 'default.jpg');

        expect(first.success).toBe(true);
        expect(Buffer.isBuffer(first.image)).toBe(true);
        expect(first.content_type).toBe('image/jpeg');
        expect(first.etag).toMatch(/^".*"$/);
        expect(first.cached).toBe(false);
        expect(UPLOADS.resolve_storage_path).toHaveBeenCalledTimes(1); // source read once

        reset_source_mock(); // isolate the next call's count
        const second = await IIIF_SERVICE.get_image(UUID, 'full', '!100,100', '0', 'default.jpg');

        expect(second.success).toBe(true);
        expect(second.cached).toBe(true);
        expect(second.etag).toBe(first.etag);
        expect(second.image.equals(first.image)).toBe(true);
        expect(UPLOADS.resolve_storage_path).toHaveBeenCalledTimes(0); // hit never touches the original
    });

    it('answers a matching If-None-Match with not_modified and no body', async () => {
        const seed = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg');

        reset_source_mock(); // isolate the conditional call's count
        const conditional = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.jpg', {
            if_none_match: seed.etag
        });

        expect(conditional.success).toBe(true);
        expect(conditional.not_modified).toBe(true);
        expect(conditional.image).toBeNull();
        expect(conditional.etag).toBe(seed.etag);
        expect(UPLOADS.resolve_storage_path).toHaveBeenCalledTimes(0); // 304 resolves before any read
    });

    it('a non-matching If-None-Match still returns the image', async () => {
        const result = await IIIF_SERVICE.get_image(UUID, 'full', '!50,50', '0', 'default.jpg', {
            if_none_match: '"stale-etag"'
        });
        expect(result.success).toBe(true);
        expect(result.not_modified).toBeUndefined();
        expect(Buffer.isBuffer(result.image)).toBe(true);
    });

    it('a new record version invalidates the cache (re-reads and re-transcodes)', async () => {
        await IIIF_SERVICE.get_image(UUID, 'full', '!120,120', '0', 'default.jpg'); // populate v1

        // Same params, newer `updated` => different version => miss
        reset_source_mock();
        MEDIA_MODEL.get_media_record = vi.fn().mockResolvedValue(make_record('2026-06-16T12:00:00Z'));
        const after = await IIIF_SERVICE.get_image(UUID, 'full', '!120,120', '0', 'default.jpg');

        expect(after.success).toBe(true);
        expect(after.cached).toBe(false);
        expect(UPLOADS.resolve_storage_path).toHaveBeenCalledTimes(1); // source read again
    });

    it('honors quality/format — grayscale PNG round-trips through the cache', async () => {
        const first = await IIIF_SERVICE.get_image(UUID, 'full', '!80,80', '0', 'gray.png');
        expect(first.success).toBe(true);
        expect(first.content_type).toBe('image/png');

        const second = await IIIF_SERVICE.get_image(UUID, 'full', '!80,80', '0', 'gray.png');
        expect(second.cached).toBe(true);
        expect(second.content_type).toBe('image/png');
        expect(second.image.equals(first.image)).toBe(true);
    });

    it('preserves the validation contract', async () => {
        const bad_uuid = await IIIF_SERVICE.get_image('not-a-uuid', 'full', 'max', '0', 'default.jpg');
        expect(bad_uuid.success).toBe(false);

        const bad_format = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '0', 'default.tiff');
        expect(bad_format.success).toBe(false);

        const bad_rotation = await IIIF_SERVICE.get_image(UUID, 'full', 'max', '90', 'default.jpg');
        expect(bad_rotation.success).toBe(false);
    });
});
