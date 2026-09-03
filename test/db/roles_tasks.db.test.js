/**
 * Database-backed test: auth/tasks/roles_tasks.js
 *
 * The role assignment behind user create/update. save_user_role must be an
 * UPSERT — a user has exactly one role row (UNIQUE(user_id), migration
 * 20260518120000) and re-saving replaces it rather than accruing a second
 * row that would make role resolution nondeterministic.
 *
 * Note on construction: users/model.js builds Roles_tasks with the join-table
 * NAME (save/update use `this.TABLE` as a string) while auth/model.js builds
 * it with the tables OBJECT (get_roles reads `this.TABLE.roles_records`).
 * Both shapes are exercised here as their callers use them (review M1).
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const { create_knex, TABLES, du_id } = require('./db');
const Roles_tasks = require('../../auth/tasks/roles_tasks');

const knex = create_knex();
const roles_by_name = new Roles_tasks(knex, TABLES.users_roles);   /* users/model style */
const roles_by_map = new Roles_tasks(knex, TABLES);                /* auth/model style */

let user_id;
let roleless_user_id;
let ROLE_ID;

beforeAll(async () => {
    const roles = await knex(TABLES.roles_records).select('id', 'role');
    ROLE_ID = Object.fromEntries(roles.map((r) => [r.role, r.id]));

    const a = du_id('Role');
    const b = du_id('NoRole');
    [user_id] = await knex(TABLES.user_records).insert({ du_id: a, email: `${a}@du.edu`, first_name: 'DB', last_name: 'Role', is_active: 1 });
    [roleless_user_id] = await knex(TABLES.user_records).insert({ du_id: b, email: `${b}@du.edu`, first_name: 'DB', last_name: 'NoRole', is_active: 1 });
});

afterAll(async () => {
    try {
        await knex(TABLES.users_roles).whereIn('user_id', [user_id, roleless_user_id]).del();
        await knex(TABLES.user_records).whereIn('id', [user_id, roleless_user_id]).del();
    } finally {
        await knex.destroy();
    }
});

describe('save_user_role — one role per user, upserted', () => {

    test('first save inserts the role row', async () => {
        await roles_by_name.save_user_role(user_id, ROLE_ID.Student);

        const rows = await knex(TABLES.users_roles).where({ user_id });
        expect(rows).toHaveLength(1);
        expect(rows[0].role_id).toBe(ROLE_ID.Student);
    });

    test('re-saving with a different role REPLACES the row instead of adding one', async () => {
        await roles_by_name.save_user_role(user_id, ROLE_ID['Power User']);

        const rows = await knex(TABLES.users_roles).where({ user_id });
        expect(rows).toHaveLength(1);
        expect(rows[0].role_id).toBe(ROLE_ID['Power User']);
    });

    test('get_user_role resolves the current role with its name', async () => {
        const result = await roles_by_map.get_user_role(user_id);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ user_id, role_id: ROLE_ID['Power User'], role: 'Power User' });
    });

    test('a user with no role row resolves to an empty list', async () => {
        expect(await roles_by_map.get_user_role(roleless_user_id)).toEqual([]);
    });
});

describe('update_user_role — an UPDATE, so it silently does nothing for a role-less user (review M2)', () => {

    test('updates an existing row', async () => {
        const affected = await roles_by_name.update_user_role(user_id, ROLE_ID.Administrator);

        expect(affected).toBe(1);
        expect((await roles_by_map.get_user_role(user_id))[0].role).toBe('Administrator');
    });

    test('affects 0 rows for a user without a role row — the caller cannot tell the role was not applied', async () => {
        const affected = await roles_by_name.update_user_role(roleless_user_id, ROLE_ID.Student);

        expect(affected).toBe(0);
        expect(await roles_by_map.get_user_role(roleless_user_id)).toEqual([]);
    });
});

describe('get_roles', () => {

    test('returns the seeded role catalog when constructed with the tables map', async () => {
        const roles = await roles_by_map.get_roles();

        expect(roles.map((r) => r.role).sort()).toEqual(['Administrator', 'General User', 'Power User', 'Student']);
    });
});
