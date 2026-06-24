/**
 * Backfill Media Library Subjects
 *
 * Populates topics / genre_form / places columns on `tbl_media_library`
 * from two sources, in this order:
 *
 *   A) REPOSITORY IMPORTS
 *      For media records imported from the digital repository, subjects
 *      are fetched from the authoritative repository payload at:
 *        https://<REPOSITORY_SERVER>/repository/data/<REPO_UUID>?key=<API_KEY>
 *      Subjects live at `payload.display_record.subjects` as an array of
 *      entries, each with a nested `terms: [{ type, term }, ...]` array.
 *      Terms are bucketed by type:
 *        topical     → topics_subjects
 *        geographic  → places_subjects
 *        genre/form  → genre_form_subjects
 *
 *   B) NON-REPOSITORY RECORDS
 *      Reads pipe-delimited `item_subjects` values from v2 item tables
 *      and classifies each term using the layers below.
 *      Repository-imported media are skipped in this pass because they
 *      were already populated authoritatively in step A.
 *
 * Classification layers for non-repo terms (applied in order):
 *   1. Personal name detection  → SKIP (stays in item_subjects only)
 *   2. Narrative detection      → FLAG for manual review
 *   3. Exact vocabulary lookup  → genre_form / places / topics
 *   4. Geographic heuristic     → places
 *   5. Topical event heuristic  → topics
 *   6. Unresolved               → FLAG for manual review
 *
 * Personal names are intentionally left in `item_subjects` and are
 * NOT propagated to the media library subject columns.
 *
 * Usage:
 *   1. Copy .env.migration to .env and set V2_DB_* variables
 *   2. Set REPOSITORY_SERVER and REPOSITORY_API_KEY for repo imports
 *   3. Ensure vocabulary files are at the paths below (or set env vars)
 *   4. Set DRY_RUN=true for preview, DRY_RUN=false to execute
 *   5. node backfill_media_subjects.js
 *
 * Prerequisites:
 *   - npm install knex mysql2 dotenv
 *   - Node.js 18+ (uses the built-in global `fetch`)
 *   - v2 database accessible
 *   - Vocabulary files: genre_form_terms.txt, topics_terms.txt, places_terms.txt
 */

'use strict';

require('dotenv').config();

// ── TLS ──────────────────────────────────────────────────────────────
// The DU repository serves a cert chain that Node's bundled CA store
// cannot fully validate (UNABLE_TO_VERIFY_LEAF_SIGNATURE — typically a
// missing intermediate cert). Disable verification for this migration.
// A more principled alternative is to set NODE_EXTRA_CA_CERTS to a PEM
// bundle that includes the DU/InCommon intermediate, which preserves
// TLS verification. This flag is safe here because the script only
// talks to a single, known internal host.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const knex = require('knex');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true';

const VOCAB_DIR = process.env.VOCAB_DIR || path.join(__dirname, 'vocab');
const GENRE_FORM_FILE = process.env.GENRE_FORM_FILE || path.join(VOCAB_DIR, 'genre_form_terms.txt');
const TOPICS_FILE = process.env.TOPICS_FILE || path.join(VOCAB_DIR, 'topics_terms.txt');
const PLACES_FILE = process.env.PLACES_FILE || path.join(VOCAB_DIR, 'places_terms.txt');

// Repository API (for repository-imported media records)
const REPOSITORY_SERVER = process.env.REPOSITORY_SERVER || '';
const REPOSITORY_API_KEY = process.env.REPOSITORY_API_KEY || '';

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

// Item tables to scan (table name → parent key column)
const ITEM_TABLES = [
    { table: 'tbl_standard_items', label: 'standard' },
    { table: 'tbl_grid_items', label: 'grid' },
    { table: 'tbl_timeline_items', label: 'timeline' }
];

// ─────────────────────────────────────────────
// VOCABULARY LOADING
// ─────────────────────────────────────────────

/**
 * Load a vocabulary file into a Set (case-insensitive lookup).
 * Each line = one term. Blank lines and leading/trailing whitespace are ignored.
 * Returns { set: Set<lowercase_term>, map: Map<lowercase_term, original_term> }
 */
