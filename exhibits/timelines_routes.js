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

};