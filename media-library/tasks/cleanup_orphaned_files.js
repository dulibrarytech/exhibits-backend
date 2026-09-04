/**

 Copyright 2026 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

/**
 * Orphaned File Cleanup Script
 *
 * Scans the hash-bucketed storage directories for files that no row of the
 * media_library_records table references, and (with --delete) removes them
 * and prunes empty hash-bucket directories.
 *
 * What "referenced" means (code review 2026-09-02, C5):
 *   A file is referenced when its storage-relative path equals some row's
 *   storage_path or thumbnail_path — ANY row, soft-deleted ones included, so
 *   recycle-bin restores keep working. Files are NOT matched by the UUID in
 *   their filename: v2 uploads name the file by the upload uuid while the
 *   record gets a different uuid (uploads.js store_file / model.js create),
 *   so a uuid-keyed sweep would delete every v2 upload. IIIF derivative-cache
 *   directories ARE keyed by the record uuid (iiif-cache.js) and are matched
 *   against the rows' uuid column.
 *
 * Fail-closed: if the reference query fails, or returns no rows while files
 * exist, the run aborts and deletes nothing.
 *
 * Usage:
 *   node media-library/tasks/cleanup_orphaned_files.js              (dry run — default)
 *   node media-library/tasks/cleanup_orphaned_files.js --delete     (actually delete)
 *   node media-library/tasks/cleanup_orphaned_files.js --help
 *
 * The script automatically resolves the project root from its own location,
 * so it can be invoked from any working directory.
 *
 * Environment:
 *   Loads .env from the project root automatically via dotenv.
 *   Requires the same environment variables as the main application
 *   (DB connection, STORAGE_PATH, etc.)
 *
 * Output:
 *   Logs all actions via the application logger and prints a summary to stdout.
 *
 * Schedule:
 *   Run weekly via cron during off-hours:
 *   0 3 * * 0  node /path/to/exhibits-backend/media-library/tasks/cleanup_orphaned_files.js --delete >> /path/to/exhibits-backend/logs/cleanup.log
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;

// ---------------------------------------------------------------------------
// Anchor to project root
// ---------------------------------------------------------------------------
// This script lives at media-library/tasks/cleanup_orphaned_files.js.
// All application modules resolve paths relative to process.cwd(), so we
// must set CWD to the project root BEFORE requiring anything else.
// This ensures:
//   - storage_config resolves STORAGE_PATH correctly
//   - log4js writes to ./logs/exhibits.log at the project root
//   - db_config and other configs find .env and resolve properly
const PROJECT_ROOT = path.resolve(__dirname, '../../');
process.chdir(PROJECT_ROOT);

// Load environment variables from project root .env
try {
    require('dotenv').config();
} catch (e) {
    // dotenv is optional if environment variables are set externally
}

// Load application modules (now that CWD is project root)
const DB = require('../../config/db_config')();
const DB_TABLES = require('../../config/db_tables_config')();
/*
 * db_tables_config exports { exhibits: { media_library_records, ... } }. The
 * previous `DB_TABLES.media_library_records` was undefined, which made every
 * reference lookup throw and the sweep silently treat every file as "in DB".
 */
const MEDIA_TABLE = DB_TABLES.exhibits.media_library_records;
const STORAGE_CONFIG = require('../../media-library/storage_config')();
const LOGGER = require('../../libs/log4');
const UUID_LIB = require('../../libs/uuid');

