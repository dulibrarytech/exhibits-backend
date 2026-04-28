'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '660e8400-e29b-41d4-a716-446655440099';

test.describe('Items delete confirmation page (items.module.js — delete_item)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
    });

    test('renders the delete confirmation card with delete button enabled', async ({ page }) => {
        await page.goto(
            `${APP_PATH}/items/delete`
            + `?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}&type=item`
        );

        await expect(page.locator('#delete-card')).toBeVisible();
        await expect(page.locator('#delete-item-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Items host exhibit');
    });

    test('clicking Delete fires DELETE with type query param and redirects on 204', async ({ page }) => {
        let deleteRequestUrl = null;

        // Inline route for the DELETE endpoint. delete_item constructs
        // /api/v1/exhibits/<eid>/items/<item_id>?type=<type>.
        await page.route(
            `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/items/${ITEM_UUID}**`,
            (route) => {
                const req = route.request();
                if (req.method() !== 'DELETE') {
                    return route.fallback();
                }
                deleteRequestUrl = req.url();
                return route.fulfill({
                    status: 204,
                    contentType: 'application/json',
                    body: '',
                });
            }
        );

        await page.goto(
            `${APP_PATH}/items/delete`
            + `?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}&type=item`
        );
        await expect(page.locator('#delete-item-btn')).toBeEnabled();

        await page.click('#delete-item-btn');

        await expect.poll(() => deleteRequestUrl).not.toBeNull();
        const u = new URL(deleteRequestUrl);
        expect(u.pathname).toBe(`${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/items/${ITEM_UUID}`);
        expect(u.searchParams.get('type')).toBe('item');

        // On 204 the module redirects to /items?exhibit_id=<eid> after
        // a 900ms setTimeout. Wait for the navigation to commit.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items\\?exhibit_id=${EXHIBIT_UUID}`),
            { waitUntil: 'commit' }
        );
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await page.goto(
            `${APP_PATH}/items/delete`
            + `?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}&type=item&status=403`
        );

        // The inline init() in dashboard-items-delete-form.ejs takes the
        // early-exit branch on status=403, writes the alert directly,
        // and skips the permission/title fetches.
        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });
});
