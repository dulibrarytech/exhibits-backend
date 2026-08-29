// @vitest-environment jsdom
//
// Unit tests for public/app/heading-items/items.common.heading.form.module.js.
//
// Mirrors items.common.grid.form.module.test.js: covers
// get_common_heading_form_fields, set_item_style, wait_for_styles.
// init() and fetch_and_populate_styles are async/http-bound and belong
// in integration coverage.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/heading-items/items.common.heading.form.module.js',
);

function build_form() {
    document.body.innerHTML = `
        <div id="message"></div>
        <input type="text" id="item-heading-text-input" value="Section heading" />
        <select id="item-heading-type-input">
            <option value="">Select type</option>
            <option value="heading" selected>Heading</option>
            <option value="subheading">Subheading</option>
        </select>
        <select id="margins">
            <option value="small">Small</option>
            <option value="medium" selected>Medium</option>
        </select>
        <select id="text-align">
            <option value="left" selected>Left</option>
            <option value="center">Center</option>
        </select>
        <div id="item-style-options" role="radiogroup">
            <label class="item-style-option"><input type="radio" name="styles" id="item-style-none" value="" checked> None</label>
            <label class="item-style-option"><input type="radio" name="styles" id="item-style-heading1" value="heading1"> Heading Style 1</label>
        </div>
    `;
}

function set_value(selector, value) {
    document.querySelector(selector).value = value;
}

function select_style(value) {
    document.querySelectorAll('input[name="styles"]').forEach((radio) => {
        radio.checked = radio.value === value;
    });
}

describe('itemsCommonHeadingFormModule', () => {

    beforeAll(() => {
        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+itemsCommonHeadingFormModule\s*=/m,
            'globalThis.itemsCommonHeadingFormModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        globalThis.rteModule = {
            get_html: (id) => document.getElementById(id)?.value?.trim() ?? '',
            set_html: (id, html) => {
                const el = document.getElementById(id);
                if (el) el.value = html;
            },
            is_empty: (id) => (document.getElementById(id)?.value?.trim() ?? '') === '',
            init: () => null,
            init_all: () => {},
            set_enabled: () => {},
            set_all_enabled: () => {},
            on_change: () => {},
            is_dirty: () => false,
        };
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        globalThis.domModule = {
            set_alert: vi.fn(),
            set_field_error: vi.fn(),
            clear_field_error: vi.fn(),
        };
        globalThis.helperModule = {
            get_checked_radio_button: (radios) => {
                if (!radios || !radios.length) return null;
                const checked = Array.from(radios).find((b) => b && b.checked);
                if (!checked) return null;
                const v = String(checked.value);
                return v === '' || v === 'undefined' ? null : v;
            },
            check_item_style_option: (value) => {
                const radios = document.getElementsByName('styles');
                if (!radios || !radios.length) return;
                const target = value || '';
                for (const r of radios) { if (r.value === target) { r.checked = true; return; } }
                for (const r of radios) { if (r.value === '') { r.checked = true; return; } }
            },
        };
        build_form();
    });

    describe('get_common_heading_form_fields', () => {

        it('returns the assembled heading object on a fully valid form', () => {
            set_value('#item-heading-text-input', 'Chapter One');
            set_value('#margins', 'small');
            set_value('#text-align', 'center');
            select_style('heading1');

            const result = globalThis.itemsCommonHeadingFormModule
                .get_common_heading_form_fields();

            expect(result).toEqual({
                text: 'Chapter One',
                type: 'heading',
                styles: 'heading1',
                margins: 'small',
                text_alignment: 'center',
            });
        });

        it('returns false and flags the field when heading text is empty', () => {
            set_value('#item-heading-text-input', '');

            const result = globalThis.itemsCommonHeadingFormModule
                .get_common_heading_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'Please enter heading text',
            );
            expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
                '#item-heading-text-input',
                'item-heading-text-input-error',
                'Please enter heading text',
            );
        });

        it('returns false and flags the field when heading type is not selected', () => {
            set_value('#item-heading-type-input', '');

            const result = globalThis.itemsCommonHeadingFormModule
                .get_common_heading_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'Please select heading type',
            );
            expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
                '#item-heading-type-input',
                'item-heading-type-input-error',
                'Please select heading type',
            );
        });

        it('clears prior field errors on both validated fields before validating', () => {
            globalThis.itemsCommonHeadingFormModule.get_common_heading_form_fields();

            expect(globalThis.domModule.clear_field_error).toHaveBeenCalledWith(
                '#item-heading-text-input',
                'item-heading-text-input-error',
            );
            expect(globalThis.domModule.clear_field_error).toHaveBeenCalledWith(
                '#item-heading-type-input',
                'item-heading-type-input-error',
            );
        });

        it('includes is_published only when the hidden input is present', () => {
            const without = globalThis.itemsCommonHeadingFormModule
                .get_common_heading_form_fields();
            expect(without).not.toHaveProperty('is_published');

            const published_input = document.createElement('input');
            published_input.id = 'is-published';
            published_input.value = '1';
            document.body.appendChild(published_input);

            const with_flag = globalThis.itemsCommonHeadingFormModule
                .get_common_heading_form_fields();
            expect(with_flag.is_published).toBe('1');
        });

        it('sets styles to null when no preset is selected (empty option)', () => {
            select_style('');

            const result = globalThis.itemsCommonHeadingFormModule
                .get_common_heading_form_fields();

            expect(result.styles).toBeNull();
        });

        it('returns false and alerts when an unexpected error is thrown', () => {
            globalThis.rteModule.get_html = vi.fn(() => {
                throw new Error('boom');
            });

            const result = globalThis.itemsCommonHeadingFormModule
                .get_common_heading_form_fields();

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'boom',
            );
        });
    });

    describe('set_item_style', () => {

        it('checks the radio that matches the saved key', () => {
            globalThis.itemsCommonHeadingFormModule.set_item_style('heading1');

            expect(document.querySelector('#item-style-heading1').checked).toBe(true);
        });

        it('falls back to "None" when the saved key has no matching option', () => {
            globalThis.itemsCommonHeadingFormModule.set_item_style('heading999');

            expect(document.querySelector('#item-style-none').checked).toBe(true);
        });
    });

    describe('wait_for_styles', () => {

        it('resolves immediately when no fetch is in flight', async () => {
            await expect(
                globalThis.itemsCommonHeadingFormModule.wait_for_styles(),
            ).resolves.toBeUndefined();
        });
    });
});
