'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridRecordApi,
    exhibitFixture,
    gridRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';

test.describe('Edit grid form (items.edit.grid.form.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
    });

    test('populates form fields from the fetched record', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({
                uuid: GRID_UUID,
                text: 'Existing grid text',
                columns: 6,
                created_by: 'tester',
                created: '2026-04-01T00:00:00Z',
            }),
        });

        await page.goto(`${APP_PATH}/items/grid/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);

        await expect(page.locator('#grid-text-input')).toHaveValue('Existing grid text');
        await expect(page.locator('#grid-columns')).toHaveValue('6');
        await expect(page.locator('#created')).toContainText(/Created by tester/);
    });

    test('PUTs updated payload and shows success alert on 201', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        const state = await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({
                uuid: GRID_UUID,
                text: 'Original',
                columns: 3,
            }),
        });

        await page.goto(`${APP_PATH}/items/grid/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);
        await expect(page.locator('#grid-text-input')).toHaveValue('Original');

        await page.fill('#grid-text-input', 'Edited grid');
        await page.fill('#grid-columns', '6');

        const putPromise = page.waitForRequest((req) =>
            req.url().includes(`/api/v1/exhibits/${EXHIBIT_UUID}/grids/${GRID_UUID}`)
            && req.method() === 'PUT'
        );

        await page.click('#save-item-btn');
        await putPromise;

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.text).toBe('Edited grid');
        expect(state.lastUpdatePayload.columns).toBe('6');

        // update_grid_record refreshes the form in place (no reload),
        // setting the success alert and auto-dismissing it after 3s.
        await expect(page.locator('#message .alert-success')).toBeVisible();
    });

    test('applies a saved style preset to the styles dropdown', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({
                    uuid: EXHIBIT_UUID,
                    styles: {
                        exhibit: {
                            item1: { color: '#222', fontSize: '16px' },
                            item2: { color: '#444', fontSize: '14px' },
                        },
                    },
                }),
            },
        });
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({
                uuid: GRID_UUID,
                styles: 'item2',
            }),
        });

        await page.goto(`${APP_PATH}/items/grid/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);

        // Common module hides the style dropdown until at least one preset
        // is found, then populates options keyed `item1`/`item2`/`item3`.
        await expect(page.locator('#item-style-select')).toBeVisible();
        await expect(page.locator('#item-style-select')).toHaveValue('item2');
    });
});
