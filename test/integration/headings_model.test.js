/**
 * Integration Tests for Headings Model
 *
 * Runs the REAL exhibits/headings_model.js with the task classes, helper,
 * validator, indexer and coalescer mocked — the same shape as grid_model /
 * timelines_model. The heading model was mocked in four suites and tested in
 * none before this file.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const HEADING_UUID = '660e8400-e29b-41d4-a716-446655440001';
const USER_UID = '1';

jest.mock('../../libs/rte_vocabulary', () => ({
    apply: jest.fn((record) => record)
}));

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../config/db_config', () => () => ({ query: jest.fn() }));

jest.mock('../../config/db_tables_config', () => () => ({
    exhibits: {
        exhibit_records: 'tbl_exhibits',
        heading_records: 'tbl_heading_items'
    }
}));

const mockHelper = {
    create_uuid: jest.fn(),
    order_exhibit_items: jest.fn(),
    unlock_record: jest.fn()
};
jest.mock('../../libs/helper', () => jest.fn().mockImplementation(() => mockHelper));

/* Schema validation is unit-tested elsewhere; here it is a switch so the model's
   400 path can be driven without composing a schema-complete payload. */
const mockValidate = jest.fn();
jest.mock('../../libs/validate', () => jest.fn().mockImplementation(() => ({ validate: mockValidate })));

const mockHeadingTasks = {
    create_heading_record: jest.fn(),
    get_heading_record: jest.fn(),
    get_heading_edit_record: jest.fn(),
    update_heading_record: jest.fn(),
    set_heading_to_publish: jest.fn(),
    set_heading_to_suppress: jest.fn(),
    reorder_headings: jest.fn()
};
jest.mock('../../exhibits/tasks/exhibit_heading_record_tasks', () => jest.fn().mockImplementation(() => mockHeadingTasks));

const mockExhibitTasks = {
    update_exhibit_timestamp: jest.fn(),
    get_exhibit_record: jest.fn()
};
jest.mock('../../exhibits/tasks/exhibit_record_tasks', () => jest.fn().mockImplementation(() => mockExhibitTasks));

jest.mock('../../indexer/model', () => ({
    index_heading_record: jest.fn(),
    delete_record: jest.fn()
}));

jest.mock('../../exhibits/reindex_coalescer', () => ({
    schedule_reindex: jest.fn()
}));

const HEADINGS_MODEL = require('../../exhibits/headings_model');
const INDEXER_MODEL = require('../../indexer/model');
const REINDEX_COALESCER = require('../../exhibits/reindex_coalescer');

const flush = () => new Promise((resolve) => setImmediate(() => setImmediate(resolve)));

