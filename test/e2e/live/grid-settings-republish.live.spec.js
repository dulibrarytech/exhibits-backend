'use strict';

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const {
    APP_PATH,
    role_headers,
    apiCreateExhibit,
    apiCreateGrid,
    apiCreateGridItem,
    apiDeleteExhibit,
    apiSuppressExhibit,
    apiGet
} = require('./fixtures/live-api');

const API = `${APP_PATH}/api/v1`;

test.describe('Published grid settings (live)', () => {

    let exhibit_uuid = null;
    let first_grid_uuid = null;
    let first_grid_as_published = null;
    let grid_uuid = null;
    let late_item_uuid = null;
    let stamp = null;

    const headers = () => role_headers('administrator');

    const indexed_grid = async (request, uuid = grid_uuid) => {
        const res = await request.get(`/api/v1/indexer/${uuid}`, { headers: headers() });

        if (res.status() !== 200) {
            return null;
        }

        return (await res.json())?.source ?? null;
    };

    const saved_grid = async (request) => JSON.parse(
        (await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}`)).body
    ).data;

    const saved_item = async (request, item_uuid) => JSON.parse(
        (await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${item_uuid}`)).body
    ).data;

    const open_for_editing = async (page) => {
        await page.goto(`${APP_PATH}/items/grid/items?exhibit_id=${exhibit_uuid}&grid_id=${grid_uuid}`);
        await expect(page.locator('#grid-text-input .ql-editor'))
            .toHaveText(new RegExp(`grid-original-${stamp}`), { timeout: 10_000 });
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(4);
        await page.click('#edit-grid-btn');
        await expect(page.locator('#save-item-btn')).toBeVisible();
    };

    const save_and_wait = async (page) => {
        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${API}/exhibits/${exhibit_uuid}/grids/${grid_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#save-item-btn');

        return (await put_response).status();
    };

    test.beforeEach(async ({ context, page, request }) => {
        await loginAs(context, page, 'administrator');

        stamp = `${Date.now()}-${test.info().workerIndex}`;
        exhibit_uuid = await apiCreateExhibit(request, `pw2-grid-settings-${stamp}`);
        first_grid_uuid = await apiCreateGrid(request, exhibit_uuid, `grid-first-${stamp}`, 2);
        grid_uuid = await apiCreateGrid(request, exhibit_uuid, `grid-original-${stamp}`, 3);

        for (const name of ['one', 'two']) {
            await apiCreateGridItem(request, exhibit_uuid, first_grid_uuid, `first-${name}-${stamp}`);
        }

        for (const name of ['one', 'two', 'three']) {
            await apiCreateGridItem(request, exhibit_uuid, grid_uuid, `published-${name}-${stamp}`);
        }

        const published = await request.post(`${API}/exhibits/${exhibit_uuid}/publish`, { headers: headers() });
        expect(published.status()).toBe(200);
        await expect.poll(async () => (await indexed_grid(request))?.items?.length ?? 0, { timeout: 15_000 }).toBe(3);
        await expect.poll(
            async () => (await indexed_grid(request, first_grid_uuid))?.items?.length ?? 0,
            { timeout: 15_000 }
        ).toBe(2);

        first_grid_as_published = await indexed_grid(request, first_grid_uuid);
        expect(JSON.stringify(first_grid_as_published.items)).toContain(`first-one-${stamp}`);

        late_item_uuid = await apiCreateGridItem(request, exhibit_uuid, grid_uuid, `unpublished-late-${stamp}`);
    });

    test.afterEach(async ({ request }) => {
        await apiSuppressExhibit(request, exhibit_uuid);
        await apiDeleteExhibit(request, exhibit_uuid);
        exhibit_uuid = null;
    });

    test('saved text and columns reach the search index, and no item is published by the save', async ({ page, request }) => {
        const as_published = await indexed_grid(request);

        await open_for_editing(page);

        await page.fill('#grid-text-input .ql-editor', `grid-changed-${stamp}`);
        await page.selectOption('#grid-columns', '2');

        expect(await save_and_wait(page)).toBe(201);

        await expect.poll(async () => (await indexed_grid(request))?.text ?? '', { timeout: 15_000 })
            .toContain(`grid-changed-${stamp}`);

        const indexed = await indexed_grid(request);

        expect(Number(indexed.columns)).toBe(2);
        expect(indexed.items).toHaveLength(3);
        expect(indexed.items).toEqual(as_published.items);
        expect(Object.keys(indexed).sort()).toEqual(Object.keys(as_published).sort());
        expect(JSON.stringify(indexed.items)).not.toContain(`unpublished-late-${stamp}`);
        expect((await saved_item(request, late_item_uuid)).is_published).toBe(0);
        expect(await indexed_grid(request, first_grid_uuid)).toEqual(first_grid_as_published);
    });

    test('columns cannot be raised above the published items until one more is published', async ({ page, request }) => {
        await open_for_editing(page);

        await page.selectOption('#grid-columns', '4');

        expect(await save_and_wait(page)).toBe(422);
        await expect(page.locator('#message')).toContainText(
            'This grid is published and has 3 published items. '
            + 'Publish more of its items before changing it to 4 columns.'
        );
        await expect(page.locator('#grid-columns')).toHaveAttribute('aria-invalid', 'true');
        expect((await saved_grid(request)).columns).toBe(3);
        expect(Number((await indexed_grid(request)).columns)).toBe(3);

        const published_item = await request.post(
            `${API}/exhibits/${exhibit_uuid}/publish/${grid_uuid}/item/${late_item_uuid}?type=grid_item`,
            { headers: headers() }
        );
        expect(published_item.status()).toBe(200);

        expect(await save_and_wait(page)).toBe(201);

        await expect.poll(async () => Number((await indexed_grid(request))?.columns), { timeout: 15_000 }).toBe(4);
        expect((await indexed_grid(request)).items).toHaveLength(4);
        expect((await saved_grid(request)).columns).toBe(4);
        expect(await indexed_grid(request, first_grid_uuid)).toEqual(first_grid_as_published);
    });
});
