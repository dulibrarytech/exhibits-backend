// @vitest-environment jsdom
//
// Unit tests for public/app/grid-items/items.common.grid.form.module.js.
//
// Covers the three public methods that have observable behavior outside
// of init() — get_common_grid_form_fields, set_item_style, wait_for_styles.
// init() and the closure-private fetch_and_populate_styles are async/http-
// bound and belong in integration coverage.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/grid-items/items.common.grid.form.module.js',
);

function build_form() {
    document.body.innerHTML = `
        <div id="message"></div>
        <input type="text" id="grid-text-input" />
        <input type="number" id="grid-columns" />
        <select id="item-style-select">
            <option value=""></option>
            <option value="item1">Item Style 1</option>
            <option value="item2">Item Style 2</option>
            <option value="item3">Item Style 3</option>
        </select>
    `;
}

function set_value(selector, value) {
    document.querySelector(selector).value = value;
}

describe('itemsCommonStandardGridFormModule', () => {

    beforeAll(() => {
        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+itemsCommonStandardGridFormModule\s*=/m,
            'globalThis.itemsCommonStandardGridFormModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // The methods reach for domModule.set_alert when reporting validation
        // failures. Stubbed per-test so we can assert calls.
        globalThis.domModule = { set_alert: vi.fn() };
        build_form();
    });

    describe('get_common_grid_form_fields', () => {

        it('returns false and shows an alert when columns is empty', () => {
            const result = globalThis.itemsCommonStandardGridFormModule
                .get_common_grid_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'Please enter the number of columns',
            );
        });

        it('returns false when columns is not a positive integer in [1,12]', () => {
            for (const bad of ['0', '13', '-1', '3.5', 'abc']) {
                build_form();
                set_value('#grid-columns', bad);

                const result = globalThis.itemsCommonStandardGridFormModule
                    .get_common_grid_form_fields();

                expect(result, `expected '${bad}' to be rejected`).toBe(false);
            }
            expect(globalThis.domModule.set_alert).toHaveBeenCalled();
        });

        it('accepts integer columns at the boundary values 1 and 12', () => {
            set_value('#grid-columns', '1');
            const r1 = globalThis.itemsCommonStandardGridFormModule
                .get_common_grid_form_fields();
            expect(r1).toMatchObject({ columns: '1' });

            build_form();
            set_value('#grid-columns', '12');
            const r12 = globalThis.itemsCommonStandardGridFormModule
                .get_common_grid_form_fields();
            expect(r12).toMatchObject({ columns: '12' });
        });

        it('returns the assembled grid object on a fully valid form', () => {
            set_value('#grid-text-input', 'Some grid copy');
            set_value('#grid-columns', '4');
            set_value('#item-style-select', 'item2');

            const result = globalThis.itemsCommonStandardGridFormModule
                .get_common_grid_form_fields();

            expect(result).toEqual({
                text: 'Some grid copy',
                columns: '4',
                styles: 'item2',
            });
        });

        it('serializes columns as a string (server coerces to number)', () => {
            set_value('#grid-columns', '6');

            const result = globalThis.itemsCommonStandardGridFormModule
                .get_common_grid_form_fields();

            expect(typeof result.columns).toBe('string');
            expect(result.columns).toBe('6');
        });

        it('sets styles to null when no preset is selected (empty option)', () => {
            set_value('#grid-columns', '3');
            set_value('#item-style-select', '');

            const result = globalThis.itemsCommonStandardGridFormModule
                .get_common_grid_form_fields();

            expect(result.styles).toBeNull();
        });

        it('trims surrounding whitespace from text', () => {
            set_value('#grid-text-input', '\tspacey text\n');
            set_value('#grid-columns', '3');

            const result = globalThis.itemsCommonStandardGridFormModule
                .get_common_grid_form_fields();

            expect(result.text).toBe('spacey text');
        });

        it('returns false and renders an alert when an unexpected error is thrown', () => {
            // Force querySelector to throw after the form is in the DOM
            const original_qs = document.querySelector.bind(document);
            document.querySelector = vi.fn((sel) => {
                if (sel === '#grid-text-input') throw new Error('boom');
                return original_qs(sel);
            });

            const result = globalThis.itemsCommonStandardGridFormModule
                .get_common_grid_form_fields();

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(),
                'danger',
                'boom',
            );

            document.querySelector = original_qs;
        });
    });

    describe('set_item_style', () => {

        it('selects an option that matches the saved key', () => {
            globalThis.itemsCommonStandardGridFormModule.set_item_style('item2');

            expect(document.querySelector('#item-style-select').value).toBe('item2');
        });

        it('warns when the saved key has no matching option', () => {
            globalThis.itemsCommonStandardGridFormModule.set_item_style('item999');

            expect(console.warn).toHaveBeenCalledWith(
                'Saved style key not found in dropdown options:',
                'item999',
            );
            expect(document.querySelector('#item-style-select').value).toBe('');
        });

        it('is a no-op when the select element is missing', () => {
            document.querySelector('#item-style-select').remove();
            expect(() =>
                globalThis.itemsCommonStandardGridFormModule.set_item_style('item1'),
            ).not.toThrow();
        });

        it('is a no-op when styles_value is falsy', () => {
            globalThis.itemsCommonStandardGridFormModule.set_item_style(null);
            globalThis.itemsCommonStandardGridFormModule.set_item_style('');
            globalThis.itemsCommonStandardGridFormModule.set_item_style(undefined);
            expect(console.warn).not.toHaveBeenCalled();
            expect(document.querySelector('#item-style-select').value).toBe('');
        });
    });

    describe('wait_for_styles', () => {

        it('resolves immediately when no fetch is in flight', async () => {
            // styles_promise is closure-private and starts as null. Until
            // init() kicks off fetch_and_populate_styles, wait_for_styles()
            // falls through to Promise.resolve().
            await expect(
                globalThis.itemsCommonStandardGridFormModule.wait_for_styles(),
            ).resolves.toBeUndefined();
        });

        it('returns a thenable each time it is called', () => {
            const p1 = globalThis.itemsCommonStandardGridFormModule.wait_for_styles();
            const p2 = globalThis.itemsCommonStandardGridFormModule.wait_for_styles();
            expect(typeof p1.then).toBe('function');
            expect(typeof p2.then).toBe('function');
        });
    });
});
