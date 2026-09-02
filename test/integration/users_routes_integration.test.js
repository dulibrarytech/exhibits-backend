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
    check_permission: jest.fn().mockResolvedValue(true),
    get_actor_id: jest.fn(),
    can_assign_role: jest.fn()
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
    get_user_role_id: jest.fn(),
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
        /* Default: the actor IS the target (self-edit) and holds role 4 (Student). */
        AUTHORIZE.get_actor_id.mockResolvedValue(TEST_USER_ID);
        AUTHORIZE.can_assign_role.mockResolvedValue(true);
        mockUsersModel.get_user_role_id.mockResolvedValue(4);
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

        /*
         * Role-escalation on create (code review 2026-09-02, H11): add_users
         * alone must not let the creator hand out a role above their own.
         */
        test('returns 403 when the requested role may not be assigned by the actor', async () => {
            AUTHORIZE.can_assign_role.mockResolvedValue(false);

            const response = await request(app)
                .post(ENDPOINTS.endpoint)
                .send({ ...VALID_USER, role_id: 1 });

            expect(response.status).toBe(403);
            expect(AUTHORIZE.can_assign_role).toHaveBeenCalledWith(expect.anything(), 1);
            expect(mockUsersModel.save_user).not.toHaveBeenCalled();
        });

        test('creates the user when the role assignment is allowed', async () => {
            mockUsersModel.save_user.mockResolvedValue({ data: TEST_USER_ID });

            const response = await request(app)
                .post(ENDPOINTS.endpoint)
                .send({ ...VALID_USER, role_id: 4 });

            expect(response.status).toBe(201);
            expect(AUTHORIZE.can_assign_role).toHaveBeenCalledWith(expect.anything(), 4);
            expect(mockUsersModel.save_user).toHaveBeenCalledWith(expect.objectContaining({ role_id: 4 }));
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

    /*
     * Self-promotion regression (code review 2026-09-02, C1): update_user is
     * granted to every role, so it must only admit edits to the caller's OWN
     * record, and a role CHANGE must additionally require update_user_role.
     * check_permission is driven by which single permission is asked for.
     */
    describe('PUT user — self-scoping and role-change gating', () => {

        const OTHER_USER_ID = 99;
        const put_user = (user_id, body) => request(app)
            .put(path_for(ENDPOINTS.update_user.put.endpoint, { user_id }))
            .send(body);
        const grant = (...permissions) => {
            AUTHORIZE.check_permission.mockImplementation(({ permissions: asked }) =>
                Promise.resolve(asked.length === 1 && permissions.includes(asked[0])));
        };

        beforeEach(() => {
            mockUsersModel.update_user.mockResolvedValue({ data: { id: TEST_USER_ID } });
        });

        test('update_user alone cannot edit ANOTHER user', async () => {
            grant('update_user');
            AUTHORIZE.get_actor_id.mockResolvedValue(OTHER_USER_ID);

            const response = await put_user(TEST_USER_ID, VALID_USER);

            expect(response.status).toBe(403);
            expect(mockUsersModel.update_user).not.toHaveBeenCalled();
        });

        test('update_user alone can edit the caller\'s OWN profile', async () => {
            grant('update_user');

            const response = await put_user(TEST_USER_ID, VALID_USER);

            expect(response.status).toBe(201);
            expect(mockUsersModel.update_user).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining(VALID_USER));
        });

        test('update_users can edit another user', async () => {
            grant('update_users');
            AUTHORIZE.get_actor_id.mockResolvedValue(OTHER_USER_ID);

            const response = await put_user(TEST_USER_ID, VALID_USER);

            expect(response.status).toBe(201);
            expect(mockUsersModel.update_user).toHaveBeenCalledTimes(1);
        });

        test('re-posting the UNCHANGED role_id is not a role change', async () => {
            grant('update_user');

            const response = await put_user(TEST_USER_ID, { ...VALID_USER, role_id: 4 });

            expect(response.status).toBe(201);
            expect(mockUsersModel.update_user).toHaveBeenCalledTimes(1);
        });

        test('self-promotion: role change without update_user_role is denied', async () => {
            grant('update_user');

            const response = await put_user(TEST_USER_ID, { ...VALID_USER, role_id: 1 });

            expect(response.status).toBe(403);
            expect(mockUsersModel.update_user).not.toHaveBeenCalled();
        });

        test('update_users without update_user_role cannot change a role either', async () => {
            grant('update_users');
            AUTHORIZE.get_actor_id.mockResolvedValue(OTHER_USER_ID);

            const response = await put_user(TEST_USER_ID, { ...VALID_USER, role_id: 1 });

            expect(response.status).toBe(403);
            expect(mockUsersModel.update_user).not.toHaveBeenCalled();
        });

        test('assigning a first role to a role-less user counts as a role change', async () => {
            grant('update_users');
            mockUsersModel.get_user_role_id.mockResolvedValue(null);

            const response = await put_user(TEST_USER_ID, { ...VALID_USER, role_id: 4 });

            expect(response.status).toBe(403);
            expect(mockUsersModel.update_user).not.toHaveBeenCalled();
        });

        test('update_users + update_user_role can change a role', async () => {
            grant('update_users', 'update_user_role');
            AUTHORIZE.get_actor_id.mockResolvedValue(OTHER_USER_ID);

            const response = await put_user(TEST_USER_ID, { ...VALID_USER, role_id: 1 });

            expect(response.status).toBe(201);
            expect(mockUsersModel.update_user).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ role_id: 1 }));
        });

        test('unresolvable actor is denied', async () => {
            grant('update_users', 'update_user', 'update_user_role');
            AUTHORIZE.get_actor_id.mockResolvedValue(null);

            const response = await put_user(TEST_USER_ID, VALID_USER);

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
    /*
     * C2 (code review 2026-09-02): get_user had no permission gate at all.
     */
    describe('GET user — view_users gate', () => {

        test('returns 403 when view_users is denied and never touches the model', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .get(path_for(ENDPOINTS.get_user.endpoint, { user_id: TEST_USER_ID }));

            expect(response.status).toBe(403);
            expect(AUTHORIZE.check_permission).toHaveBeenCalledWith(
                expect.objectContaining({ permissions: ['view_users'] })
            );
            expect(mockUsersModel.get_user).not.toHaveBeenCalled();
        });
    });
});
