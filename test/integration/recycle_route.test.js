/**
 * Integration tests for the recycle-bin routes' security wiring.
 *
 * Verifies {APP_PATH}/api/v1/recycle enforces, in order:
 *   TOKEN.verify (auth)  ->  AUTHORIZE.check_permission (authz)  ->  handler
 *
 * i.e. an unauthenticated/unauthorized caller is rejected BEFORE any
 * restore/permanent-delete/empty runs, and listing/emptying are owner-scoped
 * unless the caller holds `manage_recycle_bin`. Auth/authz internals are tested
 * elsewhere; here we assert the routes apply them correctly. The model is mocked
 * so no DB is needed.
 */

'use strict';

const express = require('express');
const request = require('supertest');

// ==================== MOCKS ====================

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../config/app_config', () => () => ({ app_path: '/exhibits-dashboard' }));

// TOKEN.verify: 401 unless an x-access-token is present; sets req.decoded like the real one.
jest.mock('../../libs/tokens', () => ({
    verify: (req, res, next) => {
        if (req.headers['x-access-token']) {
            req.decoded = { sub: 'curator' };
            return next();
        }
        return res.status(401).json({ message: 'Unauthorized request' });
    }
}));

// Controllable authorization. (jest requires mock-factory vars to be `mock`-prefixed.)
const mockCheckPermission = jest.fn();
jest.mock('../../auth/authorize', () => ({ check_permission: (...args) => mockCheckPermission(...args) }));

// Deterministic pass-through rate limiters (no limit flakiness across many requests).
jest.mock('../../config/rate_limits_loader', () => ({
    rate_limits: {
        read_operations: (req, res, next) => next(),
        write_operations: (req, res, next) => next(),
        state_change_operations: (req, res, next) => next()
    }
}));

// Stub the model so no knex/DB is loaded.
const mockGet = jest.fn();
const mockRestore = jest.fn();
const mockDelete = jest.fn();
const mockDeleteAll = jest.fn();
jest.mock('../../exhibits/recycle_model', () => ({
    get_recycled_records: (...a) => mockGet(...a),
    restore_recycled_record: (...a) => mockRestore(...a),
    delete_recycled_record: (...a) => mockDelete(...a),
    delete_all_recycled_records: (...a) => mockDeleteAll(...a)
}));

const register_recycle_routes = require('../../exhibits/recycle_routes');

// ==================== FIXTURE ====================

const BASE = '/exhibits-dashboard/api/v1/recycle';
const EXHIBIT_UUID = '11111111-1111-4111-8111-111111111111';
const ITEM_UUID = '22222222-2222-4222-8222-222222222222';
let app;

beforeAll(() => {
    app = express();
    app.use(express.json());
    register_recycle_routes(app);
});

beforeEach(() => jest.clearAllMocks());

// ==================== LIST ====================

describe('GET /recycle — auth + owner scoping', () => {

    test('401 when no auth token; authorization and model never reached', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).get(BASE);

        expect(res.status).toBe(401);
        expect(mockCheckPermission).not.toHaveBeenCalled();
        expect(mockGet).not.toHaveBeenCalled();
    });

    test('non-admin is scoped to their own records (created_by = caller)', async () => {
        mockCheckPermission.mockResolvedValue(false); // lacks manage_recycle_bin
        mockGet.mockResolvedValue({ status: 200, message: 'Recycled records', data: [] });

        const res = await request(app).get(BASE).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(mockCheckPermission.mock.calls[0][0]).toMatchObject({ permissions: ['manage_recycle_bin'] });
        expect(mockGet).toHaveBeenCalledWith('curator'); // owner-scoped
    });

    test('manage_recycle_bin holder sees all owners (created_by = null)', async () => {
        mockCheckPermission.mockResolvedValue(true);
        mockGet.mockResolvedValue({ status: 200, message: 'Recycled records', data: [] });

        const res = await request(app).get(BASE).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(mockGet).toHaveBeenCalledWith(null); // system-wide
    });
});

// ==================== RESTORE ====================

