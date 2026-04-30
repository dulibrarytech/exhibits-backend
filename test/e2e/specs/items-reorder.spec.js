'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubMixedItemsListApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');
const { dragRow } = require('../helpers/bootstrap');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

// Items.module.js renders rows with id `${uuid}_${item_type}_${type}`.
// reorder.module.js parse_item_id splits on '_' and parses 3-part ids
// as `{uuid: parts[0], type: parts[2]}`. So a row with
// id="abc_text_item" parses to `{uuid: 'abc', type: 'item'}`.
//
// Builds a minimal standard-text item that itemsListDisplayModule.display_standard_items
// renders without error (no media URL paths exercised when item_type === 'text').
function standardTextItem(overrides = {}) {
    return {
        uuid: 'a',
        type: 'item',           // discriminator for items.module.js dispatch
        item_type: 'text',      // keeps display_standard_items off the media path
        title: 'Sample item',
        order: 1,
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: EXHIBIT_UUID,
        ...overrides,
    };
}

test.describe('Items list page — row reorder (items.module.js + reorder.module.js)', () => {

    test('drags a row and POSTs new order to /items/reorder', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
        const state = await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                standardTextItem({ uuid: 'a', title: 'First',  order: 1 }),
                standardTextItem({ uuid: 'b', title: 'Second', order: 2 }),
                standardTextItem({ uuid: 'c', title: 'Third',  order: 3 }),
            ],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);

        // DataTables init runs after the GET resolves. Wait for the rows.
        await expect(page.locator('table#items tbody tr')).toHaveCount(3);

        // Drag the first row's order-cell down past the third row's
        // order-cell. dragRow does a multi-step mouse.move so DataTables
        // RowReorder picks up the motion (a single jump won't trigger).
        await dragRow(
            page,
            'table#items tbody tr:nth-child(1) .item-order',
            'table#items tbody tr:nth-child(3) .item-order'
        );

        // Module wires `row-reordered` → reorderModule.reorder_items, which
        // POSTs the rebuilt order via build_reorder_array. Each entry has
        // {uuid, type, order}.
        await expect.poll(
            () => state.lastReorderPayload,
            { timeout: 5000, message: 'expected items reorder POST to be captured after drag' }
        ).not.toBeNull();

        expect(Array.isArray(state.lastReorderPayload)).toBe(true);
        expect(state.lastReorderPayload.length).toBeGreaterThan(0);

        for (const entry of state.lastReorderPayload) {
            expect(typeof entry.uuid).toBe('string');
            expect(entry.uuid.length).toBeGreaterThan(0);
            // build_reorder_array sets `type` from parse_item_id
            // (parts[2] in the 3-part tr id). For standard items the
            // discriminator is 'item'.
            expect(entry.type).toBe('item');
            expect(typeof entry.order).toBe('number');
        }

        // grid-reorder.spec.js stops here too — the spec validates the
        // wiring (event → reorder POST shape), not DataTables internals.
    });

    // ─── Phase 4 / 5b': Move Up / Move Down dropdown items ───────────────

    test('renders Move up / Move down dropdown items in each row actions menu with boundary disabling', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
        await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                standardTextItem({ uuid: 'a', title: 'First',  order: 1 }),
                standardTextItem({ uuid: 'b', title: 'Second', order: 2 }),
                standardTextItem({ uuid: 'c', title: 'Third',  order: 3 }),
            ],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('table#items tbody tr')).toHaveCount(3);

        // Every row carries one Move Up + one Move Down dropdown item.
        // (They're emitted under their data-action attributes regardless
        // of whether the dropdown is open — Bootstrap toggles visibility,
        // not presence.)
        await expect(page.locator('table#items tbody tr [data-action="move-up"]')).toHaveCount(3);
        await expect(page.locator('table#items tbody tr [data-action="move-down"]')).toHaveCount(3);

        // Items live as <button class="dropdown-item"> in the actions
        // menu (NOT in the order cell).
        const middle_up = page.locator('table#items tbody tr:nth-child(2) [data-action="move-up"]');
        await expect(middle_up).toHaveClass(/dropdown-item/);
        await expect(middle_up.locator('xpath=ancestor::*[contains(@class, "item-actions-menu")][1]')).toHaveCount(1);

        // The first row's Move Up is disabled; last row's Move Down is disabled.
        // Phase 5b' adds Bootstrap's `.disabled` class alongside the existing
        // `disabled` attribute + aria-disabled so dropdown items render greyed.
        const first_up = page.locator('table#items tbody tr:nth-child(1) [data-action="move-up"]');
        const last_down = page.locator('table#items tbody tr:nth-child(3) [data-action="move-down"]');
        await expect(first_up).toBeDisabled();
        await expect(first_up).toHaveClass(/disabled/);
        await expect(first_up).toHaveAttribute('aria-disabled', 'true');
        await expect(last_down).toBeDisabled();
        await expect(last_down).toHaveClass(/disabled/);
        await expect(last_down).toHaveAttribute('aria-disabled', 'true');

        // Middle row's items are both enabled.
        const middle_down = page.locator('table#items tbody tr:nth-child(2) [data-action="move-down"]');
        await expect(middle_up).toBeEnabled();
        await expect(middle_down).toBeEnabled();

        // Items carry context-rich aria-labels including the row title.
        await expect(middle_up).toHaveAttribute('aria-label', /Move Second up/i);
        await expect(middle_down).toHaveAttribute('aria-label', /Move Second down/i);
    });

    test('clicking Move down on the first row (via the actions dropdown) swaps rows, POSTs the new order, and announces via #reorder-status', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
        const state = await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                standardTextItem({ uuid: 'a', title: 'First',  order: 1 }),
                standardTextItem({ uuid: 'b', title: 'Second', order: 2 }),
                standardTextItem({ uuid: 'c', title: 'Third',  order: 3 }),
            ],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('table#items tbody tr')).toHaveCount(3);

        // Phase 5b': Move Up / Move Down are dropdown items. Open the
        // first row's actions menu, then click the Move Down item.
        // The delegated click handler in reorder.module.js (attached to
        // the table tbody) catches [data-action="move-down"] regardless
        // of which row or which container the trigger lives in.
        const first_row = page.locator('table#items tbody tr:nth-child(1)');
        await first_row.locator('.item-actions-toggle').click();
        await first_row.locator('[data-action="move-down"]').click();

        // POST capture
        await expect.poll(
            () => state.lastReorderPayload,
            { timeout: 5000, message: 'expected keyboard-driven reorder POST to be captured after Move down' }
        ).not.toBeNull();

        expect(Array.isArray(state.lastReorderPayload)).toBe(true);
        expect(state.lastReorderPayload.length).toBe(3);

        // Each entry has the right shape and order = 1-based DOM position.
        for (const entry of state.lastReorderPayload) {
            expect(typeof entry.uuid).toBe('string');
            expect(entry.uuid.length).toBeGreaterThan(0);
            expect(entry.type).toBe('item');
            expect(typeof entry.order).toBe('number');
        }
        const orders = state.lastReorderPayload.map(e => e.order);
        expect(orders).toEqual([1, 2, 3]);

        // The DOM row order changed: First (uuid 'a') is now in the second
        // slot (its row id begins with the uuid).
        const second_row_id = await page.locator('table#items tbody tr:nth-child(2)').getAttribute('id');
        expect(second_row_id).toMatch(/^a_/);

        // The polite live region was populated with the move announcement.
        await expect(page.locator('#reorder-status')).toContainText(/Moved .* to position 2 of 3/i);
    });

    test('clicking a disabled boundary dropdown item is a no-op (no POST)', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
        const state = await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                standardTextItem({ uuid: 'a', title: 'First',  order: 1 }),
                standardTextItem({ uuid: 'b', title: 'Second', order: 2 }),
            ],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('table#items tbody tr')).toHaveCount(2);

        // First row Move Up dropdown item is disabled. dispatchEvent('click')
        // sends a synthetic click event that bypasses Playwright's
        // actionability checks and the browser's normal "disabled buttons
        // don't fire click" behavior, so we exercise the in-app guard's
        // short-circuit (the disabled-attribute check at the top of
        // _apply_keyboard_move) directly without needing to first open
        // the dropdown menu.
        const first_up = page.locator('table#items tbody tr:nth-child(1) [data-action="move-up"]');
        await expect(first_up).toBeDisabled();
        await first_up.dispatchEvent('click');

        // Give any latent POST a moment to fire — none should.
        await page.waitForTimeout(250);
        expect(state.lastReorderPayload).toBeNull();
    });
});
