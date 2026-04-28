'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridItemRecordApi,
    exhibitFixture,
    gridItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440200';

test.describe('Edit grid text item form (items.edit.grid.item.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('populates form fields from the fetched record', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: ITEM_UUID,
                title: 'Existing item title',
                text: 'Existing item text',
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator('#item-title-input')).toHaveValue('Existing item title');
        await expect(page.locator('#item-text-input')).toHaveValue('Existing item text');
        await expect(page.locator('#created')).toContainText(/Created by tester/);
    });

    test('PUTs updated payload and shows success alert on 201', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        const state = await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: ITEM_UUID,
                text: 'Original',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );
        await expect(page.locator('#item-text-input')).toHaveValue('Original');

        await page.fill('#item-text-input', 'Edited item text');

        const putPromise = page.waitForRequest((req) =>
            req.url().includes(`/grids/${GRID_UUID}/items/${ITEM_UUID}`)
            && req.method() === 'PUT'
        );

        await page.click('#save-item-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.text).toBe('Edited item text');
        expect(state.lastUpdatePayload.item_type).toBe('text');

        // update_grid_item_record sets a success alert before the
        // smooth-clear timeout, so it's readable on the same page.
        await expect(page.locator('#message .alert-success')).toBeVisible();
    });

    test('disables form fields when record is locked by another user', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: ITEM_UUID,
                is_locked: 1,
                locked_by_user: '999',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/grid/item/text/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${ITEM_UUID}`
        );

        // Same lock-detection mechanic as heading-edit: parseInt of
        // profile.uid ('1' from the seeded user) vs locked_by_user
        // ('999') → asymmetric → disable_form_fields runs.
        await expect(page.locator('#item-title-input')).toBeDisabled();
        await expect(page.locator('#item-text-input')).toBeDisabled();
    });
});
