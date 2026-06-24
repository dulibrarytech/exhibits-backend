/**
 * Exhibits v2 — Ownership Assignment / Override (standalone)
 *
 * Post-migration tool to (re)assign the `owner` of exhibits and their content in
 * the v2 database. Complements the main migration's automatic owner remap (which
 * sets each record's owner from its v1 owner): this script is for DELIBERATE
 * ownership changes — handing an exhibit to a curator, claiming orphaned
 * (owner = 0) content, or moving everything off a departed user.
 *
 * Why ownership matters: exhibits-v2 uses `owner` for ownership-scoped
 * authorization (auth/authorize.js tier-2) — a user holding a scoped permission
 * (e.g. `update_exhibit`, not `update_any_exhibit`) may act only on records they
 * own. So `owner` is functional access control, not just an audit field.
 *
 * Operates ONLY on the v2 database (V2_DB_* in .env, same as the migration).
 *
 * Modes:
 *   node assign_ownership.js --list
 *       Read-only audit: the current owner of each exhibit, owner distribution
 *       across all ownable tables, and orphan (owner = 0) counts. Use this to
 *       author the assignments file.
 *
 *   node assign_ownership.js [assignments.json]
 *       Apply the assignments / reassignments in the given JSON file
 *       (default: ./ownership_assignments.json). DRY_RUN=true previews without
 *       writing. See ownership_assignments.example.json for the format.
 *
 * Assignments file shape:
 *   {
 *     "assignments": [                       // assign an exhibit + all its content
 *       { "exhibit_uuid": "<uuid>", "owner": { "du_id": "873296219" } },
 *       { "exhibit_uuid": "<uuid>", "owner": { "email": "jane@du.edu" },
 *         "include_media": false }
 *     ],
 *     "reassignments": [                     // bulk-move every record by current owner
 *       { "from": { "du_id": "873667074" }, "to": { "du_id": "873296219" } },
 *       { "from": { "owner_id": 0 },        "to": { "email": "lead@du.edu" } }
 *     ]
 *   }
 *
 * Owner is resolved to a v2 tbl_users.id via stable du_id (preferred), email, or
 * raw user_id. A reassignment `from` may also be a raw `owner_id` (including 0 to
 * target orphaned/unowned records).
 *
 * Safety:
 *   - DRY_RUN=true computes and reports every change but writes nothing.
 *   - Each assignment (exhibit + all its children + single-exhibit media) and each
 *     reassignment runs inside one transaction.
 *   - Idempotent: reported counts reflect only rows whose owner actually changes,
 *     so a re-run is a no-op.
 *   - Media shared across MULTIPLE exhibits is never reassigned by an exhibit
 *     assignment (reported as skipped) — use a reassignment to move shared media.
 *
 * Usage:
 *   1. node assign_ownership.js --list                                   # see current state
 *   2. cp ownership_assignments.example.json ownership_assignments.json  # then edit
 *   3. DRY_RUN=true  node assign_ownership.js ownership_assignments.json  # preview
 *   4. DRY_RUN=false node assign_ownership.js ownership_assignments.json  # apply
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
// Set OWNERSHIP_INCLUDE_MEDIA=false to leave media owners untouched by assignments.
const INCLUDE_MEDIA = process.env.OWNERSHIP_INCLUDE_MEDIA !== 'false';

const v2_db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.V2_DB_HOST || '127.0.0.1',
        port: process.env.V2_DB_PORT || 3306,
        user: process.env.V2_DB_USER || 'root',
        password: process.env.V2_DB_PASSWORD || '',
        database: process.env.V2_DB_NAME || 'exhibitsv2'
    }
});

// Child tables that carry both `is_member_of_exhibit` and `owner`.
const CHILD_TABLES = [
    'tbl_standard_items', 'tbl_grids', 'tbl_timelines',
    'tbl_heading_items', 'tbl_grid_items', 'tbl_timeline_items'
];
// Every table with an `owner` column (used by reassignment + the audit).
const OWNABLE_TABLES = ['tbl_exhibits', ...CHILD_TABLES, 'tbl_media_library'];

// ─────────────────────────────────────────────
// USER LOOKUP
// ─────────────────────────────────────────────

const du_id_to_id = new Map();  // du_id (string) → v2 tbl_users.id
const email_to_id = new Map();  // email (lowercase) → v2 tbl_users.id
const id_to_info = new Map();   // v2 id → { name, du_id, email }

async function load_users() {
    const users = await v2_db('tbl_users').select('id', 'du_id', 'email', 'first_name', 'last_name');
    for (const u of users) {
        const name = `${u.first_name} ${u.last_name}`.trim();
        if (u.du_id) du_id_to_id.set(String(u.du_id), u.id);
        if (u.email) email_to_id.set(String(u.email).toLowerCase(), u.id);
        id_to_info.set(u.id, { name, du_id: u.du_id, email: u.email });
    }
    return users.length;
}

function user_label(id) {
    const n = Number(id);
    if (n === 0) return '(unowned / owner=0)';
    const info = id_to_info.get(n);
    return info ? `${info.name} (du_id ${info.du_id})` : `id ${n} (unknown user)`;
}

/**
 * Resolve an owner spec to a REAL v2 user id.
 * @returns {{id: number|null, reason?: string}}
 */
