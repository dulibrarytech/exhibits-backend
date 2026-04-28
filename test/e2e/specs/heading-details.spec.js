'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubHeadingPageDeps,
    stubHeadingRecordsApi,
    exhibitFixture,
    headingFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const HEADING_UUID = '660e8400-e29b-41d4-a716-446655440099';

test.describe('Heading details page (items.details.heading.item.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubHeadingPageDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Heading host exhibit' }),
            },
        });
    });

    test('renders record fields read-only', async ({ page }) => {
        await stubHeadingRecordsApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: headingFixture({
                uuid: HEADING_UUID,
                text: 'Read-only heading',
                type: 'heading',
                is_published: 1,
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(`${APP_PATH}/items/heading/details?exhibit_id=${EXHIBIT_UUID}&item_id=${HEADING_UUID}`);

        await expect(page.locator('#item-heading-text-input')).toHaveValue('Read-only heading');
        await expect(page.locator('#item-heading-type-input')).toHaveValue('heading');

        // The details EJS renders inputs with the disabled attribute set.
        await expect(page.locator('#item-heading-text-input')).toBeDisabled();
        await expect(page.locator('#item-heading-type-input')).toBeDisabled();

        // Save button is hidden in details mode; Edit is the primary action.
        await expect(page.locator('#edit-item-btn')).toBeVisible();
    });

    test('clicking Edit navigates to the edit page with the same ids', async ({ page }) => {
        await stubHeadingRecordsApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: headingFixture({ uuid: HEADING_UUID }),
        });

        await page.goto(`${APP_PATH}/items/heading/details?exhibit_id=${EXHIBIT_UUID}&item_id=${HEADING_UUID}`);

        await page.click('#edit-item-btn');

        // waitUntil:'commit' fires when the URL change registers, without
        // waiting on the destination page's `load` event. The heading-edit
        // page pulls Bootstrap/jQuery from a CDN and under parallel-test
        // load those resources occasionally stall — see modified-24
        // README. Commit is the right semantic anyway: this assertion is
        // about navigation, not page-load completion.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/heading/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe(HEADING_UUID);
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await stubHeadingRecordsApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: headingFixture({ uuid: HEADING_UUID }),
        });

        await page.goto(
            `${APP_PATH}/items/heading/details`
            + `?exhibit_id=${EXHIBIT_UUID}&item_id=${HEADING_UUID}&status=403`
        );

        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });
});
