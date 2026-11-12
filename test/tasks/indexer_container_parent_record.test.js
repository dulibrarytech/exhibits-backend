'use strict';

jest.mock('../../libs/log4', () => {
    const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    };
    return {
        module: jest.fn(() => mockLogger)
    };
});

const {reindex_container_parent_record, construct_grid_index_record} = require('../../indexer/indexer_helper');

describe('reindex_container_parent_record (a grid\'s own settings)', () => {

    const EXHIBIT_ID = '550e8400-e29b-41d4-a716-446655440000';
    const GRID_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    const OTHER_GRID_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const ITEM_ONE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const ITEM_TWO = '9b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';
    const ITEM_NOT_PUBLIC = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

    const INDEXED_ITEMS = [
        {uuid: ITEM_ONE, order: 1, text: 'One', is_published: 1},
        {uuid: ITEM_TWO, order: 2, text: 'Two', is_published: 1}
    ];

    const stored_grid = () => ({
        uuid: GRID_ID,
        is_member_of_exhibit: EXHIBIT_ID,
        type: 'grid',
        columns: 3,
        text: '<p>New text</p>',
        styles: 'item2',
        order: 4,
        is_published: 1,
        created: '2026-01-01T00:00:00Z',
        margins: 'large',
        text_alignment: 'center',
        internal_name: 'Staff only'
    });

    const arrange = (options = {}) => {
        const record_task = {
            get_grid_record: jest.fn().mockResolvedValue('record' in options ? options.record : stored_grid()),
            get_grid_records: jest.fn(),
            get_grid_item_records: jest.fn().mockResolvedValue(options.stored_items ?? []),
            set_grid_item_to_publish: jest.fn()
        };
        const get_indexed_record = jest.fn().mockResolvedValue(options.indexed ?? {
            status: 200,
            data: {source: {uuid: GRID_ID, type: 'grid', columns: 2, text: '<p>Old text</p>', items: INDEXED_ITEMS}}
        });
        const state = {source: null};
        const index_record = jest.fn(async (source) => {
            state.source = source;
            return options.index_result ?? true;
        });
        const run = (parent_id = GRID_ID) => reindex_container_parent_record({
            exhibit_id: EXHIBIT_ID,
            parent_id,
            record_task,
            get_record_method: 'get_grid_record',
            ...(options.stored_items ? {get_items_method: 'get_grid_item_records'} : {}),
            construct_parent: construct_grid_index_record,
            label: 'Grid',
            get_indexed_record,
            index_record
        });

        return {record_task, get_indexed_record, index_record, state, run};
    };

    test('writes the saved settings and keeps the items already in the index', async () => {
        const {state, run} = arrange();

        expect(await run()).toBe(true);
        expect(state.source).toMatchObject({
            uuid: GRID_ID,
            is_member_of_exhibit: EXHIBIT_ID,
            type: 'grid',
            columns: 3,
            text: '<p>New text</p>',
            styles: 'item2',
            margins: 'large',
            text_alignment: 'center',
            is_published: 1
        });
        expect(state.source.items).toEqual(INDEXED_ITEMS);
        expect(state.source).not.toHaveProperty('internal_name');
    });

    test('reads the one grid by exhibit and grid id, never the exhibit\'s list of grids', async () => {
        const {record_task, get_indexed_record, run} = arrange();

        await run();

        expect(record_task.get_grid_record).toHaveBeenCalledTimes(1);
        expect(record_task.get_grid_record).toHaveBeenCalledWith(EXHIBIT_ID, GRID_ID);
        expect(record_task.get_grid_records).not.toHaveBeenCalled();
        expect(get_indexed_record).toHaveBeenCalledWith(GRID_ID);
    });

    test('writes nothing when it is handed a different grid\'s record', async () => {
        const {get_indexed_record, index_record, run} = arrange({record: {...stored_grid(), uuid: OTHER_GRID_ID}});

        expect(await run()).toBe(false);
        expect(get_indexed_record).not.toHaveBeenCalled();
        expect(index_record).not.toHaveBeenCalled();
    });

    test('writes nothing when it is handed a list of grids', async () => {
        const {index_record, run} = arrange({record: [{...stored_grid(), uuid: OTHER_GRID_ID}, stored_grid()]});

        expect(await run()).toBe(false);
        expect(index_record).not.toHaveBeenCalled();
    });

    test('reads no items and publishes none when it is given no item reader', async () => {
        const {record_task, run} = arrange();

        await run();

        expect(record_task.get_grid_item_records).not.toHaveBeenCalled();
        expect(record_task.set_grid_item_to_publish).not.toHaveBeenCalled();
    });

    test('leaves an unpublished grid alone and reports nothing wrong', async () => {
        const {get_indexed_record, index_record, run} = arrange({record: {...stored_grid(), is_published: 0}});

        expect(await run()).toBe(true);
        expect(get_indexed_record).not.toHaveBeenCalled();
        expect(index_record).not.toHaveBeenCalled();
    });

    test('puts the public items in their stored order, without adding or publishing any', async () => {
        const {record_task, state, run} = arrange({
            stored_items: [
                {uuid: ITEM_TWO, order: 1, is_published: 1},
                {uuid: ITEM_ONE, order: 2, is_published: 1},
                {uuid: ITEM_NOT_PUBLIC, order: 3, is_published: 0}
            ]
        });

        expect(await run()).toBe(true);
        expect(record_task.get_grid_item_records).toHaveBeenCalledWith(EXHIBIT_ID, GRID_ID);
        expect(state.source.items).toEqual([
            {uuid: ITEM_TWO, order: 1, text: 'Two', is_published: 1},
            {uuid: ITEM_ONE, order: 2, text: 'One', is_published: 1}
        ]);
        expect(record_task.set_grid_item_to_publish).not.toHaveBeenCalled();
    });

    test('keeps a public item that has no stored row where it was', async () => {
        const {state, run} = arrange({stored_items: [{uuid: ITEM_TWO, order: 5, is_published: 1}]});

        expect(await run()).toBe(true);
        expect(state.source.items).toEqual([
            {uuid: ITEM_ONE, order: 1, text: 'One', is_published: 1},
            {uuid: ITEM_TWO, order: 5, text: 'Two', is_published: 1}
        ]);
    });

    test('keeps an empty item list empty', async () => {
        const {state, run} = arrange({
            indexed: {status: 200, data: {source: {uuid: GRID_ID, type: 'grid', columns: 2}}}
        });

        expect(await run()).toBe(true);
        expect(state.source.items).toEqual([]);
    });

    test('writes nothing when the grid is not in the index', async () => {
        const {index_record, run} = arrange({indexed: {status: 404, message: 'Record not found'}});

        expect(await run()).toBe(false);
        expect(index_record).not.toHaveBeenCalled();
    });

    test('writes nothing when the grid record is gone', async () => {
        const {get_indexed_record, index_record, run} = arrange({record: null});

        expect(await run()).toBe(false);
        expect(get_indexed_record).not.toHaveBeenCalled();
        expect(index_record).not.toHaveBeenCalled();
    });

    test('reports a write the index refused', async () => {
        const {run} = arrange({index_result: false});

        expect(await run()).toBe(false);
    });

    test('refuses an id that is not a uuid before reading anything', async () => {
        const {record_task, run} = arrange();

        expect(await run('not-a-uuid')).toBe(false);
        expect(record_task.get_grid_record).not.toHaveBeenCalled();
    });
});