function resolve_real_user(spec) {
    if (!spec || typeof spec !== 'object') return { id: null, reason: 'owner spec missing/!object' };
    if (spec.du_id !== undefined) {
        const id = du_id_to_id.get(String(spec.du_id));
        return id ? { id } : { id: null, reason: `du_id ${spec.du_id} not found in tbl_users` };
    }
    if (spec.email !== undefined) {
        const id = email_to_id.get(String(spec.email).toLowerCase());
        return id ? { id } : { id: null, reason: `email ${spec.email} not found in tbl_users` };
    }
    if (spec.user_id !== undefined) {
        const id = Number(spec.user_id);
        return id_to_info.has(id) ? { id } : { id: null, reason: `user_id ${spec.user_id} is not a known user` };
    }
    return { id: null, reason: 'owner spec needs du_id, email, or user_id' };
}

/**
 * Resolve a reassignment `from` spec. Like resolve_real_user but also allows a
 * raw `owner_id` (including 0, to target orphaned/unowned records).
 */
function resolve_from(spec) {
    if (spec && spec.owner_id !== undefined) {
        const id = Number(spec.owner_id);
        if (Number.isNaN(id)) return { id: null, reason: `owner_id ${spec.owner_id} is not a number` };
        return { id };
    }
    return resolve_real_user(spec);
}

function safe_json_parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function strip_html(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }

// ─────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────

const report = {
    started_at: null,
    completed_at: null,
    dry_run: DRY_RUN,
    mode: null,
    assignments: [],
    reassignments: [],
    errors: []
};

// ─────────────────────────────────────────────
// MEDIA RESOLUTION
// ─────────────────────────────────────────────

/**
 * Find media library records linked to an exhibit, split into those linked ONLY
 * to this exhibit (safe to reassign) and those shared across multiple exhibits.
 * `exhibits` is a JSON array of exhibit UUIDs; LIKE pre-filters, JS verifies.
 */
async function media_for_exhibit(exhibit_uuid) {
    const candidates = await v2_db('tbl_media_library')
        .select('id', 'uuid', 'owner', 'exhibits')
        .whereNotNull('exhibits')
        .where('exhibits', 'like', `%${exhibit_uuid}%`);

    const single = [], shared = [];
    for (const m of candidates) {
        const arr = safe_json_parse(m.exhibits);
        if (!Array.isArray(arr) || !arr.includes(exhibit_uuid)) continue; // LIKE false positive
        (arr.length === 1 ? single : shared).push(m);
    }
    return { single, shared };
}

// ─────────────────────────────────────────────
// APPLY: EXHIBIT ASSIGNMENT (+ cascade to children + single-exhibit media)
// ─────────────────────────────────────────────

