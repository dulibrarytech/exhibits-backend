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

const APP_PATH = '/exhibits-backend';
const PREFIX = '/api/';
const VERSION = 'v1';
const ENDPOINT = '/authenticate/';
const ENDPOINTS = {
    auth: {
        sso: {
            endpoint: APP_PATH + '/sso',
            description: 'Accepts DU authproxy payload after SSO authentication has occurred',
            post: {
                description: 'Authenticates admin user',
                body: 'sso payload - employeeID, HTTP_HOST'
            }
        },
        authentication: {
            endpoint: `${PREFIX}${VERSION}${ENDPOINT}`,
            description: 'Authenticates application admin users',
            get: {
                description: 'Authenticates admin user',
                params: 'token or api_key',
                body: 'username, password'
            }
        }
    }
};

module.exports = function() {
    return ENDPOINTS;
};
