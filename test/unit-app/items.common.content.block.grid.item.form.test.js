// @vitest-environment jsdom

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const HELPER_PATH = resolve(__dirname, '../../public/app/utils/helper.module.js');
const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/grid-items/items.common.content.block.grid.item.form.module.js',
);
const MODULE_NAME = 'itemsCommonContentBlockGridItemFormModule';

function load_iife(path, name) {
    const src = readFileSync(path, 'utf8');
    const patched = src.replace(new RegExp(`^const\\s+${name}\\s*=`, 'm'), `globalThis.${name} =`);
    (0, eval)(patched);
}

function build_form() {
    document.body.innerHTML = `
        <div id="message"></div>
        <select id="content-type">
            <option value="" disabled selected>Select a content block type</option>
            <option value="button">Button</option>
            <option value="card">Card</option>
            <option value="emphasis">Emphasis</option>
            <option value="quote">Quote</option>
        </select>
        <textarea id="button-text-input"></textarea>
        <input type="text" id="button-url-input" />
        <select id="button-size">
            <option value="" disabled selected>Select a button size</option>
            <option value="small">Small</option>
            <option value="large">Large</option>
        </select>
        <input type="checkbox" id="button-transparent" />
        <textarea id="card-title-input"></textarea>
        <textarea id="card-text-input"></textarea>
        <textarea id="emphasis-text-input"></textarea>
        <textarea id="quote-text-input"></textarea>
        <input type="text" id="quote-attribution-input" />
        <input type="radio" name="styles" value="accent1" />
    `;
}

const set_value = (selector, value) => {
    document.querySelector(selector).value = value;
};
const value_of = (selector) => document.querySelector(selector).value;

