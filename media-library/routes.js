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

const CONTROLLER = require('../media-library/controller');
const ENDPOINTS = require('../media-library/endpoints')();
const TOKEN = require('../libs/tokens');
const LOGGER = require('../libs/log4');
const { rate_limits } = require('../config/rate_limits_loader');

// Security headers middleware
// NOTE: Content-Security-Policy is handled globally by Helmet (see helmet_config.js)
// which includes frame-src directives for Kaltura player iframe embedding.
// Do NOT set CSP here as it would override the global Helmet policy.
const security_headers = (req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    });
    next();
};

// Request logging middleware
const log_request = (req, res, next) => {
    const start_time = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start_time;
        LOGGER.module().info(`INFO: [${req.method}] ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms - IP: ${req.ip}`);
    });

    next();
};

// JSON body parser error handler
const json_error_handler = (err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        LOGGER.module().warn(`WARNING: [JSON Parse Error] Invalid JSON in request body - Path: ${req.path}`);
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body',
            data: null
        });
    }
    next(err);
};

// Error handling middleware for routes
const async_handler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = function (app) {
    // Apply global middleware for all media library routes
    app.use('/api/media', security_headers);
    app.use('/api/media', log_request);
    app.use('/api/media', json_error_handler);

    // ========================================
    // MEDIA LIBRARY CRUD OPERATIONS
    // ========================================

    // Get all media records
    app.route(ENDPOINTS.media_records.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_media_records)
        );

    // Create media record
    app.route(ENDPOINTS.media_records.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.create_media_record)
        );

    // Get single media record by UUID
    app.route(ENDPOINTS.media_record.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_media_record)
        );

    // Update media record
    app.route(ENDPOINTS.media_records.put.endpoint)
        .put(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.update_media_record)
        );

    // Delete media record (soft delete)
    app.route(ENDPOINTS.media_records.delete.endpoint)
        .delete(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.delete_media_record)
        );

    // ========================================
    // MEDIA FILE AND THUMBNAIL RETRIEVAL
    // ========================================

    // Get media file by UUID (hash-bucketed storage)
    // Note: Uses TOKEN.verify_with_query to support token in query string for img src URLs
    app.route(ENDPOINTS.media_file.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify_with_query || TOKEN.verify,
            async_handler(CONTROLLER.get_media)
        );

    // Get media thumbnail by UUID (hash-bucketed storage)
    // Note: Uses TOKEN.verify_with_query to support token in query string for img src URLs
    app.route(ENDPOINTS.media_thumbnail.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify_with_query || TOKEN.verify,
            async_handler(CONTROLLER.get_thumbnail)
        );

    // ========================================
    // REPOSITORY SEARCH AND THUMBNAILS
    // ========================================

    // Search digital repository records
    app.route(ENDPOINTS.repo_media_search.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.search_repository)
        );

    // Get repository thumbnail by UUID
    // Note: Uses TOKEN.verify_with_query to support token in query string for img src URLs
    app.route(ENDPOINTS.repo_thumbnail.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify_with_query || TOKEN.verify,
            async_handler(CONTROLLER.get_repo_tn)
        );

    // Get subjects from digital repository (all types or filtered by ?type=)
    app.route(ENDPOINTS.repo_subjects.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_subjects)
        );

    // Get resource types from digital repository
    app.route(ENDPOINTS.repo_resource_types.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_resource_types)
        );

    // ========================================
    // KALTURA MEDIA
    // ========================================

    // Get Kaltura player configuration (partner_id, uiconf_id)
    // GET /api/v1/media/library/kaltura/config/player
    // NOTE: This route MUST be registered before /kaltura/:entry_id
    // to prevent Express from matching "config" as an entry_id parameter
    app.route(ENDPOINTS.kaltura_config.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_kaltura_config)
        );

    // Get Kaltura media metadata by entry ID
    // GET /api/v1/media/library/kaltura/:entry_id
    app.route(ENDPOINTS.kaltura_media.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_kaltura_media)
        );

    // Assign Kaltura media entry to exhibits category
    // POST /api/v1/media/library/kaltura/:entry_id/category
    app.route(ENDPOINTS.kaltura_category.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.assign_kaltura_category)
        );

    // ========================================
    // ERROR HANDLING
    // ========================================

    // 404 handler for media library routes
    app.use('/api/media/*', (req, res) => {
        LOGGER.module().warn(`WARNING: [404] Route not found: ${req.method} ${req.path}`);
        res.status(404).json({
            success: false,
            message: 'Endpoint not found',
            data: null
        });
    });

    // Global error handler for media library routes
    app.use('/api/media', (err, req, res, next) => {
        LOGGER.module().error(`ERROR: [Global Error Handler] ${err.message} - Path: ${req.path}`);

        const error_message = process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message;

        res.status(err.status || 500).json({
            success: false,
            message: error_message,
            data: null
        });
    });
};
