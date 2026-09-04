/**
 * Route-mounting Integration Tests for Items Routes
 *
 * Mounts the REAL exhibits/items_routes.js (real endpoints module, real
 * controller, real items_helper validation/authorization chain) with the
 * models mocked. Verifies route registration, path-param mapping,
 * middleware ordering, the publish/suppress type-dispatch to the four
 * container models, reorder payload validation, and the conditional
 * reindex scheduling — coverage the hand-rolled items_integration app
 * cannot provide.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

/*
 * Requiring the shared mocks pins APP_PATH before any endpoints module is
 * loaded; the jest.mock factories below are hoisted and resolve it lazily.
 */
const { TEST_UUID, TEST_USER_UID, path_for, mock_model } = require('./helpers/mocks');

const TEST_EXHIBIT_ID = TEST_UUID;
const TEST_ITEM_ID = '770e8400-e29b-41d4-a716-446655440200';
const TEST_GRID_ID = '660e8400-e29b-41d4-a716-446655440100';

jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());

jest.mock('../../libs/tokens', () => require('./helpers/mocks').tokens_factory());

jest.mock('../../auth/authorize', () => require('./helpers/mocks').authorize_factory());

jest.mock('../../config/rate_limits_loader', () => require('./helpers/mocks').rate_limits_factory([
    'read_operations',
    'write_operations',
    'state_change_operations'
]));

const mockItemsModel = mock_model([
    'create_item_record',
    'get_item_records',
    'get_item_record',
    'get_item_edit_record',
    'get_item_details_record',
    'update_item_record',
    'delete_item_record',
    'publish_item_record',
    'suppress_item_record',
    'reorder_exhibit_items',
    'schedule_reorder_reindex',
    'unlock_item_record'
]);

jest.mock('../../exhibits/items_model', () => mockItemsModel);

const mockHeadingsModel = mock_model(['publish_heading_record', 'suppress_heading_record']);

jest.mock('../../exhibits/headings_model', () => mockHeadingsModel);

const mockGridsModel = mock_model(['publish_grid_record', 'suppress_grid_record']);

jest.mock('../../exhibits/grid_model', () => mockGridsModel);

const mockTimelinesModel = mock_model(['publish_timeline_record', 'suppress_timeline_record']);

jest.mock('../../exhibits/timelines_model', () => mockTimelinesModel);

const mockExhibitsModel = mock_model(['get_exhibit_record']);

jest.mock('../../exhibits/exhibits_model', () => mockExhibitsModel);

const ENDPOINTS = require('../../exhibits/endpoints/index')().exhibits;

const IDS = {
    exhibit_id: TEST_EXHIBIT_ID,
    item_id: TEST_ITEM_ID
};

