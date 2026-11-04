'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridItemsApi,
    stubGridRecordApi,
    exhibitFixture,
    gridItemFixture,
    gridRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '660e8400-e29b-41d4-a716-446655440100';
const ITEM_UUID = '770e8400-e29b-41d4-a716-446655440200';

const ITEM_TYPES = [
    { item_type: 'image', path: 'media' },
    { item_type: 'text', path: 'text' },
    { item_type: 'content_block', path: 'content-block' },
];

const item_url = (path, page_name) => `${APP_PATH}/items/grid/item/${path}/${page_name}`
    + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`;

const menu_link = (page) => page.locator(`[id="${ITEM_UUID}-item-actions"] a.dropdown-item`).first();

async function open_grid_items(page, item_type, is_published) {
    await seedAuth(page);
    await stubDashboardDeps(page, {
        exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
    });
    await stubGridItemsApi(page, {
        exhibitId: EXHIBIT_UUID,
        gridId: GRID_UUID,
        items: [gridItemFixture({
            uuid: ITEM_UUID,
            item_type,
            content_type: 'quote',
            is_published,
            is_member_of_exhibit: EXHIBIT_UUID,
            is_member_of_grid: GRID_UUID,
        })],
    });
    await stubGridRecordApi(page, {
        exhibitId: EXHIBIT_UUID,
        record: gridRecordFixture({ uuid: GRID_UUID, columns: 3 }),
    });

    for (const action of ['publish', 'suppress']) {
        await page.route(
            `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/${action}/${GRID_UUID}/item/${ITEM_UUID}**`,
            (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
        );
    }

    await page.goto(`${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`);
    await expect(page.locator(`[id="${ITEM_UUID}"]`)).toBeVisible();
}

test.describe('Grid item links (items.list.displays.module.js, items.grid.module.js)', () => {

    for (const { item_type, path } of ITEM_TYPES) {

        test(`${item_type} row keeps its ${path} links through publish and unpublish`, async ({ page }) => {
            await open_grid_items(page, item_type, 0);

            await expect(menu_link(page)).toHaveAttribute('href', item_url(path, 'edit'));

            await page.locator(`[id="${ITEM_UUID}"].publish-item`).click();
            await expect(page.locator(`[id="${ITEM_UUID}"].suppress-item`)).toBeVisible();
            await expect(menu_link(page)).toHaveAttribute('href', item_url(path, 'details'));

            await page.locator(`[id="${ITEM_UUID}"].suppress-item`).click();
            await expect(page.locator(`[id="${ITEM_UUID}"].publish-item`)).toBeVisible();
            await expect(menu_link(page)).toHaveAttribute('href', item_url(path, 'edit'));
        });
    }

    test('a published image row opens the media details page', async ({ page }) => {
        await open_grid_items(page, 'image', 1);

        await expect(menu_link(page)).toHaveAttribute('href', item_url('media', 'details'));
    });
});
