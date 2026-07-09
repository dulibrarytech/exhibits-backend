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

const CONTROLLER = require('../exhibits/recycle_controller');
const ENDPOINTS = require('../exhibits/endpoints/index');
const TOKEN = require('../libs/tokens');
const { rate_limits } = require('../config/rate_limits_loader');

// Surface a rejected handler promise to Express' error handling.
const async_handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = function (app) {

    const endpoints = ENDPOINTS();

    // List recycled records (owner-scoped; manage_recycle_bin sees all).
    app.route(endpoints.exhibits.recycled_records.get.endpoint)
        .get(
            rate_limits.read_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.get_recycled_records)
        );

    // Empty the recycle bin. Parameterless `/recycle/all` (one segment) — distinct
    // from the three-segment per-record routes below, so there is no path overlap.
    app.route(endpoints.exhibits.recycled_records.empty.endpoint)
        .delete(
            rate_limits.state_change_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.delete_all_recycled_records)
        );

    // Restore a single recycled record.
    app.route(endpoints.exhibits.recycled_records.put.endpoint)
        .put(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.restore_recycled_record)
        );

    // Permanently delete a single recycled record.
    app.route(endpoints.exhibits.recycled_records.delete.endpoint)
        .delete(
            rate_limits.write_operations,
            TOKEN.verify,
            async_handler(CONTROLLER.delete_recycled_record)
        );
};
