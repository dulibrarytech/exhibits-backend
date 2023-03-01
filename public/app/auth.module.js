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

    const api = configModule.getApi();
    const init_endpoints = endpointsModule.init();
    let obj = {};

    /**
     * Gets token from session storage
     * @returns {*|Color}
     */
    obj.getUserToken = function () {

        let data = JSON.parse(window.sessionStorage.getItem('repo_token'));

        if (data !== null && data.token === null) {

            setTimeout(function () {
                window.location.replace('/login');
            }, 0);

        } else if (data === null) {
            window.location.replace('/login');
        } else {
            return DOMPurify.sanitize(data.token);
        }
    };

    /**
     * Gets user profile data after authentication
     */
    obj.getAuthUserData = function () {

        let id = helperModule.getParameterByName('id');
        authModule.saveToken();

        if (id !== null) {

            let token = authModule.getUserToken();
            let url = api + init_endpoints.authenticate + '?id=' + id,
                request = new Request(url, {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

            const callback = function (response) {

                if (response.status === 200) {

                    response.json().then(function (data) {
                        console.log(data);
                        authModule.saveUserAuthData(data);
                        userModule.renderUserName();
                    });

                } else if (response.status === 401) {

                    helperModule.renderError('Error: (HTTP status ' + response.status + '). Your session has expired.  You will be redirected to the login page momentarily.');

                    setTimeout(function () {
                        window.location.replace('/login');
                    }, 3000);

                } else {
                    helperModule.renderError('Error: (HTTP status ' + response.status + '). Unable to retrieve user profile.');
                    window.location.replace('/login');
                }
            };

            httpModule.req(request, callback);

        } else {
            userModule.renderUserName();
        }
    };


    /** TODO: reference in logout ejs template
     * Destroys session data and redirects user to login
     */
    obj.sessionExpired = function () {
        obj.reset();
        window.sessionStorage.removeItem('repo_user');
        setTimeout(function () {
            window.location.replace('/login');
        }, 500);
    };

    /**
     * Checks if user data is in session storage
     * @returns {boolean}
     */
    obj.checkUserAuthData = function () {
        let data = window.sessionStorage.getItem('repo_user');

        if (data !== null) {
            return true;
        }

        return false;
    };

    /**
     * Saves user profile data to session storage
     * @param data
     */
    obj.saveUserAuthData = function (data) {

        let user = {
            uid: DOMPurify.sanitize(data.user_data.data[0].id),
            name: DOMPurify.sanitize(data.user_data.data[0].first_name) + ' ' + DOMPurify.sanitize(data.user_data.data[0].last_name)
        };

        endpointsModule.save_repo_endpoints(data);
        window.sessionStorage.setItem('repo_user', JSON.stringify(user));

        /*
        window.localStorage.setItem('repo_endpoints_users', JSON.stringify(data.endpoints.users));
        window.localStorage.setItem('repo_endpoints_stats', JSON.stringify(data.endpoints.stats));
        window.localStorage.setItem('repo_endpoints_repository', JSON.stringify(data.endpoints.repository));
        window.localStorage.setItem('repo_endpoints_search', JSON.stringify(data.endpoints.search));
        window.localStorage.setItem('repo_endpoints_qa', JSON.stringify(data.endpoints.qa));
         */

    };

    /**
     * Gets session token from URL params
     */
    obj.saveToken = function () {

        let token = helperModule.getParameterByName('t');

        if (token !== null) {

            let data = {
                token: DOMPurify.sanitize(token)
            };

            window.sessionStorage.setItem('repo_token', JSON.stringify(data));
        }
    };

    /**
     * Clears out session storage - used when user logs out
     */
    obj.reset = function () {
        window.sessionStorage.clear();
    };

    obj.init = function () {};

    return obj;

}());

authModule.init();