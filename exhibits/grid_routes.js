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
const ENDPOINTS = require('../exhibits/endpoints');
const TOKEN = require('../libs/tokens');

module.exports = function (app) {

    app.route(ENDPOINTS().exhibits.grid_records.get.endpoint)
    .get(TOKEN.verify, CONTROLLER.get_grid_record);

    app.route(ENDPOINTS().exhibits.grid_records.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.create_grid_record);

    app.route(ENDPOINTS().exhibits.grid_records.put.endpoint)
    .put(TOKEN.verify, CONTROLLER.update_grid_record);

    app.route(ENDPOINTS().exhibits.grid_item_records.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.create_grid_item_record);

    app.route(ENDPOINTS().exhibits.grid_item_records.get.endpoint)
    .get(TOKEN.verify, CONTROLLER.get_grid_item_records);

    app.route(ENDPOINTS().exhibits.grid_item_record.get.endpoint)
    .get(TOKEN.verify, CONTROLLER.get_grid_item_record);

    app.route(ENDPOINTS().exhibits.grid_item_records.put.endpoint)
    .put(TOKEN.verify, CONTROLLER.update_grid_item_record);

    app.route(ENDPOINTS().exhibits.grid_item_media.delete.endpoint)
    .delete(TOKEN.verify, CONTROLLER.delete_grid_item_media);

    app.route(ENDPOINTS().exhibits.grid_item_records.grid_item_publish.post.endpoint)
    .post(CONTROLLER.publish_grid_item_record);

    app.route(ENDPOINTS().exhibits.grid_item_records.grid_item_suppress.post.endpoint)
    .post(CONTROLLER.suppress_grid_item_record);
};