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

const CONTROLLER = require('../indexer/controller');
const ENDPOINTS = require('../indexer/endpoints');
const TOKEN = require('../libs/tokens');

module.exports = function (app) {

    app.route(ENDPOINTS().indexer.index_utils.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.create_index);

    app.route(ENDPOINTS().indexer.index_records.endpoints.post.endpoint)
    .post(TOKEN.verify, CONTROLLER.index_exhibit);

    app.route(ENDPOINTS().indexer.index_records.endpoints.get.endpoint)
    .get(TOKEN.verify, CONTROLLER.get_indexed_record);

    app.route(ENDPOINTS().indexer.index_records.endpoints.delete.endpoint)
    .delete(TOKEN.verify, CONTROLLER.delete_record);
};
