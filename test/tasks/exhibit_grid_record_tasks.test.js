/**
 * Unit tests for Exhibit_grid_record_tasks
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const Exhibit_grid_record_tasks = require('../../exhibits/tasks/exhibit_grid_record_tasks');

// Mock dependencies - MUST be identical across all test files to avoid conflicts
jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('../../libs/helper');

///

// Mock dependencies - silence all logging during tests
/*
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

 */
///

afterAll(async () => {
    // Allow any pending async operations to complete
    await new Promise(resolve => setImmediate(resolve));
});

describe('Exhibit_grid_record_tasks', () => {
    let mockDB;
    let mockTABLE;
    let mockQuery;
    let gridTasks;
    const exhibitUUID = '550e8400-e29b-41d4-a716-446655440000';
    const gridUUID = '660e8400-e29b-41d4-a716-446655440000';

    // Helper to create fresh mock query with proper chaining
    // Source code uses .timeout() on queries, so we need timeout to return a promise
    const createMockQuery = () => {
        const query = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            timeout: jest.fn().mockResolvedValue(null),
            count: jest.fn().mockReturnThis()
        };
        return query;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        mockQuery = createMockQuery();

        mockDB = jest.fn(() => mockQuery);
        mockDB.fn = { now: jest.fn(() => 'NOW()') };

        mockTABLE = {
            exhibit_records: 'tbl_exhibit_records',
            grid_records: 'tbl_grid_records',
            grid_item_records: 'tbl_grid_item_records'
        };

        gridTasks = new Exhibit_grid_record_tasks(mockDB, mockTABLE);
    });

    // ==================== CONSTRUCTOR TESTS ====================
    describe('Constructor', () => {
        test('should initialize with correct properties', () => {
            expect(gridTasks.DB).toBe(mockDB);
            expect(gridTasks.TABLE).toBe(mockTABLE);
            expect(gridTasks.UUID_REGEX).toBeDefined();
        });

        test('should have valid UUID regex pattern', () => {
            expect(gridTasks.UUID_REGEX.test(exhibitUUID)).toBe(true);
            expect(gridTasks.UUID_REGEX.test('invalid')).toBe(false);
        });
    });

    // ==================== VALIDATION HELPER TESTS ====================
    describe('Validation Helpers', () => {
        describe('_validate_database', () => {
            test('should not throw error for valid database connection', () => {
                expect(() => gridTasks._validate_database()).not.toThrow();
            });

            test('should throw error when DB is null', () => {
                gridTasks.DB = null;
                expect(() => gridTasks._validate_database()).toThrow('Database connection is not available');
            });

            test('should throw error when DB is not a function', () => {
                gridTasks.DB = 'not a function';
                expect(() => gridTasks._validate_database()).toThrow('Database connection is not available');
            });
        });

        describe('_validate_table', () => {
            test('should not throw error for valid table name', () => {
                expect(() => gridTasks._validate_table('grid_records')).not.toThrow();
            });

            test('should throw error for undefined table', () => {
                expect(() => gridTasks._validate_table('nonexistent_table'))
                    .toThrow('Table name "nonexistent_table" is not defined');
            });
        });

        describe('_validate_uuid', () => {
            test('should return trimmed UUID for valid input', () => {
                const result = gridTasks._validate_uuid('  ' + gridUUID + '  ');
                expect(result).toBe(gridUUID);
            });

            test('should throw error for empty string', () => {
                expect(() => gridTasks._validate_uuid('')).toThrow('Valid UUID is required');
            });

            test('should throw error for invalid UUID format', () => {
                expect(() => gridTasks._validate_uuid('invalid-uuid')).toThrow('Invalid UUID format');
            });

            test('should use custom field name in error message', () => {
                expect(() => gridTasks._validate_uuid('', 'grid UUID'))
                    .toThrow('Valid grid UUID is required');
            });
        });

        describe('_validate_uuids', () => {
            test('should validate multiple UUIDs', () => {
                const result = gridTasks._validate_uuids({
                    [gridUUID]: 'grid UUID',
                    [exhibitUUID]: 'exhibit UUID'
                });
                expect(result['grid UUID']).toBe(gridUUID);
                expect(result['exhibit UUID']).toBe(exhibitUUID);
            });

            test('should throw error if any UUID is invalid', () => {
                expect(() => gridTasks._validate_uuids({
                    'invalid': 'exhibit UUID'
                })).toThrow();
            });
        });

        describe('_validate_string', () => {
            test('should return trimmed string for valid input', () => {
                const result = gridTasks._validate_string('  test  ', 'field');
                expect(result).toBe('test');
            });

            test('should throw error for empty string', () => {
                expect(() => gridTasks._validate_string('', 'field')).toThrow('Valid field is required');
            });

            test('should throw error for null', () => {
                expect(() => gridTasks._validate_string(null, 'field')).toThrow('Valid field is required');
            });
        });

        describe('_validate_data_object', () => {
            test('should not throw for valid object', () => {
                expect(() => gridTasks._validate_data_object({ columns: 3 })).not.toThrow();
            });

            test('should throw error for null', () => {
                expect(() => gridTasks._validate_data_object(null)).toThrow('Data must be a valid object');
            });

            test('should throw error for array', () => {
                expect(() => gridTasks._validate_data_object([])).toThrow('Data must be a valid object');
            });

            test('should throw error for empty object', () => {
                expect(() => gridTasks._validate_data_object({})).toThrow('Data object cannot be empty');
            });
        });

        describe('_sanitize_data', () => {
            test('should only include allowed fields', () => {
                const data = {
                    columns: 3,
                    invalid_field: 'should be removed'
                };
                const result = gridTasks._sanitize_data(data, ['columns']);
                expect(result.sanitized_data).toHaveProperty('columns');
                expect(result.sanitized_data).not.toHaveProperty('invalid_field');
            });

            test('should skip specified fields', () => {
                const data = { columns: 3, uuid: 'should-skip' };
                const result = gridTasks._sanitize_data(data, ['columns', 'uuid'], ['uuid']);
                expect(result.sanitized_data).not.toHaveProperty('uuid');
            });

            test('should prevent prototype pollution', () => {
                const data = { __proto__: { malicious: true }, columns: 3 };
                const result = gridTasks._sanitize_data(data, ['columns']);
                // Check that __proto__ is not an own property (Object.keys only returns own properties)
                expect(Object.keys(result.sanitized_data)).not.toContain('__proto__');
            });

            test('should return invalid fields list', () => {
                const data = { columns: 3, invalid_field: 'value' };
                const result = gridTasks._sanitize_data(data, ['columns']);
                expect(result.invalid_fields).toContain('invalid_field');
            });
        });

        describe('_set_grid_defaults', () => {
            test('should set default values for missing fields', () => {
                const data = { title: 'Test Grid' };
                gridTasks._set_grid_defaults(data);
                expect(data.type).toBe('grid');
                expect(data.columns).toBe(4);
                expect(data.order).toBe(0);
            });

            test('should not override existing values', () => {
                const data = { title: 'Test', columns: 5 };
                gridTasks._set_grid_defaults(data);
                expect(data.columns).toBe(5);
            });

            test('should set all expected default fields', () => {
                const data = {};
                gridTasks._set_grid_defaults(data);
                expect(data.type).toBe('grid');
                expect(data.columns).toBe(4);
                expect(data.order).toBe(0);
                expect(data.is_published).toBe(0);
                expect(data.is_deleted).toBe(0);
                expect(data.owner).toBe(0);
            });
        });

        describe('_set_grid_item_defaults', () => {
            test('should set default values for grid item fields', () => {
                const data = { title: 'Test Grid Item' };
                gridTasks._set_grid_item_defaults(data);
                expect(data.item_type).toBe('image');
                expect(data.type).toBe('item');
            });

            test('does not default margins/text_alignment (grid item table does not carry them)', () => {
                const data = {};
                gridTasks._set_grid_item_defaults(data);
                expect(data.margins).toBeUndefined();
                expect(data.text_alignment).toBeUndefined();
            });

            test('should not override existing grid item values', () => {
                const data = { title: 'Test', order: 10 };
                gridTasks._set_grid_item_defaults(data);
                expect(data.order).toBe(10);
            });
        });
    });

    // ==================== _UPDATE_PUBLISH_STATUS TESTS ====================
    describe('_update_publish_status', () => {
        test('should publish records successfully', async () => {
            // First call: count query
            const countQuery = createMockQuery();
            countQuery.count.mockReturnThis();
            countQuery.where.mockReturnThis();
            countQuery.timeout.mockResolvedValue([{ count: 3 }]);

            // Second call: update query
            const updateQuery = createMockQuery();
            updateQuery.where.mockReturnThis();
            updateQuery.update.mockReturnThis();
            updateQuery.timeout.mockResolvedValue(3);

            let callCount = 0;
            mockDB.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return countQuery;
                return updateQuery;
            });

            const result = await gridTasks._update_publish_status(
                'grid_records',
                { is_member_of_exhibit: exhibitUUID },
                1
            );

            expect(result.success).toBe(true);
            expect(result.affected_rows).toBe(3);
        });

        test('should suppress records successfully', async () => {
            const countQuery = createMockQuery();
            countQuery.count.mockReturnThis();
            countQuery.where.mockReturnThis();
            countQuery.timeout.mockResolvedValue([{ count: 2 }]);

            const updateQuery = createMockQuery();
            updateQuery.where.mockReturnThis();
            updateQuery.update.mockReturnThis();
            updateQuery.timeout.mockResolvedValue(2);

            let callCount = 0;
            mockDB.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return countQuery;
                return updateQuery;
            });

            const result = await gridTasks._update_publish_status(
                'grid_records',
                { is_member_of_exhibit: exhibitUUID },
                0
            );

            expect(result.success).toBe(true);
            expect(result.status).toBe('suppressed');
        });

        test('should handle case with no records to update', async () => {
            const countQuery = createMockQuery();
            countQuery.count.mockReturnThis();
            countQuery.where.mockReturnThis();
            countQuery.timeout.mockResolvedValue([{ count: 0 }]);
            mockDB.mockReturnValue(countQuery);

            const result = await gridTasks._update_publish_status(
                'grid_records',
                { is_member_of_exhibit: exhibitUUID },
                1
            );

            expect(result.success).toBe(true);
            expect(result.affected_rows).toBe(0);
            expect(result.total_records).toBe(0);
        });

        test('should include updated_by when provided', async () => {
            const countQuery = createMockQuery();
            countQuery.count.mockReturnThis();
            countQuery.where.mockReturnThis();
            countQuery.timeout.mockResolvedValue([{ count: 1 }]);

            const updateQuery = createMockQuery();
            updateQuery.where.mockReturnThis();
            updateQuery.update.mockReturnThis();
            updateQuery.timeout.mockResolvedValue(1);

            let callCount = 0;
            mockDB.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return countQuery;
                return updateQuery;
            });

            const result = await gridTasks._update_publish_status(
                'grid_records',
                { is_member_of_exhibit: exhibitUUID },
                1,
                'user456'
            );

            expect(result.updated_by).toBe('user456');
        });
    });

    // ==================== GET_RECORD_COUNT TESTS ====================
    describe('get_record_count', () => {
        test('should return correct count', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 5 }]);

            const count = await gridTasks.get_record_count(exhibitUUID);

            expect(count).toBe(5);
        });

        test('should return 0 for no records', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 0 }]);

            const count = await gridTasks.get_record_count(exhibitUUID);
            expect(count).toBe(0);
        });

        test('should return 0 for null result', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(null);

            const count = await gridTasks.get_record_count(exhibitUUID);
            expect(count).toBe(0);
        });

        test('should throw error for invalid UUID', async () => {
            await expect(gridTasks.get_record_count('invalid'))
                .rejects.toThrow('Invalid exhibit UUID format');
        });
    });

    describe('get_grid_item_count', () => {
        test('should return correct count for non-deleted items', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 3 }]);

            const count = await gridTasks.get_grid_item_count(exhibitUUID, gridUUID);

            expect(count).toBe(3);
            expect(mockQuery.where).toHaveBeenCalledWith({
                is_member_of_exhibit: exhibitUUID,
                is_member_of_grid: gridUUID,
                is_deleted: 0
            });
            // No published_only option: no is_published filter
            expect(mockQuery.where).not.toHaveBeenCalledWith({ is_published: 1 });
        });

        test('should filter to published items when published_only is set', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 2 }]);

            const count = await gridTasks.get_grid_item_count(exhibitUUID, gridUUID, { published_only: true });

            expect(count).toBe(2);
            expect(mockQuery.where).toHaveBeenCalledWith({ is_published: 1 });
        });

        test('should return 0 for null result', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(null);

            const count = await gridTasks.get_grid_item_count(exhibitUUID, gridUUID);

            expect(count).toBe(0);
        });

        test('should throw error for invalid UUID', async () => {
            await expect(gridTasks.get_grid_item_count('invalid', gridUUID))
                .rejects.toThrow();
        });
    });

    describe('create_grid_with_items', () => {

        const ITEM_A = '770e8400-e29b-41d4-a716-446655440001';
        const ITEM_B = '770e8400-e29b-41d4-a716-446655440002';
        const ITEM_C = '770e8400-e29b-41d4-a716-446655440003';
        const MEDIA_1 = '880e8400-e29b-41d4-a716-446655440001';
        const MEDIA_2 = '880e8400-e29b-41d4-a716-446655440002';
        const OTHER_EXHIBIT = '990e8400-e29b-41d4-a716-446655440000';

        const TABLE = {
            exhibit_records: 'tbl_exhibits',
            grid_records: 'tbl_grids',
            grid_item_records: 'tbl_grid_items'
        };

        const createRecordingDb = (options = {}) => {

            const log = [];
            const state = { transactions: 0, committed: 0, rolled_back: 0 };

            const respond = (query) => {

                if (options.fail_on && options.fail_on(query)) {
                    throw new Error('Simulated database failure');
                }

                if (query.op === 'insert') {
                    return [1];
                }

                return options.exhibit_found === false ? 0 : 1;
            };

            const makeBuilder = (table, in_transaction) => {
                const query = { table, op: null, where: null, data: null, in_transaction };
                const builder = {
                    where(conditions) { query.where = conditions; return builder; },
                    insert(data) { query.op = 'insert'; query.data = data; return builder; },
                    update(data) { query.op = 'update'; query.data = data; return builder; },
                    timeout() { return builder; },
                    then(resolve, reject) {
                        log.push(query);
                        return new Promise((done) => done(respond(query))).then(resolve, reject);
                    }
                };
                return builder;
            };

            const db = (table) => makeBuilder(table, false);
            db.fn = { now: () => 'NOW()' };
            db.transaction = async (callback) => {
                state.transactions += 1;
                const trx = (table) => makeBuilder(table, true);
                trx.fn = { now: () => 'NOW()' };

                try {
                    const result = await callback(trx);
                    state.committed += 1;
                    return result;
                } catch (error) {
                    state.rolled_back += 1;
                    throw error;
                }
            };

            return { db, log, state };
        };

        const grid_data = () => ({
            uuid: gridUUID,
            is_member_of_exhibit: exhibitUUID,
            internal_name: 'Staff grid name',
            columns: 3,
            order: 5,
            styles: '{}',
            text: '<p>Intro</p>'
        });

        const item_data = () => [
            { uuid: ITEM_A, item_type: 'image', media_uuid: MEDIA_1, thumbnail_media_uuid: MEDIA_2, styles: '{}' },
            { uuid: ITEM_B, item_type: 'text', text: '<p>Text</p>', styles: '{}' },
            { uuid: ITEM_C, item_type: 'content_block', content_type: 'button', text: 'Go', url: 'https://www.du.edu', size: 'small', styles: '{}' }
        ];

        const writes_to = (log, table) => log.filter((query) => query.table === table);

        test('writes the exhibit timestamp, the grid and every item in one transaction', async () => {
            const { db, log, state } = createRecordingDb();
            const tasks = new Exhibit_grid_record_tasks(db, TABLE);

            const result = await tasks.create_grid_with_items(grid_data(), item_data());

            expect(result).toEqual({ success: true, grid_uuid: gridUUID, item_uuids: [ITEM_A, ITEM_B, ITEM_C] });
            expect(state).toEqual({ transactions: 1, committed: 1, rolled_back: 0 });
            expect(log.every((query) => query.in_transaction)).toBe(true);
            expect(log.map((query) => `${query.op} ${query.table}`)).toEqual([
                'update tbl_exhibits',
                'insert tbl_grids',
                'insert tbl_grid_items'
            ]);
            expect(log[0].where).toEqual({ uuid: exhibitUUID, is_deleted: 0 });
        });

        test('numbers the items 1..N in the order given and binds them to the new grid', async () => {
            const { db, log } = createRecordingDb();
            const tasks = new Exhibit_grid_record_tasks(db, TABLE);
            const items = item_data().map((item) => ({
                ...item,
                order: 99,
                is_member_of_grid: OTHER_EXHIBIT,
                is_member_of_exhibit: OTHER_EXHIBIT
            }));

            await tasks.create_grid_with_items(grid_data(), items);

            const [item_insert] = writes_to(log, TABLE.grid_item_records);

            expect(item_insert.data.map((row) => [row.uuid, row.order])).toEqual([[ITEM_A, 1], [ITEM_B, 2], [ITEM_C, 3]]);
            for (const row of item_insert.data) {
                expect(row.is_member_of_grid).toBe(gridUUID);
                expect(row.is_member_of_exhibit).toBe(exhibitUUID);
            }
        });

        test('keeps content block fields and applies the grid item defaults', async () => {
            const { db, log } = createRecordingDb();
            const tasks = new Exhibit_grid_record_tasks(db, TABLE);

            await tasks.create_grid_with_items(grid_data(), item_data());

            const [item_insert] = writes_to(log, TABLE.grid_item_records);

            expect(item_insert.data[2]).toEqual(expect.objectContaining({
                item_type: 'content_block',
                content_type: 'button',
                url: 'https://www.du.edu',
                size: 'small',
                is_published: 0,
                is_deleted: 0
            }));
        });

        test('drops fields outside the grid and grid item whitelists', async () => {
            const { db, log } = createRecordingDb();
            const tasks = new Exhibit_grid_record_tasks(db, TABLE);
            const items = item_data();
            items[1].not_a_column = 'x';

            await tasks.create_grid_with_items({ ...grid_data(), not_a_column: 'x', title: 'x' }, items);

            const [grid_insert] = writes_to(log, TABLE.grid_records);
            const [item_insert] = writes_to(log, TABLE.grid_item_records);

            expect(grid_insert.data).not.toHaveProperty('not_a_column');
            expect(grid_insert.data).not.toHaveProperty('title');
            expect(grid_insert.data).toEqual(expect.objectContaining({ uuid: gridUUID, columns: 3, order: 5, type: 'grid' }));
            expect(item_insert.data[1]).not.toHaveProperty('not_a_column');
        });

        test('rolls back and rethrows when the item insert fails', async () => {
            const { db, log, state } = createRecordingDb({
                fail_on: (query) => query.op === 'insert' && query.table === TABLE.grid_item_records
            });
            const tasks = new Exhibit_grid_record_tasks(db, TABLE);

            await expect(tasks.create_grid_with_items(grid_data(), item_data()))
                .rejects.toThrow('Simulated database failure');

            expect(state).toEqual({ transactions: 1, committed: 0, rolled_back: 1 });
            expect(writes_to(log, TABLE.grid_item_records)).toHaveLength(1);
        });

        test('saves nothing when the exhibit is missing or deleted', async () => {
            const { db, log } = createRecordingDb({ exhibit_found: false });
            const tasks = new Exhibit_grid_record_tasks(db, TABLE);

            const result = await tasks.create_grid_with_items(grid_data(), item_data());

            expect(result).toEqual({ success: false, exhibit_not_found: true });
            expect(log.filter((query) => query.op === 'insert')).toEqual([]);
        });

        test('refuses bad input before opening a transaction', async () => {
            const bad_calls = [
                [grid_data(), []],
                [grid_data(), null],
                [{ ...grid_data(), columns: undefined }, item_data()],
                [{ ...grid_data(), uuid: 'not-a-uuid' }, item_data()],
                [{ ...grid_data(), is_member_of_exhibit: '' }, item_data()],
                [grid_data(), [{ ...item_data()[0], uuid: 'not-a-uuid' }]],
                [grid_data(), [null]]
            ];

            for (const [grid, items] of bad_calls) {
                const { db, log, state } = createRecordingDb();
                const tasks = new Exhibit_grid_record_tasks(db, TABLE);

                await expect(tasks.create_grid_with_items(grid, items)).rejects.toThrow();

                expect(state.transactions).toBe(0);
                expect(log).toEqual([]);
            }
        });
    });

    // ==================== UPDATE_GRID_RECORD TESTS ====================
    describe('update_grid_record', () => {
        test('should successfully update grid record', async () => {
            // Source code: DB(table).where(...).update().timeout()
            // Returns boolean true on success (line 644)
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const data = {
                uuid: gridUUID,
                is_member_of_exhibit: exhibitUUID,
                columns: 4
            };
            const result = await gridTasks.update_grid_record(data);

            // Source returns true (boolean) on success, not {success: true}
            expect(result).toBe(true);
        });

        test('should return false when no rows affected', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(0);

            const data = {
                uuid: gridUUID,
                is_member_of_exhibit: exhibitUUID,
                columns: 3
            };
            const result = await gridTasks.update_grid_record(data);

            // Source returns false when rows_affected === 0 (line 637)
            expect(result).toBe(false);
        });

        test('should return false when no valid fields to update', async () => {
            const data = {
                uuid: gridUUID,
                is_member_of_exhibit: exhibitUUID,
                invalid_field: 'value'  // Not in UPDATABLE_FIELDS
            };
            const result = await gridTasks.update_grid_record(data);

            // Source returns false when sanitized_data is empty (line 623)
            expect(result).toBe(false);
        });

        test('should throw error for invalid UUIDs', async () => {
            const data = {
                uuid: 'invalid',
                is_member_of_exhibit: exhibitUUID,
                columns: 3
            };
            await expect(gridTasks.update_grid_record(data))
                .rejects.toThrow('Invalid grid UUID format');
        });
    });

    // ==================== PUBLISHING METHODS TESTS ====================
    describe('Publishing Methods', () => {
        describe('set_to_publish', () => {
            test('should publish all grids for an exhibit', async () => {
                const countQuery = createMockQuery();
                countQuery.count.mockReturnThis();
                countQuery.where.mockReturnThis();
                countQuery.timeout.mockResolvedValue([{ count: 2 }]);

                const updateQuery = createMockQuery();
                updateQuery.where.mockReturnThis();
                updateQuery.update.mockReturnThis();
                updateQuery.timeout.mockResolvedValue(2);

                let callCount = 0;
                mockDB.mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) return countQuery;
                    return updateQuery;
                });

                const result = await gridTasks.set_to_publish(exhibitUUID);
                expect(result.success).toBe(true);
                expect(result.affected_rows).toBe(2);
            });

            test('should throw error for invalid UUID', async () => {
                // _handle_error throws, doesn't return false
                await expect(gridTasks.set_to_publish('invalid'))
                    .rejects.toThrow('Invalid exhibit UUID format');
            });
        });

        describe('set_grid_to_publish', () => {
            test('should publish single grid', async () => {
                // _update_single_publish_status: select().where().first().timeout()
                // then update().timeout()
                const mockRecord = { id: 1, uuid: gridUUID, title: 'Test', is_published: 0, is_deleted: 0 };

                const selectQuery = createMockQuery();
                selectQuery.select.mockReturnThis();
                selectQuery.where.mockReturnThis();
                selectQuery.first.mockReturnThis();
                selectQuery.timeout.mockResolvedValue(mockRecord);

                const updateQuery = createMockQuery();
                updateQuery.where.mockReturnThis();
                updateQuery.update.mockReturnThis();
                updateQuery.timeout.mockResolvedValue(1);

                let callCount = 0;
                mockDB.mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) return selectQuery;
                    return updateQuery;
                });

                const result = await gridTasks.set_grid_to_publish(gridUUID);
                expect(result.success).toBe(true);
            });

            test('should throw error when record not found', async () => {
                const selectQuery = createMockQuery();
                selectQuery.select.mockReturnThis();
                selectQuery.where.mockReturnThis();
                selectQuery.first.mockReturnThis();
                selectQuery.timeout.mockResolvedValue(null);

                mockDB.mockReturnValue(selectQuery);

                await expect(gridTasks.set_grid_to_publish(gridUUID))
                    .rejects.toThrow('grid_records record not found');
            });
        });

        describe('set_to_suppress', () => {
            test('should suppress all grids for an exhibit', async () => {
                const countQuery = createMockQuery();
                countQuery.count.mockReturnThis();
                countQuery.where.mockReturnThis();
                countQuery.timeout.mockResolvedValue([{ count: 2 }]);

                const updateQuery = createMockQuery();
                updateQuery.where.mockReturnThis();
                updateQuery.update.mockReturnThis();
                updateQuery.timeout.mockResolvedValue(2);

                let callCount = 0;
                mockDB.mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) return countQuery;
                    return updateQuery;
                });

                const result = await gridTasks.set_to_suppress(exhibitUUID);
                expect(result.success).toBe(true);
            });

            test('should throw error for invalid UUID', async () => {
                await expect(gridTasks.set_to_suppress('invalid'))
                    .rejects.toThrow('Invalid exhibit UUID format');
            });
        });

        describe('set_grid_to_suppress', () => {
            test('should suppress single grid', async () => {
                const mockRecord = { id: 1, uuid: gridUUID, title: 'Test', is_published: 1, is_deleted: 0 };

                const selectQuery = createMockQuery();
                selectQuery.select.mockReturnThis();
                selectQuery.where.mockReturnThis();
                selectQuery.first.mockReturnThis();
                selectQuery.timeout.mockResolvedValue(mockRecord);

                const updateQuery = createMockQuery();
                updateQuery.where.mockReturnThis();
                updateQuery.update.mockReturnThis();
                updateQuery.timeout.mockResolvedValue(1);

                let callCount = 0;
                mockDB.mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) return selectQuery;
                    return updateQuery;
                });

                const result = await gridTasks.set_grid_to_suppress(gridUUID);
                expect(result.success).toBe(true);
            });

            test('should throw error when record not found', async () => {
                const selectQuery = createMockQuery();
                selectQuery.select.mockReturnThis();
                selectQuery.where.mockReturnThis();
                selectQuery.first.mockReturnThis();
                selectQuery.timeout.mockResolvedValue(null);

                mockDB.mockReturnValue(selectQuery);

                await expect(gridTasks.set_grid_to_suppress(gridUUID))
                    .rejects.toThrow('grid_records record not found');
            });
        });
    });

    // ==================== REORDER_GRIDS TESTS ====================
    describe('reorder_grids', () => {
        test('should successfully reorder grid', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const grid = { uuid: gridUUID, order: 5 };
            const result = await gridTasks.reorder_grids(exhibitUUID, grid);
            expect(result).toBe(true);
        });

        test('should handle order value of 0', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const grid = { uuid: gridUUID, order: 0 };
            const result = await gridTasks.reorder_grids(exhibitUUID, grid);
            expect(result).toBe(true);
        });

        test('should throw error for invalid exhibit UUID', async () => {
            const grid = { uuid: gridUUID, order: 1 };
            await expect(gridTasks.reorder_grids('invalid', grid))
                .rejects.toThrow('Invalid exhibit UUID format');
        });

        test('should throw error for invalid item object', async () => {
            await expect(gridTasks.reorder_grids(exhibitUUID, null))
                .rejects.toThrow('Valid item object is required');
        });

        test('should throw error when item missing uuid or order', async () => {
            await expect(gridTasks.reorder_grids(exhibitUUID, { uuid: gridUUID }))
                .rejects.toThrow('Item must have uuid and order properties');
        });
    });

    // ==================== ERROR HANDLING TESTS ====================
    describe('Error Handling', () => {
        test('_handle_error should log and rethrow error', () => {
            const error = new Error('Test error');
            expect(() => {
                gridTasks._handle_error(error, 'test_method', { uuid: 'test' });
            }).toThrow('Test error');
        });

        test('should handle database connection errors gracefully', async () => {
            gridTasks.DB = null;
            await expect(gridTasks.get_record_count(exhibitUUID))
                .rejects.toThrow('Database connection is not available');
        });

        test('should handle query errors properly', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockRejectedValue(new Error('Query failed'));

            await expect(gridTasks.get_record_count(exhibitUUID))
                .rejects.toThrow('Query failed');
        });
    });

    // ==================== INTEGRATION TESTS ====================
    describe('Integration Tests', () => {
        test('should handle complete grid workflow', async () => {
            // Step 1: Get record count
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 1 }]);

            const count = await gridTasks.get_record_count(exhibitUUID);
            expect(count).toBe(1);

            // Step 2: Update grid
            mockQuery = createMockQuery();
            mockDB.mockReturnValue(mockQuery);

            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const updateResult = await gridTasks.update_grid_record({
                uuid: gridUUID,
                is_member_of_exhibit: exhibitUUID,
                columns: 4
            });
            expect(updateResult).toBe(true);
        });
    });
});