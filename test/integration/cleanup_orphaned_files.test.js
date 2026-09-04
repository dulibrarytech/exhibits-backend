/**
 * Integration Test: media-library/tasks/cleanup_orphaned_files.js
 *
 * Runs the real sweep against a temporary storage tree with a fake DB.
 * Pins the contract from code review 2026-09-02 (C5):
 *
 *   - a file is referenced by storage_path / thumbnail_path, NOT by the uuid in
 *     its filename (v2 uploads: file uuid != record uuid) — retained
 *   - soft-deleted rows still protect their files — retained
 *   - unreferenced files older than the age gate are orphans — deleted only
 *     with --delete; fresh ones are skipped
 *   - IIIF cache dirs are keyed by RECORD uuid
 *   - a DB failure, or an empty table with files on disk, aborts with nothing deleted
 *
 * Runs under Jest so the script's transitive CJS config requires can be mocked.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

const mockStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'exhibits-cleanup-'));

const mockSelect = jest.fn();
const mockDB = jest.fn(() => ({ select: mockSelect }));
mockDB.destroy = jest.fn();

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('log4js', () => ({ configure: jest.fn() }));
jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());
jest.mock('../../config/db_config', () => () => mockDB);
jest.mock('../../config/db_tables_config', () => require('./helpers/mocks').db_tables_factory({ media_library_records: 'tbl_media_library' }));
jest.mock('../../media-library/storage_config', () => () => ({
    storage_path: mockStorageRoot,
    media_type_dirs: { image: 'images', pdf: 'documents', video: 'video', audio: 'audio', thumbnails: 'thumbnails' }
}));

const { run_cleanup, normalize_reference, conventional_thumbnail_key } = require('../../media-library/tasks/cleanup_orphaned_files');

/* uuids: record uuid != file uuid for the v2-shaped rows */
const RECORD_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const FILE_A = 'd8adfc37-ce14-43e7-82a3-662014507111';
const RECORD_DELETED = 'bbbbbbbb-2222-4222-8222-222222222222';
const FILE_DELETED = 'f00ba0f2-c526-4f18-9eec-57e53795dc9b';
const V1_SAME = 'cccccccc-3333-4333-8333-333333333333';   /* v1-migrated: record uuid == file uuid, no thumbnail_path */
const ORPHAN = 'dddddddd-4444-4444-8444-444444444444';
const FRESH = 'eeeeeeee-5555-4555-8555-555555555555';
const CACHE_ORPHAN = 'ffffffff-6666-4666-8666-666666666666';

const bucket = (uuid) => {
    const clean = uuid.replace(/-/g, '');
    return [clean.substring(0, 2), clean.substring(2, 4)];
};
const rel_file = (dir, uuid, ext) => `${dir}/${bucket(uuid).join('/')}/${uuid}${ext}`;
const rel_thumb = (uuid) => `thumbnails/${bucket(uuid).join('/')}/${uuid}_thumb.jpg`;

const TWO_DAYS_AGO = new Date(Date.now() - 48 * 60 * 60 * 1000);

function write_file(relative, { fresh = false } = {}) {
    const absolute = path.join(mockStorageRoot, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, 'x'.repeat(100));
    if (!fresh) {
        fs.utimesSync(absolute, TWO_DAYS_AGO, TWO_DAYS_AGO);
    }
    return absolute;
}

const exists = (relative) => fs.existsSync(path.join(mockStorageRoot, relative));

const ROWS = [
    { uuid: RECORD_A, storage_path: rel_file('images', FILE_A, '.jpg'), thumbnail_path: rel_thumb(FILE_A) },
    { uuid: RECORD_DELETED, storage_path: rel_file('images', FILE_DELETED, '.png'), thumbnail_path: rel_thumb(FILE_DELETED), is_deleted: 1 },
    { uuid: V1_SAME, storage_path: rel_file('documents', V1_SAME, '.pdf'), thumbnail_path: null },
    { uuid: 'a0a0a0a0-7777-4777-8777-777777777777', storage_path: null, thumbnail_path: null } /* kaltura/repo row: no files */
];

let files;

function seed_storage() {
    fs.rmSync(mockStorageRoot, { recursive: true, force: true });
    fs.mkdirSync(mockStorageRoot, { recursive: true });

    files = {
        a: rel_file('images', FILE_A, '.jpg'),
        a_thumb: rel_thumb(FILE_A),
        deleted: rel_file('images', FILE_DELETED, '.png'),
        deleted_thumb: rel_thumb(FILE_DELETED),
        v1: rel_file('documents', V1_SAME, '.pdf'),
        v1_thumb: rel_thumb(V1_SAME),           /* on disk, but thumbnail_path is NULL in the row */
        orphan: rel_file('images', ORPHAN, '.jpg'),
        orphan_thumb: rel_thumb(ORPHAN),
        fresh: rel_file('images', FRESH, '.jpg'),
        cache_a: `iiif_cache/${bucket(RECORD_A).join('/')}/${RECORD_A}/1/full.jpg`,
        cache_orphan: `iiif_cache/${bucket(CACHE_ORPHAN).join('/')}/${CACHE_ORPHAN}/1/full.jpg`
    };

    for (const [name, relative] of Object.entries(files)) {
        write_file(relative, { fresh: name === 'fresh' });
    }
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockSelect.mockResolvedValue(ROWS);
    seed_storage();
});

