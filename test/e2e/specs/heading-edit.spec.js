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

test.describe('Edit heading form (items.edit.heading.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('populates heading text and type from the fetched record', async ({ page }) => {
        await stubHeadingPageDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Heading host exhibit' }),
            },
        });
        await stubHeadingRecordsApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: headingFixture({
                uuid: HEADING_UUID,
                text: 'Existing heading copy',
                type: 'subheading',
                is_published: 1,
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(`${APP_PATH}/items/heading/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${HEADING_UUID}`);

        await expect(page.locator('#item-heading-text-input')).toHaveValue('Existing heading copy');
        await expect(page.locator('#item-heading-type-input')).toHaveValue('subheading');
        await expect(page.locator('#created')).toContainText(/Created by tester/);
    });

    test('PUTs updated payload and shows success alert on 201', async ({ page }) => {
        await stubHeadingPageDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        const state = await stubHeadingRecordsApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: headingFixture({
                uuid: HEADING_UUID,
                text: 'Original',
                type: 'heading',
            }),
        });

        await page.goto(`${APP_PATH}/items/heading/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${HEADING_UUID}`);
        await expect(page.locator('#item-heading-text-input')).toHaveValue('Original');

        await page.fill('#item-heading-text-input', 'Edited heading');
        await page.selectOption('#item-heading-type-input', 'subheading');

        const putPromise = page.waitForRequest((req) =>
            req.url().includes(`/api/v1/exhibits/${EXHIBIT_UUID}/headings/${HEADING_UUID}`)
            && req.method() === 'PUT'
        );

        await page.click('#save-heading-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.text).toBe('Edited heading');
        expect(state.lastUpdatePayload.type).toBe('subheading');

        await expect(page.locator('#message .alert-success')).toBeVisible();
    });

    test('disables form fields when record is locked by another user', async ({ page }) => {
        await stubHeadingPageDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        // Default seeded user has uid: '1'. Lock detection uses parseInt on
        // both sides, so a numeric-looking different value triggers the
        // "locked by other user" path.
        await stubHeadingRecordsApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: headingFixture({
                uuid: HEADING_UUID,
                is_locked: 1,
                locked_by_user: '999',
            }),
        });

        await page.goto(`${APP_PATH}/items/heading/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${HEADING_UUID}`);

        // Wait until the record has been applied to the form before
        // asserting on the disable side-effect.
        await expect(page.locator('#item-heading-text-input')).toBeDisabled();
        await expect(page.locator('#item-heading-type-input')).toBeDisabled();
    });

    test('applies a saved style preset to the styles dropdown', async ({ page }) => {
        await stubHeadingPageDeps(page, {
            exhibit: {
                record: exhibitFixture({
                    uuid: EXHIBIT_UUID,
                    styles: {
                        exhibit: {
                            heading1: { color: '#222', fontSize: '32px' },
                            heading2: { color: '#444', fontSize: '24px' },
                        },
                    },
                }),
            },
        });
        await stubHeadingRecordsApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: headingFixture({
                uuid: HEADING_UUID,
                styles: 'heading2',
            }),
        });

        await page.goto(`${APP_PATH}/items/heading/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${HEADING_UUID}`);

        // The styles card is hidden until at least one preset is found.
        await expect(page.locator('#item-style-select')).toBeVisible();
        await expect(page.locator('#item-style-select')).toHaveValue('heading2');
    });
});
