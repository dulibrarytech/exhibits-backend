/**
 * Route-mounting Integration Tests for Grid Routes
 *
 * Mounts the REAL exhibits/grid_routes.js (real endpoints module, real
 * controller, real grid_helper validation/authorization chain) with the
 * model mocked. Verifies route registration, path-param mapping, and
 * middleware ordering (token verify -> validation -> authorize -> model)
 * for every registered grid endpoint — coverage the hand-rolled
 * grid_model.test.js app cannot provide.
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

const TEST_EXHIBIT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_GRID_ID = '660e8400-e29b-41d4-a716-446655440100';
const TEST_ITEM_ID = '770e8400-e29b-41d4-a716-446655440200';
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
        req.decoded = { sub: TEST_USER_UID };
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
        state_change_operations: (req, res, next) => next()
    }
}));

const mockGridsModel = {
    create_grid_record: jest.fn(),
    get_grid_record: jest.fn(),
    update_grid_record: jest.fn(),
    create_grid_item_record: jest.fn(),
    get_grid_item_records: jest.fn(),
    get_grid_item_record: jest.fn(),
    get_grid_item_edit_record: jest.fn(),
    get_grid_item_details_record: jest.fn(),
    update_grid_item_record: jest.fn(),
    delete_grid_item_record: jest.fn(),
    publish_grid_item_record: jest.fn(),
    suppress_grid_item_record: jest.fn(),
    unlock_grid_item_record: jest.fn()
};

jest.mock('../../exhibits/grid_model', () => mockGridsModel);

const ENDPOINTS = require('../../exhibits/endpoints/index')().exhibits;

/*
 * Builds a request path from a registered endpoint template so the tests
 * exercise exactly the strings the router was mounted with.
 */
const path_for = (template, params = {}) => {
    let path = template;
    for (const [key, value] of Object.entries(params)) {
        /*
         * Anchor on the following segment boundary so a short key never
         * corrupts a longer one (":grid_id" vs ":grid_item_id").
         */
        path = path.replace(new RegExp(`:${key}(?=/|$)`, 'g'), value);
    }
    return path;
};

const IDS = {
    exhibit_id: TEST_EXHIBIT_ID,
    grid_id: TEST_GRID_ID,
    item_id: TEST_ITEM_ID,
    grid_item_id: TEST_ITEM_ID
};

