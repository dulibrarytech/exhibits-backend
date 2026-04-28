// @vitest-environment jsdom
//
// Pattern reference for unit-testing public/app/*.module.js files.
// These modules are IIFEs assigned to a const at file scope (matching how
// they're loaded as <script> tags in the dashboard), so the test reads the
// source, rewrites the assignment to attach to globalThis, and evals it
// inside the jsdom window. DOMPurify is referenced as a bare global by
// these modules and must be initialized on window first.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(__dirname, '../../public/app/utils/helper.module.js');

describe('helperModule.get_parameter_by_name', () => {

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);

        const src = readFileSync(MODULE_PATH, 'utf8');
        // Hoist the IIFE result onto globalThis so the tests can reach it
        // after eval — `const helperModule = ...` would be scoped to the
        // eval block and discarded.
        const patched = src.replace(/^const\s+helperModule\s*=/m, 'globalThis.helperModule =');
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
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
