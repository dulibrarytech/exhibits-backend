// @vitest-environment jsdom

/**
 * A missing session token sends the user to the sign-in page.
 *
 * APP_PATH (from endpointsModule.get_app_path()) is already
 * /exhibits-dashboard, so appending '/exhibits-dashboard/auth' redirected
 * to /exhibits-dashboard/exhibits-dashboard/auth, which is a 404. Covers
 * both modules that built the doubled path.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const APP_PATH = '/exhibits-dashboard';

let replace_mock;

function set_location(pathname) {
    replace_mock = vi.fn();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { pathname, replace: replace_mock },
    });
}

function install_globals(token) {
    const params = { exhibit_id: 'exhibit-1', item_id: 'item-1' };

    globalThis.endpointsModule = {
        get_app_path: () => APP_PATH,
        get_exhibits_endpoints: () => ({
            exhibits: {
                item_records: { get: { endpoint: '/api/items/:exhibit_id/:item_id' } },
                timeline_records: { get: { endpoint: '/api/timelines/:exhibit_id/:timeline_id' } },
            },
        }),
    };
    globalThis.helperModule = { get_parameter_by_name: (name) => params[name] ?? null };
    globalThis.authModule = {
        get_user_token: () => token,
        get_user_profile_data: () => ({ uid: '1' }),
        check_permissions: vi.fn().mockResolvedValue(true),
    };
    globalThis.httpModule = { req: vi.fn() };
    globalThis.domModule = { set_alert: vi.fn(), on: vi.fn() };
    globalThis.exhibitsModule = { set_exhibit_title: vi.fn() };
}

/*
 * Evaluates a client module (a top-level `const name = (function () {…}())`)
 * so it lands on globalThis, after its dependencies are stubbed.
 */
function load_module(relative_path, global_name) {
    const src = readFileSync(resolve(__dirname, '../../public/app', relative_path), 'utf8');
    const patched = src.replace(
        new RegExp(`^const\\s+${global_name}\\s*=`, 'm'),
        `globalThis.${global_name} =`,
    );
    // eslint-disable-next-line no-eval
    (0, eval)(patched);
    return globalThis[global_name];
}

describe('missing session token redirects to APP_PATH/auth', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        document.body.innerHTML = '<div id="message"></div>';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('vertical timeline details page', async () => {
        set_location(APP_PATH + '/items/vertical-timeline/details');
        install_globals(null);
        const timeline_module = load_module(
            'timeline-items/items.details.vertical.timeline.module.js',
            'itemsDetailsVerticalTimelineModule',
        );

        await timeline_module.init();
        await vi.advanceTimersByTimeAsync(3000);

        expect(replace_mock).toHaveBeenCalledWith(APP_PATH + '/auth');
        expect(globalThis.httpModule.req).not.toHaveBeenCalled();
    });

    it('standard item edit form', async () => {
        set_location(APP_PATH + '/items/standard/media/edit');
        /*
         * This module redirects only when get_user_token() returns exactly
         * false, so the stub returns false to reach that branch.
         */
        install_globals(false);
        const edit_module = load_module(
            'standard-items/items.edit.standard.item.form.module.js',
            'itemsEditStandardItemFormModule',
        );

        await edit_module.init();
        await vi.advanceTimersByTimeAsync(1000);

        expect(replace_mock).toHaveBeenCalledWith(APP_PATH + '/auth');
        expect(globalThis.httpModule.req).not.toHaveBeenCalled();
    });
});
