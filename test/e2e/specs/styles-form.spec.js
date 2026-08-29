'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

/*
 * Fills every empty style field inside the exhibit-styles partial so
 * exhibitsStylesModule.validate_required() passes: selects get their
 * first non-empty option, everything else gets a type-appropriate value.
 */
async function fill_required_style_fields(page) {
    await page.evaluate(() => {
        const sections = ['introduction', 'navigation', 'heading1', 'item1'];
        const suffixes = [
            '-background-color', '-font-color', '-font-size',
            '-font', '-margins', '-text-align',
        ];
        for (const section of sections) {
            for (const suffix of suffixes) {
                const el = document.getElementById(section + suffix);
                if (!el || el.value.trim() !== '') continue;
                if (el.tagName === 'SELECT') {
                    const option = Array.from(el.options).find((o) => o.value.trim() !== '');
                    if (option) el.value = option.value;
                } else if (suffix.includes('color')) {
                    el.value = '#336699';
                } else if (suffix === '-font-size') {
                    el.value = '16';
                } else {
                    el.value = 'test-value';
                }
            }
        }
    });
}

test.describe('Exhibit styles form page (exhibits.styles.form.module.js)', () => {
    let recordState;

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        recordState = await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Styled exhibit' }) },
        });
    });

    test('renders the styles form with Save and Cancel wired', async ({ page }) => {
        await page.goto(`${APP_PATH}/styles?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('#exhibit-submit-card')).toBeVisible();
        await expect(page.locator('#save-exhibit-btn')).toBeEnabled();
        await expect(page.locator('#cancel-exhibit-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Styled exhibit');
    });

    test('Save blocks with a required-fields warning when style fields are empty', async ({ page }) => {
        await page.goto(`${APP_PATH}/styles?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#exhibit-submit-card')).toBeVisible();

        await page.click('#save-exhibit-btn');

        await expect(page.locator('#message'))
            .toContainText('Please complete all required style fields');
        expect(recordState.updateCount).toBe(0);
    });

    test('Save PUTs the styles payload once required fields are filled', async ({ page }) => {
        await page.goto(`${APP_PATH}/styles?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#exhibit-submit-card')).toBeVisible();

        await fill_required_style_fields(page);
        await page.click('#save-exhibit-btn');

        await expect(page.locator('#message'))
            .toContainText('Exhibit styles updated successfully');
        expect(recordState.updateCount).toBe(1);
        expect(recordState.lastUpdatePayload).toHaveProperty('styles');
        expect(recordState.lastUpdatePayload.styles).not.toBeNull();
    });

    test('Cancel navigates to the exhibit details page', async ({ page }) => {
        await page.goto(`${APP_PATH}/styles?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#exhibit-submit-card')).toBeVisible();

        await page.click('#cancel-exhibit-btn');

        await page.waitForURL(
            new RegExp(`${APP_PATH}/exhibits/exhibit/details\\?exhibit_id=${EXHIBIT_UUID}`),
            { waitUntil: 'commit' }
        );
    });
});
