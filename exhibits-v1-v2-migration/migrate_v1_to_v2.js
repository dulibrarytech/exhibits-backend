/**
 * Exhibits v1 → v2 Migration Script
 *
 * Backfills v1 database records and storage files into the v2 system.
 *
 * What it does:
 *   Phase 1: Migrate users + user→role assignments (skip existing). Roles,
 *            permissions, and the role→permission grants are NOT migrated from v1 —
 *            they are the v2 app's own canonical RBAC, seeded by the backend
 *            (db/seeds; run `knex seed:run` after migrate:latest, before this).
 *   Phase 2: Migrate exhibits (preserve UUIDs, skip existing)
 *   Phase 3: Migrate grids, timelines, heading items (preserve UUIDs, skip existing)
 *   Phase 4: Migrate standard items, grid items, timeline items (preserve UUIDs, skip existing)
 *   Phase 4.5: Convert v1 member titles (standard items, grids, timelines) into
 *              `subheading` heading-items, mirroring v2 migration 20260403200926
 *              ("titles-to-subheadings"), which dropped those `title` columns.
 *   Phase 5: Detect orphaned files and broken DB references (before file copy)
 *   Phase 6: Create media library records + copy files for exhibit hero/thumbnail
 *   Phase 7: Create media library records + copy files for item media
 *   Phase 8: Generate IIIF manifests for uploaded and Kaltura media via v2 API (per-record)
 *   Phase 9: [DISABLED — moved to standalone script] Convert exhibit styles to v2 format + backfill item/heading presets
 *   Phase 10: Generate migration report
 *
 * Orphan detection runs before file-copy phases so that files without a v1
 * database reference are never copied to v2 storage.
 *
 * All text fields are decoded during Phases 2–7 to fix double-encoded HTML
 * entities from a v1 bug (e.g. &amp;lt;b&amp;gt; → &lt;b&gt;). Decoding loops until
 * output stabilizes to handle arbitrary encoding depth.
 *
 * Storage layout:
 *   v1: storage/{exhibit_uuid}/{exhibit_uuid}_{timestamp}_exhibit_hero.{ext}
 *       storage/{exhibit_uuid}/{item_uuid}_{timestamp}_item_media.{ext}
 *
 *   v2: media-library/images/{uuid[0:2]}/{uuid[2:4]}/{media_uuid}.{ext}
 *       media-library/documents/{uuid[0:2]}/{uuid[2:4]}/{media_uuid}.{ext}
 *       media-library/thumbnails/{uuid[0:2]}/{uuid[2:4]}/{media_uuid}.{ext}
 *
 * Usage:
 *   1. Copy .env.migration to .env and fill in values
 *   2. Set DRY_RUN=true in .env for preview, DRY_RUN=false to execute
 *   3. node migrate_v1_to_v2.js
 *
 * Prerequisites:
 *   - npm install knex mysql2 uuid dotenv sharp exiftool-vendored pdfjs-dist @napi-rs/canvas
 *   - Both v1 and v2 databases accessible
 *   - v1 storage directory accessible at V1_STORAGE_PATH
 *   - v2 media-library directory writable at V2_MEDIA_LIBRARY_PATH
 *   - v2 API server running and accessible at V2_API_URL (for IIIF manifest generation)
 */

'use strict';

require('dotenv').config();
const knex = require('knex');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const http = require('http');
const https = require('https');
const sharp = require('sharp');
const { exiftool } = require('exiftool-vendored');

// ─────────────────────────────────────────────
// CONFIGURATION — Set values in .env file
// ─────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true';

const V1_STORAGE_PATH = process.env.V1_STORAGE_PATH || '/path/to/v1/storage';
const V2_MEDIA_LIBRARY_PATH = process.env.V2_MEDIA_LIBRARY_PATH || '/path/to/v2/media-library';

const MIGRATION_USER = process.env.MIGRATION_USER || 'migration_script';

// v2 API settings for IIIF manifest generation (Phase 8)
const V2_API_URL = process.env.V2_API_URL || 'http://localhost:9001';
const V2_IIIF_GENERATE_ENDPOINT = process.env.V2_IIIF_GENERATE_ENDPOINT || '/api/v1/media/library/iiif/:media_id/manifest/generate';
const V2_API_TOKEN = process.env.V2_API_TOKEN || '';

const v1_db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.V1_DB_HOST || '127.0.0.1',
        port: process.env.V1_DB_PORT || 3306,
        user: process.env.V1_DB_USER || 'root',
        password: process.env.V1_DB_PASSWORD || '',
        database: process.env.V1_DB_NAME || 'exhibits_v1'
    }
});

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
// MIME TYPE + CATEGORY MAPPINGS
// ─────────────────────────────────────────────

const EXT_TO_MIME = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
};

const MIME_TO_MEDIA_TYPE = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/tiff': 'image',
    'image/webp': 'image',
    'image/svg+xml': 'image',
    'application/pdf': 'pdf',
    'video/mp4': 'video',
    'video/webm': 'video',
    'audio/mpeg': 'audio',
    'audio/wav': 'audio',
    'audio/ogg': 'audio'
};

/**
 * Valid item_type values for the media library.
 * These are descriptive content classifications distinct from media_type.
 */
const VALID_ITEM_TYPES = new Set([
    'mixed materials',
    'moving image',
    'sound recording',
    'sound recording non musical',
    'still image',
    'text'
]);

/**
 * Fallback map: item_type → media_type.
 * Used ONLY when MIME type is missing or unrecognized.
 * MIME type remains the sole source of truth for media_type.
 */
const ITEM_TYPE_TO_MEDIA_TYPE = {
    'moving image': 'video',
    'sound recording': 'audio',
    'sound recording non musical': 'audio',
    'still image': 'image',
    'text': 'pdf',
    'mixed materials': 'unknown'
};

/**
 * Reverse map: media_type → default item_type.
 * Used when v1 records lack an item_type value so that the media library
 * item_type column is always populated with a descriptive classification.
 */
const MEDIA_TYPE_TO_ITEM_TYPE = {
    'image': 'still image',
    'video': 'moving image',
    'audio': 'sound recording',
    'pdf': 'text',
    'unknown': 'mixed materials'
};

/**
 * Resolve item_type for a media library record.
 * Prefers the v1 item_type when present and valid;
 * falls back to deriving from media_type.
 *
 * @param {string|null} v1_item_type - item_type from the v1 record
 * @param {string} media_type - resolved media_type for this record
 * @returns {string} Descriptive item_type value
 */
function resolve_item_type(v1_item_type, media_type) {
    if (v1_item_type) {
        const normalized = v1_item_type.toLowerCase().trim();
        if (VALID_ITEM_TYPES.has(normalized)) return normalized;
    }
    return MEDIA_TYPE_TO_ITEM_TYPE[media_type] || 'mixed materials';
}

/**
 * Determine media-library storage category from mime type
 * images → images/, pdf/documents → documents/, audio/video → documents/
 */
function get_storage_category(mime_type) {
    if (!mime_type) return 'images';
    if (mime_type.startsWith('image/')) return 'images';
    return 'documents';
}

/**
 * Build v2 hash-prefix storage path: {category}/{uuid[0:2]}/{uuid[2:4]}/{uuid}.{ext}
 */
function build_v2_storage_path(media_uuid, ext, mime_type) {
    const category = get_storage_category(mime_type);
    const prefix1 = media_uuid.substring(0, 2);
    const prefix2 = media_uuid.substring(2, 4);
    return path.join(category, prefix1, prefix2, `${media_uuid}${ext}`);
}

/**
 * Build v2 thumbnail path: thumbnails/{uuid[0:2]}/{uuid[2:4]}/{uuid}_thumb.jpg
 *
 * v2 always generates JPEG thumbnails with a _thumb suffix
 * (see uploads.js build_thumbnail_path). The source extension is irrelevant.
 */
function build_v2_thumbnail_path(media_uuid) {
    const prefix1 = media_uuid.substring(0, 2);
    const prefix2 = media_uuid.substring(2, 4);
    return path.join('thumbnails', prefix1, prefix2, `${media_uuid}_thumb.jpg`);
}

/**
 * Get mime type from file extension
 */
function get_mime_type(filename) {
    if (!filename) return null;
    const ext = path.extname(filename).toLowerCase();
    return EXT_TO_MIME[ext] || null;
}

/**
 * Normalize a MIME type value that may contain HTML-encoded characters.
 * v1 stored some MIME types with encoded forward slashes (e.g. image&#x2F;tiff).
 * Decodes entities, trims whitespace, and lowercases for consistent lookup.
 *
 * @param {string|null} mime_type - Raw MIME type from v1 database
 * @returns {string|null} Cleaned MIME type or null
 */
function normalize_mime_type(mime_type) {
    if (!mime_type || typeof mime_type !== 'string') return null;
    const decoded = decode_html_entities(mime_type).toLowerCase().trim();
    return decoded || null;
}

/**
 * Get media type from mime type.
 * Returns null if mime type is missing or unrecognized — callers
 * should use resolve_media_type() for fallback handling.
 */
function get_media_type(mime_type) {
    if (!mime_type) return null;
    return MIME_TO_MEDIA_TYPE[mime_type] || null;
}

/**
 * Resolve media_type with fallback chain:
 *   1. MIME type (sole source of truth)
 *   2. item_type hint (general reference only)
 *   3. 'unknown'
 *
 * @param {string|null} mime_type - MIME type from file extension or v1 record
 * @param {string|null} item_type - v1 item_type value (e.g. 'moving image', 'still image')
 * @returns {string} Resolved media_type
 */
function resolve_media_type(mime_type, item_type) {
    // 1. MIME type is authoritative
    const from_mime = get_media_type(mime_type);
    if (from_mime) return from_mime;

    // 2. Fall back to item_type hint
    if (item_type) {
        const normalized = item_type.toLowerCase().trim();
        const from_item_type = ITEM_TYPE_TO_MEDIA_TYPE[normalized];
        if (from_item_type) return from_item_type;
    }

    // 3. Last resort
    return 'unknown';
}

/**
 * Determine ingest method from v1 item flags
 */
function get_ingest_method(record) {
    if (record.is_kaltura_item === 1) return 'kaltura';
    if (record.is_repo_item === 1) return 'repo';
    return 'upload';
}

/**
 * Serialize an exhibit UUID into the JSON array format used by
 * tbl_media_library.exhibits.  Returns null when the value is
 * missing or the literal string "null" (v1 data artifact) so
 * that the column stays NULL rather than storing '["null"]'.
 *
 * @param {string|null} exhibit_uuid
 * @returns {string|null} JSON array string or null
 */
function serialize_exhibits_value(exhibit_uuid) {
    if (!exhibit_uuid || exhibit_uuid === 'null') return null;
    return JSON.stringify([exhibit_uuid]);
}

/**
 * Human-readable placeholder names for media-library records, keyed by
 * media_type. Used when a v1 item has no title so that a raw filename
 * (often a UUID/timestamp string such as
 * "c5b1d2be-..._1736806587303_item_media.jpg" or a bare repo UUID) is
 * never written to the media `name` (title) field. The original filename
 * is always preserved separately in `original_filename`.
 */
const PLACEHOLDER_MEDIA_NAME = {
    image: 'Untitled image',
    video: 'Untitled video',
    audio: 'Untitled audio',
    pdf: 'Untitled document',
    unknown: 'Untitled item'
};

/**
 * Resolve the media-library `name` (display title) for an item's media.
 * Prefers the v1 item title; NEVER falls back to a filename. When the item
 * has no usable title, returns a media-type-specific placeholder
 * ("Untitled image", "Untitled document", …) so curators can locate and
 * rename the record from the v2 media library later.
 *
 * @param {string|null} item_title - The v1 item.title value (may be null/empty)
 * @param {string} media_type - Resolved media_type (image/video/audio/pdf/unknown)
 * @returns {string} A non-empty display name, capped at 255 chars
 */
function build_media_name(item_title, media_type) {
    if (item_title && typeof item_title === 'string' && item_title.trim()) {
        return item_title.trim().substring(0, 255);
    }
    return PLACEHOLDER_MEDIA_NAME[media_type] || PLACEHOLDER_MEDIA_NAME.unknown;
}

// ─────────────────────────────────────────────
// HTML ENTITY DECODING (v1 double-encoding cleanup)
// ─────────────────────────────────────────────

/**
 * Decode common HTML entities in a string.
 * Loops until the output stabilizes to handle double-encoding
 * (e.g. &amp;lt; → &lt; → <).
 */
