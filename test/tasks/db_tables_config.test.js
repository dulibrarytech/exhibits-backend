'use strict';

/* config/db_tables_config must refuse to load when a table-name key is missing from .env. */

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const TABLE_ENV = {
    EXHIBIT_RECORDS: 'tbl_exhibits',
    ITEM_RECORDS: 'tbl_standard_items',
    HEADING_RECORDS: 'tbl_heading_items',
    CONTENT_BLOCK_RECORDS: 'tbl_content_block_items',
    GRID_ITEM_RECORDS: 'tbl_grid_items',
    GRID_RECORDS: 'tbl_grids',
    TIMELINE_RECORDS: 'tbl_timelines',
    TIMELINE_ITEM_RECORDS: 'tbl_timeline_items',
    USER_RECORDS: 'tbl_users',
    ROLES_RECORDS: 'ctbl_roles',
    USERS_ROLES: 'ctbl_users_roles',
    MEDIA_LIBRARY_RECORDS: 'tbl_media_library',
    EXHIBIT_MEDIA_RECORDS: 'tbl_exhibit_media'
};

async function load() {
    const loaded = await import('../../config/db_tables_config');
    return (loaded.default || loaded)();
}

describe('config/db_tables_config', () => {

    let saved_env;

    beforeEach(() => {
        saved_env = { ...process.env };
        vi.resetModules();

        for (const [key, value] of Object.entries(TABLE_ENV)) {
            process.env[key] = value;
        }
    });

    afterEach(() => {
        process.env = saved_env;
    });

    test('maps every table key when all env keys are set', async () => {
        const config = await load();

        expect(config.exhibits.content_block_records).toBe('tbl_content_block_items');
        expect(Object.keys(config.exhibits)).toHaveLength(Object.keys(TABLE_ENV).length);
    });

    test('refuses to load when CONTENT_BLOCK_RECORDS is missing, naming the key', async () => {
        delete process.env.CONTENT_BLOCK_RECORDS;

        await expect(load()).rejects.toThrow(/CONTENT_BLOCK_RECORDS/);
    });

    test('treats a blank value as missing and lists every missing key', async () => {
        process.env.GRID_RECORDS = '   ';
        delete process.env.EXHIBIT_MEDIA_RECORDS;

        await expect(load()).rejects.toThrow(/GRID_RECORDS, EXHIBIT_MEDIA_RECORDS/);
    });
});
