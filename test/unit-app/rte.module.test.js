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

    it('writes font family, size and colour inline on the container — never the background', () => {
        const ok = globalThis.rteModule.set_theme('item-text-input', {
            fontFamily: 'IBM Plex Mono', fontSize: '19px', color: '#303030', backgroundColor: '#c2ced5',
        });

        const style = document.getElementById('item-text-input').style;
        expect(ok).toBe(true);
        expect(style.fontFamily).toBe('"IBM Plex Mono"');
        expect(style.fontSize).toBe('19px');
        expect(style.color).toBe('rgb(48, 48, 48)');
        /* the editing surface stays white whatever the exhibit theme paints (2026-09-15) */
        expect(style.backgroundColor).toBe('');
    });

    it('clears a background an earlier theme left behind', () => {
        const el = document.getElementById('item-text-input');
        el.style.backgroundColor = '#000000';
        globalThis.rteModule.set_theme('item-text-input', { color: '#303030' });
        expect(el.style.backgroundColor).toBe('');
    });

    /*
     * With no background mirrored, a colour designed for a dark background
     * would vanish on the white editor. Kept only at AA contrast on white.
     */
    it('skips a text colour that would not read on white, keeps one that does', () => {
        const el = document.getElementById('item-text-input');

        globalThis.rteModule.set_theme('item-text-input', { color: '#ffffff' });
        expect(el.style.color).toBe('');
        globalThis.rteModule.set_theme('item-text-input', { color: 'rgb(255, 255, 0)' });
        expect(el.style.color).toBe('');
        /* #777777 is 4.48:1 — just under; #767676 is 4.54:1 — just over */
        globalThis.rteModule.set_theme('item-text-input', { color: '#777777' });
        expect(el.style.color).toBe('');
        globalThis.rteModule.set_theme('item-text-input', { color: '#767676' });
        expect(el.style.color).toBe('rgb(118, 118, 118)');
        globalThis.rteModule.set_theme('item-text-input', { color: '#4b0082' });
        expect(el.style.color).toBe('rgb(75, 0, 130)');
        globalThis.rteModule.set_theme('item-text-input', { color: '#fff' });
        expect(el.style.color).toBe('');
        /* unparseable → not mirrored rather than guessed */
        globalThis.rteModule.set_theme('item-text-input', { color: 'papayawhip' });
        expect(el.style.color).toBe('');
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
            fontFamily: 'Georgia', fontSize: '15px', color: '#111111',
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