function decode_html_entities(str) {
    if (!str || typeof str !== 'string') return str;

    let prev = str;
    let decoded = str;
    let iterations = 0;
    const MAX_ITERATIONS = 5; // safety limit

    do {
        prev = decoded;
        decoded = decoded
            .replace(/&#x2F;/gi, '/')
            .replace(/&#x27;/gi, "'")
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&'); // &amp; last — earlier passes may reveal it
        iterations++;
    } while (decoded !== prev && iterations < MAX_ITERATIONS);

    return decoded;
}

/**
 * Decode HTML entities in specified text fields of a record object.
 * Returns a shallow copy with decoded values; original is not mutated.
 * Tracks how many fields were actually changed for reporting.
 *
 * @param {Object} record - The data object to process
 * @param {string[]} fields - List of field names to decode
 * @returns {{ decoded: Object, changed_count: number }}
 */
function decode_record_text_fields(record, fields) {
    const decoded = { ...record };
    let changed_count = 0;

    for (const field of fields) {
        if (decoded[field] && typeof decoded[field] === 'string') {
            const original = decoded[field];
            decoded[field] = decode_html_entities(original);
            if (decoded[field] !== original) {
                changed_count++;
            }
        }
    }

    return { decoded, changed_count };
}

// Text fields to decode per table type
const DECODE_FIELDS = {
    exhibits: ['title', 'subtitle', 'description', 'alert_text'],
    grids: ['title', 'description'],
    timelines: ['title', 'description'],
    headings: ['title', 'text'],
    standard_items: ['title', 'description', 'text', 'caption', 'wrap_text'],
    grid_items: ['title', 'description', 'text', 'caption', 'wrap_text'],
    timeline_items: ['title', 'description', 'text', 'caption', 'wrap_text'],
    media: ['name', 'description', 'alt_text']
};

/**
 * Resolve actual files on disk for a v1 repo item.
 *
 * v1 repo items store a bare repo UUID in the `media` column, NOT a filename.
 * The actual files on disk follow the convention:
 *   {item_uuid}_repository_item_media.{ext}   (may have multiple: .jpeg, .tif, etc.)
 *   {item_uuid}_repository_item_thumbnail.{ext}
 *
 * Returns { media_files: string[], thumbnail_files: string[] } — arrays of filenames found.
 */
async function resolve_repo_item_files(item_uuid, storage_dir) {
    const result = { media_files: [], thumbnail_files: [] };

    try {
        const files = await fsp.readdir(storage_dir);
        const prefix = `${item_uuid}_repository_item_`;

        for (const filename of files) {
            if (!filename.startsWith(prefix)) continue;
            if (filename.includes('_repository_item_media.')) {
                result.media_files.push(filename);
            } else if (filename.includes('_repository_item_thumbnail.')) {
                result.thumbnail_files.push(filename);
            }
        }
    } catch (err) {
        // Directory may not exist; caller handles empty results
    }

    return result;
}

/**
 * Pick the best media file from a set of repo item file variants.
 * Prefers the derivative (jpeg/png) over the archival original (tif/tiff)
 * since the derivative is what the v1 app actually served.
 * Falls back to whatever is available if no derivative exists.
 */
function pick_preferred_repo_media_file(media_files, mime_type_hint) {
    if (media_files.length === 0) return null;
    if (media_files.length === 1) return media_files[0];

    // Prefer file matching the item's declared mime_type
    if (mime_type_hint) {
        const expected_ext = Object.entries(EXT_TO_MIME)
            .filter(([, mime]) => mime === mime_type_hint)
            .map(([ext]) => ext);
        const match = media_files.find(f =>
            expected_ext.some(ext => f.toLowerCase().endsWith(ext))
        );
        if (match) return match;
    }

    // Prefer derivative formats over archival originals
    const derivative_exts = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.pdf', '.mp4'];
    const derivative = media_files.find(f =>
        derivative_exts.some(ext => f.toLowerCase().endsWith(ext))
    );
    if (derivative) return derivative;

    return media_files[0];
}

// ─────────────────────────────────────────────
// MIGRATION REPORT
// ─────────────────────────────────────────────

const report = {
    started_at: null,
    completed_at: null,
    dry_run: DRY_RUN,

    users: { migrated: 0, skipped: 0, errors: [] },
    auth_tables: { user_role_assignments: 0, errors: [] },

    exhibits: { migrated: 0, skipped: 0, errors: [] },
    grids: { migrated: 0, skipped: 0, errors: [] },
    timelines: { migrated: 0, skipped: 0, errors: [] },
    heading_items: { migrated: 0, skipped: 0, errors: [] },
    standard_items: { migrated: 0, skipped: 0, errors: [] },
    grid_items: { migrated: 0, skipped: 0, errors: [] },
    timeline_items: { migrated: 0, skipped: 0, errors: [] },

    subheadings: { created: 0, exhibits_converted: 0, skipped_existing: 0, errors: [] },

    media_library: { created: 0, errors: [] },
    exhibit_media: { created: 0, errors: [] },
    files_copied: { count: 0, total_bytes: 0, errors: [] },

    thumbnails: { image_generated: 0, pdf_generated: 0, skipped: 0, failed: 0, errors: [] },

    iiif_manifests: { generated: 0, skipped: 0, failed: 0, kaltura_generated: 0, kaltura_skipped: 0, kaltura_failed: 0, error: null },

    styles: {
        exhibit_styles_converted: 0,
        exhibit_styles_skipped_v2: 0,
        exhibit_styles_skipped_null: 0,
        item_presets_exhibits: 0,
        item_presets_items_updated: 0,
        item_presets_exceeds_3: [],
        heading_presets_exhibits: 0,
        heading_presets_updated: 0,
        heading_presets_exceeds_3: [],
        orphan_styles: [],
        errors: []
    },

    html_decoded: { fields: 0, records: 0 },

    orphans: {
        files_without_db_reference: [],
        db_references_without_files: [],
        files_skipped_as_orphans: 0
    }
};

// Module-level set of orphaned v1 file paths (full paths).
// Populated by detect_orphans() before file-copy phases so that
// copy_file_to_v2 and generate_v2_thumbnail can refuse to process them.
const orphaned_v1_files = new Set();

// Module-level map of "First Last" → tbl_users.id.
// Populated once at the start of Phase 6 (first phase that creates
// media library records) and reused through Phase 7.
const user_name_to_id = new Map();

/**
 * Resolve a tbl_users.id from a created_by display name.
 * Returns the integer user ID, or 0 when the name is missing
 * or has no matching user record (matches the column default).
 *
 * @param {string|null} created_by_name - e.g. "Madison Sussmann"
 * @returns {number} User ID or 0
 */
function resolve_owner_id(created_by_name) {
    if (!created_by_name || created_by_name === MIGRATION_USER) return 0;
    return user_name_to_id.get(created_by_name) || 0;
}

// Module-level map of v1 tbl_users.id → v2 tbl_users.id (joined on the stable
// du_id). Populated once by ensure_owner_map(). v2 does NOT preserve v1 user
// ids (migrate_users strips id, so v2 re-numbers users and compacts v1's id
// gaps), which means the raw v1 `owner` integer points at the WRONG v2 user
// unless it is remapped — and v2 uses `owner` for ownership-scoped authorization
// (auth/authorize.js tier-2 fallback), so the value is functionally load-bearing.
const v1_owner_to_v2_id = new Map();

/**
 * Build the v1-owner-id → v2-user-id map once, from the current contents of
 * both user tables. Safe to call repeatedly (no-op once populated) and works
 * whether or not migrate_users inserted this run (it reads whatever v2 users
 * exist). Must be awaited before remap_owner() is used.
 */
async function ensure_owner_map() {
    if (v1_owner_to_v2_id.size > 0) return;
    const [v1_users, v2_users] = await Promise.all([
        v1_db('tbl_users').select('id', 'du_id'),
        v2_db('tbl_users').select('id', 'du_id')
    ]);
    const du_id_to_v2_id = new Map(v2_users.map(u => [u.du_id, u.id]));
    for (const u of v1_users) {
        const v2_id = du_id_to_v2_id.get(u.du_id);
        if (v2_id) v1_owner_to_v2_id.set(u.id, v2_id);
    }
}

/**
 * Remap a v1 `owner` user-id to the corresponding v2 user-id (same du_id).
 * Returns 0 (the column default / "no owner") when the v1 owner is unset or
 * has no matching v2 user. Call ensure_owner_map() first.
 *
 * @param {number|null} v1_owner_id - The raw v1 record `owner` value
 * @returns {number} The v2 tbl_users.id, or 0
 */
function remap_owner(v1_owner_id) {
    if (!v1_owner_id) return 0;
    return v1_owner_to_v2_id.get(v1_owner_id) || 0;
}

// ─────────────────────────────────────────────
// FILE OPERATIONS
// ─────────────────────────────────────────────

/**
 * Copy a file from v1 storage to v2 media-library, creating hash-prefix directories
 */
async function copy_file_to_v2(v1_file_path, v2_relative_path) {

    // Guard: refuse to copy files identified as orphans (no DB reference)
    if (orphaned_v1_files.has(v1_file_path)) {
        report.orphans.files_skipped_as_orphans++;
        console.warn(`  SKIPPED (orphan): ${v1_file_path} — no DB reference`);
        return false;
    }

    const v2_full_path = path.join(V2_MEDIA_LIBRARY_PATH, v2_relative_path);

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would copy: ${v1_file_path} → ${v2_full_path}`);
        return true;
    }

    try {
        const dir = path.dirname(v2_full_path);
        await fsp.mkdir(dir, { recursive: true });
        await fsp.copyFile(v1_file_path, v2_full_path);

        const stats = await fsp.stat(v2_full_path);
        report.files_copied.count++;
        report.files_copied.total_bytes += stats.size;

        console.log(`  Copied: ${path.basename(v1_file_path)} → ${v2_relative_path}`);
        return true;
    } catch (err) {
        const msg = `Failed to copy ${v1_file_path}: ${err.message}`;
        report.files_copied.errors.push(msg);
        console.error(`  ERROR: ${msg}`);
        return false;
    }
}

/**
 * Check if a file exists
 */
async function file_exists(file_path) {
    try {
        await fsp.access(file_path, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get file size in bytes
 */
async function get_file_size(file_path) {
    try {
        const stats = await fsp.stat(file_path);
        return stats.size;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// THUMBNAIL GENERATION
// ─────────────────────────────────────────────

// Match v2 production thumbnail settings (see uploads.js THUMBNAIL_CONFIG)
const THUMBNAIL_CONFIG = { width: 400, height: 400, quality: 80 };

/**
 * Generate a v2-compatible thumbnail from a source file.
 *
 * v2 stores thumbnails as resized JPEGs at:
 *   thumbnails/{uuid[0:2]}/{uuid[2:4]}/{uuid}_thumb.jpg
 *
 * For images: uses Sharp to resize to 400×400 (fit inside) and save as JPEG.
 * For PDFs: renders the first page via pdfjs-dist + @napi-rs/canvas, then
 *   resizes via Sharp — mirrors v2's generate_pdf_thumbnail() in uploads.js.
 *
 * @param {string} v1_source_path - Absolute path to the source file on disk
 * @param {string} v2_thumbnail_relative - Relative thumbnail path (e.g. thumbnails/a3/f7/uuid_thumb.jpg)
 * @param {string} mime_type - MIME type of the source file
 * @returns {Promise<boolean>} Whether the thumbnail was generated successfully
 */
async function generate_v2_thumbnail(v1_source_path, v2_thumbnail_relative, mime_type) {

    // Guard: refuse to generate thumbnails from orphaned files
    if (orphaned_v1_files.has(v1_source_path)) {
        report.orphans.files_skipped_as_orphans++;
        console.warn(`  SKIPPED thumbnail (orphan): ${v1_source_path} — no DB reference`);
        return false;
    }

    if (!mime_type) {
        report.thumbnails.skipped++;
        return false;
    }

    const is_image = mime_type.startsWith('image/');
    const is_pdf = mime_type === 'application/pdf';

    if (!is_image && !is_pdf) {
        report.thumbnails.skipped++;
        console.log(`  Skipping thumbnail (unsupported type: ${mime_type}): ${path.basename(v1_source_path)}`);
        return false;
    }

    const v2_full_path = path.join(V2_MEDIA_LIBRARY_PATH, v2_thumbnail_relative);

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would generate ${is_pdf ? 'PDF' : 'image'} thumbnail: ${v2_thumbnail_relative}`);
        return true;
    }

    try {
        const dir = path.dirname(v2_full_path);
        await fsp.mkdir(dir, { recursive: true });

        if (is_image) {

            await sharp(v1_source_path)
                .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: THUMBNAIL_CONFIG.quality })
                .toFile(v2_full_path);

            report.thumbnails.image_generated++;

        } else if (is_pdf) {

            // Verify PDF thumbnail dependencies are available
            let createCanvas, DOMMatrix, pdfjsLib;

            try {
                const canvas_module = require('@napi-rs/canvas');
                createCanvas = canvas_module.createCanvas;
                DOMMatrix = canvas_module.DOMMatrix;
            } catch (dep_err) {
                const msg = `@napi-rs/canvas not installed — cannot generate PDF thumbnails: ${dep_err.message}`;
                // Log once, then skip all subsequent PDF thumbnails
                if (!report.thumbnails.errors.some(e => e.includes('@napi-rs/canvas not installed'))) {
                    report.thumbnails.errors.push(msg);
                    console.error(`  ERROR: ${msg}`);
                    console.error('  Install with: npm install @napi-rs/canvas');
                }
                report.thumbnails.failed++;
                return false;
            }

            try {
                pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
            } catch (dep_err) {
                const msg = `pdfjs-dist not installed or incompatible — cannot generate PDF thumbnails: ${dep_err.message}`;
                if (!report.thumbnails.errors.some(e => e.includes('pdfjs-dist not installed'))) {
                    report.thumbnails.errors.push(msg);
                    console.error(`  ERROR: ${msg}`);
                    console.error('  Install with: npm install pdfjs-dist');
                }
                report.thumbnails.failed++;
                return false;
            }

            // pdfjs-dist renderer expects DOMMatrix as a global
            if (typeof globalThis.DOMMatrix === 'undefined') {
                globalThis.DOMMatrix = DOMMatrix;
            }

            // Handle ESM default export variations across pdfjs-dist versions
            const getDocument = pdfjsLib.getDocument || (pdfjsLib.default && pdfjsLib.default.getDocument);

            if (!getDocument) {
                const msg = 'pdfjs-dist: getDocument not found — check pdfjs-dist version compatibility';
                report.thumbnails.errors.push(msg);
                report.thumbnails.failed++;
                console.error(`  ERROR: ${msg}`);
                return false;
            }

            const pdf_buffer = await fsp.readFile(v1_source_path);
            const pdf_data = new Uint8Array(pdf_buffer);
            const pdf_document = await getDocument({ data: pdf_data }).promise;

            const page = await pdf_document.getPage(1);

            const unscaled_viewport = page.getViewport({ scale: 1.0 });
            const scale = THUMBNAIL_CONFIG.width / unscaled_viewport.width;
            const viewport = page.getViewport({ scale: scale });

            const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
            const context = canvas.getContext('2d');

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const png_buffer = canvas.toBuffer('image/png');

            await pdf_document.destroy();

            await sharp(png_buffer)
                .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: THUMBNAIL_CONFIG.quality })
                .toFile(v2_full_path);

            report.thumbnails.pdf_generated++;
        }

        report.files_copied.count++;
        const stats = await fsp.stat(v2_full_path);
        report.files_copied.total_bytes += stats.size;

        console.log(`  Generated ${is_pdf ? 'PDF' : 'image'} thumbnail: ${v2_thumbnail_relative}`);
        return true;
    } catch (err) {
        report.thumbnails.failed++;
        const msg = `Failed to generate ${is_pdf ? 'PDF' : 'image'} thumbnail from ${path.basename(v1_source_path)}: ${err.message}`;
        report.thumbnails.errors.push(msg);
        console.error(`  ERROR: ${msg}`);
        return false;
    }
}