function load_vocabulary(file_path) {
    if (!fs.existsSync(file_path)) {
        console.warn(`  WARNING: Vocabulary file not found: ${file_path}`);
        return { set: new Set(), map: new Map() };
    }
    const lines = fs.readFileSync(file_path, 'utf-8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const set = new Set();
    const map = new Map();
    for (const term of lines) {
        const key = term.toLowerCase();
        set.add(key);
        map.set(key, term);
    }
    return { set, map };
}

// ─────────────────────────────────────────────
// CLASSIFICATION HELPERS
// ─────────────────────────────────────────────

/**
 * Detect personal name pattern:
 *   "Last, First"
 *   "Last, First, YYYY-YYYY"
 *   "Last, First Middle, YYYY-YYYY"
 *   "Last, First, YYYY-"
 *
 * Key indicator: a comma followed by what looks like a first name
 * (capitalized word), optionally followed by life dates.
 */
const PERSONAL_NAME_RE = /^[A-Z][a-zÀ-ÿ]+,\s+[A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]*\.?)*(?:,\s*\d{4}-?\d{0,4})?$/;

function is_personal_name(term) {
    return PERSONAL_NAME_RE.test(term);
}

/**
 * Detect narrative-style free text (not a controlled heading).
 * Heuristic: contains sentence-ending punctuation or is very long.
 */
const NARRATIVE_THRESHOLD = 80;

function is_narrative(term) {
    // Contains sentence punctuation (period followed by space and capital, or period at end after a word)
    if (/\.\s+[A-Z]/.test(term)) return true;
    // Very long string — controlled headings rarely exceed ~80 chars
    if (term.length > NARRATIVE_THRESHOLD) return true;
    return false;
}

/**
 * Detect geographic qualifier patterns common in AACR2/RDA place headings:
 *   "Place Name (State.)"  e.g. Central City (Colo.)
 *   "Place Name (Country)"  e.g. Berlin (Germany)
 *   "Place, State"  e.g. (less common in LCSH, but exists)
 *
 * These parenthetical qualifiers strongly indicate a place term.
 */
const GEO_QUALIFIER_RE = /\([A-Z][A-Za-z.\s:-]+\)\s*$/;

function has_geographic_qualifier(term) {
    return GEO_QUALIFIER_RE.test(term);
}

/**
 * Detect topical event patterns with dates:
 *   "Event Name, Place., YYYY"       e.g. Sand Creek Massacre, Colo., 1864
 *   "Topic (YYYY-YYYY)"              e.g. Holocaust, Jewish (1939-1945)
 *   "Topic (YYYY)"
 */
const EVENT_DATE_RE = /(?:,\s*\d{4}$|\(\d{4}(?:-\d{4})?\)\s*$)/;

function has_event_date(term) {
    return EVENT_DATE_RE.test(term);
}

// ─────────────────────────────────────────────
// TERM CLASSIFIER
// ─────────────────────────────────────────────

const CATEGORY = {
    TOPICS: 'topics',
    GENRE_FORM: 'genre_form',
    PLACES: 'places',
    PERSONAL_NAME: 'personal_name',  // skipped — not propagated to media library
    NARRATIVE: 'narrative',          // flagged for manual review
    UNRESOLVED: 'unresolved'         // flagged for manual review
};

/**
 * Classify a single subject term.
 *
 * @param {string} term - A single (already pipe-split, trimmed) subject term
 * @param {object} vocab - { genre_form, topics, places } each with .set and .map
 * @returns {{ category: string, term: string, method: string }}
 */
function classify_term(term, vocab) {
    // Layer 1: Personal name
    if (is_personal_name(term)) {
        return { category: CATEGORY.PERSONAL_NAME, term, method: 'personal_name_regex' };
    }

    // Layer 2: Narrative free text
    if (is_narrative(term)) {
        return { category: CATEGORY.NARRATIVE, term, method: 'narrative_detection' };
    }

    const lower = term.toLowerCase();

    // Layer 3: Exact vocabulary lookup (genre_form first — narrowest list)
    if (vocab.genre_form.set.has(lower)) {
        return { category: CATEGORY.GENRE_FORM, term, method: 'exact_vocab_lookup' };
    }
    if (vocab.places.set.has(lower)) {
        return { category: CATEGORY.PLACES, term, method: 'exact_vocab_lookup' };
    }
    if (vocab.topics.set.has(lower)) {
        return { category: CATEGORY.TOPICS, term, method: 'exact_vocab_lookup' };
    }

    // Layer 4: Geographic heuristic — parenthetical qualifier
    if (has_geographic_qualifier(term)) {
        return { category: CATEGORY.PLACES, term, method: 'geographic_heuristic' };
    }

    // Layer 5: Topical event with date
    if (has_event_date(term)) {
        return { category: CATEGORY.TOPICS, term, method: 'event_date_heuristic' };
    }

    // Layer 6: Unresolved
    return { category: CATEGORY.UNRESOLVED, term, method: 'none' };
}

