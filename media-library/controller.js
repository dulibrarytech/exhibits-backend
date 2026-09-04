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
const MEDIA_MODEL = require('../media-library/model');
const REPO_SERVICE = require('../media-library/repo-service');
const KALTURA_SERVICE = require('../media-library/kaltura-service');
const IIIF_SERVICE = require('../media-library/iiif-service');
const KALTURA_CONFIG = require('../config/kaltura_config')();
const UPLOADS = require('../media-library/uploads');
const GATE = require('../auth/permission_gate');
const { decode_html_entities } = require('./helper');
const LOGGER = require('../libs/log4');
const { is_valid_uuid } = require('../libs/uuid');
const { send_error, send_ok } = require('../libs/http');

// Allowed MIME types for media files
const ALLOWED_MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff'
};

/**
 * Builds a safe Content-Disposition header value for file serving
 * Handles filenames with spaces, Unicode, and special characters (e.g., macOS screenshots)
 * Uses RFC 5987 filename*= parameter for Unicode support with ASCII fallback
 * @param {string} filename - Original filename (may contain spaces, Unicode, etc.)
 * @param {string} [disposition='inline'] - Disposition type ('inline' or 'attachment')
 * @returns {string} Safe Content-Disposition header value
 */
const build_content_disposition = (filename, disposition = 'inline') => {

    if (!filename || typeof filename !== 'string') {
        return `${disposition}; filename="download"`;
    }

    // Decode any HTML entities first
    const decoded = decode_html_entities(filename);

    // Create ASCII-safe fallback: replace non-ASCII and problematic characters
    const ascii_safe = decoded
        .replace(/[^\x20-\x7E]/g, '_')  // Replace non-printable/non-ASCII with underscore
        .replace(/["\\]/g, '_');          // Replace quotes and backslashes

    // RFC 5987 encoded version for full Unicode support
    const encoded = encodeURIComponent(decoded);

    // Provide both: ASCII fallback for older clients, filename* for modern ones
    return `${disposition}; filename="${ascii_safe}"; filename*=UTF-8''${encoded}`;
};

/*
 * Shared handler steps: the media-id guard, record lookup, storage-path
 * resolution, stat/stream/pipe sequence and IIIF CORS header set.
 * The guard/lookup/resolve helpers send the failure response themselves and
 * return `null` / `false`, so the caller's next line is a bare `return`.
 */

/** CORS headers every public IIIF response carries (manifest, info.json, image, PDF) */
const IIIF_CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, Content-Type, Accept'
};

/**
 * Rejects a media id that is not a UUID with 400
 * @param {Object} res - Express response object
 * @param {string} media_id - Candidate media UUID
 * @param {string} method - Handler name, for the log line
 * @param {string} [message='Invalid media ID'] - Staff-facing message
 * @returns {boolean} True when the id is valid; false when the response has been sent
 */
const require_valid_media_id = (res, media_id, method, message = 'Invalid media ID') => {

    if (!is_valid_uuid(media_id)) {
        LOGGER.module().warn(`WARNING: [/media-library/controller (${method})] Invalid media ID: ${media_id}`);
        send_error(res, 400, message);
        return false;
    }

    return true;
};

/**
 * Loads a media record, answering 404 when there is none
 * @param {Object} res - Express response object
 * @param {string} media_id - Media UUID
 * @param {string} method - Handler name, for the log line
 * @returns {Promise<Object|null>} The record, or null when the response has been sent
 */
const load_media_record = async (res, media_id, method) => {

    const result = await MEDIA_MODEL.get_media_record(media_id);

    if (!result || !result.success || !result.record) {
        LOGGER.module().warn(`WARNING: [/media-library/controller (${method})] Media record not found: ${media_id}`);
        send_error(res, 404, 'Media not found');
        return null;
    }

    return result.record;
};

/**
 * Resolves a storage-relative path to an absolute one (with the traversal
 * protection resolve_storage_path enforces), answering 404 when it is gone
 * @param {Object} res - Express response object
 * @param {string} relative_path - Stored path, possibly HTML-encoded
 * @param {Object} options
 * @param {string} options.method - Handler name, for the log line
 * @param {string} options.log_label - What is missing, e.g. 'File not found on disk'
 * @param {string} options.message - Staff-facing 404 message
 * @returns {Promise<string|null>} Absolute path, or null when the response has been sent
 */
const resolve_stored_path = async (res, relative_path, {method, log_label, message}) => {

    try {
        return await UPLOADS.resolve_storage_path(decode_html_entities(relative_path));
    } catch (error) {
        LOGGER.module().warn(`WARNING: [/media-library/controller (${method})] ${log_label}: ${relative_path}`);
        send_error(res, 404, message);
        return null;
    }
};

/**
 * Streams a stored file to the response: stat, headers, pipe. `Content-Length`
 * comes from the stat, so callers pass every other header. A read error after
 * the headers are on the wire can only be logged — the response is already
 * committed — which is why the 500 is guarded by `headersSent`.
 * @param {Object} res - Express response object
 * @param {string} abs_path - Absolute path to the file
 * @param {Object} headers - Response headers (Content-Length is added here)
 * @param {Object} log_ctx
 * @param {string} log_ctx.method - Handler name, for the log lines
 * @param {string} log_ctx.read_error_message - Staff-facing message for a read failure
 * @param {boolean} [log_ctx.require_regular_file=false] - Reject anything that is not a file with 400
 * @returns {void}
 */
const stream_stored_file = (res, abs_path, headers, {method, read_error_message, require_regular_file = false}) => {

    const stats = FS.statSync(abs_path);

    if (require_regular_file && !stats.isFile()) {
        send_error(res, 400, 'Invalid file type');
        return;
    }

    res.set({
        ...headers,
        'Content-Length': stats.size
    });

    const read_stream = FS.createReadStream(abs_path);

    read_stream.on('error', (error) => {
        LOGGER.module().error(`ERROR: [/media-library/controller (${method})] Stream error: ${error.message}`);
        if (!res.headersSent) {
            send_error(res, 500, read_error_message);
        }
    });

    read_stream.pipe(res);
};

/**
 * Gets a media file from storage by UUID
 * Looks up the storage_path in the database and resolves through the
 * hash-bucketed directory structure
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_media = async function (req, res) {

    try {

        const media_id = req.params.media_id;

        if (!require_valid_media_id(res, media_id, 'get_media')) {
            return;
        }

        // Look up the media record to get storage_path
        const record = await load_media_record(res, media_id, 'get_media');

        if (record === null) {
            return;
        }

        // Ensure record has a storage path
        if (!record.storage_path) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_media)] No storage path for media: ${media_id}`);
            send_error(res, 404, 'File not found');
            return;
        }

        const resolved_path = await resolve_stored_path(res, record.storage_path, {
            method: 'get_media',
            log_label: 'File not found on disk',
            message: 'File not found'
        });

        if (resolved_path === null) {
            return;
        }

        // Determine MIME type — decode in case XSS middleware encoded the stored value
        // Prefer extension-based lookup for known types as it's always clean
        const extension_mime = ALLOWED_MIME_TYPES[PATH.extname(resolved_path).toLowerCase()];
        const stored_mime = record.mime_type ? decode_html_entities(record.mime_type) : null;
        const mime_type = extension_mime || stored_mime || 'application/octet-stream';

        stream_stored_file(res, resolved_path, {
            'Content-Type': mime_type,
            'Content-Disposition': build_content_disposition(record.original_filename || record.filename || 'download'),
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff'
        }, {
            method: 'get_media',
            read_error_message: 'Error reading file',
            require_regular_file: true
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_media)] ${error.message}`);
        send_error(res, 500, 'Unable to retrieve media file');
    }
};

/**
 * Gets a thumbnail image for a media record by UUID
 * Resolves the thumbnail_path from the database and serves the file
 * Supports query param token for <img> src URLs
 *
 * GET /api/v1/media/library/thumbnail/:media_id
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_thumbnail = async function (req, res) {

    try {

        const media_id = req.params.media_id;

        if (!require_valid_media_id(res, media_id, 'get_thumbnail')) {
            return;
        }

        // Look up the media record to get thumbnail_path
        const record = await load_media_record(res, media_id, 'get_thumbnail');

        if (record === null) {
            return;
        }

        // Check for thumbnail path — if absent, try repo thumbnail fallback
        if (!record.thumbnail_path) {

            // Repo imports have no local thumbnail file; proxy from the repository thumbnail service
            if (record.repo_uuid) {

                const repo_result = await REPO_SERVICE.get_repo_tn(record.repo_uuid);

                if (repo_result && repo_result.success && repo_result.thumbnail) {

                    res.set({
                        'Content-Type': repo_result.mime_type || 'image/jpeg',
                        'Content-Length': repo_result.thumbnail.length,
                        'Cache-Control': 'public, max-age=86400',
                        'X-Content-Type-Options': 'nosniff'
                    });

                    return res.status(200).send(repo_result.thumbnail);
                }

                LOGGER.module().warn(`WARNING: [/media-library/controller (get_thumbnail)] Repo thumbnail unavailable for media: ${media_id} (repo_uuid: ${record.repo_uuid})`);
            } else {
                LOGGER.module().warn(`WARNING: [/media-library/controller (get_thumbnail)] No thumbnail for media: ${media_id}`);
            }

            send_error(res, 404, 'Thumbnail not found');
            return;
        }

        const resolved_path = await resolve_stored_path(res, record.thumbnail_path, {
            method: 'get_thumbnail',
            log_label: 'Thumbnail file not found on disk',
            message: 'Thumbnail not found'
        });

        if (resolved_path === null) {
            return;
        }

        // Thumbnails are always JPEG
        stream_stored_file(res, resolved_path, {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff'
        }, {
            method: 'get_thumbnail',
            read_error_message: 'Error reading thumbnail'
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_thumbnail)] ${error.message}`);
        send_error(res, 500, 'Unable to retrieve thumbnail');
    }
};

/**
 * Checks if a media record already exists with the given identifier
 * Used to prevent duplicate imports from repository and Kaltura
 *
 * GET /api/v1/media/library/duplicate-check?field=repo_uuid&value=xxx
 * GET /api/v1/media/library/duplicate-check?field=kaltura_entry_id&value=xxx
 *
 * Query Parameters:
 * - field: Field to check ('repo_uuid' or 'kaltura_entry_id')
 * - value: Value to search for
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.check_duplicate = async function (req, res) {

    try {

        const field = req.query.field;
        const value = req.query.value;

        // Validate field parameter
        const allowed_fields = ['repo_uuid', 'kaltura_entry_id'];

        if (!field || !allowed_fields.includes(field)) {
            return send_error(res, 400, 'Invalid or missing field parameter. Allowed: repo_uuid, kaltura_entry_id');
        }

        // Validate value parameter
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
            return send_error(res, 400, 'Value parameter is required');
        }

        LOGGER.module().info(`INFO: [/media-library/controller (check_duplicate)] Checking ${field} = ${value}`);

        const result = await MEDIA_MODEL.check_duplicate(field, value.trim());

        if (!result || !result.success) {
            return send_error(res, 200, result?.message || 'Duplicate check failed');
        }

        return send_ok(res, {exists: result.exists, record: result.record}, result.message);

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (check_duplicate)] ' + error.message);
        return send_error(res, 500, 'Internal server error checking for duplicates');
    }
};

/**
 * Creates a new media record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.create_media_record = async function (req, res) {

    try {

        const data = req.body;

        // Validate required inputs with comprehensive checks
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
            send_error(res, 400, 'Bad request. Missing or invalid media data.');
            return;
        }

        // Pass username from verified token for created_by lookup
        // (req.decoded is set by TOKEN.verify middleware with decoded JWT payload)
        if (req.decoded && req.decoded.sub) {
            data.username = req.decoded.sub;
        }

        // Decode fields that may have been HTML-encoded by XSS sanitization middleware
        if (data.storage_path) {
            data.storage_path = decode_html_entities(data.storage_path);
        }
        if (data.thumbnail_path) {
            data.thumbnail_path = decode_html_entities(data.thumbnail_path);
        }
        if (data.mime_type) {
            data.mime_type = decode_html_entities(data.mime_type);
        }
        if (data.original_filename) {
            data.original_filename = decode_html_entities(data.original_filename);
        }

        const is_authorized = await GATE.authorize_request(req, res, ['can_create_media'], { record_type: 'media' });

        if (!is_authorized) {
            return;
        }

        // For Kaltura imports, enrich the payload with the original uploaded filename
        // before persisting. Pulled from the Kaltura custom metadata profile's
        // OriginalFileName field; falls back to a synthesized "{entry_id}.{fileExt}".
        // Awaited (unlike the post-insert category assignment below) so the value
        // lands in the row on first save. Failures are non-fatal — the record still
        // saves with the column default (empty string).
        if (data.ingest_method === 'kaltura' && data.kaltura_entry_id && !data.original_filename) {
            try {
                const filename_result = await KALTURA_SERVICE.get_kaltura_original_filename(data.kaltura_entry_id);
                if (filename_result && filename_result.success && filename_result.original_filename) {
                    data.original_filename = filename_result.original_filename;
                } else if (filename_result && !filename_result.success) {
                    LOGGER.module().warn(`WARNING: [/media-library/controller (create_media_record)] Kaltura original filename lookup returned failure for entry ${data.kaltura_entry_id}: ${filename_result.message}`);
                }
            } catch (err) {
                LOGGER.module().warn(`WARNING: [/media-library/controller (create_media_record)] Kaltura original filename lookup failed for entry ${data.kaltura_entry_id}: ${err.message}`);
            }
        }

        const result = await MEDIA_MODEL.create_media_record(data);

        if (!result || !result.success) {
            LOGGER.module().error('ERROR: [/media-library/controller (create_media_record)] Model returned unsuccessful result');
            send_error(res, 400, result?.message || 'Failed to create media record.');
            return;
        }

        // Success response - return 201 Created
        send_ok(res, result.id, result.message || 'Media record created successfully.', 201);

        // Assign Kaltura entry to exhibits category after successful import (fire-and-forget)
        if (data.ingest_method === 'kaltura' && data.kaltura_entry_id) {
            KALTURA_SERVICE.assign_kaltura_category(data.kaltura_entry_id).then(category_result => {
                if (!category_result || !category_result.success) {
                    LOGGER.module().warn(`WARNING: [/media-library/controller (create_media_record)] Kaltura category assignment returned failure for entry ${data.kaltura_entry_id}: ${category_result?.message}`);
                } else {
                    LOGGER.module().info(`INFO: [/media-library/controller (create_media_record)] Kaltura entry ${data.kaltura_entry_id} assigned to exhibits category`);
                }
            }).catch(err => {
                LOGGER.module().warn(`WARNING: [/media-library/controller (create_media_record)] Kaltura category assignment failed for entry ${data.kaltura_entry_id}: ${err.message}`);
            });
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (create_media_record)] Unable to create media record ' + error.message);
        send_error(res, 500, 'Unable to create media record.');
    }
};

/**
 * Gets all media records
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_media_records = async function (req, res) {

    try {

        const { page, limit, q, media_type } = req.query;

        // If pagination params are present, use the browse method with filtering
        if (page || limit || q || media_type) {

            const options = {
                page: page || 1,
                limit: limit || 20,
                q: q || null,
                media_type: media_type || null
            };

            const result = await MEDIA_MODEL.get_media_records_browse(options);

            if (!result || !result.success) {
                send_error(res, 404, 'No media records found.', {total: 0});
                return;
            }

            send_ok(res, result.records, result.message, 200, {
                total: result.total,
                page: result.page,
                limit: result.limit
            });
            return;
        }

        // Default: return all records (existing behavior for DataTable)
        const result = await MEDIA_MODEL.get_media_records();

        if (!result || !result.success) {
            send_error(res, 404, 'No media records found.');
            return;
        }

        send_ok(res, result.records, result.message);

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (get_media_records)] Unable to get media records: ' + error.message);
        send_error(res, 500, 'Unable to get media records.');
    }
};

/**
 * Gets a single media record by UUID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_media_record = async function (req, res) {

    try {

        const media_id = req.params.media_id;

        // Validate required path parameter
        if (!require_valid_media_id(res, media_id, 'get_media_record', 'Bad request. Missing or invalid media ID.')) {
            return;
        }

        const result = await MEDIA_MODEL.get_media_record(media_id);

        if (!result || !result.success) {
            send_error(res, 404, result?.message || 'Media record not found.');
            return;
        }

        send_ok(res, result.record, result.message);

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (get_media_record)] Unable to get media record ' + req.params.media_id + ': ' + error.message);
        send_error(res, 500, 'Unable to get media record.');
    }
};

/**
 * Updates a media record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.update_media_record = async function (req, res) {

    try {

        const media_id = req.params.media_id;
        const data = req.body;

        // Validate required path parameter
        if (!require_valid_media_id(res, media_id, 'update_media_record', 'Bad request. Missing or invalid media ID.')) {
            return;
        }

        // Validate request body
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
            send_error(res, 400, 'Bad request. Missing or invalid update data.');
            return;
        }

        // Pass username from verified token for updated_by name lookup
        // (req.decoded is set by TOKEN.verify middleware)
        if (req.decoded && req.decoded.sub) {
            data.username = req.decoded.sub;
        }

        const is_authorized = await GATE.authorize_request(req, res, ['can_update_any_media', 'can_update_media'], {
            record_type: 'media',
            parent_id: media_id
        });

        if (!is_authorized) {
            return;
        }

        const result = await MEDIA_MODEL.update_media_record(media_id, data);

        if (!result || !result.success) {
            send_error(res, 400, result?.message || 'Failed to update media record.');
            return;
        }

        send_ok(res, result.record, result.message);

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (update_media_record)] Unable to update media record ' + req.params.media_id + ': ' + error.message);
        send_error(res, 500, 'Unable to update media record.');
    }
};

/**
 * Replaces the stored file behind an uploaded media record while preserving
 * its descriptive metadata. Authorization (update-media, ownership-scoped)
 * is enforced by route middleware before the multipart body is parsed.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.replace_media_file = async function (req, res) {

    try {

        const media_id = req.params.media_id;

        // Validate required path parameter
        if (!require_valid_media_id(res, media_id, 'replace_media_file', 'Bad request. Missing or invalid media ID.')) {
            return;
        }

        // Validate uploaded file (multer single-file middleware sets req.file)
        if (!req.file || !req.file.buffer) {
            send_error(res, 400, 'Bad request. No replacement file provided.');
            return;
        }

        // Pass username from verified token for updated_by name lookup
        // (req.decoded is set by TOKEN.verify middleware)
        const username = req.decoded?.sub || null;

        const result = await MEDIA_MODEL.replace_media_file(media_id, req.file, username);

        if (!result || !result.success) {

            const message = result?.message || 'Failed to replace media file.';
            const status = message === 'Media record not found' ? 404 : 400;

            send_error(res, status, message);
            return;
        }

        send_ok(res, result.record, result.message);

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (replace_media_file)] Unable to replace media file ' + req.params.media_id + ': ' + error.message);
        send_error(res, 500, 'Unable to replace media file.');
    }
};

/**
 * Deletes a media record (soft delete)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.delete_media_record = async function (req, res) {

    try {

        const media_id = req.params.media_id;

        // Validate required path parameter
        if (!require_valid_media_id(res, media_id, 'delete_media_record', 'Bad request. Missing or invalid media ID.')) {
            return;
        }

        // Get username from verified token for deleted_by name lookup
        // (req.decoded is set by TOKEN.verify middleware)
        const username = req.decoded?.sub || null;

        const is_authorized = await GATE.authorize_request(req, res, ['can_delete_any_media', 'can_delete_media'], {
            record_type: 'media',
            parent_id: media_id
        });

        if (!is_authorized) {
            return;
        }

        const result = await MEDIA_MODEL.delete_media_record(media_id, username);

        if (!result || !result.success) {
            send_error(res, 400, result?.message || 'Failed to delete media record.');
            return;
        }

        send_ok(res, null, result.message);

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (delete_media_record)] Unable to delete media record ' + req.params.media_id + ': ' + error.message);
        send_error(res, 500, 'Unable to delete media record.');
    }
};

/**
 * Deletes an unprocessed (staged, not-yet-saved) uploaded file and its
 * thumbnail from staging storage. This is part of the upload/create flow
 * (the upload modal's per-card Remove), NOT a library-record deletion —
 * so it is gated by the create-media capability, and the model refuses
 * any path already linked to a saved record.
 *
 * DELETE /api/v1/media/library/upload
 * Body: { storage_path: string (required), thumbnail_path: string (optional) }
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.delete_uploaded_file = async function (req, res) {

    try {

        const { storage_path, thumbnail_path } = req.body || {};

        if (!storage_path || typeof storage_path !== 'string' || storage_path.trim() === '') {
            send_error(res, 400, 'Bad request. Missing or invalid storage_path.');
            return;
        }

        const is_authorized = await GATE.authorize_request(req, res, ['can_create_media'], { record_type: 'media' });

        if (!is_authorized) {
            return;
        }

        const result = await MEDIA_MODEL.delete_uploaded_file(
            storage_path,
            (typeof thumbnail_path === 'string' && thumbnail_path.trim() !== '') ? thumbnail_path : null
        );

        if (!result || !result.success) {
            send_error(res, 400, result?.message || 'Failed to remove uploaded file.');
            return;
        }

        send_ok(res, null, result.message);

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (delete_uploaded_file)] Unable to remove uploaded file: ' + error.message);
        send_error(res, 500, 'Unable to remove uploaded file.');
    }
};

/**
 * Serves a staged (not-yet-saved) uploaded thumbnail by its storage-relative
 * path. The upload modal preview needs this because the record-keyed
 * thumbnail endpoint resolves via a saved DB record, which does not exist
 * until the curator clicks Save (and is then keyed by a different,
 * freshly-generated uuid). The thumbnail itself is generated at upload time.
 *
 * GET /api/v1/media/library/upload/thumbnail?path=<relative>&token=<jwt>
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_uploaded_thumbnail = async function (req, res) {

    try {

        const rel = req.query.path;

        if (!rel || typeof rel !== 'string' || rel.trim() === '') {
            send_error(res, 400, 'Bad request. Missing or invalid path.');
            return;
        }

        const p = rel.trim();

        // Fast-fail obviously hostile input before touching the filesystem.
        // resolve_storage_path also hard-guards containment.
        if (p.includes('..') || p.includes('\0') || PATH.isAbsolute(p)) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_uploaded_thumbnail)] Rejected path: ${p}`);
            send_error(res, 400, 'Invalid path');
            return;
        }

        const resolved_path = await resolve_stored_path(res, p, {
            method: 'get_uploaded_thumbnail',
            log_label: 'Staged thumbnail not found',
            message: 'Thumbnail not found'
        });

        if (resolved_path === null) {
            return;
        }

        // Staged thumbnails are always JPEG (generated by uploads.js).
        stream_stored_file(res, resolved_path, {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'private, max-age=300',
            'X-Content-Type-Options': 'nosniff'
        }, {
            method: 'get_uploaded_thumbnail',
            read_error_message: 'Error reading thumbnail'
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_uploaded_thumbnail)] ${error.message}`);
        send_error(res, 500, 'Unable to retrieve thumbnail');
    }
};

/**
 * Adds or removes an exhibit UUID from a media record's exhibits JSON array
 * Used to track which exhibits reference a given media library asset
 *
 * PUT /api/v1/media/library/record/:media_id/exhibits
 *
 * Body:
 * - exhibit_uuid: {string} Exhibit UUID to add or remove
 * - action: {string} 'add' or 'remove'
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.update_media_exhibits = async function (req, res) {

    try {

        const media_id = req.params.media_id;
        const { exhibit_uuid, action, media_role } = req.body;

        // Validate media_id
        if (!is_valid_uuid(media_id)) {
            return send_error(res, 400, 'Invalid media ID format');
        }

        // Validate exhibit_uuid
        if (!is_valid_uuid(exhibit_uuid)) {
            return send_error(res, 400, 'Invalid or missing exhibit_uuid');
        }

        // Validate action
        const allowed_actions = ['add', 'remove'];

        if (!action || !allowed_actions.includes(action)) {
            return send_error(res, 400, 'Invalid or missing action. Allowed: add, remove');
        }

        // Sanitize media_role (optional, for logging context)
        const safe_role = (typeof media_role === 'string' && media_role.trim()) ? media_role.trim() : null;

        let result;

        if (action === 'add') {
            result = await MEDIA_MODEL.add_exhibit_to_media_record(media_id, exhibit_uuid, safe_role);
        } else {
            result = await MEDIA_MODEL.remove_exhibit_from_media_record(media_id, exhibit_uuid, safe_role);
        }

        if (!result || !result.success) {
            return send_error(res, 400, result?.message || `Failed to ${action} exhibit association`);
        }

        return send_ok(res, {exhibits: result.exhibits}, result.message);

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (update_media_exhibits)] ' + error.message);
        return send_error(res, 500, 'Unable to update media exhibits');
    }
};

/*
 * Every repository-search failure answers with the same empty payload the
 * success path shapes, so the picker's `data.records` / `data.total` reads
 * are safe on all six branches. Built fresh per call so no caller can mutate
 * a shared object.
 */
const empty_search_payload = () => ({data: {records: [], total: 0}});

/**
 * Searches the digital repository for records matching the search term
 * GET /api/v1/media/library/repo/search?q=search_term
 *
 * Query Parameters:
 * - q: Search term (required) - also accepts 'term' or 'search'
 * - size: Number of results to return (optional, default: 25, max: 100)
 * - from: Starting offset for pagination (optional, default: 0)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.search_repository = async function (req, res) {

    try {

        // Extract search term from query parameter
        const term = req.query.q;

        // Validate search term is provided
        if (!term) {
            LOGGER.module().warn('WARNING: [/media-library/controller (search_repository)] Missing search term');
            return send_error(res, 400, 'Search term is required. Use ?q=your_search_term', empty_search_payload());
        }

        // Extract pagination options
        const options = {
            size: parseInt(req.query.size, 10) || 25,
            from: parseInt(req.query.from, 10) || 0
        };

        // Validate size parameter
        if (options.size < 1 || options.size > 100) {
            return send_error(res, 400, 'Size must be between 1 and 100', empty_search_payload());
        }

        // Validate from parameter
        if (options.from < 0) {
            return send_error(res, 400, 'From offset cannot be negative', empty_search_payload());
        }

        LOGGER.module().info(`INFO: [/media-library/controller (search_repository)] Searching for: ${term}`);

        // Call repo service to perform search
        const result = await REPO_SERVICE.search_repository(term, options);

        if (!result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (search_repository)] Search failed: ${result.message}`);
            return send_error(res, 200, result.message, empty_search_payload());
        }

        // Return successful response with 200 status
        return send_ok(res, {records: result.records, total: result.total}, result.message);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (search_repository)] ${error.message}`);

        return send_error(res, 500, 'Internal server error during search', empty_search_payload());
    }
};

/**
 * Gets a repository thumbnail by UUID
 * GET /api/v1/media/library/repo/thumbnail?uuid=xxx
 *
 * Query Parameters:
 * - uuid: Repository item UUID (required)
 *
 * Returns the binary image data with appropriate Content-Type header
 * for direct use in <img> src attributes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_repo_tn = async function (req, res) {

    try {

        // Extract UUID from query parameter
        const uuid = req.query.uuid;

        // Validate UUID is provided
        if (!uuid) {
            LOGGER.module().warn('WARNING: [/media-library/controller (get_repo_tn)] Missing UUID');
            return send_error(res, 400, 'UUID is required. Use ?uuid=your_uuid');
        }

        // Validate UUID format
        if (!is_valid_uuid(uuid)) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_repo_tn)] Invalid UUID format: ${uuid}`);
            return send_error(res, 400, 'Invalid UUID format');
        }

        LOGGER.module().info(`INFO: [/media-library/controller (get_repo_tn)] Fetching thumbnail for UUID: ${uuid}`);

        // Call repo service to get thumbnail
        const result = await REPO_SERVICE.get_repo_tn(uuid);

        if (!result || !result.success || !result.thumbnail) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_repo_tn)] Thumbnail not found for UUID: ${uuid}`);
            return send_error(res, 404, result?.message || 'Thumbnail not found');
        }

        // Set response headers for binary image data
        res.set({
            'Content-Type': result.mime_type || 'image/jpeg',
            'Content-Length': result.thumbnail.length,
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'X-Content-Type-Options': 'nosniff'
        });

        // Send the binary image data
        return res.status(200).send(result.thumbnail);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_repo_tn)] ${error.message}`);

        return send_error(res, 500, 'Internal server error retrieving thumbnail');
    }
};

/**
 * Answers one of the corpus-wide repository aggregate reads (subjects,
 * resource types). Both use the same envelope — a 200 carrying
 * `success: false` when the service fails (the repo picker degrades rather
 * than erroring), and a 500 with the same empty payload on an exception —
 * differing only in the noun and the payload key.
 *
 * @param {Object} res - Express response object
 * @param {Object} options
 * @param {string} options.method - Handler name, for the log lines
 * @param {string} options.label - Noun for the log and message strings
 * @param {string} options.payload_key - Envelope key carrying the payload
 * @param {*} options.empty_payload - Payload value used on every failure path
 * @param {Function} options.run - Zero-arg call returning the service envelope
 * @param {Function} options.project - (result) => `{message, data}` for the success body
 * @returns {Promise<Object>} The Express response
 */
const handle_repo_aggregate = async (res, {method, label, payload_key, empty_payload, run, project}) => {

    const empty_data = {
        data: {
            [payload_key]: empty_payload,
            total: 0
        }
    };

    try {

        LOGGER.module().info(`INFO: [/media-library/controller (${method})] Fetching ${label}`);

        const result = await run();

        if (!result || !result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (${method})] Failed: ${result?.message}`);

            return send_error(res, 200, result?.message || `Failed to retrieve ${label}`, empty_data);
        }

        const projected = project(result);

        return send_ok(res, projected.data, projected.message);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (${method})] ${error.message}`);

        return send_error(res, 500, `Internal server error retrieving ${label}`, empty_data);
    }
};

