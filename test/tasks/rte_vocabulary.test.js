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
        expect(vocabulary.sanitize_rich_full('<a href="mailto:a@du.edu">x</a>'))
            .toBe('<a href="mailto:a@du.edu">x</a>');
        expect(vocabulary.sanitize_rich_full('<a href="/exhibits/1">x</a>'))
            .toBe('<a href="/exhibits/1">x</a>');
        expect(vocabulary.sanitize_rich_full('<a href="#section">x</a>'))
            .toBe('<a href="#section">x</a>');
    });

    /*
     * Quill resolves a scheme-less value against the dashboard origin to test
     * its protocol, so "www.example.com" passes its whitelist and is stored
     * verbatim. Dropping it here is what made staff links vanish on save.
     */
    test('adds https:// to scheme-less hosts instead of dropping the link', () => {
        expect(vocabulary.sanitize_rich_full('<a href="www.example.com">x</a>'))
            .toBe('<a href="https://www.example.com">x</a>');
        expect(vocabulary.sanitize_rich_full('<a href="du.edu">x</a>'))
            .toBe('<a href="https://du.edu">x</a>');
        expect(vocabulary.sanitize_rich_full('<a href="libguides.du.edu/c.php?g=629200">x</a>'))
            .toBe('<a href="https://libguides.du.edu/c.php?g=629200">x</a>');
        expect(vocabulary.sanitize_rich_full('<a href="  www.example.com  ">x</a>'))
            .toBe('<a href="https://www.example.com">x</a>');
    });

    /*
     * A dangling <a> still picks up the crimson underlined link styling on
     * the public site, so it reads as a broken link rather than plain text.
     */
    test('unwraps anchors whose href cannot be made usable', () => {
        expect(vocabulary.sanitize_rich_full('<a href="javascript:alert(1)">x</a>')).toBe('x');
        expect(vocabulary.sanitize_rich_full('<a href="data:text/html,x">x</a>')).toBe('x');
        expect(vocabulary.sanitize_rich_full('<a href="//evil.test">x</a>')).toBe('x');
        expect(vocabulary.sanitize_rich_full('<a href="about:blank">x</a>')).toBe('x');
        expect(vocabulary.sanitize_rich_full('<a>x</a>')).toBe('x');
        expect(vocabulary.sanitize_rich_full('<p>see <a href="not a url">this</a> now</p>'))
            .toBe('<p>see this now</p>');
    });

    /*
     * Blocks outside the vocabulary are unwrapped, so their boundaries have
     * to survive as whitespace or adjacent words run together.
     */
    test('keeps a word boundary where an out-of-vocabulary block is dropped', () => {
        expect(vocabulary.sanitize_rich_full('<div>First line</div><div>Second line</div>'))
            .toBe('First line Second line');
        /* h1 is remapped rather than dropped now — blockquote still drops */
        expect(vocabulary.sanitize_rich_full('<p>a</p><blockquote>Quoted</blockquote><p>b</p>'))
            .toBe('<p>a</p> Quoted<p>b</p>');
        expect(vocabulary.sanitize_rich_full('<table><tr><td>one</td><td>two</td></tr></table>'))
            .toBe('one two');
    });

    test('strips out-of-vocabulary structure but keeps content', () => {
        expect(vocabulary.sanitize_rich_full('<button style="color:#fff">CLICK</button>')).toBe('CLICK');
        expect(vocabulary.sanitize_rich_full('<section>chunk</section>')).toBe('chunk');
        expect(vocabulary.sanitize_rich_full('<table><tr><td>cell</td></tr></table>')).toBe('cell');
        /* headings are the exception — they are remapped, not stripped */
        expect(vocabulary.sanitize_rich_full('<h1>big</h1>')).toBe('<h2>big</h2>');
    });

    /*
     * Quill remaps these at the clipboard boundary, so this covers the paths
     * that never touch an editor — imports and direct API writes. Without it
     * an h1 arriving that way is flattened to plain text.
     */
    test('remaps out-of-vocabulary headings instead of flattening them', () => {
        expect(vocabulary.sanitize_rich_full('<h1>Section</h1><p>body</p>'))
            .toBe('<h2>Section</h2><p>body</p>');
        expect(vocabulary.sanitize_rich_full('<h4>A</h4><h5>B</h5><h6>C</h6>'))
            .toBe('<h3>A</h3><h3>B</h3><h3>C</h3>');
        expect(vocabulary.sanitize_rich_full('<h2>Two</h2><h3>Three</h3>'))
            .toBe('<h2>Two</h2><h3>Three</h3>');
        expect(vocabulary.sanitize_rich_full('<div><h1>Inside a div</h1></div>'))
            .toBe('<h2>Inside a div</h2>');
    });

    test('remapped headings keep their content and still lose bad attributes', () => {
        expect(vocabulary.sanitize_rich_full('<h1>Text with <strong>bold</strong></h1>'))
            .toBe('<h2>Text with <strong>bold</strong></h2>');
        expect(vocabulary.sanitize_rich_full('<h1 class="ql-indent-2 junk" style="color: #8B2332">S</h1>'))
            .toBe('<h2 class="ql-indent-2" style="color: #8b2332">S</h2>');
        expect(vocabulary.sanitize_rich_full('<h1 style="font-size: 40px" onclick="evil()">B</h1>'))
            .toBe('<h2>B</h2>');
    });

    test('reduced and plain still flatten every heading level', () => {
        expect(vocabulary.sanitize_rich_reduced('<h1>x</h1><h4>y</h4>')).toBe('x y');
        expect(vocabulary.sanitize_plain('<h1>x</h1><h4>y</h4>')).toBe('x y');
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

    /*
     * Pressing Enter in a reduced editor, or pasting multi-line text into
     * one, produces block markup the profile has to flatten — the words on
     * either side of the boundary must not be joined.
     */
    test('flattens block boundaries to a single space', () => {
        expect(vocabulary.sanitize_rich_reduced('<p>First line</p><p>Second line</p>'))
            .toBe('First line Second line');
        expect(vocabulary.sanitize_rich_reduced('<ol><li>one</li><li>two</li></ol>'))
            .toBe('one two');
        expect(vocabulary.sanitize_rich_reduced('<div>a</div><div>b</div><div>c</div>'))
            .toBe('a b c');
        expect(vocabulary.sanitize_rich_reduced('<p><strong>Bold</strong></p><p>plain</p>'))
            .toBe('<strong>Bold</strong> plain');
    });

    test('does not introduce padding around already-flat content', () => {
        expect(vocabulary.sanitize_rich_reduced('<p>Only one line</p>')).toBe('Only one line');
        expect(vocabulary.sanitize_rich_reduced('  spaced  out  ')).toBe('spaced out');
    });
});

describe('libs/rte_vocabulary — plain profile', () => {

    test('strips all markup, keeps text', () => {
        expect(vocabulary.sanitize_plain('<b>bold</b> text')).toBe('bold text');
        expect(vocabulary.sanitize_plain('plain')).toBe('plain');
    });

    test('flattens block boundaries to a single space', () => {
        expect(vocabulary.sanitize_plain('<p>First line</p><p>Second line</p>'))
            .toBe('First line Second line');
        expect(vocabulary.sanitize_plain('a<br>b')).toBe('a b');
        expect(vocabulary.sanitize_plain('<div>Portrait</div><div>1921</div>'))
            .toBe('Portrait 1921');
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
