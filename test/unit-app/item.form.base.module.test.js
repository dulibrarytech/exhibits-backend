// @vitest-environment jsdom
//
// Unit tests for public/app/utils/item.form.base.module.js — the
// config-driven base behind the add / edit / details forms of the four
// item families.
//
// Covers the parts the six-copies-per-skeleton forms used to repeat and
// that the e2e specs only reach indirectly: endpoint + id resolution per
// record type, the GET query shape (`type=edit&uid=` vs `type=details`
// vs none), the audit line, the lock trio, collect-before-announce on
// save, the create redirect, and the read-only sweep.

'use strict';

const { load_browser_module } = require('./helpers/load_module');

/* Endpoint registry shaped like the real generated one, for the record
 * types the tests exercise. */
const ENDPOINTS = {
    exhibits: {
        heading_records: {
            get: { endpoint: '/api/v1/exhibits/:exhibit_id/headings/:heading_id' },
            post: { endpoint: '/api/v1/exhibits/:exhibit_id/headings' },
            put: { endpoint: '/api/v1/exhibits/:exhibit_id/headings/:heading_id' },
        },
        grid_records: {
            get: { endpoint: '/api/v1/exhibits/:exhibit_id/grids/:grid_id' },
            post: { endpoint: '/api/v1/exhibits/:exhibit_id/grids' },
            put: { endpoint: '/api/v1/exhibits/:exhibit_id/grids/:grid_id' },
        },
        grid_item_record: {
            get: { endpoint: '/api/v1/exhibits/:exhibit_id/grids/:grid_id/items/:item_id' },
        },
        grid_item_records: {
            post: { endpoint: '/api/v1/exhibits/:exhibit_id/grids/:grid_id/items' },
            put: { endpoint: '/api/v1/exhibits/:exhibit_id/grids/:grid_id/items/:item_id' },
        },
        item_records: {
            get: { endpoint: '/api/v1/exhibits/:exhibit_id/items/:item_id' },
            post: { endpoint: '/api/v1/exhibits/:exhibit_id/items' },
            put: { endpoint: '/api/v1/exhibits/:exhibit_id/items/:item_id' },
        },
    },
};

let url_params = {};
let api_calls = [];
let api_responses = [];

function build_page() {
    document.body.innerHTML = `
        <div id="message"></div>
        <div id="created"></div>
        <input type="text" id="plain-field" value="" />
        <button type="button" id="edit-item-btn">Edit</button>
        <button type="button" id="pick-item-media-btn">Pick</button>
        <div id="item-submit-card"><button type="submit" id="save-item-btn">Save</button></div>
    `;
}

function stub_globals() {

    url_params = { exhibit_id: 'E1', item_id: 'I1', grid_id: 'G1' };
    api_calls = [];
    api_responses = [];

    globalThis.helperModule = {
        get_parameter_by_name: (name) => (name in url_params ? url_params[name] : null),
        get_user_name: () => 'tester',
        get_owner: () => 7,
        unescape: (value) => value,
        format_date: (date) => new Date(date).toISOString().slice(0, 10),
        clear_status_message: vi.fn(),
        render_record_meta: vi.fn(() => true),
    };

    globalThis.domModule = {
        set_alert: vi.fn(),
        set_value: vi.fn(),
        on: vi.fn(),
    };

    globalThis.endpointsModule = {
        get_exhibits_endpoints: () => ENDPOINTS,
        get_app_path: () => '/exhibits-dashboard',
        build: (template, params) => {
            let out = template;
            for (const [key, value] of Object.entries(params || {})) {
                if (value === undefined || value === null || value === '') return null;
                out = out.split(`:${key}`).join(encodeURIComponent(value));
            }
            return out;
        },
    };

    globalThis.authModule = {
        get_user_profile_data: () => ({ uid: 42 }),
        check_permissions: vi.fn(async () => true),
    };

    globalThis.lockModule = {
        check_if_locked: vi.fn(async () => {}),
        is_locked_by_other_user: vi.fn(() => false),
        is_user_administrator: vi.fn(async () => false),
        disable_form_fields: vi.fn(),
        setup_auto_unlock: vi.fn(),
    };

    globalThis.exhibitsModule = { set_exhibit_title: vi.fn(async () => {}) };
    globalThis.rteModule = { set_all_enabled: vi.fn() };

    globalThis.httpModule = {
        api: vi.fn(async (options) => {
            api_calls.push(options);
            return api_responses.length ? api_responses.shift() : { status: 200, data: { data: {} } };
        }),
    };
}

