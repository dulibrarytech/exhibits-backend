'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridRecordApi,
    exhibitFixture,
    gridRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';

test.describe('Grid details page (items.details.grid.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }),
            },
        });
    });

    test('renders record fields read-only', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({
                uuid: GRID_UUID,
                text: 'Read-only grid',
                columns: 5,
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(`${APP_PATH}/items/grid/details?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);

        await expect(page.locator('#grid-text-input .ql-editor')).toHaveText('Read-only grid');
        await expect(page.locator('#grid-internal-name-input')).toHaveValue('Sample grid internal name');
        await expect(page.locator('#grid-columns')).toHaveValue('5');

        // The details EJS renders all inputs with the disabled attribute set.
        await expect(page.locator('#grid-text-input .ql-editor')).toHaveAttribute('contenteditable', 'false');
        await expect(page.locator('#grid-internal-name-input')).toBeDisabled();
        await expect(page.locator('#grid-columns')).toBeDisabled();

        // Staff-only hint rides along on the read-only view too.
        await expect(page.locator('#grid-internal-name-hint')).toContainText(
            /does not display on the exhibit; for internal use only/i
        );

        // Save button is hidden in details mode; Edit is the primary action.
        await expect(page.locator('#edit-item-btn')).toBeVisible();
    });

    test('renders an empty internal name for legacy grids that predate the column', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, internal_name: null }),
        });

        await page.goto(`${APP_PATH}/items/grid/details?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);

        await expect(page.locator('#grid-internal-name-input')).toHaveValue('');
    });

    test('clicking Edit navigates to the edit page with the same ids', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID }),
        });

        await page.goto(`${APP_PATH}/items/grid/details?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);

        await page.click('#edit-item-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/grid/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe(GRID_UUID);
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/details`
            + `?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}&status=403`
        );

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });
});
