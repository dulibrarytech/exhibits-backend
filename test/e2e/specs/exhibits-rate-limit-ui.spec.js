'use strict';

/**
 * 429 handling in the exhibits UI (exhibits.module.js).
 *
 * The server's rate limiters answer 429 with a JSON body whose `message`
 * names the exhausted tier; the client's publish and delete flows surface
 * that message as a warning alert instead of failing silently or showing
 * a generic error. These specs pin that contract — the limiter behavior
 * itself is covered in test/integration/auth_rate_limit.test.js.
 */

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubExhibitsApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

// Mirrors the loader's rate_limit response envelope.
const RATE_LIMIT_BODY = JSON.stringify({
    success: false,
    message: 'Too many state-change operations',
    data: null,
});

test.describe('Rate-limit (429) handling in the exhibits UI', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Throttled exhibit' }) },
        });
    });

    test('publish answered with 429 surfaces the limiter message as a warning', async ({ page }) => {
        await stubExhibitsApi(page, {
            records: [exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Throttled exhibit', is_published: 0 })],
        });

        await page.route(
            `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/publish`,
            (route) => {
                if (route.request().method() !== 'POST') {
                    return route.fallback();
                }
                return route.fulfill({
                    status: 429,
                    contentType: 'application/json',
                    body: RATE_LIMIT_BODY,
                });
            }
        );

        await page.goto(`${APP_PATH}/exhibits`);
        await expect(page.locator('#exhibits tbody tr')).toHaveCount(1);

        // The list's status toggle carries a "-status" id suffix.
        await page.locator(`a.publish-exhibit[id="${EXHIBIT_UUID}-status"]`).click();

        await expect(page.locator('#message')).toContainText('Too many state-change operations');
        await expect(page.locator('#message .alert-warning')).toBeVisible();

        // The row must NOT flip to published on a throttled request.
        await expect(page.locator(`a.publish-exhibit[id="${EXHIBIT_UUID}-status"]`)).toBeVisible();
    });

    test('delete answered with 429 surfaces the limiter message as a warning', async ({ page }) => {
        await page.route(
            `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}**`,
            (route) => {
                if (route.request().method() !== 'DELETE') {
                    return route.fallback();
                }
                return route.fulfill({
                    status: 429,
                    contentType: 'application/json',
                    body: RATE_LIMIT_BODY,
                });
            }
        );

        await page.goto(`${APP_PATH}/exhibits/exhibit/delete?exhibit_id=${EXHIBIT_UUID}`);
        // The click listener is attached only after the view's async init
        // resolves; show_form() reveals the card at the same point.
        await expect(page.locator('#delete-card')).toBeVisible();

        await page.click('#delete-exhibit-btn');

        await expect(page.locator('#message')).toContainText('Too many state-change operations');
        await expect(page.locator('#message .alert-warning')).toBeVisible();
    });
});
