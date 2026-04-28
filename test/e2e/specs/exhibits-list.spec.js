'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubExhibitsApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

test.describe('Exhibits list page', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        // exhibitsModule.init -> check_auth posts /api/v1/exhibits/verify;
        // without this stub the page redirects to auth and #exhibits never
        // appears.
        await stubDashboardDeps(page);
    });

    test('renders DataTables rows from API', async ({ page }) => {
        await stubExhibitsApi(page, {
            records: [
                exhibitFixture({ uuid: 'a', title: 'Alpha exhibit' }),
                exhibitFixture({ uuid: 'b', title: 'Bravo exhibit' }),
            ],
        });

        await page.goto(`${APP_PATH}/exhibits`);

        await expect(page.locator('#exhibits tbody tr')).toHaveCount(2);
        await expect(page.getByText('Alpha exhibit')).toBeVisible();
        await expect(page.getByText('Bravo exhibit')).toBeVisible();
    });

    test('shows empty-state when API returns no records', async ({ page }) => {
        await stubExhibitsApi(page, { records: [] });

        await page.goto(`${APP_PATH}/exhibits`);

        // exhibits.module.js display_exhibits() calls clear_exhibits_display()
        // (which empties #exhibit-card and removes the #exhibits table) and
        // then domModule.set_alert('#message', 'info', 'No Exhibits found.').
        // The user-visible signal is the message, not the now-removed table.
        await expect(page.locator('#message')).toContainText(/no exhibits found/i);
    });
});
