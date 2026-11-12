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

const ITEM_TYPES = ['image', 'text', 'content_block'];

const actions_cell = (page) => page.locator(`[id="${ITEM_UUID}-item-actions"]`);
const menu_link = (page) => actions_cell(page).locator('a.dropdown-item').first();

async function open_grid_items(page, item_type, is_published) {
    const items = [gridItemFixture({
        uuid: ITEM_UUID,
        item_type,
        content_type: 'quote',
        is_published,
        is_member_of_exhibit: EXHIBIT_UUID,
        is_member_of_grid: GRID_UUID,
    })];

    await seedAuth(page);
    await stubDashboardDeps(page, {
        exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
    });
    await stubGridItemsApi(page, {
        exhibitId: EXHIBIT_UUID,
        gridId: GRID_UUID,
        items,
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

    return items;
}

test.describe('Grid item row actions (items.list.displays.module.js, items.grid.module.js)', () => {

    for (const item_type of ITEM_TYPES) {

        test(`${item_type} row offers Edit until it is published and Details after`, async ({ page }) => {
            const items = await open_grid_items(page, item_type, 0);

            await expect(menu_link(page)).toHaveAttribute('data-action', 'edit-item');
            await expect(menu_link(page)).toContainText('Edit');

            items[0].is_published = 1;
            await page.locator(`[id="${ITEM_UUID}"].publish-item`).click();
            await expect(page.locator(`[id="${ITEM_UUID}"].suppress-item`)).toBeVisible();
            await expect(menu_link(page)).toHaveAttribute('data-action', 'details-item');
            await expect(menu_link(page)).toContainText('Details');
            await expect(actions_cell(page).locator('[data-action="move-up"], [data-action="move-down"]')).toHaveCount(2);

            items[0].is_published = 0;
            await page.locator(`[id="${ITEM_UUID}"].suppress-item`).click();
            await expect(page.locator(`[id="${ITEM_UUID}"].publish-item`)).toBeVisible();
            await expect(menu_link(page)).toHaveAttribute('data-action', 'edit-item');
            await expect(actions_cell(page).locator('[data-action="delete-item"]')).toHaveCount(1);
        });
    }

    test('a published row offers Details and no Delete action', async ({ page }) => {
        await open_grid_items(page, 'image', 1);

        await expect(menu_link(page)).toHaveAttribute('data-action', 'details-item');
        await expect(actions_cell(page).locator('[data-action="delete-item"]')).toHaveCount(0);
        await expect(actions_cell(page).locator('a.dropdown-item.disabled')).toContainText('Delete');
    });

    test('a refused publish is explained above the list, which stays in view', async ({ page }) => {
        await open_grid_items(page, 'text', 0);
        await page.route(
            `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/publish/${GRID_UUID}/item/${ITEM_UUID}**`,
            (route) => route.fulfill({
                status: 422,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Publish the grid before its items.' }),
            })
        );

        await page.locator(`[id="${ITEM_UUID}"].publish-item`).click();

        await expect(page.locator('#grid-items-message .alert-warning')).toContainText('Publish the grid before its items.');
        await expect(page.locator('#grid-items-message .alert-warning')).toBeInViewport({ ratio: 1 });
        await expect(page.locator(`[id="${ITEM_UUID}"].publish-item`)).toBeInViewport();
        await expect(page.locator('#message')).toBeEmpty();
    });

    test('no row links to a separate item page', async ({ page }) => {
        await open_grid_items(page, 'text', 0);

        await expect(page.locator('#grid-items a[href*="/items/grid/item/"]')).toHaveCount(0);
        await expect(page.locator(`#grid-items .item-title-link`)).toHaveAttribute('data-action', 'details-item');
    });
});
