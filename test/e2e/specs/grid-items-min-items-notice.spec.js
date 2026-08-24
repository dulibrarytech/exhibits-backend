'use strict';

/*
 * Grid items list — minimum-items advisory.
 *
 * A grid must hold at least one full row (items >= columns) before it can
 * be published; the server refuses to publish it otherwise (grid_model).
 * The list page warns ahead of time via a polite live region
 * (#grid-min-items-status) so staff see the shortfall while adding items,
 * not first at a failed publish.
 */

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

function grid_items(count) {
    const items = [];
    for (let i = 1; i <= count; i++) {
        items.push(gridItemFixture({
            uuid: `g${i}`, order: i, title: `Item ${i}`,
            is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
        }));
    }
    return items;
}

async function open_grid_items_page(page, { columns, items }) {
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
        record: gridRecordFixture({ uuid: GRID_UUID, columns }),
    });

    await page.goto(
        `${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
    );
}

test.describe('Grid items — minimum-items advisory', () => {

    test('warns with counts and remedies when items fall short of columns', async ({ page }) => {
        await open_grid_items_page(page, { columns: 4, items: grid_items(1) });

        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(1);

        const status = page.locator('#grid-min-items-status');
        await expect(status).toHaveAttribute('role', 'status');
        await expect(status.locator('.alert-warning')).toContainText('This grid is set to 4 columns');
        await expect(status.locator('.alert-warning')).toContainText('1 of 4 added');
        await expect(status.locator('.alert-warning')).toContainText('Add 3 more grid items');
        await expect(status.locator('.alert-warning')).toContainText('reduce the number of columns');
    });

    test('shows no advisory when the item count meets the column count', async ({ page }) => {
        await open_grid_items_page(page, { columns: 2, items: grid_items(2) });

        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(2);
        await expect(page.locator('#grid-min-items-status .alert-warning')).toHaveCount(0);
    });

    test('warns on an empty grid alongside the "Grid is empty." message', async ({ page }) => {
        await open_grid_items_page(page, { columns: 3, items: [] });

        await expect(page.locator('#message')).toContainText('Grid is empty.');
        await expect(page.locator('#grid-min-items-status .alert-warning')).toContainText('0 of 3 added');
        await expect(page.locator('#grid-min-items-status .alert-warning')).toContainText('Add 3 more grid items');
    });
});
