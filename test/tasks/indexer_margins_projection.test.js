'use strict';

/**
 * Regression pin: every record-type index constructor must project the
 * per-record margins / text_alignment fields.
 *
 * These were dropped from construct_heading / construct_grid / construct_timeline
 * by an unrelated commit (kept only in construct_item), so the frontend stopped
 * receiving margins/text-alignment for headings, grids, and timelines. Because
 * preview/publish do a full-document replace on the same index doc, a re-index
 * propagated the loss to live exhibits.
 */

process.env.API_URL = process.env.API_URL || 'http://localhost:8004';
process.env.APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';


const {
    construct_exhibit_index_record,
    construct_heading_index_record,
    construct_item_index_record,
    construct_grid_index_record,
    construct_timeline_index_record
} = require('../../indexer/indexer_helper');

const base = (extra = {}) => ({
    uuid: '9a8403ea-6016-4942-a611-a07140106c4f',
    is_member_of_exhibit: 'e5b0c3d2-0000-4000-8000-000000000000',
    type: 'item',
    text: 'body',
    order: 1,
    styles: '{}',
    is_published: 1,
    created: '2026-01-01T00:00:00Z',
    margins: 'large',
    text_alignment: 'center',
    ...extra
});

describe('index constructors project per-record margins / text_alignment', () => {

    const cases = [
        ['heading', () => construct_heading_index_record(base())],
        ['item', () => construct_item_index_record(base({ item_type: 'image', layout: 'media_top' }))],
        ['grid', () => construct_grid_index_record(base({ columns: 3, items: [] }))],
        ['timeline', () => construct_timeline_index_record(base({ items: [] }))]
    ];

    for (const [label, build] of cases) {
        test(`${label} constructor carries margins and text_alignment`, () => {
            const doc = build();
            expect(doc.margins).toBe('large');
            expect(doc.text_alignment).toBe('center');
        });
    }

    test('values pass through unchanged (small vs left)', () => {
        const doc = construct_grid_index_record(base({ columns: 2, items: [], margins: 'small', text_alignment: 'left' }));
        expect(doc.margins).toBe('small');
        expect(doc.text_alignment).toBe('left');
    });
});

describe('item index constructor projects per-record title (grid/timeline items, standard items)', () => {

    // title was dropped from the item/grid/timeline constructors by the
    // titles-to-subheadings "drop columns" migration, then restored to
    // construct_item_index_record only (grid/timeline CONTAINERS legitimately
    // lost their title). The frontend builds nav subheadings from item.title.
    test('construct_item_index_record carries title', () => {
        const doc = construct_item_index_record(base({ title: 'My Timeline Item', item_type: 'image' }));
        expect(doc.title).toBe('My Timeline Item');
    });

    test('grid and timeline CONTAINER constructors do not carry a title field', () => {
        const grid = construct_grid_index_record(base({ title: 'x', columns: 2, items: [] }));
        const timeline = construct_timeline_index_record(base({ title: 'x', items: [] }));
        expect(grid.title).toBeUndefined();
        expect(timeline.title).toBeUndefined();
    });
});