describe('Headings Model', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockHelper.create_uuid.mockReturnValue(HEADING_UUID);
        mockHelper.order_exhibit_items.mockResolvedValue(3);
        mockHelper.unlock_record.mockResolvedValue({ status: true });
        mockValidate.mockReturnValue(true);
        mockHeadingTasks.create_heading_record.mockResolvedValue(true);
        mockHeadingTasks.update_heading_record.mockResolvedValue(true);
        mockHeadingTasks.get_heading_record.mockResolvedValue({ uuid: HEADING_UUID });
        mockHeadingTasks.get_heading_edit_record.mockResolvedValue({ uuid: HEADING_UUID, is_locked: 1 });
        mockHeadingTasks.set_heading_to_publish.mockResolvedValue(true);
        mockHeadingTasks.set_heading_to_suppress.mockResolvedValue(true);
        mockHeadingTasks.reorder_headings.mockResolvedValue(true);
        mockExhibitTasks.update_exhibit_timestamp.mockResolvedValue(true);
        mockExhibitTasks.get_exhibit_record.mockResolvedValue({ uuid: EXHIBIT_UUID, is_published: 1 });
        INDEXER_MODEL.index_heading_record.mockResolvedValue(true);
        INDEXER_MODEL.delete_record.mockResolvedValue({ status: 204 });
    });

    // ==================== create ====================

    describe('create_heading_record', () => {

        test('rejects an invalid exhibit uuid or body with 400', async () => {
            expect((await HEADINGS_MODEL.create_heading_record('nope', { text: 'x' })).status).toBe(400);
            expect((await HEADINGS_MODEL.create_heading_record(EXHIBIT_UUID, null)).status).toBe(400);
            expect(mockHeadingTasks.create_heading_record).not.toHaveBeenCalled();
        });

        test('assigns uuid, membership, order and serialized styles, then bumps the exhibit timestamp', async () => {
            const data = { text: 'Intro', styles: { color: 'red' } };

            const result = await HEADINGS_MODEL.create_heading_record(EXHIBIT_UUID, data);

            expect(result).toEqual({ status: 201, message: 'Heading record created', data: HEADING_UUID });
            expect(mockHeadingTasks.create_heading_record).toHaveBeenCalledWith(expect.objectContaining({
                uuid: HEADING_UUID,
                is_member_of_exhibit: EXHIBIT_UUID,
                order: 3,
                styles: JSON.stringify({ color: 'red' })
            }));
            expect(mockExhibitTasks.update_exhibit_timestamp).toHaveBeenCalledWith(EXHIBIT_UUID);
        });

        test('returns 400 with the validator\'s message when validation fails', async () => {
            mockValidate.mockReturnValue([{ message: 'should have required property text' }]);

            const result = await HEADINGS_MODEL.create_heading_record(EXHIBIT_UUID, { styles: {} });

            expect(result.status).toBe(400);
            expect(mockHeadingTasks.create_heading_record).not.toHaveBeenCalled();
        });

        test('returns 500 when the insert fails', async () => {
            mockHeadingTasks.create_heading_record.mockResolvedValue(false);

            const result = await HEADINGS_MODEL.create_heading_record(EXHIBIT_UUID, { text: 'Intro' });

            expect(result.status).toBe(500);
            expect(mockExhibitTasks.update_exhibit_timestamp).not.toHaveBeenCalled();
        });
    });

    // ==================== reads ====================

    describe('get_heading_record / get_heading_edit_record', () => {

        test('reads are scoped to the exhibit', async () => {
            const result = await HEADINGS_MODEL.get_heading_record(EXHIBIT_UUID, HEADING_UUID);

            expect(result.status).toBe(200);
            expect(result.data).toEqual({ uuid: HEADING_UUID });
            expect(mockHeadingTasks.get_heading_record).toHaveBeenCalledWith(EXHIBIT_UUID, HEADING_UUID);
        });

        test('edit read passes the locking user through', async () => {
            const result = await HEADINGS_MODEL.get_heading_edit_record(USER_UID, EXHIBIT_UUID, HEADING_UUID);

            expect(result.status).toBe(200);
            expect(mockHeadingTasks.get_heading_edit_record).toHaveBeenCalledWith(USER_UID, EXHIBIT_UUID, HEADING_UUID);
        });

        test('invalid ids are rejected with 400 before the DB', async () => {
            expect((await HEADINGS_MODEL.get_heading_record(EXHIBIT_UUID, 'x')).status).toBe(400);
            expect((await HEADINGS_MODEL.get_heading_edit_record('', EXHIBIT_UUID, HEADING_UUID)).status).toBe(400);
            expect(mockHeadingTasks.get_heading_record).not.toHaveBeenCalled();
            expect(mockHeadingTasks.get_heading_edit_record).not.toHaveBeenCalled();
        });

        test('a DB failure surfaces as 400 with the error message (current contract)', async () => {
            mockHeadingTasks.get_heading_record.mockRejectedValue(new Error('db down'));

            const result = await HEADINGS_MODEL.get_heading_record(EXHIBIT_UUID, HEADING_UUID);

            expect(result.status).toBe(400);
            expect(result.message).toBe('db down');
        });
    });

    // ==================== update ====================

    describe('update_heading_record', () => {

        test('strips is_published from the payload and updates in place', async () => {
            const result = await HEADINGS_MODEL.update_heading_record(EXHIBIT_UUID, HEADING_UUID, {
                text: 'New', styles: {}, is_published: 0
            });

            expect(result.status).toBe(201);
            const written = mockHeadingTasks.update_heading_record.mock.calls[0][0];
            expect(written).not.toHaveProperty('is_published');
            expect(written).toMatchObject({ uuid: HEADING_UUID, is_member_of_exhibit: EXHIBIT_UUID, text: 'New' });
            expect(REINDEX_COALESCER.schedule_reindex).not.toHaveBeenCalled();
        });

        test('a truthy is_published schedules a coalesced re-index keyed by heading', async () => {
            await HEADINGS_MODEL.update_heading_record(EXHIBIT_UUID, HEADING_UUID, { text: 'New', is_published: 'true' });
            await flush();

            expect(REINDEX_COALESCER.schedule_reindex).toHaveBeenCalledWith(`heading:${HEADING_UUID}`, expect.any(Function));
        });

        test('the scheduled re-index republishes through publish_heading_record', async () => {
            await HEADINGS_MODEL.update_heading_record(EXHIBIT_UUID, HEADING_UUID, { text: 'New', is_published: true });
            await flush();

            const [, job] = REINDEX_COALESCER.schedule_reindex.mock.calls[0];
            await job();

            expect(mockHeadingTasks.set_heading_to_publish).toHaveBeenCalledWith(HEADING_UUID);
            expect(INDEXER_MODEL.index_heading_record).toHaveBeenCalledWith(EXHIBIT_UUID, HEADING_UUID);
        });

        test('returns 400 when the task reports failure or validation fails', async () => {
            mockHeadingTasks.update_heading_record.mockResolvedValue(false);
            expect((await HEADINGS_MODEL.update_heading_record(EXHIBIT_UUID, HEADING_UUID, { text: 'x' })).status).toBe(400);

            mockValidate.mockReturnValue([{ message: 'bad' }]);
            expect((await HEADINGS_MODEL.update_heading_record(EXHIBIT_UUID, HEADING_UUID, { text: 'x' })).status).toBe(400);
        });
    });

    // ==================== publish / suppress ====================

    describe('publish_heading_record', () => {

        test('refuses when the parent exhibit is not published', async () => {
            mockExhibitTasks.get_exhibit_record.mockResolvedValue({ uuid: EXHIBIT_UUID, is_published: 0 });

            const result = await HEADINGS_MODEL.publish_heading_record(EXHIBIT_UUID, HEADING_UUID);

            expect(result.status).toBe(false);
            expect(mockHeadingTasks.set_heading_to_publish).not.toHaveBeenCalled();
            expect(INDEXER_MODEL.index_heading_record).not.toHaveBeenCalled();
        });

        test('flags then indexes, and succeeds when both succeed', async () => {
            const result = await HEADINGS_MODEL.publish_heading_record(EXHIBIT_UUID, HEADING_UUID);

            expect(result).toEqual({ status: true, message: 'Heading published' });
            expect(mockHeadingTasks.set_heading_to_publish).toHaveBeenCalledWith(HEADING_UUID);
            expect(INDEXER_MODEL.index_heading_record).toHaveBeenCalledWith(EXHIBIT_UUID, HEADING_UUID);
        });

        test('fails when indexing or the DB flag fails', async () => {
            INDEXER_MODEL.index_heading_record.mockResolvedValue(false);
            expect((await HEADINGS_MODEL.publish_heading_record(EXHIBIT_UUID, HEADING_UUID)).status).toBe(false);

            INDEXER_MODEL.index_heading_record.mockResolvedValue(true);
            mockHeadingTasks.set_heading_to_publish.mockResolvedValue(false);
            expect((await HEADINGS_MODEL.publish_heading_record(EXHIBIT_UUID, HEADING_UUID)).status).toBe(false);
        });

        test('rejects invalid uuids', async () => {
            expect((await HEADINGS_MODEL.publish_heading_record('x', HEADING_UUID)).status).toBe(false);
            expect(mockExhibitTasks.get_exhibit_record).not.toHaveBeenCalled();
        });
    });

    describe('suppress_heading_record', () => {

        test('removes the index doc first, then flags the row', async () => {
            const result = await HEADINGS_MODEL.suppress_heading_record(EXHIBIT_UUID, HEADING_UUID);

            expect(result).toEqual({ status: true, message: 'Heading suppressed' });
            expect(INDEXER_MODEL.delete_record).toHaveBeenCalledWith(HEADING_UUID);
            expect(mockHeadingTasks.set_heading_to_suppress).toHaveBeenCalledWith(HEADING_UUID);
        });

        test('does not flag the row when the index delete did not return 204', async () => {
            INDEXER_MODEL.delete_record.mockResolvedValue({ status: 200 });

            const result = await HEADINGS_MODEL.suppress_heading_record(EXHIBIT_UUID, HEADING_UUID);

            expect(result.status).toBe(false);
            expect(mockHeadingTasks.set_heading_to_suppress).not.toHaveBeenCalled();
        });

        test('fails when the DB flag fails', async () => {
            mockHeadingTasks.set_heading_to_suppress.mockResolvedValue(false);

            expect((await HEADINGS_MODEL.suppress_heading_record(EXHIBIT_UUID, HEADING_UUID)).status).toBe(false);
        });
    });

    // ==================== reorder / unlock ====================

    describe('reorder_headings / unlock_heading_record', () => {

        test('reorder validates and delegates', async () => {
            expect(await HEADINGS_MODEL.reorder_headings('x', { a: 1 })).toBe(false);
            expect(await HEADINGS_MODEL.reorder_headings(EXHIBIT_UUID, null)).toBe(false);

            expect(await HEADINGS_MODEL.reorder_headings(EXHIBIT_UUID, { order: [] })).toBe(true);
            expect(mockHeadingTasks.reorder_headings).toHaveBeenCalledWith(EXHIBIT_UUID, { order: [] });
        });

        test('unlock goes through the shared helper against the headings table', async () => {
            const result = await HEADINGS_MODEL.unlock_heading_record(USER_UID, HEADING_UUID, { force: false });

            expect(result).toEqual({ status: true });
            expect(mockHelper.unlock_record).toHaveBeenCalledWith(USER_UID, HEADING_UUID, expect.anything(), 'tbl_heading_items', { force: false });
        });

        test('unlock rejects invalid ids', async () => {
            expect(await HEADINGS_MODEL.unlock_heading_record('', HEADING_UUID, {})).toBe(false);
            expect(mockHelper.unlock_record).not.toHaveBeenCalled();
        });
    });
});
