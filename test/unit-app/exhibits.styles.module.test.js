// @vitest-environment jsdom
//
// Unit tests for public/app/exhibits/exhibits.styles.module.js.
//
// Follows the browser-module test pattern established in
// test/unit-app/helper.module.test.js: read the source, rewrite the
// `const exhibitsStylesModule = ...` IIFE assignment to attach the
// result to globalThis, then indirect-eval inside jsdom.
//
// This module has no external module dependencies (no httpModule,
// endpointsModule, helperModule, domModule) — it's all DOM I/O against
// the #exhibit-styles-card form, which makes it the cleanest first
// target among the exhibits modules.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/exhibits/exhibits.styles.module.js',
);

const STYLE_SECTIONS = [
    'template',
    'introduction',
    'navigation',
    'heading1',
    'item1',
    'heading2',
    'heading3',
    'item2',
    'item3',
];

const REQUIRED_SECTIONS = [
    'template',
    'introduction',
    'navigation',
    'heading1',
    'item1',
];

function build_section_fragment(key) {
    return `
        <div id="collapse-${key}">
            <div class="field-row">
                <div class="input-group">
                    <input type="text" id="${key}-background-color" />
                    <input type="color" id="${key}-background-color-picker" />
                </div>
            </div>
            <div class="field-row">
                <div class="input-group">
                    <input type="text" id="${key}-font-color" />
                    <input type="color" id="${key}-font-color-picker" />
                </div>
            </div>
            <div class="field-row">
                <input type="number" id="${key}-font-size" />
            </div>
            <div class="field-row">
                <select id="${key}-font">
                    <option value=""></option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                </select>
            </div>
            <span id="swatch-${key}-bg"></span>
            <span id="swatch-${key}-font"></span>
        </div>
    `;
}

function build_styles_form() {
    const sections_html = STYLE_SECTIONS.map(build_section_fragment).join('');
    document.body.innerHTML = `<div id="exhibit-styles-card">${sections_html}</div>`;
}

function set_value(selector, value) {
    document.querySelector(selector).value = value;
}

function fill_required_sections() {
    for (const key of REQUIRED_SECTIONS) {
        set_value(`#${key}-background-color`, '#ffffff');
        set_value(`#${key}-font-color`, '#000000');
        set_value(`#${key}-font-size`, '16');
        set_value(`#${key}-font`, 'Arial');
    }
}

