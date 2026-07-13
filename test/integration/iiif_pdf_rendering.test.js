'use strict';

/**
 * IIIF PDF delivery — regression pins for the public rendering flow.
 *
 * Context: the public PDF manifest's "rendering" (Download PDF) resource once
 * pointed at the token-gated, CORS-less /api/v1/media/library/file endpoint,
 * so cross-origin frontend fetches were blocked by the browser. The manifest
 * now points at the public GET <APP_PATH>/iiif/:media_id/file route, which
 * serves uploaded PDFs with the same public/CORS posture as the manifest.
 */

jest.mock('../../libs/log4', () => ({
    module: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../media-library/model', () => ({
    get_media_record: jest.fn()
}));

jest.mock('../../media-library/uploads', () => ({
    resolve_storage_path: jest.fn()
}));

jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        statSync: jest.fn(),
        createReadStream: jest.fn()
    };
});

process.env.ELASTICSEARCH_HOST = process.env.ELASTICSEARCH_HOST || 'http://es.test:9200';
process.env.REPO_ELASTICSEARCH_INDEX = process.env.REPO_ELASTICSEARCH_INDEX || 'repo-test';

const FS = require('fs');
const MEDIA_MODEL = require('../../media-library/model');
const UPLOADS = require('../../media-library/uploads');
const CONTROLLER = require('../../media-library/controller');
const IIIF_SERVICE = require('../../media-library/iiif-service');

const PDF_UUID = 'eca4e8ba-b96a-4a6c-920c-0b5f5e88d6d0';

const pdf_record = (overrides = {}) => ({
    uuid: PDF_UUID,
    name: 'Test PDF',
    ingest_method: 'upload',
    mime_type: 'application/pdf',
    media_type: 'pdf',
    storage_path: 'documents/ec/a4/test.pdf',
    original_filename: 'test.pdf',
    thumbnail_path: 'thumbnails/ec/a4/test.jpg',
    ...overrides
});

const mock_res = () => {
    const res = {
        headersSent: false,
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };
    return res;
};

describe('IIIF manifest rendering URL (PDF)', () => {

    beforeEach(() => jest.clearAllMocks());

    test('points the Download PDF rendering at the public /iiif/:id/file route', async () => {
        MEDIA_MODEL.get_media_record.mockResolvedValue({ success: true, record: pdf_record() });

        const result = await IIIF_SERVICE.build_manifest_for_uuid(
            PDF_UUID,
            `http://host/exhibits-dashboard/iiif/${PDF_UUID}`,
            'http://host/exhibits-dashboard'
        );

        expect(result.success).toBe(true);
        const canvas = result.manifest.items[0];
        expect(canvas.rendering[0].id).toBe(`http://host/exhibits-dashboard/iiif/${PDF_UUID}/file`);
        expect(canvas.rendering[0].format).toBe('application/pdf');
        expect(canvas.rendering[0].id).not.toContain('/api/v1/');
    });
});

describe('get_iiif_file (public PDF delivery)', () => {

    beforeEach(() => jest.clearAllMocks());

    test('serves an uploaded PDF with CORS + inline headers and streams it', async () => {
        MEDIA_MODEL.get_media_record.mockResolvedValue({ success: true, record: pdf_record() });
        UPLOADS.resolve_storage_path.mockResolvedValue('/resolved/test.pdf');
        FS.statSync.mockReturnValue({ isFile: () => true, size: 1234 });
        const stream = { on: jest.fn().mockReturnThis(), pipe: jest.fn() };
        FS.createReadStream.mockReturnValue(stream);

        const res = mock_res();
        await CONTROLLER.get_iiif_file({ params: { media_id: PDF_UUID } }, res);

        expect(res.set).toHaveBeenCalledTimes(1);
        const headers = res.set.mock.calls[0][0];
        expect(headers['Access-Control-Allow-Origin']).toBe('*');
        expect(headers['Content-Type']).toBe('application/pdf');
        expect(headers['Content-Disposition']).toMatch(/^inline;/);
        expect(stream.pipe).toHaveBeenCalledWith(res);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('refuses repository-ingested records with 404', async () => {
        MEDIA_MODEL.get_media_record.mockResolvedValue({
            success: true,
            record: pdf_record({ ingest_method: 'repository' })
        });

        const res = mock_res();
        await CONTROLLER.get_iiif_file({ params: { media_id: PDF_UUID } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(FS.createReadStream).not.toHaveBeenCalled();
    });

    test('refuses non-PDF uploads with 404', async () => {
        MEDIA_MODEL.get_media_record.mockResolvedValue({
            success: true,
            record: pdf_record({ mime_type: 'image/jpeg', media_type: 'image' })
        });

        const res = mock_res();
        await CONTROLLER.get_iiif_file({ params: { media_id: PDF_UUID } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('rejects an invalid UUID with 400 before any lookup', async () => {
        const res = mock_res();
        await CONTROLLER.get_iiif_file({ params: { media_id: 'not-a-uuid' } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(MEDIA_MODEL.get_media_record).not.toHaveBeenCalled();
    });
});
