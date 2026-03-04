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
 * Scans the hash-bucketed storage directories for files whose UUIDs
 * do not have a corresponding record in the media_library_records table.
 * Orphaned files and their thumbnails are deleted, and empty hash-bucket
 * directories are pruned.
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
 * Recommended schedule:
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
const TABLES = DB_TABLES.media_library_records;
const STORAGE_CONFIG = require('../../media-library/storage_config')();
const LOGGER = require('../../libs/log4');

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

// Only scan primary file directories — thumbnails are handled as dependents
const PRIMARY_DIRS = [
    MEDIA_TYPE_DIRS.image,      // 'images'
    MEDIA_TYPE_DIRS.pdf,        // 'documents'
    MEDIA_TYPE_DIRS.video,      // 'video'
    MEDIA_TYPE_DIRS.audio       // 'audio'
].filter(Boolean);

// Batch size for DB lookups — keeps queries manageable
const DB_BATCH_SIZE = 200;

// UUID pattern: standard v1–v5 UUID in a filename
const UUID_REGEX = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i;

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
 * Extracts the UUID from a storage filename
 * Handles both primary files (uuid.ext) and thumbnails (uuid_thumb.jpg)
 * @param {string} file_path - Absolute file path
 * @returns {string|null} Extracted UUID or null if not a UUID-named file
 */
const extract_uuid_from_path = (file_path) => {
    const basename = path.basename(file_path);
    const match = basename.match(UUID_REGEX);
    return match ? match[1].toLowerCase() : null;
};

// ---------------------------------------------------------------------------
// Database Lookups
// ---------------------------------------------------------------------------

/**
 * Checks which UUIDs from a list exist in the media_library_records table
 * Includes both active and soft-deleted records to avoid deleting files
 * that are soft-deleted but may need recovery
 *
 * @param {string[]} uuids - Array of UUIDs to check
 * @returns {Promise<Set<string>>} Set of UUIDs that DO exist in the DB
 */
