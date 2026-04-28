'use strict';

const { defineConfig, devices } = require('@playwright/test');

const APP_HOST = process.env.APP_HOST || 'localhost';
const APP_PORT = process.env.APP_PORT || '3000';
const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const BASE_URL = process.env.BASE_URL || `http://${APP_HOST}:${APP_PORT}`;
const PW_MODE = process.env.PW_MODE || 'stub';

module.exports = defineConfig({
    testDir: './test/e2e/specs',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
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
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: PW_MODE === 'stub' ? {
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
    } : undefined,
});
