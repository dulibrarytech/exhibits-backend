/**
 * Database-backed test: publish-gate counts and bulk publish/suppress flags
 *
 * exhibits_model.publish_exhibit_record refuses an exhibit with no content
 * (get_exhibit_counts → total_count === 0) and then bulk-flags every
 * component table for the exhibit. Both are implemented per task class with
 * an `is_member_of_exhibit` WHERE clause. Recycled rows (is_deleted = 1) must
 * be invisible to both: a bin full of items is not content, and publishing an
 * exhibit must not resurrect what a curator threw away (review M3).
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const { create_knex, TABLES, uuid } = require('./db');
const Heading_tasks = require('../../exhibits/tasks/exhibit_heading_record_tasks');
const Item_tasks = require('../../exhibits/tasks/exhibit_item_record_tasks');
const Grid_tasks = require('../../exhibits/tasks/exhibit_grid_record_tasks');
const Timeline_tasks = require('../../exhibits/tasks/exhibit_timeline_record_tasks');

const knex = create_knex();
const tasks = {
    heading: new Heading_tasks(knex, TABLES),
    item: new Item_tasks(knex, TABLES),
    grid: new Grid_tasks(knex, TABLES),
    timeline: new Timeline_tasks(knex, TABLES)
};

const EXHIBIT = uuid();
const OTHER_EXHIBIT = uuid();

/* One live + one recycled row per component table, plus a live row in another exhibit. */
const ROWS = {
    heading: { table: TABLES.heading_records, live: uuid(), deleted: uuid(), foreign: uuid(), extra: { text: 'h' } },
    item: { table: TABLES.item_records, live: uuid(), deleted: uuid(), foreign: uuid(), extra: {} },
    grid: { table: TABLES.grid_records, live: uuid(), deleted: uuid(), foreign: uuid(), extra: {} },
    timeline: { table: TABLES.timeline_records, live: uuid(), deleted: uuid(), foreign: uuid(), extra: {} }
};

const all_uuids = (row) => [row.live, row.deleted, row.foreign];

beforeAll(async () => {
    await knex(TABLES.exhibit_records).insert([
        { uuid: EXHIBIT, title: 'DB publish gate', is_published: 0 },
        { uuid: OTHER_EXHIBIT, title: 'DB publish gate (other)', is_published: 0 }
    ]);

    for (const row of Object.values(ROWS)) {
        await knex(row.table).insert([
            { uuid: row.live, is_member_of_exhibit: EXHIBIT, is_deleted: 0, is_published: 0, ...row.extra },
            { uuid: row.deleted, is_member_of_exhibit: EXHIBIT, is_deleted: 1, is_published: 0, ...row.extra },
            { uuid: row.foreign, is_member_of_exhibit: OTHER_EXHIBIT, is_deleted: 0, is_published: 0, ...row.extra }
        ]);
    }
});

afterAll(async () => {
    try {
        for (const row of Object.values(ROWS)) {
            await knex(row.table).whereIn('uuid', all_uuids(row)).del();
        }
        await knex(TABLES.exhibit_records).whereIn('uuid', [EXHIBIT, OTHER_EXHIBIT]).del();
    } finally {
        await knex.destroy();
    }
});

async function flags(row) {
    const rows = await knex(row.table).select('uuid', 'is_published').whereIn('uuid', all_uuids(row));
    const by = Object.fromEntries(rows.map((r) => [r.uuid, Number(r.is_published)]));
    return { live: by[row.live], deleted: by[row.deleted], foreign: by[row.foreign] };
}

describe('get_record_count — the publish gate must not count recycled rows', () => {

    test.each(Object.keys(ROWS))('%s: counts the live row only, scoped to the exhibit', async (type) => {
        expect(await tasks[type].get_record_count(EXHIBIT)).toBe(1);
    });

    test.each(Object.keys(ROWS))('%s: an exhibit with no rows counts 0', async (type) => {
        expect(await tasks[type].get_record_count(uuid())).toBe(0);
    });
});

describe('set_to_publish / set_to_suppress — bulk flags skip recycled rows and other exhibits', () => {

    beforeEach(async () => {
        for (const row of Object.values(ROWS)) {
            await knex(row.table).whereIn('uuid', all_uuids(row)).update({ is_published: 0 });
        }
    });

    test.each(Object.keys(ROWS))('%s: publish flips the live row, leaves the recycled and foreign rows alone', async (type) => {
        await tasks[type].set_to_publish(EXHIBIT);

        expect(await flags(ROWS[type])).toEqual({ live: 1, deleted: 0, foreign: 0 });
    });

    test.each(Object.keys(ROWS))('%s: suppress clears only what publish set', async (type) => {
        await knex(ROWS[type].table).whereIn('uuid', all_uuids(ROWS[type])).update({ is_published: 1 });

        await tasks[type].set_to_suppress(EXHIBIT);

        /* recycled row was published "by hand" above; suppress must not touch it either */
        expect(await flags(ROWS[type])).toEqual({ live: 0, deleted: 1, foreign: 1 });
    });
});
