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

const HELPER = require('../libs/helper');
const APP_CONFIG = {
    host: process.env.HOST,
    app_name: process.env.APP_NAME,
    app_version: process.env.APP_VERSION,
    organization: process.env.ORGANIZATION,
    app_host: process.env.APP_HOST,
    app_port: process.env.APP_PORT,
    api_url: process.env.API_URL,
    build_version: process.env.BUILD_VERSION
};

module.exports = function () {
    const HELPER_TASK = new HELPER();
    return HELPER_TASK.check_config(APP_CONFIG);
};
