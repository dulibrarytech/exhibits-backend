#!/usr/bin/env node

'use strict';

/**
 * One-time migration: normalizes legacy staff-entered HTML into the rich
 * text editor vocabulary (libs/rte_vocabulary.js) so existing content
 * round-trips through the new Quill editors without loss or surprise.
 *
 * Structural pre-pass (before the vocabulary gate):
 *   - decodes legacy entity-escaped values (VALIDATOR.escape era)
 *   - h1 → h2; center/div → p; button → unwrapped text
 *   - snaps inline colors to the nearest DU palette color
 *   - converts bare newlines in tag-free values to <p>/<br> markup (FULL profile only)
 * Then each value runs through its field profile (full/reduced/plain), and a
 * whitespace tidy pass clears the blank runs and stranded spacer <br>s that
 * unwrapping legacy layout markup leaves behind.
 *
 * Dry run (default):  node tools/migrate-rte-content.js
 *                     (writes a diff report to tools/rte-migration-report.txt)
 * Apply:              node tools/migrate-rte-content.js --apply
 *
 * After applying, rebuild the Elasticsearch index so stored documents match
 * the database.
 */

require('dotenv').config();

const FS = require('fs');
const PATH = require('path');
const knex = require('knex');
const {JSDOM} = require('jsdom');
const RTE_VOCABULARY = require('../libs/rte_vocabulary');

const APPLY = process.argv.includes('--apply');
const REPORT_PATH = PATH.join(__dirname, 'rte-migration-report.txt');

const DB = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
});

/*
 * Field → profile per table. This is a PARTIAL mirror of the model-layer RTE
 * profile maps — six plain-profile fields the models sanitize are absent:
 * tbl_standard_items.alt_text, tbl_grid_items.alt_text,
 * tbl_timeline_items.alt_text, tbl_timeline_items.date,
 * tbl_grids.internal_name and tbl_timelines.internal_name.
 *
 * alt_text is included at the `plain` profile, which is a SANITIZER binding,
 * not an editor — the field has no RTE and must never get one, since it is
 * accessibility text rendered into an HTML attribute where markup cannot
 * work. It is here because 73 values carried VALIDATOR.escape-era entities
 * (&#x27;, &quot;) — no markup, just escaped apostrophes and quotes — and
 * nothing downstream decoded them: alt_text is absent from the frontend's
 * htmlFieldsExhibitItem list, and Svelte assigns the attribute with
 * setAttribute, which does not parse entities, so assistive tech read
 * "Dr. Max Lowenstein&#x27;s" verbatim. sanitize_plain returns textContent,
 * which resolves the entities at the source.
 *
 * Still absent, and harmless: tbl_grids.internal_name,
 * tbl_timelines.internal_name and tbl_timeline_items.date — all three scan
 * clean, so adding them would be a no-op today.
 */
const TARGETS = [
    {table: 'tbl_exhibits', key: 'id', fields: {title: 'reduced', subtitle: 'reduced', description: 'full', about_the_curators: 'full', alert_text: 'plain'}},
    {table: 'tbl_heading_items', key: 'id', fields: {text: 'reduced'}},
    {table: 'tbl_standard_items', key: 'id', fields: {text: 'full', description: 'full', caption: 'plain', alt_text: 'plain'}},
    {table: 'tbl_grid_items', key: 'id', fields: {title: 'reduced', text: 'full', description: 'full', caption: 'plain', alt_text: 'plain'}},
    {table: 'tbl_timeline_items', key: 'id', fields: {title: 'reduced', text: 'full', description: 'full', caption: 'plain', alt_text: 'plain'}},
    {table: 'tbl_grids', key: 'id', fields: {text: 'full'}},
    {table: 'tbl_timelines', key: 'id', fields: {text: 'full'}},
    {table: 'tbl_media_library', key: 'id', fields: {name: 'plain', description: 'full', alt_text: 'plain'}}
];

