// @vitest-environment jsdom
//
// Unit tests for public/app/utils/page.actions.module.js — the shared
// cancel-button / edit-button / delete-form bootstrap that replaced the
// per-page inline <script> copies. Loaded with the same read-and-eval
// convention as the other test/unit-app files (see helper.module.test.js).

'use strict';

const { load_browser_module } = require('./helpers/load_module');

const APP_PATH = '/exhibits-dashboard';

/* query-string values served by the helperModule stub */
let query_params = {};
let location_mock;

function set_location() {
    location_mock = { href: '', replace: vi.fn() };
    Object.defineProperty(window, 'location', { configurable: true, value: location_mock });
}

function install_stubs() {

    globalThis.helperModule = {
        get_parameter_by_name: vi.fn((name) => (Object.prototype.hasOwnProperty.call(query_params, name) ? query_params[name] : null)),
        show_form: vi.fn(),
    };
    globalThis.endpointsModule = { get_app_path: vi.fn(() => APP_PATH) };
    globalThis.domModule = { set_alert: vi.fn() };
    globalThis.authModule = { check_permissions: vi.fn(async () => true) };
    globalThis.exhibitsModule = { set_exhibit_title: vi.fn(async () => true) };
    globalThis.navModule = { wire_nav_links: vi.fn() };
}

