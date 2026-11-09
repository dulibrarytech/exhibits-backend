'use strict';

jest.mock('../../libs/rte_vocabulary', () => ({
    apply: (record) => record
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
    create_media_record: jest.fn(),
    update_media_record: jest.fn(),
    get_user_by_username: jest.fn()
};
jest.mock('../../media-library/tasks/media_record_tasks', () => jest.fn().mockImplementation(() => mockMediaTask));

jest.mock('../../media-library/tasks/media_reference_tasks', () => jest.fn().mockImplementation(() => ({})));

const MEDIA_MODEL = require('../../media-library/model');

const MEDIA_UUID = '61706e13-7896-46d1-8956-ca2acff4e1d6';
const BLANK_NAMES = ['', '   ', '\t\n'];

const media_record = (overrides = {}) => ({
    name: 'Union Station',
    media_type: 'image',
    ingest_method: 'upload',
    ...overrides
});

describe('Media Name must not be blank (media-library/model.js)', () => {

    beforeEach(() => {
        mockMediaTask.create_media_record.mockResolvedValue({ success: true, id: 1, record: { id: 1 } });
        mockMediaTask.update_media_record.mockResolvedValue({ success: true, record: { id: 1 } });
    });

    describe('create_media_record', () => {

        test.each(BLANK_NAMES)('rejects %j', async (name) => {
            const result = await MEDIA_MODEL.create_media_record(media_record({ name }));

            expect(result.success).toBe(false);
            expect(result.message).toBe('Please provide a name.');
            expect(mockMediaTask.create_media_record).not.toHaveBeenCalled();
        });

        test('saves a real name', async () => {
            const result = await MEDIA_MODEL.create_media_record(media_record());

            expect(result.success).toBe(true);
            expect(mockMediaTask.create_media_record).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Union Station' })
            );
        });

        test('still reports a missing name through the schema', async () => {
            const { name, ...record } = media_record();

            const result = await MEDIA_MODEL.create_media_record(record);

            expect(result.success).toBe(false);
            expect(result.message).toMatch(/^Invalid media data: /);
            expect(mockMediaTask.create_media_record).not.toHaveBeenCalled();
        });
    });

    describe('update_media_record', () => {

        test.each([...BLANK_NAMES, null])('rejects %j', async (name) => {
            const result = await MEDIA_MODEL.update_media_record(MEDIA_UUID, { name, description: 'Text' });

            expect(result.success).toBe(false);
            expect(result.message).toBe('Please provide a name.');
            expect(mockMediaTask.update_media_record).not.toHaveBeenCalled();
        });

        test('saves a real name', async () => {
            const result = await MEDIA_MODEL.update_media_record(MEDIA_UUID, { name: 'Union Station' });

            expect(result.success).toBe(true);
            expect(mockMediaTask.update_media_record).toHaveBeenCalledWith(
                MEDIA_UUID,
                expect.objectContaining({ name: 'Union Station' })
            );
        });

        test('saves an update that leaves name out', async () => {
            const result = await MEDIA_MODEL.update_media_record(MEDIA_UUID, { description: 'Text' });

            expect(result.success).toBe(true);
            expect(mockMediaTask.update_media_record).toHaveBeenCalledTimes(1);
        });
    });
});
