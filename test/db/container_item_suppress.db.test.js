/**
 * Database-backed test: suppressing one container's items leaves its siblings alone
 *
 * grid_model.suppress_grid_record / timelines_model.suppress_timeline_record
 * flag the container's ITEMS unpublished via set_to_suppressed_grid_items /
 * set_to_suppressed_timeline_items, keyed by the container uuid. A caller bug
 * used to hand them every container in the exhibit, so suppressing one grid
 * unpublished the items of all of them (review 2026-09-02, H8). This suite
 * pins the task contract: exactly one container's items change.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const { create_knex, TABLES, uuid } = require('./db');
const Grid_tasks = require('../../exhibits/tasks/exhibit_grid_record_tasks');
const Timeline_tasks = require('../../exhibits/tasks/exhibit_timeline_record_tasks');

const knex = create_knex();
const grid_tasks = new Grid_tasks(knex, TABLES);
const timeline_tasks = new Timeline_tasks(knex, TABLES);

const EXHIBIT = uuid();
const G = { a: uuid(), b: uuid(), items_a: [uuid(), uuid()], items_b: [uuid(), uuid()] };
const T = { a: uuid(), b: uuid(), items_a: [uuid(), uuid()], items_b: [uuid(), uuid()] };

beforeAll(async () => {
    await knex(TABLES.exhibit_records).insert({ uuid: EXHIBIT, title: 'DB container suppress', is_published: 1 });

    await knex(TABLES.grid_records).insert([
        { uuid: G.a, is_member_of_exhibit: EXHIBIT, is_published: 1 },
        { uuid: G.b, is_member_of_exhibit: EXHIBIT, is_published: 1 }
    ]);
    await knex(TABLES.grid_item_records).insert([
        ...G.items_a.map((u) => ({ uuid: u, is_member_of_grid: G.a, is_member_of_exhibit: EXHIBIT, title: 'ga', is_published: 1 })),
        ...G.items_b.map((u) => ({ uuid: u, is_member_of_grid: G.b, is_member_of_exhibit: EXHIBIT, title: 'gb', is_published: 1 }))
    ]);

    await knex(TABLES.timeline_records).insert([
        { uuid: T.a, is_member_of_exhibit: EXHIBIT, is_published: 1 },
        { uuid: T.b, is_member_of_exhibit: EXHIBIT, is_published: 1 }
    ]);
    await knex(TABLES.timeline_item_records).insert([
        ...T.items_a.map((u) => ({ uuid: u, is_member_of_timeline: T.a, is_member_of_exhibit: EXHIBIT, title: 'ta', is_published: 1 })),
        ...T.items_b.map((u) => ({ uuid: u, is_member_of_timeline: T.b, is_member_of_exhibit: EXHIBIT, title: 'tb', is_published: 1 }))
    ]);
});

afterAll(async () => {
    try {
        await knex(TABLES.grid_item_records).whereIn('uuid', [...G.items_a, ...G.items_b]).del();
        await knex(TABLES.grid_records).whereIn('uuid', [G.a, G.b]).del();
        await knex(TABLES.timeline_item_records).whereIn('uuid', [...T.items_a, ...T.items_b]).del();
        await knex(TABLES.timeline_records).whereIn('uuid', [T.a, T.b]).del();
        await knex(TABLES.exhibit_records).where({ uuid: EXHIBIT }).del();
    } finally {
        await knex.destroy();
    }
});

const published_flags = async (table, uuids) => {
    const rows = await knex(table).select('uuid', 'is_published').whereIn('uuid', uuids);
    return uuids.map((u) => Number(rows.find((r) => r.uuid === u).is_published));
};

test('set_to_suppressed_grid_items(grid A) unpublishes A\'s items and nobody else\'s', async () => {
    const result = await grid_tasks.set_to_suppressed_grid_items(G.a);

    expect(result.affected_rows).toBe(2);
    expect(await published_flags(TABLES.grid_item_records, G.items_a)).toEqual([0, 0]);
    expect(await published_flags(TABLES.grid_item_records, G.items_b)).toEqual([1, 1]);
});

test('set_to_suppressed_timeline_items(timeline A) unpublishes A\'s items and nobody else\'s', async () => {
    const result = await timeline_tasks.set_to_suppressed_timeline_items(T.a);

    expect(result.affected_rows).toBe(2);
    expect(await published_flags(TABLES.timeline_item_records, T.items_a)).toEqual([0, 0]);
    expect(await published_flags(TABLES.timeline_item_records, T.items_b)).toEqual([1, 1]);
});

test('passing the EXHIBIT uuid (the old bug\'s first call) matches nothing', async () => {
    expect((await grid_tasks.set_to_suppressed_grid_items(EXHIBIT)).affected_rows).toBe(0);
    expect((await timeline_tasks.set_to_suppressed_timeline_items(EXHIBIT)).affected_rows).toBe(0);
    expect(await published_flags(TABLES.grid_item_records, G.items_b)).toEqual([1, 1]);
    expect(await published_flags(TABLES.timeline_item_records, T.items_b)).toEqual([1, 1]);
});
