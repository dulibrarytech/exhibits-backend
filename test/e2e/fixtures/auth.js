'use strict';

/*
 * Seeds a logged-in dashboard client for the stubbed e2e suite. The client
 * keeps its session in sessionStorage (token + user profile); the endpoint
 * map and the app path are build constants inside the bundle, so nothing
 * else needs seeding.
 */

const DEFAULT_TOKEN = {
    token: 'pw-test-token',
    expires: Date.now() + 24 * 60 * 60 * 1000,
};

const DEFAULT_USER = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    uid: '1',
    name: 'Playwright Tester',
    role: 'admin',
    permissions: [
        'add_item',
        'add_item_to_any_exhibit',
        'update_item',
        'update_any_item',
        'add_exhibit',
        'update_exhibit',
        'update_any_exhibit',
        'delete_exhibit',
        'publish_exhibit',
    ],
};

/**
 * Seeds the session token and user profile before any page script runs.
 * @param {import('@playwright/test').Page} page
 * @param {{token?: Object, user?: Object}} [opts]
 */
async function seedAuth(page, opts = {}) {
    const token = JSON.stringify(opts.token ?? DEFAULT_TOKEN);
    const user = JSON.stringify(opts.user ?? DEFAULT_USER);

    await page.addInitScript(({ token, user }) => {
        try {
            window.sessionStorage.setItem('exhibits_token', token);
            window.sessionStorage.setItem('exhibits_user', user);
        } catch (_) {}
    }, { token, user });
}

module.exports = {
    seedAuth,
    DEFAULT_TOKEN,
    DEFAULT_USER,
};
