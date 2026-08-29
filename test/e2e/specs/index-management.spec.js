'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

/*
 * Stubs GET/POST /api/v1/indexer/manage. Returns a state object
 * capturing rebuild POSTs.
 */
async function stubIndexerManageApi(page, { status = {} } = {}) {
    const state = { rebuildCount: 0 };

    const status_body = {
        index: 'exhibits_local',
        exists: true,
        count: 42,
        published_exhibits: 7,
        ...status,
    };

    await page.route(`**${APP_PATH}/api/v1/indexer/manage**`, (route) => {
        const req = route.request();

        if (req.method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: status_body }),
            });
        }

        if (req.method() === 'POST') {
            state.rebuildCount += 1;
            return route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Index created' }),
            });
        }

        return route.fallback();
    });

    return state;
}

test.describe('Index management page (index.management.module.js)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        // The page gates on the Administrator role before rendering anything.
        await stubDashboardDeps(page, { role: { role: 'Administrator' } });
    });

    test('redirects non-administrators to /access-denied', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, { role: { role: 'User' } });
        await stubIndexerManageApi(page);

        await page.goto(`${APP_PATH}/index-management`);

        await page.waitForURL(new RegExp(`${APP_PATH}/access-denied`), { waitUntil: 'commit' });
    });

    test('renders index status from the manage endpoint', async ({ page }) => {
        await stubIndexerManageApi(page, {
            status: { index: 'exhibits_local', exists: true, count: 42, published_exhibits: 7 },
        });

        await page.goto(`${APP_PATH}/index-management`);

        await expect(page.locator('#index-management-content')).toBeVisible();
        await expect(page.locator('#status-index')).toHaveText('exhibits_local');
        await expect(page.locator('#status-exists')).toHaveText('Yes');
        await expect(page.locator('#status-count')).toHaveText('42');
        await expect(page.locator('#status-published')).toHaveText('7');
    });

    test('shows a missing index as No', async ({ page }) => {
        await stubIndexerManageApi(page, {
            status: { exists: false, count: null },
        });

        await page.goto(`${APP_PATH}/index-management`);

        await expect(page.locator('#status-exists')).toHaveText('No');
        await expect(page.locator('#status-count')).toHaveText('—');
    });

    test('Rebuild only enables after typing REBUILD, then POSTs to the manage endpoint', async ({ page }) => {
        const state = await stubIndexerManageApi(page);

        await page.goto(`${APP_PATH}/index-management`);
        await expect(page.locator('#index-management-content')).toBeVisible();

        await page.locator('#rebuild-index').click();
        await expect(page.locator('#rebuild-confirm-modal')).toBeVisible();
        await expect(page.locator('#rebuild-confirm-btn')).toBeDisabled();

        await page.fill('#rebuild-confirm-input', 'rebuild please');
        await expect(page.locator('#rebuild-confirm-btn')).toBeDisabled();

        // Case-insensitive exact match arms the destructive button.
        await page.fill('#rebuild-confirm-input', 'rebuild');
        await expect(page.locator('#rebuild-confirm-btn')).toBeEnabled();

        await page.locator('#rebuild-confirm-btn').click();

        await expect.poll(() => state.rebuildCount).toBe(1);
    });
});
