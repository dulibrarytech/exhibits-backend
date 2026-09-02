/**
 * Route-mounting Integration Tests for Auth Routes
 *
 * Mounts the REAL auth/routes.js (real controller, real registration)
 * with the model, token library, and SSO guard mocked. First
 * request-level coverage of the auth subsystem: landing page, SSO
 * initiation and callback (including guard-before-controller ordering),
 * permission checks, and role lookups.
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

const APP_PATH = process.env.APP_PATH;
const TEST_USER_ID = 42;
const TEST_USER_UID = '660e8400-e29b-41d4-a716-446655440001';
const SSO_HOST = 'sso.test.du.edu';

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
    create: jest.fn().mockReturnValue('test-token'),
    set_auth_cookie: jest.fn()
}));

jest.mock('../../auth/authorize', () => ({
    check_permission: jest.fn().mockResolvedValue(true)
}));

/*
 * The SSO guard is unit-tested on its own (test/tasks/sso_guard.test.js);
 * here it is a pass-through spy so the tests can assert it runs BEFORE
 * the controller on the /auth/sso route.
 */
jest.mock('../../auth/sso_guard', () =>
    jest.fn((req, res, next) => next())
);

jest.mock('../../config/rate_limits_loader', () => ({
    rate_limits: {
        read_operations: (req, res, next) => next(),
        write_operations: (req, res, next) => next(),
        auth_operations: (req, res, next) => next(),
        auth_identity_operations: (req, res, next) => next()
    }
}));

jest.mock('../../config/webservices_config', () => () => ({
    sso_host: 'sso.test.du.edu',
    sso_url: 'https://sso.test.du.edu/login',
    sso_response_url: 'https://app.test.du.edu/exhibits-dashboard/auth/sso',
    sso_logout_url: 'https://sso.test.du.edu/logout'
}));

const mockAuthModel = {
    check_auth_user: jest.fn(),
    get_auth_user_data: jest.fn(),
    get_roles: jest.fn(),
    get_user_role: jest.fn()
};

jest.mock('../../auth/model', () => mockAuthModel);

const AUTH_ENDPOINTS = require('../../auth/endpoints')().auth;

