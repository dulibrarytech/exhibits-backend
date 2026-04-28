'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridItemRecordApi,
    exhibitFixture,
    gridItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440200';

test.describe('Grid text item details page (items.details.grid.item.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }),
            },
        });
    });

    test('renders record fields and disables them after population', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Read-only title',
                text: 'Read-only text',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text/details`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator('#item-title-input')).toHaveValue('Read-only title');
        await expect(page.locator('#item-text-input')).toHaveValue('Read-only text');

        // The text-details EJS renders fields with `disabled` baked in
        // AND display_details_record() runs disable_all_fields() after
        // populating, so the inputs are disabled at both layers.
        await expect(page.locator('#item-title-input')).toBeDisabled();
        await expect(page.locator('#item-text-input')).toBeDisabled();

        // Edit is the primary action on details mode.
        await expect(page.locator('#edit-item-btn')).toBeVisible();
        await expect(page.locator('#edit-item-btn')).toBeEnabled();
    });

    test('clicking Edit navigates to the text edit page with the same ids', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({ uuid: ITEM_UUID }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text/details`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );

        await page.click('#edit-item-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/grid/item/text/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('grid_id')).toBe(GRID_UUID);
        expect(url.searchParams.get('item_id')).toBe(ITEM_UUID);
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({ uuid: ITEM_UUID }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text/details`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}&status=403`
        );

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });
});
