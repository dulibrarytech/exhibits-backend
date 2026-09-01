'use strict';

/**
 * Media replace-file task: guards + the dedicated column whitelist.
 *
 * replace_media_file exists precisely because storage_path/thumbnail_path are
 * excluded from update_media_record's UPDATABLE_FIELDS (the generic PUT must
 * never repoint a record at an arbitrary path). These tests pin that split:
 * - only upload-ingested, non-deleted records can be repointed;
 * - only file-derived columns reach the UPDATE (no name/uuid/is_deleted);
 * - a replacement storage_path is mandatory.
 */

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const Media_record_tasks = require('../../media-library/tasks/media_record_tasks');

const TABLE = {
    media_library_records: 'tbl_media_library',
    exhibit_records: 'tbl_exhibits'
};

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';

// Recording fake DB: captures .update() payloads; serves the queued
// existing-row check first, then the refreshed-record select.
function createReplaceDb({ existing, affected = 1, updated_record = { uuid: TEST_UUID } }) {
    const calls = { updates: [] };
    let select_count = 0;
    function makeBuilder() {
        const state = { mode: null };
        const builder = {
            select() { state.mode = 'select'; return builder; },
            where() { return builder; },
            whereIn() { return builder; },
            first() { return builder; },
            update(d) { state.mode = 'update'; calls.updates.push(d); return builder; },
            timeout() { return builder; },
            then(resolve, reject) {
                let value;
                if (state.mode === 'update') {
                    value = affected;
                } else {
                    select_count += 1;
                    value = select_count === 1 ? existing : updated_record;
                }
                return Promise.resolve(value).then(resolve, reject);
            }
        };
        return builder;
    }
    const db = () => makeBuilder();
    db.fn = { now: () => 'DB_NOW' };
    return { db, calls };
}

const VALID_REPLACE_DATA = {
    storage_path: 'images/aa/bb/new-file-uuid.jpg',
    thumbnail_path: 'thumbnails/aa/bb/new-file-uuid_thumb.jpg',
    mime_type: 'image/jpeg',
    original_filename: 'better-version.jpg',
    size: 12345,
    exif_data: '{}',
    media_width: 800,
    media_height: 600,
    updated_by: 'Curator'
};

describe('replace_media_file — guards + whitelist', () => {

    test('refuses a non-upload record (repository/kaltura rows have no local file)', async () => {
        const { db, calls } = createReplaceDb({
            existing: { id: 1, uuid: TEST_UUID, is_deleted: 0, ingest_method: 'kaltura' }
        });
        const task = new Media_record_tasks(db, TABLE);

        const result = await task.replace_media_file(TEST_UUID, VALID_REPLACE_DATA);

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/Only uploaded media/);
        expect(calls.updates.length).toBe(0);
    });

    test('refuses a deleted record', async () => {
        const { db, calls } = createReplaceDb({
            existing: { id: 1, uuid: TEST_UUID, is_deleted: 1, ingest_method: 'upload' }
        });
        const task = new Media_record_tasks(db, TABLE);

        const result = await task.replace_media_file(TEST_UUID, VALID_REPLACE_DATA);

        expect(result.success).toBe(false);
        expect(calls.updates.length).toBe(0);
    });

    test('requires a replacement storage_path', async () => {
        const { db, calls } = createReplaceDb({
            existing: { id: 1, uuid: TEST_UUID, is_deleted: 0, ingest_method: 'upload' }
        });
        const task = new Media_record_tasks(db, TABLE);

        const result = await task.replace_media_file(TEST_UUID, { mime_type: 'image/jpeg' });

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/storage_path/);
        expect(calls.updates.length).toBe(0);
    });

    test('updates only file-derived columns (drops uuid/name/is_deleted smuggling)', async () => {
        const { db, calls } = createReplaceDb({
            existing: { id: 1, uuid: TEST_UUID, is_deleted: 0, ingest_method: 'upload' }
        });
        const task = new Media_record_tasks(db, TABLE);

        const result = await task.replace_media_file(TEST_UUID, {
            ...VALID_REPLACE_DATA,
            // smuggled / server-managed columns that must NOT reach the UPDATE:
            uuid: 'other-uuid',
            name: 'attacker rename',
            is_deleted: 1,
            ingest_method: 'repository',
            owner: 999
        });

        expect(result.success).toBe(true);
        expect(calls.updates.length).toBe(1);
        const updated = calls.updates[0];
        expect(updated).toMatchObject(VALID_REPLACE_DATA);
        expect(updated.updated).toBe('DB_NOW');
        expect(updated).not.toHaveProperty('uuid');
        expect(updated).not.toHaveProperty('name');
        expect(updated).not.toHaveProperty('is_deleted');
        expect(updated).not.toHaveProperty('ingest_method');
        expect(updated).not.toHaveProperty('owner');
    });

    test('returns the refreshed record on success', async () => {
        const refreshed = { uuid: TEST_UUID, original_filename: 'better-version.jpg' };
        const { db } = createReplaceDb({
            existing: { id: 1, uuid: TEST_UUID, is_deleted: 0, ingest_method: 'upload' },
            updated_record: refreshed
        });
        const task = new Media_record_tasks(db, TABLE);

        const result = await task.replace_media_file(TEST_UUID, VALID_REPLACE_DATA);

        expect(result.success).toBe(true);
        expect(result.record).toEqual(refreshed);
    });
});

describe('get_published_exhibit_uuids', () => {

    test('returns [] for an empty candidate set without querying', async () => {
        const db = () => { throw new Error('DB must not be queried for an empty set'); };
        const task = new Media_record_tasks(db, TABLE);

        expect(await task.get_published_exhibit_uuids([])).toEqual([]);
        expect(await task.get_published_exhibit_uuids(null)).toEqual([]);
    });

    test('maps matched rows to a flat uuid array', async () => {
        const rows = [{ uuid: 'exhibit-a' }, { uuid: 'exhibit-b' }];
        function makeBuilder() {
            const builder = {
                select() { return builder; },
                whereIn() { return builder; },
                where() { return builder; },
                timeout() { return builder; },
                then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); }
            };
            return builder;
        }
        const db = () => makeBuilder();
        const task = new Media_record_tasks(db, TABLE);

        const result = await task.get_published_exhibit_uuids(['exhibit-a', 'exhibit-b', 'exhibit-unpublished']);

        expect(result).toEqual(['exhibit-a', 'exhibit-b']);
    });
});
