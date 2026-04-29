'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubUserRoleApi,
    stubUsersApi,
    stubAuthRolesApi,
    userFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

// User-admin pages live outside the per-exhibit nav, so we don't
// load stubDashboardDeps (which fetches a single exhibit record).
async function stubUserPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    // Default 'Administrator' so display_user_record's access-level
    // resolution lands on `editable` (not view-only). The view-only
    // fork is exercised separately if/when we choose to cover it.
    await stubUserRoleApi(page, { role: opts.role ?? 'Administrator' });
}

test.describe('Users edit page (user.module.js — display_user_record / update_user_record)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubUserPageDeps(page);
    });

    test('GET populates the form with the record fields', async ({ page }) => {
        await stubUsersApi(page, {
            record: userFixture({
                id: 1,
                first_name: 'Alice',
                last_name: 'Admin',
                email: 'alice@example.com',
                du_id: '1000001',
                role: 'Administrator',
            }),
        });
        // Roles dropdown — must register AFTER stubUserRoleApi (see
        // header on stubAuthRolesApi for why).
        await stubAuthRolesApi(page);

        await page.goto(`${APP_PATH}/users/edit?user_id=1`);

        await expect(page.locator('#first-name-input')).toHaveValue('Alice');
        await expect(page.locator('#last-name-input')).toHaveValue('Admin');
        await expect(page.locator('#email-input')).toHaveValue('alice@example.com');
        await expect(page.locator('#du-id-input')).toHaveValue('1000001');
    });

    test('clicking Save fires PUT with the form payload', async ({ page }) => {
        const state = await stubUsersApi(page, {
            record: userFixture({
                id: 1,
                first_name: 'Alice',
                last_name: 'Admin',
                email: 'alice@example.com',
                du_id: '1000001',
                role: 'Administrator',
            }),
        });
        await stubAuthRolesApi(page);

        await page.goto(`${APP_PATH}/users/edit?user_id=1`);

        // Wait for the form to populate before mutating it; otherwise
        // a race between display_user_record's GET and our fill could
        // leave the new value clobbered by the late-arriving response.
        await expect(page.locator('#first-name-input')).toHaveValue('Alice');
        // Wait for the role dropdown to populate (init runs list_roles
        // which fetches /auth/roles); selecting before that completes
        // would land on a stale '----------' option.
        await expect(page.locator('#user-roles option')).toHaveCount(4);

        await page.fill('#first-name-input', 'Alicia');
        await page.fill('#last-name-input', 'Admin');
        await page.fill('#email-input', 'alicia@example.com');
        await page.fill('#du-id-input', '1000001');
        await page.selectOption('#user-roles', { label: 'Administrator' });

        await page.click('#save-user-btn');

        await expect.poll(() => state.updateCount).toBeGreaterThan(0);
        expect(state.lastUpdatePayload).toMatchObject({
            first_name: 'Alicia',
            last_name: 'Admin',
            email: 'alicia@example.com',
            du_id: '1000001',
        });
        // role_id is the option value, which list_roles wires to the
        // numeric role id from /auth/roles (Administrator → '1').
        expect(state.lastUpdatePayload.role_id).toBe('1');
    });

    test('redirects to /users when the record GET returns 404', async ({ page }) => {
        // Server returns a 404 for "no such user". process_user_record
        // short-circuits when get_user_record yields a falsy value,
        // shows the alert, then schedules the redirect after 1s.
        await stubUsersApi(page, { recordStatus: 404 });
        await stubAuthRolesApi(page);

        await page.goto(`${APP_PATH}/users/edit?user_id=1`);

        await expect(page.locator('#message .alert-danger')).toContainText(
            /Unable to retrieve user record/i
        );
        await page.waitForURL(new RegExp(`${APP_PATH}/users(?:\\?|$)`), {
            waitUntil: 'commit',
        });
    });
});
