// @vitest-environment jsdom
//
// Unit tests for public/app/exhibits/exhibits.add.form.module.js.
//
// Only obj.reset_form is exercised here. obj.create_exhibit_record and
// obj.init are tightly bound to httpModule + DataTables init wiring; they
// belong in integration-style coverage, not pure unit tests.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/exhibits/exhibits.add.form.module.js',
);

// Style sections cleared by reset_form. Note: this list intentionally
// excludes 'template' — the add-exhibit modal's styles section starts
// at 'introduction' (verified against the module source on 2026-04-26).
const RESET_STYLE_SECTIONS = [
    'introduction',
    'navigation',
    'heading1',
    'item1',
    'heading2',
    'heading3',
    'item2',
    'item3',
];

function build_section_fragment(key) {
    return `
        <input type="text" id="${key}-background-color" />
        <input type="color" id="${key}-background-color-picker" />
        <input type="text" id="${key}-font-color" />
        <input type="color" id="${key}-font-color-picker" />
        <input type="number" id="${key}-font-size" />
        <select id="${key}-font">
            <option value=""></option>
            <option value="Arial">Arial</option>
        </select>
        <span id="swatch-${key}-bg"></span>
        <span id="swatch-${key}-font"></span>
    `;
}

function build_modal() {
    const sections_html = RESET_STYLE_SECTIONS.map(build_section_fragment).join('');
    document.body.innerHTML = `
        <div id="add-exhibit-modal">
            <div class="modal-body">
                <div id="add-exhibit-message"></div>
                <textarea id="exhibit-title-input"></textarea>
                <textarea id="exhibit-sub-title-input"></textarea>
                <textarea id="exhibit-description-input"></textarea>
                <textarea id="exhibit-about-the-curators-input"></textarea>

                <input type="checkbox" id="is-content-advisory" />
                <input type="checkbox" id="is-featured" />
                <input type="checkbox" id="is-student-curated" />

                <input type="radio" id="exhibit-banner-1" name="banner_template" />
                <input type="radio" id="exhibit-banner-2" name="banner_template" />

                <input type="hidden" id="hero-image" />
                <input type="hidden" id="hero-image-media-uuid" />
                <input type="hidden" id="thumbnail-image" />
                <input type="hidden" id="thumbnail-media-uuid" />

                <div id="hero-image-display"></div>
                <div id="thumbnail-image-display"></div>

                <span id="hero-image-filename-display"></span>
                <span id="thumbnail-filename-display"></span>

                <a href="#" id="hero-trash"></a>
                <a href="#" id="thumbnail-trash"></a>

                ${sections_html}

                <div id="collapse-introduction" class="collapse show"></div>
                <div id="collapse-heading1" class="collapse show"></div>
            </div>
        </div>
    `;
}

function pre_fill_form() {
    document.querySelector('#exhibit-title-input').value = 'Old title';
    document.querySelector('#exhibit-sub-title-input').value = 'Old subtitle';
    document.querySelector('#exhibit-description-input').value = 'Old description';
    document.querySelector('#exhibit-about-the-curators-input').value = 'Old curators';

    document.querySelector('#is-content-advisory').checked = true;
    document.querySelector('#is-featured').checked = true;
    document.querySelector('#is-student-curated').checked = true;

    document.querySelector('#exhibit-banner-2').checked = true;

    document.querySelector('#hero-image').value = 'hero.jpg';
    document.querySelector('#hero-image-media-uuid').value = 'hero-uuid';
    document.querySelector('#thumbnail-image').value = 'thumb.jpg';
    document.querySelector('#thumbnail-media-uuid').value = 'thumb-uuid';

    document.querySelector('#hero-image-filename-display').textContent = 'hero.jpg';
    document.querySelector('#thumbnail-filename-display').textContent = 'thumb.jpg';

    document.querySelector('#hero-image-display').innerHTML = '<img src="hero.jpg">';
    document.querySelector('#thumbnail-image-display').innerHTML = '<img src="thumb.jpg">';

    document.querySelector('#hero-trash').style.display = 'inline';
    document.querySelector('#thumbnail-trash').style.display = 'inline';

    document.querySelector('#add-exhibit-message').innerHTML = '<div class="alert">Old msg</div>';

    for (const key of RESET_STYLE_SECTIONS) {
        document.querySelector('#' + key + '-background-color').value = '#aabbcc';
        document.querySelector('#' + key + '-background-color-picker').value = '#aabbcc';
        document.querySelector('#' + key + '-font-color').value = '#112233';
        document.querySelector('#' + key + '-font-color-picker').value = '#112233';
        document.querySelector('#' + key + '-font-size').value = '20';
        document.querySelector('#' + key + '-font').selectedIndex = 1;
        document.querySelector('#swatch-' + key + '-bg').style.backgroundColor = '#aabbcc';
        document.querySelector('#swatch-' + key + '-font').style.backgroundColor = '#112233';
    }
}