/**
 * Parse and classify all terms from a pipe-delimited item_subjects string.
 *
 * @param {string} raw_subjects - e.g. "Holocaust, Jewish (1939-1945)|Yearbooks"
 * @param {object} vocab
 * @returns {{ topics: string[], genre_form: string[], places: string[], skipped: object[], flagged: object[] }}
 */
function classify_subjects(raw_subjects, vocab) {
    const result = {
        topics: [],
        genre_form: [],
        places: [],
        skipped: [],   // personal names — not propagated
        flagged: []    // narratives + unresolved — manual review
    };

    const terms = raw_subjects
        .split('|')
        .map(t => t.trim())
        .filter(t => t.length > 0);

    for (const term of terms) {
        const classified = classify_term(term, vocab);

        switch (classified.category) {
            case CATEGORY.TOPICS:
                result.topics.push(term);
                break;
            case CATEGORY.GENRE_FORM:
                result.genre_form.push(term);
                break;
            case CATEGORY.PLACES:
                result.places.push(term);
                break;
            case CATEGORY.PERSONAL_NAME:
                result.skipped.push(classified);
                break;
            case CATEGORY.NARRATIVE:
            case CATEGORY.UNRESOLVED:
                result.flagged.push(classified);
                break;
        }
    }

    return result;
}

// ─────────────────────────────────────────────
// REPOSITORY API
// ─────────────────────────────────────────────

/**
 * Flatten the `.cause` chain on a fetch error into a readable string.
 * Node's global `fetch` throws `TypeError: fetch failed` and hides the real
 * network error (ENOTFOUND, ECONNREFUSED, cert errors, etc.) on `.cause`,
 * which itself may nest further causes.
 */
function describe_fetch_error(err) {
    const parts = [err.message];
    let c = err.cause;
    const seen = new Set();
    while (c && !seen.has(c)) {
        seen.add(c);
        const bits = [];
        if (c.code) bits.push(`code=${c.code}`);
        if (c.errno) bits.push(`errno=${c.errno}`);
        if (c.syscall) bits.push(`syscall=${c.syscall}`);
        if (c.hostname) bits.push(`host=${c.hostname}`);
        if (c.message && c.message !== err.message) bits.push(c.message);
        if (bits.length) parts.push(bits.join(' '));
        c = c.cause;
    }
    return parts.join(' → ');
}

/**
 * Fetch a repository record payload by its repository UUID.
 *
 * URL format: https://<server>/repository/data/<REPO_UUID>?key=<API_KEY>
 *
 * Hardened with an explicit timeout, retries with backoff, and verbose
 * cause-chain reporting on failure.
 *
 * @param {string} repo_uuid
 * @param {{ timeout_ms?: number, retries?: number }} [opts]
 * @returns {Promise<object>} Parsed JSON payload
 */
async function fetch_repository_record(repo_uuid, { timeout_ms = 30000, retries = 2 } = {}) {
    if (!REPOSITORY_SERVER || !REPOSITORY_API_KEY) {
        throw new Error('REPOSITORY_SERVER and REPOSITORY_API_KEY must be set in .env');
    }

    const base = REPOSITORY_SERVER.replace(/\/+$/, '');
    const url = `${base}/repository/data/${encodeURIComponent(repo_uuid)}?key=${encodeURIComponent(REPOSITORY_API_KEY)}`;

    let last_err;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(timeout_ms),
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'exhibits-v2-migration/1.0'
                }
            });
            if (!response.ok) {
                // Drain body so the socket can be reused, include a snippet for context.
                const body_snippet = (await response.text()).slice(0, 200);
                throw new Error(`HTTP ${response.status} ${response.statusText}${body_snippet ? ` — ${body_snippet}` : ''}`);
            }
            return await response.json();
        } catch (err) {
            last_err = err;
            const detail = describe_fetch_error(err);
            if (attempt < retries) {
                const backoff = 1000 * (attempt + 1);
                console.warn(`    attempt ${attempt + 1}/${retries + 1} failed: ${detail} — retrying in ${backoff}ms`);
                await new Promise(r => setTimeout(r, backoff));
            } else {
                console.warn(`    attempt ${attempt + 1}/${retries + 1} failed: ${detail}`);
            }
        }
    }

    throw new Error(describe_fetch_error(last_err));
}