describe('Auth Routes Integration (real router)', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;
    let SSO_GUARD;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        /*
         * The landing route renders a view — capture the render call
         * instead of running EJS.
         */
        app.use((req, res, next) => {
            res.render = jest.fn((view, data) => {
                res.status(200).json({ view, data });
            });
            next();
        });

        const routes = require('../../auth/routes');
        routes(app);

        AUTHORIZE = require('../../auth/authorize');
        TOKEN = require('../../libs/tokens');
        SSO_GUARD = require('../../auth/sso_guard');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        AUTHORIZE.check_permission.mockResolvedValue(true);
        TOKEN.verify.mockImplementation((req, res, next) => {
            req.decoded = { sub: TEST_USER_UID };
            next();
        });
        TOKEN.create.mockReturnValue('test-token');
        SSO_GUARD.mockImplementation((req, res, next) => next());
    });

    // ==================== LANDING + LOGIN ====================

    describe('GET /auth (landing)', () => {

        test('renders the auth landing view without requiring a token', async () => {
            const response = await request(app).get(`${APP_PATH}/auth`);

            expect(response.status).toBe(200);
            expect(response.body.view).toBe('dist/auth-landing');
        });
    });

    describe('GET /auth/login (SSO initiation)', () => {

        test('redirects to the SSO URL with the encoded callback', async () => {
            const response = await request(app).get(`${APP_PATH}/auth/login`);

            expect(response.status).toBe(302);
            expect(response.headers.location).toMatch(/^https:\/\/sso\.test\.du\.edu\/login\?app_url=/);
        });
    });

    // ==================== SSO CALLBACK ====================

    describe('POST /auth/sso', () => {

        const VALID_SSO_BODY = { HTTP_HOST: SSO_HOST, employeeID: '871234567' };

        test('runs the SSO guard before the controller', async () => {
            SSO_GUARD.mockImplementation((req, res) => {
                res.status(403).json({ message: 'Forbidden' });
            });

            const response = await request(app)
                .post(`${APP_PATH}/auth/sso`)
                .send(VALID_SSO_BODY);

            expect(response.status).toBe(403);
            expect(SSO_GUARD).toHaveBeenCalled();
            expect(mockAuthModel.check_auth_user).not.toHaveBeenCalled();
        });

        test('rejects a payload missing required parameters with 400', async () => {
            const response = await request(app)
                .post(`${APP_PATH}/auth/sso`)
                .send({ employeeID: '871234567' });

            expect(response.status).toBe(400);
            expect(mockAuthModel.check_auth_user).not.toHaveBeenCalled();
        });

        test('rejects a payload from an unexpected host with 403', async () => {
            const response = await request(app)
                .post(`${APP_PATH}/auth/sso`)
                .send({ HTTP_HOST: 'evil.example.com', employeeID: '871234567' });

            expect(response.status).toBe(403);
            expect(mockAuthModel.check_auth_user).not.toHaveBeenCalled();
        });

        test('returns 401 when the user is not an authorized app user', async () => {
            mockAuthModel.check_auth_user.mockResolvedValue(null);

            const response = await request(app)
                .post(`${APP_PATH}/auth/sso`)
                .send(VALID_SSO_BODY);

            expect(response.status).toBe(401);
            expect(TOKEN.set_auth_cookie).not.toHaveBeenCalled();
        });

        test('authenticates a known user, sets the cookie, and redirects — without persisting the JWT', async () => {
            mockAuthModel.check_auth_user.mockResolvedValue({ auth: true, data: TEST_USER_ID });

            const response = await request(app)
                .post(`${APP_PATH}/auth/sso`)
                .send(VALID_SSO_BODY);

            expect(response.status).toBe(302);
            expect(response.headers.location).toContain(`${APP_PATH}/exhibits?t=`);
            expect(response.headers.location).toContain(`id=${TEST_USER_ID}`);
            expect(TOKEN.set_auth_cookie).toHaveBeenCalledWith(expect.anything(), 'test-token');
            /* The JWT must never reach the model/DB (code review 2026-09-02, C2 follow-up). */
            expect(mockAuthModel.save_token).toBeUndefined();
        });
    });

    // ==================== PERMISSIONS + ROLES ====================

    describe('POST /auth/permissions', () => {

        const VALID_CHECK = {
            permissions: ['update_exhibit'],
            record_type: 'exhibit',
            parent_id: TEST_USER_UID
        };

        test('requires a verified token', async () => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });

            const response = await request(app)
                .post(`${APP_PATH}/auth/permissions`)
                .send(VALID_CHECK);

            expect(response.status).toBe(401);
            expect(AUTHORIZE.check_permission).not.toHaveBeenCalled();
        });

        test('returns 200 Authorized when the check passes', async () => {
            const response = await request(app)
                .post(`${APP_PATH}/auth/permissions`)
                .send(VALID_CHECK);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Authorized');
            expect(AUTHORIZE.check_permission).toHaveBeenCalledWith(
                expect.objectContaining({ permissions: ['update_exhibit'], record_type: 'exhibit' })
            );
        });

        test('returns 403 when the check fails', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .post(`${APP_PATH}/auth/permissions`)
                .send(VALID_CHECK);

            expect(response.status).toBe(403);
        });

        test('rejects a body without permissions with 400', async () => {
            const response = await request(app)
                .post(`${APP_PATH}/auth/permissions`)
                .send({ record_type: 'exhibit' });

            expect(response.status).toBe(400);
            expect(AUTHORIZE.check_permission).not.toHaveBeenCalled();
        });
    });

    describe('GET /auth/roles', () => {

        test('returns role records from the model', async () => {
            mockAuthModel.get_roles.mockResolvedValue({ data: [{ id: 1, role: 'Administrator' }] });

            const response = await request(app).get(`${APP_PATH}/auth/roles`);

            expect(response.status).toBe(200);
            expect(mockAuthModel.get_roles).toHaveBeenCalled();
        });

        test('requires a verified token', async () => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });

            const response = await request(app).get(`${APP_PATH}/auth/roles`);

            expect(response.status).toBe(401);
            expect(mockAuthModel.get_roles).not.toHaveBeenCalled();
        });
    });

    describe('GET /auth/role', () => {

        test('parses the numeric user id and returns the role', async () => {
            mockAuthModel.get_user_role.mockResolvedValue({ data: [{ role: 'Administrator' }] });

            const response = await request(app)
                .get(`${APP_PATH}/auth/role`)
                .query({ user_id: TEST_USER_ID });

            expect(response.status).toBe(200);
            expect(mockAuthModel.get_user_role).toHaveBeenCalledWith(TEST_USER_ID);
        });

        test('rejects a non-numeric user id with 400', async () => {
            const response = await request(app)
                .get(`${APP_PATH}/auth/role`)
                .query({ user_id: 'abc' });

            expect(response.status).toBe(400);
            expect(mockAuthModel.get_user_role).not.toHaveBeenCalled();
        });
    });

    describe('GET authentication endpoint (auth user data)', () => {

        test('returns user data for a numeric id', async () => {
            mockAuthModel.get_auth_user_data.mockResolvedValue({ data: { id: TEST_USER_ID, du_id: '871234567' } });

            const response = await request(app)
                .get(AUTH_ENDPOINTS.authentication.endpoint)
                .query({ id: TEST_USER_ID });

            expect(response.status).toBe(200);
            expect(mockAuthModel.get_auth_user_data).toHaveBeenCalledWith(TEST_USER_ID);
        });

        test('rejects a missing id with 400', async () => {
            const response = await request(app)
                .get(AUTH_ENDPOINTS.authentication.endpoint);

            expect(response.status).toBe(400);
            expect(mockAuthModel.get_auth_user_data).not.toHaveBeenCalled();
        });
    });
});
