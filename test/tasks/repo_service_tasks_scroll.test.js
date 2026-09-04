'use strict';

/**
 * Pins `Repo_service_tasks.get_subjects` and `.get_resource_types` — the two
 * Elasticsearch scroll-and-aggregate methods.
 *
 * Written BEFORE the `_scroll_all` extraction (DRY review 2026-09-03, cluster
 * O7) because these methods had zero unit coverage and the two ~80-line copies
 * of the scroll loop had to be proved equivalent before being merged. Every
 * assertion below describes behaviour that existed prior to the refactor: the
 * search body, the scroll/clearScroll call sequence, the return envelopes for
 * success / empty response / index-missing / generic failure, and the log
 * strings (which are part of the operational contract — they are what an
 * on-call developer greps for).
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

/*
 * vi.mock does not intercept CJS require() chains, so the logger is captured by
 * spying on the shared log4 module instance (the task class holds the same
 * require-cached object). restoreMocks resets the spy, hence the re-arm in
 * beforeEach.
 */
const LOGGER = require('../../libs/log4');
const Repo_service_tasks = require('../../media-library/tasks/repo_service_tasks');

const INDEX = 'repo_test_index';

const mock_logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };

/**
 * Builds a stub Elasticsearch client whose `search` returns the first page and
 * whose `scroll` returns each subsequent page in turn (an empty page ends the
 * loop, exactly as a real scroll does).
 * @param {Array} pages - Array of hit arrays; pages[0] is the initial search
 * @returns {Object} Stub client
 */
function es_client(pages) {

    const [first, ...rest] = pages;
    let call = 0;

    return {
        search: vi.fn().mockResolvedValue({
            _scroll_id: 'scroll-0',
            hits: { hits: first }
        }),
        scroll: vi.fn().mockImplementation(() => {
            const hits = rest[call] || [];
            call += 1;
            return Promise.resolve({
                _scroll_id: `scroll-${call}`,
                hits: { hits: hits }
            });
        }),
        clearScroll: vi.fn().mockResolvedValue({})
    };
}

/** Builds a hit carrying a display_record.subjects array */
const subject_hit = (subjects) => ({ _source: { display_record: { subjects: subjects } } });

/** Builds a hit carrying a display_record.resource_type value */
const resource_type_hit = (value) => ({ _source: { display_record: { resource_type: value } } });

/** Builds an Elasticsearch error carrying an HTTP status the way the client does */
const es_error = (message, status_code) => {
    const error = new Error(message);
    if (status_code !== undefined) {
        error.meta = { statusCode: status_code };
    }
    return error;
};

/** Collects every message string passed to a logger level */
const logged = (level) => mock_logger[level].mock.calls.map((call) => call[0]);