describe('Items Routes Integration (real router)', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const routes = require('../../exhibits/items_routes');
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
        mockExhibitsModel.get_exhibit_record.mockResolvedValue({ data: { is_published: 0 } });
    });

    // ==================== MIDDLEWARE ORDERING ====================

    describe('Token verification gate', () => {

        const all_models = [
            mockItemsModel, mockHeadingsModel, mockGridsModel, mockTimelinesModel
        ];

        const routes_under_test = [
            ['post', path_for(ENDPOINTS.item_records.post.endpoint, IDS)],
            ['get', path_for(ENDPOINTS.item_records.endpoint, IDS)],
            ['get', path_for(ENDPOINTS.item_records.get.endpoint, IDS)],
            ['put', path_for(ENDPOINTS.item_records.put.endpoint, IDS)],
            ['delete', path_for(ENDPOINTS.item_records.delete.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.item_records.item_publish.post.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.item_records.item_suppress.post.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.item_unlock_record.post.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.reorder_records.post.endpoint, IDS)]
        ];

        test.each(routes_under_test)('%s %s rejects with 401 before reaching any model', async (method, path) => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });

            const response = await request(app)[method](path).send([{ type: 'item' }]);

            expect(response.status).toBe(401);
            for (const model of all_models) {
                for (const fn of Object.values(model)) {
                    expect(fn).not.toHaveBeenCalled();
                }
            }
        });
    });

    // ==================== ITEM CRUD ====================

    describe('Item record routes', () => {

        test('POST item passes exhibit id and body to the model', async () => {
            mockItemsModel.create_item_record.mockResolvedValue({ status: 201, message: 'created', data: TEST_ITEM_ID });

            const response = await request(app)
                .post(path_for(ENDPOINTS.item_records.post.endpoint, IDS))
                .send({ item_type: 'text', text: 'Item copy' });

            expect(response.status).toBe(201);
            expect(mockItemsModel.create_item_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                expect.objectContaining({ item_type: 'text' })
            );
        });

        test('POST item returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .post(path_for(ENDPOINTS.item_records.post.endpoint, IDS))
                .send({ item_type: 'text' });

            expect(response.status).toBe(403);
            expect(mockItemsModel.create_item_record).not.toHaveBeenCalled();
        });

        test('GET item records maps the exhibit id to the model', async () => {
            mockItemsModel.get_item_records.mockResolvedValue({ status: 200, message: 'ok', data: [] });

            const response = await request(app)
                .get(path_for(ENDPOINTS.item_records.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockItemsModel.get_item_records).toHaveBeenCalledWith(TEST_EXHIBIT_ID);
        });

        test('GET single item dispatches to the plain record fetch by default', async () => {
            mockItemsModel.get_item_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.item_records.get.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockItemsModel.get_item_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_ITEM_ID);
        });

        test('GET single item with type=edit requires uid and dispatches to the edit fetch', async () => {
            const missing_uid = await request(app)
                .get(path_for(ENDPOINTS.item_records.get.endpoint, IDS))
                .query({ type: 'edit' });
            expect(missing_uid.status).toBe(400);

            mockItemsModel.get_item_edit_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.item_records.get.endpoint, IDS))
                .query({ type: 'edit', uid: TEST_USER_UID });

            expect(response.status).toBe(200);
            expect(mockItemsModel.get_item_edit_record).toHaveBeenCalledWith(TEST_USER_UID, TEST_EXHIBIT_ID, TEST_ITEM_ID);
        });

        test('GET single item with type=details dispatches to the details fetch', async () => {
            mockItemsModel.get_item_details_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.item_records.get.endpoint, IDS))
                .query({ type: 'details' });

            expect(response.status).toBe(200);
            expect(mockItemsModel.get_item_details_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_ITEM_ID);
        });

        test('GET single item rejects an unknown type with 400', async () => {
            const response = await request(app)
                .get(path_for(ENDPOINTS.item_records.get.endpoint, IDS))
                .query({ type: 'summary' });

            expect(response.status).toBe(400);
            expect(mockItemsModel.get_item_record).not.toHaveBeenCalled();
        });

        test('PUT item maps params and body to the model', async () => {
            mockItemsModel.update_item_record.mockResolvedValue({ status: 200, message: 'updated' });

            const response = await request(app)
                .put(path_for(ENDPOINTS.item_records.put.endpoint, IDS))
                .send({ text: 'renamed' });

            expect(response.status).toBe(200);
            expect(mockItemsModel.update_item_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                TEST_ITEM_ID,
                expect.objectContaining({ text: 'renamed' })
            );
        });

        test('DELETE item maps params to the model and returns 403 when denied', async () => {
            mockItemsModel.delete_item_record.mockResolvedValue({ status: 204, message: 'deleted' });

            const ok = await request(app)
                .delete(path_for(ENDPOINTS.item_records.delete.endpoint, IDS));
            expect(ok.status).toBe(204);
            expect(mockItemsModel.delete_item_record).toHaveBeenCalled();

            AUTHORIZE.check_permission.mockResolvedValue(false);
            mockItemsModel.delete_item_record.mockClear();

            const denied = await request(app)
                .delete(path_for(ENDPOINTS.item_records.delete.endpoint, IDS));
            expect(denied.status).toBe(403);
            expect(mockItemsModel.delete_item_record).not.toHaveBeenCalled();
        });
    });

    // ==================== PUBLISH / SUPPRESS TYPE DISPATCH ====================

    describe('Publish and suppress type dispatch', () => {

        const PUBLISH_DISPATCH = [
            ['item', mockItemsModel, 'publish_item_record'],
            ['heading', mockHeadingsModel, 'publish_heading_record'],
            ['grid', mockGridsModel, 'publish_grid_record'],
            ['timeline', mockTimelinesModel, 'publish_timeline_record']
        ];

        test.each(PUBLISH_DISPATCH)('publish type=%s routes to the matching model', async (type, model, fn) => {
            model[fn].mockResolvedValue({ status: true });

            const response = await request(app)
                .post(path_for(ENDPOINTS.item_records.item_publish.post.endpoint, IDS))
                .query({ type });

            expect(response.status).toBe(200);
            expect(model[fn]).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_ITEM_ID);
        });

        const SUPPRESS_DISPATCH = [
            ['item', mockItemsModel, 'suppress_item_record'],
            ['heading', mockHeadingsModel, 'suppress_heading_record'],
            ['grid', mockGridsModel, 'suppress_grid_record'],
            ['timeline', mockTimelinesModel, 'suppress_timeline_record']
        ];

        test.each(SUPPRESS_DISPATCH)('suppress type=%s routes to the matching model', async (type, model, fn) => {
            model[fn].mockResolvedValue({ status: true });

            const response = await request(app)
                .post(path_for(ENDPOINTS.item_records.item_suppress.post.endpoint, IDS))
                .query({ type });

            expect(response.status).toBe(200);
            expect(model[fn]).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_ITEM_ID);
        });

        test('publish rejects a missing or unknown type with 400 before authorizing', async () => {
            for (const query of [{}, { type: 'exhibit' }, { type: 'constructor' }]) {
                const response = await request(app)
                    .post(path_for(ENDPOINTS.item_records.item_publish.post.endpoint, IDS))
                    .query(query);

                expect(response.status).toBe(400);
            }
            expect(AUTHORIZE.check_permission).not.toHaveBeenCalled();
        });

        test('publish returns 422 with the model message when the model refuses', async () => {
            mockItemsModel.publish_item_record.mockResolvedValue({ status: false, message: 'minimum not met' });

            const response = await request(app)
                .post(path_for(ENDPOINTS.item_records.item_publish.post.endpoint, IDS))
                .query({ type: 'item' });

            expect(response.status).toBe(422);
            expect(response.body.message).toBe('minimum not met');
        });

        test('publish returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .post(path_for(ENDPOINTS.item_records.item_publish.post.endpoint, IDS))
                .query({ type: 'item' });

            expect(response.status).toBe(403);
            expect(mockItemsModel.publish_item_record).not.toHaveBeenCalled();
        });
    });

    // ==================== REORDER ====================

    describe('Reorder route', () => {

        const VALID_ORDER = [
            { uuid: 'a', type: 'item', order: 1 },
            { uuid: 'b', type: 'griditem', grid_id: TEST_GRID_ID, order: 2 }
        ];

        test('applies a valid reorder and skips reindex for unpublished exhibits', async () => {
            mockItemsModel.reorder_exhibit_items.mockResolvedValue(true);
            mockExhibitsModel.get_exhibit_record.mockResolvedValue({ data: { is_published: 0 } });

            const response = await request(app)
                .post(path_for(ENDPOINTS.reorder_records.post.endpoint, IDS))
                .send(VALID_ORDER);

            expect(response.status).toBe(200);
            expect(mockItemsModel.reorder_exhibit_items).toHaveBeenCalledWith(TEST_EXHIBIT_ID, VALID_ORDER);
            expect(mockItemsModel.schedule_reorder_reindex).not.toHaveBeenCalled();
        });

        test('schedules the targeted reindex when the exhibit is published', async () => {
            mockItemsModel.reorder_exhibit_items.mockResolvedValue(true);
            mockExhibitsModel.get_exhibit_record.mockResolvedValue({ data: { is_published: 1 } });

            const response = await request(app)
                .post(path_for(ENDPOINTS.reorder_records.post.endpoint, IDS))
                .send(VALID_ORDER);

            expect(response.status).toBe(200);
            expect(mockItemsModel.schedule_reorder_reindex).toHaveBeenCalledWith(TEST_EXHIBIT_ID, VALID_ORDER);
        });

        test('rejects an empty or non-array payload with 400', async () => {
            for (const body of [[], {}, { uuid: 'a' }]) {
                const response = await request(app)
                    .post(path_for(ENDPOINTS.reorder_records.post.endpoint, IDS))
                    .send(body);

                expect(response.status).toBe(400);
            }
            expect(mockItemsModel.reorder_exhibit_items).not.toHaveBeenCalled();
        });

        test('rejects entries with an unknown type with 400', async () => {
            const response = await request(app)
                .post(path_for(ENDPOINTS.reorder_records.post.endpoint, IDS))
                .send([{ uuid: 'a', type: 'widget' }]);

            expect(response.status).toBe(400);
            expect(mockItemsModel.reorder_exhibit_items).not.toHaveBeenCalled();
        });

        test('rejects a griditem entry without its grid id with 400', async () => {
            const response = await request(app)
                .post(path_for(ENDPOINTS.reorder_records.post.endpoint, IDS))
                .send([{ uuid: 'a', type: 'griditem' }]);

            expect(response.status).toBe(400);
            expect(mockItemsModel.reorder_exhibit_items).not.toHaveBeenCalled();
        });

        test('returns 422 when the transactional reorder fails', async () => {
            mockItemsModel.reorder_exhibit_items.mockResolvedValue(false);

            const response = await request(app)
                .post(path_for(ENDPOINTS.reorder_records.post.endpoint, IDS))
                .send(VALID_ORDER);

            expect(response.status).toBe(422);
            expect(mockItemsModel.schedule_reorder_reindex).not.toHaveBeenCalled();
        });
    });

    // ==================== UNLOCK ====================

    describe('Unlock route', () => {

        test('requires a uid query param', async () => {
            const response = await request(app)
                .post(path_for(ENDPOINTS.item_unlock_record.post.endpoint, IDS));

            expect(response.status).toBe(400);
            expect(mockItemsModel.unlock_item_record).not.toHaveBeenCalled();
        });

        test('maps uid, item id, and the force flag to the model', async () => {
            mockItemsModel.unlock_item_record.mockResolvedValue({ unlocked: true });

            const response = await request(app)
                .post(path_for(ENDPOINTS.item_unlock_record.post.endpoint, IDS))
                .query({ uid: TEST_USER_UID, force: 'true' });

            expect(response.status).toBe(200);
            expect(mockItemsModel.unlock_item_record).toHaveBeenCalledWith(
                TEST_USER_UID,
                TEST_ITEM_ID,
                { force: true }
            );
        });

        test('returns 422 when the model cannot unlock', async () => {
            mockItemsModel.unlock_item_record.mockResolvedValue(false);

            const response = await request(app)
                .post(path_for(ENDPOINTS.item_unlock_record.post.endpoint, IDS))
                .query({ uid: TEST_USER_UID });

            expect(response.status).toBe(422);
        });
    });
});
