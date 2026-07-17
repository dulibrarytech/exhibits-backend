'use strict';

/**
 * Regression tests for repository-import IIIF resolution at index time.
 *
 * Previously, construct_item_index_record built LOCAL exhibits-IIIF URLs for
 * every media-library-bound item regardless of ingest_method, so repository
 * imports were indexed with manifest URLs the local IIIF service refuses to
 * serve (it only supports 'upload' and 'kaltura'). The repo fallback
 * (resolve_repo_iiif) was dead code: it only ran when the media library join
 * was empty AND relied on the stored is_repo_item flag, which the v2 dashboard
 * never sets. Repo-ness is now derived from the media library join
 * (ingest_method = 'repository' + repo_uuid) and repo items resolve to
 * REPO_IIIF_ENDPOINT (manifest) + REPO_IIIF_IMAGE_ENDPOINT (image/service/
 * thumbnail), with the indexed is_repo_item flag derived the same way.
 */

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

// Config modules capture process.env at require time — set everything the
// assertions depend on BEFORE requiring the indexer helper.
const REPO_MANIFEST_BASE = 'https://digitalarchives.du.edu/presentation/v3/';
const REPO_IMAGE_BASE = 'https://digitalarchives.du.edu/cantaloupe-digitaldu/iiif/3/';
process.env.REPO_IIIF_ENDPOINT = REPO_MANIFEST_BASE;
process.env.REPO_IIIF_IMAGE_ENDPOINT = REPO_IMAGE_BASE;
process.env.API_URL = 'http://localhost:8004';
process.env.APP_PATH = '/exhibits-dashboard';

const LOCAL_IIIF_BASE = 'http://localhost:8004/exhibits-dashboard/iiif';

const {
    build_repo_iiif_urls,
    resolve_repo_media_uuid,
    resolve_kaltura_entry_id,
    construct_item_index_record,
    construct_exhibit_index_record
} = require('../../indexer/indexer_helper');

const REPO_UUID = 'e9404f6c-19cc-4510-a49b-c0148aa0119f';
const MEDIA_LIB_UUID = '753f0908-5a8a-480f-8574-ce0ad388b132';
const ITEM_UUID = '4b39da8f-dd82-4dd7-9692-d25b2cdbe7df';

const base_item = (overrides = {}) => ({
    uuid: ITEM_UUID,
    is_member_of_exhibit: 'f0c2bff2-41cd-4d5f-959c-b8be52ab8dfc',
    type: 'item',
    item_type: 'image',
    is_published: 1,
    is_repo_item: 0,
    is_kaltura_item: 0,
    ...overrides
});

describe('build_repo_iiif_urls', () => {

    test('builds manifest (no /manifest suffix), image, service and thumbnail URLs', () => {
        const urls = build_repo_iiif_urls(REPO_UUID);
        expect(urls).toEqual({
            manifest_url: `${REPO_MANIFEST_BASE}${REPO_UUID}`,
            image_url: `${REPO_IMAGE_BASE}${REPO_UUID}/full/max/0/default.jpg`,
            service_url: `${REPO_IMAGE_BASE}${REPO_UUID}`,
            thumbnail_url: `${REPO_IMAGE_BASE}${REPO_UUID}/full/!400,400/0/default.jpg`
        });
    });

    test('returns null without a repo uuid', () => {
        expect(build_repo_iiif_urls(null)).toBeNull();
        expect(build_repo_iiif_urls('')).toBeNull();
    });
});

describe('resolve_repo_media_uuid', () => {

    test('media library join is the source of truth (v2 items, stale flag = 0)', () => {
        const record = base_item({
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'repository',
            media_repo_uuid: REPO_UUID
        });
        expect(resolve_repo_media_uuid(record)).toBe(REPO_UUID);
    });

    test('legacy v1 rows without a library record fall back to flag + media column', () => {
        const record = base_item({
            is_repo_item: 1,
            media: REPO_UUID,
            media_lib_uuid: null
        });
        expect(resolve_repo_media_uuid(record)).toBe(REPO_UUID);
    });

    test('upload media never resolves as repo, even with a stale flag', () => {
        const record = base_item({
            is_repo_item: 1,
            media: 'legacy-filename.jpg',
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'upload',
            media_repo_uuid: null
        });
        expect(resolve_repo_media_uuid(record)).toBeNull();
    });
});