// ─────────────────────────────────────────────
// EXIF METADATA EXTRACTION
// ─────────────────────────────────────────────

/**
 * EXIF metadata fields to extract — mirrors v2 uploads.js categories
 */
const EXIF_FIELDS = {
    camera: ['Make', 'Model', 'LensModel', 'Software'],
    format: ['ImageWidth', 'ImageHeight', 'MIMEType', 'FileType', 'FileSize', 'ColorSpace', 'BitsPerSample'],
    capture: ['ExposureTime', 'FNumber', 'ISO', 'FocalLength', 'Flash', 'WhiteBalance', 'ExposureProgram', 'MeteringMode'],
    dates: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    gps: ['GPSLatitude', 'GPSLongitude', 'GPSAltitude'],
    descriptive: ['Title', 'Description', 'Subject', 'Keywords', 'Artist', 'Creator', 'Copyright'],
    pdf: ['PageCount', 'PDFVersion', 'Author', 'Producer', 'CreatorTool']
};

/**
 * Extracts EXIF/metadata from a file, matching v2 uploads.js extract_metadata().
 *
 * @param {string} file_path - Absolute path to the source file
 * @param {string} media_type - Media type category ('image' or 'pdf')
 * @returns {Promise<Object>} Extracted metadata or empty object on failure
 */
async function extract_metadata(file_path, media_type) {

    try {

        const tags = await exiftool.read(file_path);
        const metadata = {};

        let categories;

        if (media_type === 'pdf') {
            categories = ['format', 'dates', 'descriptive', 'pdf'];
        } else if (media_type === 'image') {
            categories = ['camera', 'format', 'capture', 'dates', 'gps', 'descriptive'];
        } else {
            return metadata;
        }

        for (const category of categories) {
            const fields = EXIF_FIELDS[category];

            if (fields) {
                for (const field of fields) {

                    if (tags[field] !== undefined && tags[field] !== null) {
                        const value = tags[field];

                        if (typeof value === 'object' && value !== null && typeof value.toString === 'function' && value.constructor.name !== 'Array') {
                            metadata[field] = value.toString();
                        } else {
                            metadata[field] = value;
                        }
                    }
                }
            }
        }

        return metadata;

    } catch (err) {
        console.error(`  WARN: Metadata extraction failed for ${file_path}: ${err.message}`);
        return {};
    }
}

/**
 * Extracts pixel dimensions and EXIF data from a file.
 * Uses Sharp for image dimensions and exiftool for full EXIF metadata.
 *
 * @param {string} file_path - Absolute path to the source file
 * @param {string} mime_type - MIME type of the file
 * @param {string} media_type - Media type category ('image', 'pdf', etc.)
 * @returns {Promise<Object>} { media_width, media_height, exif_data }
 */
async function extract_file_metadata(file_path, mime_type, media_type) {

    const result = { media_width: null, media_height: null, exif_data: null };

    if (!file_path || !mime_type) return result;

    try {
        // Extract pixel dimensions for images via Sharp
        if (mime_type.startsWith('image/')) {
            try {
                const img_metadata = await sharp(file_path).metadata();
                result.media_width = img_metadata.width || null;
                result.media_height = img_metadata.height || null;
            } catch (dim_err) {
                console.error(`  WARN: Dimension extraction failed for ${path.basename(file_path)}: ${dim_err.message}`);
            }
        }

        // Extract EXIF metadata
        const exif = await extract_metadata(file_path, media_type);

        if (Object.keys(exif).length > 0) {
            result.exif_data = JSON.stringify(exif);
        }

    } catch (err) {
        console.error(`  WARN: File metadata extraction failed for ${path.basename(file_path)}: ${err.message}`);
    }

    return result;
}

// ─────────────────────────────────────────────
// PHASE 1: USERS & AUTH TABLES
// ─────────────────────────────────────────────

async function migrate_users() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 1: Users & Role Assignments');
    console.log('══════════════════════════════════════════');

    // --- Users ---
    const v1_users = await v1_db('tbl_users').select('*');
    const v2_existing = await v2_db('tbl_users').select('du_id');
    const existing_du_ids = new Set(v2_existing.map(u => u.du_id));

    for (const user of v1_users) {
        if (existing_du_ids.has(user.du_id)) {
            report.users.skipped++;
            console.log(`  Skipping user ${user.du_id} (already exists)`);
            continue;
        }

        // v2 removed the token__ column
        const { id, token__, ...user_data } = user;

        if (!DRY_RUN) {
            try {
                await v2_db('tbl_users').insert(user_data);
                report.users.migrated++;
                console.log(`  Migrated user: ${user.du_id} (${user.first_name} ${user.last_name})`);
            } catch (err) {
                report.users.errors.push(`User ${user.du_id}: ${err.message}`);
                console.error(`  ERROR migrating user ${user.du_id}: ${err.message}`);
            }
        } else {
            report.users.migrated++;
            console.log(`  [DRY RUN] Would migrate user: ${user.du_id}`);
        }
    }

    // --- Role assignments (ctbl_user_roles) ---
    //
    // Roles, permissions, and the role→permission grant matrix are NOT migrated
    // from v1. They are the v2 application's own canonical RBAC, established by the
    // backend seeds (db/seeds/01_user_roles, 02_user_permissions, 03_role_permissions
    // — run `knex seed:run` after `knex migrate:latest`, before this migration).
    // Copying v1's definitions was the wrong layer AND broken in practice: v1's
    // tbl_user_permissions carries a `has_permission` column that v2 dropped, so the
    // inserts threw and were silently swallowed. The migration owns only the people:
    // users (above) and which role each user holds (below).
    //
    // Both keys differ between v1 and v2 (v2 re-numbers users; roles come from the
    // seed), so each is remapped by a STABLE identifier — user via du_id, role via
    // role name — never by raw id.

    // user: v1 id → du_id → v2 id (query v2 after the user migration above).
    const v1_id_to_du_id = new Map(v1_users.map(u => [u.id, u.du_id]));
    const v2_all_users = await v2_db('tbl_users').select('id', 'du_id');
    const du_id_to_v2_id = new Map(v2_all_users.map(u => [u.du_id, u.id]));

    // role: v1 role_id → role name → v2 role_id (roles are seeded into v2).
    const v1_roles = await v1_db('tbl_user_roles').select('id', 'role');
    const v2_roles = await v2_db('tbl_user_roles').select('id', 'role');
    const v1_role_id_to_name = new Map(v1_roles.map(r => [r.id, r.role]));
    const role_name_to_v2_id = new Map(v2_roles.map(r => [r.role, r.id]));

    if (role_name_to_v2_id.size === 0) {
        console.warn('  WARNING: no roles in v2 — run the backend seeds (knex seed:run) before this migration; role assignments will be skipped.');
    }

    // Existing v2 (user_id, role_id) pairs, to avoid duplicates on re-runs.
    const v2_existing_ur = await v2_db('ctbl_user_roles').select('user_id', 'role_id');
    const existing_ur_pairs = new Set(v2_existing_ur.map(r => `${r.user_id}:${r.role_id}`));

    const v1_user_roles = await v1_db('ctbl_user_roles').select('*');

    for (const ur of v1_user_roles) {

        // Remap user: v1 user_id → du_id → v2 user_id.
        const du_id = v1_id_to_du_id.get(ur.user_id);
        if (!du_id) {
            console.warn(`  WARNING: ctbl_user_roles row ${ur.id} references v1 user_id ${ur.user_id} which has no du_id — skipping`);
            continue;
        }
        const v2_user_id = du_id_to_v2_id.get(du_id);
        if (!v2_user_id) {
            console.warn(`  WARNING: ctbl_user_roles row ${ur.id} — user ${du_id} not found in v2 — skipping`);
            continue;
        }

        // Remap role: v1 role_id → role name → v2 role_id (from the seed).
        const role_name = v1_role_id_to_name.get(ur.role_id);
        const v2_role_id = role_name ? role_name_to_v2_id.get(role_name) : undefined;
        if (!v2_role_id) {
            console.warn(`  WARNING: ctbl_user_roles row ${ur.id} — v1 role "${role_name || ur.role_id}" has no matching seeded v2 role — skipping`);
            continue;
        }

        // Skip if this (user_id, role_id) pair already exists in v2.
        const pair_key = `${v2_user_id}:${v2_role_id}`;
        if (existing_ur_pairs.has(pair_key)) continue;

        if (!DRY_RUN) {
            try {
                await v2_db('ctbl_user_roles').insert({ user_id: v2_user_id, role_id: v2_role_id });
                report.auth_tables.user_role_assignments++;
                existing_ur_pairs.add(pair_key);
                console.log(`  Assigned role: ${du_id} (v2 user ${v2_user_id}) → ${role_name} (v2 role ${v2_role_id})`);
            } catch (err) {
                // v2 enforces UNIQUE(user_id) (one role per user); surface real failures
                // instead of swallowing them (the bug that hid the broken perm copy).
                report.auth_tables.errors.push(`ctbl_user_roles row ${ur.id} (${du_id} → ${role_name}): ${err.message}`);
                console.error(`  ERROR assigning role for ${du_id}: ${err.message}`);
            }
        } else {
            report.auth_tables.user_role_assignments++;
            console.log(`  [DRY RUN] Would assign role: ${du_id} → ${role_name}`);
        }
    }

    console.log(`  Users: ${report.users.migrated} migrated, ${report.users.skipped} skipped; role assignments: ${report.auth_tables.user_role_assignments}`);
}

// ─────────────────────────────────────────────
// PHASE 2: EXHIBITS
// ─────────────────────────────────────────────

async function migrate_exhibits() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 2: Exhibits');
    console.log('══════════════════════════════════════════');

    await ensure_owner_map();

    const v1_exhibits = await v1_db('tbl_exhibits').select('*');
    const v2_existing = await v2_db('tbl_exhibits').select('uuid');
    const existing_uuids = new Set(v2_existing.map(e => e.uuid));

    for (const exhibit of v1_exhibits) {
        if (existing_uuids.has(exhibit.uuid)) {
            report.exhibits.skipped++;
            console.log(`  Skipping exhibit ${exhibit.uuid} (already exists)`);
            continue;
        }

        // Map v1 fields to v2 — drop id (auto-increment), exhibit_owner (removed in v2)
        // Add new v2 columns with defaults
        const { id, exhibit_owner, ...raw_exhibit_data } = exhibit;

        // Decode double-encoded HTML entities from v1
        const { decoded: exhibit_data, changed_count: ex_changed } = decode_record_text_fields(raw_exhibit_data, DECODE_FIELDS.exhibits);
        if (ex_changed > 0) {
            report.html_decoded.records++;
            report.html_decoded.fields += ex_changed;
            console.log(`  Decoded ${ex_changed} HTML-encoded field(s) in exhibit ${exhibit.uuid}`);
        }

        const v2_exhibit = {
            ...exhibit_data,
            owner: remap_owner(exhibit.owner),  // remap v1 owner id → v2 user id (v2 renumbers users)
            hero_image_media_uuid: null,    // will be set in Phase 6
            thumbnail_media_uuid: null,     // will be set in Phase 6
            locked_at: null
        };

        if (!DRY_RUN) {
            try {
                await v2_db('tbl_exhibits').insert(v2_exhibit);
                report.exhibits.migrated++;
                console.log(`  Migrated exhibit: ${exhibit.uuid} — ${exhibit.title.substring(0, 60)}`);
            } catch (err) {
                report.exhibits.errors.push(`Exhibit ${exhibit.uuid}: ${err.message}`);
                console.error(`  ERROR: Exhibit ${exhibit.uuid}: ${err.message}`);
            }
        } else {
            report.exhibits.migrated++;
            console.log(`  [DRY RUN] Would migrate exhibit: ${exhibit.uuid}`);
        }
    }

    console.log(`  Exhibits: ${report.exhibits.migrated} migrated, ${report.exhibits.skipped} skipped`);
}

// ─────────────────────────────────────────────
// PHASE 3: CONTAINER RECORDS (grids, timelines, headings)
// ─────────────────────────────────────────────