describe('exhibitsAddFormModule.reset_form', () => {

    let collapse_hide_spy;

    beforeAll(() => {
        // The module reads these at IIFE-definition time:
        //   const APP_PATH = window.localStorage.getItem('exhibits_app_path');
        //   const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
        // vitest's jsdom env exposes window.localStorage as a bare {} without
        // .getItem, so we have to stub it before evaling the module.
        const fake_storage = (() => {
            const store = new Map();
            return {
                getItem: (k) => (store.has(k) ? store.get(k) : null),
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: (k) => store.delete(k),
                clear: () => store.clear(),
            };
        })();
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: fake_storage,
        });

        globalThis.endpointsModule = {
            get_exhibits_endpoints: () => ({}),
        };

        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+exhibitsAddFormModule\s*=/m,
            'globalThis.exhibitsAddFormModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // reset_form calls $(open_panels[i]).collapse('hide') — stub the
        // jQuery factory so we can assert it ran on each open .collapse.show.
        collapse_hide_spy = vi.fn();
        globalThis.$ = vi.fn(() => ({ collapse: collapse_hide_spy }));
        build_modal();
        pre_fill_form();
    });

    it('clears all textareas back to empty strings', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        for (const sel of [
            '#exhibit-title-input',
            '#exhibit-sub-title-input',
            '#exhibit-description-input',
            '#exhibit-about-the-curators-input',
        ]) {
            expect(document.querySelector(sel).value).toBe('');
        }
    });

    it('unchecks all toggle checkboxes', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        expect(document.querySelector('#is-content-advisory').checked).toBe(false);
        expect(document.querySelector('#is-featured').checked).toBe(false);
        expect(document.querySelector('#is-student-curated').checked).toBe(false);
    });

    it('selects banner_1 as the default banner radio', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        expect(document.querySelector('#exhibit-banner-1').checked).toBe(true);
    });

    it('clears all hidden image and media-uuid inputs', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        for (const sel of [
            '#hero-image',
            '#hero-image-media-uuid',
            '#thumbnail-image',
            '#thumbnail-media-uuid',
        ]) {
            expect(document.querySelector(sel).value).toBe('');
        }
    });

    it('replaces media-display content with a "No image selected" placeholder', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        for (const sel of ['#hero-image-display', '#thumbnail-image-display']) {
            const display_el = document.querySelector(sel);
            const placeholder = display_el.querySelector('.media-placeholder');
            expect(placeholder).not.toBeNull();
            expect(placeholder.querySelector('i.fa.fa-picture-o')).not.toBeNull();
            expect(placeholder.querySelector('span').textContent).toBe('No image selected');
            // Old <img> content is gone
            expect(display_el.querySelector('img')).toBeNull();
        }
    });

    it('empties the filename text spans', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        expect(document.querySelector('#hero-image-filename-display').textContent).toBe('');
        expect(document.querySelector('#thumbnail-filename-display').textContent).toBe('');
    });

    it('hides the trash links via inline display:none', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        expect(document.querySelector('#hero-trash').style.display).toBe('none');
        expect(document.querySelector('#thumbnail-trash').style.display).toBe('none');
    });

    it('clears every style section field', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        for (const key of RESET_STYLE_SECTIONS) {
            expect(document.querySelector('#' + key + '-background-color').value).toBe('');
            expect(document.querySelector('#' + key + '-font-color').value).toBe('');
            // Pickers reset to white (#ffffff) per the module convention
            expect(document.querySelector('#' + key + '-background-color-picker').value).toBe('#ffffff');
            expect(document.querySelector('#' + key + '-font-color-picker').value).toBe('#ffffff');
            expect(document.querySelector('#' + key + '-font-size').value).toBe('');
            expect(document.querySelector('#' + key + '-font').selectedIndex).toBe(0);
            expect(document.querySelector('#swatch-' + key + '-bg').style.backgroundColor).toBe('');
            expect(document.querySelector('#swatch-' + key + '-font').style.backgroundColor).toBe('');
        }
    });

    it('collapses any open accordion panels via jQuery', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        // Two .collapse.show panels exist in the fixture.
        expect(globalThis.$).toHaveBeenCalledTimes(2);
        expect(collapse_hide_spy).toHaveBeenCalledWith('hide');
        expect(collapse_hide_spy).toHaveBeenCalledTimes(2);
    });

    it('clears the message area inside the modal', () => {
        globalThis.exhibitsAddFormModule.reset_form();

        expect(document.querySelector('#add-exhibit-message').innerHTML).toBe('');
    });

    it('does not throw when the modal DOM is missing — failures are logged', () => {
        document.body.innerHTML = '';
        expect(() => globalThis.exhibitsAddFormModule.reset_form()).not.toThrow();
    });
});
