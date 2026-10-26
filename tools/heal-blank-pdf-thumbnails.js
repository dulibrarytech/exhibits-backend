#!/usr/bin/env node

'use strict';

/**
 * Heals PDF thumbnails that were generated blank.
 *
 * Cause: pdfjs decodes JPEG 2000 (JPX) imagery through an OpenJPEG WASM module,
 * and in Node it cannot locate its own bundled assets unless told where they
 * are. Before media-library/pdf-render.js supplied `wasmUrl`, pdfjs reported
 * "JpxError: OpenJPEG failed to initialize" as a console warning ONLY, then
 * rendered the page without that imagery and returned success. Documents that
 * are JPEG 2000 scans therefore produced a real, correctly sized thumbnail JPEG
 * that is pure white.
 *
 * The renderer is fixed, so new uploads are correct — but a stored thumbnail is
 * written once, at upload, and never regenerates itself. This heals the ones
 * already on disk.
 *
 * Detection is by Sharp's entropy: a featureless image measures ~0, whereas any
 * real page scan measures well above 1. A page that is genuinely blank (a cover
 * sheet, a separator) is indistinguishable from a failed decode by inspection
 * alone, so the script re-renders it and reports it as STILL BLANK rather than
 * claiming a fix.
 *
 * Regeneration goes through uploads.generate_pdf_thumbnail — the same function
 * an upload calls — so a healed thumbnail is byte-for-byte what a fresh upload
 * of the same file would produce today.
 *
 * Two invalidations are required, and BOTH matter:
 *
 *   - IIIF_CACHE.purge() drops the derivatives transcoded from the blank
 *     thumbnail, which would otherwise keep being served from disk;
 *   - the record's `updated` timestamp is bumped, because it is part of the
 *     derivative cache key AND of the ETag. Without that bump, a browser
 *     holding a cached blank image revalidates, matches the unchanged ETag and
 *     is told 304 Not Modified — so it keeps showing the blank for up to the
 *     24-hour max-age even though the server has correct bytes.
 *
 * Dry run (default):  node tools/heal-blank-pdf-thumbnails.js
 * Apply:              node tools/heal-blank-pdf-thumbnails.js --apply
 * One record:         node tools/heal-blank-pdf-thumbnails.js --apply --uuid=<uuid>
 */

require('dotenv').config();

const FS = require('fs');
const PATH = require('path');
const SHARP = require('sharp');
const knex = require('knex');
const UPLOADS = require('../media-library/uploads');
const IIIF_CACHE = require('../media-library/iiif-cache');

const APPLY = process.argv.includes('--apply');
const UUID_ARGUMENT = process.argv.find((argument) => argument.startsWith('--uuid='));
const ONLY_UUID = UUID_ARGUMENT ? UUID_ARGUMENT.split('=')[1] : null;

/*
 * Entropy below this is treated as featureless. Real page scans in this corpus
 * measure 2.0 and up; a blank render measures exactly 0.
 */
const BLANK_ENTROPY_THRESHOLD = 0.01;

/*
 * Sharp caches operation results keyed by input, so a file read BEFORE a
 * regeneration is still served from that cache afterwards: the verification
 * read of a freshly written thumbnail came back with the old blank image's
 * statistics and the script reported a successful heal as "still blank".
 * Disable the cache outright — this is a short-lived CLI, it has nothing to
 * gain from it — and read through a Buffer as well, so verification cannot be
 * answered from anything but the bytes now on disk.
 */
SHARP.cache(false);

const STORAGE_PATH = UPLOADS.STORAGE_PATH;

const DB = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
});

/**
 * Absolute path for a storage-relative path, or null when it is absent.
 * @param {string|null} relative_path - Path stored on the record
 * @returns {string|null} Absolute path, or null
 */
const absolute_path = (relative_path) => {
    return relative_path ? PATH.join(STORAGE_PATH, relative_path) : null;
};

/**
 * Sharp's entropy for an image on disk — ~0 when the image is featureless.
 * @param {string} file_path - Absolute image path
 * @returns {Promise<number|null>} Entropy, or null when the image is unreadable
 */
const entropy_of = async (file_path) => {

    try {
        const stats = await SHARP(FS.readFileSync(file_path)).stats();
        return stats.entropy;
    } catch (error) {
        return null;
    }
};

/**
 * Decides whether a record needs healing, and why.
 * @param {Object} record - Media library row
 * @returns {Promise<Object>} { action: 'heal'|'skip'|'ok', reason, entropy }
 */
