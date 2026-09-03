/**
 * Database-backed test: auth/tasks/auth_tasks.js check_ownership
 *
 * check_ownership is the ownership half of every partial-permission decision
 * (authorize.check_permission → "user holds SOME of the required permissions →
 * must own the record"). The mocked-knex unit test can only assert which
 * builder calls were made; this suite asserts which OWNER comes back for real
 * rows, including the cross-exhibit case from code review 2026-09-02 (H3):
 * owning exhibit A must not confer ownership of a child that lives in
 * exhibit B just because A's uuid is in the URL.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const { create_knex, TABLES, uuid, du_id } = require('./db');
const Auth_tasks = require('../../auth/tasks/auth_tasks');

const knex = create_knex();
const auth = new Auth_tasks(knex, TABLES);

/* Fixture ids, filled in beforeAll. */
const F = {
    users: {},      /* owner_a, owner_b, other */
    exhibit_a: uuid(),
    exhibit_b: uuid(),
    item_a_by_a: uuid(),   /* in A, owned by owner_a */
    item_a_by_other: uuid(),   /* in A, owned by other */
    item_b_by_b: uuid(),   /* in B, owned by owner_b */
    grid_a: uuid(),
    grid_item_a: uuid(),   /* in grid_a / exhibit A, owned by owner_a */
    media_by_a: uuid(),
    media_deleted_by_a: uuid()
};

async function insert_user(label) {
    const id_label = du_id(label);
    const [id] = await knex(TABLES.user_records).insert({
        du_id: id_label, email: `${id_label}@du.edu`, first_name: 'DB', last_name: label, is_active: 1
    });
    return id;
}

beforeAll(async () => {
    F.users.owner_a = await insert_user('OwnerA');
    F.users.owner_b = await insert_user('OwnerB');
    F.users.other = await insert_user('Other');

    await knex(TABLES.exhibit_records).insert([
        { uuid: F.exhibit_a, title: 'DB ownership A', owner: F.users.owner_a },
        { uuid: F.exhibit_b, title: 'DB ownership B', owner: F.users.owner_b }
    ]);

    await knex(TABLES.item_records).insert([
        { uuid: F.item_a_by_a, is_member_of_exhibit: F.exhibit_a, owner: F.users.owner_a },
        { uuid: F.item_a_by_other, is_member_of_exhibit: F.exhibit_a, owner: F.users.other },
        { uuid: F.item_b_by_b, is_member_of_exhibit: F.exhibit_b, owner: F.users.owner_b }
    ]);

    await knex(TABLES.grid_records).insert({ uuid: F.grid_a, is_member_of_exhibit: F.exhibit_a, owner: F.users.owner_a });
    await knex(TABLES.grid_item_records).insert({
        uuid: F.grid_item_a, is_member_of_grid: F.grid_a, is_member_of_exhibit: F.exhibit_a, title: 'gi', owner: F.users.owner_a
    });

    await knex(TABLES.media_library_records).insert([
        { uuid: F.media_by_a, name: 'm', media_type: 'image', ingest_method: 'upload', owner: F.users.owner_a, is_deleted: 0 },
        { uuid: F.media_deleted_by_a, name: 'm', media_type: 'image', ingest_method: 'upload', owner: F.users.owner_a, is_deleted: 1 }
    ]);
});

afterAll(async () => {
    try {
        await knex(TABLES.media_library_records).whereIn('uuid', [F.media_by_a, F.media_deleted_by_a]).del();
        await knex(TABLES.grid_item_records).where({ uuid: F.grid_item_a }).del();
        await knex(TABLES.grid_records).where({ uuid: F.grid_a }).del();
        await knex(TABLES.item_records).whereIn('uuid', [F.item_a_by_a, F.item_a_by_other, F.item_b_by_b]).del();
        await knex(TABLES.exhibit_records).whereIn('uuid', [F.exhibit_a, F.exhibit_b]).del();
        await knex(TABLES.user_records).whereIn('id', Object.values(F.users)).del();
    } finally {
        await knex.destroy();
    }
});

