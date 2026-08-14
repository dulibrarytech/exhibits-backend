'use strict';

/**
 * Regression pin: tbl_grids.internal_name / tbl_timelines.internal_name are
 * staff-facing dashboard labels and must NEVER reach the public index.
 * Publish and preview both project container rows through
 * construct_grid_index_record / construct_timeline_index_record, so those
 * whitelists are the single enforcement point — this test pins them.
 */

process.env.API_URL = process.env.API_URL || 'http://localhost:8004';
process.env.APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const {
    construct_grid_index_record,
    construct_timeline_index_record
} = require('../../indexer/indexer_helper');

const container_row = (extra = {}) => ({
    uuid: '9a8403ea-6016-4942-a611-a07140106c4f',
    is_member_of_exhibit: 'e5b0c3d2-0000-4000-8000-000000000000',
    text: 'body',
    internal_name: 'Staff-only container label',
    styles: '{}',
    order: 1,
    is_published: 1,
    created: '2026-01-01T00:00:00Z',
    margins: 'medium',
    text_alignment: 'left',
    items: [],
    ...extra
});

describe('container index constructors exclude internal_name', () => {

    const cases = [
        ['grid', () => construct_grid_index_record(container_row({ type: 'grid', columns: 3 }))],
        ['timeline', () => construct_timeline_index_record(container_row({ type: 'vertical_timeline' }))]
    ];

    for (const [label, build] of cases) {
        test(`${label}: internal_name is not projected into the index doc`, () => {
            const doc = build();

            expect(doc).not.toHaveProperty('internal_name');
            // The rest of the projection still works.
            expect(doc.uuid).toBe('9a8403ea-6016-4942-a611-a07140106c4f');
        });

        test(`${label}: no key of the doc leaks the internal name value`, () => {
            const doc = build();

            expect(JSON.stringify(doc)).not.toContain('Staff-only container label');
        });
    }
});
