'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubExhibitMediaBindingsApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Exhibit details page (exhibits.details.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('renders record fields and disables them after population', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({
                    uuid: EXHIBIT_UUID,
                    title: 'Read-only exhibit',
                    subtitle: 'Read-only subtitle',
                    description: 'Read-only description',
                    is_published: 1,
                    created_by: 'tester',
                    created: '2026-04-01T00:00:00Z',
                }),
            },
        });
        await stubExhibitMediaBindingsApi(page);

        await page.goto(`${APP_PATH}/exhibits/exhibit/details?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('#exhibit-title-input')).toHaveValue('Read-only exhibit');
        await expect(page.locator('#exhibit-sub-title-input')).toHaveValue('Read-only subtitle');
        await expect(page.locator('#exhibit-description-input')).toHaveValue('Read-only description');

        // The details init() runs a `forEach(el => el.disabled = true)` sweep
        // over visible inputs/textareas/selects after population. The
        // partials don't have `disabled` baked in — the runtime sweep
        // is the only mechanism keeping the page read-only.
        await expect(page.locator('#exhibit-title-input')).toBeDisabled();
        await expect(page.locator('#exhibit-description-input')).toBeDisabled();

        // Save button is hidden on details mode; Edit is the primary action.
        await expect(page.locator('#edit-item-btn')).toBeVisible();
    });

    test('clicking Edit navigates to the edit page with the same exhibit_id', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubExhibitMediaBindingsApi(page);

        await page.goto(`${APP_PATH}/exhibits/exhibit/details?exhibit_id=${EXHIBIT_UUID}`);

        await page.click('#edit-item-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/exhibits/exhibit/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubExhibitMediaBindingsApi(page);

        await page.goto(
            `${APP_PATH}/exhibits/exhibit/details?exhibit_id=${EXHIBIT_UUID}&status=403`
        );

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });
});
