/**
 * Media delete in-use guard (media-library/model.js delete_media_record).
 *
 * Context: staff de-duplicated the media library and soft-deleted two PDFs
 * that published items still referenced. Nothing refused the delete, the
 * indexer kept baking the dead IIIF URLs into the search index, and the
 * public viewer broke (404 masked as a CORS error). The model now looks up
 * every live item/exhibit bound to the record before deleting and refuses
 * with a staff-facing summary when any exist.
 *
 * Jest (not Vitest) because the model's transitive CommonJS requires — the
 * task classes, IIIF cache, uploads — must be intercepted by module mocks.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

/*
 * rte_vocabulary pulls in jsdom; not needed here.
 */
jest.mock('../../libs/rte_vocabulary', () => ({
    sanitize_for_profile: jest.fn((value) => value),
    PROFILES: {}
}));

jest.mock('../../libs/log4', () => ({
    module: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../config/db_config', () => () => jest.fn());

jest.mock('../../config/db_tables_config', () => () => ({
    exhibits: {
        exhibit_records: 'tbl_exhibits',
        item_records: 'tbl_standard_items',
        grid_item_records: 'tbl_grid_items',
        grid_records: 'tbl_grids',
        timeline_item_records: 'tbl_timeline_items',
        timeline_records: 'tbl_timelines',
        media_library_records: 'tbl_media_library',
        exhibit_media_records: 'tbl_exhibit_media'
    }
}));

jest.mock('../../media-library/uploads', () => ({}));
jest.mock('../../exhibits/reindex_coalescer', () => ({ schedule_reindex: jest.fn() }));

const mockIiifCache = { purge: jest.fn().mockResolvedValue(undefined) };
jest.mock('../../media-library/iiif-cache', () => mockIiifCache);

const mockMediaTask = {
    delete_media_record: jest.fn(),
    get_user_by_username: jest.fn()
};
jest.mock('../../media-library/tasks/media_record_tasks', () => jest.fn().mockImplementation(() => mockMediaTask));

const mockReferenceTask = {
    get_media_references: jest.fn()
};
jest.mock('../../media-library/tasks/media_reference_tasks', () => jest.fn().mockImplementation(() => mockReferenceTask));

const MEDIA_MODEL = require('../../media-library/model');

const MEDIA_UUID = '61706e13-7896-46d1-8956-ca2acff4e1d6';
const EXHIBIT_UUID = '561837a9-2a43-4187-95d6-9376a48b9b85';

const reference = (overrides = {}) => ({
    record_type: 'item',
    role: 'media',
    uuid: 'a676c5bb-5d68-4457-b424-1c400163e181',
    exhibit_uuid: EXHIBIT_UUID,
    exhibit_title: 'Latinx Poetry',
    exhibit_is_deleted: 0,
    container_uuid: null,
    container_name: null,
    container_is_deleted: 0,
    is_published: 1,
    ...overrides
});

describe('delete_media_record in-use guard', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockMediaTask.get_user_by_username.mockResolvedValue({ success: true, full_name: 'Staff Member' });
        mockMediaTask.delete_media_record.mockResolvedValue({ success: true, uuid: MEDIA_UUID, message: 'Media record deleted successfully' });
        mockIiifCache.purge.mockResolvedValue(undefined);
    });

    test('unreferenced media is soft-deleted and its IIIF cache purged', async () => {
        mockReferenceTask.get_media_references.mockResolvedValue([]);

        const result = await MEDIA_MODEL.delete_media_record(MEDIA_UUID, 'staff');

        expect(result.success).toBe(true);
        expect(result.in_use).toBeUndefined();
        expect(mockReferenceTask.get_media_references).toHaveBeenCalledWith(MEDIA_UUID);
        expect(mockMediaTask.delete_media_record).toHaveBeenCalledWith(MEDIA_UUID, 'Staff Member');
        expect(mockIiifCache.purge).toHaveBeenCalledWith(MEDIA_UUID);
    });

    test('media bound to a live item is refused before anything is written', async () => {
        mockReferenceTask.get_media_references.mockResolvedValue([reference()]);

        const result = await MEDIA_MODEL.delete_media_record(MEDIA_UUID, 'staff');

        expect(result.success).toBe(false);
        expect(result.in_use).toBe(true);
        expect(result.references).toHaveLength(1);
        expect(mockMediaTask.delete_media_record).not.toHaveBeenCalled();
        expect(mockIiifCache.purge).not.toHaveBeenCalled();
    });

    test('the refusal message names the exhibits and counts the uses, tags stripped', async () => {
        mockReferenceTask.get_media_references.mockResolvedValue([
            reference({ exhibit_title: '<b>Latinx</b> Poetry' }),
            reference({ uuid: '6e29fb8d-d3a6-4985-9276-ffd020ac5bab' }),
            reference({ uuid: 'c0ffee00-0000-4000-8000-000000000001', role: 'thumbnail' }),
            reference({
                record_type: 'grid_item', exhibit_uuid: 'e2', exhibit_title: 'Facing Pages',
                container_name: 'Portraits', container_is_deleted: 1
            }),
            reference({ record_type: 'exhibit', role: 'hero_image', exhibit_uuid: 'e3', exhibit_title: 'Loewenstien', exhibit_is_deleted: 1 })
        ]);

        const { message } = await MEDIA_MODEL.delete_media_record(MEDIA_UUID, 'staff');

        expect(message).toContain('still in use and cannot be deleted');
        expect(message).toContain('"Latinx Poetry": 2 items, 1 item (as thumbnail)');
        expect(message).not.toContain('<b>');
        expect(message).toContain('"Facing Pages": 1 grid item in a recycled grid or timeline');
        expect(message).toContain('"Loewenstien" (in the recycle bin): the hero image');
        expect(message).toContain('Select different media for those items');
    });

    test('fails closed: a failed reference lookup refuses the delete', async () => {
        mockReferenceTask.get_media_references.mockRejectedValue(new Error('Query timeout'));

        const result = await MEDIA_MODEL.delete_media_record(MEDIA_UUID, 'staff');

        expect(result.success).toBe(false);
        expect(result.in_use).toBeUndefined();
        expect(result.message).toContain('Query timeout');
        expect(mockMediaTask.delete_media_record).not.toHaveBeenCalled();
    });

    test('an invalid uuid is rejected before the lookup', async () => {
        const result = await MEDIA_MODEL.delete_media_record('not-a-uuid', 'staff');

        expect(result.success).toBe(false);
        expect(mockReferenceTask.get_media_references).not.toHaveBeenCalled();
    });
});
