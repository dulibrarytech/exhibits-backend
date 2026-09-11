'use strict';

/**
 * Index-time handling of soft-deleted media library rows.
 *
 * The item/exhibit record queries LEFT JOIN tbl_media_library without an
 * is_deleted predicate, so a published item bound to media that staff later
 * deleted still arrives with media_lib_uuid populated. The public IIIF routes
 * refuse deleted rows (404 "Media record not found"), so baking their URLs
 * into the index ships a viewer that can never load. construct_*_index_record
 * must index such records as having no media and log a warning.
 */

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

process.env.REPO_IIIF_ENDPOINT = 'https://digitalarchives.du.edu/presentation/v3/';
process.env.REPO_IIIF_IMAGE_ENDPOINT = 'https://digitalarchives.du.edu/cantaloupe-digitaldu/iiif/3/';
process.env.API_URL = 'http://localhost:8004';
process.env.APP_PATH = '/exhibits-dashboard';

const {
    strip_deleted_media,
    warn_deleted_media,
    construct_item_index_record,
    construct_exhibit_index_record
} = require('../../indexer/indexer_helper');

const LOCAL_IIIF_BASE = 'http://localhost:8004/exhibits-dashboard/iiif';
const MEDIA_LIB_UUID = '61706e13-7896-46d1-8956-ca2acff4e1d6';
const THUMB_LIB_UUID = 'f8753408-87b0-45ff-82e4-de2260108a2a';
const ITEM_UUID = 'a676c5bb-5d68-4457-b424-1c400163e181';
const EXHIBIT_UUID = '561837a9-2a43-4187-95d6-9376a48b9b85';

const bound_item = (overrides = {}) => ({
    uuid: ITEM_UUID,
    is_member_of_exhibit: EXHIBIT_UUID,
    type: 'item',
    item_type: 'pdf',
    is_published: 1,
    is_repo_item: 0,
    is_kaltura_item: 0,
    media: `${ITEM_UUID}_1744321721062_item_media.pdf`,
    media_uuid: MEDIA_LIB_UUID,
    media_lib_uuid: MEDIA_LIB_UUID,
    media_name: 'Untitled document',
    media_ingest_method: 'upload',
    media_is_deleted: 0,
    thumbnail: `${ITEM_UUID}_1744321798730_item_thumbnail.jpg`,
    thumbnail_media_uuid: THUMB_LIB_UUID,
    thumb_lib_uuid: THUMB_LIB_UUID,
    thumbnail_media_name: 'Item — Thumbnail',
    thumbnail_media_is_deleted: 0,
    ...overrides
});

describe('strip_deleted_media', () => {

    test('leaves a record with live media untouched', () => {
        const record = bound_item();
        expect(strip_deleted_media(record)).toEqual(record);
    });

    test('blanks every media-library-derived field for a deleted primary media', () => {
        const stripped = strip_deleted_media(bound_item({
            media_is_deleted: 1,
            kaltura_entry_id: '1_abc',
            media_repo_uuid: 'x',
            media_topics_subjects: 'a|b'
        }));

        expect(stripped.media_lib_uuid).toBeNull();
        expect(stripped.media_name).toBeNull();
        expect(stripped.media_ingest_method).toBeNull();
        expect(stripped.kaltura_entry_id).toBeNull();
        expect(stripped.media_repo_uuid).toBeNull();
        expect(stripped.media_topics_subjects).toBeNull();
        // The item's own columns survive
        expect(stripped.media_uuid).toBe(MEDIA_LIB_UUID);
        expect(stripped.media).toContain('_item_media.pdf');
        // The thumbnail role is independent
        expect(stripped.thumb_lib_uuid).toBe(THUMB_LIB_UUID);
    });

    test('accepts the flag as a numeric string (driver-dependent)', () => {
        expect(strip_deleted_media(bound_item({ media_is_deleted: '1' })).media_lib_uuid).toBeNull();
    });

    test('does not mutate its input', () => {
        const record = bound_item({ media_is_deleted: 1 });
        strip_deleted_media(record);
        expect(record.media_lib_uuid).toBe(MEDIA_LIB_UUID);
    });
});

describe('warn_deleted_media', () => {

    test('reports nothing for live media', () => {
        expect(warn_deleted_media(bound_item(), 'item')).toEqual([]);
    });

    test('reports each deleted role once', () => {
        expect(warn_deleted_media(bound_item({ media_is_deleted: 1 }), 'item')).toEqual(['media_is_deleted']);
        expect(warn_deleted_media(bound_item({ media_is_deleted: 1, thumbnail_media_is_deleted: 1 }), 'item'))
            .toEqual(['media_is_deleted', 'thumbnail_media_is_deleted']);
    });
});

