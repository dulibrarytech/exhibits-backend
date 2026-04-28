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
});
