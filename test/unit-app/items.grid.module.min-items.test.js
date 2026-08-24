// @vitest-environment jsdom
//
// Unit tests for the minimum-items advisory in
// public/app/grid-items/items.grid.module.js (build_min_items_notice).
//
// A grid must hold at least one full row (items >= columns) before it can
// be published; the server enforces the same rule in exhibits/grid_model.js.
// The rest of the module (fetching, DataTable wiring) is http/DOM-bound and
// belongs in e2e coverage.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/grid-items/items.grid.module.js',
);

describe('itemsGridModule.build_min_items_notice', () => {

    beforeAll(() => {
        // The IIFE reads the endpoints module at load time.
        globalThis.endpointsModule = {
            get_app_path: () => '/exhibits-dashboard',
            get_exhibits_endpoints: () => ({}),
        };

        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+itemsGridModule\s*=/m,
            'globalThis.itemsGridModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    it('returns null when the item count meets the column count', () => {
        expect(globalThis.itemsGridModule.build_min_items_notice(2, 2)).toBeNull();
        expect(globalThis.itemsGridModule.build_min_items_notice(3, 3)).toBeNull();
        expect(globalThis.itemsGridModule.build_min_items_notice(4, 4)).toBeNull();
        expect(globalThis.itemsGridModule.build_min_items_notice(4, 9)).toBeNull();
    });

    it('warns with counts and both remedies when items fall short', () => {
        const notice = globalThis.itemsGridModule.build_min_items_notice(4, 1);

        expect(notice).toContain('set to 4 columns');
        expect(notice).toContain('1 of 4 added');
        expect(notice).toContain('Add 3 more grid items');
        expect(notice).toContain('reduce the number of columns');
    });

    it('uses singular phrasing when exactly one item is missing', () => {
        const notice = globalThis.itemsGridModule.build_min_items_notice(3, 2);

        expect(notice).toContain('Add 1 more grid item,');
        expect(notice).not.toContain('grid items,');
    });

    it('handles an empty grid', () => {
        const notice = globalThis.itemsGridModule.build_min_items_notice(2, 0);

        expect(notice).toContain('0 of 2 added');
        expect(notice).toContain('Add 2 more grid items');
    });

    it('accepts a string column value (records store numbers, forms strings)', () => {
        const notice = globalThis.itemsGridModule.build_min_items_notice('4', 2);

        expect(notice).toContain('2 of 4 added');
    });

    it('falls back to a minimum of 2 for legacy column values outside 2-4', () => {
        expect(globalThis.itemsGridModule.build_min_items_notice(6, 2)).toBeNull();

        const notice = globalThis.itemsGridModule.build_min_items_notice(6, 1);
        expect(notice).toContain('at least 2 grid items');
        expect(notice).not.toContain('set to');
    });
});