/* DU palette — keep in sync with libs/rte_vocabulary.js ALLOWED_COLORS */
const PALETTE = ['#181818', '#8b2332', '#3c7896', '#139aa1', '#6c757d'];

const PROFILE_FN = {
    full: RTE_VOCABULARY.sanitize_rich_full,
    reduced: RTE_VOCABULARY.sanitize_rich_reduced,
    plain: RTE_VOCABULARY.sanitize_plain
};

/*
 * Decodes the legacy VALIDATOR.escape entity set exactly once. Applied only
 * when the value contains no raw markup but does contain escaped markup, so
 * already-decoded values are never double-processed.
 *
 * `&amp;` is the one entity whose handling depends on the profile, because
 * the correct storage differs by destination:
 *
 *   full / reduced — the value is rendered as HTML, where `&amp;` IS the
 *     correct encoding of a literal ampersand, and the vocabulary gate emits
 *     exactly that. Decoding it on sight fights the gate and makes the
 *     migration non-idempotent (a second run un-escaped what the first had
 *     correctly escaped). So it is decoded only alongside `&lt;`/`&gt;`,
 *     which mark a genuinely escape-era value.
 *
 *   plain — the value is rendered into an HTML *attribute* (alt text, media
 *     names) via setAttribute, which does not parse entities, and nothing
 *     upstream decodes it either. A stored `&amp;` is therefore read out
 *     literally by assistive tech, so it must be resolved here. This stays
 *     idempotent: sanitize_plain neither decodes nor re-encodes a bare `&`,
 *     so the decoded form is a fixed point.
 *
 * The quote/apostrophe/slash entities never appear in gate output for text,
 * so they are always safe to decode.
 *
 * @param {string} value
 * @param {string} profile - full | reduced | plain
 */
