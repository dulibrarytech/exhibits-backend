'use strict';

/**
 * LIVE smoke: every role signs in with a real minted JWT and lands on the real
 * exhibits dashboard.
 *
 * What each case proves end-to-end (no stubs anywhere):
 *   1. verify_page accepts the real JWT cookie — the page renders instead of
 *      bouncing to the DU SSO entry.
 *   2. The client calls the REAL exhibits API with the JWT (x-access-token) and
 *      gets 200 — token signature, verify(), and MySQL round trip all real.
 *   3. Role-based nav gating runs against the REAL /auth/role endpoint
 *      (ctbl_user_roles): Admin Utils is revealed for Administrator and stays
 *      hidden (fail-closed) for Power/General/Student.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const CASES = [
    { key: 'administrator', label: 'Administrator', sees_admin_utils: true },
    { key: 'power', label: 'Power User', sees_admin_utils: false },
    { key: 'general', label: 'General User', sees_admin_utils: false },
    { key: 'student', label: 'Student', sees_admin_utils: false }
];

for (const role of CASES) {

    test.describe(`${role.label}`, () => {

        test(`signs in and loads the real exhibits dashboard (Admin Utils ${role.sees_admin_utils ? 'visible' : 'hidden'})`, async ({ context, page, baseURL }) => {

            await loginAs(context, page, role.key);

            // Arm the API-response watcher before navigating: the list page fires
            // GET /api/v1/exhibits on load — a full real round trip (JWT -> verify
            // -> model -> MySQL).
            const exhibits_api = page.waitForResponse((resp) =>
                resp.url().includes('/api/v1/exhibits')
                && resp.request().method() === 'GET'
            );

            await page.goto(`${APP_PATH}/exhibits`);

            // 0. We are on the LIVE e2e server — origin (incl. PORT) must match the
            // project baseURL. Guards against env drift re-pointing workers at a
            // different local instance (a path-only URL check can't catch that).
            expect(page.url().startsWith(baseURL)).toBeTruthy();

            // 1. Authenticated page render — not bounced to the SSO entry.
            await expect(page).toHaveURL(new RegExp(`${APP_PATH.replace(/\//g, '\\/')}\\/exhibits`));
            await expect(page.locator('h1')).toHaveText('Exhibits');

            // 2. Real API + real DB answered the list call.
            const api_response = await exhibits_api;
            expect(api_response.status()).toBe(200);

            // 3. Role gating against the real /auth/role endpoint. The gate is
            // fail-closed: `.admin-only-nav` stays CSS-hidden unless the resolved
            // role is Administrator.
            const admin_utils = page.locator('#admin-utils-link');

            if (role.sees_admin_utils) {
                await expect(admin_utils).toBeVisible({ timeout: 10_000 });
            } else {
                // Give the gate its bounded profile-wait + role call, then assert
                // the link never revealed.
                await page.waitForTimeout(1_000);
                await expect(admin_utils).toBeHidden();
            }
        });
    });
}
