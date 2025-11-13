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

const CONTROLLER = require('../exhibits/timelines_controller');
const ENDPOINTS = require('../exhibits/endpoints/index');
const TOKEN = require('../libs/tokens');
const LOGGER = require('../libs/log4');
const { rate_limits } = require('../config/rate_limits_loader');

// Security headers middleware
const security_headers = (req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'"
    });
    next();
};

// Request logging middleware
const log_request = (req, res, next) => {
    const start_time = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start_time;
        LOGGER.module().info`INFO: [${req.method}] ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms - IP: ${req.ip}`;
    });

    next();
};

// Error handling middleware for async routes
const async_handler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = function (app) {
    // Apply global middleware for all timeline routes
    app.use('/api/timelines', security_headers);
    app.use('/api/timelines', log_request);

    // Get endpoints
    const endpoints = ENDPOINTS();

    // ========================================
    // TIMELINE CRUD OPERATIONS
    // ========================================

    // Get timeline record
    app.route(endpoints.exhibits.timeline_records.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_timeline_record)
        );

    // Create timeline record
    app.route(endpoints.exhibits.timeline_records.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.create_timeline_record)
        );

    // Update timeline record
    app.route(endpoints.exhibits.timeline_records.put.endpoint)
        .put(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.update_timeline_record)
        );

    // ========================================
    // TIMELINE ITEM CRUD OPERATIONS
    // ========================================

    // Create timeline item record
    app.route(endpoints.exhibits.timeline_item_records.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.create_timeline_item_record)
        );

    // Get all timeline item records
    app.route(endpoints.exhibits.timeline_item_records.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_timeline_item_records)
        );

    // Get single timeline item record
    app.route(endpoints.exhibits.timeline_item_record.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_timeline_item_record)
        );

    // Update timeline item record
    app.route(endpoints.exhibits.timeline_item_records.put.endpoint)
        .put(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.update_timeline_item_record)
        );

    // Delete timeline item record (soft delete)
    app.route(endpoints.exhibits.timeline_item_records.delete.endpoint)
        .delete(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.delete_timeline_item_record)
        );

    // ========================================
    // TIMELINE ITEM STATE MANAGEMENT
    // ========================================

    // Publish timeline item record
    app.route(endpoints.exhibits.timeline_item_records.timeline_item_publish.post.endpoint)
        .post(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.publish_timeline_item_record)
        );

    // Suppress timeline item record
    app.route(endpoints.exhibits.timeline_item_records.timeline_item_suppress.post.endpoint)
        .post(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.suppress_timeline_item_record)
        );

    // Unlock timeline item record
    app.route(endpoints.exhibits.timeline_item_unlock_record.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.unlock_timeline_item_record)
        );

    // ========================================
    // ERROR HANDLING
    // ========================================

    // 404 handler for timeline routes
    app.use('/api/timelines/*', (req, res) => {
        LOGGER.module().warn`WARNING: [404] Route not found: ${req.method} ${req.path}`;
        res.status(404).json({
            success: false,
            message: 'Endpoint not found',
            data: null
        });
    });

    // Global error handler for timeline routes
    app.use('/api/timelines', (err, req, res, next) => {
        LOGGER.module().error`ERROR: [Global Error Handler] ${err.message} - Path: ${req.path}`;

        // Don't expose error details in production
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