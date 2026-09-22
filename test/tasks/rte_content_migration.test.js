'use strict';

/**
 * tools/migrate-rte-content.js — the entity-decode pre-pass.
 *
 * The migration reported "0 row(s) need migration" for content that was
 * demonstrably still escaped, and the dashboard rendered its literal `<p>`
 * tags (prod, 2026-09-22). Cause: decode_legacy_entities() bailed on ANY raw
 * `<` in the value. Legacy escape-era content that has since been saved
 * through an editor holds BOTH escaped and raw markup, so the decode was
 * skipped; the vocabulary gate is then a no-op on the escaped half, the row
 * never differs from what is stored, and nothing is reported.
 *
 * These pin both sides of the guard: the mixed value must be rescued, and a
 * correctly-encoded literal `&lt;` sitting inside real markup must NOT be
 * turned into a tag.
 */

const {
    decode_legacy_entities,
    transform,
    ESCAPED_TAG_REGEX,
} = require('../../tools/migrate-rte-content');

describe('ESCAPED_TAG_REGEX — escaped tag vs encoded literal', () => {

    test.each([
        ['&lt;p&gt;text&lt;/p&gt;', 'paragraph'],
        ['&lt;/p&gt;', 'closing tag'],
        ['&lt;a href="https://du.edu"&gt;DU&lt;/a&gt;', 'tag with attributes'],
        ['&lt;br /&gt;', 'self-closing'],
        ['&lt;BR&gt;', 'uppercase'],
        ['&lt;strong&gt;x&lt;/strong&gt;', 'multi-char name'],
        ['&lt;h1&gt;x&lt;/h1&gt;', 'legacy structural tag'],
    ])('matches %j (%s)', (value) => {
        expect(ESCAPED_TAG_REGEX.test(value)).toBe(true);
    });

    test.each([
        ['a &lt; b', 'literal less-than with spaces'],
        ['Width &lt; 3 inches', 'literal in prose'],
        ['5 &lt; 10 and 10 &gt; 5', 'literal comparison pair'],
        ['&lt;paragraph&gt;', 'unknown tag name'],
        ['&amp;lt;p&amp;gt;', 'double-encoded, not an escaped tag'],
        ['plain prose, no entities', 'nothing to decode'],
    ])('does not match %j (%s)', (value) => {
        expect(ESCAPED_TAG_REGEX.test(value)).toBe(false);
    });
});

describe('decode_legacy_entities — the guard', () => {

    test('decodes a purely escaped legacy value', () => {
        expect(decode_legacy_entities('&lt;p&gt;In 1933&lt;/p&gt;', 'full'))
            .toBe('<p>In 1933</p>');
    });

    /* the regression: this is what shipped to prod still escaped */
    test('decodes a value holding BOTH escaped legacy and raw markup', () => {
        const stored = '&lt;p&gt;In 1933&lt;/p&gt;<p>See <a href="https://du.edu">DU</a></p>';

        expect(decode_legacy_entities(stored, 'full'))
            .toBe('<p>In 1933</p><p>See <a href="https://du.edu">DU</a></p>');
    });

    test('leaves an already-migrated value untouched', () => {
        const migrated = '<p>In 1933</p><p>The historic documents</p>';

        expect(decode_legacy_entities(migrated, 'full')).toBe(migrated);
    });

    /*
     * The reason the raw-markup bail exists at all: inside real markup, a
     * `&lt;` is the CORRECT encoding of a literal less-than. Decoding it
     * would fabricate a tag out of prose.
     */
    test('does not decode an encoded literal inside raw markup', () => {
        const value = '<p>Sheet music, a &lt; b, 1943</p>';

        expect(decode_legacy_entities(value, 'full')).toBe(value);
    });

    test('is idempotent — a second pass changes nothing', () => {
        const stored = '&lt;p&gt;In 1933&lt;/p&gt;<p>raw</p>';
        const once = decode_legacy_entities(stored, 'full');

        expect(decode_legacy_entities(once, 'full')).toBe(once);
    });

    /*
     * `&amp;` decodes only alongside escaped tags for full/reduced (so the
     * gate's own encoding is not fought), but always for plain.
     */
    test('full profile leaves a bare &amp; alone when there is no escaped tag', () => {
        expect(decode_legacy_entities('<p>Ira M. &amp; Peryle Beck</p>', 'full'))
            .toBe('<p>Ira M. &amp; Peryle Beck</p>');
    });

    test('plain profile still resolves attribute entities', () => {
        expect(decode_legacy_entities('Dr. Max Lowenstein&#x27;s papers', 'plain'))
            .toBe('Dr. Max Lowenstein\'s papers');
    });
});

describe('transform — end to end through the vocabulary gate', () => {

    /*
     * The migration flags a row when transform() differs from what is
     * stored. Before the guard fix the mixed value came back byte-identical,
     * which is why the run printed "0 row(s) need migration".
     */
    test('flags a mixed escaped/raw value for migration', () => {
        const stored = '&lt;p&gt;In 1933, the year&lt;/p&gt;<p>See <a href="https://du.edu">DU</a></p>';
        const migrated = transform(stored, 'full');

        expect(migrated).not.toBe(stored);
        expect(migrated).not.toMatch(/&lt;p&gt;/);
        expect(migrated).toContain('<p>In 1933, the year</p>');
        expect(migrated).toContain('href="https://du.edu"');
    });

    test('flags a purely escaped value for migration', () => {
        const stored = '&lt;p&gt;In 1933&lt;/p&gt;';

        expect(transform(stored, 'full')).toBe('<p>In 1933</p>');
    });

    test('leaves already-migrated content byte-identical (no needless write)', () => {
        const migrated = '<p>In 1933</p>';

        expect(transform(migrated, 'full')).toBe(migrated);
    });

    test('running the migration twice is a fixed point', () => {
        const stored = '&lt;p&gt;In 1933&lt;/p&gt;<p>raw</p>';
        const once = transform(stored, 'full');

        expect(transform(once, 'full')).toBe(once);
    });
});
