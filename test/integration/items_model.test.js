/**
 * Integration Tests for Items Model
 *
 * Tests the model layer directly, including validation and business logic.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// ==================== TEST CONSTANTS ====================
const TEST_EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_ITEM_UUID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_USER_UID = '770e8400-e29b-41d4-a716-446655440002';
const TEST_REPO_UUID = '880e8400-e29b-41d4-a716-446655440003';

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

// Mock Webservices Config
jest.mock('../../config/webservices_config', () => () => ({
    repo_item_api_url: 'http://localhost/api/',
    repo_item_api_key: 'test-key',
    tn_service: 'http://localhost/tn/',
    tn_service_api_key: 'test-tn-key',
    item_subjects_api_url: 'http://localhost/subjects/',
    item_subjects_api_key: 'test-subjects-key'
}));

// Mock Kaltura Config
jest.mock('../../config/kaltura_config', () => () => ({
    kaltura_secret_key: 'test-secret',
    kaltura_user_id: 'test-user',
    kaltura_partner_id: 12345
}));

// Mock DB Config
jest.mock('../../config/db_config', () => () => ({
    query: jest.fn()
}));

// Mock DB Tables Config
jest.mock('../../config/db_tables_config', () => () => ({
    exhibits: {
        exhibit_records: 'tbl_exhibits_exhibit_records',
        item_records: 'tbl_exhibits_item_records',
        heading_records: 'tbl_exhibits_heading_records',
        grid_records: 'tbl_exhibits_grid_records',
        timeline_records: 'tbl_exhibits_timeline_records'
    }
}));

// Mock Schemas
jest.mock('../../exhibits/schemas/exhibit_item_create_record_schema', () => () => ({
    type: 'object',
    properties: {}
}));

jest.mock('../../exhibits/schemas/exhibit_item_update_record_schema', () => () => ({
    type: 'object',
    properties: {}
}));

// Mock Helper instance
const mockHelperInstance = {
    create_uuid: jest.fn().mockReturnValue(TEST_ITEM_UUID),
    order_exhibit_items: jest.fn().mockResolvedValue(1),
    unlock_record: jest.fn().mockResolvedValue(true),
    check_storage_path: jest.fn(),
    process_uploaded_media: jest.fn().mockReturnValue('processed-media.jpg'),
    has_order_gaps: jest.fn().mockReturnValue(false),
    reorder: jest.fn().mockResolvedValue([]),
    apply_reorder: jest.fn().mockResolvedValue({ success: true })
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

// Mock Item Record Tasks
const mockItemRecordTask = {
    create_item_record: jest.fn().mockResolvedValue(true),
    get_item_records: jest.fn().mockResolvedValue([]),
    get_item_record: jest.fn().mockResolvedValue({}),
    get_item_edit_record: jest.fn().mockResolvedValue({}),
    update_item_record: jest.fn().mockResolvedValue(true),
    delete_item_record: jest.fn().mockResolvedValue(true),
    set_item_to_publish: jest.fn().mockResolvedValue(true),
    set_item_to_suppress: jest.fn().mockResolvedValue(true),
    reorder_items: jest.fn().mockResolvedValue(true),
    delete_media_value: jest.fn().mockResolvedValue(true)
};

jest.mock('../../exhibits/tasks/exhibit_item_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockItemRecordTask);
});

// Mock Heading Record Tasks
const mockHeadingRecordTask = {
    get_heading_records: jest.fn().mockResolvedValue([])
};

jest.mock('../../exhibits/tasks/exhibit_heading_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockHeadingRecordTask);
});

// Mock Grid Record Tasks
const mockGridRecordTask = {
    get_grid_records: jest.fn().mockResolvedValue([]),
    get_grid_item_records: jest.fn().mockResolvedValue([])
};

jest.mock('../../exhibits/tasks/exhibit_grid_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockGridRecordTask);
});

// Mock Timeline Record Tasks
const mockTimelineRecordTask = {
    get_timeline_records: jest.fn().mockResolvedValue([]),
    get_timeline_item_records: jest.fn().mockResolvedValue([])
};

jest.mock('../../exhibits/tasks/exhibit_timeline_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockTimelineRecordTask);
});

// Mock Exhibit Record Tasks
const mockExhibitRecordTask = {
    update_exhibit_timestamp: jest.fn().mockResolvedValue(true),
    get_exhibit_record: jest.fn().mockResolvedValue({ is_published: 1 })
};

jest.mock('../../exhibits/tasks/exhibit_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockExhibitRecordTask);
});

// Mock Indexer Model
const mockIndexerModel = {
    index_item_record: jest.fn().mockResolvedValue(true),
    delete_record: jest.fn().mockResolvedValue({ status: 204 }),
    get_indexed_record: jest.fn().mockResolvedValue({ status: 404 })
};

jest.mock('../../indexer/model', () => mockIndexerModel);

// Mock HTTP (axios)
const mockHttp = jest.fn().mockResolvedValue({ status: 200, data: {} });
mockHttp.get = jest.fn().mockResolvedValue({ status: 200, data: Buffer.from('test') });
jest.mock('axios', () => mockHttp);

// Mock Kaltura
jest.mock('kaltura-client', () => ({
    Configuration: jest.fn(),
    Client: jest.fn().mockImplementation(() => ({
        setKs: jest.fn()
    })),
    enums: {
        SessionType: {
            USER: 0,
            ADMIN: 2
        }
    },
    services: {
        session: {
            start: jest.fn().mockReturnValue({
                execute: jest.fn().mockResolvedValue('test-session')
            })
        },
        media: {
            get: jest.fn().mockReturnValue({
                execute: jest.fn().mockResolvedValue({ mediaType: 1, id: 'test-id' })
            })
        }
    }
}));

// ==================== TESTS ====================

describe('Items Model Integration Tests', () => {
    let ITEMS_MODEL;

    beforeAll(() => {
        ITEMS_MODEL = require('../../exhibits/items_model');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mock implementations
        mockValidate.mockReturnValue(true);
        mockHelperInstance.create_uuid.mockReturnValue(TEST_ITEM_UUID);
        mockHelperInstance.order_exhibit_items.mockResolvedValue(1);
        mockHelperInstance.unlock_record.mockResolvedValue(true);
        mockHelperInstance.has_order_gaps.mockReturnValue(false);
        mockItemRecordTask.create_item_record.mockResolvedValue(true);
        mockItemRecordTask.get_item_records.mockResolvedValue([]);
        mockItemRecordTask.get_item_record.mockResolvedValue({});
        mockItemRecordTask.get_item_edit_record.mockResolvedValue({});
        mockItemRecordTask.update_item_record.mockResolvedValue(true);
        mockItemRecordTask.delete_item_record.mockResolvedValue(true);
        mockItemRecordTask.set_item_to_publish.mockResolvedValue(true);
        mockItemRecordTask.set_item_to_suppress.mockResolvedValue(true);
        mockItemRecordTask.reorder_items.mockResolvedValue(true);
        mockHeadingRecordTask.get_heading_records.mockResolvedValue([]);
        mockGridRecordTask.get_grid_records.mockResolvedValue([]);
        mockGridRecordTask.get_grid_item_records.mockResolvedValue([]);
        mockTimelineRecordTask.get_timeline_records.mockResolvedValue([]);
        mockTimelineRecordTask.get_timeline_item_records.mockResolvedValue([]);
        mockExhibitRecordTask.update_exhibit_timestamp.mockResolvedValue(true);
        mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ is_published: 1 });
        mockIndexerModel.index_item_record.mockResolvedValue(true);
        mockIndexerModel.delete_record.mockResolvedValue({ status: 204 });
        mockIndexerModel.get_indexed_record.mockResolvedValue({ status: 404 });
        mockHttp.mockResolvedValue({ status: 200, data: {} });
        mockHttp.get.mockResolvedValue({ status: 200, data: Buffer.from('test') });
    });

    afterAll(async () => {
        await new Promise(resolve => setImmediate(resolve));
    });

    // ==================== CREATE ITEM RECORD ====================

    describe('create_item_record', () => {

        test('should create item record successfully', async () => {
            const itemData = {
                title: 'Test Item',
                item_type: 'image'
            };

            const result = await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, itemData);

            expect(result.status).toBe(201);
            expect(result.message).toBe('Item record created');
            expect(result.data).toBe(TEST_ITEM_UUID);
            expect(mockItemRecordTask.create_item_record).toHaveBeenCalled();
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.create_item_record('', { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid exhibit UUID provided');
        });

        test('should return 400 for null exhibit UUID', async () => {
            const result = await ITEMS_MODEL.create_item_record(null, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid exhibit UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, null);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should return 400 when validation fails', async () => {
            mockValidate.mockReturnValue([
                { message: 'Title is required' }
            ]);

            const result = await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, { item_type: 'image' });

            expect(result.status).toBe(400);
        });

        test('should return 200 when database operation fails', async () => {
            mockItemRecordTask.create_item_record.mockResolvedValue(false);

            const result = await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, { title: 'Test' });

            expect(result.status).toBe(200);
            expect(result.message).toBe('Unable to create item record');
        });

        test('should generate UUID for new item', async () => {
            await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, { title: 'Test' });

            expect(mockHelperInstance.create_uuid).toHaveBeenCalled();
        });

        test('should calculate order for new item', async () => {
            await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, { title: 'Test' });

            expect(mockHelperInstance.order_exhibit_items).toHaveBeenCalled();
        });
    });

    // ==================== GET ITEM RECORDS ====================

    describe('get_item_records', () => {

        test('should get all item records successfully', async () => {
            const mockItems = [
                { uuid: TEST_ITEM_UUID, title: 'Item 1', order: 1 }
            ];
            mockItemRecordTask.get_item_records.mockResolvedValue(mockItems);

            const result = await ITEMS_MODEL.get_item_records(TEST_EXHIBIT_UUID);

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit item records');
            expect(result.data).toHaveLength(1);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.get_item_records('');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid exhibit UUID provided');
        });

        test('should combine items, headings, grids, and timelines', async () => {
            const mockItems = [{ uuid: '1', order: 1, type: 'item' }];
            const mockHeadings = [{ uuid: '2', order: 2, type: 'heading' }];
            const mockGrids = [{ uuid: '3', order: 3, type: 'grid' }];
            const mockTimelines = [{ uuid: '4', order: 4, type: 'timeline' }];

            mockItemRecordTask.get_item_records.mockResolvedValue(mockItems);
            mockHeadingRecordTask.get_heading_records.mockResolvedValue(mockHeadings);
            mockGridRecordTask.get_grid_records.mockResolvedValue(mockGrids);
            mockTimelineRecordTask.get_timeline_records.mockResolvedValue(mockTimelines);

            const result = await ITEMS_MODEL.get_item_records(TEST_EXHIBIT_UUID);

            expect(result.status).toBe(200);
            expect(result.data).toHaveLength(4);
        });
    });

    // ==================== GET ITEM RECORD ====================

    describe('get_item_record', () => {

        test('should get item record successfully', async () => {
            const mockRecord = {
                uuid: TEST_ITEM_UUID,
                title: 'Test Item'
            };
            mockItemRecordTask.get_item_record.mockResolvedValue(mockRecord);

            const result = await ITEMS_MODEL.get_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(200);
            expect(result.message).toBe('Item record');
            expect(result.data).toEqual(mockRecord);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.get_item_record('', TEST_ITEM_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid item UUID', async () => {
            const result = await ITEMS_MODEL.get_item_record(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== GET ITEM EDIT RECORD ====================

    describe('get_item_edit_record', () => {

        test('should get item edit record successfully', async () => {
            const mockRecord = {
                uuid: TEST_ITEM_UUID,
                title: 'Test Item',
                is_locked: 1
            };
            mockItemRecordTask.get_item_edit_record.mockResolvedValue(mockRecord);

            const result = await ITEMS_MODEL.get_item_edit_record(
                TEST_USER_UID,
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID
            );

            expect(result.status).toBe(200);
            expect(result.message).toBe('Item edit record');
            expect(result.data).toEqual(mockRecord);
        });

        test('should return 400 for invalid user UID', async () => {
            const result = await ITEMS_MODEL.get_item_edit_record(
                '',
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.get_item_edit_record(
                TEST_USER_UID,
                '',
                TEST_ITEM_UUID
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid item UUID', async () => {
            const result = await ITEMS_MODEL.get_item_edit_record(
                TEST_USER_UID,
                TEST_EXHIBIT_UUID,
                ''
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== UPDATE ITEM RECORD ====================

    describe('update_item_record', () => {

        test('should update item record successfully', async () => {
            const updateData = {
                title: 'Updated Item'
            };

            const result = await ITEMS_MODEL.update_item_record(
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID,
                updateData
            );

            expect(result.status).toBe(201);
            expect(result.message).toBe('Item record updated');
            expect(mockItemRecordTask.update_item_record).toHaveBeenCalled();
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.update_item_record('', TEST_ITEM_UUID, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid item UUID', async () => {
            const result = await ITEMS_MODEL.update_item_record(TEST_EXHIBIT_UUID, '', { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await ITEMS_MODEL.update_item_record(
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID,
                null
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should return 400 when validation fails', async () => {
            mockValidate.mockReturnValue([
                { message: 'Invalid field' }
            ]);

            const result = await ITEMS_MODEL.update_item_record(
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID,
                { invalid: 'data' }
            );

            expect(result.status).toBe(400);
        });

        test('should return 400 when database operation fails', async () => {
            mockItemRecordTask.update_item_record.mockResolvedValue(false);

            const result = await ITEMS_MODEL.update_item_record(
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Unable to update item record');
        });
    });

    // ==================== DELETE ITEM RECORD ====================

    describe('delete_item_record', () => {

        test('should delete item record successfully', async () => {
            const result = await ITEMS_MODEL.delete_item_record(
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID,
                'item'
            );

            expect(result.status).toBe(204);
            expect(result.message).toBe('Record deleted');
            expect(mockItemRecordTask.delete_item_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID,
                'item'
            );
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.delete_item_record('', TEST_ITEM_UUID, 'item');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid item UUID', async () => {
            const result = await ITEMS_MODEL.delete_item_record(TEST_EXHIBIT_UUID, '', 'item');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should delete from index if item is indexed', async () => {
            mockIndexerModel.get_indexed_record.mockResolvedValue({ status: 200 });

            await ITEMS_MODEL.delete_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID, 'item');

            expect(mockIndexerModel.delete_record).toHaveBeenCalledWith(TEST_ITEM_UUID);
        });
    });

    // ==================== PUBLISH ITEM RECORD ====================

    describe('publish_item_record', () => {

        test('should publish item record successfully', async () => {
            const result = await ITEMS_MODEL.publish_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(true);
            expect(result.message).toBe('Item published');
        });

        test('should return false for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.publish_item_record('', TEST_ITEM_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false for invalid item UUID', async () => {
            const result = await ITEMS_MODEL.publish_item_record(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false when exhibit is not published', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ is_published: 0 });

            const result = await ITEMS_MODEL.publish_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toContain('Exhibit must be published first');
        });

        test('should return false when set_item_to_publish fails', async () => {
            mockItemRecordTask.set_item_to_publish.mockResolvedValue(false);

            const result = await ITEMS_MODEL.publish_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to publish item');
        });

        test('should return false when indexing fails', async () => {
            mockIndexerModel.index_item_record.mockResolvedValue(false);

            const result = await ITEMS_MODEL.publish_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to publish item');
        });
    });

    // ==================== SUPPRESS ITEM RECORD ====================

    describe('suppress_item_record', () => {

        test('should suppress item record successfully', async () => {
            const result = await ITEMS_MODEL.suppress_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(true);
            expect(result.message).toBe('Item suppressed');
        });

        test('should return false for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.suppress_item_record('', TEST_ITEM_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false for invalid item UUID', async () => {
            const result = await ITEMS_MODEL.suppress_item_record(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false when delete from index fails', async () => {
            mockIndexerModel.delete_record.mockResolvedValue({ status: 500 });

            const result = await ITEMS_MODEL.suppress_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to suppress item');
        });

        test('should return false when set_item_to_suppress fails', async () => {
            mockItemRecordTask.set_item_to_suppress.mockResolvedValue(false);

            const result = await ITEMS_MODEL.suppress_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to suppress item');
        });
    });

    // ==================== REORDER ITEMS ====================

    describe('reorder_items', () => {

        test('should reorder items successfully', async () => {
            const itemOrder = { uuid: TEST_ITEM_UUID, order: 1 };

            const result = await ITEMS_MODEL.reorder_items(TEST_EXHIBIT_UUID, itemOrder);

            expect(result).toBe(true);
            expect(mockItemRecordTask.reorder_items).toHaveBeenCalledWith(
                TEST_EXHIBIT_UUID,
                itemOrder
            );
        });

        test('should return false for invalid exhibit UUID', async () => {
            const result = await ITEMS_MODEL.reorder_items('', { order: 1 });

            expect(result).toBe(false);
        });

        test('should return false for invalid item data', async () => {
            const result = await ITEMS_MODEL.reorder_items(TEST_EXHIBIT_UUID, null);

            expect(result).toBe(false);
        });

        test('should return false on database error', async () => {
            mockItemRecordTask.reorder_items.mockRejectedValue(new Error('Database error'));

            const result = await ITEMS_MODEL.reorder_items(TEST_EXHIBIT_UUID, { order: 1 });

            expect(result).toBe(false);
        });
    });

    // ==================== UNLOCK ITEM RECORD ====================

    describe('unlock_item_record', () => {

        test('should unlock item record successfully', async () => {
            const result = await ITEMS_MODEL.unlock_item_record(TEST_USER_UID, TEST_ITEM_UUID, {});

            expect(result).toBe(true);
            expect(mockHelperInstance.unlock_record).toHaveBeenCalled();
        });

        test('should unlock with force option', async () => {
            const result = await ITEMS_MODEL.unlock_item_record(
                TEST_USER_UID,
                TEST_ITEM_UUID,
                { force: true }
            );

            expect(result).toBe(true);
        });

        test('should return false for invalid user UID', async () => {
            const result = await ITEMS_MODEL.unlock_item_record('', TEST_ITEM_UUID, {});

            expect(result).toBe(false);
        });

        test('should return false for invalid item UUID', async () => {
            const result = await ITEMS_MODEL.unlock_item_record(TEST_USER_UID, '', {});

            expect(result).toBe(false);
        });

        test('should return false on database error', async () => {
            mockHelperInstance.unlock_record.mockRejectedValue(new Error('Database error'));

            const result = await ITEMS_MODEL.unlock_item_record(TEST_USER_UID, TEST_ITEM_UUID, {});

            expect(result).toBe(false);
        });
    });

    // ==================== GET REPO ITEM RECORD ====================

    describe('get_repo_item_record', () => {

        test('should get repo item record successfully', async () => {
            mockHttp.mockResolvedValue({
                status: 200,
                data: { uuid: TEST_REPO_UUID, title: 'Repo Item' }
            });

            const result = await ITEMS_MODEL.get_repo_item_record(TEST_REPO_UUID);

            expect(result.status).toBe(200);
        });

        test('should return null for invalid UUID', async () => {
            const result = await ITEMS_MODEL.get_repo_item_record('');

            expect(result).toBeNull();
        });

        test('should return null on HTTP error', async () => {
            mockHttp.mockRejectedValue(new Error('Network error'));

            const result = await ITEMS_MODEL.get_repo_item_record(TEST_REPO_UUID);

            expect(result).toBeNull();
        });
    });

    // ==================== GET REPO THUMBNAIL ====================

    describe('get_repo_tn', () => {

        test('should get repo thumbnail successfully', async () => {
            const mockThumbnail = Buffer.from('thumbnail-data');
            mockHttp.get.mockResolvedValue({
                status: 200,
                data: mockThumbnail
            });

            const result = await ITEMS_MODEL.get_repo_tn(TEST_REPO_UUID);

            expect(result).toEqual(mockThumbnail);
        });

        test('should return null for invalid UUID', async () => {
            const result = await ITEMS_MODEL.get_repo_tn('');

            expect(result).toBeNull();
        });

        test('should return null on HTTP error', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            const result = await ITEMS_MODEL.get_repo_tn(TEST_REPO_UUID);

            expect(result).toBeNull();
        });

        test('should return null for non-200 status', async () => {
            mockHttp.get.mockResolvedValue({ status: 404 });

            const result = await ITEMS_MODEL.get_repo_tn(TEST_REPO_UUID);

            expect(result).toBeNull();
        });
    });

    // ==================== GET ITEM SUBJECTS ====================

    describe('get_item_subjects', () => {

        test('should get item subjects successfully', async () => {
            const mockSubjects = [
                { id: 1, name: 'History' },
                { id: 2, name: 'Science' }
            ];
            mockHttp.mockResolvedValue({
                status: 200,
                data: mockSubjects
            });

            const result = await ITEMS_MODEL.get_item_subjects();

            expect(result).toEqual(mockSubjects);
        });

        test('should return null on HTTP error', async () => {
            mockHttp.mockRejectedValue(new Error('API error'));

            const result = await ITEMS_MODEL.get_item_subjects();

            expect(result).toBeNull();
        });
    });

    // ==================== GET KALTURA ITEM RECORD ====================

    describe('get_kaltura_item_record', () => {

        test('should call callback with result', (done) => {
            ITEMS_MODEL.get_kaltura_item_record('test-entry-id', (result) => {
                expect(result).toBeDefined();
                done();
            });
        });

        test('should call callback with error for invalid entry_id', (done) => {
            ITEMS_MODEL.get_kaltura_item_record('', (result) => {
                expect(result).toBe('Invalid entry ID provided');
                done();
            });
        });

        test('should call callback with error for null entry_id', (done) => {
            ITEMS_MODEL.get_kaltura_item_record(null, (result) => {
                expect(result).toBe('Invalid entry ID provided');
                done();
            });
        });
    });

    // ==================== ERROR HANDLING ====================

    describe('Error Handling', () => {

        test('should handle database errors in create_item_record', async () => {
            mockItemRecordTask.create_item_record.mockRejectedValue(new Error('Database error'));

            const result = await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, { title: 'Test' });

            expect(result.status).toBe(200);
            expect(result.message).toContain('Unable to create record');
        });

        test('should handle database errors in get_item_records', async () => {
            mockItemRecordTask.get_item_records.mockRejectedValue(new Error('Database error'));

            const result = await ITEMS_MODEL.get_item_records(TEST_EXHIBIT_UUID);

            expect(result.status).toBe(400);
        });

        test('should handle database errors in get_item_record', async () => {
            mockItemRecordTask.get_item_record.mockRejectedValue(new Error('Database error'));

            const result = await ITEMS_MODEL.get_item_record(TEST_EXHIBIT_UUID, TEST_ITEM_UUID);

            expect(result.status).toBe(400);
        });

        test('should handle database errors in update_item_record', async () => {
            mockItemRecordTask.update_item_record.mockRejectedValue(new Error('Database error'));

            const result = await ITEMS_MODEL.update_item_record(
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(400);
            expect(result.message).toContain('Unable to update record');
        });

        test('should handle database errors in delete_item_record', async () => {
            mockItemRecordTask.delete_item_record.mockRejectedValue(new Error('Database error'));

            const result = await ITEMS_MODEL.delete_item_record(
                TEST_EXHIBIT_UUID,
                TEST_ITEM_UUID,
                'item'
            );

            expect(result.status).toBe(400);
        });
    });
});
