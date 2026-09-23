'use strict';

/**
 * Unit tests for Media_reference_tasks — the "who still references this
 * media?" / "what in this exhibit references deleted media?" lookups behind
 * the media delete guard and the exhibit publish gate.
 *
 * Knex is mocked with a recording builder so the tests pin the query SHAPE
 * (which tables, which WHERE clauses) rather than driver behaviour.
 */

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const Media_reference_tasks = require('../../media-library/tasks/media_reference_tasks');

const MEDIA_UUID = '61706e13-7896-46d1-8956-ca2acff4e1d6';
const EXHIBIT_UUID = '561837a9-2a43-4187-95d6-9376a48b9b85';

const TABLE = {
    exhibit_records: 'tbl_exhibits',
    item_records: 'tbl_standard_items',
    grid_item_records: 'tbl_grid_items',
    grid_records: 'tbl_grids',
    timeline_item_records: 'tbl_timeline_items',
    timeline_records: 'tbl_timelines',
    media_library_records: 'tbl_media_library',
    exhibit_media_records: 'tbl_exhibit_media'
};

/*
 * Builds a thenable query recorder. Every chained call is logged; awaiting the
 * builder resolves with the rows registered for its FROM table.
 */
const make_db = (rows_by_table = {}) => {
    const queries = [];

    const db = vi.fn((from) => {
        const query = { from, calls: [] };
        const chain = new Proxy({}, {
            get(_target, prop) {
                if (prop === 'then') {
                    const table = String(from).split(' as ')[0];
                    const rows = rows_by_table[table] || [];
                    return (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
                }
                return (...args) => {
                    query.calls.push({ method: prop, args });
                    return chain;
                };
            }
        });
        queries.push(query);
        return chain;
    });

    db.raw = vi.fn((sql, bindings) => ({ sql, bindings }));
    db.queries = queries;
    return db;
};

const wheres = (query) => query.calls.filter((c) => c.method === 'where').map((c) => c.args);

describe('Media_reference_tasks', () => {

    describe('validation', () => {

        test('rejects a malformed media uuid before querying', async () => {
            const db = make_db();
            const tasks = new Media_reference_tasks(db, TABLE);
            await expect(tasks.get_media_references('not-a-uuid')).rejects.toThrow(/media UUID/);
            expect(db).not.toHaveBeenCalled();
        });

        test('rejects a malformed exhibit uuid before querying', async () => {
            const db = make_db();
            const tasks = new Media_reference_tasks(db, TABLE);
            await expect(tasks.get_deleted_media_references('nope')).rejects.toThrow(/exhibit UUID/);
            expect(db).not.toHaveBeenCalled();
        });

        test('fails when a required table is not configured', async () => {
            const tasks = new Media_reference_tasks(make_db(), { ...TABLE, exhibit_media_records: undefined });
            await expect(tasks.get_media_references(MEDIA_UUID)).rejects.toThrow(/exhibit_media_records/);
        });
    });

    describe('get_media_references', () => {

        test('queries every item table in both roles plus both exhibit roles', async () => {
            const db = make_db();
            const tasks = new Media_reference_tasks(db, TABLE);

            await tasks.get_media_references(MEDIA_UUID);

            const froms = db.queries.map((q) => q.from);
            expect(froms.filter((f) => f.startsWith('tbl_standard_items'))).toHaveLength(2);
            expect(froms.filter((f) => f.startsWith('tbl_grid_items'))).toHaveLength(2);
            expect(froms.filter((f) => f.startsWith('tbl_timeline_items'))).toHaveLength(2);
            expect(froms.filter((f) => f.startsWith('tbl_exhibits'))).toHaveLength(2);
            expect(db.queries).toHaveLength(8);
        });

        test('item queries match the uuid in the role column and only live item rows', async () => {
            const db = make_db();
            const tasks = new Media_reference_tasks(db, TABLE);

            await tasks.get_media_references(MEDIA_UUID);

            const item_queries = db.queries.filter((q) => q.from.startsWith('tbl_standard_items'));
            const role_columns = item_queries.map((q) =>
                wheres(q).find((args) => args[1] === MEDIA_UUID)[0]
            );
            expect(role_columns.sort()).toEqual(['i.media_uuid', 'i.thumbnail_media_uuid']);

            for (const query of item_queries) {
                expect(wheres(query)).toContainEqual(['i.is_deleted', 0]);
                // No container filter: items inside recycled grids still count as references
                expect(wheres(query).some((args) => args[0] === 'c.is_deleted')).toBe(false);
            }
        });

        test('grid/timeline item queries join their container for the recycled flag', async () => {
            const db = make_db();
            const tasks = new Media_reference_tasks(db, TABLE);

            await tasks.get_media_references(MEDIA_UUID);

            const grid_query = db.queries.find((q) => q.from.startsWith('tbl_grid_items'));
            const joins = grid_query.calls.filter((c) => c.method === 'leftJoin').map((c) => c.args[0]);
            expect(joins).toContain('tbl_grids as c');
            expect(joins).toContain('tbl_exhibits as e');
        });

        test('exhibit queries resolve the bound media through the binding table with legacy fallback', async () => {
            const db = make_db();
            const tasks = new Media_reference_tasks(db, TABLE);

            await tasks.get_media_references(MEDIA_UUID);

            const exhibit_queries = db.queries.filter((q) => q.from.startsWith('tbl_exhibits'));
            for (const query of exhibit_queries) {
                expect(wheres(query)).toContainEqual(['m.uuid', MEDIA_UUID]);
                const join = query.calls.find((c) => c.method === 'join');
                expect(join.args[0]).toBe('tbl_media_library as m');
                expect(join.args[3].sql).toContain('COALESCE(b.media_uuid, ??)');
            }
            const legacy_columns = db.raw.mock.calls
                .filter((c) => c[0].includes('COALESCE'))
                .map((c) => c[1][0]);
            expect(legacy_columns).toEqual(expect.arrayContaining(['e.hero_image_media_uuid', 'e.thumbnail_media_uuid']));
        });

        test('flattens the rows from every query into one list', async () => {
            const db = make_db({
                tbl_standard_items: [{ uuid: 'item-1', record_type: 'item' }],
                tbl_exhibits: [{ uuid: 'ex-1', record_type: 'exhibit' }]
            });
            const tasks = new Media_reference_tasks(db, TABLE);

            const references = await tasks.get_media_references(MEDIA_UUID);

            // 2 item-table queries x 1 row + 2 exhibit-role queries x 1 row
            expect(references).toHaveLength(4);
            expect(references.map((r) => r.record_type).sort()).toEqual(['exhibit', 'exhibit', 'item', 'item']);
        });

        test('returns an empty list when nothing references the media', async () => {
            const tasks = new Media_reference_tasks(make_db(), TABLE);
            expect(await tasks.get_media_references(MEDIA_UUID)).toEqual([]);
        });
    });

    describe('get_deleted_media_references', () => {

        test('scopes to the exhibit and to deleted media rows', async () => {
            const db = make_db();
            const tasks = new Media_reference_tasks(db, TABLE);

            await tasks.get_deleted_media_references(EXHIBIT_UUID);

            const item_queries = db.queries.filter((q) => !q.from.startsWith('tbl_exhibits'));
            expect(item_queries).toHaveLength(6);
            for (const query of item_queries) {
                expect(wheres(query)).toContainEqual(['i.is_member_of_exhibit', EXHIBIT_UUID]);
                expect(wheres(query)).toContainEqual(['m.is_deleted', 1]);
                expect(wheres(query)).toContainEqual(['i.is_deleted', 0]);
            }

            const exhibit_queries = db.queries.filter((q) => q.from.startsWith('tbl_exhibits'));
            expect(exhibit_queries).toHaveLength(2);
            for (const query of exhibit_queries) {
                expect(wheres(query)).toContainEqual(['e.uuid', EXHIBIT_UUID]);
                expect(wheres(query)).toContainEqual(['m.is_deleted', 1]);
            }
        });

        test('skips items whose grid or timeline is in the recycle bin', async () => {
            const db = make_db();
            const tasks = new Media_reference_tasks(db, TABLE);

            await tasks.get_deleted_media_references(EXHIBIT_UUID);

            for (const query of db.queries) {
                const has_container = query.from.startsWith('tbl_grid_items') || query.from.startsWith('tbl_timeline_items');
                const filters_container = wheres(query).some((args) => args[0] === 'c.is_deleted' && args[1] === 0);
                expect(filters_container).toBe(has_container);
            }
        });

        test('returns the offending rows', async () => {
            const db = make_db({
                tbl_standard_items: [{ uuid: 'a676c5bb', record_type: 'item', role: 'media', media_is_deleted: 1 }]
            });
            const tasks = new Media_reference_tasks(db, TABLE);

            const references = await tasks.get_deleted_media_references(EXHIBIT_UUID);

            expect(references).toHaveLength(2); // media + thumbnail role queries both return the stub row
            expect(references[0].uuid).toBe('a676c5bb');
        });
    });
});
