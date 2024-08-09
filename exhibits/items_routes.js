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

const CONTROLLER = require('../exhibits/controller');
const ENDPOINTS = require('../exhibits/endpoints');
const TOKEN = require('../libs/tokens');

module.exports = function (app) {

    app.route(ENDPOINTS().exhibits.item_records.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.create_item_record);

    app.route(ENDPOINTS().exhibits.item_records.endpoint)
    .get(CONTROLLER.get_item_records);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.item_records.get.endpoint)
    .get(TOKEN.verify, CONTROLLER.get_item_record);

    app.route(ENDPOINTS().exhibits.item_media.get.endpoint)
    .get(CONTROLLER.get_item_media);

    app.route(ENDPOINTS().exhibits.item_records.put.endpoint)
    .put(TOKEN.verify, CONTROLLER.update_item_record);

    app.route(ENDPOINTS().exhibits.item_records.delete.endpoint)
    .delete(TOKEN.verify, CONTROLLER.delete_item_record);


    /*
    app.route(ENDPOINTS().exhibits.heading_records.post.endpoint)
    .post(CONTROLLER.create_heading_record);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.heading_records.get.endpoint)
    .get(CONTROLLER.get_heading_record);

    app.route(ENDPOINTS().exhibits.heading_records.put.endpoint)
    .put(CONTROLLER.update_heading_record); // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.heading_records.delete.endpoint)
    .delete(CONTROLLER.delete_heading_record);

    app.route(ENDPOINTS().exhibits.grid_records.post.endpoint)
    .post(CONTROLLER.create_grid_record);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.grid_item_records.post.endpoint)
    .post(CONTROLLER.create_grid_item_record)
    .get(CONTROLLER.get_grid_item_records);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.trashed_records.get.endpoint)
    .get(CONTROLLER.get_trashed_records);

    app.route(ENDPOINTS().exhibits.trashed_records.delete.endpoint)
    .delete(CONTROLLER.delete_trashed_record);

    app.route(ENDPOINTS().exhibits.trashed_records.post.endpoint)
    .post(CONTROLLER.delete_all_trashed_records);

    app.route(ENDPOINTS().exhibits.trashed_records.put.endpoint)
    .put(CONTROLLER.restore_trashed_record);

    app.route(ENDPOINTS().exhibits.exhibit_media.get.endpoint)
    .get(CONTROLLER.get_exhibit_media);
    */

    /*
    app.route(ENDPOINTS().exhibits.exhibit_preview.get.endpoint)
    .get(CONTROLLER.build_exhibit_preview);  // TOKEN verify

    app.route(ENDPOINTS().exhibits.exhibit_publish.post.endpoint)
    .post(CONTROLLER.publish_exhibit);

    app.route(ENDPOINTS().exhibits.exhibit_suppress.post.endpoint)
    .post(CONTROLLER.suppress_exhibit);

     */
};