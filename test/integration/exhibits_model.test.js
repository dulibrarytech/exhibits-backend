/**
 * Integration Tests for Exhibits Model
 *
 * Tests the model layer functions and their interactions
 * with the task layer.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { TEST_UUID, TEST_USER_UID, mock_model } = require('./helpers/mocks');

// Test constants

// Mock Logger - must be before require
/*
 * libs/rte_vocabulary requires jsdom, whose dependency tree ships untranspiled
 * ESM that jest cannot parse (node_modules is not transformed). The vocabulary
 * itself is unit-tested in vitest (test/tasks/rte_vocabulary.test.js); here it
 * is a pass-through so model orchestration is tested unchanged.
 */
jest.mock('../../libs/rte_vocabulary', () => ({
    apply: jest.fn((record) => record),
    sanitize_rich_full: jest.fn((value) => value),
    sanitize_rich_reduced: jest.fn((value) => value),
    sanitize_plain: jest.fn((value) => value),
}));

jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());

// Define mock instances that will be shared
const mockHelperInstance = {
    create_uuid: jest.fn().mockReturnValue(TEST_UUID),
    check_storage_path: jest.fn(),
    process_uploaded_media: jest.fn((uuid, _, media) => `/storage/${uuid}/${media}`),
    unlock_record: jest.fn().mockResolvedValue({ status: true })
};

// Mock Helper - return a class that creates our mock instance
jest.mock('../../libs/helper', () => {
    return jest.fn().mockImplementation(() => mockHelperInstance);
});

// Mock Validator - stores reference to be modified in tests
const mockValidate = jest.fn().mockReturnValue(true);
jest.mock('../../libs/validate', () => {
    return jest.fn().mockImplementation(() => ({
        validate: mockValidate
    }));
});

// Mock DB Config
const mockQuery = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    orderBy: jest.fn().mockReturnThis()
};

const mockDB = jest.fn(() => mockQuery);
mockDB.fn = { now: jest.fn(() => 'NOW()') };

jest.mock('../../config/db_config', () => () => mockDB);

// Mock DB Tables Config
jest.mock('../../config/db_tables_config', () => require('./helpers/mocks').db_tables_factory({
    exhibit_records: 'tbl_exhibit_records',
    heading_records: 'tbl_heading_records',
    item_records: 'tbl_item_records',
    grid_records: 'tbl_grid_records',
    timeline_records: 'tbl_timeline_records'
}));

// Mock Schemas
jest.mock('../../exhibits/schemas/exhibit_create_record_schema', () => () => ({}));
jest.mock('../../exhibits/schemas/exhibit_update_record_schema', () => () => ({}));

// Mock Task Classes
const mockExhibitRecordTask = mock_model({
    create_exhibit_record: true,
    get_exhibit_records: [],
    get_exhibit_record: {},
    get_exhibit_edit_record: {},
    update_exhibit_record: true,
    delete_exhibit_record: true,
    get_exhibit_title: 'Test Title',
    set_to_publish: true,
    set_to_suppress: true,
    set_preview: true,
    unset_preview: true,
    reorder_exhibits: true
});

jest.mock('../../exhibits/tasks/exhibit_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockExhibitRecordTask);
});

// Mock Media Library Task Class
const mockExhibitMediaLibraryTask = mock_model({
    bind_media: true,
    unbind_media: true,
    get_exhibit_media_bindings: []
});

jest.mock('../../exhibits/tasks/exhibit_media_library_tasks', () => {
    return jest.fn().mockImplementation(() => mockExhibitMediaLibraryTask);
});

// Mock other task classes — named so tests can assert on the cascade / index paths
const mockItemRecordTask = mock_model({
    get_exhibit_items: [],
    get_item_records: [],
    delete_item_record: true,
    set_to_suppress: true,
    set_to_publish: true
});
jest.mock('../../exhibits/tasks/exhibit_item_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockItemRecordTask);
});

const mockHeadingRecordTask = mock_model({
    get_exhibit_headings: [],
    get_heading_records: [],
    set_to_suppress: true,
    set_to_publish: true
});
jest.mock('../../exhibits/tasks/exhibit_heading_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockHeadingRecordTask);
});

const mockGridRecordTask = mock_model({
    get_exhibit_grids: [],
    get_grid_records: [],
    set_to_suppress: true,
    set_to_publish: true,
    set_exhibit_grid_items_to_suppress: true,
    set_exhibit_grid_items_to_publish: true
});
jest.mock('../../exhibits/tasks/exhibit_grid_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockGridRecordTask);
});

