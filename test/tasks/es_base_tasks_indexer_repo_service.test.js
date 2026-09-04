'use strict';

/**
 * Pins the Es_base_tasks extraction (DRY review 2026-09-03, cluster O4):
 * the three Elasticsearch task classes extend one base, keep their public
 * surface, and keep the behaviour the former per-class copies had — the
 * per-class error-log prefix, the repo-service timeout message, and the
 * indexer's UUID error text (which includes the offending value).
 */

/*
 * vi.mock does not intercept CJS require() chains, so the logger is captured
 * by spying on the shared log4 module instance instead (the base holds the
 * same require-cached object). restoreMocks resets the spy before each test,
 * hence it is re-armed in beforeEach.
 */
const LOGGER = require('../../libs/log4');
const mock_logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };

const Es_base_tasks = require('../../libs/es_base_tasks');
const { UUID_REGEX } = require('../../libs/uuid');
const Indexer_index_tasks = require('../../indexer/tasks/indexer_index_tasks');
const Indexer_index_utils_tasks = require('../../indexer/tasks/indexer_index_utils_tasks');
const Repo_service_tasks = require('../../media-library/tasks/repo_service_tasks');

const INDEX = 'exhibits_test';

function es_client() {
    return {
        index: vi.fn(), get: vi.fn(), delete: vi.fn(), bulk: vi.fn(),
        search: vi.fn(), scroll: vi.fn(), clearScroll: vi.fn(),
        indices: { exists: vi.fn() }
    };
}

describe('Es_base_tasks', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(LOGGER, 'module').mockReturnValue(mock_logger);
    });
    afterEach(() => vi.useRealTimers());

    test('the three ES task classes extend it and share libs/uuid', () => {
        const client = es_client();
        const index_tasks = new Indexer_index_tasks(client, INDEX);
        const utils_tasks = new Indexer_index_utils_tasks(INDEX, client, { elasticsearch_shards: 1, elasticsearch_replicas: 0 });
        const repo_tasks = new Repo_service_tasks(client, INDEX);

        for (const tasks of [index_tasks, utils_tasks, repo_tasks]) {
            expect(tasks).toBeInstanceOf(Es_base_tasks);
            expect(tasks.CLIENT).toBe(client);
            expect(tasks.INDEX).toBe(INDEX);
            expect(tasks.UUID_REGEX).toBe(UUID_REGEX);
        }

        /* index-utils keeps its historical alias for the index name */
        expect(utils_tasks.INDEX_NAME).toBe(INDEX);
    });

    test('_validate_dependencies keeps the constructor error strings', () => {
        expect(() => new Indexer_index_tasks(null, INDEX)).toThrow('Valid Elasticsearch client is required');
        expect(() => new Indexer_index_tasks(es_client(), '')).toThrow('Valid index name is required');
        expect(() => new Repo_service_tasks(null, INDEX)).toThrow('Valid Elasticsearch client is required');
        expect(() => new Repo_service_tasks(es_client(), 42)).toThrow('Valid index name is required');
        /* index-utils checks the name first, with trim, then the client */
        expect(() => new Indexer_index_utils_tasks('   ', null, {})).toThrow('Valid index name is required');
        expect(() => new Indexer_index_utils_tasks(INDEX, {}, {})).toThrow('Elasticsearch client must have indices API');
    });

    test('_handle_error logs with the per-class prefix and does not throw', () => {
        const client = es_client();
        const cases = [
            [new Indexer_index_tasks(client, INDEX), '/indexer/indexer_index_tasks'],
            [new Indexer_index_utils_tasks(INDEX, client, { elasticsearch_shards: 1, elasticsearch_replicas: 0 }), '/indexer/indexer_index_utils_tasks'],
            [new Repo_service_tasks(client, INDEX), '/media-library/tasks/repo_service_tasks']
        ];

        for (const [tasks, prefix] of cases) {
            mock_logger.error.mockClear();
            const error = new Error('boom');
            error.meta = { statusCode: 503, body: { error: { type: 'unavailable', reason: 'down' } } };

            expect(() => tasks._handle_error(error, 'do_thing', { extra: 1 })).not.toThrow();

            expect(mock_logger.error).toHaveBeenCalledTimes(1);
            const [message, context] = mock_logger.error.mock.calls[0];
            expect(message).toBe(`ERROR: [${prefix} (do_thing)] Failed to do thing`);
            expect(context).toMatchObject({
                method: 'do_thing', index: INDEX, extra: 1, message: 'boom',
                error_type: 'Error', status_code: 503, elasticsearch_error: 'unavailable', reason: 'down'
            });
        }
    });

    test('_log_success stamps the index and a timestamp', () => {
        const tasks = new Indexer_index_tasks(es_client(), INDEX);
        mock_logger.info.mockClear();

        tasks._log_success('done', { uuid: 'x' });

        const [message, context] = mock_logger.info.mock.calls[0];
        expect(message).toBe('done');
        expect(context).toMatchObject({ index: INDEX, uuid: 'x' });
        expect(typeof context.timestamp).toBe('string');
    });

    test('_with_timeout rejects with the indexer message by default and the repo-service message there', async () => {
        const never = new Promise(() => {});
        const index_tasks = new Indexer_index_tasks(es_client(), INDEX);
        const repo_tasks = new Repo_service_tasks(es_client(), INDEX);

        const index_race = index_tasks._with_timeout(never, 50);
        const repo_race = repo_tasks._with_timeout(never, 50);
        const index_result = index_race.then(() => 'resolved', (e) => e.message);
        const repo_result = repo_race.then(() => 'resolved', (e) => e.message);

        await vi.advanceTimersByTimeAsync(60);

        expect(await index_result).toBe('Elasticsearch operation timeout');
        expect(await repo_result).toBe('Operation timed out after 50ms');
    });

    test('_with_timeout resolves with the operation result when it finishes first', async () => {
        const tasks = new Indexer_index_tasks(es_client(), INDEX);
        await expect(tasks._with_timeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
    });

    test('_validate_uuid keeps the indexer error strings (invalid value echoed back)', () => {
        const tasks = new Indexer_index_tasks(es_client(), INDEX);
        const valid = '550e8400-e29b-41d4-a716-446655440000';

        expect(tasks._validate_uuid(`  ${valid}  `, 'record UUID')).toBe(valid);
        expect(() => tasks._validate_uuid('', 'record UUID')).toThrow('Valid record UUID is required');
        expect(() => tasks._validate_uuid('   ', 'record UUID')).toThrow('Valid record UUID is required');
        expect(() => tasks._validate_uuid('not-a-uuid', 'record UUID')).toThrow('Invalid record UUID format: not-a-uuid');
    });
});
