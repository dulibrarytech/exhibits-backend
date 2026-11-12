'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridRecordApi,
    stubGridItemsApi,
    stubAuthPermissionsApi,
    exhibitFixture,
    gridRecordFixture,
    gridItemFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const GRID_PAGE_URL = `${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`;

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

test.describe('Grid page — published grid (grid.page.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }),
            },
        });
        await stubGridItemsApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID, items: grid_items(3) });
    });

    test('shows a published grid read-only with Edit and the public warning', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({
                uuid: GRID_UUID,
                text: 'Read-only grid',
                columns: 3,
                is_published: 1,
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(GRID_PAGE_URL);

        await expect(page.locator('#grid-text-input .ql-editor')).toHaveText('Read-only grid');
        await expect(page.locator('#grid-internal-name-input')).toHaveValue('Sample grid internal name');
        await expect(page.locator('#grid-columns')).toHaveValue('3');

        await expect(page.locator('#grid-text-input .ql-editor')).toHaveAttribute('contenteditable', 'false');
        await expect(page.locator('#grid-internal-name-input')).toBeDisabled();
        await expect(page.locator('#grid-columns')).toBeDisabled();

        await expect(page.locator('#grid-internal-name-hint')).toContainText(
            /does not display on the exhibit; for internal use only/i
        );

        await expect(page.locator('#edit-grid-btn')).toBeVisible();
        await expect(page.locator('#save-item-btn')).toBeHidden();
        await expect(page.locator('#cancel-exhibit-btn')).toBeHidden();
        await expect(page.locator('#grid-published-note')).toContainText(
            'Changes made to published exhibit grids are immediately visible to the public'
        );
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);
    });

    test('leaves an unpublished grid editable with Save and no warning', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, text: 'Draft grid', columns: 3 }),
        });

        await page.goto(GRID_PAGE_URL);

        await expect(page.locator('#grid-text-input .ql-editor')).toHaveText('Draft grid');
        await expect(page.locator('#grid-internal-name-input')).toBeEnabled();
        await expect(page.locator('#save-item-btn')).toBeVisible();
        await expect(page.locator('#cancel-exhibit-btn')).toBeVisible();
        await expect(page.locator('#edit-grid-btn')).toBeHidden();
        await expect(page.locator('#grid-published-note')).toBeHidden();
        await expect(page.locator('#grid-no-permission-note')).toBeHidden();
    });

    test('renders an empty internal name for legacy grids that predate the column', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, internal_name: null }),
        });

        await page.goto(`${APP_PATH}/items/grid/details?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);

        await expect(page.locator('#grid-internal-name-input')).toHaveValue('');
    });

    test('Edit opens the form in place and keeps the warning', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, text: 'Published grid', columns: 3, is_published: 1 }),
        });

        await page.goto(GRID_PAGE_URL);
        await expect(page.locator('#grid-internal-name-input')).toBeDisabled();

        await page.click('#edit-grid-btn');

        await expect(page.locator('#grid-internal-name-input')).toBeEnabled();
        await expect(page.locator('#grid-internal-name-input')).toBeFocused();
        await expect(page.locator('#grid-columns')).toBeEnabled();
        await expect(page.locator('#grid-text-input .ql-editor')).toHaveAttribute('contenteditable', 'true');
        await expect(page.locator('#save-item-btn')).toBeVisible();
        await expect(page.locator('#edit-grid-btn')).toBeHidden();
        await expect(page.locator('#grid-published-note')).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(`${APP_PATH}/items/grid/items`);
    });

    test('shows a published grid read-only, without Edit, to a user who may not edit it', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, text: 'Not mine', columns: 3, is_published: 1 }),
        });
        await stubAuthPermissionsApi(page, { status: 403 });

        await page.goto(GRID_PAGE_URL);

        await expect(page.locator('#grid-text-input .ql-editor')).toHaveText('Not mine');
        await expect(page.locator('#grid-no-permission-note')).toContainText(
            'You do not have permission to update this grid.'
        );
        await expect(page.locator('#grid-internal-name-input')).toBeDisabled();
        await expect(page.locator('#edit-grid-btn')).toBeHidden();
        await expect(page.locator('#save-item-btn')).toBeHidden();
        await expect(page.locator('#grid-published-note')).toBeHidden();
    });

    test('shows an unpublished grid read-only, with the reason, to a user who may not edit it', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, text: 'Not mine either', columns: 3 }),
        });
        await stubAuthPermissionsApi(page, { status: 403 });

        await page.goto(GRID_PAGE_URL);

        await expect(page.locator('#grid-text-input .ql-editor')).toHaveText('Not mine either');
        await expect(page.locator('#grid-no-permission-note')).toContainText(
            'You do not have permission to update this grid.'
        );
        await expect(page.locator('#grid-text-input .ql-editor')).toHaveAttribute('contenteditable', 'false');
        await expect(page.locator('#grid-internal-name-input')).toBeDisabled();
        await expect(page.locator('#grid-columns')).toBeDisabled();
        await expect(page.locator('#save-item-btn')).toBeHidden();
        await expect(page.locator('#cancel-exhibit-btn')).toBeHidden();
        await expect(page.locator('#edit-grid-btn')).toBeHidden();
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);
    });

    test('opens from the old grid details address', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, text: 'Old address grid', columns: 3, is_published: 1 }),
        });

        await page.goto(`${APP_PATH}/items/grid/details?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);

        await expect(page.locator('#grid-text-input .ql-editor')).toHaveText('Old address grid');

        const url = new URL(page.url());
        expect(url.pathname).toBe(`${APP_PATH}/items/grid/items`);
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('grid_id')).toBe(GRID_UUID);
    });
});
