/**
 * Column-projection PIN TEST for the media-library JOIN.
 *
 * The ~25-column + 2-leftJoin SELECT that pulls media-library metadata onto an
 * item row was copy-pasted into ten task methods across three task classes,
 * and the copies DRIFTED. The aliases are client-visible — `public/app` reads
 * `media_repo_uuid`, `thumbnail_repo_uuid`, `thumb_thumbnail_path` and friends
 * by name off the JSON, and the indexer projects several of them — so the
 * shared builder (`Base_tasks._with_media_library`) must keep every call site
 * returning EXACTLY the aliases it returned before.
 *
 * This suite locks the ordered alias list of all ten call sites. It was written
 * and run green against the pre-refactor code, so a diff here means the shared
 * builder changed a projection, not that a projection was "fixed".
 *
 * Three variants survive, deliberately un-unified (see the report):
 *   list          - item list/single, grid item list, timeline item list
 *   edit          - item edit/details, grid item edit/details
 *   timeline_edit - timeline item edit/details
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const Exhibit_item_record_tasks = require('../../exhibits/tasks/exhibit_item_record_tasks');
const Exhibit_grid_record_tasks = require('../../exhibits/tasks/exhibit_grid_record_tasks');
const Exhibit_timeline_record_tasks = require('../../exhibits/tasks/exhibit_timeline_record_tasks');

jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('../../libs/helper');

/* Deliberately not the physical table names — a leaked literal fails loudly. */
const TABLES = Object.freeze({
    item_records: 'tbl_item_records',
    grid_records: 'tbl_grid_records',
    grid_item_records: 'tbl_grid_item_records',
    timeline_records: 'tbl_timeline_records',
    timeline_item_records: 'tbl_timeline_item_records',
    media_library_records: 'tbl_media_library_records'
});

const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const CONTAINER_UUID = '660e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '770e8400-e29b-41d4-a716-446655440000';
const UID = 42;

/*
 * The projections the ten call sites returned before the refactor, in select
 * order. `*` is the `<table>.*` wildcard every site selects first.
 */
const LIST_ALIASES = Object.freeze([
    '*',
    'media_name',
    'media_ingest_method',
    'media_kaltura_thumbnail_url',
    'media_repo_uuid',
    'media_thumbnail_path',
    'media_alt_text',
    'media_is_alt_text_decorative',
    'media_lib_uuid',
    'kaltura_entry_id',
    'ml_media_width',
    'ml_media_height',
    'ml_media_type',
    'ml_media_filename',
    'media_topics_subjects',
    'media_genre_form_subjects',
    'media_places_subjects',
    'thumbnail_media_name',
    'thumbnail_ingest_method',
    'thumbnail_media_kaltura_thumbnail_url',
    'thumbnail_media_repo_uuid',
    'thumbnail_media_thumbnail_path',
    'thumb_lib_uuid'
]);

const EDIT_ALIASES = Object.freeze([
    '*',
    'media_name',
    'media_ingest_method',
    'media_kaltura_thumbnail_url',
    'media_repo_uuid',
    'media_thumbnail_path',
    'media_alt_text',
    'media_is_alt_text_decorative',
    'media_topics_subjects',
    'media_genre_form_subjects',
    'media_places_subjects',
    'thumbnail_media_name',
    'thumbnail_ingest_method',
    'thumbnail_repo_uuid',
    'thumbnail_media_thumbnail_path'
]);

const TIMELINE_EDIT_ALIASES = Object.freeze([
    '*',
    'media_name',
    'media_filename',
    'media_ingest_method',
    'media_kaltura_thumbnail_url',
    'media_repo_uuid',
    'media_thumbnail_path',
    'media_alt_text',
    'media_is_alt_text_decorative',
    'media_topics_subjects',
    'media_genre_form_subjects',
    'media_places_subjects',
    'thumbnail_media_name',
    'thumbnail_filename',
    'thumb_ingest_method',
    'thumb_kaltura_thumbnail_url',
    'thumbnail_repo_uuid',
    'thumb_thumbnail_path'
]);

