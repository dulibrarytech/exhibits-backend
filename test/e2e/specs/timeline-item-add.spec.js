'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubTimelineItemApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440100';

test.describe('Add timeline text item form (items.add.vertical.timeline.item.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Timeline host exhibit' }),
            },
        });
    });

    test('renders the item data card with title, date, and text inputs', async ({ page }) => {
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`
        );

        await expect(page.locator('#item-title-input')).toBeVisible();
        await expect(page.locator('#item-date-input')).toBeVisible();
        await expect(page.locator('#item-text-input')).toBeVisible();
        await expect(page.locator('#save-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Timeline host exhibit');
    });

    test('blocks submit when date is empty', async ({ page }) => {
        const state = await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`
        );

        // The EJS sets value="0000-00-00" on #item-date-input. Chromium
        // rejects this as out-of-range, so el.value reads as ''. The
        // common form's first date validation fires.
        //
        // (If a future change makes Chromium accept the literal 0000-00-00,
        // the `new Date(...)` check fires instead with "Please enter a
        // valid date". Match either path with a permissive regex.)
        await page.click('#save-item-btn');

        await expect(page.locator('#message .alert-danger')).toContainText(
            /please enter (?:a timeline date|a valid date)/i
        );
        expect(state.createCount).toBe(0);
    });

    test('POSTs serialized payload and redirects to text edit on 201', async ({ page }) => {
        const state = await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            newItemId: 'timeline-item-uuid-new',
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`
        );
        await expect(page.locator('#save-item-btn')).toBeEnabled();

        await page.fill('#item-title-input', 'New timeline item');
        await page.fill('#item-date-input', '2026-04-15');
        await page.fill('#item-text-input', 'Some description text');

        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/timelines/${TIMELINE_UUID}/items`
                && req.method() === 'POST';
        });

        await page.click('#save-item-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.title).toBe('New timeline item');
        expect(state.lastCreatePayload.text).toBe('Some description text');
        expect(state.lastCreatePayload.date).toBe('2026-04-15');
        // Common form sets these for the text path.
        expect(state.lastCreatePayload.item_type).toBe('text');
        expect(state.lastCreatePayload.mime_type).toBe('text/plain');

        // redirect_to_timeline_item_edit_page discriminates by
        // pathname.indexOf('media') — text path → /text/edit.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/vertical-timeline/item/text/edit`),
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
            `${APP_PATH}/items/vertical-timeline/item/text`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=existing-item`
        );

        await page.fill('#item-date-input', '2026-04-15');
        await page.click('#save-item-btn');
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
