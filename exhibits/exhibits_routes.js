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

const CONTROLLER = require('../exhibits/exhibits_controller');
const ENDPOINTS = require('../exhibits/endpoints/index');
const TOKEN = require('../libs/tokens');
const { rate_limits } = require('../config/rate_limits_loader');

// Wrap an async handler so a rejected promise reaches the global error handler.
// Security headers, request logging, and 404/error handling are applied once,
// globally, in config/express.js — not per route file.
const async_handler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = function (app) {

    const endpoints = ENDPOINTS();

    // ========================================
    // EXHIBIT MEDIA LIBRARY BINDINGS
    // ========================================
    // NOTE: These routes MUST be registered BEFORE the parameterized
    // /:exhibit_id routes to prevent Express from matching "media-library"
    // as an exhibit_id value.

    // Get media library bindings for an exhibit
    app.route(endpoints.exhibits.exhibit_media_library.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_exhibit_media_bindings)
        );

    // Bind a media library asset to an exhibit
    app.route(endpoints.exhibits.exhibit_media_library.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.bind_exhibit_media)
        );

    // Unbind a media library asset from an exhibit by role
    app.route(endpoints.exhibits.exhibit_media_library.delete.endpoint)
        .delete(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.unbind_exhibit_media)
        );

    // ========================================
    // EXHIBIT CRUD OPERATIONS
    // ========================================

    // Create exhibit record
    app.route(endpoints.exhibits.exhibit_records.endpoints.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.create_exhibit_record)
        );

    // Get all exhibit records
    app.route(endpoints.exhibits.exhibit_records.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_exhibit_records)
        );

    // Get single exhibit record
    app.route(endpoints.exhibits.exhibit_records.endpoints.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_exhibit_record)
        );

    // Update exhibit record
    app.route(endpoints.exhibits.exhibit_records.endpoints.put.endpoint)
        .put(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.update_exhibit_record)
        );

    // Delete exhibit record (soft delete)
    app.route(endpoints.exhibits.exhibit_records.endpoints.delete.endpoint)
        .delete(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.delete_exhibit_record)
        );

    // ========================================
    // EXHIBIT STATE MANAGEMENT
    // ========================================

    // Build exhibit preview
    app.route(endpoints.exhibits.exhibit_preview.get.endpoint)
        .get(
            rate_limits.preview_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.build_exhibit_preview)
        );

    // Publish exhibit
    app.route(endpoints.exhibits.exhibit_publish.post.endpoint)
        .post(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.publish_exhibit)
        );

    // Suppress exhibit
    app.route(endpoints.exhibits.exhibit_suppress.post.endpoint)
        .post(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.suppress_exhibit)
        );

    // Unlock exhibit record
    app.route(endpoints.exhibits.exhibit_unlock_record.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.unlock_exhibit_record)
        );

    // ========================================
    // UTILITY ENDPOINTS
    // ========================================

    // Verify token
    app.route(endpoints.exhibits.token_verify.endpoint)
        .post(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.verify)
        );

};