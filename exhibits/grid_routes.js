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

const CONTROLLER = require('../exhibits/grid_controller');
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
    // GRID CRUD OPERATIONS
    // ========================================

    // Get grid record
    app.route(endpoints.exhibits.grid_records.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_grid_record)
        );

    // Create grid record
    app.route(endpoints.exhibits.grid_records.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.create_grid_record)
        );

    // Update grid record
    app.route(endpoints.exhibits.grid_records.put.endpoint)
        .put(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.update_grid_record)
        );

    // ========================================
    // GRID ITEM CRUD OPERATIONS
    // ========================================

    // Create grid item record
    app.route(endpoints.exhibits.grid_item_records.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.create_grid_item_record)
        );

    // Get all grid item records
    app.route(endpoints.exhibits.grid_item_records.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_grid_item_records)
        );

    // Get single grid item record
    app.route(endpoints.exhibits.grid_item_record.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_grid_item_record)
        );

    // Update grid item record
    app.route(endpoints.exhibits.grid_item_records.put.endpoint)
        .put(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.update_grid_item_record)
        );

    // Delete grid item record (soft delete)
    app.route(endpoints.exhibits.grid_item_records.delete.endpoint)
        .delete(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.delete_grid_item_record)
        );

    // ========================================
    // GRID ITEM STATE MANAGEMENT
    // ========================================

    // Publish grid item record
    app.route(endpoints.exhibits.grid_item_records.grid_item_publish.post.endpoint)
        .post(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.publish_grid_item_record)
        );

    // Suppress grid item record
    app.route(endpoints.exhibits.grid_item_records.grid_item_suppress.post.endpoint)
        .post(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.suppress_grid_item_record)
        );

    // Unlock grid item record
    app.route(endpoints.exhibits.grid_item_unlock_record.post.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.unlock_grid_item_record)
        );

};