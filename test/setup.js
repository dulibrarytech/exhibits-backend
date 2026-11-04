import { vi } from 'vitest';

globalThis.jest = vi;

/* config/db_tables_config refuses to load without these; mirror env-example so suites that load it for real can start. */
const TABLE_ENV_DEFAULTS = {
    EXHIBIT_RECORDS: 'tbl_exhibits',
    ITEM_RECORDS: 'tbl_standard_items',
    HEADING_RECORDS: 'tbl_heading_items',
    CONTENT_BLOCK_RECORDS: 'tbl_content_block_items',
    GRID_RECORDS: 'tbl_grids',
    GRID_ITEM_RECORDS: 'tbl_grid_items',
    TIMELINE_RECORDS: 'tbl_timelines',
    TIMELINE_ITEM_RECORDS: 'tbl_timeline_items',
    MEDIA_LIBRARY_RECORDS: 'tbl_media_library',
    EXHIBIT_MEDIA_RECORDS: 'tbl_exhibit_media',
    USER_RECORDS: 'tbl_users',
    ROLES_RECORDS: 'tbl_user_roles',
    USERS_ROLES: 'ctbl_user_roles'
};

for (const [key, value] of Object.entries(TABLE_ENV_DEFAULTS)) {
    if (!process.env[key]) {
        process.env[key] = value;
    }
}

// jsdom 16.7 under newer Node exposes a window.localStorage whose setItem/clear are
// missing (opaque-origin Storage), which breaks the jsdom-environment unit tests in
// test/unit-app. Provide a minimal in-memory Storage so those tests have a real
// localStorage. Skipped in the default `node` environment, where there is no window.
if (typeof window !== 'undefined'
    && (!window.localStorage || typeof window.localStorage.setItem !== 'function')) {

    const store = new Map();
    const storage = {
        getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
        setItem: (key, value) => { store.set(String(key), String(value)); },
        removeItem: (key) => { store.delete(String(key)); },
        clear: () => { store.clear(); },
        key: (i) => (Array.from(store.keys())[i] ?? null),
        get length() { return store.size; },
    };

    try {
        Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });
    } catch {
        window.localStorage = storage;
    }
}
