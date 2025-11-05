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

const CONTROLLER = require('../exhibits/exhibits_controller');
const ENDPOINTS = require('../exhibits/endpoints/index');
const TOKEN = require('../libs/tokens');

module.exports = function (app) {

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoints.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.create_exhibit_record);

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoint)
    .get(TOKEN.verify, CONTROLLER.get_exhibit_records);

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoints.get.endpoint)
    .get(TOKEN.verify, CONTROLLER.get_exhibit_record);

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoints.put.endpoint)
    .put(TOKEN.verify, CONTROLLER.update_exhibit_record);

    app.route(ENDPOINTS().exhibits.exhibit_records.endpoints.delete.endpoint)
    .delete(TOKEN.verify, CONTROLLER.delete_exhibit_record);

    app.route(ENDPOINTS().exhibits.exhibit_media.get.endpoint)
    .get(CONTROLLER.get_exhibit_media);

    app.route(ENDPOINTS().exhibits.exhibit_media.delete.endpoint)
    .delete(TOKEN.verify, CONTROLLER.delete_exhibit_media);

    app.route(ENDPOINTS().exhibits.media.get.endpoint)
    .get(CONTROLLER.get_media);

    app.route(ENDPOINTS().exhibits.media.delete.endpoint)
    .delete(TOKEN.verify, CONTROLLER.delete_media);

    app.route(ENDPOINTS().exhibits.exhibit_preview.get.endpoint)
    .get(TOKEN.verify, CONTROLLER.build_exhibit_preview);

    app.route(ENDPOINTS().exhibits.reorder_exhibits_records.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.reorder_exhibit_items);

    app.route(ENDPOINTS().exhibits.exhibit_publish.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.publish_exhibit);

    app.route(ENDPOINTS().exhibits.exhibit_suppress.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.suppress_exhibit);

    app.route(ENDPOINTS().exhibits.exhibit_unlock_record.post.endpoint)
        .post(TOKEN.verify, CONTROLLER.unlock_exhibit_record);

    app.route(ENDPOINTS().exhibits.token_verify.endpoint)
    .post(TOKEN.verify, CONTROLLER.verify);
};