const get_existing_uuids = async (uuids) => {

    const existing = new Set();

    // Process in batches to avoid overly large IN clauses
    for (let i = 0; i < uuids.length; i += DB_BATCH_SIZE) {
        const batch = uuids.slice(i, i + DB_BATCH_SIZE);

        try {

            const rows = await DB(TABLES.media_library_records)
                .select('uuid')
                .whereIn('uuid', batch)
                .timeout(15000);

            for (const row of rows) {
                existing.add(row.uuid.toLowerCase());
            }

        } catch (error) {
            LOGGER.module().error(`ERROR: [cleanup] DB lookup failed for batch starting at index ${i}: ${error.message}`);
            // On DB error, assume all UUIDs in this batch exist — safer to skip than to delete
            for (const uuid of batch) {
                existing.add(uuid);
            }
        }
    }

    return existing;
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

/**
 * Builds the expected thumbnail path for a given UUID
 * Mirrors the logic in uploads.js build_thumbnail_path()
 * @param {string} uuid - File UUID
 * @returns {string} Absolute path to expected thumbnail
 */
const get_thumbnail_path = (uuid) => {
    const clean = uuid.replace(/-/g, '');
    const bucket1 = clean.substring(0, 2);
    const bucket2 = clean.substring(2, 4);
    return path.join(STORAGE_PATH, MEDIA_TYPE_DIRS.thumbnails, bucket1, bucket2, `${uuid}_thumb.jpg`);
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
    console.log(`Scanning:     ${PRIMARY_DIRS.join(', ')}\n`);

    const stats = {
        files_scanned: 0,
        uuids_found: 0,
        uuids_in_db: 0,
        orphaned_files: 0,
        orphaned_thumbnails: 0,
        files_deleted: 0,
        thumbnails_deleted: 0,
        skipped_too_new: 0,
        errors: 0,
        bytes_recovered: 0
    };

    // Step 1: Scan primary storage directories for all files
    console.log('Step 1: Scanning storage directories...');

    const file_map = new Map(); // uuid → { file_path, dir_type }

    for (const dir_name of PRIMARY_DIRS) {
        const dir_path = path.join(STORAGE_PATH, dir_name);
        const files = await walk_directory(dir_path);

        for (const file_path of files) {
            stats.files_scanned++;
            const uuid = extract_uuid_from_path(file_path);

            if (uuid) {
                file_map.set(uuid, {
                    file_path,
                    dir_type: dir_name
                });
            }
        }
    }

    stats.uuids_found = file_map.size;
    console.log(`  Found ${stats.files_scanned} files (${stats.uuids_found} unique UUIDs)\n`);

    if (stats.uuids_found === 0) {
        console.log('No files found in storage. Nothing to clean up.');
        return stats;
    }

    // Step 2: Check which UUIDs exist in the database
    console.log('Step 2: Checking UUIDs against database...');

    const all_uuids = Array.from(file_map.keys());
    const existing_uuids = await get_existing_uuids(all_uuids);

    stats.uuids_in_db = existing_uuids.size;
    console.log(`  ${stats.uuids_in_db} of ${stats.uuids_found} UUIDs have DB records\n`);

    // Step 3: Identify and process orphans
    const orphaned_uuids = all_uuids.filter(uuid => !existing_uuids.has(uuid));

    if (orphaned_uuids.length === 0) {
        console.log('No orphaned files found. Storage is clean.');
        LOGGER.module().info('INFO: [cleanup] No orphaned files found');
        return stats;
    }

    console.log(`Step 3: Processing ${orphaned_uuids.length} orphaned file(s)...`);

    for (const uuid of orphaned_uuids) {
        const entry = file_map.get(uuid);

        // Check age threshold — don't delete files that may be mid-upload
        const old_enough = await is_old_enough(entry.file_path);

        if (!old_enough) {
            stats.skipped_too_new++;
            console.log(`  SKIP (too new): ${entry.dir_type}/${uuid}`);
            continue;
        }

        stats.orphaned_files++;

        // Get file size for reporting
        let file_size = 0;

        try {
            const file_stats = await fs.stat(entry.file_path);
            file_size = file_stats.size;
        } catch {
            // File may have been removed between scan and now
        }

        console.log(`  ORPHAN: ${entry.dir_type}/${uuid} (${format_bytes(file_size)})`);
        LOGGER.module().info(`INFO: [cleanup] Orphaned file: ${entry.file_path} (${format_bytes(file_size)})`);

        if (!dry_run) {

            const deleted = await delete_file(entry.file_path);

            if (deleted) {
                stats.files_deleted++;
                stats.bytes_recovered += file_size;
                LOGGER.module().info(`INFO: [cleanup] Deleted orphaned file: ${entry.file_path}`);
            } else {
                stats.errors++;
            }
        }

        // Check for and handle the corresponding thumbnail
        const thumbnail_path = get_thumbnail_path(uuid);

        try {

            await fs.access(thumbnail_path);
            stats.orphaned_thumbnails++;

            let thumb_size = 0;

            try {
                const thumb_stats = await fs.stat(thumbnail_path);
                thumb_size = thumb_stats.size;
            } catch {
                // Non-critical
            }

            console.log(`  ORPHAN (thumbnail): thumbnails/${uuid}_thumb.jpg (${format_bytes(thumb_size)})`);

            if (!dry_run) {

                const deleted = await delete_file(thumbnail_path);

                if (deleted) {
                    stats.thumbnails_deleted++;
                    stats.bytes_recovered += thumb_size;
                    LOGGER.module().info(`INFO: [cleanup] Deleted orphaned thumbnail: ${thumbnail_path}`);
                } else {
                    stats.errors++;
                }
            }

        } catch {
            // No thumbnail exists for this UUID — that's fine
        }
    }

    // Step 4: Summary
    console.log(`\n========================================`);
    console.log(`  Cleanup Summary — ${mode_label}`);
    console.log(`========================================`);
    console.log(`  Files scanned:         ${stats.files_scanned}`);
    console.log(`  UUIDs found:           ${stats.uuids_found}`);
    console.log(`  UUIDs in database:     ${stats.uuids_in_db}`);
    console.log(`  Orphaned files:        ${stats.orphaned_files}`);
    console.log(`  Orphaned thumbnails:   ${stats.orphaned_thumbnails}`);
    console.log(`  Skipped (too new):     ${stats.skipped_too_new}`);

    if (!dry_run) {
        console.log(`  Files deleted:         ${stats.files_deleted}`);
        console.log(`  Thumbnails deleted:    ${stats.thumbnails_deleted}`);
        console.log(`  Space recovered:       ${format_bytes(stats.bytes_recovered)}`);
        console.log(`  Errors:                ${stats.errors}`);
    } else {
        const total_orphans = stats.orphaned_files + stats.orphaned_thumbnails;
        console.log(`\n  Run with --delete to remove ${total_orphans} orphaned file(s).`);
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

Scans storage for files whose UUIDs have no matching database record
and optionally deletes them. Can be run from any working directory.

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
module.exports = { run_cleanup };
