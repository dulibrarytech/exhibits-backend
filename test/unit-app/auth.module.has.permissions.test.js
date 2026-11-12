// @vitest-environment jsdom

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(__dirname, '../../public/app/utils/auth.module.js');
const PERMISSIONS = ['update_item', 'update_any_item'];

function make_storage(entries = {}) {
    const map = new Map(Object.entries(entries));
    return {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => { map.set(key, String(value)); },
        removeItem: (key) => { map.delete(key); },
    };
}

describe('authModule.has_permissions', () => {

    beforeAll(() => {
        Object.defineProperty(window, 'sessionStorage', { configurable: true, value: make_storage() });
        Object.defineProperty(window, 'localStorage', { configurable: true, value: make_storage() });
        globalThis.endpointsModule = {
            get_app_path: () => '/exhibits-dashboard',
            init: () => ({}),
        };
        const src = readFileSync(MODULE_PATH, 'utf8');
        (0, eval)(src.replace(/^const\s+authModule\s*=/m, 'globalThis.authModule ='));
    });

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(globalThis.authModule, 'get_user_token').mockReturnValue('secret-token');
        globalThis.httpModule = { req: vi.fn(async () => ({ status: 200 })) };
    });

    it('asks the server and answers yes on 200', async () => {
        const is_allowed = await authModule.has_permissions(PERMISSIONS, 'grid_item', 'exhibit-1', 'item-1');

        expect(is_allowed).toBe(true);

        const request = globalThis.httpModule.req.mock.calls[0][0];

        expect(request.method).toBe('POST');
        expect(request.url).toBe('/exhibits-dashboard/auth/permissions');
        expect(request.headers['x-access-token']).toBe('secret-token');
        expect(request.data).toEqual({
            permissions: PERMISSIONS,
            record_type: 'grid_item',
            parent_id: 'exhibit-1',
            child_id: 'item-1',
        });
    });

    it('sends no child id when there is none', async () => {
        await authModule.has_permissions(['add_item'], 'grid_item', 'exhibit-1', null);

        expect(globalThis.httpModule.req.mock.calls[0][0].data.child_id).toBeNull();
    });

    it.each([401, 403, 404, 500])('answers no on %i and leaves the page where it is', async (status) => {
        globalThis.httpModule.req = vi.fn(async () => ({ status }));
        const address = window.location.href;

        expect(await authModule.has_permissions(PERMISSIONS, 'grid', 'exhibit-1', 'grid-1')).toBe(false);
        expect(window.location.href).toBe(address);
    });

    it('answers no without a token and without asking the server', async () => {
        globalThis.authModule.get_user_token.mockReturnValue(false);

        expect(await authModule.has_permissions(PERMISSIONS, 'grid', 'exhibit-1', 'grid-1')).toBe(false);
        expect(globalThis.httpModule.req).not.toHaveBeenCalled();
    });

    it('answers no when the request fails', async () => {
        globalThis.httpModule.req = vi.fn(async () => {
            throw new Error('network down');
        });

        expect(await authModule.has_permissions(PERMISSIONS, 'grid', 'exhibit-1', 'grid-1')).toBe(false);
    });
});
