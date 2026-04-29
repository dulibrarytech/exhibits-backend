'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    exhibitFixture,
    standardItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440300';

test.describe('Edit standard text item form (items.edit.standard.item.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('populates text field from the fetched record', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID,
                text: 'Existing item text',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/text/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator('#item-text-input')).toHaveValue('Existing item text');
        await expect(page.locator('#created')).toContainText(/Created by tester/);
    });

    test('PUTs updated payload via #save-item-btn and shows success', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        const state = await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID,
                text: 'Original',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/text/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`
        );
        await expect(page.locator('#item-text-input')).toHaveValue('Original');

        await page.fill('#item-text-input', 'Edited item text');

        const putPromise = page.waitForRequest((req) =>
            req.url().includes(`/exhibits/${EXHIBIT_UUID}/items/${ITEM_UUID}`)
            && req.method() === 'PUT'
        );

        await page.click('#save-item-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.text).toBe('Edited item text');
        expect(state.lastUpdatePayload.item_type).toBe('text');

        await expect(page.locator('#message .alert-success')).toBeVisible();
    });

    test('disables form fields when record is locked by another user', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID,
                is_locked: 1,
                locked_by_user: '999',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/text/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`
        );

        // Same lock-detection mechanic as heading-edit/grid-item-edit.
        await expect(page.locator('#item-text-input')).toBeDisabled();
    });
});
