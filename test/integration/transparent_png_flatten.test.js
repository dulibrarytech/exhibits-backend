'use strict';

/**
 * Transparency regression pins.
 *
 * Uploaded transparent PNGs once produced JPEG derivatives with BLACK
 * backgrounds: sharp drops the alpha channel when encoding JPEG and
 * composites onto black unless .flatten({background}) runs first. The
 * thumbnail pipelines and the IIIF Image API jpeg branch now flatten to
 * white; the IIIF png branch must keep alpha untouched.
 *
 * These tests run REAL sharp end-to-end through the exported functions and
 * assert actual pixels.
 */

const OS = require('os');
const PATH = require('path');
const FS = require('fs');

const TMP_STORAGE = FS.mkdtempSync(PATH.join(OS.tmpdir(), 'pw-flatten-'));
process.env.STORAGE_PATH = TMP_STORAGE;
process.env.ELASTICSEARCH_HOST = process.env.ELASTICSEARCH_HOST || 'http://es.test:9200';

jest.mock('../../libs/log4', () => ({
    module: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../media-library/model', () => ({
    get_media_record: jest.fn()
}));

const sharp = require('sharp');
const UPLOADS = require('../../media-library/uploads');
const MEDIA_MODEL = require('../../media-library/model');

const PNG_UUID = 'dddddddd-4444-4444-8444-444444444444';

const make_transparent_png = async () => {
    const svg = '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">'
        + '<circle cx="100" cy="100" r="60" fill="#c00"/></svg>';
    return sharp(Buffer.from(svg)).png().toBuffer();
};

const corner_pixel = async (input) => {
    const { data } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
    return [data[0], data[1], data[2]];
};

afterAll(async () => {
    await UPLOADS.shutdown_exiftool().catch(() => {});
    FS.rmSync(TMP_STORAGE, { recursive: true, force: true });
});

describe('upload thumbnail pipeline flattens transparency to white', () => {

    test('generate_image_thumbnail produces a white (not black) background from a transparent PNG', async () => {
        const png = await make_transparent_png();

        const thumb_path = await UPLOADS.generate_image_thumbnail(png, PNG_UUID);

        expect(thumb_path).toBeTruthy();
        const [r, g, b] = await corner_pixel(thumb_path);
        expect(r).toBeGreaterThan(240);
        expect(g).toBeGreaterThan(240);
        expect(b).toBeGreaterThan(240);
    });
});

describe('IIIF Image API transparency handling', () => {

    const arrange_record = async () => {
        const png = await make_transparent_png();
        const rel = 'images/dd/dd/source.png';
        const abs = PATH.join(TMP_STORAGE, rel);
        FS.mkdirSync(PATH.dirname(abs), { recursive: true });
        FS.writeFileSync(abs, png);
        MEDIA_MODEL.get_media_record.mockResolvedValue({
            success: true,
            record: {
                uuid: PNG_UUID,
                ingest_method: 'upload',
                mime_type: 'image/png',
                media_type: 'image',
                storage_path: rel,
                updated: '2026-07-13T00:00:00Z'
            }
        });
    };

    test('default.jpg output flattens transparency to white', async () => {
        await arrange_record();
        const IIIF_SERVICE = require('../../media-library/iiif-service');

        const result = await IIIF_SERVICE.get_image(PNG_UUID, 'full', 'max', '0', 'default.jpg');

        expect(result.success).toBe(true);
        const [r, g, b] = await corner_pixel(result.image);
        expect(r).toBeGreaterThan(240);
        expect(g).toBeGreaterThan(240);
        expect(b).toBeGreaterThan(240);
    });

    test('default.png output preserves the alpha channel (no flatten)', async () => {
        await arrange_record();
        const IIIF_SERVICE = require('../../media-library/iiif-service');

        const result = await IIIF_SERVICE.get_image(PNG_UUID, 'full', 'max', '0', 'default.png');

        expect(result.success).toBe(true);
        const meta = await sharp(result.image).metadata();
        expect(meta.hasAlpha).toBe(true);
    });
});
