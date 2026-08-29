'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Exhibit delete confirmation page (exhibits.module.js — delete_exhibit)', () => {

    /*
     * Registers the DELETE /api/v1/exhibits/<uuid> route with the given
     * status and returns a state object capturing the request URL.
     */
    async function stubExhibitDelete(page, { status = 204, body = '' } = {}) {
        const state = { deleteUrl: null };

        await page.route(
            `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}**`,
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
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Doomed exhibit' }) },
        });
    });

    test('renders the delete confirmation card with the exhibit title', async ({ page }) => {
        await page.goto(`${APP_PATH}/exhibits/exhibit/delete?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('#delete-card')).toBeVisible();
        await expect(page.locator('#delete-exhibit-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Doomed exhibit');
    });

    test('clicking Delete fires DELETE and redirects to the exhibits list on 204', async ({ page }) => {
        const state = await stubExhibitDelete(page, { status: 204 });

        await page.goto(`${APP_PATH}/exhibits/exhibit/delete?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#delete-card')).toBeVisible();

        await page.click('#delete-exhibit-btn');

        await expect.poll(() => state.deleteUrl).not.toBeNull();
        expect(new URL(state.deleteUrl).pathname)
            .toBe(`${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}`);

        // 204 → redirect to /exhibits after a 900ms setTimeout.
        await page.waitForURL(new RegExp(`${APP_PATH}/exhibits$`), { waitUntil: 'commit' });
    });

    test('a 200 response surfaces the contains-items warning instead of redirecting', async ({ page }) => {
        await stubExhibitDelete(page, {
            status: 200,
            body: JSON.stringify({ message: 'Cannot delete an exhibit that contains items' }),
        });

        await page.goto(`${APP_PATH}/exhibits/exhibit/delete?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#delete-card')).toBeVisible();
        await page.click('#delete-exhibit-btn');

        await expect(page.locator('#message')).toContainText('Cannot delete an exhibit that contains items');
        await expect(page.locator('#delete-card')).toBeEmpty();
    });

    test('a 403 response surfaces a permission-denied alert', async ({ page }) => {
        await stubExhibitDelete(page, {
            status: 403,
            body: JSON.stringify({ message: 'Unauthorized request' }),
        });

        await page.goto(`${APP_PATH}/exhibits/exhibit/delete?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#delete-card')).toBeVisible();
        await page.click('#delete-exhibit-btn');

        await expect(page.locator('#message')).toContainText('You do not have permission to delete this record');
    });
});
