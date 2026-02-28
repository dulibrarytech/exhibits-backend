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

const FS = require('fs');
const PATH = require('path');
const SHARP = require('sharp');
const MEDIA_MODEL = require('../media-library/model');
const UPLOADS = require('../media-library/uploads');
const APP_CONFIG = require('../config/app_config')();
const LOGGER = require('../libs/log4');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Base URL for constructing IIIF identifiers
const APP_BASE_URL = APP_CONFIG.api_url || '';
const IIIF_BASE = `${APP_BASE_URL}/exhibits-dashboard/api/v1/media/library/iiif`;

// IIIF Presentation API 3.0 context
const IIIF_PRESENTATION_CONTEXT = 'http://iiif.io/api/presentation/3/context.json';

// IIIF Image API 3.0 context
const IIIF_IMAGE_CONTEXT = 'http://iiif.io/api/image/3/context.json';

// Default attribution for requiredStatement
const DEFAULT_ATTRIBUTION = 'University of Denver';

// Supported output formats for IIIF Image API
const SUPPORTED_FORMATS = {
    'jpg': { mime: 'image/jpeg', sharp_method: 'jpeg' },
    'png': { mime: 'image/png', sharp_method: 'png' },
    'webp': { mime: 'image/webp', sharp_method: 'webp' }
};

// Default JPEG quality for IIIF image responses
const IIIF_IMAGE_QUALITY = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a standardized response object
 * @param {boolean} success - Whether the operation succeeded
 * @param {string} message - Response message
 * @param {*} data - Response data
 * @returns {Object} Standardized response object
 */
const build_response = (success, message, data = null) => {
    return {
        success,
        message,
        ...data
    };
};

/**
 * Decodes HTML entities in a string
 * Handles common entities that may be injected by XSS sanitization middleware
 * @param {string} str - String to decode
 * @returns {string} Decoded string
 */
