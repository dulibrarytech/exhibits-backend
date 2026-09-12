// @vitest-environment jsdom
//
// rteModule loads as a <script> in the dashboard (IIFE assigned to a const at
// file scope); the test rewrites the assignment onto globalThis and evals the
// source inside the jsdom window, as helper.module.test.js does. Quill is not
// loaded here — set_theme works on the container element alone.
'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(__dirname, '../../public/app/utils/rte.module.js');

describe('rteModule.set_theme', () => {

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);
        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(/^const\s+rteModule\s*=/m, 'globalThis.rteModule =');
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        document.body.innerHTML = '<div id="item-text-input" class="rte-container ql-container ql-snow"><div class="ql-editor"><p>x</p></div></div>';
    });

    it('writes the four preset properties inline on the container', () => {
        const ok = globalThis.rteModule.set_theme('item-text-input', {
            fontFamily: 'IBM Plex Mono', fontSize: '19px', color: '#303030', backgroundColor: '#c2ced5',
        });

        const style = document.getElementById('item-text-input').style;
        expect(ok).toBe(true);
        expect(style.fontFamily).toBe('"IBM Plex Mono"');
        expect(style.fontSize).toBe('19px');
        expect(style.color).toBe('rgb(48, 48, 48)');
        expect(style.backgroundColor).toBe('rgb(194, 206, 213)');
    });

    it('treats a bare numeric fontSize as pixels', () => {
        globalThis.rteModule.set_theme('item-text-input', { fontSize: '16' });
        expect(document.getElementById('item-text-input').style.fontSize).toBe('16px');

        globalThis.rteModule.set_theme('item-text-input', { fontSize: 18 });
        expect(document.getElementById('item-text-input').style.fontSize).toBe('18px');

        globalThis.rteModule.set_theme('item-text-input', { fontSize: '1.2rem' });
        expect(document.getElementById('item-text-input').style.fontSize).toBe('1.2rem');
    });

    it('clears a property the theme leaves empty, and everything on null', () => {
        const el = document.getElementById('item-text-input');
        globalThis.rteModule.set_theme('item-text-input', {
            fontFamily: 'Georgia', fontSize: '15px', color: '#111111', backgroundColor: '#fdfdfd',
        });

        globalThis.rteModule.set_theme('item-text-input', { fontFamily: 'Georgia', fontSize: '', color: null });
        expect(el.style.fontFamily).toBe('Georgia');
        expect(el.style.fontSize).toBe('');
        expect(el.style.color).toBe('');
        expect(el.style.backgroundColor).toBe('');

        globalThis.rteModule.set_theme('item-text-input', null);
        expect(el.getAttribute('style')).toBe('');
    });

    it('ignores properties the public site does not apply and reports a missing container', () => {
        globalThis.rteModule.set_theme('item-text-input', { textAlign: 'center', margins: 'large', color: '#000' });
        const el = document.getElementById('item-text-input');
        expect(el.style.textAlign).toBe('');
        expect(el.style.color).toBe('rgb(0, 0, 0)');

        expect(globalThis.rteModule.set_theme('no-such-editor', { color: '#000' })).toBe(false);
    });
});