const classify = async (record) => {

    const pdf_path = absolute_path(record.storage_path);

    if (!pdf_path || !FS.existsSync(pdf_path)) {
        return { action: 'skip', reason: 'source PDF is not on disk — nothing to render from' };
    }

    const thumbnail_path = absolute_path(record.thumbnail_path);

    if (!thumbnail_path || !FS.existsSync(thumbnail_path)) {
        return { action: 'heal', reason: 'no thumbnail on disk' };
    }

    const entropy = await entropy_of(thumbnail_path);

    if (entropy === null) {
        return { action: 'heal', reason: 'thumbnail is unreadable' };
    }

    if (entropy < BLANK_ENTROPY_THRESHOLD) {
        return { action: 'heal', reason: 'thumbnail is blank', entropy };
    }

    return { action: 'ok', entropy };
};

/**
 * Regenerates one record's thumbnail and invalidates both caches.
 * @param {Object} record - Media library row
 * @returns {Promise<Object>} { healed, still_blank, entropy, message }
 */
const heal = async (record) => {

    const pdf_path = absolute_path(record.storage_path);
    const pdf_buffer = FS.readFileSync(pdf_path);

    const generated = await UPLOADS.generate_pdf_thumbnail(pdf_buffer, record.uuid, pdf_path);

    if (!generated) {
        return { healed: false, message: 'thumbnail generation returned null' };
    }

    const entropy = await entropy_of(generated);
    const metadata = await SHARP(FS.readFileSync(generated)).metadata();
    const relative_thumbnail = PATH.relative(STORAGE_PATH, generated);

    /*
     * Bump `updated` explicitly. The column carries ON UPDATE
     * CURRENT_TIMESTAMP, but MySQL only applies that when a value actually
     * changes — and on a record whose dimensions happen to match, nothing would
     * change, leaving the ETag intact and every cached blank image valid.
     */
    await DB('tbl_media_library')
        .where({ uuid: record.uuid })
        .update({
            thumbnail_path: relative_thumbnail,
            media_width: metadata.width || null,
            media_height: metadata.height || null,
            updated: DB.fn.now()
        });

    await IIIF_CACHE.purge(record.uuid);

    return {
        healed: true,
        still_blank: entropy !== null && entropy < BLANK_ENTROPY_THRESHOLD,
        entropy,
        dimensions: `${metadata.width}x${metadata.height}`
    };
};

(async () => {

    const query = DB('tbl_media_library')
        .select('uuid', 'name', 'storage_path', 'thumbnail_path')
        .where({ media_type: 'pdf', is_deleted: 0 });

    if (ONLY_UUID) {
        query.andWhere({ uuid: ONLY_UUID });
    }

    const records = await query;

    console.log(`${records.length} active PDF record(s) to inspect${ONLY_UUID ? ` (filtered to ${ONLY_UUID})` : ''}`);
    console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: dry run — pass --apply to regenerate\n');

    const counts = { ok: 0, healed: 0, still_blank: 0, skipped: 0, failed: 0 };

    for (const record of records) {

        const label = `${record.uuid}  ${(record.name || '').slice(0, 44)}`;
        const verdict = await classify(record);

        if (verdict.action === 'ok') {
            counts.ok++;
            continue;
        }

        if (verdict.action === 'skip') {
            console.log(`  SKIP        ${label}\n              ${verdict.reason}`);
            counts.skipped++;
            continue;
        }

        if (!APPLY) {
            const measured = verdict.entropy === undefined ? '' : ` (entropy ${verdict.entropy.toFixed(4)})`;
            console.log(`  WOULD HEAL  ${label}\n              ${verdict.reason}${measured}`);
            counts.healed++;
            continue;
        }

        const result = await heal(record);

        if (!result.healed) {
            console.log(`  FAILED      ${label}\n              ${result.message}`);
            counts.failed++;
            continue;
        }

        if (result.still_blank) {
            console.log(`  STILL BLANK ${label}\n              re-rendered but still featureless — page 1 may genuinely be blank`);
            counts.still_blank++;
            continue;
        }

        console.log(`  HEALED      ${label}\n              ${result.dimensions}, entropy ${result.entropy.toFixed(3)}; cache purged, ETag invalidated`);
        counts.healed++;
    }

    console.log(`\nalready OK: ${counts.ok}`);
    console.log(`${APPLY ? 'healed' : 'would heal'}: ${counts.healed}`);

    if (counts.still_blank > 0) {
        console.log(`still blank after re-render: ${counts.still_blank}  <- inspect these by hand`);
    }

    if (counts.skipped > 0) {
        console.log(`skipped (unhealable): ${counts.skipped}`);
    }

    if (counts.failed > 0) {
        console.log(`failed: ${counts.failed}`);
    }

    if (!APPLY && counts.healed > 0) {
        console.log('\nNothing was changed. Re-run with --apply to regenerate.');
    }

    await UPLOADS.shutdown_exiftool().catch(() => {});
    await DB.destroy();
})().catch(async (error) => {
    console.error('FAILED:', error.message);
    await UPLOADS.shutdown_exiftool().catch(() => {});
    await DB.destroy();
    process.exit(1);
});
