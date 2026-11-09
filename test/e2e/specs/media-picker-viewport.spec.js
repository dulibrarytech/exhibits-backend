'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubExhibitsApi,
    stubStandardItemApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');
const { openModal } = require('../helpers/bootstrap');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

const PAGE_OF_MEDIA = Array.from({ length: 20 }, (_, i) => ({
    uuid: `media-uuid-${i + 1}`,
    name: `Picker item ${i + 1}`,
    original_filename: `picker-${i + 1}.jpg`,
    media_type: 'image',
    mime_type: 'image/jpeg',
}));

async function stubFullPickerPage(page) {
    await page.route(`**${APP_PATH}/api/v1/media/library?**`, (route) => {
        if (route.request().method() !== 'GET') {
            return route.fallback();
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: PAGE_OF_MEDIA, total: 140 }),
        });
    });
}

async function openPicker(page, button_selector) {
    const shown = page.evaluate(() => new Promise((resolve) => {
        window.jQuery('#media-picker-modal').one('shown.bs.modal', () => resolve());
    }));
    await page.click(button_selector);
    await shown;
    await expect(page.locator('#media-picker-modal .media-card')).toHaveCount(20);
}

async function expectPickerUsable(page, saved_field_selector) {
    const modal = page.locator('#media-picker-modal');

    await modal.locator('.modal-body').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.locator('#media-picker-pagination .page-btn').last()).toBeInViewport();

    await expect(modal.locator('.modal-header .close')).toBeInViewport({ ratio: 1 });
    await expect(modal.locator('.modal-footer .btn-secondary')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#media-picker-confirm-btn')).toBeInViewport({ ratio: 1 });

    const hidden_px = await modal.locator('.modal-content')
        .evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(hidden_px, 'content hidden inside .modal-content').toBeLessThanOrEqual(1);

    await modal.locator('.media-card').first().dispatchEvent('click');
    await expect(page.locator('#media-picker-confirm-btn')).toBeEnabled();

    const box = await page.locator('#media-picker-confirm-btn').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(modal).toBeHidden();
    await expect(page.locator(saved_field_selector)).toHaveValue('media-uuid-1');
}

test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubDashboardDeps(page, {
        exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
    });
    await stubFullPickerPage(page);
});

for (const viewport of [
    { width: 1366, height: 657 },
    { width: 1024, height: 500 },
    { width: 320, height: 568 },
]) {
    test.describe(`media picker at ${viewport.width}x${viewport.height}`, () => {
        test.use({ viewport });

        test('the grid scrolls, the buttons stay on screen and Select Media works', async ({ page }) => {
            await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });
            await page.goto(`${APP_PATH}/items/standard/media?exhibit_id=${EXHIBIT_UUID}`);
            await openPicker(page, '#pick-item-media-btn');
            await expectPickerUsable(page, '#item-media-uuid');
        });
    });
}

test.describe('media picker opened from the Add Exhibit window at 1280x600', () => {
    test.use({ viewport: { width: 1280, height: 600 } });

    test('the picker sits above the Add Exhibit window and Select Media works', async ({ page }) => {
        await stubExhibitsApi(page);
        await page.goto(`${APP_PATH}/exhibits`);
        await openModal(page, 'add-exhibit-modal');
        await openPicker(page, '#pick-hero-image-btn');
        await expectPickerUsable(page, '#hero-image-media-uuid');
        await expect(page.locator('#add-exhibit-modal')).toBeVisible();
    });
});