/**
 * Gets all unique subjects from the digital repository, grouped by type
 * Optionally filters to a single type via query parameter
 * GET /api/v1/media/library/repo/subjects
 * GET /api/v1/media/library/repo/subjects?type=geographic
 *
 * Query Parameters:
 * - type: Subject type to filter by (optional, e.g., 'geographic', 'topical', 'genre_form')
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_subjects = async function (req, res) {
    return handle_repo_aggregate(res, {
        method: 'get_subjects',
        label: 'subjects',
        payload_key: 'subjects',
        empty_payload: {},
        run: () => REPO_SERVICE.get_subjects(),
        /* read inside project() so a malformed ?type= is still caught by the
           shared try/catch */
        project: (result) => {

            // If a type filter is provided, return only that type
            const type_filter = req.query.type ? req.query.type.trim().toLowerCase() : null;

            if (type_filter) {

                const filtered_subjects = result.subjects[type_filter] || [];

                return {
                    message: `Found ${filtered_subjects.length} unique ${type_filter} subject(s)`,
                    data: {
                        subjects: { [type_filter]: filtered_subjects },
                        total: filtered_subjects.length
                    }
                };
            }

            return {
                message: result.message,
                data: {
                    subjects: result.subjects,
                    total: result.total
                }
            };
        }
    });
};

