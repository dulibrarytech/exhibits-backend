/**
 * Integration Tests for Timelines Model
 *
 * Tests the model layer directly, including validation and business logic.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { mock_model } = require('./helpers/mocks');

// ==================== TEST CONSTANTS ====================
const TEST_EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_TIMELINE_UUID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_TIMELINE_ITEM_UUID = '770e8400-e29b-41d4-a716-446655440002';
const TEST_USER_UID = '1'; // numeric tbl_users.id (the lock owner), NOT a UUID

// ==================== MOCK SETUP ====================

// Mock Logger
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

// Mock DB Config
jest.mock('../../config/db_config', () => () => ({
    query: jest.fn()
}));

// Mock DB Tables Config
jest.mock('../../config/db_tables_config', () => require('./helpers/mocks').db_tables_factory({
    exhibit_records: 'tbl_exhibits_exhibit_records',
    timeline_records: 'tbl_exhibits_timeline_records',
    timeline_item_records: 'tbl_exhibits_timeline_item_records'
}));

// Mock Helper instance
const mockHelperInstance = {
    create_uuid: jest.fn().mockReturnValue(TEST_TIMELINE_UUID),
    order_exhibit_items: jest.fn().mockResolvedValue(1),
    order_timeline_items: jest.fn().mockResolvedValue(1),
    /* real helper resolves to the unlocked record row, not a boolean */
    unlock_record: jest.fn().mockResolvedValue({ uuid: TEST_TIMELINE_ITEM_UUID, is_locked: 0, locked_by_user: null }),
    check_storage_path: jest.fn(),
    process_uploaded_media: jest.fn().mockReturnValue('processed-media.jpg')
};

jest.mock('../../libs/helper', () => {
    return jest.fn().mockImplementation(() => mockHelperInstance);
});

// Mock Timeline Record Tasks
const mockTimelineRecordTask = mock_model({
    create_timeline_record: true,
    update_timeline_record: true,
    get_timeline_record: {},
    get_timeline_records: [],
    create_timeline_item_record: true,
    get_timeline_item_records: [],
    get_timeline_item_record: {},
    get_timeline_item_edit_record: {},
    update_timeline_item_record: true,
    delete_timeline_item_record: true,
    set_timeline_to_publish: true,
    set_timeline_to_suppress: true,
    set_to_suppressed_timeline_items: true,
    reorder_timelines: true,
    reorder_timeline_items: true
});

jest.mock('../../exhibits/tasks/exhibit_timeline_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockTimelineRecordTask);
});

// Mock Exhibit Record Tasks
const mockExhibitRecordTask = mock_model({
    update_exhibit_timestamp: true,
    get_exhibit_record: { is_published: 1 }
});

jest.mock('../../exhibits/tasks/exhibit_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockExhibitRecordTask);
});

// Mock Indexer Model
const mockIndexerModel = mock_model({
    index_timeline_record: true,
    index_timeline_item_record: true,
    index_record: true,
    delete_record: { status: 204 },
    get_indexed_record: { status: 200, data: { source: { items: [] } } }
});

jest.mock('../../indexer/model', () => mockIndexerModel);

// Mock Reindex Coalescer (post-edit republish of published timeline items)
const mockReindexCoalescer = mock_model(['schedule_reindex']);

jest.mock('../../exhibits/reindex_coalescer', () => mockReindexCoalescer);

// ==================== TESTS ====================

