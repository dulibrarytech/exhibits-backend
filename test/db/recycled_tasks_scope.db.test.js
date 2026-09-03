/**
 * Database-backed test: exhibit_recycled_record_tasks restore/purge scoping
 *
 * Restore and permanent delete used to match on uuid alone, so a caller who
 * passed exhibit A in the URL (and was authorized for A) could restore or
 * purge a recycled child that belongs to exhibit B (review 2026-09-02, H3).
 * The task now takes a scope ({ is_member_of_exhibit }) that recycle_model
 * derives from the request; this suite proves the scope actually confines
 * the write.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const { create_knex, TABLES, uuid } = require('./db');
const Recycled_tasks = require('../../exhibits/tasks/exhibit_recycled_record_tasks');

const knex = create_knex();
const tasks = new Recycled_tasks(knex, TABLES);

const EXHIBIT_A = uuid();
const EXHIBIT_B = uuid();
const ITEM_IN_B = uuid();
const ITEM_IN_A = uuid();

beforeAll(async () => {
    await knex(TABLES.exhibit_records).insert([
        { uuid: EXHIBIT_A, title: 'DB recycle scope A' },
        { uuid: EXHIBIT_B, title: 'DB recycle scope B' }
    ]);
    await knex(TABLES.item_records).insert([
        { uuid: ITEM_IN_A, is_member_of_exhibit: EXHIBIT_A, is_deleted: 1 },
        { uuid: ITEM_IN_B, is_member_of_exhibit: EXHIBIT_B, is_deleted: 1 }
    ]);
});

afterAll(async () => {
    try {
        await knex(TABLES.item_records).whereIn('uuid', [ITEM_IN_A, ITEM_IN_B]).del();
        await knex(TABLES.exhibit_records).whereIn('uuid', [EXHIBIT_A, EXHIBIT_B]).del();
    } finally {
        await knex.destroy();
    }
});

const is_deleted = async (item_uuid) => Number((await knex(TABLES.item_records).where({ uuid: item_uuid }).first()).is_deleted);

describe('restore_recycled_record — scoped to the named exhibit', () => {

    test('a child of exhibit B cannot be restored under exhibit A', async () => {
        const affected = await tasks.restore_recycled_record(TABLES.item_records, ITEM_IN_B, { is_member_of_exhibit: EXHIBIT_A });

        expect(affected).toBe(0);
        expect(await is_deleted(ITEM_IN_B)).toBe(1);
    });

    test('the same child restores under its own exhibit', async () => {
        const affected = await tasks.restore_recycled_record(TABLES.item_records, ITEM_IN_B, { is_member_of_exhibit: EXHIBIT_B });

        expect(affected).toBe(1);
        expect(await is_deleted(ITEM_IN_B)).toBe(0);

        /* only recycled rows are restorable: a second restore is a no-op */
        expect(await tasks.restore_recycled_record(TABLES.item_records, ITEM_IN_B, { is_member_of_exhibit: EXHIBIT_B })).toBe(0);
    });
});

describe('delete_recycled_record — scoped to the named exhibit', () => {

    test('a child of exhibit A cannot be purged under exhibit B', async () => {
        const affected = await tasks.delete_recycled_record(TABLES.item_records, ITEM_IN_A, { is_member_of_exhibit: EXHIBIT_B });

        expect(affected).toBe(0);
        expect(await knex(TABLES.item_records).where({ uuid: ITEM_IN_A }).first()).toBeDefined();
    });

    test('the same child purges under its own exhibit', async () => {
        const affected = await tasks.delete_recycled_record(TABLES.item_records, ITEM_IN_A, { is_member_of_exhibit: EXHIBIT_A });

        expect(affected).toBe(1);
        expect(await knex(TABLES.item_records).where({ uuid: ITEM_IN_A }).first()).toBeUndefined();
    });
});
