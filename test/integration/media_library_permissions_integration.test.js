/**
 * Integration Test: Media Library permission enforcement per role
 *
 * Runs under Jest so it can intercept auth/authorize.js's transitive CJS
 * require() chain (see test/integration/README.md).
 *
 * The media-library routes are gated only by TOKEN.verify; the role/permission
 * decision happens inside media-library/controller.js via
 * AUTHORIZE.check_permission with these exact option tuples:
 *
 *   create : ['can_create_media']                        record_type 'media'
 *   update : ['can_update_any_media','can_update_media']  record_type 'media'
 *   delete : ['can_delete_any_media','can_delete_media']  record_type 'media'
 *
 * This suite drives check_permission with those exact tuples and the ENFORCED
 * per-role media permission sets from exhibitsv2, asserting:
 *
 *   CREATE : Admin / Power / General / Student  -> allowed
 *   UPDATE : Admin / Power                      -> any media
 *            General / Student                  -> own media only
 *   DELETE : Admin                              -> any media
 *            Power / General                    -> own media only
 *            Student                            -> DENIED (no media-delete perm)
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
        media_library_records: 'tbl_media_library'
    }
}));

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
// Fixtures — media permission catalog and ENFORCED per-role grants
// ---------------------------------------------------------------------------

const CATALOG = [
    { id: 30, permission: 'can_create_media' },
    { id: 31, permission: 'can_update_media' },
    { id: 32, permission: 'can_delete_media' },
    { id: 33, permission: 'can_update_any_media' },
    { id: 34, permission: 'can_delete_any_media' }
];
const PID = Object.fromEntries(CATALOG.map(p => [p.permission, p.id]));

const ROLE_MEDIA_PERMS = {
    Administrator: [PID.can_create_media, PID.can_update_media, PID.can_delete_media,
        PID.can_update_any_media, PID.can_delete_any_media],
    PowerUser: [PID.can_create_media, PID.can_update_media, PID.can_delete_media,
        PID.can_update_any_media],
    GeneralUser: [PID.can_create_media, PID.can_update_media, PID.can_delete_media],
    Student: [PID.can_create_media, PID.can_update_media]
};

const USER_ID = 42;
const OTHER_OWNER = 999;
const MEDIA_UUID = '550e8400-e29b-41d4-a716-446655440000';

const CREATE_OPTS = { permissions: ['can_create_media'], record_type: 'media', parent_id: null, child_id: null };
const UPDATE_OPTS = { permissions: ['can_update_any_media', 'can_update_media'], record_type: 'media', parent_id: MEDIA_UUID, child_id: null };
const DELETE_OPTS = { permissions: ['can_delete_any_media', 'can_delete_media'], record_type: 'media', parent_id: MEDIA_UUID, child_id: null };

function asRole(role) {
    auth.get_user_id_by_username.mockResolvedValue(USER_ID);
    auth.get_permissions.mockResolvedValue(CATALOG);
    auth.get_user_permissions_by_username.mockResolvedValue(
        ROLE_MEDIA_PERMS[role].map(permission_id => ({ permission_id }))
    );
}

const call = (opts) =>
    AUTHORIZE.check_permission({ req: { decoded: { sub: '871095226' } }, ...opts });

beforeEach(() => {
    jest.clearAllMocks();
    auth.check_ownership.mockResolvedValue(0);
});

describe('media CREATE (can_create_media)', () => {
    for (const role of Object.keys(ROLE_MEDIA_PERMS)) {
        test(`${role} is allowed to create media`, async () => {
            asRole(role);
            expect(await call(CREATE_OPTS)).toBe(true);
            expect(auth.check_ownership).not.toHaveBeenCalled();
        });
    }
});

describe('media UPDATE (can_update_any_media | can_update_media)', () => {

    for (const role of ['Administrator', 'PowerUser']) {
        test(`${role} may update ANY media (no ownership check)`, async () => {
            asRole(role);
            auth.check_ownership.mockResolvedValue(OTHER_OWNER);
            expect(await call(UPDATE_OPTS)).toBe(true);
            expect(auth.check_ownership).not.toHaveBeenCalled();
        });
    }

    for (const role of ['GeneralUser', 'Student']) {
        test(`${role} may update media they OWN`, async () => {
            asRole(role);
            auth.check_ownership.mockResolvedValue(USER_ID);
            expect(await call(UPDATE_OPTS)).toBe(true);
            expect(auth.check_ownership).toHaveBeenCalledTimes(1);
        });

        test(`${role} may NOT update media owned by someone else`, async () => {
            asRole(role);
            auth.check_ownership.mockResolvedValue(OTHER_OWNER);
            expect(await call(UPDATE_OPTS)).toBe(false);
        });
    }
});

describe('media DELETE (can_delete_any_media | can_delete_media)', () => {

    test('Administrator may delete ANY media (no ownership check)', async () => {
        asRole('Administrator');
        auth.check_ownership.mockResolvedValue(OTHER_OWNER);
        expect(await call(DELETE_OPTS)).toBe(true);
        expect(auth.check_ownership).not.toHaveBeenCalled();
    });

    for (const role of ['PowerUser', 'GeneralUser']) {
        test(`${role} may delete media they OWN`, async () => {
            asRole(role);
            auth.check_ownership.mockResolvedValue(USER_ID);
            expect(await call(DELETE_OPTS)).toBe(true);
            expect(auth.check_ownership).toHaveBeenCalledTimes(1);
        });

        test(`${role} may NOT delete media owned by someone else`, async () => {
            asRole(role);
            auth.check_ownership.mockResolvedValue(OTHER_OWNER);
            expect(await call(DELETE_OPTS)).toBe(false);
        });
    }

    test('Student is DENIED media delete entirely (no media-delete permission)', async () => {
        asRole('Student');
        auth.check_ownership.mockResolvedValue(USER_ID);
        expect(await call(DELETE_OPTS)).toBe(false);
        expect(auth.check_ownership).not.toHaveBeenCalled();
    });
});