async function migrate_containers() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 3: Grids, Timelines, Heading Items');
    console.log('══════════════════════════════════════════');

    await ensure_owner_map();

    // --- Grids ---
    const v1_grids = await v1_db('tbl_grids').select('*');
    const v2_existing_grids = await v2_db('tbl_grids').select('uuid');
    const existing_grid_uuids = new Set(v2_existing_grids.map(g => g.uuid));

    for (const grid of v1_grids) {
        if (existing_grid_uuids.has(grid.uuid)) {
            report.grids.skipped++;
            continue;
        }
        // v2 dropped tbl_grids.title (titles-to-subheadings migration 20260403200926).
        // Strip it from the insert; non-empty titles are recreated as subheadings
        // in convert_titles_to_subheadings() (Phase 4.5).
        const { id, title, ...raw_grid_data } = grid;
        const { decoded: grid_data, changed_count: g_changed } = decode_record_text_fields(raw_grid_data, DECODE_FIELDS.grids);
        if (g_changed > 0) {
            report.html_decoded.records++;
            report.html_decoded.fields += g_changed;
        }
        if (!DRY_RUN) {
            try {
                await v2_db('tbl_grids').insert({ ...grid_data, owner: remap_owner(grid.owner) });
                report.grids.migrated++;
            } catch (err) {
                report.grids.errors.push(`Grid ${grid.uuid}: ${err.message}`);
            }
        } else {
            report.grids.migrated++;
        }
    }
    console.log(`  Grids: ${report.grids.migrated} migrated, ${report.grids.skipped} skipped`);

    // --- Timelines ---
    const v1_timelines = await v1_db('tbl_timelines').select('*');
    const v2_existing_timelines = await v2_db('tbl_timelines').select('uuid');
    const existing_timeline_uuids = new Set(v2_existing_timelines.map(t => t.uuid));

    for (const timeline of v1_timelines) {
        if (existing_timeline_uuids.has(timeline.uuid)) {
            report.timelines.skipped++;
            continue;
        }
        // v2 dropped tbl_timelines.title (titles-to-subheadings migration 20260403200926).
        // Strip it from the insert; recreated as subheadings in Phase 4.5.
        const { id, title, ...raw_timeline_data } = timeline;
        const { decoded: timeline_data, changed_count: t_changed } = decode_record_text_fields(raw_timeline_data, DECODE_FIELDS.timelines);
        if (t_changed > 0) {
            report.html_decoded.records++;
            report.html_decoded.fields += t_changed;
        }
        if (!DRY_RUN) {
            try {
                await v2_db('tbl_timelines').insert({ ...timeline_data, owner: remap_owner(timeline.owner) });
                report.timelines.migrated++;
            } catch (err) {
                report.timelines.errors.push(`Timeline ${timeline.uuid}: ${err.message}`);
            }
        } else {
            report.timelines.migrated++;
        }
    }
    console.log(`  Timelines: ${report.timelines.migrated} migrated, ${report.timelines.skipped} skipped`);

    // --- Heading Items ---
    const v1_headings = await v1_db('tbl_heading_items').select('*');
    const v2_existing_headings = await v2_db('tbl_heading_items').select('uuid');
    const existing_heading_uuids = new Set(v2_existing_headings.map(h => h.uuid));

    for (const heading of v1_headings) {
        if (existing_heading_uuids.has(heading.uuid)) {
            report.heading_items.skipped++;
            continue;
        }
        const { id, ...raw_heading_data } = heading;
        const { decoded: heading_data, changed_count: h_changed } = decode_record_text_fields(raw_heading_data, DECODE_FIELDS.headings);
        if (h_changed > 0) {
            report.html_decoded.records++;
            report.html_decoded.fields += h_changed;
        }
        if (!DRY_RUN) {
            try {
                await v2_db('tbl_heading_items').insert({ ...heading_data, owner: remap_owner(heading.owner), locked_at: null });
                report.heading_items.migrated++;
            } catch (err) {
                report.heading_items.errors.push(`Heading ${heading.uuid}: ${err.message}`);
            }
        } else {
            report.heading_items.migrated++;
        }
    }
    console.log(`  Headings: ${report.heading_items.migrated} migrated, ${report.heading_items.skipped} skipped`);
}

// ─────────────────────────────────────────────
// PHASE 4: ITEM RECORDS (standard, grid, timeline items)
// ─────────────────────────────────────────────

async function migrate_items() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 4: Standard Items, Grid Items, Timeline Items');
    console.log('══════════════════════════════════════════');

    await ensure_owner_map();

    // --- Standard Items ---
    const v1_standard = await v1_db('tbl_standard_items').select('*');
    const v2_existing_standard = await v2_db('tbl_standard_items').select('uuid');
    const existing_standard_uuids = new Set(v2_existing_standard.map(i => i.uuid));

    for (const item of v1_standard) {
        if (existing_standard_uuids.has(item.uuid)) {
            report.standard_items.skipped++;
            continue;
        }
        // v2 dropped tbl_standard_items.title (titles-to-subheadings migration 20260403200926).
        // Strip it from the insert; recreated as subheadings in Phase 4.5.
        const { id, title, ...raw_item_data } = item;
        const { decoded: item_data, changed_count: si_changed } = decode_record_text_fields(raw_item_data, DECODE_FIELDS.standard_items);
        if (si_changed > 0) {
            report.html_decoded.records++;
            report.html_decoded.fields += si_changed;
        }
        if (!DRY_RUN) {
            try {
                await v2_db('tbl_standard_items').insert({
                    ...item_data,
                    owner: remap_owner(item.owner),  // remap v1 owner id → v2 user id
                    media_uuid: null,               // will be set in Phase 7
                    thumbnail_media_uuid: null,     // will be set in Phase 7
                    locked_at: null
                });
                report.standard_items.migrated++;
            } catch (err) {
                report.standard_items.errors.push(`Standard item ${item.uuid}: ${err.message}`);
            }
        } else {
            report.standard_items.migrated++;
        }
    }
    console.log(`  Standard items: ${report.standard_items.migrated} migrated, ${report.standard_items.skipped} skipped`);

    // --- Grid Items ---
    const v1_grid_items = await v1_db('tbl_grid_items').select('*');
    const v2_existing_grid_items = await v2_db('tbl_grid_items').select('uuid');
    const existing_grid_item_uuids = new Set(v2_existing_grid_items.map(i => i.uuid));

    for (const item of v1_grid_items) {
        if (existing_grid_item_uuids.has(item.uuid)) {
            report.grid_items.skipped++;
            continue;
        }
        const { id, date, ...raw_item_data } = item;
        const { decoded: item_data, changed_count: gi_changed } = decode_record_text_fields(raw_item_data, DECODE_FIELDS.grid_items);
        if (gi_changed > 0) {
            report.html_decoded.records++;
            report.html_decoded.fields += gi_changed;
        }
        if (!DRY_RUN) {
            try {
                await v2_db('tbl_grid_items').insert({
                    ...item_data,
                    owner: remap_owner(item.owner),  // remap v1 owner id → v2 user id
                    media_uuid: null,
                    thumbnail_media_uuid: null,
                    locked_at: null
                });
                report.grid_items.migrated++;
            } catch (err) {
                report.grid_items.errors.push(`Grid item ${item.uuid}: ${err.message}`);
            }
        } else {
            report.grid_items.migrated++;
        }
    }
    console.log(`  Grid items: ${report.grid_items.migrated} migrated, ${report.grid_items.skipped} skipped`);

    // --- Timeline Items ---
    const v1_timeline_items = await v1_db('tbl_timeline_items').select('*');
    const v2_existing_timeline_items = await v2_db('tbl_timeline_items').select('uuid');
    const existing_timeline_item_uuids = new Set(v2_existing_timeline_items.map(i => i.uuid));

    for (const item of v1_timeline_items) {
        if (existing_timeline_item_uuids.has(item.uuid)) {
            report.timeline_items.skipped++;
            continue;
        }
        const { id, ...raw_item_data } = item;
        const { decoded: item_data, changed_count: ti_changed } = decode_record_text_fields(raw_item_data, DECODE_FIELDS.timeline_items);
        if (ti_changed > 0) {
            report.html_decoded.records++;
            report.html_decoded.fields += ti_changed;
        }
        if (!DRY_RUN) {
            try {
                await v2_db('tbl_timeline_items').insert({
                    ...item_data,
                    owner: remap_owner(item.owner),  // remap v1 owner id → v2 user id
                    media_uuid: null,
                    thumbnail_media_uuid: null,
                    locked_at: null
                });
                report.timeline_items.migrated++;
            } catch (err) {
                report.timeline_items.errors.push(`Timeline item ${item.uuid}: ${err.message}`);
            }
        } else {
            report.timeline_items.migrated++;
        }
    }
    console.log(`  Timeline items: ${report.timeline_items.migrated} migrated, ${report.timeline_items.skipped} skipped`);
}

// ─────────────────────────────────────────────
// PHASE 4.5: TITLES → SUBHEADINGS
// ─────────────────────────────────────────────
//
// v2 migration 20260403200926 ("titles-to-subheadings") converted the
// `title` of every top-level exhibit member (standard items, grids,
// timelines) into a standalone `subheading` heading-item and then DROPPED
// those `title` columns. v1 still carries titles on those tables, so we
// replicate that transformation here: each titled member becomes a
// subheading placed immediately before it, and every member at/after that
// position is shifted down by one in the exhibit-wide `order` sequence.
//
// Subheading UUIDs are derived deterministically from the source member
// UUID (uuidv5), so the phase is idempotent — a re-run detects existing
// subheadings and skips the exhibit instead of re-shifting orders.

// Fixed (valid) namespace UUID for deterministic subheading UUID generation.
const SUBHEADING_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

// Default (empty) style preset, matching the v2 knex migration's subheadings.
const SUBHEADING_DEFAULT_STYLES = JSON.stringify({
    backgroundColor: '',
    color: '',
    fontFamily: '',
    fontSize: ''
});

/**
 * Deterministic subheading UUID for a given source member UUID.
 * Stable across runs so the conversion phase is idempotent.
 */
function subheading_uuid_for(member_uuid) {
    return uuidv5(`${member_uuid}:subheading`, SUBHEADING_NAMESPACE);
}

async function convert_titles_to_subheadings() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 4.5: Titles → Subheadings');
    console.log('══════════════════════════════════════════');

    // v1 tables whose `title` becomes a subheading.
    const titled_tables = ['tbl_standard_items', 'tbl_grids', 'tbl_timelines'];

    // All v2 member tables that share the exhibit-wide `order` sequence and
    // therefore must be shifted to make room for inserted subheadings.
    const order_member_tables = ['tbl_heading_items', 'tbl_standard_items', 'tbl_grids', 'tbl_timelines'];

    const v1_exhibits = await v1_db('tbl_exhibits').select('uuid');

    for (const { uuid: exhibit_uuid } of v1_exhibits) {

        // Only process exhibits that exist in v2.
        const v2_exhibit = await v2_db('tbl_exhibits').where('uuid', exhibit_uuid).first();
        if (!v2_exhibit) continue;

        // Collect v1 titles for this exhibit's titled members.
        // Map: source member uuid → { title, created_by, updated_by }
        const title_by_uuid = new Map();
        for (const table of titled_tables) {
            const rows = await v1_db(table)
                .select('uuid', 'title', 'created_by', 'updated_by')
                .where({ is_member_of_exhibit: exhibit_uuid, is_deleted: 0 });
            for (const row of rows) {
                const title = (row.title && typeof row.title === 'string') ? row.title.trim() : '';
                if (title) {
                    title_by_uuid.set(row.uuid, { title, created_by: row.created_by, updated_by: row.updated_by });
                }
            }
        }

        if (title_by_uuid.size === 0) continue; // nothing to convert

        // Idempotency: have the subheadings for these members already been created?
        const expected_uuids = [...title_by_uuid.keys()].map(subheading_uuid_for);
        const existing = await v2_db('tbl_heading_items').whereIn('uuid', expected_uuids).select('uuid');

        if (existing.length === expected_uuids.length) {
            report.subheadings.skipped_existing += existing.length;
            console.log(`  Skipping exhibit ${exhibit_uuid} (${existing.length} subheading(s) already exist)`);
            continue;
        }
        if (existing.length > 0) {
            const msg = `Exhibit ${exhibit_uuid}: partial subheading state (${existing.length}/${expected_uuids.length}) — skipped to avoid corrupting order; manual review needed`;
            report.subheadings.errors.push(msg);
            console.warn(`  WARNING: ${msg}`);
            continue;
        }

        // Gather ALL current v2 members for this exhibit so the order-shift
        // covers every member type (matches the v2 migration's behavior).
        let members = [];
        for (const table of order_member_tables) {
            const rows = await v2_db(table)
                .select('uuid', 'order', 'is_published', 'owner')
                .where({ is_member_of_exhibit: exhibit_uuid, is_deleted: 0 });
            for (const row of rows) {
                members.push({
                    uuid: row.uuid,
                    order: Number(row.order),
                    is_published: row.is_published,
                    owner: row.owner,
                    table
                });
            }
        }

        // Build one subheading per titled member, anchored at the member's
        // current order. Carry over published state and ownership so a
        // published exhibit does not silently lose its section titles.
        let new_subheadings = [];
        for (const [member_uuid, meta] of title_by_uuid.entries()) {
            const member = members.find(m => m.uuid === member_uuid);
            if (!member) continue; // member absent from v2 (skipped) — no anchor to place before
            new_subheadings.push({
                uuid: subheading_uuid_for(member_uuid),
                _anchor_order: member.order,
                is_member_of_exhibit: exhibit_uuid,
                type: 'subheading',
                text: decode_html_entities(meta.title),
                order: member.order,
                styles: SUBHEADING_DEFAULT_STYLES,
                is_published: member.is_published,
                owner: member.owner,
                created_by: meta.created_by || MIGRATION_USER,
                updated_by: meta.updated_by || MIGRATION_USER
            });
        }

        if (new_subheadings.length === 0) continue;

        // Cascading order-shift using the v2 knex migration's rules: for each
        // anchor (in original-order terms), bump every member at/after it by +1
        // and every subheading strictly after it by +1. Anchors are processed
        // highest-order-first so each subheading lands immediately before its
        // member with contiguous orders — avoiding the order ties the v2
        // migration's unsorted sequence could produce for adjacent titled
        // members (member orders are unique within an exhibit in v1).
        const anchors = new_subheadings.map(s => s._anchor_order).sort((a, b) => b - a);
        for (const anchor of anchors) {
            members = members.map(m => ({
                ...m,
                order: m.order >= anchor ? m.order + 1 : m.order
            }));
            new_subheadings = new_subheadings.map(s => ({
                ...s,
                order: s.order > anchor ? s.order + 1 : s.order
            }));
        }

        if (DRY_RUN) {
            console.log(`  [DRY RUN] Would create ${new_subheadings.length} subheading(s) for exhibit ${exhibit_uuid}`);
            report.subheadings.created += new_subheadings.length;
            report.subheadings.exhibits_converted++;
            continue;
        }

        try {
            await v2_db.transaction(async (trx) => {
                await trx('tbl_heading_items').insert(
                    new_subheadings.map(({ _anchor_order, ...row }) => row)
                );
                for (const m of members) {
                    await trx(m.table).update({ order: m.order }).where('uuid', m.uuid);
                }
            });
            report.subheadings.created += new_subheadings.length;
            report.subheadings.exhibits_converted++;
            console.log(`  Exhibit ${exhibit_uuid}: created ${new_subheadings.length} subheading(s) from member titles`);
        } catch (err) {
            report.subheadings.errors.push(`Exhibit ${exhibit_uuid}: ${err.message}`);
            console.error(`  ERROR converting titles for exhibit ${exhibit_uuid}: ${err.message}`);
        }
    }

    console.log(`  Subheadings created: ${report.subheadings.created} across ${report.subheadings.exhibits_converted} exhibit(s); ${report.subheadings.skipped_existing} already existed`);
}

