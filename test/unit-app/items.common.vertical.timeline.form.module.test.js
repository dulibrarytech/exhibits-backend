// @vitest-environment jsdom
//
// Unit tests for public/app/timeline-items/items.common.vertical.timeline.form.module.js.
//
// Mirrors items.common.grid.form.module.test.js: covers the public
// methods with observable behavior outside init() —
// get_common_timeline_form_fields, set_item_style, wait_for_styles.
// init() and fetch_and_populate_styles are async/http-bound and belong
// in integration coverage.

'use strict';

const { load_browser_module } = require('./helpers/load_module');
const { dom_stub, helper_stub, rte_stub } = require('./helpers/stubs');

function build_form() {
    document.body.innerHTML = `
        <div id="message"></div>
        <input type="text" id="timeline-text-input" />
        <input type="text" id="timeline-internal-name-input" value="Staff timeline name" />
        <select id="margins">
            <option value="small">Small</option>
            <option value="medium" selected>Medium</option>
            <option value="large">Large</option>
        </select>
        <select id="text-align">
            <option value="left" selected>Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
        </select>
        <div id="item-style-options" role="radiogroup">
            <label class="item-style-option"><input type="radio" name="styles" id="item-style-none" value="" checked> None</label>
            <label class="item-style-option"><input type="radio" name="styles" id="item-style-item1" value="item1"> Item Style 1</label>
            <label class="item-style-option"><input type="radio" name="styles" id="item-style-item2" value="item2"> Item Style 2</label>
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

describe('itemsCommonVerticalTimelineFormModule', () => {

    beforeAll(() => {
        load_browser_module(
            'public/app/timeline-items/items.common.vertical.timeline.form.module.js',
            'itemsCommonVerticalTimelineFormModule',
        );
    });

    beforeEach(() => {
        globalThis.rteModule = rte_stub();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        globalThis.domModule = dom_stub();
        globalThis.helperModule = helper_stub();
        build_form();
    });

    describe('get_common_timeline_form_fields', () => {

        it('returns the assembled timeline object on a fully valid form', () => {
            set_value('#timeline-text-input', 'Timeline copy');
            set_value('#margins', 'large');
            set_value('#text-align', 'center');
            select_style('item2');

            const result = globalThis.itemsCommonVerticalTimelineFormModule
                .get_common_timeline_form_fields();

            expect(result).toEqual({
                text: 'Timeline copy',
                internal_name: 'Staff timeline name',
                styles: 'item2',
                margins: 'large',
                text_alignment: 'center',
            });
        });

        it('returns false and flags the field when internal name is empty', () => {
            for (const empty of ['', '   ', '\t\n']) {
                build_form();
                set_value('#timeline-internal-name-input', empty);

                const result = globalThis.itemsCommonVerticalTimelineFormModule
                    .get_common_timeline_form_fields();

                expect(result, `expected '${JSON.stringify(empty)}' to be rejected`).toBe(false);
            }
            expect(globalThis.domModule.show_field_error).toHaveBeenCalledWith(
                'Please enter an internal name',
                '#timeline-internal-name-input',
            );
        });

        it('clears prior internal-name field errors before validating', () => {
            globalThis.itemsCommonVerticalTimelineFormModule
                .get_common_timeline_form_fields();

            expect(globalThis.domModule.clear_field_error).toHaveBeenCalledWith(
                '#timeline-internal-name-input',
                'timeline-internal-name-input-error',
            );
        });

        it('trims surrounding whitespace from internal name', () => {
            set_value('#timeline-internal-name-input', '  Homesteading timeline  ');

            const result = globalThis.itemsCommonVerticalTimelineFormModule
                .get_common_timeline_form_fields();

            expect(result.internal_name).toBe('Homesteading timeline');
        });

        it('allows empty timeline text (text is optional)', () => {
            set_value('#timeline-text-input', '');

            const result = globalThis.itemsCommonVerticalTimelineFormModule
                .get_common_timeline_form_fields();

            expect(result).not.toBe(false);
            expect(result.text).toBe('');
        });

        it('sets styles to null when no preset is selected (empty option)', () => {
            select_style('');

            const result = globalThis.itemsCommonVerticalTimelineFormModule
                .get_common_timeline_form_fields();

            expect(result.styles).toBeNull();
        });

        it('returns false and renders an inline alert when an unexpected error is thrown', () => {
            globalThis.rteModule.get_html = vi.fn(() => {
                throw new Error('boom');
            });

            const result = globalThis.itemsCommonVerticalTimelineFormModule
                .get_common_timeline_form_fields();

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                '#message',
                'danger',
                'boom',
            );
        });
    });

    describe('set_item_style', () => {

        it('checks the radio that matches the saved key', () => {
            globalThis.itemsCommonVerticalTimelineFormModule.set_item_style('item2');

            expect(document.querySelector('#item-style-item2').checked).toBe(true);
        });

        it('falls back to "None" when the saved key has no matching option', () => {
            globalThis.itemsCommonVerticalTimelineFormModule.set_item_style('item999');

            expect(document.querySelector('#item-style-none').checked).toBe(true);
        });

        it('selects "None" when styles_value is falsy', () => {
            expect(() => {
                globalThis.itemsCommonVerticalTimelineFormModule.set_item_style(null);
                globalThis.itemsCommonVerticalTimelineFormModule.set_item_style('');
            }).not.toThrow();
            expect(document.querySelector('#item-style-none').checked).toBe(true);
        });
    });

    describe('wait_for_styles', () => {

        it('resolves immediately when no fetch is in flight', async () => {
            await expect(
                globalThis.itemsCommonVerticalTimelineFormModule.wait_for_styles(),
            ).resolves.toBeUndefined();
        });

        it('returns a thenable each time it is called', () => {
            const p1 = globalThis.itemsCommonVerticalTimelineFormModule.wait_for_styles();
            expect(typeof p1.then).toBe('function');
        });
    });
});
