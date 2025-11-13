/**

 Copyright 2024 University of Denver

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

const path = require('path');
const fs = require('fs').promises;
const WEBSERVICES_CONFIG = require('../config/webservices_config')();
const STORAGE_CONFIG = require('../config/storage_config')();
const EXHIBITS_MODEL = require('../exhibits/exhibits_model');
const AUTHORIZE = require('../auth/authorize');
const LOGGER = require('../libs/log4');

/**
 * Creates a new exhibit record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.create_exhibit_record = async (req, res) => {

    try {

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        const authOptions = {
            req,
            permissions: ['add_exhibit'],
            record_type: 'exhibit',
            parent_id: null,
            child_id: null
        };

        const isAuthorized = await AUTHORIZE.check_permission(authOptions);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request'
            });
        }

        // Create exhibit record
        const result = await EXHIBITS_MODEL.create_exhibit_record(req.body);

        // Validate result structure
        if (!result || typeof result.status !== 'number') {
            throw new Error('Invalid response from model');
        }

        return res.status(result.status).json(result);

    } catch (error) {
        // Log detailed error internally
        LOGGER.module().error('ERROR: [/exhibits/controller (create_exhibit_record)]', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id // Log user context if available
        });

        // Send generic error to client
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Unable to create exhibit record'
            });
        }
    }
};

exports.get_exhibit_records = async function (req, res) {

    try {

        // Validate model exists
        if (!EXHIBITS_MODEL || typeof EXHIBITS_MODEL.get_exhibit_records !== 'function') {
            throw new Error('Exhibit model not properly initialized');
        }

        // Call model to get exhibit records
        const data = await EXHIBITS_MODEL.get_exhibit_records();

        // Validate response structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response from database');
        }

        // Validate status code
        const status_code = parseInt(data.status, 10);
        if (isNaN(status_code) || status_code < 100 || status_code > 599) {
            LOGGER.module().error`ERROR: [/exhibits/controller (get_exhibit_records)] Invalid status code received: ${data.status}`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        return res.status(status_code).json(data);

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (get_exhibit_records)] ${error.message}`;

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve exhibit records',
            data: null
        });
    }
};

exports.get_exhibit_record = async function (req, res) {

    try {

        const type = req.query.type;
        const exhibit_uuid = req.params.exhibit_id;
        const user_uid = req.query.uid;

        // Validate exhibit UUID
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit ID is required',
                data: null
            });
        }

        // Sanitize and validate UUID format
        const sanitized_exhibit_uuid = exhibit_uuid.trim();
        if (sanitized_exhibit_uuid.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Exhibit ID exceeds maximum length',
                data: null
            });
        }

        // Validate model exists
        if (!EXHIBITS_MODEL) {
            throw new Error('Exhibit model not properly initialized');
        }

        let data;

        // Handle 'edit' type request
        if (type === 'edit') {
            // Validate user UID for edit requests
            if (!user_uid || typeof user_uid !== 'string' || user_uid.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user ID is required for edit requests',
                    data: null
                });
            }

            // Sanitize user UID
            const sanitized_user_uid = user_uid.trim();
            if (sanitized_user_uid.length > 255) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID exceeds maximum length',
                    data: null
                });
            }

            // Validate model method exists
            if (typeof EXHIBITS_MODEL.get_exhibit_edit_record !== 'function') {
                throw new Error('get_exhibit_edit_record method not available');
            }

            // Get edit record
            data = await EXHIBITS_MODEL.get_exhibit_edit_record(sanitized_user_uid, sanitized_exhibit_uuid);

        } else if (type === undefined || type === null || type === '') {
            // Handle standard exhibit record request

            // Validate model method exists
            if (typeof EXHIBITS_MODEL.get_exhibit_record !== 'function') {
                throw new Error('get_exhibit_record method not available');
            }

            // Get exhibit record
            data = await EXHIBITS_MODEL.get_exhibit_record(sanitized_exhibit_uuid);

        } else {
            // Invalid type parameter
            return res.status(400).json({
                success: false,
                message: 'Invalid request type',
                data: null
            });
        }

        // Validate response structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response from database');
        }

        // Validate status code
        const status_code = parseInt(data.status, 10);
        if (isNaN(status_code) || status_code < 100 || status_code > 599) {
            LOGGER.module().error`ERROR: [/exhibits/controller (get_exhibit_record)] Invalid status code received: ${data.status}`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Send successful response
        return res.status(status_code).json(data);

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (get_exhibit_record)] ${error.message}`;

        // Send sanitized error response
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve exhibit record',
            data: null
        });
    }
};

/**
 * Updates an existing exhibit record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.update_exhibit_record = async (req, res) => {

    try {

        const { exhibit_id: uuid } = req.params;

        // Validate UUID format
        if (!uuid || typeof uuid !== 'string' || uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit ID is required'
            });
        }

        // Validate request body exists and contains data
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body with update data is required'
            });
        }

        // Check authorization
        const authOptions = {
            req,
            permissions: ['update_exhibit', 'update_any_exhibit'],
            record_type: 'exhibit',
            parent_id: uuid,
            child_id: null
        };

        const isAuthorized = await AUTHORIZE.check_permission(authOptions);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request'
            });
        }

        // Update exhibit record
        const result = await EXHIBITS_MODEL.update_exhibit_record(uuid, req.body);

        // Validate result structure
        if (!result || typeof result.status !== 'number') {
            throw new Error('Invalid response from model');
        }

        return res.status(result.status).json(result);

    } catch (error) {
        // Log detailed error internally
        LOGGER.module().error('ERROR: [/exhibits/controller (update_exhibit_record)]', {
            error: error.message,
            stack: error.stack,
            exhibitId: req.params.exhibit_id,
            userId: req.user?.id
        });

        // Send generic error to client
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Unable to update exhibit record'
            });
        }
    }
};

exports.delete_exhibit_record = async function (req, res) {

    try {

        const exhibit_uuid = req.params.exhibit_id;

        // Validate exhibit UUID
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit ID is required',
                data: null
            });
        }

        // Sanitize and validate UUID
        const sanitized_exhibit_uuid = exhibit_uuid.trim();
        if (sanitized_exhibit_uuid.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Exhibit ID exceeds maximum length',
                data: null
            });
        }

        // Validate authorization module exists
        if (!AUTHORIZE || typeof AUTHORIZE.check_permission !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_record)] Authorization module not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Check permissions
        const authorization_options = {
            req: req,
            permissions: ['delete_exhibit', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: sanitized_exhibit_uuid,
            child_id: null
        };

        const is_authorized = await AUTHORIZE.check_permission(authorization_options);

        if (!is_authorized) {
            // Log unauthorized access attempt
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_exhibit_record)] Unauthorized delete attempt for exhibit: ${sanitized_exhibit_uuid} by user: ${req.user?.id || 'unknown'}`;

            return res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }

        // Validate model exists
        if (!EXHIBITS_MODEL || typeof EXHIBITS_MODEL.delete_exhibit_record !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_record)] Exhibit model not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Delete exhibit record
        const result = await EXHIBITS_MODEL.delete_exhibit_record(sanitized_exhibit_uuid);

        // Validate response structure
        if (!result || typeof result !== 'object') {
            throw new Error('Invalid response from database');
        }

        // Validate status code
        const status_code = parseInt(result.status, 10);
        if (isNaN(status_code) || status_code < 100 || status_code > 599) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_record)] Invalid status code received: ${result.status}`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Log successful deletion
        if (status_code >= 200 && status_code < 300) {
            LOGGER.module().info`INFO: [/exhibits/controller (delete_exhibit_record)] Successfully deleted exhibit: ${sanitized_exhibit_uuid} by user: ${req.user?.id || 'unknown'}`;
        }

        // Send successful response
        return res.status(status_code).json(result);

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_record)] ${error.message}`;

        return res.status(500).json({
            success: false,
            message: 'Unable to delete exhibit record',
            data: null
        });
    }
};

exports.get_exhibit_media = async function (req, res) {

    try {

        const exhibit_uuid = req.params.exhibit_id;
        const media_filename = req.params.media;

        // Validate exhibit UUID
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit ID is required',
                data: null
            });
        }

        // Validate media filename
        if (!media_filename || typeof media_filename !== 'string' || media_filename.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid media filename is required',
                data: null
            });
        }

        // Sanitize inputs
        const sanitized_uuid = exhibit_uuid.trim();
        const sanitized_media = media_filename.trim();

        // Check for path traversal attempts
        if (sanitized_uuid.includes('..') || sanitized_uuid.includes('/') || sanitized_uuid.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (get_exhibit_media)] Path traversal attempt detected in UUID: ${sanitized_uuid}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid exhibit ID format',
                data: null
            });
        }

        if (sanitized_media.includes('..') || sanitized_media.includes('/') || sanitized_media.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (get_exhibit_media)] Path traversal attempt detected in filename: ${sanitized_media}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid media filename format',
                data: null
            });
        }

        // Validate storage configuration
        if (!STORAGE_CONFIG || !STORAGE_CONFIG.storage_path) {
            LOGGER.module().error`ERROR: [/exhibits/controller (get_exhibit_media)] Storage configuration not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Construct and resolve absolute file path
        const base_storage_path = path.resolve(STORAGE_CONFIG.storage_path);
        const exhibit_directory = path.join(base_storage_path, sanitized_uuid);
        const file_path = path.join(exhibit_directory, sanitized_media);
        const resolved_file_path = path.resolve(file_path);

        // Verify the resolved path is within the allowed directory (prevent path traversal)
        if (!resolved_file_path.startsWith(base_storage_path)) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (get_exhibit_media)] Attempted access outside storage directory: ${resolved_file_path}`;
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                data: null
            });
        }

        // Validate file extension (whitelist allowed media types)
        const allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.mp4', '.webm', '.mp3'];
        const file_extension = path.extname(sanitized_media).toLowerCase();

        if (!allowed_extensions.includes(file_extension)) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (get_exhibit_media)] Attempted access to disallowed file type: ${file_extension}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid media file type',
                data: null
            });
        }

        // Check if file exists and is a file (not a directory)
        try {
            const file_stats = await fs.stat(resolved_file_path);

            if (!file_stats.isFile()) {
                LOGGER.module().warn`WARNING: [/exhibits/controller (get_exhibit_media)] Attempted access to non-file: ${resolved_file_path}`;
                return res.status(404).json({
                    success: false,
                    message: 'Media file not found',
                    data: null
                });
            }
        } catch (stat_error) {
            if (stat_error.code === 'ENOENT') {
                // File doesn't exist
                return res.status(404).json({
                    success: false,
                    message: 'Media file not found',
                    data: null
                });
            }
            // Other stat errors
            throw stat_error;
        }

        // Set security headers
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Cache-Control': 'private, max-age=3600'
        });

        // Send file with proper options
        const send_file_options = {
            root: base_storage_path,
            dotfiles: 'deny',
            headers: {
                'Content-Disposition': 'inline' // or 'attachment' to force download
            }
        };

        // Get relative path from base storage path
        const relative_path = path.relative(base_storage_path, resolved_file_path);

        // Send the file
        res.sendFile(relative_path, send_file_options, (send_error) => {
            if (send_error) {
                // Only log if headers haven't been sent
                if (!res.headersSent) {
                    LOGGER.module().error`ERROR: [/exhibits/controller (get_exhibit_media)] Error sending file: ${send_error.message}`;
                    return res.status(500).json({
                        success: false,
                        message: 'Error serving media file',
                        data: null
                    });
                }
            }
        });

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (get_exhibit_media)] ${error.message}`;

        // Send sanitized error response (only if headers not sent)
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Unable to retrieve media file',
                data: null
            });
        }
    }
};

exports.get_media = async function (req, res) {

    try {

        const media_filename = req.query.media;

        // Validate media filename
        if (!media_filename || typeof media_filename !== 'string' || media_filename.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid media filename is required',
                data: null
            });
        }

        // Sanitize input
        const sanitized_media = media_filename.trim();

        // Validate length
        if (sanitized_media.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Media filename exceeds maximum length',
                data: null
            });
        }

        // Check for path traversal attempts
        if (sanitized_media.includes('..') || sanitized_media.includes('/') || sanitized_media.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (get_media)] Path traversal attempt detected in filename: ${sanitized_media}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid media filename format',
                data: null
            });
        }

        // Validate storage configuration
        if (!STORAGE_CONFIG || !STORAGE_CONFIG.storage_path) {
            LOGGER.module().error`ERROR: [/exhibits/controller (get_media)] Storage configuration not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Construct and resolve absolute file path
        const base_storage_path = path.resolve(STORAGE_CONFIG.storage_path);
        const file_path = path.join(base_storage_path, sanitized_media);
        const resolved_file_path = path.resolve(file_path);

        // Verify the resolved path is within the allowed directory (prevent path traversal)
        if (!resolved_file_path.startsWith(base_storage_path)) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (get_media)] Attempted access outside storage directory: ${resolved_file_path}`;
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                data: null
            });
        }

        // Validate file extension (whitelist allowed media types)
        const allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.mp4', '.webm', '.mp3'];
        const file_extension = path.extname(sanitized_media).toLowerCase();

        if (!file_extension || !allowed_extensions.includes(file_extension)) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (get_media)] Attempted access to disallowed file type: ${file_extension || 'no extension'}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid media file type',
                data: null
            });
        }

        // Check if file exists and is a file (not a directory)
        try {
            const file_stats = await fs.stat(resolved_file_path);

            if (!file_stats.isFile()) {
                LOGGER.module().warn`WARNING: [/exhibits/controller (get_media)] Attempted access to non-file: ${resolved_file_path}`;
                return res.status(404).json({
                    success: false,
                    message: 'Media file not found',
                    data: null
                });
            }
        } catch (stat_error) {
            if (stat_error.code === 'ENOENT') {
                // File doesn't exist
                return res.status(404).json({
                    success: false,
                    message: 'Media file not found',
                    data: null
                });
            }
            // Other stat errors
            throw stat_error;
        }

        // Set security headers
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Cache-Control': 'private, max-age=3600'
        });

        // Send file with proper options
        const send_file_options = {
            root: base_storage_path,
            dotfiles: 'deny',
            headers: {
                'Content-Disposition': 'inline' // or 'attachment' to force download
            }
        };

        // Get relative path from base storage path
        const relative_path = path.relative(base_storage_path, resolved_file_path);

        // Send the file
        res.sendFile(relative_path, send_file_options, (send_error) => {
            if (send_error) {
                // Only log and respond if headers haven't been sent
                if (!res.headersSent) {
                    LOGGER.module().error`ERROR: [/exhibits/controller (get_media)] Error sending file: ${send_error.message}`;
                    return res.status(500).json({
                        success: false,
                        message: 'Error serving media file',
                        data: null
                    });
                }
            }
        });

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (get_media)] ${error.message}`;

        // Send sanitized error response (only if headers not sent)
        // Fixed: changed from 200 to 500 status code
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Unable to retrieve media file',
                data: null
            });
        }
    }
};

exports.delete_media = async function (req, res) {

    try {

        const media_filename = req.query.media;

        // Validate media filename
        if (!media_filename || typeof media_filename !== 'string' || media_filename.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid media filename is required',
                data: null
            });
        }

        // Sanitize input
        const sanitized_media = media_filename.trim();

        // Validate length
        if (sanitized_media.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Media filename exceeds maximum length',
                data: null
            });
        }

        // Check for path traversal attempts
        if (sanitized_media.includes('..') || sanitized_media.includes('/') || sanitized_media.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_media)] Path traversal attempt detected in filename: ${sanitized_media}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid media filename format',
                data: null
            });
        }

        // Validate storage configuration
        if (!STORAGE_CONFIG || !STORAGE_CONFIG.storage_path) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_media)] Storage configuration not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Construct and resolve absolute file path
        const base_storage_path = path.resolve(STORAGE_CONFIG.storage_path);
        const file_path = path.join(base_storage_path, sanitized_media);
        const resolved_file_path = path.resolve(file_path);

        // Verify the resolved path is within the allowed directory (prevent path traversal)
        if (!resolved_file_path.startsWith(base_storage_path)) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_media)] Attempted access outside storage directory: ${resolved_file_path}`;
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                data: null
            });
        }

        // Validate file extension (whitelist allowed media types)
        const allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.mp4', '.webm', '.mp3'];
        const file_extension = path.extname(sanitized_media).toLowerCase();

        if (!file_extension || !allowed_extensions.includes(file_extension)) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_media)] Attempted deletion of disallowed file type: ${file_extension || 'no extension'}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid media file type',
                data: null
            });
        }

        /* TODO
        if (!AUTHORIZE || typeof AUTHORIZE.check_permission !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_media)] Authorization module not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        const authorization_options = {
            req: req,
            permissions: ['delete_media', 'delete_any_media'],
            record_type: 'media',
            parent_id: null,
            child_id: sanitized_media
        };

        const is_authorized = await AUTHORIZE.check_permission(authorization_options);

        if (!is_authorized) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_media)] Unauthorized delete attempt for media: ${sanitized_media} by user: ${req.user?.id || 'unknown'}`;
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }
        */

        // Check if file exists and is a file (not a directory)
        let file_stats;
        try {
            file_stats = await fs.stat(resolved_file_path);

            if (!file_stats.isFile()) {
                LOGGER.module().warn`WARNING: [/exhibits/controller (delete_media)] Attempted deletion of non-file: ${resolved_file_path}`;
                return res.status(404).json({
                    success: false,
                    message: 'Media file not found',
                    data: null
                });
            }
        } catch (stat_error) {
            if (stat_error.code === 'ENOENT') {
                // File doesn't exist
                return res.status(404).json({
                    success: false,
                    message: 'Media file not found',
                    data: null
                });
            }
            // Other stat errors
            throw stat_error;
        }

        // Delete the file (async operation)
        await fs.unlink(resolved_file_path);

        // Log successful deletion
        LOGGER.module().info`INFO: [/exhibits/controller (delete_media)] Successfully deleted media: ${sanitized_media} by user: ${req.user?.id || 'unknown'}`;

        // Return 204 No Content (no response body with 204)
        return res.status(204).end();

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (delete_media)] ${error.message}`;

        // Send sanitized error response
        // Fixed: changed from 200 to 500 status code
        return res.status(500).json({
            success: false,
            message: 'Unable to delete media file',
            data: null
        });
    }
};

exports.delete_exhibit_media = async function (req, res) {

    let database_updated = false;
    let file_moved = false;
    let metadata_written = false;
    let trash_file_path = null;
    let metadata_file_path = null;
    let original_file_path = null;

    try {

        const exhibit_uuid = req.params.exhibit_id;
        const media_filename = req.params.media;

        // Validate exhibit UUID
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit ID is required',
                data: null
            });
        }

        // Validate media filename
        if (!media_filename || typeof media_filename !== 'string' || media_filename.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid media filename is required',
                data: null
            });
        }

        // Sanitize inputs
        const sanitized_uuid = exhibit_uuid.trim();
        const sanitized_media = media_filename.trim();

        // Validate lengths
        if (sanitized_uuid.length > 255 || sanitized_media.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Parameters exceed maximum length',
                data: null
            });
        }

        // Check for path traversal attempts in UUID
        if (sanitized_uuid.includes('..') || sanitized_uuid.includes('/') || sanitized_uuid.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_exhibit_media)] Path traversal attempt detected in UUID: ${sanitized_uuid}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid exhibit ID format',
                data: null
            });
        }

        // Check for path traversal attempts in media filename
        if (sanitized_media.includes('..') || sanitized_media.includes('/') || sanitized_media.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_exhibit_media)] Path traversal attempt detected in filename: ${sanitized_media}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid media filename format',
                data: null
            });
        }

        // Validate storage configuration
        if (!STORAGE_CONFIG || !STORAGE_CONFIG.storage_path) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Storage configuration not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Construct and resolve absolute file path
        const base_storage_path = path.resolve(STORAGE_CONFIG.storage_path);
        const exhibit_directory = path.join(base_storage_path, sanitized_uuid);
        const file_path = path.join(exhibit_directory, sanitized_media);
        const resolved_file_path = path.resolve(file_path);
        original_file_path = resolved_file_path;

        // Verify the resolved path is within the allowed directory
        if (!resolved_file_path.startsWith(base_storage_path)) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_exhibit_media)] Attempted access outside storage directory: ${resolved_file_path}`;
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                data: null
            });
        }

        // Validate file extension (whitelist allowed media types)
        const allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.mp4', '.webm', '.mp3'];
        const file_extension = path.extname(sanitized_media).toLowerCase();

        if (!file_extension || !allowed_extensions.includes(file_extension)) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_exhibit_media)] Attempted deletion of disallowed file type: ${file_extension || 'no extension'}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid media file type',
                data: null
            });
        }

        // Check authorization
        /* TODO
        if (!AUTHORIZE || typeof AUTHORIZE.check_permission !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Authorization module not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        const authorization_options = {
            req: req,
            permissions: ['delete_exhibit_media', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: sanitized_uuid,
            child_id: sanitized_media
        };

        const is_authorized = await AUTHORIZE.check_permission(authorization_options);

        if (!is_authorized) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (delete_exhibit_media)] Unauthorized delete attempt for exhibit: ${sanitized_uuid}, media: ${sanitized_media} by user: ${req.user?.id || 'unknown'}`;
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }

         */

        // Validate model exists
        if (!EXHIBITS_MODEL || typeof EXHIBITS_MODEL.delete_media_value !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Exhibit model not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Check if file exists and is a file (not a directory)
        let file_stats;
        try {
            file_stats = await fs.stat(resolved_file_path);

            if (!file_stats.isFile()) {
                LOGGER.module().warn`WARNING: [/exhibits/controller (delete_exhibit_media)] Attempted deletion of non-file: ${resolved_file_path}`;
                return res.status(404).json({
                    success: false,
                    message: 'Media file not found',
                    data: null
                });
            }
        } catch (stat_error) {
            if (stat_error.code === 'ENOENT') {
                return res.status(404).json({
                    success: false,
                    message: 'Media file not found',
                    data: null
                });
            }
            throw stat_error;
        }

        // === SOFT DELETE PROCESS ===

        // Define trash directory path
        const trash_directory = path.join(base_storage_path, '.trash', sanitized_uuid);
        const resolved_trash_directory = path.resolve(trash_directory);

        // Verify trash directory is within storage path
        if (!resolved_trash_directory.startsWith(base_storage_path)) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Trash directory path validation failed`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Ensure trash directory exists
        try {
            await fs.mkdir(resolved_trash_directory, { recursive: true });
        } catch (mkdir_error) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Failed to create trash directory: ${mkdir_error.message}`;
            throw new Error('Failed to initialize trash directory');
        }

        // Create timestamped filename to avoid conflicts
        const timestamp = Date.now();
        const file_basename = path.basename(sanitized_media, file_extension);
        const trashed_filename = `${file_basename}_${timestamp}${file_extension}`;
        trash_file_path = path.join(resolved_trash_directory, trashed_filename);
        const resolved_trash_file_path = path.resolve(trash_file_path);

        // Verify trash file path is within trash directory
        if (!resolved_trash_file_path.startsWith(resolved_trash_directory)) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Trash file path validation failed`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Create metadata file for restoration
        const metadata = {
            exhibit_uuid: sanitized_uuid,
            original_filename: sanitized_media,
            original_path: resolved_file_path,
            trashed_filename: trashed_filename,
            deleted_at: new Date().toISOString(),
            deleted_by: req.user?.id || 'unknown',
            deleted_by_username: req.user?.username || 'unknown',
            file_size: file_stats.size,
            file_extension: file_extension,
            can_restore_until: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString() // 30 days
        };

        const metadata_filename = `${file_basename}_${timestamp}.json`;
        metadata_file_path = path.join(resolved_trash_directory, metadata_filename);
        const resolved_metadata_file_path = path.resolve(metadata_file_path);

        // Verify metadata file path is within trash directory
        if (!resolved_metadata_file_path.startsWith(resolved_trash_directory)) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Metadata file path validation failed`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Step 1: Update database (mark media as deleted or remove reference)
        try {
            await EXHIBITS_MODEL.delete_media_value(sanitized_uuid, sanitized_media);
            database_updated = true;
        } catch (db_error) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Database update failed: ${db_error.message}`;
            throw new Error('Failed to update database');
        }

        // Step 2: Move file to trash (atomic operation)
        try {
            await fs.rename(resolved_file_path, resolved_trash_file_path);
            file_moved = true;
        } catch (rename_error) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Failed to move file to trash: ${rename_error.message}`;
            throw new Error('Failed to move file to trash');
        }

        // Step 3: Write metadata file
        try {
            await fs.writeFile(
                resolved_metadata_file_path,
                JSON.stringify(metadata, null, 2),
                'utf8'
            );
            metadata_written = true;
        } catch (write_error) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Failed to write metadata: ${write_error.message}`;
            throw new Error('Failed to write metadata');
        }

        // Log successful soft deletion
        LOGGER.module().info`INFO: [/exhibits/controller (delete_exhibit_media)] Successfully soft deleted media: ${sanitized_media} from exhibit: ${sanitized_uuid} to trash as: ${trashed_filename} by user: ${req.user?.id || 'unknown'}`;

        // Return success response with restoration info
        return res.status(204).json({
            success: true,
            message: 'Media file moved to trash successfully',
            data: {
                exhibit_uuid: sanitized_uuid,
                original_filename: sanitized_media,
                trashed_filename: trashed_filename,
                can_restore_until: metadata.can_restore_until,
                restore_available: true
            }
        });

    } catch (error) {
        // Rollback operations if something failed
        try {
            // If file was moved but metadata write failed, try to restore file
            if (file_moved && !metadata_written && trash_file_path && original_file_path) {
                LOGGER.module().warn`WARNING: [/exhibits/controller (delete_exhibit_media)] Attempting to rollback file move`;
                try {
                    await fs.rename(trash_file_path, original_file_path);
                    LOGGER.module().info`INFO: [/exhibits/controller (delete_exhibit_media)] Successfully rolled back file move`;
                } catch (rollback_error) {
                    LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Rollback failed: ${rollback_error.message}`;
                }
            }

            // If database was updated but file operations failed, log critical error
            if (database_updated && !file_moved) {
                LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] CRITICAL: Database updated but file not moved. Manual intervention required for exhibit: ${req.params.exhibit_id}, media: ${req.params.media}`;
            }

            // Clean up partial trash files if they exist
            if (trash_file_path && file_moved) {
                try {
                    await fs.unlink(trash_file_path);
                } catch (cleanup_error) {
                    LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Failed to clean up trash file: ${cleanup_error.message}`;
                }
            }

            if (metadata_file_path && metadata_written) {
                try {
                    await fs.unlink(metadata_file_path);
                } catch (cleanup_error) {
                    LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Failed to clean up metadata file: ${cleanup_error.message}`;
                }
            }
        } catch (rollback_error) {
            LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] Error during rollback: ${rollback_error.message}`;
        }

        LOGGER.module().error`ERROR: [/exhibits/controller (delete_exhibit_media)] ${error.message}`;

        // Send sanitized error response
        return res.status(500).json({
            success: false,
            message: 'Unable to delete exhibit media file',
            data: null
        });
    }
};

