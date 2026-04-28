'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubExhibitsApi,
    stubMediaApi,
} = require('../fixtures/api-stubs');
const { openModal } = require('../helpers/bootstrap');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

test.describe('Media picker — hero image selection', () => {
    test('selecting a media item populates hidden hero-image inputs', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page);
        await stubExhibitsApi(page);
        // mediaPickerModule reads `media.name || media.original_filename`
        // for #hero-image-filename-display, and `media.media_type` for the
        // card icon. The original `filename` field is unused.
        await stubMediaApi(page, {
            items: [
                {
                    uuid: 'media-uuid-1',
                    name: 'hero.jpg',
                    original_filename: 'hero.jpg',
                    media_type: 'image',
                    mime_type: 'image/jpeg',
                    url: '/exhibits-dashboard/static/test/hero.jpg',
                },
            ],
        });

        await page.goto(`${APP_PATH}/exhibits`);
        await openModal(page, 'add-exhibit-modal');

        await page.click('#pick-hero-image-btn');

        // create_media_card produces .media-card elements inside
        // #media-picker-grid-container > .media-grid. Confirm button
        // starts disabled and is enabled once a card is selected.
        await expect(page.locator('#media-picker-modal .media-card').first()).toBeVisible();
        await page.locator('#media-picker-modal .media-card').first().click();

        await expect(page.locator('#media-picker-confirm-btn')).toBeEnabled();
        await page.click('#media-picker-confirm-btn');

        await expect(page.locator('#hero-image-media-uuid')).toHaveValue('media-uuid-1');
        await expect(page.locator('#hero-image-filename-display')).toContainText('hero.jpg');
    });
});
