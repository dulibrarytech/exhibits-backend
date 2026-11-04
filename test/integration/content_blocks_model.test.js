/**
 * Integration Tests for Content Blocks Model — button URL gate
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const TEST_EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_BLOCK_UUID = '660e8400-e29b-41d4-a716-446655440001';

jest.mock('../../libs/rte_vocabulary', () => ({
    apply: jest.fn((record) => record),
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

jest.mock('../../config/db_config', () => () => ({
    query: jest.fn()
}));

jest.mock('../../config/db_tables_config', () => () => ({
    exhibits: {
        exhibit_records: 'tbl_exhibits',
        content_block_records: 'tbl_content_block_items'
    }
}));

const mockHelperInstance = {
    create_uuid: jest.fn().mockReturnValue(TEST_BLOCK_UUID),
    order_exhibit_items: jest.fn().mockResolvedValue(1),
    unlock_record: jest.fn().mockResolvedValue({ status: true })
};

jest.mock('../../libs/helper', () => {
    return jest.fn().mockImplementation(() => mockHelperInstance);
});

const mockContentBlockTask = {
    create_content_block_record: jest.fn().mockResolvedValue({ success: true }),
    update_content_block_record: jest.fn().mockResolvedValue({ success: true }),
    get_content_block_record: jest.fn().mockResolvedValue({}),
    get_content_block_edit_record: jest.fn().mockResolvedValue({}),
    set_content_block_to_publish: jest.fn().mockResolvedValue(true),
    set_content_block_to_suppress: jest.fn().mockResolvedValue(true),
    reorder_content_blocks: jest.fn().mockResolvedValue(true)
};

jest.mock('../../exhibits/tasks/exhibit_content_block_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockContentBlockTask);
});

const mockExhibitRecordTask = {
    update_exhibit_timestamp: jest.fn().mockResolvedValue(true),
    get_exhibit_record: jest.fn().mockResolvedValue({ is_published: 1 })
};

jest.mock('../../exhibits/tasks/exhibit_record_tasks', () => {
    return jest.fn().mockImplementation(() => mockExhibitRecordTask);
});

jest.mock('../../indexer/model', () => ({
    index_content_block_record: jest.fn().mockResolvedValue(true),
    delete_record: jest.fn().mockResolvedValue({ status: 204 })
}));

jest.mock('../../exhibits/reindex_coalescer', () => ({
    schedule_reindex: jest.fn()
}));

describe('Content Blocks Model — button URL gate', () => {
    let MODEL;

    const button = (url) => ({ content_type: 'button', text: '<p>Go</p>', size: 'small', url });

    beforeAll(() => {
        MODEL = require('../../exhibits/content_blocks_model');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockHelperInstance.create_uuid.mockReturnValue(TEST_BLOCK_UUID);
        mockHelperInstance.order_exhibit_items.mockResolvedValue(1);
        mockContentBlockTask.create_content_block_record.mockResolvedValue({ success: true });
        mockContentBlockTask.update_content_block_record.mockResolvedValue({ success: true });
    });

    test('create refuses a javascript: url before touching the database', async () => {
        const result = await MODEL.create_content_block_record(TEST_EXHIBIT_UUID, button('javascript:alert(document.cookie)'));

        expect(result.status).toBe(400);
        expect(result.message).toMatch(/^Button URL/);
        expect(mockContentBlockTask.create_content_block_record).not.toHaveBeenCalled();
    });

    test('create keeps a web address and adds https:// to a bare host', async () => {
        const result = await MODEL.create_content_block_record(TEST_EXHIBIT_UUID, button('www.du.edu/library'));

        expect(result.status).toBe(201);
        expect(mockContentBlockTask.create_content_block_record).toHaveBeenCalledTimes(1);
        expect(mockContentBlockTask.create_content_block_record.mock.calls[0][0].url).toBe('https://www.du.edu/library');
    });

    test('update refuses a data: url before touching the database', async () => {
        const result = await MODEL.update_content_block_record(TEST_EXHIBIT_UUID, TEST_BLOCK_UUID, button('data:text/html,<script>alert(1)</script>'));

        expect(result.status).toBe(400);
        expect(result.message).toMatch(/^Button URL/);
        expect(mockContentBlockTask.update_content_block_record).not.toHaveBeenCalled();
    });

    test('update keeps an https url', async () => {
        const result = await MODEL.update_content_block_record(TEST_EXHIBIT_UUID, TEST_BLOCK_UUID, button('https://library.du.edu/?a=1&b=2'));

        expect(result.status).toBe(201);
        expect(mockContentBlockTask.update_content_block_record.mock.calls[0][0].url).toBe('https://library.du.edu/?a=1&b=2');
    });

    test('blocks without a url are unaffected', async () => {
        const result = await MODEL.create_content_block_record(TEST_EXHIBIT_UUID, { content_type: 'divider', size: 'small' });

        expect(result.status).toBe(201);
        expect(mockContentBlockTask.create_content_block_record).toHaveBeenCalledTimes(1);
    });

    test('sanitizes attribution as plain text alongside text and title', async () => {
        const RTE = require('../../libs/rte_vocabulary');

        await MODEL.create_content_block_record(TEST_EXHIBIT_UUID, { content_type: 'quote', text: '<p>Q</p>', attribution: 'A' });

        expect(RTE.apply).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ text: 'full', title: 'full', attribution: 'plain' }));
    });
});