// ─────────────────────────────────────────────
// PHASE 6: EXHIBIT MEDIA → MEDIA LIBRARY
// ─────────────────────────────────────────────

async function migrate_exhibit_media() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 6: Exhibit Media → Media Library');
    console.log('══════════════════════════════════════════');

    // Build user name → id lookup (once, reused by Phase 7)
    if (user_name_to_id.size === 0) {
        const v2_users = await v2_db('tbl_users').select('id', 'first_name', 'last_name');
        for (const u of v2_users) {
            const full_name = `${u.first_name} ${u.last_name}`.trim();
            if (full_name) user_name_to_id.set(full_name, u.id);
        }
        console.log(`  Built user lookup: ${user_name_to_id.size} users`);
    }

    // Process ALL v1 exhibits (including those already in v2 that may lack media library records)
    const v1_exhibits = await v1_db('tbl_exhibits').select(
        'uuid', 'title', 'hero_image', 'thumbnail', 'created', 'created_by'
    );

    for (const exhibit of v1_exhibits) {

        // Check if this exhibit exists in v2
        const v2_exhibit = await v2_db('tbl_exhibits')
            .where('uuid', exhibit.uuid)
            .first();

        if (!v2_exhibit) {
            console.log(`  Skipping exhibit media for ${exhibit.uuid} (exhibit not in v2)`);
            continue;
        }

        const exhibit_storage_dir = path.join(V1_STORAGE_PATH, exhibit.uuid);

        // --- Hero Image ---
        if (exhibit.hero_image) {
            await create_exhibit_media_record(
                exhibit, v2_exhibit, exhibit.hero_image, 'hero_image', exhibit_storage_dir
            );
        }

        // --- Thumbnail ---
        if (exhibit.thumbnail) {
            await create_exhibit_media_record(
                exhibit, v2_exhibit, exhibit.thumbnail, 'thumbnail', exhibit_storage_dir
            );
        }
    }

    console.log(`  Media library records created: ${report.media_library.created}`);
    console.log(`  Exhibit media links created: ${report.exhibit_media.created}`);
}

/**
 * Create a media library record for an exhibit hero_image or thumbnail,
 * copy the file, update the exhibit, and create the tbl_exhibit_media link.
 */
async function create_exhibit_media_record(exhibit, v2_exhibit, filename, role, storage_dir) {

    // Determine the UUID column to check/set
    const uuid_column = role === 'hero_image' ? 'hero_image_media_uuid' : 'thumbnail_media_uuid';

    // Skip if this exhibit already has a media UUID for this role
    if (v2_exhibit[uuid_column]) {
        console.log(`  Skipping ${role} for exhibit ${exhibit.uuid} (already has media_uuid)`);
        return;
    }

    const v1_file_path = path.join(storage_dir, filename);
    const ext = path.extname(filename).toLowerCase();
    const mime_type = get_mime_type(filename);
    const media_type = resolve_media_type(mime_type, 'still image');
    const media_uuid = uuidv4();

    // Check if source file exists
    const exists = await file_exists(v1_file_path);
    if (!exists) {
        const msg = `Exhibit ${exhibit.uuid} ${role}: file not found — ${v1_file_path}`;
        report.orphans.db_references_without_files.push(msg);
        console.warn(`  WARNING: ${msg}`);
        return;
    }

    const file_size = await get_file_size(v1_file_path);
    const v2_storage_path = build_v2_storage_path(media_uuid, ext, mime_type);

    // Derive a human-readable name
    const name = `${exhibit.title.substring(0, 100)} — ${role === 'hero_image' ? 'Hero Image' : 'Thumbnail'}`;

    // Extract EXIF data and image dimensions from the v1 source file
    const file_meta = await extract_file_metadata(v1_file_path, mime_type, media_type);

    const media_record = {
        uuid: media_uuid,
        name: name,
        description: null,
        alt_text: null,
        is_alt_text_decorative: 0,
        media_type: media_type,
        mime_type: mime_type,
        item_type: 'still image',
        filename: `${media_uuid}${ext}`,
        original_filename: filename,
        ingest_method: 'upload',
        repo_uuid: null,
        repo_handle: null,
        kaltura_entry_id: null,
        kaltura_thumbnail_url: null,
        exhibits: JSON.stringify([exhibit.uuid]),
        size: file_size,
        storage_path: v2_storage_path,
        thumbnail_path: build_v2_thumbnail_path(media_uuid),
        exif_data: file_meta.exif_data,
        media_width: file_meta.media_width,
        media_height: file_meta.media_height,
        is_deleted: 0,
        owner: resolve_owner_id(exhibit.created_by),
        created: exhibit.created,
        created_by: exhibit.created_by || MIGRATION_USER,
        updated_by: MIGRATION_USER
    };

    // Decode double-encoded HTML entities in media text fields
    const { decoded: decoded_media, changed_count: em_changed } = decode_record_text_fields(media_record, DECODE_FIELDS.media);
    if (em_changed > 0) {
        report.html_decoded.records++;
        report.html_decoded.fields += em_changed;
    }

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create media library record for exhibit ${exhibit.uuid} ${role}: ${media_uuid}`);
        report.media_library.created++;
        report.exhibit_media.created++;
        return;
    }

    try {
        // 1. Create media library record
        await v2_db('tbl_media_library').insert(decoded_media);
        report.media_library.created++;

        // 2. Copy file to v2 storage
        await copy_file_to_v2(v1_file_path, v2_storage_path);

        // 3. Generate thumbnail in v2 thumbnails directory
        await generate_v2_thumbnail(v1_file_path, build_v2_thumbnail_path(media_uuid), mime_type);

        // 4. Update exhibit with media UUID
        await v2_db('tbl_exhibits')
            .where('uuid', exhibit.uuid)
            .update({ [uuid_column]: media_uuid });

        // 5. Create tbl_exhibit_media linking record
        // Hard-delete any stale soft-deleted rows first (unique constraint pattern)
        await v2_db('tbl_exhibit_media')
            .where({ exhibit_uuid: exhibit.uuid, media_role: role, is_deleted: 1 })
            .del();

        await v2_db('tbl_exhibit_media').insert({
            exhibit_uuid: exhibit.uuid,
            media_uuid: media_uuid,
            media_role: role,
            is_deleted: 0,
            created_by: MIGRATION_USER
        });
        report.exhibit_media.created++;

        console.log(`  Created ${role} media for exhibit ${exhibit.uuid}: ${media_uuid}`);
    } catch (err) {
        report.media_library.errors.push(`Exhibit ${exhibit.uuid} ${role}: ${err.message}`);
        console.error(`  ERROR: Exhibit ${exhibit.uuid} ${role}: ${err.message}`);
    }
}

// ─────────────────────────────────────────────
// PHASE 7: ITEM MEDIA → MEDIA LIBRARY
// ─────────────────────────────────────────────

async function migrate_item_media() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 7: Item Media → Media Library');
    console.log('══════════════════════════════════════════');

    const item_tables = [
        { table: 'tbl_standard_items', label: 'standard' },
        { table: 'tbl_grid_items', label: 'grid' },
        { table: 'tbl_timeline_items', label: 'timeline' }
    ];

    for (const { table, label } of item_tables) {
        console.log(`\n  --- ${label} items ---`);

        const v1_items = await v1_db(table).select('*');

        for (const item of v1_items) {

            // Skip items without media
            if (!item.media && !item.thumbnail) continue;

            // Check if this item exists in v2
            const v2_item = await v2_db(table)
                .where('uuid', item.uuid)
                .first();

            if (!v2_item) {
                console.log(`  Skipping ${label} item ${item.uuid} (not in v2)`);
                continue;
            }

            const exhibit_uuid = item.is_member_of_exhibit;
            const exhibit_storage_dir = path.join(V1_STORAGE_PATH, exhibit_uuid);

            // --- Primary media ---
            if (item.media && !v2_item.media_uuid) {
                await create_item_media_record(item, v2_item, table, label, exhibit_storage_dir);
            } else if (item.media && v2_item.media_uuid) {
                console.log(`  Skipping ${label} item ${item.uuid} media (already has media_uuid)`);
            }

            // --- Item thumbnail (separate file from primary media) ---
            if (item.thumbnail && !v2_item.thumbnail_media_uuid) {
                await create_item_thumbnail_record(item, v2_item, table, label, exhibit_storage_dir);
            } else if (item.thumbnail && v2_item.thumbnail_media_uuid) {
                console.log(`  Skipping ${label} item ${item.uuid} thumbnail (already has thumbnail_media_uuid)`);
            }
        }
    }

    console.log(`\n  Total media library records created: ${report.media_library.created}`);
}

/**
 * Create a media library record for an item's media,
 * copy the file, and update the item record with media_uuid.
 */
async function create_item_media_record(item, v2_item, table, label, storage_dir) {

    const media_uuid = uuidv4();
    const ingest_method = get_ingest_method(item);
    const filename = item.media;
    const ext = filename ? path.extname(filename).toLowerCase() : '';
    const mime_type = normalize_mime_type(item.mime_type) || get_mime_type(filename);
    const media_type = resolve_media_type(mime_type, item.item_type);

    // --- Kaltura items: no physical file, just metadata ---
    if (ingest_method === 'kaltura') {
        const kaltura_media_type = (media_type === 'image' || media_type === 'unknown') ? 'video' : media_type; // Kaltura is typically video/audio
        const media_record = {
            uuid: media_uuid,
            name: build_media_name(item.title, kaltura_media_type),
            description: item.description || null,
            alt_text: item.alt_text || null,
            is_alt_text_decorative: item.is_alt_text_decorative || 0,
            media_type: kaltura_media_type,
            mime_type: mime_type,
            item_type: resolve_item_type(item.item_type, kaltura_media_type),
            filename: null,
            original_filename: filename || '',
            ingest_method: 'kaltura',
            repo_uuid: null,
            repo_handle: null,
            kaltura_entry_id: item.media || null,   // v1 may store entry_id in media field
            kaltura_thumbnail_url: item.thumbnail || null,
            exhibits: serialize_exhibits_value(item.is_member_of_exhibit),
            size: null,
            storage_path: null,
            thumbnail_path: null,
            is_deleted: 0,
            owner: resolve_owner_id(item.created_by),
            created: item.created,
            created_by: item.created_by || MIGRATION_USER,
            updated_by: MIGRATION_USER
        };

        if (DRY_RUN) {
            console.log(`  [DRY RUN] Would create Kaltura media record for ${label} item ${item.uuid}: ${media_uuid}`);
            report.media_library.created++;
            return;
        }

        // Decode double-encoded HTML entities in media text fields
        const { decoded: decoded_kaltura_record, changed_count: k_changed } = decode_record_text_fields(media_record, DECODE_FIELDS.media);
        if (k_changed > 0) {
            report.html_decoded.records++;
            report.html_decoded.fields += k_changed;
        }

        try {
            await v2_db('tbl_media_library').insert(decoded_kaltura_record);
            await v2_db(table).where('uuid', item.uuid).update({ media_uuid: media_uuid });
            report.media_library.created++;
            console.log(`  Created Kaltura media for ${label} item ${item.uuid}: ${media_uuid}`);
        } catch (err) {
            report.media_library.errors.push(`${label} item ${item.uuid} (kaltura): ${err.message}`);
            console.error(`  ERROR: ${label} item ${item.uuid}: ${err.message}`);
        }
        return;
    }

    // --- Uploaded / Repo items: physical file expected ---

    // For repo items, the `media` column stores a bare repo UUID, NOT a filename.
    // The actual files on disk follow: {item_uuid}_repository_item_media.{ext}
    // Resolve the real filename before proceeding.
    let resolved_filename = filename;

    if (ingest_method === 'repo') {
        const repo_files = await resolve_repo_item_files(item.uuid, storage_dir);
        const preferred = pick_preferred_repo_media_file(repo_files.media_files, mime_type);

        if (preferred) {
            resolved_filename = preferred;
            console.log(`  Resolved repo item ${item.uuid} media: ${filename} → ${resolved_filename}`);
        } else if (!filename) {
            console.log(`  Skipping ${label} item ${item.uuid} (no media filename and no repo files on disk)`);
            return;
        }
        // If no repo files found, fall through — will be caught by exists check below
    } else if (!filename) {
        console.log(`  Skipping ${label} item ${item.uuid} (no media filename)`);
        return;
    }

    const resolved_ext = resolved_filename ? path.extname(resolved_filename).toLowerCase() : ext;
    const resolved_mime = get_mime_type(resolved_filename) || mime_type;
    const resolved_media_type = resolve_media_type(resolved_mime, item.item_type);

    const v1_file_path = path.join(storage_dir, resolved_filename);
    const exists = await file_exists(v1_file_path);

    if (!exists) {
        const msg = `${label} item ${item.uuid}: file not found — ${v1_file_path}`;
        report.orphans.db_references_without_files.push(msg);
        console.warn(`  WARNING: ${msg}`);
        // Still create the media library record without storage_path so the relationship is tracked
    }

    const file_size = exists ? await get_file_size(v1_file_path) : null;
    const v2_storage_path = exists ? build_v2_storage_path(media_uuid, resolved_ext, resolved_mime) : null;

    // Extract EXIF data and image dimensions from the v1 source file
    const file_meta = exists
        ? await extract_file_metadata(v1_file_path, resolved_mime, resolved_media_type)
        : { media_width: null, media_height: null, exif_data: null };

    const media_record = {
        uuid: media_uuid,
        name: build_media_name(item.title, resolved_media_type),
        description: item.description || null,
        alt_text: item.alt_text || null,
        is_alt_text_decorative: item.is_alt_text_decorative || 0,
        media_type: resolved_media_type,
        mime_type: resolved_mime,
        item_type: resolve_item_type(item.item_type, resolved_media_type),
        filename: exists ? `${media_uuid}${resolved_ext}` : null,
        original_filename: resolved_filename,
        ingest_method: ingest_method,
        repo_uuid: (item.repo_uuid || item.is_repo_item) ? (item.repo_uuid || item.media || null) : null,
        repo_handle: null,
        kaltura_entry_id: null,
        kaltura_thumbnail_url: null,
        exhibits: serialize_exhibits_value(item.is_member_of_exhibit),
        size: file_size,
        storage_path: v2_storage_path,
        thumbnail_path: exists ? build_v2_thumbnail_path(media_uuid) : null,
        exif_data: file_meta.exif_data,
        media_width: file_meta.media_width,
        media_height: file_meta.media_height,
        is_deleted: 0,
        owner: resolve_owner_id(item.created_by),
        created: item.created,
        created_by: item.created_by || MIGRATION_USER,
        updated_by: MIGRATION_USER
    };

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create media record for ${label} item ${item.uuid}: ${media_uuid}`);
        report.media_library.created++;
        return;
    }

    // Decode double-encoded HTML entities in media text fields
    const { decoded: decoded_item_media, changed_count: im_changed } = decode_record_text_fields(media_record, DECODE_FIELDS.media);
    if (im_changed > 0) {
        report.html_decoded.records++;
        report.html_decoded.fields += im_changed;
    }

    try {
        // 1. Create media library record
        await v2_db('tbl_media_library').insert(decoded_item_media);
        report.media_library.created++;

        // 2. Copy file if it exists
        if (exists) {
            await copy_file_to_v2(v1_file_path, v2_storage_path);

            // 3. Generate thumbnail in v2 thumbnails directory
            await generate_v2_thumbnail(v1_file_path, build_v2_thumbnail_path(media_uuid), resolved_mime);
        }

        // 4. Update item with media_uuid
        await v2_db(table).where('uuid', item.uuid).update({ media_uuid: media_uuid });

        console.log(`  Created ${ingest_method} media for ${label} item ${item.uuid}: ${media_uuid}`);
    } catch (err) {
        report.media_library.errors.push(`${label} item ${item.uuid}: ${err.message}`);
        console.error(`  ERROR: ${label} item ${item.uuid}: ${err.message}`);
    }
}

