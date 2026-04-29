'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubTimelineRecordApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Add timeline form (items.add.vertical.timeline.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Timeline host exhibit' }),
            },
        });
    });

    test('renders the timeline data card and save button', async ({ page }) => {
        await stubTimelineRecordApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/vertical-timeline?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('#timeline-text-input')).toBeVisible();
        // Save button is #save-timeline-btn here, not #save-item-btn.
        await expect(page.locator('#save-timeline-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Timeline host exhibit');
    });

    test('POSTs and redirects to edit on 201', async ({ page }) => {
        const state = await stubTimelineRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            newTimelineId: 'timeline-uuid-new',
        });

        await page.goto(`${APP_PATH}/items/vertical-timeline?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#save-timeline-btn')).toBeEnabled();

        await page.fill('#timeline-text-input', 'My new timeline');

        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/timelines`
                && req.method() === 'POST';
        });

        await page.click('#save-timeline-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.text).toBe('My new timeline');

        // Module redirects to /items/vertical-timeline/edit?... after
        // success. Use 'commit' to avoid CDN-stall flake on destination.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/vertical-timeline/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe('timeline-uuid-new');
    });

    test('does not POST when item_id is already present (edit mode guard)', async ({ page }) => {
        const state = await stubTimelineRecordApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(
            `${APP_PATH}/items/vertical-timeline?exhibit_id=${EXHIBIT_UUID}&item_id=existing-timeline`
        );

        await page.click('#save-timeline-btn');
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
