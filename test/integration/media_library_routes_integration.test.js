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

/*
 * The real endpoints modules build paths from APP_PATH at require time —
 * ensure it is defined before anything is loaded.
 */
process.env.APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const express = require('express');
const request = require('supertest');
const FS = require('fs');
const OS = require('os');
const PATH = require('path');

const TEST_MEDIA_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_EXHIBIT_ID = '660e8400-e29b-41d4-a716-446655440100';
const TEST_REPO_UUID = '770e8400-e29b-41d4-a716-446655440200';
const TEST_USER_UID = '660e8400-e29b-41d4-a716-446655440001';

jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('../../libs/tokens', () => ({
    verify: jest.fn((req, res, next) => {
        req.decoded = { sub: '660e8400-e29b-41d4-a716-446655440001' };
        next();
    }),
    verify_with_query: jest.fn((req, res, next) => {
        req.decoded = { sub: '660e8400-e29b-41d4-a716-446655440001' };
        next();
    })
}));

jest.mock('../../auth/authorize', () => ({
    check_permission: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../config/rate_limits_loader', () => ({
    rate_limits: {
        read_operations: (req, res, next) => next(),
        write_operations: (req, res, next) => next(),
        iiif_image_operations: (req, res, next) => next()
    }
}));

jest.mock('../../config/kaltura_config', () => () => ({
    kaltura_partner_id: '1234567',
    kaltura_conf_ui_id: '7654321'
}));

const mockMediaModel = {
    get_media_records: jest.fn(),
    get_media_records_browse: jest.fn(),
    get_media_record: jest.fn(),
    create_media_record: jest.fn(),
    update_media_record: jest.fn(),
    delete_media_record: jest.fn(),
    delete_uploaded_file: jest.fn(),
    check_duplicate: jest.fn(),
    add_exhibit_to_media_record: jest.fn(),
    remove_exhibit_from_media_record: jest.fn()
};

jest.mock('../../media-library/model', () => mockMediaModel);

const mockRepoService = {
    search_repository: jest.fn(),
    get_repo_tn: jest.fn(),
    get_subjects: jest.fn(),
    get_resource_types: jest.fn()
};

jest.mock('../../media-library/repo-service', () => mockRepoService);

const mockKalturaService = {
    get_kaltura_media: jest.fn(),
    get_kaltura_original_filename: jest.fn(),
    assign_kaltura_category: jest.fn(),
    remove_kaltura_category: jest.fn()
};

jest.mock('../../media-library/kaltura-service', () => mockKalturaService);

const mockIiifService = {
    derive_iiif_base: jest.fn().mockReturnValue('http://test.host/exhibits-dashboard/iiif'),
    derive_file_base: jest.fn().mockReturnValue('http://test.host/exhibits-dashboard/iiif'),
    build_manifest_for_uuid: jest.fn(),
    get_info: jest.fn(),
    get_image: jest.fn()
};

jest.mock('../../media-library/iiif-service', () => mockIiifService);

const mockUploads = {
    resolve_storage_path: jest.fn()
};

jest.mock('../../media-library/uploads', () => mockUploads);

const ENDPOINTS = require('../../media-library/endpoints')();
const APP_PATH = process.env.APP_PATH;

const path_for = (template, params = {}) => {
    let path = template;
    for (const [key, value] of Object.entries(params)) {
        path = path.replace(new RegExp(`:${key}(?=/|$)`, 'g'), value);
    }
    return path;
};

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

        test('GET Kaltura media tags failures with 404 / 422 / 500 by reason', async () => {
            const cases = [
                ['Entry not found', 404],
                ['Unsupported media type: document', 422],
                ['Kaltura session failed', 500]
            ];
            for (const [message, expected_status] of cases) {
                mockKalturaService.get_kaltura_media.mockResolvedValue({ success: false, message });

                const response = await request(app)
                    .get(path_for(ENDPOINTS.kaltura_media.get.endpoint, { entry_id: '1_abc123' }));

                expect(response.status).toBe(expected_status);
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
                success: false, message: 'Category entry not found'
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
