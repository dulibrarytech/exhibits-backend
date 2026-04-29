'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridItemRecordApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';

test.describe('Add grid text item form (items.add.grid.item.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }),
            },
        });
    });

    test('renders the item data card with the text input', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );

        await expect(page.locator('#item-title-input')).toBeVisible();
        await expect(page.locator('#item-text-input')).toBeVisible();
        await expect(page.locator('#save-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Grid host exhibit');
    });

    test('blocks submit when text is empty (text path)', async ({ page }) => {
        const state = await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );

        // Leave #item-text-input empty.
        await page.click('#save-item-btn');

        // Unlike create_heading_record / create_grid_record, the
        // create_grid_item_record wrapper has the "clobbering" overwrite
        // commented out (items.add.grid.item.form.module.js:93). The
        // user-visible message IS the specific one from the common
        // module.
        await expect(page.locator('#message .alert-danger')).toContainText(
            /please enter "?text"?/i
        );
        expect(state.createCount).toBe(0);
    });

    test('POSTs serialized payload and redirects to text edit on 201', async ({ page }) => {
        const state = await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            newItemId: 'grid-item-uuid-new',
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );
        await expect(page.locator('#save-item-btn')).toBeEnabled();

        await page.fill('#item-text-input', 'A new text item');

        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/grids/${GRID_UUID}/items`
                && req.method() === 'POST';
        });

        await page.click('#save-item-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.text).toBe('A new text item');
        // Common form forces these for the text path.
        expect(state.lastCreatePayload.item_type).toBe('text');
        expect(state.lastCreatePayload.mime_type).toBe('text/plain');
        // Pre-checked radios in the EJS.
        expect(state.lastCreatePayload.layout).toBe('text_only');
        expect(state.lastCreatePayload.media_width).toBe('50');

        // create_grid_item_record discriminates redirect URL by
        // window.location.pathname.includes('media') — text path goes
        // to /items/grid/item/text/edit.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/grid/item/text/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('grid_id')).toBe(GRID_UUID);
        expect(url.searchParams.get('item_id')).toBe('grid-item-uuid-new');
    });

    test('does not POST when item_id is already present (edit mode guard)', async ({ page }) => {
        const state = await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
        });

        // item_id present → create_grid_item_record bails out without POSTing.
        await page.goto(
            `${APP_PATH}/items/grid/item/text`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=existing-grid-item`
        );

        await page.fill('#item-text-input', 'Should not be sent');
        await page.click('#save-item-btn');
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