describe('itemFormBaseModule', () => {

    beforeAll(() => {
        load_browser_module('public/app/utils/item.form.base.module.js', 'itemFormBaseModule');
    });

    beforeEach(() => {
        vi.useFakeTimers();
        stub_globals();
        build_page();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('create', () => {

        it('rejects an unknown record type', () => {
            expect(() => itemFormBaseModule.create({ record_type: 'nope', mode: 'edit' }))
                .toThrow(/unknown record_type/);
        });
    });

    describe('get_record', () => {

        it('maps the page item_id onto the type\'s own endpoint placeholder', async () => {
            const form = itemFormBaseModule.create({ record_type: 'heading', mode: 'edit' });

            await form.get_record();

            /* the heading endpoint's :heading_id is fed from the page's item_id */
            expect(api_calls[0].url).toBe('/api/v1/exhibits/E1/headings/I1?type=edit&uid=42');
        });

        it('carries every parent id for a nested type', async () => {
            const form = itemFormBaseModule.create({ record_type: 'grid_item', mode: 'edit' });

            await form.get_record();

            expect(api_calls[0].url).toBe('/api/v1/exhibits/E1/grids/G1/items/I1?type=edit&uid=42');
        });

        it('requests type=details and no uid in details mode', async () => {
            const form = itemFormBaseModule.create({ record_type: 'heading', mode: 'details' });

            await form.get_record();

            expect(api_calls[0].url).toBe('/api/v1/exhibits/E1/headings/I1?type=details');
        });

        it('sends no query at all when the form opts out (container forms)', async () => {
            const form = itemFormBaseModule.create({
                record_type: 'grid',
                mode: 'edit',
                query: { type: null, uid: false },
            });

            await form.get_record();

            expect(api_calls[0].url).toBe('/api/v1/exhibits/E1/grids/I1');
        });

        it('reports a missing id without calling the API', async () => {
            delete url_params.item_id;
            const form = itemFormBaseModule.create({ record_type: 'heading', mode: 'edit' });

            const record = await form.get_record();

            expect(record).toBeNull();
            expect(httpModule.api).not.toHaveBeenCalled();
            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'danger', 'Missing required parameters: exhibit_id or item_id',
            );
        });

        it('rejects an over-long id', async () => {
            url_params.item_id = 'x'.repeat(256);
            const form = itemFormBaseModule.create({ record_type: 'heading', mode: 'edit' });

            expect(await form.get_record()).toBeNull();
            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'danger', 'Invalid parameter length',
            );
        });

        it('leaves the session-expired alert in place when the token is missing', async () => {
            api_responses = [null];
            const form = itemFormBaseModule.create({ record_type: 'heading', mode: 'edit' });

            expect(await form.get_record()).toBeNull();
            expect(domModule.set_alert).not.toHaveBeenCalled();
        });

        it('reports a non-200 with the type-specific load message', async () => {
            api_responses = [{ status: 500, data: {} }];
            const form = itemFormBaseModule.create({ record_type: 'grid', mode: 'edit' });

            expect(await form.get_record()).toBeNull();
            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'danger', 'Unable to load the grid record. Please try again.',
            );
        });
    });

    describe('display_record', () => {

        it('renders the audit line and runs the type\'s populate hook', async () => {
            const record = { uuid: 'I1', created_by: 'tester', created: '2026-01-01' };
            api_responses = [{ status: 200, data: { data: record } }];
            const populate = vi.fn();

            const form = itemFormBaseModule.create({
                record_type: 'heading', mode: 'edit', populate,
            });

            await form.display_record();

            expect(helperModule.render_record_meta).toHaveBeenCalledWith('#created', record);
            expect(populate).toHaveBeenCalledWith(record);
        });

        it('runs the lock trio when the form declares a lock card', async () => {
            api_responses = [{ status: 200, data: { data: { is_locked: 1 } } }];
            lockModule.is_locked_by_other_user.mockReturnValue(true);

            const form = itemFormBaseModule.create({
                record_type: 'heading',
                mode: 'edit',
                lock: { card_selector: '#item-submit-card' },
            });

            await form.display_record();

            expect(lockModule.check_if_locked).toHaveBeenCalledWith({ is_locked: 1 }, '#item-submit-card');
            expect(lockModule.disable_form_fields).toHaveBeenCalled();
            expect(lockModule.setup_auto_unlock).toHaveBeenCalled();
        });

        it('skips the lock trio entirely for container forms (lock: false)', async () => {
            api_responses = [{ status: 200, data: { data: {} } }];

            const form = itemFormBaseModule.create({
                record_type: 'grid', mode: 'edit', lock: false,
            });

            await form.display_record();

            expect(lockModule.check_if_locked).not.toHaveBeenCalled();
            expect(lockModule.setup_auto_unlock).not.toHaveBeenCalled();
        });

        it('does not overwrite the loader\'s alert when the record cannot be read', async () => {
            api_responses = [{ status: 404, data: {} }];
            const populate = vi.fn();

            const form = itemFormBaseModule.create({
                record_type: 'heading', mode: 'edit', populate,
            });

            expect(await form.display_record()).toBe(false);
            expect(populate).not.toHaveBeenCalled();
            expect(domModule.set_alert).toHaveBeenCalledTimes(1);
            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'danger', 'Unable to load the heading record. Please try again.',
            );
        });

        it('makes the page read-only when disable_fields is set', async () => {
            api_responses = [{ status: 200, data: { data: {} } }];

            const form = itemFormBaseModule.create({
                record_type: 'heading', mode: 'details', disable_fields: true,
            });

            await form.display_record();

            expect(document.querySelector('#plain-field').disabled).toBe(true);
            /* the Edit button is the one control a details page keeps */
            expect(document.querySelector('#edit-item-btn').disabled).toBe(false);
            expect(document.querySelector('#pick-item-media-btn').style.display).toBe('none');
            expect(rteModule.set_all_enabled).toHaveBeenCalledWith(false);
        });
    });

    describe('submit_record — edit mode', () => {

        function edit_form(collect, overrides = {}) {
            return itemFormBaseModule.create(Object.assign({
                record_type: 'heading',
                mode: 'edit',
                collect,
                populate: () => {},
            }, overrides));
        }

        it('PUTs the collected fields with updated_by attached', async () => {
            api_responses = [
                { status: 201, data: { data: 'I1' } },
                { status: 200, data: { data: {} } },
            ];

            const form = edit_form(() => ({ text: 'hello' }));
            expect(await form.submit_record()).toBe(true);

            expect(api_calls[0]).toMatchObject({
                method: 'PUT',
                url: '/api/v1/exhibits/E1/headings/I1',
                data: { text: 'hello', updated_by: 'tester' },
            });
            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'success', 'Heading record updated successfully',
            );
        });

        it('collects before announcing, so a rejected form leaves no progress alert', async () => {
            const form = edit_form(() => false);

            expect(await form.submit_record()).toBe(false);
            expect(httpModule.api).not.toHaveBeenCalled();
            expect(domModule.set_alert).not.toHaveBeenCalled();
        });

        it('uses the record type\'s own success wording where it differs', async () => {
            api_responses = [
                { status: 201, data: { data: 'I1' } },
                { status: 200, data: { data: {} } },
            ];

            const form = edit_form(() => ({ text: 'x' }), {
                record_type: 'grid',
                query: { type: null, uid: false },
                lock: false,
            });

            await form.submit_record();

            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'success', 'Grid record updated',
            );
        });

        it('refuses a second submit while the first is in flight', async () => {
            api_responses = [
                { status: 201, data: { data: 'I1' } },
                { status: 200, data: { data: {} } },
            ];

            const form = edit_form(() => ({ text: 'x' }));
            const first = form.submit_record();
            const second = await form.submit_record();

            await first;

            expect(second).toBe(false);
        });

        it('surfaces a non-201 as a danger alert', async () => {
            api_responses = [{ status: 500, data: {} }];

            const form = edit_form(() => ({ text: 'x' }));

            expect(await form.submit_record()).toBe(false);
            expect(domModule.set_alert).toHaveBeenLastCalledWith(
                expect.anything(), 'danger', 'Failed to update heading record',
            );
        });
    });

    describe('submit_record — add mode', () => {

        function add_form(collect, overrides = {}) {
            return itemFormBaseModule.create(Object.assign({
                record_type: 'heading',
                mode: 'add',
                collect,
            }, overrides));
        }

        it('POSTs with created_by and owner, then replaces the page with the edit form', async () => {
            delete url_params.item_id;
            api_responses = [{ status: 201, data: { data: 'NEW' } }];

            const replace = vi.fn();
            Object.defineProperty(window, 'location', {
                value: { pathname: '/items/heading/add', replace },
                writable: true,
            });

            const form = add_form(() => ({ text: 'hi' }));
            expect(await form.submit_record()).toBe(true);

            expect(api_calls[0]).toMatchObject({
                method: 'POST',
                url: '/api/v1/exhibits/E1/headings',
                data: { text: 'hi', created_by: 'tester', owner: 7 },
            });

            vi.runAllTimers();

            expect(replace).toHaveBeenCalledWith(
                '/exhibits-dashboard/items/heading/edit?exhibit_id=E1&item_id=NEW',
            );
        });

        it('carries the parent ids into the redirect for a nested type', async () => {
            delete url_params.item_id;
            api_responses = [{ status: 201, data: { data: 'NEW' } }];

            const replace = vi.fn();
            Object.defineProperty(window, 'location', {
                value: { pathname: '/items/grid/item/media/add', replace },
                writable: true,
            });

            const form = add_form(() => ({ text: 'hi' }), { record_type: 'grid_item' });
            await form.submit_record();
            vi.runAllTimers();

            expect(replace).toHaveBeenCalledWith(
                '/exhibits-dashboard/items/grid/item/media/edit?exhibit_id=E1&grid_id=G1&item_id=NEW',
            );
        });

        it('refuses to create when the page already carries an item_id', async () => {
            const form = add_form(() => ({ text: 'hi' }));

            expect(await form.submit_record()).toBe(false);
            expect(httpModule.api).not.toHaveBeenCalled();
            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'warning', 'Already in edit mode.',
            );
        });

        it('reports a missing parent id with the type\'s own wording', async () => {
            delete url_params.item_id;
            delete url_params.grid_id;

            const form = add_form(() => ({ text: 'hi' }), { record_type: 'grid_item' });

            expect(await form.submit_record()).toBe(false);
            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'warning',
                'Missing exhibit ID or grid ID. Cannot create grid item record.',
            );
        });

        it('reports a permission problem when no response comes back', async () => {
            delete url_params.item_id;
            api_responses = [undefined];

            const form = add_form(() => ({ text: 'hi' }));

            expect(await form.submit_record()).toBe(false);
            expect(domModule.set_alert).toHaveBeenLastCalledWith(
                expect.anything(), 'danger',
                'Permission denied. You do not have access to add items to this exhibit.',
            );
        });
    });

    describe('init', () => {

        it('gates on permissions, sets the exhibit title, paints, then binds', async () => {
            api_responses = [{ status: 200, data: { data: {} } }];

            const form = itemFormBaseModule.create({
                record_type: 'heading',
                mode: 'edit',
                populate: () => {},
                submit_selector: '#save-item-btn',
                permissions: ['update_item'],
                redirect_path: (ids) => `/x?exhibit_id=${ids.exhibit_id}&item_id=${ids.record_id}`,
            });

            await form.init();

            expect(authModule.check_permissions).toHaveBeenCalledWith(
                ['update_item'], 'heading', 'E1', 'I1', '/x?exhibit_id=E1&item_id=I1',
            );
            expect(exhibitsModule.set_exhibit_title).toHaveBeenCalledWith('E1');
            expect(domModule.on).toHaveBeenCalledWith('#save-item-btn', 'click', form.submit_record);
        });

        it('passes a null record id to the permission check on an add form', async () => {
            const form = itemFormBaseModule.create({
                record_type: 'heading',
                mode: 'add',
                collect: () => ({}),
                permissions: ['add_item'],
                redirect_path: '/items',
            });

            await form.init();

            expect(authModule.check_permissions).toHaveBeenCalledWith(
                ['add_item'], 'heading', 'E1', null, '/items',
            );
            expect(httpModule.api).not.toHaveBeenCalled();
        });

        it('renders the permission-denied banner from ?status=403', async () => {
            url_params.status = '403';
            api_responses = [{ status: 200, data: { data: {} } }];

            const form = itemFormBaseModule.create({
                record_type: 'heading',
                mode: 'details',
                populate: () => {},
                show_denied_banner: true,
            });

            await form.init();

            expect(domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'danger', 'You do not have permission to edit this record.',
            );
        });
    });
});
