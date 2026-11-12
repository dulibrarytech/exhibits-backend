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

const {index_container_records, construct_grid_index_record} = require('../../indexer/indexer_helper');

describe('index_container_records (publishing one grid of an exhibit)', () => {

    const EXHIBIT_ID = '550e8400-e29b-41d4-a716-446655440000';
    const FIRST_GRID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const SECOND_GRID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const MISSING_GRID = '9b2c3d4e-5f60-4a71-8b92-c3d4e5f60718';

    const grid = (uuid, order) => ({
        uuid,
        is_member_of_exhibit: EXHIBIT_ID,
        type: 'grid',
        columns: 2,
        order,
        is_published: 1
    });

    const item_id = (grid_id, position) => `${position}${grid_id.slice(1)}`;

    const item_of = (grid_id, position) => ({
        uuid: item_id(grid_id, position),
        is_member_of_exhibit: EXHIBIT_ID,
        is_member_of_grid: grid_id,
        item_type: 'text',
        text: `Item ${position}`,
        order: position,
        is_published: 0
    });

    const arrange = (options = {}) => {
        const record_task = {
            get_grid_records: jest.fn().mockResolvedValue(options.grids ?? [grid(FIRST_GRID, 1), grid(SECOND_GRID, 2)]),
            get_grid_item_records: jest.fn(async (exhibit_id, grid_id) => [item_of(grid_id, 1), item_of(grid_id, 2)]),
            set_grid_item_to_publish: jest.fn().mockResolvedValue(true)
        };
        const indexed = [];
        const index_tasks = {
            index_record: jest.fn(async (record) => {
                indexed.push(record);
                return {success: true};
            })
        };
        const run = (container_id = null) => index_container_records({
            exhibit_id: EXHIBIT_ID,
            container_id,
            record_task,
            get_records_method: 'get_grid_records',
            get_items_method: 'get_grid_item_records',
            set_publish_method: 'set_grid_item_to_publish',
            construct_parent: construct_grid_index_record,
            index_tasks,
            label: 'Grid'
        });

        return {record_task, indexed, run};
    };

    const published_item_ids = (record_task) => {
        return record_task.set_grid_item_to_publish.mock.calls.map(([uuid]) => uuid).sort();
    };

    test('indexes the one grid it is asked for and publishes only that grid\'s items', async () => {
        const {record_task, indexed, run} = arrange();

        expect(await run(SECOND_GRID)).toBe(true);
        expect(indexed.map((record) => record.uuid)).toEqual([SECOND_GRID]);
        expect(indexed[0].items.map((item) => item.is_published)).toEqual([1, 1]);
        expect(record_task.get_grid_item_records).toHaveBeenCalledTimes(1);
        expect(record_task.get_grid_item_records).toHaveBeenCalledWith(EXHIBIT_ID, SECOND_GRID);
        expect(published_item_ids(record_task)).toEqual([item_id(SECOND_GRID, 1), item_id(SECOND_GRID, 2)].sort());
    });

    test('indexes every grid of the exhibit when no grid is named', async () => {
        const {record_task, indexed, run} = arrange();

        expect(await run()).toBe(true);
        expect(indexed.map((record) => record.uuid).sort()).toEqual([FIRST_GRID, SECOND_GRID].sort());
        expect(record_task.set_grid_item_to_publish).toHaveBeenCalledTimes(4);
    });

    test('fails and indexes nothing when the named grid is not in the exhibit', async () => {
        const {record_task, indexed, run} = arrange();

        expect(await run(MISSING_GRID)).toBe(false);
        expect(indexed).toEqual([]);
        expect(record_task.get_grid_item_records).not.toHaveBeenCalled();
        expect(record_task.set_grid_item_to_publish).not.toHaveBeenCalled();
    });

    test('an exhibit with no grids is not a failure when no grid is named', async () => {
        const {indexed, run} = arrange({grids: []});

        expect(await run()).toBe(true);
        expect(indexed).toEqual([]);
    });
});