describe('exhibitsStylesModule', () => {

    beforeAll(() => {
        const src = readFileSync(MODULE_PATH, 'utf8');
        // The module is a top-level `const exhibitsStylesModule = (function () {...}());`
        // — `const` would be scoped to the eval block and discarded, so rewrite
        // to attach the IIFE result to globalThis instead.
        const patched = src.replace(
            /^const\s+exhibitsStylesModule\s*=/m,
            'globalThis.exhibitsStylesModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        // scrollIntoView is not implemented in jsdom — stub on the prototype
        // so any element call is a no-op rather than a TypeError.
        Element.prototype.scrollIntoView = function () {};
        build_styles_form();
    });

    describe('get_styles', () => {

        it('returns the nested { exhibit: {...} } shape with one entry per section', () => {
            const result = globalThis.exhibitsStylesModule.get_styles();
            expect(result).not.toBeNull();
            expect(Object.keys(result)).toEqual(['exhibit']);
            expect(Object.keys(result.exhibit).sort()).toEqual([...STYLE_SECTIONS].sort());
        });

        it('appends "px" to fontSize values when present', () => {
            set_value('#introduction-font-size', '18');
            const result = globalThis.exhibitsStylesModule.get_styles();
            expect(result.exhibit.introduction.fontSize).toBe('18px');
        });

        it('returns empty string for fontSize when the input is blank', () => {
            const result = globalThis.exhibitsStylesModule.get_styles();
            expect(result.exhibit.introduction.fontSize).toBe('');
        });

        it('passes through trimmed values for non-fontSize properties', () => {
            set_value('#heading1-background-color', '  #abcdef  ');
            set_value('#heading1-font-color', '#123456');
            set_value('#heading1-font', 'Georgia');
            const result = globalThis.exhibitsStylesModule.get_styles();
            expect(result.exhibit.heading1.backgroundColor).toBe('#abcdef');
            expect(result.exhibit.heading1.color).toBe('#123456');
            expect(result.exhibit.heading1.fontFamily).toBe('Georgia');
        });

        it('returns empty strings for sections whose fields are blank', () => {
            const result = globalThis.exhibitsStylesModule.get_styles();
            expect(result.exhibit.heading2).toEqual({
                backgroundColor: '',
                color: '',
                fontSize: '',
                fontFamily: '',
            });
        });
    });

    describe('set_styles', () => {

        it('populates inputs, pickers, and swatches for a section', () => {
            globalThis.exhibitsStylesModule.set_styles({
                exhibit: {
                    introduction: {
                        backgroundColor: '#ff0000',
                        color: '#00ff00',
                        fontSize: '20px',
                        fontFamily: 'Arial',
                    },
                },
            });

            expect(document.querySelector('#introduction-background-color').value).toBe('#ff0000');
            expect(document.querySelector('#introduction-background-color-picker').value).toBe('#ff0000');
            expect(document.querySelector('#introduction-font-color').value).toBe('#00ff00');
            expect(document.querySelector('#introduction-font-color-picker').value).toBe('#00ff00');
            // fontSize should be stripped of the px suffix for the number input
            expect(document.querySelector('#introduction-font-size').value).toBe('20');
            expect(document.querySelector('#introduction-font').value).toBe('Arial');

            // Header swatches reflect the chosen colors
            expect(document.querySelector('#swatch-introduction-bg').style.backgroundColor)
                .toBe('rgb(255, 0, 0)');
            expect(document.querySelector('#swatch-introduction-font').style.backgroundColor)
                .toBe('rgb(0, 255, 0)');
        });

        it('rejects a JSON string payload (current behavior — see note)', () => {
            // The module declares it handles "both stringified and object styles"
            // (see the JSDoc on obj.set_styles), but the early-return guard
            //   `if (!styles || typeof styles !== 'object') return;`
            // fires before the `typeof styles === 'string'` branch can parse
            // the input, so string payloads are silently dropped today. This
            // test pins the actual behavior; flag this as a source-side bug
            // if exhibit records are ever stored as stringified JSON.
            set_value('#item1-background-color', '#preserved');
            const payload = JSON.stringify({
                exhibit: { item1: { backgroundColor: '#abcdef' } },
            });
            globalThis.exhibitsStylesModule.set_styles(payload);
            expect(document.querySelector('#item1-background-color').value).toBe('#preserved');
        });

        it('is a no-op when styles is null or undefined', () => {
            set_value('#introduction-background-color', '#preserved');
            globalThis.exhibitsStylesModule.set_styles(null);
            globalThis.exhibitsStylesModule.set_styles(undefined);
            expect(document.querySelector('#introduction-background-color').value).toBe('#preserved');
        });

        it('is a no-op when the exhibit key is missing', () => {
            set_value('#introduction-background-color', '#preserved');
            globalThis.exhibitsStylesModule.set_styles({ something_else: {} });
            expect(document.querySelector('#introduction-background-color').value).toBe('#preserved');
        });

        it('skips sections whose data is missing or non-object', () => {
            globalThis.exhibitsStylesModule.set_styles({
                exhibit: {
                    introduction: { backgroundColor: '#111111' },
                    navigation: null,
                    heading1: 'not-an-object',
                },
            });
            expect(document.querySelector('#introduction-background-color').value).toBe('#111111');
            expect(document.querySelector('#navigation-background-color').value).toBe('');
            expect(document.querySelector('#heading1-background-color').value).toBe('');
        });

        it('only populates fields whose values are present in the payload', () => {
            globalThis.exhibitsStylesModule.set_styles({
                exhibit: {
                    item1: { fontSize: '14px' },
                },
            });
            expect(document.querySelector('#item1-font-size').value).toBe('14');
            // Unspecified fields stay blank
            expect(document.querySelector('#item1-background-color').value).toBe('');
            expect(document.querySelector('#item1-font-color').value).toBe('');
            expect(document.querySelector('#item1-font').value).toBe('');
        });
    });

    describe('validate_required', () => {

        it('returns { valid: true } when every required field is filled', () => {
            fill_required_sections();
            const result = globalThis.exhibitsStylesModule.validate_required();
            expect(result).toEqual({ valid: true, errors: [] });
            expect(document.querySelectorAll('.is-invalid')).toHaveLength(0);
        });

        it('flags blank fields with is-invalid and returns labeled error messages', () => {
            fill_required_sections();
            set_value('#introduction-background-color', '');
            set_value('#introduction-font-color', '');

            const result = globalThis.exhibitsStylesModule.validate_required();

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Exhibit Introduction: Background Color is required');
            expect(result.errors).toContain('Exhibit Introduction: Font Color is required');
            expect(document.querySelector('#introduction-background-color').classList.contains('is-invalid'))
                .toBe(true);
            expect(document.querySelector('#introduction-font-color').classList.contains('is-invalid'))
                .toBe(true);
        });

        it('injects an inline feedback div next to each invalid field', () => {
            fill_required_sections();
            set_value('#introduction-background-color', '');

            globalThis.exhibitsStylesModule.validate_required();

            const feedbacks = document.querySelectorAll('.style-validation-feedback');
            expect(feedbacks.length).toBeGreaterThanOrEqual(1);
            const messages = Array.from(feedbacks).map(el => el.textContent);
            expect(messages).toContain('Background Color is required');
        });

        it('expands the accordion panel containing the first error', () => {
            fill_required_sections();
            set_value('#heading1-background-color', '');

            globalThis.exhibitsStylesModule.validate_required();

            // No jQuery available in the test env, so the fallback path runs:
            // collapse_el.classList.add('show')
            expect(document.querySelector('#collapse-heading1').classList.contains('show')).toBe(true);
        });

        it('ignores blank fields in optional sections', () => {
            fill_required_sections();
            // heading2 / item2 / heading3 / item3 are optional
            const result = globalThis.exhibitsStylesModule.validate_required();
            expect(result.valid).toBe(true);
            expect(document.querySelector('#heading2-background-color').classList.contains('is-invalid'))
                .toBe(false);
        });

        it('clears prior validation state when called twice', () => {
            fill_required_sections();
            set_value('#introduction-background-color', '');
            globalThis.exhibitsStylesModule.validate_required();
            expect(document.querySelectorAll('.style-validation-feedback').length).toBeGreaterThan(0);

            // Re-fill and re-validate; prior is-invalid + feedback should be cleared.
            set_value('#introduction-background-color', '#ffffff');
            const result = globalThis.exhibitsStylesModule.validate_required();
            expect(result.valid).toBe(true);
            expect(document.querySelectorAll('.is-invalid')).toHaveLength(0);
            expect(document.querySelectorAll('.style-validation-feedback')).toHaveLength(0);
        });

        it('skips fields whose DOM elements are missing without throwing', () => {
            fill_required_sections();
            document.querySelector('#introduction-background-color').remove();
            // Should not throw — the module guards with `if (!field_el) continue;`
            expect(() => globalThis.exhibitsStylesModule.validate_required()).not.toThrow();
        });
    });

    describe('clear_validation', () => {

        it('removes is-invalid classes and injected feedback divs', () => {
            fill_required_sections();
            set_value('#introduction-background-color', '');
            globalThis.exhibitsStylesModule.validate_required();
            expect(document.querySelectorAll('.is-invalid').length).toBeGreaterThan(0);

            globalThis.exhibitsStylesModule.clear_validation();

            expect(document.querySelectorAll('#exhibit-styles-card .is-invalid')).toHaveLength(0);
            expect(document.querySelectorAll('#exhibit-styles-card .style-validation-feedback'))
                .toHaveLength(0);
        });

        it('is a no-op when nothing is invalid', () => {
            expect(() => globalThis.exhibitsStylesModule.clear_validation()).not.toThrow();
        });
    });

    describe('init', () => {

        it('returns true on success', () => {
            expect(globalThis.exhibitsStylesModule.init()).toBe(true);
        });

        it('syncs picker → text input + swatch on color picker change', () => {
            globalThis.exhibitsStylesModule.init();

            const picker = document.querySelector('#introduction-background-color-picker');
            const input = document.querySelector('#introduction-background-color');
            const swatch = document.querySelector('#swatch-introduction-bg');

            picker.value = '#abcdef';
            picker.dispatchEvent(new Event('input', { bubbles: true }));

            expect(input.value).toBe('#abcdef');
            expect(swatch.style.backgroundColor).toBe('rgb(171, 205, 239)');
        });

        it('syncs text input → picker + swatch when value is a valid hex', () => {
            globalThis.exhibitsStylesModule.init();

            const picker = document.querySelector('#introduction-font-color-picker');
            const input = document.querySelector('#introduction-font-color');
            const swatch = document.querySelector('#swatch-introduction-font');

            input.value = '#ff8800';
            input.dispatchEvent(new Event('input', { bubbles: true }));

            expect(picker.value).toBe('#ff8800');
            expect(swatch.style.backgroundColor).toBe('rgb(255, 136, 0)');
        });

        it('updates only the swatch (not the picker) when input is invalid hex', () => {
            globalThis.exhibitsStylesModule.init();

            const picker = document.querySelector('#introduction-font-color-picker');
            const input = document.querySelector('#introduction-font-color');
            const swatch = document.querySelector('#swatch-introduction-font');
            // Default color picker value is #000000 in jsdom
            const initial_picker_value = picker.value;

            input.value = 'not-a-hex';
            input.dispatchEvent(new Event('input', { bubbles: true }));

            // Picker is unchanged because regex didn't match
            expect(picker.value).toBe(initial_picker_value);
            // Swatch resets to no background when value isn't a valid hex
            expect(swatch.style.backgroundColor).toBe('');
        });
    });
});