/**
 * Gets all unique resource types from the digital repository
 * GET /api/v1/media/library/repo/resource-types
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_resource_types = async function (req, res) {
    return handle_repo_aggregate(res, {
        method: 'get_resource_types',
        label: 'resource types',
        payload_key: 'resource_types',
        empty_payload: [],
        run: () => REPO_SERVICE.get_resource_types(),
        project: (result) => ({
            message: result.message,
            data: {
                resource_types: result.resource_types,
                total: result.total
            }
        })
    });
};

/**
 * Runs one of the entry-scoped Kaltura service calls and answers with the
 * shared envelope: 400 when the entry id is missing, the status the service
 * tagged on the failure (defaulting to 500 — a service failure must not be
 * reported as 200 OK), or the success payload.
 *
 * The three handlers below differ only in the log wording, the payload key
 * and the success status.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options
 * @param {string} options.method - Handler name, for the log lines
 * @param {Function} options.describe - (entry_id) => the INFO log sentence
 * @param {Function} options.run - (entry_id) => Promise of the service envelope
 * @param {string} options.data_key - Envelope key holding the success payload
 * @param {number} options.success_status - HTTP status for the success response
 * @param {string} options.failure_message - Fallback message when the service sent none
 * @param {string} options.error_message - Message for an unhandled exception
 * @returns {Promise<Object>} The Express response
 */