/**
 * Create a media library record for an item's thumbnail,
 * copy the file, and update the item record with thumbnail_media_uuid.
 */
async function create_item_thumbnail_record(item, v2_item, table, label, storage_dir) {

    let thumbnail = item.thumbnail;
    const ingest_method = get_ingest_method(item);

    // For repo items, the thumbnail column is often empty but files exist on disk
    // as {item_uuid}_repository_item_thumbnail.{ext}
    if (!thumbnail && ingest_method === 'repo') {
        const repo_files = await resolve_repo_item_files(item.uuid, storage_dir);
        if (repo_files.thumbnail_files.length > 0) {
            thumbnail = repo_files.thumbnail_files[0];
            console.log(`  Resolved repo item ${item.uuid} thumbnail from disk: ${thumbnail}`);
        }
    }

    if (!thumbnail) return;

    // Kaltura thumbnails are URLs, not local files — skip file processing
    if (thumbnail.startsWith('http://') || thumbnail.startsWith('https://')) {
        console.log(`  Skipping ${label} item ${item.uuid} thumbnail (Kaltura URL, handled by primary media record)`);
        return;
    }

    const media_uuid = uuidv4();
    const ext = path.extname(thumbnail).toLowerCase();
    const mime_type = get_mime_type(thumbnail) || 'image/jpeg';
    const media_type = 'image'; // thumbnails are always images

    const v1_file_path = path.join(storage_dir, thumbnail);
    const exists = await file_exists(v1_file_path);

    if (!exists) {
        const msg = `${label} item ${item.uuid} thumbnail: file not found — ${v1_file_path}`;
        report.orphans.db_references_without_files.push(msg);
        console.warn(`  WARNING: ${msg}`);
        return;
    }

    const file_size = await get_file_size(v1_file_path);
    const v2_storage_path = build_v2_storage_path(media_uuid, ext, mime_type);

    const name = `${(item.title || 'Item').substring(0, 100)} — Thumbnail`;

    // Extract EXIF data and dimensions from the v1 thumbnail file
    const file_meta = await extract_file_metadata(v1_file_path, mime_type, media_type);

    const media_record = {
        uuid: media_uuid,
        name: name,
        description: null,
        alt_text: item.alt_text || null,
        is_alt_text_decorative: item.is_alt_text_decorative || 0,
        media_type: media_type,
        mime_type: mime_type,
        item_type: 'still image',
        filename: `${media_uuid}${ext}`,
        original_filename: thumbnail,
        ingest_method: ingest_method === 'kaltura' ? 'upload' : ingest_method,
        repo_uuid: item.repo_uuid || null,
        repo_handle: null,
        kaltura_entry_id: null,
        kaltura_thumbnail_url: null,
        exhibits: serialize_exhibits_value(item.is_member_of_exhibit),
        size: file_size,
        storage_path: v2_storage_path,
        thumbnail_path: build_v2_thumbnail_path(media_uuid),
        exif_data: file_meta.exif_data,
        media_width: file_meta.media_width,
        media_height: file_meta.media_height,
        is_deleted: 0,
        owner: resolve_owner_id(item.created_by),
        created: item.created,
        created_by: item.created_by || MIGRATION_USER,
        updated_by: MIGRATION_USER
    };

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create thumbnail media record for ${label} item ${item.uuid}: ${media_uuid}`);
        report.media_library.created++;
        return;
    }

    // Decode double-encoded HTML entities in media text fields
    const { decoded: decoded_thumb_media, changed_count: tm_changed } = decode_record_text_fields(media_record, DECODE_FIELDS.media);
    if (tm_changed > 0) {
        report.html_decoded.records++;
        report.html_decoded.fields += tm_changed;
    }

    try {
        await v2_db('tbl_media_library').insert(decoded_thumb_media);
        report.media_library.created++;

        await copy_file_to_v2(v1_file_path, v2_storage_path);

        // Generate thumbnail in v2 thumbnails directory
        await generate_v2_thumbnail(v1_file_path, build_v2_thumbnail_path(media_uuid), mime_type);

        await v2_db(table).where('uuid', item.uuid).update({ thumbnail_media_uuid: media_uuid });

        console.log(`  Created thumbnail media for ${label} item ${item.uuid}: ${media_uuid}`);
    } catch (err) {
        report.media_library.errors.push(`${label} item ${item.uuid} thumbnail: ${err.message}`);
        console.error(`  ERROR: ${label} item ${item.uuid} thumbnail: ${err.message}`);
    }
}

// ─────────────────────────────────────────────
// PHASE 8: IIIF MANIFEST GENERATION
// ─────────────────────────────────────────────

/**
 * Generates IIIF manifests for media records by calling the v2
 * per-record endpoint for each one.
 * POST {V2_API_URL}/api/v1/media/library/iiif/:media_id/manifest/generate
 *
 * Processes two categories:
 *   8A — Upload/repo records that have a storage_path (physical file exists)
 *   8B — Kaltura records that have a kaltura_entry_id (no physical file;
 *         v2 iiif-service builds HLS streaming canvases for video/audio)
 */
async function generate_iiif_manifests() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 8: IIIF Manifest Generation');
    console.log('══════════════════════════════════════════');

    if (!V2_API_TOKEN) {
        console.warn('  WARNING: V2_API_TOKEN not set — skipping IIIF manifest generation');
        console.warn('  Set V2_API_TOKEN in .env to enable this phase');
        report.iiif_manifests.error = 'V2_API_TOKEN not configured';
        return;
    }

    // ── 8A: Upload / Repo records (physical files) ──

    console.log('\n  ── 8A: Upload / Repo media ──');

    const upload_records = await v2_db('tbl_media_library')
        .select('uuid', 'name', 'ingest_method')
        .where({ is_deleted: 0 })
        .whereIn('ingest_method', ['upload', 'repo'])
        .whereNotNull('storage_path');

    console.log(`  Found ${upload_records.length} upload/repo media records`);

    if (DRY_RUN && upload_records.length > 0) {
        console.log(`  [DRY RUN] Would generate manifests for ${upload_records.length} upload/repo records`);
        report.iiif_manifests.skipped = upload_records.length;
    } else {
        // No DB-level "already generated?" check: v2 has no iiif_manifest column —
        // the endpoint builds manifests on demand and serves repeat calls from its
        // disk cache (iiif-service.js / iiif-cache.js), so re-runs are cheap.
        for (const record of upload_records) {
            await call_iiif_generate_endpoint(record, 'generated', 'failed');
        }
    }

    console.log(`  Upload/repo manifests — generated: ${report.iiif_manifests.generated}, ` +
        `skipped: ${report.iiif_manifests.skipped}, failed: ${report.iiif_manifests.failed}`);

    // ── 8B: Kaltura records (AV streaming — no physical file) ──

    console.log('\n  ── 8B: Kaltura media ──');

    const kaltura_records = await v2_db('tbl_media_library')
        .select('uuid', 'name', 'ingest_method', 'kaltura_entry_id')
        .where({ is_deleted: 0, ingest_method: 'kaltura' })
        .whereNotNull('kaltura_entry_id');

    console.log(`  Found ${kaltura_records.length} Kaltura media records`);

    if (DRY_RUN && kaltura_records.length > 0) {
        console.log(`  [DRY RUN] Would generate manifests for ${kaltura_records.length} Kaltura records`);
        report.iiif_manifests.kaltura_skipped = kaltura_records.length;
    } else {
        // See note above: no iiif_manifest column to short-circuit on; the
        // endpoint is the source of truth and caches its output.
        for (const record of kaltura_records) {
            await call_iiif_generate_endpoint(record, 'kaltura_generated', 'kaltura_failed');
        }
    }

    console.log(`  Kaltura manifests — generated: ${report.iiif_manifests.kaltura_generated}, ` +
        `skipped: ${report.iiif_manifests.kaltura_skipped}, failed: ${report.iiif_manifests.kaltura_failed}`);

    // ── Summary ──

    const total_generated = report.iiif_manifests.generated + report.iiif_manifests.kaltura_generated;
    const total_failed = report.iiif_manifests.failed + report.iiif_manifests.kaltura_failed;

    console.log(`\n  IIIF total — generated: ${total_generated}, failed: ${total_failed}`);
}

/**
 * Call the v2 IIIF manifest generation endpoint for a single media record.
 * Shared by both upload/repo and Kaltura processing paths.
 *
 * @param {Object} record - Media library record with at least { uuid }
 * @param {string} generated_key - Report counter key for successful generation
 * @param {string} failed_key - Report counter key for failures
 */
async function call_iiif_generate_endpoint(record, generated_key, failed_key) {

    const endpoint = V2_IIIF_GENERATE_ENDPOINT.replace(':media_id', record.uuid);
    const url = `${V2_API_URL}${endpoint}`;

    try {

        const body = await new Promise((resolve, reject) => {

            const parsed = new URL(url);
            const transport = parsed.protocol === 'https:' ? https : http;

            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: 'POST',
                rejectUnauthorized: false,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${V2_API_TOKEN}`
                }
            };

            const req = transport.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => { data += chunk; });

                res.on('end', () => {
                    try {
                        const parsed_body = JSON.parse(data);
                        parsed_body._status_code = res.statusCode;
                        resolve(parsed_body);
                    } catch (parse_err) {
                        reject(new Error(`Invalid JSON response (HTTP ${res.statusCode}): ${data.substring(0, 200)}`));
                    }
                });
            });

            req.on('error', (err) => reject(err));
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timed out after 30 seconds'));
            });

            req.end();
        });

        const status_code = body._status_code;
        delete body._status_code;

        if (status_code >= 200 && status_code < 300 && body.success) {
            report.iiif_manifests[generated_key]++;
            console.log(`  Generated manifest: ${record.uuid}`);
        } else {
            report.iiif_manifests[failed_key]++;
            console.error(`  FAILED manifest for ${record.uuid}: HTTP ${status_code} — ${body.message || 'Unknown error'}`);
        }

    } catch (err) {
        report.iiif_manifests[failed_key]++;
        console.error(`  ERROR manifest for ${record.uuid}: ${err.message}`);
    }
}

// ─────────────────────────────────────────────
// PHASE 5: ORPHAN DETECTION
// ─────────────────────────────────────────────

/**
 * Scans v1 storage and builds the orphaned_v1_files set BEFORE file-copy
 * phases so that copy_file_to_v2 and generate_v2_thumbnail can refuse to
 * process files that have no database reference.
 */
