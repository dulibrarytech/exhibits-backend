/**
 * Route-mounting Integration Tests for Media Library Routes
 *
 * Mounts the REAL media-library/routes.js (real endpoints module, real
 * controller) with the model and the repo/Kaltura/IIIF services mocked.
 * Covers all 20 registered routes: registration order (duplicate-check
 * before :media_id), the auth-transport split (verify vs
 * verify_with_query vs the public IIIF routes), validation, authorize
 * gating, file serving via a real temp file, and the IIIF status
 * tagging / ETag / 304 contracts.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const FS = require('fs');
const OS = require('os');
const PATH = require('path');

/*
 * Requiring the shared mocks pins APP_PATH before any endpoints module is
 * loaded; the jest.mock factories below are hoisted and resolve it lazily.
 */
const { APP_PATH, TEST_USER_UID, path_for, mock_model } = require('./helpers/mocks');

const TEST_MEDIA_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_EXHIBIT_ID = '660e8400-e29b-41d4-a716-446655440100';
const TEST_REPO_UUID = '770e8400-e29b-41d4-a716-446655440200';

jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());

jest.mock('../../libs/tokens', () => require('./helpers/mocks').tokens_factory({ methods: ['verify', 'verify_with_query'] }));

jest.mock('../../auth/authorize', () => require('./helpers/mocks').authorize_factory());

jest.mock('../../config/rate_limits_loader', () => require('./helpers/mocks').rate_limits_factory([
    'read_operations',
    'write_operations',
    'media_operations',
    'iiif_image_operations'
]));

jest.mock('../../config/kaltura_config', () => () => ({
    kaltura_partner_id: '1234567',
    kaltura_conf_ui_id: '7654321'
}));

const mockMediaModel = mock_model([
    'get_media_records',
    'get_media_records_browse',
    'get_media_record',
    'create_media_record',
    'update_media_record',
    'replace_media_file',
    'delete_media_record',
    'delete_uploaded_file',
    'check_duplicate',
    'add_exhibit_to_media_record',
    'remove_exhibit_from_media_record'
]);

jest.mock('../../media-library/model', () => mockMediaModel);

const mockRepoService = mock_model([
    'search_repository',
    'get_repo_tn',
    'get_subjects',
    'get_resource_types'
]);

jest.mock('../../media-library/repo-service', () => mockRepoService);

const mockKalturaService = mock_model([
    'get_kaltura_media',
    'get_kaltura_original_filename',
    'assign_kaltura_category',
    'remove_kaltura_category'
]);

jest.mock('../../media-library/kaltura-service', () => mockKalturaService);

const mockIiifService = mock_model(['build_manifest_for_uuid', 'get_info', 'get_image'], {}, {
    derive_iiif_base: 'http://test.host/exhibits-dashboard/iiif',
    derive_file_base: 'http://test.host/exhibits-dashboard/iiif'
});

jest.mock('../../media-library/iiif-service', () => mockIiifService);

const mockUploads = {
    resolve_storage_path: jest.fn(),
    // The replace route pulls its permission gate, single-file multer parser,
    // and multer error handler from the uploads module at registration time.
    // The permission gate mirrors the real middleware's contract (delegates
    // to authorize with the update-media permissions and the path media_id)
    // so route tests can drive it through the shared authorize mock.
    require_update_media_permission: jest.fn(async (req, res, next) => {
        const AUTHORIZE = require('../../auth/authorize');
        const is_authorized = await AUTHORIZE.check_permission({
            req,
            permissions: ['can_update_any_media', 'can_update_media'],
            record_type: 'media',
            parent_id: req.params.media_id || null,
            child_id: null
        });
        if (is_authorized !== true) {
            return res.status(403).json({ success: false, message: 'Unauthorized request', data: null });
        }
        return next();
    }),
    upload_single: jest.fn((req, res, next) => next()),
    handle_upload_error: jest.fn((err, req, res, next) => res.status(500).json({ error: 'Upload failed', code: 'UPLOAD_ERROR' }))
};

jest.mock('../../media-library/uploads', () => mockUploads);

const ENDPOINTS = require('../../media-library/endpoints')();