const handle_kaltura_entry_action = async (req, res, options) => {

    const {method, describe, run, data_key, success_status, failure_message, error_message} = options;

    try {

        const entry_id = req.params.entry_id;

        if (!entry_id) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (${method})] Missing entry ID`);
            return send_error(res, 400, 'Entry ID is required');
        }

        LOGGER.module().info(`INFO: [/media-library/controller (${method})] ${describe(entry_id)}`);

        const result = await run(entry_id);

        if (!result || !result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (${method})] Failed: ${result?.message}`);

            const status_code = result?.status || 500;

            return send_error(res, status_code, result?.message || failure_message);
        }

        return send_ok(res, result[data_key], result.message, success_status);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (${method})] ${error.message}`);

        return send_error(res, 500, error_message);
    }
};

/**
 * Gets Kaltura media metadata by entry ID
 * GET /api/v1/media/library/kaltura/:entry_id
 *
 * Path Parameters:
 * - entry_id: Kaltura entry ID (required)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_kaltura_media = async function (req, res) {
    return handle_kaltura_entry_action(req, res, {
        method: 'get_kaltura_media',
        describe: (entry_id) => `Fetching Kaltura media for entry ID: ${entry_id}`,
        run: (entry_id) => KALTURA_SERVICE.get_kaltura_media(entry_id),
        data_key: 'media',
        success_status: 200,
        failure_message: 'Failed to retrieve Kaltura media metadata',
        error_message: 'Internal server error retrieving Kaltura media'
    });
};

/**
 * Gets Kaltura player configuration (non-secret values for iframe embed)
 * GET /api/v1/media/library/kaltura/config/player
 *
 * Returns partner_id and uiconf_id needed to construct the Kaltura player iframe URL.
 * These are non-secret values safe for client-side use.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_kaltura_config = async function (req, res) {

    try {

        const partner_id = KALTURA_CONFIG.kaltura_partner_id || '';
        const uiconf_id = KALTURA_CONFIG.kaltura_conf_ui_id || '';

        if (!partner_id || !uiconf_id) {
            LOGGER.module().warn('WARNING: [/media-library/controller (get_kaltura_config)] Kaltura player config incomplete');
            return send_error(res, 200, 'Kaltura player configuration is incomplete');
        }

        return send_ok(res, {partner_id: partner_id, uiconf_id: uiconf_id}, 'Kaltura player configuration retrieved');

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_kaltura_config)] ${error.message}`);

        return send_error(res, 500, 'Internal server error retrieving Kaltura configuration');
    }
};

