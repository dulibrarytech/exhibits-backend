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
const STORAGE_CONFIG = require('../config/storage_config')();
const MEDIA_MODEL = require('../media-library/model');
const AUTHORIZE = require('../auth/authorize');
const LOGGER = require('../libs/log4');

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
 * Gets a media file from storage by filename
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_media = async function (req, res) {

    try {

        const filename = req.params.filename;
        console.log(filename);
        // Note: Token verification is handled by TOKEN.verify middleware in routes.js
        // The token can be passed via header (x-access-token) or query parameter (token)
        // This allows img src URLs to include ?token=xxx for authentication

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

        // TODO: get user and add to created by field - via token?
        // Extract user info from token if available
        if (req.user && req.user.uid) {
            data.created_by = req.user.uid;
        }

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
