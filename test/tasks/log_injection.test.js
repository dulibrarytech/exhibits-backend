'use strict';

/**
 * Log injection (OWASP A09) — libs/log4.js.
 *
 * Express decodes path parameters, so `%0A` in a URL reaches a handler as a
 * real newline. Handlers that log a REJECTED identifier are logging a value
 * that failed validation, so `/iiif/%0AWARNING:%20forged/...` could write a
 * second, attacker-authored line into the log file.
 *
 * The escaping lives in the logger rather than at the ~940 call sites, so this
 * pins the property that matters: whatever a caller passes, one log event stays
 * one line, and the value is still shown verbatim (escaped, not stripped).
 *
 * This suite requires the REAL logger — most suites mock it — so LOG_LEVEL is
 * forced off to keep the run quiet.
 */

process.env.LOG_LEVEL = 'off';

const LOGGER = require('../../libs/log4');

const { sanitize_log_message } = LOGGER;

describe('sanitize_log_message', () => {

    it('escapes a forged log line instead of emitting it', () => {
        const forged = `evil${String.fromCharCode(10)}WARNING: [auth] login succeeded`;

        const safe = sanitize_log_message(forged);

        expect(safe).toBe('evil\\nWARNING: [auth] login succeeded');
        expect(safe.includes(String.fromCharCode(10))).toBe(false);
    });

    it.each([
        [10, '\\n', 'newline'],
        [13, '\\r', 'carriage return'],
        [9, '\\t', 'tab'],
        [0, '\\u0000', 'null'],
        [27, '\\u001b', 'escape — ANSI sequences'],
        [8, '\\u0008', 'backspace'],
        [127, '\\u007f', 'delete'],
        [133, '\\u0085', 'C1 next-line']
    ])('escapes char %s as %s (%s)', (code, expected) => {
        expect(sanitize_log_message(`a${String.fromCharCode(code)}b`)).toBe(`a${expected}b`);
    });

    it('leaves ordinary text — including a page selector — untouched', () => {
        const identifier = 'b1d47972-3799-49c0-8bb9-6036a754e158;4';
        expect(sanitize_log_message(`Invalid media ID: ${identifier}`))
            .toBe(`Invalid media ID: ${identifier}`);
    });

    it('preserves non-ASCII text', () => {
        expect(sanitize_log_message('Ñandú — “quoted” · 日本語')).toBe('Ñandú — “quoted” · 日本語');
    });

    it('passes non-strings through unchanged', () => {
        const metadata = { stack: `Error: x${String.fromCharCode(10)}    at y` };

        expect(sanitize_log_message(metadata)).toBe(metadata);
        expect(sanitize_log_message(42)).toBe(42);
        expect(sanitize_log_message(null)).toBeNull();
        expect(sanitize_log_message(undefined)).toBeUndefined();
    });
});

describe('the logger returned by module()', () => {

    /*
     * The wrapper inherits from the log4js logger it was built around, so its
     * prototype IS that instance — which is the only handle on it, because
     * LOG4JS.getLogger() hands back a NEW Logger on every call. The wrapper
     * resolves the underlying method per call, so swapping it in place is
     * enough to observe exactly what reached log4js.
     */
    const capture = (level) => {
        const underlying = Object.getPrototypeOf(LOGGER.module());
        const original = underlying[level];
        const calls = [];

        underlying[level] = (...args) => calls.push(args);

        return {
            calls,
            restore: () => { underlying[level] = original; }
        };
    };

    it.each(['error', 'warn', 'info', 'debug'])('escapes the message passed to %s()', (level) => {
        const captured = capture(level);

        try {
            LOGGER.module()[level](`Invalid media ID: evil${String.fromCharCode(10)}forged`);
        } finally {
            captured.restore();
        }

        expect(captured.calls).toHaveLength(1);
        expect(captured.calls[0][0]).toBe('Invalid media ID: evil\\nforged');
    });

    it('passes a metadata object through untouched, so stack traces survive', () => {
        const captured = capture('error');
        const metadata = { stack: `Error: boom${String.fromCharCode(10)}    at handler`, uuid: 'abc' };

        try {
            LOGGER.module().error('ERROR: something failed', metadata);
        } finally {
            captured.restore();
        }

        expect(captured.calls[0][0]).toBe('ERROR: something failed');
        expect(captured.calls[0][1]).toBe(metadata);
        expect(captured.calls[0][1].stack).toContain(String.fromCharCode(10));
    });

    it('escapes a stack trace inlined into the message, keeping one event on one line', () => {
        const captured = capture('error');

        try {
            LOGGER.module().error(`ERROR: boom${String.fromCharCode(10)}    at handler`);
        } finally {
            captured.restore();
        }

        expect(captured.calls[0][0]).toBe('ERROR: boom\\n    at handler');
    });

    it('is built around one logger instance, not a new one per log statement', () => {
        /* The previous implementation called LOG4JS.getLogger() at every log
           statement, and that allocates a fresh Logger every time. */
        expect(Object.getPrototypeOf(LOGGER.module())).toBe(Object.getPrototypeOf(LOGGER.module()));
    });

    it('still exposes the underlying logger API it does not override', () => {
        const wrapped = LOGGER.module();

        expect(typeof wrapped.level).not.toBe('undefined');
        expect(typeof wrapped.isLevelEnabled).toBe('function');
    });

    it('returns one shared instance, rather than rebuilding per log statement', () => {
        expect(LOGGER.module()).toBe(LOGGER.module());
    });
});
