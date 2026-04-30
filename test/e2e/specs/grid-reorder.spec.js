'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridItemsApi,
    exhibitFixture,
    gridItemFixture,
} = require('../fixtures/api-stubs');
const { dragRow } = require('../helpers/bootstrap');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '660e8400-e29b-41d4-a716-446655440100';

test.describe('Grid items — row reorder', () => {
    test('drags a row and POSTs new order to reorder endpoint', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
        });
        const state = await stubGridItemsApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            items: [
                gridItemFixture({
                    uuid: 'g1', order: 1, title: 'First',
                    is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
                }),
                gridItemFixture({
                    uuid: 'g2', order: 2, title: 'Second',
                    is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
                }),
                gridItemFixture({
                    uuid: 'g3', order: 3, title: 'Third',
                    is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
                }),
            ],
        });

        await page.goto(
            `${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );

        // DataTables init runs after the GET resolves. Wait for the rendered
        // rows before attempting to drag.
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);

        // Drag the first row's order-cell down past the third row's
        // order-cell. dragRow does a multi-step mouse.move so DataTables
        // RowReorder picks up the motion (a single jump won't trigger it).
        await dragRow(
            page,
            'table#grid-items tbody tr:nth-child(1) .item-order',
            'table#grid-items tbody tr:nth-child(3) .item-order'
        );

        // The 'row-reordered' event fires only when DataTables detects an
        // actual position change; reorderModule.reorder_grid_items then
        // POSTs the rebuilt order. Poll for capture.
        await expect.poll(
            () => state.lastReorderPayload,
            { timeout: 5000, message: 'expected reorder POST to be captured after drag' }
        ).not.toBeNull();

        expect(Array.isArray(state.lastReorderPayload)).toBe(true);
        expect(state.lastReorderPayload.length).toBeGreaterThan(0);

        // build_reorder_array (in reorder.module.js) emits objects with
        // string uuids — assert the shape so a malformed payload would be
        // visible without spec-coupling to the exact reorder.
        for (const entry of state.lastReorderPayload) {
            expect(typeof entry.uuid).toBe('string');
            expect(entry.uuid.length).toBeGreaterThan(0);
        }
    });

    // ─── Phase 4 / 5b': Move Up / Move Down dropdown items on grid items ─

    test('Move down on first grid row (via dropdown) swaps rows and POSTs entries tagged with grid_id and type=griditem', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
        });
        const state = await stubGridItemsApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            items: [
                gridItemFixture({
                    uuid: 'g1', order: 1, title: 'First',
                    is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
                }),
                gridItemFixture({
                    uuid: 'g2', order: 2, title: 'Second',
                    is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
                }),
                gridItemFixture({
                    uuid: 'g3', order: 3, title: 'Third',
                    is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
                }),
            ],
        });

        await page.goto(
            `${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );

        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);

        // Boundary disabling on render.
        await expect(
            page.locator('table#grid-items tbody tr:nth-child(1) [data-action="move-up"]')
        ).toBeDisabled();
        await expect(
            page.locator('table#grid-items tbody tr:nth-child(3) [data-action="move-down"]')
        ).toBeDisabled();

        // Phase 5b': Move Up / Move Down are dropdown items in the row's
        // actions menu. Open the first row's actions menu, then click the
        // Move Down item. The delegated handler in reorder.module.js
        // (attached to the table tbody) catches [data-action="move-down"]
        // regardless of which row or which container the trigger lives in.
        const first_grid_row = page.locator('table#grid-items tbody tr:nth-child(1)');
        await first_grid_row.locator('.item-actions-toggle').click();
        await first_grid_row.locator('[data-action="move-down"]').click();

        await expect.poll(
            () => state.lastReorderPayload,
            { timeout: 5000, message: 'expected keyboard-driven grid reorder POST to be captured' }
        ).not.toBeNull();

        expect(Array.isArray(state.lastReorderPayload)).toBe(true);
        expect(state.lastReorderPayload.length).toBe(3);

        for (const entry of state.lastReorderPayload) {
            expect(typeof entry.uuid).toBe('string');
            expect(entry.uuid.length).toBeGreaterThan(0);
            expect(entry.type).toBe('griditem');
            expect(entry.grid_id).toBe(GRID_UUID);
            expect(typeof entry.order).toBe('number');
        }
        const orders = state.lastReorderPayload.map(e => e.order);
        expect(orders).toEqual([1, 2, 3]);

        // First row (uuid 'g1') is now in slot 2.
        const second_row_id = await page.locator('table#grid-items tbody tr:nth-child(2)').getAttribute('id');
        expect(second_row_id).toMatch(/^g1/);

        // The polite live region was populated.
        await expect(page.locator('#reorder-status')).toContainText(/Moved .* to position 2 of 3/i);
    });
});
