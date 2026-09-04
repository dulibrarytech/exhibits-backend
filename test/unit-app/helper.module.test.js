// @vitest-environment jsdom
//
// Pattern reference for unit-testing public/app/*.module.js files.
// These modules are IIFEs assigned to a const at file scope (matching how
// they're loaded as <script> tags in the dashboard), so the test reads the
// source, rewrites the assignment to attach to globalThis, and evals it
// inside the jsdom window. DOMPurify is referenced as a bare global by
// these modules and must be initialized on window first.

'use strict';

const { load_browser_module } = require('./helpers/load_module');

describe('helperModule.get_parameter_by_name', () => {

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);

        load_browser_module('public/app/utils/helper.module.js', 'helperModule');
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('returns the named parameter from a passed URL', () => {
        const result = globalThis.helperModule.get_parameter_by_name(
            'exhibit_id', 'https://example.test/foo?exhibit_id=abc-123',
        );
        expect(result).toBe('abc-123');
    });

    it('returns null when the parameter is absent', () => {
        const result = globalThis.helperModule.get_parameter_by_name(
            'missing', 'https://example.test/foo?other=x',
        );
        expect(result).toBe(null);
    });

    it('returns the empty string when the parameter is present but empty', () => {
        const result = globalThis.helperModule.get_parameter_by_name(
            'empty', 'https://example.test/foo?empty=',
        );
        expect(result).toBe('');
    });

    it('returns null when the parameter name is missing or non-string', () => {
        expect(globalThis.helperModule.get_parameter_by_name('', 'https://example.test/?x=1')).toBe(null);
        expect(globalThis.helperModule.get_parameter_by_name(null, 'https://example.test/?x=1')).toBe(null);
        expect(globalThis.helperModule.get_parameter_by_name(123, 'https://example.test/?x=1')).toBe(null);
    });

    it('rejects values that DOMPurify would alter (treated as malicious)', () => {
        const result = globalThis.helperModule.get_parameter_by_name(
            'name', 'https://example.test/?name=' + encodeURIComponent('<script>alert(1)</script>'),
        );
        expect(result).toBe(null);
    });
});

// ───────────────────────────── clear_status_message ─────────────────────────────
// Phase 1 DRY (cluster C5): shared replacement for the per-form
// `clear_message_smoothly` copies (FADE_DURATION = 300).

describe('helperModule.clear_status_message', () => {

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);

        load_browser_module('public/app/utils/helper.module.js', 'helperModule');
    });

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="message"><div class="alert alert-success">Saved</div></div>';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('fades over 300 ms by default, then empties and resets opacity/transition', () => {
        const el = document.getElementById('message');
        globalThis.helperModule.clear_status_message(el);

        expect(el.style.transition).toBe('opacity 300ms ease-out');
        expect(el.style.opacity).toBe('0');
        expect(el.textContent).toBe('Saved');

        vi.advanceTimersByTime(299);
        expect(el.textContent).toBe('Saved');

        vi.advanceTimersByTime(1);
        expect(el.textContent).toBe('');
        expect(el.style.opacity).toBe('1');
        expect(el.style.transition).toBe('');
    });

    it('accepts a selector string', () => {
        globalThis.helperModule.clear_status_message('#message');
        const el = document.getElementById('message');
        expect(el.style.opacity).toBe('0');
        vi.advanceTimersByTime(300);
        expect(el.textContent).toBe('');
    });

    it('honours { fade_ms }', () => {
        const el = document.getElementById('message');
        globalThis.helperModule.clear_status_message(el, { fade_ms: 1000 });
        expect(el.style.transition).toBe('opacity 1000ms ease-out');
        vi.advanceTimersByTime(300);
        expect(el.textContent).toBe('Saved');
        vi.advanceTimersByTime(700);
        expect(el.textContent).toBe('');
    });

    it('fade_ms: 0 clears synchronously', () => {
        const el = document.getElementById('message');
        globalThis.helperModule.clear_status_message(el, { fade_ms: 0 });
        expect(el.textContent).toBe('');
        expect(el.style.opacity).toBe('1');
        expect(el.style.transition).toBe('');
    });

    it('falls back to 300 ms for an invalid fade_ms', () => {
        const el = document.getElementById('message');
        globalThis.helperModule.clear_status_message(el, { fade_ms: 'fast' });
        expect(el.style.transition).toBe('opacity 300ms ease-out');
    });

    it('is a no-op for a missing element / selector', () => {
        expect(() => globalThis.helperModule.clear_status_message(null)).not.toThrow();
        expect(() => globalThis.helperModule.clear_status_message('#nope')).not.toThrow();
    });
});
