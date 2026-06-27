/**
 * Unit tests for reindex_coalescer — the per-key debounce that coalesces
 * fire-and-forget re-index tasks (Phase 3 / S4 of the publish-amplification work).
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// Stable logger mock. Kept outside the factory so it can be re-bound in beforeEach:
// vitest's `restoreMocks: true` resets a `jest.fn(() => x)` implementation between
// tests, which would otherwise make LOGGER.module() return undefined.
const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
};

jest.mock('../../libs/log4', () => ({
    module: jest.fn()
}));

const LOGGER = require('../../libs/log4');
const COALESCER = require('../../exhibits/reindex_coalescer');

describe('reindex_coalescer.schedule_reindex', () => {

    beforeEach(() => {
        jest.useFakeTimers();
        // Reassign directly (not mockReturnValue): vitest's restoreMocks strips the
        // factory fn's mock identity between tests, so bind a fresh one here.
        mockLogger.error.mockClear();
        LOGGER.module = jest.fn(() => mockLogger);
    });

    afterEach(() => {
        // Cancel any leftover pending timers and clear the shared map between tests.
        for (const timer of COALESCER._timers.values()) {
            clearTimeout(timer);
        }
        COALESCER._timers.clear();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    test('runs the task once after the default debounce window (not immediately)', async () => {
        const task = jest.fn().mockResolvedValue();

        COALESCER.schedule_reindex('item:A', task);
        expect(task).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(COALESCER.DEFAULT_DEBOUNCE_MS);
        expect(task).toHaveBeenCalledTimes(1);
    });

    test('coalesces a burst on the same key into ONE run of the latest task', async () => {
        const first = jest.fn().mockResolvedValue();
        const second = jest.fn().mockResolvedValue();
        const third = jest.fn().mockResolvedValue();

        COALESCER.schedule_reindex('item:A', first, 1000);
        await jest.advanceTimersByTimeAsync(400);              // still within the window
        COALESCER.schedule_reindex('item:A', second, 1000);   // cancels `first`
        await jest.advanceTimersByTimeAsync(400);
        COALESCER.schedule_reindex('item:A', third, 1000);    // cancels `second`

        await jest.advanceTimersByTimeAsync(1000);            // let the burst settle

        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled();
        expect(third).toHaveBeenCalledTimes(1);               // only the latest runs
    });

    test('different keys are debounced independently', async () => {
        const a = jest.fn().mockResolvedValue();
        const b = jest.fn().mockResolvedValue();

        COALESCER.schedule_reindex('item:A', a, 1000);
        COALESCER.schedule_reindex('grid_item:B', b, 1000);

        await jest.advanceTimersByTimeAsync(1000);
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    test('respects a custom delay', async () => {
        const task = jest.fn().mockResolvedValue();

        COALESCER.schedule_reindex('item:A', task, 250);

        await jest.advanceTimersByTimeAsync(200);
        expect(task).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(50);
        expect(task).toHaveBeenCalledTimes(1);
    });

    test('clears the key after running, so a later edit schedules a fresh re-index', async () => {
        const first = jest.fn().mockResolvedValue();
        COALESCER.schedule_reindex('item:A', first, 1000);
        await jest.advanceTimersByTimeAsync(1000);

        expect(first).toHaveBeenCalledTimes(1);
        expect(COALESCER._timers.has('item:A')).toBe(false);

        const second = jest.fn().mockResolvedValue();
        COALESCER.schedule_reindex('item:A', second, 1000);
        await jest.advanceTimersByTimeAsync(1000);
        expect(second).toHaveBeenCalledTimes(1);
    });

    test('an error thrown by the task is caught and logged, never propagated', async () => {
        const task = jest.fn().mockRejectedValue(new Error('index boom'));

        COALESCER.schedule_reindex('item:A', task, 1000);
        await jest.advanceTimersByTimeAsync(1000);            // must not reject

        expect(task).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalled();
    });
});