describe('construct_item_index_record — deleted media', () => {

    test('live media still indexes with local IIIF URLs (regression guard)', () => {
        const doc = construct_item_index_record(bound_item());

        expect(doc.media_iiif).toEqual({
            manifest_url: `${LOCAL_IIIF_BASE}/${MEDIA_LIB_UUID}/manifest`,
            image_url: `${LOCAL_IIIF_BASE}/${MEDIA_LIB_UUID}/full/max/0/default.jpg`,
            service_url: `${LOCAL_IIIF_BASE}/${MEDIA_LIB_UUID}`
        });
        expect(doc.media_name).toBe('Untitled document');
    });

    test('deleted primary media indexes with no media_iiif, no media name, flags off', () => {
        const doc = construct_item_index_record(bound_item({ media_is_deleted: 1 }));

        expect(doc.media_iiif).toBeNull();
        expect(doc.media_name).toBeNull();
        expect(doc.is_repo_item).toBe(0);
        expect(doc.is_kaltura_item).toBe(0);
        expect(doc.kaltura).toBeNull();
        // Legacy filename passes through unchanged for backward compatibility
        expect(doc.media).toBe(`${ITEM_UUID}_1744321721062_item_media.pdf`);
        // Thumbnail (live) is unaffected
        expect(doc.thumbnail_iiif.thumbnail_url).toBe(`${LOCAL_IIIF_BASE}/${THUMB_LIB_UUID}/full/!400,400/0/default.jpg`);
    });

    test('deleted thumbnail media drops thumbnail_iiif and falls back to the legacy thumbnail', () => {
        const doc = construct_item_index_record(bound_item({ thumbnail_media_is_deleted: 1 }));

        expect(doc.thumbnail_iiif).toBeNull();
        expect(doc.thumbnail).toBe(`${ITEM_UUID}_1744321798730_item_thumbnail.jpg`);
        // Primary media is unaffected
        expect(doc.media_iiif.manifest_url).toBe(`${LOCAL_IIIF_BASE}/${MEDIA_LIB_UUID}/manifest`);
    });

    test('a deleted repository-import media does not resolve to repo IIIF URLs either', () => {
        const doc = construct_item_index_record(bound_item({
            media_is_deleted: 1,
            media_ingest_method: 'repository',
            media_repo_uuid: 'e9404f6c-19cc-4510-a49b-c0148aa0119f'
        }));

        expect(doc.media_iiif).toBeNull();
        expect(doc.is_repo_item).toBe(0);
    });

    test('records without the flag (older callers) are unchanged', () => {
        const record = bound_item();
        delete record.media_is_deleted;
        delete record.thumbnail_media_is_deleted;

        const doc = construct_item_index_record(record);
        expect(doc.media_iiif.manifest_url).toBe(`${LOCAL_IIIF_BASE}/${MEDIA_LIB_UUID}/manifest`);
    });
});

describe('construct_exhibit_index_record — deleted media', () => {

    const HERO_UUID = 'bfb0b417-1111-4222-8333-444455556666';

    const exhibit = (overrides = {}) => ({
        uuid: EXHIBIT_UUID,
        type: 'exhibit',
        title: 'Latinx Poetry',
        is_published: 1,
        hero_lib_uuid: HERO_UUID,
        hero_media_name: 'Hero',
        hero_ingest_method: 'upload',
        hero_media_is_deleted: 0,
        thumb_lib_uuid: THUMB_LIB_UUID,
        thumb_ingest_method: 'upload',
        thumb_media_is_deleted: 0,
        ...overrides
    });

    test('live hero/thumbnail index with local IIIF URLs', () => {
        const doc = construct_exhibit_index_record(exhibit());
        expect(doc.media_iiif.manifest_url).toBe(`${LOCAL_IIIF_BASE}/${HERO_UUID}/manifest`);
        expect(doc.thumbnail_iiif.thumbnail_url).toBe(`${LOCAL_IIIF_BASE}/${THUMB_LIB_UUID}/full/!400,400/0/default.jpg`);
        expect(doc.media_name).toBe('Hero');
    });

    test('deleted hero media indexes without media_iiif or media_name', () => {
        const doc = construct_exhibit_index_record(exhibit({ hero_media_is_deleted: 1 }));
        expect(doc.media_iiif).toBeNull();
        expect(doc.media_name).toBeNull();
        expect(doc.thumbnail_iiif).not.toBeNull();
    });

    test('deleted thumbnail media indexes without thumbnail_iiif', () => {
        const doc = construct_exhibit_index_record(exhibit({ thumb_media_is_deleted: 1 }));
        expect(doc.thumbnail_iiif).toBeNull();
        expect(doc.media_iiif).not.toBeNull();
    });
});
