'use strict';

/**
 * IIIF derivative cache (media-library/iiif-cache.js).
 *
 * Guards the fix for "IIIF re-reads + re-transcodes originals on every request,
 * no server-side derivative cache":
 *  - the cache key is deterministic in (uuid, version, region, size, rotation,
 *    quality.format) and filesystem-safe;
 *  - put/get is an atomic round trip;
 *  - a new record version (the `updated` timestamp) yields a new cache path, so
 *    a stale derivative can never be served;
 *  - purge() drops every version/variant for a UUID;
 *  - the ETag tracks the same key (changes iff the bytes would).
 *
 * The cache root is pointed at a throwaway temp directory via STORAGE_PATH,
 * which the module reads at load — so the env is set BEFORE the require below.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const TMP_ROOT = path.join(os.tmpdir(), `iiif-cache-test-${process.pid}-${Date.now()}`);
process.env.STORAGE_PATH = TMP_ROOT;

const IIIF_CACHE = require('../../media-library/iiif-cache');

const UUID = 'a3f7b2c1-89d4-4e2a-b5c6-1234abcd5678';
const V1 = '2026-06-15T10:00:00Z';
const V2 = '2026-06-16T10:00:00Z';

afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe('iiif-cache key helpers', () => {

    it('normalize_version maps a date to a stable epoch string and absent to "0"', () => {
        const a = IIIF_CACHE.normalize_version(V1);
        const b = IIIF_CACHE.normalize_version(new Date(V1));
        expect(a).toBe(b);                       // string and Date forms agree
        expect(a).toMatch(/^\d+$/);
        expect(IIIF_CACHE.normalize_version(null)).toBe('0');
        expect(IIIF_CACHE.normalize_version(undefined)).toBe('0');
        expect(IIIF_CACHE.normalize_version('')).toBe('0');
    });

    it('variant_digest is deterministic, 16-hex, and param-sensitive', () => {
        const d1 = IIIF_CACHE.variant_digest('full', '!400,400', '0', 'default.jpg');
        const d2 = IIIF_CACHE.variant_digest('full', '!400,400', '0', 'default.jpg');
        const d3 = IIIF_CACHE.variant_digest('full', 'max', '0', 'default.jpg');
        expect(d1).toBe(d2);
        expect(d1).not.toBe(d3);
        expect(d1).toMatch(/^[0-9a-f]{16}$/);
    });

    it('derivative_path nests by buckets/uuid/version/variant with the right extension', () => {
        const p_jpg = IIIF_CACHE.derivative_path(UUID, V1, 'full', 'max', '0', 'default.jpg');
        expect(p_jpg.startsWith(path.join(TMP_ROOT, 'iiif_cache'))).toBe(true);
        expect(p_jpg).toContain(path.join('a3', 'f7', UUID));
        expect(p_jpg).toContain(IIIF_CACHE.normalize_version(V1));
        expect(p_jpg.endsWith('.jpg')).toBe(true);

        expect(IIIF_CACHE.derivative_path(UUID, V1, 'full', 'max', '0', 'gray.png').endsWith('.png')).toBe(true);
        expect(IIIF_CACHE.derivative_path(UUID, V1, 'full', 'max', '0', 'color.webp').endsWith('.webp')).toBe(true);
    });

    it('compute_etag is quoted and changes with version and with params', () => {
        const e1 = IIIF_CACHE.compute_etag(UUID, V1, 'full', 'max', '0', 'default.jpg');
        const e2 = IIIF_CACHE.compute_etag(UUID, V2, 'full', 'max', '0', 'default.jpg');
        const e3 = IIIF_CACHE.compute_etag(UUID, V1, 'full', '!400,400', '0', 'default.jpg');
        expect(e1).toMatch(/^".*"$/);
        expect(e1).not.toBe(e2);   // version bump
        expect(e1).not.toBe(e3);   // param change
        expect(IIIF_CACHE.compute_etag(UUID, V1, 'full', 'max', '0', 'default.jpg')).toBe(e1); // stable
    });
});

describe('iiif-cache put/get/purge', () => {

    it('round-trips a derivative: put then get returns identical bytes and writes the file', async () => {
        const bytes = Buffer.from('pretend-jpeg-bytes-0123456789');
        const ok = await IIIF_CACHE.put_cached(UUID, V1, 'full', '!400,400', '0', 'default.jpg', bytes);
        expect(ok).toBe(true);

        const got = await IIIF_CACHE.get_cached(UUID, V1, 'full', '!400,400', '0', 'default.jpg');
        expect(Buffer.isBuffer(got)).toBe(true);
        expect(got.equals(bytes)).toBe(true);

        const on_disk = IIIF_CACHE.derivative_path(UUID, V1, 'full', '!400,400', '0', 'default.jpg');
        expect(fs.existsSync(on_disk)).toBe(true);
    });

    it('get returns null for an uncached variant (miss)', async () => {
        const got = await IIIF_CACHE.get_cached(UUID, V1, 'full', 'max', '0', 'default.jpg');
        expect(got).toBeNull();
    });

    it('a new version is a cache miss — the prior version is never served for it', async () => {
        const bytes = Buffer.from('v1-bytes');
        await IIIF_CACHE.put_cached(UUID, V1, 'square', '200,200', '0', 'default.jpg', bytes);

        // Same params, different version => different path => miss
        const miss = await IIIF_CACHE.get_cached(UUID, V2, 'square', '200,200', '0', 'default.jpg');
        expect(miss).toBeNull();

        // The V1 derivative is still retrievable under V1
        const hit = await IIIF_CACHE.get_cached(UUID, V1, 'square', '200,200', '0', 'default.jpg');
        expect(hit.equals(bytes)).toBe(true);
    });

    it('purge removes every version and variant for a uuid', async () => {
        await IIIF_CACHE.put_cached(UUID, V1, 'full', 'max', '0', 'default.jpg', Buffer.from('a'));
        await IIIF_CACHE.put_cached(UUID, V2, 'full', 'max', '0', 'default.jpg', Buffer.from('b'));
        await IIIF_CACHE.put_cached(UUID, V2, 'full', '!400,400', '0', 'gray.png', Buffer.from('c'));

        const purged = await IIIF_CACHE.purge(UUID);
        expect(purged).toBe(true);

        expect(await IIIF_CACHE.get_cached(UUID, V1, 'full', 'max', '0', 'default.jpg')).toBeNull();
        expect(await IIIF_CACHE.get_cached(UUID, V2, 'full', 'max', '0', 'default.jpg')).toBeNull();
        expect(await IIIF_CACHE.get_cached(UUID, V2, 'full', '!400,400', '0', 'gray.png')).toBeNull();

        const [b1, b2] = IIIF_CACHE.get_hash_buckets(UUID);
        expect(fs.existsSync(path.join(TMP_ROOT, 'iiif_cache', b1, b2, UUID))).toBe(false);
    });

    it('purge of an unknown uuid is a no-op success', async () => {
        expect(await IIIF_CACHE.purge('ffffffff-ffff-4fff-bfff-ffffffffffff')).toBe(true);
    });

    it('refuses to cache a non-buffer or empty payload', async () => {
        expect(await IIIF_CACHE.put_cached(UUID, V1, 'full', 'max', '0', 'default.jpg', 'not-a-buffer')).toBe(false);
        expect(await IIIF_CACHE.put_cached(UUID, V1, 'full', 'max', '0', 'default.jpg', Buffer.alloc(0))).toBe(false);
    });
});
