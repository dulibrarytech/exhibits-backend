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

const CONTROLLER = require('../exhibits/share_controller');
const ENDPOINTS = require('../exhibits/endpoints');
const TOKEN = require('../libs/tokens');

module.exports = function (app) {
    app.route(ENDPOINTS().exhibits.exhibit_shared.get.endpoint)
    .get(TOKEN.verify_shared, CONTROLLER.share_exhibit_preview);

    app.route(ENDPOINTS().exhibits.exhibit_shared.get.endpoint)
    .post(TOKEN.verify, CONTROLLER.create_shared_exhibit_preview_url);
};
