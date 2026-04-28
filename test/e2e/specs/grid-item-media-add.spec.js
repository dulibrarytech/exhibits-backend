'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridItemRecordApi,
    stubMediaApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';

test.describe('Add grid media item form (items.add.grid.item.form.module — media path)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }),
            },
        });
        // Picker fetches /api/v1/media/library — stub it for every test
        // so a stray fetch doesn't fall through to the real backend.
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
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/media?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );

        await expect(page.locator('#item-text-input')).toBeVisible();
        await expect(page.locator('#pick-item-media-btn')).toBeVisible();
        // Hidden input is in the DOM but not visible — assert it exists
        // by checking the `value` attribute (empty until a pick).
        await expect(page.locator('#item-media-uuid')).toHaveValue('');
        await expect(page.locator('#save-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Grid host exhibit');
    });

    test('blocks submit when media is not selected (media path)', async ({ page }) => {
        const state = await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/media?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );

        // Don't open the picker — go straight to save.
        await page.click('#save-item-btn');

        // Common module's media-path validation: "Please select a media item".
        // Same no-overwrite pattern as the text path — create_grid_item_record
        // doesn't clobber the message.
        await expect(page.locator('#message .alert-danger')).toContainText(
            /please select a media item/i
        );
        expect(state.createCount).toBe(0);
    });

    test('selecting media via picker → POST → redirect to media edit', async ({ page }) => {
        const state = await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            newItemId: 'grid-item-uuid-new',
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/media?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );

        // Open the media picker. mediaPickerModule.open is wired by
        // items.common.grid.item.form.module.js init_media_picker_buttons
        // when location.pathname includes 'media'.
        await page.click('#pick-item-media-btn');

        // Pick the first card and confirm.
        await expect(page.locator('#media-picker-modal .media-card').first()).toBeVisible();
        await page.locator('#media-picker-modal .media-card').first().click();
        await expect(page.locator('#media-picker-confirm-btn')).toBeEnabled();
        await page.click('#media-picker-confirm-btn');

        // handle_item_media_selected populates the hidden inputs
        // synchronously inside the confirm callback.
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-1');

        await page.fill('#item-text-input', 'Optional caption');

        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/grids/${GRID_UUID}/items`
                && req.method() === 'POST';
        });

        await page.click('#save-item-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.media_uuid).toBe('media-uuid-1');
        // Common form serializes the media-path fields from the picker
        // selection (handle_item_media_selected sets these).
        expect(state.lastCreatePayload.item_type).toBe('image');
        expect(state.lastCreatePayload.mime_type).toBe('image/jpeg');

        // Redirect URL discriminates by `pathname.indexOf('media')` —
        // media path → /items/grid/item/media/edit.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/grid/item/media/edit`),
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

        await page.goto(
            `${APP_PATH}/items/grid/item/media`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=existing-grid-item`
        );

        await page.click('#save-item-btn');
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
