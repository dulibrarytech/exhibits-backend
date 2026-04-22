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

const APP_CONFIG = require('../config/app_config')();
const CONTROLLER = require('../auth/controller');
const ENDPOINTS = require('../auth/endpoints');
const TOKENS = require('../libs/tokens');
const APP_PATH = APP_CONFIG.app_path;

module.exports = function (app) {

    app.route(`${APP_PATH}/auth`)
        .get(CONTROLLER.get_auth_landing);

    app.route(`${APP_PATH}/auth/login`)
        .get(CONTROLLER.initiate_login);

    app.route(`${APP_PATH}/auth/sso`)
        .post(CONTROLLER.sso);

    app.route(`${APP_PATH}/auth/permissions`)
        .post(TOKENS.verify, CONTROLLER.check_permissions);

    app.route(`${APP_PATH}/auth/roles`)
        .get(TOKENS.verify, CONTROLLER.get_roles);

    app.route(`${APP_PATH}/auth/role`)
        .get(TOKENS.verify, CONTROLLER.get_user_role);

    app.route(`${APP_PATH}/auth/role/update`)
        .get(CONTROLLER.update_user_role);

    app.route(ENDPOINTS().auth.authentication.endpoint)
        .get(TOKENS.verify, CONTROLLER.get_auth_user_data);
};
