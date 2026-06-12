'use strict';

/**
 * Unit tests for Indexer_index_utils_tasks.check_index().
 *
 * Regression guard for the ES "timeout-param" bug: check_index used to pass a
 * `timeout` query param to indices.exists(), but that API is a HEAD request and
 * Elasticsearch rejects it with a 400 (unrecognized parameter) — which made
 * check_index report exists:false for a perfectly healthy index. The fix drops
 * the param (the client-side timeout is the _with_timeout() race). These tests
 * assert the correct results AND that no `timeout` is sent.
 */

// Silence the logger this class pulls in transitively.
vi.mock('../../libs/log4', () => ({
    module: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}));

const Indexer_index_utils_tasks = require('../../indexer/tasks/indexer_index_utils_tasks');

const INDEX = 'exhibits_test';
const CONFIG = { elasticsearch_shards: 1, elasticsearch_replicas: 0 };

function build(exists_impl) {
    const exists = vi.fn(exists_impl);
    const client = { indices: { exists } };
    const tasks = new Indexer_index_utils_tasks(INDEX, client, { ...CONFIG });
    return { tasks, exists };
}

describe('Indexer_index_utils_tasks.check_index', () => {

    // _with_timeout() schedules a setTimeout it never clears; fake timers keep it
    // from leaving a dangling 5s timer after each fast-resolving test.
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('reports exists:true and sends NO `timeout` param (regression: HEAD exists 400s on it)', async () => {
        const { tasks, exists } = build(async () => true);

        const result = await tasks.check_index();

        expect(result).toMatchObject({ success: true, exists: true, index: INDEX });
        expect(exists).toHaveBeenCalledTimes(1);
        const passed = exists.mock.calls[0][0];
        expect(passed).toEqual({ index: INDEX });
        expect(passed).not.toHaveProperty('timeout');
    });

    test('reports exists:false when the index is absent', async () => {
        const { tasks } = build(async () => false);

        const result = await tasks.check_index();

        expect(result).toMatchObject({ success: true, exists: false, index: INDEX });
    });

    test('treats a 404 from Elasticsearch as exists:false (not an error)', async () => {
        const { tasks } = build(async () => {
            const err = new Error('index_not_found_exception');
            err.meta = { statusCode: 404 };
            throw err;
        });

        const result = await tasks.check_index();

        expect(result).toMatchObject({ success: true, exists: false, index: INDEX });
    });

    test('reports success:false on a non-404 Elasticsearch error', async () => {
        const { tasks } = build(async () => {
            const err = new Error('service unavailable');
            err.meta = { statusCode: 503 };
            throw err;
        });

        const result = await tasks.check_index();

        expect(result).toMatchObject({ success: false, exists: false, index: INDEX });
    });
});