describe('Grid Routes Integration (real router)', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const routes = require('../../exhibits/grid_routes');
        routes(app);

        AUTHORIZE = require('../../auth/authorize');
        TOKEN = require('../../libs/tokens');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        AUTHORIZE.check_permission.mockResolvedValue(true);
        TOKEN.verify.mockImplementation((req, res, next) => {
            req.decoded = { sub: TEST_USER_UID };
            next();
        });
    });

    // ==================== MIDDLEWARE ORDERING ====================

    describe('Token verification gate', () => {

        const routes_under_test = [
            ['get', path_for(ENDPOINTS.grid_records.get.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.grid_records.post.endpoint, IDS)],
            ['put', path_for(ENDPOINTS.grid_records.put.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.grid_item_records.post.endpoint, IDS)],
            ['get', path_for(ENDPOINTS.grid_item_records.get.endpoint, IDS)],
            ['get', path_for(ENDPOINTS.grid_item_record.get.endpoint, IDS)],
            ['put', path_for(ENDPOINTS.grid_item_records.put.endpoint, IDS)],
            ['delete', path_for(ENDPOINTS.grid_item_records.delete.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.grid_item_records.grid_item_publish.post.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.grid_item_records.grid_item_suppress.post.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.grid_item_unlock_record.post.endpoint, IDS)]
        ];

        test.each(routes_under_test)('%s %s rejects with 401 before reaching the model', async (method, path) => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });

            const response = await request(app)[method](path).send({ text: 'x' });

            expect(response.status).toBe(401);
            for (const fn of Object.values(mockGridsModel)) {
                expect(fn).not.toHaveBeenCalled();
            }
        });
    });

    // ==================== GRID CRUD ====================

    describe('Grid record routes', () => {

        test('GET grid record maps path params through to the model', async () => {
            mockGridsModel.get_grid_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.grid_records.get.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockGridsModel.get_grid_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_GRID_ID);
        });

        test('POST grid record passes exhibit id and body to the model', async () => {
            mockGridsModel.create_grid_record.mockResolvedValue({ status: 201, message: 'created', data: TEST_GRID_ID });

            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_records.post.endpoint, IDS))
                .send({ columns: 2, internal_name: 'x' });

            expect(response.status).toBe(201);
            expect(mockGridsModel.create_grid_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                expect.objectContaining({ columns: 2 })
            );
        });

        test('POST grid record returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_records.post.endpoint, IDS))
                .send({ columns: 2 });

            expect(response.status).toBe(403);
            expect(mockGridsModel.create_grid_record).not.toHaveBeenCalled();
        });

        test('POST grid record returns 400 on empty body before authorizing', async () => {
            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_records.post.endpoint, IDS))
                .send({});

            expect(response.status).toBe(400);
            expect(AUTHORIZE.check_permission).not.toHaveBeenCalled();
            expect(mockGridsModel.create_grid_record).not.toHaveBeenCalled();
        });

        test('PUT grid record maps params and body to the model', async () => {
            mockGridsModel.update_grid_record.mockResolvedValue({ status: 200, message: 'updated' });

            const response = await request(app)
                .put(path_for(ENDPOINTS.grid_records.put.endpoint, IDS))
                .send({ columns: 3 });

            expect(response.status).toBe(200);
            expect(mockGridsModel.update_grid_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                TEST_GRID_ID,
                expect.objectContaining({ columns: 3 })
            );
        });
    });

    // ==================== GRID ITEM CRUD ====================

    describe('Grid item record routes', () => {

        test('POST grid item passes exhibit id, grid id, and body to the model', async () => {
            mockGridsModel.create_grid_item_record.mockResolvedValue({ status: 201, message: 'created', data: TEST_ITEM_ID });

            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_item_records.post.endpoint, IDS))
                .send({ title: 'item', item_type: 'text' });

            expect(response.status).toBe(201);
            expect(mockGridsModel.create_grid_item_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                TEST_GRID_ID,
                expect.objectContaining({ title: 'item' })
            );
        });

        test('GET grid item records maps params to the model', async () => {
            mockGridsModel.get_grid_item_records.mockResolvedValue({ status: 200, message: 'ok', data: [] });

            const response = await request(app)
                .get(path_for(ENDPOINTS.grid_item_records.get.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockGridsModel.get_grid_item_records).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_GRID_ID);
        });

        test('GET single grid item dispatches to the plain record fetch by default', async () => {
            mockGridsModel.get_grid_item_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.grid_item_record.get.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockGridsModel.get_grid_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_GRID_ID, TEST_ITEM_ID);
        });

        test('GET single grid item with type=edit dispatches to the edit-record fetch', async () => {
            mockGridsModel.get_grid_item_edit_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.grid_item_record.get.endpoint, IDS))
                .query({ type: 'edit', uid: TEST_USER_UID });

            expect(response.status).toBe(200);
            expect(mockGridsModel.get_grid_item_edit_record).toHaveBeenCalled();
            expect(mockGridsModel.get_grid_item_record).not.toHaveBeenCalled();
        });

        test('GET single grid item with type=details dispatches to the details fetch', async () => {
            mockGridsModel.get_grid_item_details_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.grid_item_record.get.endpoint, IDS))
                .query({ type: 'details' });

            expect(response.status).toBe(200);
            expect(mockGridsModel.get_grid_item_details_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_GRID_ID, TEST_ITEM_ID);
        });

        test('PUT grid item maps params and body to the model', async () => {
            mockGridsModel.update_grid_item_record.mockResolvedValue({ status: 200, message: 'updated' });

            const response = await request(app)
                .put(path_for(ENDPOINTS.grid_item_records.put.endpoint, IDS))
                .send({ title: 'renamed' });

            expect(response.status).toBe(200);
            expect(mockGridsModel.update_grid_item_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                TEST_GRID_ID,
                TEST_ITEM_ID,
                expect.objectContaining({ title: 'renamed' })
            );
        });

        test('DELETE grid item maps params and record type to the model', async () => {
            mockGridsModel.delete_grid_item_record.mockResolvedValue({ status: 204, message: 'deleted' });

            const response = await request(app)
                .delete(path_for(ENDPOINTS.grid_item_records.delete.endpoint, IDS))
                .query({ type: 'grid_item' });

            expect(response.status).toBe(204);
            expect(mockGridsModel.delete_grid_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_GRID_ID, TEST_ITEM_ID, 'grid_item');
        });

        test('DELETE grid item rejects an unknown record type with 400', async () => {
            const response = await request(app)
                .delete(path_for(ENDPOINTS.grid_item_records.delete.endpoint, IDS))
                .query({ type: 'not-a-type' });

            expect(response.status).toBe(400);
            expect(mockGridsModel.delete_grid_item_record).not.toHaveBeenCalled();
        });

        test('DELETE grid item returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .delete(path_for(ENDPOINTS.grid_item_records.delete.endpoint, IDS));

            expect(response.status).toBe(403);
            expect(mockGridsModel.delete_grid_item_record).not.toHaveBeenCalled();
        });
    });

    // ==================== STATE MANAGEMENT ====================

    describe('Grid item state routes', () => {

        test('POST publish maps params to the model and returns 200 on success', async () => {
            mockGridsModel.publish_grid_item_record.mockResolvedValue(true);

            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_item_records.grid_item_publish.post.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockGridsModel.publish_grid_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_GRID_ID, TEST_ITEM_ID);
        });

        test('POST publish returns 422 when the model refuses', async () => {
            mockGridsModel.publish_grid_item_record.mockResolvedValue({ status: false, message: 'minimum not met' });

            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_item_records.grid_item_publish.post.endpoint, IDS));

            expect(response.status).toBe(422);
        });

        test('POST suppress maps params to the model and returns 200 on success', async () => {
            mockGridsModel.suppress_grid_item_record.mockResolvedValue(true);

            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_item_records.grid_item_suppress.post.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockGridsModel.suppress_grid_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_GRID_ID, TEST_ITEM_ID);
        });

        test('POST unlock requires a uid query param', async () => {
            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_item_unlock_record.post.endpoint, IDS));

            expect(response.status).toBe(400);
            expect(mockGridsModel.unlock_grid_item_record).not.toHaveBeenCalled();
        });

        test('POST unlock maps params and uid to the model', async () => {
            mockGridsModel.unlock_grid_item_record.mockResolvedValue({ status: 200, message: 'unlocked' });

            const response = await request(app)
                .post(path_for(ENDPOINTS.grid_item_unlock_record.post.endpoint, IDS))
                .query({ uid: TEST_USER_UID });

            expect(response.status).toBe(200);
            expect(mockGridsModel.unlock_grid_item_record).toHaveBeenCalled();
        });
    });

    // ==================== VALIDATION ====================

    describe('Path-format validation', () => {

        test('GET grid record with malformed exhibit id returns 400 without touching the model', async () => {
            const response = await request(app)
                .get(path_for(ENDPOINTS.grid_records.get.endpoint, { ...IDS, exhibit_id: 'bad%20id' }));

            expect(response.status).toBe(400);
            expect(mockGridsModel.get_grid_record).not.toHaveBeenCalled();
        });
    });
});
