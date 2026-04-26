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