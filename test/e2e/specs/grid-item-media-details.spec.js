'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridItemRecordApi,
    stubMediaApi,
    exhibitFixture,
    gridItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440200';

test.describe('Grid media item details page (items.details.grid.item.module — media path)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }),
            },
        });
        await stubMediaApi(page);
    });

    test('renders read-only fields and populates the media preview', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Read-only media item',
                text: 'Read-only caption',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/media/details`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator('#item-title-input')).toHaveValue('Read-only media item');
        await expect(page.locator('#item-text-input')).toHaveValue('Read-only caption');
        // Media path: details module calls populate_media_previews which
        // writes the hidden media uuid input alongside the visible preview.
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-existing');

        // disable_all_fields runs after population.
        await expect(page.locator('#item-title-input')).toBeDisabled();
        await expect(page.locator('#item-text-input')).toBeDisabled();

        // Edit is the primary action; save button is hidden in details mode.
        await expect(page.locator('#edit-item-btn')).toBeVisible();
    });

    test('clicking Edit navigates to the media edit page with the same ids', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: ITEM_UUID,
                item_type: 'image',
                media_uuid: 'media-uuid-existing',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/media/details`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );

        await page.click('#edit-item-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/grid/item/media/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('grid_id')).toBe(GRID_UUID);
        expect(url.searchParams.get('item_id')).toBe(ITEM_UUID);
    });
});