/**
 * Sort a repository payload's `subjects` array into topics / places /
 * genre_form buckets based on the `type` field on each nested term.
 *
 * Real payload shape (from the repository):
 *   subjects: [
 *     {
 *       authority: 'lcsh',
 *       title: 'Holocaust, Jewish (1939-1945)',
 *       authority_id: 'http://id.loc.gov/...',
 *       terms: [ { type: 'topical', term: 'Holocaust, Jewish (1939-1945)' } ]
 *     },
 *     {
 *       authority: 'lcnaf',
 *       title: 'Berlin (Germany)',
 *       terms: [ { type: 'geographic', term: 'Berlin (Germany)' } ]
 *     },
 *     ...
 *   ]
 *
 * Compound subjects may have multiple entries in `terms` with different
 * types, so each inner term is bucketed independently.
 *
 * Type → column mapping:
 *   topical                  → topics_subjects
 *   geographic               → places_subjects
 *   genre / form / genre/form → genre_form_subjects
 *
 * @param {Array} subjects
 * @returns {{ topics: string[], genre_form: string[], places: string[], unrecognized: object[] }}
 */
function sort_repository_subjects(subjects) {
    const result = {
        topics: [],
        genre_form: [],
        places: [],
        unrecognized: []
    };

    if (!Array.isArray(subjects)) {
        return result;
    }

    for (const entry of subjects) {
        if (!entry || typeof entry !== 'object') continue;

        // Iterate the nested `terms` array. Fall back to the entry itself
        // if `terms` is missing (defensive — not seen in practice).
        const terms = Array.isArray(entry.terms) && entry.terms.length > 0
            ? entry.terms
            : [{ type: entry.type, term: entry.term || entry.title }];

        for (const t of terms) {
            if (!t || typeof t !== 'object') continue;

            const term = String(t.term || t.title || '').trim();
            if (!term) continue;

            const type = String(t.type || '').toLowerCase().trim();

            switch (type) {
                case 'topical':
                    result.topics.push(term);
                    break;
                case 'geographic':
                    result.places.push(term);
                    break;
                case 'genre':
                case 'form':
                case 'genre/form':
                    result.genre_form.push(term);
                    break;
                default:
                    result.unrecognized.push({ type: t.type, term });
                    break;
            }
        }
    }

    return result;
}

// ─────────────────────────────────────────────
// MAIN BACKFILL
// ─────────────────────────────────────────────

/**
 * Pass A: populate subjects on repository-imported media records from the
 * authoritative repository payload.
 *
 * Returns a Set<media_uuid> of records that were touched (or were already
 * populated) so the item pass can skip them.
 *
 * Repo imports are identified by `repo_uuid IS NOT NULL` on tbl_media_library
 * — any record with a `repo_uuid` is by definition a repo import, and the
 * column has a dedicated index (`repo_uuid_index`).
 */
