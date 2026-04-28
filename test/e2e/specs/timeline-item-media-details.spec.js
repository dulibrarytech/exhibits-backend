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

test.describe('Timeline media item details page (items.details.vertical.timeline.item.module — media path)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Timeline host exhibit' }),
            },
        });
        await stubMediaApi(page);
    });

    test('renders read-only fields and populates the media preview', async ({ page }) => {
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Read-only media item',
                text: 'Read-only caption',
                date: '2026-04-15',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media/details`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator('#item-title-input')).toHaveValue('Read-only media item');
        await expect(page.locator('#item-text-input')).toHaveValue('Read-only caption');
        await expect(page.locator('#item-date-input')).toHaveValue('2026-04-15');
        // Media path → details module calls populate_media_previews.
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-existing');

        await expect(page.locator('#item-title-input')).toBeDisabled();
        await expect(page.locator('#item-text-input')).toBeDisabled();

        await expect(page.locator('#edit-item-btn')).toBeVisible();
    });

    test('clicking Edit navigates to the media edit page with the same ids', async ({ page }) => {
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                date: '2026-04-15',
                item_type: 'image',
                media_uuid: 'media-uuid-existing',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media/details`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );

        await page.click('#edit-item-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/vertical-timeline/item/media/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('timeline_id')).toBe(TIMELINE_UUID);
        expect(url.searchParams.get('item_id')).toBe(ITEM_UUID);
    });
});
