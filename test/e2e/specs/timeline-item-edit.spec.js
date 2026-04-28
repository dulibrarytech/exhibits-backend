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

test.describe('Edit timeline text item form (items.edit.vertical.timeline.item.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('populates form fields from the fetched record', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Existing item title',
                text: 'Existing item text',
                date: '2026-04-15',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator('#item-title-input')).toHaveValue('Existing item title');
        await expect(page.locator('#item-text-input')).toHaveValue('Existing item text');
        await expect(page.locator('#item-date-input')).toHaveValue('2026-04-15');
        await expect(page.locator('#created')).toContainText(/Created by tester/);
    });

    test('PUTs updated payload and shows success alert on 201', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        const state = await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Original',
                text: 'Original text',
                date: '2026-04-15',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );
        await expect(page.locator('#item-title-input')).toHaveValue('Original');

        await page.fill('#item-title-input', 'Edited title');
        await page.fill('#item-text-input', 'Edited text');

        const putPromise = page.waitForRequest((req) =>
            req.url().includes(`/timelines/${TIMELINE_UUID}/items/${ITEM_UUID}`)
            && req.method() === 'PUT'
        );

        await page.click('#save-item-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.title).toBe('Edited title');
        expect(state.lastUpdatePayload.text).toBe('Edited text');
        expect(state.lastUpdatePayload.date).toBe('2026-04-15');
        expect(state.lastUpdatePayload.item_type).toBe('text');

        await expect(page.locator('#message .alert-success')).toBeVisible();
    });

    test('disables form fields when record is locked by another user', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: ITEM_UUID,
                date: '2026-04-15',
                is_locked: 1,
                locked_by_user: '999',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`
        );

        // Same lock-detection mechanic as heading-edit / grid-item-edit /
        // standard-item-edit.
        await expect(page.locator('#item-title-input')).toBeDisabled();
        await expect(page.locator('#item-text-input')).toBeDisabled();
    });
});
