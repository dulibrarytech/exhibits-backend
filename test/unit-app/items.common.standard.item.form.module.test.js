// @vitest-environment jsdom
//
// Unit tests for public/app/standard-items/items.common.standard.item.form.module.js.
//
// Covers get_common_standard_item_form_fields — the text-path vs
// media-path field sets (selected from window.location.pathname via
// history.pushState), required-field validation, the inverted
// media_padding / wrap_text checkbox semantics, and the PDF
// open-to-page fallback — plus set_item_style and wait_for_styles.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/standard-items/items.common.standard.item.form.module.js',
);

function navigate(pathname) {
    window.history.pushState({}, '', pathname);
}

function build_form({ media = false } = {}) {
    document.body.innerHTML = `
        <div id="message"></div>
        <input type="text" id="item-text-input" value="Item text" />
        <select id="margins">
            <option value="small">Small</option>
            <option value="medium" selected>Medium</option>
        </select>
        <select id="text-align">
            <option value="left" selected>Left</option>
            <option value="center">Center</option>
        </select>
        <div role="radiogroup">
            <input type="radio" name="layout" value="media_top" checked>
            <input type="radio" name="layout" value="media_only">
        </div>
        <div role="radiogroup">
            <input type="radio" name="media_width" value="50" checked>
            <input type="radio" name="media_width" value="100">
        </div>
        <div id="item-style-options" role="radiogroup">
            <label class="item-style-option"><input type="radio" name="styles" id="item-style-none" value="" checked> None</label>
            <label class="item-style-option"><input type="radio" name="styles" id="item-style-item1" value="item1"> Item Style 1</label>
        </div>
        ${media ? `
        <input type="hidden" id="item-media-uuid" value="media-uuid-1" />
        <input type="hidden" id="item-media-type" value="image" />
        <input type="hidden" id="item-mime-type" value="image/jpeg" />
        <input type="hidden" id="thumbnail-media-uuid" value="thumb-uuid-1" />
        <input type="text" id="item-description-input" value="Pop-up description" />
        <input type="text" id="item-caption-input" value="A caption" />
        <input type="checkbox" id="embed-item" />
        <input type="checkbox" id="media-padding" />
        <input type="checkbox" id="wrap-text" checked />
        <input type="number" id="pdf-open-to-page" value="1" />
        ` : ''}
    `;
}

function set_value(selector, value) {
    document.querySelector(selector).value = value;
}

describe('itemsCommonStandardItemFormModule', () => {

    beforeAll(() => {
        // The IIFE reads endpointsModule.get_app_path() at eval time —
        // stub it before loading the module.
        globalThis.endpointsModule = {
            get_app_path: () => '/exhibits-dashboard',
        };
        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+itemsCommonStandardItemFormModule\s*=/m,
            'globalThis.itemsCommonStandardItemFormModule =',
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
        navigate('/items/standard/text');
        build_form();
    });

    describe('text path', () => {

        it('assembles a text item with default type, mime type, and radio selections', () => {
            const result = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();

            expect(result).toMatchObject({
                text: 'Item text',
                item_type: 'text',
                mime_type: 'text/plain',
                layout: 'media_top',
                media_width: '50',
                margins: 'medium',
                text_alignment: 'left',
            });
            expect(result).not.toHaveProperty('media_uuid');
        });

        it('returns false and flags the field when text is empty on the text path', () => {
            set_value('#item-text-input', '');

            const result = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'Please enter "Text" for this item',
            );
            expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
                '#item-text-input',
                'item-text-input-error',
                'Please enter "Text" for this item',
            );
        });

        it('includes is_published only when the hidden input is present', () => {
            const without = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();
            expect(without).not.toHaveProperty('is_published');

            const published_input = document.createElement('input');
            published_input.id = 'is-published';
            published_input.value = '1';
            document.body.appendChild(published_input);

            const with_flag = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();
            expect(with_flag.is_published).toBe('1');
        });
    });

    describe('media path', () => {

        beforeEach(() => {
            navigate('/items/standard/media');
            build_form({ media: true });
        });

        it('allows empty text on the media path', () => {
            set_value('#item-text-input', '');

            const result = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();

            expect(result).not.toBe(false);
        });

        it('returns false and flags the picker when no media is selected', () => {
            set_value('#item-media-uuid', '');

            const result = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'Please select a media item',
            );
        });

        it('assembles the media item from the picker hidden inputs', () => {
            const result = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();

            expect(result).toMatchObject({
                media_uuid: 'media-uuid-1',
                thumbnail_media_uuid: 'thumb-uuid-1',
                item_type: 'image',
                mime_type: 'image/jpeg',
                description: 'Pop-up description',
                caption: 'A caption',
            });
        });

        it('serializes media_padding inverted: checked means no padding (0)', () => {
            document.querySelector('#media-padding').checked = true;
            const padded_off = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();
            expect(padded_off.media_padding).toBe(0);

            document.querySelector('#media-padding').checked = false;
            const padded_on = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();
            expect(padded_on.media_padding).toBe(1);
        });

        it('serializes wrap_text inverted: unchecked means no wrap (0)', () => {
            document.querySelector('#wrap-text').checked = false;
            const no_wrap = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();
            expect(no_wrap.wrap_text).toBe(0);

            document.querySelector('#wrap-text').checked = true;
            const wrap = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();
            expect(wrap.wrap_text).toBe(1);
        });

        it('serializes the embed checkbox to 1/0', () => {
            document.querySelector('#embed-item').checked = true;
            expect(globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields().is_embedded).toBe(1);

            document.querySelector('#embed-item').checked = false;
            expect(globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields().is_embedded).toBe(0);
        });

        it('collects pdf_open_to_page for PDF media, defaulting bad values to 1', () => {
            set_value('#item-media-type', 'pdf');

            set_value('#pdf-open-to-page', '12');
            expect(globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields().pdf_open_to_page).toBe(12);

            for (const bad of ['0', '-3', 'abc', '']) {
                set_value('#pdf-open-to-page', bad);
                expect(
                    globalThis.itemsCommonStandardItemFormModule
                        .get_common_standard_item_form_fields().pdf_open_to_page,
                    `expected '${bad}' to fall back to 1`,
                ).toBe(1);
            }
        });

        it('forces pdf_open_to_page to 1 for non-PDF media', () => {
            set_value('#pdf-open-to-page', '7');

            const result = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();

            expect(result.pdf_open_to_page).toBe(1);
        });
    });

    describe('set_item_style', () => {

        it('checks the radio that matches the saved key', () => {
            globalThis.itemsCommonStandardItemFormModule.set_item_style('item1');

            expect(document.querySelector('#item-style-item1').checked).toBe(true);
        });

        it('falls back to "None" when the saved key has no matching option', () => {
            globalThis.itemsCommonStandardItemFormModule.set_item_style('item999');

            expect(document.querySelector('#item-style-none').checked).toBe(true);
        });
    });

    describe('wait_for_styles', () => {

        it('resolves immediately when no fetch is in flight', async () => {
            await expect(
                globalThis.itemsCommonStandardItemFormModule.wait_for_styles(),
            ).resolves.toBeUndefined();
        });
    });

    describe('error handling', () => {

        it('returns false and alerts when an unexpected error is thrown', () => {
            globalThis.rteModule.get_html = vi.fn(() => {
                throw new Error('boom');
            });

            const result = globalThis.itemsCommonStandardItemFormModule
                .get_common_standard_item_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'boom',
            );
        });
    });
});
