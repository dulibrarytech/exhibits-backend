'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubTimelineRecordApi,
    exhibitFixture,
    timelineRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440100';

test.describe('Timeline details page (items.details.vertical.timeline.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Timeline host exhibit' }),
            },
        });
    });

    test('renders text field populated from the fetched record', async ({ page }) => {
        await stubTimelineRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: timelineRecordFixture({
                uuid: TIMELINE_UUID,
                text: 'Read-only timeline text',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/details?exhibit_id=${EXHIBIT_UUID}&item_id=${TIMELINE_UUID}`
        );

        await expect(page.locator('#timeline-text-input')).toHaveValue('Read-only timeline text');
        await expect(page.locator('#edit-item-btn')).toBeVisible();
    });

    test('clicking Edit navigates to the timeline edit page with the same ids', async ({ page }) => {
        await stubTimelineRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: timelineRecordFixture({ uuid: TIMELINE_UUID }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/details?exhibit_id=${EXHIBIT_UUID}&item_id=${TIMELINE_UUID}`
        );

        await page.click('#edit-item-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/vertical-timeline/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe(TIMELINE_UUID);
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await stubTimelineRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: timelineRecordFixture({ uuid: TIMELINE_UUID }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/details`
            + `?exhibit_id=${EXHIBIT_UUID}&item_id=${TIMELINE_UUID}&status=403`
        );

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });
});
