/**
 * Database-backed test: media_record_tasks reference lookups
 *
 *   find_by_storage_path     — the guard behind DELETE /media/library/upload:
 *                              "is this on-disk path claimed by ANY saved
 *                              record?" A yes must cover both the original and
 *                              the thumbnail column, and soft-deleted rows too
 *                              (their files must survive for recycle-bin
 *                              restore). Review finding 3 (media).
 *   get_published_exhibit_uuids — which of a media record's exhibits get
 *                              re-indexed after a file replace: published and
 *                              not deleted, nothing else.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const { create_knex, TABLES, uuid } = require('./db');
const Media_tasks = require('../../media-library/tasks/media_record_tasks');

const knex = create_knex();
const media = new Media_tasks(knex, TABLES);

const stamp = uuid().slice(0, 8);
const P = {
    live_file: `images/aa/bb/${stamp}-live.jpg`,
    live_thumb: `thumbnails/aa/bb/${stamp}-live_thumb.jpg`,
    deleted_file: `images/cc/dd/${stamp}-gone.png`,
    deleted_thumb: `thumbnails/cc/dd/${stamp}-gone_thumb.jpg`,
    unknown: `images/ee/ff/${stamp}-nobody.jpg`
};

const MEDIA = { live: uuid(), deleted: uuid() };
const EXHIBITS = { published: uuid(), unpublished: uuid(), deleted_published: uuid(), unknown: uuid() };

beforeAll(async () => {
    await knex(TABLES.media_library_records).insert([
        { uuid: MEDIA.live, name: 'live', media_type: 'image', ingest_method: 'upload', is_deleted: 0,
            storage_path: P.live_file, thumbnail_path: P.live_thumb },
        { uuid: MEDIA.deleted, name: 'gone', media_type: 'image', ingest_method: 'upload', is_deleted: 1,
            storage_path: P.deleted_file, thumbnail_path: P.deleted_thumb }
    ]);

    await knex(TABLES.exhibit_records).insert([
        { uuid: EXHIBITS.published, title: 'DB media refs P', is_published: 1, is_deleted: 0 },
        { uuid: EXHIBITS.unpublished, title: 'DB media refs U', is_published: 0, is_deleted: 0 },
        { uuid: EXHIBITS.deleted_published, title: 'DB media refs D', is_published: 1, is_deleted: 1 }
    ]);
});

afterAll(async () => {
    try {
        await knex(TABLES.media_library_records).whereIn('uuid', Object.values(MEDIA)).del();
        await knex(TABLES.exhibit_records).whereIn('uuid', Object.values(EXHIBITS)).del();
    } finally {
        await knex.destroy();
    }
});

describe('find_by_storage_path — is this path claimed by any saved record?', () => {

    test('a live record\'s original is claimed', async () => {
        const result = await media.find_by_storage_path(P.live_file);

        expect(result.exists).toBe(true);
        expect(result.record).toEqual({ uuid: MEDIA.live, name: 'live' });
    });

    test('a live record\'s THUMBNAIL is claimed too (it is a real file the record serves)', async () => {
        expect((await media.find_by_storage_path(P.live_thumb)).exists).toBe(true);
    });

    test('a soft-deleted record still claims its files (recycle-bin restore needs them)', async () => {
        expect((await media.find_by_storage_path(P.deleted_file)).exists).toBe(true);
        expect((await media.find_by_storage_path(P.deleted_thumb)).exists).toBe(true);
    });

    test('an unclaimed path is reported as free, and surrounding whitespace is ignored', async () => {
        expect((await media.find_by_storage_path(P.unknown)).exists).toBe(false);
        expect((await media.find_by_storage_path(`  ${P.live_file}  `)).exists).toBe(true);
    });

    test('an empty path is an error, not "free"', async () => {
        await expect(media.find_by_storage_path('   ')).rejects.toThrow(/storage_path is required/);
    });
});

describe('get_published_exhibit_uuids — which referencing exhibits get re-indexed', () => {

    test('returns only exhibits that are published AND not deleted', async () => {
        const result = await media.get_published_exhibit_uuids(Object.values(EXHIBITS));

        expect(result).toEqual([EXHIBITS.published]);
    });

    test('an empty or non-array input yields an empty list without querying', async () => {
        expect(await media.get_published_exhibit_uuids([])).toEqual([]);
        expect(await media.get_published_exhibit_uuids(null)).toEqual([]);
    });
});
