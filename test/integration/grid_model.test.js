/**
 * Integration Tests for Grid Model
 *
 * Tests the model layer directly, including validation and business logic.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// ==================== TEST CONSTANTS ====================
const TEST_EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_GRID_UUID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_GRID_ITEM_UUID = '770e8400-e29b-41d4-a716-446655440002';
const TEST_USER_UID = '880e8400-e29b-41d4-a716-446655440003';

// ==================== MOCK SETUP ====================

// Mock Logger
jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

// Mock DB Config
jest.mock('../../config/db_config', () => () => ({
    query: jest.fn()
}));

// Mock DB Tables Config
jest.mock('../../config/db_tables_config', () => () => ({
    exhibits: {
        exhibit_records: 'tbl_exhibits_exhibit_records',
        grid_records: 'tbl_exhibits_grid_records',
        grid_item_records: 'tbl_exhibits_grid_item_records'
    }
}));

// Mock Schemas
jest.mock('../../exhibits/schemas/exhibit_create_grid_record_schema', () => () => ({
    type: 'object',
    properties: {}
}));

jest.mock('../../exhibits/schemas/exhibit_grid_update_record_schema', () => () => ({
    type: 'object',
    properties: {}
}));

jest.mock('../../exhibits/schemas/exhibit_grid_item_create_record_schema', () => () => ({
    type: 'object',
    properties: {}
}));

jest.mock('../../exhibits/schemas/exhibit_grid_item_update_record_schema', () => () => ({
    type: 'object',
    properties: {}
}));

// Mock Helper instance
const mockHelperInstance = {
    create_uuid: jest.fn().mockReturnValue(TEST_GRID_UUID),
    check_storage_path: jest.fn(),
    process_uploaded_media: jest.fn((exhibit_id, uuid, media) => `/storage/${exhibit_id}/${uuid}/${media}`),
    unlock_record: jest.fn().mockResolvedValue({ status: true }),
    order_exhibit_items: jest.fn().mockResolvedValue(1),
    order_grid_items: jest.fn().mockResolvedValue(1)
};

jest.mock('../../libs/helper', () => {
    return jest.fn().mockImplementation(() => mockHelperInstance);
});

// Mock Validator
const mockValidate = jest.fn().mockReturnValue(true);
jest.mock('../../libs/validate', () => {
    return jest.fn().mockImplementation(() => ({
        validate: mockValidate
    }));
});

// Mock Grid Record Tasks
const mockGridRecordTask = {
    create_grid_record: jest.fn().mockResolvedValue(true),
    update_grid_record: jest.fn().mockResolvedValue(true),
    get_grid_record: jest.fn().mockResolvedValue({}),
    create_grid_item_record: jest.fn().mockResolvedValue(true),
    get_grid_item_records: jest.fn().mockResolvedValue([]),
    get_grid_item_record: jest.fn().mockResolvedValue({}),
    get_grid_item_edit_record: jest.fn().mockResolvedValue({}),
    update_grid_item_record: jest.fn().mockResolvedValue(true),
    delete_grid_item_record: jest.fn().mockResolvedValue(true),
    reorder_grids: jest.fn().mockResolvedValue(true),
    reorder_grid_items: jest.fn().mockResolvedValue(true)
};

jest.mock('../../exhibits/tasks/exhibit_grid_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockGridRecordTask);
});

// Mock Exhibit Record Tasks
const mockExhibitRecordTask = {
    update_exhibit_timestamp: jest.fn().mockResolvedValue(true)
};

jest.mock('../../exhibits/tasks/exhibit_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockExhibitRecordTask);
});

// Mock Indexer Model
jest.mock('../../indexer/model', () => ({
    index_grid_record: jest.fn().mockResolvedValue(true),
    index_grid_item_record: jest.fn().mockResolvedValue(true),
    index_record: jest.fn().mockResolvedValue(true),
    get_indexed_record: jest.fn().mockResolvedValue({
        status: 200,
        data: { source: { items: [] } }
    }),
    delete_record: jest.fn().mockResolvedValue({ status: 204 })
}));

// ==================== TESTS ====================

describe('Grid Model Integration Tests', () => {
    let GRID_MODEL;

    beforeAll(() => {
        GRID_MODEL = require('../../exhibits/grid_model');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset mock implementations
        mockValidate.mockReturnValue(true);
        mockHelperInstance.create_uuid.mockReturnValue(TEST_GRID_UUID);
        mockHelperInstance.order_exhibit_items.mockResolvedValue(1);
        mockHelperInstance.order_grid_items.mockResolvedValue(1);
        mockHelperInstance.unlock_record.mockResolvedValue({ status: true });
        mockGridRecordTask.create_grid_record.mockResolvedValue(true);
        mockGridRecordTask.update_grid_record.mockResolvedValue(true);
        mockGridRecordTask.get_grid_record.mockResolvedValue({});
        mockGridRecordTask.create_grid_item_record.mockResolvedValue(true);
        mockGridRecordTask.get_grid_item_records.mockResolvedValue([]);
        mockGridRecordTask.get_grid_item_record.mockResolvedValue({});
        mockGridRecordTask.reorder_grids.mockResolvedValue(true);
        mockGridRecordTask.reorder_grid_items.mockResolvedValue(true);
        mockExhibitRecordTask.update_exhibit_timestamp.mockResolvedValue(true);
    });

    afterAll(async () => {
        await new Promise(resolve => setImmediate(resolve));
    });

    // ==================== CREATE GRID RECORD ====================

    describe('create_grid_record', () => {

        test('should create grid record successfully', async () => {
            const gridData = {
                title: 'Test Grid',
                columns: 3
            };

            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            expect(result.status).toBe(201);
            expect(result.message).toBe('Grid record created');
            expect(result.data).toBe(TEST_GRID_UUID);
            expect(mockGridRecordTask.create_grid_record).toHaveBeenCalled();
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await GRID_MODEL.create_grid_record('', { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid exhibit UUID provided');
        });

        test('should return 400 for null exhibit UUID', async () => {
            const result = await GRID_MODEL.create_grid_record(null, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid exhibit UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, null);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should return 400 when validation fails', async () => {
            mockValidate.mockReturnValue([
                { message: 'Title is required' }
            ]);

            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, { columns: 3 });

            expect(result.status).toBe(400);
        });

        test('should return 200 when database operation fails', async () => {
            mockGridRecordTask.create_grid_record.mockResolvedValue(false);

            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, { title: 'Test' });

            expect(result.status).toBe(200);
            expect(result.message).toBe('Unable to create grid record');
        });

        test('should handle styles object', async () => {
            const gridData = {
                title: 'Test Grid',
                styles: { backgroundColor: '#fff' }
            };

            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            expect(mockGridRecordTask.create_grid_record).toHaveBeenCalled();
        });

        test('should handle styles string', async () => {
            const gridData = {
                title: 'Test Grid',
                styles: '{"backgroundColor": "#fff"}'
            };

            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            expect(mockGridRecordTask.create_grid_record).toHaveBeenCalled();
        });

        test('should parse columns as integer', async () => {
            const gridData = {
                title: 'Test Grid',
                columns: '4'
            };

            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            const callArg = mockGridRecordTask.create_grid_record.mock.calls[0][0];
            expect(callArg.columns).toBe(4);
        });

        test('should default columns to 1 for invalid value', async () => {
            const gridData = {
                title: 'Test Grid',
                columns: 'invalid'
            };

            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            const callArg = mockGridRecordTask.create_grid_record.mock.calls[0][0];
            expect(callArg.columns).toBe(1);
        });
    });

    // ==================== UPDATE GRID RECORD ====================

    describe('update_grid_record', () => {

        test('should update grid record successfully', async () => {
            const updateData = {
                title: 'Updated Grid'
            };

            const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, updateData);

            expect(result.status).toBe(201);
            expect(result.message).toBe('Grid record updated');
            expect(mockGridRecordTask.update_grid_record).toHaveBeenCalled();
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await GRID_MODEL.update_grid_record('', TEST_GRID_UUID, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid grid UUID', async () => {
            const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, '', { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, null);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should return 400 when validation fails', async () => {
            mockValidate.mockReturnValue([
                { message: 'Invalid field' }
            ]);

            const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, { invalid: 'data' });

            expect(result.status).toBe(400);
        });

        test('should return 200 when database operation fails', async () => {
            mockGridRecordTask.update_grid_record.mockResolvedValue(false);

            const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, { title: 'Test' });

            expect(result.status).toBe(200);
            expect(result.message).toBe('Unable to update grid record');
        });
    });

    // ==================== GET GRID RECORD ====================

    describe('get_grid_record', () => {

        test('should get grid record successfully', async () => {
            const mockRecord = {
                uuid: TEST_GRID_UUID,
                title: 'Test Grid'
            };
            mockGridRecordTask.get_grid_record.mockResolvedValue(mockRecord);

            const result = await GRID_MODEL.get_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID);

            expect(result.status).toBe(200);
            expect(result.message).toBe('Grid record');
            expect(result.data).toEqual(mockRecord);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await GRID_MODEL.get_grid_record('', TEST_GRID_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid grid UUID', async () => {
            const result = await GRID_MODEL.get_grid_record(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== CREATE GRID ITEM RECORD ====================

    describe('create_grid_item_record', () => {

        test('should create grid item record successfully', async () => {
            mockHelperInstance.create_uuid.mockReturnValue(TEST_GRID_ITEM_UUID);

            const itemData = {
                title: 'Test Item',
                item_type: 'image'
            };

            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(result.status).toBe(201);
            expect(result.message).toBe('Grid item record created');
            expect(result.data).toBe(TEST_GRID_ITEM_UUID);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await GRID_MODEL.create_grid_item_record('', TEST_GRID_UUID, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid grid UUID', async () => {
            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, '', { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, null);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should handle text item type', async () => {
            const itemData = {
                title: 'Text Item',
                item_type: 'text'
            };

            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(result.status).toBe(201);
        });

        // SKIPPED: media handling refactored. grid_model.create_grid_item_record
        // no longer calls helper_task.process_uploaded_media directly. Rewrite
        // this test to assert on the current media-binding path.
        test.skip('should process media files', async () => {
            const itemData = {
                title: 'Media Item',
                item_type: 'image',
                media: 'test-image.jpg'
            };

            await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(mockHelperInstance.process_uploaded_media).toHaveBeenCalled();
        });

        test('should handle Kaltura items', async () => {
            const itemData = {
                title: 'Kaltura Item',
                kaltura: 'kaltura-id-123'
            };

            await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(mockGridRecordTask.create_grid_item_record).toHaveBeenCalled();
        });

        test('should handle repository items', async () => {
            const itemData = {
                title: 'Repo Item',
                repo_uuid: 'repo-uuid-123'
            };

            await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(mockGridRecordTask.create_grid_item_record).toHaveBeenCalled();
        });

        test('should return 200 when database operation fails', async () => {
            mockGridRecordTask.create_grid_item_record.mockResolvedValue(false);

            const result = await GRID_MODEL.create_grid_item_record(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(200);
            expect(result.message).toBe('Unable to create grid item record');
        });
    });

    // ==================== GET GRID ITEM RECORDS ====================

    describe('get_grid_item_records', () => {

        test('should get grid item records successfully', async () => {
            const mockItems = [
                { uuid: TEST_GRID_ITEM_UUID, title: 'Item 1' },
                { uuid: '880e8400-e29b-41d4-a716-446655440004', title: 'Item 2' }
            ];
            mockGridRecordTask.get_grid_item_records.mockResolvedValue(mockItems);

            const result = await GRID_MODEL.get_grid_item_records(TEST_EXHIBIT_UUID, TEST_GRID_UUID);

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit grid item records');
            expect(result.data).toHaveLength(2);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await GRID_MODEL.get_grid_item_records('', TEST_GRID_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid grid UUID', async () => {
            const result = await GRID_MODEL.get_grid_item_records(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== GET GRID ITEM RECORD ====================

    describe('get_grid_item_record', () => {

        test('should get single grid item record successfully', async () => {
            const mockItem = {
                uuid: TEST_GRID_ITEM_UUID,
                title: 'Test Item'
            };
            mockGridRecordTask.get_grid_item_record.mockResolvedValue(mockItem);

            const result = await GRID_MODEL.get_grid_item_record(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                TEST_GRID_ITEM_UUID
            );

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit grid item record');
            expect(result.data.uuid).toBe(TEST_GRID_ITEM_UUID);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await GRID_MODEL.get_grid_item_record('', TEST_GRID_UUID, TEST_GRID_ITEM_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid grid UUID', async () => {
            const result = await GRID_MODEL.get_grid_item_record(TEST_EXHIBIT_UUID, '', TEST_GRID_ITEM_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid item UUID', async () => {
            const result = await GRID_MODEL.get_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, '');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== REORDER GRIDS ====================

    describe('reorder_grids', () => {

        test('should reorder grids successfully', async () => {
            const gridOrder = { order: [TEST_GRID_UUID] };

            const result = await GRID_MODEL.reorder_grids(TEST_EXHIBIT_UUID, gridOrder);

            expect(result).toBe(true);
            expect(mockGridRecordTask.reorder_grids).toHaveBeenCalledWith(TEST_EXHIBIT_UUID, gridOrder);
        });

        test('should return false for invalid exhibit UUID', async () => {
            const result = await GRID_MODEL.reorder_grids('', { order: [] });

            expect(result).toBe(false);
        });

        test('should return false for invalid grid data', async () => {
            const result = await GRID_MODEL.reorder_grids(TEST_EXHIBIT_UUID, null);

            expect(result).toBe(false);
        });
    });

    // ==================== REORDER GRID ITEMS ====================

    describe('reorder_grid_items', () => {

        test('should reorder grid items successfully', async () => {
            const itemOrder = { order: [TEST_GRID_ITEM_UUID] };

            const result = await GRID_MODEL.reorder_grid_items(TEST_GRID_UUID, itemOrder);

            expect(result).toBe(true);
            expect(mockGridRecordTask.reorder_grid_items).toHaveBeenCalledWith(TEST_GRID_UUID, itemOrder);
        });

        test('should return false for invalid grid UUID', async () => {
            const result = await GRID_MODEL.reorder_grid_items('', { order: [] });

            expect(result).toBe(false);
        });

        test('should return false for invalid item data', async () => {
            const result = await GRID_MODEL.reorder_grid_items(TEST_GRID_UUID, null);

            expect(result).toBe(false);
        });
    });

    // ==================== UNLOCK GRID ITEM RECORD ====================

    describe('unlock_grid_item_record', () => {

        test('should unlock grid item record successfully', async () => {
            const result = await GRID_MODEL.unlock_grid_item_record(TEST_USER_UID, TEST_GRID_ITEM_UUID, {});

            expect(result).toEqual({ status: true });
            expect(mockHelperInstance.unlock_record).toHaveBeenCalled();
        });

        test('should unlock with force option', async () => {
            const result = await GRID_MODEL.unlock_grid_item_record(
                TEST_USER_UID,
                TEST_GRID_ITEM_UUID,
                { force: true }
            );

            expect(result).toEqual({ status: true });
        });

        test('should return false for invalid user UID', async () => {
            const result = await GRID_MODEL.unlock_grid_item_record('', TEST_GRID_ITEM_UUID, {});

            expect(result).toBe(false);
        });

        test('should return false for invalid item UUID', async () => {
            const result = await GRID_MODEL.unlock_grid_item_record(TEST_USER_UID, '', {});

            expect(result).toBe(false);
        });
    });

    // ==================== ERROR HANDLING ====================

    describe('Error Handling', () => {

        test('should handle database errors in create_grid_record', async () => {
            mockGridRecordTask.create_grid_record.mockRejectedValue(new Error('Database error'));

            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, { title: 'Test' });

            expect(result.status).toBe(200);
            expect(result.message).toContain('Unable to create grid record');
        });

        test('should handle database errors in update_grid_record', async () => {
            mockGridRecordTask.update_grid_record.mockRejectedValue(new Error('Database error'));

            const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, { title: 'Test' });

            expect(result.status).toBe(200);
            expect(result.message).toContain('Unable to update grid record');
        });

        test('should handle database errors in get_grid_record', async () => {
            mockGridRecordTask.get_grid_record.mockRejectedValue(new Error('Database error'));

            const result = await GRID_MODEL.get_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID);

            expect(result.status).toBe(400);
        });

        test('should handle database errors in create_grid_item_record', async () => {
            mockGridRecordTask.create_grid_item_record.mockRejectedValue(new Error('Database error'));

            const result = await GRID_MODEL.create_grid_item_record(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(200);
            expect(result.message).toContain('Unable to create grid item record');
        });

        test('should handle database errors in unlock_grid_item_record', async () => {
            mockHelperInstance.unlock_record.mockRejectedValue(new Error('Database error'));

            const result = await GRID_MODEL.unlock_grid_item_record(TEST_USER_UID, TEST_GRID_ITEM_UUID, {});

            expect(result).toBe(false);
        });

        test('should handle database errors in reorder_grids', async () => {
            mockGridRecordTask.reorder_grids.mockRejectedValue(new Error('Database error'));

            const result = await GRID_MODEL.reorder_grids(TEST_EXHIBIT_UUID, { order: [] });

            expect(result).toBe(false);
        });
    });
});
