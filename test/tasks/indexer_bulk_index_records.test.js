/**
 * Unit tests for Indexer_index_tasks.bulk_index_records — the ES bulk path used by
 * the full-reindex flows (an exhibit publish/reindex re-indexes ~200 component docs
 * in a couple of bulk requests instead of one client.index round trip per doc).
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// Mock dependencies - MUST be identical across all test files to avoid conflicts
jest.mock('../../libs/log4', () => {
    const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    };
    return {
        module: jest.fn(() => mockLogger)
    };
});

const Indexer_index_tasks = require('../../indexer/tasks/indexer_index_tasks');

describe('Indexer_index_tasks.bulk_index_records', () => {

    const INDEX = 'exhibits_index';
    const U1 = '550e8400-e29b-41d4-a716-446655440000';
    const U2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const U3 = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

    let client;
    let tasks;

    const ok_items = (uuids, result = 'created') => ({
        errors: false,
        items: uuids.map((id) => ({
            index: {_id: id, _index: INDEX, status: result === 'created' ? 201 : 200, result}
        }))
    });

    const rec = (uuid, extra = {}) => ({uuid, type: 'item', title: 't', ...extra});

    beforeEach(() => {
        jest.clearAllMocks();
        client = {index: jest.fn(), get: jest.fn(), delete: jest.fn(), bulk: jest.fn()};
        tasks = new Indexer_index_tasks(client, INDEX);
    });

    test('empty / non-array input returns a zero result and never calls client.bulk', async () => {
        expect(await tasks.bulk_index_records([])).toEqual({success: 0, failed: 0, total: 0, errors: []});
        expect(await tasks.bulk_index_records(null)).toEqual({success: 0, failed: 0, total: 0, errors: []});
        expect(client.bulk).not.toHaveBeenCalled();
    });

    test('all-success: one bulk call with correct action/doc operation pairs', async () => {
        client.bulk.mockResolvedValue(ok_items([U1, U2]));

        const result = await tasks.bulk_index_records([rec(U1, {title: 'A'}), rec(U2, {title: 'B'})]);

        expect(result).toEqual({success: 2, failed: 0, total: 2, errors: []});
        expect(client.bulk).toHaveBeenCalledTimes(1);

        const {operations, refresh} = client.bulk.mock.calls[0][0];
        expect(refresh).toBe(false);                                  // default: no immediate refresh
        expect(operations).toHaveLength(4);                           // 2 action lines + 2 doc lines
        expect(operations[0]).toEqual({index: {_index: INDEX, _id: U1}});
        expect(operations[1].title).toBe('A');
        expect(operations[2]).toEqual({index: {_index: INDEX, _id: U2}});
        expect(operations[3].title).toBe('B');
    });

    test('upsert semantics: the index action keys on _id = the record uuid (trimmed)', async () => {
        client.bulk.mockResolvedValue(ok_items([U1]));

        await tasks.bulk_index_records([rec(`  ${U1}  `)]);

        expect(client.bulk.mock.calls[0][0].operations[0]).toEqual({index: {_index: INDEX, _id: U1}});
    });

    test('a per-item ES error is counted as failed (with reason); its siblings still succeed', async () => {
        client.bulk.mockResolvedValue({
            errors: true,
            items: [
                {index: {_id: U1, status: 201, result: 'created'}},
                {index: {_id: U2, status: 400, error: {type: 'mapper_parsing_exception', reason: 'bad date'}}}
            ]
        });

        const result = await tasks.bulk_index_records([rec(U1), rec(U2)]);

        expect(result.success).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.total).toBe(2);
        expect(result.errors).toEqual([{uuid: U2, error: 'bad date'}]);
    });

    test('an invalid record is failed and omitted from the request; valid ones are still indexed', async () => {
        client.bulk.mockResolvedValue(ok_items([U1]));

        const result = await tasks.bulk_index_records([rec(U1), {uuid: 'not-a-uuid', title: 'x'}]);

        expect(result.success).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.total).toBe(2);
        expect(result.errors[0].uuid).toBe('not-a-uuid');

        const {operations} = client.bulk.mock.calls[0][0];
        expect(operations).toHaveLength(2);                           // only the valid record's pair
        expect(operations[0].index._id).toBe(U1);
    });

    test('chunking: chunk_size splits into multiple bulk calls and aggregates the totals', async () => {
        client.bulk
            .mockResolvedValueOnce(ok_items([U1, U2]))
            .mockResolvedValueOnce(ok_items([U3]));

        const result = await tasks.bulk_index_records([rec(U1), rec(U2), rec(U3)], {chunk_size: 2});

        expect(client.bulk).toHaveBeenCalledTimes(2);
        expect(result).toEqual({success: 3, failed: 0, total: 3, errors: []});
    });

    test('a whole-chunk transport failure marks every doc in the chunk as failed', async () => {
        client.bulk.mockRejectedValue(new Error('connection refused'));

        const result = await tasks.bulk_index_records([rec(U1), rec(U2)]);

        expect(result.success).toBe(0);
        expect(result.failed).toBe(2);
        expect(result.total).toBe(2);
        expect(result.errors.map((e) => e.uuid).sort()).toEqual([U1, U2].sort());
    });

    test('refresh:true is forwarded to client.bulk', async () => {
        client.bulk.mockResolvedValue(ok_items([U1]));

        await tasks.bulk_index_records([rec(U1)], {refresh: true});

        expect(client.bulk.mock.calls[0][0].refresh).toBe(true);
    });
});
