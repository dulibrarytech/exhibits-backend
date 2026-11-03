// @vitest-environment jsdom

/**
 * Logout, sign-in and session-expired pages remove only the dashboard's
 * own browser-storage keys.
 *
 * Other apps share the staging domain, and the old sessionStorage.clear() /
 * localStorage.clear() calls erased their data too. The sidebar preference
 * (exhibits_sidebar_collapsed) survives logout.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { readFileSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const BACKEND_ROOT = resolve(__dirname, '../..');
const AUTH_MODULE_PATH = join(BACKEND_ROOT, 'public/app/utils/auth.module.js');
const PARTIAL_PATH = join(BACKEND_ROOT, 'views/partials/clear-session-storage.ejs');

const OWN_SESSION_KEYS = [
    'exhibits_token',
    'exhibits_user',
    'exhibits_endpoints_refresh_attempted',
];
const OWN_LOCAL_KEYS = [
    'exhibits_app_path',
    'exhibits_endpoints',
    'exhibits_endpoints_users',
    'exhibits_endpoints_indexer',
    'exhibits_endpoints_media_library',
    'exhibits_endpoints_version',
    'items',
];
const SIDEBAR_KEY = 'exhibits_sidebar_collapsed';
const OTHER_APP_KEYS = ['other_app_token', 'other_app_settings'];

function make_storage() {
    const map = new Map();
    return {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => { map.set(key, String(value)); },
        removeItem: (key) => { map.delete(key); },
        clear: vi.fn(() => { map.clear(); }),
        stored_keys: () => [...map.keys()].sort(),
    };
}

function install_storage() {
    const session = make_storage();
    const local = make_storage();
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: session });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: local });
    return { session, local };
}

function seed(storage, keys) {
    keys.forEach((key) => storage.setItem(key, 'value'));
}

/*
 * .js and .ejs sources under dir, skipping built copies (dist/).
 */
function source_files(dir) {
    return readdirSync(join(BACKEND_ROOT, dir), { recursive: true })
        .map((file) => join(dir, file))
        .filter((file) => /\.(js|ejs)$/.test(file) && !/(^|[\\/])dist[\\/]/.test(file));
}

describe('dashboard storage clearing', () => {

    beforeAll(() => {
        install_storage();
        globalThis.endpointsModule = {
            get_app_path: () => '/exhibits-dashboard',
            init: () => ({}),
        };
        const src = readFileSync(AUTH_MODULE_PATH, 'utf8');
        // eslint-disable-next-line no-eval
        (0, eval)(src.replace(/^const\s+authModule\s*=/m, 'globalThis.authModule ='));
    });

    it('authModule.clear() removes only the dashboard keys and keeps the sidebar preference', () => {
        const { session, local } = install_storage();
        seed(session, [...OWN_SESSION_KEYS, ...OTHER_APP_KEYS]);
        seed(local, [...OWN_LOCAL_KEYS, SIDEBAR_KEY, ...OTHER_APP_KEYS]);

        authModule.clear();

        expect(session.stored_keys()).toEqual([...OTHER_APP_KEYS].sort());
        expect(local.stored_keys()).toEqual([SIDEBAR_KEY, ...OTHER_APP_KEYS].sort());
        expect(session.clear).not.toHaveBeenCalled();
        expect(local.clear).not.toHaveBeenCalled();
    });

    it('authModule.clear() still clears localStorage when sessionStorage is blocked', () => {
        const { local } = install_storage();
        Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            get: () => { throw new Error('SecurityError'); },
        });
        seed(local, OWN_LOCAL_KEYS);
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => authModule.clear()).not.toThrow();
        expect(local.stored_keys()).toEqual([]);
    });

    it('the sign-in / session-expired partial removes the same session keys', () => {
        const { session } = install_storage();
        seed(session, [...OWN_SESSION_KEYS, ...OTHER_APP_KEYS]);

        const script = readFileSync(PARTIAL_PATH, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
        // eslint-disable-next-line no-eval
        (0, eval)(script);

        expect(session.stored_keys()).toEqual([...OTHER_APP_KEYS].sort());
        expect(session.clear).not.toHaveBeenCalled();
    });

    it.each(['auth-landing.ejs', 'dashboard-session-out.ejs'])('%s uses the partial', (view) => {
        const src = readFileSync(join(BACKEND_ROOT, 'views', view), 'utf8');

        expect(src).toContain("include('partials/clear-session-storage.ejs')");
    });

    it('no client module or view clears a whole storage area', () => {
        const offenders = [...source_files('public/app'), ...source_files('views')]
            .filter((file) => /\b(sessionStorage|localStorage)\.clear\(/.test(readFileSync(join(BACKEND_ROOT, file), 'utf8')));

        expect(offenders).toEqual([]);
    });
});
