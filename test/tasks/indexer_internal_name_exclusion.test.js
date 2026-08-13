'use strict';

/**
 * Regression pin: tbl_grids.internal_name is a staff-facing dashboard label
 * and must NEVER reach the public index. Publish and preview both project
 * grid rows through construct_grid_index_record, so its whitelist is the
 * single enforcement point — this test pins it.
 */

process.env.API_URL = process.env.API_URL || 'http://localhost:8004';
process.env.APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const {
    construct_grid_index_record
} = require('../../indexer/indexer_helper');

const grid_row = (extra = {}) => ({
    uuid: '9a8403ea-6016-4942-a611-a07140106c4f',
    is_member_of_exhibit: 'e5b0c3d2-0000-4000-8000-000000000000',
    type: 'grid',
    columns: 3,
    text: 'body',
    internal_name: 'Staff-only grid label',
    styles: '{}',
    order: 1,
    is_published: 1,
    created: '2026-01-01T00:00:00Z',
    margins: 'medium',
    text_alignment: 'left',
    items: [],
    ...extra
});

describe('grid index constructor excludes internal_name', () => {

    test('internal_name is not projected into the index doc', () => {
        const doc = construct_grid_index_record(grid_row());

        expect(doc).not.toHaveProperty('internal_name');
        // The rest of the projection still works.
        expect(doc.uuid).toBe('9a8403ea-6016-4942-a611-a07140106c4f');
        expect(doc.columns).toBe(3);
    });

    test('no key of the doc leaks the internal name value', () => {
        const doc = construct_grid_index_record(grid_row());

        expect(JSON.stringify(doc)).not.toContain('Staff-only grid label');
    });
});
