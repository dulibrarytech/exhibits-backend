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
const TEST_MEDIA_UUID = '880e8400-e29b-41d4-a716-446655440003';
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
    normalize_href: jest.fn((value) => {
        const href = String(value).trim();

        if (/^(?:https?:|mailto:|tel:|\/(?!\/)|#)/i.test(href)) {
            return href;
        }

        if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]\S*)?$/i.test(href)) {
            return 'https://' + href;
        }

        return null;
    })
}));

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

// Mock Grid Record Tasks
const mockGridRecordTask = {
    create_grid_record: jest.fn().mockResolvedValue(true),
    create_grid_with_items: jest.fn().mockResolvedValue(true),
    update_grid_record: jest.fn().mockResolvedValue(true),
    get_grid_record: jest.fn().mockResolvedValue({}),
    create_grid_item_record: jest.fn().mockResolvedValue(true),
    get_grid_item_records: jest.fn().mockResolvedValue([]),
    get_grid_item_record: jest.fn().mockResolvedValue({}),
    get_grid_item_count: jest.fn().mockResolvedValue(4),
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
    reindex_grid_record: jest.fn().mockResolvedValue(true),
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
        mockGridRecordTask.get_grid_item_count.mockResolvedValue(4);
        mockGridRecordTask.update_grid_item_record.mockResolvedValue(true);
        mockGridRecordTask.delete_grid_item_record.mockResolvedValue(true);
        mockGridRecordTask.create_grid_with_items.mockResolvedValue(true);
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
                internal_name: 'Test Grid',
                columns: 3
            };

            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            expect(result.status).toBe(201);
            expect(result.message).toBe('Grid record created');
            expect(result.data).toBe(TEST_GRID_UUID);
            expect(mockGridRecordTask.create_grid_record).toHaveBeenCalled();
        });

        test('should return 400 when internal_name is missing or empty', async () => {
            for (const bad of [undefined, null, '', '   ', 42]) {
                const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, {
                    columns: 3,
                    internal_name: bad
                });

                expect(result.status).toBe(400);
                expect(result.message).toBe('Grid internal name is required');
            }

            expect(mockGridRecordTask.create_grid_record).not.toHaveBeenCalled();
        });

        test('should trim internal_name and reject values over 255 characters', async () => {
            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, {
                columns: 3,
                internal_name: '  Padded name  '
            });

            const callArg = mockGridRecordTask.create_grid_record.mock.calls[0][0];
            expect(callArg.internal_name).toBe('Padded name');

            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, {
                columns: 3,
                internal_name: 'x'.repeat(256)
            });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Grid internal name must be 255 characters or fewer');
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

        test('should return 500 when database operation fails', async () => {
            mockGridRecordTask.create_grid_record.mockResolvedValue(false);

            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, { internal_name: 'Test' });

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to create grid record');
        });

        test('should handle styles object', async () => {
            const gridData = {
                internal_name: 'Test Grid',
                styles: { backgroundColor: '#fff' }
            };

            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            expect(mockGridRecordTask.create_grid_record).toHaveBeenCalled();
        });

        test('should handle styles string', async () => {
            const gridData = {
                internal_name: 'Test Grid',
                styles: '{"backgroundColor": "#fff"}'
            };

            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            expect(mockGridRecordTask.create_grid_record).toHaveBeenCalled();
        });

        test('should parse columns as integer', async () => {
            const gridData = {
                internal_name: 'Test Grid',
                columns: '4'
            };

            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            const callArg = mockGridRecordTask.create_grid_record.mock.calls[0][0];
            expect(callArg.columns).toBe(4);
        });

        test('should default columns to 4 when omitted', async () => {
            const gridData = {
                internal_name: 'Test Grid'
            };

            await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, gridData);

            const callArg = mockGridRecordTask.create_grid_record.mock.calls[0][0];
            expect(callArg.columns).toBe(4);
        });

        test('should return 400 for columns outside the allowed set (2-4)', async () => {
            for (const bad of [1, 5, 12, 'invalid']) {
                const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, {
                    title: 'Test Grid',
                    columns: bad
                });

                expect(result.status).toBe(400);
                expect(result.message).toBe('Grid columns must be 2, 3, or 4');
            }

            expect(mockGridRecordTask.create_grid_record).not.toHaveBeenCalled();
        });
    });

    describe('create_grid_with_items', () => {

        const ITEM_UUIDS = [
            'a0000000-0000-4000-8000-000000000001',
            'a0000000-0000-4000-8000-000000000002',
            'a0000000-0000-4000-8000-000000000003'
        ];
        const SAVE_MESSAGE = 'Grids cannot have less items than there are columns. ' +
            'Reduce the amount of columns or add more items before saving.';

        const media_item = () => ({ item_type: 'image', mime_type: 'image/jpeg', media_uuid: TEST_MEDIA_UUID });
        const text_item = (text = '<p>Text</p>') => ({ item_type: 'text', mime_type: 'text/plain', text });
        const button_item = () => ({
            item_type: 'content_block',
            type: 'content_block',
            content_type: 'button',
            text: 'Go',
            url: 'https://www.du.edu',
            size: 'small'
        });
        const valid_payload = () => ({
            grid: { internal_name: 'Test Grid', columns: '3', text: '<p>Intro</p>' },
            items: [media_item(), text_item(), button_item()]
        });

        beforeEach(() => {
            const uuids = [TEST_GRID_UUID, ...ITEM_UUIDS];
            let uuid_calls = 0;

            mockHelperInstance.create_uuid.mockImplementation(() => uuids[uuid_calls++]);
            mockHelperInstance.order_exhibit_items.mockResolvedValue(7);
            mockGridRecordTask.create_grid_with_items.mockImplementation(async (grid, items) => ({
                success: true,
                grid_uuid: grid.uuid,
                item_uuids: items.map((item) => item.uuid)
            }));
        });

        test('creates the grid and its items through one task call', async () => {
            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, valid_payload());

            expect(result.status).toBe(201);
            expect(result.data).toEqual({ grid_uuid: TEST_GRID_UUID, item_uuids: ITEM_UUIDS });
            expect(mockGridRecordTask.create_grid_with_items).toHaveBeenCalledTimes(1);
            expect(mockGridRecordTask.create_grid_record).not.toHaveBeenCalled();
            expect(mockGridRecordTask.create_grid_item_record).not.toHaveBeenCalled();

            const [grid, items] = mockGridRecordTask.create_grid_with_items.mock.calls[0];

            expect(grid).toEqual(expect.objectContaining({
                uuid: TEST_GRID_UUID,
                is_member_of_exhibit: TEST_EXHIBIT_UUID,
                internal_name: 'Test Grid',
                columns: 3,
                order: 7
            }));
            expect(items.map((item) => item.uuid)).toEqual(ITEM_UUIDS);
            expect(items.map((item) => item.item_type)).toEqual(['image', 'text', 'content_block']);
        });

        test('accepts more items than columns', async () => {
            const payload = valid_payload();
            payload.grid.columns = 2;

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.create_grid_with_items.mock.calls[0][1]).toHaveLength(3);
        });

        test('gives an item sent without a title an empty one', async () => {
            const payload = valid_payload();
            payload.items[0].title = 'Kept title';
            payload.items[1].title = null;

            await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            const items = mockGridRecordTask.create_grid_with_items.mock.calls[0][1];

            expect(items.map((item) => item.title)).toEqual(['Kept title', '', '']);
        });

        test('requires columns and never falls back to a default', async () => {
            for (const missing of [undefined, null, '']) {
                const payload = valid_payload();
                payload.grid.columns = missing;

                const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

                expect(result.status).toBe(400);
                expect(result.errors).toEqual([
                    { index: null, field: 'columns', message: 'Please select the number of columns' }
                ]);
            }

            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
        });

        test('refuses columns outside the allowed set (2-4)', async () => {
            for (const bad of [1, 5, 'invalid']) {
                const payload = valid_payload();
                payload.grid.columns = bad;

                const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

                expect(result.status).toBe(400);
                expect(result.errors).toEqual([
                    { index: null, field: 'columns', message: 'Grid columns must be 2, 3, or 4' }
                ]);
            }

            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
        });

        test('requires an internal name', async () => {
            const payload = valid_payload();
            payload.grid.internal_name = '   ';

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            expect(result.status).toBe(400);
            expect(result.errors).toEqual([
                { index: null, field: 'internal_name', message: 'Grid internal name is required' }
            ]);
            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
        });

        test('refuses a grid with fewer items than columns', async () => {
            const payload = valid_payload();
            payload.items.pop();

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            expect(result.status).toBe(422);
            expect(result.message).toBe(SAVE_MESSAGE);
            expect(result.errors).toBeUndefined();
            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
        });

        test('refuses a grid with no items', async () => {
            const payload = valid_payload();
            payload.items = [];

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            expect(result.status).toBe(422);
            expect(result.message).toBe(SAVE_MESSAGE);
            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
        });

        test('saves nothing when the third item is invalid and reports its position', async () => {
            const payload = valid_payload();
            payload.items[2] = text_item('');

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            expect(result.status).toBe(400);
            expect(result.message).toBe(
                'Some required information is missing or not valid. Check the marked fields and try again.'
            );
            expect(result.errors).toEqual([
                { index: 2, field: 'text', message: 'Please enter the text for this item' }
            ]);
            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
            expect(mockExhibitRecordTask.update_exhibit_timestamp).not.toHaveBeenCalled();
        });

        test('reports every invalid item and grid field in one response', async () => {
            const payload = valid_payload();
            payload.grid.columns = '';
            delete payload.items[0].media_uuid;
            payload.items[2].url = '';
            payload.items[2].size = '';

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            expect(result.status).toBe(400);
            expect(result.errors).toEqual([
                { index: null, field: 'columns', message: 'Please select the number of columns' },
                { index: 0, field: 'media_uuid', message: 'Please select a media item' },
                { index: 2, field: 'url', message: 'Please enter the button URL' },
                { index: 2, field: 'size', message: 'Please select a button size' }
            ]);
        });

        test('refuses a content block item with no or an unknown content_type', async () => {
            for (const [content_type, message] of [
                [undefined, 'Please select a content block type'],
                ['', 'Please select a content block type'],
                ['divider', 'Content block type must be Button, Card, Emphasis or Quote']
            ]) {
                const payload = valid_payload();
                payload.items[1] = { item_type: 'content_block', type: 'content_block', content_type, text: 'x' };

                const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

                expect(result.status).toBe(400);
                expect(result.errors).toEqual([{ index: 1, field: 'content_type', message }]);
            }

            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
        });

        test('refuses a button whose url is not a web address', async () => {
            const payload = valid_payload();
            payload.items[2].url = 'javascript:alert(1)';

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            expect(result.status).toBe(400);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual(expect.objectContaining({ index: 2, field: 'url' }));
            expect(result.errors[0].message).toMatch(/^Button URL/);
            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
        });

        test('stores a bare-host button url with https://', async () => {
            const payload = valid_payload();
            payload.items[2].url = 'www.du.edu';

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, payload);

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.create_grid_with_items.mock.calls[0][1][2].url).toBe('https://www.du.edu');
        });

        test('sanitizes the grid and every item with the same rich-text profiles as the single creates', async () => {
            const RTE = require('../../libs/rte_vocabulary');

            await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, valid_payload());

            expect(RTE.apply).toHaveBeenCalledWith(
                expect.objectContaining({ internal_name: 'Test Grid' }),
                { text: 'full', internal_name: 'plain' }
            );

            for (const item_type of ['image', 'text', 'content_block']) {
                expect(RTE.apply).toHaveBeenCalledWith(
                    expect.objectContaining({ item_type }),
                    expect.objectContaining({ title: 'reduced', text: 'full', attribution: 'plain' })
                );
            }
        });

        test('returns 400 for a malformed request', async () => {
            const bad_requests = [
                ['', valid_payload()],
                [TEST_EXHIBIT_UUID, null],
                [TEST_EXHIBIT_UUID, { items: [text_item()] }],
                [TEST_EXHIBIT_UUID, { grid: [], items: [text_item()] }],
                [TEST_EXHIBIT_UUID, { grid: { internal_name: 'x', columns: 2 } }],
                [TEST_EXHIBIT_UUID, { grid: { internal_name: 'x', columns: 2 }, items: 'two' }],
                [TEST_EXHIBIT_UUID, { grid: { internal_name: 'x', columns: 2 }, items: [text_item(), 'second'] }]
            ];

            for (const [exhibit_id, payload] of bad_requests) {
                const result = await GRID_MODEL.create_grid_with_items(exhibit_id, payload);

                expect(result.status).toBe(400);
                expect(result.errors).toBeUndefined();
            }

            expect(mockGridRecordTask.create_grid_with_items).not.toHaveBeenCalled();
        });

        test('returns 404 when the exhibit does not exist', async () => {
            mockGridRecordTask.create_grid_with_items.mockResolvedValue({ success: false, exhibit_not_found: true });

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, valid_payload());

            expect(result.status).toBe(404);
            expect(result.message).toBe('Exhibit not found');
        });

        test('returns 500 without database details when the save fails', async () => {
            mockGridRecordTask.create_grid_with_items.mockRejectedValue(new Error('ER_DUP_ENTRY tbl_grid_items'));

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, valid_payload());

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to create grid. Nothing was saved.');
        });

        test('returns 500 when the task reports no success', async () => {
            mockGridRecordTask.create_grid_with_items.mockResolvedValue(false);

            const result = await GRID_MODEL.create_grid_with_items(TEST_EXHIBIT_UUID, valid_payload());

            expect(result.status).toBe(500);
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

        test('should return 500 when database operation fails', async () => {
            mockGridRecordTask.update_grid_record.mockResolvedValue(false);

            const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, { title: 'Test' });

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to update grid record');
        });

        test('should parse columns as integer on update', async () => {
            await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, {
                title: 'Updated Grid',
                columns: '3'
            });

            const callArg = mockGridRecordTask.update_grid_record.mock.calls[0][0];
            expect(callArg.columns).toBe(3);
        });

        test('should leave stored columns untouched when omitted on update', async () => {
            await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, {
                title: 'Updated Grid'
            });

            const callArg = mockGridRecordTask.update_grid_record.mock.calls[0][0];
            expect(callArg).not.toHaveProperty('columns');
        });

        test('should return 400 for columns outside the allowed set (2-4) on update', async () => {
            for (const bad of [1, 5, 12, 'invalid']) {
                const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, {
                    title: 'Updated Grid',
                    columns: bad
                });

                expect(result.status).toBe(400);
                expect(result.message).toBe('Grid columns must be 2, 3, or 4');
            }

            expect(mockGridRecordTask.update_grid_record).not.toHaveBeenCalled();
        });
    });

    describe('update_grid_record items-vs-columns guard', () => {

        const SAVE_MESSAGE = 'Grids cannot have less items than there are columns. ' +
            'Reduce the amount of columns or add more items before saving.';

        const arrange = (stored_columns, item_count) => {
            mockGridRecordTask.get_grid_record.mockResolvedValue({
                uuid: TEST_GRID_UUID,
                columns: stored_columns,
                internal_name: 'Staff grid name'
            });
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(item_count);
        };

        const update_columns = (columns) => GRID_MODEL.update_grid_record(
            TEST_EXHIBIT_UUID,
            TEST_GRID_UUID,
            { internal_name: 'Staff grid name', columns }
        );

        test('refuses raising columns above the item count', async () => {
            arrange(3, 3);

            const result = await update_columns(4);

            expect(result.status).toBe(422);
            expect(result.message).toBe(SAVE_MESSAGE);
            expect(mockGridRecordTask.update_grid_record).not.toHaveBeenCalled();
            expect(mockExhibitRecordTask.update_exhibit_timestamp).not.toHaveBeenCalled();
        });

        test('refuses the raise when columns arrive as a string', async () => {
            arrange(3, 3);

            const result = await update_columns('4');

            expect(result.status).toBe(422);
        });

        test('allows raising columns when the grid holds enough items', async () => {
            arrange(2, 4);

            const result = await update_columns(4);

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.update_grid_record.mock.calls[0][0].columns).toBe(4);
        });

        test('allows saving a short legacy grid when its columns are unchanged', async () => {
            arrange(4, 1);

            const result = await update_columns(4);

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.update_grid_record).toHaveBeenCalled();
        });

        test('allows lowering columns on a grid that is still short of items', async () => {
            arrange(4, 1);

            const result = await update_columns(2);

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.update_grid_record.mock.calls[0][0].columns).toBe(2);
        });

        test('refuses raising columns on a grid that is already short of items', async () => {
            arrange(3, 1);

            const result = await update_columns(4);

            expect(result.status).toBe(422);
            expect(mockGridRecordTask.update_grid_record).not.toHaveBeenCalled();
        });

        test('treats a stored column value outside 2-4 as the smallest allowed count', async () => {
            arrange(1, 1);

            const kept = await update_columns(2);
            expect(kept.status).toBe(201);

            const raised = await update_columns(3);
            expect(raised.status).toBe(422);
        });

        test('leaves a missing grid to the update task', async () => {
            mockGridRecordTask.get_grid_record.mockResolvedValue(null);
            mockGridRecordTask.update_grid_record.mockResolvedValue(false);

            const result = await update_columns(4);

            expect(result.status).toBe(500);
            expect(mockGridRecordTask.get_grid_item_count).not.toHaveBeenCalled();
        });
    });

    describe('update_grid_record on a published grid', () => {

        const INDEXER_MODEL = require('../../indexer/model');

        const SAVE_MESSAGE = 'Grids cannot have less items than there are columns. ' +
            'Reduce the amount of columns or add more items before saving.';

        const arrange = ({ is_published, stored_columns = 3, item_count = 4, published_count = 4 }) => {
            mockGridRecordTask.get_grid_record.mockResolvedValue({
                uuid: TEST_GRID_UUID,
                columns: stored_columns,
                internal_name: 'Staff grid name',
                is_published
            });
            mockGridRecordTask.get_grid_item_count.mockImplementation(async (exhibit_id, grid_id, options = {}) => {
                return options.published_only === true ? published_count : item_count;
            });
        };

        const save = (data) => GRID_MODEL.update_grid_record(
            TEST_EXHIBIT_UUID,
            TEST_GRID_UUID,
            { internal_name: 'Staff grid name', ...data }
        );

        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('re-indexes the grid\'s settings shortly after the save, without re-publishing its items', async () => {
            arrange({ is_published: 1 });

            const result = await save({ text: '<p>Changed</p>' });

            expect(result.status).toBe(201);
            expect(INDEXER_MODEL.reindex_grid_record).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1500);

            expect(INDEXER_MODEL.reindex_grid_record).toHaveBeenCalledTimes(1);
            expect(INDEXER_MODEL.reindex_grid_record).toHaveBeenCalledWith(TEST_EXHIBIT_UUID, TEST_GRID_UUID);
            expect(INDEXER_MODEL.index_grid_record).not.toHaveBeenCalled();
        });

        test('re-indexes once for several saves in quick succession', async () => {
            arrange({ is_published: 1 });

            await save({ text: '<p>One</p>' });
            await jest.advanceTimersByTimeAsync(300);
            await save({ text: '<p>Two</p>' });
            await jest.advanceTimersByTimeAsync(300);
            await save({ text: '<p>Three</p>' });
            await jest.advanceTimersByTimeAsync(1500);

            expect(INDEXER_MODEL.reindex_grid_record).toHaveBeenCalledTimes(1);
        });

        test('a save and a reorder of the same grid in the same second share one re-index', async () => {
            const ITEMS_MODEL = require('../../exhibits/items_model');

            arrange({ is_published: 1 });
            ITEMS_MODEL.schedule_reorder_reindex(TEST_EXHIBIT_UUID, [
                { type: 'griditem', uuid: TEST_GRID_ITEM_UUID, order: 1, grid_id: TEST_GRID_UUID }
            ]);

            await save({ text: '<p>Changed</p>' });
            await jest.advanceTimersByTimeAsync(1500);

            expect(INDEXER_MODEL.reindex_grid_record).toHaveBeenCalledTimes(1);
            expect(INDEXER_MODEL.reindex_grid_record).toHaveBeenCalledWith(TEST_EXHIBIT_UUID, TEST_GRID_UUID);
            expect(INDEXER_MODEL.index_grid_record).not.toHaveBeenCalled();
        });

        test('a save still re-indexes when the reorder came second', async () => {
            const ITEMS_MODEL = require('../../exhibits/items_model');

            arrange({ is_published: 1 });

            await save({ text: '<p>Changed</p>' });
            await jest.advanceTimersByTimeAsync(300);
            ITEMS_MODEL.schedule_reorder_reindex(TEST_EXHIBIT_UUID, [
                { type: 'grid', uuid: TEST_GRID_UUID, order: 2 }
            ]);
            await jest.advanceTimersByTimeAsync(1500);

            expect(INDEXER_MODEL.reindex_grid_record).toHaveBeenCalledTimes(1);
            expect(INDEXER_MODEL.reindex_grid_record).toHaveBeenCalledWith(TEST_EXHIBIT_UUID, TEST_GRID_UUID);
        });

        test('leaves the index alone when the grid is not published', async () => {
            arrange({ is_published: 0 });

            const result = await save({ text: '<p>Changed</p>' });
            await jest.advanceTimersByTimeAsync(1500);

            expect(result.status).toBe(201);
            expect(INDEXER_MODEL.reindex_grid_record).not.toHaveBeenCalled();
        });

        test('leaves the index alone when the save fails', async () => {
            arrange({ is_published: 1 });
            mockGridRecordTask.update_grid_record.mockResolvedValue(false);

            const result = await save({ text: '<p>Changed</p>' });
            await jest.advanceTimersByTimeAsync(1500);

            expect(result.status).toBe(500);
            expect(INDEXER_MODEL.reindex_grid_record).not.toHaveBeenCalled();
        });

        test('refuses a raise above the number of published items and says to publish more', async () => {
            arrange({ is_published: 1, stored_columns: 3, item_count: 4, published_count: 3 });

            const result = await save({ columns: 4 });
            await jest.advanceTimersByTimeAsync(1500);

            expect(result.status).toBe(422);
            expect(result.message).toBe(
                'This grid is published and has 3 published items. ' +
                'Publish more of its items before changing it to 4 columns.'
            );
            expect(mockGridRecordTask.update_grid_record).not.toHaveBeenCalled();
            expect(INDEXER_MODEL.reindex_grid_record).not.toHaveBeenCalled();
        });

        test('allows the raise once enough items are published', async () => {
            arrange({ is_published: 1, stored_columns: 3, item_count: 4, published_count: 4 });

            const result = await save({ columns: 4 });

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.update_grid_record).toHaveBeenCalledWith(
                expect.objectContaining({ columns: 4 })
            );
        });

        test('keeps the usual sentence when there are too few items of any kind', async () => {
            arrange({ is_published: 1, stored_columns: 3, item_count: 3, published_count: 3 });

            const result = await save({ columns: 4 });

            expect(result.status).toBe(422);
            expect(result.message).toBe(SAVE_MESSAGE);
        });

        test('counts every item, published or not, when the grid is not published', async () => {
            arrange({ is_published: 0, stored_columns: 3, item_count: 4, published_count: 0 });

            const result = await save({ columns: 4 });

            expect(result.status).toBe(201);
        });

        test('lets a published grid be lowered or left as it is whatever is published', async () => {
            arrange({ is_published: 1, stored_columns: 4, item_count: 4, published_count: 2 });

            expect((await save({ columns: 3 })).status).toBe(201);
            expect((await save({ columns: 4 })).status).toBe(201);
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

        test('should refuse a content block button whose url is not a web address', async () => {
            const itemData = { item_type: 'content_block', content_type: 'button', text: '<p>Go</p>', size: 'small', url: 'javascript:alert(1)' };

            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(result.status).toBe(400);
            expect(result.message).toMatch(/^Button URL/);
            expect(mockGridRecordTask.create_grid_item_record).not.toHaveBeenCalled();
        });

        test('should store a bare-host button url with https://', async () => {
            const itemData = { item_type: 'content_block', content_type: 'button', text: '<p>Go</p>', size: 'small', url: 'www.du.edu' };

            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.create_grid_item_record.mock.calls[0][0].url).toBe('https://www.du.edu');
        });

        test('should refuse a content block button url update that is not a web address', async () => {
            const itemData = { item_type: 'content_block', content_type: 'button', text: '<p>Go</p>', size: 'small', url: 'data:text/html,x' };

            const result = await GRID_MODEL.update_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, TEST_GRID_ITEM_UUID, itemData);

            expect(result.status).toBe(400);
            expect(result.message).toMatch(/^Button URL/);
            expect(mockGridRecordTask.update_grid_item_record).not.toHaveBeenCalled();
        });

        test('should sanitize a content block attribution as plain text', async () => {
            const RTE = require('../../libs/rte_vocabulary');
            const itemData = { item_type: 'content_block', content_type: 'quote', text: '<p>Q</p>', attribution: 'A' };

            await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(RTE.apply).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ attribution: 'plain' }));
        });

        // Media is no longer processed inline (the old process_uploaded_media
        // path); it rides through to the record task as a plain field.
        test('should pass media field through to the record task', async () => {
            const itemData = {
                title: 'Media Item',
                item_type: 'image',
                media: 'test-media-uuid'
            };

            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, itemData);

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.create_grid_item_record).toHaveBeenCalledWith(
                expect.objectContaining({ media: 'test-media-uuid' })
            );
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

        test('should return 500 when database operation fails', async () => {
            mockGridRecordTask.create_grid_item_record.mockResolvedValue(false);

            const result = await GRID_MODEL.create_grid_item_record(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                { title: 'Test' }
            );

            expect(result.status).toBe(500);
            expect(result.message).toBe('Unable to create grid item record');
        });
    });

    describe('create_grid_item_record content block checks', () => {

        const BUTTON = { item_type: 'content_block', content_type: 'button', text: 'Go', url: 'https://www.du.edu', size: 'small' };
        const CARD = { item_type: 'content_block', content_type: 'card', title: 'Heading', text: '<p>Body</p>' };
        const EMPHASIS = { item_type: 'content_block', content_type: 'emphasis', text: '<p>Note</p>' };
        const QUOTE = { item_type: 'content_block', content_type: 'quote', text: '<p>Quote</p>' };

        test.each([
            ['a content block with no content_type', { item_type: 'content_block', text: 'x' }, 'Please select a content block type'],
            [
                'what the Add Content Block page sends with no type chosen',
                { content_type: '', is_published: '0', styles: null, type: 'content_block', item_type: 'content_block', title: '' },
                'Please select a content block type'
            ],
            ['an unknown content_type', { item_type: 'content_block', content_type: 'divider', size: 'small' }, 'Content block type must be Button, Card, Emphasis or Quote'],
            ['a content_type inherited from Object', { item_type: 'content_block', content_type: 'constructor' }, 'Content block type must be Button, Card, Emphasis or Quote'],
            ['a button with no text', { ...BUTTON, text: '' }, 'Please enter the button text'],
            ['a button with no url', { ...BUTTON, url: '   ' }, 'Please enter the button URL'],
            ['a button with no size', { ...BUTTON, size: undefined }, 'Please select a button size'],
            ['a card with no heading', { ...CARD, title: '' }, 'Please enter the card heading'],
            ['a card with no body', { ...CARD, text: null }, 'Please enter the card body'],
            ['emphasis with no text', { ...EMPHASIS, text: '' }, 'Please enter the emphasis text'],
            ['a quote with no text', { ...QUOTE, text: '' }, 'Please enter the quote text']
        ])('refuses %s', async (label, itemData, message) => {
            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, { ...itemData });

            expect(result.status).toBe(400);
            expect(result.message).toBe(message);
            expect(mockGridRecordTask.create_grid_item_record).not.toHaveBeenCalled();
        });

        test.each([
            ['a button', BUTTON],
            ['a card', CARD],
            ['emphasis', EMPHASIS],
            ['a quote without attribution', QUOTE],
            ['a text item', { item_type: 'text', text: '<p>Text</p>' }],
            ['a media item', { item_type: 'pdf', media_uuid: TEST_MEDIA_UUID }]
        ])('accepts %s', async (label, itemData) => {
            const result = await GRID_MODEL.create_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, { ...itemData });

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.create_grid_item_record).toHaveBeenCalledTimes(1);
        });
    });

    describe('update_grid_item_record content block checks', () => {

        const update_item = (data) => GRID_MODEL.update_grid_item_record(
            TEST_EXHIBIT_UUID,
            TEST_GRID_UUID,
            TEST_GRID_ITEM_UUID,
            data
        );

        test('refuses a content block saved with no type chosen', async () => {
            const result = await update_item({ content_type: '', is_published: '0', styles: null, updated_by: 'tester' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Please select a content block type');
            expect(mockGridRecordTask.update_grid_item_record).not.toHaveBeenCalled();
        });

        test('refuses a content block missing a field its type requires', async () => {
            const result = await update_item({ content_type: 'card', title: '', text: '<p>Body</p>' });

            expect(result.status).toBe(400);
            expect(result.message).toBe('Please enter the card heading');
            expect(mockGridRecordTask.update_grid_item_record).not.toHaveBeenCalled();
        });

        test('saves a complete content block', async () => {
            const result = await update_item({ content_type: 'quote', text: '<p>Quote</p>', attribution: '' });

            expect(result.status).toBe(201);
            expect(mockGridRecordTask.update_grid_item_record).toHaveBeenCalledTimes(1);
        });

        test('leaves updates that name no content_type as they were', async () => {
            for (const data of [{ title: 'Renamed' }, { item_type: 'text', text: '' }, { title: 'Echoed', content_type: null }]) {
                const result = await update_item(data);

                expect(result.status).toBe(201);
            }

            expect(mockGridRecordTask.update_grid_item_record).toHaveBeenCalledTimes(3);
        });
    });

    describe('delete_grid_item_record', () => {

        const DELETE_MESSAGE = 'Grids cannot contain less items than there are columns. ' +
            'Reduce the amount of columns to delete items.';
        const ADD_ITEMS_MESSAGE = 'Grids cannot contain less items than there are columns. ' +
            'Add more items before deleting this one, or delete the whole grid.';

        const delete_item = (...options) => GRID_MODEL.delete_grid_item_record(
            TEST_EXHIBIT_UUID,
            TEST_GRID_UUID,
            TEST_GRID_ITEM_UUID,
            ...options
        );

        beforeEach(() => {
            mockGridRecordTask.get_grid_record.mockResolvedValue({ uuid: TEST_GRID_UUID, columns: 3 });
            mockGridRecordTask.get_grid_item_record.mockResolvedValue({ uuid: TEST_GRID_ITEM_UUID, is_deleted: 0 });
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(4);
            mockGridRecordTask.delete_grid_item_record.mockResolvedValue({ success: true });
        });

        test('deletes an item when the grid keeps at least as many items as columns', async () => {
            const result = await delete_item();

            expect(result.status).toBe(204);
            expect(mockGridRecordTask.delete_grid_item_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                TEST_GRID_ITEM_UUID
            );
            expect(mockExhibitRecordTask.update_exhibit_timestamp).toHaveBeenCalledWith(TEST_EXHIBIT_UUID);
        });

        test('refuses a delete that would leave fewer items than columns', async () => {
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(3);

            const result = await delete_item();

            expect(result.status).toBe(422);
            expect(result.message).toBe(DELETE_MESSAGE);
            expect(mockGridRecordTask.delete_grid_item_record).not.toHaveBeenCalled();
            expect(mockExhibitRecordTask.update_exhibit_timestamp).not.toHaveBeenCalled();
        });

        test('refuses a delete from a grid that is already short of items', async () => {
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(1);

            const result = await delete_item();

            expect(result.status).toBe(422);
            expect(result.message).toBe(ADD_ITEMS_MESSAGE);
            expect(mockGridRecordTask.delete_grid_item_record).not.toHaveBeenCalled();
        });

        test.each([
            [4, 4, DELETE_MESSAGE],
            [4, 3, DELETE_MESSAGE],
            [3, 3, DELETE_MESSAGE],
            [4, 2, ADD_ITEMS_MESSAGE],
            [3, 2, ADD_ITEMS_MESSAGE],
            [3, 1, ADD_ITEMS_MESSAGE],
            [2, 2, ADD_ITEMS_MESSAGE],
            [2, 1, ADD_ITEMS_MESSAGE]
        ])('says to reduce the columns only when fewer columns would allow the delete: %i columns, %i items', async (columns, item_count, message) => {
            mockGridRecordTask.get_grid_record.mockResolvedValue({ uuid: TEST_GRID_UUID, columns });
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(item_count);

            const result = await delete_item();

            expect(result.status).toBe(422);
            expect(result.message).toBe(message);
            expect(mockGridRecordTask.delete_grid_item_record).not.toHaveBeenCalled();
        });

        test('counts every item in the grid, published or not', async () => {
            await delete_item();

            expect(mockGridRecordTask.get_grid_item_count).toHaveBeenCalledWith(TEST_EXHIBIT_UUID, TEST_GRID_UUID);
        });

        test('skips the check when enforce_minimum_items is false', async () => {
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(1);

            const result = await delete_item({ enforce_minimum_items: false });

            expect(result.status).toBe(204);
            expect(mockGridRecordTask.get_grid_item_count).not.toHaveBeenCalled();
            expect(mockGridRecordTask.delete_grid_item_record).toHaveBeenCalledTimes(1);
        });

        test('uses the smallest allowed count for a stored column value outside 2-4', async () => {
            mockGridRecordTask.get_grid_record.mockResolvedValue({ uuid: TEST_GRID_UUID, columns: 6 });
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(3);

            const allowed = await delete_item();
            expect(allowed.status).toBe(204);

            mockGridRecordTask.get_grid_item_count.mockResolvedValue(2);

            const refused = await delete_item();
            expect(refused.status).toBe(422);
        });

        test('leaves an item that is missing or already deleted to the delete task', async () => {
            mockGridRecordTask.get_grid_item_record.mockResolvedValue(null);
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(3);

            const result = await delete_item();

            expect(result.status).toBe(204);
            expect(mockGridRecordTask.get_grid_item_count).not.toHaveBeenCalled();
            expect(mockGridRecordTask.delete_grid_item_record).toHaveBeenCalledTimes(1);
        });

        test('does not block when the grid itself is missing or deleted', async () => {
            mockGridRecordTask.get_grid_record.mockResolvedValue(null);
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(0);

            const result = await delete_item();

            expect(result.status).toBe(204);
        });

        test('returns 400 for an invalid UUID', async () => {
            const result = await GRID_MODEL.delete_grid_item_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, '');

            expect(result.status).toBe(400);
            expect(result.message).toBe('Invalid UUID provided');
            expect(mockGridRecordTask.get_grid_record).not.toHaveBeenCalled();
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

    // ==================== MINIMUM ITEMS RULE (items >= columns) ====================

    describe('publish_grid_record minimum-items gate', () => {

        const INDEXER_MODEL = require('../../indexer/model');

        beforeEach(() => {
            mockExhibitRecordTask.get_exhibit_record = jest.fn().mockResolvedValue({ is_published: 1 });
            mockGridRecordTask.set_grid_to_publish = jest.fn().mockResolvedValue(true);
            mockGridRecordTask.get_grid_item_count = jest.fn().mockResolvedValue(4);
            mockGridRecordTask.get_grid_record.mockResolvedValue({
                uuid: TEST_GRID_UUID,
                columns: 4,
                internal_name: 'Staff grid name'
            });
        });

        test('refuses to publish a grid with fewer items than columns', async () => {
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(1);

            const result = await GRID_MODEL.publish_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID);

            expect(result.status).toBe(false);
            expect(result.message).toContain('set to 4 columns');
            expect(result.message).toContain('Add at least 4 grid items');
            expect(mockGridRecordTask.set_grid_to_publish).not.toHaveBeenCalled();
            expect(INDEXER_MODEL.index_grid_record).not.toHaveBeenCalled();
        });

        test('publishes a grid whose item count meets the column count', async () => {
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(4);

            const result = await GRID_MODEL.publish_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID);

            expect(result.status).toBe(true);
            expect(mockGridRecordTask.set_grid_to_publish).toHaveBeenCalledWith(TEST_GRID_UUID);
        });

        test('legacy column values outside 2-4 fall back to a minimum of 2', async () => {
            mockGridRecordTask.get_grid_record.mockResolvedValue({
                uuid: TEST_GRID_UUID,
                columns: 6,
                internal_name: 'Legacy grid'
            });
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(1);

            const blocked = await GRID_MODEL.publish_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID);
            expect(blocked.status).toBe(false);

            mockGridRecordTask.get_grid_item_count.mockResolvedValue(2);
            const allowed = await GRID_MODEL.publish_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID);
            expect(allowed.status).toBe(true);
        });
    });

    describe('suppress_grid_record', () => {

        const INDEXER_MODEL = require('../../indexer/model');
        const OTHER_GRID_UUID = '660e8400-e29b-41d4-a716-446655440099';

        beforeEach(() => {
            INDEXER_MODEL.delete_record.mockResolvedValue({ status: 204 });
            mockGridRecordTask.set_grid_to_suppress = jest.fn().mockResolvedValue(true);
            mockGridRecordTask.set_to_suppressed_grid_items = jest.fn().mockResolvedValue(true);
            mockGridRecordTask.get_grid_records = jest.fn().mockResolvedValue([
                { uuid: OTHER_GRID_UUID, is_member_of_exhibit: TEST_EXHIBIT_UUID },
                { uuid: TEST_GRID_UUID, is_member_of_exhibit: TEST_EXHIBIT_UUID }
            ]);
            mockGridRecordTask.get_grid_record.mockResolvedValue({
                uuid: TEST_GRID_UUID,
                is_member_of_exhibit: TEST_EXHIBIT_UUID
            });
            mockGridRecordTask.get_grid_item_records.mockImplementation(async (exhibit_id, grid_id) => [
                { uuid: TEST_GRID_ITEM_UUID, is_member_of_grid: grid_id }
            ]);
        });

        test('unpublishes the items of this grid and of no other grid in the exhibit', async () => {
            const result = await GRID_MODEL.suppress_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID);

            expect(result.status).toBe(true);
            expect(INDEXER_MODEL.delete_record).toHaveBeenCalledWith(TEST_GRID_UUID);
            expect(mockGridRecordTask.set_grid_to_suppress).toHaveBeenCalledWith(TEST_GRID_UUID);
            expect(mockGridRecordTask.get_grid_record).toHaveBeenCalledWith(TEST_EXHIBIT_UUID, TEST_GRID_UUID);
            expect(mockGridRecordTask.set_to_suppressed_grid_items).toHaveBeenCalledWith(TEST_GRID_UUID);
            expect(mockGridRecordTask.set_to_suppressed_grid_items).not.toHaveBeenCalledWith(OTHER_GRID_UUID);
            expect(mockGridRecordTask.get_grid_item_records).not.toHaveBeenCalledWith(TEST_EXHIBIT_UUID, OTHER_GRID_UUID);
        });

        test('still reports the grid unpublished when its record cannot be read back', async () => {
            mockGridRecordTask.get_grid_record.mockResolvedValue(null);

            const result = await GRID_MODEL.suppress_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID);

            expect(result.status).toBe(true);
            expect(mockGridRecordTask.set_to_suppressed_grid_items).not.toHaveBeenCalled();
        });
    });

    describe('suppress_grid_item_record minimum-items gate', () => {

        const INDEXER_MODEL = require('../../indexer/model');

        beforeEach(() => {
            mockGridRecordTask.get_grid_item_count = jest.fn().mockResolvedValue(4);
            mockGridRecordTask.get_grid_record.mockResolvedValue({
                uuid: TEST_GRID_UUID,
                columns: 3,
                is_published: 1
            });
            mockGridRecordTask.get_grid_item_record.mockResolvedValue({
                uuid: TEST_GRID_ITEM_UUID,
                is_published: 1
            });
        });

        test('refuses to unpublish an item that would drop a published grid below its minimum', async () => {
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(3);

            const result = await GRID_MODEL.suppress_grid_item_record(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                TEST_GRID_ITEM_UUID
            );

            expect(result.status).toBe(false);
            expect(result.message).toContain('Unpublish the grid first');
            expect(mockGridRecordTask.get_grid_item_count).toHaveBeenCalledWith(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                { published_only: true }
            );
            expect(INDEXER_MODEL.delete_record).not.toHaveBeenCalled();
        });

        test('allows unpublishing an item when the grid keeps its minimum', async () => {
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(4);

            const result = await GRID_MODEL.suppress_grid_item_record(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                TEST_GRID_ITEM_UUID
            );

            expect(result.status).toBe(true);
        });

        test('skips the gate when the grid is not published', async () => {
            mockGridRecordTask.get_grid_record.mockResolvedValue({
                uuid: TEST_GRID_UUID,
                columns: 3,
                is_published: 0
            });
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(0);

            const result = await GRID_MODEL.suppress_grid_item_record(
                TEST_EXHIBIT_UUID,
                TEST_GRID_UUID,
                TEST_GRID_ITEM_UUID
            );

            expect(result.status).toBe(true);
        });
    });

    describe('get_under_filled_grids', () => {

        beforeEach(() => {
            mockGridRecordTask.get_grid_records = jest.fn();
            mockGridRecordTask.get_grid_item_count = jest.fn();
        });

        test('returns only grids whose item count is below their column count', async () => {
            mockGridRecordTask.get_grid_records.mockResolvedValue([
                { uuid: 'aaaaaaaa-1111-4111-8111-111111111111', columns: 4, internal_name: 'Under-filled' },
                { uuid: 'bbbbbbbb-2222-4222-8222-222222222222', columns: 2, internal_name: 'Full' }
            ]);
            mockGridRecordTask.get_grid_item_count
                .mockResolvedValueOnce(1)
                .mockResolvedValueOnce(2);

            const result = await GRID_MODEL.get_under_filled_grids(TEST_EXHIBIT_UUID);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                uuid: 'aaaaaaaa-1111-4111-8111-111111111111',
                internal_name: 'Under-filled',
                minimum: 4,
                item_count: 1
            });
        });

        test('labels grids without an internal name as "Untitled grid"', async () => {
            mockGridRecordTask.get_grid_records.mockResolvedValue([
                { uuid: 'cccccccc-3333-4333-8333-333333333333', columns: 3, internal_name: null }
            ]);
            mockGridRecordTask.get_grid_item_count.mockResolvedValue(0);

            const result = await GRID_MODEL.get_under_filled_grids(TEST_EXHIBIT_UUID);

            expect(result[0].internal_name).toBe('Untitled grid');
        });

        test('returns an empty array when the exhibit has no grids', async () => {
            mockGridRecordTask.get_grid_records.mockResolvedValue([]);

            const result = await GRID_MODEL.get_under_filled_grids(TEST_EXHIBIT_UUID);

            expect(result).toEqual([]);
        });
    });

    // ==================== ERROR HANDLING ====================

    describe('Error Handling', () => {

        test('should handle database errors in create_grid_record', async () => {
            mockGridRecordTask.create_grid_record.mockRejectedValue(new Error('Database error'));

            const result = await GRID_MODEL.create_grid_record(TEST_EXHIBIT_UUID, { internal_name: 'Test' });

            expect(result.status).toBe(500);
            expect(result.message).toContain('Unable to create grid record');
        });

        test('should handle database errors in update_grid_record', async () => {
            mockGridRecordTask.update_grid_record.mockRejectedValue(new Error('Database error'));

            const result = await GRID_MODEL.update_grid_record(TEST_EXHIBIT_UUID, TEST_GRID_UUID, { title: 'Test' });

            expect(result.status).toBe(500);
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

            expect(result.status).toBe(500);
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
