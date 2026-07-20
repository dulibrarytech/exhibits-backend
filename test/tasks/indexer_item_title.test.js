/**
 * Regression: grid/timeline item titles must ride into the index doc.
 *
 * tbl_grid_items and tbl_timeline_items still carry a `title` column (only the
 * container tables tbl_grids/tbl_timelines and tbl_standard_items lost it in the
 * titles-to-subheadings migration). The frontend builds navigation subheadings
 * from item.title, so construct_item_index_record must copy it through. It was
 * silently dropped, so item titles never reached Elasticsearch.
 */

const {construct_item_index_record} = require('../../indexer/indexer_helper');

describe('construct_item_index_record — item title indexing', () => {

    test('carries the grid/timeline item title into the index record', () => {
        const record = {
            uuid: 'item-uuid-1',
            is_member_of_exhibit: 'exhibit-uuid-1',
            title: 'My Grid Item Title',
            type: 'item'
        };

        const result = construct_item_index_record(record);

        expect(result.title).toBe('My Grid Item Title');
    });

    test('normalizes a missing/empty title to null (standard items have no title column)', () => {
        const record = {
            uuid: 'item-uuid-2',
            is_member_of_exhibit: 'exhibit-uuid-1',
            title: '',
            type: 'item'
        };

        const result = construct_item_index_record(record);

        expect(result.title).toBeNull();
    });
});