const decode_html_entities = (str) => {
    if (!str || typeof str !== 'string') {
        return str;
    }
    return str
        .replace(/&#x2F;/gi, '/')
        .replace(/&#x27;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&');
};

/**
 * Validates if a string is a valid UUID format
 * @param {string} uuid - String to validate
 * @returns {boolean} Whether string is valid UUID
 */
const is_valid_uuid = (uuid) => {
    if (!uuid || typeof uuid !== 'string') {
        return false;
    }
    const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuid_regex.test(uuid);
};

/**
 * Parses a delimited string into a trimmed, filtered array
 * Handles both pipe-delimited (raw DB format) and comma-delimited
 * (display format from model's format_subjects_for_display)
 * @param {string|null} value - Delimited string (e.g., "Denver|Boulder" or "Denver, Boulder")
 * @returns {string[]} Array of non-empty trimmed strings
 */
const parse_delimited = (value) => {
    if (!value || typeof value !== 'string') {
        return [];
    }
    // Use pipe delimiter if present (raw DB format), otherwise comma (display format)
    const delimiter = value.includes('|') ? '|' : ',';
    return value.split(delimiter).map(s => s.trim()).filter(Boolean);
};

// ---------------------------------------------------------------------------
// IIIF Presentation API 3.0 — Manifest Generation (Uploaded Items)
// ---------------------------------------------------------------------------

/**
 * Builds IIIF metadata pairs from a media library record
 * Maps database columns and EXIF data to IIIF label/value pairs
 * @param {Object} record - Media library DB record
 * @returns {Array} Array of IIIF metadata objects
 */
const build_metadata_pairs = (record) => {

    const pairs = [];

    /**
     * Adds a label/value pair if value is non-empty
     * @param {string} label - Display label
     * @param {string|null} value - Value string
     */
    const add_pair = (label, value) => {
        if (value && typeof value === 'string' && value.trim() !== '') {
            pairs.push({
                label: { en: [label] },
                value: { en: [value.trim()] }
            });
        }
    };

    // Core descriptive metadata
    add_pair('Title', record.name);
    add_pair('Description', record.description);

    // Database column metadata
    add_pair('Format', record.item_type);
    add_pair('Media Type', record.media_type);
    add_pair('Call Number', record.call_number);

    // Subject metadata (pipe-delimited in DB, comma-delimited after model formatting)
    const topics = parse_delimited(record.topics_subjects);

    if (topics.length > 0) {
        pairs.push({
            label: { en: ['Subject (Topical)'] },
            value: { en: topics }
        });
    }

    const places = parse_delimited(record.places_subjects);

    if (places.length > 0) {
        pairs.push({
            label: { en: ['Subject (Geographic)'] },
            value: { en: places }
        });
    }

    const genres = parse_delimited(record.genre_form_subjects);

    if (genres.length > 0) {
        pairs.push({
            label: { en: ['Genre/Form'] },
            value: { en: genres }
        });
    }

    // EXIF metadata (stored as JSON string in exif_data column)
    if (record.exif_data) {

        try {

            const exif = typeof record.exif_data === 'string'
                ? JSON.parse(record.exif_data)
                : record.exif_data;

            // Camera info
            const camera_parts = [exif.Make, exif.Model].filter(Boolean);

            if (camera_parts.length > 0) {
                add_pair('Camera', camera_parts.join(' '));
            }

            add_pair('Lens', exif.LensModel);
            add_pair('Date Created', exif.DateTimeOriginal || exif.CreateDate);

            // Dimensions from EXIF (supplementary — primary source is media_width/media_height)
            if (exif.ImageWidth && exif.ImageHeight) {
                add_pair('Dimensions', `${exif.ImageWidth} × ${exif.ImageHeight}`);
            }

            // Capture settings
            if (exif.FNumber) {
                add_pair('Aperture', `f/${exif.FNumber}`);
            }

            if (exif.ExposureTime) {
                add_pair('Exposure', String(exif.ExposureTime));
            }

            if (exif.ISO) {
                add_pair('ISO', String(exif.ISO));
            }

            if (exif.FocalLength) {
                add_pair('Focal Length', String(exif.FocalLength));
            }

            // PDF-specific
            if (exif.PageCount) {
                add_pair('Page Count', String(exif.PageCount));
            }

            add_pair('Author', exif.Author || exif.Artist || exif.Creator);
            add_pair('Copyright', exif.Copyright);

        } catch (error) {
            LOGGER.module().warn(`WARNING: [/media-library/iiif-service (build_metadata_pairs)] Failed to parse EXIF data for record ${record.uuid}: ${error.message}`);
        }
    }

    return pairs;
};

/**
 * Builds a IIIF thumbnail object for a manifest or canvas
 * @param {Object} record - Media library DB record
 * @returns {Object|null} IIIF thumbnail object or null
 */
const build_manifest_thumbnail = (record) => {

    if (!record.uuid) {
        return null;
    }

    // Thumbnail served through IIIF Image API at a constrained size
    return {
        id: `${IIIF_BASE}/${record.uuid}/full/!400,400/0/default.jpg`,
        type: 'Image',
        format: 'image/jpeg',
        width: 400,
        height: 400
    };
};

/**
 * Builds a IIIF canvas for an uploaded image
 * The painting annotation body references the IIIF Image API endpoint
 * with an ImageService3 service descriptor
 * @param {Object} record - Media library DB record
 * @param {string} canvas_id - Canvas URI
 * @returns {Object} IIIF canvas object
 */
const build_image_canvas = (record, canvas_id) => {

    const width = record.media_width || 800;
    const height = record.media_height || 600;
    const image_id = `${IIIF_BASE}/${record.uuid}/full/max/0/default.jpg`;

    return {
        id: canvas_id,
        type: 'Canvas',
        width: width,
        height: height,
        label: { en: [record.name || 'Image'] },
        items: [{
            id: `${canvas_id}/page`,
            type: 'AnnotationPage',
            items: [{
                id: `${canvas_id}/page/annotation`,
                type: 'Annotation',
                motivation: 'painting',
                body: {
                    id: image_id,
                    type: 'Image',
                    format: record.mime_type || 'image/jpeg',
                    width: width,
                    height: height,
                    service: [{
                        id: `${IIIF_BASE}/${record.uuid}`,
                        type: 'ImageService3',
                        profile: 'level1'
                    }]
                },
                target: canvas_id
            }]
        }]
    };
};

/**
 * Builds a IIIF canvas for an uploaded PDF
 * The painting annotation uses the generated thumbnail as the visual representation
 * The full PDF is linked as a rendering (download) resource
 * @param {Object} record - Media library DB record
 * @param {string} canvas_id - Canvas URI
 * @returns {Object} IIIF canvas object
 */
const build_pdf_canvas = (record, canvas_id) => {

    // PDF canvas dimensions — use stored dimensions or US Letter defaults
    const width = record.media_width || 612;
    const height = record.media_height || 792;
    const thumbnail_id = `${IIIF_BASE}/${record.uuid}/full/max/0/default.jpg`;

    return {
        id: canvas_id,
        type: 'Canvas',
        width: width,
        height: height,
        label: { en: [record.name || 'Document'] },
        items: [{
            id: `${canvas_id}/page`,
            type: 'AnnotationPage',
            items: [{
                id: `${canvas_id}/page/annotation`,
                type: 'Annotation',
                motivation: 'painting',
                body: {
                    id: thumbnail_id,
                    type: 'Image',
                    format: 'image/jpeg',
                    width: width,
                    height: height
                },
                target: canvas_id
            }]
        }],
        rendering: [{
            id: `${APP_BASE_URL}/api/v1/media/library/file/${record.uuid}`,
            type: 'Text',
            label: { en: ['Download PDF'] },
            format: 'application/pdf'
        }]
    };
};

/**
 * Builds a IIIF Presentation 3.0 manifest from a media library record
 * Handles uploaded images and PDFs (ingest_method = 'upload')
 * @param {Object} record - Full media library DB record
 * @returns {Object} IIIF manifest JSON-LD
 */
const build_manifest = (record) => {

    const manifest_id = `${IIIF_BASE}/${record.uuid}/manifest`;
    const canvas_id = `${manifest_id}/canvas/1`;

    // Core manifest structure
    const manifest = {
        '@context': IIIF_PRESENTATION_CONTEXT,
        id: manifest_id,
        type: 'Manifest',
        label: { en: [record.name || 'Untitled'] },
        metadata: build_metadata_pairs(record),
        requiredStatement: {
            label: { en: ['Attribution'] },
            value: { en: [DEFAULT_ATTRIBUTION] }
        },
        items: []
    };

    // Optional summary (description)
    if (record.description && record.description.trim() !== '') {
        manifest.summary = { en: [record.description.trim()] };
    }

    // Build canvas based on media type
    if (record.media_type === 'image') {
        manifest.items = [build_image_canvas(record, canvas_id)];
    } else if (record.media_type === 'pdf') {
        manifest.items = [build_pdf_canvas(record, canvas_id)];
    }

    // Manifest-level thumbnail
    const thumbnail = build_manifest_thumbnail(record);

    if (thumbnail) {
        manifest.thumbnail = [thumbnail];
    }

    return manifest;
};

// ---------------------------------------------------------------------------
// IIIF Presentation API — Manifest CRUD
// ---------------------------------------------------------------------------

/**
 * Generates a IIIF manifest for a media record and stores it in the database
 * Fetches the full record, builds the manifest, and updates the iiif_manifest column
 * @param {string} uuid - Media record UUID
 * @returns {Promise<Object>} Result object with manifest data
 */
exports.generate_manifest = async function (uuid) {

    try {

        if (!is_valid_uuid(uuid)) {
            return build_response(false, 'Invalid UUID format', { manifest: null });
        }

        LOGGER.module().info(`INFO: [/media-library/iiif-service (generate_manifest)] Generating manifest for: ${uuid}`);

        // Fetch the full media record
        const result = await MEDIA_MODEL.get_media_record(uuid);

        if (!result || !result.success || !result.record) {
            LOGGER.module().warn(`WARNING: [/media-library/iiif-service (generate_manifest)] Record not found: ${uuid}`);
            return build_response(false, 'Media record not found', { manifest: null });
        }

        const record = result.record;

        // Only generate manifests for uploaded items (images and PDFs)
        if (record.ingest_method !== 'upload') {
            LOGGER.module().info(`INFO: [/media-library/iiif-service (generate_manifest)] Skipping non-upload record: ${uuid} (${record.ingest_method})`);
            return build_response(false, `Manifest generation not supported for ingest method: ${record.ingest_method}`, {
                manifest: null
            });
        }

        if (record.media_type !== 'image' && record.media_type !== 'pdf') {
            LOGGER.module().info(`INFO: [/media-library/iiif-service (generate_manifest)] Skipping unsupported media type: ${uuid} (${record.media_type})`);
            return build_response(false, `Manifest generation not supported for media type: ${record.media_type}`, {
                manifest: null
            });
        }

        // Build the manifest
        const manifest = build_manifest(record);
        const manifest_json = JSON.stringify(manifest);

        // Store manifest in database
        const update_result = await MEDIA_MODEL.update_media_record(uuid, {
            iiif_manifest: manifest_json
        });

        if (!update_result || !update_result.success) {
            LOGGER.module().error(`ERROR: [/media-library/iiif-service (generate_manifest)] Failed to store manifest for: ${uuid}`);
            return build_response(false, 'Failed to store manifest', { manifest: null });
        }

        LOGGER.module().info(`INFO: [/media-library/iiif-service (generate_manifest)] Manifest generated and stored for: ${uuid}`);

        return build_response(true, 'Manifest generated successfully', { manifest });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/iiif-service (generate_manifest)] ${error.message}`, {
            uuid,
            stack: error.stack
        });
        return build_response(false, 'Error generating manifest: ' + error.message, { manifest: null });
    }
};

/**
 * Retrieves a stored IIIF manifest for a media record
 * Returns the parsed manifest from the iiif_manifest column
 * If no manifest is stored, generates one on-the-fly and caches it
 * @param {string} uuid - Media record UUID
 * @returns {Promise<Object>} Result object with manifest data
 */
exports.get_manifest = async function (uuid) {

    try {

        if (!is_valid_uuid(uuid)) {
            return build_response(false, 'Invalid UUID format', { manifest: null });
        }

        LOGGER.module().info(`INFO: [/media-library/iiif-service (get_manifest)] Fetching manifest for: ${uuid}`);

        // Fetch the full media record
        const result = await MEDIA_MODEL.get_media_record(uuid);

        if (!result || !result.success || !result.record) {
            return build_response(false, 'Media record not found', { manifest: null });
        }

        const record = result.record;

        // If manifest is already stored, return it
        if (record.iiif_manifest) {

            try {

                const manifest = typeof record.iiif_manifest === 'string'
                    ? JSON.parse(record.iiif_manifest)
                    : record.iiif_manifest;

                return build_response(true, 'Manifest retrieved from storage', { manifest });

            } catch (parse_error) {
                LOGGER.module().warn(`WARNING: [/media-library/iiif-service (get_manifest)] Stored manifest is invalid JSON for: ${uuid}, regenerating`);
            }
        }

        // No stored manifest — generate on-the-fly and cache
        LOGGER.module().info(`INFO: [/media-library/iiif-service (get_manifest)] No stored manifest for: ${uuid}, generating`);
        return await exports.generate_manifest(uuid);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/iiif-service (get_manifest)] ${error.message}`, {
            uuid,
            stack: error.stack
        });
        return build_response(false, 'Error retrieving manifest: ' + error.message, { manifest: null });
    }
};