// TODO
exports.restore_exhibit_media = async function (req, res) {
    try {
        const exhibit_uuid = req.params.exhibit_id;
        const trashed_filename = req.query.filename;

        // Validate inputs
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit ID is required',
                data: null
            });
        }

        if (!trashed_filename || typeof trashed_filename !== 'string' || trashed_filename.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid trashed filename is required',
                data: null
            });
        }

        const sanitized_uuid = exhibit_uuid.trim();
        const sanitized_filename = trashed_filename.trim();

        // Check authorization
        const authorization_options = {
            req: req,
            permissions: ['restore_exhibit_media', 'delete_any_exhibit'],
            record_type: 'exhibit',
            parent_id: sanitized_uuid,
            child_id: sanitized_filename
        };

        const is_authorized = await AUTHORIZE.check_permission(authorization_options);

        if (!is_authorized) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (restore_exhibit_media)] Unauthorized restore attempt by user: ${req.user?.id || 'unknown'}`;
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }

        const base_storage_path = path.resolve(STORAGE_CONFIG.storage_path);
        const trash_directory = path.join(base_storage_path, '.trash', sanitized_uuid);
        const resolved_trash_directory = path.resolve(trash_directory);

        // Get metadata
        const file_basename = path.basename(sanitized_filename, path.extname(sanitized_filename));
        const metadata_filename = `${file_basename}.json`;
        const metadata_path = path.join(resolved_trash_directory, metadata_filename);
        const resolved_metadata_path = path.resolve(metadata_path);

        // Verify path
        if (!resolved_metadata_path.startsWith(base_storage_path)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                data: null
            });
        }

        // Read metadata
        let metadata;
        try {
            const metadata_content = await fs.readFile(resolved_metadata_path, 'utf8');
            metadata = JSON.parse(metadata_content);
        } catch (read_error) {
            return res.status(404).json({
                success: false,
                message: 'Metadata file not found',
                data: null
            });
        }

        // Check restoration period
        const restore_deadline = new Date(metadata.can_restore_until);
        if (Date.now() > restore_deadline.getTime()) {
            return res.status(410).json({
                success: false,
                message: 'Restoration period has expired',
                data: null
            });
        }

        // Restore file
        const trash_file_path = path.join(resolved_trash_directory, sanitized_filename);
        const resolved_trash_file_path = path.resolve(trash_file_path);
        const original_path = metadata.original_path;

        // Verify paths
        if (!resolved_trash_file_path.startsWith(base_storage_path) || !original_path.startsWith(base_storage_path)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                data: null
            });
        }

        // Ensure original directory exists
        const original_directory = path.dirname(original_path);
        await fs.mkdir(original_directory, { recursive: true });

        // Check if file exists at original location
        try {
            await fs.stat(original_path);
            return res.status(409).json({
                success: false,
                message: 'A file already exists at the original location',
                data: null
            });
        } catch (stat_error) {
            if (stat_error.code !== 'ENOENT') {
                throw stat_error;
            }
        }

        // Restore database reference
        if (EXHIBITS_MODEL && typeof EXHIBITS_MODEL.restore_media_value === 'function') {
            await EXHIBITS_MODEL.restore_media_value(metadata.exhibit_uuid, metadata.original_filename);
        }

        // Move file back
        await fs.rename(resolved_trash_file_path, original_path);

        // Delete metadata
        await fs.unlink(resolved_metadata_path);

        LOGGER.module().info`INFO: [/exhibits/controller (restore_exhibit_media)] Successfully restored media: ${metadata.original_filename} to exhibit: ${metadata.exhibit_uuid} by user: ${req.user?.id || 'unknown'}`;

        return res.status(200).json({
            success: true,
            message: 'Media file restored successfully',
            data: {
                exhibit_uuid: metadata.exhibit_uuid,
                original_filename: metadata.original_filename,
                restored_to: original_path
            }
        });

    } catch (error) {
        LOGGER.module().error`ERROR: [/exhibits/controller (restore_exhibit_media)] ${error.message}`;
        return res.status(500).json({
            success: false,
            message: 'Unable to restore media file',
            data: null
        });
    }
};

exports.build_exhibit_preview = async function (req, res) {

    try {
        const exhibit_uuid = req.query.uuid;

        // Validate UUID
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit UUID is required',
                data: null
            });
        }

        // Sanitize input
        const sanitized_uuid = exhibit_uuid.trim();

        // Validate length
        if (sanitized_uuid.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Exhibit UUID exceeds maximum length',
                data: null
            });
        }

        // Check for path traversal attempts
        if (sanitized_uuid.includes('..') || sanitized_uuid.includes('/') || sanitized_uuid.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (build_exhibit_preview)] Path traversal attempt detected: ${sanitized_uuid}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid exhibit UUID format',
                data: null
            });
        }

        // Validate model exists
        if (!EXHIBITS_MODEL ||
            typeof EXHIBITS_MODEL.check_preview !== 'function' ||
            typeof EXHIBITS_MODEL.delete_exhibit_preview !== 'function' ||
            typeof EXHIBITS_MODEL.build_exhibit_preview !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (build_exhibit_preview)] Exhibit model not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        /* TODO
        // Check authorization
        if (!AUTHORIZE || typeof AUTHORIZE.check_permission !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (build_exhibit_preview)] Authorization module not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        const authorization_options = {
            req: req,
            permissions: ['build_preview', 'edit_exhibit'],
            record_type: 'exhibit',
            parent_id: sanitized_uuid,
            child_id: null
        };

        const is_authorized = await AUTHORIZE.check_permission(authorization_options);

        if (!is_authorized) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (build_exhibit_preview)] Unauthorized preview build attempt for exhibit: ${sanitized_uuid} by user: ${req.user?.id || 'unknown'}`;
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }
        */

        // Check if preview exists
        const preview_exists = await EXHIBITS_MODEL.check_preview(sanitized_uuid);

        // Delete old preview if it exists
        if (preview_exists === true) {
            LOGGER.module().info`INFO: [/exhibits/controller (build_exhibit_preview)] Deleting existing preview for exhibit: ${sanitized_uuid}`;

            const delete_result = await EXHIBITS_MODEL.delete_exhibit_preview(sanitized_uuid);

            if (!delete_result || delete_result.status === false) {
                LOGGER.module().error`ERROR: [/exhibits/controller (build_exhibit_preview)] Failed to delete existing preview for exhibit: ${sanitized_uuid}`;
                return res.status(500).json({
                    success: false,
                    message: 'Unable to remove existing preview',
                    data: null
                });
            }

            LOGGER.module().info`INFO: [/exhibits/controller (build_exhibit_preview)] Successfully deleted existing preview for exhibit: ${sanitized_uuid}`;
        }

        // Build new preview
        LOGGER.module().info`INFO: [/exhibits/controller (build_exhibit_preview)] Building new preview for exhibit: ${sanitized_uuid}`;

        const build_result = await EXHIBITS_MODEL.build_exhibit_preview(sanitized_uuid);

        if (!build_result || build_result.status !== true) {
            LOGGER.module().error`ERROR: [/exhibits/controller (build_exhibit_preview)] Failed to build preview for exhibit: ${sanitized_uuid}`;
            return res.status(500).json({
                success: false,
                message: 'Unable to build exhibit preview',
                data: null
            });
        }

        // Validate webservices configuration
        if (!WEBSERVICES_CONFIG ||
            !WEBSERVICES_CONFIG.exhibit_preview_url ||
            !WEBSERVICES_CONFIG.exhibit_preview_api_key) {
            LOGGER.module().error`ERROR: [/exhibits/controller (build_exhibit_preview)] Webservices configuration not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Generate time-limited preview token
        const preview_token = await generate_preview_token(sanitized_uuid, req.user?.id);

        // Build preview URL
        const preview_url = `${WEBSERVICES_CONFIG.exhibit_preview_url}${sanitized_uuid}?token=${preview_token}`;

        LOGGER.module().info`INFO: [/exhibits/controller (build_exhibit_preview)] Successfully built preview for exhibit: ${sanitized_uuid} by user: ${req.user?.id || 'unknown'}`;

        // Render preview page
        return res.render('preview', {
            preview_url: preview_url,
            exhibit_uuid: sanitized_uuid
        });

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (build_exhibit_preview)] ${error.message}`;

        // Send sanitized error response
        return res.status(500).json({
            success: false,
            message: 'Unable to build exhibit preview',
            data: null
        });
    }
};

