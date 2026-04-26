/**
 * Unit tests for Exhibit_heading_record_tasks
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const Exhibit_heading_record_tasks = require('../../exhibits/tasks/exhibit_heading_record_tasks');

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

describe('Exhibit_heading_record_tasks', () => {
    let mockDB;
    let mockTABLE;
    let mockQuery;
    let headingTasks;
    const exhibitUUID = '550e8400-e29b-41d4-a716-446655440000';
    const headingUUID = '660e8400-e29b-41d4-a716-446655440000';

    // Helper to create fresh mock query with proper chaining
    // Source code uses .timeout() on queries which returns a promise
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
            heading_records: 'tbl_heading_records',
            item_records: 'tbl_item_records'
        };

        headingTasks = new Exhibit_heading_record_tasks(mockDB, mockTABLE);
    });

    // ==================== CONSTRUCTOR TESTS ====================
    describe('Constructor', () => {
        test('should initialize with correct properties', () => {
            expect(headingTasks.DB).toBe(mockDB);
            expect(headingTasks.TABLE).toBe(mockTABLE);
            expect(headingTasks.UUID_REGEX).toBeDefined();
        });

        test('should have valid UUID regex pattern', () => {
            expect(headingTasks.UUID_REGEX.test(exhibitUUID)).toBe(true);
            expect(headingTasks.UUID_REGEX.test('invalid')).toBe(false);
        });
    });

    // ==================== VALIDATION HELPER TESTS ====================
    describe('Validation Helpers', () => {
        describe('_validate_database', () => {
            test('should not throw error for valid database connection', () => {
                expect(() => headingTasks._validate_database()).not.toThrow();
            });

            test('should throw error when DB is null', () => {
                headingTasks.DB = null;
                expect(() => headingTasks._validate_database()).toThrow('Database connection is not available');
            });

            test('should throw error when DB is not a function', () => {
                headingTasks.DB = 'not a function';
                expect(() => headingTasks._validate_database()).toThrow('Database connection is not available');
            });
        });

        describe('_validate_table', () => {
            test('should not throw error for valid table name', () => {
                expect(() => headingTasks._validate_table('heading_records')).not.toThrow();
            });

            test('should throw error for undefined table', () => {
                expect(() => headingTasks._validate_table('nonexistent_table'))
                    .toThrow('Table name "nonexistent_table" is not defined');
            });

            test('should throw error when TABLE is null', () => {
                headingTasks.TABLE = null;
                expect(() => headingTasks._validate_table('heading_records')).toThrow();
            });
        });

        describe('_validate_uuid', () => {
            test('should return trimmed UUID for valid input', () => {
                const result = headingTasks._validate_uuid('  ' + exhibitUUID + '  ');
                expect(result).toBe(exhibitUUID);
            });

            test('should throw error for empty string', () => {
                expect(() => headingTasks._validate_uuid('')).toThrow('Valid UUID is required');
            });

            test('should throw error for null', () => {
                expect(() => headingTasks._validate_uuid(null)).toThrow('Valid UUID is required');
            });

            test('should throw error for non-string', () => {
                expect(() => headingTasks._validate_uuid(12345)).toThrow('Valid UUID is required');
            });

            test('should throw error for invalid UUID format', () => {
                expect(() => headingTasks._validate_uuid('invalid-uuid')).toThrow('Invalid UUID format');
            });

            test('should use custom field name in error message', () => {
                expect(() => headingTasks._validate_uuid('', 'exhibit UUID'))
                    .toThrow('Valid exhibit UUID is required');
            });
        });

        describe('_validate_uuids', () => {
            test('should validate multiple UUIDs', () => {
                // Source expects: { [uuid_value]: field_name }
                const result = headingTasks._validate_uuids({
                    [exhibitUUID]: 'exhibit UUID',
                    [headingUUID]: 'heading UUID'
                });
                expect(result['exhibit UUID']).toBe(exhibitUUID);
                expect(result['heading UUID']).toBe(headingUUID);
            });

            test('should throw error if any UUID is invalid', () => {
                expect(() => headingTasks._validate_uuids({
                    'invalid': 'exhibit UUID'
                })).toThrow();
            });
        });

        describe('_validate_string', () => {
            test('should return trimmed string for valid input', () => {
                const result = headingTasks._validate_string('  test  ', 'field');
                expect(result).toBe('test');
            });

            test('should throw error for empty string', () => {
                expect(() => headingTasks._validate_string('', 'field')).toThrow('Valid field is required');
            });

            test('should throw error for whitespace only', () => {
                expect(() => headingTasks._validate_string('   ', 'field')).toThrow('Valid field is required');
            });

            test('should throw error for null', () => {
                expect(() => headingTasks._validate_string(null, 'field')).toThrow('Valid field is required');
            });
        });

        describe('_validate_data_object', () => {
            test('should not throw for valid object', () => {
                expect(() => headingTasks._validate_data_object({ text: 'Test' })).not.toThrow();
            });

            test('should throw error for null', () => {
                expect(() => headingTasks._validate_data_object(null)).toThrow('Data must be a valid object');
            });

            test('should throw error for array', () => {
                expect(() => headingTasks._validate_data_object([])).toThrow('Data must be a valid object');
            });

            test('should throw error for empty object', () => {
                expect(() => headingTasks._validate_data_object({})).toThrow('Data object cannot be empty');
            });
        });

        describe('_sanitize_data', () => {
            test('should only include allowed fields', () => {
                const data = {
                    text: 'Test',
                    invalid_field: 'should be removed'
                };
                const result = headingTasks._sanitize_data(data, ['text']);
                expect(result.sanitized_data).toHaveProperty('text');
                expect(result.sanitized_data).not.toHaveProperty('invalid_field');
            });

            test('should skip specified fields', () => {
                const data = { text: 'Test', uuid: 'should-skip' };
                const result = headingTasks._sanitize_data(data, ['text', 'uuid'], ['uuid']);
                expect(result.sanitized_data).not.toHaveProperty('uuid');
            });

            test('should prevent prototype pollution', () => {
                const data = { __proto__: { malicious: true }, text: 'Test' };
                const result = headingTasks._sanitize_data(data, ['text']);
                // Check that __proto__ is not an own property
                expect(Object.keys(result.sanitized_data)).not.toContain('__proto__');
            });

            test('should return invalid fields list', () => {
                const data = { text: 'Test', invalid_field: 'value' };
                const result = headingTasks._sanitize_data(data, ['text']);
                expect(result.invalid_fields).toContain('invalid_field');
            });
        });

        describe('_set_heading_defaults', () => {
            test('should set default values for missing fields', () => {
                const data = { text: 'Test Heading' };
                // Method modifies data in-place, doesn't return anything
                headingTasks._set_heading_defaults(data);
                expect(data.is_visible).toBe(1);
                expect(data.is_anchor).toBe(1);
                expect(data.type).toBe('heading');
            });

            test('should not override existing values', () => {
                const data = { text: 'Test', is_visible: 0 };
                headingTasks._set_heading_defaults(data);
                expect(data.is_visible).toBe(0);
            });

            test('should set all default fields', () => {
                const data = {};
                headingTasks._set_heading_defaults(data);
                expect(data.type).toBe('heading');
                expect(data.order).toBe(0);
                expect(data.is_visible).toBe(1);
                expect(data.is_anchor).toBe(1);
                expect(data.is_published).toBe(0);
                expect(data.is_locked).toBe(0);
                expect(data.locked_by_user).toBe(0);
                expect(data.is_indexed).toBe(0);
                expect(data.is_deleted).toBe(0);
                expect(data.owner).toBe(0);
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

            const result = await headingTasks._update_publish_status(
                'heading_records',
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

            const result = await headingTasks._update_publish_status(
                'heading_records',
                { is_member_of_exhibit: exhibitUUID },
                0
            );

            expect(result.success).toBe(true);
            expect(result.status).toBe('suppressed');
        });

        test('should throw error for invalid status', async () => {
            await expect(headingTasks._update_publish_status(
                'heading_records',
                { is_member_of_exhibit: exhibitUUID },
                2
            )).rejects.toThrow('Status must be 0 or 1');
        });

        test('should include updated_by when provided', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            await headingTasks._update_publish_status(
                'heading_records',
                { is_member_of_exhibit: exhibitUUID },
                1,
                'user456'
            );

            expect(mockQuery.update).toHaveBeenCalled();
        });
    });

    // ==================== GET_RECORD_COUNT TESTS ====================
    describe('get_record_count', () => {
        test('should return correct count', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 5 }]);

            const count = await headingTasks.get_record_count(exhibitUUID);

            expect(count).toBe(5);
            expect(mockQuery.count).toHaveBeenCalledWith('id as count');
        });

        test('should return 0 for no records', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 0 }]);

            const count = await headingTasks.get_record_count(exhibitUUID);
            expect(count).toBe(0);
        });

        test('should return 0 for null result', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(null);

            const count = await headingTasks.get_record_count(exhibitUUID);
            expect(count).toBe(0);
        });

        test('should throw error for invalid UUID', async () => {
            await expect(headingTasks.get_record_count('invalid'))
                .rejects.toThrow('Invalid exhibit UUID format');
        });
    });

    // ==================== UPDATE_HEADING_RECORD TESTS ====================
    describe('update_heading_record', () => {
        test('should successfully update heading record', async () => {
            const mockRecord = { id: 1, uuid: headingUUID, is_deleted: 0 };

            // First call: select to check exists
            const selectQuery = createMockQuery();
            selectQuery.select.mockReturnThis();
            selectQuery.where.mockReturnThis();
            selectQuery.first.mockReturnThis();
            selectQuery.timeout.mockResolvedValue(mockRecord);

            // Second call: update
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

            const data = {
                uuid: headingUUID,
                is_member_of_exhibit: exhibitUUID,
                text: 'Updated Heading'
            };
            const result = await headingTasks.update_heading_record(data);

            expect(result.success).toBe(true);
        });

        test('should return no_change when no fields to update', async () => {
            const data = {
                uuid: headingUUID,
                is_member_of_exhibit: exhibitUUID,
                invalid_only: 'value'
            };
            const result = await headingTasks.update_heading_record(data);

            expect(result.no_change).toBe(true);
            expect(result.message).toContain('No fields to update');
        });

        test('should throw error when record not found', async () => {
            const selectQuery = createMockQuery();
            selectQuery.select.mockReturnThis();
            selectQuery.where.mockReturnThis();
            selectQuery.first.mockReturnThis();
            selectQuery.timeout.mockResolvedValue(null);

            mockDB.mockReturnValue(selectQuery);

            const data = {
                uuid: headingUUID,
                is_member_of_exhibit: exhibitUUID,
                text: 'Test'
            };
            await expect(headingTasks.update_heading_record(data))
                .rejects.toThrow('Heading record not found');
        });

        test('should throw error when record is deleted', async () => {
            const deletedRecord = { uuid: headingUUID, is_deleted: 1 };
            const selectQuery = createMockQuery();
            selectQuery.select.mockReturnThis();
            selectQuery.where.mockReturnThis();
            selectQuery.first.mockReturnThis();
            selectQuery.timeout.mockResolvedValue(deletedRecord);

            mockDB.mockReturnValue(selectQuery);

            const data = {
                uuid: headingUUID,
                is_member_of_exhibit: exhibitUUID,
                text: 'Test'
            };
            await expect(headingTasks.update_heading_record(data))
                .rejects.toThrow('Cannot update deleted heading record');
        });

        test('should include updated_by when provided', async () => {
            const mockRecord = { id: 1, uuid: headingUUID, is_deleted: 0 };

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

            const data = {
                uuid: headingUUID,
                is_member_of_exhibit: exhibitUUID,
                text: 'Test'
            };
            await headingTasks.update_heading_record(data, 'user123');

            expect(updateQuery.update).toHaveBeenCalled();
        });
    });

    // ==================== PUBLISHING METHODS TESTS ====================
    describe('Publishing Methods', () => {
        describe('set_to_publish', () => {
            test('should publish all headings for an exhibit', async () => {
                // Source: _update_publish_status does DB(table).where().update().timeout()
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(2);

                const result = await headingTasks.set_to_publish(exhibitUUID);
                expect(result).toBe(true);
            });

            test('should return false on error', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

                const result = await headingTasks.set_to_publish(exhibitUUID);
                expect(result).toBe(false);
            });

            test('should pass updated_by parameter', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                await headingTasks.set_to_publish(exhibitUUID, 'user123');
                expect(mockQuery.update).toHaveBeenCalled();
            });
        });

        describe('set_heading_to_publish', () => {
            test('should publish single heading', async () => {
                // Source: _update_single_publish_status does DB(table).where({uuid}).update().timeout()
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const result = await headingTasks.set_heading_to_publish(headingUUID);
                expect(result).toBe(true);
            });

            test('should return false on error', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

                const result = await headingTasks.set_heading_to_publish(headingUUID);
                expect(result).toBe(false);
            });

            test('should return false when no rows affected', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(0);

                const result = await headingTasks.set_heading_to_publish(headingUUID);
                expect(result).toBe(false);
            });
        });

        describe('set_to_suppress', () => {
            test('should suppress all headings for an exhibit', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(2);

                const result = await headingTasks.set_to_suppress(exhibitUUID);
                expect(result).toBe(true);
            });

            test('should return false on error', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

                const result = await headingTasks.set_to_suppress(exhibitUUID);
                expect(result).toBe(false);
            });
        });

        describe('set_heading_to_suppress', () => {
            test('should suppress single heading', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(1);

                const result = await headingTasks.set_heading_to_suppress(headingUUID);
                expect(result).toBe(true);
            });

            test('should return false on error', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

                const result = await headingTasks.set_heading_to_suppress(headingUUID);
                expect(result).toBe(false);
            });

            test('should return false when no rows affected', async () => {
                mockQuery.where.mockReturnThis();
                mockQuery.update.mockReturnThis();
                mockQuery.timeout.mockResolvedValue(0);

                const result = await headingTasks.set_heading_to_suppress(headingUUID);
                expect(result).toBe(false);
            });
        });
    });

    // ==================== REORDER_HEADINGS TESTS ====================
    describe('reorder_headings', () => {
        test('should successfully reorder heading', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const heading = { uuid: headingUUID, order: 5 };
            const result = await headingTasks.reorder_headings(exhibitUUID, heading);
            expect(result).toBe(true);
        });

        test('should handle order value of 0', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockResolvedValue(1);

            const heading = { uuid: headingUUID, order: 0 };
            const result = await headingTasks.reorder_headings(exhibitUUID, heading);
            expect(result).toBe(true);
        });

        test('should return false on error', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockReturnThis();
            mockQuery.timeout.mockRejectedValue(new Error('DB Error'));

            const heading = { uuid: headingUUID, order: 3 };
            const result = await headingTasks.reorder_headings(exhibitUUID, heading);
            expect(result).toBe(false);
        });

        test('should return false for invalid exhibit UUID', async () => {
            const heading = { uuid: headingUUID, order: 1 };
            const result = await headingTasks.reorder_headings('invalid', heading);
            expect(result).toBe(false);
        });

        test('should return false for invalid item object', async () => {
            const result = await headingTasks.reorder_headings(exhibitUUID, null);
            expect(result).toBe(false);
        });

        test('should return false when item missing uuid or order', async () => {
            const result = await headingTasks.reorder_headings(exhibitUUID, { uuid: headingUUID });
            expect(result).toBe(false);
        });
    });

    // ==================== ERROR HANDLING TESTS ====================
    describe('Error Handling', () => {
        test('_handle_error should log and rethrow error', () => {
            const error = new Error('Test error');
            expect(() => {
                headingTasks._handle_error(error, 'test_method', { uuid: 'test' });
            }).toThrow('Test error');
        });

        test('should handle database connection errors gracefully', async () => {
            headingTasks.DB = null;
            await expect(headingTasks.get_record_count(exhibitUUID))
                .rejects.toThrow('Database connection is not available');
        });

        test('should handle query errors properly', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockRejectedValue(new Error('Query failed'));

            await expect(headingTasks.get_record_count(exhibitUUID))
                .rejects.toThrow('Query failed');
        });
    });

    // ==================== INTEGRATION TESTS ====================
    describe('Integration Tests', () => {
        test('should handle complete heading workflow', async () => {
            // Step 1: Get record count
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockReturnThis();
            mockQuery.timeout.mockResolvedValue([{ count: 1 }]);

            const count = await headingTasks.get_record_count(exhibitUUID);
            expect(count).toBe(1);

            // Step 2: Update heading
            const mockRecord = { id: 1, uuid: headingUUID, is_deleted: 0 };

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

            const updateResult = await headingTasks.update_heading_record({
                uuid: headingUUID,
                is_member_of_exhibit: exhibitUUID,
                text: 'Updated Heading Text'
            });
            expect(updateResult.success).toBe(true);
        });
    });
});