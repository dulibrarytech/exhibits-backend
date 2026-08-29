'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '660e8400-e29b-41d4-a716-446655440099';

/*
 * Stubs GET /api/v1/recycle with fixture rows plus the record-level
 * PUT (restore) / DELETE (purge) and DELETE /all (empty bin) routes.
 * Returns a state object capturing the mutation requests.
 */
async function stubRecycleApi(page, { records = [] } = {}) {
    const state = {
        lastRestoreUrl: null,
        lastDeleteUrl: null,
        emptyCount: 0,
    };

    await page.route(`**${APP_PATH}/api/v1/recycle**`, (route) => {
        const req = route.request();
        const url = new URL(req.url());

        if (req.method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: records }),
            });
        }

        if (req.method() === 'DELETE' && url.pathname.endsWith('/recycle/all')) {
            state.emptyCount += 1;
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ deleted: records.length }),
            });
        }

        if (req.method() === 'PUT') {
            state.lastRestoreUrl = req.url();
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Record restored' }),
            });
        }

        if (req.method() === 'DELETE') {
            state.lastDeleteUrl = req.url();
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Record permanently deleted' }),
            });
        }

        return route.fallback();
    });

    return state;
}

const RECYCLED_ITEM = {
    uuid: ITEM_UUID,
    type: 'item',
    title: 'Recycled sample item',
    is_member_of_exhibit: EXHIBIT_UUID,
    created_by: 'tester',
    is_deleted: 1,
};

test.describe('Recycle bin page (recycle.module.js)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        // The page gates on the Administrator role before rendering anything.
        await stubDashboardDeps(page, { role: { role: 'Administrator' } });
    });

    test('redirects non-administrators to /access-denied', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, { role: { role: 'User' } });
        await stubRecycleApi(page);

        await page.goto(`${APP_PATH}/recycle`);

        await page.waitForURL(new RegExp(`${APP_PATH}/access-denied`), { waitUntil: 'commit' });
    });

    test('renders recycled records with owner and type', async ({ page }) => {
        await stubRecycleApi(page, { records: [RECYCLED_ITEM] });

        await page.goto(`${APP_PATH}/recycle`);

        await expect(page.locator('#recycled-data tr')).toHaveCount(1);
        await expect(page.locator('.recycle-title')).toContainText('Recycled sample item');
        await expect(page.locator('.recycle-type')).toContainText('item');
        await expect(page.locator('#recycle-empty-state')).toBeHidden();
    });

    test('shows the empty state when the bin holds nothing', async ({ page }) => {
        await stubRecycleApi(page, { records: [] });

        await page.goto(`${APP_PATH}/recycle`);

        await expect(page.locator('#recycle-empty-state')).toBeVisible();
        await expect(page.locator('#recycled-table-wrap')).toBeHidden();
    });

    test('Restore PUTs to the record route with exhibit id, uuid, and type', async ({ page }) => {
        const state = await stubRecycleApi(page, { records: [RECYCLED_ITEM] });

        await page.goto(`${APP_PATH}/recycle`);
        await expect(page.locator('#recycled-data tr')).toHaveCount(1);

        await page.locator('.recycle-actions-toggle').click();
        await page.locator('.recycle-restore').click();

        await expect.poll(() => state.lastRestoreUrl).not.toBeNull();
        const u = new URL(state.lastRestoreUrl);
        expect(u.pathname).toBe(`${APP_PATH}/api/v1/recycle/${EXHIBIT_UUID}/${ITEM_UUID}/item`);
    });

    test('Permanently Delete requires modal confirmation before the DELETE fires', async ({ page }) => {
        const state = await stubRecycleApi(page, { records: [RECYCLED_ITEM] });

        await page.goto(`${APP_PATH}/recycle`);
        await expect(page.locator('#recycled-data tr')).toHaveCount(1);

        await page.locator('.recycle-actions-toggle').click();
        await page.locator('.recycle-delete').click();

        // Confirmation modal opens; nothing deleted yet.
        await expect(page.locator('#delete-confirm-modal')).toBeVisible();
        expect(state.lastDeleteUrl).toBeNull();

        await page.locator('#delete-confirm-btn').click();

        await expect.poll(() => state.lastDeleteUrl).not.toBeNull();
        const u = new URL(state.lastDeleteUrl);
        expect(u.pathname).toBe(`${APP_PATH}/api/v1/recycle/${EXHIBIT_UUID}/${ITEM_UUID}/item`);
    });

    test('Empty bin only enables after typing EMPTY, then DELETEs /recycle/all', async ({ page }) => {
        const state = await stubRecycleApi(page, { records: [RECYCLED_ITEM] });

        await page.goto(`${APP_PATH}/recycle`);
        await expect(page.locator('#recycled-data tr')).toHaveCount(1);

        await page.locator('#empty-recycle').click();
        await expect(page.locator('#empty-confirm-modal')).toBeVisible();
        await expect(page.locator('#empty-confirm-btn')).toBeDisabled();

        await page.fill('#empty-confirm-input', 'nope');
        await expect(page.locator('#empty-confirm-btn')).toBeDisabled();

        await page.fill('#empty-confirm-input', 'EMPTY');
        await expect(page.locator('#empty-confirm-btn')).toBeEnabled();

        await page.locator('#empty-confirm-btn').click();

        await expect.poll(() => state.emptyCount).toBe(1);
    });
});
