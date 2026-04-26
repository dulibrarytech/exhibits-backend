/**
 * Unit tests for Exhibit_timeline_record_tasks
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const Exhibit_timeline_record_tasks = require('../../exhibits/tasks/exhibit_timeline_record_tasks');

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

describe('Exhibit_timeline_record_tasks', () => {
    let mockDB;
    let mockTABLE;
    let mockQuery;
    let timelineTasks;
    const exhibitUUID = '550e8400-e29b-41d4-a716-446655440000';
    const timelineUUID = '660e8400-e29b-41d4-a716-446655440001';
    const timelineItemUUID = '770e8400-e29b-41d4-a716-446655440002';

    // Helper to create fresh mock query with proper chaining
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

        // Setup transaction mock
        mockDB.transaction = jest.fn(async (callback) => {
            const trxQuery = createMockQuery();
            trxQuery.insert.mockReturnThis();
            trxQuery.timeout.mockResolvedValue([1]);
            trxQuery.select.mockReturnThis();
            trxQuery.where.mockReturnThis();
            trxQuery.first.mockResolvedValue({ id: 1, uuid: timelineUUID, title: 'Test Timeline' });

            const trxFn = jest.fn(() => trxQuery);
            return callback(trxFn);
        });

        // Mock TABLE configuration
        mockTABLE = {
            exhibit_records: 'tbl_exhibit_records',
            heading_records: 'tbl_heading_records',
            item_records: 'tbl_item_records',
            timeline_records: 'tbl_timeline_records',
            timeline_item_records: 'tbl_timeline_item_records'
        };

        timelineTasks = new Exhibit_timeline_record_tasks(mockDB, mockTABLE);
    });

    // ==================== CONSTRUCTOR TESTS ====================
    describe('Constructor', () => {
        test('should initialize with correct properties', () => {
            expect(timelineTasks.DB).toBe(mockDB);
            expect(timelineTasks.TABLE).toBe(mockTABLE);
            expect(timelineTasks.UUID_REGEX).toBeDefined();
            expect(timelineTasks.QUERY_TIMEOUT).toBe(10000);
        });

        test('should have valid UUID regex pattern', () => {
            const validUUID = '550e8400-e29b-41d4-a716-446655440000';
            expect(timelineTasks.UUID_REGEX.test(validUUID)).toBe(true);
        });
    });

    // ==================== VALIDATION HELPER TESTS ====================
    describe('Validation Helpers', () => {
        describe('_validate_database', () => {
            test('should not throw error for valid database connection', () => {
                expect(() => timelineTasks._validate_database()).not.toThrow();
            });

            test('should throw error when DB is null', () => {
                timelineTasks.DB = null;
                expect(() => timelineTasks._validate_database())
                    .toThrow('Database connection is not available');
            });

            test('should throw error when DB is not a function', () => {
                timelineTasks.DB = {};
                expect(() => timelineTasks._validate_database())
                    .toThrow('Database connection is not available');
            });
        });

        describe('_validate_table', () => {
            test('should not throw error for valid table name', () => {
                expect(() => timelineTasks._validate_table('timeline_records')).not.toThrow();
            });

            test('should throw error for undefined table', () => {
                expect(() => timelineTasks._validate_table('invalid_table'))
                    .toThrow('Table name "invalid_table" is not defined');
            });

            test('should throw error when TABLE is null', () => {
                timelineTasks.TABLE = null;
                expect(() => timelineTasks._validate_table('timeline_records')).toThrow();
            });
        });

        describe('_validate_uuid', () => {
            const validUUID = '550e8400-e29b-41d4-a716-446655440000';

            test('should return trimmed UUID for valid input', () => {
                const result = timelineTasks._validate_uuid(`  ${validUUID}  `);
                expect(result).toBe(validUUID);
            });

            test('should throw error for empty string', () => {
                expect(() => timelineTasks._validate_uuid('')).toThrow('Valid UUID is required');
            });

            test('should throw error for null', () => {
                expect(() => timelineTasks._validate_uuid(null)).toThrow('Valid UUID is required');
            });

            test('should throw error for non-string', () => {
                expect(() => timelineTasks._validate_uuid(123)).toThrow('Valid UUID is required');
            });

            test('should throw error for invalid UUID format', () => {
                expect(() => timelineTasks._validate_uuid('invalid-uuid'))
                    .toThrow('Invalid UUID format');
            });

            test('should use custom field name in error message', () => {
                expect(() => timelineTasks._validate_uuid('', 'timeline UUID'))
                    .toThrow('Valid timeline UUID is required');
            });

            test('should accept various valid UUID versions', () => {
                const uuids = [
                    '550e8400-e29b-11d4-a716-446655440000', // v1
                    '550e8400-e29b-21d4-a716-446655440000', // v2
                    '550e8400-e29b-31d4-a716-446655440000', // v3
                    '550e8400-e29b-41d4-a716-446655440000', // v4
                    '550e8400-e29b-51d4-a716-446655440000'  // v5
                ];

                uuids.forEach(uuid => {
                    expect(() => timelineTasks._validate_uuid(uuid)).not.toThrow();
                });
            });
        });

        describe('_validate_uuids', () => {
            test('should validate multiple UUIDs', () => {
                const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
                const uuid2 = '660e8400-e29b-41d4-a716-446655440001';

                // Source expects: { [uuid_value]: field_name }
                const result = timelineTasks._validate_uuids({
                    [uuid1]: 'exhibit UUID',
                    [uuid2]: 'timeline UUID'
                });

                expect(result['exhibit UUID']).toBe(uuid1);
                expect(result['timeline UUID']).toBe(uuid2);
            });

            test('should throw error if any UUID is invalid', () => {
                // The key is the UUID value being validated
                expect(() => timelineTasks._validate_uuids({
                    'invalid-uuid': 'exhibit UUID'
                })).toThrow();
            });

            test('should handle empty uuid map', () => {
                const result = timelineTasks._validate_uuids({});
                expect(Object.keys(result)).toHaveLength(0);
            });
        });

        describe('_validate_string', () => {
            test('should return trimmed string for valid input', () => {
                const result = timelineTasks._validate_string('  test  ', 'field');
                expect(result).toBe('test');
            });

            test('should throw error for empty string', () => {
                expect(() => timelineTasks._validate_string('', 'field'))
                    .toThrow('Valid field is required');
            });

            test('should throw error for whitespace only', () => {
                expect(() => timelineTasks._validate_string('   ', 'field'))
                    .toThrow('Valid field is required');
            });

            test('should throw error for null', () => {
                expect(() => timelineTasks._validate_string(null, 'field'))
                    .toThrow('Valid field is required');
            });

            test('should throw error for non-string', () => {
                expect(() => timelineTasks._validate_string(123, 'field'))
                    .toThrow('Valid field is required');
            });
        });

        describe('_validate_data_object', () => {
            test('should not throw for valid object', () => {
                expect(() => timelineTasks._validate_data_object({ date: '2025-01-01' })).not.toThrow();
            });

            test('should throw error for null', () => {
                expect(() => timelineTasks._validate_data_object(null))
                    .toThrow('Data must be a valid object');
            });

            test('should throw error for array', () => {
                expect(() => timelineTasks._validate_data_object([]))
                    .toThrow('Data must be a valid object');
            });

            test('should throw error for empty object', () => {
                expect(() => timelineTasks._validate_data_object({}))
                    .toThrow('Data object cannot be empty');
            });

            test('should throw error for non-object', () => {
                expect(() => timelineTasks._validate_data_object('string'))
                    .toThrow('Data must be a valid object');
            });

            test('should throw error for undefined', () => {
                expect(() => timelineTasks._validate_data_object(undefined))
                    .toThrow('Data must be a valid object');
            });
        });

        describe('_sanitize_data', () => {
            const allowedFields = ['date', 'title', 'is_published'];
            const skipFields = ['uuid'];

            test('should only include allowed fields', () => {
                const data = {
                    date: '2025-01-01',
                    title: 'Timeline Event',
                    invalid_field: 'value'
                };
                const { sanitized_data } = timelineTasks._sanitize_data(data, allowedFields);
                expect(sanitized_data.date).toBe('2025-01-01');
                expect(sanitized_data.title).toBe('Timeline Event');
                expect(sanitized_data.invalid_field).toBeUndefined();
            });

            test('should skip specified fields', () => {
                const data = {
                    uuid: '550e8400-e29b-41d4-a716-446655440000',
                    date: '2025-01-01'
                };
                const { sanitized_data } = timelineTasks._sanitize_data(data, allowedFields, skipFields);
                expect(sanitized_data.uuid).toBeUndefined();
                expect(sanitized_data.date).toBe('2025-01-01');
            });

            test('should prevent prototype pollution', () => {
                const data = {
                    __proto__: { polluted: true },
                    date: '2025-01-01'
                };
                const { sanitized_data } = timelineTasks._sanitize_data(data, allowedFields);
                // Check that __proto__ is not an own property
                expect(Object.keys(sanitized_data)).not.toContain('__proto__');
                expect(sanitized_data.date).toBe('2025-01-01');
            });

            test('should prevent constructor pollution', () => {
                const data = {
                    constructor: { polluted: true },
                    date: '2025-01-01'
                };
                const { sanitized_data } = timelineTasks._sanitize_data(data, allowedFields);
                // Check that constructor is not an own property
                expect(Object.keys(sanitized_data)).not.toContain('constructor');
                expect(sanitized_data.date).toBe('2025-01-01');
            });

            test('should prevent prototype key pollution', () => {
                const data = {
                    prototype: { polluted: true },
                    date: '2025-01-01'
                };
                const { sanitized_data } = timelineTasks._sanitize_data(data, allowedFields);
                expect(sanitized_data.prototype).toBeUndefined();
            });

            test('should return invalid fields list', () => {
                const data = {
                    date: '2025-01-01',
                    invalid1: 'value1',
                    invalid2: 'value2'
                };
                const { invalid_fields } = timelineTasks._sanitize_data(data, allowedFields);
                expect(invalid_fields).toContain('invalid1');
                expect(invalid_fields).toContain('invalid2');
                expect(invalid_fields).toHaveLength(2);
            });

            test('should handle empty data object', () => {
                const data = {};
                const { sanitized_data, invalid_fields } = timelineTasks._sanitize_data(data, allowedFields);
                expect(Object.keys(sanitized_data)).toHaveLength(0);
                expect(invalid_fields).toHaveLength(0);
            });

            test('should handle all valid fields', () => {
                const data = {
                    date: '2025-01-01',
                    title: 'Event',
                    is_published: 1
                };
                const { sanitized_data, invalid_fields } = timelineTasks._sanitize_data(data, allowedFields);
                expect(Object.keys(sanitized_data)).toHaveLength(3);
                expect(invalid_fields).toHaveLength(0);
            });
        });
    });

    // ==================== ERROR HANDLING TESTS ====================
    describe('Error Handling', () => {
        test('should handle database connection errors', () => {
            timelineTasks.DB = null;
            expect(() => timelineTasks._validate_database())
                .toThrow('Database connection is not available');
        });

        test('should handle null TABLE configuration', () => {
            timelineTasks.TABLE = null;
            expect(() => timelineTasks._validate_table('timeline_records'))
                .toThrow();
        });

        test('should handle undefined TABLE entries', () => {
            timelineTasks.TABLE = { other_table: 'tbl_other' };
            expect(() => timelineTasks._validate_table('timeline_records'))
                .toThrow('Table name "timeline_records" is not defined');
        });

        test('_handle_error should log and rethrow error', () => {
            const error = new Error('Test error');
            expect(() => {
                timelineTasks._handle_error(error, 'test_method', { uuid: 'test' });
            }).toThrow('Test error');
        });
    });

    // ==================== _UPDATE_PUBLISH_STATUS TESTS ====================
    describe('_update_publish_status', () => {
        test('should publish records successfully', async () => {
            // Source: DB(table).where(clause).update(data).timeout()
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(3);

            const result = await timelineTasks._update_publish_status(
                'timeline_records',
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

            const result = await timelineTasks._update_publish_status(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                0
            );

            expect(result.success).toBe(true);
            expect(result.status).toBe('suppressed');
        });

        test('should throw error for invalid status', async () => {
            await expect(timelineTasks._update_publish_status(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                2
            )).rejects.toThrow('Status must be 0 or 1');
        });

        test('should include updated_by when provided', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            await timelineTasks._update_publish_status(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                1,
                'user456'
            );

            expect(mockQuery.update).toHaveBeenCalled();
        });
    });

    // ==================== _REORDER_ITEMS TESTS ====================
    describe('_reorder_items', () => {
        test('should successfully reorder item', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const item = { uuid: timelineUUID, order: 5 };
            const result = await timelineTasks._reorder_items(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                item
            );
            expect(result.success).toBe(true);
            expect(result.uuid).toBe(timelineUUID);
            expect(result.order).toBe(5);
        });

        test('should throw error for null item', async () => {
            await expect(timelineTasks._reorder_items(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                null
            )).rejects.toThrow('Valid item object is required');
        });

        test('should throw error for array item', async () => {
            await expect(timelineTasks._reorder_items(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                []
            )).rejects.toThrow('Valid item object is required');
        });

        test('should throw error when item missing uuid', async () => {
            const item = { order: 5 };
            await expect(timelineTasks._reorder_items(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                item
            )).rejects.toThrow('Item must have uuid and order properties');
        });

        test('should throw error when item missing order', async () => {
            const item = { uuid: timelineUUID };
            await expect(timelineTasks._reorder_items(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                item
            )).rejects.toThrow('Item must have uuid and order properties');
        });

        test('should work with order value of 0', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const item = { uuid: timelineUUID, order: 0 };
            const result = await timelineTasks._reorder_items(
                'timeline_records',
                { is_member_of_exhibit: exhibitUUID },
                item
            );
            expect(result.success).toBe(true);
        });
    });

    // ==================== PUBLISHING METHODS TESTS ====================
    describe('Publishing Methods', () => {
        describe('set_to_publish', () => {
            test('should publish all timelines for an exhibit', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(2);

                const result = await timelineTasks.set_to_publish(exhibitUUID);
                expect(result.success).toBe(true);
                expect(result.affected_rows).toBe(2);
            });

            test('should throw error for invalid UUID', async () => {
                await expect(timelineTasks.set_to_publish('invalid'))
                    .rejects.toThrow('Invalid exhibit UUID format');
            });
        });

        describe('set_timeline_to_publish', () => {
            test('should publish single timeline', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const result = await timelineTasks.set_timeline_to_publish(timelineUUID);
                expect(result.success).toBe(true);
            });
        });

        describe('set_timeline_item_to_publish', () => {
            test('should publish single timeline item', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const result = await timelineTasks.set_timeline_item_to_publish(timelineItemUUID);
                expect(result.success).toBe(true);
            });
        });

        describe('set_to_publish_timeline_items', () => {
            test('should publish all timeline items for a timeline', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(3);

                const result = await timelineTasks.set_to_publish_timeline_items(timelineUUID);
                expect(result.success).toBe(true);
                expect(result.affected_rows).toBe(3);
            });
        });

        describe('set_to_suppress', () => {
            test('should suppress all timelines for an exhibit', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(2);

                const result = await timelineTasks.set_to_suppress(exhibitUUID);
                expect(result.success).toBe(true);
                expect(result.status).toBe('suppressed');
            });
        });

        describe('set_timeline_to_suppress', () => {
            test('should suppress single timeline', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const result = await timelineTasks.set_timeline_to_suppress(timelineUUID);
                expect(result.success).toBe(true);
            });
        });

        describe('set_to_suppressed_timeline_items', () => {
            test('should suppress all timeline items for a timeline', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(3);

                const result = await timelineTasks.set_to_suppressed_timeline_items(timelineUUID);
                expect(result.success).toBe(true);
                expect(result.status).toBe('suppressed');
            });
        });
    });

    // ==================== REORDER METHODS TESTS ====================
    describe('Reorder Methods', () => {
        describe('reorder_timelines', () => {
            test('should successfully reorder timeline', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const timeline = { uuid: timelineUUID, order: 5 };
                const result = await timelineTasks.reorder_timelines(exhibitUUID, timeline);
                expect(result.success).toBe(true);
            });

            test('should throw error for invalid exhibit UUID', async () => {
                const timeline = { uuid: timelineUUID, order: 1 };
                await expect(timelineTasks.reorder_timelines('invalid', timeline))
                    .rejects.toThrow('Invalid exhibit UUID format');
            });
        });

        describe('reorder_timeline_items', () => {
            test('should successfully reorder timeline item', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const item = { uuid: timelineItemUUID, order: 3 };
                const result = await timelineTasks.reorder_timeline_items(timelineUUID, item);
                expect(result.success).toBe(true);
            });

            test('should throw error for invalid timeline UUID', async () => {
                const item = { uuid: timelineItemUUID, order: 1 };
                await expect(timelineTasks.reorder_timeline_items('invalid', item))
                    .rejects.toThrow('Invalid timeline UUID format');
            });
        });
    });

    // ==================== INTEGRATION TESTS ====================
    describe('Integration Tests', () => {
        test('should validate complete data flow', () => {
            // Validate database
            expect(() => timelineTasks._validate_database()).not.toThrow();

            // Validate table
            expect(() => timelineTasks._validate_table('timeline_records')).not.toThrow();

            // Validate UUIDs
            const validated = timelineTasks._validate_uuids({
                [exhibitUUID]: 'exhibit UUID',
                [timelineUUID]: 'timeline UUID'
            });

            expect(validated['exhibit UUID']).toBe(exhibitUUID);
            expect(validated['timeline UUID']).toBe(timelineUUID);

            // Validate data object
            const data = {
                uuid: timelineUUID,
                is_member_of_exhibit: exhibitUUID,
                date: '2025-01-01',
                title: 'Test Event'
            };

            expect(() => timelineTasks._validate_data_object(data)).not.toThrow();
        });

        test('should handle validation chain failure', () => {
            timelineTasks.DB = null;

            // Should fail at first validation step
            expect(() => timelineTasks._validate_database())
                .toThrow('Database connection is not available');
        });
    });

    // ==================== EDGE CASES ====================
    describe('Edge Cases', () => {
        test('should handle UUID with leading/trailing whitespace', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            const result = timelineTasks._validate_uuid(`  ${uuid}  `);
            expect(result).toBe(uuid);
        });

        test('should handle string with mixed whitespace', () => {
            const result = timelineTasks._validate_string('  test  string  ', 'field');
            expect(result).toBe('test  string');
        });

        test('should reject UUID with invalid variant', () => {
            const invalidUUID = '550e8400-e29b-41d4-c716-446655440000'; // 'c' is invalid variant
            expect(() => timelineTasks._validate_uuid(invalidUUID)).toThrow();
        });

        test('should handle empty allowed fields in sanitize', () => {
            const data = { field1: 'value1', field2: 'value2' };
            const { sanitized_data, invalid_fields } = timelineTasks._sanitize_data(data, []);

            expect(Object.keys(sanitized_data)).toHaveLength(0);
            expect(invalid_fields).toHaveLength(2);
        });

        test('should handle special characters in field names', () => {
            const data = {
                'field-name': 'value',
                'field_name': 'value2'
            };
            const { sanitized_data } = timelineTasks._sanitize_data(
                data,
                ['field-name', 'field_name']
            );

            expect(sanitized_data['field-name']).toBe('value');
            expect(sanitized_data['field_name']).toBe('value2');
        });

        test('should handle null values in data', () => {
            const data = {
                date: null,
                title: 'Test'
            };
            const { sanitized_data } = timelineTasks._sanitize_data(
                data,
                ['date', 'title']
            );

            expect(sanitized_data.date).toBeNull();
            expect(sanitized_data.title).toBe('Test');
        });

        test('should handle undefined values in data', () => {
            const data = {
                date: undefined,
                title: 'Test'
            };
            const { sanitized_data } = timelineTasks._sanitize_data(
                data,
                ['date', 'title']
            );

            expect(sanitized_data.date).toBeUndefined();
            expect(sanitized_data.title).toBe('Test');
        });
    });

    // ==================== SECURITY TESTS ====================
    describe('Security Tests', () => {
        test('should prevent __proto__ injection', () => {
            const maliciousData = {
                __proto__: { admin: true },
                normalField: 'value'
            };

            const { sanitized_data } = timelineTasks._sanitize_data(
                maliciousData,
                ['normalField']
            );

            // Use Object.keys to check only own properties
            expect(Object.keys(sanitized_data)).not.toContain('__proto__');
            expect(sanitized_data.normalField).toBe('value');
        });

        test('should prevent constructor injection', () => {
            const maliciousData = {
                constructor: { malicious: true },
                normalField: 'value'
            };

            const { sanitized_data } = timelineTasks._sanitize_data(
                maliciousData,
                ['normalField']
            );

            expect(Object.keys(sanitized_data)).not.toContain('constructor');
            expect(sanitized_data.normalField).toBe('value');
        });

        test('should prevent prototype injection', () => {
            const maliciousData = {
                prototype: { malicious: true },
                normalField: 'value'
            };

            const { sanitized_data } = timelineTasks._sanitize_data(
                maliciousData,
                ['normalField']
            );

            expect(sanitized_data.prototype).toBeUndefined();
            expect(sanitized_data.normalField).toBe('value');
        });
    });

    // ==================== TYPE VALIDATION TESTS ====================
    describe('Type Validation', () => {
        test('should reject boolean as UUID', () => {
            expect(() => timelineTasks._validate_uuid(true, 'field'))
                .toThrow('Valid field is required');
        });

        test('should reject number as UUID', () => {
            expect(() => timelineTasks._validate_uuid(12345, 'field'))
                .toThrow('Valid field is required');
        });

        test('should reject object as UUID', () => {
            expect(() => timelineTasks._validate_uuid({}, 'field'))
                .toThrow('Valid field is required');
        });

        test('should reject array as UUID', () => {
            expect(() => timelineTasks._validate_uuid([], 'field'))
                .toThrow('Valid field is required');
        });

        test('should reject function as data object', () => {
            expect(() => timelineTasks._validate_data_object(() => {}))
                .toThrow('Data must be a valid object');
        });

        test('should reject symbol as string', () => {
            expect(() => timelineTasks._validate_string(Symbol('test'), 'field'))
                .toThrow('Valid field is required');
        });
    });
});