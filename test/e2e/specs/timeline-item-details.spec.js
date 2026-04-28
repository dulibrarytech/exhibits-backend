'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubTimelineItemApi,
    exhibitFixture,
    timelineItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440100';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440400';

test.describe('Timeline text item details page (items.details.vertical.timeline.item.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Timeline host exhibit' }),
            },
        });
    });

    test('renders record fields and disables them after population', async ({ page }) => {
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Read-only title',
                text: 'Read-only text',
                date: '2026-04-15',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text/details`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator('#item-title-input')).toHaveValue('Read-only title');
        await expect(page.locator('#item-text-input')).toHaveValue('Read-only text');
        await expect(page.locator('#item-date-input')).toHaveValue('2026-04-15');

        // Both EJS-baked and runtime disable.
        await expect(page.locator('#item-title-input')).toBeDisabled();
        await expect(page.locator('#item-text-input')).toBeDisabled();

        await expect(page.locator('#edit-item-btn')).toBeVisible();
    });

    test('clicking Edit navigates to the text edit page with the same ids', async ({ page }) => {
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                date: '2026-04-15',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text/details`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );

        await page.click('#edit-item-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/vertical-timeline/item/text/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('timeline_id')).toBe(TIMELINE_UUID);
        expect(url.searchParams.get('item_id')).toBe(ITEM_UUID);
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                date: '2026-04-15',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text/details`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}&status=403`
        );

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });
});