async function process_repository_imports(report) {
    console.log('\n══════════════════════════════════════════');
    console.log('Pass A: Repository-imported media');
    console.log('══════════════════════════════════════════');

    const handled = new Set();

    if (!REPOSITORY_SERVER || !REPOSITORY_API_KEY) {
        console.log('  REPOSITORY_SERVER / REPOSITORY_API_KEY not set — skipping repo pass');
        return handled;
    }

    const repo_media = await v2_db('tbl_media_library')
        .select('uuid', 'repo_uuid', 'topics_subjects', 'genre_form_subjects', 'places_subjects')
        .whereNotNull('repo_uuid')
        .andWhere('repo_uuid', '!=', '')
        .andWhere('is_deleted', 0);

    console.log(`  Found ${repo_media.length} repository-imported media records`);

    for (const media of repo_media) {
        report.repo_records_scanned++;
        handled.add(media.uuid);

        // Belt-and-suspenders — whereNotNull above should guarantee this,
        // but keep the check in case of empty-string rows that slipped past.
        if (!media.repo_uuid) {
            report.repo_records_without_uuid++;
            console.log(`  SKIP media ${media.uuid}: no repo_uuid`);
            continue;
        }

        // --- Fetch repository payload ---
        let payload;
        try {
            payload = await fetch_repository_record(media.repo_uuid);
        } catch (err) {
            report.errors.push(`Media ${media.uuid} (repo ${media.repo_uuid}): ${err.message}`);
            console.error(`  ERROR fetching repo ${media.repo_uuid}: ${err.message}`);
            continue;
        }

        const subjects = payload && payload.display_record && payload.display_record.subjects;
        if (!subjects || (Array.isArray(subjects) && subjects.length === 0)) {
            console.log(`  SKIP media ${media.uuid}: repo payload has no display_record.subjects`);
            continue;
        }

        // --- Sort subjects by type ---
        const sorted = sort_repository_subjects(subjects);

        report.repo_terms_classified.topics += sorted.topics.length;
        report.repo_terms_classified.genre_form += sorted.genre_form.length;
        report.repo_terms_classified.places += sorted.places.length;

        for (const u of sorted.unrecognized) {
            report.repo_unrecognized_types.push({
                media_uuid: media.uuid,
                repo_uuid: media.repo_uuid,
                ...u
            });
        }

        // --- Build update payload (only fill NULL/empty columns) ---
        const has_topics = sorted.topics.length > 0;
        const has_genre_form = sorted.genre_form.length > 0;
        const has_places = sorted.places.length > 0;

        if (!has_topics && !has_genre_form && !has_places) {
            console.log(`  SKIP media ${media.uuid}: no recognized subject types in payload`);
            continue;
        }

        const update = {};
        if (has_topics && !media.topics_subjects) {
            update.topics_subjects = sorted.topics.join('|');
        }
        if (has_genre_form && !media.genre_form_subjects) {
            update.genre_form_subjects = sorted.genre_form.join('|');
        }
        if (has_places && !media.places_subjects) {
            update.places_subjects = sorted.places.join('|');
        }

        if (Object.keys(update).length === 0) {
            report.repo_records_already_populated++;
            console.log(`  SKIP media ${media.uuid}: already has subjects`);
            continue;
        }

        console.log(`  ${DRY_RUN ? '[DRY RUN] Would update' : 'Updating'} media ${media.uuid} (repo ${media.repo_uuid}):`);
        if (update.topics_subjects) console.log(`    topics:     ${update.topics_subjects}`);
        if (update.genre_form_subjects) console.log(`    genre_form: ${update.genre_form_subjects}`);
        if (update.places_subjects) console.log(`    places:     ${update.places_subjects}`);

        if (!DRY_RUN) {
            try {
                await v2_db('tbl_media_library')
                    .where('uuid', media.uuid)
                    .update(update);
                report.repo_records_updated++;
            } catch (err) {
                report.errors.push(`Media ${media.uuid}: ${err.message}`);
                console.error(`  ERROR updating media ${media.uuid}: ${err.message}`);
            }
        } else {
            report.repo_records_updated++;
        }
    }

    return handled;
}

