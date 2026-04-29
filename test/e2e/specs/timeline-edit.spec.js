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

test.describe('Edit timeline form (items.edit.vertical.timeline.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('populates text field from the fetched record', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubTimelineRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: timelineRecordFixture({
                uuid: TIMELINE_UUID,
                title: 'Existing title (not displayed)',
                text: 'Existing timeline text',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${TIMELINE_UUID}`
        );

        await expect(page.locator('#timeline-text-input')).toHaveValue('Existing timeline text');
        await expect(page.locator('#created')).toContainText(/Created by tester/);
    });

    test('PUTs updated payload via #save-timeline-btn and shows success', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        const state = await stubTimelineRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: timelineRecordFixture({
                uuid: TIMELINE_UUID,
                text: 'Original timeline text',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${TIMELINE_UUID}`
        );
        await expect(page.locator('#timeline-text-input')).toHaveValue('Original timeline text');

        await page.fill('#timeline-text-input', 'Edited timeline text');

        const putPromise = page.waitForRequest((req) =>
            req.url().includes(`/exhibits/${EXHIBIT_UUID}/timelines/${TIMELINE_UUID}`)
            && req.method() === 'PUT'
        );

        await page.click('#save-timeline-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.text).toBe('Edited timeline text');

        await expect(page.locator('#message .alert-success')).toBeVisible();
    });
});
