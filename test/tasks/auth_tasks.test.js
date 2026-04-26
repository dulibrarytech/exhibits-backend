/**
 * Auth Tasks Unit Tests
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// Mock LOGGER before requiring Auth_tasks
jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

const Auth_tasks = require('../../auth/tasks/auth_tasks');

describe('Auth_tasks', () => {

    let mockDB;
    let mockTable;
    let auth_tasks;

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

        mockTable = {
            user_records: 'tbl_users',
            exhibit_records: 'tbl_exhibits',
            item_records: 'tbl_items',
            heading_records: 'tbl_headings',
            grid_records: 'tbl_grids',
            grid_item_records: 'tbl_grid_items',
            timeline_records: 'tbl_timelines',
            timeline_item_records: 'tbl_timeline_items'
        };

        mockDB = jest.fn();
    });

    describe('constructor', () => {

        it('should initialize with DB and TABLE', () => {
            auth_tasks = new Auth_tasks(mockDB, mockTable);

            expect(auth_tasks.DB).toBe(mockDB);
            expect(auth_tasks.TABLE).toBe(mockTable);
        });
    });

    describe('check_auth_user', () => {

        beforeEach(() => {
            auth_tasks = new Auth_tasks(mockDB, mockTable);
        });

        it('should return auth false for null username', async () => {
            const result = await auth_tasks.check_auth_user(null);

            expect(result).toEqual({
                auth: false,
                data: null
            });
        });

        it('should return auth false for undefined username', async () => {
            const result = await auth_tasks.check_auth_user(undefined);

            expect(result).toEqual({
                auth: false,
                data: null
            });
        });

        it('should return auth false for non-string username', async () => {
            const result = await auth_tasks.check_auth_user(12345);

            expect(result).toEqual({
                auth: false,
                data: null
            });
        });

        it('should return auth true with user id for valid active user', async () => {
            const chainMock = createChainableMock([{ id: 42 }]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_auth_user('testuser');

            expect(result).toEqual({
                auth: true,
                data: 42
            });
            expect(mockDB).toHaveBeenCalledWith(mockTable.user_records);
            expect(chainMock.select).toHaveBeenCalledWith('id');
            expect(chainMock.where).toHaveBeenCalledWith({
                du_id: 'testuser',
                is_active: 1
            });
            expect(chainMock.limit).toHaveBeenCalledWith(1);
        });

        it('should return auth false when no user found', async () => {
            const chainMock = createChainableMock([]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_auth_user('nonexistent');

            expect(result).toEqual({
                auth: false,
                data: null
            });
        });

        it('should return auth false when multiple users found', async () => {
            const chainMock = createChainableMock([{ id: 1 }, { id: 2 }]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_auth_user('duplicateuser');

            expect(result).toEqual({
                auth: false,
                data: null
            });
        });

        it('should return auth false on database error', async () => {
            const chainMock = createChainableMock([]);
            chainMock.limit.mockRejectedValue(new Error('Database connection failed'));
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_auth_user('testuser');

            expect(result).toEqual({
                auth: false,
                data: null
            });
        });
    });

    describe('get_auth_user_data', () => {

        beforeEach(() => {
            auth_tasks = new Auth_tasks(mockDB, mockTable);
        });

        it('should return null for null id', async () => {
            const result = await auth_tasks.get_auth_user_data(null);

            expect(result).toBeNull();
        });

        it('should return null for undefined id', async () => {
            const result = await auth_tasks.get_auth_user_data(undefined);

            expect(result).toBeNull();
        });

        it('should return null for non-integer id', async () => {
            const result = await auth_tasks.get_auth_user_data('abc');

            expect(result).toBeNull();
        });

        it('should return null for zero id', async () => {
            const result = await auth_tasks.get_auth_user_data(0);

            expect(result).toBeNull();
        });

        it('should return null for negative id', async () => {
            const result = await auth_tasks.get_auth_user_data(-5);

            expect(result).toBeNull();
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
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_auth_user_data(1);

            expect(result).toEqual({
                id: 1,
                du_id: 'jdoe',
                email: 'jdoe@example.com',
                first_name: 'John',
                last_name: 'Doe'
            });
            expect(chainMock.select).toHaveBeenCalledWith('id', 'du_id', 'email', 'first_name', 'last_name');
            expect(chainMock.where).toHaveBeenCalledWith({
                id: 1,
                is_active: 1
            });
        });

        it('should handle string id that converts to valid integer', async () => {
            const mockUserData = [{
                id: 42,
                du_id: 'testuser',
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User'
            }];

            const chainMock = createChainableMock(mockUserData);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_auth_user_data('42');

            expect(result).toEqual({
                id: 42,
                du_id: 'testuser',
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User'
            });
        });

        it('should return null when user not found', async () => {
            const chainMock = createChainableMock([]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_auth_user_data(999);

            expect(result).toBeNull();
        });

        it('should return null when multiple users found', async () => {
            const chainMock = createChainableMock([{ id: 1 }, { id: 2 }]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_auth_user_data(1);

            expect(result).toBeNull();
        });

        it('should return null when user record missing required fields', async () => {
            const chainMock = createChainableMock([{ email: 'test@example.com' }]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_auth_user_data(1);

            expect(result).toBeNull();
        });

        it('should handle null optional fields', async () => {
            const mockUserData = [{
                id: 1,
                du_id: 'jdoe',
                email: null,
                first_name: null,
                last_name: null
            }];

            const chainMock = createChainableMock(mockUserData);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_auth_user_data(1);

            expect(result).toEqual({
                id: 1,
                du_id: 'jdoe',
                email: null,
                first_name: null,
                last_name: null
            });
        });

        it('should return null on database error', async () => {
            const chainMock = createChainableMock([]);
            chainMock.limit.mockRejectedValue(new Error('Database error'));
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_auth_user_data(1);

            expect(result).toBeNull();
        });
    });

    describe('save_token', () => {

        beforeEach(() => {
            auth_tasks = new Auth_tasks(mockDB, mockTable);
        });

        it('should return false for null user_id', async () => {
            const result = await auth_tasks.save_token(null, 'valid-token-string-12345');

            expect(result).toBe(false);
        });

        it('should return false for undefined user_id', async () => {
            const result = await auth_tasks.save_token(undefined, 'valid-token-string-12345');

            expect(result).toBe(false);
        });

        it('should return false for null token', async () => {
            const result = await auth_tasks.save_token(1, null);

            expect(result).toBe(false);
        });

        it('should return false for undefined token', async () => {
            const result = await auth_tasks.save_token(1, undefined);

            expect(result).toBe(false);
        });

        it('should return false for empty token', async () => {
            const result = await auth_tasks.save_token(1, '');

            expect(result).toBe(false);
        });

        it('should return false for non-integer user_id', async () => {
            const result = await auth_tasks.save_token('abc', 'valid-token-string-12345');

            expect(result).toBe(false);
        });

        it('should return false for zero user_id', async () => {
            const result = await auth_tasks.save_token(0, 'valid-token-string-12345');

            expect(result).toBe(false);
        });

        it('should return false for negative user_id', async () => {
            const result = await auth_tasks.save_token(-1, 'valid-token-string-12345');

            expect(result).toBe(false);
        });

        it('should return false for non-string token', async () => {
            const result = await auth_tasks.save_token(1, 12345);

            expect(result).toBe(false);
        });

        it('should return false for token too short', async () => {
            const result = await auth_tasks.save_token(1, 'short');

            expect(result).toBe(false);
        });

        it('should return false for token too long', async () => {
            const longToken = 'a'.repeat(2049);
            const result = await auth_tasks.save_token(1, longToken);

            expect(result).toBe(false);
        });

        it('should save token successfully', async () => {
            const chainMock = {
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockResolvedValue(1)
            };
            mockDB.mockReturnValue(chainMock);

            const validToken = 'valid-jwt-token-12345678901234567890';
            const result = await auth_tasks.save_token(1, validToken);

            expect(result).toBe(true);
            expect(mockDB).toHaveBeenCalledWith(mockTable.user_records);
            expect(chainMock.where).toHaveBeenCalledWith({ id: 1 });
            expect(chainMock.update).toHaveBeenCalledWith({ token: validToken });
        });

        it('should return false when no user found to update', async () => {
            const chainMock = {
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockResolvedValue(0)
            };
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.save_token(999, 'valid-jwt-token-12345678901234567890');

            expect(result).toBe(false);
        });

        it('should return false on database error', async () => {
            const chainMock = {
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockRejectedValue(new Error('Database error'))
            };
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.save_token(1, 'valid-jwt-token-12345678901234567890');

            expect(result).toBe(false);
        });
    });

    describe('get_user_id', () => {

        beforeEach(() => {
            auth_tasks = new Auth_tasks(mockDB, mockTable);
        });

        it('should return null for null token', async () => {
            const result = await auth_tasks.get_user_id(null);

            expect(result).toBeNull();
        });

        it('should return null for undefined token', async () => {
            const result = await auth_tasks.get_user_id(undefined);

            expect(result).toBeNull();
        });

        it('should return null for empty token', async () => {
            const result = await auth_tasks.get_user_id('');

            expect(result).toBeNull();
        });

        it('should return null for non-string token', async () => {
            const result = await auth_tasks.get_user_id(12345);

            expect(result).toBeNull();
        });

        it('should return null for token too short', async () => {
            const result = await auth_tasks.get_user_id('short');

            expect(result).toBeNull();
        });

        it('should return null for token too long', async () => {
            const longToken = 'a'.repeat(2049);
            const result = await auth_tasks.get_user_id(longToken);

            expect(result).toBeNull();
        });

        it('should return user_id for valid token', async () => {
            const chainMock = createChainableMock([{ id: 42 }]);
            mockDB.mockReturnValue(chainMock);

            const validToken = 'valid-jwt-token-12345678901234567890';
            const result = await auth_tasks.get_user_id(validToken);

            expect(result).toBe(42);
            expect(mockDB).toHaveBeenCalledWith(mockTable.user_records);
            expect(chainMock.select).toHaveBeenCalledWith('id');
            expect(chainMock.where).toHaveBeenCalledWith({ token: validToken });
        });

        it('should return null when no user found with token', async () => {
            const chainMock = createChainableMock([]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_user_id('valid-jwt-token-12345678901234567890');

            expect(result).toBeNull();
        });

        it('should return null when user record missing id', async () => {
            const chainMock = createChainableMock([{ email: 'test@example.com' }]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_user_id('valid-jwt-token-12345678901234567890');

            expect(result).toBeNull();
        });

        it('should return null on database error', async () => {
            const chainMock = createChainableMock([]);
            chainMock.limit.mockRejectedValue(new Error('Database error'));
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_user_id('valid-jwt-token-12345678901234567890');

            expect(result).toBeNull();
        });
    });

    describe('get_user_permissions', () => {

        beforeEach(() => {
            auth_tasks = new Auth_tasks(mockDB, mockTable);
        });

        it('should return null for null token', async () => {
            const result = await auth_tasks.get_user_permissions(null);

            expect(result).toBeNull();
        });

        it('should return null for undefined token', async () => {
            const result = await auth_tasks.get_user_permissions(undefined);

            expect(result).toBeNull();
        });

        it('should return null for empty token', async () => {
            const result = await auth_tasks.get_user_permissions('');

            expect(result).toBeNull();
        });

        it('should return null for non-string token', async () => {
            const result = await auth_tasks.get_user_permissions(12345);

            expect(result).toBeNull();
        });

        it('should return null for token too short', async () => {
            const result = await auth_tasks.get_user_permissions('short');

            expect(result).toBeNull();
        });

        it('should return null for token too long', async () => {
            const longToken = 'a'.repeat(2049);
            const result = await auth_tasks.get_user_permissions(longToken);

            expect(result).toBeNull();
        });

        it('should return permissions for valid token', async () => {
            const mockPermissions = [
                { id: 1, is_active: 1, role_id: 1, permission_id: 1 },
                { id: 1, is_active: 1, role_id: 1, permission_id: 2 }
            ];

            // For complex join queries, mock the DB function itself
            mockDB.select = jest.fn().mockReturnThis();
            mockDB.from = jest.fn().mockReturnThis();
            mockDB.leftJoin = jest.fn().mockReturnThis();
            mockDB.where = jest.fn().mockReturnThis();
            mockDB.andWhere = jest.fn().mockResolvedValue(mockPermissions);

            const validToken = 'valid-jwt-token-12345678901234567890';
            const result = await auth_tasks.get_user_permissions(validToken);

            expect(result).toEqual(mockPermissions);
            expect(mockDB.select).toHaveBeenCalledWith(
                'u.id',
                'u.is_active',
                'ur.role_id',
                'rp.permission_id'
            );
            expect(mockDB.from).toHaveBeenCalledWith('tbl_users AS u');
        });

        it('should return empty array when no user found', async () => {
            mockDB.select = jest.fn().mockReturnThis();
            mockDB.from = jest.fn().mockReturnThis();
            mockDB.leftJoin = jest.fn().mockReturnThis();
            mockDB.where = jest.fn().mockReturnThis();
            mockDB.andWhere = jest.fn().mockResolvedValue([]);

            const result = await auth_tasks.get_user_permissions('valid-jwt-token-12345678901234567890');

            expect(result).toEqual([]);
        });

        it('should filter out permissions without permission_id', async () => {
            const mockPermissions = [
                { id: 1, is_active: 1, role_id: 1, permission_id: 1 },
                { id: 1, is_active: 1, role_id: 1, permission_id: null }
            ];

            mockDB.select = jest.fn().mockReturnThis();
            mockDB.from = jest.fn().mockReturnThis();
            mockDB.leftJoin = jest.fn().mockReturnThis();
            mockDB.where = jest.fn().mockReturnThis();
            mockDB.andWhere = jest.fn().mockResolvedValue(mockPermissions);

            const result = await auth_tasks.get_user_permissions('valid-jwt-token-12345678901234567890');

            expect(result).toHaveLength(1);
            expect(result[0].permission_id).toBe(1);
        });

        it('should return null on database error', async () => {
            mockDB.select = jest.fn().mockReturnThis();
            mockDB.from = jest.fn().mockReturnThis();
            mockDB.leftJoin = jest.fn().mockReturnThis();
            mockDB.where = jest.fn().mockReturnThis();
            mockDB.andWhere = jest.fn().mockRejectedValue(new Error('Database error'));

            const result = await auth_tasks.get_user_permissions('valid-jwt-token-12345678901234567890');

            expect(result).toBeNull();
        });
    });

    describe('get_permissions', () => {

        beforeEach(() => {
            auth_tasks = new Auth_tasks(mockDB, mockTable);
        });

        it('should return all permissions', async () => {
            const mockPermissions = [
                { id: 1, permission: 'read' },
                { id: 2, permission: 'write' },
                { id: 3, permission: 'delete' }
            ];

            const chainMock = {
                select: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockResolvedValue(mockPermissions)
            };
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_permissions();

            expect(result).toEqual(mockPermissions);
            expect(mockDB).toHaveBeenCalledWith('tbl_user_permissions');
            expect(chainMock.select).toHaveBeenCalledWith('id', 'permission');
            expect(chainMock.orderBy).toHaveBeenCalledWith('permission', 'asc');
        });

        it('should return empty array when no permissions exist', async () => {
            const chainMock = {
                select: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockResolvedValue([])
            };
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_permissions();

            expect(result).toEqual([]);
        });

        it('should filter out invalid permission objects', async () => {
            const mockPermissions = [
                { id: 1, permission: 'read' },
                null,
                { id: 2, permission: 'write' },
                { id: null, permission: 'invalid' },
                { id: 3, permission: '' }
            ];

            const chainMock = {
                select: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockResolvedValue(mockPermissions)
            };
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_permissions();

            expect(result).toHaveLength(2);
            expect(result[0].permission).toBe('read');
            expect(result[1].permission).toBe('write');
        });

        it('should return null on database error', async () => {
            const chainMock = {
                select: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockRejectedValue(new Error('Database error'))
            };
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.get_permissions();

            expect(result).toBeNull();
        });
    });

    describe('check_ownership', () => {

        beforeEach(() => {
            auth_tasks = new Auth_tasks(mockDB, mockTable);
        });

        const validUUID = '12345678-1234-1234-1234-123456789012';
        const validChildUUID = '87654321-4321-4321-4321-210987654321';

        it('should return 0 for null user_id', async () => {
            const result = await auth_tasks.check_ownership(null, validUUID, validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for undefined user_id', async () => {
            const result = await auth_tasks.check_ownership(undefined, validUUID, validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for non-integer user_id', async () => {
            const result = await auth_tasks.check_ownership('abc', validUUID, validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for zero user_id', async () => {
            const result = await auth_tasks.check_ownership(0, validUUID, validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for negative user_id', async () => {
            const result = await auth_tasks.check_ownership(-1, validUUID, validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for missing parent_id', async () => {
            const result = await auth_tasks.check_ownership(1, null, validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for non-string parent_id', async () => {
            const result = await auth_tasks.check_ownership(1, 12345, validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for invalid parent_id UUID format', async () => {
            const result = await auth_tasks.check_ownership(1, 'not-a-uuid', validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for invalid child_id UUID format', async () => {
            const result = await auth_tasks.check_ownership(1, validUUID, 'not-a-uuid', 'item');

            expect(result).toBe(0);
        });

        it('should return 0 for missing record_type', async () => {
            const result = await auth_tasks.check_ownership(1, validUUID, validChildUUID, null);

            expect(result).toBe(0);
        });

        it('should return 0 for invalid record_type', async () => {
            const result = await auth_tasks.check_ownership(1, validUUID, validChildUUID, 'invalid_type');

            expect(result).toBe(0);
        });

        it('should return exhibit owner when no child_id provided', async () => {
            const chainMock = createChainableMock([{ owner: 5 }]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_ownership(1, validUUID, null, 'item');

            expect(result).toBe(5);
            expect(mockDB).toHaveBeenCalledWith(mockTable.exhibit_records);
            expect(chainMock.where).toHaveBeenCalledWith({ uuid: validUUID });
        });

        it('should return exhibit owner for exhibit record type', async () => {
            const chainMock = createChainableMock([{ owner: 5 }]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_ownership(1, validUUID, validChildUUID, 'exhibit');

            expect(result).toBe(5);
        });

        it('should return 0 when exhibit not found', async () => {
            const chainMock = createChainableMock([]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_ownership(1, validUUID, null, 'item');

            expect(result).toBe(0);
        });

        it('should check child record ownership for valid record types', async () => {
            // Mock for both exhibit and child queries
            const exhibitChain = createChainableMock([{ owner: 5 }]);
            const childChain = createChainableMock([{ owner: 5 }]);

            mockDB.mockImplementation((table) => {
                if (table === mockTable.exhibit_records) {
                    return exhibitChain;
                }
                return childChain;
            });

            const result = await auth_tasks.check_ownership(5, validUUID, validChildUUID, 'item');

            expect(result).toBe(5);
        });

        it('should return child owner when child owned by current user', async () => {
            // Setup for Promise.all pattern
            const exhibitChain = createChainableMock([{ owner: 10 }]);
            const childChain = createChainableMock([{ owner: 5 }]);

            mockDB.mockImplementation((table) => {
                if (table === mockTable.exhibit_records) {
                    return exhibitChain;
                }
                return childChain;
            });

            const result = await auth_tasks.check_ownership(5, validUUID, validChildUUID, 'item');

            expect(result).toBe(5);
        });

        it('should return exhibit owner when current user is exhibit owner', async () => {
            const exhibitChain = createChainableMock([{ owner: 5 }]);
            const childChain = createChainableMock([{ owner: 10 }]);

            mockDB.mockImplementation((table) => {
                if (table === mockTable.exhibit_records) {
                    return exhibitChain;
                }
                return childChain;
            });

            const result = await auth_tasks.check_ownership(5, validUUID, validChildUUID, 'item');

            expect(result).toBe(5);
        });

        it('should return exhibit owner when child not found', async () => {
            const exhibitChain = createChainableMock([{ owner: 5 }]);
            const childChain = createChainableMock([]);

            mockDB.mockImplementation((table) => {
                if (table === mockTable.exhibit_records) {
                    return exhibitChain;
                }
                return childChain;
            });

            const result = await auth_tasks.check_ownership(5, validUUID, validChildUUID, 'item');

            expect(result).toBe(5);
        });

        it('should return 0 when no ownership match found', async () => {
            const exhibitChain = createChainableMock([{ owner: 10 }]);
            const childChain = createChainableMock([{ owner: 20 }]);

            mockDB.mockImplementation((table) => {
                if (table === mockTable.exhibit_records) {
                    return exhibitChain;
                }
                return childChain;
            });

            const result = await auth_tasks.check_ownership(5, validUUID, validChildUUID, 'item');

            expect(result).toBe(0);
        });

        it('should return 0 on database error', async () => {
            const chainMock = createChainableMock([]);
            chainMock.limit.mockRejectedValue(new Error('Database error'));
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_ownership(1, validUUID, null, 'item');

            expect(result).toBe(0);
        });

        it('should handle all valid record types', async () => {
            const recordTypes = ['item', 'heading', 'grid', 'grid_item', 'timeline', 'timeline_item', 'exhibit'];

            for (const recordType of recordTypes) {
                const chainMock = createChainableMock([{ owner: 5 }]);
                mockDB.mockReturnValue(chainMock);

                const result = await auth_tasks.check_ownership(5, validUUID, validChildUUID, recordType);

                expect(result).toBe(5);
            }
        });

        it('should normalize record type case', async () => {
            const chainMock = createChainableMock([{ owner: 5 }]);
            mockDB.mockReturnValue(chainMock);

            const result = await auth_tasks.check_ownership(5, validUUID, validChildUUID, 'ITEM');

            expect(result).toBe(5);
        });
    });
});
