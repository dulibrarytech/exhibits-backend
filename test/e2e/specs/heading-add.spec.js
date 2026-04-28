'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubHeadingPageDeps,
    stubHeadingRecordsApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

test.describe('Add heading form (items.add.heading.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubHeadingPageDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Heading host exhibit' }),
            },
        });
    });

    test('renders the heading data card with required fields', async ({ page }) => {
        await stubHeadingRecordsApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/heading?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('#item-heading-text-input')).toBeVisible();
        await expect(page.locator('#item-heading-type-input')).toBeVisible();
        await expect(page.locator('#save-heading-btn')).toBeEnabled();
        await expect(page.locator('#exhibit-title')).toContainText('Heading host exhibit');
    });

    test('blocks submit when heading text is empty', async ({ page }) => {
        const state = await stubHeadingRecordsApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/heading?exhibit_id=${EXHIBIT_UUID}`);

        // Pick a type but leave text empty.
        await page.selectOption('#item-heading-type-input', 'heading');
        await page.click('#save-heading-btn');

        // The common module sets a "Please enter heading text" alert, but
        // create_heading_record then overwrites it with this generic one.
        // We assert the user-visible final state, not the intermediate.
        await expect(page.locator('#message .alert-danger')).toContainText(
            /invalid form data/i
        );
        expect(state.createCount).toBe(0);
    });

    test('blocks submit when heading type is empty', async ({ page }) => {
        const state = await stubHeadingRecordsApi(page, { exhibitId: EXHIBIT_UUID });

        await page.goto(`${APP_PATH}/items/heading?exhibit_id=${EXHIBIT_UUID}`);

        await page.fill('#item-heading-text-input', 'Some heading');
        // Leave type select on the empty default option.
        await page.click('#save-heading-btn');

        await expect(page.locator('#message .alert-danger')).toContainText(
            /invalid form data/i
        );
        expect(state.createCount).toBe(0);
    });

    test('POSTs serialized payload and redirects to edit on 201', async ({ page }) => {
        const state = await stubHeadingRecordsApi(page, {
            exhibitId: EXHIBIT_UUID,
            newItemId: 'heading-uuid-new',
        });

        await page.goto(`${APP_PATH}/items/heading?exhibit_id=${EXHIBIT_UUID}`);

        // Wait for the save button click handler to be wired (init() is async).
        await expect(page.locator('#save-heading-btn')).toBeEnabled();

        await page.fill('#item-heading-text-input', 'New heading text');
        await page.selectOption('#item-heading-type-input', 'heading');

        const postPromise = page.waitForRequest((req) =>
            req.url().includes(`/api/v1/exhibits/${EXHIBIT_UUID}/headings`) && req.method() === 'POST'
        );

        await page.click('#save-heading-btn');
        await postPromise;

        await expect.poll(() => state.lastCreatePayload).not.toBeNull();
        expect(state.lastCreatePayload.text).toBe('New heading text');
        expect(state.lastCreatePayload.type).toBe('heading');

        // Module redirects to /items/heading/edit?... after success. Wait
        // for the navigation to *commit* rather than the default 'load':
        // the heading-edit page pulls Bootstrap/jQuery from a CDN, and
        // under parallel-test load those resources occasionally stall,
        // delaying the load event past the 30s test timeout. Commit
        // fires as soon as the URL changes, which is what these
        // assertions actually depend on.
        await page.waitForURL(
            new RegExp(`${APP_PATH}/items/heading/edit`),
            { waitUntil: 'commit' }
        );
        const url = new URL(page.url());
        expect(url.searchParams.get('exhibit_id')).toBe(EXHIBIT_UUID);
        expect(url.searchParams.get('item_id')).toBe('heading-uuid-new');
    });

    test('does not POST when item_id is already present (edit mode guard)', async ({ page }) => {
        const state = await stubHeadingRecordsApi(page, { exhibitId: EXHIBIT_UUID });

        // Land on the add page but with item_id present — module should bail
        // out of create_heading_record. update_item_heading_record is undefined
        // here, so it shows a warning rather than POSTing.
        await page.goto(`${APP_PATH}/items/heading?exhibit_id=${EXHIBIT_UUID}&item_id=existing-heading-uuid`);

        await page.fill('#item-heading-text-input', 'Should not be sent');
        await page.selectOption('#item-heading-type-input', 'heading');
        await page.click('#save-heading-btn');

        // Give the page a moment to settle so a stray POST would be observed.
        await page.waitForTimeout(250);

        expect(state.createCount).toBe(0);
    });
});
