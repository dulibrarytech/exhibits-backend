'use strict';

// Regression: re-authentication after session expiry.
//
// When a session expires, re-auth lands back on /exhibits?t=<fresh>&id=<uid>
// while the OLD profile and OLD (expired) token are still in sessionStorage.
// homeModule.init used to gate the auth handshake on check_user_auth_data()
// alone — the stale profile made it skip get_auth_user_data(), the fresh
// ?t= token was discarded, and the very next check_auth 401'd and logged
// the brand-new session straight back out. These tests pin the fix: a token
// in the URL is always processed, stale profile or not.

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const { stubDashboardDeps, stubExhibitsApi } = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

// Long enough to pass save_token's 20-char minimum.
const FRESH_TOKEN = 'fresh-token-after-reauth-1234567890';

function stubAuthenticate(page) {
    return page.route('**/api/v1/authenticate*', (route) => {
        if (route.request().method() !== 'GET') {
            return route.fallback();
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                user_data: { id: '1', first_name: 'Play', last_name: 'Wright' },
            }),
        });
    });
}

test.describe('Re-auth handshake on the exhibits home page (home.module)', () => {

    test.beforeEach(async ({ page }) => {
        // Simulates the expired-session state: profile AND (stale) token are
        // still in sessionStorage from before the session expired.
        await seedAuth(page);
        await stubDashboardDeps(page);
        await stubExhibitsApi(page, { records: [] });
        await stubAuthenticate(page);
    });

    test('a fresh ?t= token replaces the stale session token even when a profile is present', async ({ page }) => {
        await page.goto(`${APP_PATH}/exhibits?t=${FRESH_TOKEN}&id=1`);

        // Page settles (exhibits list init completed without an auth bounce).
        await expect(page.locator('#message')).toContainText(/no exhibits found/i);

        const stored = await page.evaluate(() => {
            return JSON.parse(window.sessionStorage.getItem('exhibits_token'));
        });
        expect(stored.token).toBe(FRESH_TOKEN);
    });

    test('plain navigation without ?t= keeps the existing session token', async ({ page }) => {
        await page.goto(`${APP_PATH}/exhibits`);

        await expect(page.locator('#message')).toContainText(/no exhibits found/i);

        const stored = await page.evaluate(() => {
            return JSON.parse(window.sessionStorage.getItem('exhibits_token'));
        });
        // seedAuth's token object is preserved untouched.
        expect(stored.token).toBe('pw-test-token');
    });
});
