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

'use strict';

/**
 * IIIF derivative cache
 *
 * Stores transcoded IIIF Image API outputs on disk so an identical request is
 * served straight from the cache instead of re-reading and re-transcoding the
 * original on every hit (the "IIIF re-reads + re-transcodes originals on every
 * request, no server-side derivative cache" performance finding).
 *
 * Layout (parallels the hash-bucketed media storage):
 *
 *   <STORAGE_PATH>/iiif_cache/<b1>/<b2>/<uuid>/<version>/<variant>.<ext>
 *
 *   - <b1>/<b2>  : first two / next two hex chars of the UUID (even spread)
 *   - <uuid>     : the media record UUID — so every derivative of one record
 *                  lives under a single directory that purge() can drop whole
 *   - <version>  : the record's `updated` timestamp, normalized. Any change to
 *                  the record (including a replaced source file, which bumps
 *                  `updated`) yields a NEW version directory. The image handler
 *                  always reads the live record, so it only ever references the
 *                  CURRENT version — a stale derivative can never be served,
 *                  even if a purge is missed. Superseded version directories are
 *                  reclaimed by purge() (on update/delete) and by the weekly
 *                  orphaned-file cleanup sweep.
 *   - <variant>  : short deterministic digest of the IIIF transform params
 *                  (region/size/rotation/quality.format)
 *
 * All operations are best-effort: a cache read/write failure degrades to a
 * normal transcode and never fails the request.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const LOGGER = require('../libs/log4');

const storage_config = require('./storage_config')();
const STORAGE_PATH = storage_config.storage_path;
const PERMISSIONS = storage_config.permissions || { file: 0o640, directory: 0o750 };

// Name of the cache subtree under STORAGE_PATH. Exported so the orphaned-file
// cleanup task can locate and sweep it.
const CACHE_DIR_NAME = 'iiif_cache';
const CACHE_ROOT = path.join(STORAGE_PATH, CACHE_DIR_NAME);

// IIIF output format -> file extension (mirrors SUPPORTED_FORMATS in iiif-service)
const FORMAT_EXTENSIONS = { jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp' };

/**
 * First two / next two hex characters of a UUID (hyphens stripped), used as
 * two levels of bucket directories. Mirrors uploads.get_hash_buckets().
 * @param {string} uuid - Media record UUID
 * @returns {string[]} Two-element array of directory segments
 */
const get_hash_buckets = (uuid) => {
    const clean = String(uuid).replace(/-/g, '');
    return [clean.substring(0, 2), clean.substring(2, 4)];
};

/**
 * Normalizes a record's version token (the `updated` timestamp) to a stable,
 * filesystem-safe string. Falls back to '0' when absent so unversioned records
 * still cache coherently.
 * @param {string|number|Date|null} version - Record `updated` (or `created`) value
 * @returns {string} Normalized version token
 */
const normalize_version = (version) => {

    if (version === null || version === undefined || version === '') {
        return '0';
    }

    const millis = new Date(version).getTime();

    if (Number.isFinite(millis)) {
        return String(millis);
    }

    // Non-date value — strip to a safe token rather than risk path characters
    return String(version).replace(/[^0-9a-z]/gi, '') || '0';
};

/**
 * Deterministic, filesystem-safe digest of the IIIF transform parameters.
 * @param {string} region - IIIF region parameter
 * @param {string} size - IIIF size parameter
 * @param {string} rotation - IIIF rotation parameter
 * @param {string} quality_format - IIIF quality.format parameter
 * @returns {string} 16-char hex digest
 */
const variant_digest = (region, size, rotation, quality_format) => {
    const canonical = `${region}|${size}|${rotation}|${quality_format}`;
    return crypto.createHash('sha1').update(canonical).digest('hex').substring(0, 16);
};

/**
 * Resolves the file extension for a quality.format value (e.g. 'default.jpg' -> 'jpg').
 * @param {string} quality_format - IIIF quality.format parameter
 * @returns {string} File extension without a dot
 */
