'use strict';

/**
 * Global process safety nets (config/process_handlers.js).
 *
 * Guards the fix for "no process.on('unhandledRejection'/'uncaughtException')
 * anywhere": the handler factories are tested in isolation (no real process
 * events emitted) by injecting a fake logger / exit / cleanup:
 *   - unhandledRejection -> logs, does NOT exit;
 *   - uncaughtException  -> logs FATAL, runs cleanup, exits(1) exactly once,
 *     and still exits if cleanup rejects or hangs (timeout fallback).
 */

const {
    make_unhandled_rejection_handler,
    make_uncaught_exception_handler
} = require('../../config/process_handlers');

const make_logger = () => {
    const error = vi.fn();
    return { logger: { module: () => ({ error }) }, error };
};

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

describe('process_handlers — unhandledRejection', () => {

    it('logs an Error reason (with stack) and does not exit the process', () => {
        const { logger, error } = make_logger();
        make_unhandled_rejection_handler(logger)(new Error('boom'));

        expect(error).toHaveBeenCalledTimes(1);
        expect(error.mock.calls[0][0]).toMatch(/Unhandled promise rejection: boom/);
        expect(error.mock.calls[0][1]).toHaveProperty('stack');
    });

    it('logs a non-Error reason as a string', () => {
        const { logger, error } = make_logger();
        make_unhandled_rejection_handler(logger)('plain reason');

        expect(error.mock.calls[0][0]).toMatch(/plain reason/);
        expect(error.mock.calls[0][1].stack).toBeUndefined();
    });
});

describe('process_handlers — uncaughtException', () => {

    it('logs FATAL, runs cleanup, then exits(1) once', async () => {
        const { logger, error } = make_logger();
        const exit = vi.fn();
        const on_fatal = vi.fn().mockResolvedValue();

        make_uncaught_exception_handler({ logger, on_fatal, exit, exit_timeout_ms: 1000 })(new Error('fatal boom'));

        expect(error).toHaveBeenCalledTimes(1);
        expect(error.mock.calls[0][0]).toMatch(/FATAL.*fatal boom/);

        await tick();
        expect(on_fatal).toHaveBeenCalledTimes(1);
        expect(exit).toHaveBeenCalledWith(1);
        expect(exit).toHaveBeenCalledTimes(1);
    });

    it('still exits(1) when cleanup rejects', async () => {
        const { logger } = make_logger();
        const exit = vi.fn();
        const on_fatal = vi.fn().mockRejectedValue(new Error('cleanup failed'));

        make_uncaught_exception_handler({ logger, on_fatal, exit, exit_timeout_ms: 1000 })(new Error('x'));

        await tick();
        expect(exit).toHaveBeenCalledWith(1);
        expect(exit).toHaveBeenCalledTimes(1);
    });

    it('exits via the timeout fallback when cleanup hangs, and only once', async () => {
        const { logger } = make_logger();
        const exit = vi.fn();
        const on_fatal = vi.fn(() => new Promise(() => {})); // never resolves

        make_uncaught_exception_handler({ logger, on_fatal, exit, exit_timeout_ms: 20 })(new Error('x'));

        await tick(60);
        expect(exit).toHaveBeenCalledWith(1);
        expect(exit).toHaveBeenCalledTimes(1);
    });
});