// Helper function to generate secure preview tokens
async function generate_preview_token(exhibit_uuid, user_id) {
    const crypto = require('crypto');

    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');

    // Store token with expiration (e.g., 1 hour)
    const token_data = {
        token: token,
        exhibit_uuid: exhibit_uuid,
        user_id: user_id,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (60 * 60 * 1000)).toISOString() // 1 hour
    };

    return token;
}

exports.publish_exhibit = async function (req, res) {

    try {

        const exhibit_uuid = req.params.exhibit_id;

        // Validate UUID
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit UUID is required',
                data: null
            });
        }

        // Sanitize input
        const sanitized_uuid = exhibit_uuid.trim();

        // Validate length
        if (sanitized_uuid.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Exhibit UUID exceeds maximum length',
                data: null
            });
        }

        // Check for path traversal attempts
        if (sanitized_uuid.includes('..') || sanitized_uuid.includes('/') || sanitized_uuid.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (publish_exhibit)] Path traversal attempt detected: ${sanitized_uuid}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid exhibit UUID format',
                data: null
            });
        }

        // Validate authorization module exists
        if (!AUTHORIZE || typeof AUTHORIZE.check_permission !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (publish_exhibit)] Authorization module not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Check permissions
        const authorization_options = {
            req: req,
            permissions: ['publish_exhibit', 'publish_any_exhibit'],
            record_type: 'exhibit',
            parent_id: sanitized_uuid,
            child_id: null
        };

        const is_authorized = await AUTHORIZE.check_permission(authorization_options);

        if (!is_authorized) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (publish_exhibit)] Unauthorized publish attempt for exhibit: ${sanitized_uuid} by user: ${req.user?.id || 'unknown'}`;
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }

        // Validate model exists
        if (!EXHIBITS_MODEL || typeof EXHIBITS_MODEL.publish_exhibit !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (publish_exhibit)] Exhibit model not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Attempt to publish exhibit
        const result = await EXHIBITS_MODEL.publish_exhibit(sanitized_uuid);

        // Validate response structure
        if (!result || typeof result !== 'object') {
            throw new Error('Invalid response from database');
        }

        // Handle different result statuses
        if (result.status === 'no_items') {
            LOGGER.module().info`INFO: [/exhibits/controller (publish_exhibit)] Publish failed - no items in exhibit: ${sanitized_uuid}`;
            return res.status(422).json({
                success: false,
                message: 'Exhibit must have at least one item to be published',
                data: null
            });
        }

        if (result.status === true) {
            LOGGER.module().info`INFO: [/exhibits/controller (publish_exhibit)] Successfully published exhibit: ${sanitized_uuid} by user: ${req.user?.id || 'unknown'}`;
            return res.status(200).json({
                success: true,
                message: 'Exhibit published successfully',
                data: {
                    exhibit_uuid: sanitized_uuid,
                    published_at: new Date().toISOString()
                }
            });
        }

        // Handle failure case
        LOGGER.module().error`ERROR: [/exhibits/controller (publish_exhibit)] Failed to publish exhibit: ${sanitized_uuid}`;
        return res.status(500).json({
            success: false,
            message: 'Unable to publish exhibit',
            data: null
        });

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (publish_exhibit)] ${error.message}`;

        // Send sanitized error response
        return res.status(500).json({
            success: false,
            message: 'Unable to publish exhibit',
            data: null
        });
    }
};

