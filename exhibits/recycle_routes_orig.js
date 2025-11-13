/**

 Copyright 2025 University of Denver

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

module.exports = function (app) {
    app.route(ENDPOINTS().exhibits.recycled_records.get.endpoint)
    .get(CONTROLLER.get_recycled_records);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.recycled_records.put.endpoint)
    .put(CONTROLLER.restore_recycled_record);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.recycled_records.delete.endpoint)
    .delete(CONTROLLER.delete_recycled_record); // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.recycled_records.post.endpoint)
    .post(CONTROLLER.delete_all_recycled_records); // TOKEN.verify,
};