async function detect_orphans() {
    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 5: Orphan Detection');
    console.log('══════════════════════════════════════════');

    // Build a set of all filenames referenced by v1 DB records
    const referenced_files = new Map(); // filename → { exhibit_uuid, context }

    const v1_exhibits = await v1_db('tbl_exhibits').select('uuid', 'hero_image', 'thumbnail');
    for (const exhibit of v1_exhibits) {
        if (exhibit.hero_image) {
            referenced_files.set(
                `${exhibit.uuid}/${exhibit.hero_image}`,
                { exhibit_uuid: exhibit.uuid, context: 'exhibit hero_image' }
            );
        }
        if (exhibit.thumbnail) {
            referenced_files.set(
                `${exhibit.uuid}/${exhibit.thumbnail}`,
                { exhibit_uuid: exhibit.uuid, context: 'exhibit thumbnail' }
            );
        }
    }

    // Build a set of repo item UUIDs per exhibit for repo-pattern file matching.
    // Repo items store a bare repo UUID in the `media` column — NOT a filename —
    // but their files on disk use {item_uuid}_repository_item_media.{ext}
    const repo_item_uuids_by_exhibit = new Map(); // exhibit_uuid → Set<item_uuid>

    const item_tables = ['tbl_standard_items', 'tbl_grid_items', 'tbl_timeline_items'];
    for (const table of item_tables) {
        const items = await v1_db(table).select(
            'uuid', 'is_member_of_exhibit', 'media', 'thumbnail', 'is_repo_item'
        );
        for (const item of items) {

            if (item.is_repo_item === 1) {
                // Track this repo item UUID so the directory walk can match its files
                if (!repo_item_uuids_by_exhibit.has(item.is_member_of_exhibit)) {
                    repo_item_uuids_by_exhibit.set(item.is_member_of_exhibit, new Set());
                }
                repo_item_uuids_by_exhibit.get(item.is_member_of_exhibit).add(item.uuid);
            }

            if (item.media) {
                referenced_files.set(
                    `${item.is_member_of_exhibit}/${item.media}`,
                    { exhibit_uuid: item.is_member_of_exhibit, context: `${table} media (${item.uuid})` }
                );
            }
            if (item.thumbnail) {
                referenced_files.set(
                    `${item.is_member_of_exhibit}/${item.thumbnail}`,
                    { exhibit_uuid: item.is_member_of_exhibit, context: `${table} thumbnail (${item.uuid})` }
                );
            }
        }
    }

    // Walk the v1 storage directory and compare
    try {
        const exhibit_dirs = await fsp.readdir(V1_STORAGE_PATH, { withFileTypes: true });

        for (const dir_entry of exhibit_dirs) {
            if (!dir_entry.isDirectory()) continue;
            if (dir_entry.name.startsWith('.')) continue; // skip .trash and hidden dirs

            const exhibit_uuid = dir_entry.name;
            const dir_path = path.join(V1_STORAGE_PATH, exhibit_uuid);
            const files = await fsp.readdir(dir_path);

            // Pre-fetch repo item UUIDs for this exhibit (if any)
            const repo_uuids = repo_item_uuids_by_exhibit.get(exhibit_uuid);

            for (const filename of files) {
                const key = `${exhibit_uuid}/${filename}`;

                // Check 1: exact filename match in referenced_files
                if (referenced_files.has(key)) continue;

                // Check 2: repo-pattern match — {item_uuid}_repository_item_{media|thumbnail}.{ext}
                if (repo_uuids) {
                    const repo_match = filename.match(
                        /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_repository_item_(?:media|thumbnail)\..+$/
                    );
                    if (repo_match && repo_uuids.has(repo_match[1])) {
                        continue; // file belongs to a known repo item — not orphaned
                    }
                }

                const full_path = path.join(dir_path, filename);
                orphaned_v1_files.add(full_path);
                report.orphans.files_without_db_reference.push({
                    file: full_path,
                    exhibit_uuid: exhibit_uuid,
                    filename: filename
                });
            }
        }
    } catch (err) {
        console.error(`  ERROR scanning v1 storage: ${err.message}`);
    }

    console.log(`  Files without DB reference: ${report.orphans.files_without_db_reference.length}`);
    console.log(`  DB references without files: ${report.orphans.db_references_without_files.length}`);
}

// ─────────────────────────────────────────────
// PHASE 9: STYLES CONVERSION
// ─────────────────────────────────────────────
//
// Converts exhibit styles from v1 format to v2 format and backfills
// item-level and heading-level inline CSS into key-reference presets.
//
// V1 exhibit keys: navigation, template, introduction
// V2 exhibit keys: navigation, template (legacy), introduction,
//                  heading1, heading2, heading3, item1, item2, item3
//
// V1 item/heading styles: inline CSS objects, e.g. {"backgroundColor":"#C2CED5"}
// V2 item/heading styles: key references, e.g. "item1" / "heading1"

const EMPTY_STYLE_SECTION = {
    backgroundColor: '',
    color: '',
    fontSize: '',
    fontFamily: ''
};

/**
 * Normalizes a style value object for deduplication.
 * Lowercases hex colors, trims whitespace from all values.
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
 * Classifies an item/heading styles value as inline CSS, key reference, or empty.
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
 * Phase 9: Convert exhibit styles to v2 format and backfill item/heading presets.
 *
 * Sub-phase A: Convert exhibit-level styles
 *   - Keep navigation, introduction, template as-is
 *   - Add heading1/2/3 and item1/2/3 as empty objects
 *   - Skip exhibits already in v2 format
 *
 * Sub-phase B: Backfill item presets from inline CSS
 *   - Deduplicate inline CSS across all item types per exhibit
 *   - Assign to item1/item2/item3 slots
 *   - Replace item styles with key references
 *   - Flag exhibits with >3 distinct styles
 *
 * Sub-phase C: Backfill heading presets from inline CSS (grids/timelines)
 *   - Same pattern → heading1/heading2/heading3
 */
async function convert_styles() {

    console.log('\n══════════════════════════════════════════');
    console.log('PHASE 9: Styles Conversion (v1 → v2)');
    console.log('══════════════════════════════════════════');

    // ─── Sub-phase A: Exhibit-level styles ───

    console.log('\n  ── 9A: Exhibit-level styles ──');

    const exhibits = await v2_db('tbl_exhibits')
        .select('id', 'uuid', 'title', 'styles')
        .where('is_deleted', 0);

    console.log(`  Found ${exhibits.length} active exhibits`);

    for (const exhibit of exhibits) {

        const parsed = safe_json_parse(exhibit.styles);

        if (!parsed || !parsed.exhibit) {
            console.log(`  [SKIP] id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}... — NULL/empty styles`);
            report.styles.exhibit_styles_skipped_null++;
            continue;
        }

        const exhibit_section = parsed.exhibit;
        const keys = new Set(Object.keys(exhibit_section));

        // Already v2 format? (has heading or item keys)
        if (keys.has('heading1') || keys.has('item1')) {
            console.log(`  [SKIP] id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}... — already v2 format`);
            report.styles.exhibit_styles_skipped_v2++;
            continue;
        }

        // Build v2 styles: keep existing v1 keys, add new v2 keys
        const v2_styles = {
            exhibit: {
                introduction: exhibit_section.introduction || { ...EMPTY_STYLE_SECTION },
                navigation: exhibit_section.navigation || { ...EMPTY_STYLE_SECTION },
                template: exhibit_section.template || { ...EMPTY_STYLE_SECTION },
                heading1: { ...EMPTY_STYLE_SECTION },
                heading2: { ...EMPTY_STYLE_SECTION },
                heading3: { ...EMPTY_STYLE_SECTION },
                item1: { ...EMPTY_STYLE_SECTION },
                item2: { ...EMPTY_STYLE_SECTION },
                item3: { ...EMPTY_STYLE_SECTION }
            }
        };

        const new_styles_json = JSON.stringify(v2_styles);

        console.log(`  [CONVERT] id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}...`);
        console.log(`    v1 keys: ${Array.from(keys).join(', ')}`);

        if (!DRY_RUN) {

            try {
                await v2_db('tbl_exhibits')
                    .where('id', exhibit.id)
                    .update({ styles: new_styles_json });

                console.log(`    ✓ Updated`);
            } catch (err) {
                console.error(`    ✗ Error: ${err.message}`);
                report.styles.errors.push(`Exhibit ${exhibit.uuid} styles conversion: ${err.message}`);
                continue;
            }
        } else {
            console.log(`    [DRY RUN] Would update`);
        }

        report.styles.exhibit_styles_converted++;
    }

    console.log(`  9A complete: ${report.styles.exhibit_styles_converted} converted, ` +
        `${report.styles.exhibit_styles_skipped_v2} already v2, ` +
        `${report.styles.exhibit_styles_skipped_null} null/empty`);

    // ─── Sub-phase B: Item presets from inline CSS ───

    console.log('\n  ── 9B: Item presets from inline CSS ──');

    const ITEM_TABLES = [
        { table: 'tbl_standard_items', label: 'standard items' },
        { table: 'tbl_grid_items', label: 'grid items' },
        { table: 'tbl_timeline_items', label: 'timeline items' }
    ];

    // Re-fetch exhibits (styles may have been updated in 9A)
    const exhibits_for_items = await v2_db('tbl_exhibits')
        .select('id', 'uuid', 'styles')
        .where('is_deleted', 0);

    for (const exhibit of exhibits_for_items) {

        const style_map = new Map(); // normalized_json → original parsed object
        const item_rows = [];       // { table, id, uuid, styles_raw, normalized }

        for (const { table } of ITEM_TABLES) {

            const items = await v2_db(table)
                .select('id', 'uuid', 'styles')
                .where('is_member_of_exhibit', exhibit.uuid)
                .where('is_deleted', 0);

            for (const item of items) {

                const classification = classify_style_value(item.styles);

                if (classification === 'key_ref') {
                    continue; // Already converted
                }

                if (classification === 'inline_css') {
                    const parsed = safe_json_parse(item.styles);
                    const normalized = normalize_style(parsed);

                    if (!style_map.has(normalized)) {
                        style_map.set(normalized, parsed);
                    }

                    item_rows.push({
                        table,
                        id: item.id,
                        uuid: item.uuid,
                        styles_raw: item.styles,
                        normalized
                    });
                }
            }
        }

        if (item_rows.length === 0) {
            continue;
        }

        const distinct_count = style_map.size;

        console.log(`  Exhibit id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}...`);
        console.log(`    ${item_rows.length} items with inline CSS, ${distinct_count} distinct styles`);

        if (distinct_count > 3) {
            console.log(`    ⚠ EXCEEDS 3 ITEM SLOTS — flagged for manual review`);

            report.styles.item_presets_exceeds_3.push({
                exhibit_id: exhibit.id,
                exhibit_uuid: exhibit.uuid,
                distinct_styles: distinct_count,
                styles: Array.from(style_map.entries()).map(([norm, orig]) => ({
                    normalized: norm,
                    original: orig
                })),
                affected_items: item_rows.length
            });

            continue;
        }

        const parsed_exhibit_styles = safe_json_parse(exhibit.styles);

        if (!parsed_exhibit_styles || !parsed_exhibit_styles.exhibit) {
            console.log(`    ⚠ Exhibit has no parseable styles — skipping item backfill`);
            continue;
        }

        const exhibit_section = parsed_exhibit_styles.exhibit;
        const slot_names = ['item1', 'item2', 'item3'];
        const assignments = new Map(); // normalized_json → slot_name
        let slot_index = 0;

        for (const [normalized, original] of style_map.entries()) {

            // Check if any existing slot already matches
            let matched_slot = null;

            for (const slot of slot_names) {

                if (exhibit_section[slot] && has_style_values(exhibit_section[slot])) {

                    if (normalize_style(exhibit_section[slot]) === normalized) {
                        matched_slot = slot;
                        break;
                    }
                }
            }

            if (matched_slot) {
                assignments.set(normalized, matched_slot);
                console.log(`    Matched existing slot: ${matched_slot} ← ${normalized}`);
            } else {
                // Find next empty slot
                while (slot_index < slot_names.length &&
                       has_style_values(exhibit_section[slot_names[slot_index]])) {
                    slot_index++;
                }

                if (slot_index >= slot_names.length) {
                    console.log(`    ⚠ No available item slots for: ${normalized}`);

                    report.styles.orphan_styles.push({
                        exhibit_uuid: exhibit.uuid,
                        style: original,
                        reason: 'no_available_item_slot'
                    });

                    continue;
                }

                const slot = slot_names[slot_index];
                exhibit_section[slot] = original;
                assignments.set(normalized, slot);

                console.log(`    Assigned to ${slot}: ${normalized}`);
                slot_index++;
            }
        }

        // Update exhibit styles JSON with new item presets
        if (!DRY_RUN) {

            try {
                await v2_db('tbl_exhibits')
                    .where('id', exhibit.id)
                    .update({ styles: JSON.stringify(parsed_exhibit_styles) });
            } catch (err) {
                console.error(`    ✗ Error updating exhibit styles: ${err.message}`);
                report.styles.errors.push(`Exhibit ${exhibit.uuid} item backfill: ${err.message}`);
                continue;
            }
        }

        // Update each item from inline CSS → key reference
        let items_updated = 0;

        for (const row of item_rows) {

            const target_slot = assignments.get(row.normalized);

            if (!target_slot) {
                report.styles.orphan_styles.push({
                    exhibit_uuid: exhibit.uuid,
                    item_id: row.id,
                    table: row.table,
                    style: row.styles_raw,
                    reason: 'no_slot_assignment'
                });
                continue;
            }

            if (!DRY_RUN) {

                try {
                    await v2_db(row.table)
                        .where('id', row.id)
                        .update({ styles: target_slot });

                    items_updated++;
                } catch (err) {
                    console.error(`    ✗ Error updating ${row.table} id=${row.id}: ${err.message}`);
                    report.styles.errors.push(`${row.table} id=${row.id}: ${err.message}`);
                }
            } else {
                items_updated++;
            }
        }

        console.log(`    ${DRY_RUN ? '[DRY RUN] Would update' : 'Updated'} ${items_updated} items`);
        report.styles.item_presets_items_updated += items_updated;
        report.styles.item_presets_exhibits++;
    }

    console.log(`  9B complete: ${report.styles.item_presets_exhibits} exhibits, ` +
        `${report.styles.item_presets_items_updated} items updated, ` +
        `${report.styles.item_presets_exceeds_3.length} flagged`);

    // ─── Sub-phase C: Heading presets from inline CSS (grids/timelines) ───

    console.log('\n  ── 9C: Heading presets from inline CSS ──');

    const HEADING_TABLES = [
        { table: 'tbl_grids', label: 'grids' },
        { table: 'tbl_timelines', label: 'timelines' }
    ];

    // Re-fetch exhibits again (styles updated in 9B)
    const exhibits_for_headings = await v2_db('tbl_exhibits')
        .select('id', 'uuid', 'styles')
        .where('is_deleted', 0);

    for (const exhibit of exhibits_for_headings) {

        const style_map = new Map();
        const heading_rows = [];

        for (const { table } of HEADING_TABLES) {

            const headings = await v2_db(table)
                .select('id', 'uuid', 'styles')
                .where('is_member_of_exhibit', exhibit.uuid)
                .where('is_deleted', 0);

            for (const heading of headings) {

                const classification = classify_style_value(heading.styles);

                if (classification === 'key_ref') {
                    continue;
                }

                if (classification === 'inline_css') {
                    const parsed = safe_json_parse(heading.styles);
                    const normalized = normalize_style(parsed);

                    if (!style_map.has(normalized)) {
                        style_map.set(normalized, parsed);
                    }

                    heading_rows.push({
                        table,
                        id: heading.id,
                        uuid: heading.uuid,
                        styles_raw: heading.styles,
                        normalized
                    });
                }
            }
        }

        if (heading_rows.length === 0) {
            continue;
        }

        const distinct_count = style_map.size;

        console.log(`  Exhibit id=${exhibit.id} uuid=${exhibit.uuid.substring(0, 12)}...`);
        console.log(`    ${heading_rows.length} headings with inline CSS, ${distinct_count} distinct styles`);

        const parsed_exhibit_styles = safe_json_parse(exhibit.styles);

        if (!parsed_exhibit_styles || !parsed_exhibit_styles.exhibit) {
            console.log(`    ⚠ Exhibit has no parseable styles — skipping heading backfill`);
            continue;
        }

        const exhibit_section = parsed_exhibit_styles.exhibit;
        const slot_names = ['heading1', 'heading2', 'heading3'];
        const assignments = new Map();

        // Count occupied heading slots
        let occupied = 0;

        for (const slot of slot_names) {
            if (exhibit_section[slot] && has_style_values(exhibit_section[slot])) {
                occupied++;
            }
        }

        // Match inline styles against existing heading slots first
        let unmatched_count = 0;

        for (const [normalized, original] of style_map.entries()) {

            let matched = false;

            for (const slot of slot_names) {
                if (exhibit_section[slot] && has_style_values(exhibit_section[slot])) {

                    if (normalize_style(exhibit_section[slot]) === normalized) {
                        assignments.set(normalized, slot);
                        matched = true;
                        console.log(`    Matched existing slot: ${slot} ← ${normalized}`);
                        break;
                    }
                }
            }

            if (!matched) {
                unmatched_count++;
            }
        }

        const available = 3 - occupied;

        if (unmatched_count > available) {
            console.log(`    ⚠ ${unmatched_count} unmatched styles, only ${available} slots — flagged`);

            report.styles.heading_presets_exceeds_3.push({
                exhibit_id: exhibit.id,
                exhibit_uuid: exhibit.uuid,
                distinct_styles: distinct_count,
                unmatched: unmatched_count,
                available_slots: available,
                styles: Array.from(style_map.entries()).map(([norm, orig]) => ({
                    normalized: norm,
                    original: orig
                })),
                affected_headings: heading_rows.length
            });

            continue;
        }

        // Assign unmatched styles to available slots
        let slot_index = 0;

        for (const [normalized, original] of style_map.entries()) {

            if (assignments.has(normalized)) {
                continue;
            }

            while (slot_index < slot_names.length &&
                   has_style_values(exhibit_section[slot_names[slot_index]])) {
                slot_index++;
            }

            if (slot_index >= slot_names.length) {
                report.styles.orphan_styles.push({
                    exhibit_uuid: exhibit.uuid,
                    style: original,
                    reason: 'no_available_heading_slot'
                });
                continue;
            }

            const slot = slot_names[slot_index];
            exhibit_section[slot] = original;
            assignments.set(normalized, slot);

            console.log(`    Assigned to ${slot}: ${normalized}`);
            slot_index++;
        }

        // Update exhibit styles JSON
        if (!DRY_RUN) {

            try {
                await v2_db('tbl_exhibits')
                    .where('id', exhibit.id)
                    .update({ styles: JSON.stringify(parsed_exhibit_styles) });
            } catch (err) {
                console.error(`    ✗ Error updating exhibit styles: ${err.message}`);
                report.styles.errors.push(`Exhibit ${exhibit.uuid} heading backfill: ${err.message}`);
                continue;
            }
        }

        // Update each heading from inline CSS → key reference
        let headings_updated = 0;

        for (const row of heading_rows) {

            const target_slot = assignments.get(row.normalized);

            if (!target_slot) {
                report.styles.orphan_styles.push({
                    exhibit_uuid: exhibit.uuid,
                    heading_id: row.id,
                    table: row.table,
                    style: row.styles_raw,
                    reason: 'no_slot_assignment'
                });
                continue;
            }

            if (!DRY_RUN) {

                try {
                    await v2_db(row.table)
                        .where('id', row.id)
                        .update({ styles: target_slot });

                    headings_updated++;
                } catch (err) {
                    console.error(`    ✗ Error updating ${row.table} id=${row.id}: ${err.message}`);
                    report.styles.errors.push(`${row.table} id=${row.id}: ${err.message}`);
                }
            } else {
                headings_updated++;
            }
        }

        console.log(`    ${DRY_RUN ? '[DRY RUN] Would update' : 'Updated'} ${headings_updated} headings`);
        report.styles.heading_presets_updated += headings_updated;
        report.styles.heading_presets_exhibits++;
    }

    console.log(`  9C complete: ${report.styles.heading_presets_exhibits} exhibits, ` +
        `${report.styles.heading_presets_updated} headings updated, ` +
        `${report.styles.heading_presets_exceeds_3.length} flagged`);
}

