'use strict';

/**
 * Media create: the ajv create schema + the insert column whitelist.
 *
 * Guards the fix for "media create has no ajv schema / mass assignment":
 * - the create schema requires name/media_type/ingest_method (the NOT-NULL columns);
 * - create_media_record inserts ONLY whitelisted columns, so a client can't smuggle
 *   id / is_deleted / updated_by (or any other column) into the row.
 */

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const VALIDATOR = require('../../libs/validate');
const MEDIA_CREATE_SCHEMA = require('../../media-library/schemas/media_create_record_schema')();
const Media_record_tasks = require('../../media-library/tasks/media_record_tasks');

const TABLE = { media_library_records: 'tbl_media_library' };

// Recording fake DB: captures the .insert() payload; resolves insert→[1], select→a row.
function createRecordingDb() {
    const calls = { inserts: [] };
    function makeBuilder() {
        const state = { mode: null };
        const builder = {
            insert(d) { state.mode = 'insert'; calls.inserts.push(d); return builder; },
            select() { state.mode = 'select'; return builder; },
            where() { return builder; },
            first() { return builder; },
            timeout() { return builder; },
            then(resolve, reject) {
                const value = state.mode === 'insert' ? [1] : { id: 1, uuid: 'abc', name: 'My Media' };
                return Promise.resolve(value).then(resolve, reject);
            }
        };
        return builder;
    }
    const db = () => makeBuilder();
    db.transaction = async (cb) => cb(db);
    return { db, calls };
}

describe('media create — schema + insert whitelist', () => {

    describe('media_create_record_schema (ajv)', () => {
        const validator = new VALIDATOR(MEDIA_CREATE_SCHEMA);

        test('accepts a record with the required fields', () => {
            expect(validator.validate({ name: 'x', media_type: 'image', ingest_method: 'upload' })).toBe(true);
        });

        test('requires name, media_type and ingest_method', () => {
            expect(validator.validate({ name: 'x' })).not.toBe(true);
            expect(validator.validate({})).not.toBe(true);
        });
    });

    test('create_media_record inserts only whitelisted columns (drops id/is_deleted/updated_by)', async () => {
        const { db, calls } = createRecordingDb();
        const task = new Media_record_tasks(db, TABLE);

        const result = await task.create_media_record({
            uuid: 'abc', name: 'My Media', media_type: 'image', ingest_method: 'upload',
            owner: 7, created_by: 'Curator',
            // smuggled / server-managed columns that must NOT be inserted:
            id: 999, is_deleted: 1, updated_by: 'attacker'
        });

        expect(result.success).toBe(true);
        expect(calls.inserts.length).toBe(1);
        const inserted = calls.inserts[0];
        expect(inserted).toMatchObject({ uuid: 'abc', name: 'My Media', media_type: 'image', ingest_method: 'upload' });
        expect(inserted).not.toHaveProperty('id');
        expect(inserted).not.toHaveProperty('is_deleted');
        expect(inserted).not.toHaveProperty('updated_by');
    });
});
