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

// The list page is the only user-administration page that doesn't
// fetch a single exhibit record on load — it lives outside the
// per-exhibit nav. So we don't use stubDashboardDeps here; the
// individual permission/verify/role stubs are enough.
async function stubUserPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    await stubUserRoleApi(page, opts.role);
}

test.describe('Users list page (user.module.js — display_user_records)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubUserPageDeps(page);
    });

    test('renders user rows returned from the API', async ({ page }) => {
        // Current user (uid='1' from DEFAULT_USER) is included with
        // role Administrator so is_current_user_admin returns true and
        // the rendered rows include the deactivate-link variant for
        // active non-self users.
        await stubUsersApi(page, {
            users: [
                userFixture({ id: 1, first_name: 'Alice', last_name: 'Admin', role: 'Administrator', is_active: 1 }),
                userFixture({ id: 2, first_name: 'Bob',   last_name: 'Builder', role: 'User',          is_active: 1 }),
                userFixture({ id: 3, first_name: 'Cara',  last_name: 'Curator', role: 'User',          is_active: 0 }),
            ],
        });

        await page.goto(`${APP_PATH}/users`);

        await expect(page.locator('#user-data tr')).toHaveCount(3);
        await expect(page.getByText('Alice Admin')).toBeVisible();
        await expect(page.getByText('Bob Builder')).toBeVisible();
        await expect(page.getByText('Cara Curator')).toBeVisible();
    });

    test('shows empty-state info alert when API returns no users', async ({ page }) => {
        await stubUsersApi(page, { users: [] });

        await page.goto(`${APP_PATH}/users`);

        // display_user_records empties the .card and writes the
        // "No User Profiles found." info alert into #message.
        await expect(page.locator('#message .alert-info')).toContainText(
            /No User Profiles found/i
        );
    });

    test('shows permission-denied alert when API returns 403', async ({ page }) => {
        // get_user_records swallows non-200 responses to undefined,
        // which display_user_records treats as the no-permission
        // branch (hides #add-user, writes the alert).
        await stubUsersApi(page, { listStatus: 403 });

        await page.goto(`${APP_PATH}/users`);

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission to view users/i
        );
    });

    test('clicking the deactivate link PUTs to the user-status endpoint', async ({ page }) => {
        const state = await stubUsersApi(page, {
            users: [
                userFixture({ id: 1, first_name: 'Alice', last_name: 'Admin',   role: 'Administrator', is_active: 1 }),
                userFixture({ id: 2, first_name: 'Bob',   last_name: 'Builder', role: 'User',          is_active: 1 }),
            ],
        });

        await page.goto(`${APP_PATH}/users`);

        // Wait for DataTables to wire up the row delegation. The
        // deactivate trigger is the <a id="<user_id>" class="inactive-user">
        // wrapping the status icon (the class name reflects the NEXT
        // state — clicking it deactivates the currently-active user).
        await expect(page.locator('a.inactive-user[id="2"]')).toBeVisible();

        await page.locator('a.inactive-user[id="2"]').click();

        await expect.poll(() => state.statusCount).toBeGreaterThan(0);
        // Endpoint shape: /api/v1/users/status/:id/:is_active
        // (clicking deactivate sends is_active=0).
        expect(state.lastStatusUrl).toMatch(/\/api\/v1\/users\/status\/2\/0(?:\?|$)/);
    });
});
