/**
 * Exhibits v1 → v2 Styles Migration (standalone)
 *
 * Converts legacy inline-CSS style JSON across exhibit children into a small
 * set of preset slots stored on the parent exhibit, and replaces each child's
 * `styles` column with a string reference to a preset slot.
 *
 * Runs standalone from migrate_v1_to_v2.js, reusing the same .env database
 * configuration (V2_DB_* variables). This script only reads and writes the v2
 * database — v1 is not consulted. All source data is already in v2 (copied by
 * the main migration's Phase 2–4) and this script consolidates the style
 * representation in-place.
 *
 * What it does (all operations on v2 DB):
 *
 *   Sub-phase A — Exhibit-level styles
 *     For each tbl_exhibits row whose `styles` JSON has an `exhibit` key,
 *     preserve `introduction` / `navigation` / `template` sections (filling in
 *     the empty shape for any missing section) and seed empty `heading1..3`
 *     and `item1..3` slots. Rows already in v2 shape (carrying `heading1` or
 *     `item1`) are skipped. NULL/empty rows are skipped.
 *
 *   Sub-phase B — Item pool → item1/item2/item3
 *     Pool inline-CSS styles across tbl_standard_items + tbl_grids +
 *     tbl_timelines per exhibit. Deduplicate by a normalized canonical JSON
 *     (lowercased hex, trimmed, sorted keys). Rank by frequency (most-used
 *     first), assigning the top styles to the three item slots. Each child
 *     row's `styles` column is rewritten to the string "item1" / "item2" /
 *     "item3". Children whose style isn't in the top 3 are mapped to the
 *     closest remaining slot by shared-key overlap and logged as an overflow
 *     event on the report.
 *
 *   Sub-phase C — Heading pool → heading1/heading2/heading3
 *     Same pattern as B, but pools tbl_heading_items only, and writes into
 *     the heading slots.
 *
 *   Sub-phase D — Clear inherited-style tables
 *     tbl_grid_items and tbl_timeline_items will inherit styling from their
 *     parent grid or timeline in v2, so their `styles` column is set to NULL
 *     wholesale. Skips rows already NULL.
 *
 *   Final — Migration report
 *     A JSON report is written to the script directory as
 *     styles_migration_report_<timestamp>.json listing per-exhibit
 *     conversions, slot assignments, overflow events, and errors.
 *
 * Usage:
 *   1. Ensure .env contains V2_DB_* values (same as migrate_v1_to_v2.js).
 *   2. Dry-run first: DRY_RUN=true node migrate_styles_v1_to_v2.js
 *      Review the generated report and the console log.
 *   3. Execute: DRY_RUN=false node migrate_styles_v1_to_v2.js
 *
 * Safety:
 *   - DRY_RUN mode performs all reads and slot-assignment logic but writes
 *     nothing to the database. Report output is identical in both modes.
 *   - Each exhibit's updates (exhibit row + all affected children) run inside
 *     a knex transaction, so a mid-exhibit failure rolls back that exhibit
 *     without leaving it half-converted.
 *   - The script is idempotent for exhibits already in v2 shape: Sub-phase A
 *     skips them, and Sub-phase B/C skip child rows whose `styles` is already
 *     a "itemN" / "headingN" reference.
 */

'use strict';

require('dotenv').config();
const knex = require('knex');
const fsp = require('fs').promises;
const path = require('path');

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true';

const v2_db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.V2_DB_HOST || '127.0.0.1',
        port: process.env.V2_DB_PORT || 3306,
        user: process.env.V2_DB_USER || 'root',
        password: process.env.V2_DB_PASSWORD || '',
        database: process.env.V2_DB_NAME || 'exhibits_v2'
    }
});

// ─────────────────────────────────────────────
// STYLE HELPERS (shared with main migration)
// ─────────────────────────────────────────────

const EMPTY_STYLE_SECTION = {
    backgroundColor: '',
    color: '',
    fontSize: '',
    fontFamily: ''
};