const mockTimelineRecordTask = mock_model({
    get_exhibit_timelines: [],
    get_timeline_records: [],
    set_to_suppress: true,
    set_to_publish: true,
    set_exhibit_timeline_items_to_suppress: true,
    set_exhibit_timeline_items_to_publish: true
});
jest.mock('../../exhibits/tasks/exhibit_timeline_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockTimelineRecordTask);
});

// Mock Indexer Model
jest.mock('../../indexer/model', () => ({
    index_record: jest.fn().mockResolvedValue({ status: 201 }),
    delete_record: jest.fn().mockResolvedValue({ status: 204 }),
    get_indexed_record: jest.fn().mockResolvedValue({ data: { found: false } })
}));

// Mock Items Model
jest.mock('../../exhibits/items_model', () => ({
    get_item_record: jest.fn().mockResolvedValue({ status: 200, data: {} }),
    get_item_records: jest.fn().mockResolvedValue({ status: 200, data: [] })
}));

// Mock Grids Model
jest.mock('../../exhibits/grid_model', () => ({
    get_grid_record: jest.fn().mockResolvedValue({ status: 200, data: {} })
}));

// Mock Timelines Model
jest.mock('../../exhibits/timelines_model', () => ({
    get_timeline_record: jest.fn().mockResolvedValue({ status: 200, data: {} })
}));

