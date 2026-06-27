/**
 * Unit tests for index_container_child_record — the shared nested-child indexer
 * used by index_grid_item_record and index_timeline_item_record.
 *
 * Locks in the idempotent-upsert guarantee: re-indexing the same nested child
 * (e.g. a republish after an edit) must REPLACE its copy in the parent doc's
 * items[] rather than append a duplicate. Previously this appended
 * unconditionally and relied on a preceding suppress/delete to avoid dups;
 * the republish handlers now skip that suppress, so the upsert must be safe
 * on its own.
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

const {index_container_child_record} = require('../../indexer/indexer_helper');

describe('index_container_child_record (nested grid/timeline child upsert)', () => {

    const PARENT_ID = '550e8400-e29b-41d4-a716-446655440000';
    const CHILD_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const OTHER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

    const make_indexed_record = (items) => ({
        status: 200,
        data: {source: {uuid: PARENT_ID, type: 'grid', items}}
    });

    const capture_index_record = () => {
        const state = {source: null};
        const fn = jest.fn(async (source) => {
            state.source = source;
            return true;
        });
        return {fn, state};
    };

    test('re-indexing an existing child replaces it in place (no duplicate)', async () => {
        const get_indexed_record = jest.fn().mockResolvedValue(
            make_indexed_record([
                {uuid: OTHER_ID, order: 1, caption: 'keep me'},
                {uuid: CHILD_ID, order: 2, caption: 'STALE'}
            ])
        );
        const {fn: index_record, state} = capture_index_record();

        const result = await index_container_child_record({
            parent_id: PARENT_ID,
            child_id: CHILD_ID,
            child_record: {uuid: CHILD_ID, order: 2, caption: 'FRESH'},
            label: 'Grid',
            get_indexed_record,
            index_record
        });

        expect(result).toBe(true);
        const matches = state.source.items.filter((it) => it.uuid === CHILD_ID);
        expect(matches).toHaveLength(1);                  // not duplicated
        expect(matches[0].caption).toBe('FRESH');         // fresh copy won
        expect(state.source.items).toHaveLength(2);       // OTHER + CHILD, not 3
        expect(state.source.items.some((it) => it.uuid === OTHER_ID)).toBe(true);
    });

    test('indexing a brand-new child appends it', async () => {
        const get_indexed_record = jest.fn().mockResolvedValue(
            make_indexed_record([{uuid: OTHER_ID, order: 1, caption: 'existing'}])
        );
        const {fn: index_record, state} = capture_index_record();

        const result = await index_container_child_record({
            parent_id: PARENT_ID,
            child_id: CHILD_ID,
            child_record: {uuid: CHILD_ID, order: 2, caption: 'NEW'},
            label: 'Grid',
            get_indexed_record,
            index_record
        });

        expect(result).toBe(true);
        expect(state.source.items).toHaveLength(2);
        expect(state.source.items.find((it) => it.uuid === CHILD_ID).caption).toBe('NEW');
    });

    test('repeated re-index of the same child never accumulates duplicates', async () => {
        let stored = [{uuid: OTHER_ID, order: 1, caption: 'keep me'}];
        const get_indexed_record = jest.fn(async () => make_indexed_record([...stored]));
        const index_record = jest.fn(async (source) => {
            stored = source.items;
            return true;
        });

        for (let i = 0; i < 5; i++) {
            await index_container_child_record({
                parent_id: PARENT_ID,
                child_id: CHILD_ID,
                child_record: {uuid: CHILD_ID, order: 2, caption: `pass-${i}`},
                label: 'Grid',
                get_indexed_record,
                index_record
            });
        }

        expect(stored.filter((it) => it.uuid === CHILD_ID)).toHaveLength(1);
        expect(stored).toHaveLength(2); // OTHER + the single CHILD
    });

    test('items are re-sorted by order after upsert', async () => {
        const get_indexed_record = jest.fn().mockResolvedValue(
            make_indexed_record([{uuid: OTHER_ID, order: 5, caption: 'last'}])
        );
        const {fn: index_record, state} = capture_index_record();

        await index_container_child_record({
            parent_id: PARENT_ID,
            child_id: CHILD_ID,
            child_record: {uuid: CHILD_ID, order: 1, caption: 'first'},
            label: 'Grid',
            get_indexed_record,
            index_record
        });

        expect(state.source.items.map((it) => it.uuid)).toEqual([CHILD_ID, OTHER_ID]);
    });

    test('returns false when the parent doc is not in the index', async () => {
        const get_indexed_record = jest.fn().mockResolvedValue({status: 404, data: {}});
        const index_record = jest.fn();

        const result = await index_container_child_record({
            parent_id: PARENT_ID,
            child_id: CHILD_ID,
            child_record: {uuid: CHILD_ID, order: 1, caption: 'x'},
            label: 'Grid',
            get_indexed_record,
            index_record
        });

        expect(result).toBe(false);
        expect(index_record).not.toHaveBeenCalled();
    });
});