describe('construct_item_index_record — repository imports', () => {

    test('v2 repo item gets repo IIIF URLs and a derived is_repo_item = 1', () => {
        const record = base_item({
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'repository',
            media_repo_uuid: REPO_UUID
        });

        const doc = construct_item_index_record(record);

        expect(doc.is_repo_item).toBe(1);
        expect(doc.media_iiif).toEqual({
            manifest_url: `${REPO_MANIFEST_BASE}${REPO_UUID}`,
            image_url: `${REPO_IMAGE_BASE}${REPO_UUID}/full/max/0/default.jpg`,
            service_url: `${REPO_IMAGE_BASE}${REPO_UUID}`
        });
    });

    test('v1-migrated repo item (flag + media column, no library record) also resolves', () => {
        const record = base_item({
            is_repo_item: 1,
            media: REPO_UUID,
            media_lib_uuid: null
        });

        const doc = construct_item_index_record(record);

        expect(doc.is_repo_item).toBe(1);
        expect(doc.media_iiif.manifest_url).toBe(`${REPO_MANIFEST_BASE}${REPO_UUID}`);
        expect(doc.media_iiif.service_url).toBe(`${REPO_IMAGE_BASE}${REPO_UUID}`);
    });

    test('v2 repo item gets the repo uuid derived into media (exhibits-api contract)', () => {
        const record = base_item({
            media: null,
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'repository',
            media_repo_uuid: REPO_UUID
        });

        const doc = construct_item_index_record(record);

        /* exhibits-api reads the repository id out of `media` when is_repo_item = 1;
           without this the API builds .../iiif/3/null/... URLs */
        expect(doc.media).toBe(REPO_UUID);
        expect(doc.is_repo_item).toBe(1);
    });

    test('v1-migrated repo item keeps the repo uuid already stored in media', () => {
        const record = base_item({
            is_repo_item: 1,
            media: REPO_UUID,
            media_lib_uuid: null
        });

        expect(construct_item_index_record(record).media).toBe(REPO_UUID);
    });

    test('upload item keeps its legacy media filename in media', () => {
        const record = base_item({
            media: 'legacy-filename.jpg',
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'upload'
        });

        const doc = construct_item_index_record(record);

        expect(doc.media).toBe('legacy-filename.jpg');
        expect(doc.is_repo_item).toBe(0);
    });

    test('upload item keeps local IIIF URLs and is_repo_item = 0', () => {
        const record = base_item({
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'upload'
        });

        const doc = construct_item_index_record(record);

        expect(doc.is_repo_item).toBe(0);
        expect(doc.media_iiif).toEqual({
            manifest_url: `${LOCAL_IIIF_BASE}/${MEDIA_LIB_UUID}/manifest`,
            image_url: `${LOCAL_IIIF_BASE}/${MEDIA_LIB_UUID}/full/max/0/default.jpg`,
            service_url: `${LOCAL_IIIF_BASE}/${MEDIA_LIB_UUID}`
        });
    });

    test('repo-imported thumbnail media resolves to the repo image server', () => {
        const thumb_repo_uuid = '0769f4cb-7bc6-43ad-9525-a6343168bec4';
        const record = base_item({
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'upload',
            thumb_lib_uuid: 'a2d4e2ed-64a0-49b3-a2fe-026bc97ad6b4',
            thumbnail_ingest_method: 'repository',
            thumbnail_media_repo_uuid: thumb_repo_uuid
        });

        const doc = construct_item_index_record(record);

        expect(doc.thumbnail_iiif).toEqual({
            manifest_url: `${REPO_MANIFEST_BASE}${thumb_repo_uuid}`,
            thumbnail_url: `${REPO_IMAGE_BASE}${thumb_repo_uuid}/full/!400,400/0/default.jpg`
        });
        expect(doc.thumbnail).toBe(`${REPO_IMAGE_BASE}${thumb_repo_uuid}/full/!400,400/0/default.jpg`);
    });
});

