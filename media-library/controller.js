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
// const STORAGE_CONFIG = require('../config/storage_config')();
const MEDIA_MODEL = require('../media-library/model');
// const ITEM_MODEL = require('../exhibits/items_model');
const REPO_SERVICE = require('../media-library/repo-service');
const KALTURA_SERVICE = require('../media-library/kaltura-service');
const KALTURA_CONFIG = require('../config/kaltura_config')();
const AUTHORIZE = require('../auth/authorize');
const LOGGER = require('../libs/log4');
const VALIDATOR = require("validator");


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

// Storage path for media files
const STORAGE_PATH = PATH.join(__dirname, 'storage');

/**
 * Validates filename to prevent directory traversal attacks
 * @param {string} filename - Filename to validate
 * @returns {boolean} True if filename is valid
 */
const is_valid_filename = (filename) => {
    if (!filename || typeof filename !== 'string') {
        return false;
    }

    // Check for directory traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return false;
    }

    // Check for null bytes
    if (filename.includes('\0')) {
        return false;
    }

    // Validate filename format (alphanumeric, hyphens, underscores, periods)
    const valid_pattern = /^[a-zA-Z0-9._-]+$/;
    if (!valid_pattern.test(filename)) {
        return false;
    }

    // Check for valid extension
    const ext = PATH.extname(filename).toLowerCase();
    if (!ALLOWED_MIME_TYPES[ext]) {
        return false;
    }

    return true;
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
 * Gets a media file from storage by filename
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_media = async function (req, res) {

    try {

        const filename = req.params.filename;

        // Validate filename
        if (!is_valid_filename(filename)) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_media)] Invalid filename requested: ${filename}`);
            res.status(400).json({
                success: false,
                message: 'Invalid filename',
                data: null
            });
            return;
        }

        // Construct file path
        const file_path = PATH.join(STORAGE_PATH, filename);

        // Resolve to prevent any remaining traversal attempts
        const resolved_path = PATH.resolve(file_path);
        const resolved_storage = PATH.resolve(STORAGE_PATH);

        // Ensure resolved path is within storage directory
        if (!resolved_path.startsWith(resolved_storage)) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_media)] Path traversal attempt: ${filename}`);
            res.status(403).json({
                success: false,
                message: 'Access denied',
                data: null
            });
            return;
        }

        // Check if file exists
        if (!FS.existsSync(resolved_path)) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_media)] File not found: ${filename}`);
            res.status(404).json({
                success: false,
                message: 'File not found',
                data: null
            });
            return;
        }

        // Get file stats
        const stats = FS.statSync(resolved_path);

        // Ensure it's a file, not a directory
        if (!stats.isFile()) {
            res.status(400).json({
                success: false,
                message: 'Invalid file type',
                data: null
            });
            return;
        }

        // Get MIME type from extension
        const ext = PATH.extname(filename).toLowerCase();
        const mime_type = ALLOWED_MIME_TYPES[ext] || 'application/octet-stream';

        // Set response headers
        res.set({
            'Content-Type': mime_type,
            'Content-Length': stats.size,
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'X-Content-Type-Options': 'nosniff'
        });

        // Stream file to response
        const read_stream = FS.createReadStream(resolved_path);

        read_stream.on('error', (error) => {
            LOGGER.module().error(`ERROR: [/media-library/controller (get_media)] Stream error: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Error reading file',
                    data: null
                });
            }
        });

        read_stream.pipe(res);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_media)] ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Unable to retrieve media file',
            data: null
        });
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
            res.status(400).json({
                success: false,
                message: 'Bad request. Missing or invalid media data.',
                data: null
            });
            return;
        }

        // Extract token if available
        const token = req.headers?.['x-access-token'];
        if (!token || !VALIDATOR.isJWT(token)) {
            return false;
        }

        data.token = token;

        // TODO: figure out permissions
        /*
        const auth_options = {
            req,
            permissions: ['add_item', 'add_item_to_any_exhibit'],
            record_type: 'item',
            parent_id: null,
            child_id: null
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (is_authorized !== true) {
            res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
            return;
        }
        */

        const result = await MEDIA_MODEL.create_media_record(data);

        if (!result || !result.success) {
            LOGGER.module().error('ERROR: [/media-library/controller (create_media_record)] Model returned unsuccessful result');
            res.status(400).json({
                success: false,
                message: result?.message || 'Failed to create media record.',
                data: null
            });
            return;
        }

        // Success response - return 201 Created
        res.status(201).json({
            success: true,
            message: result.message || 'Media record created successfully.',
            data: result.id
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (create_media_record)] Unable to create media record ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Unable to create media record.',
            data: null
        });
    }
};

