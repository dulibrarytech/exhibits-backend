'use strict';

/**
 * Pins Media_record_tasks extending Base_tasks (DRY review 2026-09-03,
 * cluster O4). The class used to carry its own copies of the validation and
 * logging helpers with slightly different error text; it now inherits the
 * exhibit task classes' base, so the base strings are the contract.
 */

const Base_tasks = require('../../exhibits/tasks/tasks_helper');
const Media_record_tasks = require('../../media-library/tasks/media_record_tasks');

const TABLE = {
    media_library_records: 'tbl_media_library',
    exhibit_records: 'tbl_exhibits',
    user_records: 'tbl_users'
};

/* A knex-shaped stand-in: callable, never actually queried by these tests */
function fake_db() {
    const db = () => { throw new Error('query should not run'); };
    db.fn = { now: () => 'DB_NOW' };
    return db;
}

describe('Media_record_tasks extends Base_tasks', () => {

    test('inherits the base constructor state', () => {
        const task = new Media_record_tasks(fake_db(), TABLE);

        expect(task).toBeInstanceOf(Base_tasks);
        expect(task.TABLE).toBe(TABLE);
        expect(task.QUERY_TIMEOUT).toBe(10000);
        expect(task.UUID_REGEX).toBeInstanceOf(RegExp);
        /* no media-local copies remain */
        expect(Object.prototype.hasOwnProperty.call(Media_record_tasks.prototype, '_validate_uuid')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(Media_record_tasks.prototype, '_handle_error')).toBe(false);
    });

    test('rejects a malformed media UUID with the base error text', async () => {
        const task = new Media_record_tasks(fake_db(), TABLE);

        await expect(task.get_media_record('not-a-uuid')).rejects.toThrow('Invalid media UUID format');
        await expect(task.get_media_record('   ')).rejects.toThrow('Valid media UUID is required');
        await expect(task.delete_media_record(42, 'Curator')).rejects.toThrow('Valid media UUID is required');
    });

    test('rejects a missing database or table with the base error text', async () => {
        await expect(new Media_record_tasks(null, TABLE).get_media_records())
            .rejects.toThrow('Database connection is not available');
        await expect(new Media_record_tasks(fake_db(), {}).get_media_records())
            .rejects.toThrow('Table name "media_library_records" is not defined');
    });

    test('rejects an empty search keyword with the base error text', async () => {
        const task = new Media_record_tasks(fake_db(), TABLE);

        await expect(task.search_media_records('   ')).rejects.toThrow('Valid search keyword is required');
    });
});