/**
 * Batch generates IIIF manifests for all uploaded media records
 * that do not already have a stored manifest
 * @returns {Promise<Object>} Result object with generation statistics
 */
exports.batch_generate_manifests = async function () {

    try {

        LOGGER.module().info('INFO: [/media-library/iiif-service (batch_generate_manifests)] Starting batch manifest generation');

        // Get all media records
        const result = await MEDIA_MODEL.get_media_records();

        if (!result || !result.success || !result.records) {
            return build_response(false, 'Failed to retrieve media records', {
                stats: { total: 0, generated: 0, skipped: 0, failed: 0 }
            });
        }

        const stats = { total: 0, generated: 0, skipped: 0, failed: 0 };
        const records = result.records;

        for (const record of records) {

            stats.total++;

            // Only process uploaded images and PDFs
            if (record.ingest_method !== 'upload') {
                stats.skipped++;
                continue;
            }

            if (record.media_type !== 'image' && record.media_type !== 'pdf') {
                stats.skipped++;
                continue;
            }

            // Skip records that already have a manifest (unless force regenerate)
            if (record.iiif_manifest) {
                stats.skipped++;
                continue;
            }

            const gen_result = await exports.generate_manifest(record.uuid);

            if (gen_result.success) {
                stats.generated++;
            } else {
                stats.failed++;
                LOGGER.module().warn(`WARNING: [/media-library/iiif-service (batch_generate_manifests)] Failed for ${record.uuid}: ${gen_result.message}`);
            }
        }

        LOGGER.module().info(`INFO: [/media-library/iiif-service (batch_generate_manifests)] Complete — Generated: ${stats.generated}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`);

        return build_response(true, 'Batch manifest generation complete', { stats });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/iiif-service (batch_generate_manifests)] ${error.message}`, {
            stack: error.stack
        });
        return build_response(false, 'Error during batch manifest generation: ' + error.message, {
            stats: { total: 0, generated: 0, skipped: 0, failed: 0 }
        });
    }
};

// ---------------------------------------------------------------------------
// IIIF Image API 3.0 — info.json
// ---------------------------------------------------------------------------

/**
 * Builds the IIIF Image API 3.0 info.json response for a media record
 * Provides image dimensions, supported formats, and service profile
 * @param {string} uuid - Media record UUID
 * @returns {Promise<Object>} Result object with info.json data
 */
exports.get_info = async function (uuid) {

    try {

        if (!is_valid_uuid(uuid)) {
            return build_response(false, 'Invalid UUID format', { info: null });
        }

        LOGGER.module().info(`INFO: [/media-library/iiif-service (get_info)] Fetching info.json for: ${uuid}`);

        // Fetch the media record
        const result = await MEDIA_MODEL.get_media_record(uuid);

        if (!result || !result.success || !result.record) {
            return build_response(false, 'Media record not found', { info: null });
        }

        const record = result.record;
        const width = record.media_width || 800;
        const height = record.media_height || 600;

        const info = {
            '@context': IIIF_IMAGE_CONTEXT,
            id: `${IIIF_BASE}/${uuid}`,
            type: 'ImageService3',
            protocol: 'http://iiif.io/api/image',
            profile: 'level1',
            width: width,
            height: height,
            maxWidth: width,
            maxHeight: height,
            preferredFormats: ['jpg'],
            extraFormats: ['png', 'webp']
        };

        return build_response(true, 'Image info retrieved successfully', { info });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/iiif-service (get_info)] ${error.message}`, {
            uuid,
            stack: error.stack
        });
        return build_response(false, 'Error retrieving image info: ' + error.message, { info: null });
    }
};

