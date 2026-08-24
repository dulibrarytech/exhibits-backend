'use strict';

/**
 * Unit tests for libs/rte_vocabulary — the per-field rich text content gate.
 *
 * The vocabulary must accept exactly what the dashboard Quill editors
 * (public/app/utils/rte.module.js) produce and strip everything else:
 *   full    — p/br, strong/em/u (+legacy b/i), a[href|target|rel], ol/ul/li,
 *             ql-indent-N classes, h2/h3, DU-palette color on span[style]
 *   reduced — inline formats only
 *   plain   — no markup at all
 */

const vocabulary = require('../../libs/rte_vocabulary');

describe('libs/rte_vocabulary — full profile', () => {

    test('keeps the editor vocabulary intact', () => {
        const input = '<h2>Head</h2><p>One <strong>bold</strong> <em>italic</em> <u>under</u></p><ol><li>a</li></ol><ul><li>b</li></ul>';
        expect(vocabulary.sanitize_rich_full(input)).toBe(input);
    });

    test('keeps ql-indent classes and drops other classes', () => {
        expect(vocabulary.sanitize_rich_full('<p class="ql-indent-2 lead">x</p>'))
            .toBe('<p class="ql-indent-2">x</p>');
        expect(vocabulary.sanitize_rich_full('<p class="lead">x</p>'))
            .toBe('<p>x</p>');
    });

    test('keeps DU-palette colors and normalizes rgb; strips off-palette colors', () => {
        expect(vocabulary.sanitize_rich_full('<span style="color: #8B2332">x</span>'))
            .toBe('<span style="color: #8b2332">x</span>');
        expect(vocabulary.sanitize_rich_full('<span style="color: rgb(60,120,150)">x</span>'))
            .toBe('<span style="color: #3c7896">x</span>');
        expect(vocabulary.sanitize_rich_full('<span style="color: #ff0000">x</span>'))
            .toBe('<span>x</span>');
    });

    test('strips non-color style declarations', () => {
        expect(vocabulary.sanitize_rich_full('<p style="font-size: 200%">x</p>')).toBe('<p>x</p>');
        expect(vocabulary.sanitize_rich_full('<p style="text-align: center">x</p>')).toBe('<p>x</p>');
    });

    test('link hygiene: safe schemes only, rel forced on target=_blank', () => {
        expect(vocabulary.sanitize_rich_full('<a href="https://du.edu" target="_blank">x</a>'))
            .toBe('<a href="https://du.edu" target="_blank" rel="noopener noreferrer">x</a>');
        expect(vocabulary.sanitize_rich_full('<a href="javascript:alert(1)">x</a>'))
            .toBe('<a>x</a>');
        expect(vocabulary.sanitize_rich_full('<a href="mailto:a@du.edu">x</a>'))
            .toBe('<a href="mailto:a@du.edu">x</a>');
    });

    test('strips out-of-vocabulary structure but keeps content', () => {
        expect(vocabulary.sanitize_rich_full('<button style="color:#fff">CLICK</button>')).toBe('CLICK');
        expect(vocabulary.sanitize_rich_full('<h1>big</h1>')).toBe('big');
        expect(vocabulary.sanitize_rich_full('<table><tr><td>cell</td></tr></table>')).toBe('cell');
    });

    test('removes script/style entirely', () => {
        expect(vocabulary.sanitize_rich_full('a<script>alert(1)</script>b')).toBe('ab');
        expect(vocabulary.sanitize_rich_full('a<style>.x{}</style>b')).toBe('ab');
    });

    test('typed angle brackets display literally', () => {
        expect(vocabulary.sanitize_rich_full('<p>1 &lt; 2</p>')).toBe('<p>1 &lt; 2</p>');
    });
});

describe('libs/rte_vocabulary — reduced profile', () => {

    test('keeps inline formats only', () => {
        expect(vocabulary.sanitize_rich_reduced('<em>Denver Quarterly</em> at 60'))
            .toBe('<em>Denver Quarterly</em> at 60');
        expect(vocabulary.sanitize_rich_reduced('<h2 style="color:#3c7896"><strong>T</strong></h2>'))
            .toBe('<strong>T</strong>');
        expect(vocabulary.sanitize_rich_reduced('<a href="https://x.test">t</a>')).toBe('t');
        expect(vocabulary.sanitize_rich_reduced('<p>para</p>')).toBe('para');
    });
});

describe('libs/rte_vocabulary — plain profile', () => {

    test('strips all markup, keeps text', () => {
        expect(vocabulary.sanitize_plain('<b>bold</b> text')).toBe('bold text');
        expect(vocabulary.sanitize_plain('plain')).toBe('plain');
    });
});

describe('libs/rte_vocabulary — apply()', () => {

    test('applies the profile map per field and leaves others untouched', () => {
        const record = {
            title: '<h2><em>T</em></h2>',
            text: '<p class="x">body</p>',
            internal_name: '<b>Internal</b>',
            order: 3,
            styles: null
        };

        vocabulary.apply(record, {title: 'reduced', text: 'full', internal_name: 'plain'});

        expect(record.title).toBe('<em>T</em>');
        expect(record.text).toBe('<p>body</p>');
        expect(record.internal_name).toBe('Internal');
        expect(record.order).toBe(3);
        expect(record.styles).toBeNull();
    });

    test('tolerates null/undefined records and missing fields', () => {
        expect(vocabulary.apply(null, {text: 'full'})).toBeNull();
        expect(vocabulary.apply({other: 1}, {text: 'full'})).toEqual({other: 1});
    });
});
