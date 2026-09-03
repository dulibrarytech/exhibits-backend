/**
 * Integration Tests for Recycle Model
 *
 * Tests the model layer that orchestrates the recycle-bin task class:
 * type-to-table resolution, owner scoping pass-through, cross-type
 * aggregation, and the 400/404/500 contracts. The task layer itself is
 * unit-tested in test/tasks/exhibit_recycled_record_tasks.test.js; here
 * it is mocked. recycle_route.test.js covers the auth gates above this.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_OWNER = 'owner-du-id';
const EXHIBIT_UUID = '770e8400-e29b-41d4-a716-446655440002';

jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('../../config/db_config', () => () => jest.fn());

jest.mock('../../config/db_tables_config', () => () => ({
    exhibits: {
        exhibit_records: 'tbl_exhibits',
        heading_records: 'tbl_heading_items',
        item_records: 'tbl_standard_items',
        grid_records: 'tbl_grids',
        timeline_records: 'tbl_timelines'
    }
}));

const mockRecycledTasks = {
    get_recycled_exhibit_records: jest.fn().mockResolvedValue([]),
    get_recycled_heading_records: jest.fn().mockResolvedValue([]),
    get_recycled_item_records: jest.fn().mockResolvedValue([]),
    get_recycled_grid_records: jest.fn().mockResolvedValue([]),
    get_recycled_timeline_records: jest.fn().mockResolvedValue([]),
    delete_recycled_record: jest.fn(),
    delete_all_recycled_records: jest.fn(),
    restore_recycled_record: jest.fn()
};

jest.mock('../../exhibits/tasks/exhibit_recycled_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockRecycledTasks);
});

const RECYCLE_MODEL = require('../../exhibits/recycle_model');

describe('Recycle Model', () => {

    beforeEach(() => {
        jest.clearAllMocks();

        mockRecycledTasks.get_recycled_exhibit_records.mockResolvedValue([]);
        mockRecycledTasks.get_recycled_heading_records.mockResolvedValue([]);
        mockRecycledTasks.get_recycled_item_records.mockResolvedValue([]);
        mockRecycledTasks.get_recycled_grid_records.mockResolvedValue([]);
        mockRecycledTasks.get_recycled_timeline_records.mockResolvedValue([]);
    });

    // ==================== LIST ====================

    describe('get_recycled_records', () => {

        test('aggregates all five record types into one list', async () => {
            mockRecycledTasks.get_recycled_exhibit_records.mockResolvedValue([{ uuid: 'e1', type: 'exhibit' }]);
            mockRecycledTasks.get_recycled_item_records.mockResolvedValue([{ uuid: 'i1', type: 'item' }]);
            mockRecycledTasks.get_recycled_timeline_records.mockResolvedValue([{ uuid: 't1', type: 'timeline' }]);

            const result = await RECYCLE_MODEL.get_recycled_records();

            expect(result.status).toBe(200);
            expect(result.data.map((r) => r.uuid)).toEqual(['e1', 'i1', 't1']);
        });

        test('passes owner scoping through to every task read', async () => {
            await RECYCLE_MODEL.get_recycled_records(TEST_OWNER);

            expect(mockRecycledTasks.get_recycled_exhibit_records).toHaveBeenCalledWith(TEST_OWNER);
            expect(mockRecycledTasks.get_recycled_heading_records).toHaveBeenCalledWith(TEST_OWNER);
            expect(mockRecycledTasks.get_recycled_item_records).toHaveBeenCalledWith(TEST_OWNER);
            expect(mockRecycledTasks.get_recycled_grid_records).toHaveBeenCalledWith(TEST_OWNER);
            expect(mockRecycledTasks.get_recycled_timeline_records).toHaveBeenCalledWith(TEST_OWNER);
        });

        test('defaults to an unscoped (all-owners) read', async () => {
            await RECYCLE_MODEL.get_recycled_records();

            expect(mockRecycledTasks.get_recycled_exhibit_records).toHaveBeenCalledWith(null);
        });

        test('returns 500 with an empty list when any read fails', async () => {
            mockRecycledTasks.get_recycled_grid_records.mockRejectedValue(new Error('db down'));

            const result = await RECYCLE_MODEL.get_recycled_records();

            expect(result.status).toBe(500);
            expect(result.data).toEqual([]);
        });
    });

    // ==================== SINGLE DELETE ====================

    describe('delete_recycled_record', () => {

        test('resolves the type to its physical table', async () => {
            mockRecycledTasks.delete_recycled_record.mockResolvedValue(1);

            const result = await RECYCLE_MODEL.delete_recycled_record('grid', TEST_UUID, EXHIBIT_UUID);

            expect(result.status).toBe(200);
            expect(mockRecycledTasks.delete_recycled_record).toHaveBeenCalledWith('tbl_grids', TEST_UUID, { is_member_of_exhibit: EXHIBIT_UUID });
        });

        test('rejects an unknown type with 400 and never touches the task layer', async () => {
            const result = await RECYCLE_MODEL.delete_recycled_record('users', TEST_UUID);

            expect(result.status).toBe(400);
            expect(mockRecycledTasks.delete_recycled_record).not.toHaveBeenCalled();
        });

        test('returns 404 when no recycled row matched', async () => {
            mockRecycledTasks.delete_recycled_record.mockResolvedValue(0);

            const result = await RECYCLE_MODEL.delete_recycled_record('exhibit', TEST_UUID);

            expect(result.status).toBe(404);
        });

        test('returns 500 when the task layer throws — a failed delete is never reported as success', async () => {
            mockRecycledTasks.delete_recycled_record.mockRejectedValue(new Error('deadlock'));

            const result = await RECYCLE_MODEL.delete_recycled_record('exhibit', TEST_UUID);

            expect(result.status).toBe(500);
        });
    });

    // ==================== EMPTY BIN ====================

    describe('delete_all_recycled_records', () => {

        test('purges every record-type table and sums the affected rows', async () => {
            mockRecycledTasks.delete_all_recycled_records.mockResolvedValue(2);

            const result = await RECYCLE_MODEL.delete_all_recycled_records();

            expect(result.status).toBe(200);
            expect(result.deleted).toBe(10);
            const tables = mockRecycledTasks.delete_all_recycled_records.mock.calls.map((c) => c[0]);
            expect(tables).toEqual(['tbl_exhibits', 'tbl_heading_items', 'tbl_standard_items', 'tbl_grids', 'tbl_timelines']);
        });

        test('passes owner scoping through to every table purge', async () => {
            mockRecycledTasks.delete_all_recycled_records.mockResolvedValue(0);

            await RECYCLE_MODEL.delete_all_recycled_records(TEST_OWNER);

            for (const call of mockRecycledTasks.delete_all_recycled_records.mock.calls) {
                expect(call[1]).toBe(TEST_OWNER);
            }
        });

        test('returns 500 when any table purge fails', async () => {
            mockRecycledTasks.delete_all_recycled_records
                .mockResolvedValueOnce(1)
                .mockRejectedValueOnce(new Error('lock wait timeout'));

            const result = await RECYCLE_MODEL.delete_all_recycled_records();

            expect(result.status).toBe(500);
        });
    });

    // ==================== RESTORE ====================

    describe('restore_recycled_record', () => {

        test('resolves the type to its physical table', async () => {
            mockRecycledTasks.restore_recycled_record.mockResolvedValue(1);

            const result = await RECYCLE_MODEL.restore_recycled_record('timeline', TEST_UUID, EXHIBIT_UUID);

            expect(result.status).toBe(200);
            expect(mockRecycledTasks.restore_recycled_record).toHaveBeenCalledWith('tbl_timelines', TEST_UUID, { is_member_of_exhibit: EXHIBIT_UUID });
        });

        test('rejects an unknown type with 400', async () => {
            const result = await RECYCLE_MODEL.restore_recycled_record('nope', TEST_UUID);

            expect(result.status).toBe(400);
            expect(mockRecycledTasks.restore_recycled_record).not.toHaveBeenCalled();
        });

        test('returns 404 when no recycled row matched', async () => {
            mockRecycledTasks.restore_recycled_record.mockResolvedValue(0);

            const result = await RECYCLE_MODEL.restore_recycled_record('item', TEST_UUID, EXHIBIT_UUID);

            expect(result.status).toBe(404);
        });

        test('returns 500 when the task layer throws', async () => {
            mockRecycledTasks.restore_recycled_record.mockRejectedValue(new Error('db down'));

            const result = await RECYCLE_MODEL.restore_recycled_record('item', TEST_UUID, EXHIBIT_UUID);

            expect(result.status).toBe(500);
        });
    });
    /*
     * H3 (code review 2026-09-02): a per-record recycle op is confined to the
     * exhibit named in the request; the model derives the task scope from it.
     */
    describe('per-record scope (H3)', () => {

        test('a child type without an exhibit id is refused with 404 before the task runs', async () => {
            const result = await RECYCLE_MODEL.delete_recycled_record('item', TEST_UUID);

            expect(result.status).toBe(404);
            expect(mockRecycledTasks.delete_recycled_record).not.toHaveBeenCalled();
        });

        test('an exhibit row is only reachable under its own uuid', async () => {
            const mismatch = await RECYCLE_MODEL.restore_recycled_record('exhibit', TEST_UUID, EXHIBIT_UUID);
            expect(mismatch.status).toBe(404);
            expect(mockRecycledTasks.restore_recycled_record).not.toHaveBeenCalled();

            mockRecycledTasks.restore_recycled_record.mockResolvedValue(1);
            const ok = await RECYCLE_MODEL.restore_recycled_record('exhibit', TEST_UUID, TEST_UUID);
            expect(ok.status).toBe(200);
            expect(mockRecycledTasks.restore_recycled_record).toHaveBeenCalledWith('tbl_exhibits', TEST_UUID, {});
        });

        test('the exhibit scope reaches the task as is_member_of_exhibit', async () => {
            mockRecycledTasks.delete_recycled_record.mockResolvedValue(0);

            const result = await RECYCLE_MODEL.delete_recycled_record('heading', TEST_UUID, EXHIBIT_UUID);

            expect(result.status).toBe(404);
            expect(mockRecycledTasks.delete_recycled_record).toHaveBeenCalledWith('tbl_heading_items', TEST_UUID, { is_member_of_exhibit: EXHIBIT_UUID });
        });
    });
});
