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
const TEST_USER_UID = '1'; // numeric tbl_users.id (the lock owner), NOT a UUID
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

// Mock DB Config — rich enough to exercise reorder_exhibit_items' transaction +
// bulk CASE update. Existing tests delegate to mocked tasks and never touch DB
// directly, so this only adds capability (transaction / fn / callable builder).
jest.mock('../../config/db_config', () => {
    const mock_trx_update = jest.fn().mockResolvedValue(1);
    const mock_trx = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        update: mock_trx_update
    }));
    mock_trx.raw = jest.fn((sql, bindings) => ({ __raw: sql, bindings }));
    mock_trx.fn = { now: jest.fn(() => 'NOW()') };

    const mock_db = jest.fn(() => ({ query: jest.fn() }));
    mock_db.transaction = jest.fn(async (callback) => callback(mock_trx));
    mock_db.fn = { now: jest.fn(() => 'NOW()') };
    mock_db.__trx = mock_trx;             // exposed for assertions
    mock_db.__trx_update = mock_trx_update;

    return () => mock_db;
});

// Mock DB Tables Config
jest.mock('../../config/db_tables_config', () => () => ({
    exhibits: {
        exhibit_records: 'tbl_exhibits_exhibit_records',
        item_records: 'tbl_exhibits_item_records',
        heading_records: 'tbl_exhibits_heading_records',
        grid_records: 'tbl_exhibits_grid_records',
        grid_item_records: 'tbl_exhibits_grid_item_records',
        timeline_records: 'tbl_exhibits_timeline_records'
    }
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
    reorder_items: jest.fn().mockResolvedValue(true)
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
    index_heading_record: jest.fn().mockResolvedValue(true),
    index_grid_record: jest.fn().mockResolvedValue(true),
    index_timeline_record: jest.fn().mockResolvedValue(true),
    delete_record: jest.fn().mockResolvedValue({ status: 204 }),
    get_indexed_record: jest.fn().mockResolvedValue({ status: 404 })
};

jest.mock('../../indexer/model', () => mockIndexerModel);

// Mock the re-index coalescer to run scheduled tasks immediately, so reorder
// re-index mapping can be asserted without driving timers.
const mockCoalescer = {
    schedule_reindex: jest.fn((key, task) => { task(); }),
    DEFAULT_DEBOUNCE_MS: 1000,
    _timers: new Map()
};
jest.mock('../../exhibits/reindex_coalescer', () => mockCoalescer);

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

        test('should return 500 when database operation fails', async () => {
            mockItemRecordTask.create_item_record.mockResolvedValue(false);

            const result = await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, { title: 'Test' });

            expect(result.status).toBe(500);
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

    // ============ REORDER EXHIBIT ITEMS (atomic batch — S1 + S2 + S4) ============

    describe('reorder_exhibit_items', () => {

        const DB = require('../../config/db_config')();
        const EXHIBIT = TEST_EXHIBIT_UUID;
        // distinct, valid-format v4 uuids keyed by n
        const u = (n) => `${n}${n}${n}e8400-e29b-41d4-a716-44665544000${n}`;

        beforeEach(() => {
            DB.transaction.mockClear();
            DB.__trx.mockClear();
            DB.__trx.raw.mockClear();
            DB.__trx_update.mockClear();
            DB.__trx_update.mockResolvedValue(1);
        });

        test('S1+S2: one transaction, one bulk CASE update per table (not N)', async () => {
            const order = [
                { type: 'item', uuid: u(1), order: 1 },
                { type: 'heading', uuid: u(2), order: 2 },
                { type: 'item', uuid: u(3), order: 3 }
            ];

            const result = await ITEMS_MODEL.reorder_exhibit_items(EXHIBIT, order);

            expect(result).toBe(true);
            expect(DB.transaction).toHaveBeenCalledTimes(1);     // S1: atomic
            // 2 tables (item_records, heading_records) -> 2 updates, not 3 (N) -> S2: bulk
            expect(DB.__trx_update).toHaveBeenCalledTimes(2);
            // each update built a bound CASE (no string interpolation)
            const raw = DB.__trx.raw.mock.calls[0];
            expect(raw[0]).toContain('CASE ??');
            expect(raw[1][0]).toBe('uuid');                       // ?? binds the column id
        });

        test('grid items scope to their grid: one update per distinct grid_id', async () => {
            const order = [
                { type: 'griditem', grid_id: u(4), uuid: u(6), order: 1 },
                { type: 'griditem', grid_id: u(4), uuid: u(7), order: 2 },
                { type: 'griditem', grid_id: u(5), uuid: u(8), order: 1 }
            ];

            const result = await ITEMS_MODEL.reorder_exhibit_items(EXHIBIT, order);

            expect(result).toBe(true);
            expect(DB.__trx_update).toHaveBeenCalledTimes(2);     // one per grid
        });

        test('atomic: a mid-batch failure rolls back and returns false', async () => {
            DB.__trx_update.mockRejectedValueOnce(new Error('constraint'));

            const result = await ITEMS_MODEL.reorder_exhibit_items(EXHIBIT, [
                { type: 'item', uuid: u(1), order: 1 }
            ]);

            expect(result).toBe(false);                           // knex rolls back the trx
            expect(DB.transaction).toHaveBeenCalledTimes(1);
        });

        test('rejects invalid input without opening a transaction', async () => {
            expect(await ITEMS_MODEL.reorder_exhibit_items('', [{ type: 'item', uuid: u(1), order: 1 }])).toBe(false);
            expect(await ITEMS_MODEL.reorder_exhibit_items(EXHIBIT, [])).toBe(false);
            expect(await ITEMS_MODEL.reorder_exhibit_items(EXHIBIT, [{ type: 'bogus', uuid: u(1), order: 1 }])).toBe(false);
            expect(DB.transaction).not.toHaveBeenCalled();
        });

        test('S4: rejects duplicate uuid or duplicate order within a scope', async () => {
            const dup_uuid = [
                { type: 'item', uuid: u(1), order: 1 },
                { type: 'item', uuid: u(1), order: 2 }
            ];
            const dup_order = [
                { type: 'item', uuid: u(1), order: 1 },
                { type: 'item', uuid: u(2), order: 1 }
            ];
            expect(await ITEMS_MODEL.reorder_exhibit_items(EXHIBIT, dup_uuid)).toBe(false);
            expect(await ITEMS_MODEL.reorder_exhibit_items(EXHIBIT, dup_order)).toBe(false);
            expect(DB.transaction).not.toHaveBeenCalled();
        });
    });

    // ==================== SCHEDULE REORDER REINDEX ====================

    describe('schedule_reorder_reindex', () => {

        const EXHIBIT = TEST_EXHIBIT_UUID;
        const u = (n) => `${n}${n}${n}e8400-e29b-41d4-a716-44665544000${n}`;

        beforeEach(() => {
            // Re-establish impls wiped by restoreMocks. The coalescer mock runs the
            // scheduled task immediately so the mapping can be asserted synchronously.
            mockCoalescer.schedule_reindex.mockImplementation((key, task) => { task(); });
            mockIndexerModel.index_item_record.mockResolvedValue(true);
            mockIndexerModel.index_heading_record.mockResolvedValue(true);
            mockIndexerModel.index_grid_record.mockResolvedValue(true);
            mockIndexerModel.index_timeline_record.mockResolvedValue(true);
        });

        test('maps each top-level component type to its own targeted index function', async () => {
            ITEMS_MODEL.schedule_reorder_reindex(EXHIBIT, [
                { type: 'item', uuid: u(1), order: 1 },
                { type: 'heading', uuid: u(2), order: 2 },
                { type: 'subheading', uuid: u(3), order: 3 },
                { type: 'grid', uuid: u(4), order: 4 },
                { type: 'timeline', uuid: u(5), order: 5 }
            ]);
            await Promise.resolve();

            expect(mockIndexerModel.index_item_record).toHaveBeenCalledWith(EXHIBIT, u(1));
            expect(mockIndexerModel.index_heading_record).toHaveBeenCalledWith(EXHIBIT, u(2));
            expect(mockIndexerModel.index_heading_record).toHaveBeenCalledWith(EXHIBIT, u(3)); // subheading -> heading doc
            expect(mockIndexerModel.index_grid_record).toHaveBeenCalledWith(EXHIBIT, u(4));
            expect(mockIndexerModel.index_timeline_record).toHaveBeenCalledWith(EXHIBIT, u(5));
        });

        test('grid items re-index their parent grid doc, deduped to one call per grid', async () => {
            ITEMS_MODEL.schedule_reorder_reindex(EXHIBIT, [
                { type: 'griditem', grid_id: u(4), uuid: u(6), order: 1 },
                { type: 'griditem', grid_id: u(4), uuid: u(7), order: 2 },  // same grid
                { type: 'griditem', grid_id: u(5), uuid: u(8), order: 1 }   // different grid
            ]);
            await Promise.resolve();

            expect(mockIndexerModel.index_grid_record).toHaveBeenCalledTimes(2);   // per distinct grid, not per item
            expect(mockIndexerModel.index_grid_record).toHaveBeenCalledWith(EXHIBIT, u(4));
            expect(mockIndexerModel.index_grid_record).toHaveBeenCalledWith(EXHIBIT, u(5));
        });

        test('a moved grid and grid items within it collapse to a single grid re-index', async () => {
            ITEMS_MODEL.schedule_reorder_reindex(EXHIBIT, [
                { type: 'grid', uuid: u(4), order: 1 },
                { type: 'griditem', grid_id: u(4), uuid: u(6), order: 1 }
            ]);
            await Promise.resolve();

            expect(mockIndexerModel.index_grid_record).toHaveBeenCalledTimes(1);
            expect(mockIndexerModel.index_grid_record).toHaveBeenCalledWith(EXHIBIT, u(4));
        });

        test('schedules one coalesced re-index per distinct component', () => {
            ITEMS_MODEL.schedule_reorder_reindex(EXHIBIT, [
                { type: 'item', uuid: u(1), order: 1 },
                { type: 'item', uuid: u(1), order: 1 },   // duplicate component
                { type: 'grid', uuid: u(4), order: 2 }
            ]);

            expect(mockCoalescer.schedule_reindex).toHaveBeenCalledTimes(2); // item:u1 (deduped) + grid:u4
        });

        test('no-ops on an invalid exhibit id or a non-array payload', () => {
            ITEMS_MODEL.schedule_reorder_reindex('not-a-uuid', [{ type: 'item', uuid: u(1), order: 1 }]);
            ITEMS_MODEL.schedule_reorder_reindex(EXHIBIT, null);

            expect(mockCoalescer.schedule_reindex).not.toHaveBeenCalled();
            expect(mockIndexerModel.index_item_record).not.toHaveBeenCalled();
        });

        test('skips entries with an invalid uuid or a grid item missing its grid id', async () => {
            ITEMS_MODEL.schedule_reorder_reindex(EXHIBIT, [
                { type: 'item', uuid: 'bad', order: 1 },
                { type: 'griditem', uuid: u(6), order: 1 },   // no grid_id
                { type: 'item', uuid: u(1), order: 2 }        // the only valid entry
            ]);
            await Promise.resolve();

            expect(mockIndexerModel.index_item_record).toHaveBeenCalledTimes(1);
            expect(mockIndexerModel.index_item_record).toHaveBeenCalledWith(EXHIBIT, u(1));
            expect(mockIndexerModel.index_grid_record).not.toHaveBeenCalled();
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

    // ==================== ERROR HANDLING ====================

    describe('Error Handling', () => {

        test('should handle database errors in create_item_record', async () => {
            mockItemRecordTask.create_item_record.mockRejectedValue(new Error('Database error'));

            const result = await ITEMS_MODEL.create_item_record(TEST_EXHIBIT_UUID, { title: 'Test' });

            expect(result.status).toBe(500);
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