async function run() {
    console.log('══════════════════════════════════════════');
    console.log('Backfill Media Library Subjects');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
        console.log('TLS:  verification DISABLED (NODE_TLS_REJECT_UNAUTHORIZED=0)');
    }
    console.log('══════════════════════════════════════════\n');

    // --- Load vocabulary ---
    console.log('Loading vocabulary files...');
    const vocab = {
        genre_form: load_vocabulary(GENRE_FORM_FILE),
        topics: load_vocabulary(TOPICS_FILE),
        places: load_vocabulary(PLACES_FILE)
    };
    console.log(`  genre_form: ${vocab.genre_form.set.size} terms`);
    console.log(`  topics:     ${vocab.topics.set.size} terms`);
    console.log(`  places:     ${vocab.places.set.size} terms`);

    // --- Report accumulators ---
    const report = {
        items_scanned: 0,
        items_with_subjects: 0,
        items_without_media_uuid: 0,
        items_skipped_repo_import: 0,
        media_records_updated: 0,
        media_records_already_populated: 0,
        terms_classified: { topics: 0, genre_form: 0, places: 0 },
        personal_names_skipped: [],
        flagged_for_review: [],
        // Repository-import pass
        repo_records_scanned: 0,
        repo_records_without_uuid: 0,
        repo_records_updated: 0,
        repo_records_already_populated: 0,
        repo_terms_classified: { topics: 0, genre_form: 0, places: 0 },
        repo_unrecognized_types: [],
        errors: []
    };

    // --- Pass A: Repository imports (authoritative payloads) ---
    const repo_handled_media = await process_repository_imports(report);

    // --- Pass B: Non-repository items via item_subjects classification ---
    console.log('\n══════════════════════════════════════════');
    console.log('Pass B: Non-repository items (item_subjects)');
    console.log('══════════════════════════════════════════');

    // --- Process each item table ---
    for (const { table, label } of ITEM_TABLES) {

        console.log(`\n── ${label} items (${table}) ──`);

        const items = await v2_db(table)
            .select('uuid', 'item_subjects', 'media_uuid', 'is_member_of_exhibit')
            .whereNotNull('item_subjects')
            .andWhere('item_subjects', '!=', '')
            .andWhere('is_deleted', 0);

        console.log(`  Found ${items.length} items with item_subjects`);
        report.items_scanned += items.length;

        for (const item of items) {
            report.items_with_subjects++;

            // --- Validate media_uuid binding ---
            if (!item.media_uuid) {
                report.items_without_media_uuid++;
                console.log(`  SKIP ${item.uuid}: no media_uuid bound`);
                continue;
            }

            // --- Skip if this media is a repo import (already handled in Pass A) ---
            if (repo_handled_media.has(item.media_uuid)) {
                report.items_skipped_repo_import++;
                continue;
            }

            // --- Classify subjects ---
            const classified = classify_subjects(item.item_subjects, vocab);

            // Accumulate report data
            report.terms_classified.topics += classified.topics.length;
            report.terms_classified.genre_form += classified.genre_form.length;
            report.terms_classified.places += classified.places.length;

            for (const skipped of classified.skipped) {
                report.personal_names_skipped.push({
                    item_uuid: item.uuid,
                    exhibit_uuid: item.is_member_of_exhibit,
                    table: label,
                    ...skipped
                });
            }
            for (const flagged of classified.flagged) {
                report.flagged_for_review.push({
                    item_uuid: item.uuid,
                    exhibit_uuid: item.is_member_of_exhibit,
                    table: label,
                    ...flagged
                });
            }

            // --- Build update payload ---
            const has_topics = classified.topics.length > 0;
            const has_genre_form = classified.genre_form.length > 0;
            const has_places = classified.places.length > 0;

            if (!has_topics && !has_genre_form && !has_places) {
                console.log(`  SKIP ${item.uuid}: all terms were personal names or flagged`);
                continue;
            }

            // --- Check if media library record already has subjects ---
            const media_record = await v2_db('tbl_media_library')
                .select('uuid', 'topics_subjects', 'genre_form_subjects', 'places_subjects')
                .where('uuid', item.media_uuid)
                .first();

            if (!media_record) {
                report.errors.push(`Item ${item.uuid}: media_uuid ${item.media_uuid} not found in tbl_media_library`);
                console.error(`  ERROR ${item.uuid}: media record ${item.media_uuid} not found`);
                continue;
            }

            // Only update columns that are currently NULL/empty (don't overwrite manual edits)
            const update = {};

            if (has_topics && !media_record.topics_subjects) {
                update.topics_subjects = classified.topics.join('|');
            }
            if (has_genre_form && !media_record.genre_form_subjects) {
                update.genre_form_subjects = classified.genre_form.join('|');
            }
            if (has_places && !media_record.places_subjects) {
                update.places_subjects = classified.places.join('|');
            }

            if (Object.keys(update).length === 0) {
                report.media_records_already_populated++;
                console.log(`  SKIP ${item.uuid}: media ${item.media_uuid} already has subjects`);
                continue;
            }

            // --- Write to media library ---
            console.log(`  ${DRY_RUN ? '[DRY RUN] Would update' : 'Updating'} media ${item.media_uuid}:`);
            if (update.topics_subjects) console.log(`    topics:     ${update.topics_subjects}`);
            if (update.genre_form_subjects) console.log(`    genre_form: ${update.genre_form_subjects}`);
            if (update.places_subjects) console.log(`    places:     ${update.places_subjects}`);

            if (!DRY_RUN) {
                try {
                    await v2_db('tbl_media_library')
                        .where('uuid', item.media_uuid)
                        .update(update);
                    report.media_records_updated++;
                } catch (err) {
                    report.errors.push(`Item ${item.uuid} → media ${item.media_uuid}: ${err.message}`);
                    console.error(`  ERROR updating media ${item.media_uuid}: ${err.message}`);
                }
            } else {
                report.media_records_updated++;
            }
        }
    }

    // ─────────────────────────────────────────
    // REPORT
    // ─────────────────────────────────────────

    console.log('\n══════════════════════════════════════════');
    console.log('BACKFILL REPORT');
    console.log('══════════════════════════════════════════\n');

    console.log('── Pass A: Repository imports ──');
    console.log(`Repo records scanned:           ${report.repo_records_scanned}`);
    console.log(`Repo records without repo_uuid: ${report.repo_records_without_uuid}`);
    console.log(`Repo records updated:           ${report.repo_records_updated}`);
    console.log(`Repo records already populated: ${report.repo_records_already_populated}`);
    console.log(`Repo terms classified:`);
    console.log(`  topics:     ${report.repo_terms_classified.topics}`);
    console.log(`  genre_form: ${report.repo_terms_classified.genre_form}`);
    console.log(`  places:     ${report.repo_terms_classified.places}`);

    console.log('\n── Pass B: Non-repository items ──');
    console.log(`Items scanned:                  ${report.items_scanned}`);
    console.log(`Items with subjects:            ${report.items_with_subjects}`);
    console.log(`Items without media_uuid:       ${report.items_without_media_uuid}`);
    console.log(`Items skipped (repo import):    ${report.items_skipped_repo_import}`);
    console.log(`Media records updated:          ${report.media_records_updated}`);
    console.log(`Media records already populated: ${report.media_records_already_populated}`);
    console.log(`\nTerms classified:`);
    console.log(`  topics:     ${report.terms_classified.topics}`);
    console.log(`  genre_form: ${report.terms_classified.genre_form}`);
    console.log(`  places:     ${report.terms_classified.places}`);

    if (report.repo_unrecognized_types.length > 0) {
        console.log(`\n── Repo Subjects with Unrecognized Type (${report.repo_unrecognized_types.length}) ──`);
        console.log('These had a `type` value outside topical/places/genre/form and were not written:\n');
        for (const entry of report.repo_unrecognized_types) {
            console.log(`  media ${entry.media_uuid} (repo ${entry.repo_uuid}): type="${entry.type}" term="${entry.term}"`);
        }
    }

    if (report.personal_names_skipped.length > 0) {
        console.log(`\n── Personal Names Skipped (${report.personal_names_skipped.length}) ──`);
        console.log('These remain in item_subjects only and were NOT propagated to media library:\n');
        for (const entry of report.personal_names_skipped) {
            console.log(`  [${entry.table}] item ${entry.item_uuid} → "${entry.term}"`);
        }
    }

    if (report.flagged_for_review.length > 0) {
        console.log(`\n── Flagged for Manual Review (${report.flagged_for_review.length}) ──`);
        console.log('These could not be auto-classified and need manual assignment:\n');
        for (const entry of report.flagged_for_review) {
            console.log(`  [${entry.table}] item ${entry.item_uuid}`);
            console.log(`    term:   "${entry.term}"`);
            console.log(`    reason: ${entry.category} (${entry.method})`);
        }
    }

    if (report.errors.length > 0) {
        console.log(`\n── Errors (${report.errors.length}) ──\n`);
        for (const err of report.errors) {
            console.log(`  ${err}`);
        }
    }

    console.log('\n══════════════════════════════════════════');
    console.log(`Done. ${DRY_RUN ? '(DRY RUN — no changes written)' : ''}`);
    console.log('══════════════════════════════════════════');

    await v2_db.destroy();
}

// ─────────────────────────────────────────────
// ENTRY
// ─────────────────────────────────────────────

run().catch(async (err) => {
    console.error('FATAL:', err);
    await v2_db.destroy();
    process.exit(1);
});