/**
 * Reduces one select() argument to the column name the caller sees.
 * Strings are `table.col as alias`, `table.col` or `table.*`; the knex raw
 * stand-in carries its out-alias as the last binding (both branches of
 * kaltura_thumbnail_url_sql put it there).
 */
const alias_of = (entry) => {

    if (typeof entry === 'string') {
        const aliased = entry.match(/\s+as\s+(.+)$/i);
        return aliased ? aliased[1].trim() : entry.split('.').pop();
    }

    return entry.bindings[entry.bindings.length - 1];
};

/**
 * Builds a knex stand-in that records every select() argument list.
 * @param {*} terminal value the terminal `.timeout()` resolves with
 */
const make_capture = (terminal) => {

    const selects = [];
    const query = {};

    for (const name of ['where', 'first', 'leftJoin', 'orderBy', 'count', 'insert', 'update']) {
        query[name] = jest.fn(() => query);
    }

    query.select = jest.fn((...args) => {
        selects.push(args);
        return query;
    });

    query.timeout = jest.fn().mockResolvedValue(terminal);

    const db = jest.fn(() => query);
    db.fn = { now: jest.fn(() => 'NOW()') };
    /* Mirrors knex.raw's (sql, bindings) signature; only the bindings matter here. */
    db.raw = jest.fn((sql, bindings) => ({ sql, bindings }));

    return { db, query, selects };
};

/* A row that reports itself already locked BY THE REQUESTING USER, so the
 * edit-record methods take the "already locked by this user" branch and never
 * reach the lock helper. */
const LOCKED_ROW = Object.freeze({
    id: 1,
    uuid: ITEM_UUID,
    is_locked: 1,
    locked_by_user: UID,
    title: 'pinned'
});

