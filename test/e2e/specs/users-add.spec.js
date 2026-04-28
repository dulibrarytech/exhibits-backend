'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubUserRoleApi,
    stubUsersApi,
    stubAuthRolesApi,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

async function stubUserPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    // Default 'Administrator' so check_add_user_permission resolves
    // truthy and the form initializes. The non-admin branch is
    // exercised by the 'permission denied' test below with role:'User'.
    await stubUserRoleApi(page, { role: opts.role ?? 'Administrator' });
}

test.describe('Users add page (user.module.js — save_user_record)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('renders the empty form when current user is an Administrator', async ({ page }) => {
        await stubUserPageDeps(page);
        await stubUsersApi(page);
        await stubAuthRolesApi(page);

        await page.goto(`${APP_PATH}/users/add`);

        await expect(page.locator('#user-form')).toBeVisible();
        await expect(page.locator('#first-name-input')).toHaveValue('');
        await expect(page.locator('#email-input')).toHaveValue('');
        await expect(page.locator('#save-user-btn')).toBeVisible();
        // Roles dropdown populated by userModule.init() → list_roles.
        // 2 default options + 2 from stubAuthRolesApi default.
        await expect(page.locator('#user-roles option')).toHaveCount(4);
    });

    test('Save POSTs the form payload and redirects to the new edit page', async ({ page }) => {
        await stubUserPageDeps(page);
        const state = await stubUsersApi(page, { newUserId: 99 });
        await stubAuthRolesApi(page);

        await page.goto(`${APP_PATH}/users/add`);
        await expect(page.locator('#user-roles option')).toHaveCount(4);

        await page.fill('#first-name-input', 'New');
        await page.fill('#last-name-input', 'User');
        await page.fill('#email-input', 'new@example.com');
        await page.fill('#du-id-input', '7000007');
        await page.selectOption('#user-roles', { label: 'User' });

        await page.click('#save-user-btn');

        await expect.poll(() => state.createCount).toBeGreaterThan(0);
        expect(state.lastCreatePayload).toMatchObject({
            first_name: 'New',
            last_name: 'User',
            email: 'new@example.com',
            du_id: '7000007',
        });
        // Role 'User' → id 2 in the stubAuthRolesApi default fixture.
        expect(state.lastCreatePayload.role_id).toBe('2');

        // save_user_record reads response.data.user.data.id (= newUserId)
        // and redirects to /users/edit?user_id=<id> after 900ms.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/users/edit\\?user_id=99`),
            { waitUntil: 'commit' }
        );
    });

    test('shows permission-denied alert when current user is not an Administrator', async ({ page }) => {
        await stubUserPageDeps(page, { role: 'User' });
        // No need to stub the users API or roles — the IIFE in
        // dashboard-add-user.ejs short-circuits before list_roles or
        // any user-CRUD call when check_add_user_permission returns
        // false.

        await page.goto(`${APP_PATH}/users/add`);

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission to add users/i
        );
    });
});