/** Route currently not used -
 * Assigns a Kaltura media entry to the exhibits category
 * POST /api/v1/media/library/kaltura/:entry_id/category
 *
 * Path Parameters:
 * - entry_id: Kaltura entry ID (required)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.assign_kaltura_category = async function (req, res) {
    return handle_kaltura_entry_action(req, res, {
        method: 'assign_kaltura_category',
        describe: (entry_id) => `Assigning entry ID: ${entry_id} to exhibits category`,
        run: (entry_id) => KALTURA_SERVICE.assign_kaltura_category(entry_id),
        data_key: 'category_entry',
        success_status: 201,
        failure_message: 'Failed to assign entry to exhibits category',
        error_message: 'Internal server error assigning entry to exhibits category'
    });
};

/**
 * Removes a Kaltura media entry from the exhibits category
 * DELETE /api/v1/media/library/kaltura/:entry_id/category
 *
 * Path Parameters:
 * - entry_id: Kaltura entry ID (required)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.remove_kaltura_category = async function (req, res) {
    return handle_kaltura_entry_action(req, res, {
        method: 'remove_kaltura_category',
        describe: (entry_id) => `Removing entry ID: ${entry_id} from exhibits category`,
        run: (entry_id) => KALTURA_SERVICE.remove_kaltura_category(entry_id),
        data_key: 'category_entry',
        success_status: 200,
        failure_message: 'Failed to remove entry from exhibits category',
        error_message: 'Internal server error removing entry from exhibits category'
    });
};

// ========================================
// IIIF MANIFEST AND IMAGE API
// ========================================

/**
 * Serves the original stored PDF for a media record (public-facing)
 * PDF manifests reference this route as the canvas "rendering" resource, so it
 * carries the same public/CORS posture as the manifest itself. Restricted to
 * uploaded PDFs — repository items are served by the repository's own IIIF
 * endpoint, and other media types are delivered via the IIIF Image API.
 *
 * GET <APP_PATH>/iiif/:media_id/file
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_iiif_file = async function (req, res) {

    try {

        const media_id = req.params.media_id;

        if (!require_valid_media_id(res, media_id, 'get_iiif_file')) {
            return;
        }

        const record = await load_media_record(res, media_id, 'get_iiif_file');

        if (record === null) {
            return;
        }

        const stored_mime = record.mime_type ? decode_html_entities(record.mime_type) : null;

        if (record.ingest_method !== 'upload' || stored_mime !== 'application/pdf' || !record.storage_path) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_iiif_file)] File delivery not available for: ${media_id}`);
            return send_error(res, 404, 'File delivery not available for this record');
        }

        const resolved_path = await resolve_stored_path(res, record.storage_path, {
            method: 'get_iiif_file',
            log_label: 'File not found on disk',
            message: 'File not found'
        });

        if (resolved_path === null) {
            return;
        }

        stream_stored_file(res, resolved_path, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': build_content_disposition(record.original_filename || record.filename || 'download.pdf'),
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
            ...IIIF_CORS_HEADERS
        }, {
            method: 'get_iiif_file',
            read_error_message: 'Error reading file',
            require_regular_file: true
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_iiif_file)] ${error.message}`);

        if (!res.headersSent) {
            send_error(res, 500, 'Unable to retrieve file');
        }
    }
};

/**
 * Gets the IIIF Presentation 3.0 manifest for a media record
 * Built on demand from the live DB row; URLs derived from the request host
 * so the manifest is portable across servers.
 *
 * GET <APP_PATH>/iiif/:media_id/manifest
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_iiif_manifest = async function (req, res) {

    try {

        const media_id = req.params.media_id;

        if (!require_valid_media_id(res, media_id, 'get_iiif_manifest')) {
            return;
        }

        LOGGER.module().info(`INFO: [/media-library/controller (get_iiif_manifest)] Building manifest for: ${media_id}`);

        const base_url = IIIF_SERVICE.derive_iiif_base(req);
        const file_base = IIIF_SERVICE.derive_file_base(req);
        const result = await IIIF_SERVICE.build_manifest_for_uuid(media_id, base_url, file_base);

        if (!result || !result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_iiif_manifest)] Failed: ${result?.message}`);

            // The service tags failures with an HTTP status; default to 500 so a
            // genuine error is never reported as a 200 success.
            const status_code = result?.status || 500;

            return send_error(res, status_code, result?.message || 'Failed to retrieve manifest');
        }

        /* Serve manifest with IIIF-compliant content type and CORS headers.
           This body stays OUTSIDE the {success, message, data} envelope: it is a
           IIIF Presentation 3.0 document, whose shape is fixed by the spec and
           read by third-party viewers. */
        res.set({
            'Content-Type': 'application/ld+json;profile="http://iiif.io/api/presentation/3/context.json"',
            ...IIIF_CORS_HEADERS,
            'Cache-Control': 'public, max-age=3600'
        });

        return res.status(200).json(result.manifest);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_iiif_manifest)] ${error.message}`);

        return send_error(res, 500, 'Internal server error retrieving manifest');
    }
};

/**
 * Gets the IIIF Image API 3.0 info.json for a media record
 *
 * GET <APP_PATH>/iiif/:media_id/info.json
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_iiif_info = async function (req, res) {

    try {

        const media_id = req.params.media_id;

        if (!require_valid_media_id(res, media_id, 'get_iiif_info')) {
            return;
        }

        LOGGER.module().info(`INFO: [/media-library/controller (get_iiif_info)] Fetching info.json for: ${media_id}`);

        const base_url = IIIF_SERVICE.derive_iiif_base(req);
        const result = await IIIF_SERVICE.get_info(media_id, base_url);

        if (!result || !result.success) {
            // The service tags failures with an HTTP status; default to 500 so a
            // genuine error is never reported as a 200 success.
            const status_code = result?.status || 500;

            return send_error(res, status_code, result?.message || 'Failed to retrieve image info');
        }

        /* Serve info.json with IIIF-compliant content type and CORS headers.
           Spec-fixed body, deliberately un-enveloped (see get_iiif_manifest). */
        res.set({
            'Content-Type': 'application/ld+json;profile="http://iiif.io/api/image/3/context.json"',
            ...IIIF_CORS_HEADERS,
            'Cache-Control': 'public, max-age=86400'
        });

        return res.status(200).json(result.info);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_iiif_info)] ${error.message}`);

        return send_error(res, 500, 'Internal server error retrieving image info');
    }
};