describe('media-library JOIN projection (pin test)', () => {

    /**
     * Runs one call site against a capturing knex stand-in and returns the
     * ordered alias list its single select() produced.
     */
    const aliases_from = async (Task_class, terminal, invoke) => {

        const { db, selects } = make_capture(terminal);
        const task = new Task_class(db, TABLES);

        await invoke(task);

        expect(selects).toHaveLength(1);

        return selects[0].map(alias_of);
    };

    describe('list variant', () => {

        test('get_item_records', async () => {
            const aliases = await aliases_from(
                Exhibit_item_record_tasks,
                [],
                (task) => task.get_item_records(EXHIBIT_UUID)
            );
            expect(aliases).toEqual([...LIST_ALIASES]);
        });

        test('get_item_record', async () => {
            const aliases = await aliases_from(
                Exhibit_item_record_tasks,
                LOCKED_ROW,
                (task) => task.get_item_record(EXHIBIT_UUID, ITEM_UUID)
            );
            expect(aliases).toEqual([...LIST_ALIASES]);
        });

        test('get_grid_item_records', async () => {
            const aliases = await aliases_from(
                Exhibit_grid_record_tasks,
                [],
                (task) => task.get_grid_item_records(EXHIBIT_UUID, CONTAINER_UUID)
            );
            expect(aliases).toEqual([...LIST_ALIASES]);
        });

        test('get_timeline_item_records', async () => {
            const aliases = await aliases_from(
                Exhibit_timeline_record_tasks,
                [],
                (task) => task.get_timeline_item_records(EXHIBIT_UUID, CONTAINER_UUID)
            );
            expect(aliases).toEqual([...LIST_ALIASES]);
        });
    });

    describe('edit variant (item + grid item)', () => {

        test('get_item_edit_record', async () => {
            const aliases = await aliases_from(
                Exhibit_item_record_tasks,
                LOCKED_ROW,
                (task) => task.get_item_edit_record(UID, EXHIBIT_UUID, ITEM_UUID)
            );
            expect(aliases).toEqual([...EDIT_ALIASES]);
        });

        test('get_item_details_record', async () => {
            const aliases = await aliases_from(
                Exhibit_item_record_tasks,
                LOCKED_ROW,
                (task) => task.get_item_details_record(EXHIBIT_UUID, ITEM_UUID)
            );
            expect(aliases).toEqual([...EDIT_ALIASES]);
        });

        test('get_grid_item_edit_record', async () => {
            const aliases = await aliases_from(
                Exhibit_grid_record_tasks,
                LOCKED_ROW,
                (task) => task.get_grid_item_edit_record(UID, EXHIBIT_UUID, CONTAINER_UUID, ITEM_UUID)
            );
            expect(aliases).toEqual([...EDIT_ALIASES]);
        });

        test('get_grid_item_details_record', async () => {
            const aliases = await aliases_from(
                Exhibit_grid_record_tasks,
                LOCKED_ROW,
                (task) => task.get_grid_item_details_record(EXHIBIT_UUID, CONTAINER_UUID, ITEM_UUID)
            );
            expect(aliases).toEqual([...EDIT_ALIASES]);
        });
    });

    describe('timeline_edit variant', () => {

        test('get_timeline_item_edit_record', async () => {
            const aliases = await aliases_from(
                Exhibit_timeline_record_tasks,
                LOCKED_ROW,
                (task) => task.get_timeline_item_edit_record(String(UID), EXHIBIT_UUID, CONTAINER_UUID, ITEM_UUID)
            );
            expect(aliases).toEqual([...TIMELINE_EDIT_ALIASES]);
        });

        test('get_timeline_item_details_record', async () => {
            const aliases = await aliases_from(
                Exhibit_timeline_record_tasks,
                LOCKED_ROW,
                (task) => task.get_timeline_item_details_record(EXHIBIT_UUID, CONTAINER_UUID, ITEM_UUID)
            );
            expect(aliases).toEqual([...TIMELINE_EDIT_ALIASES]);
        });
    });

    describe('documented drift between the variants', () => {

        test('list carries the v2 indexer columns the edit variants omit', () => {
            for (const alias of ['media_lib_uuid', 'kaltura_entry_id', 'ml_media_width',
                'ml_media_height', 'ml_media_type', 'ml_media_filename', 'thumb_lib_uuid']) {
                expect(LIST_ALIASES).toContain(alias);
                expect(EDIT_ALIASES).not.toContain(alias);
                expect(TIMELINE_EDIT_ALIASES).not.toContain(alias);
            }
        });

        test('thumb_lib.repo_uuid is aliased differently per variant', () => {
            expect(LIST_ALIASES).toContain('thumbnail_media_repo_uuid');
            expect(EDIT_ALIASES).toContain('thumbnail_repo_uuid');
            expect(TIMELINE_EDIT_ALIASES).toContain('thumbnail_repo_uuid');
        });

        test('timeline_edit uses thumb_* where item/grid use thumbnail_*', () => {
            expect(TIMELINE_EDIT_ALIASES).toContain('thumb_ingest_method');
            expect(TIMELINE_EDIT_ALIASES).toContain('thumb_thumbnail_path');
            expect(TIMELINE_EDIT_ALIASES).toContain('thumb_kaltura_thumbnail_url');
            expect(EDIT_ALIASES).toContain('thumbnail_ingest_method');
            expect(EDIT_ALIASES).toContain('thumbnail_media_thumbnail_path');
        });

        test('only timeline_edit exposes the original filenames', () => {
            expect(TIMELINE_EDIT_ALIASES).toContain('media_filename');
            expect(TIMELINE_EDIT_ALIASES).toContain('thumbnail_filename');
            expect(LIST_ALIASES).not.toContain('media_filename');
            expect(EDIT_ALIASES).not.toContain('media_filename');
        });

        test('the edit variant selects no thumbnail kaltura URL, the others do', () => {
            /* All three carry the PRIMARY media kaltura URL. */
            for (const set of [LIST_ALIASES, EDIT_ALIASES, TIMELINE_EDIT_ALIASES]) {
                expect(set).toContain('media_kaltura_thumbnail_url');
            }
            /* Only the item/grid edit variant drops the THUMBNAIL one. */
            expect(EDIT_ALIASES.filter((a) => a.includes('kaltura'))).toEqual(['media_kaltura_thumbnail_url']);
            expect(LIST_ALIASES).toContain('thumbnail_media_kaltura_thumbnail_url');
            expect(TIMELINE_EDIT_ALIASES).toContain('thumb_kaltura_thumbnail_url');
        });
    });
});