describe('PUT /recycle/:exhibit_id/:uuid/:type — restore', () => {

    test('401 when no auth token; model never reached', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).put(`${BASE}/${EXHIBIT_UUID}/${ITEM_UUID}/item`);

        expect(res.status).toBe(401);
        expect(mockCheckPermission).not.toHaveBeenCalled();
        expect(mockRestore).not.toHaveBeenCalled();
    });

    test('403 when authenticated but unauthorized; restore never runs', async () => {
        mockCheckPermission.mockResolvedValue(false);

        const res = await request(app).put(`${BASE}/${EXHIBIT_UUID}/${ITEM_UUID}/item`).set('x-access-token', 'jwt');

        expect(res.status).toBe(403);
        expect(mockRestore).not.toHaveBeenCalled();
    });

    test('child record uses delete_item / delete_any_item + parent-exhibit ownership', async () => {
        mockCheckPermission.mockResolvedValue(true);
        mockRestore.mockResolvedValue({ status: 200, message: 'Record restored' });

        const res = await request(app).put(`${BASE}/${EXHIBIT_UUID}/${ITEM_UUID}/item`).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(mockCheckPermission.mock.calls[0][0]).toMatchObject({
            permissions: ['delete_item', 'delete_any_item'],
            record_type: 'item',
            parent_id: EXHIBIT_UUID,
            child_id: ITEM_UUID
        });
        expect(mockRestore).toHaveBeenCalledWith('item', ITEM_UUID);
    });

    test('exhibit record uses delete_exhibit / delete_any_exhibit + exhibit ownership', async () => {
        mockCheckPermission.mockResolvedValue(true);
        mockRestore.mockResolvedValue({ status: 200, message: 'Record restored' });

        const res = await request(app).put(`${BASE}/${EXHIBIT_UUID}/${EXHIBIT_UUID}/exhibit`).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(mockCheckPermission.mock.calls[0][0]).toMatchObject({
            permissions: ['delete_exhibit', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: EXHIBIT_UUID
        });
        expect(mockRestore).toHaveBeenCalledWith('exhibit', EXHIBIT_UUID);
    });

    test('400 on an unknown record type; authz and model never run', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).put(`${BASE}/${EXHIBIT_UUID}/${ITEM_UUID}/bogus`).set('x-access-token', 'jwt');

        expect(res.status).toBe(400);
        expect(mockCheckPermission).not.toHaveBeenCalled();
        expect(mockRestore).not.toHaveBeenCalled();
    });
});

// ==================== PERMANENT DELETE ====================

describe('DELETE /recycle/:exhibit_id/:uuid/:type — permanent delete', () => {

    test('401 when no auth token; model never reached', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).delete(`${BASE}/${EXHIBIT_UUID}/${ITEM_UUID}/item`);

        expect(res.status).toBe(401);
        expect(mockDelete).not.toHaveBeenCalled();
    });

    test('403 when authenticated but unauthorized; delete never runs', async () => {
        mockCheckPermission.mockResolvedValue(false);

        const res = await request(app).delete(`${BASE}/${EXHIBIT_UUID}/${ITEM_UUID}/item`).set('x-access-token', 'jwt');

        expect(res.status).toBe(403);
        expect(mockDelete).not.toHaveBeenCalled();
    });

    test('authorized permanent delete reaches the model with (type, uuid)', async () => {
        mockCheckPermission.mockResolvedValue(true);
        mockDelete.mockResolvedValue({ status: 200, message: 'Record permanently deleted' });

        const res = await request(app).delete(`${BASE}/${EXHIBIT_UUID}/${ITEM_UUID}/item`).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(mockDelete).toHaveBeenCalledWith('item', ITEM_UUID);
    });
});

// ==================== EMPTY BIN ====================

describe('DELETE /recycle/all — empty bin (owner-scoped, admin empties all)', () => {

    test('401 when no auth token; model never reached', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).delete(`${BASE}/all`);

        expect(res.status).toBe(401);
        expect(mockDeleteAll).not.toHaveBeenCalled();
    });

    test('non-admin empties only their own bin (created_by = caller)', async () => {
        mockCheckPermission.mockResolvedValue(false); // lacks manage_recycle_bin
        mockDeleteAll.mockResolvedValue({ status: 200, message: 'Records permanently deleted', deleted: 0 });

        const res = await request(app).delete(`${BASE}/all`).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(mockCheckPermission.mock.calls[0][0]).toMatchObject({ permissions: ['manage_recycle_bin'] });
        expect(mockDeleteAll).toHaveBeenCalledWith('curator'); // owner-scoped, NOT all owners
    });

    test('manage_recycle_bin holder empties the whole bin (created_by = null)', async () => {
        mockCheckPermission.mockResolvedValue(true);
        mockDeleteAll.mockResolvedValue({ status: 200, message: 'Records permanently deleted', deleted: 3 });

        const res = await request(app).delete(`${BASE}/all`).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(mockDeleteAll).toHaveBeenCalledWith(null); // all owners
        // `/recycle/all` (one segment) must NOT fall through to the 3-segment
        // single-record delete route.
        expect(mockDelete).not.toHaveBeenCalled();
    });
});
