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

const CONTROLLER = require('../users/controller');
const ENDPOINTS = require('../users/endpoints');
const TOKEN = require('../libs/tokens');

module.exports = function (app) {

    app.route(ENDPOINTS().users.endpoint)
        .get(TOKEN.verify, CONTROLLER.get_users)
        .post(TOKEN.verify, CONTROLLER.save_user)

    app.route(ENDPOINTS().users.update_user.put.endpoint)
        .put(TOKEN.verify, CONTROLLER.update_user);

    app.route(ENDPOINTS().users.delete_user.delete.endpoint)
        .delete(TOKEN.verify, CONTROLLER.delete_user);

    app.route(ENDPOINTS().users.get_user.endpoint)
        .get(TOKEN.verify, CONTROLLER.get_user);

    app.route(ENDPOINTS().users.user_status.endpoint)
        .put(TOKEN.verify, CONTROLLER.update_status);
};