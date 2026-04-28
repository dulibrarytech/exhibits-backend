'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubUserRoleApi,
    stubUsersApi,
    userFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

async function stubUserPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    await stubUserRoleApi(page, opts.role);
}

test.describe('Users delete page (user.module.js — display_user / delete_user)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubUserPageDeps(page);
    });

    test('renders the delete confirmation card with the target user name', async ({ page }) => {
        await stubUsersApi(page, {
            record: userFixture({
                id: 2,
                first_name: 'Bob',
                last_name: 'Builder',
                role: 'User',
                is_active: 0,
            }),
        });

        await page.goto(`${APP_PATH}/users/delete?user_id=2`);

        await expect(page.locator('#delete-card')).toBeVisible();
        // The EJS init writes "<first> <last>" into #delete-user from
        // the array's first element (user[0]).
        await expect(page.locator('#delete-user')).toHaveText('Bob Builder');
        await expect(page.locator('#delete-user-btn')).toBeEnabled();
    });

    test('clicking Delete fires DELETE and redirects to /users on 204', async ({ page }) => {
        const state = await stubUsersApi(page, {
            record: userFixture({
                id: 2,
                first_name: 'Bob',
                last_name: 'Builder',
                role: 'User',
                is_active: 0,
            }),
        });

        await page.goto(`${APP_PATH}/users/delete?user_id=2`);
        await expect(page.locator('#delete-user-btn')).toBeEnabled();

        await page.click('#delete-user-btn');

        await expect.poll(() => state.deleteCount).toBeGreaterThan(0);
        expect(state.lastDeleteUrl).toMatch(/\/api\/v1\/users\/2(?:\?|$)/);

        // delete_user empties #delete-card on 204, writes the success
        // alert, then redirects after 900ms.
        await page.waitForURL(new RegExp(`${APP_PATH}/users(?:\\?|$)`), {
            waitUntil: 'commit',
        });
    });
});