afterAll(() => {
    fs.rmSync(mockStorageRoot, { recursive: true, force: true });
});

describe('cleanup_orphaned_files — reference semantics', () => {

    test('dry run reports orphans by PATH and deletes nothing', async () => {
        const stats = await run_cleanup(true);

        expect(stats.aborted).toBeNull();
        expect(mockDB).toHaveBeenCalledWith('tbl_media_library');
        expect(stats.db_rows).toBe(ROWS.length);

        /* 9 scanned files: 6 referenced (a, a_thumb, deleted, deleted_thumb, v1, v1_thumb), orphan + orphan_thumb, fresh */
        expect(stats.files_scanned).toBe(9);
        expect(stats.files_referenced).toBe(6);
        expect(stats.orphaned_files).toBe(1);
        expect(stats.orphaned_thumbnails).toBe(1);
        expect(stats.skipped_too_new).toBe(1);
        expect(stats.orphaned_cache_dirs).toBe(1);

        expect(stats.files_deleted).toBe(0);
        expect(stats.thumbnails_deleted).toBe(0);
        expect(stats.cache_dirs_deleted).toBe(0);
        for (const relative of Object.values(files)) {
            expect(exists(relative)).toBe(true);
        }
    });

    test('--delete removes only unreferenced, old-enough files and orphaned cache dirs', async () => {
        const stats = await run_cleanup(false);

        expect(stats.aborted).toBeNull();
        expect(stats.files_deleted).toBe(1);
        expect(stats.thumbnails_deleted).toBe(1);
        expect(stats.cache_dirs_deleted).toBe(1);
        expect(stats.errors).toBe(0);

        /* v2-shaped row (record uuid != file uuid): RETAINED */
        expect(exists(files.a)).toBe(true);
        expect(exists(files.a_thumb)).toBe(true);
        /* soft-deleted row: RETAINED (recycle-bin restore must still work) */
        expect(exists(files.deleted)).toBe(true);
        expect(exists(files.deleted_thumb)).toBe(true);
        /* v1-shaped row with NULL thumbnail_path: file AND conventional thumbnail RETAINED */
        expect(exists(files.v1)).toBe(true);
        expect(exists(files.v1_thumb)).toBe(true);
        /* cache dir for a live record uuid: RETAINED */
        expect(exists(files.cache_a)).toBe(true);
        /* too-new unreferenced file: RETAINED */
        expect(exists(files.fresh)).toBe(true);

        /* genuine orphans: GONE, and their empty buckets pruned */
        expect(exists(files.orphan)).toBe(false);
        expect(exists(files.orphan_thumb)).toBe(false);
        expect(exists(files.cache_orphan)).toBe(false);
        expect(exists(path.dirname(files.orphan))).toBe(false);
        /* top-level type dirs survive pruning */
        expect(exists('images')).toBe(true);
    });

    test('a uuid-named file is NOT protected merely because some row has that uuid', async () => {
        /* Row uuid matches the ORPHAN filename but references a different path — the old
           uuid-keyed sweep would have kept this file; the path-keyed sweep deletes it. */
        mockSelect.mockResolvedValue([
            ...ROWS,
            { uuid: ORPHAN, storage_path: rel_file('images', FILE_A, '.jpg'), thumbnail_path: null }
        ]);

        const stats = await run_cleanup(false);

        expect(stats.files_deleted).toBe(1);
        expect(exists(files.orphan)).toBe(false);
        expect(exists(files.a)).toBe(true);
    });
});

describe('cleanup_orphaned_files — fail closed', () => {

    test('aborts and deletes nothing when the reference query fails', async () => {
        mockSelect.mockRejectedValue(new Error('ECONNREFUSED'));

        const stats = await run_cleanup(false);

        expect(stats.aborted).toBe('db-error');
        expect(stats.errors).toBe(1);
        expect(stats.files_deleted).toBe(0);
        expect(stats.cache_dirs_deleted).toBe(0);
        for (const relative of Object.values(files)) {
            expect(exists(relative)).toBe(true);
        }
    });

    test('aborts when the media table is empty but storage has files', async () => {
        mockSelect.mockResolvedValue([]);

        const stats = await run_cleanup(false);

        expect(stats.aborted).toBe('no-references');
        expect(stats.files_deleted).toBe(0);
        expect(exists(files.orphan)).toBe(true);
    });
});

describe('cleanup_orphaned_files — key normalization', () => {

    test('normalize_reference matches the on-disk key form', () => {
        expect(normalize_reference('images/D8/ad/X.JPG')).toBe('images/d8/ad/x.jpg');
        expect(normalize_reference('./images/a/b/c.jpg')).toBe('images/a/b/c.jpg');
        expect(normalize_reference('images\\a\\b\\c.jpg')).toBe('images/a/b/c.jpg');
        expect(normalize_reference('   ')).toBeNull();
        expect(normalize_reference(null)).toBeNull();
    });

    test('conventional_thumbnail_key derives the thumbnail from the FILE uuid', () => {
        expect(conventional_thumbnail_key(rel_file('images', FILE_A, '.jpg'))).toBe(rel_thumb(FILE_A));
        expect(conventional_thumbnail_key('images/a/b/not-a-uuid.jpg')).toBeNull();
    });
});