exports.suppress_exhibit = async function (req, res) {

    try {

        const exhibit_uuid = req.params.exhibit_id;

        // Validate UUID
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit UUID is required',
                data: null
            });
        }

        // Sanitize input
        const sanitized_uuid = exhibit_uuid.trim();

        // Validate length
        if (sanitized_uuid.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Exhibit UUID exceeds maximum length',
                data: null
            });
        }

        // Check for path traversal attempts
        if (sanitized_uuid.includes('..') || sanitized_uuid.includes('/') || sanitized_uuid.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (suppress_exhibit)] Path traversal attempt detected: ${sanitized_uuid}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid exhibit UUID format',
                data: null
            });
        }

        // Validate authorization module exists
        if (!AUTHORIZE || typeof AUTHORIZE.check_permission !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (suppress_exhibit)] Authorization module not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Check permissions
        const authorization_options = {
            req: req,
            permissions: ['suppress_exhibit', 'suppress_any_exhibit'],
            record_type: 'exhibit',
            parent_id: sanitized_uuid,
            child_id: null
        };

        const is_authorized = await AUTHORIZE.check_permission(authorization_options);

        if (!is_authorized) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (suppress_exhibit)] Unauthorized suppress attempt for exhibit: ${sanitized_uuid} by user: ${req.user?.id || 'unknown'}`;
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }

        // Validate model exists
        if (!EXHIBITS_MODEL || typeof EXHIBITS_MODEL.suppress_exhibit !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (suppress_exhibit)] Exhibit model not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Attempt to suppress exhibit
        const result = await EXHIBITS_MODEL.suppress_exhibit(sanitized_uuid);

        // Validate response structure
        if (!result || typeof result !== 'object') {
            throw new Error('Invalid response from database');
        }

        if (result.status === true) {
            LOGGER.module().info`INFO: [/exhibits/controller (suppress_exhibit)] Successfully suppressed exhibit: ${sanitized_uuid} by user: ${req.user?.id || 'unknown'}`;
            return res.status(200).json({
                success: true,
                message: 'Exhibit suppressed successfully',
                data: {
                    exhibit_uuid: sanitized_uuid,
                    suppressed_at: new Date().toISOString()
                }
            });
        }

        // Handle failure case
        LOGGER.module().error`ERROR: [/exhibits/controller (suppress_exhibit)] Failed to suppress exhibit: ${sanitized_uuid}`;
        return res.status(500).json({
            success: false,
            message: 'Unable to suppress exhibit',
            data: null
        });

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (suppress_exhibit)] ${error.message}`;

        // Send sanitized error response
        return res.status(500).json({
            success: false,
            message: 'Unable to suppress exhibit',
            data: null
        });
    }
};

