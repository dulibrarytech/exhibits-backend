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

const CONTROLLER = require('../exhibits/items_controller');
const ENDPOINTS = require('../exhibits/endpoints/index');
const TOKEN = require('../libs/tokens');
const {rate_limits} = require('../config/rate_limits_loader');

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
    // ITEM CRUD OPERATIONS
    // ========================================

    // Create item record
    app.route(endpoints.exhibits.item_records.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.create_item_record)
        );

    // Get all item records
    app.route(endpoints.exhibits.item_records.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_item_records)
        );

    // Get single item record
    app.route(endpoints.exhibits.item_records.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_item_record)
        );

    // Update item record
    app.route(endpoints.exhibits.item_records.put.endpoint)
        .put(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.update_item_record)
        );

    // Delete item record (soft delete)
    app.route(endpoints.exhibits.item_records.delete.endpoint)
        .delete(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.delete_item_record)
        );

    // ========================================
    // ITEM STATE MANAGEMENT
    // ========================================

    // Publish item record
    // SECURITY FIX: Added TOKEN.verify - was missing authentication!
    app.route(endpoints.exhibits.item_records.item_publish.post.endpoint)
        .post(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.publish_item_record)
        );

    // Suppress item record
    app.route(endpoints.exhibits.item_records.item_suppress.post.endpoint)
        .post(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.suppress_item_record)
        );

    // Unlock item record
    app.route(endpoints.exhibits.item_unlock_record.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.unlock_item_record)
        );

    // ========================================
    // ITEM ORDERING
    // ========================================

    // Reorder items
    app.route(endpoints.exhibits.reorder_records.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.reorder_items)
        );

    // ========================================
    // EXTERNAL REPOSITORY INTEGRATIONS
    // ========================================

    // Get repository item record
    app.route(endpoints.exhibits.repo_items.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_repo_item_record)
        );

    // Get Kaltura item record
    app.route(endpoints.exhibits.kaltura_items.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_kaltura_item_record)
        );

    // ========================================
    // ITEM METADATA
    // ========================================

    // Get item subjects/tags
    app.route(endpoints.exhibits.item_subjects.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_item_subjects)
        );

};