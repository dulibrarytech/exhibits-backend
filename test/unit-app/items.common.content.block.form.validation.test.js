// @vitest-environment jsdom
//
// Content block forms must stop the submit when a required field is empty or
// the button URL is not a web address (standalone and grid item variants).

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const HELPER_PATH = resolve(__dirname, '../../public/app/utils/helper.module.js');

const MODULES = [
    {
        name: 'itemsCommonContentBlockFormModule',
        path: resolve(__dirname, '../../public/app/content-block-items/items.common.content.block.item.form.module.js')
    },
    {
        name: 'itemsCommonContentBlockGridItemFormModule',
        path: resolve(__dirname, '../../public/app/grid-items/items.common.content.block.grid.item.form.module.js')
    }
];

function load_iife(path, name) {
    const src = readFileSync(path, 'utf8');
    const patched = src.replace(new RegExp(`^const\\s+${name}\\s*=`, 'm'), `globalThis.${name} =`);
    // eslint-disable-next-line no-eval
    (0, eval)(patched);
}

function build_form(content_type) {
    document.body.innerHTML = `
        <div id="message"></div>
        <select id="content-type">
            <option value=""></option>
            <option value="button">button</option>
            <option value="card">card</option>
            <option value="divider">divider</option>
        </select>
        <textarea id="button-text-input"></textarea>
        <select id="button-size"><option value=""></option><option value="small">small</option></select>
        <input type="text" id="button-url-input" />
        <input type="checkbox" id="button-transparent" />
        <textarea id="card-title-input"></textarea>
        <textarea id="card-text-input"></textarea>
        <select id="divider-size"><option value=""></option><option value="small">small</option></select>
        <textarea id="emphasis-text-input"></textarea>
        <textarea id="quote-text-input"></textarea>
        <input type="text" id="quote-attribution-input" />
        <select id="is-published"><option value="0" selected>0</option></select>
        <input type="radio" name="styles" value="accent1" />
    `;
    document.querySelector('#content-type').value = content_type;
}

function set_value(selector, value) {
    document.querySelector(selector).value = value;
}

describe.each(MODULES)('$name — get_common_content_block_item_form_fields', ({ name, path }) => {

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);
        load_iife(HELPER_PATH, 'helperModule');
        load_iife(path, name);
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        globalThis.rteModule = {
            get_html: (id) => document.getElementById(id)?.value?.trim() ?? ''
        };

        globalThis.domModule = {
            set_alert: vi.fn(),
            set_field_error: vi.fn(),
            clear_field_error: vi.fn()
        };
    });

    const read = () => globalThis[name].get_common_content_block_item_form_fields();

    test('a button with no URL does not build a payload', () => {
        build_form('button');
        set_value('#button-text-input', '<p>Visit</p>');
        set_value('#button-size', 'small');

        expect(read()).toBe(false);
        expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
            '#button-url-input', 'button-url-input-error', 'Please enter button url'
        );
    });

    test('a button with no text does not build a payload', () => {
        build_form('button');
        set_value('#button-url-input', 'https://library.du.edu');
        set_value('#button-size', 'small');

        expect(read()).toBe(false);
        expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
            '#button-text-input', 'button-text-input-error', 'Please enter button text'
        );
    });

    test('a button whose URL is not a web address does not build a payload', () => {
        for (const url of ['javascript:alert(1)', 'data:text/html,x', 'not a link']) {
            build_form('button');
            set_value('#button-text-input', '<p>Visit</p>');
            set_value('#button-size', 'small');
            set_value('#button-url-input', url);

            expect(read(), url).toBe(false);
            expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
                '#button-url-input', 'button-url-input-error', expect.stringMatching(/web address/)
            );
        }
    });

    test('a complete button builds the payload (bare hosts included)', () => {
        for (const url of ['https://library.du.edu/?a=1&b=2', 'www.du.edu', 'mailto:ask@du.edu', '/exhibits/one']) {
            build_form('button');
            set_value('#button-text-input', '<p>Visit</p>');
            set_value('#button-size', 'small');
            set_value('#button-url-input', url);

            const payload = read();

            expect(payload, url).toMatchObject({ content_type: 'button', text: '<p>Visit</p>', size: 'small', url });
            expect(globalThis.domModule.set_field_error).not.toHaveBeenCalled();
        }
    });

    test('a card with no title does not build a payload', () => {
        build_form('card');
        set_value('#card-text-input', '<p>Body</p>');

        expect(read()).toBe(false);
        expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
            '#card-title-input', 'card-title-input-error', 'Please enter card title'
        );
    });

    test('a complete card builds the payload', () => {
        build_form('card');
        set_value('#card-title-input', '<p>Heading</p>');
        set_value('#card-text-input', '<p>Body</p>');

        expect(read()).toMatchObject({ content_type: 'card', title: '<p>Heading</p>', text: '<p>Body</p>' });
    });
});
