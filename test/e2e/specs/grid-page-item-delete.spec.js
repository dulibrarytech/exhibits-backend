'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridRecordApi,
    stubGridItemsApi,
    stubGridItemRecordApi,
    exhibitFixture,
    gridRecordFixture,
    gridItemFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const GRID_PAGE_URL = `${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`;
const ITEM_IDS = [
    '880e8400-e29b-41d4-a716-446655440201',
    '880e8400-e29b-41d4-a716-446655440202',
    '880e8400-e29b-41d4-a716-446655440203',
    '880e8400-e29b-41d4-a716-446655440204',
];

const REDUCE_COLUMNS = 'Grids cannot contain less items than there are columns. Reduce the amount of columns to delete items.';
const ADD_ITEMS = 'Grids cannot contain less items than there are columns. Add more items before deleting this one, or delete the whole grid.';

const delete_modal = (page) => page.locator('#grid-item-delete-modal');
const row_menu = (page, item_id) => page.locator(`[id="${item_id}-item-actions"] .item-actions-toggle`);

function grid_items(count) {
    return ITEM_IDS.slice(0, count).map((uuid, index) => gridItemFixture({
        uuid, order: index + 1, title: `Item ${index + 1}`,
        is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
    }));
}

async function open_grid_page(page, { columns, count, item_api = {} }) {
    const items = grid_items(count);

    await seedAuth(page);
    await stubDashboardDeps(page, {
        exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
    });
    await stubGridRecordApi(page, {
        exhibitId: EXHIBIT_UUID,
        record: gridRecordFixture({ uuid: GRID_UUID, columns }),
    });
    await stubGridItemsApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID, items });

    const state = await stubGridItemRecordApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID, ...item_api });

    await page.goto(GRID_PAGE_URL);
    await expect(page.locator('table#grid-items tbody tr')).toHaveCount(count);
    await expect(page.locator('#grid-columns')).toHaveValue(String(columns));

    return { state, items };
}

async function choose_delete(page, item_id) {
    await row_menu(page, item_id).click();
    await page.locator(`[id="${item_id}-item-actions"] [data-action="delete-item"]`).click();
}

test.describe('Grid page — deleting a grid item (grid.page.module)', () => {

    test('asks first, then deletes and redraws the list', async ({ page }) => {
        const { state, items } = await open_grid_page(page, { columns: 2, count: 3 });

        await choose_delete(page, ITEM_IDS[0]);

        await expect(delete_modal(page)).toBeVisible();
        await expect(page.locator('#grid-item-delete-name')).toHaveText('Item 1');
        expect(state.deleteCount).toBe(0);

        items.shift();
        await page.click('#grid-item-delete-confirm-btn');

        await expect.poll(() => state.deleteCount).toBe(1);
        expect(state.lastDeletedId).toBe(ITEM_IDS[0]);
        await expect(delete_modal(page)).toBeHidden();
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(2);
        await expect(page.locator('#grid-items-message .alert-success')).toContainText('Grid item deleted');
        expect(new URL(page.url()).pathname).toBe(`${APP_PATH}/items/grid/items`);
    });

    test('Cancel keeps the item and returns focus to its menu', async ({ page }) => {
        const { state } = await open_grid_page(page, { columns: 2, count: 3 });

        await choose_delete(page, ITEM_IDS[1]);
        await expect(delete_modal(page)).toBeVisible();

        await page.click('#grid-item-delete-cancel-btn');

        await expect(delete_modal(page)).toBeHidden();
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);
        await expect(row_menu(page, ITEM_IDS[1])).toBeFocused();
        expect(state.deleteCount).toBe(0);
    });

    test('refuses without asking when fewer columns would allow the delete', async ({ page }) => {
        const { state } = await open_grid_page(page, { columns: 3, count: 3 });

        await choose_delete(page, ITEM_IDS[0]);

        await expect(page.locator('#grid-items-message .alert-warning')).toContainText(REDUCE_COLUMNS);
        await expect(delete_modal(page)).toBeHidden();
        expect(state.deleteCount).toBe(0);
    });

    test('refuses without asking when the grid would be left with too few items for any column count', async ({ page }) => {
        const { state } = await open_grid_page(page, { columns: 2, count: 2 });

        await choose_delete(page, ITEM_IDS[0]);

        await expect(page.locator('#grid-items-message .alert-warning')).toContainText(ADD_ITEMS);
        await expect(delete_modal(page)).toBeHidden();
        expect(state.deleteCount).toBe(0);
    });

    test('asks, instead of refusing, once the list shows an item someone else has added', async ({ page }) => {
        const { state, items } = await open_grid_page(page, { columns: 3, count: 3 });

        items.push(...grid_items(4).slice(3));
        await choose_delete(page, ITEM_IDS[0]);

        await expect(delete_modal(page)).toBeVisible();
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(4);
        await expect(page.locator('#grid-items-message .alert-warning')).toHaveCount(0);
        expect(state.deleteCount).toBe(0);
    });

    test('allows the delete once the column count has been lowered and saved', async ({ page }) => {
        const { state } = await open_grid_page(page, { columns: 4, count: 4 });

        await choose_delete(page, ITEM_IDS[0]);
        await expect(page.locator('#grid-items-message .alert-warning')).toContainText(REDUCE_COLUMNS);

        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, columns: 3 }),
        });
        await page.selectOption('#grid-columns', '3');
        await page.click('#save-item-btn');
        await expect(page.locator('#message .alert-success')).toContainText('Grid record updated');

        await choose_delete(page, ITEM_IDS[0]);

        await expect(delete_modal(page)).toBeVisible();
        expect(state.deleteCount).toBe(0);
    });

    test('shows a refusal from the server inside the pop-up and keeps the item', async ({ page }) => {
        const { state } = await open_grid_page(page, {
            columns: 2,
            count: 3,
            item_api: { deleteStatus: 422, deleteBody: { status: 422, message: REDUCE_COLUMNS } },
        });

        await choose_delete(page, ITEM_IDS[0]);
        await page.click('#grid-item-delete-confirm-btn');

        await expect(page.locator('#grid-item-delete-message .alert-danger')).toContainText(REDUCE_COLUMNS);
        await expect(delete_modal(page)).toBeVisible();
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);
        expect(state.deleteCount).toBe(1);
    });

    test('tells a user who may not delete', async ({ page }) => {
        await open_grid_page(page, { columns: 2, count: 3, item_api: { deleteStatus: 403, deleteBody: {} } });

        await choose_delete(page, ITEM_IDS[0]);
        await page.click('#grid-item-delete-confirm-btn');

        await expect(page.locator('#grid-item-delete-message .alert-danger')).toContainText(
            'You do not have permission to delete this item.'
        );
        await expect(delete_modal(page)).toBeVisible();
    });
});
