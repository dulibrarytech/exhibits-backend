/**
 * Integration Tests for Items Module
 *
 * Tests the complete flow: Routes -> Controller -> Model
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

// ==================== TEST CONSTANTS ====================
const TEST_EXHIBIT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_ITEM_ID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_USER_UID = '770e8400-e29b-41d4-a716-446655440002';
const TEST_GRID_ID = '880e8400-e29b-41d4-a716-446655440003';
const TEST_REPO_UUID = '990e8400-e29b-41d4-a716-446655440004';
const TEST_KALTURA_ENTRY_ID = '1_abc123xyz';

// ==================== MOCK SETUP ====================

// Mock Logger
jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

// Mock Authorization
const mockAuthorize = {
    check_permission: jest.fn().mockResolvedValue(true)
};
jest.mock('../../auth/authorize', () => mockAuthorize);

// We'll mock fs.promises.unlink inline in tests that need it
// Don't globally mock fs as it breaks Express

// Mock Items Model
const mockItemsModel = {
    create_item_record: jest.fn(),
    get_item_records: jest.fn(),
    get_item_record: jest.fn(),
    get_item_edit_record: jest.fn(),
    update_item_record: jest.fn(),
    delete_item_record: jest.fn(),
    delete_media_value: jest.fn(),
    publish_item_record: jest.fn(),
    suppress_item_record: jest.fn(),
    unlock_item_record: jest.fn(),
    reorder_items: jest.fn(),
    get_repo_item_record: jest.fn(),
    get_repo_tn: jest.fn(),
    get_kaltura_item_record: jest.fn(),
    get_item_subjects: jest.fn()
};
jest.mock('../../exhibits/items_model', () => mockItemsModel);

// Mock Headings Model
const mockHeadingsModel = {
    reorder_headings: jest.fn().mockResolvedValue(true),
    publish_heading_record: jest.fn().mockResolvedValue({ status: true }),
    suppress_heading_record: jest.fn().mockResolvedValue({ status: true })
};
jest.mock('../../exhibits/headings_model', () => mockHeadingsModel);

// Mock Grids Model
const mockGridsModel = {
    reorder_grids: jest.fn().mockResolvedValue(true),
    reorder_grid_items: jest.fn().mockResolvedValue(true),
    publish_grid_record: jest.fn().mockResolvedValue({ status: true }),
    suppress_grid_record: jest.fn().mockResolvedValue({ status: true })
};
jest.mock('../../exhibits/grid_model', () => mockGridsModel);

// Mock Timelines Model
const mockTimelinesModel = {
    reorder_timelines: jest.fn().mockResolvedValue(true),
    publish_timeline_record: jest.fn().mockResolvedValue({ status: true }),
    suppress_timeline_record: jest.fn().mockResolvedValue({ status: true })
};
jest.mock('../../exhibits/timelines_model', () => mockTimelinesModel);

// Mock Exhibits Model
const mockExhibitsModel = {
    get_exhibit_record: jest.fn().mockResolvedValue({ data: { is_published: 0 } }),
    suppress_exhibit: jest.fn().mockResolvedValue({ status: true }),
    publish_exhibit: jest.fn().mockResolvedValue({ status: true })
};
jest.mock('../../exhibits/exhibits_model', () => mockExhibitsModel);

// ==================== TEST SETUP ====================

describe('Items Integration Tests', () => {
    let app;
    let CONTROLLER;

    beforeAll(() => {
        // Load the controller (which uses mocked models)
        CONTROLLER = require('../../exhibits/items_controller');

        // Create Express app with manual routes
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Add security headers middleware
        app.use('/api/items', (req, res, next) => {
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'SAMEORIGIN',
                'X-XSS-Protection': '1; mode=block'
            });
            next();
        });

        // Mock token verification middleware
        const mockTokenVerify = (req, res, next) => {
            req.user = { id: TEST_USER_UID, role: 'admin' };
            next();
        };

        // Register routes manually (matching items_routes.js structure)
        // Item CRUD
        app.post('/api/items/exhibit/:exhibit_id/item', mockTokenVerify, CONTROLLER.create_item_record);
        app.get('/api/items/exhibit/:exhibit_id/items', mockTokenVerify, CONTROLLER.get_item_records);
        app.get('/api/items/exhibit/:exhibit_id/item/:item_id', mockTokenVerify, CONTROLLER.get_item_record);
        app.put('/api/items/exhibit/:exhibit_id/item/:item_id', mockTokenVerify, CONTROLLER.update_item_record);
        app.delete('/api/items/exhibit/:exhibit_id/item/:item_id', mockTokenVerify, CONTROLLER.delete_item_record);

        // Item Media — controller.delete_item_media has been removed from the
        // source. Route registration omitted; tests for this endpoint live in
        // the "Item Media Operations" describe block below, which is skipped.

        // Item State Management
        app.post('/api/items/exhibit/:exhibit_id/item/:item_id/publish', mockTokenVerify, CONTROLLER.publish_item_record);
        app.post('/api/items/exhibit/:exhibit_id/item/:item_id/suppress', mockTokenVerify, CONTROLLER.suppress_item_record);
        app.post('/api/items/exhibit/:exhibit_id/item/:item_id/unlock', mockTokenVerify, CONTROLLER.unlock_item_record);

        // Item Ordering
        app.post('/api/items/exhibit/:exhibit_id/reorder', mockTokenVerify, CONTROLLER.reorder_items);

        // External Repository Integrations
        app.get('/api/items/repo/:uuid', mockTokenVerify, CONTROLLER.get_repo_item_record);
        app.get('/api/items/kaltura/:entry_id', mockTokenVerify, CONTROLLER.get_kaltura_item_record);

        // Item Metadata
        app.get('/api/items/subjects', mockTokenVerify, CONTROLLER.get_item_subjects);

        // 404 handler
        app.use('/api/items/*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint not found',
                data: null
            });
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthorize.check_permission.mockResolvedValue(true);
        
        // Reset items model mocks (needed due to resetMocks: true in Jest config)
        mockItemsModel.create_item_record.mockResolvedValue({ status: 201, message: 'Created' });
        mockItemsModel.get_item_records.mockResolvedValue({ status: 200, data: [] });
        mockItemsModel.get_item_record.mockResolvedValue({ status: 200, data: {} });
        mockItemsModel.get_item_edit_record.mockResolvedValue({ status: 200, data: {} });
        mockItemsModel.update_item_record.mockResolvedValue({ status: 201, message: 'Updated' });
        mockItemsModel.delete_item_record.mockResolvedValue({ status: 204, message: 'Deleted' });
        mockItemsModel.delete_media_value.mockResolvedValue(true);
        mockItemsModel.publish_item_record.mockResolvedValue({ status: true, message: 'Published' });
        mockItemsModel.suppress_item_record.mockResolvedValue({ status: true, message: 'Suppressed' });
        mockItemsModel.unlock_item_record.mockResolvedValue({ status: true });
        mockItemsModel.reorder_items.mockResolvedValue(true);
        mockItemsModel.get_repo_item_record.mockResolvedValue({ status: 200, data: {} });
        mockItemsModel.get_repo_tn.mockResolvedValue(null);
        mockItemsModel.get_kaltura_item_record.mockImplementation((id, cb) => cb(null));
        mockItemsModel.get_item_subjects.mockResolvedValue([]);
        
        // Reset grid model mocks
        mockGridsModel.reorder_grids.mockResolvedValue(true);
        mockGridsModel.reorder_grid_items.mockResolvedValue(true);
        mockGridsModel.publish_grid_record.mockResolvedValue({ status: true });
        mockGridsModel.suppress_grid_record.mockResolvedValue({ status: true });
        
        // Reset heading model mocks
        mockHeadingsModel.reorder_headings.mockResolvedValue(true);
        mockHeadingsModel.publish_heading_record.mockResolvedValue({ status: true });
        mockHeadingsModel.suppress_heading_record.mockResolvedValue({ status: true });
        
        // Reset timeline model mocks
        mockTimelinesModel.reorder_timelines.mockResolvedValue(true);
        mockTimelinesModel.publish_timeline_record.mockResolvedValue({ status: true });
        mockTimelinesModel.suppress_timeline_record.mockResolvedValue({ status: true });
        
        // Reset exhibits model mocks
        mockExhibitsModel.get_exhibit_record.mockResolvedValue({ data: { is_published: 0 } });
        mockExhibitsModel.suppress_exhibit.mockResolvedValue({ status: true });
        mockExhibitsModel.publish_exhibit.mockResolvedValue({ status: true });
    });

    afterAll(async () => {
        await new Promise(resolve => setImmediate(resolve));
    });

    // ==================== ITEM CRUD OPERATIONS ====================

    describe('Item CRUD Operations', () => {

        // ---------- CREATE ITEM ----------
        describe('POST /api/items/exhibit/:exhibit_id/item (Create Item)', () => {

            test('should create an item record successfully', async () => {
                const itemData = {
                    title: 'Test Item',
                    item_type: 'image',
                    description: 'Test description'
                };

                mockItemsModel.create_item_record.mockResolvedValue({
                    status: 201,
                    message: 'Item record created',
                    data: TEST_ITEM_ID
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item`)
                    .send(itemData)
                    .expect('Content-Type', /json/)
                    .expect(201);

                expect(response.body.status).toBe(201);
                expect(response.body.message).toBe('Item record created');
                expect(response.body.data).toBe(TEST_ITEM_ID);
                expect(mockItemsModel.create_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, itemData);
            });

            test('should return 400 when exhibit_id is missing', async () => {
                const response = await request(app)
                    .post('/api/items/exhibit/%20/item')
                    .send({ title: 'Test' })
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid exhibit ID.');
            });

            test('should return 400 when request body is empty', async () => {
                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item`)
                    .send({})
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid item data.');
            });

            test('should return 403 when user is not authorized', async () => {
                mockAuthorize.check_permission.mockResolvedValue(false);

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item`)
                    .send({ title: 'Test' })
                    .expect(403);

                expect(response.body.message).toBe('Unauthorized request');
            });

            test('should return 500 when model throws error', async () => {
                mockItemsModel.create_item_record.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item`)
                    .send({ title: 'Test' })
                    .expect(500);

                expect(response.body.message).toBe('Unable to create item record.');
            });
        });

        // ---------- GET ALL ITEMS ----------
        describe('GET /api/items/exhibit/:exhibit_id/items (Get All Items)', () => {

            test('should return all item records', async () => {
                const mockItems = [
                    { uuid: TEST_ITEM_ID, title: 'Item 1', order: 1 },
                    { uuid: '770e8400-e29b-41d4-a716-446655440003', title: 'Item 2', order: 2 }
                ];

                mockItemsModel.get_item_records.mockResolvedValue({
                    status: 200,
                    message: 'Exhibit item records',
                    data: mockItems
                });

                const response = await request(app)
                    .get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/items`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.status).toBe(200);
                expect(response.body.data).toHaveLength(2);
            });

            test('should return 400 when exhibit_id is missing', async () => {
                const response = await request(app)
                    .get('/api/items/exhibit/%20/items')
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid exhibit ID.');
            });

            test('should return 500 when model throws error', async () => {
                mockItemsModel.get_item_records.mockRejectedValue(new Error('Database error'));

                const response = await request(app)
                    .get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/items`)
                    .expect(500);

                expect(response.body.message).toBe('Unable to get item records.');
            });
        });

        // ---------- GET SINGLE ITEM ----------
        describe('GET /api/items/exhibit/:exhibit_id/item/:item_id (Get Single Item)', () => {

            test('should return a single item record', async () => {
                const mockItem = {
                    uuid: TEST_ITEM_ID,
                    title: 'Test Item',
                    item_type: 'image'
                };

                mockItemsModel.get_item_record.mockResolvedValue({
                    status: 200,
                    message: 'Item record',
                    data: mockItem
                });

                const response = await request(app)
                    .get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.status).toBe(200);
                expect(response.body.data.uuid).toBe(TEST_ITEM_ID);
            });

            test('should return edit record when type=edit is specified', async () => {
                const mockItem = {
                    uuid: TEST_ITEM_ID,
                    title: 'Test Item',
                    is_locked: 1
                };

                mockItemsModel.get_item_edit_record.mockResolvedValue({
                    status: 200,
                    message: 'Item edit record',
                    data: mockItem
                });

                const response = await request(app)
                    .get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .query({ type: 'edit', uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.status).toBe(200);
                expect(mockItemsModel.get_item_edit_record).toHaveBeenCalledWith(
                    TEST_USER_UID,
                    TEST_EXHIBIT_ID,
                    TEST_ITEM_ID
                );
            });

            test('should return 400 when type=edit but uid is missing', async () => {
                const response = await request(app)
                    .get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .query({ type: 'edit' })
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid user ID for edit mode.');
            });

            test('should return 400 for invalid type parameter', async () => {
                const response = await request(app)
                    .get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .query({ type: 'invalid' })
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Invalid type parameter.');
            });

            test('should return 400 when item_id is missing', async () => {
                const response = await request(app)
                    .get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/%20`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid item ID.');
            });
        });

        // ---------- UPDATE ITEM ----------
        describe('PUT /api/items/exhibit/:exhibit_id/item/:item_id (Update Item)', () => {

            test('should update an item record successfully', async () => {
                const updateData = {
                    title: 'Updated Item'
                };

                mockItemsModel.update_item_record.mockResolvedValue({
                    status: 201,
                    message: 'Item record updated'
                });

                const response = await request(app)
                    .put(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .send(updateData)
                    .expect('Content-Type', /json/)
                    .expect(201);

                expect(response.body.status).toBe(201);
                expect(response.body.message).toBe('Item record updated');
            });

            test('should return 400 when request body is empty', async () => {
                const response = await request(app)
                    .put(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .send({})
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid item data.');
            });

            test('should return 403 when user is not authorized', async () => {
                mockAuthorize.check_permission.mockResolvedValue(false);

                const response = await request(app)
                    .put(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .send({ title: 'Test' })
                    .expect(403);

                expect(response.body.message).toBe('Unauthorized request');
            });
        });

        // ---------- DELETE ITEM ----------
        describe('DELETE /api/items/exhibit/:exhibit_id/item/:item_id (Delete Item)', () => {

            test('should delete an item record successfully', async () => {
                mockItemsModel.delete_item_record.mockResolvedValue({
                    status: 204,
                    message: 'Record deleted'
                });

                const response = await request(app)
                    .delete(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .expect(204);

                expect(mockItemsModel.delete_item_record).toHaveBeenCalledWith(
                    TEST_EXHIBIT_ID,
                    TEST_ITEM_ID,
                    undefined
                );
            });

            test('should delete with record type parameter', async () => {
                mockItemsModel.delete_item_record.mockResolvedValue({
                    status: 204,
                    message: 'Record deleted'
                });

                await request(app)
                    .delete(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .query({ type: 'item' })
                    .expect(204);

                expect(mockItemsModel.delete_item_record).toHaveBeenCalledWith(
                    TEST_EXHIBIT_ID,
                    TEST_ITEM_ID,
                    'item'
                );
            });

            test('should return 403 when user is not authorized', async () => {
                mockAuthorize.check_permission.mockResolvedValue(false);

                const response = await request(app)
                    .delete(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .expect(403);

                expect(response.body.message).toBe('Unauthorized request');
            });
        });
    });

    // ==================== ITEM MEDIA OPERATIONS ====================

    // SKIPPED: controller.delete_item_media was removed from the source.
    // Restore these tests when/if the endpoint is reintroduced.
    describe.skip('Item Media Operations', () => {

        describe('DELETE /api/items/exhibit/:exhibit_id/item/:item_id/media/:media (Delete Item Media)', () => {

            // Note: Full media deletion tests require fs mocking which breaks Express
            // These tests focus on validation that occurs before file operations

            test('should return 400 when media filename is missing', async () => {
                const response = await request(app)
                    .delete(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/media/%20`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid media filename.');
            });

            test('should return 400 when exhibit_id is missing', async () => {
                const response = await request(app)
                    .delete(`/api/items/exhibit/%20/item/${TEST_ITEM_ID}/media/test.jpg`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid exhibit ID.');
            });

            test('should return 400 when item_id is missing', async () => {
                const response = await request(app)
                    .delete(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/%20/media/test.jpg`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid item ID.');
            });

            test('should return 400 for path traversal attempt in exhibit_id', async () => {
                const response = await request(app)
                    .delete(`/api/items/exhibit/..%2Fetc/item/${TEST_ITEM_ID}/media/test.jpg`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Invalid path characters.');
            });

            test('should return 400 for path traversal attempt in media filename', async () => {
                const response = await request(app)
                    .delete(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/media/..%2Fetc%2Fpasswd`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Invalid path characters.');
            });
        });
    });

    // ==================== ITEM STATE MANAGEMENT ====================

    describe('Item State Management', () => {

        // ---------- PUBLISH ITEM ----------
        describe('POST /api/items/exhibit/:exhibit_id/item/:item_id/publish (Publish Item)', () => {

            test('should publish item successfully', async () => {
                mockItemsModel.publish_item_record.mockResolvedValue({
                    status: true,
                    message: 'Item published'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/publish`)
                    .query({ type: 'item' })
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.message).toBe('Item published.');
            });

            test('should publish heading type', async () => {
                mockHeadingsModel.publish_heading_record.mockResolvedValue({
                    status: true,
                    message: 'Heading published'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/publish`)
                    .query({ type: 'heading' })
                    .expect(200);

                expect(mockHeadingsModel.publish_heading_record).toHaveBeenCalledWith(
                    TEST_EXHIBIT_ID,
                    TEST_ITEM_ID
                );
            });

            test('should publish grid type', async () => {
                mockGridsModel.publish_grid_record.mockResolvedValue({
                    status: true,
                    message: 'Grid published'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/publish`)
                    .query({ type: 'grid' })
                    .expect(200);

                expect(mockGridsModel.publish_grid_record).toHaveBeenCalled();
            });

            test('should publish timeline type', async () => {
                mockTimelinesModel.publish_timeline_record.mockResolvedValue({
                    status: true,
                    message: 'Timeline published'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/publish`)
                    .query({ type: 'timeline' })
                    .expect(200);

                expect(mockTimelinesModel.publish_timeline_record).toHaveBeenCalled();
            });

            test('should return 400 when type is missing', async () => {
                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/publish`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid type parameter.');
            });

            test('should return 400 for invalid type', async () => {
                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/publish`)
                    .query({ type: 'invalid' })
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid type parameter.');
            });

            test('should return 403 when user is not authorized', async () => {
                mockAuthorize.check_permission.mockResolvedValue(false);

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/publish`)
                    .query({ type: 'item' })
                    .expect(403);

                expect(response.body.message).toBe('Unauthorized request');
            });

            test('should return 422 when publish fails', async () => {
                mockItemsModel.publish_item_record.mockResolvedValue({
                    status: false,
                    message: 'Exhibit must be published first'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/publish`)
                    .query({ type: 'item' })
                    .expect(422);

                expect(response.body.message).toBe('Exhibit must be published first');
            });
        });

        // ---------- SUPPRESS ITEM ----------
        describe('POST /api/items/exhibit/:exhibit_id/item/:item_id/suppress (Suppress Item)', () => {

            test('should suppress item successfully', async () => {
                mockItemsModel.suppress_item_record.mockResolvedValue({
                    status: true,
                    message: 'Item suppressed'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/suppress`)
                    .query({ type: 'item' })
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.message).toBe('Item suppressed.');
            });

            test('should return 400 when type is missing', async () => {
                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/suppress`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid type parameter.');
            });

            test('should return 422 when suppress fails', async () => {
                mockItemsModel.suppress_item_record.mockResolvedValue({
                    status: false,
                    message: 'Unable to suppress'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/suppress`)
                    .query({ type: 'item' })
                    .expect(422);

                expect(response.body.message).toBe('Unable to suppress item.');
            });
        });

        // ---------- UNLOCK ITEM ----------
        describe('POST /api/items/exhibit/:exhibit_id/item/:item_id/unlock (Unlock Item)', () => {

            test('should unlock item successfully', async () => {
                mockItemsModel.unlock_item_record.mockResolvedValue({
                    status: true,
                    message: 'Record unlocked'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/unlock`)
                    .query({ uid: TEST_USER_UID })
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.message).toBe('Item record unlocked.');
            });

            test('should unlock with force parameter', async () => {
                mockItemsModel.unlock_item_record.mockResolvedValue({
                    status: true,
                    message: 'Record force unlocked'
                });

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/unlock`)
                    .query({ uid: TEST_USER_UID, force: 'true' })
                    .expect(200);

                expect(mockItemsModel.unlock_item_record).toHaveBeenCalledWith(
                    TEST_USER_UID,
                    TEST_ITEM_ID,
                    { force: true }
                );
            });

            test('should return 400 when uid is missing', async () => {
                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/unlock`)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid user ID.');
            });

            test('should return 422 when unlock fails', async () => {
                mockItemsModel.unlock_item_record.mockResolvedValue(false);

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}/unlock`)
                    .query({ uid: TEST_USER_UID })
                    .expect(422);

                expect(response.body.message).toBe('Unable to unlock item record.');
            });
        });
    });

    // ==================== ITEM ORDERING ====================

    describe('Item Ordering', () => {

        describe('POST /api/items/exhibit/:exhibit_id/reorder (Reorder Items)', () => {

            test('should reorder items successfully', async () => {
                mockItemsModel.reorder_items.mockResolvedValue(true);

                const orderData = [
                    { type: 'item', uuid: TEST_ITEM_ID, order: 1 },
                    { type: 'item', uuid: '770e8400-e29b-41d4-a716-446655440003', order: 2 }
                ];

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/reorder`)
                    .send(orderData)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.message).toBe('Exhibit items reordered.');
            });

            test('should handle grid items reorder', async () => {
                mockGridsModel.reorder_grid_items.mockResolvedValue(true);

                const orderData = [
                    { type: 'griditem', grid_id: TEST_GRID_ID, uuid: TEST_ITEM_ID, order: 1 }
                ];

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/reorder`)
                    .send(orderData)
                    .expect(200);

                expect(mockGridsModel.reorder_grid_items).toHaveBeenCalled();
            });

            test('should return 400 when order data is empty', async () => {
                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/reorder`)
                    .send([])
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid order data.');
            });

            test('should return 400 when order data is not an array', async () => {
                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/reorder`)
                    .send({ not: 'array' })
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid order data.');
            });

            test('should return 400 for invalid item type', async () => {
                const orderData = [
                    { type: 'invalid', uuid: TEST_ITEM_ID, order: 1 }
                ];

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/reorder`)
                    .send(orderData)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid item type.');
            });

            test('should return 400 for griditem without grid_id', async () => {
                const orderData = [
                    { type: 'griditem', uuid: TEST_ITEM_ID, order: 1 }
                ];

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/reorder`)
                    .send(orderData)
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid grid ID for grid item.');
            });

            test('should return 422 when some reorder operations fail', async () => {
                mockItemsModel.reorder_items.mockResolvedValue(false);

                const orderData = [
                    { type: 'item', uuid: TEST_ITEM_ID, order: 1 }
                ];

                const response = await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/reorder`)
                    .send(orderData)
                    .expect(422);

                expect(response.body.message).toBe('Unable to reorder some exhibit items.');
            });
        });
    });

    // ==================== EXTERNAL REPOSITORY INTEGRATIONS ====================

    describe('External Repository Integrations', () => {

        // ---------- REPO ITEM ----------
        describe('GET /api/items/repo/:uuid (Get Repo Item)', () => {

            test('should return repo item successfully', async () => {
                mockItemsModel.get_repo_item_record.mockResolvedValue({
                    status: 200,
                    data: {
                        uuid: TEST_REPO_UUID,
                        title: 'Test Repo Item'
                    }
                });
                mockItemsModel.get_repo_tn.mockResolvedValue('thumbnail-data');

                const response = await request(app)
                    .get(`/api/items/repo/${TEST_REPO_UUID}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.message).toBe('Repo item metadata retrieved.');
                expect(response.body.data.thumbnail).toBe('thumbnail-data');
            });

            test('should return 400 when uuid is missing', async () => {
                const response = await request(app)
                    .get('/api/items/repo/%20')
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid UUID.');
            });

            test('should return 404 when repo item not found', async () => {
                mockItemsModel.get_repo_item_record.mockResolvedValue(null);
                mockItemsModel.get_repo_tn.mockResolvedValue(null);

                const response = await request(app)
                    .get(`/api/items/repo/${TEST_REPO_UUID}`)
                    .expect(404);

                expect(response.body.message).toBe('Repo item not found.');
            });
        });

        // ---------- KALTURA ITEM ----------
        describe('GET /api/items/kaltura/:entry_id (Get Kaltura Item)', () => {

            test('should return kaltura video item successfully', async () => {
                mockItemsModel.get_kaltura_item_record.mockImplementation((entry_id, callback) => {
                    callback({
                        id: TEST_KALTURA_ENTRY_ID,
                        mediaType: 1, // video
                        name: 'Test Video',
                        description: 'Test description',
                        thumbnailUrl: 'http://example.com/thumb.jpg'
                    });
                });

                const response = await request(app)
                    .get(`/api/items/kaltura/${TEST_KALTURA_ENTRY_ID}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.message).toBe('Kaltura item metadata retrieved.');
                expect(response.body.data.item_type).toBe('video');
            });

            test('should return kaltura audio item successfully', async () => {
                mockItemsModel.get_kaltura_item_record.mockImplementation((entry_id, callback) => {
                    callback({
                        id: TEST_KALTURA_ENTRY_ID,
                        mediaType: 5, // audio
                        name: 'Test Audio',
                        description: 'Test description',
                        thumbnailUrl: 'http://example.com/thumb.jpg'
                    });
                });

                const response = await request(app)
                    .get(`/api/items/kaltura/${TEST_KALTURA_ENTRY_ID}`)
                    .expect(200);

                expect(response.body.data.item_type).toBe('audio');
            });

            test('should return 400 when entry_id is missing', async () => {
                const response = await request(app)
                    .get('/api/items/kaltura/%20')
                    .expect(400);

                expect(response.body.message).toBe('Bad request. Missing or invalid entry ID.');
            });

            test('should return 404 when kaltura item not found', async () => {
                mockItemsModel.get_kaltura_item_record.mockImplementation((entry_id, callback) => {
                    callback(null);
                });

                const response = await request(app)
                    .get(`/api/items/kaltura/${TEST_KALTURA_ENTRY_ID}`)
                    .expect(404);

                expect(response.body.message).toBe('Unable to get Kaltura item metadata.');
            });

            test('should return 422 for unsupported media type', async () => {
                mockItemsModel.get_kaltura_item_record.mockImplementation((entry_id, callback) => {
                    callback({
                        id: TEST_KALTURA_ENTRY_ID,
                        mediaType: 2, // image - not supported
                        name: 'Test Image'
                    });
                });

                const response = await request(app)
                    .get(`/api/items/kaltura/${TEST_KALTURA_ENTRY_ID}`)
                    .expect(422);

                expect(response.body.message).toBe('Unsupported media type. Only video and audio are supported.');
            });

            test('should return 500 on Kaltura API error', async () => {
                mockItemsModel.get_kaltura_item_record.mockImplementation((entry_id, callback) => {
                    callback({
                        objectType: 'KalturaAPIException',
                        message: 'Invalid entry'
                    });
                });

                const response = await request(app)
                    .get(`/api/items/kaltura/${TEST_KALTURA_ENTRY_ID}`)
                    .expect(500);

                expect(response.body.message).toBe('Unable to get Kaltura item record.');
            });
        });
    });

    // ==================== ITEM METADATA ====================

    describe('Item Metadata', () => {

        describe('GET /api/items/subjects (Get Item Subjects)', () => {

            test('should return item subjects successfully', async () => {
                const mockSubjects = [
                    { id: 1, name: 'History' },
                    { id: 2, name: 'Science' }
                ];

                mockItemsModel.get_item_subjects.mockResolvedValue(mockSubjects);

                const response = await request(app)
                    .get('/api/items/subjects')
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.message).toBe('Item subjects retrieved.');
                expect(response.body.data).toHaveLength(2);
            });

            test('should return 404 when no subjects found', async () => {
                mockItemsModel.get_item_subjects.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/items/subjects')
                    .expect(404);

                expect(response.body.message).toBe('No item subjects found.');
            });

            test('should return 500 on error', async () => {
                mockItemsModel.get_item_subjects.mockRejectedValue(new Error('API error'));

                const response = await request(app)
                    .get('/api/items/subjects')
                    .expect(500);

                expect(response.body.message).toBe('Unable to get item subjects.');
            });
        });
    });

    // ==================== ERROR HANDLING ====================

    describe('Error Handling', () => {

        test('should return 404 for unknown routes', async () => {
            const response = await request(app)
                .get('/api/items/unknown-route')
                .expect('Content-Type', /json/)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Endpoint not found');
        });
    });

    // ==================== SECURITY TESTS ====================

    describe('Security', () => {

        describe('Security Headers', () => {

            test('should include security headers in response', async () => {
                mockItemsModel.get_item_records.mockResolvedValue({
                    status: 200,
                    message: 'Item records',
                    data: []
                });

                const response = await request(app)
                    .get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/items`)
                    .expect(200);

                expect(response.headers['x-content-type-options']).toBe('nosniff');
                expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
                expect(response.headers['x-xss-protection']).toBe('1; mode=block');
            });
        });

        describe('Authorization Checks', () => {

            test('should verify correct permissions for create', async () => {
                mockItemsModel.create_item_record.mockResolvedValue({
                    status: 201,
                    message: 'Created'
                });

                await request(app)
                    .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item`)
                    .send({ title: 'Test' })
                    .expect(201);

                expect(mockAuthorize.check_permission).toHaveBeenCalledWith(
                    expect.objectContaining({
                        permissions: ['add_item', 'add_item_to_any_exhibit'],
                        record_type: 'item',
                        parent_id: TEST_EXHIBIT_ID,
                        child_id: null
                    })
                );
            });

            test('should verify correct permissions for update', async () => {
                mockItemsModel.update_item_record.mockResolvedValue({
                    status: 201,
                    message: 'Updated'
                });

                await request(app)
                    .put(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .send({ title: 'Test' })
                    .expect(201);

                expect(mockAuthorize.check_permission).toHaveBeenCalledWith(
                    expect.objectContaining({
                        permissions: ['update_item', 'update_any_item'],
                        record_type: 'item',
                        parent_id: TEST_EXHIBIT_ID,
                        child_id: TEST_ITEM_ID
                    })
                );
            });

            test('should verify correct permissions for delete', async () => {
                mockItemsModel.delete_item_record.mockResolvedValue({
                    status: 204,
                    message: 'Deleted'
                });

                await request(app)
                    .delete(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item/${TEST_ITEM_ID}`)
                    .expect(204);

                expect(mockAuthorize.check_permission).toHaveBeenCalledWith(
                    expect.objectContaining({
                        permissions: ['delete_item', 'delete_any_item']
                    })
                );
            });
        });
    });

    // ==================== EDGE CASES ====================

    describe('Edge Cases', () => {

        test('should handle unicode in request body', async () => {
            const itemData = {
                title: '测试项目 🎨',
                description: 'Description with émojis 🖼️'
            };

            mockItemsModel.create_item_record.mockResolvedValue({
                status: 201,
                message: 'Item record created',
                data: TEST_ITEM_ID
            });

            const response = await request(app)
                .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item`)
                .send(itemData)
                .expect(201);

            expect(response.body.status).toBe(201);
        });

        test('should handle concurrent requests', async () => {
            mockItemsModel.get_item_records.mockResolvedValue({
                status: 200,
                message: 'Item records',
                data: []
            });

            const requests = Array(5).fill(null).map(() =>
                request(app).get(`/api/items/exhibit/${TEST_EXHIBIT_ID}/items`)
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        test('should not call model when authorization fails', async () => {
            mockAuthorize.check_permission.mockResolvedValue(false);

            await request(app)
                .post(`/api/items/exhibit/${TEST_EXHIBIT_ID}/item`)
                .send({ title: 'Test' })
                .expect(403);

            expect(mockItemsModel.create_item_record).not.toHaveBeenCalled();
        });
    });
});