const format_extension = (quality_format) => {
    const dot = String(quality_format).lastIndexOf('.');
    const fmt = dot === -1 ? '' : String(quality_format).substring(dot + 1).toLowerCase();
    return FORMAT_EXTENSIONS[fmt] || 'bin';
};

/**
 * Absolute path of the cached derivative for a (uuid, version, params) tuple.
 * @returns {string} Absolute cache file path
 */
const derivative_path = (uuid, version, region, size, rotation, quality_format) => {
    const [bucket1, bucket2] = get_hash_buckets(uuid);
    const v = normalize_version(version);
    const variant = variant_digest(region, size, rotation, quality_format);
    const ext = format_extension(quality_format);
    return path.join(CACHE_ROOT, bucket1, bucket2, uuid, v, `${variant}.${ext}`);
};

/**
 * Strong HTTP validator for a derivative. Changes if (and only if) the bytes
 * change, because it is built from the same version + variant the cache path is.
 * @returns {string} Quoted ETag value
 */
const compute_etag = (uuid, version, region, size, rotation, quality_format) => {
    const v = normalize_version(version);
    const variant = variant_digest(region, size, rotation, quality_format);
    return `"${uuid}-${v}-${variant}"`;
};

/**
 * Reads a cached derivative if present.
 * @returns {Promise<Buffer|null>} Cached buffer on a hit, null on a miss
 */
const get_cached = async (uuid, version, region, size, rotation, quality_format) => {

    try {
        const file = derivative_path(uuid, version, region, size, rotation, quality_format);
        return await fsp.readFile(file);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            LOGGER.module().warn(`WARNING: [/media-library/iiif-cache (get_cached)] Read failed for ${uuid}: ${error.message}`);
        }
        return null;
    }
};

/**
 * Writes a derivative to the cache atomically (temp file + rename), creating
 * bucket directories as needed. Best-effort: returns false instead of throwing.
 * @param {Buffer} buffer - Transcoded image bytes
 * @returns {Promise<boolean>} True if the derivative was written
 */
const put_cached = async (uuid, version, region, size, rotation, quality_format, buffer) => {

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return false;
    }

    const file = derivative_path(uuid, version, region, size, rotation, quality_format);
    const dir = path.dirname(file);

    try {

        await fsp.mkdir(dir, { recursive: true, mode: PERMISSIONS.directory });

        // Atomic publish: write a unique temp file in the same directory (same
        // filesystem) then rename over the final path, so a concurrent reader
        // never observes a partially written derivative.
        const tmp = path.join(dir, `.tmp-${crypto.randomBytes(8).toString('hex')}`);
        await fsp.writeFile(tmp, buffer, { mode: PERMISSIONS.file });
        await fsp.rename(tmp, file);
        return true;

    } catch (error) {
        LOGGER.module().warn(`WARNING: [/media-library/iiif-cache (put_cached)] Write failed for ${uuid}: ${error.message}`);
        return false;
    }
};

/**
 * Removes every cached derivative (all versions and variants) for a UUID.
 * Called on media update/delete so superseded or orphaned derivatives are
 * reclaimed promptly. Best-effort: never throws.
 * @param {string} uuid - Media record UUID
 * @returns {Promise<boolean>} True if the purge completed without error
 */
const purge = async (uuid) => {

    try {
        const [bucket1, bucket2] = get_hash_buckets(uuid);
        const dir = path.join(CACHE_ROOT, bucket1, bucket2, uuid);
        await fsp.rm(dir, { recursive: true, force: true });
        return true;
    } catch (error) {
        LOGGER.module().warn(`WARNING: [/media-library/iiif-cache (purge)] Purge failed for ${uuid}: ${error.message}`);
        return false;
    }
};

module.exports = {
    CACHE_DIR_NAME,
    CACHE_ROOT,
    get_cached,
    put_cached,
    purge,
    compute_etag,
    derivative_path,
    variant_digest,
    normalize_version,
    get_hash_buckets
};
