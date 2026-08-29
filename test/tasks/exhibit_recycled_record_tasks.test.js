/**
 * Unit Tests for Recycled Record Tasks
 *
 * The recycle task layer performs PERMANENT deletion, so these tests pin
 * its safety invariants: every read/write is scoped to `is_deleted = 1`
 * (a live record can never be hard-deleted or "restored" through this
 * path), owner scoping is applied only when a created_by is given, and
 * database errors propagate to the model instead of being swallowed.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const Recycled_record_tasks = require('../../exhibits/tasks/exhibit_recycled_record_tasks');

jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

describe('Recycled_record_tasks', () => {
    let mockDB;
    let mockQuery;
    let tasks;

    const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
    const TEST_OWNER = 'owner-du-id';

    const TABLES = {
        exhibit_records: 'tbl_exhibits',
        heading_records: 'tbl_heading_items',
        item_records: 'tbl_standard_items',
        grid_records: 'tbl_grids',
        timeline_records: 'tbl_timelines'
    };

    const createMockQuery = () => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        timeout: jest.fn().mockResolvedValue([])
    });

    beforeEach(() => {
        mockQuery = createMockQuery();
        mockDB = jest.fn(() => mockQuery);
        tasks = new Recycled_record_tasks(mockDB, TABLES);
    });

    // ==================== READS ====================

    describe('recycled-record reads', () => {

        const READ_CASES = [
            ['get_recycled_exhibit_records', 'tbl_exhibits', 'exhibit'],
            ['get_recycled_heading_records', 'tbl_heading_items', 'heading'],
            ['get_recycled_item_records', 'tbl_standard_items', 'item'],
            ['get_recycled_grid_records', 'tbl_grids', 'grid'],
            ['get_recycled_timeline_records', 'tbl_timelines', 'timeline']
        ];

        test.each(READ_CASES)('%s reads only is_deleted rows from %s and tags them "%s"', async (method, table, type) => {
            mockQuery.timeout.mockResolvedValue([{ uuid: TEST_UUID, is_deleted: 1 }]);

            const rows = await tasks[method]();

            expect(mockDB).toHaveBeenCalledWith(table);
            expect(mockQuery.where).toHaveBeenCalledWith({ is_deleted: 1 });
            expect(mockQuery.andWhere).not.toHaveBeenCalled();
            expect(rows).toEqual([{ uuid: TEST_UUID, is_deleted: 1, type }]);
        });

        test('owner scoping is applied when created_by is provided', async () => {
            await tasks.get_recycled_exhibit_records(TEST_OWNER);

            expect(mockQuery.where).toHaveBeenCalledWith({ is_deleted: 1 });
            expect(mockQuery.andWhere).toHaveBeenCalledWith('created_by', TEST_OWNER);
        });

        test('read queries carry the query timeout', async () => {
            await tasks.get_recycled_exhibit_records();

            expect(mockQuery.timeout).toHaveBeenCalledWith(tasks.QUERY_TIMEOUT);
        });

        test('database errors propagate instead of being swallowed', async () => {
            mockQuery.timeout.mockRejectedValue(new Error('connection lost'));

            await expect(tasks.get_recycled_exhibit_records()).rejects.toThrow('connection lost');
        });
    });

    // ==================== PERMANENT DELETE ====================

    describe('delete_recycled_record', () => {

        test('scopes the hard delete to is_deleted = 1 so a live record cannot be deleted', async () => {
            mockQuery.timeout.mockResolvedValue(1);

            const affected = await tasks.delete_recycled_record('tbl_exhibits', TEST_UUID);

            expect(mockDB).toHaveBeenCalledWith('tbl_exhibits');
            expect(mockQuery.where).toHaveBeenCalledWith({ uuid: TEST_UUID, is_deleted: 1 });
            expect(mockQuery.delete).toHaveBeenCalled();
            expect(affected).toBe(1);
        });

        test('returns 0 affected rows when nothing matched', async () => {
            mockQuery.timeout.mockResolvedValue(0);

            const affected = await tasks.delete_recycled_record('tbl_exhibits', TEST_UUID);

            expect(affected).toBe(0);
        });

        test('database errors propagate', async () => {
            mockQuery.timeout.mockRejectedValue(new Error('deadlock'));

            await expect(tasks.delete_recycled_record('tbl_exhibits', TEST_UUID)).rejects.toThrow('deadlock');
        });
    });

    describe('delete_all_recycled_records', () => {

        test('deletes only is_deleted rows across the whole table when unscoped', async () => {
            mockQuery.timeout.mockResolvedValue(3);

            const affected = await tasks.delete_all_recycled_records('tbl_exhibits');

            expect(mockQuery.where).toHaveBeenCalledWith({ is_deleted: 1 });
            expect(mockQuery.andWhere).not.toHaveBeenCalled();
            expect(mockQuery.delete).toHaveBeenCalled();
            expect(affected).toBe(3);
        });

        test('owner scoping restricts the purge to that owner', async () => {
            mockQuery.timeout.mockResolvedValue(1);

            await tasks.delete_all_recycled_records('tbl_exhibits', TEST_OWNER);

            expect(mockQuery.where).toHaveBeenCalledWith({ is_deleted: 1 });
            expect(mockQuery.andWhere).toHaveBeenCalledWith('created_by', TEST_OWNER);
        });

        test('database errors propagate', async () => {
            mockQuery.timeout.mockRejectedValue(new Error('lock wait timeout'));

            await expect(tasks.delete_all_recycled_records('tbl_exhibits')).rejects.toThrow('lock wait timeout');
        });
    });

    // ==================== RESTORE ====================

    describe('restore_recycled_record', () => {

        test('clears is_deleted on the matching recycled row only', async () => {
            mockQuery.timeout.mockResolvedValue(1);

            const affected = await tasks.restore_recycled_record('tbl_grids', TEST_UUID);

            expect(mockDB).toHaveBeenCalledWith('tbl_grids');
            expect(mockQuery.where).toHaveBeenCalledWith({ uuid: TEST_UUID, is_deleted: 1 });
            expect(mockQuery.update).toHaveBeenCalledWith({ is_deleted: 0 });
            expect(affected).toBe(1);
        });

        test('returns 0 affected rows when the record is not recycled', async () => {
            mockQuery.timeout.mockResolvedValue(0);

            const affected = await tasks.restore_recycled_record('tbl_grids', TEST_UUID);

            expect(affected).toBe(0);
        });

        test('database errors propagate', async () => {
            mockQuery.timeout.mockRejectedValue(new Error('server gone away'));

            await expect(tasks.restore_recycled_record('tbl_grids', TEST_UUID)).rejects.toThrow('server gone away');
        });
    });
});
