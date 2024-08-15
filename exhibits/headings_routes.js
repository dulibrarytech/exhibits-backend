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

const CONTROLLER = require('../exhibits/headings_controller');
const ENDPOINTS = require('../exhibits/endpoints');
const TOKEN = require('../libs/tokens');

module.exports = function (app) {

    app.route(ENDPOINTS().exhibits.heading_records.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.create_heading_record);

    app.route(ENDPOINTS().exhibits.heading_records.get.endpoint)
    .get(TOKEN.verify, CONTROLLER.get_heading_record);

    console.log(ENDPOINTS().exhibits.heading_records.put.endpoint);
    app.route(ENDPOINTS().exhibits.heading_records.put.endpoint)
    .put(TOKEN.verify, CONTROLLER.update_heading_record);

    app.route(ENDPOINTS().exhibits.heading_records.delete.endpoint)
    .delete(TOKEN.verify, CONTROLLER.delete_heading_record);
};
