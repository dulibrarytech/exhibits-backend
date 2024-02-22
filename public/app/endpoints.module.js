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

const endpointsModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-backend';
    let obj = {};

    obj.save_exhibits_endpoints = function(data) {
        window.localStorage.setItem('exhibits_endpoints_users', JSON.stringify(data.endpoints.users));
        window.localStorage.setItem('exhibits_endpoints', JSON.stringify(data.endpoints.exhibits));
        window.localStorage.setItem('exhibits_endpoints_indexer', JSON.stringify(data.endpoints.indexer));
    };

    obj.get_users_endpoints = function() {
        return JSON.parse(window.localStorage.getItem('exhibits_endpoints_users'));
    };

    obj.get_indexer_endpoints = function() {
        return JSON.parse(window.localStorage.getItem('exhibits_endpoints_indexer'));
    };

    obj.get_exhibits_endpoints = function() {
        return JSON.parse(window.localStorage.getItem('exhibits_endpoints'));
    };

    obj.init = function() {
        return {
            authenticate: APP_PATH + '/api/v1/authenticate'
        }
    };

    return obj;

}());