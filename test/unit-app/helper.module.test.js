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
