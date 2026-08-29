/**
 * Route-mounting Integration Tests for Users Routes
 *
 * Mounts the REAL users/routes.js (real endpoints module, real
 * controller) with the model mocked. First request-level coverage of
 * the users subsystem: route registration, numeric-id validation,
 * authorization gating, and middleware ordering for all five routes.
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

const TEST_USER_ID = 42;
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
        write_operations: (req, res, next) => next()
    }
}));

const mockUsersModel = {
    get_users: jest.fn(),
    get_user: jest.fn(),
    save_user: jest.fn(),
    update_user: jest.fn(),
    delete_user: jest.fn(),
    update_status: jest.fn()
};

jest.mock('../../users/model', () => mockUsersModel);

const ENDPOINTS = require('../../users/endpoints')().users;

const path_for = (template, params = {}) => {
    let path = template;
    for (const [key, value] of Object.entries(params)) {
        path = path.replace(new RegExp(`:${key}(?=/|$)`, 'g'), value);
    }
    return path;
};

const VALID_USER = {
    du_id: '871234567',
    first_name: 'Test',
    last_name: 'User',
    email: 'test.user@du.edu'
};

describe('Users Routes Integration (real router)', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const routes = require('../../users/routes');
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
            ['get', ENDPOINTS.endpoint],
            ['post', ENDPOINTS.endpoint],
            ['get', path_for(ENDPOINTS.get_user.endpoint, { user_id: TEST_USER_ID })],
            ['put', path_for(ENDPOINTS.update_user.put.endpoint, { user_id: TEST_USER_ID })],
            ['delete', path_for(ENDPOINTS.delete_user.delete.endpoint, { user_id: TEST_USER_ID })],
            ['put', path_for(ENDPOINTS.user_status.endpoint, { id: TEST_USER_ID, is_active: 1 })]
        ];

        test.each(routes_under_test)('%s %s rejects with 401 before reaching the model', async (method, path) => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });

            const response = await request(app)[method](path).send(VALID_USER);

            expect(response.status).toBe(401);
            for (const fn of Object.values(mockUsersModel)) {
                expect(fn).not.toHaveBeenCalled();
            }
        });
    });

    // ==================== LIST / GET ====================

    describe('GET users list', () => {

        test('returns 200 with user records', async () => {
            mockUsersModel.get_users.mockResolvedValue({ data: [{ id: TEST_USER_ID, ...VALID_USER }] });

            const response = await request(app).get(ENDPOINTS.endpoint);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(mockUsersModel.get_users).toHaveBeenCalled();
        });

        test('returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app).get(ENDPOINTS.endpoint);

            expect(response.status).toBe(403);
            expect(mockUsersModel.get_users).not.toHaveBeenCalled();
        });
    });

    describe('GET single user', () => {

        test('parses the numeric id and returns the record', async () => {
            mockUsersModel.get_user.mockResolvedValue({ data: { id: TEST_USER_ID, ...VALID_USER } });

            const response = await request(app)
                .get(path_for(ENDPOINTS.get_user.endpoint, { user_id: TEST_USER_ID }));

            expect(response.status).toBe(200);
            expect(mockUsersModel.get_user).toHaveBeenCalledWith(TEST_USER_ID);
        });

        test('rejects a non-numeric id with 400 before reaching the model', async () => {
            const response = await request(app)
                .get(path_for(ENDPOINTS.get_user.endpoint, { user_id: 'abc' }));

            expect(response.status).toBe(400);
            expect(mockUsersModel.get_user).not.toHaveBeenCalled();
        });
    });

    // ==================== CREATE ====================

    describe('POST user', () => {

        test('passes the validated body to the model', async () => {
            mockUsersModel.save_user.mockResolvedValue({ data: { id: TEST_USER_ID } });

            const response = await request(app)
                .post(ENDPOINTS.endpoint)
                .send(VALID_USER);

            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(300);
            expect(mockUsersModel.save_user).toHaveBeenCalledWith(expect.objectContaining({ du_id: VALID_USER.du_id }));
        });

        test('rejects missing required fields with 400 before authorizing', async () => {
            const response = await request(app)
                .post(ENDPOINTS.endpoint)
                .send({ first_name: 'OnlyName' });

            expect(response.status).toBe(400);
            expect(response.body.message).toMatch(/Missing required fields/);
            expect(mockUsersModel.save_user).not.toHaveBeenCalled();
        });

        test('rejects an invalid email format with 400', async () => {
            const response = await request(app)
                .post(ENDPOINTS.endpoint)
                .send({ ...VALID_USER, email: 'not-an-email' });

            expect(response.status).toBe(400);
            expect(mockUsersModel.save_user).not.toHaveBeenCalled();
        });

        test('returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .post(ENDPOINTS.endpoint)
                .send(VALID_USER);

            expect(response.status).toBe(403);
            expect(mockUsersModel.save_user).not.toHaveBeenCalled();
        });
    });

    // ==================== UPDATE / DELETE / STATUS ====================

    describe('PUT user', () => {

        test('passes the numeric id and body to the model', async () => {
            mockUsersModel.update_user.mockResolvedValue({ data: { id: TEST_USER_ID } });

            const response = await request(app)
                .put(path_for(ENDPOINTS.update_user.put.endpoint, { user_id: TEST_USER_ID }))
                .send(VALID_USER);

            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(300);
            expect(mockUsersModel.update_user).toHaveBeenCalledWith(
                TEST_USER_ID,
                expect.objectContaining({ du_id: VALID_USER.du_id })
            );
        });

        test('returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .put(path_for(ENDPOINTS.update_user.put.endpoint, { user_id: TEST_USER_ID }))
                .send(VALID_USER);

            expect(response.status).toBe(403);
            expect(mockUsersModel.update_user).not.toHaveBeenCalled();
        });
    });

    describe('DELETE user', () => {

        test('passes the numeric id to the model', async () => {
            mockUsersModel.delete_user.mockResolvedValue({ data: true });

            const response = await request(app)
                .delete(path_for(ENDPOINTS.delete_user.delete.endpoint, { user_id: TEST_USER_ID }));

            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(300);
            expect(mockUsersModel.delete_user).toHaveBeenCalledWith(TEST_USER_ID);
        });

        test('rejects a non-numeric id with 400 before reaching the model', async () => {
            const response = await request(app)
                .delete(path_for(ENDPOINTS.delete_user.delete.endpoint, { user_id: 'abc' }));

            expect(response.status).toBe(400);
            expect(mockUsersModel.delete_user).not.toHaveBeenCalled();
        });

        test('returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .delete(path_for(ENDPOINTS.delete_user.delete.endpoint, { user_id: TEST_USER_ID }));

            expect(response.status).toBe(403);
            expect(mockUsersModel.delete_user).not.toHaveBeenCalled();
        });
    });

    describe('PUT user status', () => {

        test('passes the numeric id and status flag to the model', async () => {
            mockUsersModel.update_status.mockResolvedValue({ data: true });

            const response = await request(app)
                .put(path_for(ENDPOINTS.user_status.endpoint, { id: TEST_USER_ID, is_active: 0 }));

            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(300);
            expect(mockUsersModel.update_status).toHaveBeenCalledWith(TEST_USER_ID, 0);
        });

        test('rejects a non-numeric status flag with 400', async () => {
            const response = await request(app)
                .put(path_for(ENDPOINTS.user_status.endpoint, { id: TEST_USER_ID, is_active: 'maybe' }));

            expect(response.status).toBe(400);
            expect(mockUsersModel.update_status).not.toHaveBeenCalled();
        });
    });
});
