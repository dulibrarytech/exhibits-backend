/**
 * Integration Tests for Indexer Model
 *
 * Runs the REAL indexer/model.js with the Elasticsearch task class, the DB
 * task classes and the indexer helper mocked. Covers orchestration and the
 * status contracts that the exhibit/heading/item/grid/timeline models and the
 * manage endpoint depend on. The indexer model was mocked in six suites and
 * tested in none before this file.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '660e8400-e29b-41d4-a716-446655440001';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../config/elasticsearch_config', () => () => ({ elasticsearch_index: 'exhibits_test' }));
jest.mock('../../config/db_config', () => () => jest.fn());
jest.mock('../../config/db_tables_config', () => () => ({ exhibits: {} }));

const mockIndexTasks = {
    index_record: jest.fn(),
    get_indexed_record: jest.fn(),
    delete_record: jest.fn()
};
jest.mock('../../indexer/tasks/indexer_index_tasks', () => jest.fn().mockImplementation(() => mockIndexTasks));

const mockExhibitTasks = { get_exhibit_record: jest.fn(), get_exhibit_records: jest.fn() };
const mockHeadingTasks = { get_heading_records: jest.fn() };
const mockItemTasks = { get_item_records: jest.fn() };
const mockGridTasks = { get_grid_records: jest.fn() };
const mockTimelineTasks = { get_timeline_records: jest.fn() };

jest.mock('../../exhibits/tasks/exhibit_record_tasks', () => jest.fn().mockImplementation(() => mockExhibitTasks));
jest.mock('../../exhibits/tasks/exhibit_heading_record_tasks', () => jest.fn().mockImplementation(() => mockHeadingTasks));
jest.mock('../../exhibits/tasks/exhibit_item_record_tasks', () => jest.fn().mockImplementation(() => mockItemTasks));
jest.mock('../../exhibits/tasks/exhibit_grid_record_tasks', () => jest.fn().mockImplementation(() => mockGridTasks));
jest.mock('../../exhibits/tasks/exhibit_timeline_record_tasks', () => jest.fn().mockImplementation(() => mockTimelineTasks));

/* The helper owns the ES client and the document transforms (unit-tested in
   test/tasks/indexer_*). Here the transforms are tagged pass-throughs so the
   model's orchestration can be asserted on. */
jest.mock('../../indexer/indexer_helper', () => ({
    CLIENT: {},
    CONSTANTS: {
        STATUS_CODES: { OK: 200, CREATED: 201, NO_CONTENT: 204, NOT_FOUND: 404 },
        BATCH_SIZE: 10,
        INDEX_TYPES: { PUBLISH: 'publish', PREVIEW: 'preview' }
    },
    is_valid_uuid: (uuid) => typeof uuid === 'string' && /^[0-9a-f-]{36}$/i.test(uuid),
    build_response: (status, message, data = null) => (data === null ? { status, message } : { status, message, data }),
    construct_exhibit_index_record: jest.fn((r) => ({ ...r, type: 'exhibit' })),
    construct_heading_index_record: jest.fn((r) => ({ ...r, type: 'heading' })),
    construct_item_index_record: jest.fn((r) => ({ ...r, type: 'item' })),
    construct_grid_index_record: jest.fn((r) => ({ ...r, type: 'grid' })),
    construct_timeline_index_record: jest.fn((r) => ({ ...r, type: 'timeline' })),
    batch_index_records: jest.fn(),
    process_container_records: jest.fn(),
    index_container_child_record: jest.fn(),
    index_standalone_record: jest.fn(),
    index_container_records: jest.fn()
}));

const INDEXER_MODEL = require('../../indexer/model');
const HELPER = require('../../indexer/indexer_helper');

