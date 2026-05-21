/**
 * Integration Test: auth/authorize.check_permission (Jest, mocked task layer)
 *
 * Runs under Jest (not Vitest) because it must intercept the transitive
 * CommonJS require() chain inside auth/authorize.js
 * (db_config / db_tables_config / auth/tasks/auth_tasks). See
 * test/integration/README.md for why the mock-heavy suites live here.
 *
 * Exercises the central authorization decision used by every gated route
 * (exhibits, items, grids, timelines, media library):
 *
 *   - missing/invalid request or actions          -> deny
 *   - user holds ALL required permissions          -> allow (no ownership check)
 *   - user holds SOME required permissions          -> ownership fallback
 *   - user holds NONE of the required permissions   -> deny
 *   - users_admin flag short-circuits ownership     -> allow
 *
 * Per-role permission sets mirror the ENFORCED exhibitsv2 matrix (audited
 * source of truth).
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn()
    })
}));

jest.mock('../../config/db_config', () => () => ({}));

jest.mock('../../config/db_tables_config', () => () => ({
    exhibits: {
        user_records: 'tbl_users',
        exhibit_records: 'tbl_exhibits',
        item_records: 'tbl_standard_items',
        heading_records: 'tbl_heading_items',
        grid_records: 'tbl_grids',
        grid_item_records: 'tbl_grid_items',
        timeline_records: 'tbl_timelines',
        timeline_item_records: 'tbl_timeline_items',
        media_library_records: 'tbl_media_library'
    }
}));

// Mocked Auth_tasks: every instance is the same controllable object,
// reachable from the test via the constructor's static __instance.
jest.mock('../../auth/tasks/auth_tasks', () => {
    const instance = {
        get_user_id_by_username: jest.fn(),
        get_user_permissions_by_username: jest.fn(),
        get_permissions: jest.fn(),
        check_ownership: jest.fn()
    };
    const MockAuth = jest.fn(() => instance);
    MockAuth.__instance = instance;
    return MockAuth;
});

const AUTHORIZE = require('../../auth/authorize');
const auth = require('../../auth/tasks/auth_tasks').__instance;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATALOG = [
    { id: 10, permission: 'delete_exhibit' },
    { id: 11, permission: 'delete_any_exhibit' },
    { id: 12, permission: 'add_exhibit' },
    { id: 30, permission: 'can_create_media' },
    { id: 31, permission: 'can_update_media' },
    { id: 33, permission: 'can_update_any_media' }
];
const PID = Object.fromEntries(CATALOG.map(p => [p.permission, p.id]));

const ROLE_PERMISSION_IDS = {
    Administrator: [PID.delete_exhibit, PID.delete_any_exhibit, PID.add_exhibit,
        PID.can_create_media, PID.can_update_media, PID.can_update_any_media],
    PowerUser: [PID.delete_exhibit, PID.add_exhibit, PID.can_create_media,
        PID.can_update_media, PID.can_update_any_media],
    GeneralUser: [PID.delete_exhibit, PID.add_exhibit, PID.can_create_media,
        PID.can_update_media],
    Student: [PID.add_exhibit, PID.can_create_media, PID.can_update_media]
};

const USER_ID = 42;

function asUser(role) {
    auth.get_user_id_by_username.mockResolvedValue(USER_ID);
    auth.get_permissions.mockResolvedValue(CATALOG);
    auth.get_user_permissions_by_username.mockResolvedValue(
        ROLE_PERMISSION_IDS[role].map(permission_id => ({ permission_id }))
    );
}

const req = (sub = '871095226') => ({ decoded: { sub } });

beforeEach(() => {
    jest.clearAllMocks();
    auth.check_ownership.mockResolvedValue(0);
});

describe('check_permission — guard clauses', () => {

    test('denies when req is missing', async () => {
        expect(await AUTHORIZE.check_permission({ permissions: ['add_exhibit'] })).toBe(false);
    });

    test('denies when permissions array is empty', async () => {
        expect(await AUTHORIZE.check_permission({ req: req(), permissions: [] })).toBe(false);
    });

    test('denies when permissions is not an array', async () => {
        expect(await AUTHORIZE.check_permission({ req: req(), permissions: 'add_exhibit' })).toBe(false);
    });

    test('denies when JWT subject is missing', async () => {
        asUser('Administrator');
        expect(await AUTHORIZE.check_permission({
            req: { decoded: {} }, permissions: ['add_exhibit'], record_type: 'exhibit'
        })).toBe(false);
    });

    test('denies when the user id cannot be resolved', async () => {
        asUser('Administrator');
        auth.get_user_id_by_username.mockResolvedValue(null);
        expect(await AUTHORIZE.check_permission({
            req: req(), permissions: ['add_exhibit'], record_type: 'exhibit'
        })).toBe(false);
    });
});

describe('check_permission — full grants bypass ownership', () => {

    test('Administrator with both delete perms may delete ANY exhibit', async () => {
        asUser('Administrator');
        const ok = await AUTHORIZE.check_permission({
            req: req(),
            permissions: ['delete_exhibit', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: '550e8400-e29b-41d4-a716-446655440000',
            child_id: null
        });
        expect(ok).toBe(true);
        expect(auth.check_ownership).not.toHaveBeenCalled();
    });

    test('single-permission action grants when the user holds it', async () => {
        asUser('Student');
        const ok = await AUTHORIZE.check_permission({
            req: req(), permissions: ['add_exhibit'], record_type: 'exhibit'
        });
        expect(ok).toBe(true);
        expect(auth.check_ownership).not.toHaveBeenCalled();
    });
});

describe('check_permission — partial grants fall back to ownership', () => {

    test('General User (only delete_exhibit) may delete an exhibit they OWN', async () => {
        asUser('GeneralUser');
        auth.check_ownership.mockResolvedValue(USER_ID);
        const ok = await AUTHORIZE.check_permission({
            req: req(),
            permissions: ['delete_exhibit', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: '550e8400-e29b-41d4-a716-446655440000',
            child_id: null
        });
        expect(ok).toBe(true);
        expect(auth.check_ownership).toHaveBeenCalledTimes(1);
    });

    test('General User may NOT delete an exhibit owned by someone else', async () => {
        asUser('GeneralUser');
        auth.check_ownership.mockResolvedValue(999);
        const ok = await AUTHORIZE.check_permission({
            req: req(),
            permissions: ['delete_exhibit', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: '550e8400-e29b-41d4-a716-446655440000',
            child_id: null
        });
        expect(ok).toBe(false);
    });

    test('users_admin flag short-circuits the ownership check', async () => {
        asUser('GeneralUser');
        auth.check_ownership.mockResolvedValue(999);
        const ok = await AUTHORIZE.check_permission({
            req: req(),
            permissions: ['delete_exhibit', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: '550e8400-e29b-41d4-a716-446655440000',
            child_id: null,
            users: true
        });
        expect(ok).toBe(true);
        expect(auth.check_ownership).not.toHaveBeenCalled();
    });
});

describe('check_permission — no matching permission denies outright', () => {

    test('Student (no delete perms) is denied', async () => {
        asUser('Student');
        const ok = await AUTHORIZE.check_permission({
            req: req(),
            permissions: ['delete_exhibit', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: '550e8400-e29b-41d4-a716-446655440000',
            child_id: null
        });
        expect(ok).toBe(false);
        expect(auth.check_ownership).not.toHaveBeenCalled();
    });
});