describe('Media Library Routes Integration (real router)', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;
    let temp_file;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const routes = require('../../media-library/routes');
        routes(app);

        AUTHORIZE = require('../../auth/authorize');
        TOKEN = require('../../libs/tokens');

        // Real file on disk so the streaming happy paths exercise the
        // full header + pipe flow.
        temp_file = PATH.join(OS.tmpdir(), `media-routes-test-${process.pid}.jpg`);
        FS.writeFileSync(temp_file, Buffer.from('fake-jpeg-bytes'));
    });

    afterAll(() => {
        try { FS.unlinkSync(temp_file); } catch (e) { /* already gone */ }
    });

    beforeEach(() => {
        jest.clearAllMocks();

        AUTHORIZE.check_permission.mockResolvedValue(true);
        TOKEN.verify.mockImplementation((req, res, next) => {
            req.decoded = { sub: TEST_USER_UID };
            next();
        });
        TOKEN.verify_with_query.mockImplementation((req, res, next) => {
            req.decoded = { sub: TEST_USER_UID };
            next();
        });
        mockIiifService.derive_iiif_base.mockReturnValue('http://test.host/exhibits-dashboard/iiif');
        mockIiifService.derive_file_base.mockReturnValue('http://test.host/exhibits-dashboard/iiif');
        mockUploads.upload_single.mockImplementation((req, res, next) => next());
    });

    // ==================== AUTH TRANSPORT SPLIT ====================

    describe('Auth middleware selection', () => {

        test('record CRUD routes gate on TOKEN.verify (header/cookie only)', async () => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.media_record.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(401);
            expect(TOKEN.verify_with_query).not.toHaveBeenCalled();
            expect(mockMediaModel.get_media_record).not.toHaveBeenCalled();
        });

        test('file/thumbnail routes gate on verify_with_query (img-src transport)', async () => {
            TOKEN.verify_with_query.mockImplementation((req, res) => {
                res.status(401).json({ success: false, message: 'No token provided', data: null });
            });

            for (const template of [
                path_for(ENDPOINTS.media_file.get.endpoint, { media_id: TEST_MEDIA_ID }),
                path_for(ENDPOINTS.media_thumbnail.get.endpoint, { media_id: TEST_MEDIA_ID }),
                ENDPOINTS.upload.get.endpoint,
                ENDPOINTS.repo_thumbnail.get.endpoint
            ]) {
                const response = await request(app).get(template);
                expect(response.status).toBe(401);
            }
            expect(TOKEN.verify).not.toHaveBeenCalled();
        });

        test('IIIF manifest route is public — reachable even when verify would reject', async () => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            TOKEN.verify_with_query.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            mockIiifService.build_manifest_for_uuid.mockResolvedValue({
                success: true,
                manifest: { id: 'manifest-id', type: 'Manifest' }
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.iiif_manifest.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(200);
            expect(TOKEN.verify).not.toHaveBeenCalled();
            expect(TOKEN.verify_with_query).not.toHaveBeenCalled();
        });
    });

    // ==================== RECORD CRUD ====================

    describe('Media record CRUD routes', () => {

        test('GET media records returns the full list', async () => {
            mockMediaModel.get_media_records.mockResolvedValue({
                success: true, message: 'ok', records: [{ uuid: TEST_MEDIA_ID }]
            });

            const response = await request(app).get(ENDPOINTS.media_records.get.endpoint);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
        });

        test('GET media records with pagination params dispatches to the browse method', async () => {
            mockMediaModel.get_media_records_browse.mockResolvedValue({
                success: true, message: 'ok', records: [], total: 0, page: 2, limit: 10
            });

            const response = await request(app)
                .get(ENDPOINTS.media_records.get.endpoint)
                .query({ page: 2, limit: 10, q: 'photo' });

            expect(response.status).toBe(200);
            expect(mockMediaModel.get_media_records_browse).toHaveBeenCalledWith(
                expect.objectContaining({ page: '2', limit: '10', q: 'photo' })
            );
            expect(mockMediaModel.get_media_records).not.toHaveBeenCalled();
        });

        test('POST media record authorizes, stamps the token subject, and returns 201', async () => {
            mockMediaModel.create_media_record.mockResolvedValue({
                success: true, message: 'created', id: TEST_MEDIA_ID
            });

            const response = await request(app)
                .post(ENDPOINTS.media_records.post.endpoint)
                .send({ name: 'Test media', ingest_method: 'upload' });

            expect(response.status).toBe(201);
            expect(response.body.data).toBe(TEST_MEDIA_ID);
            expect(mockMediaModel.create_media_record).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Test media', username: TEST_USER_UID })
            );
        });

        test('POST media record returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .post(ENDPOINTS.media_records.post.endpoint)
                .send({ name: 'Test media' });

            expect(response.status).toBe(403);
            expect(mockMediaModel.create_media_record).not.toHaveBeenCalled();
        });

        test('POST media record rejects an empty body with 400 before authorizing', async () => {
            const response = await request(app)
                .post(ENDPOINTS.media_records.post.endpoint)
                .send({});

            expect(response.status).toBe(400);
            expect(AUTHORIZE.check_permission).not.toHaveBeenCalled();
        });

        test('GET single media record maps the path param through to the model', async () => {
            mockMediaModel.get_media_record.mockResolvedValue({
                success: true, message: 'ok', record: { uuid: TEST_MEDIA_ID }
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.media_record.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(200);
            expect(mockMediaModel.get_media_record).toHaveBeenCalledWith(TEST_MEDIA_ID);
        });

        test('PUT media record authorizes then passes id and body to the model', async () => {
            mockMediaModel.update_media_record.mockResolvedValue({
                success: true, message: 'updated', record: { uuid: TEST_MEDIA_ID }
            });

            const response = await request(app)
                .put(path_for(ENDPOINTS.media_records.put.endpoint, { media_id: TEST_MEDIA_ID }))
                .send({ name: 'Renamed' });

            expect(response.status).toBe(200);
            expect(mockMediaModel.update_media_record).toHaveBeenCalledWith(
                TEST_MEDIA_ID,
                expect.objectContaining({ name: 'Renamed', username: TEST_USER_UID })
            );
        });

        test('DELETE media record authorizes then soft-deletes with the actor', async () => {
            mockMediaModel.delete_media_record.mockResolvedValue({ success: true, message: 'deleted' });

            const response = await request(app)
                .delete(path_for(ENDPOINTS.media_records.delete.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(200);
            expect(mockMediaModel.delete_media_record).toHaveBeenCalledWith(TEST_MEDIA_ID, TEST_USER_UID);
        });

        test('DELETE media record returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .delete(path_for(ENDPOINTS.media_records.delete.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(403);
            expect(mockMediaModel.delete_media_record).not.toHaveBeenCalled();
        });

        /*
         * The record routes used to accept any non-empty string as a media id and
         * let the model decide, while the file / thumbnail / IIIF routes required a
         * UUID — the same path parameter, two rules (DRY review 2026-09-03, bug #7).
         * They now share libs/uuid, so a malformed id is rejected before the model
         * and before authorization runs.
         */
        test('the record routes reject a malformed media id with 400, ahead of the model and the gate', async () => {
            const requests = [
                () => request(app).get(path_for(ENDPOINTS.media_record.get.endpoint, { media_id: 'not-a-uuid' })),
                () => request(app).put(path_for(ENDPOINTS.media_records.put.endpoint, { media_id: 'not-a-uuid' })).send({ name: 'x' }),
                () => request(app).delete(path_for(ENDPOINTS.media_records.delete.endpoint, { media_id: 'not-a-uuid' }))
            ];

            for (const send of requests) {
                const response = await send();

                expect(response.status).toBe(400);
                expect(response.body.message).toBe('Bad request. Missing or invalid media ID.');
            }

            expect(mockMediaModel.get_media_record).not.toHaveBeenCalled();
            expect(mockMediaModel.update_media_record).not.toHaveBeenCalled();
            expect(mockMediaModel.delete_media_record).not.toHaveBeenCalled();
            expect(AUTHORIZE.check_permission).not.toHaveBeenCalled();
        });
    });

    // ==================== DUPLICATE CHECK (registration order) ====================

    describe('Duplicate check route', () => {

        test('is matched ahead of the :media_id record route', async () => {
            mockMediaModel.check_duplicate.mockResolvedValue({
                success: true, message: 'ok', exists: true, record: { uuid: TEST_MEDIA_ID }
            });

            const response = await request(app)
                .get(ENDPOINTS.media_duplicate_check.get.endpoint)
                .query({ field: 'repo_uuid', value: TEST_REPO_UUID });

            expect(response.status).toBe(200);
            expect(response.body.data.exists).toBe(true);
            expect(mockMediaModel.check_duplicate).toHaveBeenCalledWith('repo_uuid', TEST_REPO_UUID);
            expect(mockMediaModel.get_media_record).not.toHaveBeenCalled();
        });

        test('rejects an unknown field with 400', async () => {
            const response = await request(app)
                .get(ENDPOINTS.media_duplicate_check.get.endpoint)
                .query({ field: 'uuid', value: 'x' });

            expect(response.status).toBe(400);
            expect(mockMediaModel.check_duplicate).not.toHaveBeenCalled();
        });
    });

    // ==================== UPLOAD STAGING ====================

    describe('Staged upload routes', () => {

        test('DELETE /upload removes the staged file after authorizing', async () => {
            mockMediaModel.delete_uploaded_file.mockResolvedValue({ success: true, message: 'removed' });

            const response = await request(app)
                .delete(ENDPOINTS.upload.delete.endpoint)
                .send({ storage_path: 'staging/file.jpg', thumbnail_path: 'staging/file-tn.jpg' });

            expect(response.status).toBe(200);
            expect(mockMediaModel.delete_uploaded_file).toHaveBeenCalledWith('staging/file.jpg', 'staging/file-tn.jpg');
        });

        test('DELETE /upload rejects a missing storage_path with 400', async () => {
            const response = await request(app)
                .delete(ENDPOINTS.upload.delete.endpoint)
                .send({});

            expect(response.status).toBe(400);
            expect(mockMediaModel.delete_uploaded_file).not.toHaveBeenCalled();
        });

        test('GET /upload/thumbnail serves the staged thumbnail from disk', async () => {
            mockUploads.resolve_storage_path.mockResolvedValue(temp_file);

            const response = await request(app)
                .get(ENDPOINTS.upload.get.endpoint)
                .query({ path: 'staging/file-tn.jpg' });

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('image/jpeg');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });

        test('GET /upload/thumbnail rejects traversal attempts with 400 before touching the filesystem', async () => {
            for (const hostile of ['../secrets.txt', '/etc/passwd']) {
                const response = await request(app)
                    .get(ENDPOINTS.upload.get.endpoint)
                    .query({ path: hostile });

                expect(response.status).toBe(400);
            }
            expect(mockUploads.resolve_storage_path).not.toHaveBeenCalled();
        });
    });

    // ==================== EXHIBIT ASSOCIATIONS ====================

    describe('Replace file route', () => {

        const replace_path = () => path_for(ENDPOINTS.media_file_replace.post.endpoint, { media_id: TEST_MEDIA_ID });

        const attach_file = () => {
            mockUploads.upload_single.mockImplementation((req, res, next) => {
                req.file = {
                    buffer: Buffer.from('new-file-bytes'),
                    originalname: 'better-version.jpg',
                    mimetype: 'image/jpeg'
                };
                next();
            });
        };

        test('POST replace authorizes, parses the file, and passes id/file/actor to the model', async () => {
            attach_file();
            mockMediaModel.replace_media_file.mockResolvedValue({
                success: true,
                message: 'File replaced successfully',
                record: { uuid: TEST_MEDIA_ID, original_filename: 'better-version.jpg' }
            });

            const response = await request(app).post(replace_path());

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('File replaced successfully');
            expect(mockMediaModel.replace_media_file).toHaveBeenCalledTimes(1);

            const [media_id, file, username] = mockMediaModel.replace_media_file.mock.calls[0];
            expect(media_id).toBe(TEST_MEDIA_ID);
            expect(file.originalname).toBe('better-version.jpg');
            expect(username).toBe(TEST_USER_UID);
        });

        test('POST replace gates on the update-media permission BEFORE the file is parsed', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);
            attach_file();

            const response = await request(app).post(replace_path());

            expect(response.status).toBe(403);
            expect(AUTHORIZE.check_permission).toHaveBeenCalledWith(expect.objectContaining({
                permissions: ['can_update_any_media', 'can_update_media'],
                parent_id: TEST_MEDIA_ID
            }));
            expect(mockUploads.upload_single).not.toHaveBeenCalled();
            expect(mockMediaModel.replace_media_file).not.toHaveBeenCalled();
        });

        test('POST replace rejects a request with no file with 400 before reaching the model', async () => {
            const response = await request(app).post(replace_path());

            expect(response.status).toBe(400);
            expect(response.body.message).toMatch(/No replacement file/);
            expect(mockMediaModel.replace_media_file).not.toHaveBeenCalled();
        });

        test('POST replace maps a missing record to 404', async () => {
            attach_file();
            mockMediaModel.replace_media_file.mockResolvedValue({
                success: false,
                message: 'Media record not found'
            });

            const response = await request(app).post(replace_path());

            expect(response.status).toBe(404);
        });

        test('POST replace maps a guard rejection (wrong type / non-upload) to 400', async () => {
            attach_file();
            mockMediaModel.replace_media_file.mockResolvedValue({
                success: false,
                message: 'Only uploaded media files can be replaced'
            });

            const response = await request(app).post(replace_path());

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Only uploaded media files can be replaced');
        });
    });

    describe('Media exhibits route', () => {

        test('PUT with action=add maps to the add association model call', async () => {
            mockMediaModel.add_exhibit_to_media_record.mockResolvedValue({
                success: true, message: 'added', exhibits: [TEST_EXHIBIT_ID]
            });

            const response = await request(app)
                .put(path_for(ENDPOINTS.media_exhibits.put.endpoint, { media_id: TEST_MEDIA_ID }))
                .send({ exhibit_uuid: TEST_EXHIBIT_ID, action: 'add', media_role: 'hero_image' });

            expect(response.status).toBe(200);
            expect(mockMediaModel.add_exhibit_to_media_record)
                .toHaveBeenCalledWith(TEST_MEDIA_ID, TEST_EXHIBIT_ID, 'hero_image');
        });

        test('PUT with action=remove maps to the remove association model call', async () => {
            mockMediaModel.remove_exhibit_from_media_record.mockResolvedValue({
                success: true, message: 'removed', exhibits: []
            });

            const response = await request(app)
                .put(path_for(ENDPOINTS.media_exhibits.put.endpoint, { media_id: TEST_MEDIA_ID }))
                .send({ exhibit_uuid: TEST_EXHIBIT_ID, action: 'remove' });

            expect(response.status).toBe(200);
            expect(mockMediaModel.remove_exhibit_from_media_record)
                .toHaveBeenCalledWith(TEST_MEDIA_ID, TEST_EXHIBIT_ID, null);
        });

        test('PUT rejects an unknown action with 400', async () => {
            const response = await request(app)
                .put(path_for(ENDPOINTS.media_exhibits.put.endpoint, { media_id: TEST_MEDIA_ID }))
                .send({ exhibit_uuid: TEST_EXHIBIT_ID, action: 'toggle' });

            expect(response.status).toBe(400);
        });
    });

    // ==================== FILE + THUMBNAIL SERVING ====================

    describe('Media file and thumbnail routes', () => {

        test('GET media file streams the stored file with type, disposition, and nosniff headers', async () => {
            mockMediaModel.get_media_record.mockResolvedValue({
                success: true,
                record: { storage_path: 'bucket/file.jpg', original_filename: 'photo.jpg', mime_type: 'image/jpeg' }
            });
            mockUploads.resolve_storage_path.mockResolvedValue(temp_file);

            const response = await request(app)
                .get(path_for(ENDPOINTS.media_file.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('image/jpeg');
            expect(response.headers['content-disposition']).toContain('photo.jpg');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });

        test('GET media file rejects a malformed media id with 400', async () => {
            const response = await request(app)
                .get(path_for(ENDPOINTS.media_file.get.endpoint, { media_id: 'not-a-uuid' }));

            expect(response.status).toBe(400);
            expect(mockMediaModel.get_media_record).not.toHaveBeenCalled();
        });

        test('GET media file returns 404 when the file is missing on disk', async () => {
            mockMediaModel.get_media_record.mockResolvedValue({
                success: true, record: { storage_path: 'bucket/gone.jpg' }
            });
            mockUploads.resolve_storage_path.mockRejectedValue(new Error('not found'));

            const response = await request(app)
                .get(path_for(ENDPOINTS.media_file.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(404);
        });

        test('GET thumbnail serves the local thumbnail as JPEG', async () => {
            mockMediaModel.get_media_record.mockResolvedValue({
                success: true, record: { thumbnail_path: 'bucket/file-tn.jpg' }
            });
            mockUploads.resolve_storage_path.mockResolvedValue(temp_file);

            const response = await request(app)
                .get(path_for(ENDPOINTS.media_thumbnail.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('image/jpeg');
        });

        test('GET thumbnail falls back to the repo thumbnail service for repo imports', async () => {
            mockMediaModel.get_media_record.mockResolvedValue({
                success: true, record: { thumbnail_path: null, repo_uuid: TEST_REPO_UUID }
            });
            mockRepoService.get_repo_tn.mockResolvedValue({
                success: true, thumbnail: Buffer.from('repo-tn-bytes'), mime_type: 'image/png'
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.media_thumbnail.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('image/png');
            expect(mockRepoService.get_repo_tn).toHaveBeenCalledWith(TEST_REPO_UUID);
        });

        test('GET thumbnail returns 404 when neither local nor repo thumbnail exists', async () => {
            mockMediaModel.get_media_record.mockResolvedValue({
                success: true, record: { thumbnail_path: null }
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.media_thumbnail.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(404);
        });
    });

    // ==================== REPOSITORY ROUTES ====================

    describe('Repository routes', () => {

        test('GET repo search passes term and pagination to the service', async () => {
            mockRepoService.search_repository.mockResolvedValue({
                success: true, message: 'ok', records: [{ uuid: TEST_REPO_UUID }], total: 1
            });

            const response = await request(app)
                .get(ENDPOINTS.repo_media_search.get.endpoint)
                .query({ q: 'homesteading', size: 10, from: 20 });

            expect(response.status).toBe(200);
            expect(response.body.data.total).toBe(1);
            expect(mockRepoService.search_repository).toHaveBeenCalledWith(
                'homesteading',
                { size: 10, from: 20 }
            );
        });

        test('GET repo search requires a search term', async () => {
            const response = await request(app).get(ENDPOINTS.repo_media_search.get.endpoint);

            expect(response.status).toBe(400);
            expect(mockRepoService.search_repository).not.toHaveBeenCalled();
        });

        test('GET repo search rejects an out-of-range size with 400', async () => {
            const response = await request(app)
                .get(ENDPOINTS.repo_media_search.get.endpoint)
                .query({ q: 'x', size: 500 });

            expect(response.status).toBe(400);
        });

        test('GET repo thumbnail serves the service bytes with its mime type', async () => {
            mockRepoService.get_repo_tn.mockResolvedValue({
                success: true, thumbnail: Buffer.from('tn-bytes'), mime_type: 'image/jpeg'
            });

            const response = await request(app)
                .get(ENDPOINTS.repo_thumbnail.get.endpoint)
                .query({ uuid: TEST_REPO_UUID });

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('image/jpeg');
        });

        test('GET repo thumbnail rejects a malformed uuid with 400', async () => {
            const response = await request(app)
                .get(ENDPOINTS.repo_thumbnail.get.endpoint)
                .query({ uuid: 'nope' });

            expect(response.status).toBe(400);
            expect(mockRepoService.get_repo_tn).not.toHaveBeenCalled();
        });

        test('GET subjects returns grouped subjects, optionally filtered by type', async () => {
            mockRepoService.get_subjects.mockResolvedValue({
                success: true,
                message: 'ok',
                subjects: { topical: ['History'], geographic: ['Colorado'] },
                total: 2
            });

            const all = await request(app).get(ENDPOINTS.repo_subjects.get.endpoint);
            expect(all.status).toBe(200);
            expect(all.body.data.total).toBe(2);

            const filtered = await request(app)
                .get(ENDPOINTS.repo_subjects.get.endpoint)
                .query({ type: 'geographic' });
            expect(filtered.body.data.subjects).toEqual({ geographic: ['Colorado'] });
            expect(filtered.body.data.total).toBe(1);
        });

        test('GET resource types returns the service list', async () => {
            mockRepoService.get_resource_types.mockResolvedValue({
                success: true, message: 'ok', resource_types: [{ value: 'image' }], total: 1
            });

            const response = await request(app).get(ENDPOINTS.repo_resource_types.get.endpoint);

            expect(response.status).toBe(200);
            expect(response.body.data.resource_types).toHaveLength(1);
        });
    });

    // ==================== KALTURA ROUTES ====================

    describe('Kaltura routes', () => {

        test('GET player config wins registration over the :entry_id route', async () => {
            const response = await request(app).get(ENDPOINTS.kaltura_config.get.endpoint);

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({ partner_id: '1234567', uiconf_id: '7654321' });
            expect(mockKalturaService.get_kaltura_media).not.toHaveBeenCalled();
        });

        test('GET Kaltura media maps the entry id to the service', async () => {
            mockKalturaService.get_kaltura_media.mockResolvedValue({
                success: true, message: 'ok', media: { entry_id: '1_abc123' }
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.kaltura_media.get.endpoint, { entry_id: '1_abc123' }));

            expect(response.status).toBe(200);
            expect(mockKalturaService.get_kaltura_media).toHaveBeenCalledWith('1_abc123');
        });

        /*
         * kaltura-service tags its failures with a `status` (the reasons it maps
         * to 404 / 422 / 500 are pinned in test/tasks/kaltura_service_status.test.js);
         * the controller passes that through and defaults to 500 so a service
         * failure is never reported as a 200. It used to re-derive the code here
         * by string-matching the message (DRY review 2026-09-03, cluster O6).
         */
        test('GET Kaltura media answers with the status the service tagged, defaulting to 500', async () => {
            const cases = [
                [{ success: false, message: 'Entry not found', status: 404 }, 404],
                [{ success: false, message: 'Unsupported media type: document', status: 422 }, 422],
                [{ success: false, message: 'Kaltura session failed', status: 500 }, 500],
                [{ success: false, message: 'An untagged failure' }, 500]
            ];
            for (const [result, expected_status] of cases) {
                mockKalturaService.get_kaltura_media.mockResolvedValue(result);

                const response = await request(app)
                    .get(path_for(ENDPOINTS.kaltura_media.get.endpoint, { entry_id: '1_abc123' }));

                expect(response.status).toBe(expected_status);
                expect(response.body.message).toBe(result.message);
            }
        });

        test('POST category assignment returns 201 on success', async () => {
            mockKalturaService.assign_kaltura_category.mockResolvedValue({
                success: true, message: 'assigned', category_entry: { id: 'ce1' }
            });

            const response = await request(app)
                .post(path_for(ENDPOINTS.kaltura_category.post.endpoint, { entry_id: '1_abc123' }));

            expect(response.status).toBe(201);
            expect(mockKalturaService.assign_kaltura_category).toHaveBeenCalledWith('1_abc123');
        });

        test('DELETE category removal returns 200 on success and 404 when the entry is unknown', async () => {
            mockKalturaService.remove_kaltura_category.mockResolvedValue({
                success: true, message: 'removed', category_entry: null
            });

            const ok = await request(app)
                .delete(path_for(ENDPOINTS.kaltura_category.delete.endpoint, { entry_id: '1_abc123' }));
            expect(ok.status).toBe(200);

            mockKalturaService.remove_kaltura_category.mockResolvedValue({
                success: false, message: 'Category entry not found', status: 404
            });

            const missing = await request(app)
                .delete(path_for(ENDPOINTS.kaltura_category.delete.endpoint, { entry_id: '1_abc123' }));
            expect(missing.status).toBe(404);
        });
    });

    // ==================== IIIF ROUTES ====================

    describe('IIIF routes', () => {

        test('GET manifest serves IIIF content type with CORS headers', async () => {
            mockIiifService.build_manifest_for_uuid.mockResolvedValue({
                success: true, manifest: { id: 'manifest-id', type: 'Manifest' }
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.iiif_manifest.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('application/ld+json');
            expect(response.headers['access-control-allow-origin']).toBe('*');
            expect(response.body.type).toBe('Manifest');
        });

        test('GET manifest maps service-tagged failure statuses through', async () => {
            mockIiifService.build_manifest_for_uuid.mockResolvedValue({
                success: false, status: 404, message: 'Media not found'
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.iiif_manifest.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(404);
        });

        test('GET manifest sub-resource URIs 303-redirect to the parent manifest', async () => {
            const response = await request(app)
                .get(path_for(ENDPOINTS.iiif_manifest.get.endpoint, { media_id: TEST_MEDIA_ID }) + '/canvas/1');

            expect(response.status).toBe(303);
            expect(response.headers.location).toContain(`/iiif/${TEST_MEDIA_ID}/manifest`);
        });

        test('GET info.json serves the image info with IIIF content type', async () => {
            mockIiifService.get_info.mockResolvedValue({
                success: true, info: { width: 1000, height: 800 }
            });

            const response = await request(app)
                .get(path_for(ENDPOINTS.iiif_info.get.endpoint, { media_id: TEST_MEDIA_ID }));

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('application/ld+json');
            expect(response.body.width).toBe(1000);
        });

        test('GET file serves an uploaded PDF and 404s for non-PDF records', async () => {
            mockMediaModel.get_media_record.mockResolvedValue({
                success: true,
                record: {
                    ingest_method: 'upload', mime_type: 'application/pdf',
                    storage_path: 'bucket/doc.pdf', original_filename: 'doc.pdf'
                }
            });
            mockUploads.resolve_storage_path.mockResolvedValue(temp_file);

            const pdf = await request(app)
                .get(path_for(ENDPOINTS.iiif_file.get.endpoint, { media_id: TEST_MEDIA_ID }));
            expect(pdf.status).toBe(200);
            expect(pdf.headers['content-type']).toContain('application/pdf');
            expect(pdf.headers['access-control-allow-origin']).toBe('*');

            mockMediaModel.get_media_record.mockResolvedValue({
                success: true,
                record: { ingest_method: 'upload', mime_type: 'image/jpeg', storage_path: 'bucket/a.jpg' }
            });

            const image = await request(app)
                .get(path_for(ENDPOINTS.iiif_file.get.endpoint, { media_id: TEST_MEDIA_ID }));
            expect(image.status).toBe(404);
        });

        test('GET image maps the four IIIF params to the service and streams the derivative', async () => {
            mockIiifService.get_image.mockResolvedValue({
                success: true,
                image: Buffer.from('derived-bytes'),
                content_type: 'image/jpeg',
                etag: '"abc123"'
            });

            const response = await request(app)
                .get(`${APP_PATH}/iiif/${TEST_MEDIA_ID}/full/max/0/default.jpg`);

            expect(response.status).toBe(200);
            expect(response.headers.etag).toBe('"abc123"');
            expect(response.headers['content-type']).toContain('image/jpeg');
            expect(mockIiifService.get_image).toHaveBeenCalledWith(
                TEST_MEDIA_ID, 'full', 'max', '0', 'default.jpg',
                expect.objectContaining({ if_none_match: undefined })
            );
        });

        test('GET image answers 304 with the ETag when the conditional matches', async () => {
            mockIiifService.get_image.mockResolvedValue({
                success: true, not_modified: true, etag: '"abc123"'
            });

            const response = await request(app)
                .get(`${APP_PATH}/iiif/${TEST_MEDIA_ID}/full/max/0/default.jpg`)
                .set('If-None-Match', '"abc123"');

            expect(response.status).toBe(304);
            expect(response.headers.etag).toBe('"abc123"');
            expect(mockIiifService.get_image).toHaveBeenCalledWith(
                TEST_MEDIA_ID, 'full', 'max', '0', 'default.jpg',
                { if_none_match: '"abc123"' }
            );
        });

        test('GET image maps service-tagged failures (bad params) through', async () => {
            mockIiifService.get_image.mockResolvedValue({
                success: false, status: 400, message: 'Invalid region'
            });

            const response = await request(app)
                .get(`${APP_PATH}/iiif/${TEST_MEDIA_ID}/bogus/max/0/default.jpg`);

            expect(response.status).toBe(400);
        });

        test('GET image rejects a malformed media id with 400 before the service runs', async () => {
            const response = await request(app)
                .get(`${APP_PATH}/iiif/not-a-uuid/full/max/0/default.jpg`);

            expect(response.status).toBe(400);
            expect(mockIiifService.get_image).not.toHaveBeenCalled();
        });
    });
});