async function apply_assignment(a, idx) {
    const tag = `assignments[${idx}]`;

    if (!a || !a.exhibit_uuid) { report.errors.push(`${tag}: missing exhibit_uuid`); return; }
    const exhibit_uuid = a.exhibit_uuid;

    const owner = resolve_real_user(a.owner);
    if (!owner.id) { report.errors.push(`${tag} (${exhibit_uuid}): ${owner.reason}`); return; }
    const new_owner = owner.id;

    const ex = await v2_db('tbl_exhibits').where('uuid', exhibit_uuid).first();
    if (!ex) { report.errors.push(`${tag}: exhibit ${exhibit_uuid} not found in v2`); return; }

    const include_media = a.include_media !== undefined ? a.include_media : INCLUDE_MEDIA;

    // Count rows whose owner will actually change (idempotent reporting).
    const changes = {};
    let total = 0;

    changes.tbl_exhibits = (Number(ex.owner) !== new_owner) ? 1 : 0;
    total += changes.tbl_exhibits;

    for (const t of CHILD_TABLES) {
        const r = await v2_db(t).where('is_member_of_exhibit', exhibit_uuid).whereNot('owner', new_owner).count('* as c').first();
        changes[t] = Number(r.c);
        total += changes[t];
    }

    let media_single = [], media_shared = [];
    if (include_media) {
        const m = await media_for_exhibit(exhibit_uuid);
        media_single = m.single.filter(x => Number(x.owner) !== new_owner);
        media_shared = m.shared;
    }
    changes.tbl_media_library = media_single.length;
    total += media_single.length;

    const result = {
        exhibit_uuid,
        new_owner,
        new_owner_label: user_label(new_owner),
        previous_exhibit_owner: Number(ex.owner),
        previous_exhibit_owner_label: user_label(Number(ex.owner)),
        include_media,
        changes,
        total_changed: total,
        media_shared_skipped: media_shared.map(x => x.uuid),
        applied: false
    };

    console.log(`\n  ${tag}  ${exhibit_uuid.substring(0, 12)}…  "${strip_html(ex.title).substring(0, 40)}"`);
    console.log(`    owner: ${result.previous_exhibit_owner_label}  →  ${result.new_owner_label}`);
    console.log(`    rows changing: ${total} (${Object.entries(changes).filter(([, n]) => n > 0).map(([t, n]) => `${t.replace('tbl_', '')}=${n}`).join(', ') || 'none'})`);
    if (media_shared.length) console.log(`    ⚠ ${media_shared.length} shared media skipped (linked to other exhibits)`);

    if (DRY_RUN) {
        console.log(`    [DRY RUN] no changes written`);
        report.assignments.push(result);
        return;
    }
    if (total === 0) {
        console.log(`    ✓ already correct — nothing to do`);
        report.assignments.push(result);
        return;
    }

    try {
        await v2_db.transaction(async trx => {
            await trx('tbl_exhibits').where('uuid', exhibit_uuid).update({ owner: new_owner });
            for (const t of CHILD_TABLES) {
                await trx(t).where('is_member_of_exhibit', exhibit_uuid).update({ owner: new_owner });
            }
            if (media_single.length) {
                await trx('tbl_media_library').whereIn('id', media_single.map(x => x.id)).update({ owner: new_owner });
            }
        });
        result.applied = true;
        console.log(`    ✓ applied`);
    } catch (err) {
        result.error = err.message;
        report.errors.push(`${tag} (${exhibit_uuid}): ${err.message}`);
        console.error(`    ✗ ${err.message}`);
    }

    report.assignments.push(result);
}

// ─────────────────────────────────────────────
// APPLY: BULK REASSIGNMENT BY CURRENT OWNER (global across all ownable tables)
// ─────────────────────────────────────────────

async function apply_reassignment(r, idx) {
    const tag = `reassignments[${idx}]`;

    const to = resolve_real_user(r && r.to);
    if (!to.id) { report.errors.push(`${tag}: to: ${to.reason}`); return; }

    const from = resolve_from(r && r.from);
    if (from.id === null || from.id === undefined) { report.errors.push(`${tag}: from: ${from.reason}`); return; }

    if (from.id === to.id) { report.errors.push(`${tag}: from and to are the same (${user_label(to.id)})`); return; }

    const changes = {};
    let total = 0;
    for (const t of OWNABLE_TABLES) {
        const c = await v2_db(t).where('owner', from.id).count('* as c').first();
        changes[t] = Number(c.c);
        total += changes[t];
    }

    const result = {
        from_owner: from.id,
        from_label: user_label(from.id),
        to_owner: to.id,
        to_label: user_label(to.id),
        changes,
        total_changed: total,
        applied: false
    };

    console.log(`\n  ${tag}  ${result.from_label}  →  ${result.to_label}`);
    console.log(`    rows changing: ${total} (${Object.entries(changes).filter(([, n]) => n > 0).map(([t, n]) => `${t.replace('tbl_', '')}=${n}`).join(', ') || 'none'})`);

    if (DRY_RUN) {
        console.log(`    [DRY RUN] no changes written`);
        report.reassignments.push(result);
        return;
    }
    if (total === 0) {
        console.log(`    ✓ nothing owned by ${result.from_label} — nothing to do`);
        report.reassignments.push(result);
        return;
    }

    try {
        await v2_db.transaction(async trx => {
            for (const t of OWNABLE_TABLES) {
                await trx(t).where('owner', from.id).update({ owner: to.id });
            }
        });
        result.applied = true;
        console.log(`    ✓ applied`);
    } catch (err) {
        result.error = err.message;
        report.errors.push(`${tag}: ${err.message}`);
        console.error(`    ✗ ${err.message}`);
    }

    report.reassignments.push(result);
}

// ─────────────────────────────────────────────
// LIST MODE (read-only audit)
// ─────────────────────────────────────────────

