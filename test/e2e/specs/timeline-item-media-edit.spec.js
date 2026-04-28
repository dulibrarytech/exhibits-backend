'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubTimelineItemApi,
    stubMediaApi,
    exhibitFixture,
    timelineItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440100';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440400';

test.describe('Edit timeline media item form (items.edit.vertical.timeline.item.form.module — media path)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubMediaApi(page);
    });

    test('populates media fields and preview from the fetched record', async ({ page }) => {
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Existing media item',
                text: 'Existing caption',
                date: '2026-04-15',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );

        // populate_media_previews writes record.media_uuid into the hidden
        // #item-media-uuid input.
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-existing');
        await expect(page.locator('#item-title-input')).toHaveValue('Existing media item');
        await expect(page.locator('#item-text-input')).toHaveValue('Existing caption');
        await expect(page.locator('#item-date-input')).toHaveValue('2026-04-15');
        await expect(page.locator('#created')).toContainText(/Created by tester/);
    });

    test('PUTs payload preserving media_uuid via #save-item-btn', async ({ page }) => {
        const state = await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Original',
                text: 'Original caption',
                date: '2026-04-15',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-existing');

        await page.fill('#item-text-input', 'Edited caption');

        const putPromise = page.waitForRequest((req) =>
            req.url().includes(`/timelines/${TIMELINE_UUID}/items/${ITEM_UUID}`)
            && req.method() === 'PUT'
        );

        await page.click('#save-item-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.text).toBe('Edited caption');
        expect(state.lastUpdatePayload.media_uuid).toBe('media-uuid-existing');
        expect(state.lastUpdatePayload.item_type).toBe('image');
        expect(state.lastUpdatePayload.mime_type).toBe('image/jpeg');
        expect(state.lastUpdatePayload.date).toBe('2026-04-15');

        await expect(page.locator('#message .alert-success')).toBeVisible();
    });
});
