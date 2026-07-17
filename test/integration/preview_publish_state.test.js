'use strict';

/**
 * Preview / publish / suppress — DB publish-state pins.
 *
 * Production bug (2026-07-16): previewing a PUBLISHED exhibit silently
 * unpublished every grid item and timeline item. `delete_grids_from_index` and
 * `delete_timelines_from_index` each carried a DB write
 * (set_to_suppressed_grid_items / set_to_suppressed_timeline_items) despite
 * their index-only names, and `check_preview` returns true whenever the exhibit
 * is present in the index — which every published exhibit is — so the
 * "delete the old preview first" branch ran on every preview.
 *
 * These pins lock the three invariants that bug violated:
 *   1. preview NEVER mutates publish state
 *   2. suppress DOES suppress container items (it used to rely on the side
 *      effect removed in 1)
 *   3. publish publishes container items via the EXHIBIT-scoped task method
 *      (the grid/timeline-scoped one silently affects 0 rows when handed an
 *      exhibit uuid)
 */

process.env.ELASTICSEARCH_HOST = process.env.ELASTICSEARCH_HOST || 'http://es.test:9200';

jest.mock('../../libs/log4', () => ({
    module: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../config/db_config', () => () => jest.fn(() => ({})));

const EXHIBIT_UUID = '9a8403ea-6016-4942-a611-a07140106c4f';
const GRID_UUID = 'ffffffff-6666-4666-8666-666666666666';
const TIMELINE_UUID = 'ffffffff-6666-4666-8666-666666666667';

const mockExhibitTask = {
    set_to_publish: jest.fn().mockResolvedValue(true),
    set_to_suppress: jest.fn().mockResolvedValue(true),
    set_preview: jest.fn().mockResolvedValue(true),
    unset_preview: jest.fn().mockResolvedValue(true),
    get_exhibit_record: jest.fn().mockResolvedValue({ uuid: EXHIBIT_UUID })
};

const mockItemTask = {
    get_item_records: jest.fn().mockResolvedValue([]),
    get_record_count: jest.fn().mockResolvedValue(1),
    set_to_publish: jest.fn().mockResolvedValue(true),
    set_to_suppress: jest.fn().mockResolvedValue(true)
};

const mockHeadingTask = {
    get_heading_records: jest.fn().mockResolvedValue([]),
    get_record_count: jest.fn().mockResolvedValue(1),
    set_to_publish: jest.fn().mockResolvedValue(true),
    set_to_suppress: jest.fn().mockResolvedValue(true)
};

const mockGridTask = {
    get_record_count: jest.fn().mockResolvedValue(1),
    get_grid_records: jest.fn().mockResolvedValue([{ uuid: GRID_UUID, is_member_of_exhibit: EXHIBIT_UUID }]),
    set_to_publish: jest.fn().mockResolvedValue(true),
    set_to_suppress: jest.fn().mockResolvedValue(true),
    // the grid-scoped writers — must NOT be used by preview
    set_to_suppressed_grid_items: jest.fn().mockResolvedValue({ success: true }),
    set_to_publish_grid_items: jest.fn().mockResolvedValue({ success: true }),
    // the exhibit-scoped writers
    set_exhibit_grid_items_to_suppress: jest.fn().mockResolvedValue({ success: true }),
    set_exhibit_grid_items_to_publish: jest.fn().mockResolvedValue({ success: true })
};

const mockTimelineTask = {
    get_record_count: jest.fn().mockResolvedValue(1),
    get_timeline_records: jest.fn().mockResolvedValue([{ uuid: TIMELINE_UUID, is_member_of_exhibit: EXHIBIT_UUID }]),
    set_to_publish: jest.fn().mockResolvedValue(true),
    set_to_suppress: jest.fn().mockResolvedValue(true),
    set_to_suppressed_timeline_items: jest.fn().mockResolvedValue({ success: true }),
    set_to_publish_timeline_items: jest.fn().mockResolvedValue({ success: true }),
    set_exhibit_timeline_items_to_suppress: jest.fn().mockResolvedValue({ success: true }),
    set_exhibit_timeline_items_to_publish: jest.fn().mockResolvedValue({ success: true })
};

jest.mock('../../exhibits/tasks/exhibit_record_tasks', () => jest.fn().mockImplementation(() => mockExhibitTask));
jest.mock('../../exhibits/tasks/exhibit_item_record_tasks', () => jest.fn().mockImplementation(() => mockItemTask));
jest.mock('../../exhibits/tasks/exhibit_heading_record_tasks', () => jest.fn().mockImplementation(() => mockHeadingTask));
jest.mock('../../exhibits/tasks/exhibit_grid_record_tasks', () => jest.fn().mockImplementation(() => mockGridTask));
jest.mock('../../exhibits/tasks/exhibit_timeline_record_tasks', () => jest.fn().mockImplementation(() => mockTimelineTask));

jest.mock('../../indexer/model', () => ({
    index_exhibit: jest.fn().mockResolvedValue({ status: 201 }),
    index_record: jest.fn().mockResolvedValue({ status: 201 }),
    delete_record: jest.fn().mockResolvedValue({ status: 204 }),
    get_indexed_record: jest.fn().mockResolvedValue({ data: { found: true } })
}));

const EXHIBITS_MODEL = require('../../exhibits/exhibits_model');
const INDEXER_MODEL = require('../../indexer/model');

const container_item_writers = () => ([
    ...Object.entries(mockGridTask),
    ...Object.entries(mockTimelineTask)
].filter(([name]) => /grid_items|timeline_items/.test(name)));

describe('preview does not mutate publish state', () => {

    beforeEach(() => jest.clearAllMocks());

    test('delete_exhibit_preview deletes index records WITHOUT suppressing container items', async () => {
        const result = await EXHIBITS_MODEL.delete_exhibit_preview(EXHIBIT_UUID);

        expect(result.status).toBe(true);

        // It must still clear the index (that IS its job).
        expect(INDEXER_MODEL.delete_record).toHaveBeenCalledWith(EXHIBIT_UUID);
        expect(INDEXER_MODEL.delete_record).toHaveBeenCalledWith(GRID_UUID);
        expect(INDEXER_MODEL.delete_record).toHaveBeenCalledWith(TIMELINE_UUID);

        // The regression: no publish-state writer may fire on this path.
        for (const [name, fn] of container_item_writers()) {
            expect(`${name}:${fn.mock.calls.length}`).toBe(`${name}:0`);
        }
    });

    test('build_exhibit_preview sets the preview flag WITHOUT touching container item publish state', async () => {
        const result = await EXHIBITS_MODEL.build_exhibit_preview(EXHIBIT_UUID);

        expect(result.status).toBe(true);
        expect(mockExhibitTask.set_preview).toHaveBeenCalledWith(EXHIBIT_UUID);
        expect(INDEXER_MODEL.index_exhibit).toHaveBeenCalledWith(EXHIBIT_UUID, 'preview');

        for (const [name, fn] of container_item_writers()) {
            expect(`${name}:${fn.mock.calls.length}`).toBe(`${name}:0`);
        }

        // Preview must never change published state on any record type.
        expect(mockExhibitTask.set_to_suppress).not.toHaveBeenCalled();
        expect(mockItemTask.set_to_suppress).not.toHaveBeenCalled();
    });
});

describe('suppress still suppresses container items (coverage the removed side effect used to provide)', () => {

    beforeEach(() => jest.clearAllMocks());

    test('suppress_exhibit suppresses grid items and timeline items, exhibit-scoped', async () => {
        await EXHIBITS_MODEL.suppress_exhibit(EXHIBIT_UUID);

        expect(mockGridTask.set_exhibit_grid_items_to_suppress).toHaveBeenCalledWith(EXHIBIT_UUID);
        expect(mockTimelineTask.set_exhibit_timeline_items_to_suppress).toHaveBeenCalledWith(EXHIBIT_UUID);
        expect(mockExhibitTask.set_to_suppress).toHaveBeenCalledWith(EXHIBIT_UUID);
    });
});

describe('publish publishes container items through the exhibit-scoped writer', () => {

    beforeEach(() => jest.clearAllMocks());

    test('publish_exhibit uses the exhibit-scoped item writers, not the grid/timeline-scoped ones', async () => {
        await EXHIBITS_MODEL.publish_exhibit(EXHIBIT_UUID);

        expect(mockGridTask.set_exhibit_grid_items_to_publish).toHaveBeenCalledWith(EXHIBIT_UUID);
        expect(mockTimelineTask.set_exhibit_timeline_items_to_publish).toHaveBeenCalledWith(EXHIBIT_UUID);

        // Handing an exhibit uuid to the grid/timeline-scoped writers matches 0
        // rows (they filter on is_member_of_grid / is_member_of_timeline).
        expect(mockGridTask.set_to_publish_grid_items).not.toHaveBeenCalled();
        expect(mockTimelineTask.set_to_publish_timeline_items).not.toHaveBeenCalled();
    });
});
