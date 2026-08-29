'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TIMELINE_UUID = '660e8400-e29b-41d4-a716-446655440100';
const ITEM_UUID = '770e8400-e29b-41d4-a716-446655440200';

const PAGE_URL = `${APP_PATH}/items/timeline/item/delete`
    + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${ITEM_UUID}`;

test.describe('Timeline item delete confirmation page (items.timeline.module.js — delete_timeline_item)', () => {

    async function stubTimelineItemDelete(page, { status = 204, body = '' } = {}) {
        const state = { deleteUrl: null };

        await page.route(
            `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/timelines/${TIMELINE_UUID}/items/${ITEM_UUID}**`,
            (route) => {
                const req = route.request();
                if (req.method() !== 'DELETE') {
                    return route.fallback();
                }
                state.deleteUrl = req.url();
                return route.fulfill({
                    status,
                    contentType: 'application/json',
                    body,
                });
            }
        );

        return state;
    }

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Timeline host exhibit' }) },
        });
    });

    test('renders the delete confirmation card', async ({ page }) => {
        await page.goto(PAGE_URL);

        await expect(page.locator('#delete-card')).toBeVisible();
        await expect(page.locator('#delete-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Timeline host exhibit');
    });

    test('clicking Delete fires DELETE with type=timeline_item and redirects to the timeline items list on 204', async ({ page }) => {
        const state = await stubTimelineItemDelete(page, { status: 204 });

        await page.goto(PAGE_URL);
        // The click listener is attached only after the view's async init
        // resolves; show_form() reveals the card at the same point.
        await expect(page.locator('#delete-card')).toBeVisible();

        await page.click('#delete-item-btn');

        await expect.poll(() => state.deleteUrl).not.toBeNull();
        const u = new URL(state.deleteUrl);
        expect(u.pathname).toBe(
            `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/timelines/${TIMELINE_UUID}/items/${ITEM_UUID}`
        );
        expect(u.searchParams.get('type')).toBe('timeline_item');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/timeline/items\\?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`),
            { waitUntil: 'commit' }
        );
    });

    test('a 403 response surfaces a permission-denied message', async ({ page }) => {
        await stubTimelineItemDelete(page, {
            status: 403,
            body: JSON.stringify({ message: 'Unauthorized request' }),
        });

        await page.goto(PAGE_URL);
        // The click listener is attached only after the view's async init
        // resolves; show_form() reveals the card at the same point.
        await expect(page.locator('#delete-card')).toBeVisible();
        await page.click('#delete-item-btn');

        await expect(page.locator('#message')).toContainText(/permission/i);
    });
});