describe('Exhibits Model Integration Tests', () => {
    let EXHIBITS_MODEL;

    beforeAll(() => {
        EXHIBITS_MODEL = require('../../exhibits/exhibits_model');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset mock implementations (needed because jest config has resetMocks: true)
        mockValidate.mockReturnValue(true);
        mockHelperInstance.create_uuid.mockReturnValue(TEST_UUID);
        mockHelperInstance.check_storage_path.mockReturnValue(undefined);
        mockHelperInstance.process_uploaded_media.mockImplementation((uuid, _, media) => `/storage/${uuid}/${media}`);
        mockHelperInstance.unlock_record.mockResolvedValue({ status: true });
        mockExhibitRecordTask.create_exhibit_record.mockResolvedValue(true);
        mockExhibitRecordTask.get_exhibit_records.mockResolvedValue([]);
        mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({});
        mockExhibitRecordTask.get_exhibit_edit_record.mockResolvedValue({});
        mockExhibitRecordTask.update_exhibit_record.mockResolvedValue(true);
        mockExhibitRecordTask.get_exhibit_title.mockResolvedValue('Test Title');
        mockExhibitRecordTask.reorder_exhibits.mockResolvedValue(true);
    });

    afterAll(async () => {
        await new Promise(resolve => setImmediate(resolve));
    });

    // ==================== CREATE EXHIBIT RECORD ====================

    describe('create_exhibit_record', () => {

        test('should create exhibit record successfully', async () => {
            const exhibitData = {
                title: 'Test Exhibit',
                description: 'Test Description'
            };

            mockExhibitRecordTask.create_exhibit_record.mockResolvedValue(true);

            const result = await EXHIBITS_MODEL.create_exhibit_record(exhibitData);

            expect(result.status).toBe(201);
            expect(result.message).toBe('Exhibit record created');
            expect(result.data).toBe(TEST_UUID);
            expect(mockHelperInstance.create_uuid).toHaveBeenCalled();
        });

        test('should return 400 when validation fails', async () => {
            const exhibitData = {
                title: '' // Invalid
            };

            mockValidate.mockReturnValue([
                { message: 'Title is required', dataPath: '.title' }
            ]);

            const result = await EXHIBITS_MODEL.create_exhibit_record(exhibitData);

            expect(result.status).toBe(400);
        });

        test('should return error when database operation fails', async () => {
            const exhibitData = {
                title: 'Test Exhibit'
            };

            mockExhibitRecordTask.create_exhibit_record.mockResolvedValue(false);

            const result = await EXHIBITS_MODEL.create_exhibit_record(exhibitData);

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to create exhibit record');
        });

        test('should bind hero image and thumbnail media when provided', async () => {
            const exhibitData = {
                title: 'Test Exhibit',
                hero_image_media_uuid: 'hero-media-uuid',
                thumbnail_media_uuid: 'thumb-media-uuid',
                created_by: TEST_USER_UID
            };

            mockExhibitRecordTask.create_exhibit_record.mockResolvedValue(true);

            const result = await EXHIBITS_MODEL.create_exhibit_record(exhibitData);

            expect(result.status).toBe(201);
            expect(mockExhibitMediaLibraryTask.bind_media).toHaveBeenCalledTimes(2);
            expect(mockExhibitMediaLibraryTask.bind_media).toHaveBeenCalledWith(TEST_UUID, 'hero-media-uuid', 'hero_image', TEST_USER_UID);
            expect(mockExhibitMediaLibraryTask.bind_media).toHaveBeenCalledWith(TEST_UUID, 'thumb-media-uuid', 'thumbnail', TEST_USER_UID);
        });

        test('should not bind media when no media uuids are provided', async () => {
            const exhibitData = {
                title: 'Test Exhibit'
            };

            mockExhibitRecordTask.create_exhibit_record.mockResolvedValue(true);

            const result = await EXHIBITS_MODEL.create_exhibit_record(exhibitData);

            expect(result.status).toBe(201);
            expect(mockExhibitMediaLibraryTask.bind_media).not.toHaveBeenCalled();
        });

        test('should handle exception gracefully', async () => {
            const exhibitData = {
                title: 'Test Exhibit'
            };

            mockExhibitRecordTask.create_exhibit_record.mockRejectedValue(
                new Error('Database error')
            );

            const result = await EXHIBITS_MODEL.create_exhibit_record(exhibitData);

            expect(result.status).toBe(500);
            expect(result.message).toContain('Unable to create record');
        });
    });

    // ==================== GET EXHIBIT RECORDS ====================

    describe('get_exhibit_records', () => {

        test('should return all exhibit records', async () => {
            const mockRecords = [
                { uuid: TEST_UUID, title: 'Exhibit 1' },
                { uuid: '660e8400-e29b-41d4-a716-446655440002', title: 'Exhibit 2' }
            ];

            mockExhibitRecordTask.get_exhibit_records.mockResolvedValue(mockRecords);

            const result = await EXHIBITS_MODEL.get_exhibit_records();

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit records');
            expect(result.data).toEqual(mockRecords);
        });

        test('should return empty array when no records exist', async () => {
            mockExhibitRecordTask.get_exhibit_records.mockResolvedValue([]);

            const result = await EXHIBITS_MODEL.get_exhibit_records();

            expect(result.status).toBe(200);
            expect(result.data).toEqual([]);
        });

        test('should handle exception gracefully', async () => {
            mockExhibitRecordTask.get_exhibit_records.mockRejectedValue(
                new Error('Query failed')
            );

            const result = await EXHIBITS_MODEL.get_exhibit_records();

            expect(result.status).toBe(400);
            expect(result.message).toBe('Query failed');
        });
    });

    // ==================== GET EXHIBIT RECORD ====================

    describe('get_exhibit_record', () => {

        test('should return single exhibit record', async () => {
            const mockRecord = {
                uuid: TEST_UUID,
                title: 'Test Exhibit',
                description: 'Test Description'
            };

            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue(mockRecord);

            const result = await EXHIBITS_MODEL.get_exhibit_record(TEST_UUID);

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit record');
            expect(result.data).toEqual(mockRecord);
        });

        test('should return 400 for invalid UUID', async () => {
            const result = await EXHIBITS_MODEL.get_exhibit_record(null);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Valid UUID is required');
        });

        test('should return 400 for non-string UUID', async () => {
            const result = await EXHIBITS_MODEL.get_exhibit_record(12345);

            expect(result.status).toBe(400);
        });

        test('should handle exception gracefully', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockRejectedValue(
                new Error('Record not found')
            );

            const result = await EXHIBITS_MODEL.get_exhibit_record(TEST_UUID);

            expect(result.status).toBe(400);
        });
    });

    // ==================== GET EXHIBIT EDIT RECORD ====================

    describe('get_exhibit_edit_record', () => {

        test('should return exhibit edit record', async () => {
            const mockRecord = {
                uuid: TEST_UUID,
                title: 'Test Exhibit',
                is_locked: 1,
                locked_by_user: TEST_USER_UID
            };

            mockExhibitRecordTask.get_exhibit_edit_record.mockResolvedValue(mockRecord);

            const result = await EXHIBITS_MODEL.get_exhibit_edit_record(TEST_USER_UID, TEST_UUID);

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit edit record');
            expect(result.data).toEqual(mockRecord);
        });

        test('should return 400 when UID is missing', async () => {
            const result = await EXHIBITS_MODEL.get_exhibit_edit_record(null, TEST_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UID or UUID provided');
        });

        test('should return 400 when UUID is missing', async () => {
            const result = await EXHIBITS_MODEL.get_exhibit_edit_record(TEST_USER_UID, null);

            expect(result.status).toBe(400);
        });
    });

    // ==================== GET EXHIBIT TITLE ====================

    describe('get_exhibit_title', () => {

        test('should return exhibit title', async () => {
            mockExhibitRecordTask.get_exhibit_title.mockResolvedValue('Test Title');

            const result = await EXHIBITS_MODEL.get_exhibit_title(TEST_UUID);

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit title');
            expect(result.data).toBe('Test Title');
        });

        test('should return 400 for invalid UUID', async () => {
            const result = await EXHIBITS_MODEL.get_exhibit_title(null);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Valid UUID is required');
        });
    });

    // ==================== UPDATE EXHIBIT RECORD ====================

    describe('update_exhibit_record', () => {

        test('should update exhibit record successfully', async () => {
            const updateData = {
                title: 'Updated Title',
                description: 'Updated Description'
            };

            mockExhibitRecordTask.update_exhibit_record.mockResolvedValue(true);

            const result = await EXHIBITS_MODEL.update_exhibit_record(TEST_UUID, updateData);

            expect(result.status).toBe(201);
            expect(result.message).toBe('Exhibit record updated');
        });

        test('should return 400 for invalid UUID', async () => {
            const result = await EXHIBITS_MODEL.update_exhibit_record(null, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Valid UUID is required');
        });

        test('should return 400 when validation fails', async () => {
            mockValidate.mockReturnValue([
                { message: 'Invalid field' }
            ]);

            const result = await EXHIBITS_MODEL.update_exhibit_record(TEST_UUID, { invalid: 'data' });

            expect(result.status).toBe(400);
        });

        test('should return 400 when update fails', async () => {
            mockExhibitRecordTask.update_exhibit_record.mockResolvedValue(false);

            const result = await EXHIBITS_MODEL.update_exhibit_record(TEST_UUID, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Unable to update exhibit record');
        });
    });

    // ==================== UNLOCK EXHIBIT RECORD ====================

    describe('unlock_exhibit_record', () => {

        test('should unlock exhibit record successfully', async () => {
            mockHelperInstance.unlock_record.mockResolvedValue({ status: true });

            const result = await EXHIBITS_MODEL.unlock_exhibit_record(TEST_USER_UID, TEST_UUID, {});

            expect(result.status).toBe(true);
        });

        test('should return false for invalid parameters', async () => {
            const result = await EXHIBITS_MODEL.unlock_exhibit_record(null, TEST_UUID, {});

            expect(result).toBe(false);
        });

        test('should return false when both uid and uuid are invalid', async () => {
            const result = await EXHIBITS_MODEL.unlock_exhibit_record('', '', {});

            expect(result).toBe(false);
        });

        test('should pass force option to helper', async () => {
            const options = { force: true };

            await EXHIBITS_MODEL.unlock_exhibit_record(TEST_USER_UID, TEST_UUID, options);

            expect(mockHelperInstance.unlock_record).toHaveBeenCalledWith(
                TEST_USER_UID,
                TEST_UUID,
                expect.anything(),
                expect.anything(),
                options
            );
        });
    });

    // ==================== CHECK PREVIEW ====================

    describe('check_preview', () => {
        const INDEXER_MODEL = require('../../indexer/model');

        test('should return true when preview exists', async () => {
            INDEXER_MODEL.get_indexed_record.mockResolvedValue({
                data: { found: true }
            });

            const result = await EXHIBITS_MODEL.check_preview(TEST_UUID);

            expect(result).toBe(true);
        });

        test('should return false when preview does not exist', async () => {
            INDEXER_MODEL.get_indexed_record.mockResolvedValue({
                data: { found: false }
            });

            const result = await EXHIBITS_MODEL.check_preview(TEST_UUID);

            expect(result).toBe(false);
        });

        test('should return false for invalid UUID', async () => {
            const result = await EXHIBITS_MODEL.check_preview(null);

            expect(result).toBe(false);
        });

        test('should return false on error', async () => {
            INDEXER_MODEL.get_indexed_record.mockRejectedValue(new Error('Index error'));

            const result = await EXHIBITS_MODEL.check_preview(TEST_UUID);

            expect(result).toBe(false);
        });
    });

    // ==================== REORDER EXHIBITS ====================

    describe('reorder_exhibits', () => {

        test('should reorder exhibits successfully', async () => {
            const orderData = [
                { type: TEST_UUID, order: 1 },
                { type: '660e8400-e29b-41d4-a716-446655440002', order: 2 }
            ];

            mockExhibitRecordTask.reorder_exhibits.mockResolvedValue(true);

            const result = await EXHIBITS_MODEL.reorder_exhibits(orderData);

            expect(result).toBe(true);
        });

        test('should return false for empty array', async () => {
            const result = await EXHIBITS_MODEL.reorder_exhibits([]);

            expect(result).toBe(false);
        });

        test('should return false for non-array input', async () => {
            const result = await EXHIBITS_MODEL.reorder_exhibits('invalid');

            expect(result).toBe(false);
        });

        test('should return false when any update fails', async () => {
            const orderData = [
                { type: TEST_UUID, order: 1 }
            ];

            mockExhibitRecordTask.reorder_exhibits.mockResolvedValue(false);

            const result = await EXHIBITS_MODEL.reorder_exhibits(orderData);

            expect(result).toBe(false);
        });
    });
    /*
     * H7 (code review 2026-09-02): deleting (recycling) an exhibit must take
     * it out of the public index, and the cascade must reach every component
     * type, not only exhibits that happen to have standard items.
     */
    describe('delete_exhibit_record — index consistency (H7)', () => {

        const INDEXER_MODEL = require('../../indexer/model');
        const ITEMS_MODEL = require('../../exhibits/items_model');

        beforeEach(() => {
            mockExhibitRecordTask.delete_exhibit_record.mockResolvedValue(true);
            INDEXER_MODEL.delete_record.mockResolvedValue({ status: 204 });
            INDEXER_MODEL.get_indexed_record.mockResolvedValue({ data: { found: false } });
        });

        test('a PUBLISHED exhibit is suppressed (flags cleared, docs removed) before the soft delete', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ uuid: TEST_UUID, is_published: 1 });

            const result = await EXHIBITS_MODEL.delete_exhibit_record(TEST_UUID);

            expect(result.status).toBe(204);
            expect(mockExhibitRecordTask.set_to_suppress).toHaveBeenCalledWith(TEST_UUID);
            expect(INDEXER_MODEL.delete_record).toHaveBeenCalledWith(TEST_UUID);
            expect(mockExhibitRecordTask.delete_exhibit_record).toHaveBeenCalledWith(TEST_UUID);
        });

        test('refuses the delete (500) when the exhibit doc cannot be removed from the index', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ uuid: TEST_UUID, is_published: 1 });
            INDEXER_MODEL.delete_record.mockResolvedValue({ status: 200, message: 'Unable to delete record' });

            const result = await EXHIBITS_MODEL.delete_exhibit_record(TEST_UUID);

            expect(result.status).toBe(500);
            expect(mockExhibitRecordTask.delete_exhibit_record).not.toHaveBeenCalled();
        });

        test('an UNPUBLISHED exhibit with preview docs has them purged, without touching publish flags', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ uuid: TEST_UUID, is_published: 0 });
            INDEXER_MODEL.get_indexed_record.mockResolvedValue({ data: { found: true } });

            const result = await EXHIBITS_MODEL.delete_exhibit_record(TEST_UUID);

            expect(result.status).toBe(204);
            expect(mockExhibitRecordTask.unset_preview).toHaveBeenCalledWith(TEST_UUID);
            expect(INDEXER_MODEL.delete_record).toHaveBeenCalledWith(TEST_UUID);
            expect(mockExhibitRecordTask.set_to_suppress).not.toHaveBeenCalled();
        });

        test('an unpublished exhibit with nothing indexed never touches the index', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ uuid: TEST_UUID, is_published: 0 });

            const result = await EXHIBITS_MODEL.delete_exhibit_record(TEST_UUID);

            expect(result.status).toBe(204);
            expect(INDEXER_MODEL.delete_record).not.toHaveBeenCalled();
        });

        test('the cascade reaches an exhibit made only of headings (no standard items)', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ uuid: TEST_UUID, is_published: 0 });
            ITEMS_MODEL.get_item_records.mockResolvedValue({ status: 200, data: [
                { uuid: 'h-1', is_member_of_exhibit: TEST_UUID, type: 'heading' }
            ] });

            await EXHIBITS_MODEL.delete_exhibit_record(TEST_UUID);

            expect(mockItemRecordTask.delete_item_record).toHaveBeenCalledWith(TEST_UUID, 'h-1', 'heading');
        });
    });
});
