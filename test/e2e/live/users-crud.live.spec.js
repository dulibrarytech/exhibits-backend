'use strict';

/**
 * LIVE users CRUD + activate/deactivate — admin drives the real users UI;
 * every mutation is verified via the users API (real ctbl_user_roles role
 * assignment included). Uses throwaway `pw-e2e-tmp-*` users; the seeded role
 * users are never touched.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const { APP_PATH, apiCreateUser, apiFindUserByDuid, apiDeleteUser } = require('./fixtures/live-api');

function unique_du_id() {
    // Numeric, unique per test — satisfies the form's DU ID expectations.
    return `9${String(Date.now()).slice(-7)}${test.info().workerIndex}`;
}

test.describe('Users CRUD (live)', () => {

    let user_id = null;

    test.beforeEach(async ({ context, page }) => {
        await loginAs(context, page, 'administrator');
    });

    test.afterEach(async ({ request }) => {
        await apiDeleteUser(request, user_id);
        user_id = null;
    });

    test('creates a user through the add form', async ({ page, request }) => {

        const du_id = unique_du_id();

        await page.goto(`${APP_PATH}/users/add`);
        await expect(page.locator('#save-user-btn')).toBeVisible();

        await page.fill('#first-name-input', 'PW');
        await page.fill('#last-name-input', `Created-${du_id}`);
        await page.fill('#email-input', `${du_id}@du.edu`);
        await page.fill('#du-id-input', du_id);
        // Role options load from the real /auth/roles endpoint.
        await page.selectOption('#user-roles', { label: 'Student' });

        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/users`
                && resp.request().method() === 'POST';
        });

        await page.click('#save-user-btn');
        expect([200, 201]).toContain((await create_response).status());

        const user = await apiFindUserByDuid(request, du_id);
        expect(user).not.toBeNull();
        user_id = user.id;
        expect(Number(user.is_active)).toBe(1);
        // Role assignment persisted (ctbl_user_roles -> role name in the list).
        expect(String(user.role || '')).toContain('Student');
    });

    test('updates a user through the edit form', async ({ page, request }) => {

        const du_id = unique_du_id();
        const created = await apiCreateUser(request, { du_id });
        user_id = created.id;

        await page.goto(`${APP_PATH}/users/edit?user_id=${user_id}`);

        const last_name_input = page.locator('#last-name-input');
        await expect(last_name_input).toHaveValue('Throwaway', { timeout: 10_000 });

        await last_name_input.fill('Renamed');

        const put_response = page.waitForResponse((resp) =>
            resp.url().includes('/api/v1/users')
            && resp.request().method() === 'PUT'
        );

        await page.click('#save-user-btn');
        expect([200, 201, 204]).toContain((await put_response).status());

        const user = await apiFindUserByDuid(request, du_id);
        expect(user.last_name).toBe('Renamed');
    });

    test('deactivates and reactivates a user from the users list', async ({ page, request }) => {

        const du_id = unique_du_id();
        const created = await apiCreateUser(request, { du_id });
        user_id = created.id;

        await page.goto(`${APP_PATH}/users`);

        // Deactivate: the trigger is <a id="<user_id>" class="inactive-user">
        // (the class names the NEXT state).
        const deactivate = page.locator(`a.inactive-user[id="${user_id}"]`);
        await expect(deactivate).toBeVisible({ timeout: 15_000 });

        const deactivate_response = page.waitForResponse((resp) =>
            resp.url().includes(`/api/v1/users/status/${user_id}/0`)
            && resp.request().method() === 'PUT'
        );
        await deactivate.click();
        expect([200, 201, 204]).toContain((await deactivate_response).status());

        let user = await apiFindUserByDuid(request, du_id);
        expect(Number(user.is_active)).toBe(0);

        // Reactivate.
        const activate = page.locator(`a.active-user[id="${user_id}"]`);
        await expect(activate).toBeVisible({ timeout: 15_000 });

        const activate_response = page.waitForResponse((resp) =>
            resp.url().includes(`/api/v1/users/status/${user_id}/1`)
            && resp.request().method() === 'PUT'
        );
        await activate.click();
        expect([200, 201, 204]).toContain((await activate_response).status());

        user = await apiFindUserByDuid(request, du_id);
        expect(Number(user.is_active)).toBe(1);
    });

    test('deletes a user through the delete confirmation page', async ({ page, request }) => {

        const du_id = unique_du_id();
        const created = await apiCreateUser(request, { du_id });
        user_id = created.id;

        await page.goto(`${APP_PATH}/users/delete?user_id=${user_id}`);
        await expect(page.locator('#delete-user-btn')).toBeEnabled();

        const delete_response = page.waitForResponse((resp) =>
            resp.url().includes(`/api/v1/users/${user_id}`)
            && resp.request().method() === 'DELETE'
        );

        await page.click('#delete-user-btn');
        expect([200, 204]).toContain((await delete_response).status());

        const gone = await apiFindUserByDuid(request, du_id);
        expect(gone).toBeNull();
        user_id = null; // already deleted
    });
});
