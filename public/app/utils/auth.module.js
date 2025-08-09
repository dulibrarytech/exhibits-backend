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

const authModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const init_endpoints = endpointsModule.init();
    let obj = {};

    obj.get_user_token = function () {

        let data = JSON.parse(window.sessionStorage.getItem('exhibits_token'));

        if (data !== null && data.token === null) {
            window.location.replace(APP_PATH + '/');
        } else if (data === null) {
            return false;
        } else {
            return DOMPurify.sanitize(data.token);
        }
    };

    obj.get_auth_user_data = async function () {

        let id = helperModule.get_parameter_by_name('id');

        if (id !== null) {

            authModule.save_token();
            let token = authModule.get_user_token();
            let url = init_endpoints.authenticate + '?id=' + id;
            let response = await httpModule.req({
                method: 'GET',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response.status === 200) {
                authModule.save_user_auth_data(response.data);
                return true;
            } else {
                authModule.redirect_to_auth();
            }
        }
    };

    obj.get_user_profile_data = function () {

        let profile = window.sessionStorage.getItem('exhibits_user');

        if (profile !== null) {
            return JSON.parse(profile);
        } else {
            authModule.redirect_to_auth();
        }
    };

    obj.check_user_auth_data = function () {

        let data = window.sessionStorage.getItem('exhibits_user');

        if (data !== null) {
            return true;
        }

        return false;
    };

    obj.save_user_auth_data = function (data) {

        let user = {
            uid: DOMPurify.sanitize(data.user_data.data[0].id),
            name: DOMPurify.sanitize(data.user_data.data[0].first_name) + ' ' + DOMPurify.sanitize(data.user_data.data[0].last_name)
        };

        endpointsModule.save_exhibits_endpoints(data);
        window.sessionStorage.setItem('exhibits_user', JSON.stringify(user));
    };

    obj.save_token = function () {

        let token = helperModule.get_parameter_by_name('t');

        if (token !== null) {

            let data = {
                token: DOMPurify.sanitize(token)
            };

            window.sessionStorage.setItem('exhibits_token', JSON.stringify(data));
        }
    };

    obj.check_auth = async function (token) {

        try {

            if (token === false) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Session Expired. One moment please...</div>`;
                authModule.redirect_to_auth();
                return false;
            }

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.token_verify.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response === undefined) {
                window.location.replace(APP_PATH + '/session');
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.check_permissions = async function (permissions, record_type, uuid, redirect) {

        try {

            const token = authModule.get_user_token();

            if (token === false) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Session Expired. One moment please...</div>`;
                authModule.redirect_to_auth();
                return false;
            }

            let data = {
                permissions: permissions,
                record_type: record_type,
                uuid: uuid
            };

            const EXHIBITS_ENDPOINTS = '/exhibits-dashboard/auth/permissions';
            const response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                data: data
            });

            if (response === undefined && redirect === undefined) {
                window.location.replace(APP_PATH + '/access-denied');
            } else if (response === undefined && redirect !== undefined) {
                window.location.replace(APP_PATH + redirect);
            } else if (response !== undefined && response.status === 200) {
                console.log('Authorized');
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.redirect_to_auth = function () {
        setTimeout(() => {
            window.location.replace(APP_PATH + '/auth');
        }, 4000);
    };

    obj.clear = function () {
        window.sessionStorage.clear();
        window.localStorage.clear();
    };

    obj.logout = function () {
        window.location.replace(APP_PATH + '/logout');
    };

    obj.init = function () {};

    return obj;

}());