describe('itemsCommonContentBlockGridItemFormModule', () => {

    let form;

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);
        load_iife(HELPER_PATH, 'helperModule');
        load_iife(MODULE_PATH, MODULE_NAME);
        form = globalThis[MODULE_NAME];
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        globalThis.rteModule = {
            get_html: (id) => document.getElementById(id)?.value?.trim() ?? '',
            set_html: (id, html) => {
                const el = document.getElementById(id);
                if (el) el.value = html ?? '';
            },
        };

        globalThis.domModule = {
            set_alert: vi.fn(),
            set_field_error: vi.fn(),
            clear_field_error: vi.fn(),
        };

        build_form();
    });

    describe('get_common_content_block_item_form_fields', () => {

        const read = () => form.get_common_content_block_item_form_fields();
        const marked_fields = () => globalThis.domModule.set_field_error.mock.calls.map((call) => call[0]);

        it('refuses when no type is chosen', () => {
            expect(read()).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'danger', 'Please select a content block type',
            );
            expect(globalThis.domModule.set_field_error.mock.calls).toEqual([
                ['#content-type', 'content-type-error', 'Please select a content block type'],
            ]);
        });

        it('clears an earlier type error once a type is chosen', () => {
            set_value('#content-type', 'quote');
            set_value('#quote-text-input', '<p>Words</p>');

            expect(read()).toMatchObject({ content_type: 'quote', text: '<p>Words</p>' });
            expect(globalThis.domModule.clear_field_error)
                .toHaveBeenCalledWith('#content-type', 'content-type-error');
            expect(globalThis.domModule.set_field_error).not.toHaveBeenCalled();
        });

        it('marks every missing field of a button and reports the first', () => {
            set_value('#content-type', 'button');

            expect(read()).toBe(false);
            expect(globalThis.domModule.set_field_error.mock.calls).toEqual([
                ['#button-url-input', 'button-url-input-error', 'Please enter button url'],
                ['#button-text-input', 'button-text-input-error', 'Please enter button text'],
                ['#button-size', 'button-size-error', 'Please select button size'],
            ]);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledTimes(1);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'danger', 'Please enter button url',
            );
        });

        it('marks a web address that is not one together with a missing button text', () => {
            set_value('#content-type', 'button');
            set_value('#button-url-input', 'not a link');
            set_value('#button-size', 'small');

            expect(read()).toBe(false);
            expect(marked_fields()).toEqual(['#button-text-input', '#button-url-input']);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(), 'danger', 'Please enter button text',
            );
        });

        it('marks both missing fields of a card', () => {
            set_value('#content-type', 'card');

            expect(read()).toBe(false);
            expect(marked_fields()).toEqual(['#card-title-input', '#card-text-input']);
        });

        it('marks the one missing field of an emphasis and of a quote', () => {
            set_value('#content-type', 'emphasis');
            expect(read()).toBe(false);

            set_value('#content-type', 'quote');
            expect(read()).toBe(false);

            expect(marked_fields()).toEqual(['#emphasis-text-input', '#quote-text-input']);
        });
    });

    describe('fill', () => {

        it('fills a button', async () => {
            await form.fill({
                content_type: 'button',
                text: 'Visit &amp; learn',
                url: 'https://library.du.edu',
                size: 'large',
                transparent: 1,
            });

            expect(value_of('#content-type')).toBe('button');
            expect(value_of('#button-text-input')).toBe('Visit & learn');
            expect(value_of('#button-url-input')).toBe('https://library.du.edu');
            expect(value_of('#button-size')).toBe('large');
            expect(document.querySelector('#button-transparent').checked).toBe(true);
        });

        it('fills a quote', async () => {
            await form.fill({ content_type: 'quote', text: 'Quoted words', attribution: 'A. Person' });

            expect(value_of('#content-type')).toBe('quote');
            expect(value_of('#quote-text-input')).toBe('Quoted words');
            expect(value_of('#quote-attribution-input')).toBe('A. Person');
            expect(document.querySelector('#button-transparent').checked).toBe(false);
        });

        it('fills a form that reads back as the same card', async () => {
            await form.fill({ content_type: 'card', title: 'Heading', text: 'Body' });

            expect(form.get_common_content_block_item_form_fields()).toMatchObject({
                content_type: 'card',
                title: 'Heading',
                text: 'Body',
            });
        });

        it('leaves an item with no type unchosen, so saving it is refused', async () => {
            await form.fill({ content_type: null, text: 'Words' });

            expect(form.get_common_content_block_item_form_fields()).toBe(false);
            expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
                '#content-type', 'content-type-error', 'Please select a content block type',
            );
        });

        it('chooses the saved style', async () => {
            const check_style = vi.spyOn(globalThis.helperModule, 'check_item_style_option')
                .mockImplementation(() => {});

            await form.fill({ content_type: 'emphasis', text: 'Words', styles: 'accent2' });

            expect(check_style).toHaveBeenCalledWith('accent2', 'styles');
        });

        it('ignores a saved style that is not a style name', async () => {
            const check_style = vi.spyOn(globalThis.helperModule, 'check_item_style_option')
                .mockImplementation(() => {});

            for (const styles of ['{}', '', '   ', null, '{"backgroundColor":"#fff"}']) {
                await form.fill({ content_type: 'emphasis', text: 'Words', styles });
            }

            expect(check_style).not.toHaveBeenCalled();
        });

        it('does nothing without a record', async () => {
            await form.fill(null);

            expect(value_of('#content-type')).toBe('');
        });
    });

    describe('reset', () => {

        it('empties a filled form back to no type chosen', async () => {
            await form.fill({
                content_type: 'button',
                text: 'Visit',
                url: 'https://library.du.edu',
                size: 'large',
                transparent: 1,
                attribution: 'A. Person',
            });

            form.reset();

            expect(value_of('#content-type')).toBe('');
            expect(value_of('#button-text-input')).toBe('');
            expect(value_of('#card-title-input')).toBe('');
            expect(value_of('#quote-text-input')).toBe('');
            expect(value_of('#button-url-input')).toBe('');
            expect(value_of('#button-size')).toBe('');
            expect(value_of('#quote-attribution-input')).toBe('');
            expect(document.querySelector('#button-transparent').checked).toBe(false);
            expect(globalThis.domModule.clear_field_error).toHaveBeenCalledWith('#content-type', 'content-type-error');
            expect(form.get_common_content_block_item_form_fields()).toBe(false);
        });
    });

    describe('set_message_selector', () => {

        it('sends the form message to the place it is given', () => {
            const popup_message = document.createElement('div');
            popup_message.id = 'popup-message';
            document.body.appendChild(popup_message);

            form.set_message_selector('#popup-message');
            form.get_common_content_block_item_form_fields();

            expect(globalThis.domModule.set_alert).toHaveBeenLastCalledWith(
                popup_message, 'danger', 'Please select a content block type',
            );

            form.set_message_selector();
        });
    });

    describe('load_styles', () => {

        afterEach(() => {
            delete globalThis.authModule;
            delete globalThis.endpointsModule;
            delete globalThis.httpModule;
        });

        it('builds the style choices where it is told and reads only that group', async () => {
            window.history.pushState({}, '', '/exhibits-dashboard/items/grid/items?exhibit_id=exhibit-1');
            document.body.insertAdjacentHTML('beforeend', `
                <input type="radio" name="styles" value="item2" checked />
                <div id="popup-styles-card" style="display: none;">
                    <div id="popup-style-options"></div>
                </div>`);

            globalThis.authModule = { get_user_token: () => 'secret-token' };
            globalThis.endpointsModule = {
                get_exhibits_endpoints: () => ({
                    exhibits: { exhibit_records: { endpoints: { get: { endpoint: '/api/exhibits/:exhibit_id' } } } },
                }),
            };
            globalThis.httpModule = {
                req: vi.fn(async () => ({
                    status: 200,
                    data: { data: { styles: { exhibit: {
                        accent1: { backgroundColor: '#111111', color: '#ffffff' },
                        accent2: { backgroundColor: '#222222', color: '#eeeeee' },
                        item1: { color: '#333333' },
                    } } } },
                })),
            };

            await form.load_styles({
                card: '#popup-styles-card',
                container: '#popup-style-options',
                name: 'popup_styles',
            });

            const radios = Array.from(document.querySelectorAll('#popup-style-options input[type="radio"]'));

            expect(radios.map((radio) => radio.value)).toEqual(['accent1', 'accent2']);
            expect(radios.every((radio) => radio.name === 'popup_styles')).toBe(true);
            expect(document.querySelector('#popup-styles-card').style.display).toBe('');
            expect(document.querySelector('input[name="styles"][value="item2"]').checked).toBe(true);

            await form.fill({ content_type: 'emphasis', text: 'Words', styles: 'accent2' });

            expect(form.get_common_content_block_item_form_fields()).toMatchObject({
                content_type: 'emphasis',
                styles: 'accent2',
            });
            expect(document.querySelector('input[name="styles"][value="item2"]').checked).toBe(true);

            form.reset();

            expect(document.querySelector('#popup-style-options input:checked').value).toBe('accent1');
            expect(document.querySelector('input[name="styles"][value="item2"]').checked).toBe(true);
        });
    });
});
