/**
 * Route-mounting Integration Tests for Timeline Routes
 *
 * Mounts the REAL exhibits/timelines_routes.js (real endpoints module,
 * real controller, real validation/authorization chain) with the model
 * mocked. Verifies route registration, path-param mapping, and
 * middleware ordering for every registered timeline endpoint.
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
const TEST_TIMELINE_ID = '660e8400-e29b-41d4-a716-446655440100';
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

const mockTimelinesModel = {
    create_timeline_record: jest.fn(),
    get_timeline_record: jest.fn(),
    update_timeline_record: jest.fn(),
    create_timeline_item_record: jest.fn(),
    get_timeline_item_records: jest.fn(),
    get_timeline_item_record: jest.fn(),
    get_timeline_item_edit_record: jest.fn(),
    get_timeline_item_details_record: jest.fn(),
    update_timeline_item_record: jest.fn(),
    delete_timeline_item_record: jest.fn(),
    publish_timeline_item_record: jest.fn(),
    suppress_timeline_item_record: jest.fn(),
    unlock_timeline_item_record: jest.fn()
};

jest.mock('../../exhibits/timelines_model', () => mockTimelinesModel);

const ENDPOINTS = require('../../exhibits/endpoints/index')().exhibits;

/*
 * Builds a request path from a registered endpoint template. Anchored on
 * the segment boundary so a short key never corrupts a longer one
 * (":timeline_id" vs ":timeline_item_id").
 */
const path_for = (template, params = {}) => {
    let path = template;
    for (const [key, value] of Object.entries(params)) {
        path = path.replace(new RegExp(`:${key}(?=/|$)`, 'g'), value);
    }
    return path;
};

const IDS = {
    exhibit_id: TEST_EXHIBIT_ID,
    timeline_id: TEST_TIMELINE_ID,
    item_id: TEST_ITEM_ID,
    timeline_item_id: TEST_ITEM_ID
};

