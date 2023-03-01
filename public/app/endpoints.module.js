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

    let obj = {};

    obj.save_exhibits_endpoints = (data) => {
        window.localStorage.setItem('exhibits_endpoints_users', JSON.stringify(data.endpoints.users));
        window.localStorage.setItem('exhibits_endpoints_repository', JSON.stringify(data.endpoints.exhibits));
    };

    obj.get_users_endpoints = () => {
        const exhibits_endpoints_users = window.localStorage.getItem('exhibits_endpoints_users');
        return JSON.parse(exhibits_endpoints_users);
    };

    obj.get_exhibits_endpoints = () => {
        const exhibits_endpoints_repository = window.localStorage.getItem('exhibits_endpoints_repository');
        return JSON.parse(exhibits_endpoints_repository);
    };

    obj.init = function () {};

    return obj;

}());