/**
 * Normalizes a style value object for deduplication.
 * Lowercases hex colors, trims whitespace from all string values, sorts keys.
 * Returns a canonical JSON string for comparison.
 */
function normalize_style(style_obj) {

    if (!style_obj || typeof style_obj !== 'object') {
        return '{}';
    }

    const normalized = {};

    for (const [key, val] of Object.entries(style_obj)) {

        if (typeof val === 'string') {
            let trimmed = val.trim();

            if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
                trimmed = trimmed.toLowerCase();
            }

            normalized[key] = trimmed;
        } else {
            normalized[key] = val;
        }
    }

    const sorted = {};

    for (const key of Object.keys(normalized).sort()) {
        sorted[key] = normalized[key];
    }

    return JSON.stringify(sorted);
}

/**
 * Checks whether a style object has at least one non-empty property value.
 */
function has_style_values(style_obj) {

    if (!style_obj || typeof style_obj !== 'object') {
        return false;
    }

    return Object.values(style_obj).some(v => v !== undefined && v !== null && v !== '');
}

/**
 * Safely parses a JSON string, returning null on failure.
 */
function safe_json_parse(str) {

    if (!str || typeof str !== 'string') {
        return null;
    }

    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

/**
 * Classifies a child row's `styles` value as inline CSS, key reference,
 * or empty.
 */
function classify_style_value(styles_value) {

    if (!styles_value || styles_value === '{}' || styles_value === 'null') {
        return 'empty';
    }

    if (typeof styles_value === 'string') {
        const trimmed = styles_value.trim();

        if (/^(item|heading)\d+$/.test(trimmed)) {
            return 'key_ref';
        }

        if (trimmed.startsWith('{')) {
            const parsed = safe_json_parse(trimmed);

            if (parsed && has_style_values(parsed)) {
                return 'inline_css';
            }

            return 'empty';
        }
    }

    return 'empty';
}

/**
 * Counts the number of keys two normalized style objects share
 * with identical non-empty values. Used as an overflow tiebreaker when
 * mapping a dropped style to its closest remaining slot.
 */
function style_similarity(normalized_a_json, normalized_b_json) {

    const a = safe_json_parse(normalized_a_json);
    const b = safe_json_parse(normalized_b_json);

    if (!a || !b) return 0;

    let score = 0;

    for (const key of Object.keys(a)) {
        if (a[key] && a[key] === b[key]) {
            score++;
        }
    }

    return score;
}

// ─────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────

const report = {
    started_at: null,
    completed_at: null,
    dry_run: DRY_RUN,

    sub_phase_a: {
        exhibits_converted: 0,
        exhibits_skipped_v2: 0,
        exhibits_skipped_null: 0,
        errors: []
    },
    sub_phase_b: {
        exhibits_processed: 0,
        items_updated: 0,
        overflow_events: [],
        errors: []
    },
    sub_phase_c: {
        exhibits_processed: 0,
        headings_updated: 0,
        overflow_events: [],
        errors: []
    },
    sub_phase_d: {
        grid_items_cleared: 0,
        timeline_items_cleared: 0,
        errors: []
    }
};

// ─────────────────────────────────────────────
// SUB-PHASE A: Exhibit-level styles
// ─────────────────────────────────────────────

/**
 * Converts each exhibit's `styles` JSON from v1 shape (`{exhibit:{navigation,
 * template, introduction}}`) into v2 shape, adding empty heading1..3 and
 * item1..3 slots. Idempotent: exhibits already in v2 shape are skipped.
 *
 * Sub-phases B and C read back these slots and fill them in.
 */
async function sub_phase_a_exhibit_styles() {

    console.log('\n══════════════════════════════════════════');
    console.log('SUB-PHASE A: Exhibit-level styles (v1 → v2 shape)');
    console.log('══════════════════════════════════════════');

    const exhibits = await v2_db('tbl_exhibits')
        .select('id', 'uuid', 'title', 'styles')
        .where('is_deleted', 0);

    console.log(`  Found ${exhibits.length} active exhibits`);

    for (const exhibit of exhibits) {

        const parsed = safe_json_parse(exhibit.styles);

        if (!parsed || !parsed.exhibit) {
            console.log(`  [SKIP] id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}... — NULL/empty styles`);
            report.sub_phase_a.exhibits_skipped_null++;
            continue;
        }

        const exhibit_section = parsed.exhibit;
        const keys = new Set(Object.keys(exhibit_section));

        // Already in v2 shape?
        if (keys.has('heading1') || keys.has('item1')) {
            console.log(`  [SKIP] id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}... — already v2 shape`);
            report.sub_phase_a.exhibits_skipped_v2++;
            continue;
        }

        // Build v2 styles: keep v1 exhibit-level sections, seed new slot keys empty.
        const v2_styles = {
            exhibit: {
                introduction: exhibit_section.introduction || { ...EMPTY_STYLE_SECTION },
                navigation:   exhibit_section.navigation   || { ...EMPTY_STYLE_SECTION },
                template:     exhibit_section.template     || { ...EMPTY_STYLE_SECTION },
                heading1: { ...EMPTY_STYLE_SECTION },
                heading2: { ...EMPTY_STYLE_SECTION },
                heading3: { ...EMPTY_STYLE_SECTION },
                item1:    { ...EMPTY_STYLE_SECTION },
                item2:    { ...EMPTY_STYLE_SECTION },
                item3:    { ...EMPTY_STYLE_SECTION }
            }
        };

        console.log(`  [CONVERT] id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}...`);
        console.log(`    v1 keys: ${Array.from(keys).join(', ')}`);

        if (!DRY_RUN) {
            try {
                await v2_db('tbl_exhibits')
                    .where('id', exhibit.id)
                    .update({ styles: JSON.stringify(v2_styles) });

                console.log(`    ✓ Updated`);
            } catch (err) {
                console.error(`    ✗ Error: ${err.message}`);
                report.sub_phase_a.errors.push(`Exhibit ${exhibit.uuid}: ${err.message}`);
                continue;
            }
        } else {
            console.log(`    [DRY RUN] Would update`);
        }

        report.sub_phase_a.exhibits_converted++;
    }

    console.log(`  A complete: ${report.sub_phase_a.exhibits_converted} converted, ` +
        `${report.sub_phase_a.exhibits_skipped_v2} already v2, ` +
        `${report.sub_phase_a.exhibits_skipped_null} null/empty`);
}

// ─────────────────────────────────────────────
// SUB-PHASE B / C: Preset backfill from inline CSS
// ─────────────────────────────────────────────

/**
 * Shared implementation for backfilling preset slots from inline CSS.
 * Used by both the item pool (Sub-phase B) and the heading pool (Sub-phase C).
 *
 * For each exhibit:
 *   1. Collect every child row with inline-CSS styles from the given tables
 *      (rows with 'key_ref' or 'empty' styles are skipped).
 *   2. Dedupe styles by normalized canonical JSON and count occurrences.
 *   3. Rank distinct styles by frequency (desc), first-seen order as tiebreaker.
 *   4. Match any already-populated slots on the exhibit to existing styles.
 *   5. Fill remaining slots with the top-ranked unassigned styles.
 *   6. Any styles that didn't win a slot are mapped to the most similar
 *      assigned slot (by shared-key overlap) and logged as an overflow event.
 *   7. Update the exhibit row's styles JSON, then update each child row's
 *      `styles` column to the string slot name ("item1", "heading2", etc).
 *
 * All writes for a single exhibit happen inside one transaction so a mid-
 * exhibit failure doesn't leave that exhibit in a partial state.
 *
 * @param {object} opts
 * @param {string[]} opts.tables - v2 table names to pool styles from
 * @param {string[]} opts.slot_names - e.g. ['item1','item2','item3']
 * @param {string} opts.label - human-readable label for logs
 * @param {object} opts.report_bucket - report.sub_phase_b or report.sub_phase_c
 * @param {string} opts.counter_key - 'items_updated' or 'headings_updated'
 * @param {string} opts.affected_key - 'affected_items' or 'affected_headings'
 */
async function backfill_preset_slots(opts) {

    const { tables, slot_names, label, report_bucket, counter_key, affected_key } = opts;

    const exhibits = await v2_db('tbl_exhibits')
        .select('id', 'uuid', 'styles')
        .where('is_deleted', 0);

    for (const exhibit of exhibits) {

        // ── Collect inline-CSS rows across the pooled tables ──

        const style_count = new Map();    // normalized → occurrence count
        const style_original = new Map(); // normalized → first parsed object seen
        const child_rows = [];            // { table, id, uuid, normalized }

        for (const table of tables) {
            const rows = await v2_db(table)
                .select('id', 'uuid', 'styles')
                .where('is_member_of_exhibit', exhibit.uuid)
                .where('is_deleted', 0);

            for (const row of rows) {
                const classification = classify_style_value(row.styles);

                if (classification === 'key_ref') {
                    // Already converted on a prior run — skip.
                    continue;
                }

                if (classification === 'inline_css') {
                    const parsed = safe_json_parse(row.styles);
                    const normalized = normalize_style(parsed);

                    if (!style_original.has(normalized)) {
                        style_original.set(normalized, parsed);
                    }

                    style_count.set(normalized, (style_count.get(normalized) || 0) + 1);

                    child_rows.push({
                        table,
                        id: row.id,
                        uuid: row.uuid,
                        normalized
                    });
                }
            }
        }

        if (child_rows.length === 0) {
            continue;
        }

        console.log(`  Exhibit id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}...`);
        console.log(`    ${child_rows.length} ${label} with inline CSS, ${style_count.size} distinct styles`);

        // ── Parse exhibit styles; must be v2 shape from Sub-phase A ──

        const exhibit_styles = safe_json_parse(exhibit.styles);

        if (!exhibit_styles || !exhibit_styles.exhibit) {
            console.log(`    ⚠ Exhibit has no parseable styles — skipping backfill`);
            report_bucket.errors.push(`Exhibit ${exhibit.uuid}: no parseable styles at ${label} backfill time`);
            continue;
        }

        const exhibit_section = exhibit_styles.exhibit;

        // ── Match distinct styles to slots ──
        //
        // Strategy:
        //   1. If a slot is already populated, try to match an incoming style
        //      against it first (by normalized equality).
        //   2. Rank remaining unmatched styles by frequency (desc).
        //   3. Fill remaining empty slots in rank order.
        //   4. Any styles that still don't have a slot are overflow: map each
        //      to the assigned slot whose style shares the most keys with it.

        const assignments = new Map(); // normalized → slot_name

        // Step 1: match existing populated slots.
        for (const [normalized] of style_count) {
            for (const slot of slot_names) {
                const slot_value = exhibit_section[slot];
                if (slot_value && has_style_values(slot_value)) {
                    if (normalize_style(slot_value) === normalized) {
                        assignments.set(normalized, slot);
                        break;
                    }
                }
            }
        }

        // Step 2: rank unmatched by frequency (desc), insertion order tiebreak.
        const unmatched_ranked = Array.from(style_count.entries())
            .filter(([normalized]) => !assignments.has(normalized))
            .sort((a, b) => b[1] - a[1]);

        // Step 3: fill empty slots in rank order.
        const empty_slots = slot_names.filter(
            slot => !has_style_values(exhibit_section[slot])
        );

        let overflow_entries = []; // [{normalized, count, mapped_to}]

        for (let i = 0; i < unmatched_ranked.length; i++) {
            const [normalized, count] = unmatched_ranked[i];

            if (i < empty_slots.length) {
                const slot = empty_slots[i];
                exhibit_section[slot] = style_original.get(normalized);
                assignments.set(normalized, slot);
                console.log(`    Assigned to ${slot} (${count}x): ${normalized}`);
            } else {
                // Overflow — will be mapped to closest assigned slot in step 4.
                overflow_entries.push({ normalized, count });
            }
        }

        // Step 4: map overflow styles to most similar assigned slot.
        if (overflow_entries.length > 0) {
            const assigned_normalized = Array.from(assignments.keys());

            for (const entry of overflow_entries) {
                let best_slot = null;
                let best_score = -1;

                for (const norm of assigned_normalized) {
                    const score = style_similarity(entry.normalized, norm);
                    if (score > best_score) {
                        best_score = score;
                        best_slot = assignments.get(norm);
                    }
                }

                // Fallback (should be unreachable if any slot was assigned).
                if (!best_slot) best_slot = slot_names[0];

                assignments.set(entry.normalized, best_slot);
                entry.mapped_to = best_slot;

                console.log(`    ⚠ OVERFLOW (${entry.count}x) → mapped to ${best_slot}: ${entry.normalized}`);
            }

            report_bucket.overflow_events.push({
                exhibit_id: exhibit.id,
                exhibit_uuid: exhibit.uuid,
                distinct_styles: style_count.size,
                slot_capacity: slot_names.length,
                [affected_key]: child_rows.length,
                dropped_styles: overflow_entries.map(e => ({
                    normalized: e.normalized,
                    original: style_original.get(e.normalized),
                    occurrence_count: e.count,
                    mapped_to: e.mapped_to
                }))
            });
        }

        // ── Write: exhibit styles + each child's styles reference ──
        // All writes for one exhibit run in a single transaction so the
        // exhibit-level slots and the child refs stay consistent.

        if (!DRY_RUN) {
            try {
                await v2_db.transaction(async trx => {
                    await trx('tbl_exhibits')
                        .where('id', exhibit.id)
                        .update({ styles: JSON.stringify(exhibit_styles) });

                    for (const row of child_rows) {
                        const target_slot = assignments.get(row.normalized);

                        if (!target_slot) {
                            // Should not happen — every normalized key ended
                            // up in `assignments` via step 3 or 4.
                            throw new Error(
                                `No slot assignment for ${row.table} id=${row.id} normalized=${row.normalized}`
                            );
                        }

                        await trx(row.table)
                            .where('id', row.id)
                            .update({ styles: target_slot });
                    }
                });

                report_bucket[counter_key] += child_rows.length;
                report_bucket.exhibits_processed++;
                console.log(`    ✓ Updated ${child_rows.length} ${label}`);

            } catch (err) {
                console.error(`    ✗ Transaction failed: ${err.message}`);
                report_bucket.errors.push(`Exhibit ${exhibit.uuid} ${label} backfill: ${err.message}`);
                continue;
            }
        } else {
            report_bucket[counter_key] += child_rows.length;
            report_bucket.exhibits_processed++;
            console.log(`    [DRY RUN] Would update ${child_rows.length} ${label}`);
        }
    }
}

/**
 * Sub-phase B: pool inline-CSS from tbl_standard_items, tbl_grids, and
 * tbl_timelines per exhibit and assign to item1/item2/item3 slots.
 * Per spec, grids and timelines inherit item-pool styling in v2.
 */
async function sub_phase_b_item_pool() {

    console.log('\n══════════════════════════════════════════');
    console.log('SUB-PHASE B: Item pool → item1/item2/item3');
    console.log('══════════════════════════════════════════');

    await backfill_preset_slots({
        tables: ['tbl_standard_items', 'tbl_grids', 'tbl_timelines'],
        slot_names: ['item1', 'item2', 'item3'],
        label: 'items',
        report_bucket: report.sub_phase_b,
        counter_key: 'items_updated',
        affected_key: 'affected_items'
    });

    console.log(`  B complete: ${report.sub_phase_b.exhibits_processed} exhibits, ` +
        `${report.sub_phase_b.items_updated} items updated, ` +
        `${report.sub_phase_b.overflow_events.length} overflow events`);
}

/**
 * Sub-phase C: pool inline-CSS from tbl_heading_items per exhibit and
 * assign to heading1/heading2/heading3 slots.
 */
async function sub_phase_c_heading_pool() {

    console.log('\n══════════════════════════════════════════');
    console.log('SUB-PHASE C: Heading pool → heading1/heading2/heading3');
    console.log('══════════════════════════════════════════');

    await backfill_preset_slots({
        tables: ['tbl_heading_items'],
        slot_names: ['heading1', 'heading2', 'heading3'],
        label: 'headings',
        report_bucket: report.sub_phase_c,
        counter_key: 'headings_updated',
        affected_key: 'affected_headings'
    });

    console.log(`  C complete: ${report.sub_phase_c.exhibits_processed} exhibits, ` +
        `${report.sub_phase_c.headings_updated} headings updated, ` +
        `${report.sub_phase_c.overflow_events.length} overflow events`);
}

// ─────────────────────────────────────────────
// SUB-PHASE D: Clear tbl_grid_items and tbl_timeline_items styles
// ─────────────────────────────────────────────

/**
 * Grid items and timeline items inherit styling from their parent grid or
 * timeline in v2, so their `styles` column is no longer meaningful. Clear
 * any non-NULL values to NULL wholesale. This runs after B/C so the overflow
 * logic has already seen all the inline CSS it needs.
 *
 * Note: grid items and timeline items were intentionally not pooled into
 * Sub-phase B. Their styles are dead data in v2 regardless of content.
 */
async function sub_phase_d_clear_child_styles() {

    console.log('\n══════════════════════════════════════════');
    console.log('SUB-PHASE D: Clear grid_items / timeline_items styles');
    console.log('══════════════════════════════════════════');

    const targets = [
        { table: 'tbl_grid_items',     counter: 'grid_items_cleared' },
        { table: 'tbl_timeline_items', counter: 'timeline_items_cleared' }
    ];

    for (const { table, counter } of targets) {

        const rows_with_styles = await v2_db(table)
            .select('id', 'uuid', 'styles')
            .whereNotNull('styles');

        // Only count rows where styles is actually non-empty (excludes '{}',
        // 'null', whitespace). An empty string still counts as "non-null" for
        // whereNotNull, so we filter explicitly.
        const to_clear = rows_with_styles.filter(r => {
            if (r.styles === null || r.styles === undefined) return false;
            const trimmed = String(r.styles).trim();
            return trimmed.length > 0;
        });

        console.log(`  ${table}: ${to_clear.length} rows with non-null styles`);

        if (to_clear.length === 0) continue;

        if (!DRY_RUN) {
            try {
                // Batched update for efficiency; one statement clears all.
                const ids = to_clear.map(r => r.id);
                await v2_db(table)
                    .whereIn('id', ids)
                    .update({ styles: null });

                report.sub_phase_d[counter] = to_clear.length;
                console.log(`    ✓ Cleared ${to_clear.length} rows`);
            } catch (err) {
                console.error(`    ✗ Error clearing ${table}: ${err.message}`);
                report.sub_phase_d.errors.push(`${table} clear: ${err.message}`);
            }
        } else {
            report.sub_phase_d[counter] = to_clear.length;
            console.log(`    [DRY RUN] Would clear ${to_clear.length} rows`);
        }
    }
}

// ─────────────────────────────────────────────
// FINAL REPORT
// ─────────────────────────────────────────────

async function generate_report() {

    report.completed_at = new Date().toISOString();

    console.log('\n══════════════════════════════════════════════════════');
    console.log('STYLES MIGRATION REPORT');
    console.log('══════════════════════════════════════════════════════');
    console.log(`Mode:      ${DRY_RUN ? 'DRY RUN (no changes written)' : 'LIVE'}`);
    console.log(`Started:   ${report.started_at}`);
    console.log(`Completed: ${report.completed_at}`);

    console.log('\n── Sub-phase A (exhibit-level shape) ──');
    console.log(`Converted to v2 shape:   ${report.sub_phase_a.exhibits_converted}`);
    console.log(`Already v2 (skipped):    ${report.sub_phase_a.exhibits_skipped_v2}`);
    console.log(`NULL/empty (skipped):    ${report.sub_phase_a.exhibits_skipped_null}`);

    console.log('\n── Sub-phase B (item pool → item1/2/3) ──');
    console.log(`Exhibits processed:      ${report.sub_phase_b.exhibits_processed}`);
    console.log(`Items updated to refs:   ${report.sub_phase_b.items_updated}`);
    console.log(`Overflow events:         ${report.sub_phase_b.overflow_events.length}`);
    if (report.sub_phase_b.overflow_events.length > 0) {
        for (const ev of report.sub_phase_b.overflow_events) {
            console.log(`  • Exhibit ${ev.exhibit_uuid.substring(0, 12)}... — ${ev.distinct_styles} distinct, dropped ${ev.dropped_styles.length}`);
            for (const ds of ev.dropped_styles) {
                console.log(`      dropped (${ds.occurrence_count}x) → mapped to ${ds.mapped_to}: ${ds.normalized}`);
            }
        }
    }

    console.log('\n── Sub-phase C (heading pool → heading1/2/3) ──');
    console.log(`Exhibits processed:      ${report.sub_phase_c.exhibits_processed}`);
    console.log(`Headings updated:        ${report.sub_phase_c.headings_updated}`);
    console.log(`Overflow events:         ${report.sub_phase_c.overflow_events.length}`);
    if (report.sub_phase_c.overflow_events.length > 0) {
        for (const ev of report.sub_phase_c.overflow_events) {
            console.log(`  • Exhibit ${ev.exhibit_uuid.substring(0, 12)}... — ${ev.distinct_styles} distinct, dropped ${ev.dropped_styles.length}`);
            for (const ds of ev.dropped_styles) {
                console.log(`      dropped (${ds.occurrence_count}x) → mapped to ${ds.mapped_to}: ${ds.normalized}`);
            }
        }
    }

    console.log('\n── Sub-phase D (clear inherited-style tables) ──');
    console.log(`Grid items cleared:      ${report.sub_phase_d.grid_items_cleared}`);
    console.log(`Timeline items cleared:  ${report.sub_phase_d.timeline_items_cleared}`);

    const all_errors = [
        ...report.sub_phase_a.errors,
        ...report.sub_phase_b.errors,
        ...report.sub_phase_c.errors,
        ...report.sub_phase_d.errors
    ];

    console.log(`\n── Errors: ${all_errors.length} ──`);
    if (all_errors.length > 0) {
        for (const err of all_errors) {
            console.log(`  • ${err}`);
        }
    }

    const report_filename = `styles_migration_report_${Date.now()}.json`;
    const report_path = path.join(__dirname, report_filename);
    await fsp.writeFile(report_path, JSON.stringify(report, null, 2));
    console.log(`\nFull report written to: ${report_path}`);
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {

    report.started_at = new Date().toISOString();

    console.log('══════════════════════════════════════════════════════');
    console.log('Exhibits v1 → v2 Styles Migration (standalone)');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log('══════════════════════════════════════════════════════');

    try {
        await v2_db.raw('SELECT 1');
        console.log('v2 database connected.');

        await sub_phase_a_exhibit_styles();
        await sub_phase_b_item_pool();
        await sub_phase_c_heading_pool();
        await sub_phase_d_clear_child_styles();
        await generate_report();

    } catch (err) {
        console.error(`\nFATAL ERROR: ${err.message}`);
        console.error(err.stack);
    } finally {
        await v2_db.destroy();
        console.log('\nDatabase connection closed.');
    }
}

main();