// ─────────────────────────────────────────────
// PHASE 10: REPORT
// ─────────────────────────────────────────────

async function generate_report() {
    report.completed_at = new Date().toISOString();

    console.log('\n══════════════════════════════════════════════════════');
    console.log('MIGRATION REPORT');
    console.log('══════════════════════════════════════════════════════');
    console.log(`Mode:      ${DRY_RUN ? 'DRY RUN (no changes written)' : 'LIVE'}`);
    console.log(`Started:   ${report.started_at}`);
    console.log(`Completed: ${report.completed_at}`);

    console.log('\n── Data Migration ──');
    console.log(`Users:          ${report.users.migrated} migrated, ${report.users.skipped} skipped`);
    console.log(`Exhibits:       ${report.exhibits.migrated} migrated, ${report.exhibits.skipped} skipped`);
    console.log(`Grids:          ${report.grids.migrated} migrated, ${report.grids.skipped} skipped`);
    console.log(`Timelines:      ${report.timelines.migrated} migrated, ${report.timelines.skipped} skipped`);
    console.log(`Headings:       ${report.heading_items.migrated} migrated, ${report.heading_items.skipped} skipped`);
    console.log(`Standard items: ${report.standard_items.migrated} migrated, ${report.standard_items.skipped} skipped`);
    console.log(`Grid items:     ${report.grid_items.migrated} migrated, ${report.grid_items.skipped} skipped`);
    console.log(`Timeline items: ${report.timeline_items.migrated} migrated, ${report.timeline_items.skipped} skipped`);

    console.log('\n── Media Library ──');
    console.log(`Media records created:  ${report.media_library.created}`);
    console.log(`Exhibit media links:    ${report.exhibit_media.created}`);
    console.log(`Files copied:           ${report.files_copied.count}`);
    console.log(`Total bytes copied:     ${(report.files_copied.total_bytes / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n── Thumbnails ──');
    console.log(`Image thumbnails:       ${report.thumbnails.image_generated}`);
    console.log(`PDF thumbnails:         ${report.thumbnails.pdf_generated}`);
    console.log(`Skipped (unsupported):  ${report.thumbnails.skipped}`);
    console.log(`Failed:                 ${report.thumbnails.failed}`);
    if (report.thumbnails.errors.length > 0) {
        for (const err of report.thumbnails.errors) {
            console.log(`  • ${err}`);
        }
    }

    console.log('\n── IIIF Manifests ──');
    console.log(`Upload/repo generated:  ${report.iiif_manifests.generated}`);
    console.log(`Upload/repo skipped:    ${report.iiif_manifests.skipped}`);
    console.log(`Upload/repo failed:     ${report.iiif_manifests.failed}`);
    console.log(`Kaltura generated:      ${report.iiif_manifests.kaltura_generated}`);
    console.log(`Kaltura skipped:        ${report.iiif_manifests.kaltura_skipped}`);
    console.log(`Kaltura failed:         ${report.iiif_manifests.kaltura_failed}`);
    if (report.iiif_manifests.error) {
        console.log(`IIIF error:             ${report.iiif_manifests.error}`);
    }

    console.log('\n── HTML Entity Decoding ──');
    console.log(`Records decoded:        ${report.html_decoded.records}`);
    console.log(`Fields decoded:         ${report.html_decoded.fields}`);

    // Styles conversion report — disabled (moved to standalone script)
    // console.log('\n── Styles Conversion ──');
    // console.log(`Exhibit styles converted: ${report.styles.exhibit_styles_converted}`);
    // console.log(`Exhibit styles (v2):      ${report.styles.exhibit_styles_skipped_v2}`);
    // console.log(`Exhibit styles (null):    ${report.styles.exhibit_styles_skipped_null}`);
    // console.log(`Item preset exhibits:     ${report.styles.item_presets_exhibits}`);
    // console.log(`Item presets applied:     ${report.styles.item_presets_items_updated}`);
    // console.log(`Items exceeding 3 slots:  ${report.styles.item_presets_exceeds_3.length}`);
    // if (report.styles.item_presets_exceeds_3.length > 0) {
    //     for (const entry of report.styles.item_presets_exceeds_3) {
    //         console.log(`  • Exhibit ${entry.exhibit_uuid.substring(0, 12)}... — ${entry.distinct_styles} distinct styles, ${entry.affected_items} items`);
    //     }
    // }
    // console.log(`Heading preset exhibits:  ${report.styles.heading_presets_exhibits}`);
    // console.log(`Heading presets applied:  ${report.styles.heading_presets_updated}`);
    // console.log(`Headings exceeding 3:    ${report.styles.heading_presets_exceeds_3.length}`);
    // if (report.styles.heading_presets_exceeds_3.length > 0) {
    //     for (const entry of report.styles.heading_presets_exceeds_3) {
    //         console.log(`  • Exhibit ${entry.exhibit_uuid.substring(0, 12)}... — ${entry.distinct_styles} distinct styles, ${entry.affected_headings} headings`);
    //     }
    // }
    // console.log(`Orphan styles:            ${report.styles.orphan_styles.length}`);
    // if (report.styles.orphan_styles.length > 0) {
    //     for (const entry of report.styles.orphan_styles) {
    //         console.log(`  • Exhibit ${entry.exhibit_uuid.substring(0, 12)}... — ${entry.reason}`);
    //     }
    // }

    console.log('\n── Orphans ──');
    console.log(`Files without DB reference: ${report.orphans.files_without_db_reference.length}`);
    console.log(`Files skipped (not copied): ${report.orphans.files_skipped_as_orphans}`);
    if (report.orphans.files_without_db_reference.length > 0) {
        for (const orphan of report.orphans.files_without_db_reference) {
            console.log(`  • ${orphan.file}`);
        }
    }

    console.log(`DB references without files: ${report.orphans.db_references_without_files.length}`);
    if (report.orphans.db_references_without_files.length > 0) {
        for (const ref of report.orphans.db_references_without_files) {
            console.log(`  • ${ref}`);
        }
    }

    // Collect all errors
    const all_errors = [
        ...report.users.errors,
        ...report.exhibits.errors,
        ...report.grids.errors,
        ...report.timelines.errors,
        ...report.heading_items.errors,
        ...report.standard_items.errors,
        ...report.grid_items.errors,
        ...report.timeline_items.errors,
        ...report.media_library.errors,
        ...report.exhibit_media.errors,
        ...report.files_copied.errors,
        ...report.thumbnails.errors,
        ...(report.iiif_manifests.error ? [report.iiif_manifests.error] : [])
        // ...report.styles.errors // Styles migration moved to standalone script
    ];

    console.log(`\n── Errors: ${all_errors.length} ──`);
    if (all_errors.length > 0) {
        for (const err of all_errors) {
            console.log(`  • ${err}`);
        }
    }

    // Write report to JSON file
    const report_filename = `migration_report_${Date.now()}.json`;
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
    console.log('Exhibits v1 → v2 Migration');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log('══════════════════════════════════════════════════════');

    try {
        // Verify database connections
        await v1_db.raw('SELECT 1');
        console.log('v1 database connected.');
        await v2_db.raw('SELECT 1');
        console.log('v2 database connected.');

        // Verify storage paths
        if (!await file_exists(V1_STORAGE_PATH)) {
            throw new Error(`v1 storage path not found: ${V1_STORAGE_PATH}`);
        }
        if (!await file_exists(V2_MEDIA_LIBRARY_PATH)) {
            throw new Error(`v2 media-library path not found: ${V2_MEDIA_LIBRARY_PATH}`);
        }

        await migrate_users();
        await migrate_exhibits();
        await migrate_containers();
        await migrate_items();
        await convert_titles_to_subheadings();
        await detect_orphans();
        await migrate_exhibit_media();
        await migrate_item_media();
        await generate_iiif_manifests();
        // await convert_styles(); // Styles migration moved to standalone script
        await generate_report();

    } catch (err) {
        console.error(`\nFATAL ERROR: ${err.message}`);
        console.error(err.stack);
    } finally {
        await v1_db.destroy();
        await v2_db.destroy();
        console.log('\nDatabase connections closed.');

        // Shut down exiftool child process to prevent hang on exit
        try {
            await exiftool.end();
            console.log('ExifTool process terminated.');
        } catch (err) {
            console.error(`ExifTool shutdown error: ${err.message}`);
        }
    }
}

// Run automatically only when invoked directly (node migrate_v1_to_v2.js).
// When required as a module (e.g. by tests), the individual phase functions
// are exported below so they can be exercised without main()'s storage checks.
if (require.main === module) {
    main();
}

module.exports = {
    main,
    migrate_users,
    migrate_exhibits,
    migrate_containers,
    migrate_items,
    convert_titles_to_subheadings,
    migrate_exhibit_media,
    migrate_item_media,
    build_media_name,
    subheading_uuid_for,
    ensure_owner_map,
    remap_owner,
    v1_db,
    v2_db
};
