/**
 * Integration Tests for Auth Model
 *
 * Runs the REAL auth/model.js with the task classes and endpoint registries
 * mocked. Covers the status contracts the auth controller consumes
 * (check_auth_user, get_auth_user_data, get_roles, get_user_role) — the
 * layer that was previously only ever mocked in auth_routes_integration.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { mock_model } = require('./helpers/mocks');

jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());

jest.mock('../../config/db_config', () => () => jest.fn());

jest.mock('../../config/db_tables_config', () => require('./helpers/mocks').db_tables_factory({ user_records: 'tbl_users', roles_records: 'tbl_user_roles' }));

/* Endpoint registries read APP_PATH/config at require time — stub them. */
jest.mock('../../exhibits/endpoints/index', () => () => ({ exhibits: 'EXHIBITS_ENDPOINTS' }));
jest.mock('../../users/endpoints', () => () => ({ users: 'USERS_ENDPOINTS' }));
jest.mock('../../indexer/endpoints', () => () => ({ indexer: 'INDEXER_ENDPOINTS' }));
jest.mock('../../media-library/endpoints', () => () => ({ media_library: 'MEDIA_ENDPOINTS' }));

const mockAuthTasks = mock_model(['check_auth_user', 'get_auth_user_data']);

const mockRolesTasks = mock_model(['get_roles', 'get_user_role']);

jest.mock('../../auth/tasks/auth_tasks', () => jest.fn().mockImplementation(() => mockAuthTasks));
jest.mock('../../auth/tasks/roles_tasks', () => jest.fn().mockImplementation(() => mockRolesTasks));

const AUTH_MODEL = require('../../auth/model');

describe('Auth Model', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================== check_auth_user ====================

    describe('check_auth_user', () => {

        test.each([null, undefined, '', '   ', 42])('rejects username %p without querying', async (username) => {
            const result = await AUTH_MODEL.check_auth_user(username);

            expect(result).toEqual({ auth: false, data: null });
            expect(mockAuthTasks.check_auth_user).not.toHaveBeenCalled();
        });

        test('rejects a username longer than 255 characters', async () => {
            const result = await AUTH_MODEL.check_auth_user('a'.repeat(256));

            expect(result.auth).toBe(false);
            expect(mockAuthTasks.check_auth_user).not.toHaveBeenCalled();
        });

        test('trims the username and passes through the task verdict', async () => {
            mockAuthTasks.check_auth_user.mockResolvedValue({ auth: true, data: 7 });

            const result = await AUTH_MODEL.check_auth_user('  871234567  ');

            expect(mockAuthTasks.check_auth_user).toHaveBeenCalledWith('871234567');
            expect(result).toEqual({ auth: true, data: 7 });
        });

        test('treats a malformed task result as not authenticated', async () => {
            mockAuthTasks.check_auth_user.mockResolvedValue({ ok: true });

            expect(await AUTH_MODEL.check_auth_user('871234567')).toEqual({ auth: false, data: null });
        });

        test('treats a task failure as not authenticated', async () => {
            mockAuthTasks.check_auth_user.mockRejectedValue(new Error('db down'));

            expect(await AUTH_MODEL.check_auth_user('871234567')).toEqual({ auth: false, data: null });
        });
    });

    // ==================== get_auth_user_data ====================

    describe('get_auth_user_data', () => {

        test.each([null, undefined, '', 'abc', 0, -1, 1.5])('rejects id %p with 400', async (id) => {
            const result = await AUTH_MODEL.get_auth_user_data(id);

            expect(result.status).toBe(400);
            expect(result.data).toEqual([]);
            expect(mockAuthTasks.get_auth_user_data).not.toHaveBeenCalled();
        });

        test('returns 404 when the task finds no active user', async () => {
            mockAuthTasks.get_auth_user_data.mockResolvedValue(null);

            const result = await AUTH_MODEL.get_auth_user_data('7');

            expect(result.status).toBe(404);
            expect(result.data).toEqual([]);
            expect(mockAuthTasks.get_auth_user_data).toHaveBeenCalledWith(7);
        });

        test('returns 500 when the task signals an error with false', async () => {
            mockAuthTasks.get_auth_user_data.mockResolvedValue(false);

            expect((await AUTH_MODEL.get_auth_user_data(7)).status).toBe(500);
        });

        test('returns 200 with the profile plus every endpoint registry', async () => {
            const profile = { id: 7, du_id: '871234567', email: 'a@du.edu', first_name: 'A', last_name: 'B' };
            mockAuthTasks.get_auth_user_data.mockResolvedValue(profile);

            const result = await AUTH_MODEL.get_auth_user_data(7);

            expect(result.status).toBe(200);
            expect(result.data.user_data).toBe(profile);
            expect(result.data.endpoints).toEqual({
                exhibits: { exhibits: 'EXHIBITS_ENDPOINTS' },
                users: { users: 'USERS_ENDPOINTS' },
                indexer: { indexer: 'INDEXER_ENDPOINTS' },
                media_library: { media_library: 'MEDIA_ENDPOINTS' }
            });
        });

        test('returns 500 when the task throws', async () => {
            mockAuthTasks.get_auth_user_data.mockRejectedValue(new Error('db down'));

            expect((await AUTH_MODEL.get_auth_user_data(7)).status).toBe(500);
        });
    });

    // ==================== get_roles ====================

    describe('get_roles', () => {

        test('returns 200 with the role list', async () => {
            const roles = [{ id: 1, role: 'Administrator' }, { id: 4, role: 'Student' }];
            mockRolesTasks.get_roles.mockResolvedValue(roles);

            const result = await AUTH_MODEL.get_roles();

            expect(result.status).toBe(200);
            expect(result.data).toBe(roles);
        });

        test('returns 500 with an empty list when the task returns nothing (its catch swallows errors)', async () => {
            mockRolesTasks.get_roles.mockResolvedValue(undefined);

            const result = await AUTH_MODEL.get_roles();

            expect(result.status).toBe(500);
            expect(result.data).toEqual([]);
        });
    });

    // ==================== get_user_role ====================

    describe('get_user_role', () => {

        test.each([null, '', 'x', 0])('rejects user_id %p with 400', async (id) => {
            const result = await AUTH_MODEL.get_user_role(id);

            expect(result.status).toBe(400);
            expect(mockRolesTasks.get_user_role).not.toHaveBeenCalled();
        });

        test('returns 404 when the user has no role row', async () => {
            mockRolesTasks.get_user_role.mockResolvedValue(undefined);

            const result = await AUTH_MODEL.get_user_role(7);

            expect(result.status).toBe(404);
            expect(result.data).toBeNull();
        });

        test('returns 200 with the role rows', async () => {
            const rows = [{ user_id: 7, role_id: 4, role: 'Student' }];
            mockRolesTasks.get_user_role.mockResolvedValue(rows);

            const result = await AUTH_MODEL.get_user_role('7');

            expect(result.status).toBe(200);
            expect(result.data).toBe(rows);
            expect(mockRolesTasks.get_user_role).toHaveBeenCalledWith(7);
        });
    });

    // ==================== singleton helpers ====================

    describe('singleton instances', () => {

        test('instances are created lazily and can be reset', async () => {
            AUTH_MODEL._reset_all_instances();
            expect(AUTH_MODEL._get_instances_status()).toEqual({ auth_tasks: false, roles_tasks: false });

            mockAuthTasks.check_auth_user.mockResolvedValue({ auth: false, data: null });
            await AUTH_MODEL.check_auth_user('871234567');

            expect(AUTH_MODEL._get_instances_status()).toEqual({ auth_tasks: true, roles_tasks: false });
        });
    });
});
