/**

 Copyright 2023 University of Denver

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

module.exports = (app) => {

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoints.post.endpoint)
        .post(CONTROLLER.create_exhibit_record);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoint)
        .get(CONTROLLER.get_exhibit_records); // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoints.get.endpoint)
        .get(CONTROLLER.get_exhibit_record); // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoints.put.endpoint)
        .put(CONTROLLER.update_exhibit_record); // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoints.delete.endpoint)
        .delete(CONTROLLER.delete_exhibit_record);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.item_records.post.endpoint)
        .post(CONTROLLER.create_item_record);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.item_records.endpoint)
        .get(CONTROLLER.get_item_records);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.item_records.get.endpoint)
        .get(CONTROLLER.get_item_record);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.item_records.put.endpoint)
        .put(CONTROLLER.update_item_record);  // TOKEN.verify,

    app.route(ENDPOINTS().exhibits.item_records.delete.endpoint)
        .delete(CONTROLLER.delete_item_record);  // TOKEN.verify,

    // TODO: headings
    app.route(ENDPOINTS().exhibits.heading_records.post.endpoint)
        .post(CONTROLLER.create_heading_record);  // TOKEN.verify,

};