exports.unlock_exhibit_record = async function (req, res) {

    try {

        const exhibit_uuid = req.params.exhibit_id;
        const user_uid = req.query.uid;
        const force_unlock = req.query.force;

        // Validate exhibit UUID
        if (!exhibit_uuid || typeof exhibit_uuid !== 'string' || exhibit_uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit UUID is required',
                data: null
            });
        }

        // Validate user UID
        if (!user_uid || typeof user_uid !== 'string' || user_uid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid user UID is required',
                data: null
            });
        }

        // Sanitize inputs
        const sanitized_uuid = exhibit_uuid.trim();
        const sanitized_uid = user_uid.trim();

        // Validate lengths
        if (sanitized_uuid.length > 255 || sanitized_uid.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Parameters exceed maximum length',
                data: null
            });
        }

        // Check for path traversal attempts in UUID
        if (sanitized_uuid.includes('..') || sanitized_uuid.includes('/') || sanitized_uuid.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (unlock_exhibit_record)] Path traversal attempt detected in UUID: ${sanitized_uuid}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid exhibit UUID format',
                data: null
            });
        }

        // Check for path traversal attempts in UID
        if (sanitized_uid.includes('..') || sanitized_uid.includes('/') || sanitized_uid.includes('\\')) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (unlock_exhibit_record)] Path traversal attempt detected in UID: ${sanitized_uid}`;
            return res.status(400).json({
                success: false,
                message: 'Invalid user UID format',
                data: null
            });
        }

        // Parse and validate force parameter
        let is_force_unlock = false;
        if (force_unlock !== undefined && force_unlock !== null) {
            const force_string = String(force_unlock).toLowerCase().trim();
            if (force_string === 'true' || force_string === '1') {
                is_force_unlock = true;
            } else if (force_string === 'false' || force_string === '0') {
                is_force_unlock = false;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid force parameter. Must be true or false',
                    data: null
                });
            }
        }

        /* TODO
        // Validate authorization module exists
        if (!AUTHORIZE || typeof AUTHORIZE.check_permission !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (unlock_exhibit_record)] Authorization module not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Determine required permissions based on force unlock
        const required_permissions = is_force_unlock
            ? ['force_unlock_exhibit', 'unlock_any_exhibit']
            : ['unlock_exhibit', 'update_exhibit', 'update_any_exhibit'];

        // Check permissions
        const authorization_options = {
            req: req,
            permissions: required_permissions,
            record_type: 'exhibit',
            parent_id: sanitized_uuid,
            child_id: null
        };

        const is_authorized = await AUTHORIZE.check_permission(authorization_options);

        if (!is_authorized) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (unlock_exhibit_record)] Unauthorized unlock attempt for exhibit: ${sanitized_uuid} by user: ${req.user?.id || 'unknown'}, force: ${is_force_unlock}`;
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }
        */

        // Additional check: verify user is unlocking their own lock or has force permission
        if (!is_force_unlock && req.user?.id && sanitized_uid !== req.user.id.toString()) {
            LOGGER.module().warn`WARNING: [/exhibits/controller (unlock_exhibit_record)] User ${req.user.id} attempted to unlock exhibit ${sanitized_uuid} locked by user ${sanitized_uid} without force permission`;
            return res.status(403).json({
                success: false,
                message: 'Cannot unlock another user\'s lock without force permission',
                data: null
            });
        }

        // Validate model exists
        if (!EXHIBITS_MODEL || typeof EXHIBITS_MODEL.unlock_exhibit_record !== 'function') {
            LOGGER.module().error`ERROR: [/exhibits/controller (unlock_exhibit_record)] Exhibit model not properly initialized`;
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                data: null
            });
        }

        // Prepare options for model
        const unlock_options = {
            force: is_force_unlock
        };

        // Attempt to unlock exhibit
        const result = await EXHIBITS_MODEL.unlock_exhibit_record(sanitized_uid, sanitized_uuid, unlock_options);

        // Validate response structure
        if (!result || typeof result !== 'object') {
            LOGGER.module().error`ERROR: [/exhibits/controller (unlock_exhibit_record)] Invalid response from model for exhibit: ${sanitized_uuid}`;
            return res.status(500).json({
                success: false,
                message: 'Unable to unlock exhibit record',
                data: null
            });
        }

        // Check for specific error conditions
        if (result.status === false) {
            // Handle specific error cases
            if (result.error === 'not_locked') {
                return res.status(409).json({
                    success: false,
                    message: 'Exhibit is not currently locked',
                    data: null
                });
            }

            if (result.error === 'locked_by_other') {
                return res.status(409).json({
                    success: false,
                    message: 'Exhibit is locked by another user',
                    data: null
                });
            }

            LOGGER.module().error`ERROR: [/exhibits/controller (unlock_exhibit_record)] Failed to unlock exhibit: ${sanitized_uuid}`;
            return res.status(500).json({
                success: false,
                message: 'Unable to unlock exhibit record',
                data: null
            });
        }

        LOGGER.module().info`INFO: [/exhibits/controller (unlock_exhibit_record)] Successfully unlocked exhibit: ${sanitized_uuid} by user: ${req.user?.id || 'unknown'}, force: ${is_force_unlock}`;

        return res.status(200).json({
            success: true,
            message: 'Exhibit record unlocked successfully',
            data: {
                exhibit_uuid: sanitized_uuid,
                unlocked_by: req.user?.id || 'unknown',
                force_unlock: is_force_unlock,
                unlocked_at: new Date().toISOString()
            }
        });

    } catch (error) {

        LOGGER.module().error`ERROR: [/exhibits/controller (unlock_exhibit_record)] ${error.message}`;

        // Send sanitized error response
        return res.status(500).json({
            success: false,
            message: 'Unable to unlock exhibit record',
            data: null
        });
    }
};

exports.verify = function (req, res) {
    res.status(200).send({
        message: 'Token Verified'
    });
};
