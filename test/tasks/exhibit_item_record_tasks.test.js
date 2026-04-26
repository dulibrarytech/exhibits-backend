/**
 * Unit tests for Exhibit_item_record_tasks
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const Exhibit_item_record_tasks = require('../../exhibits/tasks/exhibit_item_record_tasks');

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

afterAll(async () => {
    // Allow any pending async operations to complete
    await new Promise(resolve => setImmediate(resolve));
});

describe('Exhibit_item_record_tasks', () => {
    let mockDB;
    let mockTABLE;
    let mockQuery;
    let itemTasks;
    const exhibitUUID = '550e8400-e29b-41d4-a716-446655440000';
    const itemUUID = '660e8400-e29b-41d4-a716-446655440000';

    // Helper to create fresh mock query with full chain support
    // Source code uses .timeout() which returns a promise
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
            count: jest.fn().mockReturnThis(),
            returning: jest.fn().mockReturnThis()
        };
        return query;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        mockQuery = createMockQuery();

        mockDB = jest.fn(() => mockQuery);
        mockDB.fn = { now: jest.fn(() => 'NOW()') };

        // Setup transaction mock that properly provides trx function
        mockDB.transaction = jest.fn(async (callback) => {
            const trxQuery = createMockQuery();
            trxQuery.insert.mockReturnThis();
            trxQuery.timeout.mockResolvedValue([1]);
            trxQuery.select.mockReturnThis();
            trxQuery.where.mockReturnThis();
            trxQuery.first.mockResolvedValue({ id: 1, uuid: itemUUID, item_type: 'item' });

            const trxFn = jest.fn(() => trxQuery);
            return callback(trxFn);
        });

        mockTABLE = {
            exhibit_records: 'tbl_exhibit_records',
            heading_records: 'tbl_heading_records',
            item_records: 'tbl_item_records',
            grid_records: 'tbl_grid_records',
            grid_item_records: 'tbl_grid_item_records',
            timeline_records: 'tbl_timeline_records',
            timeline_item_records: 'tbl_timeline_item_records'
        };

        itemTasks = new Exhibit_item_record_tasks(mockDB, mockTABLE);
    });

    // ==================== CONSTRUCTOR TESTS ====================
    describe('Constructor', () => {
        test('should initialize with correct properties', () => {
            expect(itemTasks.DB).toBe(mockDB);
            expect(itemTasks.TABLE).toBe(mockTABLE);
            expect(itemTasks.UUID_REGEX).toBeDefined();
        });

        test('should have valid UUID regex pattern', () => {
            expect(itemTasks.UUID_REGEX.test(exhibitUUID)).toBe(true);
            expect(itemTasks.UUID_REGEX.test('invalid')).toBe(false);
        });
    });

    // ==================== VALIDATION HELPER TESTS ====================
    describe('Validation Helpers', () => {
        describe('_validate_database', () => {
            test('should not throw error for valid database connection', () => {
                expect(() => itemTasks._validate_database()).not.toThrow();
            });

            test('should throw error when DB is null', () => {
                itemTasks.DB = null;
                expect(() => itemTasks._validate_database()).toThrow('Database connection is not available');
            });

            test('should throw error when DB is not a function', () => {
                itemTasks.DB = 'not a function';
                expect(() => itemTasks._validate_database()).toThrow('Database connection is not available');
            });
        });

        describe('_validate_table', () => {
            test('should not throw error for valid table name', () => {
                expect(() => itemTasks._validate_table('item_records')).not.toThrow();
            });

            test('should throw error for undefined table', () => {
                expect(() => itemTasks._validate_table('nonexistent_table'))
                    .toThrow('Table name "nonexistent_table" is not defined');
            });
        });

        describe('_validate_uuid', () => {
            test('should return trimmed UUID for valid input', () => {
                const result = itemTasks._validate_uuid('  ' + itemUUID + '  ');
                expect(result).toBe(itemUUID);
            });

            test('should throw error for empty string', () => {
                expect(() => itemTasks._validate_uuid('')).toThrow('Valid UUID is required');
            });

            test('should throw error for invalid UUID format', () => {
                expect(() => itemTasks._validate_uuid('invalid-uuid')).toThrow('Invalid UUID format');
            });

            test('should use custom field name in error message', () => {
                expect(() => itemTasks._validate_uuid('', 'item UUID'))
                    .toThrow('Valid item UUID is required');
            });
        });

        describe('_validate_uuids', () => {
            test('should validate multiple UUIDs', () => {
                // Source expects: { [uuid_value]: field_name }
                const result = itemTasks._validate_uuids({
                    [itemUUID]: 'item UUID',
                    [exhibitUUID]: 'exhibit UUID'
                });
                expect(result['item UUID']).toBe(itemUUID);
                expect(result['exhibit UUID']).toBe(exhibitUUID);
            });

            test('should throw error if any UUID is invalid', () => {
                expect(() => itemTasks._validate_uuids({
                    'invalid': 'exhibit UUID'
                })).toThrow();
            });
        });

        describe('_validate_string', () => {
            test('should return trimmed string for valid input', () => {
                const result = itemTasks._validate_string('  test  ', 'field');
                expect(result).toBe('test');
            });

            test('should throw error for empty string', () => {
                expect(() => itemTasks._validate_string('', 'field')).toThrow('Valid field is required');
            });

            test('should throw error for null', () => {
                expect(() => itemTasks._validate_string(null, 'field')).toThrow('Valid field is required');
            });
        });

        describe('_validate_data_object', () => {
            test('should not throw for valid object', () => {
                expect(() => itemTasks._validate_data_object({ item_type: 'item' })).not.toThrow();
            });

            test('should throw error for null', () => {
                expect(() => itemTasks._validate_data_object(null)).toThrow('Data must be a valid object');
            });

            test('should throw error for array', () => {
                expect(() => itemTasks._validate_data_object([])).toThrow('Data must be a valid object');
            });

            test('should throw error for empty object', () => {
                expect(() => itemTasks._validate_data_object({})).toThrow('Data object cannot be empty');
            });
        });

        describe('_set_item_defaults', () => {
            test('should set default values for missing fields', () => {
                const data = { title: 'Test Item' };
                // Method modifies data in-place, doesn't return anything
                itemTasks._set_item_defaults(data);
                expect(data.type).toBe('item');
                expect(data.layout).toBe('media_right');
                expect(data.order).toBe(0);
            });

            test('should not override existing values', () => {
                const data = { title: 'Test', order: 10 };
                itemTasks._set_item_defaults(data);
                expect(data.order).toBe(10);
            });

            test('should set all expected default fields', () => {
                const data = { title: 'Test' };
                itemTasks._set_item_defaults(data);
                expect(data.type).toBe('item');
                expect(data.layout).toBe('media_right');
                expect(data.wrap_text).toBe(1);
                expect(data.media_width).toBe(50);
                expect(data.media_padding).toBe(1);
                expect(data.is_alt_text_decorative).toBe(0);
                expect(data.pdf_open_to_page).toBe(1);
                expect(data.order).toBe(0);
                expect(data.is_repo_item).toBe(0);
                expect(data.is_kaltura_item).toBe(0);
                expect(data.is_embedded).toBe(0);
                expect(data.is_published).toBe(0);
                expect(data.is_locked).toBe(0);
                expect(data.locked_by_user).toBe(0);
                expect(data.is_deleted).toBe(0);
                expect(data.owner).toBe(0);
            });
        });

        describe('_get_table_for_type', () => {
            test('should return correct table for item type', () => {
                const result = itemTasks._get_table_for_type('item');
                expect(result).toBe('item_records');
            });

            test('should return correct table for grid type', () => {
                const result = itemTasks._get_table_for_type('grid');
                expect(result).toBe('grid_records');
            });

            test('should return correct table for heading type', () => {
                const result = itemTasks._get_table_for_type('heading');
                expect(result).toBe('heading_records');
            });

            test('should return correct table for timeline type', () => {
                const result = itemTasks._get_table_for_type('timeline');
                expect(result).toBe('timeline_records');
            });

            test('should be case insensitive', () => {
                expect(itemTasks._get_table_for_type('ITEM')).toBe('item_records');
                expect(itemTasks._get_table_for_type('Grid')).toBe('grid_records');
            });

            test('should handle whitespace', () => {
                expect(itemTasks._get_table_for_type('  item  ')).toBe('item_records');
            });

            test('should throw error for invalid type', () => {
                expect(() => itemTasks._get_table_for_type('invalid'))
                    .toThrow('Invalid item type');
            });
        });
    });

    // ==================== _UPDATE_PUBLISH_STATUS TESTS ====================
    describe('_update_publish_status', () => {
        test('should publish records successfully', async () => {
            // Source code: DB(table).where(clause).update(data).timeout()
            // No count query - directly updates
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(3);

            const result = await itemTasks._update_publish_status(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                1
            );

            expect(result.success).toBe(true);
            expect(result.affected_rows).toBe(3);
            expect(result.status).toBe('published');
        });

        test('should suppress records successfully', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(2);

            const result = await itemTasks._update_publish_status(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                0
            );

            expect(result.success).toBe(true);
            expect(result.status).toBe('suppressed');
        });

        test('should throw error for invalid status', async () => {
            await expect(itemTasks._update_publish_status(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                2
            )).rejects.toThrow('Status must be 0 or 1');
        });

        test('should include updated_by when provided', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            await itemTasks._update_publish_status(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                1,
                'user456'
            );

            expect(mockQuery.update).toHaveBeenCalled();
        });
    });

    // ==================== _UPDATE_SINGLE_PUBLISH_STATUS TESTS ====================
    describe('_update_single_publish_status', () => {
        test('should publish single record successfully', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const result = await itemTasks._update_single_publish_status(
                'item_records',
                itemUUID,
                1
            );

            expect(result.success).toBe(true);
        });

        test('should throw error when no rows affected', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(0);

            await expect(itemTasks._update_single_publish_status(
                'item_records',
                itemUUID,
                1
            )).rejects.toThrow(/No.*record found or updated/i);
        });

        test('should throw error for invalid UUID', async () => {
            await expect(itemTasks._update_single_publish_status(
                'item_records',
                'invalid',
                1
            )).rejects.toThrow(/Invalid.*UUID format/i);
        });
    });

    // ==================== _REORDER_ITEMS TESTS ====================
    describe('_reorder_items', () => {
        test('should successfully reorder item', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            // Method signature is (table_name, where_clause, item)
            const item = { uuid: itemUUID, order: 5 };
            const result = await itemTasks._reorder_items(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                item
            );
            expect(result.success).toBe(true);
        });

        test('should throw error for null item', async () => {
            await expect(itemTasks._reorder_items(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                null
            )).rejects.toThrow('Valid item object is required');
        });

        test('should throw error for array item', async () => {
            await expect(itemTasks._reorder_items(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                []
            )).rejects.toThrow('Valid item object is required');
        });

        test('should throw error when item missing uuid', async () => {
            const item = { order: 5 };
            await expect(itemTasks._reorder_items(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                item
            )).rejects.toThrow('Item must have uuid and order properties');
        });

        test('should throw error when item missing order', async () => {
            const item = { uuid: itemUUID };
            await expect(itemTasks._reorder_items(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                item
            )).rejects.toThrow('Item must have uuid and order properties');
        });

        test('should work with order value of 0', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const item = { uuid: itemUUID, order: 0 };
            const result = await itemTasks._reorder_items(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                item
            );
            expect(result.success).toBe(true);
        });
    });

    // ==================== CREATE_ITEM_RECORD TESTS ====================
    describe('create_item_record', () => {
        test('should create item record with required fields', async () => {
            const data = {
                uuid: itemUUID,
                is_member_of_exhibit: exhibitUUID,
                item_type: 'item',
                mime_type: 'image/jpeg',
                title: 'Test Item'
            };

            const result = await itemTasks.create_item_record(data, 'user123');
            expect(result.success).toBe(true);
        });

        test('should throw error for missing uuid', async () => {
            const data = {
                is_member_of_exhibit: exhibitUUID,
                item_type: 'item',
                mime_type: 'image/jpeg'
            };

            await expect(itemTasks.create_item_record(data))
                .rejects.toThrow();
        });

        test('should throw error for missing exhibit UUID', async () => {
            const data = {
                uuid: itemUUID,
                item_type: 'item',
                mime_type: 'image/jpeg'
            };

            await expect(itemTasks.create_item_record(data))
                .rejects.toThrow();
        });

        test('should throw error for missing item_type', async () => {
            const data = {
                uuid: itemUUID,
                is_member_of_exhibit: exhibitUUID,
                mime_type: 'image/jpeg'
            };

            await expect(itemTasks.create_item_record(data))
                .rejects.toThrow('Valid item_type is required');
        });

        test('should apply default values', async () => {
            const data = {
                uuid: itemUUID,
                is_member_of_exhibit: exhibitUUID,
                item_type: 'item',
                mime_type: 'image/jpeg',
                title: 'Test Item'
            };

            const result = await itemTasks.create_item_record(data);
            expect(result.success).toBe(true);
        });
    });

    // ==================== GET_RECORD_COUNT TESTS ====================
    describe('get_record_count', () => {
        test('should return correct count', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 5 }]);

            const count = await itemTasks.get_record_count(exhibitUUID);
            expect(count).toBe(5);
        });

        test('should return 0 for no records', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 0 }]);

            const count = await itemTasks.get_record_count(exhibitUUID);
            expect(count).toBe(0);
        });

        test('should return 0 on error', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

            // Source returns 0 on error, doesn't throw
            const count = await itemTasks.get_record_count(exhibitUUID);
            expect(count).toBe(0);
        });

        test('should return 0 for invalid UUID', async () => {
            // Source returns 0 on error, doesn't throw
            const count = await itemTasks.get_record_count('invalid');
            expect(count).toBe(0);
        });
    });

    // ==================== PUBLISHING METHODS TESTS ====================
    describe('Publishing Methods', () => {
        describe('set_to_publish', () => {
            test('should publish all items for an exhibit', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(2);

                const result = await itemTasks.set_to_publish(exhibitUUID);
                expect(result).toBe(true);
            });

            test('should return false on error', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

                const result = await itemTasks.set_to_publish(exhibitUUID);
                expect(result).toBe(false);
            });
        });

        describe('set_item_to_publish', () => {
            test('should publish single item', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const result = await itemTasks.set_item_to_publish(itemUUID);
                expect(result).toBe(true);
            });

            test('should return false on error', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

                const result = await itemTasks.set_item_to_publish(itemUUID);
                expect(result).toBe(false);
            });

            test('should return false when no rows affected', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(0);

                const result = await itemTasks.set_item_to_publish(itemUUID);
                expect(result).toBe(false);
            });
        });

        describe('set_to_suppress', () => {
            test('should suppress all items for an exhibit', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(2);

                const result = await itemTasks.set_to_suppress(exhibitUUID);
                expect(result).toBe(true);
            });

            test('should return false on error', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

                const result = await itemTasks.set_to_suppress(exhibitUUID);
                expect(result).toBe(false);
            });
        });

        describe('set_item_to_suppress', () => {
            test('should suppress single item', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const result = await itemTasks.set_item_to_suppress(itemUUID);
                expect(result).toBe(true);
            });

            test('should return false on error', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

                const result = await itemTasks.set_item_to_suppress(itemUUID);
                expect(result).toBe(false);
            });

            test('should return false when no rows affected', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(0);

                const result = await itemTasks.set_item_to_suppress(itemUUID);
                expect(result).toBe(false);
            });
        });
    });

    // ==================== REORDER_ITEMS TESTS ====================
    describe('reorder_items', () => {
        test('should successfully reorder item', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const item = { uuid: itemUUID, order: 5 };
            const result = await itemTasks.reorder_items(exhibitUUID, item);
            expect(result).toBe(true);
        });

        test('should return false on error', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

            const item = { uuid: itemUUID, order: 3 };
            const result = await itemTasks.reorder_items(exhibitUUID, item);
            expect(result).toBe(false);
        });

        test('should return false for invalid exhibit UUID', async () => {
            const item = { uuid: itemUUID, order: 1 };
            const result = await itemTasks.reorder_items('invalid', item);
            expect(result).toBe(false);
        });

        test('should return false for invalid item object', async () => {
            const result = await itemTasks.reorder_items(exhibitUUID, null);
            expect(result).toBe(false);
        });
    });

    // ==================== ERROR HANDLING TESTS ====================
    describe('Error Handling', () => {
        test('_handle_error should log and rethrow error', () => {
            const error = new Error('Test error');
            expect(() => {
                itemTasks._handle_error(error, 'test_method', { uuid: 'test' });
            }).toThrow('Test error');
        });

        test('should handle database connection errors', async () => {
            itemTasks.DB = null;
            const data = {
                uuid: exhibitUUID,
                is_member_of_exhibit: exhibitUUID,
                item_type: 'item',
                mime_type: 'image/jpeg'
            };

            await expect(itemTasks.create_item_record(data))
                .rejects.toThrow('Database connection is not available');
        });

        test('should handle query timeout', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockRejectedValue(new Error('Query timeout'));

            await expect(itemTasks._update_publish_status(
                'item_records',
                { is_member_of_exhibit: exhibitUUID },
                1
            )).rejects.toThrow('Query timeout');
        });
    });

    // ==================== INTEGRATION TESTS ====================
    describe('Integration Tests', () => {
        test('should handle complete item workflow', async () => {
            // Create item with all required fields
            const createData = {
                uuid: itemUUID,
                is_member_of_exhibit: exhibitUUID,
                item_type: 'item',
                mime_type: 'image/jpeg',
                title: 'Test Item'
            };

            const createResult = await itemTasks.create_item_record(createData, 'user123');
            expect(createResult.success).toBe(true);
        });

        test('should handle type mapping correctly', () => {
            expect(itemTasks._get_table_for_type('item')).toBe('item_records');
            expect(itemTasks._get_table_for_type('grid')).toBe('grid_records');
            expect(itemTasks._get_table_for_type('heading')).toBe('heading_records');
            expect(itemTasks._get_table_for_type('timeline')).toBe('timeline_records');
        });
    });
});