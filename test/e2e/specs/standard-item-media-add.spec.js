'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    stubMediaApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Add standard media item form (items.add.standard.item.form.module — media path)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Standard host exhibit' }),
            },
        });
        await stubMediaApi(page, {
            items: [
                {
                    uuid: 'media-uuid-1',
                    name: 'photo.jpg',
                    original_filename: 'photo.jpg',
                    media_type: 'image',
                    mime_type: 'image/jpeg',
                },
            ],
        });
    });

    test('renders the item data card with media picker button', async ({ page }) => {
        await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/standard/media?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('#item-text-input')).toBeVisible();
        await expect(page.locator('#pick-item-media-btn')).toBeVisible();
        await expect(page.locator('#item-media-uuid')).toHaveValue('');
        await expect(page.locator('#save-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Standard host exhibit');
    });

    test('blocks submit when media is not selected (media path)', async ({ page }) => {
        const state = await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/standard/media?exhibit_id=${EXHIBIT_UUID}`);

        await page.click('#save-item-btn');

        // Same no-clobber pattern as standard-item-add (text path) and
        // grid-item-media-add — the wrapping create_item_record's
        // overwrite line is commented out, so the common module's
        // specific message reaches the user.
        await expect(page.locator('#message .alert-danger')).toContainText(
            /please select a media item/i
        );
        expect(state.createCount).toBe(0);
    });

    test('selecting media via picker → POST → redirect to media edit', async ({ page }) => {
        const state = await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            newItemId: 'standard-item-uuid-new',
        });

        await page.goto(`${APP_PATH}/items/standard/media?exhibit_id=${EXHIBIT_UUID}`);

        // Open picker (wired by init_media_picker_buttons when pathname
        // includes 'media').
        await page.click('#pick-item-media-btn');

        await expect(page.locator('#media-picker-modal .media-card').first()).toBeVisible();
        await page.locator('#media-picker-modal .media-card').first().click();
        await expect(page.locator('#media-picker-confirm-btn')).toBeEnabled();
        await page.click('#media-picker-confirm-btn');

        // handle_item_media_selected populates the four hidden inputs
        // synchronously inside the confirm callback.
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-1');

        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/items`
                && req.method() === 'POST';
        });

        await page.click('#save-item-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.media_uuid).toBe('media-uuid-1');
        expect(state.lastCreatePayload.item_type).toBe('image');
        expect(state.lastCreatePayload.mime_type).toBe('image/jpeg');

        // Redirect URL discriminates by `pathname.indexOf('media')` —
        // media path → /items/standard/media/edit.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/standard/media/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe('standard-item-uuid-new');
    });

    test('does not POST when item_id is already present (edit mode guard)', async ({ page }) => {
        const state = await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(
            `${APP_PATH}/items/standard/media?exhibit_id=${EXHIBIT_UUID}&item_id=existing-item`
        );

        await page.click('#save-item-btn');
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
