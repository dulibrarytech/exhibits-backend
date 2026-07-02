'use strict';

const { defineConfig, devices } = require('@playwright/test');

// Two modes, selected by PW_MODE:
//
//   stub (default) — the existing client-behavior suite (test/e2e/specs).
//     Boots the real server with the test auth bypass; every data API is
//     intercepted in-browser by test/e2e/fixtures/api-stubs.js. Fast and
//     fully deterministic.
//
//   live — the full-stack workflow suite (test/e2e/live). Boots the real
//     server against a dedicated e2e database (E2E_DB_NAME, default
//     exhibits_e2e) with NO auth bypass: global-setup migrates/seeds the DB,
//     creates one user per role, and mints real JWTs via libs/tokens.create,
//     so verify()/authorize run for real. Media storage is pointed at a
//     scratch dir so live uploads never pollute real storage.
//
const PW_MODE = process.env.PW_MODE || 'stub';
const IS_LIVE = PW_MODE === 'live';

const APP_HOST = process.env.APP_HOST || 'localhost';
// Live gets its own default port so it never collides with a running dev
// instance or a stub run.
const APP_PORT = process.env.APP_PORT || (IS_LIVE ? '3001' : '3000');
const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const BASE_URL = process.env.BASE_URL || `http://${APP_HOST}:${APP_PORT}`;
const E2E_DB_NAME = process.env.E2E_DB_NAME || 'exhibits_e2e';

// Pin the resolved values back into process.env. This file is re-evaluated in
// every worker process, and workers INHERIT the runner's env — so anything that
// mutates the runner's env between evaluations (e.g. a dotenv load pulling the
// backend .env, whose APP_PORT points at the DEV instance) would silently
// re-resolve baseURL to a different server in workers. Pinning makes every
// evaluation deterministic: first resolution wins, everywhere.
process.env.APP_HOST = APP_HOST;
process.env.APP_PORT = APP_PORT;
process.env.APP_PATH = APP_PATH;
process.env.BASE_URL = BASE_URL;
process.env.E2E_DB_NAME = E2E_DB_NAME;

module.exports = defineConfig({
    testDir: IS_LIVE ? './test/e2e/live' : './test/e2e/specs',
    globalSetup: IS_LIVE ? './test/e2e/live/global-setup.js' : undefined,
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : (IS_LIVE ? 1 : 0),
    workers: process.env.CI ? 2 : undefined,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],
    use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 10_000,
    },
    projects: [
        {
            name: IS_LIVE ? 'chromium-live' : 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: IS_LIVE ? {
        command: 'node exhibits-backend.js',
        // The exhibits page 302s to SSO for an unauthenticated probe — any
        // non-5xx response satisfies Playwright's readiness check.
        url: `${BASE_URL}${APP_PATH}/exhibits`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
            // Real auth end-to-end: NODE_ENV=test alone does NOT arm the
            // bypass (two-key gate) — EXHIBITS_TEST_AUTH_BYPASS is deliberately
            // NOT set here.
            NODE_ENV: 'test',
            APP_HOST,
            APP_PORT,
            APP_PATH,
            DB_NAME: E2E_DB_NAME,
            STORAGE_PATH: './test/e2e/live/.storage',
        },
    } : {
        command: 'node exhibits-backend.js',
        url: `${BASE_URL}${APP_PATH}/exhibits`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
            NODE_ENV: 'test',
            APP_HOST,
            APP_PORT,
            APP_PATH,
            // Enables the test-only auth bypass in libs/tokens.js. The
            // bypass also requires NODE_ENV=test, set above. Both must
            // match for verify()/verify_with_query() to short-circuit.
            EXHIBITS_TEST_AUTH_BYPASS: '1',
        },
    },
});
