'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridRecordApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Add grid form (items.add.grid.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }),
            },
        });
    });

    test('renders the grid data card with required fields', async ({ page }) => {
        await stubGridRecordApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/grid?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('#grid-text-input')).toBeVisible();
        // The columns input has value="4" baked into the EJS — pre-filled
        // so a default save click would pass validation.
        await expect(page.locator('#grid-columns')).toHaveValue('4');
        await expect(page.locator('#save-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Grid host exhibit');
    });

    test('blocks submit when columns is empty', async ({ page }) => {
        const state = await stubGridRecordApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/grid?exhibit_id=${EXHIBIT_UUID}`);

        // Clear the pre-filled columns value to trigger the only required-
        // field validation in items.common.grid.form.module.
        await page.fill('#grid-columns', '');
        await page.click('#save-item-btn');

        // The common module sets a "Please enter the number of columns"
        // alert directly, but create_grid_record then overwrites it with
        // this generic one (same UX bug previously observed in
        // create_heading_record). Assert what the user actually sees,
        // not the intermediate state.
        await expect(page.locator('#message .alert-danger')).toContainText(
            /invalid form data/i
        );
        expect(state.createCount).toBe(0);
    });

    test('POSTs serialized payload and redirects to edit on 201', async ({ page }) => {
        const state = await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            newGridId: 'grid-uuid-new',
        });

        await page.goto(`${APP_PATH}/items/grid?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#save-item-btn')).toBeEnabled();

        await page.fill('#grid-text-input', 'My new grid');

        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/grids`
                && req.method() === 'POST';
        });

        await page.click('#save-item-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.text).toBe('My new grid');
        // Common form serializes columns as a string per
        // get_common_grid_form_fields (the `.toString()` call there).
        expect(state.lastCreatePayload.columns).toBe('4');

        // Module redirects to /items/grid/edit?... after success. Use
        // 'commit' to avoid a CDN-stall flake on the destination page.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/grid/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe('grid-uuid-new');
    });

    test('does not POST when item_id is already present (edit mode guard)', async ({ page }) => {
        const state = await stubGridRecordApi(page, { exhibitId: EXHIBIT_UUID });

        // item_id present → create_grid_record bails out (and tries to
        // call obj.update_grid_record which is undefined on the add module).
        await page.goto(`${APP_PATH}/items/grid?exhibit_id=${EXHIBIT_UUID}&item_id=existing-grid`);

        await page.click('#save-item-btn');
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
