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

describe('helperModule.render_record_meta', () => {

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);
        load_browser_module('public/app/utils/helper.module.js', 'helperModule');
    });

    beforeEach(() => {
        document.body.innerHTML = '<p id="created">stale</p>';
    });

    const created_html = () => document.getElementById('created').innerHTML;
    const created_text = () => document.getElementById('created').textContent;

    it('renders both halves joined by " | "', () => {
        globalThis.helperModule.render_record_meta('#created', {
            created_by: 'alice',
            created: '2026-01-02T03:04:05Z',
            updated_by: 'bob',
            updated: '2026-02-03T04:05:06Z',
        });

        expect(created_text()).toMatch(/^Created by alice on .+ \| Last updated by bob on .+$/);
        expect(document.querySelectorAll('#created em').length).toBe(2);
    });

    it('renders only the created half when there is no update actor', () => {
        globalThis.helperModule.render_record_meta('#created', {
            created_by: 'alice',
            created: '2026-01-02T03:04:05Z',
        });

        expect(created_text()).toMatch(/^Created by alice on /);
        expect(created_text()).not.toContain('|');
        expect(document.querySelectorAll('#created em').length).toBe(1);
    });

    it('renders only the updated half when there is no create actor, with no leading separator', () => {
        globalThis.helperModule.render_record_meta('#created', {
            updated_by: 'bob',
            updated: '2026-02-03T04:05:06Z',
        });

        expect(created_text()).toMatch(/^Last updated by bob on /);
        expect(created_text().startsWith(' | ')).toBe(false);
    });

    it('escapes the actor names instead of interpolating them into markup', () => {
        globalThis.helperModule.render_record_meta('#created', {
            created_by: '<img src=x onerror=alert(1)>',
            created: '2026-01-02T03:04:05Z',
        });

        expect(document.querySelectorAll('#created img').length).toBe(0);
        expect(created_html()).toContain('&lt;img');
        expect(created_text()).toContain('<img src=x onerror=alert(1)>');
    });

    it('skips a half whose timestamp is missing or unparsable (no "Invalid Date")', () => {
        globalThis.helperModule.render_record_meta('#created', {
            created_by: 'alice',
            created: 'not-a-date',
            updated_by: 'bob',
            updated: null,
        });

        expect(created_text()).toBe('');
    });

    it('clears the container even when the record has nothing to render', () => {
        globalThis.helperModule.render_record_meta('#created', {});
        expect(created_text()).toBe('');
    });

    it('accepts an element as well as a selector, and returns false when absent', () => {
        const el = document.getElementById('created');
        expect(globalThis.helperModule.render_record_meta(el, { created_by: 'a', created: '2026-01-01' })).toBe(true);
        expect(globalThis.helperModule.render_record_meta('#nope', {})).toBe(false);
        expect(globalThis.helperModule.render_record_meta(null, {})).toBe(false);
    });
});

