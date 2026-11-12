// @vitest-environment jsdom

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(__dirname, '../../public/app/utils/lock.module.js');
const TEMPLATE = '/exhibits-dashboard/api/v1/exhibits/:exhibit_id/grids/:grid_id/items/:item_id/unlock';
const UNLOCK_URL = '/exhibits-dashboard/api/v1/exhibits/exhibit-1/grids/grid-1/items/item-1/unlock';
const IDS = { exhibit_id: 'exhibit-1', grid_id: 'grid-1', item_id: 'item-1' };

describe('lockModule.release_grid_item', () => {

    beforeAll(() => {
        const src = readFileSync(MODULE_PATH, 'utf8');
        (0, eval)(src.replace(/^const\s+lockModule\s*=/m, 'globalThis.lockModule ='));
    });

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        globalThis.endpointsModule = {
            get_exhibits_endpoints: () => ({
                exhibits: { grid_item_unlock_record: { post: { endpoint: TEMPLATE } } },
            }),
        };
        globalThis.authModule = {
            get_user_profile_data: () => ({ uid: '7' }),
            get_user_token: () => 'secret-token',
        };
        globalThis.httpModule = { req: vi.fn(async () => ({ status: 200 })) };
        globalThis.fetch = vi.fn(async () => ({ ok: true }));
    });

    it('asks the server to release the named item, with the token in a header', async () => {
        const is_released = await lockModule.release_grid_item(IDS);

        expect(is_released).toBe(true);

        const request = globalThis.httpModule.req.mock.calls[0][0];

        expect(request.method).toBe('POST');
        expect(request.url).toBe(`${UNLOCK_URL}?uid=7`);
        expect(request.headers['x-access-token']).toBe('secret-token');
        expect(request.url).not.toContain('secret-token');
    });

    it('adds force when an administrator unlocks', async () => {
        await lockModule.release_grid_item(IDS, { force: true });

        expect(globalThis.httpModule.req.mock.calls[0][0].url).toBe(`${UNLOCK_URL}?uid=7&force=true`);
    });

    it('uses a request that outlives the page when asked, still without the token in the address', async () => {
        const is_released = await lockModule.release_grid_item(IDS, { keepalive: true });

        expect(is_released).toBe(true);
        expect(globalThis.httpModule.req).not.toHaveBeenCalled();
        expect(globalThis.fetch).toHaveBeenCalledWith(`${UNLOCK_URL}?uid=7`, {
            method: 'POST',
            headers: { 'x-access-token': 'secret-token' },
            keepalive: true,
        });
    });

    it('reports failure when the server refuses', async () => {
        globalThis.httpModule.req = vi.fn(async () => ({ status: 403 }));

        expect(await lockModule.release_grid_item(IDS)).toBe(false);
    });

    it('sends nothing without an item, a signed-in user or a token', async () => {
        expect(await lockModule.release_grid_item({ ...IDS, item_id: null })).toBe(false);

        globalThis.authModule.get_user_token = () => null;
        expect(await lockModule.release_grid_item(IDS)).toBe(false);

        globalThis.authModule.get_user_token = () => 'secret-token';
        globalThis.authModule.get_user_profile_data = () => null;
        expect(await lockModule.release_grid_item(IDS, { keepalive: true })).toBe(false);

        expect(globalThis.httpModule.req).not.toHaveBeenCalled();
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});
