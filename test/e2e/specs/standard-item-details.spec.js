'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    exhibitFixture,
    standardItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440300';

test.describe('Standard text item details page (items.details.standard.item.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Standard host exhibit' }),
            },
        });
    });

    test('renders text field and disables it after population', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID,
                text: 'Read-only standard text',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/text/details?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator('#item-text-input')).toHaveValue('Read-only standard text');

        // The text-details EJS renders the text field with `disabled`
        // baked in AND display_details_record() runs disable_all_fields
        // after populating.
        await expect(page.locator('#item-text-input')).toBeDisabled();

        await expect(page.locator('#edit-item-btn')).toBeVisible();
        await expect(page.locator('#edit-item-btn')).toBeEnabled();
    });

    test('clicking Edit navigates to the text edit page with the same ids', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({ uuid: ITEM_UUID }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/text/details?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`
        );

        await page.click('#edit-item-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/standard/text/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe(ITEM_UUID);
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({ uuid: ITEM_UUID }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/text/details`
            + `?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}&status=403`
        );

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });
});
