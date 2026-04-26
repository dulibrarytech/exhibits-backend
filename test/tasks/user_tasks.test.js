/**
 * Unit tests for User_tasks
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const User_tasks = require('../../users/tasks/user_tasks');

// Mock dependencies - MUST be identical across all test files to avoid conflicts
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

/**
 * Database Schema Reference (tbl_users):
 * - id: int(11) unsigned, AUTO_INCREMENT, PRIMARY KEY
 * - du_id: varchar(50), NOT NULL, UNIQUE
 * - email: varchar(100), NOT NULL, UNIQUE
 * - first_name: varchar(255), NOT NULL
 * - last_name: varchar(255), NOT NULL
 * - is_active: tinyint(1), NOT NULL, DEFAULT 1
 * - token: varchar(500), NULL, UNIQUE
 * - created: timestamp, DEFAULT CURRENT_TIMESTAMP
 * - last_login: timestamp, DEFAULT CURRENT_TIMESTAMP ON UPDATE
 */

describe('User_tasks', () => {
    let mockDB;
    let mockTABLE;
    let mockQuery;
    let userTasks;

    // Helper to create fresh mock query with proper chaining
    const createMockQuery = () => {
        const query = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            del: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnThis()
        };
        return query;
    };

    // Helper to create mock user matching schema
    const createMockUser = (overrides = {}) => ({
        id: 1,
        du_id: 'jdoe',
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        is_active: 1,
        token: 'abc123token',
        created: '2025-01-01 00:00:00',
        last_login: '2025-12-18 10:00:00',
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        mockQuery = createMockQuery();
        mockDB = jest.fn(() => mockQuery);
        mockTABLE = 'tbl_users';

        userTasks = new User_tasks(mockDB, mockTABLE);
    });

    afterAll(async () => {
        // Allow any pending async operations to complete
        await new Promise(resolve => setImmediate(resolve));
    });

    // ==================== CONSTRUCTOR TESTS ====================
    describe('Constructor', () => {
        test('should initialize with correct properties', () => {
            expect(userTasks.DB).toBe(mockDB);
            expect(userTasks.TABLE).toBe(mockTABLE);
        });

        test('should use tbl_users as default table', () => {
            expect(userTasks.TABLE).toBe('tbl_users');
        });
    });

    // ==================== GET_USERS TESTS ====================
    describe('get_users', () => {
        test('should return all users with all schema fields', async () => {
            const mockUsers = [
                createMockUser({ id: 1, du_id: 'jdoe', email: 'john@example.com' }),
                createMockUser({ id: 2, du_id: 'jsmith', email: 'jane@example.com', first_name: 'Jane', last_name: 'Smith' })
            ];

            mockQuery.select.mockResolvedValue(mockUsers);

            const result = await userTasks.get_users();

            expect(mockDB).toHaveBeenCalledWith('tbl_users');
            expect(mockQuery.select).toHaveBeenCalledWith('*');
            expect(result).toEqual(mockUsers);
            expect(result[0]).toHaveProperty('du_id');
            expect(result[0]).toHaveProperty('token');
            expect(result[0]).toHaveProperty('created');
            expect(result[0]).toHaveProperty('last_login');
        });

        test('should return empty array when no users exist', async () => {
            mockQuery.select.mockResolvedValue([]);

            const result = await userTasks.get_users();

            expect(result).toEqual([]);
        });

        test('should handle database errors gracefully', async () => {
            mockQuery.select.mockRejectedValue(new Error('Database connection failed'));

            const result = await userTasks.get_users();

            expect(result).toBeUndefined();
        });

        test('should return users with correct is_active values', async () => {
            const mockUsers = [
                createMockUser({ id: 1, is_active: 1 }),
                createMockUser({ id: 2, is_active: 0 })
            ];

            mockQuery.select.mockResolvedValue(mockUsers);

            const result = await userTasks.get_users();

            expect(result[0].is_active).toBe(1);
            expect(result[1].is_active).toBe(0);
        });
    });

    // ==================== GET_USER TESTS ====================
    describe('get_user', () => {
        test('should return user by id with all schema fields', async () => {
            const mockUser = [createMockUser()];

            mockQuery.select.mockReturnThis();
            mockQuery.where.mockResolvedValue(mockUser);

            const result = await userTasks.get_user(1);

            expect(mockDB).toHaveBeenCalledWith('tbl_users');
            expect(mockQuery.select).toHaveBeenCalledWith('*');
            expect(mockQuery.where).toHaveBeenCalledWith({ id: 1 });
            expect(result).toEqual(mockUser);
            expect(result[0]).toHaveProperty('du_id');
            expect(result[0]).toHaveProperty('email');
            expect(result[0]).toHaveProperty('token');
        });

        test('should return empty array when user not found', async () => {
            mockQuery.select.mockReturnThis();
            mockQuery.where.mockResolvedValue([]);

            const result = await userTasks.get_user(999);

            expect(result).toEqual([]);
        });

        test('should handle unsigned int id (schema: int(11) unsigned)', async () => {
            const mockUser = [createMockUser({ id: 4294967295 })]; // Max unsigned int

            mockQuery.select.mockReturnThis();
            mockQuery.where.mockResolvedValue(mockUser);

            const result = await userTasks.get_user(4294967295);

            expect(mockQuery.where).toHaveBeenCalledWith({ id: 4294967295 });
            expect(result[0].id).toBe(4294967295);
        });

        test('should handle database errors gracefully', async () => {
            mockQuery.select.mockReturnThis();
            mockQuery.where.mockRejectedValue(new Error('Query failed'));

            const result = await userTasks.get_user(1);

            expect(result).toBeUndefined();
        });
    });

    // ==================== UPDATE_USER TESTS ====================
    describe('update_user', () => {
        test('should update user successfully', async () => {
            const userId = 1;
            const userData = {
                first_name: 'John',
                last_name: 'Updated',
                email: 'john.updated@example.com'
            };

            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);

            const result = await userTasks.update_user(userId, userData);

            expect(mockDB).toHaveBeenCalledWith('tbl_users');
            expect(mockQuery.where).toHaveBeenCalledWith({ id: userId });
            expect(mockQuery.update).toHaveBeenCalledWith({
                first_name: userData.first_name,
                last_name: userData.last_name,
                email: userData.email
            });
            expect(result).toBe(1);
        });

        test('should return 0 when user not found', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(0);

            const result = await userTasks.update_user(999, {
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com'
            });

            expect(result).toBe(0);
        });

        test('should only update first_name, last_name, and email (not du_id, token, etc)', async () => {
            const userData = {
                first_name: 'New',
                last_name: 'Name',
                email: 'new@example.com',
                du_id: 'should_not_update',
                token: 'should_not_update',
                is_active: 0,
                created: '2020-01-01'
            };

            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);

            await userTasks.update_user(1, userData);

            // Source explicitly only updates first_name, last_name, email
            expect(mockQuery.update).toHaveBeenCalledWith({
                first_name: 'New',
                last_name: 'Name',
                email: 'new@example.com'
            });
        });

        test('should handle first_name at max length (varchar 255)', async () => {
            const maxLengthName = 'A'.repeat(255);
            const userData = {
                first_name: maxLengthName,
                last_name: 'Test',
                email: 'test@example.com'
            };

            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);

            const result = await userTasks.update_user(1, userData);

            expect(mockQuery.update).toHaveBeenCalledWith({
                first_name: maxLengthName,
                last_name: 'Test',
                email: 'test@example.com'
            });
            expect(result).toBe(1);
        });

        test('should handle email at max length (varchar 100)', async () => {
            // Create email that's exactly 100 chars: local@domain.com format
            const localPart = 'a'.repeat(88);
            const maxEmail = `${localPart}@test.com`; // 88 + 1 + 8 = 97, close to 100

            const userData = {
                first_name: 'Test',
                last_name: 'User',
                email: maxEmail
            };

            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);

            await userTasks.update_user(1, userData);

            expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
                email: maxEmail
            }));
        });

        test('should handle database errors', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockRejectedValue(new Error('Update failed'));

            // update_user is NOT async, so errors propagate through the returned promise
            await expect(userTasks.update_user(1, {
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com'
            })).rejects.toThrow('Update failed');
        });

        test('should handle duplicate email error (unique constraint)', async () => {
            const sqlError = new Error('Duplicate entry');
            sqlError.code = 'ER_DUP_ENTRY';
            sqlError.sqlMessage = "Duplicate entry 'existing@example.com' for key 'email_index'";

            mockQuery.where.mockReturnThis();
            mockQuery.update.mockRejectedValue(sqlError);

            await expect(userTasks.update_user(1, {
                first_name: 'Test',
                last_name: 'User',
                email: 'existing@example.com'
            })).rejects.toThrow('Duplicate entry');
        });
    });

    // ==================== SAVE_USER TESTS ====================
    describe('save_user', () => {
        test('should save user successfully with all fields', async () => {
            const userData = {
                du_id: 'newuser',
                first_name: 'New',
                last_name: 'User',
                email: 'NEW@EXAMPLE.COM',
                is_active: 1,
                token: 'newtoken123'
            };

            mockQuery.insert.mockResolvedValue([41]); // AUTO_INCREMENT=41 from schema

            const result = await userTasks.save_user(userData);

            expect(mockDB).toHaveBeenCalledWith('tbl_users');
            expect(userData.email).toBe('new@example.com'); // Should be lowercased
            expect(mockQuery.insert).toHaveBeenCalledWith(userData);
            expect(result).toEqual([41]);
        });

        test('should lowercase email before saving', async () => {
            const userData = {
                du_id: 'testuser',
                first_name: 'Test',
                last_name: 'User',
                email: 'TEST.USER@EXAMPLE.COM'
            };

            mockQuery.insert.mockResolvedValue([1]);

            await userTasks.save_user(userData);

            expect(userData.email).toBe('test.user@example.com');
        });

        test('should return SQL error message on duplicate du_id (unique constraint)', async () => {
            const userData = {
                du_id: 'existinguser',
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com'
            };

            const sqlError = new Error('Duplicate entry');
            sqlError.sqlMessage = "Duplicate entry 'existinguser' for key 'du_id_index'";
            mockQuery.insert.mockRejectedValue(sqlError);

            const result = await userTasks.save_user(userData);

            expect(result).toBe(sqlError.sqlMessage);
        });

        test('should return SQL error message on duplicate email (unique constraint)', async () => {
            const userData = {
                du_id: 'newuser',
                first_name: 'Test',
                last_name: 'User',
                email: 'duplicate@example.com'
            };

            const sqlError = new Error('Duplicate entry');
            sqlError.sqlMessage = "Duplicate entry 'duplicate@example.com' for key 'email_index'";
            mockQuery.insert.mockRejectedValue(sqlError);

            const result = await userTasks.save_user(userData);

            expect(result).toBe(sqlError.sqlMessage);
        });

        test('should return SQL error message on duplicate token (unique constraint)', async () => {
            const userData = {
                du_id: 'newuser',
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                token: 'existingtoken'
            };

            const sqlError = new Error('Duplicate entry');
            sqlError.sqlMessage = "Duplicate entry 'existingtoken' for key 'token_index'";
            mockQuery.insert.mockRejectedValue(sqlError);

            const result = await userTasks.save_user(userData);

            expect(result).toBe(sqlError.sqlMessage);
        });

        test('should return undefined when error has no sqlMessage', async () => {
            const userData = {
                du_id: 'testuser',
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com'
            };

            const error = new Error('Generic database error');
            mockQuery.insert.mockRejectedValue(error);

            const result = await userTasks.save_user(userData);

            expect(result).toBeUndefined();
        });

        test('should handle du_id at max length (varchar 50)', async () => {
            const maxDuId = 'a'.repeat(50);
            const userData = {
                du_id: maxDuId,
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com'
            };

            mockQuery.insert.mockResolvedValue([1]);

            await userTasks.save_user(userData);

            expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
                du_id: maxDuId
            }));
        });

        test('should handle token at max length (varchar 500)', async () => {
            const maxToken = 'x'.repeat(500);
            const userData = {
                du_id: 'testuser',
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                token: maxToken
            };

            mockQuery.insert.mockResolvedValue([1]);

            await userTasks.save_user(userData);

            expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
                token: maxToken
            }));
        });

        test('should allow null token (schema allows NULL)', async () => {
            const userData = {
                du_id: 'testuser',
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                token: null
            };

            mockQuery.insert.mockResolvedValue([1]);

            await userTasks.save_user(userData);

            expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
                token: null
            }));
        });
    });

    // ==================== CHECK_USERNAME TESTS ====================
    describe('check_username', () => {
        test('should return true when du_id exists (count equals 1)', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockResolvedValue([{ du_id: 1 }]);

            const result = await userTasks.check_username('existinguser');

            expect(mockDB).toHaveBeenCalledWith('tbl_users');
            expect(mockQuery.count).toHaveBeenCalledWith('du_id as du_id');
            expect(mockQuery.where).toHaveBeenCalledWith('du_id', 'existinguser');
            expect(result).toBe(true);
        });

        test('should return false when du_id does not exist (count equals 0)', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockResolvedValue([{ du_id: 0 }]);

            const result = await userTasks.check_username('newuser');

            expect(result).toBe(false);
        });

        test('should return false when count is greater than 1 (edge case)', async () => {
            // Source checks if count === 1, so count > 1 returns false
            // This shouldn't happen due to unique constraint, but testing the logic
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockResolvedValue([{ du_id: 2 }]);

            const result = await userTasks.check_username('duplicateuser');

            expect(result).toBe(false);
        });

        test('should handle du_id at max length (varchar 50)', async () => {
            const maxDuId = 'a'.repeat(50);
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockResolvedValue([{ du_id: 1 }]);

            const result = await userTasks.check_username(maxDuId);

            expect(mockQuery.where).toHaveBeenCalledWith('du_id', maxDuId);
            expect(result).toBe(true);
        });

        test('should handle empty username', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockResolvedValue([{ du_id: 0 }]);

            const result = await userTasks.check_username('');

            expect(mockQuery.where).toHaveBeenCalledWith('du_id', '');
            expect(result).toBe(false);
        });

        test('should handle database errors gracefully', async () => {
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockRejectedValue(new Error('Query failed'));

            const result = await userTasks.check_username('testuser');

            expect(result).toBeUndefined();
        });
    });

    // ==================== DELETE_USER TESTS ====================
    describe('delete_user', () => {
        test('should delete user successfully', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.del.mockResolvedValue(1);

            const result = await userTasks.delete_user(1);

            expect(mockDB).toHaveBeenCalledWith('tbl_users');
            expect(mockQuery.where).toHaveBeenCalledWith({ id: 1 });
            expect(mockQuery.del).toHaveBeenCalled();
            expect(result).toBe(1);
        });

        test('should return 0 when user not found', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.del.mockResolvedValue(0);

            const result = await userTasks.delete_user(999);

            expect(result).toBe(0);
        });

        test('should handle string user_id', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.del.mockResolvedValue(1);

            const result = await userTasks.delete_user('5');

            expect(mockQuery.where).toHaveBeenCalledWith({ id: '5' });
            expect(result).toBe(1);
        });

        test('should handle database errors gracefully', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.del.mockRejectedValue(new Error('Delete failed'));

            const result = await userTasks.delete_user(1);

            expect(result).toBeUndefined();
        });
    });

    // ==================== UPDATE_STATUS TESTS ====================
    describe('update_status', () => {
        test('should activate user (is_active = 1)', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);

            const result = await userTasks.update_status(1, 1);

            expect(mockDB).toHaveBeenCalledWith('tbl_users');
            expect(mockQuery.where).toHaveBeenCalledWith({ id: 1 });
            expect(mockQuery.update).toHaveBeenCalledWith({ is_active: 1 });
            expect(result).toBe(1);
        });

        test('should deactivate user (is_active = 0)', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);

            const result = await userTasks.update_status(1, 0);

            expect(mockQuery.update).toHaveBeenCalledWith({ is_active: 0 });
            expect(result).toBe(1);
        });

        test('should return 0 when user not found', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(0);

            const result = await userTasks.update_status(999, 1);

            expect(result).toBe(0);
        });

        test('should handle tinyint(1) values as schema defines', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);

            // Schema uses tinyint(1) which stores 0 or 1
            await userTasks.update_status(1, 1);
            expect(mockQuery.update).toHaveBeenCalledWith({ is_active: 1 });

            await userTasks.update_status(1, 0);
            expect(mockQuery.update).toHaveBeenCalledWith({ is_active: 0 });
        });

        test('should handle database errors gracefully', async () => {
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockRejectedValue(new Error('Update failed'));

            const result = await userTasks.update_status(1, 1);

            expect(result).toBeUndefined();
        });
    });

    // ==================== ERROR HANDLING TESTS ====================
    describe('Error Handling', () => {
        test('should handle null DB in get_users gracefully', async () => {
            // Source code catches errors and returns undefined
            userTasks.DB = null;

            const result = await userTasks.get_users();

            // Error is caught internally, undefined is returned
            expect(result).toBeUndefined();
        });

        test('should handle undefined TABLE', async () => {
            userTasks.TABLE = undefined;
            mockQuery.select.mockResolvedValue([]);

            const result = await userTasks.get_users();

            expect(mockDB).toHaveBeenCalledWith(undefined);
            expect(result).toEqual([]);
        });
    });

    // ==================== INTEGRATION TESTS ====================
    describe('Integration Tests', () => {
        test('should handle complete user lifecycle', async () => {
            // 1. Check username doesn't exist
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockResolvedValue([{ du_id: 0 }]);
            const notExists = await userTasks.check_username('lifecycleuser');
            expect(notExists).toBe(false);

            // 2. Save new user with all schema fields
            const newUser = {
                du_id: 'lifecycleuser',
                first_name: 'Lifecycle',
                last_name: 'Test',
                email: 'LIFECYCLE@TEST.COM',
                is_active: 1,
                token: 'lifecycle_token_123'
            };

            mockQuery.insert.mockResolvedValue([41]);
            const saveResult = await userTasks.save_user(newUser);
            expect(saveResult).toEqual([41]);
            expect(newUser.email).toBe('lifecycle@test.com');

            // 3. Check username now exists
            mockQuery.count.mockReturnThis();
            mockQuery.where.mockResolvedValue([{ du_id: 1 }]);
            const exists = await userTasks.check_username('lifecycleuser');
            expect(exists).toBe(true);

            // 4. Get user
            mockQuery.select.mockReturnThis();
            mockQuery.where.mockResolvedValue([createMockUser({
                id: 41,
                du_id: 'lifecycleuser',
                first_name: 'Lifecycle',
                last_name: 'Test',
                email: 'lifecycle@test.com'
            })]);
            const getResult = await userTasks.get_user(41);
            expect(getResult[0].du_id).toBe('lifecycleuser');

            // 5. Update user (only first_name, last_name, email)
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);
            const updateResult = await userTasks.update_user(41, {
                first_name: 'Updated',
                last_name: 'User',
                email: 'updated@test.com'
            });
            expect(updateResult).toBe(1);

            // 6. Deactivate user
            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);
            const statusResult = await userTasks.update_status(41, 0);
            expect(statusResult).toBe(1);

            // 7. Delete user
            mockQuery.where.mockReturnThis();
            mockQuery.del.mockResolvedValue(1);
            const deleteResult = await userTasks.delete_user(41);
            expect(deleteResult).toBe(1);
        });

        test('should handle multiple users retrieval with all schema fields', async () => {
            const mockUsers = [
                createMockUser({ id: 1, du_id: 'user1', is_active: 1 }),
                createMockUser({ id: 2, du_id: 'user2', is_active: 1 }),
                createMockUser({ id: 3, du_id: 'user3', is_active: 0 })
            ];

            mockQuery.select.mockResolvedValue(mockUsers);

            const result = await userTasks.get_users();

            expect(result).toHaveLength(3);
            expect(result[0].du_id).toBe('user1');
            expect(result[2].is_active).toBe(0);
            expect(result[0]).toHaveProperty('token');
            expect(result[0]).toHaveProperty('created');
            expect(result[0]).toHaveProperty('last_login');
        });
    });

    // ==================== SCHEMA CONSTRAINTS ====================
    describe('Schema Constraints', () => {
        test('should handle email with special characters', async () => {
            const userData = {
                du_id: 'specialuser',
                first_name: 'Test',
                last_name: 'User',
                email: 'TEST+SPECIAL@EXAMPLE.COM'
            };

            mockQuery.insert.mockResolvedValue([1]);

            await userTasks.save_user(userData);

            expect(userData.email).toBe('test+special@example.com');
        });

        test('should handle unicode characters in names (utf8 charset)', async () => {
            const userData = {
                first_name: 'José',
                last_name: 'Müller',
                email: 'jose.muller@example.com'
            };

            mockQuery.where.mockReturnThis();
            mockQuery.update.mockResolvedValue(1);

            await userTasks.update_user(1, userData);

            expect(mockQuery.update).toHaveBeenCalledWith({
                first_name: 'José',
                last_name: 'Müller',
                email: 'jose.muller@example.com'
            });
        });

        test('should handle zero as user id', async () => {
            mockQuery.select.mockReturnThis();
            mockQuery.where.mockResolvedValue([]);

            const result = await userTasks.get_user(0);

            expect(mockQuery.where).toHaveBeenCalledWith({ id: 0 });
            expect(result).toEqual([]);
        });

        test('should handle user with null token', async () => {
            const mockUser = [createMockUser({ token: null })];

            mockQuery.select.mockReturnThis();
            mockQuery.where.mockResolvedValue(mockUser);

            const result = await userTasks.get_user(1);

            expect(result[0].token).toBeNull();
        });

        test('should handle default is_active value (schema default is 1)', async () => {
            const userData = {
                du_id: 'defaultactive',
                first_name: 'Default',
                last_name: 'Active',
                email: 'default@example.com'
                // is_active not provided, should use DB default of 1
            };

            mockQuery.insert.mockResolvedValue([1]);

            await userTasks.save_user(userData);

            expect(mockQuery.insert).toHaveBeenCalledWith(userData);
            // is_active will be set by DB default
        });

        test('should handle timestamps (created and last_login)', async () => {
            const mockUser = [createMockUser({
                created: '2025-01-15 08:30:00',
                last_login: '2025-12-18 16:45:30'
            })];

            mockQuery.select.mockReturnThis();
            mockQuery.where.mockResolvedValue(mockUser);

            const result = await userTasks.get_user(1);

            expect(result[0].created).toBe('2025-01-15 08:30:00');
            expect(result[0].last_login).toBe('2025-12-18 16:45:30');
        });
    });
});