async function list_ownership() {
    const exhibits = await v2_db('tbl_exhibits').select('uuid', 'title', 'owner', 'is_deleted').orderBy('owner');

    console.log('\n═══ EXHIBITS — current owner ═══');
    for (const e of exhibits) {
        console.log(`  ${e.uuid.substring(0, 12)}…  owner=${String(e.owner).padStart(3)}  ${user_label(Number(e.owner)).padEnd(34)} ${e.is_deleted ? '[deleted] ' : ''}${strip_html(e.title).substring(0, 40)}`);
    }

    // Owner distribution across every ownable table.
    const owner_set = new Set();
    const per_table = {};
    for (const t of OWNABLE_TABLES) {
        const rows = await v2_db(t).select('owner').count('* as c').groupBy('owner');
        per_table[t] = new Map(rows.map(r => [Number(r.owner), Number(r.c)]));
        rows.forEach(r => owner_set.add(Number(r.owner)));
    }
    const owners = [...owner_set].sort((a, b) => a - b);

    console.log('\n═══ OWNER DISTRIBUTION (rows per ownable table) ═══');
    for (const owner of owners) {
        const parts = OWNABLE_TABLES
            .map(t => [t.replace('tbl_', ''), per_table[t].get(owner) || 0])
            .filter(([, n]) => n > 0)
            .map(([t, n]) => `${t}=${n}`);
        console.log(`  ${user_label(owner).padEnd(34)} ${parts.join('  ')}`);
    }

    const orphan_lines = OWNABLE_TABLES
        .map(t => [t, per_table[t].get(0) || 0])
        .filter(([, n]) => n > 0);
    console.log('\n═══ ORPHANS (owner = 0) ═══');
    if (orphan_lines.length === 0) console.log('  none — every record has an owner');
    else for (const [t, n] of orphan_lines) console.log(`  ${t}: ${n}`);
}

// ─────────────────────────────────────────────
// REPORT WRITER
// ─────────────────────────────────────────────

async function write_report() {
    report.completed_at = new Date().toISOString();

    const assigned = report.assignments.reduce((s, a) => s + (a.applied ? a.total_changed : 0), 0);
    const reassigned = report.reassignments.reduce((s, r) => s + (r.applied ? r.total_changed : 0), 0);

    console.log('\n══════════════════════════════════════════════════════');
    console.log('OWNERSHIP ASSIGNMENT REPORT');
    console.log('══════════════════════════════════════════════════════');
    console.log(`Mode:                 ${DRY_RUN ? 'DRY RUN (no changes written)' : 'LIVE'}`);
    console.log(`Assignments:          ${report.assignments.length} (${assigned} rows changed)`);
    console.log(`Reassignments:        ${report.reassignments.length} (${reassigned} rows changed)`);
    console.log(`Errors:               ${report.errors.length}`);
    for (const e of report.errors) console.log(`  • ${e}`);

    const file = path.join(__dirname, `ownership_report_${Date.now()}.json`);
    await fsp.writeFile(file, JSON.stringify(report, null, 2));
    console.log(`\nFull report written to: ${file}`);
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
    report.started_at = new Date().toISOString();
    const arg = process.argv[2];
    const is_list = arg === '--list' || arg === 'list';

    console.log('══════════════════════════════════════════════════════');
    console.log('Exhibits v2 — Ownership Assignment');
    console.log(`Mode: ${is_list ? 'LIST (read-only)' : (DRY_RUN ? 'DRY RUN' : 'LIVE')}`);
    console.log('══════════════════════════════════════════════════════');

    try {
        await v2_db.raw('SELECT 1');
        const n = await load_users();
        console.log(`v2 database connected. Loaded ${n} users.`);

        if (is_list) {
            report.mode = 'list';
            await list_ownership();
        } else {
            report.mode = 'apply';
            const file = arg || path.join(__dirname, 'ownership_assignments.json');

            let spec;
            try {
                spec = JSON.parse(await fsp.readFile(file, 'utf8'));
            } catch (e) {
                throw new Error(`Cannot read/parse assignments file "${file}": ${e.message}`);
            }

            const assignments = Array.isArray(spec.assignments) ? spec.assignments : [];
            const reassignments = Array.isArray(spec.reassignments) ? spec.reassignments : [];
            if (assignments.length === 0 && reassignments.length === 0) {
                throw new Error(`No "assignments" or "reassignments" arrays found in ${path.basename(file)}`);
            }

            console.log(`\nApplying ${assignments.length} assignment(s) + ${reassignments.length} reassignment(s) from ${path.basename(file)}`);
            for (let i = 0; i < assignments.length; i++) await apply_assignment(assignments[i], i);
            for (let i = 0; i < reassignments.length; i++) await apply_reassignment(reassignments[i], i);
            await write_report();
        }
    } catch (err) {
        console.error(`\nFATAL ERROR: ${err.message}`);
        process.exitCode = 1;
    } finally {
        await v2_db.destroy();
        console.log('\nDatabase connection closed.');
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    v2_db,
    load_users,
    resolve_real_user,
    resolve_from,
    media_for_exhibit,
    apply_assignment,
    apply_reassignment,
    list_ownership,
    user_label,
    _report: report
};
