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

describe('helperModule item style preset mirroring (bind/apply_item_style_theme)', () => {

    const PRESETS = {
        item1: { backgroundColor: '#c2ced5', color: '#303030', fontFamily: 'IBM Plex Mono', fontSize: '19px' },
        item2: { backgroundColor: '#ffffff', color: '#4b0082', fontFamily: 'Courier New', fontSize: '' },
    };
    const TEMPLATE = { backgroundColor: '#fdfdfd', color: '#111111', fontFamily: 'Georgia', fontSize: '15px' };

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);
        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(/^const\s+helperModule\s*=/m, 'globalThis.helperModule =');
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        // The real rteModule is a separate script; the helper only forwards to it.
        globalThis.rteModule = { set_theme: vi.fn() };
        document.body.innerHTML = `
            <div id="item-style-options"></div>
            <div id="item-text-input"></div>`;
        globalThis.helperModule.build_item_style_swatch_options(
            '#item-style-options', ['item1', 'item2'], PRESETS, { item1: 'Item Style 1', item2: 'Item Style 2' },
        );
    });

    afterEach(() => {
        delete globalThis.rteModule;
    });

    it('applies the checked preset to every bound editor as soon as it is bound', () => {
        globalThis.helperModule.bind_item_style_theme(PRESETS, TEMPLATE, ['item-text-input']);

        // the builder default-checks the first preset
        expect(globalThis.rteModule.set_theme).toHaveBeenLastCalledWith('item-text-input', {
            fontFamily: 'IBM Plex Mono', fontSize: '19px', color: '#303030', backgroundColor: '#c2ced5',
        });
    });

    it('fills a preset gap from the template preset (the public site\'s base layer)', () => {
        globalThis.helperModule.bind_item_style_theme(PRESETS, TEMPLATE, ['item-text-input']);
        document.getElementById('item-style-item2').checked = true;
        globalThis.helperModule.apply_item_style_theme();

        expect(globalThis.rteModule.set_theme).toHaveBeenLastCalledWith('item-text-input', {
            fontFamily: 'Courier New', fontSize: '15px', color: '#4b0082', backgroundColor: '#ffffff',
        });
    });

    it('re-applies on a change event from the preset radios', () => {
        globalThis.helperModule.bind_item_style_theme(PRESETS, TEMPLATE, ['item-text-input']);
        globalThis.rteModule.set_theme.mockClear();

        const radio = document.getElementById('item-style-item2');
        radio.checked = true;
        radio.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(globalThis.rteModule.set_theme).toHaveBeenCalledTimes(1);
        expect(globalThis.rteModule.set_theme.mock.calls[0][1].fontFamily).toBe('Courier New');
    });

    it('binds the change listener once even when bound twice (modal re-renders)', () => {
        globalThis.helperModule.bind_item_style_theme(PRESETS, TEMPLATE, ['item-text-input']);
        globalThis.helperModule.bind_item_style_theme(PRESETS, TEMPLATE, ['item-text-input']);
        globalThis.rteModule.set_theme.mockClear();

        const radio = document.getElementById('item-style-item2');
        radio.checked = true;
        radio.dispatchEvent(new window.Event('change', { bubbles: true }));

        expect(globalThis.rteModule.set_theme).toHaveBeenCalledTimes(1);
    });

    it('check_item_style_option mirrors the preset it checks (no change event fires programmatically)', () => {
        globalThis.helperModule.bind_item_style_theme(PRESETS, TEMPLATE, ['item-text-input']);
        globalThis.rteModule.set_theme.mockClear();

        globalThis.helperModule.check_item_style_option('item2');

        expect(document.getElementById('item-style-item2').checked).toBe(true);
        expect(globalThis.rteModule.set_theme).toHaveBeenLastCalledWith('item-text-input',
            expect.objectContaining({ fontFamily: 'Courier New' }));

        // unknown value → first preset, mirrored too
        globalThis.helperModule.check_item_style_option('nope');
        expect(document.getElementById('item-style-item1').checked).toBe(true);
        expect(globalThis.rteModule.set_theme).toHaveBeenLastCalledWith('item-text-input',
            expect.objectContaining({ fontFamily: 'IBM Plex Mono' }));
    });

    it('does not bind on a page without the preset chooser (details pages)', () => {
        // details pages run the same common init but render no #item-style-options
        document.body.innerHTML = '<div id="item-text-input" data-rte-disabled="true"></div>';

        globalThis.helperModule.bind_item_style_theme(PRESETS, TEMPLATE, ['item-text-input']);
        globalThis.helperModule.apply_item_style_theme();

        expect(globalThis.rteModule.set_theme).not.toHaveBeenCalled();
    });

    it('is a no-op before anything is bound and without rteModule', () => {
        // fresh module state is not reachable, so simulate the pre-bind case by
        // removing rteModule: apply must not throw or touch anything
        delete globalThis.rteModule;
        expect(() => globalThis.helperModule.apply_item_style_theme()).not.toThrow();
        expect(() => globalThis.helperModule.check_item_style_option('item1')).not.toThrow();
    });
});
