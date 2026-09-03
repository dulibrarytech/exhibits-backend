/**
 * Integration Tests for Media Library Model
 *
 * Runs the REAL media-library/model.js with the task class, upload pipeline,
 * IIIF cache, coalescer and indexer mocked. Focus is the orchestration that
 * was never executed under `npm test` before: create/update/get, and above
 * all replace_media_file (store → repoint → purge → unlink old → reindex),
 * delete_media_record and delete_uploaded_file.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const MEDIA_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NEW_UUID = '660e8400-e29b-41d4-a716-446655440001';
const EXHIBIT_A = '770e8400-e29b-41d4-a716-446655440002';
const EXHIBIT_B = '880e8400-e29b-41d4-a716-446655440003';

jest.mock('../../libs/rte_vocabulary', () => ({ apply: jest.fn((record) => record) }));

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../config/db_config', () => () => jest.fn());
jest.mock('../../config/db_tables_config', () => () => ({ exhibits: { media_library_records: 'tbl_media_library' } }));

const mockHelper = { create_uuid: jest.fn() };
jest.mock('../../libs/helper', () => jest.fn().mockImplementation(() => mockHelper));

const mockValidate = jest.fn();
jest.mock('../../libs/validate', () => jest.fn().mockImplementation(() => ({ validate: mockValidate })));
jest.mock('../../media-library/schemas/media_create_record_schema', () => () => ({}));

const mockMediaTasks = {
    create_media_record: jest.fn(),
    get_media_records: jest.fn(),
    get_media_records_browse: jest.fn(),
    get_media_record: jest.fn(),
    update_media_record: jest.fn(),
    replace_media_file: jest.fn(),
    get_published_exhibit_uuids: jest.fn(),
    delete_media_record: jest.fn(),
    find_by_storage_path: jest.fn(),
    get_user_by_username: jest.fn()
};
jest.mock('../../media-library/tasks/media_record_tasks', () => jest.fn().mockImplementation(() => mockMediaTasks));

jest.mock('../../media-library/uploads', () => ({
    get_media_type: jest.fn(),
    store_file: jest.fn(),
    extract_metadata: jest.fn(),
    delete_stored_file: jest.fn()
}));

jest.mock('../../media-library/iiif-cache', () => ({ purge: jest.fn() }));
jest.mock('../../exhibits/reindex_coalescer', () => ({ schedule_reindex: jest.fn() }));
jest.mock('../../indexer/model', () => ({ index_exhibit: jest.fn() }));

const MEDIA_MODEL = require('../../media-library/model');
const UPLOADS = require('../../media-library/uploads');
const IIIF_CACHE = require('../../media-library/iiif-cache');
const REINDEX_COALESCER = require('../../exhibits/reindex_coalescer');
const INDEXER_MODEL = require('../../indexer/model');

const OLD_RECORD = {
    uuid: MEDIA_UUID,
    ingest_method: 'upload',
    mime_type: 'image/jpeg',
    storage_path: 'images/aa/bb/old.jpg',
    thumbnail_path: 'thumbnails/aa/bb/old_thumb.jpg',
    exhibits: JSON.stringify([EXHIBIT_A, EXHIBIT_B])
};

const STORE_RESULT = {
    file_path: '/abs/images/cc/dd/new.png',
    storage_path: 'images/cc/dd/new.png',
    thumbnail_path: 'thumbnails/cc/dd/new_thumb.jpg',
    mime_type: 'image/png',
    original_name: 'new.png',
    file_size: 1234,
    media_type: 'image',
    media_width: 800,
    media_height: 600
};

const FILE = { buffer: Buffer.from('x'), originalname: 'new.png', mimetype: 'image/png' };

describe('Media Library Model', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockHelper.create_uuid.mockReturnValue(NEW_UUID);
        mockValidate.mockReturnValue(true);
        mockMediaTasks.get_user_by_username.mockResolvedValue({ success: true, id: 7, full_name: 'Ada Lovelace' });
        mockMediaTasks.get_media_record.mockResolvedValue({ success: true, record: { ...OLD_RECORD } });
        mockMediaTasks.replace_media_file.mockResolvedValue({ success: true, record: { ...OLD_RECORD, storage_path: STORE_RESULT.storage_path } });
        mockMediaTasks.get_published_exhibit_uuids.mockResolvedValue([EXHIBIT_A]);
        mockMediaTasks.delete_media_record.mockResolvedValue({ success: true });
        mockMediaTasks.find_by_storage_path.mockResolvedValue({ exists: false });
        UPLOADS.get_media_type.mockImplementation((mime) => (mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'unknown'));
        UPLOADS.store_file.mockResolvedValue({ ...STORE_RESULT });
        UPLOADS.extract_metadata.mockResolvedValue({ Make: 'Cam' });
        UPLOADS.delete_stored_file.mockResolvedValue(true);
        IIIF_CACHE.purge.mockResolvedValue(undefined);
    });

    // ==================== create / get / update ====================

    describe('create_media_record', () => {

        test('assigns uuid and timestamps, resolves the creator, normalizes subjects, strips username', async () => {
            mockMediaTasks.create_media_record.mockResolvedValue({ success: true, id: 1, record: { uuid: NEW_UUID, topics_subjects: 'a | b ||' } });

            const result = await MEDIA_MODEL.create_media_record({ name: 'n', username: 'ada', topics_subjects: ' a |b| ' });

            expect(result.success).toBe(true);
            expect(result.uuid).toBe(NEW_UUID);
            const written = mockMediaTasks.create_media_record.mock.calls[0][0];
            expect(written).toMatchObject({ uuid: NEW_UUID, created_by: 'Ada Lovelace', owner: 7, topics_subjects: 'a|b' });
            expect(written.created).toBeInstanceOf(Date);
            expect(written).not.toHaveProperty('username');
            expect(result.record.topics_subjects).toBe('a|b');
        });

        test('rejects a schema failure with the validator message and never writes', async () => {
            mockValidate.mockReturnValue([{ message: 'should have required property name' }]);

            const result = await MEDIA_MODEL.create_media_record({});

            expect(result.success).toBe(false);
            expect(result.message).toContain('should have required property name');
            expect(mockMediaTasks.create_media_record).not.toHaveBeenCalled();
        });

        test('surfaces a task failure', async () => {
            mockMediaTasks.create_media_record.mockResolvedValue({ success: false, message: 'dup' });

            expect(await MEDIA_MODEL.create_media_record({ name: 'n' })).toEqual({ success: false, message: 'dup' });
        });
    });

    describe('get_media_record / update_media_record', () => {

        test('get validates the uuid, maps not-found, and normalizes subjects', async () => {
            expect((await MEDIA_MODEL.get_media_record('x')).success).toBe(false);

            mockMediaTasks.get_media_record.mockResolvedValue({ success: false });
            expect((await MEDIA_MODEL.get_media_record(MEDIA_UUID)).message).toBe('Media record not found');

            mockMediaTasks.get_media_record.mockResolvedValue({ success: true, record: { uuid: MEDIA_UUID, places_subjects: ' x | y ' } });
            const result = await MEDIA_MODEL.get_media_record(MEDIA_UUID);
            expect(result.record.places_subjects).toBe('x|y');
        });

        test('update stamps updated/updated_by, writes, then purges the IIIF cache', async () => {
            mockMediaTasks.update_media_record.mockResolvedValue({ success: true, record: { uuid: MEDIA_UUID } });

            const result = await MEDIA_MODEL.update_media_record(MEDIA_UUID, { alt_text: 'a', username: 'ada' });

            expect(result.success).toBe(true);
            const [id, written] = mockMediaTasks.update_media_record.mock.calls[0];
            expect(id).toBe(MEDIA_UUID);
            expect(written).toMatchObject({ alt_text: 'a', updated_by: 'Ada Lovelace' });
            expect(written).not.toHaveProperty('username');
            expect(IIIF_CACHE.purge).toHaveBeenCalledWith(MEDIA_UUID);
        });

        test('update does not purge when the write fails', async () => {
            mockMediaTasks.update_media_record.mockResolvedValue({ success: false, message: 'nope' });

            const result = await MEDIA_MODEL.update_media_record(MEDIA_UUID, { alt_text: 'a' });

            expect(result).toEqual({ success: false, message: 'nope' });
            expect(IIIF_CACHE.purge).not.toHaveBeenCalled();
        });
    });

    // ==================== replace_media_file ====================

    describe('replace_media_file — guards', () => {

        test('rejects an invalid id or missing file before reading the record', async () => {
            expect((await MEDIA_MODEL.replace_media_file('x', FILE)).success).toBe(false);
            expect((await MEDIA_MODEL.replace_media_file(MEDIA_UUID, null)).success).toBe(false);
            expect((await MEDIA_MODEL.replace_media_file(MEDIA_UUID, { buffer: Buffer.from('x') })).success).toBe(false);
            expect(mockMediaTasks.get_media_record).not.toHaveBeenCalled();
            expect(UPLOADS.store_file).not.toHaveBeenCalled();
        });

        test('rejects when the record is missing', async () => {
            mockMediaTasks.get_media_record.mockResolvedValue({ success: false });

            const result = await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE);

            expect(result.message).toBe('Media record not found');
            expect(UPLOADS.store_file).not.toHaveBeenCalled();
        });

        test('only uploaded media can be replaced (not repo or Kaltura records)', async () => {
            mockMediaTasks.get_media_record.mockResolvedValue({ success: true, record: { ...OLD_RECORD, ingest_method: 'kaltura' } });

            const result = await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE);

            expect(result.success).toBe(false);
            expect(result.message).toMatch(/Only uploaded media/);
            expect(UPLOADS.store_file).not.toHaveBeenCalled();
        });

        test('the replacement must be the same media type as the original', async () => {
            const result = await MEDIA_MODEL.replace_media_file(MEDIA_UUID, { ...FILE, mimetype: 'application/pdf' });

            expect(result.success).toBe(false);
            expect(result.message).toMatch(/same media type.*image/);
            expect(UPLOADS.store_file).not.toHaveBeenCalled();
        });
    });

    describe('replace_media_file — happy path', () => {

        test('stores the new file, repoints the row with file-derived fields, purges, unlinks the old file, reindexes', async () => {
            const result = await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE, 'ada');

            expect(result.success).toBe(true);

            /* 1. new file written under a fresh path from the upload pipeline */
            expect(UPLOADS.store_file).toHaveBeenCalledWith(FILE.buffer, 'new.png', 'image/png');
            expect(UPLOADS.extract_metadata).toHaveBeenCalledWith(STORE_RESULT.file_path, 'image');

            /* 2. row repointed with ONLY file-derived fields (descriptive metadata untouched) */
            const [id, replace_data] = mockMediaTasks.replace_media_file.mock.calls[0];
            expect(id).toBe(MEDIA_UUID);
            expect(replace_data).toEqual({
                storage_path: STORE_RESULT.storage_path,
                thumbnail_path: STORE_RESULT.thumbnail_path,
                mime_type: 'image/png',
                original_filename: 'new.png',
                size: 1234,
                exif_data: JSON.stringify({ Make: 'Cam' }),
                media_width: 800,
                media_height: 600,
                updated_by: 'Ada Lovelace'
            });

            /* 3. derivatives of the old source are invalidated */
            expect(IIIF_CACHE.purge).toHaveBeenCalledWith(MEDIA_UUID);

            /* 4. the superseded file (and its thumbnail) is removed — the NEW one is not */
            expect(UPLOADS.delete_stored_file).toHaveBeenCalledTimes(1);
            expect(UPLOADS.delete_stored_file).toHaveBeenCalledWith(OLD_RECORD.storage_path, OLD_RECORD.thumbnail_path);

            /* 5. only PUBLISHED exhibits that reference the media are re-indexed, coalesced per exhibit */
            expect(mockMediaTasks.get_published_exhibit_uuids).toHaveBeenCalledWith([EXHIBIT_A, EXHIBIT_B]);
            expect(REINDEX_COALESCER.schedule_reindex).toHaveBeenCalledTimes(1);
            expect(REINDEX_COALESCER.schedule_reindex).toHaveBeenCalledWith(`exhibit:${EXHIBIT_A}`, expect.any(Function));
            await REINDEX_COALESCER.schedule_reindex.mock.calls[0][1]();
            expect(INDEXER_MODEL.index_exhibit).toHaveBeenCalledWith(EXHIBIT_A, 'publish');
        });

        test('omits updated_by when the username cannot be resolved', async () => {
            mockMediaTasks.get_user_by_username.mockResolvedValue({ success: false });

            await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE, 'ghost');

            expect(mockMediaTasks.replace_media_file.mock.calls[0][1]).not.toHaveProperty('updated_by');
        });

        test('skips the reindex when no referencing exhibit is published', async () => {
            mockMediaTasks.get_published_exhibit_uuids.mockResolvedValue([]);

            await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE);

            expect(REINDEX_COALESCER.schedule_reindex).not.toHaveBeenCalled();
        });

        test('a failure to unlink the old file is tolerated (the sweep is the backstop)', async () => {
            UPLOADS.delete_stored_file.mockRejectedValue(new Error('EACCES'));

            const result = await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE);

            expect(result.success).toBe(true);
        });
    });

    describe('replace_media_file — DB repoint fails', () => {

        test('deletes the NEW file, leaves the live one alone, and does not purge or reindex', async () => {
            mockMediaTasks.replace_media_file.mockResolvedValue({ success: false, message: 'row locked' });

            const result = await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE);

            expect(result).toEqual({ success: false, message: 'row locked' });
            expect(UPLOADS.delete_stored_file).toHaveBeenCalledTimes(1);
            expect(UPLOADS.delete_stored_file).toHaveBeenCalledWith(STORE_RESULT.storage_path, STORE_RESULT.thumbnail_path);
            expect(IIIF_CACHE.purge).not.toHaveBeenCalled();
            expect(REINDEX_COALESCER.schedule_reindex).not.toHaveBeenCalled();
        });

        test('a thrown task error is handled the same way', async () => {
            mockMediaTasks.replace_media_file.mockRejectedValue(new Error('deadlock'));

            const result = await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE);

            expect(result).toEqual({ success: false, message: 'deadlock' });
            expect(UPLOADS.delete_stored_file).toHaveBeenCalledWith(STORE_RESULT.storage_path, STORE_RESULT.thumbnail_path);
        });

        test('a store failure leaves the row untouched', async () => {
            UPLOADS.store_file.mockRejectedValue(new Error('disk full'));

            const result = await MEDIA_MODEL.replace_media_file(MEDIA_UUID, FILE);

            expect(result.success).toBe(false);
            expect(result.message).toContain('disk full');
            expect(mockMediaTasks.replace_media_file).not.toHaveBeenCalled();
        });
    });

    // ==================== delete_media_record ====================

    describe('delete_media_record', () => {

        test('soft-deletes with the resolved actor name and purges derivatives', async () => {
            const result = await MEDIA_MODEL.delete_media_record(MEDIA_UUID, 'ada');

            expect(result).toEqual({ success: true, message: 'Media record deleted successfully', uuid: MEDIA_UUID });
            expect(mockMediaTasks.delete_media_record).toHaveBeenCalledWith(MEDIA_UUID, 'Ada Lovelace');
            expect(IIIF_CACHE.purge).toHaveBeenCalledWith(MEDIA_UUID);
            /* Soft delete never touches the file on disk. */
            expect(UPLOADS.delete_stored_file).not.toHaveBeenCalled();
        });

        test('does not purge when the delete fails, and rejects an invalid id', async () => {
            mockMediaTasks.delete_media_record.mockResolvedValue({ success: false, message: 'in use' });
            expect(await MEDIA_MODEL.delete_media_record(MEDIA_UUID)).toEqual({ success: false, message: 'in use' });
            expect(IIIF_CACHE.purge).not.toHaveBeenCalled();

            expect((await MEDIA_MODEL.delete_media_record('x')).success).toBe(false);
            expect(mockMediaTasks.delete_media_record).toHaveBeenCalledTimes(1);
        });
    });

    // ==================== delete_uploaded_file ====================

    describe('delete_uploaded_file (staged uploads)', () => {

        test('requires a storage_path and rejects traversal or absolute paths', async () => {
            expect((await MEDIA_MODEL.delete_uploaded_file('')).success).toBe(false);
            expect((await MEDIA_MODEL.delete_uploaded_file('../etc/passwd')).message).toBe('Invalid file path');
            expect((await MEDIA_MODEL.delete_uploaded_file('/abs/file.jpg')).message).toBe('Invalid file path');
            expect((await MEDIA_MODEL.delete_uploaded_file('images/a/b/c.jpg', '../x')).message).toBe('Invalid file path');
            expect(UPLOADS.delete_stored_file).not.toHaveBeenCalled();
        });

        test('refuses to delete a file that a saved record references', async () => {
            mockMediaTasks.find_by_storage_path.mockResolvedValue({ exists: true });

            const result = await MEDIA_MODEL.delete_uploaded_file('images/a/b/c.jpg');

            expect(result.success).toBe(false);
            expect(result.message).toMatch(/linked to a saved media record/);
            expect(UPLOADS.delete_stored_file).not.toHaveBeenCalled();
        });

        test('refuses when the THUMBNAIL argument is claimed by a saved record, even if the original is free', async () => {
            mockMediaTasks.find_by_storage_path.mockImplementation(async (p) => ({ exists: p === 'thumbnails/a/b/live_thumb.jpg' }));

            const result = await MEDIA_MODEL.delete_uploaded_file('images/a/b/staged.jpg', 'thumbnails/a/b/live_thumb.jpg');

            expect(result.success).toBe(false);
            expect(result.message).toMatch(/linked to a saved media record/);
            expect(mockMediaTasks.find_by_storage_path).toHaveBeenCalledWith('images/a/b/staged.jpg');
            expect(mockMediaTasks.find_by_storage_path).toHaveBeenCalledWith('thumbnails/a/b/live_thumb.jpg');
            expect(UPLOADS.delete_stored_file).not.toHaveBeenCalled();
        });

        test('confines each argument to its upload subtree', async () => {
            /* original outside the media-type dirs */
            expect((await MEDIA_MODEL.delete_uploaded_file('iiif_cache/a/b/x/1/full.jpg')).message).toBe('Invalid file path');
            /* a thumbnail passed as the original */
            expect((await MEDIA_MODEL.delete_uploaded_file('thumbnails/a/b/x_thumb.jpg')).message).toBe('Invalid file path');
            /* an original passed as the thumbnail */
            expect((await MEDIA_MODEL.delete_uploaded_file('images/a/b/x.jpg', 'images/a/b/y.jpg')).message).toBe('Invalid file path');
            expect(mockMediaTasks.find_by_storage_path).not.toHaveBeenCalled();
            expect(UPLOADS.delete_stored_file).not.toHaveBeenCalled();
        });

        test('deletes an unreferenced staged file and its thumbnail', async () => {
            const result = await MEDIA_MODEL.delete_uploaded_file(' images/a/b/c.jpg ', 'thumbnails/a/b/c_thumb.jpg');

            expect(result).toEqual({ success: true, message: 'Uploaded file removed successfully', storage_path: 'images/a/b/c.jpg' });
            expect(mockMediaTasks.find_by_storage_path).toHaveBeenCalledWith('images/a/b/c.jpg');
            expect(UPLOADS.delete_stored_file).toHaveBeenCalledWith('images/a/b/c.jpg', 'thumbnails/a/b/c_thumb.jpg');
        });
    });
});