/**
 * Serves an image via IIIF Image API 3.0
 * Parses IIIF URL parameters and applies image transformations via Sharp
 *
 * GET <APP_PATH>/iiif/:media_id/:region/:size/:rotation/:quality_format
 *
 * Examples:
 *   .../iiif/{uuid}/full/max/0/default.jpg          full image as JPEG
 *   .../iiif/{uuid}/full/!400,400/0/default.jpg     best fit within 400x400
 *   .../iiif/{uuid}/square/200,200/0/default.jpg    square crop, 200x200
 *   .../iiif/{uuid}/0,0,500,500/max/0/gray.png      top-left 500x500, grayscale PNG
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_iiif_image = async function (req, res) {

    try {

        const media_id = req.params.media_id;
        const region = req.params.region;
        const size = req.params.size;
        const rotation = req.params.rotation;
        const quality_format = req.params.quality_format;

        if (!require_valid_media_id(res, media_id, 'get_iiif_image')) {
            return;
        }

        LOGGER.module().info(`INFO: [/media-library/controller (get_iiif_image)] IIIF image request: ${media_id}/${region}/${size}/${rotation}/${quality_format}`);

        // Conditional-request validator — lets an unchanged derivative answer 304
        const if_none_match = req.headers['if-none-match'];

        const result = await IIIF_SERVICE.get_image(media_id, region, size, rotation, quality_format, { if_none_match });

        if (!result || !result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_iiif_image)] Failed: ${result?.message}`);

            // The service tags failures with an HTTP status; default to 500 so a
            // genuine error is never reported as a 200 success.
            const status_code = result?.status || 500;

            return send_error(res, status_code, result?.message || 'Failed to process image');
        }

        // CORS + caching headers shared by 200 and 304 responses. The ETag is
        // derived from the record version + IIIF params, so it changes when (and
        // only when) the derivative's bytes change — making the long max-age safe.
        const cache_headers = {
            ...IIIF_CORS_HEADERS,
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff'
        };

        if (result.etag) {
            cache_headers['ETag'] = result.etag;
        }

        // Conditional request matched the current derivative — nothing to send
        if (result.not_modified) {
            res.set(cache_headers);
            return res.status(304).end();
        }

        // Stream the processed image
        res.set({
            ...cache_headers,
            'Content-Type': result.content_type,
            'Content-Length': result.image.length
        });

        return res.status(200).send(result.image);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_iiif_image)] ${error.message}`);

        return send_error(res, 500, 'Internal server error processing image');
    }
};
