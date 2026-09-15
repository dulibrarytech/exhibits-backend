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
            fontFamily: 'IBM Plex Mono', fontSize: '19px', color: '#303030',
        });
    });

    it('fills a preset gap from the template preset (the public site\'s base layer)', () => {
        globalThis.helperModule.bind_item_style_theme(PRESETS, TEMPLATE, ['item-text-input']);
        document.getElementById('item-style-item2').checked = true;
        globalThis.helperModule.apply_item_style_theme();

        expect(globalThis.rteModule.set_theme).toHaveBeenLastCalledWith('item-text-input', {
            fontFamily: 'Courier New', fontSize: '15px', color: '#4b0082',
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

describe('helperModule.bind_embed_description (Embed item ↔ Pop-up Window Description)', () => {

    const SET_ENABLED_CALLS = [];

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);
        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(/^const\s+helperModule\s*=/m, 'globalThis.helperModule =');
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        SET_ENABLED_CALLS.length = 0;
        // rteModule is a separate script; stand in for what set_enabled does to the DOM
        globalThis.rteModule = {
            set_enabled: vi.fn((id, enabled) => {
                SET_ENABLED_CALLS.push([id, enabled]);
                const editor = document.querySelector('#' + id + ' .ql-editor');
                editor.setAttribute('contenteditable', enabled ? 'true' : 'false');
                return true;
            }),
        };
        // the media card as the partials + Quill leave it: text row, description row, embed group after
        document.body.innerHTML = `
            <div id="card">
                <div id="text-row"><div id="item-text-input" data-rte="full"><div class="ql-editor" contenteditable="true"></div></div></div>
                <div class="row" id="is-media-only-description">
                    <div class="col-12"><div class="row form-group"><div class="col-12">
                        <div class="form-text text-muted"><span id="item-description-input-label">Pop-up Window Description</span></div>
                        <div class="ql-toolbar ql-snow"><button class="ql-bold"></button></div>
                        <div id="item-description-input" class="rte-container ql-container" data-rte="full">
                            <div class="ql-editor" contenteditable="true" role="textbox" aria-labelledby="item-description-input-label"><p>Kept text</p></div>
                        </div>
                    </div></div></div>
                </div>
                <div id="embed-item-group" class="form-group">
                    <small class="form-text text-muted"><em>Embedded items do not open the item viewer (pop-up window)</em></small>
                    <label for="embed-item">Embed item <input type="checkbox" id="embed-item" name="embed_item"></label>
                </div>
            </div>`;
    });

    afterEach(() => {
        delete globalThis.rteModule;
        const region = document.getElementById('embed-item-status');
        if (region) region.remove();
    });

    const editor = () => document.querySelector('#item-description-input .ql-editor');
    const note = () => document.getElementById('item-description-input-embed-note');
    /*
     * jsdom cannot dispatch a trusted event (isTrusted is unforgeable and
     * always false here), so these tests drive the state machine with
     * synthetic changes — the edit-form path — and leave "a real click
     * announces" to the e2e spec, where the click is real.
     */
    const change = () => {
        document.getElementById('embed-item').dispatchEvent(new window.Event('change', { bubbles: true }));
    };

    it('moves the checkbox above the description row and links them with aria-controls', () => {
        expect(globalThis.helperModule.bind_embed_description('embed-item', 'item-description-input')).toBe(true);

        const ids = [...document.getElementById('card').children].map((el) => el.id);
        expect(ids).toEqual(['text-row', 'embed-item-group', 'is-media-only-description']);
        expect(document.getElementById('embed-item').getAttribute('aria-controls')).toBe('is-media-only-description');
    });

    it('leaves an unchecked box with an enabled editor and a hidden note', () => {
        globalThis.helperModule.bind_embed_description('embed-item', 'item-description-input');

        expect(SET_ENABLED_CALLS.at(-1)).toEqual(['item-description-input', true]);
        expect(editor().getAttribute('contenteditable')).toBe('true');
        expect(note().hidden).toBe(true);
        expect(editor().getAttribute('aria-describedby')).toBe(null);
        // the note sits under the label, before the toolbar
        expect(note().nextElementSibling.classList.contains('ql-toolbar')).toBe(true);
    });

    it('disables the editor and shows the note when the box becomes checked, and restores on uncheck', () => {
        globalThis.helperModule.bind_embed_description('embed-item', 'item-description-input');
        document.getElementById('embed-item').checked = true;
        change();

        expect(SET_ENABLED_CALLS.at(-1)).toEqual(['item-description-input', false]);
        expect(editor().getAttribute('contenteditable')).toBe('false');
        expect(note().hidden).toBe(false);
        expect(note().textContent).toMatch(/not used while embed item is checked/i);
        expect(editor().getAttribute('aria-describedby')).toBe('item-description-input-embed-note');

        // the value is untouched — search results and the index still read it
        expect(editor().innerHTML).toBe('<p>Kept text</p>');

        document.getElementById('embed-item').checked = false;
        change();
        expect(SET_ENABLED_CALLS.at(-1)).toEqual(['item-description-input', true]);
        expect(editor().getAttribute('contenteditable')).toBe('true');
        expect(note().hidden).toBe(true);
        expect(editor().getAttribute('aria-describedby')).toBe(null);
    });

    it('does not announce a record-driven (synthetic) change — the edit form restoring is_embedded is not news', () => {
        globalThis.helperModule.bind_embed_description('embed-item', 'item-description-input');
        document.getElementById('embed-item').checked = true;
        change();

        expect(editor().getAttribute('contenteditable')).toBe('false');
        expect(note().hidden).toBe(false);
        expect(document.getElementById('embed-item-status')).toBe(null);
    });

    it('binds once even when called twice (re-init on the same page)', () => {
        globalThis.helperModule.bind_embed_description('embed-item', 'item-description-input');
        globalThis.helperModule.bind_embed_description('embed-item', 'item-description-input');
        SET_ENABLED_CALLS.length = 0;
        document.getElementById('embed-item').checked = true;
        change();

        expect(SET_ENABLED_CALLS.length).toBe(1);
        expect(document.querySelectorAll('#item-description-input-embed-note').length).toBe(1);
    });

    it('keeps any existing aria-describedby tokens on the editor', () => {
        editor().setAttribute('aria-describedby', 'some-hint');
        globalThis.helperModule.bind_embed_description('embed-item', 'item-description-input');
        document.getElementById('embed-item').checked = true;
        change();
        expect(editor().getAttribute('aria-describedby')).toBe('some-hint item-description-input-embed-note');
        document.getElementById('embed-item').checked = false;
        change();
        expect(editor().getAttribute('aria-describedby')).toBe('some-hint');
    });

    it('returns false when the page has no checkbox or no editor', () => {
        document.getElementById('embed-item-group').remove();
        expect(globalThis.helperModule.bind_embed_description('embed-item', 'item-description-input')).toBe(false);
        expect(SET_ENABLED_CALLS.length).toBe(0);
    });

    it('mark_embedded_description shows the details-page note only for embedded records', () => {
        document.body.innerHTML = '<div class="form-text"><span id="l">Pop-up Window Description</span></div><div id="item-description-input" class="rte-readonly"><p>Kept</p></div>';
        globalThis.helperModule.mark_embedded_description('item-description-input', true);
        const n = document.getElementById('item-description-input-embed-note');
        expect(n.hidden).toBe(false);
        expect(n.textContent).toMatch(/embedded/i);
        expect(n.nextElementSibling.id).toBe('item-description-input');

        globalThis.helperModule.mark_embedded_description('item-description-input', false);
        expect(document.getElementById('item-description-input-embed-note').hidden).toBe(true);
    });
});