describe('Timelines Model Integration Tests', () => {
    let TIMELINES_MODEL;

    beforeAll(() => {
        TIMELINES_MODEL = require('../../exhibits/timelines_model');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mock implementations
        mockHelperInstance.create_uuid.mockReturnValue(TEST_TIMELINE_UUID);
        mockHelperInstance.order_exhibit_items.mockResolvedValue(1);
        mockHelperInstance.order_timeline_items.mockResolvedValue(1);
        mockHelperInstance.unlock_record.mockResolvedValue({ uuid: TEST_TIMELINE_ITEM_UUID, is_locked: 0, locked_by_user: null });
        mockTimelineRecordTask.create_timeline_record.mockResolvedValue(true);
        mockTimelineRecordTask.update_timeline_record.mockResolvedValue(true);
        mockTimelineRecordTask.get_timeline_record.mockResolvedValue({});
        mockTimelineRecordTask.get_timeline_records.mockResolvedValue([]);
        mockTimelineRecordTask.create_timeline_item_record.mockResolvedValue(true);
        mockTimelineRecordTask.get_timeline_item_records.mockResolvedValue([]);
        mockTimelineRecordTask.get_timeline_item_record.mockResolvedValue({});
        mockTimelineRecordTask.get_timeline_item_edit_record.mockResolvedValue({});
        mockTimelineRecordTask.update_timeline_item_record.mockResolvedValue(true);
        mockTimelineRecordTask.delete_timeline_item_record.mockResolvedValue(true);
        mockTimelineRecordTask.set_timeline_to_publish.mockResolvedValue(true);
        mockTimelineRecordTask.set_timeline_to_suppress.mockResolvedValue(true);
        mockTimelineRecordTask.set_to_suppressed_timeline_items.mockResolvedValue(true);
        mockTimelineRecordTask.reorder_timelines.mockResolvedValue(true);
        mockTimelineRecordTask.reorder_timeline_items.mockResolvedValue(true);
        mockExhibitRecordTask.update_exhibit_timestamp.mockResolvedValue(true);
        mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ is_published: 1 });
        mockIndexerModel.index_timeline_record.mockResolvedValue(true);
        mockIndexerModel.index_timeline_item_record.mockResolvedValue(true);
        mockIndexerModel.index_record.mockResolvedValue(true);
        mockIndexerModel.delete_record.mockResolvedValue({ status: 204 });
        mockIndexerModel.get_indexed_record.mockResolvedValue({ status: 200, data: { source: { items: [] } } });
    });

    afterAll(async () => {
        await new Promise(resolve => setImmediate(resolve));
    });

    // ==================== CREATE TIMELINE RECORD ====================

    describe('create_timeline_record', () => {

        test('should create timeline record successfully', async () => {
            const timelineData = {
                internal_name: 'Test Timeline'
            };

            const result = await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, timelineData);

            expect(result.status).toBe(201);
            expect(result.message).toBe('Timeline record created');
            expect(result.data).toBe(TEST_TIMELINE_UUID);
            expect(mockTimelineRecordTask.create_timeline_record).toHaveBeenCalled();
        });

        test('should return 400 when internal_name is missing or empty', async () => {
            for (const bad of [undefined, null, '', '   ', 42]) {
                const result = await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, {
                    internal_name: bad
                });

                expect(result.status).toBe(400);
                expect(result.message).toBe('Timeline internal name is required');
            }

            expect(mockTimelineRecordTask.create_timeline_record).not.toHaveBeenCalled();
        });

        test('should trim internal_name and reject values over 255 characters', async () => {
            await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, {
                internal_name: '  Padded name  '
            });

            const callArg = mockTimelineRecordTask.create_timeline_record.mock.calls[0][0];
            expect(callArg.internal_name).toBe('Padded name');

            const result = await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, {
                internal_name: 'x'.repeat(256)
            });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Timeline internal name must be 255 characters or fewer');
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.create_timeline_record('', { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid exhibit UUID provided');
        });

        test('should return 400 for null exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.create_timeline_record(null, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid exhibit UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, null);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should return 500 when database operation fails', async () => {
            mockTimelineRecordTask.create_timeline_record.mockResolvedValue(false);

            const result = await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, { internal_name: 'Test' });

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to create timeline record');
        });

        test('should generate UUID for new timeline', async () => {
            await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, { internal_name: 'Test' });

            expect(mockHelperInstance.create_uuid).toHaveBeenCalled();
        });

        test('should handle styles as object', async () => {
            const timelineData = {
                internal_name: 'Test Timeline',
                styles: { color: 'blue' }
            };

            const result = await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, timelineData);

            expect(result.status).toBe(201);
        });

        test('should handle styles as string', async () => {
            const timelineData = {
                internal_name: 'Test Timeline',
                styles: '{"color": "blue"}'
            };

            const result = await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, timelineData);

            expect(result.status).toBe(201);
        });
    });

    // ==================== UPDATE TIMELINE RECORD ====================

    describe('update_timeline_record', () => {

        test('should return 400 for empty internal_name on update, pass through omitted', async () => {
            const result = await TIMELINES_MODEL.update_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                { internal_name: '   ' }
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Timeline internal name is required');

            const omitted = await TIMELINES_MODEL.update_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                { text: 'no name supplied' }
            );

            expect(omitted.status).toBe(201);
            const callArg = mockTimelineRecordTask.update_timeline_record.mock.calls.at(-1)[0];
            expect(callArg).not.toHaveProperty('internal_name');
        });

        test('should update timeline record successfully', async () => {
            const updateData = {
                title: 'Updated Timeline'
            };

            const result = await TIMELINES_MODEL.update_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                updateData
            );

            expect(result.status).toBe(201);
            expect(result.message).toBe('Timeline record updated');
            expect(mockTimelineRecordTask.update_timeline_record).toHaveBeenCalled();
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.update_timeline_record('', TEST_TIMELINE_UUID, { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.update_timeline_record(TEST_EXHIBIT_UUID, '', { title: 'Test' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await TIMELINES_MODEL.update_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                null
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should return 500 when database operation fails', async () => {
            mockTimelineRecordTask.update_timeline_record.mockResolvedValue(false);

            const result = await TIMELINES_MODEL.update_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to update timeline record');
        });
    });

    // ==================== GET TIMELINE RECORD ====================

    describe('get_timeline_record', () => {

        test('should get timeline record successfully', async () => {
            const mockRecord = {
                uuid: TEST_TIMELINE_UUID,
                title: 'Test Timeline'
            };
            mockTimelineRecordTask.get_timeline_record.mockResolvedValue(mockRecord);

            const result = await TIMELINES_MODEL.get_timeline_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID);

            expect(result.status).toBe(200);
            expect(result.message).toBe('Timeline record');
            expect(result.data).toEqual(mockRecord);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_record('', TEST_TIMELINE_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_record(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== CREATE TIMELINE ITEM RECORD ====================

    describe('create_timeline_item_record', () => {

        beforeEach(() => {
            mockHelperInstance.create_uuid.mockReturnValue(TEST_TIMELINE_ITEM_UUID);
        });

        test('should create timeline item record successfully', async () => {
            const itemData = {
                title: 'Test Timeline Item',
                date: '2024-01-01'
            };

            const result = await TIMELINES_MODEL.create_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                itemData
            );

            expect(result.status).toBe(201);
            expect(result.message).toBe('Timeline item record created');
            expect(result.data).toBe(TEST_TIMELINE_ITEM_UUID);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.create_timeline_item_record(
                '',
                TEST_TIMELINE_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.create_timeline_item_record(
                TEST_EXHIBIT_UUID,
                '',
                { title: 'Test' }
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await TIMELINES_MODEL.create_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                null
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should return 500 when database operation fails', async () => {
            mockTimelineRecordTask.create_timeline_item_record.mockResolvedValue(false);

            const result = await TIMELINES_MODEL.create_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to create timeline item record');
        });
    });

    // ==================== GET TIMELINE ITEM RECORDS ====================

    describe('get_timeline_item_records', () => {

        test('should get all timeline item records successfully', async () => {
            const mockItems = [
                { uuid: TEST_TIMELINE_ITEM_UUID, title: 'Item 1', order: 1 }
            ];
            mockTimelineRecordTask.get_timeline_item_records.mockResolvedValue(mockItems);

            const result = await TIMELINES_MODEL.get_timeline_item_records(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit timeline item records');
            expect(result.data).toHaveLength(1);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_item_records('', TEST_TIMELINE_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_item_records(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== GET TIMELINE ITEM RECORD ====================

    describe('get_timeline_item_record', () => {

        test('should get timeline item record successfully', async () => {
            const mockRecord = {
                uuid: TEST_TIMELINE_ITEM_UUID,
                title: 'Test Timeline Item'
            };
            mockTimelineRecordTask.get_timeline_item_record.mockResolvedValue(mockRecord);

            const result = await TIMELINES_MODEL.get_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit timeline item record');
            expect(result.data).toEqual(mockRecord);
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_item_record(
                '',
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_item_record(
                TEST_EXHIBIT_UUID,
                '',
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid item UUID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                ''
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== GET TIMELINE ITEM EDIT RECORD ====================

    describe('get_timeline_item_edit_record', () => {

        test('should get timeline item edit record successfully', async () => {
            const mockRecord = {
                uuid: TEST_TIMELINE_ITEM_UUID,
                title: 'Test Timeline Item',
                is_locked: 1
            };
            mockTimelineRecordTask.get_timeline_item_edit_record.mockResolvedValue(mockRecord);

            const result = await TIMELINES_MODEL.get_timeline_item_edit_record(
                TEST_USER_UID,
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(200);
            expect(result.message).toBe('Exhibit timeline item edit record');
            expect(result.data).toEqual(mockRecord);
        });

        test('should return 400 for invalid user UID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_item_edit_record(
                '',
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.get_timeline_item_edit_record(
                TEST_USER_UID,
                '',
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== UPDATE TIMELINE ITEM RECORD ====================

    describe('update_timeline_item_record', () => {

        test('should update timeline item record successfully', async () => {
            const updateData = {
                title: 'Updated Timeline Item'
            };

            const result = await TIMELINES_MODEL.update_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID,
                updateData
            );

            expect(result.status).toBe(201);
            expect(result.message).toBe('Timeline item record updated');
        });

        /*
         * Drift fixes (DRY review 2026-09-03, Phase 0 #1/#2): the timeline-item
         * update used to skip the post-edit republish the other three item
         * types perform, and it recomputed `order` through the exhibit-scoped
         * helper with a timeline uuid, moving the item on every edit.
         */
        test('schedules a coalesced re-index when the edited item is published (parity with grid items)', async () => {
            const result = await TIMELINES_MODEL.update_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID,
                { title: 'Edited', is_published: 1 }
            );

            expect(result.status).toBe(201);

            await new Promise(resolve => setImmediate(resolve));

            expect(mockReindexCoalescer.schedule_reindex).toHaveBeenCalledWith(
                `timeline_item:${TEST_TIMELINE_ITEM_UUID}`,
                expect.any(Function)
            );
        });

        test('does not schedule a re-index for an unpublished item', async () => {
            await TIMELINES_MODEL.update_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID,
                { title: 'Edited', is_published: 0 }
            );

            await new Promise(resolve => setImmediate(resolve));

            expect(mockReindexCoalescer.schedule_reindex).not.toHaveBeenCalled();
        });

        test('strips is_published from the DB write and never recomputes order', async () => {
            await TIMELINES_MODEL.update_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID,
                { title: 'Edited', is_published: 1 }
            );

            const written = mockTimelineRecordTask.update_timeline_item_record.mock.calls[0][0];
            expect(written).not.toHaveProperty('is_published');
            expect(written).not.toHaveProperty('order');
            expect(mockHelperInstance.order_exhibit_items).not.toHaveBeenCalled();
            expect(mockHelperInstance.order_timeline_items).not.toHaveBeenCalled();
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.update_timeline_item_record(
                '',
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.update_timeline_item_record(
                TEST_EXHIBIT_UUID,
                '',
                TEST_TIMELINE_ITEM_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid item UUID', async () => {
            const result = await TIMELINES_MODEL.update_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                '',
                { title: 'Test' }
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid data', async () => {
            const result = await TIMELINES_MODEL.update_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID,
                null
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid data provided');
        });

        test('should return 500 when database operation fails', async () => {
            mockTimelineRecordTask.update_timeline_item_record.mockResolvedValue(false);

            const result = await TIMELINES_MODEL.update_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to update timeline item record');
        });
    });

    // ==================== DELETE TIMELINE ITEM RECORD ====================

    describe('delete_timeline_item_record', () => {

        test('should delete timeline item record successfully', async () => {
            const result = await TIMELINES_MODEL.delete_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(204);
            expect(result.message).toBe('Record deleted');
        });

        test('should return 400 for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.delete_timeline_item_record(
                '',
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.delete_timeline_item_record(
                TEST_EXHIBIT_UUID,
                '',
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return 400 for invalid item UUID', async () => {
            const result = await TIMELINES_MODEL.delete_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                ''
            );

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
        });
    });

    // ==================== PUBLISH TIMELINE RECORD ====================

    describe('publish_timeline_record', () => {

        test('should publish timeline record successfully', async () => {
            const result = await TIMELINES_MODEL.publish_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(true);
            expect(result.message).toBe('Timeline published');
        });

        test('should return false for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.publish_timeline_record('', TEST_TIMELINE_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.publish_timeline_record(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false when exhibit is not published', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ is_published: 0 });

            const result = await TIMELINES_MODEL.publish_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toContain('Exhibit must be published first');
        });

        test('should return false when set_timeline_to_publish fails', async () => {
            mockTimelineRecordTask.set_timeline_to_publish.mockResolvedValue(false);

            const result = await TIMELINES_MODEL.publish_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to publish timeline');
        });

        test('should return false when indexing fails', async () => {
            mockIndexerModel.index_timeline_record.mockResolvedValue(false);

            const result = await TIMELINES_MODEL.publish_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to publish timeline');
        });
    });

    // ==================== SUPPRESS TIMELINE RECORD ====================

    describe('suppress_timeline_record', () => {

        test('should suppress timeline record successfully', async () => {
            const result = await TIMELINES_MODEL.suppress_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(true);
            expect(result.message).toBe('Timeline suppressed');
        });

        test('should return false for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.suppress_timeline_record('', TEST_TIMELINE_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.suppress_timeline_record(TEST_EXHIBIT_UUID, '');

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false when delete from index fails', async () => {
            mockIndexerModel.delete_record.mockResolvedValue({ status: 500 });

            const result = await TIMELINES_MODEL.suppress_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to suppress timeline');
        });

        test('should return false when set_timeline_to_suppress fails', async () => {
            mockTimelineRecordTask.set_timeline_to_suppress.mockResolvedValue(false);

            const result = await TIMELINES_MODEL.suppress_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to suppress timeline');
        });
    });

    // ==================== PUBLISH TIMELINE ITEM RECORD ====================

    describe('publish_timeline_item_record', () => {

        test('should publish timeline item record successfully', async () => {
            mockTimelineRecordTask.get_timeline_record.mockResolvedValue({ is_published: 1 });
            mockTimelineRecordTask.get_timeline_item_record.mockResolvedValue({
                uuid: TEST_TIMELINE_ITEM_UUID,
                title: 'Test Item'
            });

            const result = await TIMELINES_MODEL.publish_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(true);
            expect(result.message).toBe('Timeline item published');
        });

        test('should return false for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.publish_timeline_item_record(
                '',
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toBe('Invalid UUID provided');
        });

        test('should return false when timeline is not published', async () => {
            mockTimelineRecordTask.get_timeline_record.mockResolvedValue({ is_published: 0 });

            const result = await TIMELINES_MODEL.publish_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toContain('Timeline must be published first');
        });

        test('should return false when timeline item not found', async () => {
            mockTimelineRecordTask.get_timeline_record.mockResolvedValue({ is_published: 1 });
            mockTimelineRecordTask.get_timeline_item_record.mockResolvedValue(null);

            const result = await TIMELINES_MODEL.publish_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toBe('Timeline item not found');
        });

        test('should return false when indexing fails', async () => {
            mockTimelineRecordTask.get_timeline_record.mockResolvedValue({ is_published: 1 });
            mockTimelineRecordTask.get_timeline_item_record.mockResolvedValue({
                uuid: TEST_TIMELINE_ITEM_UUID
            });
            mockIndexerModel.index_timeline_item_record.mockResolvedValue(false);

            const result = await TIMELINES_MODEL.publish_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toBe('Unable to publish timeline item');
        });
    });

    // ==================== SUPPRESS TIMELINE ITEM RECORD ====================

    describe('suppress_timeline_item_record', () => {

        test('should suppress timeline item record successfully', async () => {
            mockIndexerModel.get_indexed_record.mockResolvedValue({
                status: 200,
                data: { source: { items: [{ uuid: TEST_TIMELINE_ITEM_UUID }] } }
            });

            const result = await TIMELINES_MODEL.suppress_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            /* Same {status, message} contract as suppress_grid_item_record */
            expect(result).toEqual({ status: true, message: 'Timeline item suppressed' });
        });

        test('should return status false for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.suppress_timeline_item_record(
                '',
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result).toEqual({ status: false, message: 'Invalid UUID provided' });
        });

        test('should return status false for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.suppress_timeline_item_record(
                TEST_EXHIBIT_UUID,
                '',
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(false);
        });

        test('should return status false for invalid item UUID', async () => {
            const result = await TIMELINES_MODEL.suppress_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                ''
            );

            expect(result.status).toBe(false);
        });

        test('should return status false when timeline not found in index', async () => {
            mockIndexerModel.get_indexed_record.mockResolvedValue({
                status: 200,
                data: null
            });

            const result = await TIMELINES_MODEL.suppress_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result).toEqual({ status: false, message: 'Timeline not found in index' });
        });

        test('should return status false when delete from index fails', async () => {
            mockIndexerModel.get_indexed_record.mockResolvedValue({
                status: 200,
                data: { source: { items: [] } }
            });
            mockIndexerModel.delete_record.mockResolvedValue({ status: 500 });

            const result = await TIMELINES_MODEL.suppress_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(false);
        });

        test('never resolves to a bare boolean (controller relies on result.status)', async () => {
            const result = await TIMELINES_MODEL.suppress_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(typeof result).toBe('object');
            expect(typeof result.status).toBe('boolean');
            expect(typeof result.message).toBe('string');
        });
    });

    // ==================== REORDER TIMELINES ====================

    describe('reorder_timelines', () => {

        test('should reorder timelines successfully', async () => {
            const timelineOrder = { uuid: TEST_TIMELINE_UUID, order: 1 };

            const result = await TIMELINES_MODEL.reorder_timelines(TEST_EXHIBIT_UUID, timelineOrder);

            expect(result).toBe(true);
            expect(mockTimelineRecordTask.reorder_timelines).toHaveBeenCalledWith(
                TEST_EXHIBIT_UUID,
                timelineOrder
            );
        });

        test('should return false for invalid exhibit UUID', async () => {
            const result = await TIMELINES_MODEL.reorder_timelines('', { order: 1 });

            expect(result).toBe(false);
        });

        test('should return false for invalid timeline data', async () => {
            const result = await TIMELINES_MODEL.reorder_timelines(TEST_EXHIBIT_UUID, null);

            expect(result).toBe(false);
        });

        test('should return false on database error', async () => {
            mockTimelineRecordTask.reorder_timelines.mockRejectedValue(new Error('Database error'));

            const result = await TIMELINES_MODEL.reorder_timelines(TEST_EXHIBIT_UUID, { order: 1 });

            expect(result).toBe(false);
        });
    });

    // ==================== REORDER TIMELINE ITEMS ====================

    describe('reorder_timeline_items', () => {

        test('should reorder timeline items successfully', async () => {
            const itemOrder = { uuid: TEST_TIMELINE_ITEM_UUID, order: 1 };

            const result = await TIMELINES_MODEL.reorder_timeline_items(TEST_TIMELINE_UUID, itemOrder);

            expect(result).toBe(true);
            expect(mockTimelineRecordTask.reorder_timeline_items).toHaveBeenCalledWith(
                TEST_TIMELINE_UUID,
                itemOrder
            );
        });

        test('should return false for invalid timeline UUID', async () => {
            const result = await TIMELINES_MODEL.reorder_timeline_items('', { order: 1 });

            expect(result).toBe(false);
        });

        test('should return false for invalid item data', async () => {
            const result = await TIMELINES_MODEL.reorder_timeline_items(TEST_TIMELINE_UUID, null);

            expect(result).toBe(false);
        });

        test('should return false on database error', async () => {
            mockTimelineRecordTask.reorder_timeline_items.mockRejectedValue(new Error('Database error'));

            const result = await TIMELINES_MODEL.reorder_timeline_items(TEST_TIMELINE_UUID, { order: 1 });

            expect(result).toBe(false);
        });
    });

    // ==================== UNLOCK TIMELINE ITEM RECORD ====================

    describe('unlock_timeline_item_record', () => {

        test('should unlock timeline item record successfully', async () => {
            const result = await TIMELINES_MODEL.unlock_timeline_item_record(
                TEST_USER_UID,
                TEST_TIMELINE_ITEM_UUID,
                {}
            );

            expect(result).toEqual({ uuid: TEST_TIMELINE_ITEM_UUID, is_locked: 0, locked_by_user: null });
            expect(mockHelperInstance.unlock_record).toHaveBeenCalled();
        });

        test('should unlock with force option', async () => {
            const result = await TIMELINES_MODEL.unlock_timeline_item_record(
                TEST_USER_UID,
                TEST_TIMELINE_ITEM_UUID,
                { force: true }
            );

            expect(result).toEqual({ uuid: TEST_TIMELINE_ITEM_UUID, is_locked: 0, locked_by_user: null });
        });

        test('should return false for invalid user UID', async () => {
            const result = await TIMELINES_MODEL.unlock_timeline_item_record(
                '',
                TEST_TIMELINE_ITEM_UUID,
                {}
            );

            expect(result).toBe(false);
        });

        test('should return false for invalid item UUID', async () => {
            const result = await TIMELINES_MODEL.unlock_timeline_item_record(
                TEST_USER_UID,
                '',
                {}
            );

            expect(result).toBe(false);
        });

        test('should return false on database error', async () => {
            mockHelperInstance.unlock_record.mockRejectedValue(new Error('Database error'));

            const result = await TIMELINES_MODEL.unlock_timeline_item_record(
                TEST_USER_UID,
                TEST_TIMELINE_ITEM_UUID,
                {}
            );

            expect(result).toBe(false);
        });
    });

    // ==================== ERROR HANDLING ====================

    describe('Error Handling', () => {

        test('should handle database errors in create_timeline_record', async () => {
            mockTimelineRecordTask.create_timeline_record.mockRejectedValue(new Error('Database error'));

            const result = await TIMELINES_MODEL.create_timeline_record(TEST_EXHIBIT_UUID, { internal_name: 'Test' });

            expect(result.status).toBe(500);
            expect(result.message).toContain('Unable to create timeline record');
        });

        test('should handle database errors in get_timeline_record', async () => {
            mockTimelineRecordTask.get_timeline_record.mockRejectedValue(new Error('Database error'));

            const result = await TIMELINES_MODEL.get_timeline_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID);

            expect(result.status).toBe(400);
        });

        test('should handle database errors in delete_timeline_item_record', async () => {
            mockTimelineRecordTask.delete_timeline_item_record.mockRejectedValue(new Error('Database error'));

            const result = await TIMELINES_MODEL.delete_timeline_item_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID,
                TEST_TIMELINE_ITEM_UUID
            );

            expect(result.status).toBe(400);
        });

        test('should handle database errors in publish_timeline_record', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockRejectedValue(new Error('Database error'));

            const result = await TIMELINES_MODEL.publish_timeline_record(
                TEST_EXHIBIT_UUID,
                TEST_TIMELINE_UUID
            );

            expect(result.status).toBe(false);
        });
    });
    describe('membership guard (H3)', () => {

        test('publishing a timeline that is not in the exhibit flags nothing', async () => {
            mockExhibitRecordTask.get_exhibit_record.mockResolvedValue({ is_published: 1 });
            mockTimelineRecordTask.get_timeline_record.mockResolvedValue(null);

            const result = await TIMELINES_MODEL.publish_timeline_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID);

            expect(result.status).toBe(false);
            expect(mockTimelineRecordTask.set_timeline_to_publish).not.toHaveBeenCalled();
        });

        test('suppressing a timeline that is not in the exhibit leaves its index doc alone', async () => {
            const INDEXER_MODEL = require('../../indexer/model');
            mockTimelineRecordTask.get_timeline_record.mockResolvedValue(null);

            const result = await TIMELINES_MODEL.suppress_timeline_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID);

            expect(result.status).toBe(false);
            expect(INDEXER_MODEL.delete_record).not.toHaveBeenCalled();
        });

        test('suppressing a timeline item that is not in the exhibit never touches the container doc', async () => {
            const INDEXER_MODEL = require('../../indexer/model');
            mockTimelineRecordTask.get_timeline_item_record.mockResolvedValue(null);

            const result = await TIMELINES_MODEL.suppress_timeline_item_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID, TEST_TIMELINE_ITEM_UUID);

            expect(result.status).toBe(false);
            expect(INDEXER_MODEL.get_indexed_record).not.toHaveBeenCalled();
            expect(INDEXER_MODEL.delete_record).not.toHaveBeenCalled();
        });
    });
    describe('suppress_timeline_record scope (H8)', () => {

        test('suppresses exactly this timeline\'s items, once, keyed by the timeline uuid', async () => {
            const INDEXER_MODEL = require('../../indexer/model');
            INDEXER_MODEL.delete_record.mockResolvedValue({ status: 204 });
            mockTimelineRecordTask.get_timeline_record.mockResolvedValue({ uuid: TEST_TIMELINE_UUID, is_member_of_exhibit: TEST_EXHIBIT_UUID });
            mockTimelineRecordTask.set_timeline_to_suppress.mockResolvedValue(true);

            const result = await TIMELINES_MODEL.suppress_timeline_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID);

            expect(result.status).toBe(true);
            expect(mockTimelineRecordTask.set_to_suppressed_timeline_items).toHaveBeenCalledTimes(1);
            expect(mockTimelineRecordTask.set_to_suppressed_timeline_items).toHaveBeenCalledWith(TEST_TIMELINE_UUID);
            expect(mockTimelineRecordTask.get_timeline_records).not.toHaveBeenCalled();
        });
    });
    describe('delete_timeline_item_record — index consistency (M4)', () => {

        const INDEXER_MODEL = require('../../indexer/model');
        const OTHER_ITEM = '990e8400-e29b-41d4-a716-446655440009';

        beforeEach(() => {
            mockTimelineRecordTask.delete_timeline_item_record.mockResolvedValue(true);
            INDEXER_MODEL.index_record.mockResolvedValue(true);
        });

        test('drops the item from the indexed timeline doc before deleting the row', async () => {
            const source = { uuid: TEST_TIMELINE_UUID, items: [{ uuid: TEST_TIMELINE_ITEM_UUID }, { uuid: OTHER_ITEM }] };
            INDEXER_MODEL.get_indexed_record.mockResolvedValue({ status: 200, data: { source } });

            const result = await TIMELINES_MODEL.delete_timeline_item_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID, TEST_TIMELINE_ITEM_UUID);

            expect(result.status).toBe(204);
            expect(INDEXER_MODEL.index_record).toHaveBeenCalledWith(expect.objectContaining({ items: [{ uuid: OTHER_ITEM }] }));
            expect(INDEXER_MODEL.index_record.mock.invocationCallOrder[0])
                .toBeLessThan(mockTimelineRecordTask.delete_timeline_item_record.mock.invocationCallOrder[0]);
        });

        test('an unindexed timeline needs no index write; a failed upsert refuses the delete', async () => {
            INDEXER_MODEL.get_indexed_record.mockResolvedValue({ status: 404 });
            expect((await TIMELINES_MODEL.delete_timeline_item_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID, TEST_TIMELINE_ITEM_UUID)).status).toBe(204);
            expect(INDEXER_MODEL.index_record).not.toHaveBeenCalled();

            INDEXER_MODEL.get_indexed_record.mockResolvedValue({ status: 200, data: { source: { items: [{ uuid: TEST_TIMELINE_ITEM_UUID }] } } });
            INDEXER_MODEL.index_record.mockResolvedValue(false);
            mockTimelineRecordTask.delete_timeline_item_record.mockClear();
            expect((await TIMELINES_MODEL.delete_timeline_item_record(TEST_EXHIBIT_UUID, TEST_TIMELINE_UUID, TEST_TIMELINE_ITEM_UUID)).status).toBe(500);
            expect(mockTimelineRecordTask.delete_timeline_item_record).not.toHaveBeenCalled();
        });
    });
});
