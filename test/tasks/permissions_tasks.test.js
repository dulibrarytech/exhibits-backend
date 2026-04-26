/**
 * Permissions Tasks Unit Tests
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// Mock LOGGER before requiring Permissions_tasks
jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

const Permissions_tasks = require('../../auth/tasks/permissions_tasks');

describe('Permissions_tasks', () => {

    let mockDB;
    let mockTable;
    let permissions_tasks;

    // Helper to create chainable mock
    const createChainableMock = (resolvedValue) => {
        const mock = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(resolvedValue),
            insert: jest.fn().mockResolvedValue(resolvedValue),
            update: jest.fn().mockResolvedValue(resolvedValue),
            orderBy: jest.fn().mockResolvedValue(resolvedValue),
            from: jest.fn().mockReturnThis(),
            leftJoin: jest.fn().mockReturnThis()
        };
        return mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockTable = 'tbl_users';

        mockDB = jest.fn();
    });

    describe('constructor', () => {

        it('should initialize with DB and TABLE', () => {
            permissions_tasks = new Permissions_tasks(mockDB, mockTable);

            expect(permissions_tasks.DB).toBe(mockDB);
            expect(permissions_tasks.TABLE).toBe(mockTable);
        });
    });

    describe('get_role_permissions', () => {

        beforeEach(() => {
            permissions_tasks = new Permissions_tasks(mockDB, mockTable);
        });

        it('should log the role parameter', async () => {
            // The method is a TODO that just logs
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await permissions_tasks.get_role_permissions('admin');

            expect(consoleSpy).toHaveBeenCalledWith('admin');

            consoleSpy.mockRestore();
        });

        it('should handle null role', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await permissions_tasks.get_role_permissions(null);

            expect(consoleSpy).toHaveBeenCalledWith(null);

            consoleSpy.mockRestore();
        });

        it('should handle undefined role', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await permissions_tasks.get_role_permissions(undefined);

            expect(consoleSpy).toHaveBeenCalledWith(undefined);

            consoleSpy.mockRestore();
        });

        it('should handle numeric role', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await permissions_tasks.get_role_permissions(1);

            expect(consoleSpy).toHaveBeenCalledWith(1);

            consoleSpy.mockRestore();
        });

        it('should handle object role', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const roleObj = { id: 1, name: 'admin' };
            await permissions_tasks.get_role_permissions(roleObj);

            expect(consoleSpy).toHaveBeenCalledWith(roleObj);

            consoleSpy.mockRestore();
        });
    });

    describe('get_auth_user_data', () => {

        beforeEach(() => {
            permissions_tasks = new Permissions_tasks(mockDB, mockTable);
        });

        it('should return user data for valid id', async () => {
            const mockUserData = [{
                id: 1,
                du_id: 'jdoe',
                email: 'jdoe@example.com',
                first_name: 'John',
                last_name: 'Doe'
            }];

            const chainMock = createChainableMock(mockUserData);
            // Override to resolve at where() instead of limit()
            chainMock.where = jest.fn().mockResolvedValue(mockUserData);
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data(1);

            expect(result).toEqual({
                data: mockUserData
            });
            expect(mockDB).toHaveBeenCalledWith(mockTable);
            expect(chainMock.select).toHaveBeenCalledWith('id', 'du_id', 'email', 'first_name', 'last_name');
            expect(chainMock.where).toHaveBeenCalledWith({
                id: 1,
                is_active: 1
            });
        });

        it('should return false when no user found', async () => {
            const chainMock = createChainableMock([]);
            chainMock.where = jest.fn().mockResolvedValue([]);
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data(999);

            expect(result).toBe(false);
        });

        it('should return false when multiple users found', async () => {
            const mockUserData = [
                { id: 1, du_id: 'user1' },
                { id: 2, du_id: 'user2' }
            ];

            const chainMock = createChainableMock(mockUserData);
            chainMock.where = jest.fn().mockResolvedValue(mockUserData);
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data(1);

            expect(result).toBe(false);
        });

        it('should handle database error gracefully', async () => {
            const chainMock = createChainableMock([]);
            chainMock.where = jest.fn().mockRejectedValue(new Error('Database connection failed'));
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data(1);

            // Method doesn't return anything on error (undefined)
            expect(result).toBeUndefined();
        });

        it('should query with correct parameters', async () => {
            const mockUserData = [{
                id: 42,
                du_id: 'testuser',
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User'
            }];

            const chainMock = createChainableMock(mockUserData);
            chainMock.where = jest.fn().mockResolvedValue(mockUserData);
            mockDB.mockReturnValue(chainMock);

            await permissions_tasks.get_auth_user_data(42);

            expect(chainMock.where).toHaveBeenCalledWith({
                id: 42,
                is_active: 1
            });
        });

        it('should handle string id parameter', async () => {
            const mockUserData = [{
                id: 1,
                du_id: 'jdoe',
                email: 'jdoe@example.com',
                first_name: 'John',
                last_name: 'Doe'
            }];

            const chainMock = createChainableMock(mockUserData);
            chainMock.where = jest.fn().mockResolvedValue(mockUserData);
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data('1');

            expect(result).toEqual({
                data: mockUserData
            });
            // Note: The method passes the id directly without conversion
            expect(chainMock.where).toHaveBeenCalledWith({
                id: '1',
                is_active: 1
            });
        });

        it('should return user data with all fields populated', async () => {
            const mockUserData = [{
                id: 1,
                du_id: 'admin_user',
                email: 'admin@du.edu',
                first_name: 'Admin',
                last_name: 'User'
            }];

            const chainMock = createChainableMock(mockUserData);
            chainMock.where = jest.fn().mockResolvedValue(mockUserData);
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data(1);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toHaveProperty('id', 1);
            expect(result.data[0]).toHaveProperty('du_id', 'admin_user');
            expect(result.data[0]).toHaveProperty('email', 'admin@du.edu');
            expect(result.data[0]).toHaveProperty('first_name', 'Admin');
            expect(result.data[0]).toHaveProperty('last_name', 'User');
        });

        it('should return user data with null optional fields', async () => {
            const mockUserData = [{
                id: 1,
                du_id: 'minimal_user',
                email: null,
                first_name: null,
                last_name: null
            }];

            const chainMock = createChainableMock(mockUserData);
            chainMock.where = jest.fn().mockResolvedValue(mockUserData);
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data(1);

            expect(result).toEqual({
                data: mockUserData
            });
        });

        it('should handle zero id', async () => {
            const chainMock = createChainableMock([]);
            chainMock.where = jest.fn().mockResolvedValue([]);
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data(0);

            expect(result).toBe(false);
        });

        it('should handle negative id', async () => {
            const chainMock = createChainableMock([]);
            chainMock.where = jest.fn().mockResolvedValue([]);
            mockDB.mockReturnValue(chainMock);

            const result = await permissions_tasks.get_auth_user_data(-1);

            expect(result).toBe(false);
        });
    });
});

describe('Permissions_tasks Edge Cases', () => {

    let mockDB;
    let mockTable;
    let permissions_tasks;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTable = 'tbl_users';
        mockDB = jest.fn();
    });

    describe('concurrent access', () => {

        it('should handle multiple simultaneous get_auth_user_data calls', async () => {
            permissions_tasks = new Permissions_tasks(mockDB, mockTable);

            const mockUser1 = [{ id: 1, du_id: 'user1', email: 'user1@example.com', first_name: 'User', last_name: 'One' }];
            const mockUser2 = [{ id: 2, du_id: 'user2', email: 'user2@example.com', first_name: 'User', last_name: 'Two' }];

            let callCount = 0;
            mockDB.mockImplementation(() => {
                callCount++;
                const currentCall = callCount;
                return {
                    select: jest.fn().mockReturnThis(),
                    where: jest.fn().mockResolvedValue(currentCall === 1 ? mockUser1 : mockUser2)
                };
            });

            const [result1, result2] = await Promise.all([
                permissions_tasks.get_auth_user_data(1),
                permissions_tasks.get_auth_user_data(2)
            ]);

            expect(result1).toEqual({ data: mockUser1 });
            expect(result2).toEqual({ data: mockUser2 });
        });
    });

    describe('data integrity', () => {

        it('should preserve original data structure', async () => {
            permissions_tasks = new Permissions_tasks(mockDB, mockTable);

            const originalData = [{
                id: 1,
                du_id: 'testuser',
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User',
                extra_field: 'should be included'
            }];

            mockDB.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockResolvedValue(originalData)
            });

            const result = await permissions_tasks.get_auth_user_data(1);

            // The method returns whatever the DB returns wrapped in data
            expect(result.data).toEqual(originalData);
        });
    });

    describe('different table configurations', () => {

        it('should work with different table names', async () => {
            const customTable = 'custom_users_table';
            permissions_tasks = new Permissions_tasks(mockDB, customTable);

            const mockUserData = [{ id: 1, du_id: 'user', email: 'user@example.com', first_name: 'Test', last_name: 'User' }];

            mockDB.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockResolvedValue(mockUserData)
            });

            await permissions_tasks.get_auth_user_data(1);

            expect(mockDB).toHaveBeenCalledWith(customTable);
        });

        it('should handle table object configuration', async () => {
            const tableConfig = { users: 'tbl_users', roles: 'tbl_roles' };
            permissions_tasks = new Permissions_tasks(mockDB, tableConfig);

            expect(permissions_tasks.TABLE).toEqual(tableConfig);
        });
    });
});