/**
 * Gets all media records
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_media_records = async function (req, res) {

    try {

        const result = await MEDIA_MODEL.get_media_records();

        if (!result || !result.success) {
            res.status(404).json({
                success: false,
                message: 'No media records found.',
                data: null
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: result.message,
            data: result.records
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (get_media_records)] Unable to get media records: ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Unable to get media records.',
            data: null
        });
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
        if (!media_id || typeof media_id !== 'string' || media_id.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'Bad request. Missing or invalid media ID.',
                data: null
            });
            return;
        }

        const result = await MEDIA_MODEL.get_media_record(media_id);

        if (!result || !result.success) {
            res.status(404).json({
                success: false,
                message: result?.message || 'Media record not found.',
                data: null
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: result.message,
            data: result.record
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (get_media_record)] Unable to get media record ' + req.params.media_id + ': ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Unable to get media record.',
            data: null
        });
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
        if (!media_id || typeof media_id !== 'string' || media_id.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'Bad request. Missing or invalid media ID.',
                data: null
            });
            return;
        }

        // Validate request body
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
            res.status(400).json({
                success: false,
                message: 'Bad request. Missing or invalid update data.',
                data: null
            });
            return;
        }

        // Add updated_by if user info available
        if (req.user && req.user.uid) {
            data.updated_by = req.user.uid;
        }

        const result = await MEDIA_MODEL.update_media_record(media_id, data);

        if (!result || !result.success) {
            res.status(400).json({
                success: false,
                message: result?.message || 'Failed to update media record.',
                data: null
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: result.message,
            data: result.record
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (update_media_record)] Unable to update media record ' + req.params.media_id + ': ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Unable to update media record.',
            data: null
        });
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
        if (!media_id || typeof media_id !== 'string' || media_id.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'Bad request. Missing or invalid media ID.',
                data: null
            });
            return;
        }

        // Get user ID for audit trail
        const deleted_by = req.user?.uid || null;

        const result = await MEDIA_MODEL.delete_media_record(media_id, deleted_by);

        if (!result || !result.success) {
            res.status(400).json({
                success: false,
                message: result?.message || 'Failed to delete media record.',
                data: null
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: result.message,
            data: null
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/controller (delete_media_record)] Unable to delete media record ' + req.params.media_id + ': ' + error.message);
        res.status(500).json({
            success: false,
            message: 'Unable to delete media record.',
            data: null
        });
    }
};

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
        const term = req.query.q; // TODO || req.query.term || req.query.search;

        // Validate search term is provided
        if (!term) {
            LOGGER.module().warn('WARNING: [/media-library/controller (search_repository)] Missing search term');
            return res.status(400).json({
                success: false,
                message: 'Search term is required. Use ?q=your_search_term',
                data: {
                    records: [],
                    total: 0
                }
            });
        }

        // Extract pagination options
        const options = {
            size: parseInt(req.query.size, 10) || 25,
            from: parseInt(req.query.from, 10) || 0
        };

        // Validate size parameter
        if (options.size < 1 || options.size > 100) {
            return res.status(400).json({
                success: false,
                message: 'Size must be between 1 and 100',
                data: {
                    records: [],
                    total: 0
                }
            });
        }

        // Validate from parameter
        if (options.from < 0) {
            return res.status(400).json({
                success: false,
                message: 'From offset cannot be negative',
                data: {
                    records: [],
                    total: 0
                }
            });
        }

        LOGGER.module().info(`INFO: [/media-library/controller (search_repository)] Searching for: ${term}`);

        // Call repo service to perform search
        const result = await REPO_SERVICE.search(term, options);

        if (!result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (search_repository)] Search failed: ${result.message}`);
            return res.status(200).json({
                success: false,
                message: result.message,
                data: {
                    records: [],
                    total: 0
                }
            });
        }

        // Return successful response with 200 status
        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                records: result.records,
                total: result.total
            }
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (search_repository)] ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Internal server error during search',
            data: {
                records: [],
                total: 0
            }
        });
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
            return res.status(400).json({
                success: false,
                message: 'UUID is required. Use ?uuid=your_uuid',
                data: null
            });
        }

        // Validate UUID format
        if (!is_valid_uuid(uuid)) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_repo_tn)] Invalid UUID format: ${uuid}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid UUID format',
                data: null
            });
        }

        LOGGER.module().info(`INFO: [/media-library/controller (get_repo_tn)] Fetching thumbnail for UUID: ${uuid}`);

        // Call repo service to get thumbnail
        const result = await REPO_SERVICE.get_repo_tn(uuid);

        if (!result || !result.success || !result.thumbnail) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_repo_tn)] Thumbnail not found for UUID: ${uuid}`);
            return res.status(404).json({
                success: false,
                message: result?.message || 'Thumbnail not found',
                data: null
            });
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

        return res.status(500).json({
            success: false,
            message: 'Internal server error retrieving thumbnail',
            data: null
        });
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

    try {

        LOGGER.module().info('INFO: [/media-library/controller (get_subjects)] Fetching subjects');

        const result = await REPO_SERVICE.get_subjects();

        if (!result || !result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_subjects)] Failed: ${result?.message}`);
            return res.status(200).json({
                success: false,
                message: result?.message || 'Failed to retrieve subjects',
                data: {
                    subjects: {},
                    total: 0
                }
            });
        }

        // If a type filter is provided, return only that type
        const type_filter = req.query.type ? req.query.type.trim().toLowerCase() : null;

        if (type_filter) {

            const filtered_subjects = result.subjects[type_filter] || [];

            return res.status(200).json({
                success: true,
                message: `Found ${filtered_subjects.length} unique ${type_filter} subject(s)`,
                data: {
                    subjects: { [type_filter]: filtered_subjects },
                    total: filtered_subjects.length
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                subjects: result.subjects,
                total: result.total
            }
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_subjects)] ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Internal server error retrieving subjects',
            data: {
                subjects: {},
                total: 0
            }
        });
    }
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

    try {

        LOGGER.module().info('INFO: [/media-library/controller (get_resource_types)] Fetching resource types');

        const result = await REPO_SERVICE.get_resource_types();

        if (!result || !result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_resource_types)] Failed: ${result?.message}`);
            return res.status(200).json({
                success: false,
                message: result?.message || 'Failed to retrieve resource types',
                data: {
                    resource_types: [],
                    total: 0
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                resource_types: result.resource_types,
                total: result.total
            }
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_resource_types)] ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Internal server error retrieving resource types',
            data: {
                resource_types: [],
                total: 0
            }
        });
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

    try {

        // Extract entry_id from path parameter
        const entry_id = req.params.entry_id;

        // Validate entry_id is provided
        if (!entry_id) {
            LOGGER.module().warn('WARNING: [/media-library/controller (get_kaltura_media)] Missing entry ID');
            return res.status(400).json({
                success: false,
                message: 'Entry ID is required',
                data: null
            });
        }

        LOGGER.module().info(`INFO: [/media-library/controller (get_kaltura_media)] Fetching Kaltura media for entry ID: ${entry_id}`);

        // Call Kaltura service to get media metadata
        const result = await KALTURA_SERVICE.get_kaltura_media(entry_id);

        if (!result || !result.success) {
            LOGGER.module().warn(`WARNING: [/media-library/controller (get_kaltura_media)] Failed: ${result?.message}`);

            // Determine appropriate status code based on failure reason
            const status_code = result?.message?.includes('Unsupported media type') ? 422
                : result?.message?.includes('not found') ? 404
                : 200;

            return res.status(status_code).json({
                success: false,
                message: result?.message || 'Failed to retrieve Kaltura media metadata',
                data: null
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result.media
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_kaltura_media)] ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Internal server error retrieving Kaltura media',
            data: null
        });
    }
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
            return res.status(200).json({
                success: false,
                message: 'Kaltura player configuration is incomplete',
                data: null
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Kaltura player configuration retrieved',
            data: {
                partner_id: partner_id,
                uiconf_id: uiconf_id
            }
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/controller (get_kaltura_config)] ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Internal server error retrieving Kaltura configuration',
            data: null
        });
    }
};