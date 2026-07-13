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
// const PATH = require('path');
const SHARP = require('sharp');
const MEDIA_MODEL = require('../media-library/model');
const UPLOADS = require('../media-library/uploads');
const IIIF_CACHE = require('../media-library/iiif-cache');
const APP_CONFIG = require('../config/app_config')();
const KALTURA_CONFIG = require('../config/kaltura_config')();
const LOGGER = require('../libs/log4');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

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

// OWASP A04 (H3) — cap the requested IIIF output dimensions. A request such as
// `/iiif/{uuid}/full/!50000,50000/0/default.jpg` would otherwise ask Sharp for a
// huge allocation and let an attacker cache-bust the derivative store with an
// unbounded set of distinct sizes. Requests whose explicit width/height exceed
// the cap are rejected with HTTP 400 (a size larger than the server supports is
// an error per the IIIF Image API) before any source read or transcode. The
// `max`/`full` forms are unaffected — they serve the source-bounded original.
// Configurable via IIIF_MAX_DIMENSION (default 2000px per dimension).
const IIIF_MAX_DIMENSION = (() => {
    const v = parseInt(process.env.IIIF_MAX_DIMENSION, 10);
    return Number.isFinite(v) && v > 0 ? v : 2000;
})();

// Defense-in-depth: bound the SOURCE decode as well, since peak memory is driven
// by the full-resolution source, not the output. Defaults to Sharp's own
// built-in limit (~268 megapixels) so existing library assets are unaffected;
// lower via IIIF_MAX_SOURCE_PIXELS to tighten. Applied to every SHARP() instance
// in the image pipeline so an oversized source is rejected rather than decoded.
const IIIF_MAX_SOURCE_PIXELS = (() => {
    const v = parseInt(process.env.IIIF_MAX_SOURCE_PIXELS, 10);
    return Number.isFinite(v) && v > 0 ? v : 268402689;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the IIIF base URL from an Express request, e.g.
 * https://host/exhibits-dashboard/iiif
 * @param {Object} req - Express request
 * @returns {string} IIIF base URL
 */
exports.derive_iiif_base = (req) => {
    const proto = req.protocol;
    const host = req.get('host');
    return `${proto}://${host}${APP_CONFIG.app_path}/iiif`;
};

/**
 * Derives the file-download base URL from an Express request, e.g.
 * https://host/exhibits-dashboard
 * Used for the PDF rendering URL on PDF canvases.
 * @param {Object} req - Express request
 * @returns {string} File-download base URL
 */
exports.derive_file_base = (req) => {
    const proto = req.protocol;
    const host = req.get('host');
    return `${proto}://${host}${APP_CONFIG.app_path}`;
};

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
 * Parses a pipe-delimited subject string into a trimmed, filtered array.
 *
 * Pipe '|' is the single canonical subject delimiter at every layer (DB
 * storage, model's format_subjects_for_display, the multi-select widget, and
 * the indexer's process_subjects). It is collision-free because a single LCSH
 * subfield term can itself contain ", " (e.g. "Vietnam War, 1961-1975",
 * "Civil War, 1861-1865", or the geographic "Washington, D.C.") but never a
 * literal pipe. Splitting on anything but pipe would shred such single-term
 * values into bogus fragments in the manifest. A value with no pipe is a
 * single term and is returned as a one-element array unchanged.
 *
 * @param {string|null} value - Pipe-delimited string (e.g., "Denver|Boulder")
 * @returns {string[]} Array of non-empty trimmed strings
 */
const parse_delimited = (value) => {
    if (!value || typeof value !== 'string') {
        return [];
    }
    return value.split('|').map(s => s.trim()).filter(Boolean);
};

/**
 * Normalizes media_type values to canonical types used throughout the IIIF service
 * Handles variations from different ingest sources (e.g., Kaltura returns 'moving image'
 * for video and 'sound' for audio)
 * @param {string} media_type - Raw media_type value from the database
 * @returns {string} Normalized media type ('image', 'pdf', 'video', 'audio', or original value)
 */
const normalize_media_type = (media_type) => {

    if (!media_type || typeof media_type !== 'string') {
        return media_type;
    }

    const type = media_type.trim().toLowerCase();

    const MEDIA_TYPE_MAP = {
        'image': 'image',
        'pdf': 'pdf',
        'video': 'video',
        'audio': 'audio',
        'moving image': 'video',
        'sound': 'audio'
    };

    return MEDIA_TYPE_MAP[type] || media_type;
};

// Canonical media types supported for IIIF manifest generation
const SUPPORTED_MEDIA_TYPES = ['image', 'pdf', 'video', 'audio'];

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

    // AV metadata
    if (record.media_duration) {
        const duration_sec = parseFloat(record.media_duration);

        if (duration_sec > 0) {
            const hours = Math.floor(duration_sec / 3600);
            const minutes = Math.floor((duration_sec % 3600) / 60);
            const seconds = Math.floor(duration_sec % 60);
            const formatted = hours > 0
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                : `${minutes}:${String(seconds).padStart(2, '0')}`;
            add_pair('Duration', formatted);
        }
    }

    if (record.kaltura_entry_id) {
        add_pair('Kaltura Entry ID', record.kaltura_entry_id);
    }

    // Subject metadata (pipe-delimited in DB and after model formatting)
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
 * @param {string} base_url - IIIF base URL
 * @returns {Object|null} IIIF thumbnail object or null
 */
const build_manifest_thumbnail = (record, base_url) => {

    if (!record.uuid) {
        return null;
    }

    // Kaltura items: use the external Kaltura thumbnail URL directly
    if (record.kaltura_thumbnail_url) {
        return {
            id: record.kaltura_thumbnail_url,
            type: 'Image',
            format: 'image/jpeg'
        };
    }

    // Uploaded items: thumbnail served through IIIF Image API at a constrained size
    return {
        id: `${base_url}/${record.uuid}/full/!400,400/0/default.jpg`,
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
 * @param {string} base_url - IIIF base URL
 * @returns {Object} IIIF canvas object
 */
const build_image_canvas = (record, canvas_id, base_url) => {

    const width = record.media_width || 800;
    const height = record.media_height || 600;
    const image_id = `${base_url}/${record.uuid}/full/max/0/default.jpg`;

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
                        id: `${base_url}/${record.uuid}`,
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
 * @param {string} base_url - IIIF base URL
 * @param {string} file_base - File-download base URL
 * @returns {Object} IIIF canvas object
 */
const build_pdf_canvas = (record, canvas_id, base_url, file_base) => {

    // PDF canvas dimensions — use stored dimensions or US Letter defaults
    const width = record.media_width || 612;
    const height = record.media_height || 792;
    const thumbnail_id = `${base_url}/${record.uuid}/full/max/0/default.jpg`;

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
            id: `${file_base}/iiif/${record.uuid}/file`,
            type: 'Text',
            label: { en: ['Download PDF'] },
            format: 'application/pdf'
        }]
    };
};

/**
 * Builds a Kaltura HLS streaming URL for a given entry ID
 * Uses the Kaltura playManifest endpoint for adaptive bitrate streaming
 * @param {string} entry_id - Kaltura entry ID
 * @returns {string|null} HLS streaming URL or null if config is missing
 */
const build_kaltura_streaming_url = (entry_id) => {

    const partner_id = KALTURA_CONFIG.kaltura_partner_id;

    if (!partner_id || !entry_id) {
        return null;
    }

    return `${KALTURA_CONFIG.kaltura_cdn}/p/${partner_id}/sp/${partner_id}00/playManifest/entryId/${entry_id}/format/applehttp/protocol/https`;
};

/**
 * Builds a Kaltura iframe embed URL for a given entry ID
 * Used as a fallback rendering resource in the manifest
 * @param {string} entry_id - Kaltura entry ID
 * @returns {string|null} Embed URL or null if config is missing
 */
const build_kaltura_embed_url = (entry_id) => {

    const partner_id = KALTURA_CONFIG.kaltura_partner_id;
    const uiconf_id = KALTURA_CONFIG.kaltura_conf_ui_id;

    if (!partner_id || !uiconf_id || !entry_id) {
        return null;
    }

    return `${KALTURA_CONFIG.kaltura_cdn}/p/${partner_id}/sp/${partner_id}00/embedIframeJs/uiconf_id/${uiconf_id}/partner_id/${partner_id}?iframeembed=true&entry_id=${entry_id}`;
};

/**
 * Builds a IIIF canvas for a Kaltura video
 * The painting annotation body references the Kaltura HLS streaming endpoint
 * with duration, width, and height for the canvas
 * @param {Object} record - Media library DB record
 * @param {string} canvas_id - Canvas URI
 * @returns {Object} IIIF canvas object
 */
const build_video_canvas = (record, canvas_id) => {

    const width = record.media_width || 1920;
    const height = record.media_height || 1080;
    const duration = record.media_duration ? parseFloat(record.media_duration) : 0;
    const streaming_url = build_kaltura_streaming_url(record.kaltura_entry_id);

    const canvas = {
        id: canvas_id,
        type: 'Canvas',
        width: width,
        height: height,
        duration: duration,
        label: { en: [record.name || 'Video'] },
        items: [{
            id: `${canvas_id}/page`,
            type: 'AnnotationPage',
            items: [{
                id: `${canvas_id}/page/annotation`,
                type: 'Annotation',
                motivation: 'painting',
                body: {
                    id: streaming_url || '',
                    type: 'Video',
                    format: record.mime_type || 'video/mp4',
                    width: width,
                    height: height,
                    duration: duration
                },
                target: canvas_id
            }]
        }]
    };

    // Add Kaltura player embed as a rendering (alternative playback)
    const embed_url = build_kaltura_embed_url(record.kaltura_entry_id);

    if (embed_url) {
        canvas.rendering = [{
            id: embed_url,
            type: 'Video',
            label: { en: ['Kaltura Player'] },
            format: 'text/html'
        }];
    }

    return canvas;
};

/**
 * Builds a IIIF canvas for a Kaltura audio track
 * Audio canvases have duration but no width/height
 * The painting annotation body references the Kaltura HLS streaming endpoint
 * @param {Object} record - Media library DB record
 * @param {string} canvas_id - Canvas URI
 * @returns {Object} IIIF canvas object
 */
const build_audio_canvas = (record, canvas_id) => {

    const duration = record.media_duration ? parseFloat(record.media_duration) : 0;
    const streaming_url = build_kaltura_streaming_url(record.kaltura_entry_id);

    const canvas = {
        id: canvas_id,
        type: 'Canvas',
        duration: duration,
        label: { en: [record.name || 'Audio'] },
        items: [{
            id: `${canvas_id}/page`,
            type: 'AnnotationPage',
            items: [{
                id: `${canvas_id}/page/annotation`,
                type: 'Annotation',
                motivation: 'painting',
                body: {
                    id: streaming_url || '',
                    type: 'Sound',
                    format: record.mime_type || 'audio/mpeg',
                    duration: duration
                },
                target: canvas_id
            }]
        }]
    };

    // Add Kaltura player embed as a rendering (alternative playback)
    const embed_url = build_kaltura_embed_url(record.kaltura_entry_id);

    if (embed_url) {
        canvas.rendering = [{
            id: embed_url,
            type: 'Sound',
            label: { en: ['Kaltura Player'] },
            format: 'text/html'
        }];
    }

    return canvas;
};

/**
 * Builds a IIIF Presentation 3.0 manifest from a media library record
 * Handles uploaded images and PDFs (ingest_method = 'upload')
 * and Kaltura video/audio (ingest_method = 'kaltura')
 * @param {Object} record - Full media library DB record
 * @param {string} base_url - IIIF base URL (e.g., https://host/path/iiif)
 * @param {string} file_base - File-download base URL (e.g., https://host/path)
 * @returns {Object} IIIF manifest JSON-LD
 */
const build_manifest = (record, base_url, file_base) => {

    const manifest_id = `${base_url}/${record.uuid}/manifest`;
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

    // Build canvas based on media type (normalized to handle variants like 'moving image')
    const canvas_type = normalize_media_type(record.media_type);

    if (canvas_type === 'image') {
        manifest.items = [build_image_canvas(record, canvas_id, base_url)];
    } else if (canvas_type === 'pdf') {
        manifest.items = [build_pdf_canvas(record, canvas_id, base_url, file_base)];
    } else if (canvas_type === 'video') {
        manifest.items = [build_video_canvas(record, canvas_id)];
    } else if (canvas_type === 'audio') {
        manifest.items = [build_audio_canvas(record, canvas_id)];
    }

    // Manifest-level thumbnail
    const thumbnail = build_manifest_thumbnail(record, base_url);

    if (thumbnail) {
        manifest.thumbnail = [thumbnail];
    }

    return manifest;
};

// ---------------------------------------------------------------------------
// IIIF Presentation API — Manifest builder (on-demand)
// ---------------------------------------------------------------------------

/**
 * Builds a IIIF manifest for a media record on demand from the live DB row.
 * URLs are built from the supplied base_url/file_base so the manifest is
 * portable across hosts — no values are persisted.
 * @param {string} uuid - Media record UUID
 * @param {string} base_url - IIIF base URL (e.g., https://host/path/iiif)
 * @param {string} file_base - File-download base URL (e.g., https://host/path)
 * @returns {Promise<Object>} Result object with manifest data
 */
exports.build_manifest_for_uuid = async function (uuid, base_url, file_base) {

    try {

        if (!is_valid_uuid(uuid)) {
            return build_response(false, 'Invalid UUID format', { manifest: null, status: 400 });
        }

        const result = await MEDIA_MODEL.get_media_record(uuid);

        if (!result || !result.success || !result.record) {
            return build_response(false, 'Media record not found', { manifest: null, status: 404 });
        }

        const record = result.record;

        if (record.ingest_method !== 'upload' && record.ingest_method !== 'kaltura') {
            return build_response(false, `Manifest generation not supported for ingest method: ${record.ingest_method}`, {
                manifest: null,
                status: 404
            });
        }

        if (!SUPPORTED_MEDIA_TYPES.includes(normalize_media_type(record.media_type))) {
            return build_response(false, `Manifest generation not supported for media type: ${record.media_type}`, {
                manifest: null,
                status: 404
            });
        }

        const manifest = build_manifest(record, base_url, file_base);

        return build_response(true, 'Manifest built', { manifest });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/iiif-service (build_manifest_for_uuid)] ${error.message}`, {
            uuid,
            stack: error.stack
        });
        return build_response(false, 'Error building manifest: ' + error.message, { manifest: null, status: 500 });
    }
};

// ---------------------------------------------------------------------------
// IIIF Image API 3.0 — info.json
// ---------------------------------------------------------------------------

/**
 * Builds the IIIF Image API 3.0 info.json response for a media record
 * Provides image dimensions, supported formats, and service profile
 * @param {string} uuid - Media record UUID
 * @param {string} base_url - IIIF base URL (e.g., https://host/path/iiif)
 * @returns {Promise<Object>} Result object with info.json data
 */
exports.get_info = async function (uuid, base_url) {

    try {

        if (!is_valid_uuid(uuid)) {
            return build_response(false, 'Invalid UUID format', { info: null, status: 400 });
        }

        LOGGER.module().info(`INFO: [/media-library/iiif-service (get_info)] Fetching info.json for: ${uuid}`);

        // Fetch the media record
        const result = await MEDIA_MODEL.get_media_record(uuid);

        if (!result || !result.success || !result.record) {
            return build_response(false, 'Media record not found', { info: null, status: 404 });
        }

        const record = result.record;
        const width = record.media_width || 800;
        const height = record.media_height || 600;

        const info = {
            '@context': IIIF_IMAGE_CONTEXT,
            id: `${base_url}/${uuid}`,
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
        return build_response(false, 'Error retrieving image info: ' + error.message, { info: null, status: 500 });
    }
};

// ---------------------------------------------------------------------------
// IIIF Image API 3.0 — Image Request Processing
// ---------------------------------------------------------------------------

/**
 * Resolves the source image buffer for a media record
 * For uploaded images: reads from local hash-bucketed storage
 * For uploaded PDFs: reads the generated thumbnail
 *
 * Reads are asynchronous (FS.promises.readFile) so a large original never
 * blocks the event loop the way the previous synchronous readFileSync did.
 * Only reached on a cache miss — a cached derivative is served without ever
 * touching the original.
 *
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

            return await FS.promises.readFile(resolved_path);
        }

        // For PDFs: use the generated thumbnail (first page preview)
        if (record.media_type === 'pdf' && record.thumbnail_path) {

            const resolved_path = await UPLOADS.resolve_storage_path(
                decode_html_entities(record.thumbnail_path)
            );

            return await FS.promises.readFile(resolved_path);
        }

        // Fallback: try thumbnail_path for any type that has one
        if (record.thumbnail_path) {

            const resolved_path = await UPLOADS.resolve_storage_path(
                decode_html_entities(record.thumbnail_path)
            );

            return await FS.promises.readFile(resolved_path);
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
/**
 * Extracts the explicit output dimensions a size parameter requests, for cap
 * enforcement (OWASP A04/H3). Only the numeric IIIF size forms carry explicit
 * dimensions: "w,", ",h", "w,h", "!w,h". "max"/"full" (and any unparseable
 * value) carry none, so they return { width: null, height: null }.
 *
 * @param {string} size - IIIF size parameter
 * @returns {{width: (number|null), height: (number|null)}}
 */
const requested_size_dimensions = (size) => {

    if (typeof size !== 'string' || size === 'max' || size === 'full') {
        return { width: null, height: null };
    }

    const body = size.startsWith('!') ? size.substring(1) : size;
    const parts = body.split(',');

    if (parts.length !== 2) {
        return { width: null, height: null };
    }

    const w = parts[0] !== '' ? parseInt(parts[0], 10) : null;
    const h = parts[1] !== '' ? parseInt(parts[1], 10) : null;

    return {
        width: Number.isFinite(w) ? w : null,
        height: Number.isFinite(h) ? h : null
    };
};

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
 * Results are cached on disk keyed by (uuid, record version, region, size,
 * rotation, quality.format): an identical request is served straight from the
 * derivative cache without re-reading or re-transcoding the original. A strong
 * ETag (derived from the same key) is returned so the caller can answer
 * conditional requests with 304 Not Modified.
 *
 * For uploaded images: reads from local hash-bucketed storage
 * For uploaded PDFs: uses the generated thumbnail
 *
 * @param {string} uuid - Media record UUID
 * @param {string} region - IIIF region parameter (full, square, x,y,w,h)
 * @param {string} size - IIIF size parameter (max, w,h, !w,h, w,, ,h)
 * @param {string} rotation - IIIF rotation parameter (0 for Level 1)
 * @param {string} quality_format - IIIF quality.format parameter (default.jpg, gray.png, etc.)
 * @param {Object} [options] - Optional request context
 * @param {string} [options.if_none_match] - Client If-None-Match header for conditional requests
 * @returns {Promise<Object>} Result object with image buffer, content type, etag and version
 */
exports.get_image = async function (uuid, region, size, rotation, quality_format, options = {}) {

    try {

        if (!is_valid_uuid(uuid)) {
            return build_response(false, 'Invalid UUID format', { image: null, status: 400 });
        }

        // Parse quality.format first — reject early if invalid
        const qf = parse_quality_format(quality_format);

        if (!qf) {
            return build_response(false, `Unsupported quality/format: ${quality_format}. Supported formats: jpg, png, webp`, {
                image: null,
                status: 400
            });
        }

        // Only rotation=0 is supported (Level 1)
        if (rotation !== '0') {
            return build_response(false, 'Only rotation value of 0 is supported', { image: null, status: 400 });
        }

        // H3 (A04) — reject oversized output requests before any source read or
        // transcode, so a request like `!50000,50000` can't force a huge Sharp
        // allocation or bust the derivative cache with unbounded distinct sizes.
        const requested = requested_size_dimensions(size);

        if ((requested.width !== null && requested.width > IIIF_MAX_DIMENSION) ||
            (requested.height !== null && requested.height > IIIF_MAX_DIMENSION)) {
            return build_response(false, `Requested size exceeds the maximum of ${IIIF_MAX_DIMENSION}px per dimension`, {
                image: null,
                status: 400
            });
        }

        // Fetch the media record (cheap indexed lookup; also yields the version
        // token that keys the cache and the ETag)
        const result = await MEDIA_MODEL.get_media_record(uuid);

        if (!result || !result.success || !result.record) {
            return build_response(false, 'Media record not found', { image: null, status: 404 });
        }

        const record = result.record;
        const version = record.updated || record.created || null;
        const etag = IIIF_CACHE.compute_etag(uuid, version, region, size, rotation, quality_format);

        // Conditional request: nothing changed — let the caller answer 304
        if (options.if_none_match && options.if_none_match === etag) {
            return build_response(true, 'Not modified', {
                image: null,
                content_type: qf.mime,
                etag,
                version,
                not_modified: true
            });
        }

        // Serve from the derivative cache when present (no source read, no transcode)
        const cached = await IIIF_CACHE.get_cached(uuid, version, region, size, rotation, quality_format);

        if (cached) {
            return build_response(true, 'Image served from cache', {
                image: cached,
                content_type: qf.mime,
                etag,
                version,
                cached: true
            });
        }

        LOGGER.module().info(`INFO: [/media-library/iiif-service (get_image)] Cache miss — processing IIIF image request: ${uuid}/${region}/${size}/${rotation}/${quality_format}`);

        // Resolve the source image buffer (async — never blocks the event loop)
        const source_buffer = await resolve_image_source(record);

        if (!source_buffer) {
            return build_response(false, 'Image source not available', { image: null, status: 404 });
        }

        // Build the Sharp pipeline. limitInputPixels bounds the source decode
        // (defense-in-depth for H3 — an oversized source is rejected, not
        // buffered into memory).
        let pipeline = SHARP(source_buffer, { limitInputPixels: IIIF_MAX_SOURCE_PIXELS });

        // 1. Region extraction — source dimensions are only needed for a
        //    non-"full" region, so the extra metadata decode is skipped otherwise
        if (region !== 'full') {

            const source_metadata = await SHARP(source_buffer, { limitInputPixels: IIIF_MAX_SOURCE_PIXELS }).metadata();
            const region_opts = parse_region(region, source_metadata.width, source_metadata.height);

            if (region_opts) {
                pipeline = pipeline.extract(region_opts);
            }
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

        // Store the derivative for subsequent requests (best-effort — a cache
        // write failure must never fail the response)
        await IIIF_CACHE.put_cached(uuid, version, region, size, rotation, quality_format, output_buffer);

        LOGGER.module().info(`INFO: [/media-library/iiif-service (get_image)] Image processed successfully for: ${uuid} (${output_buffer.length} bytes)`);

        return build_response(true, 'Image processed successfully', {
            image: output_buffer,
            content_type: qf.mime,
            etag,
            version,
            cached: false
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
        return build_response(false, 'Error processing image: ' + error.message, { image: null, status: 500 });
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