describe('helperModule.load_style_presets', () => {

    let api_calls;
    let api_response;

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);
        load_browser_module('public/app/utils/helper.module.js', 'helperModule');
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        document.body.innerHTML = `
            <div id="item-styles-card" style="display: none;">
                <div id="item-style-options"></div>
            </div>`;

        window.history.replaceState({}, '', '/items?exhibit_id=abc-123');

        api_calls = [];
        api_response = {
            status: 200,
            data: {
                data: {
                    styles: JSON.stringify({
                        exhibit: {
                            navigation: { backgroundColor: '#111111' },
                            item1: { backgroundColor: '#222222', color: '#333333' },
                            item2: { backgroundColor: '', color: '' },
                            item3: { backgroundColor: '#444444' },
                            heading1: { backgroundColor: '#555555' },
                        },
                    }),
                },
            },
        };

        globalThis.endpointsModule = {
            get_exhibits_endpoints: () => ({
                exhibits: {
                    exhibit_records: {
                        endpoints: { get: { endpoint: '/api/v1/exhibits/:exhibit_id' } },
                    },
                },
            }),
            build: (template, params) => template.replace(':exhibit_id', encodeURIComponent(params.exhibit_id)),
        };

        globalThis.httpModule = {
            api: (options) => {
                api_calls.push(options);
                return Promise.resolve(api_response);
            },
        };
    });

    const preset_values = () =>
        Array.from(document.querySelectorAll('#item-style-options input[name="styles"]')).map((r) => r.value);

    const preset_labels = () =>
        Array.from(document.querySelectorAll('#item-style-options .item-style-name')).map((s) => s.textContent);

    it('renders the exhibit\'s item presets, sorted, skipping empty ones', async () => {
        const map = await globalThis.helperModule.load_style_presets();

        expect(Object.keys(map).sort()).toEqual(['item1', 'item3']);
        expect(preset_values()).toEqual(['item1', 'item3']);
        expect(preset_labels()).toEqual(['Item Style 1', 'Item Style 3']);
    });

    it('reveals the styles card and pre-checks the first preset', async () => {
        await globalThis.helperModule.load_style_presets();

        expect(document.getElementById('item-styles-card').style.display).toBe('');
        expect(document.querySelector('#item-style-options input[name="styles"]:checked').value).toBe('item1');
    });

    it('honours the heading prefix and derives its labels', async () => {
        const map = await globalThis.helperModule.load_style_presets({ prefix: 'heading' });

        expect(Object.keys(map)).toEqual(['heading1']);
        expect(preset_labels()).toEqual(['Heading Style 1']);
    });

    it('accepts explicit label overrides', async () => {
        await globalThis.helperModule.load_style_presets({ labels: { item1: 'Custom One' } });
        expect(preset_labels()).toEqual(['Custom One', 'Item Style 3']);
    });

    it('requests the exhibit record without logging the user out on a missing token', async () => {
        await globalThis.helperModule.load_style_presets();

        expect(api_calls).toHaveLength(1);
        expect(api_calls[0].method).toBe('GET');
        expect(api_calls[0].url).toBe('/api/v1/exhibits/abc-123');
        expect(api_calls[0].logout_on_missing_token).toBe(false);
    });

    it('accepts an already-parsed styles object', async () => {
        api_response.data.data.styles = { exhibit: { item1: { color: '#abcdef' } } };
        const map = await globalThis.helperModule.load_style_presets();
        expect(Object.keys(map)).toEqual(['item1']);
    });

    it('resolves null and leaves the card hidden when there is no exhibit_id', async () => {
        window.history.replaceState({}, '', '/items');
        expect(await globalThis.helperModule.load_style_presets()).toBe(null);
        expect(document.getElementById('item-styles-card').style.display).toBe('none');
    });

    it('resolves null on a missing token (api resolves null), a non-200, and unparsable styles', async () => {
        api_response = null;
        expect(await globalThis.helperModule.load_style_presets()).toBe(null);

        api_response = { status: 500, data: {} };
        expect(await globalThis.helperModule.load_style_presets()).toBe(null);

        api_response = { status: 200, data: { data: { styles: '{not json' } } };
        expect(await globalThis.helperModule.load_style_presets()).toBe(null);
    });

    it('resolves null when the exhibit defines no presets for the prefix', async () => {
        api_response.data.data.styles = JSON.stringify({ exhibit: { navigation: { color: '#fff' } } });
        expect(await globalThis.helperModule.load_style_presets()).toBe(null);
        expect(preset_values()).toEqual([]);
    });

    it('never rejects when the request throws', async () => {
        globalThis.httpModule.api = () => Promise.reject(new Error('boom'));
        await expect(globalThis.helperModule.load_style_presets()).resolves.toBe(null);
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
        load_browser_module('public/app/utils/helper.module.js', 'helperModule');
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
        load_browser_module('public/app/utils/helper.module.js', 'helperModule');
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

describe('helperModule.show_form', () => {

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);
        load_browser_module('public/app/utils/helper.module.js', 'helperModule');
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        /* Run the frame callback synchronously so the assertions can follow the call. */
        globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
    });

    it('reveals every .card and reports true', () => {
        document.body.innerHTML = `
            <div class="card hidden" style="visibility: hidden; display: none; opacity: 0;"></div>
            <div class="card" style="visibility: hidden;"></div>`;

        expect(globalThis.helperModule.show_form()).toBe(true);

        const cards = document.querySelectorAll('.card');
        cards.forEach((card) => {
            expect(card.classList.contains('hidden')).toBe(false);
            expect(card.style.visibility).toBe('visible');
            expect(card.style.display).not.toBe('none');
            expect(card.style.opacity).not.toBe('0');
        });
    });

    it('reports false when the page has no cards', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(globalThis.helperModule.show_form()).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});
