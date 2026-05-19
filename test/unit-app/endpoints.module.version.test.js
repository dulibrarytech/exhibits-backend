// @vitest-environment jsdom

/**
 * Unit tests for the endpoints-registry version stamp.
 *
 * The client caches the server endpoint map in localStorage with no TTL;
 * after the server adds an endpoint, stale clients 404 until they
 * re-authenticate. A version mismatch on page load must wipe the stale
 * cache and route the client back through auth exactly once.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/utils/endpoints.module.js',
);

const APP_PATH = '/exhibits-dashboard';
const VERSION_KEY = 'exhibits_endpoints_version';
const GUARD_KEY = 'exhibits_endpoints_refresh_attempted';
const CURRENT_VERSION = '2';

const EP_KEYS = [
    'exhibits_endpoints_users',
    'exhibits_endpoints',
    'exhibits_endpoints_indexer',
    'exhibits_endpoints_media_library',
];

function seed_endpoints() {
    EP_KEYS.forEach((k) => window.localStorage.setItem(k, JSON.stringify({ x: { get: { endpoint: '/e' } } })));
}

function valid_save_payload() {
    const ep = { x: { get: { endpoint: '/e' } } };
    return { endpoints: { users: ep, exhibits: ep, indexer: ep, media_library: ep } };
}

let replaceMock;

function make_storage() {
    let map = {};
    return {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
        setItem: (k, v) => { map[k] = String(v); },
        removeItem: (k) => { delete map[k]; },
        clear: () => { map = {}; },
    };
}

function install_storage() {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: make_storage() });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: make_storage() });
}

function set_location(pathname) {
    replaceMock = vi.fn();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { pathname, replace: replaceMock },
    });
}

describe('endpointsModule — registry version stamp', () => {

    beforeAll(() => {
        // The module probes localStorage ONCE at load and caches the result;
        // jsdom's Storage is unreliable here, so install the deterministic
        // mock BEFORE eval so the probe sees a working store.
        install_storage();
        set_location('/exhibits-dashboard/items');

        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+endpointsModule\s*=/m,
            'globalThis.endpointsModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        install_storage();
        set_location('/exhibits-dashboard/items');
    });

    it('save_exhibits_endpoints stamps the current version and releases the guard', () => {
        window.sessionStorage.setItem(GUARD_KEY, '1');
        const ok = endpointsModule.save_exhibits_endpoints(valid_save_payload());
        expect(ok).toBe(true);
        expect(window.localStorage.getItem(VERSION_KEY)).toBe(CURRENT_VERSION);
        expect(window.sessionStorage.getItem(GUARD_KEY)).toBeNull();
    });

    it('init() leaves a fresh client (no cached endpoints) untouched', () => {
        endpointsModule.init();
        expect(replaceMock).not.toHaveBeenCalled();
        EP_KEYS.forEach((k) => expect(window.localStorage.getItem(k)).toBeNull());
    });

    it('init() leaves an up-to-date client (matching version) untouched', () => {
        seed_endpoints();
        window.localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
        endpointsModule.init();
        expect(replaceMock).not.toHaveBeenCalled();
        EP_KEYS.forEach((k) => expect(window.localStorage.getItem(k)).not.toBeNull());
    });

    it('init() wipes a stale/legacy registry and routes through auth once', () => {
        seed_endpoints(); // legacy: endpoints present, NO version key
        endpointsModule.init();

        EP_KEYS.forEach((k) => expect(window.localStorage.getItem(k)).toBeNull());
        expect(window.localStorage.getItem(VERSION_KEY)).toBeNull();
        expect(window.sessionStorage.getItem(GUARD_KEY)).toBe('1');
        expect(replaceMock).toHaveBeenCalledWith(APP_PATH + '/');
    });

    it('init() wipes a registry whose version differs from the current one', () => {
        seed_endpoints();
        window.localStorage.setItem(VERSION_KEY, '1');
        endpointsModule.init();
        expect(window.localStorage.getItem('exhibits_endpoints_media_library')).toBeNull();
        expect(replaceMock).toHaveBeenCalledWith(APP_PATH + '/');
    });

    it('does not redirect twice (one-shot guard already set)', () => {
        seed_endpoints();
        window.sessionStorage.setItem(GUARD_KEY, '1');
        endpointsModule.init();
        // Stale cache still wiped, but no second redirect.
        EP_KEYS.forEach((k) => expect(window.localStorage.getItem(k)).toBeNull());
        expect(replaceMock).not.toHaveBeenCalled();
    });

    it('does not redirect when already at the auth entry path', () => {
        set_location(APP_PATH + '/');
        seed_endpoints();
        endpointsModule.init();
        EP_KEYS.forEach((k) => expect(window.localStorage.getItem(k)).toBeNull());
        expect(replaceMock).not.toHaveBeenCalled();
    });
});
