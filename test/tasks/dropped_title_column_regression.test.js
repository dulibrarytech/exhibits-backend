'use strict';

/**
 * Regression for the dropped `title` column.
 *
 * 20260403200926_titles-to-subheadings DROPPED `title` from the three CONTAINER
 * tables — tbl_standard_items (item_records), tbl_grids (grid_records) and
 * tbl_timelines (timeline_records). Any query that names `title` explicitly
 * against those tables throws "Unknown column 'title'", which the models wrap as
 * a 400 — the "Failed to update item record" bug (and the equivalent on grid
 * publish / timeline create).
 *
 * The item tables (tbl_grid_items, tbl_timeline_items) KEPT their `title` column,
 * so the item-record task paths legitimately still reference it — those are NOT
 * covered here.
 *
 * The model / integration tests fully mock the DB *and* these task modules, so
 * the real SQL never runs there. This drives the REAL task classes against a
 * recording fake DB and asserts the container paths never reference `title`.
 */

// Silence the logger pulled in by Base_tasks (_log_success / _handle_error).
vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const ItemTasks = require('../../exhibits/tasks/exhibit_item_record_tasks');
const GridTasks = require('../../exhibits/tasks/exhibit_grid_record_tasks');
const TimelineTasks = require('../../exhibits/tasks/exhibit_timeline_record_tasks');

const EXHIBIT_UUID = '5ce8ac28-63d9-4fb6-94d7-bbff2760c06b';
const RECORD_UUID = 'b042f609-b680-4ca9-be40-aaf194dcfced';

const TABLE = {
    item_records: 'tbl_standard_items',
    grid_records: 'tbl_grids',
    grid_item_records: 'tbl_grid_items',
    timeline_records: 'tbl_timelines',
    timeline_item_records: 'tbl_timeline_items',
    media_library_records: 'tbl_media_library'
};

// Minimal knex-like builder that RECORDS the columns/payloads each query sees and
// resolves the chain to canned rows, so the real tasks can run without a database.
function createRecordingDb() {

    const calls = { selects: [], inserts: [], updates: [] };
    const responses = {
        existing: { id: 1, uuid: RECORD_UUID, is_deleted: 0, is_published: 0 },
        record: { id: 1, uuid: RECORD_UUID, is_deleted: 0, item_type: 'image' },
        affectedRows: 1,
        insertedId: [1]
    };

    function makeBuilder(table) {
        const state = { mode: 'select', cols: [] };
        const builder = {
            select(...cols) { state.mode = 'select'; state.cols = cols; calls.selects.push({ table, cols }); return builder; },
            insert(data) { state.mode = 'insert'; calls.inserts.push({ table, data }); return builder; },
            update(data) { state.mode = 'update'; calls.updates.push({ table, data }); return builder; },
            where() { return builder; },
            andWhere() { return builder; },
            whereIn() { return builder; },
            first() { return builder; },
            leftJoin() { return builder; },
            orderBy() { return builder; },
            timeout() { return builder; },
            then(resolve, reject) {
                let value;
                if (state.mode === 'insert') { value = responses.insertedId; }
                else if (state.mode === 'update') { value = responses.affectedRows; }
                else if (state.cols.some(c => String(c).includes('*'))) { value = responses.record; }
                else { value = responses.existing; }
                return Promise.resolve(value).then(resolve, reject);
            }
        };
        return builder;
    }

    const db = (table) => makeBuilder(table);
    db.fn = { now: () => 'NOW()' };
    db.transaction = async (cb) => cb(db);

    return { db, calls };
}

// Assert no query touched the dropped `title` column.
function expectNoTitle(calls) {
    const selected = calls.selects.flatMap(s => s.cols.map(String));
    const inserted = calls.inserts.flatMap(i => Object.keys(i.data));
    const updated = calls.updates.flatMap(u => Object.keys(u.data));
    expect(selected).not.toContain('title');
    expect(inserted).not.toContain('title');
    expect(updated).not.toContain('title');
}

describe('dropped `title` column — container task paths never reference it', () => {

    // ---- standard items (tbl_standard_items) ----

    test('item: update_item_record succeeds without selecting/updating `title`', async () => {
        const { db, calls } = createRecordingDb();
        const task = new ItemTasks(db, TABLE);
        const result = await task.update_item_record({
            uuid: RECORD_UUID, is_member_of_exhibit: EXHIBIT_UUID, text: 'TEST', caption: 'cap'
        });
        expect(result.success).toBe(true);
        expect(calls.selects.length).toBeGreaterThan(0);
        expectNoTitle(calls);
    });

    test('item: create_item_record succeeds without inserting `title`', async () => {
        const { db, calls } = createRecordingDb();
        const task = new ItemTasks(db, TABLE);
        const result = await task.create_item_record({
            uuid: RECORD_UUID, is_member_of_exhibit: EXHIBIT_UUID, item_type: 'image', mime_type: 'image/jpeg'
        });
        expect(result.success).toBe(true);
        expect(calls.inserts.length).toBeGreaterThan(0);
        expectNoTitle(calls);
    });

    // ---- grid containers (tbl_grids) ----

    test('grid: publishing a grid container does not select `title`', async () => {
        const { db, calls } = createRecordingDb();
        const task = new GridTasks(db, TABLE);
        // set_grid_to_publish → _update_single_publish_status('grid_records', …)
        const result = await task._update_single_publish_status('grid_records', RECORD_UUID, 1);
        expect(result.success).toBe(true);
        expect(calls.selects.length).toBeGreaterThan(0);
        expectNoTitle(calls);
    });

    test('grid: create_grid_record does not insert `title`', async () => {
        const { db, calls } = createRecordingDb();
        const task = new GridTasks(db, TABLE);
        const result = await task.create_grid_record({
            uuid: RECORD_UUID, is_member_of_exhibit: EXHIBIT_UUID, type: 'grid', columns: 3
        });
        expect(result).toBeTruthy();
        expect(calls.inserts.length).toBeGreaterThan(0);
        expectNoTitle(calls);
    });

    // ---- timeline containers (tbl_timelines) ----

    test('timeline: create_timeline_record does not insert `title`', async () => {
        const { db, calls } = createRecordingDb();
        const task = new TimelineTasks(db, TABLE);
        const result = await task.create_timeline_record({
            uuid: RECORD_UUID, is_member_of_exhibit: EXHIBIT_UUID, type: 'vertical_timeline'
        });
        expect(result).toBeTruthy();
        expect(calls.inserts.length).toBeGreaterThan(0);
        expectNoTitle(calls);
    });
});
