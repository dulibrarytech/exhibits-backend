/**
 * Integration tests for the indexer /manage route's security wiring.
 *
 * Verifies POST {APP_PATH}/api/v1/indexer/manage enforces, in order:
 *   TOKEN.verify (auth)  ->  manage_index (authz)  ->  create_index handler
 *
 * i.e. an unauthenticated/unauthorized caller is rejected BEFORE the
 * destructive index create/rebuild runs. Auth/authz internals are tested
 * elsewhere; here we assert the route applies them in the right order. The
 * Elasticsearch service + model are mocked so no ES/DB is needed.
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
            req.decoded = { sub: 'admin' };
            return next();
        }
        return res.status(401).json({ message: 'Unauthorized request' });
    }
}));

// Controllable authorization. (jest requires mock-factory vars to be `mock`-prefixed.)
const mockCheckPermission = jest.fn();
jest.mock('../../auth/authorize', () => ({ check_permission: (...args) => mockCheckPermission(...args) }));

// Stub the ES service + model + helper so requiring the controller does not load
// Elasticsearch or the knex/DB config.
const mockCreateIndex = jest.fn();
const mockGetStatus = jest.fn();
jest.mock('../../indexer/service', () => ({
    create_index: (...args) => mockCreateIndex(...args),
    get_index_status: (...args) => mockGetStatus(...args)
}));
jest.mock('../../indexer/model', () => ({}));
jest.mock('../../indexer/indexer_helper', () => ({ is_valid_uuid: jest.fn(), is_valid_record_type: jest.fn() }));

const register_indexer_routes = require('../../indexer/routes');

// ==================== FIXTURE ====================

const URL = '/exhibits-dashboard/api/v1/indexer/manage';
let app;

beforeAll(() => {
    app = express();
    app.use(express.json());
    register_indexer_routes(app);
});

beforeEach(() => jest.clearAllMocks());

// ==================== TESTS ====================

describe('POST /api/v1/indexer/manage — auth + manage_index permission', () => {

    test('401 when no auth token, and authorization is never reached', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).post(URL);

        expect(res.status).toBe(401);
        // auth runs before authz; neither the permission check nor the index op runs
        expect(mockCheckPermission).not.toHaveBeenCalled();
        expect(mockCreateIndex).not.toHaveBeenCalled();
    });

    test('403 when authenticated but lacking manage_index — index op never runs', async () => {
        mockCheckPermission.mockResolvedValue(false);

        const res = await request(app).post(URL).set('x-access-token', 'jwt');

        expect(res.status).toBe(403);
        expect(mockCheckPermission).toHaveBeenCalledTimes(1);
        expect(mockCheckPermission.mock.calls[0][0]).toMatchObject({ permissions: ['manage_index'] });
        expect(mockCreateIndex).not.toHaveBeenCalled();
    });

    test('authorized request passes the guards and reaches create_index', async () => {
        mockCheckPermission.mockResolvedValue(true);
        mockCreateIndex.mockResolvedValue({ status: 200, success: true, message: 'Index created' });

        const res = await request(app).post(URL).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true });
        expect(mockCheckPermission).toHaveBeenCalledTimes(1);
        expect(mockCreateIndex).toHaveBeenCalledTimes(1);
    });
});

describe('GET /api/v1/indexer/manage — auth + manage_index permission (status)', () => {

    test('401 when no auth token', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).get(URL);

        expect(res.status).toBe(401);
        expect(mockCheckPermission).not.toHaveBeenCalled();
        expect(mockGetStatus).not.toHaveBeenCalled();
    });

    test('403 when authenticated but lacking manage_index', async () => {
        mockCheckPermission.mockResolvedValue(false);

        const res = await request(app).get(URL).set('x-access-token', 'jwt');

        expect(res.status).toBe(403);
        expect(mockCheckPermission).toHaveBeenCalledTimes(1);
        expect(mockGetStatus).not.toHaveBeenCalled();
    });

    test('authorized request returns index status', async () => {
        mockCheckPermission.mockResolvedValue(true);
        mockGetStatus.mockResolvedValue({ status: 200, data: { index: 'exhibits_index', exists: true, count: 42 } });

        const res = await request(app).get(URL).set('x-access-token', 'jwt');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ data: { exists: true, count: 42 } });
        expect(mockGetStatus).toHaveBeenCalledTimes(1);
    });
});