describe('check_ownership — exhibit and media (no child)', () => {

    test('returns the exhibit owner for any record_type when no child is given', async () => {
        expect(await auth.check_ownership(F.users.other, F.exhibit_a, null, 'exhibit')).toBe(F.users.owner_a);
        expect(await auth.check_ownership(F.users.other, F.exhibit_a, null, 'item')).toBe(F.users.owner_a);
        expect(await auth.check_ownership(F.users.other, F.exhibit_b, '', 'grid')).toBe(F.users.owner_b);
    });

    test('returns 0 for an exhibit that does not exist', async () => {
        expect(await auth.check_ownership(F.users.owner_a, uuid(), null, 'exhibit')).toBe(0);
    });

    test('media resolves its own owner and ignores soft-deleted rows', async () => {
        expect(await auth.check_ownership(F.users.other, F.media_by_a, null, 'media')).toBe(F.users.owner_a);
        expect(await auth.check_ownership(F.users.owner_a, F.media_deleted_by_a, null, 'media')).toBe(0);
    });
});

describe('check_ownership — child inside the named exhibit', () => {

    test('child owned by the exhibit owner → exhibit owner (a non-owner caller then fails the compare)', async () => {
        expect(await auth.check_ownership(F.users.other, F.exhibit_a, F.item_a_by_a, 'item')).toBe(F.users.owner_a);
    });

    test('child owned by the caller inside someone else\'s exhibit → the caller (own-item edits)', async () => {
        expect(await auth.check_ownership(F.users.other, F.exhibit_a, F.item_a_by_other, 'item')).toBe(F.users.other);
    });

    test('exhibit owner acting on a child someone else added → exhibit owner', async () => {
        expect(await auth.check_ownership(F.users.owner_a, F.exhibit_a, F.item_a_by_other, 'item')).toBe(F.users.owner_a);
    });

    test('a third party who owns neither the exhibit nor the child → 0', async () => {
        expect(await auth.check_ownership(F.users.owner_b, F.exhibit_a, F.item_a_by_other, 'item')).toBe(0);
    });

    test('grid items resolve through their own table', async () => {
        expect(await auth.check_ownership(F.users.other, F.exhibit_a, F.grid_item_a, 'grid_item')).toBe(F.users.owner_a);
    });
});

describe('check_ownership — child must belong to the named exhibit (review H3)', () => {

    test('owning exhibit A confers NOTHING over a child that lives in exhibit B', async () => {
        /* URL says exhibit A (owned by the caller); the child uuid is B's. */
        expect(await auth.check_ownership(F.users.owner_a, F.exhibit_a, F.item_b_by_b, 'item')).toBe(0);
    });

    test('a child uuid that does not exist under the named exhibit resolves to nobody', async () => {
        expect(await auth.check_ownership(F.users.owner_a, F.exhibit_a, uuid(), 'item')).toBe(0);
    });

    test('a child looked up under the wrong record_type resolves to nobody', async () => {
        /* item uuid queried as a grid item: no such grid_item row */
        expect(await auth.check_ownership(F.users.owner_a, F.exhibit_a, F.item_a_by_a, 'grid_item')).toBe(0);
    });
});

describe('check_ownership — input guards', () => {

    test('rejects malformed ids and unknown record types with 0, without querying', async () => {
        expect(await auth.check_ownership(null, F.exhibit_a, null, 'exhibit')).toBe(0);
        expect(await auth.check_ownership(F.users.owner_a, 'not-a-uuid', null, 'exhibit')).toBe(0);
        expect(await auth.check_ownership(F.users.owner_a, F.exhibit_a, 'not-a-uuid', 'item')).toBe(0);
        expect(await auth.check_ownership(F.users.owner_a, F.exhibit_a, null, 'user')).toBe(0);
    });
});
