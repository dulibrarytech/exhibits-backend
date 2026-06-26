/**
 * Integration Test: User / Role / Permission Matrix (LIVE DB, read-only)
 *
 * Audits the real `exhibitsv2` MariaDB that backs the exhibits application.
 * This suite performs ONLY SELECT queries — it never writes, so it is safe to
 * run against the connected development database.
 *
 * What it verifies:
 *   1. The four canonical roles exist with the expected ids/names.
 *   2. The 36 canonical permissions exist.
 *   3. Referential integrity of user -> role assignments
 *      (every user has exactly one role; no orphan / duplicate role rows).
 *   4. The ENFORCED role -> permission matrix (ctbl_role_permissions) matches
 *      the expected per-role permission sets. The enforced DB state is the
 *      single source of truth (the legacy `has_permission` text column was
 *      dropped by migration 20260518120100; there is no longer a second
 *      source to drift against).
 *   5. Inactive users resolve to zero permissions (is_active = 1 gate).
 *   6. The `_any_` permission invariant: any role granted an `*_any_*`
 *      permission that AUTHORIZE.check_permission pairs with a base permission
 *      must also hold that base permission — otherwise the all-or-ownership
 *      logic wrongly forces the user down the ownership-only path.
 *
 * Connection: uses the same credentials as the app (.env). Host resolution
 * order: TEST_DB_HOST (per-run test override) -> DB_HOST (the app's configured
 * host, e.g. exhibits.dev — used by default so the test connects exactly like
 * the application) -> 127.0.0.1 (last-resort fallback for stock dev boxes
 * where exhibits.dev does not resolve).
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

require('dotenv').config();

// Silence the application logger pulled in transitively by Auth_tasks.
jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

const knexLib = require('knex');
const Auth_tasks = require('../../auth/tasks/auth_tasks');

// ---------------------------------------------------------------------------
// Expected state (snapshot of enforced production-like exhibitsv2 truth)
// ---------------------------------------------------------------------------

const ROLES = {
    1: 'Administrator',
    2: 'Power User',
    3: 'General User',
    4: 'Student'
};

const ALL_PERMISSIONS = [
    'add_exhibit', 'add_item', 'update_item', 'update_exhibit', 'publish_exhibit',
    'suppress_exhibit', 'publish_item', 'suppress_item', 'add_item_to_any_exhibit',
    'delete_exhibit', 'delete_item', 'transfer_exhibit', 'transfer_any_exhibit',
    'delete_any_exhibit', 'delete_any_item', 'add_items_to_any_published_exhibit',
    'publish_any_exhibit', 'suppress_any_exhibit', 'update_any_exhibit',
    'update_any_item', 'unlock_record', 'update_user_role', 'publish_any_item',
    'suppress_any_item', 'add_users', 'update_users', 'delete_users', 'view_users',
    'update_user', 'can_create_media', 'can_update_media', 'can_delete_media',
    'can_update_any_media', 'can_delete_any_media', 'manage_index', 'manage_recycle_bin'
];

// ENFORCED per-role permission sets (ctbl_role_permissions), source of truth.
// Mirrors db/seeds/03_role_permissions.js (the owner-confirmed grant matrix, 2026-06-22):
// the v2 media `can_*` grants track each role's item perms (can_*_any_media ~ *_any_item),
// so Power User holds can_delete_any_media (has delete_any_item) and Student holds
// can_delete_media (has delete_item).
const EXPECTED_ROLE_PERMISSIONS = {
    1: [...ALL_PERMISSIONS], // Administrator: all 36
    2: [ // Power User: 29
        'add_exhibit', 'add_item', 'update_item', 'update_exhibit', 'publish_exhibit',
        'suppress_exhibit', 'publish_item', 'suppress_item', 'add_item_to_any_exhibit',
        'delete_exhibit', 'delete_item', 'transfer_exhibit', 'delete_any_item',
        'add_items_to_any_published_exhibit', 'publish_any_exhibit', 'suppress_any_exhibit',
        'update_any_exhibit', 'update_any_item', 'publish_any_item', 'suppress_any_item',
        'add_users', 'update_users', 'view_users', 'update_user', 'can_create_media',
        'can_update_media', 'can_delete_media', 'can_update_any_media', 'can_delete_any_media'
    ],
    3: [ // General User: 17
        'add_exhibit', 'add_item', 'update_item', 'update_exhibit', 'publish_exhibit',
        'suppress_exhibit', 'publish_item', 'suppress_item', 'add_item_to_any_exhibit',
        'delete_exhibit', 'delete_item', 'transfer_exhibit', 'view_users', 'update_user',
        'can_create_media', 'can_update_media', 'can_delete_media'
    ],
    4: [ // Student: 15
        'add_exhibit', 'add_item', 'update_item', 'update_exhibit', 'publish_exhibit',
        'suppress_exhibit', 'publish_item', 'suppress_item', 'delete_exhibit',
        'delete_item', 'view_users', 'update_user', 'can_create_media', 'can_update_media',
        'can_delete_media'
    ]
};

// `[any_permission, base_permission]` pairs that AUTHORIZE.check_permission
// receives as a 2-element `permissions` array from the controllers. For these,
// holding the `_any_` permission WITHOUT the base silently demotes the user to
// the ownership-only path. Verified call sites (2026-05-18):
//   exhibits delete : ['delete_exhibit','delete_any_exhibit']
//   media update    : ['can_update_any_media','can_update_media']
//   media delete    : ['can_delete_any_media','can_delete_media']
const ANY_BASE_PAIRS = [
    ['delete_any_exhibit', 'delete_exhibit'],
    ['can_update_any_media', 'can_update_media'],
    ['can_delete_any_media', 'can_delete_media']
];

let db;

beforeAll(() => {
    db = knexLib({
        client: 'mysql2',
        connection: {
            host: process.env.TEST_DB_HOST || process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'exhibitsv2'
        },
        pool: { min: 0, max: 5 }
    });
});

afterAll(async () => {
    if (db) {
        await db.destroy();
    }
});

describe('exhibitsv2 — roles & permissions catalog', () => {

    test('the four canonical roles exist with expected ids and names', async () => {
        const rows = await db('tbl_user_roles').select('id', 'role').orderBy('id', 'asc');
        const actual = {};
        rows.forEach(r => { actual[r.id] = r.role; });
        expect(actual).toEqual(ROLES);
    });

    test('all 36 canonical permissions exist (no missing / extra)', async () => {
        const rows = await db('tbl_user_permissions').select('permission');
        const actual = rows.map(r => r.permission).sort();
        expect(actual).toEqual([...ALL_PERMISSIONS].sort());
    });
});

describe('exhibitsv2 — user/role assignment integrity', () => {

    test('every user has exactly one role; no orphan or duplicate role rows', async () => {
        const [{ users }] = await db('tbl_users').count('id as users');
        const [{ rows }] = await db('ctbl_user_roles').count('id as rows');
        const distinct = await db('ctbl_user_roles').countDistinct('user_id as d');
        const orphanRoles = await db('ctbl_user_roles as cur')
            .leftJoin('tbl_user_roles as r', 'r.id', 'cur.role_id')
            .whereNull('r.id')
            .count('cur.id as c');
        const orphanUsers = await db('ctbl_user_roles as cur')
            .leftJoin('tbl_users as u', 'u.id', 'cur.user_id')
            .whereNull('u.id')
            .count('cur.id as c');

        expect(Number(rows)).toBe(Number(users));            // one role row per user
        expect(Number(distinct[0].d)).toBe(Number(users));   // each user appears once
        expect(Number(orphanRoles[0].c)).toBe(0);            // role_id always valid
        expect(Number(orphanUsers[0].c)).toBe(0);            // user_id always valid
    });

    test('every assigned role_id is one of the four canonical roles', async () => {
        const rows = await db('ctbl_user_roles').distinct('role_id');
        const ids = rows.map(r => Number(r.role_id)).sort();
        ids.forEach(id => expect(Object.keys(ROLES).map(Number)).toContain(id));
    });
});

describe('exhibitsv2 — ENFORCED role -> permission matrix', () => {

    for (const roleId of Object.keys(EXPECTED_ROLE_PERMISSIONS)) {
        const rid = Number(roleId);
        test(`${ROLES[rid]} (role ${rid}) has exactly its expected permission set`, async () => {
            const rows = await db('ctbl_role_permissions as rp')
                .join('tbl_user_permissions as p', 'p.id', 'rp.permission_id')
                .where('rp.role_id', rid)
                .select('p.permission');
            const actual = rows.map(r => r.permission).sort();
            const expected = [...EXPECTED_ROLE_PERMISSIONS[rid]].sort();
            expect(actual).toEqual(expected);
        });
    }

    test('media-library permissions are correctly scoped per role', async () => {
        const grants = await db('ctbl_role_permissions as rp')
            .join('tbl_user_permissions as p', 'p.id', 'rp.permission_id')
            .whereIn('p.permission', [
                'can_create_media', 'can_update_media', 'can_update_any_media',
                'can_delete_media', 'can_delete_any_media'
            ])
            .select('rp.role_id', 'p.permission');

        const has = (role, perm) =>
            grants.some(g => Number(g.role_id) === role && g.permission === perm);

        // create: every role
        [1, 2, 3, 4].forEach(r => expect(has(r, 'can_create_media')).toBe(true));
        // update own: every role
        [1, 2, 3, 4].forEach(r => expect(has(r, 'can_update_media')).toBe(true));
        // update ANY: admin + power only
        expect(has(1, 'can_update_any_media')).toBe(true);
        expect(has(2, 'can_update_any_media')).toBe(true);
        expect(has(3, 'can_update_any_media')).toBe(false);
        expect(has(4, 'can_update_any_media')).toBe(false);
        // delete own: every role (media mirrors delete_item, which all roles hold)
        expect(has(1, 'can_delete_media')).toBe(true);
        expect(has(2, 'can_delete_media')).toBe(true);
        expect(has(3, 'can_delete_media')).toBe(true);
        expect(has(4, 'can_delete_media')).toBe(true);
        // delete ANY: admin + power (media mirrors delete_any_item, which both hold)
        expect(has(1, 'can_delete_any_media')).toBe(true);
        expect(has(2, 'can_delete_any_media')).toBe(true);
        expect(has(3, 'can_delete_any_media')).toBe(false);
        expect(has(4, 'can_delete_any_media')).toBe(false);
    });
});

describe('exhibitsv2 — _any_ permission invariant', () => {

    test('no role holds an _any_ permission without its paired base permission', async () => {
        const grants = await db('ctbl_role_permissions as rp')
            .join('tbl_user_permissions as p', 'p.id', 'rp.permission_id')
            .select('rp.role_id', 'p.permission');

        // role_id -> Set(permission)
        const byRole = {};
        grants.forEach(g => {
            const rid = Number(g.role_id);
            (byRole[rid] = byRole[rid] || new Set()).add(g.permission);
        });

        const violations = [];
        for (const rid of Object.keys(ROLES).map(Number)) {
            const held = byRole[rid] || new Set();
            for (const [anyPerm, basePerm] of ANY_BASE_PAIRS) {
                if (held.has(anyPerm) && !held.has(basePerm)) {
                    violations.push(`${ROLES[rid]}: has ${anyPerm} but not ${basePerm}`);
                }
            }
        }

        expect(violations).toEqual([]);
    });
});

describe('exhibitsv2 — is_active gate (inactive users resolve to no permissions)', () => {

    let auth;
    beforeAll(() => {
        auth = new Auth_tasks(db, { user_records: 'tbl_users' });
    });

    test('inactive users get an empty permission set via username lookup', async () => {
        const inactive = await db('tbl_users').where('is_active', 0).select('du_id');
        expect(inactive.length).toBeGreaterThan(0); // guard: fixture must contain inactive users
        for (const row of inactive) {
            const perms = await auth.get_user_permissions_by_username(row.du_id);
            expect(Array.isArray(perms)).toBe(true);
            expect(perms.length).toBe(0);
        }
    });

    test('an active administrator resolves to the full enforced permission set', async () => {
        const admin = await db('tbl_users as u')
            .join('ctbl_user_roles as cur', 'cur.user_id', 'u.id')
            .where({ 'u.is_active': 1, 'cur.role_id': 1 })
            .select('u.du_id')
            .first();
        expect(admin).toBeTruthy();
        const perms = await auth.get_user_permissions_by_username(admin.du_id);
        expect(perms.length).toBe(ALL_PERMISSIONS.length); // one row per granted permission
    });
});