describe('Repo_service_tasks scroll methods', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(LOGGER, 'module').mockReturnValue(mock_logger);
    });

    afterEach(() => vi.useRealTimers());

    // ==================== get_subjects ====================

    describe('get_subjects', () => {

        test('issues the subjects scroll search with the pinned query, size and _source', async () => {
            const client = es_client([[]]);
            const tasks = new Repo_service_tasks(client, INDEX);

            await tasks.get_subjects();

            expect(client.search).toHaveBeenCalledTimes(1);
            expect(client.search).toHaveBeenCalledWith({
                index: INDEX,
                scroll: '30s',
                size: 1000,
                body: {
                    query: {
                        exists: {
                            field: 'display_record.subjects.terms.type'
                        }
                    },
                    _source: ['display_record.subjects']
                }
            });
        });

        test('scrolls every page, groups terms by type, dedupes case-insensitively and sorts', async () => {
            const client = es_client([
                [subject_hit([
                    {
                        authority: 'lcsh',
                        authority_id: 'a1',
                        title: 'Ranching',
                        terms: [
                            { type: 'Topical', term: 'Ranching' },
                            { type: 'geographic', term: 'Colorado' }
                        ]
                    }
                ])],
                [subject_hit([
                    {
                        terms: [
                            /* duplicate of page 1 in different casing — must not double up */
                            { type: 'topical', term: 'ranching' },
                            { type: 'topical', term: 'Agriculture' },
                            /* incomplete entries are skipped */
                            { type: 'topical' },
                            { term: 'no type' }
                        ]
                    },
                    /* a subject without a terms array is skipped */
                    { authority: 'lcsh' }
                ])],
                []
            ]);

            const tasks = new Repo_service_tasks(client, INDEX);
            const result = await tasks.get_subjects();

            expect(client.scroll).toHaveBeenCalledTimes(2);
            expect(client.scroll).toHaveBeenNthCalledWith(1, { scroll_id: 'scroll-0', scroll: '30s' });
            expect(client.scroll).toHaveBeenNthCalledWith(2, { scroll_id: 'scroll-1', scroll: '30s' });

            expect(result.success).toBe(true);
            expect(result.total).toBe(3);
            expect(result.message).toBe('Found 3 unique subject(s) across 2 type(s)');
            expect(Object.keys(result.subjects).sort()).toEqual(['geographic', 'topical']);

            /* sorted by term; first-seen casing and authority metadata preserved */
            expect(result.subjects.topical).toEqual([
                { term: 'Agriculture', authority: null, authority_id: null, title: 'Agriculture' },
                { term: 'Ranching', authority: 'lcsh', authority_id: 'a1', title: 'Ranching' }
            ]);
            expect(result.subjects.geographic).toEqual([
                { term: 'Colorado', authority: 'lcsh', authority_id: 'a1', title: 'Ranching' }
            ]);
        });

        test('clears the scroll context with the last scroll id', async () => {
            const client = es_client([[subject_hit([])], []]);
            const tasks = new Repo_service_tasks(client, INDEX);

            await tasks.get_subjects();

            expect(client.clearScroll).toHaveBeenCalledTimes(1);
            expect(client.clearScroll).toHaveBeenCalledWith({ scroll_id: 'scroll-1' });
        });

        test('a clearScroll failure is warned about, not surfaced to the caller', async () => {
            const client = es_client([[subject_hit([])], []]);
            client.clearScroll.mockRejectedValue(new Error('context gone'));
            const tasks = new Repo_service_tasks(client, INDEX);

            const result = await tasks.get_subjects();

            expect(result.success).toBe(true);
            expect(logged('warn')).toContain(
                'WARNING: [/media-library/tasks/repo_service_tasks (get_subjects)] Failed to clear scroll: context gone'
            );
        });

        test('logs the success line with the type list and total', async () => {
            const client = es_client([[subject_hit([{ terms: [{ type: 'topical', term: 'Ranching' }] }])], []]);
            const tasks = new Repo_service_tasks(client, INDEX);

            await tasks.get_subjects();

            expect(mock_logger.info).toHaveBeenCalledWith(
                'INFO: [/media-library/tasks/repo_service_tasks (get_subjects)] Subjects retrieved successfully',
                expect.objectContaining({ types: ['topical'], total: 1 })
            );
        });

        test('returns the empty-response envelope when Elasticsearch answers without hits', async () => {
            const client = es_client([[]]);
            client.search.mockResolvedValue({});
            const tasks = new Repo_service_tasks(client, INDEX);

            const result = await tasks.get_subjects();

            expect(result).toEqual({
                success: false,
                message: 'Empty response from Elasticsearch',
                subjects: {},
                total: 0
            });
            expect(client.scroll).not.toHaveBeenCalled();
        });

        test('maps a 404 from Elasticsearch to the index-not-found envelope', async () => {
            const client = es_client([[]]);
            client.search.mockRejectedValue(es_error('index_not_found_exception', 404));
            const tasks = new Repo_service_tasks(client, INDEX);

            const result = await tasks.get_subjects();

            expect(result).toEqual({
                success: false,
                message: 'Search index not found',
                subjects: {},
                total: 0
            });
            expect(logged('warn')).toContain(
                `WARNING: [/media-library/tasks/repo_service_tasks (get_subjects)] Index not found: ${INDEX}`
            );
        });

        test('maps any other failure to the generic envelope carrying the error message', async () => {
            const client = es_client([[]]);
            client.search.mockRejectedValue(es_error('connection refused'));
            const tasks = new Repo_service_tasks(client, INDEX);

            const result = await tasks.get_subjects();

            expect(result).toEqual({
                success: false,
                message: 'Failed to retrieve subjects: connection refused',
                subjects: {},
                total: 0
            });
            expect(mock_logger.error).toHaveBeenCalledWith(
                'ERROR: [/media-library/tasks/repo_service_tasks (get_subjects)] Failed to get subjects',
                expect.objectContaining({ method: 'get_subjects', index: INDEX })
            );
        });
    });

    // ==================== get_resource_types ====================

    describe('get_resource_types', () => {

        test('issues the resource-type scroll search with the pinned query, size and _source', async () => {
            const client = es_client([[]]);
            const tasks = new Repo_service_tasks(client, INDEX);

            await tasks.get_resource_types();

            expect(client.search).toHaveBeenCalledTimes(1);
            expect(client.search).toHaveBeenCalledWith({
                index: INDEX,
                scroll: '30s',
                size: 1000,
                body: {
                    query: {
                        exists: {
                            field: 'display_record.resource_type'
                        }
                    },
                    _source: ['display_record.resource_type']
                }
            });
        });

        test('scrolls every page, dedupes case-insensitively and sorts the values', async () => {
            const client = es_client([
                [resource_type_hit('Still Image'), resource_type_hit('text')],
                [
                    resource_type_hit('still image'),  /* duplicate in different casing */
                    resource_type_hit('  '),           /* blank is skipped */
                    resource_type_hit(null),           /* missing is skipped */
                    { _source: {} }                    /* no display_record at all */
                ],
                []
            ]);

            const tasks = new Repo_service_tasks(client, INDEX);
            const result = await tasks.get_resource_types();

            expect(client.scroll).toHaveBeenCalledTimes(2);
            expect(result.success).toBe(true);
            expect(result.total).toBe(2);
            expect(result.message).toBe('Found 2 unique resource type(s)');
            expect(result.resource_types).toEqual([
                { resource_type: 'Still Image' },
                { resource_type: 'text' }
            ]);
        });

        test('clears the scroll context with the last scroll id', async () => {
            const client = es_client([[resource_type_hit('text')], []]);
            const tasks = new Repo_service_tasks(client, INDEX);

            await tasks.get_resource_types();

            expect(client.clearScroll).toHaveBeenCalledWith({ scroll_id: 'scroll-1' });
        });

        test('a clearScroll failure is warned about, not surfaced to the caller', async () => {
            const client = es_client([[resource_type_hit('text')], []]);
            client.clearScroll.mockRejectedValue(new Error('context gone'));
            const tasks = new Repo_service_tasks(client, INDEX);

            const result = await tasks.get_resource_types();

            expect(result.success).toBe(true);
            expect(logged('warn')).toContain(
                'WARNING: [/media-library/tasks/repo_service_tasks (get_resource_types)] Failed to clear scroll: context gone'
            );
        });

        test('logs the success line with the total', async () => {
            const client = es_client([[resource_type_hit('text')], []]);
            const tasks = new Repo_service_tasks(client, INDEX);

            await tasks.get_resource_types();

            expect(mock_logger.info).toHaveBeenCalledWith(
                'INFO: [/media-library/tasks/repo_service_tasks (get_resource_types)] Resource types retrieved successfully',
                expect.objectContaining({ total: 1 })
            );
        });

        test('returns the empty-response envelope when Elasticsearch answers without hits', async () => {
            const client = es_client([[]]);
            client.search.mockResolvedValue({});
            const tasks = new Repo_service_tasks(client, INDEX);

            const result = await tasks.get_resource_types();

            expect(result).toEqual({
                success: false,
                message: 'Empty response from Elasticsearch',
                resource_types: [],
                total: 0
            });
        });

        test('maps a 404 from Elasticsearch to the index-not-found envelope', async () => {
            const client = es_client([[]]);
            client.search.mockRejectedValue(es_error('index_not_found_exception', 404));
            const tasks = new Repo_service_tasks(client, INDEX);

            const result = await tasks.get_resource_types();

            expect(result).toEqual({
                success: false,
                message: 'Search index not found',
                resource_types: [],
                total: 0
            });
            expect(logged('warn')).toContain(
                `WARNING: [/media-library/tasks/repo_service_tasks (get_resource_types)] Index not found: ${INDEX}`
            );
        });

        test('maps any other failure to the generic envelope carrying the error message', async () => {
            const client = es_client([[]]);
            client.search.mockRejectedValue(es_error('connection refused'));
            const tasks = new Repo_service_tasks(client, INDEX);

            const result = await tasks.get_resource_types();

            expect(result).toEqual({
                success: false,
                message: 'Failed to retrieve resource types: connection refused',
                resource_types: [],
                total: 0
            });
            expect(mock_logger.error).toHaveBeenCalledWith(
                'ERROR: [/media-library/tasks/repo_service_tasks (get_resource_types)] Failed to get resource types',
                expect.objectContaining({ method: 'get_resource_types', index: INDEX })
            );
        });
    });
});
