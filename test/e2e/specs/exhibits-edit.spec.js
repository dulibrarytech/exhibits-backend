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

test.describe('Edit exhibit form (exhibits.edit.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('populates form fields from the fetched record', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({
                    uuid: EXHIBIT_UUID,
                    title: 'Existing exhibit title',
                    subtitle: 'Existing subtitle',
                    description: 'Existing description',
                    about_the_curators: 'Existing curators copy',
                    is_featured: 1,
                    is_student_curated: 0,
                    is_published: 1,
                    created_by: 'tester',
                    created: '2026-04-01T00:00:00Z',
                }),
            },
        });
        await stubExhibitMediaBindingsApi(page);

        await page.goto(`${APP_PATH}/exhibits/exhibit/edit?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('#exhibit-title-input')).toHaveValue('Existing exhibit title');
        await expect(page.locator('#exhibit-sub-title-input')).toHaveValue('Existing subtitle');
        await expect(page.locator('#exhibit-description-input')).toHaveValue('Existing description');
        await expect(page.locator('#exhibit-about-the-curators-input')).toHaveValue('Existing curators copy');

        // is_featured: 1 in the fixture → checkbox checked.
        await expect(page.locator('#is-featured')).toBeChecked();
    });

    test('PUTs updated payload and shows success alert on 201', async ({ page }) => {
        const state = await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({
                    uuid: EXHIBIT_UUID,
                    title: 'Original title',
                    description: 'Original description',
                }),
            },
        });
        await stubExhibitMediaBindingsApi(page);

        await page.goto(`${APP_PATH}/exhibits/exhibit/edit?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#exhibit-title-input')).toHaveValue('Original title');

        await page.fill('#exhibit-title-input', 'Edited exhibit title');
        await page.fill('#exhibit-description-input', 'Edited description');

        const putPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}`
                && req.method() === 'PUT';
        });

        await page.click('#save-exhibit-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.title).toBe('Edited exhibit title');
        expect(state.lastUpdatePayload.description).toBe('Edited description');
        // Common form serializes these from hidden EJS inputs.
        expect(state.lastUpdatePayload.exhibit_template).toBe('vertical_scroll');

        await expect(page.locator('#message .alert-success')).toBeVisible();
    });

    test('disables form fields when record is locked by another user', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({
                    uuid: EXHIBIT_UUID,
                    title: 'Locked exhibit',
                    is_locked: 1,
                    locked_by_user: '999',
                }),
            },
        });
        await stubExhibitMediaBindingsApi(page);

        await page.goto(`${APP_PATH}/exhibits/exhibit/edit?exhibit_id=${EXHIBIT_UUID}`);

        // Lock detection mirrors the heading/grid/standard/timeline modules:
        // parseInt of profile.uid ('1' from seeded user) vs locked_by_user
        // ('999') → asymmetric → disable_form_fields runs.
        await expect(page.locator('#exhibit-title-input')).toBeDisabled();
        await expect(page.locator('#exhibit-description-input')).toBeDisabled();
    });
});
