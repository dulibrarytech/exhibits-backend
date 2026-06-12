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

const CONTROLLER = require('../exhibits/share_controller');
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
    // EXHIBIT SHARING OPERATIONS
    // ========================================

    // View shared exhibit preview (public access with shared token)
    app.route(endpoints.exhibits.exhibit_shared.get.endpoint)
        .get(
            rate_limits.public_media_access,
            TOKEN.verify_shared,
            async_handler(CONTROLLER.share_exhibit_preview)
        );

    // Create shared exhibit preview URL (authenticated users only)
    app.route(endpoints.exhibits.exhibit_shared.get.endpoint)
        .post(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.create_shared_exhibit_preview_url)
        );

};