describe('Indexer Model', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockExhibitTasks.get_exhibit_record.mockResolvedValue({ uuid: EXHIBIT_UUID, title: 'T', is_published: 1 });
        mockHeadingTasks.get_heading_records.mockResolvedValue([{ uuid: 'h1' }]);
        mockItemTasks.get_item_records.mockResolvedValue([{ uuid: 'i1' }, { uuid: 'i2' }]);
        mockGridTasks.get_grid_records.mockResolvedValue([{ uuid: 'g1' }]);
        mockTimelineTasks.get_timeline_records.mockResolvedValue([]);
        mockIndexTasks.index_record.mockResolvedValue({ success: true });
        HELPER.batch_index_records.mockResolvedValue({ success: 1, failed: 0 });
        HELPER.process_container_records.mockResolvedValue([{ uuid: 'g1', type: 'grid' }]);
        HELPER.index_standalone_record.mockResolvedValue(true);
    });

    // ==================== index_exhibit ====================

    describe('index_exhibit', () => {

        test('rejects an invalid uuid or index type (200 with a message — current contract)', async () => {
            expect(await INDEXER_MODEL.index_exhibit('nope', 'publish')).toEqual({ status: 200, message: 'Invalid UUID provided' });
            expect(await INDEXER_MODEL.index_exhibit(EXHIBIT_UUID, 'draft')).toEqual({ status: 200, message: 'Invalid index type provided' });
            expect(await INDEXER_MODEL.index_exhibit(EXHIBIT_UUID)).toEqual({ status: 200, message: 'Invalid index type provided' });
            expect(mockExhibitTasks.get_exhibit_record).not.toHaveBeenCalled();
        });

        test('returns 404 when the exhibit does not exist', async () => {
            mockExhibitTasks.get_exhibit_record.mockResolvedValue(null);

            const result = await INDEXER_MODEL.index_exhibit(EXHIBIT_UUID, 'publish');

            expect(result.status).toBe(404);
            expect(mockIndexTasks.index_record).not.toHaveBeenCalled();
        });

        test('indexes the exhibit doc, then every component family, and returns 201', async () => {
            const result = await INDEXER_MODEL.index_exhibit(EXHIBIT_UUID, 'publish');

            expect(result).toEqual({ status: 201, message: 'Exhibit indexed' });
            expect(mockIndexTasks.index_record).toHaveBeenCalledWith(expect.objectContaining({ uuid: EXHIBIT_UUID, type: 'exhibit' }));

            /* Containers go through process_container_records in the requested mode. */
            expect(HELPER.process_container_records).toHaveBeenCalledWith(expect.objectContaining({
                type: 'publish', label: 'grid', get_items_method: 'get_grid_item_records', set_publish_method: 'set_grid_item_to_publish'
            }));
            expect(HELPER.process_container_records).toHaveBeenCalledWith(expect.objectContaining({
                type: 'publish', label: 'timeline', get_items_method: 'get_timeline_item_records', set_publish_method: 'set_timeline_item_to_publish'
            }));

            /* Headings and items are transformed and bulk-indexed; one batch per family. */
            expect(HELPER.batch_index_records).toHaveBeenCalledTimes(4);
            expect(HELPER.batch_index_records).toHaveBeenCalledWith([{ uuid: 'h1', type: 'heading' }], 'Heading', mockIndexTasks);
            expect(HELPER.batch_index_records).toHaveBeenCalledWith([{ uuid: 'i1', type: 'item' }, { uuid: 'i2', type: 'item' }], 'Item', mockIndexTasks);
        });

        test('preview mode is passed through to the container processor', async () => {
            await INDEXER_MODEL.index_exhibit(EXHIBIT_UUID, 'preview');

            expect(HELPER.process_container_records).toHaveBeenCalledWith(expect.objectContaining({ type: 'preview', label: 'grid' }));
        });

        test('stops before the components when the exhibit doc fails to index', async () => {
            mockIndexTasks.index_record.mockResolvedValue({ success: false });

            const result = await INDEXER_MODEL.index_exhibit(EXHIBIT_UUID, 'publish');

            expect(result).toEqual({ status: 200, message: 'Unable to index exhibit' });
            expect(HELPER.batch_index_records).not.toHaveBeenCalled();
        });

        test('reports 201 even when a component batch has failures (documented gap, review item 9)', async () => {
            HELPER.batch_index_records.mockResolvedValue({ success: 0, failed: 2 });

            expect((await INDEXER_MODEL.index_exhibit(EXHIBIT_UUID, 'publish')).status).toBe(201);
        });

        test('a thrown error is reported as 200 with the message (current contract)', async () => {
            mockHeadingTasks.get_heading_records.mockRejectedValue(new Error('db down'));

            const result = await INDEXER_MODEL.index_exhibit(EXHIBIT_UUID, 'publish');

            expect(result.status).toBe(200);
            expect(result.message).toContain('db down');
        });
    });

    // ==================== published count / reindex ====================

    describe('get_published_exhibit_count / reindex_published_exhibits', () => {

        const RECORDS = [
            { uuid: EXHIBIT_UUID, is_published: 1 },
            { uuid: '770e8400-e29b-41d4-a716-446655440002', is_published: '1' },
            { uuid: '880e8400-e29b-41d4-a716-446655440003', is_published: 0 }
        ];

        test('counts only published exhibits, tolerating string flags', async () => {
            mockExhibitTasks.get_exhibit_records.mockResolvedValue(RECORDS);
            expect(await INDEXER_MODEL.get_published_exhibit_count()).toBe(2);

            mockExhibitTasks.get_exhibit_records.mockResolvedValue(undefined);
            expect(await INDEXER_MODEL.get_published_exhibit_count()).toBe(0);
        });

        test('re-indexes each published exhibit in publish mode and tallies failures without aborting', async () => {
            mockExhibitTasks.get_exhibit_records.mockResolvedValue(RECORDS);
            mockExhibitTasks.get_exhibit_record
                .mockResolvedValueOnce({ uuid: EXHIBIT_UUID })
                .mockResolvedValueOnce(null);   /* second exhibit vanished → 404 → counted as failed */

            const summary = await INDEXER_MODEL.reindex_published_exhibits();

            expect(summary).toEqual({ total: 2, indexed: 1, failed: 1 });
            expect(mockExhibitTasks.get_exhibit_record).toHaveBeenCalledTimes(2);
            expect(HELPER.process_container_records).toHaveBeenCalledWith(expect.objectContaining({ type: 'publish' }));
        });

        test('returns an empty summary when the exhibit list cannot be read', async () => {
            mockExhibitTasks.get_exhibit_records.mockRejectedValue(new Error('db down'));

            expect(await INDEXER_MODEL.reindex_published_exhibits()).toEqual({ total: 0, indexed: 0, failed: 0 });
        });
    });

    // ==================== get_indexed_record / delete_record ====================

    describe('get_indexed_record', () => {

        test('returns 200 with the ES hit when found', async () => {
            const hit = { found: true, _source: { uuid: ITEM_UUID } };
            mockIndexTasks.get_indexed_record.mockResolvedValue(hit);

            const result = await INDEXER_MODEL.get_indexed_record(ITEM_UUID);

            expect(result).toEqual({ status: 200, message: 'Record found', data: hit });
        });

        test('returns 404 when ES reports not found or nothing at all', async () => {
            mockIndexTasks.get_indexed_record.mockResolvedValue({ found: false });
            expect((await INDEXER_MODEL.get_indexed_record(ITEM_UUID)).status).toBe(404);

            mockIndexTasks.get_indexed_record.mockResolvedValue(null);
            expect((await INDEXER_MODEL.get_indexed_record(ITEM_UUID)).status).toBe(404);
        });

        test('rejects an invalid uuid without querying', async () => {
            expect((await INDEXER_MODEL.get_indexed_record('x')).message).toBe('Invalid UUID provided');
            expect(mockIndexTasks.get_indexed_record).not.toHaveBeenCalled();
        });
    });

    describe('delete_record', () => {

        test('returns 204 on success — the status the suppress paths key on', async () => {
            mockIndexTasks.delete_record.mockResolvedValue({ success: true });

            expect(await INDEXER_MODEL.delete_record(ITEM_UUID)).toEqual({ status: 204, message: 'Record deleted' });
            expect(mockIndexTasks.delete_record).toHaveBeenCalledWith(ITEM_UUID);
        });

        test('returns 200 (not 204) when the delete fails or throws, so suppress paths stop', async () => {
            mockIndexTasks.delete_record.mockResolvedValue({ success: false });
            expect((await INDEXER_MODEL.delete_record(ITEM_UUID)).status).toBe(200);

            mockIndexTasks.delete_record.mockRejectedValue(new Error('es down'));
            expect((await INDEXER_MODEL.delete_record(ITEM_UUID)).status).toBe(200);
        });
    });

    // ==================== single-doc upserts ====================

    describe('index_exhibit_record', () => {

        test('upserts only the exhibit doc and reports a boolean', async () => {
            expect(await INDEXER_MODEL.index_exhibit_record(EXHIBIT_UUID)).toBe(true);
            expect(mockIndexTasks.index_record).toHaveBeenCalledWith(expect.objectContaining({ uuid: EXHIBIT_UUID, type: 'exhibit' }));
            expect(HELPER.batch_index_records).not.toHaveBeenCalled();
        });

        test('returns false when the exhibit is missing or ES refuses', async () => {
            mockExhibitTasks.get_exhibit_record.mockResolvedValue(null);
            expect(await INDEXER_MODEL.index_exhibit_record(EXHIBIT_UUID)).toBe(false);

            mockExhibitTasks.get_exhibit_record.mockResolvedValue({ uuid: EXHIBIT_UUID });
            mockIndexTasks.index_record.mockResolvedValue({ success: false });
            expect(await INDEXER_MODEL.index_exhibit_record(EXHIBIT_UUID)).toBe(false);
        });
    });

    describe('per-record indexers delegate to index_standalone_record', () => {

        test.each([
            ['index_item_record', 'get_item_record', 'Item'],
            ['index_heading_record', 'get_heading_record', 'Heading']
        ])('%s uses %s', async (fn, get_record_method, label) => {
            expect(await INDEXER_MODEL[fn](EXHIBIT_UUID, ITEM_UUID)).toBe(true);
            expect(HELPER.index_standalone_record).toHaveBeenCalledWith(expect.objectContaining({
                exhibit_id: EXHIBIT_UUID, record_id: ITEM_UUID, get_record_method, label, index_tasks: mockIndexTasks
            }));
        });
    });
});