// ---------------------------------------------------------------------------
// IIIF Image API 3.0 — Image Request Processing
// ---------------------------------------------------------------------------

/**
 * Resolves the source image buffer for a media record
 * For uploaded images: reads from local hash-bucketed storage
 * For uploaded PDFs: reads the generated thumbnail
 * @param {Object} record - Media library DB record
 * @returns {Promise<Buffer|null>} Image buffer or null
 */
const resolve_image_source = async (record) => {

    try {

        // For images: use the full-size stored file
        if (record.media_type === 'image' && record.storage_path) {

            const resolved_path = await UPLOADS.resolve_storage_path(
                decode_html_entities(record.storage_path)
            );

            return FS.readFileSync(resolved_path);
        }

        // For PDFs: use the generated thumbnail (first page preview)
        if (record.media_type === 'pdf' && record.thumbnail_path) {

            const resolved_path = await UPLOADS.resolve_storage_path(
                decode_html_entities(record.thumbnail_path)
            );

            return FS.readFileSync(resolved_path);
        }

        // Fallback: try thumbnail_path for any type that has one
        if (record.thumbnail_path) {

            const resolved_path = await UPLOADS.resolve_storage_path(
                decode_html_entities(record.thumbnail_path)
            );

            return FS.readFileSync(resolved_path);
        }

        return null;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/iiif-service (resolve_image_source)] Failed to resolve image source for ${record.uuid}: ${error.message}`);
        return null;
    }
};

/**
 * Parses the IIIF region parameter
 *
 * Supported values (Level 1):
 *   - "full"        → no cropping
 *   - "square"      → center-crop to square
 *   - "x,y,w,h"    → pixel-based region extraction
 *
 * @param {string} region - IIIF region parameter
 * @param {number} source_width - Source image width
 * @param {number} source_height - Source image height
 * @returns {Object|null} Sharp extract options { left, top, width, height } or null for full
 */
const parse_region = (region, source_width, source_height) => {

    if (region === 'full') {
        return null;
    }

    if (region === 'square') {
        const size = Math.min(source_width, source_height);
        const left = Math.floor((source_width - size) / 2);
        const top = Math.floor((source_height - size) / 2);
        return { left, top, width: size, height: size };
    }

    // Pixel-based: x,y,w,h
    const parts = region.split(',');

    if (parts.length === 4) {

        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const w = parseInt(parts[2], 10);
        const h = parseInt(parts[3], 10);

        if ([x, y, w, h].every(v => Number.isFinite(v) && v >= 0) && w > 0 && h > 0) {

            // Clamp to source dimensions
            const clamped_x = Math.min(x, source_width - 1);
            const clamped_y = Math.min(y, source_height - 1);
            const clamped_w = Math.min(w, source_width - clamped_x);
            const clamped_h = Math.min(h, source_height - clamped_y);

            return { left: clamped_x, top: clamped_y, width: clamped_w, height: clamped_h };
        }
    }

    return null;
};

/**
 * Parses the IIIF size parameter
 *
 * Supported values (Level 1):
 *   - "max"       → original size (no resize)
 *   - "w,"        → scale to width, height proportional
 *   - ",h"        → scale to height, width proportional
 *   - "w,h"       → exact dimensions (may distort)
 *   - "!w,h"      → best fit within w×h (maintains aspect ratio)
 *
 * @param {string} size - IIIF size parameter
 * @returns {Object|null} Sharp resize options or null for max/original
 */
const parse_size = (size) => {

    if (size === 'max' || size === 'full') {
        return null;
    }

    // Best fit: !w,h
    if (size.startsWith('!')) {

        const parts = size.substring(1).split(',');

        if (parts.length === 2) {
            const w = parseInt(parts[0], 10);
            const h = parseInt(parts[1], 10);

            if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
                return { width: w, height: h, fit: 'inside', withoutEnlargement: true };
            }
        }

        return null;
    }

    const parts = size.split(',');

    if (parts.length === 2) {

        const w = parts[0] !== '' ? parseInt(parts[0], 10) : null;
        const h = parts[1] !== '' ? parseInt(parts[1], 10) : null;

        // "w,"  — scale to width
        if (w && !h && Number.isFinite(w) && w > 0) {
            return { width: w, withoutEnlargement: true };
        }

        // ",h"  — scale to height
        if (!w && h && Number.isFinite(h) && h > 0) {
            return { height: h, withoutEnlargement: true };
        }

        // "w,h" — exact dimensions
        if (w && h && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            return { width: w, height: h, fit: 'fill', withoutEnlargement: true };
        }
    }

    return null;
};

/**
 * Parses the IIIF quality.format parameter
 *
 * Quality:
 *   - "default" or "color" → no transformation
 *   - "gray"               → grayscale conversion
 *
 * Format:
 *   - "jpg", "png", "webp"
 *
 * @param {string} quality_format - Combined quality.format string (e.g., "default.jpg")
 * @returns {Object|null} Parsed { quality, format, mime } or null if invalid
 */
const parse_quality_format = (quality_format) => {

    if (!quality_format || typeof quality_format !== 'string') {
        return null;
    }

    const dot_index = quality_format.lastIndexOf('.');

    if (dot_index === -1) {
        return null;
    }

    const quality = quality_format.substring(0, dot_index);
    const format = quality_format.substring(dot_index + 1).toLowerCase();

    // Validate quality
    const valid_qualities = ['default', 'color', 'gray'];

    if (!valid_qualities.includes(quality)) {
        return null;
    }

    // Validate format
    const format_config = SUPPORTED_FORMATS[format];

    if (!format_config) {
        return null;
    }

    return {
        quality: quality,
        format: format,
        mime: format_config.mime,
        sharp_method: format_config.sharp_method
    };
};

/**
 * Processes a IIIF Image API request
 * Applies region extraction, size scaling, and quality/format conversion using Sharp
 *
 * For uploaded images: reads from local hash-bucketed storage
 * For uploaded PDFs: uses the generated thumbnail
 *
 * @param {string} uuid - Media record UUID
 * @param {string} region - IIIF region parameter (full, square, x,y,w,h)
 * @param {string} size - IIIF size parameter (max, w,h, !w,h, w,, ,h)
 * @param {string} rotation - IIIF rotation parameter (0 for Level 1)
 * @param {string} quality_format - IIIF quality.format parameter (default.jpg, gray.png, etc.)
 * @returns {Promise<Object>} Result object with image buffer and content type
 */
exports.get_image = async function (uuid, region, size, rotation, quality_format) {

    try {

        if (!is_valid_uuid(uuid)) {
            return build_response(false, 'Invalid UUID format', { image: null });
        }

        // Parse quality.format first — reject early if invalid
        const qf = parse_quality_format(quality_format);

        if (!qf) {
            return build_response(false, `Unsupported quality/format: ${quality_format}. Supported formats: jpg, png, webp`, {
                image: null
            });
        }

        // Only rotation=0 is supported (Level 1)
        if (rotation !== '0') {
            return build_response(false, 'Only rotation value of 0 is supported', { image: null });
        }

        LOGGER.module().info(`INFO: [/media-library/iiif-service (get_image)] Processing IIIF image request: ${uuid}/${region}/${size}/${rotation}/${quality_format}`);

        // Fetch the media record
        const result = await MEDIA_MODEL.get_media_record(uuid);

        if (!result || !result.success || !result.record) {
            return build_response(false, 'Media record not found', { image: null });
        }

        const record = result.record;

        // Resolve the source image buffer
        const source_buffer = await resolve_image_source(record);

        if (!source_buffer) {
            return build_response(false, 'Image source not available', { image: null });
        }

        // Get source dimensions from Sharp (authoritative, regardless of DB values)
        const source_metadata = await SHARP(source_buffer).metadata();
        const source_width = source_metadata.width;
        const source_height = source_metadata.height;

        // Build the Sharp pipeline
        let pipeline = SHARP(source_buffer);

        // 1. Region extraction
        const region_opts = parse_region(region, source_width, source_height);

        if (region_opts) {
            pipeline = pipeline.extract(region_opts);
        }

        // 2. Size scaling
        const size_opts = parse_size(size);

        if (size_opts) {
            pipeline = pipeline.resize(size_opts);
        }

        // 3. Quality (grayscale)
        if (qf.quality === 'gray') {
            pipeline = pipeline.grayscale();
        }

        // 4. Output format
        if (qf.sharp_method === 'jpeg') {
            pipeline = pipeline.jpeg({ quality: IIIF_IMAGE_QUALITY });
        } else if (qf.sharp_method === 'png') {
            pipeline = pipeline.png();
        } else if (qf.sharp_method === 'webp') {
            pipeline = pipeline.webp({ quality: IIIF_IMAGE_QUALITY });
        }

        // Execute pipeline
        const output_buffer = await pipeline.toBuffer();

        LOGGER.module().info(`INFO: [/media-library/iiif-service (get_image)] Image processed successfully for: ${uuid} (${output_buffer.length} bytes)`);

        return build_response(true, 'Image processed successfully', {
            image: output_buffer,
            content_type: qf.mime
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/iiif-service (get_image)] ${error.message}`, {
            uuid,
            region,
            size,
            rotation,
            quality_format,
            stack: error.stack
        });
        return build_response(false, 'Error processing image: ' + error.message, { image: null });
    }
};

// ---------------------------------------------------------------------------
// Dimension Extraction Utility
// ---------------------------------------------------------------------------

/**
 * Extracts image dimensions from a buffer using Sharp
 * Used during upload processing to populate media_width/media_height
 * @param {Buffer} buffer - Image or thumbnail buffer
 * @returns {Promise<Object>} Dimensions { width, height } or { width: null, height: null }
 */
exports.extract_dimensions = async function (buffer) {

    try {

        if (!Buffer.isBuffer(buffer)) {
            return { width: null, height: null };
        }

        const metadata = await SHARP(buffer).metadata();

        return {
            width: metadata.width || null,
            height: metadata.height || null
        };

    } catch (error) {
        LOGGER.module().warn(`WARNING: [/media-library/iiif-service (extract_dimensions)] Dimension extraction failed: ${error.message}`);
        return { width: null, height: null };
    }
};
