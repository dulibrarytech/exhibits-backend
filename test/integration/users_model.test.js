/**
 * Integration Tests for Users Model
 *
 * Runs the REAL users/model.js with the task classes mocked (same pattern as
 * exhibits_model / grid_model). Until this suite existed the users model was
 * only ever replaced by a mock (users_routes_integration), so its status
 * contracts — the layer the controller is supposed to honour — were untested.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { mock_model } = require('./helpers/mocks');

jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());

jest.mock('../../config/db_config', () => () => jest.fn());

jest.mock('../../config/db_tables_config', () => require('./helpers/mocks').db_tables_factory({
    user_records: 'tbl_users',
    users_roles: 'ctbl_user_roles'
}));

const mockUserTasks = mock_model([
    'get_users',
    'get_user',
    'update_user',
    'save_user',
    'check_username',
    'delete_user',
    'update_status'
]);

const mockRoleTasks = mock_model(['get_user_role', 'save_user_role', 'update_user_role']);

jest.mock('../../users/tasks/user_tasks', () => jest.fn().mockImplementation(() => mockUserTasks));
jest.mock('../../auth/tasks/roles_tasks', () => jest.fn().mockImplementation(() => mockRoleTasks));

const USERS_MODEL = require('../../users/model');

const USER_ROW = { id: 7, du_id: '871234567', email: 'a@du.edu', first_name: 'A', last_name: 'B', is_active: 1 };
const VALID_NEW_USER = { du_id: '871234567', first_name: 'A', last_name: 'B', email: 'a@du.edu', role_id: 4 };

describe('Users Model', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockRoleTasks.get_user_role.mockResolvedValue([{ user_id: 7, role_id: 4, role: 'Student' }]);
        mockRoleTasks.save_user_role.mockResolvedValue([1]);
        mockRoleTasks.update_user_role.mockResolvedValue(1);
        mockUserTasks.check_username.mockResolvedValue(false);
    });

    // ==================== get_users ====================

    describe('get_users', () => {

        test('attaches each user\'s role name', async () => {
            mockUserTasks.get_users.mockResolvedValue([USER_ROW, { ...USER_ROW, id: 8 }]);
            mockRoleTasks.get_user_role
                .mockResolvedValueOnce([{ role: 'Administrator' }])
                .mockResolvedValueOnce([]);

            const result = await USERS_MODEL.get_users();

            expect(result.status).toBe(200);
            expect(result.data).toHaveLength(2);
            expect(result.data[0].role).toBe('Administrator');
            expect(result.data[1].role).toBe('N/A');
            expect(mockRoleTasks.get_user_role).toHaveBeenCalledWith(7);
            expect(mockRoleTasks.get_user_role).toHaveBeenCalledWith(8);
        });

        test('skips malformed rows and survives a role lookup failure', async () => {
            mockUserTasks.get_users.mockResolvedValue([null, { no_id: true }, USER_ROW]);
            mockRoleTasks.get_user_role.mockRejectedValue(new Error('db down'));

            const result = await USERS_MODEL.get_users();

            expect(result.status).toBe(200);
            expect(result.data).toHaveLength(1);
            expect(result.data[0].role).toBe('N/A');
        });

        test('returns 200 with an empty list when there are no users', async () => {
            mockUserTasks.get_users.mockResolvedValue([]);

            expect(await USERS_MODEL.get_users()).toEqual({ status: 200, message: 'User data retrieved.', data: [] });
        });

        test('returns 500 with an empty list when the task does not return an array', async () => {
            mockUserTasks.get_users.mockResolvedValue(undefined);

            const result = await USERS_MODEL.get_users();

            expect(result.status).toBe(500);
            expect(result.data).toEqual([]);
        });
    });

    // ==================== get_user ====================

    describe('get_user', () => {

        test.each([null, undefined, '', '  ', 'abc', 0, -1, 1.5])('rejects id %p with 400', async (id) => {
            const result = await USERS_MODEL.get_user(id);

            expect(result.status).toBe(400);
            expect(mockUserTasks.get_user).not.toHaveBeenCalled();
        });

        test('returns 404 when the task finds nothing', async () => {
            mockUserTasks.get_user.mockResolvedValue(undefined);

            const result = await USERS_MODEL.get_user('7');

            expect(result.status).toBe(404);
            expect(result.data).toBeNull();
            expect(mockUserTasks.get_user).toHaveBeenCalledWith(7);
        });

        test('returns 200 with the record', async () => {
            mockUserTasks.get_user.mockResolvedValue(USER_ROW);

            const result = await USERS_MODEL.get_user(7);

            expect(result.status).toBe(200);
            expect(result.data).toBe(USER_ROW);
        });

        test('returns 500 when the task throws', async () => {
            mockUserTasks.get_user.mockRejectedValue(new Error('db down'));

            expect((await USERS_MODEL.get_user(7)).status).toBe(500);
        });
    });

    // ==================== get_user_role_id ====================

    describe('get_user_role_id', () => {

        test('returns the numeric role id', async () => {
            mockRoleTasks.get_user_role.mockResolvedValue([{ user_id: 7, role_id: '2', role: 'Power User' }]);

            expect(await USERS_MODEL.get_user_role_id(7)).toBe(2);
        });

        test('returns null when the user has no role row', async () => {
            mockRoleTasks.get_user_role.mockResolvedValue([]);

            expect(await USERS_MODEL.get_user_role_id(7)).toBeNull();
        });

        test('returns null for an invalid id without querying', async () => {
            expect(await USERS_MODEL.get_user_role_id('x')).toBeNull();
            expect(mockRoleTasks.get_user_role).not.toHaveBeenCalled();
        });

        test('returns null when the lookup throws', async () => {
            mockRoleTasks.get_user_role.mockRejectedValue(new Error('db down'));

            expect(await USERS_MODEL.get_user_role_id(7)).toBeNull();
        });
    });

    // ==================== update_user ====================

    describe('update_user', () => {

        test('rejects a bad id or empty body with 400', async () => {
            expect((await USERS_MODEL.update_user('x', { first_name: 'A' })).status).toBe(400);
            expect((await USERS_MODEL.update_user(7, {})).status).toBe(400);
            expect((await USERS_MODEL.update_user(7, [])).status).toBe(400);
            expect(mockUserTasks.update_user).not.toHaveBeenCalled();
        });

        test('rejects a malformed role_id with 400 before touching the DB', async () => {
            const result = await USERS_MODEL.update_user(7, { first_name: 'A', role_id: 'admin' });

            expect(result.status).toBe(400);
            expect(mockUserTasks.update_user).not.toHaveBeenCalled();
        });

        test('whitelists the profile fields — identity, status, and token never reach the task', async () => {
            mockUserTasks.update_user.mockResolvedValue(1);

            await USERS_MODEL.update_user(7, {
                first_name: 'A', last_name: 'B', email: 'a@du.edu',
                du_id: 'hijack', is_active: 0, token: 'x', id: 99
            });

            expect(mockUserTasks.update_user).toHaveBeenCalledWith(7, {
                first_name: 'A', last_name: 'B', email: 'a@du.edu'
            });
        });

        test('applies role_id through the role task only when present', async () => {
            mockUserTasks.update_user.mockResolvedValue(1);

            await USERS_MODEL.update_user(7, { first_name: 'A', last_name: 'B', email: 'a@du.edu' });
            expect(mockRoleTasks.update_user_role).not.toHaveBeenCalled();

            const result = await USERS_MODEL.update_user(7, { first_name: 'A', last_name: 'B', email: 'a@du.edu', role_id: '3' });
            expect(result.status).toBe(201);
            expect(mockRoleTasks.update_user_role).toHaveBeenCalledWith(7, 3);
        });

        test('returns 500 when the profile update fails, without touching the role', async () => {
            mockUserTasks.update_user.mockResolvedValue(false);

            const result = await USERS_MODEL.update_user(7, { first_name: 'A', last_name: 'B', email: 'a@du.edu', role_id: 3 });

            expect(result.status).toBe(500);
            expect(mockRoleTasks.update_user_role).not.toHaveBeenCalled();
        });

        test('returns 500 when the task throws', async () => {
            mockUserTasks.update_user.mockRejectedValue(new Error('Empty .update() call'));

            expect((await USERS_MODEL.update_user(7, { first_name: 'A', last_name: 'B', email: 'a@du.edu' })).status).toBe(500);
        });
    });

    // ==================== save_user ====================

    describe('save_user', () => {

        test.each(['du_id', 'first_name', 'last_name', 'email', 'role_id'])('rejects a missing %s with 400', async (field) => {
            const body = { ...VALID_NEW_USER };
            delete body[field];

            const result = await USERS_MODEL.save_user(body);

            expect(result.status).toBe(400);
            expect(result.message).toContain(field);
            expect(mockUserTasks.save_user).not.toHaveBeenCalled();
        });

        test('rejects a malformed role_id or email with 400', async () => {
            expect((await USERS_MODEL.save_user({ ...VALID_NEW_USER, role_id: 'admin' })).status).toBe(400);
            expect((await USERS_MODEL.save_user({ ...VALID_NEW_USER, email: 'nope' })).status).toBe(400);
            expect(mockUserTasks.save_user).not.toHaveBeenCalled();
        });

        test('returns 409 with data:false for a duplicate du_id', async () => {
            mockUserTasks.check_username.mockResolvedValue(true);

            const result = await USERS_MODEL.save_user(VALID_NEW_USER);

            expect(result.status).toBe(409);
            expect(result.data).toBe(false);
            expect(mockUserTasks.save_user).not.toHaveBeenCalled();
        });

        test('inserts only the whitelisted fields and assigns the role', async () => {
            mockUserTasks.save_user.mockResolvedValue([42]);

            const result = await USERS_MODEL.save_user({ ...VALID_NEW_USER, is_active: 1, token: 'x', id: 1 });

            expect(mockUserTasks.save_user).toHaveBeenCalledWith({
                du_id: '871234567', first_name: 'A', last_name: 'B', email: 'a@du.edu'
            });
            expect(mockRoleTasks.save_user_role).toHaveBeenCalledWith(42, 4);
            expect(result.status).toBe(201);
            expect(result.data).toMatchObject({ id: 42, du_id: '871234567', role_id: 4 });
        });

        test('accepts a scalar insert id as well as knex\'s [id] array', async () => {
            mockUserTasks.save_user.mockResolvedValue(43);

            const result = await USERS_MODEL.save_user(VALID_NEW_USER);

            expect(result.status).toBe(201);
            expect(result.data.id).toBe(43);
        });

        test('returns 500 when the insert yields no usable id', async () => {
            mockUserTasks.save_user.mockResolvedValue([]);
            expect((await USERS_MODEL.save_user(VALID_NEW_USER)).status).toBe(500);

            mockUserTasks.save_user.mockResolvedValue('Duplicate entry for email_index');
            expect((await USERS_MODEL.save_user(VALID_NEW_USER)).status).toBe(500);
            expect(mockRoleTasks.save_user_role).not.toHaveBeenCalled();
        });

        test('a failed role assignment is logged but does not fail the create (documented gap, review M2)', async () => {
            mockUserTasks.save_user.mockResolvedValue([44]);
            mockRoleTasks.save_user_role.mockRejectedValue(new Error('fk violation'));

            const result = await USERS_MODEL.save_user(VALID_NEW_USER);

            expect(result.status).toBe(201);
        });
    });

    // ==================== delete_user ====================

    describe('delete_user', () => {

        test('rejects an invalid id with 400', async () => {
            expect((await USERS_MODEL.delete_user('')).status).toBe(400);
            expect((await USERS_MODEL.delete_user(-5)).status).toBe(400);
            expect(mockUserTasks.delete_user).not.toHaveBeenCalled();
        });

        test('returns 204 when exactly one row was deleted', async () => {
            mockUserTasks.delete_user.mockResolvedValue(1);

            const result = await USERS_MODEL.delete_user('7');

            expect(result).toEqual({ status: 204, message: 'User deleted.', data: true });
            expect(mockUserTasks.delete_user).toHaveBeenCalledWith(7);
        });

        test('returns 404 when no row matched', async () => {
            mockUserTasks.delete_user.mockResolvedValue(0);

            const result = await USERS_MODEL.delete_user(7);

            expect(result.status).toBe(404);
            expect(result.data).toBe(false);
        });

        test('returns 500 when the task result is not a row count', async () => {
            mockUserTasks.delete_user.mockResolvedValue(undefined);

            expect((await USERS_MODEL.delete_user(7)).status).toBe(500);
        });
    });

    // ==================== update_status ====================

    describe('update_status', () => {

        test.each([
            [true, 1], [false, 0], [1, 1], [0, 0], ['1', 1], ['0', 0], ['true', 1], ['false', 0], [' True ', 1]
        ])('coerces is_active %p to %p', async (input, expected) => {
            mockUserTasks.update_status.mockResolvedValue(1);

            const result = await USERS_MODEL.update_status(7, input);

            expect(result.status).toBe(200);
            expect(mockUserTasks.update_status).toHaveBeenCalledWith(7, expected);
        });

        test.each([2, '2', 'yes', null, undefined, {}])('rejects is_active %p with 400', async (input) => {
            const result = await USERS_MODEL.update_status(7, input);

            expect(result.status).toBe(400);
            expect(mockUserTasks.update_status).not.toHaveBeenCalled();
        });

        test('returns 500 when the task reports failure', async () => {
            mockUserTasks.update_status.mockResolvedValue(false);

            const result = await USERS_MODEL.update_status(7, 1);

            expect(result.status).toBe(500);
            expect(result.data).toBe(false);
        });
    });

    // ==================== singleton helpers ====================

    describe('singleton instances', () => {

        test('_get_instances_status reflects lazily created task instances', () => {
            USERS_MODEL._reset_all_instances();
            expect(USERS_MODEL._get_instances_status()).toEqual({ user_tasks: false, role_tasks: false });
        });
    });
});
