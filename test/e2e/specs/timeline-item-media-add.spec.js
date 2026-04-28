'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubTimelineItemApi,
    stubMediaApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440100';

test.describe('Add timeline media item form (items.add.vertical.timeline.item.form.module — media path)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Timeline host exhibit' }),
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
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`
        );

        await expect(page.locator('#item-text-input')).toBeVisible();
        await expect(page.locator('#item-date-input')).toBeVisible();
        await expect(page.locator('#pick-item-media-btn')).toBeVisible();
        await expect(page.locator('#item-media-uuid')).toHaveValue('');
        await expect(page.locator('#save-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Timeline host exhibit');
    });

    test('blocks submit when media is not selected (media path)', async ({ page }) => {
        const state = await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`
        );

        // Date is the first required field — fill it so the validation
        // chain reaches the media-uuid check.
        await page.fill('#item-date-input', '2026-04-15');
        await page.click('#save-item-btn');

        await expect(page.locator('#message .alert-danger')).toContainText(
            /please select a media item/i
        );
        expect(state.createCount).toBe(0);
    });

    test('selecting media via picker → POST → redirect to media edit', async ({ page }) => {
        const state = await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            newItemId: 'timeline-item-uuid-new',
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`
        );

        await page.fill('#item-date-input', '2026-04-15');

        // Open picker, pick first card, confirm.
        await page.click('#pick-item-media-btn');
        await expect(page.locator('#media-picker-modal .media-card').first()).toBeVisible();
        await page.locator('#media-picker-modal .media-card').first().click();
        await expect(page.locator('#media-picker-confirm-btn')).toBeEnabled();
        await page.click('#media-picker-confirm-btn');

        // handle_item_media_selected populates the hidden inputs
        // synchronously inside the confirm callback.
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-1');

        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/timelines/${TIMELINE_UUID}/items`
                && req.method() === 'POST';
        });

        await page.click('#save-item-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.media_uuid).toBe('media-uuid-1');
        expect(state.lastCreatePayload.item_type).toBe('image');
        expect(state.lastCreatePayload.mime_type).toBe('image/jpeg');
        expect(state.lastCreatePayload.date).toBe('2026-04-15');

        // redirect_to_timeline_item_edit_page → media path → /media/edit.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/vertical-timeline/item/media/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('timeline_id')).toBe(TIMELINE_UUID);
        expect(url.searchParams.get('item_id')).toBe('timeline-item-uuid-new');
    });

    test('does not POST when item_id is already present (edit mode guard)', async ({ page }) => {
        const state = await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=existing-item`
        );

        await page.fill('#item-date-input', '2026-04-15');
        await page.click('#save-item-btn');
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