describe('Timeline Routes Integration (real router)', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const routes = require('../../exhibits/timelines_routes');
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
            ['get', path_for(ENDPOINTS.timeline_records.get.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.timeline_records.post.endpoint, IDS)],
            ['put', path_for(ENDPOINTS.timeline_records.put.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.timeline_item_records.post.endpoint, IDS)],
            ['get', path_for(ENDPOINTS.timeline_item_records.get.endpoint, IDS)],
            ['get', path_for(ENDPOINTS.timeline_item_record.get.endpoint, IDS)],
            ['put', path_for(ENDPOINTS.timeline_item_records.put.endpoint, IDS)],
            ['delete', path_for(ENDPOINTS.timeline_item_records.delete.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.timeline_item_records.timeline_item_publish.post.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.timeline_item_records.timeline_item_suppress.post.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.timeline_item_unlock_record.post.endpoint, IDS)]
        ];

        test.each(routes_under_test)('%s %s rejects with 401 before reaching the model', async (method, path) => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });

            const response = await request(app)[method](path).send({ text: 'x' });

            expect(response.status).toBe(401);
            for (const fn of Object.values(mockTimelinesModel)) {
                expect(fn).not.toHaveBeenCalled();
            }
        });
    });

    // ==================== TIMELINE CRUD ====================

    describe('Timeline record routes', () => {

        test('GET timeline record maps path params through to the model', async () => {
            mockTimelinesModel.get_timeline_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.timeline_records.get.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.get_timeline_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_TIMELINE_ID);
        });

        test('POST timeline record passes exhibit id and body to the model', async () => {
            mockTimelinesModel.create_timeline_record.mockResolvedValue({ status: 201, message: 'created', data: TEST_TIMELINE_ID });

            const response = await request(app)
                .post(path_for(ENDPOINTS.timeline_records.post.endpoint, IDS))
                .send({ internal_name: 'x', text: 'timeline' });

            expect(response.status).toBe(201);
            expect(mockTimelinesModel.create_timeline_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                expect.objectContaining({ internal_name: 'x' })
            );
        });

        test('POST timeline record returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .post(path_for(ENDPOINTS.timeline_records.post.endpoint, IDS))
                .send({ text: 'timeline' });

            expect(response.status).toBe(403);
            expect(mockTimelinesModel.create_timeline_record).not.toHaveBeenCalled();
        });

        test('PUT timeline record maps params and body to the model', async () => {
            mockTimelinesModel.update_timeline_record.mockResolvedValue({ status: 200, message: 'updated' });

            const response = await request(app)
                .put(path_for(ENDPOINTS.timeline_records.put.endpoint, IDS))
                .send({ text: 'renamed' });

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.update_timeline_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                TEST_TIMELINE_ID,
                expect.objectContaining({ text: 'renamed' })
            );
        });
    });

    // ==================== TIMELINE ITEM CRUD ====================

    describe('Timeline item record routes', () => {

        test('POST timeline item passes exhibit id, timeline id, and body to the model', async () => {
            mockTimelinesModel.create_timeline_item_record.mockResolvedValue({ status: 201, message: 'created', data: TEST_ITEM_ID });

            const response = await request(app)
                .post(path_for(ENDPOINTS.timeline_item_records.post.endpoint, IDS))
                .send({ title: 'item', date: '2026-01-01' });

            expect(response.status).toBe(201);
            expect(mockTimelinesModel.create_timeline_item_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                TEST_TIMELINE_ID,
                expect.objectContaining({ title: 'item' })
            );
        });

        test('GET timeline item records maps params to the model', async () => {
            mockTimelinesModel.get_timeline_item_records.mockResolvedValue({ status: 200, message: 'ok', data: [] });

            const response = await request(app)
                .get(path_for(ENDPOINTS.timeline_item_records.get.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.get_timeline_item_records).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_TIMELINE_ID);
        });

        test('GET single timeline item dispatches to the plain record fetch by default', async () => {
            mockTimelinesModel.get_timeline_item_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.timeline_item_record.get.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.get_timeline_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_TIMELINE_ID, TEST_ITEM_ID);
        });

        test('GET single timeline item with type=details dispatches to the details fetch', async () => {
            mockTimelinesModel.get_timeline_item_details_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.timeline_item_record.get.endpoint, IDS))
                .query({ type: 'details' });

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.get_timeline_item_details_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_TIMELINE_ID, TEST_ITEM_ID);
            expect(mockTimelinesModel.get_timeline_item_record).not.toHaveBeenCalled();
        });

        test('GET single timeline item with type=edit dispatches to the edit-record fetch', async () => {
            mockTimelinesModel.get_timeline_item_edit_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.timeline_item_record.get.endpoint, IDS))
                .query({ type: 'edit', uid: TEST_USER_UID });

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.get_timeline_item_edit_record).toHaveBeenCalled();
        });

        test('PUT timeline item maps params and body to the model', async () => {
            mockTimelinesModel.update_timeline_item_record.mockResolvedValue({ status: 200, message: 'updated' });

            const response = await request(app)
                .put(path_for(ENDPOINTS.timeline_item_records.put.endpoint, IDS))
                .send({ title: 'renamed' });

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.update_timeline_item_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                TEST_TIMELINE_ID,
                TEST_ITEM_ID,
                expect.objectContaining({ title: 'renamed' })
            );
        });

        test('DELETE timeline item maps params to the model', async () => {
            mockTimelinesModel.delete_timeline_item_record.mockResolvedValue({ status: 204, message: 'deleted' });

            const response = await request(app)
                .delete(path_for(ENDPOINTS.timeline_item_records.delete.endpoint, IDS));

            expect(response.status).toBe(204);
            expect(mockTimelinesModel.delete_timeline_item_record).toHaveBeenCalled();
        });

        test('DELETE timeline item returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .delete(path_for(ENDPOINTS.timeline_item_records.delete.endpoint, IDS));

            expect(response.status).toBe(403);
            expect(mockTimelinesModel.delete_timeline_item_record).not.toHaveBeenCalled();
        });
    });

    // ==================== STATE MANAGEMENT ====================

    describe('Timeline item state routes', () => {

        test('POST publish maps params to the model and returns 200 on success', async () => {
            mockTimelinesModel.publish_timeline_item_record.mockResolvedValue({ status: true });

            const response = await request(app)
                .post(path_for(ENDPOINTS.timeline_item_records.timeline_item_publish.post.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.publish_timeline_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_TIMELINE_ID, TEST_ITEM_ID);
        });

        test('POST publish returns 422 when the model refuses', async () => {
            mockTimelinesModel.publish_timeline_item_record.mockResolvedValue({ status: false, message: 'refused' });

            const response = await request(app)
                .post(path_for(ENDPOINTS.timeline_item_records.timeline_item_publish.post.endpoint, IDS));

            expect(response.status).toBe(422);
        });

        test('POST suppress maps params to the model and returns 200 on success', async () => {
            mockTimelinesModel.suppress_timeline_item_record.mockResolvedValue(true);

            const response = await request(app)
                .post(path_for(ENDPOINTS.timeline_item_records.timeline_item_suppress.post.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.suppress_timeline_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_TIMELINE_ID, TEST_ITEM_ID);
        });

        test('POST unlock requires a uid query param', async () => {
            const response = await request(app)
                .post(path_for(ENDPOINTS.timeline_item_unlock_record.post.endpoint, IDS));

            expect(response.status).toBe(400);
            expect(mockTimelinesModel.unlock_timeline_item_record).not.toHaveBeenCalled();
        });

        test('POST unlock maps params and uid to the model', async () => {
            mockTimelinesModel.unlock_timeline_item_record.mockResolvedValue({ status: 200, message: 'unlocked' });

            const response = await request(app)
                .post(path_for(ENDPOINTS.timeline_item_unlock_record.post.endpoint, IDS))
                .query({ uid: TEST_USER_UID });

            expect(response.status).toBe(200);
            expect(mockTimelinesModel.unlock_timeline_item_record).toHaveBeenCalled();
        });
    });

    // ==================== VALIDATION ====================

    describe('Path-param forwarding', () => {

        /*
         * Unlike the grid controller, the timeline controller's
         * validate_param only rejects empty values — UUID-format
         * validation happens in the model layer. This pins that contract:
         * the raw (decoded) param reaches the model untouched.
         */
        test('GET timeline record forwards a non-UUID exhibit id for the model to reject', async () => {
            mockTimelinesModel.get_timeline_record.mockResolvedValue({ status: 400, message: 'Invalid UUID' });

            const response = await request(app)
                .get(path_for(ENDPOINTS.timeline_records.get.endpoint, { ...IDS, exhibit_id: 'not-a-uuid' }));

            expect(response.status).toBe(400);
            expect(mockTimelinesModel.get_timeline_record).toHaveBeenCalledWith('not-a-uuid', TEST_TIMELINE_ID);
        });
    });
});