describe('resolve_kaltura_entry_id', () => {

    const ENTRY_ID = '1_j4x6lqo4';

    test('media library join is the source of truth (v2 items, stale flag = 0)', () => {
        const record = base_item({
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'kaltura',
            kaltura_entry_id: ENTRY_ID
        });
        expect(resolve_kaltura_entry_id(record)).toBe(ENTRY_ID);
    });

    test('legacy v1 rows without a library record fall back to flag + media column', () => {
        const record = base_item({
            is_kaltura_item: 1,
            media: ENTRY_ID,
            media_lib_uuid: null
        });
        expect(resolve_kaltura_entry_id(record)).toBe(ENTRY_ID);
    });

    test('upload media never resolves as kaltura, even with a stale flag', () => {
        const record = base_item({
            is_kaltura_item: 1,
            media: 'legacy-filename.jpg',
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'upload'
        });
        expect(resolve_kaltura_entry_id(record)).toBeNull();
    });
});

describe('construct_item_index_record — kaltura items', () => {

    const ENTRY_ID = '1_j4x6lqo4';
    const KALTURA_THUMB = 'https://cdn.kaltura.com/thumbnail/1_j4x6lqo4.jpg';

    test('v2 kaltura item gets a derived is_kaltura_item = 1 alongside kaltura data', () => {
        const record = base_item({
            item_type: 'video',
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'kaltura',
            kaltura_entry_id: ENTRY_ID,
            media_kaltura_thumbnail_url: KALTURA_THUMB
        });

        const doc = construct_item_index_record(record);

        expect(doc.is_kaltura_item).toBe(1);
        expect(doc.is_repo_item).toBe(0);
        expect(doc.kaltura).toEqual({
            kaltura_id: ENTRY_ID,
            kaltura_stream_url: ENTRY_ID,
            kaltura_thumbnail: KALTURA_THUMB
        });
    });

    test('v1-migrated kaltura item (flag + media column, no library record) keeps flag and data', () => {
        const record = base_item({
            item_type: 'video',
            is_kaltura_item: 1,
            media: ENTRY_ID,
            media_lib_uuid: null
        });

        const doc = construct_item_index_record(record);

        expect(doc.is_kaltura_item).toBe(1);
        expect(doc.kaltura.kaltura_id).toBe(ENTRY_ID);
    });

    test('non-kaltura item gets is_kaltura_item = 0 and null kaltura', () => {
        const record = base_item({
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'upload'
        });

        const doc = construct_item_index_record(record);

        expect(doc.is_kaltura_item).toBe(0);
        expect(doc.kaltura).toBeNull();
    });

    test('repo item with a stale kaltura flag does not resolve as kaltura', () => {
        const record = base_item({
            is_kaltura_item: 1,
            media_uuid: MEDIA_LIB_UUID,
            media_lib_uuid: MEDIA_LIB_UUID,
            media_ingest_method: 'repository',
            media_repo_uuid: REPO_UUID
        });

        const doc = construct_item_index_record(record);

        expect(doc.is_repo_item).toBe(1);
        expect(doc.is_kaltura_item).toBe(0);
        expect(doc.kaltura).toBeNull();
    });
});

describe('construct_exhibit_index_record — repository imports', () => {

    test('repo-imported hero image resolves to the repo IIIF endpoints', () => {
        const record = {
            uuid: 'b042f609-b680-4ca9-be40-aaf194dcfced',
            type: 'exhibit',
            title: 'Test exhibit',
            hero_lib_uuid: MEDIA_LIB_UUID,
            hero_ingest_method: 'repository',
            hero_repo_uuid: REPO_UUID
        };

        const doc = construct_exhibit_index_record(record);

        expect(doc.media_iiif).toEqual({
            manifest_url: `${REPO_MANIFEST_BASE}${REPO_UUID}`,
            image_url: `${REPO_IMAGE_BASE}${REPO_UUID}/full/max/0/default.jpg`,
            service_url: `${REPO_IMAGE_BASE}${REPO_UUID}`
        });
    });

    test('repo-imported exhibit thumbnail resolves to the repo image server', () => {
        const record = {
            uuid: 'b042f609-b680-4ca9-be40-aaf194dcfced',
            type: 'exhibit',
            title: 'Test exhibit',
            thumb_lib_uuid: MEDIA_LIB_UUID,
            thumb_ingest_method: 'repository',
            thumb_repo_uuid: REPO_UUID
        };

        const doc = construct_exhibit_index_record(record);

        expect(doc.thumbnail_iiif).toEqual({
            manifest_url: `${REPO_MANIFEST_BASE}${REPO_UUID}`,
            thumbnail_url: `${REPO_IMAGE_BASE}${REPO_UUID}/full/!400,400/0/default.jpg`
        });
    });
});
