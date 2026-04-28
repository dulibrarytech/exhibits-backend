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

test.describe('Edit grid media item form (items.edit.grid.item.form.module — media path)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubMediaApi(page);
    });

    test('populates media fields and preview from the fetched record', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Existing media item',
                text: 'Existing caption',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/media/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );

        // populate_media_previews (in the common module) writes record.media_uuid
        // into the hidden #item-media-uuid input.
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-existing');
        await expect(page.locator('#item-title-input')).toHaveValue('Existing media item');
        await expect(page.locator('#item-text-input')).toHaveValue('Existing caption');
        await expect(page.locator('#created')).toContainText(/Created by tester/);
    });

    test('PUTs payload preserving media_uuid and shows success alert', async ({ page }) => {
        const state = await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: ITEM_UUID,
                text: 'Original caption',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/media/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-existing');

        await page.fill('#item-text-input', 'Edited caption');

        const putPromise = page.waitForRequest((req) =>
            req.url().includes(`/grids/${GRID_UUID}/items/${ITEM_UUID}`)
            && req.method() === 'PUT'
        );

        await page.click('#save-item-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.text).toBe('Edited caption');
        expect(state.lastUpdatePayload.media_uuid).toBe('media-uuid-existing');
        expect(state.lastUpdatePayload.item_type).toBe('image');
        expect(state.lastUpdatePayload.mime_type).toBe('image/jpeg');

        await expect(page.locator('#message .alert-success')).toBeVisible();
    });
});
