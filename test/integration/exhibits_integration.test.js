/**
 * Integration Tests for Exhibits Module
 *
 * Tests the complete flow: Routes -> Controller -> Model
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

// ==================== MOCK SETUP ====================
// All mocks must be defined before requiring the modules

// Valid test UUIDs
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_UID = '660e8400-e29b-41d4-a716-446655440001';

// Mock Logger
jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

// Mock Token verification
jest.mock('../../libs/tokens', () => ({
    verify: jest.fn((req, res, next) => {
        req.user = { id: TEST_USER_UID, role: 'admin' };
        next();
    })
}));

// Mock Authorization
jest.mock('../../auth/authorize', () => ({
    check_permission: jest.fn().mockResolvedValue(true)
}));

// Mock Rate Limits
jest.mock('../../config/rate_limits_loader', () => ({
    rate_limits: {
        read_operations: (req, res, next) => next(),
        write_operations: (req, res, next) => next(),
        media_operations: (req, res, next) => next(),
        state_change_operations: (req, res, next) => next(),
        preview_operations: (req, res, next) => next(),
        public_media_access: (req, res, next) => next()
    }
}));

// Mock Webservices Config
jest.mock('../../config/webservices_config', () => () => ({
    exhibit_preview_url: 'http://test-preview.com/',
    exhibit_preview_api_key: 'test-api-key'
}));

// Mock fs.promises for media file operations
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    promises: {
        stat: jest.fn().mockResolvedValue({ isFile: () => true }),
        readFile: jest.fn().mockResolvedValue(Buffer.from('test')),
        writeFile: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
        access: jest.fn().mockResolvedValue(undefined)
    }
}));

// Mock Exhibits Model
const mockExhibitsModel = {
    create_exhibit_record: jest.fn(),
    get_exhibit_records: jest.fn(),
    get_exhibit_record: jest.fn(),
    get_exhibit_edit_record: jest.fn(),
    update_exhibit_record: jest.fn(),
    delete_exhibit_record: jest.fn(),
    delete_media_value: jest.fn(),
    publish_exhibit: jest.fn(),
    suppress_exhibit: jest.fn(),
    check_preview: jest.fn(),
    delete_exhibit_preview: jest.fn(),
    build_exhibit_preview: jest.fn(),
    unlock_exhibit_record: jest.fn()
};

jest.mock('../../exhibits/exhibits_model', () => mockExhibitsModel);

// Mock Endpoints — covers every endpoint key referenced in exhibits_routes.js.
jest.mock('../../exhibits/endpoints/index', () => () => ({
    exhibits: {
        exhibit_media_library: {
            get: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id/media-library' },
            post: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id/media-library' },
            delete: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id/media-library/:media_role' }
        },
        exhibit_records: {
            endpoint: '/api/exhibits/v2/exhibit',
            endpoints: {
                post: { endpoint: '/api/exhibits/v2/exhibit' },
                get: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id' },
                put: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id' },
                delete: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id' }
            }
        },
        exhibit_preview: {
            get: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id/preview' }
        },
        exhibit_publish: {
            post: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id/publish' }
        },
        exhibit_suppress: {
            post: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id/suppress' }
        },
        exhibit_unlock_record: {
            post: { endpoint: '/api/exhibits/v2/exhibit/:exhibit_id/unlock' }
        },
        token_verify: {
            endpoint: '/api/exhibits/v2/token/verify'
        }
    }
}));

// ==================== TEST SETUP ====================

describe('Exhibits Integration Tests', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;

    beforeAll(() => {
        // Create Express app
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Set up view engine for preview test
        app.set('view engine', 'ejs');
        app.set('views', '/tmp');

        // Mock render for preview
        app.use((req, res, next) => {
            res.render = jest.fn((view, data) => {
                res.status(200).json({ view, data });
            });
            next();
        });

        // Load routes
        const routes = require('../../exhibits/exhibits_routes');
        routes(app);

        // Get references to mocked modules
        AUTHORIZE = require('../../auth/authorize');
        TOKEN = require('../../libs/tokens');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset authorization to allow by default
        AUTHORIZE.check_permission.mockResolvedValue(true);

        // Reset token verification
        TOKEN.verify.mockImplementation((req, res, next) => {
            req.user = { id: TEST_USER_UID, role: 'admin' };
            next();
        });
    });

    afterAll(async () => {
        // Allow pending async operations to complete
        await new Promise(resolve => setImmediate(resolve));
        // Additional delay for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    // ==================== EXHIBIT CRUD OPERATIONS ====================

    describe('Exhibit CRUD Operations', () => {

        // ---------- CREATE EXHIBIT ----------
        describe('POST /api/exhibits/v2/exhibit (Create Exhibit)', () => {

            test('should create an exhibit record successfully', async () => {
                const exhibitData = {
                    title: 'Test Exhibit',
                    description: 'Test Description',
                    type: 'standard'
                };

                mockExhibitsModel.create_exhibit_record.mockResolvedValue({
                    status: 201,
                    message: 'Exhibit record created',
                    data: TEST_UUID
                });

                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit')
                    .send(exhibitData)
                    .expect('Content-Type', /json/)
                    .expect(201);

                expect(response.body.status).toBe(201);
                expect(response.body.message).toBe('Exhibit record created');
                expect(mockExhibitsModel.create_exhibit_record).toHaveBeenCalledWith(exhibitData);
            });

            test('should return 400 when request body is empty', async () => {
                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit')
                    .send({})
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Request body is required');
            });

            test('should return 403 when user is not authorized', async () => {
                AUTHORIZE.check_permission.mockResolvedValue(false);

                const exhibitData = {
                    title: 'Test Exhibit',
                    description: 'Test Description'
                };

                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit')
                    .send(exhibitData)
                    .expect('Content-Type', /json/)
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unauthorized request');
            });

            test('should return 500 when model throws error', async () => {
                mockExhibitsModel.create_exhibit_record.mockRejectedValue(
                    new Error('Database error')
                );

                const exhibitData = {
                    title: 'Test Exhibit',
                    description: 'Test Description'
                };

                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit')
                    .send(exhibitData)
                    .expect('Content-Type', /json/)
                    .expect(500);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unable to create exhibit record');
            });

            test('should return 500 when model returns invalid response', async () => {
                mockExhibitsModel.create_exhibit_record.mockResolvedValue(null);

                const exhibitData = {
                    title: 'Test Exhibit',
                    description: 'Test Description'
                };

                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit')
                    .send(exhibitData)
                    .expect('Content-Type', /json/)
                    .expect(500);

                expect(response.body.success).toBe(false);
            });
        });

        // ---------- GET ALL EXHIBITS ----------
        describe('GET /api/exhibits/v2/exhibit (Get All Exhibits)', () => {

            test('should return all exhibit records', async () => {
                const mockRecords = [
                    { uuid: TEST_UUID, title: 'Exhibit 1' },
                    { uuid: '660e8400-e29b-41d4-a716-446655440002', title: 'Exhibit 2' }
                ];

                mockExhibitsModel.get_exhibit_records.mockResolvedValue({
                    status: 200,
                    message: 'Exhibit records',
                    data: mockRecords
                });

                const response = await request(app)
                    .get('/api/exhibits/v2/exhibit')
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.status).toBe(200);
                expect(response.body.data).toHaveLength(2);
                expect(mockExhibitsModel.get_exhibit_records).toHaveBeenCalled();
            });

            test('should return 500 when model throws error', async () => {
                mockExhibitsModel.get_exhibit_records.mockRejectedValue(
                    new Error('Database connection failed')
                );

                const response = await request(app)
                    .get('/api/exhibits/v2/exhibit')
                    .expect('Content-Type', /json/)
                    .expect(500);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unable to retrieve exhibit records');
            });

            test('should return 500 when model returns invalid response', async () => {
                mockExhibitsModel.get_exhibit_records.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/exhibits/v2/exhibit')
                    .expect('Content-Type', /json/)
                    .expect(500);

                expect(response.body.success).toBe(false);
            });

            test('should return 500 for invalid status code from model', async () => {
                mockExhibitsModel.get_exhibit_records.mockResolvedValue({
                    status: 'invalid',
                    message: 'Test'
                });

                const response = await request(app)
                    .get('/api/exhibits/v2/exhibit')
                    .expect('Content-Type', /json/)
                    .expect(500);

                expect(response.body.success).toBe(false);
            });
        });

        // ---------- GET SINGLE EXHIBIT ----------
        describe('GET /api/exhibits/v2/exhibit/:exhibit_id (Get Single Exhibit)', () => {

            test('should return a single exhibit record', async () => {
                const mockRecord = {
                    uuid: TEST_UUID,
                    title: 'Test Exhibit',
                    description: 'Test Description'
                };

                mockExhibitsModel.get_exhibit_record.mockResolvedValue({
                    status: 200,
                    message: 'Exhibit record',
                    data: mockRecord
                });

                const response = await request(app)
                    .get(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.status).toBe(200);
                expect(response.body.data.uuid).toBe(TEST_UUID);
                expect(mockExhibitsModel.get_exhibit_record).toHaveBeenCalledWith(TEST_UUID);
            });

            test('should return edit record when type=edit is specified', async () => {
                const mockRecord = {
                    uuid: TEST_UUID,
                    title: 'Test Exhibit',
                    is_locked: 1,
                    locked_by_user: TEST_USER_UID
                };

                mockExhibitsModel.get_exhibit_edit_record.mockResolvedValue({
                    status: 200,
                    message: 'Exhibit edit record',
                    data: mockRecord
                });

                const response = await request(app)
                    .get(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .query({ type: 'edit', uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.status).toBe(200);
                expect(mockExhibitsModel.get_exhibit_edit_record).toHaveBeenCalledWith(
                    TEST_USER_UID,
                    TEST_UUID
                );
            });

            test('should return 400 when exhibit_id is missing', async () => {
                const response = await request(app)
                    .get('/api/exhibits/v2/exhibit/%20')
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Valid exhibit ID is required');
            });

            test('should return 400 when exhibit_id exceeds max length', async () => {
                const longId = 'a'.repeat(300);

                const response = await request(app)
                    .get(`/api/exhibits/v2/exhibit/${longId}`)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('exhibit ID exceeds maximum length');
            });

            test('should return 400 for edit type without uid', async () => {
                const response = await request(app)
                    .get(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .query({ type: 'edit' })
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Valid user ID is required');
            });

            test('should return 400 for invalid type parameter', async () => {
                const response = await request(app)
                    .get(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .query({ type: 'invalid' })
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Invalid request type');
            });
        });

        // ---------- UPDATE EXHIBIT ----------
        describe('PUT /api/exhibits/v2/exhibit/:exhibit_id (Update Exhibit)', () => {

            test('should update an exhibit record successfully', async () => {
                const updateData = {
                    title: 'Updated Title',
                    description: 'Updated Description'
                };

                mockExhibitsModel.update_exhibit_record.mockResolvedValue({
                    status: 201,
                    message: 'Exhibit record updated'
                });

                const response = await request(app)
                    .put(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .send(updateData)
                    .expect('Content-Type', /json/)
                    .expect(201);

                expect(response.body.status).toBe(201);
                expect(response.body.message).toBe('Exhibit record updated');
                expect(mockExhibitsModel.update_exhibit_record).toHaveBeenCalledWith(
                    TEST_UUID,
                    updateData
                );
            });

            test('should return 400 when exhibit_id is invalid', async () => {
                const response = await request(app)
                    .put('/api/exhibits/v2/exhibit/%20')
                    .send({ title: 'Test' })
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Valid exhibit ID is required');
            });

            test('should return 400 when request body is empty', async () => {
                const response = await request(app)
                    .put(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .send({})
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Request body with update data is required');
            });

            test('should return 403 when user is not authorized', async () => {
                AUTHORIZE.check_permission.mockResolvedValue(false);

                const response = await request(app)
                    .put(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .send({ title: 'Test' })
                    .expect('Content-Type', /json/)
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unauthorized request');
            });
        });

        // ---------- DELETE EXHIBIT ----------
        describe('DELETE /api/exhibits/v2/exhibit/:exhibit_id (Delete Exhibit)', () => {

            test('should delete an exhibit record successfully', async () => {
                mockExhibitsModel.delete_exhibit_record.mockResolvedValue({
                    status: 200,
                    message: 'Exhibit record deleted',
                    data: null
                });

                const response = await request(app)
                    .delete(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.status).toBe(200);
                expect(mockExhibitsModel.delete_exhibit_record).toHaveBeenCalledWith(TEST_UUID);
            });

            test('should return 400 when exhibit_id is invalid', async () => {
                const response = await request(app)
                    .delete('/api/exhibits/v2/exhibit/%20')
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Valid exhibit ID is required');
            });

            test('should return 400 when exhibit_id exceeds max length', async () => {
                const longId = 'a'.repeat(300);

                const response = await request(app)
                    .delete(`/api/exhibits/v2/exhibit/${longId}`)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('exhibit ID exceeds maximum length');
            });

            test('should return 403 when user is not authorized', async () => {
                AUTHORIZE.check_permission.mockResolvedValue(false);

                const response = await request(app)
                    .delete(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .expect('Content-Type', /json/)
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unauthorized request');
            });

            test('should return 500 when model throws error', async () => {
                mockExhibitsModel.delete_exhibit_record.mockRejectedValue(
                    new Error('Database error')
                );

                const response = await request(app)
                    .delete(`/api/exhibits/v2/exhibit/${TEST_UUID}`)
                    .expect('Content-Type', /json/)
                    .expect(500);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unable to delete exhibit record');
            });
        });
    });

    // ==================== EXHIBIT STATE MANAGEMENT ====================

    describe('Exhibit State Management', () => {

        // ---------- PUBLISH EXHIBIT ----------
        describe('POST /api/exhibits/v2/exhibit/:exhibit_id/publish (Publish Exhibit)', () => {

            test('should publish exhibit successfully', async () => {
                mockExhibitsModel.publish_exhibit.mockResolvedValue({
                    status: true,
                    message: 'Exhibit published'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/publish`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.message).toBe('Exhibit published successfully');
                expect(response.body.data.exhibit_uuid).toBe(TEST_UUID);
                expect(mockExhibitsModel.publish_exhibit).toHaveBeenCalledWith(TEST_UUID);
            });

            test('should return 422 when exhibit has no items', async () => {
                mockExhibitsModel.publish_exhibit.mockResolvedValue({
                    status: 'no_items',
                    message: 'Exhibit has no items'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/publish`)
                    .expect('Content-Type', /json/)
                    .expect(422);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Exhibit must have at least one item to be published');
            });

            test('should return 400 when exhibit UUID is invalid', async () => {
                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit/%20/publish')
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Valid exhibit UUID is required');
            });

            test('should return 400 when UUID exceeds max length', async () => {
                const longId = 'a'.repeat(300);

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${longId}/publish`)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('exhibit UUID exceeds maximum length');
            });

            test('should return 400 for path traversal attempt', async () => {
                // Use a UUID-like string with path traversal characters embedded
                // Express will match this route, then controller validation catches it
                const maliciousId = 'abc..def';
                
                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${maliciousId}/publish`)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Invalid exhibit UUID format');
            });

            test('should return 403 when user is not authorized', async () => {
                AUTHORIZE.check_permission.mockResolvedValue(false);

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/publish`)
                    .expect('Content-Type', /json/)
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unauthorized request');
            });

            test('should return 500 when publish fails', async () => {
                mockExhibitsModel.publish_exhibit.mockResolvedValue({
                    status: false,
                    message: 'Publish failed'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/publish`)
                    .expect('Content-Type', /json/)
                    .expect(500);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unable to publish exhibit');
            });
        });

        // ---------- SUPPRESS EXHIBIT ----------
        describe('POST /api/exhibits/v2/exhibit/:exhibit_id/suppress (Suppress Exhibit)', () => {

            test('should suppress exhibit successfully', async () => {
                mockExhibitsModel.suppress_exhibit.mockResolvedValue({
                    status: true,
                    message: 'Exhibit suppressed'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/suppress`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.message).toBe('Exhibit suppressed successfully');
                expect(response.body.data.exhibit_uuid).toBe(TEST_UUID);
                expect(mockExhibitsModel.suppress_exhibit).toHaveBeenCalledWith(TEST_UUID);
            });

            test('should return 400 when exhibit UUID is invalid', async () => {
                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit/%20/suppress')
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Valid exhibit UUID is required');
            });

            test('should return 403 when user is not authorized', async () => {
                AUTHORIZE.check_permission.mockResolvedValue(false);

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/suppress`)
                    .expect('Content-Type', /json/)
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unauthorized request');
            });

            test('should return 500 when suppress fails', async () => {
                mockExhibitsModel.suppress_exhibit.mockResolvedValue({
                    status: false,
                    message: 'Suppress failed'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/suppress`)
                    .expect('Content-Type', /json/)
                    .expect(500);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Unable to suppress exhibit');
            });
        });

        // ---------- UNLOCK EXHIBIT ----------
        describe('POST /api/exhibits/v2/exhibit/:exhibit_id/unlock (Unlock Exhibit)', () => {

            test('should unlock exhibit successfully', async () => {
                mockExhibitsModel.unlock_exhibit_record.mockResolvedValue({
                    status: true,
                    message: 'Record unlocked'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/unlock`)
                    .query({ uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.message).toBe('Exhibit record unlocked successfully');
                expect(response.body.data.exhibit_uuid).toBe(TEST_UUID);
            });

            test('should unlock with force parameter', async () => {
                mockExhibitsModel.unlock_exhibit_record.mockResolvedValue({
                    status: true,
                    message: 'Record force unlocked'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/unlock`)
                    .query({ uid: TEST_USER_UID, force: 'true' })
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.force_unlock).toBe(true);
            });

            test('should return 400 when exhibit UUID is missing', async () => {
                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit/%20/unlock')
                    .query({ uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Valid exhibit UUID is required');
            });

            test('should return 400 when user UID is missing', async () => {
                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/unlock`)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Valid user UID is required');
            });

            test('should return 400 when UUID exceeds max length', async () => {
                const longId = 'a'.repeat(300);

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${longId}/unlock`)
                    .query({ uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('exhibit UUID exceeds maximum length');
            });

            test('should return 400 for path traversal in UUID', async () => {
                const response = await request(app)
                    .post('/api/exhibits/v2/exhibit/..%2F..%2Fetc%2Fpasswd/unlock')
                    .query({ uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
            });

            test('should return 400 for invalid force parameter', async () => {
                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/unlock`)
                    .query({ uid: TEST_USER_UID, force: 'invalid' })
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Invalid force parameter. Must be true or false');
            });

            test('should return 409 when exhibit is not locked', async () => {
                mockExhibitsModel.unlock_exhibit_record.mockResolvedValue({
                    status: false,
                    error: 'not_locked'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/unlock`)
                    .query({ uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(409);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Exhibit is not currently locked');
            });

            test('should return 409 when exhibit is locked by another user', async () => {
                mockExhibitsModel.unlock_exhibit_record.mockResolvedValue({
                    status: false,
                    error: 'locked_by_other'
                });

                const response = await request(app)
                    .post(`/api/exhibits/v2/exhibit/${TEST_UUID}/unlock`)
                    .query({ uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(409);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Exhibit is locked by another user');
            });
        });
    });

    // ==================== TOKEN VERIFICATION ====================

    describe('Token Verification', () => {

        describe('POST /api/exhibits/v2/token/verify', () => {

            test('should verify token successfully', async () => {
                const response = await request(app)
                    .post('/api/exhibits/v2/token/verify')
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.message).toBe('Token Verified');
            });
        });
    });

    // ==================== ERROR HANDLING ====================

    describe('Error Handling', () => {

        describe('404 Handler', () => {

            test('should return 404 for unknown exhibit routes', async () => {
                const response = await request(app)
                    .get('/api/exhibits/unknown-route')
                    .expect('Content-Type', /json/)
                    .expect(404);

                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Endpoint not found');
            });

            test('should return 404 for deeply nested unknown routes', async () => {
                const response = await request(app)
                    .get('/api/exhibits/v2/unknown/nested/route')
                    .expect('Content-Type', /json/)
                    .expect(404);

                expect(response.body.success).toBe(false);
            });
        });
    });

    // ==================== SECURITY TESTS ====================

    describe('Security', () => {

        describe('Security Headers', () => {

            test('should include security headers in response', async () => {
                mockExhibitsModel.get_exhibit_records.mockResolvedValue({
                    status: 200,
                    message: 'Exhibit records',
                    data: []
                });

                const response = await request(app)
                    .get('/api/exhibits/v2/exhibit')
                    .expect(200);

                expect(response.headers['x-content-type-options']).toBe('nosniff');
                expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
                expect(response.headers['x-xss-protection']).toBe('1; mode=block');
            });
        });

        describe('Input Validation', () => {

            test('should reject UUIDs with path traversal patterns', async () => {
                // Use patterns that will be matched by Express router but caught by validation
                const maliciousIds = [
                    'test..path',
                    'test/path',
                    'test\\path'
                ];

                for (const maliciousId of maliciousIds) {
                    const response = await request(app)
                        .post(`/api/exhibits/v2/exhibit/${encodeURIComponent(maliciousId)}/publish`);
                    
                    // Should return 400 for path traversal or 404 if route doesn't match
                    expect([400, 404]).toContain(response.status);
                    if (response.status === 400) {
                        expect(response.body.success).toBe(false);
                    }
                }
            });

            test('should handle extremely long input', async () => {
                const longInput = 'a'.repeat(10000);

                const response = await request(app)
                    .get(`/api/exhibits/v2/exhibit/${longInput}`)
                    .expect(400);

                expect(response.body.success).toBe(false);
            });
        });

        describe('Authorization Checks', () => {

            test('should check permissions for protected endpoints', async () => {
                // All write operations should check permissions
                const protectedEndpoints = [
                    { method: 'post', path: '/api/exhibits/v2/exhibit', body: { title: 'Test' } },
                    { method: 'put', path: `/api/exhibits/v2/exhibit/${TEST_UUID}`, body: { title: 'Test' } },
                    { method: 'delete', path: `/api/exhibits/v2/exhibit/${TEST_UUID}` },
                    { method: 'post', path: `/api/exhibits/v2/exhibit/${TEST_UUID}/publish` },
                    { method: 'post', path: `/api/exhibits/v2/exhibit/${TEST_UUID}/suppress` }
                ];

                for (const endpoint of protectedEndpoints) {
                    AUTHORIZE.check_permission.mockResolvedValue(false);

                    let req = request(app)[endpoint.method](endpoint.path);
                    if (endpoint.body) {
                        req = req.send(endpoint.body);
                    }

                    const response = await req.expect(403);
                    expect(response.body.success).toBe(false);
                }
            });
        });
    });

    // ==================== EDGE CASES ====================

    describe('Edge Cases', () => {

        test('should handle special characters in exhibit ID', async () => {
            // GET endpoint doesn't validate for .. patterns (only state-change endpoints do)
            // Test that special characters are handled without crashing
            const specialId = 'test-special_chars';

            mockExhibitsModel.get_exhibit_record.mockResolvedValue({
                status: 200,
                message: 'Exhibit record',
                data: null
            });

            const response = await request(app)
                .get(`/api/exhibits/v2/exhibit/${specialId}`);

            // Should handle the request (either return data or appropriate error)
            expect([200, 400, 404]).toContain(response.status);
        });

        test('should reject path traversal in state-change endpoints', async () => {
            // State-change endpoints (publish, suppress, unlock) DO validate for .. patterns
            const maliciousId = 'test..traversal';

            const response = await request(app)
                .post(`/api/exhibits/v2/exhibit/${maliciousId}/publish`)
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid exhibit UUID format');
        });

        test('should handle unicode in request body', async () => {
            const exhibitData = {
                title: '展览标题 🎨',
                description: 'Description with émojis 🖼️ and spëcial çharacters'
            };

            mockExhibitsModel.create_exhibit_record.mockResolvedValue({
                status: 201,
                message: 'Exhibit record created',
                data: TEST_UUID
            });

            const response = await request(app)
                .post('/api/exhibits/v2/exhibit')
                .send(exhibitData)
                .expect(201);

            expect(response.body.status).toBe(201);
            expect(mockExhibitsModel.create_exhibit_record).toHaveBeenCalledWith(exhibitData);
        });

        test('should handle concurrent requests', async () => {
            mockExhibitsModel.get_exhibit_records.mockResolvedValue({
                status: 200,
                message: 'Exhibit records',
                data: []
            });

            // Send multiple concurrent requests
            const requests = Array(10).fill(null).map(() =>
                request(app).get('/api/exhibits/v2/exhibit')
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        test('should handle model returning undefined status', async () => {
            mockExhibitsModel.get_exhibit_records.mockResolvedValue({
                message: 'Test',
                data: []
                // status is missing
            });

            const response = await request(app)
                .get('/api/exhibits/v2/exhibit')
                .expect(500);

            expect(response.body.success).toBe(false);
        });
    });
});
