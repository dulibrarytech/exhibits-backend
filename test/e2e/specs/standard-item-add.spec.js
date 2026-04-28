'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Add standard text item form (items.add.standard.item.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Standard host exhibit' }),
            },
        });
    });

    test('renders the item data card with the text input', async ({ page }) => {
        await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/standard/text?exhibit_id=${EXHIBIT_UUID}`);

        // Standard items don't have a title field (unlike grid items).
        // Only #item-text-input is present in item-data-card.ejs.
        await expect(page.locator('#item-text-input')).toBeVisible();
        await expect(page.locator('#save-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Standard host exhibit');
    });

    test('blocks submit when text is empty (text path)', async ({ page }) => {
        const state = await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/standard/text?exhibit_id=${EXHIBIT_UUID}`);

        await page.click('#save-item-btn');

        // Same no-clobber pattern as grid-item-add: the wrapping
        // create_item_record has its overwrite line commented out
        // (items.add.standard.item.form.module.js:90), so the
        // common module's specific message reaches the user.
        await expect(page.locator('#message .alert-danger')).toContainText(
            /please enter "?text"?/i
        );
        expect(state.createCount).toBe(0);
    });

    test('POSTs serialized payload and redirects to text edit on 201', async ({ page }) => {
        const state = await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            newItemId: 'standard-item-uuid-new',
        });

        await page.goto(`${APP_PATH}/items/standard/text?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#save-item-btn')).toBeEnabled();

        await page.fill('#item-text-input', 'A new standard text item');

        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/items`
                && req.method() === 'POST';
        });

        await page.click('#save-item-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.text).toBe('A new standard text item');
        expect(state.lastCreatePayload.item_type).toBe('text');
        expect(state.lastCreatePayload.mime_type).toBe('text/plain');
        // Pre-checked radios in the EJS.
        expect(state.lastCreatePayload.layout).toBe('text_only');
        expect(state.lastCreatePayload.media_width).toBe('50');

        // create_item_record's redirect_to_item_edit_page discriminates
        // by `pathname.indexOf('media')` — text path → /standard/text/edit.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/standard/text/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe('standard-item-uuid-new');
    });

    test('does not POST when item_id is already present (edit mode guard)', async ({ page }) => {
        const state = await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(
            `${APP_PATH}/items/standard/text?exhibit_id=${EXHIBIT_UUID}&item_id=existing-item`
        );

        await page.fill('#item-text-input', 'Should not be sent');
        await page.click('#save-item-btn');
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