// Reconfigure log4js to file-only output (suppress stdout appender).
// This keeps console.log output (the cleanup report) as the only thing
// on stdout, so redirecting to cleanup.log produces clean output
// without ANSI color codes or interleaved log4js messages.
const LOG4JS = require('log4js');
LOG4JS.configure({
    appenders: {
        exhibits: {
            type: 'dateFile',
            filename: './logs/exhibits.log',
            compress: true
        }
    },
    categories: {
        default: {
            appenders: ['exhibits'],
            level: 'info'
        }
    }
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STORAGE_PATH = STORAGE_CONFIG.storage_path;
const MEDIA_TYPE_DIRS = STORAGE_CONFIG.media_type_dirs || {
    image: 'images',
    pdf: 'documents',
    video: 'video',
    audio: 'audio',
    thumbnails: 'thumbnails'
};

/* Primary file directories; thumbnails are scanned too, as their own dir type. */
const PRIMARY_DIRS = [
    MEDIA_TYPE_DIRS.image,      // 'images'
    MEDIA_TYPE_DIRS.pdf,        // 'documents'
    MEDIA_TYPE_DIRS.video,      // 'video'
    MEDIA_TYPE_DIRS.audio       // 'audio'
].filter(Boolean);
const THUMBNAIL_DIR = MEDIA_TYPE_DIRS.thumbnails || 'thumbnails';
const SCANNED_DIRS = [...PRIMARY_DIRS, THUMBNAIL_DIR];

// IIIF derivative-cache subtree (see media-library/iiif-cache.js). Its layout is
// iiif_cache/<b1>/<b2>/<uuid>/<version>/<variant>.<ext>, so each record's
// derivatives live under one <uuid> directory that is swept whole when the
// UUID no longer has a DB record.
const IIIF_CACHE_DIR = 'iiif_cache';

/*
 * UUID at the START of a filename (capture group 1), e.g. "<uuid>_thumb.jpg".
 * Derived from the shared strict pattern in libs/uuid with its ^...$ anchors
 * replaced by a leading anchor only, so the shape has one definition.
 */
const UUID_REGEX = new RegExp(`^(${UUID_LIB.UUID_REGEX.source.slice(1, -1)})`, 'i');

// Minimum file age before it is eligible for cleanup (in hours)
// Protects files that are mid-upload or awaiting metadata entry
const MIN_AGE_HOURS = 24;

// ---------------------------------------------------------------------------
// Filesystem Scanning
// ---------------------------------------------------------------------------

/**
 * Recursively walks a directory tree and collects all file paths
 * @param {string} dir_path - Directory to walk
 * @returns {Promise<string[]>} Array of absolute file paths
 */
const walk_directory = async (dir_path) => {

    const results = [];

    try {
        const entries = await fs.readdir(dir_path, { withFileTypes: true });

        for (const entry of entries) {
            const full_path = path.join(dir_path, entry.name);

            if (entry.isDirectory()) {
                const nested = await walk_directory(full_path);
                results.push(...nested);
            } else if (entry.isFile()) {
                results.push(full_path);
            }
        }
    } catch (error) {
        // Directory may not exist (e.g., no video files uploaded yet)
        if (error.code !== 'ENOENT') {
            LOGGER.module().warn(`WARNING: [cleanup] Could not read directory ${dir_path}: ${error.message}`);
        }
    }

    return results;
};

/**
 * Storage-relative, forward-slash, lower-cased key for a file on disk — the
 * form in which storage_path / thumbnail_path are stored in the DB.
 * @param {string} absolute_path
 * @returns {string}
 */
const to_storage_key = (absolute_path) => {
    return path.relative(STORAGE_PATH, absolute_path).split(path.sep).join('/').toLowerCase();
};

/**
 * Normalizes a DB path value to the same key form, or null when empty.
 * @param {*} value - storage_path / thumbnail_path column value
 * @returns {string|null}
 */
const normalize_reference = (value) => {

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim().replace(/\\/g, '/').replace(/^\.?\//, '');
    return trimmed === '' ? null : trimmed.toLowerCase();
};

/**
 * The thumbnail path uploads.js would have written for a stored file, derived
 * from the FILE's uuid (not the record's). Protects a thumbnail on disk even
 * for a row whose thumbnail_path column is empty.
 * @param {string} storage_key - normalized storage_path
 * @returns {string|null}
 */
const conventional_thumbnail_key = (storage_key) => {

    const basename = storage_key.split('/').pop();
    const match = basename.match(UUID_REGEX);

    if (!match) {
        return null;
    }

    const uuid = match[1].toLowerCase();
    const clean = uuid.replace(/-/g, '');
    return `${THUMBNAIL_DIR}/${clean.substring(0, 2)}/${clean.substring(2, 4)}/${uuid}_thumb.jpg`.toLowerCase();
};

/**
 * Collects the UUID-level directories of the IIIF derivative cache.
 * The cache nests as iiif_cache/<b1>/<b2>/<uuid>/..., so the UUID is a
 * directory name (not a filename). Missing cache root is normal (nothing
 * cached yet) and returns an empty map.
 * @param {string} cache_root - Absolute path to the iiif_cache directory
 * @returns {Promise<Map<string, string>>} Map of uuid -> absolute uuid-dir path
 */
const scan_iiif_cache_uuid_dirs = async (cache_root) => {

    const map = new Map();

    let bucket1_entries;

    try {
        bucket1_entries = await fs.readdir(cache_root, { withFileTypes: true });
    } catch (error) {
        if (error.code !== 'ENOENT') {
            LOGGER.module().warn(`WARNING: [cleanup] Could not read IIIF cache ${cache_root}: ${error.message}`);
        }
        return map; // No cache directory yet — nothing to sweep
    }

    for (const bucket1 of bucket1_entries) {

        if (!bucket1.isDirectory()) {
            continue;
        }

        const bucket1_path = path.join(cache_root, bucket1.name);
        const bucket2_entries = await fs.readdir(bucket1_path, { withFileTypes: true }).catch(() => []);

        for (const bucket2 of bucket2_entries) {

            if (!bucket2.isDirectory()) {
                continue;
            }

            const bucket2_path = path.join(bucket1_path, bucket2.name);
            const uuid_entries = await fs.readdir(bucket2_path, { withFileTypes: true }).catch(() => []);

            for (const entry of uuid_entries) {

                if (!entry.isDirectory()) {
                    continue;
                }

                const uuid = entry.name.toLowerCase();

                if (UUID_REGEX.test(uuid)) {
                    map.set(uuid, path.join(bucket2_path, entry.name));
                }
            }
        }
    }

    return map;
};

// ---------------------------------------------------------------------------
// Database Lookups
// ---------------------------------------------------------------------------

/**
 * Loads every reference the database holds on the storage tree, from ALL rows
 * (active and soft-deleted alike).
 *
 * @returns {Promise<{paths: Set<string>, uuids: Set<string>, rows: number}>}
 *   paths — normalized storage_path / thumbnail_path values (+ the conventional
 *           thumbnail for each storage_path); uuids — record uuids (IIIF cache)
 * @throws when the query fails — callers must treat that as "abort"
 */
const load_references = async () => {

    const rows = await DB(MEDIA_TABLE).select('uuid', 'storage_path', 'thumbnail_path');

    const paths = new Set();
    const uuids = new Set();

    for (const row of rows) {

        const storage_key = normalize_reference(row.storage_path);
        const thumbnail_key = normalize_reference(row.thumbnail_path);

        if (storage_key) {
            paths.add(storage_key);
            const derived = conventional_thumbnail_key(storage_key);
            if (derived) {
                paths.add(derived);
            }
        }

        if (thumbnail_key) {
            paths.add(thumbnail_key);
        }

        if (typeof row.uuid === 'string' && row.uuid.trim() !== '') {
            uuids.add(row.uuid.trim().toLowerCase());
        }
    }

    return { paths, uuids, rows: rows.length };
};

// ---------------------------------------------------------------------------
// File Deletion
// ---------------------------------------------------------------------------

/**
 * Deletes a file and prunes empty parent directories up to the storage root
 * @param {string} file_path - Absolute path to file
 * @returns {Promise<boolean>} True if file was deleted
 */
const delete_file = async (file_path) => {

    try {
        await fs.unlink(file_path);
        await prune_empty_parents(path.dirname(file_path));
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false; // Already gone
        }
        LOGGER.module().error(`ERROR: [cleanup] Failed to delete ${file_path}: ${error.message}`);
        return false;
    }
};

/**
 * Removes empty directories up the hash-bucket chain
 * Stops at the storage root to avoid deleting top-level type directories
 * @param {string} dir_path - Starting directory to check
 * @returns {Promise<void>}
 */
const prune_empty_parents = async (dir_path) => {

    const resolved_storage = path.resolve(STORAGE_PATH);

    // Stop at or above the storage root
    if (!dir_path.startsWith(resolved_storage) || dir_path === resolved_storage) {
        return;
    }

    // Don't remove top-level type directories (images/, documents/, etc.)
    const relative = path.relative(resolved_storage, dir_path);
    const depth = relative.split(path.sep).length;

    if (depth <= 1) {
        return; // This is a type directory like 'images' — keep it
    }

    try {
        const entries = await fs.readdir(dir_path);

        if (entries.length === 0) {
            await fs.rmdir(dir_path);
            await prune_empty_parents(path.dirname(dir_path));
        }
    } catch {
        // Directory may have been removed by a concurrent operation
    }
};

// ---------------------------------------------------------------------------
// Age Check
// ---------------------------------------------------------------------------

/**
 * Checks if a file is older than the minimum age threshold
 * @param {string} file_path - Absolute file path
 * @returns {Promise<boolean>} True if file is old enough to be eligible
 */
const is_old_enough = async (file_path) => {

    try {
        const stats = await fs.stat(file_path);
        const age_ms = Date.now() - stats.mtimeMs;
        const age_hours = age_ms / (1000 * 60 * 60);
        return age_hours >= MIN_AGE_HOURS;
    } catch {
        return false; // Can't stat — skip it
    }
};

// ---------------------------------------------------------------------------
// Main Cleanup Logic
// ---------------------------------------------------------------------------

/**
 * Runs the orphaned file cleanup process
 * @param {boolean} dry_run - If true, report only without deleting
 * @returns {Promise<Object>} Summary of cleanup results
 */
const run_cleanup = async (dry_run = true) => {

    const mode_label = dry_run ? 'DRY RUN' : 'DELETE';
    LOGGER.module().info(`INFO: [cleanup] Starting orphaned file cleanup (${mode_label})`);
    console.log(`\n========================================`);
    console.log(`  Orphaned File Cleanup — ${mode_label}`);
    console.log(`========================================`);
    console.log(`Storage path: ${STORAGE_PATH}`);
    console.log(`Min file age: ${MIN_AGE_HOURS} hours`);
    console.log(`Scanning:     ${SCANNED_DIRS.join(', ')}, ${IIIF_CACHE_DIR}\n`);

    const stats = {
        files_scanned: 0,
        files_referenced: 0,
        db_rows: 0,
        orphaned_files: 0,
        orphaned_thumbnails: 0,
        files_deleted: 0,
        thumbnails_deleted: 0,
        skipped_too_new: 0,
        cache_uuids_found: 0,
        orphaned_cache_dirs: 0,
        cache_dirs_deleted: 0,
        errors: 0,
        bytes_recovered: 0,
        aborted: null
    };

    // Step 1: Scan storage directories (primary files AND thumbnails)
    console.log('Step 1: Scanning storage directories...');

    const scanned = []; // { file_path, key, dir_type }

    for (const dir_name of SCANNED_DIRS) {
        const dir_path = path.join(STORAGE_PATH, dir_name);
        const files = await walk_directory(dir_path);

        for (const file_path of files) {
            stats.files_scanned++;
            scanned.push({ file_path, key: to_storage_key(file_path), dir_type: dir_name });
        }
    }

    const cache_root = path.join(STORAGE_PATH, IIIF_CACHE_DIR);
    const cache_uuid_dirs = await scan_iiif_cache_uuid_dirs(cache_root);
    stats.cache_uuids_found = cache_uuid_dirs.size;

    console.log(`  Found ${stats.files_scanned} file(s) and ${stats.cache_uuids_found} cached derivative set(s)\n`);

    if (stats.files_scanned === 0 && stats.cache_uuids_found === 0) {
        console.log('No files found in storage. Nothing to clean up.');
        return stats;
    }

    // Step 2: Load every path/uuid the database references — fail closed
    console.log('Step 2: Loading database references...');

    let references;

    try {
        references = await load_references();
    } catch (error) {
        stats.errors++;
        stats.aborted = 'db-error';
        LOGGER.module().error(`ERROR: [cleanup] reference query failed — aborting, nothing deleted: ${error.message}`);
        console.log(`  ABORT: could not load references from the database (${error.message}). Nothing deleted.\n`);
        return stats;
    }

    stats.db_rows = references.rows;

    if (references.rows === 0) {
        stats.errors++;
        stats.aborted = 'no-references';
        LOGGER.module().error('ERROR: [cleanup] media table returned no rows while storage has files — aborting, nothing deleted');
        console.log('  ABORT: the media table has no rows; refusing to treat every file as an orphan. Nothing deleted.\n');
        return stats;
    }

    console.log(`  ${references.rows} row(s) reference ${references.paths.size} path(s) and ${references.uuids.size} uuid(s)\n`);

    // Step 3: Files not referenced by any row are orphans (age-gated)
    const orphans = scanned.filter(entry => !references.paths.has(entry.key));
    stats.files_referenced = scanned.length - orphans.length;

    if (orphans.length === 0) {
        console.log('No orphaned files found.\n');
        LOGGER.module().info('INFO: [cleanup] No orphaned files found');
    } else {
        console.log(`Step 3: Processing ${orphans.length} unreferenced file(s)...`);
    }

    for (const entry of orphans) {

        const is_thumbnail = entry.dir_type === THUMBNAIL_DIR;

        // Age threshold — a staged upload awaiting its record has no row yet
        const old_enough = await is_old_enough(entry.file_path);

        if (!old_enough) {
            stats.skipped_too_new++;
            console.log(`  SKIP (too new): ${entry.key}`);
            continue;
        }

        if (is_thumbnail) {
            stats.orphaned_thumbnails++;
        } else {
            stats.orphaned_files++;
        }

        let file_size = 0;

        try {
            file_size = (await fs.stat(entry.file_path)).size;
        } catch {
            // File may have been removed between scan and now
        }

        console.log(`  ORPHAN${is_thumbnail ? ' (thumbnail)' : ''}: ${entry.key} (${format_bytes(file_size)})`);
        LOGGER.module().info(`INFO: [cleanup] Orphaned file: ${entry.file_path} (${format_bytes(file_size)})`);

        if (!dry_run) {

            const deleted = await delete_file(entry.file_path);

            if (deleted) {
                if (is_thumbnail) {
                    stats.thumbnails_deleted++;
                } else {
                    stats.files_deleted++;
                }
                stats.bytes_recovered += file_size;
                LOGGER.module().info(`INFO: [cleanup] Deleted orphaned file: ${entry.file_path}`);
            } else {
                stats.errors++;
            }
        }
    }

    // Step 4: IIIF derivative-cache directories are keyed by RECORD uuid.
    // A cached uuid with no row (hard-deleted record whose purge was missed) is
    // removed whole; soft-deleted rows still exist, so their derivatives stay.
    console.log('Step 4: Sweeping IIIF derivative cache...');

    if (cache_uuid_dirs.size === 0) {
        console.log('  No cached derivatives found.\n');
    } else {

        const cache_orphans = Array.from(cache_uuid_dirs.keys()).filter(uuid => !references.uuids.has(uuid));

        console.log(`  ${cache_uuid_dirs.size} cached UUID(s); ${cache_orphans.length} orphaned\n`);

        for (const uuid of cache_orphans) {

            const dir = cache_uuid_dirs.get(uuid);

            // Sum the directory's bytes for reporting
            const files = await walk_directory(dir);
            let dir_bytes = 0;

            for (const file_path of files) {
                try {
                    dir_bytes += (await fs.stat(file_path)).size;
                } catch {
                    // File may have been removed concurrently
                }
            }

            stats.orphaned_cache_dirs++;
            console.log(`  ORPHAN (cache): ${IIIF_CACHE_DIR}/.../${uuid} (${format_bytes(dir_bytes)}, ${files.length} file(s))`);
            LOGGER.module().info(`INFO: [cleanup] Orphaned IIIF cache dir: ${dir} (${format_bytes(dir_bytes)})`);

            if (!dry_run) {

                try {
                    await fs.rm(dir, { recursive: true, force: true });
                    await prune_empty_parents(path.dirname(dir));
                    stats.cache_dirs_deleted++;
                    stats.bytes_recovered += dir_bytes;
                    LOGGER.module().info(`INFO: [cleanup] Deleted orphaned IIIF cache dir: ${dir}`);
                } catch (error) {
                    stats.errors++;
                    LOGGER.module().error(`ERROR: [cleanup] Failed to remove IIIF cache dir ${dir}: ${error.message}`);
                }
            }
        }

        console.log('');
    }

    // Step 5: Summary
    console.log(`\n========================================`);
    console.log(`  Cleanup Summary — ${mode_label}`);
    console.log(`========================================`);
    console.log(`  Files scanned:         ${stats.files_scanned}`);
    console.log(`  Files referenced:      ${stats.files_referenced}`);
    console.log(`  DB rows consulted:     ${stats.db_rows}`);
    console.log(`  Orphaned files:        ${stats.orphaned_files}`);
    console.log(`  Orphaned thumbnails:   ${stats.orphaned_thumbnails}`);
    console.log(`  Skipped (too new):     ${stats.skipped_too_new}`);
    console.log(`  Cache UUIDs found:     ${stats.cache_uuids_found}`);
    console.log(`  Orphaned cache dirs:   ${stats.orphaned_cache_dirs}`);

    if (!dry_run) {
        console.log(`  Files deleted:         ${stats.files_deleted}`);
        console.log(`  Thumbnails deleted:    ${stats.thumbnails_deleted}`);
        console.log(`  Cache dirs deleted:    ${stats.cache_dirs_deleted}`);
        console.log(`  Space recovered:       ${format_bytes(stats.bytes_recovered)}`);
        console.log(`  Errors:                ${stats.errors}`);
    } else {
        const total_orphans = stats.orphaned_files + stats.orphaned_thumbnails + stats.orphaned_cache_dirs;
        console.log(`\n  Run with --delete to remove ${total_orphans} orphaned item(s).`);
    }

    console.log('');

    LOGGER.module().info(`INFO: [cleanup] Cleanup complete (${mode_label}): ` +
        `${stats.orphaned_files} orphaned files, ` +
        `${stats.orphaned_thumbnails} orphaned thumbnails` +
        (dry_run ? '' : `, ${format_bytes(stats.bytes_recovered)} recovered`));

    return stats;
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Formats byte count as human-readable string
 * @param {number} bytes - Byte count
 * @returns {string} Formatted string (e.g., '1.5 MB')
 */
const format_bytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
    return `${size} ${units[i]}`;
};

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

const main = async () => {

    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: node media-library/tasks/cleanup_orphaned_files.js [options]

Scans storage for files that no media_library row references (by
storage_path / thumbnail_path, across active AND soft-deleted rows) and
optionally deletes them. Can be run from any working directory.

Options:
  --delete    Actually delete orphaned files (default is dry run)
  --help      Show this help message

Files younger than ${MIN_AGE_HOURS} hours are always skipped to protect
files that are mid-upload or awaiting metadata entry.
`);
        process.exit(0);
    }

    const dry_run = !args.includes('--delete');

    try {
        const stats = await run_cleanup(dry_run);
        process.exit(stats.errors > 0 ? 1 : 0);
    } catch (error) {
        LOGGER.module().error(`ERROR: [cleanup] Unhandled error: ${error.message}`);
        console.error('Fatal error:', error.message);
        process.exit(1);
    } finally {
        // Ensure the DB connection pool is closed so the process exits cleanly
        if (DB && typeof DB.destroy === 'function') {
            await DB.destroy();
        }
    }
};

// Run if executed directly (not required as a module)
if (require.main === module) {
    main();
}

// Export for testing or programmatic use from a controller endpoint
module.exports = { run_cleanup, load_references, normalize_reference, conventional_thumbnail_key };