function decode_legacy_entities(value, profile) {

    if (value.includes('<')) {
        return value;
    }

    const has_escaped_tags = /&(lt|gt);/i.test(value);
    const decode_ampersand = has_escaped_tags === true || profile === 'plain';

    const trigger = decode_ampersand === true
        ? /&(lt|gt|amp|quot|#x27|#x2F|#39);/i
        : /&(lt|gt|quot|#x27|#x2F|#39);/i;

    if (trigger.test(value) === false) {
        return value;
    }

    let decoded = value
        .replace(/&#x2F;/gi, '/')
        .replace(/&#x27;/g, '\'')
        .replace(/&#39;/g, '\'')
        .replace(/&quot;/g, '"');

    /* tags before the ampersand, so `&amp;lt;` never becomes `<` */
    if (has_escaped_tags === true) {
        decoded = decoded
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    }

    if (decode_ampersand === true) {
        decoded = decoded.replace(/&amp;/g, '&');
    }

    return decoded;
}

function hex_to_rgb(hex) {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    ];
}

function parse_css_color(value) {

    const color = value.trim().toLowerCase();

    if (/^#[0-9a-f]{6}$/.test(color)) {
        return hex_to_rgb(color);
    }

    if (/^#[0-9a-f]{3}$/.test(color)) {
        return hex_to_rgb('#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]);
    }

    const rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);

    if (rgb !== null) {
        return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    }

    return null;
}

/* snaps an arbitrary CSS color to the nearest DU palette hex */
function snap_to_palette(value) {

    const rgb = parse_css_color(value);

    if (rgb === null) {
        return null;
    }

    let best = PALETTE[0];
    let best_distance = Infinity;

    for (const candidate of PALETTE) {

        const c = hex_to_rgb(candidate);
        const distance = (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;

        if (distance < best_distance) {
            best_distance = distance;
            best = candidate;
        }
    }

    return best;
}

/*
 * Structural normalization on a DOM: legacy block/decoration constructs are
 * rewritten into vocabulary-expressible shapes so the sanitizer strips as
 * little content structure as possible.
 */
function normalize_structure(document) {

    /* h1 → h2 (public pages reserve h1 for the exhibit title) */
    document.querySelectorAll('h1').forEach((h1) => {
        const h2 = document.createElement('h2');
        h2.innerHTML = h1.innerHTML;
        if (h1.getAttribute('style') !== null) {
            h2.setAttribute('style', h1.getAttribute('style'));
        }
        h1.replaceWith(h2);
    });

    /* buttons become their text content (link-styled buttons keep the link wrapper) */
    document.querySelectorAll('button').forEach((button) => {
        button.replaceWith(document.createTextNode(button.textContent));
    });

    /* center and div become paragraphs so block boundaries survive the gate */
    document.querySelectorAll('center, div').forEach((block) => {

        /* skip wrappers that only contain other blocks — unwrap those instead */
        const has_block_children = block.querySelector('p, div, center, h2, h3, ul, ol') !== null;

        if (has_block_children) {
            block.replaceWith(...block.childNodes);
            return;
        }

        const p = document.createElement('p');
        p.innerHTML = block.innerHTML;
        block.replaceWith(p);
    });

    /* snap inline colors to the palette; other style declarations are dropped
       by the vocabulary gate. Anchors lose inline styles entirely — legacy
       button-styled links take the site-wide link styling instead. */
    document.querySelectorAll('[style]').forEach((node) => {

        if (node.tagName === 'A') {
            node.removeAttribute('style');
            return;
        }

        const match = node.getAttribute('style').match(/(?:^|;)\s*color:\s*([^;]+)/i);

        if (match === null) {
            return;
        }

        const snapped = snap_to_palette(match[1]);

        if (snapped !== null) {
            node.setAttribute('style', `color: ${snapped}`);
        } else {
            node.removeAttribute('style');
        }
    });
}

/*
 * Block elements in the editor vocabulary. Whitespace between two of these
 * is layout noise the browser collapses anyway; whitespace around inline
 * elements is a real word boundary and must survive.
 */
const BLOCK_ELEMENTS = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE']);

function is_block(node) {
    return node !== null && node.nodeType === 1 && BLOCK_ELEMENTS.has(node.tagName);
}

/*
 * True when a node sits at a block boundary — between block elements, or at
 * the start/end of its container. Whitespace and spacer <br>s in those
 * positions carry no meaning once the wrapper markup is gone.
 */
function at_block_boundary(node) {

    const before = node.previousSibling;
    const after = node.nextSibling;

    return (before === null || is_block(before)) && (after === null || is_block(after));
}

/*
 * Tidies the whitespace left behind when the vocabulary gate unwraps legacy
 * layout markup. Unwrapping <div class="container"><div class="row"> nesting
 * leaves the newlines and indentation that separated those tags as text
 * nodes, so a migrated value arrives full of blank runs, and legacy spacer
 * <br>s end up stranded between paragraphs.
 *
 * The whitespace pass is text-equivalent: HTML already collapses whitespace
 * and ignores it between blocks, and whitespace between inline elements is
 * preserved as a single space, so no word is lost or joined. The <br> and
 * empty-block passes go slightly further — a spacer <br> stranded between
 * paragraphs does render as vertical space, and removing it closes that gap.
 * That is the intent (Quill cannot produce such a spacer, so it could never
 * be re-authored), but it is a visible change, not a purely cosmetic one.
 */
function tidy_whitespace(html) {

    const dom = new JSDOM(`<body>${html}</body>`);
    const document = dom.window.document;

    /* whitespace-only text: drop at block boundaries, otherwise one space */
    const walker = document.createTreeWalker(document.body, dom.window.NodeFilter.SHOW_TEXT);
    const text_nodes = [];

    while (walker.nextNode() !== null) {
        text_nodes.push(walker.currentNode);
    }

    for (const node of text_nodes) {

        if (node.nodeValue.trim().length === 0) {

            if (at_block_boundary(node)) {
                node.remove();
            } else {
                node.nodeValue = ' ';
            }

            continue;
        }

        node.nodeValue = node.nodeValue.replace(/\s+/g, ' ');
    }

    /* legacy spacer <br> stranded between blocks */
    document.querySelectorAll('br').forEach((br) => {
        if (at_block_boundary(br)) {
            br.remove();
        }
    });

    /* blocks emptied out by the gate */
    document.querySelectorAll('p, h2, h3, li').forEach((block) => {
        if (block.textContent.trim().length === 0 && block.children.length === 0) {
            block.remove();
        }
    });

    return document.body.innerHTML.trim();
}

/* converts a tag-free multi-line value into <p>/<br> markup */
function newlines_to_markup(value) {

    const paragraphs = value.split(/\r?\n\s*\r?\n/);

    return paragraphs
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0)
        .map((paragraph) => {

            const escaped = paragraph
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\r?\n/g, '<br>');

            return `<p>${escaped}</p>`;
        })
        .join('');
}

/**
 * Full transformation pipeline for one value.
 *
 * Whitespace tidying rides along only with values the migration is already
 * rewriting, and only for the FULL profile — the reduced and plain gates
 * collapse whitespace themselves. Tidying every value instead would turn
 * ~470 otherwise-untouched rows into writes for a render-identical result.
 *
 * @param {string} value
 * @param {string} profile - full | reduced | plain
 * @returns {string}
 */
function transform(value, profile) {

    if (typeof value !== 'string' || value.trim().length === 0) {
        return value;
    }

    const migrated = migrate_value(value, profile);

    if (migrated === value || profile !== 'full') {
        return migrated;
    }

    return tidy_whitespace(migrated);
}

/* the migration pipeline proper, before whitespace tidying */
function migrate_value(value, profile) {

    let working = decode_legacy_entities(value, profile);

    if (profile === 'plain') {
        return RTE_VOCABULARY.sanitize_plain(working);
    }

    if (working.includes('<') === false) {

        /* tag-free prose: preserve line structure for the full profile */
        if (profile === 'full' && /\r?\n/.test(working.trim())) {
            working = newlines_to_markup(working);
        }

        return PROFILE_FN[profile](working).trim();
    }

    const dom = new JSDOM(`<body>${working}</body>`);
    normalize_structure(dom.window.document);
    working = dom.window.document.body.innerHTML;

    return PROFILE_FN[profile](working).trim();
}

(async () => {

    const report_lines = [];
    let total_changed = 0;
    let total_values = 0;

    for (const target of TARGETS) {

        const columns = Object.keys(target.fields);
        const rows = await DB(target.table).select([target.key, ...columns]);
        const updates = [];

        for (const row of rows) {

            const changed_fields = {};

            for (const column of columns) {

                const original = row[column];

                if (typeof original !== 'string' || original.trim().length === 0) {
                    continue;
                }

                total_values++;
                const migrated = transform(original, target.fields[column]);

                if (migrated !== original) {
                    changed_fields[column] = migrated;
                    total_changed++;
                    report_lines.push(
                        `--- ${target.table}.${column} ${target.key}=${row[target.key]}`,
                        `  BEFORE: ${JSON.stringify(original)}`,
                        `  AFTER:  ${JSON.stringify(migrated)}`
                    );
                }
            }

            if (Object.keys(changed_fields).length > 0) {
                updates.push({key: row[target.key], fields: changed_fields});
            }
        }

        console.log(`${target.table}: ${updates.length} row(s) need migration (${rows.length} scanned)`);

        if (APPLY) {
            for (const update of updates) {
                await DB(target.table).where(target.key, update.key).update(update.fields);
            }
        }
    }

    FS.writeFileSync(REPORT_PATH, report_lines.join('\n') + '\n');

    console.log(`\n${total_changed} of ${total_values} non-empty values ${APPLY ? 'migrated' : 'would change'} (report: ${REPORT_PATH})`);

    if (APPLY) {
        console.log('\nDone. Rebuild the Elasticsearch index so documents match the database.');
    } else {
        console.log('\nDry run only — re-run with --apply to write changes.');
    }

    await DB.destroy();
})();
