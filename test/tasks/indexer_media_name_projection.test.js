/**
 * Regression: the media library `name` must ride into index docs as `media_name`.
 *
 * The dashboard displays the media library name on exhibit and item forms, and
 * the index docs carry it for the public API/frontend. Items (standard, grid,
 * timeline — all built by construct_item_index_record) project the joined
 * `media_name` column; exhibit docs project the hero image's name
 * (`hero_media_name`). Constructors silently dropping joined columns is a known
 * failure mode (see indexer_margins_projection), so pin the projection here.
 */

const {
    construct_item_index_record,
    construct_exhibit_index_record
} = require('../../indexer/indexer_helper');

describe('index constructors — media_name projection', () => {

    test('item docs carry the joined media library name as media_name', () => {
        const record = {
            uuid: 'item-uuid-1',
            is_member_of_exhibit: 'exhibit-uuid-1',
            type: 'item',
            media_name: 'Dr. Max Loewenstein'
        };

        const result = construct_item_index_record(record);

        expect(result.media_name).toBe('Dr. Max Loewenstein');
    });

    test('item docs normalize a missing media name to null', () => {
        const record = {
            uuid: 'item-uuid-2',
            is_member_of_exhibit: 'exhibit-uuid-1',
            type: 'item'
        };

        const result = construct_item_index_record(record);

        expect(result.media_name).toBeNull();
    });

    test('exhibit docs carry the hero image media library name as media_name', () => {
        const record = {
            uuid: 'exhibit-uuid-1',
            type: 'exhibit',
            title: 'Test Exhibit',
            hero_media_name: 'The Loewenstien Family — Hero Image'
        };

        const result = construct_exhibit_index_record(record);

        expect(result.media_name).toBe('The Loewenstien Family — Hero Image');
    });

    test('exhibit docs normalize a missing hero media name to null', () => {
        const record = {
            uuid: 'exhibit-uuid-2',
            type: 'exhibit',
            title: 'Test Exhibit'
        };

        const result = construct_exhibit_index_record(record);

        expect(result.media_name).toBeNull();
    });
});