describe('pageActionsModule', () => {

    beforeAll(() => {
        install_stubs();
        load_browser_module('public/app/utils/page.actions.module.js', 'pageActionsModule');
    });

    beforeEach(() => {
        install_stubs();
        set_location();
        query_params = { exhibit_id: 'ex-1', grid_id: 'grid-1', item_id: 'item-1' };
        document.body.innerHTML = '';
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('check_for_unsaved_changes', () => {

        it('is false when every field still holds its default value', () => {
            document.body.innerHTML = '<input id="a" value="x"><textarea id="b">t</textarea>';
            expect(globalThis.pageActionsModule.check_for_unsaved_changes()).toBe(false);
        });

        it('is true once a field differs from its default value', () => {
            document.body.innerHTML = '<input id="a" value="x">';
            document.getElementById('a').value = 'changed';
            expect(globalThis.pageActionsModule.check_for_unsaved_changes()).toBe(true);
        });
    });

    describe('wire_cancel_button', () => {

        const options = {
            redirect_path: '/items/grid/items',
            params: ['exhibit_id', 'grid_id'],
            confirm_message: 'Discard unsaved changes and return to the exhibit grid item list?',
        };

        it('returns false and does nothing when the button is absent', () => {
            expect(globalThis.pageActionsModule.wire_cancel_button(options)).toBe(false);
        });

        it('redirects to the list page with the carried-over params when nothing changed', () => {
            document.body.innerHTML = '<input id="a" value="x"><button id="cancel-exhibit-btn"></button>';
            const confirm_spy = vi.spyOn(window, 'confirm').mockReturnValue(false);

            expect(globalThis.pageActionsModule.wire_cancel_button(options)).toBe(true);
            document.getElementById('cancel-exhibit-btn').click();

            expect(confirm_spy).not.toHaveBeenCalled();
            expect(location_mock.href).toBe(`${APP_PATH}/items/grid/items?exhibit_id=ex-1&grid_id=grid-1`);
        });

        it('asks for confirmation when there are unsaved changes and stays when declined', () => {
            document.body.innerHTML = '<input id="a" value="x"><button id="cancel-exhibit-btn"></button>';
            document.getElementById('a').value = 'changed';
            const confirm_spy = vi.spyOn(window, 'confirm').mockReturnValue(false);

            globalThis.pageActionsModule.wire_cancel_button(options);
            document.getElementById('cancel-exhibit-btn').click();

            expect(confirm_spy).toHaveBeenCalledWith(options.confirm_message);
            expect(location_mock.href).toBe('');
        });

        it('redirects when the unsaved-changes confirmation is accepted', () => {
            document.body.innerHTML = '<input id="a" value="x"><button id="cancel-exhibit-btn"></button>';
            document.getElementById('a').value = 'changed';
            vi.spyOn(window, 'confirm').mockReturnValue(true);

            globalThis.pageActionsModule.wire_cancel_button(options);
            document.getElementById('cancel-exhibit-btn').click();

            expect(location_mock.href).toBe(`${APP_PATH}/items/grid/items?exhibit_id=ex-1&grid_id=grid-1`);
        });

        it('omits the query string when no params are requested and honours a custom selector', () => {
            document.body.innerHTML = '<button id="other-cancel"></button>';

            globalThis.pageActionsModule.wire_cancel_button({ redirect_path: '/exhibits', selector: '#other-cancel' });
            document.getElementById('other-cancel').click();

            expect(location_mock.href).toBe(`${APP_PATH}/exhibits`);
        });

        it('URL-encodes carried-over parameter values', () => {
            query_params = { exhibit_id: 'a b&c' };
            document.body.innerHTML = '<button id="cancel-exhibit-btn"></button>';

            globalThis.pageActionsModule.wire_cancel_button({ redirect_path: '/items', params: ['exhibit_id'] });
            document.getElementById('cancel-exhibit-btn').click();

            expect(location_mock.href).toBe(`${APP_PATH}/items?exhibit_id=a%20b%26c`);
        });
    });

    describe('wire_edit_button', () => {

        it('returns false when the button is absent', () => {
            expect(globalThis.pageActionsModule.wire_edit_button({ edit_path: '/items/grid/edit' })).toBe(false);
        });

        it('hides the content and replaces the location with the edit page', () => {
            document.body.innerHTML = '<main class="content"></main><button id="edit-item-btn"></button>';

            expect(globalThis.pageActionsModule.wire_edit_button({
                edit_path: '/items/grid/item/media/edit',
                params: ['exhibit_id', 'grid_id', 'item_id'],
            })).toBe(true);

            const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
            document.getElementById('edit-item-btn').dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
            expect(document.querySelector('.content').style.visibility).toBe('hidden');
            expect(location_mock.replace).toHaveBeenCalledWith(
                `${APP_PATH}/items/grid/item/media/edit?exhibit_id=ex-1&grid_id=grid-1&item_id=item-1`,
            );
        });

        it('serialises a missing parameter as "null" (legacy interpolation behaviour)', () => {
            query_params = { exhibit_id: 'ex-1' };
            document.body.innerHTML = '<button id="edit-item-btn"></button>';

            globalThis.pageActionsModule.wire_edit_button({ edit_path: '/items/heading/edit', params: ['exhibit_id', 'item_id'] });
            document.getElementById('edit-item-btn').click();

            expect(location_mock.replace).toHaveBeenCalledWith(`${APP_PATH}/items/heading/edit?exhibit_id=ex-1&item_id=null`);
        });
    });

    describe('init_delete_form', () => {

        const options = () => ({
            delete_path: '/items/grid/item/delete',
            url_params: ['exhibit_id', 'grid_id', 'item_id'],
            on_delete: vi.fn(),
            label: 'grid-items delete form',
        });

        it('shows the permission notice and rewrites the address on status=403 without fetching', async () => {
            query_params.status = '403';
            document.body.innerHTML = '<div id="message"></div><button id="delete-item-btn"></button>';
            const replace_state = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
            const opts = options();

            await expect(globalThis.pageActionsModule.init_delete_form(opts)).resolves.toBe(true);

            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith('#message', 'danger', 'You do not have permission to delete this item.');
            expect(replace_state).toHaveBeenCalledWith(
                { page: 'items' }, '', `${APP_PATH}/items/grid/item/delete?exhibit_id=ex-1&grid_id=grid-1&item_id=item-1`,
            );
            expect(globalThis.authModule.check_permissions).not.toHaveBeenCalled();
            expect(globalThis.exhibitsModule.set_exhibit_title).not.toHaveBeenCalled();
            expect(globalThis.helperModule.show_form).not.toHaveBeenCalled();
            expect(globalThis.navModule.wire_nav_links).toHaveBeenCalledTimes(1);

            document.getElementById('delete-item-btn').click();
            expect(opts.on_delete).not.toHaveBeenCalled();
        });

        it('checks permissions, sets the title, wires the delete handler and reveals the form', async () => {
            document.body.innerHTML = '<div id="message"></div><button id="delete-item-btn"></button>';
            const opts = options();

            await expect(globalThis.pageActionsModule.init_delete_form(opts)).resolves.toBe(true);

            expect(globalThis.authModule.check_permissions).toHaveBeenCalledWith(
                ['delete_item', 'delete_any_item'], 'item', 'ex-1', 'item-1',
                '/items/grid/item/delete?exhibit_id=ex-1&grid_id=grid-1&item_id=item-1&status=403',
            );
            expect(globalThis.exhibitsModule.set_exhibit_title).toHaveBeenCalledWith('ex-1');
            expect(globalThis.helperModule.show_form).toHaveBeenCalledTimes(1);
            expect(globalThis.navModule.wire_nav_links).toHaveBeenCalledTimes(1);
            expect(globalThis.domModule.set_alert).not.toHaveBeenCalled();

            document.getElementById('delete-item-btn').click();
            expect(opts.on_delete).toHaveBeenCalledTimes(1);
        });

        it('builds the standard-item URLs from exhibit_id only', async () => {
            document.body.innerHTML = '<div id="message"></div><button id="delete-item-btn"></button>';

            await globalThis.pageActionsModule.init_delete_form({
                delete_path: '/items/delete', url_params: ['exhibit_id'], on_delete: vi.fn(),
            });

            expect(globalThis.authModule.check_permissions).toHaveBeenCalledWith(
                ['delete_item', 'delete_any_item'], 'item', 'ex-1', 'item-1', '/items/delete?exhibit_id=ex-1&status=403',
            );
        });

        it('honours custom permissions and record type', async () => {
            document.body.innerHTML = '<div id="message"></div>';

            await globalThis.pageActionsModule.init_delete_form({
                delete_path: '/exhibits/delete', url_params: ['exhibit_id'],
                permissions: ['delete_exhibit'], record_type: 'exhibit',
            });

            expect(globalThis.authModule.check_permissions.mock.calls[0][0]).toEqual(['delete_exhibit']);
            expect(globalThis.authModule.check_permissions.mock.calls[0][1]).toBe('exhibit');
        });

        it('surfaces an init failure through domModule.set_alert and resolves false', async () => {
            document.body.innerHTML = '<div id="message"></div>';
            globalThis.exhibitsModule.set_exhibit_title.mockRejectedValue(new Error('title failed'));

            await expect(globalThis.pageActionsModule.init_delete_form(options())).resolves.toBe(false);

            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith('#message', 'danger', 'title failed');
            expect(console.error).toHaveBeenCalledWith('grid-items delete form init failed:', expect.any(Error));
            expect(globalThis.helperModule.show_form).not.toHaveBeenCalled();
        });
    });
});
