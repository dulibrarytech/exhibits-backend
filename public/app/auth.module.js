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

    // const api = configModule.getApi();
    const init_endpoints = endpointsModule.init();
    let obj = {};

    /**
     * Gets token from session storage
     * @returns token
     */
    obj.get_user_token = () => {

        let data = JSON.parse(window.sessionStorage.getItem('exhibits_token'));

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
    obj.get_auth_user_data = () => {

        let id = helperModule.get_parameter_by_name('id');
        authModule.save_token();

        if (id !== null) {

            (async () => {

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

                }

                /*
                else if (response.status === 401) {

                    helperModule.render_error('Error: (HTTP status ' + response.status + '). Your session has expired.  You will be redirected to the login page momentarily.');

                    setTimeout(function () {
                        window.location.replace('/login');
                    }, 3000);

                } else {
                    helperModule.render_error('Error: (HTTP status ' + response.status + '). Unable to retrieve user profile.');
                    window.location.replace('/login');
                }

                 */

            })();
        }
    };

    /**
     * Checks if user data is in session storage
     * @returns {boolean}
     */
    obj.check_user_auth_data = () => {
        let data = window.sessionStorage.getItem('exhibits_user');

        if (data !== null) {
            return true;
        }

        return false;
    };

    /**
     * Saves user profile data to session storage
     * @param data
     */
    obj.save_user_auth_data = (data) => {
        console.log('save_user_auth_data: ', data);
        let user = {
            uid: DOMPurify.sanitize(data.user_data.data[0].id),
            name: DOMPurify.sanitize(data.user_data.data[0].first_name) + ' ' + DOMPurify.sanitize(data.user_data.data[0].last_name)
        };

        endpointsModule.save_exhibits_endpoints(data);
        window.sessionStorage.setItem('exhibits_user', JSON.stringify(user));
    };

    /**
     * Gets session token from URL params
     */
    obj.save_token = () => {

        let token = helperModule.get_parameter_by_name('t');

        if (token !== null) {

            let data = {
                token: DOMPurify.sanitize(token)
            };

            window.sessionStorage.setItem('exhibits_token', JSON.stringify(data));
        }
    };

    obj.init = function () {};

    return obj;

}());
