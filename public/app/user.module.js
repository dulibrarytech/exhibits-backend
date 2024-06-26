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

const userModule = (function () {

    'use strict';

    const api = configModule.getApi();
    const endpoints = endpointsModule.get_users_endpoints();
    const users_table = '#users-data-table';
    let obj = {};

    /**
     * Renders user profile data
     * @param data
     */
    function render_users(data) {

        let users = '';
        let user;

        users += `<thead>
        <tr>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Email</th>
            <th>Active</th>
            <th>Edit</th>
        </tr>
        </thead>`;

        users += '<tbody>';

        for (let i = 0; i < data.length; i++) {

            user = data[i];

            users += '<tr>';
            users += '<td>' + DOMPurify.sanitize(user.first_name) + '</td>';
            users += '<td>' + DOMPurify.sanitize(user.last_name) + '</td>';
            users += '<td>' + DOMPurify.sanitize(user.email) + '</td>';

            if (user.is_active === 1) {
                users += '<td>Active</td>';
            } else if (user.is_active === 0) {
                users += '<td>Inactive</td>';
            }

            users += '<td>';
            users += '&nbsp;';
            users += '<a class="btn btn-xs btn-default" href="/exhibits-dashboard/edit-user?id=' + DOMPurify.sanitize(user.id) + '" title="Edit User"><i class="fa fa-edit"></i></a>&nbsp;&nbsp;&nbsp;&nbsp;';
            users += '</td>';
            users += '</tr>';
        }

        users += '</tbody>';

        domModule.html(users_table, users);

        $(users_table).DataTable({
            responsive: true,
            order: [[2, 'asc']]
        });

        return false;
    }

    /**
     * Renders user profile data for edit form
     * @param data
     */
    function render_user_details(data) {

        let user;

        for (let i = 0; i < data.length; i++) {

            user = data[i];

            domModule.val('#id', user.id);
            domModule.val('#username', user.du_id);
            domModule.val('#email', user.email);
            domModule.val('#first_name', user.first_name);
            domModule.val('#last_name', user.last_name);

            if (user.is_active === 1) {
                $('#is_active').prop('checked', true);
            } else {
                $('#is_active').prop('checked', false);
            }
        }

        return false;
    }

    /**
     * Gets all users
     */
    obj.get_users = function() {

        (async () => {

            let response = await httpModule.req({
                method: 'GET',
                url: api + endpoints.users.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': authModule.get_user_token()
                }
            });

            if (response.status === 200) {
                render_users(response.data);
            } else if (response.status === 401) {
                window.location.replace('/exhibits-dashboard/login');
            } else {
                window.location.replace('/exhibits-dashboard/error?e=' + DOMPurify.sanitize(response.status));
            }

        })();
    };

    /**
     * Retrieves user profile data for edit form
     */
    obj.getUserDetails = function() {

        (async () => {

            let id = helperModule.getParameterByName('id');
            let response = await httpModule.req({
                method: 'GET',
                url: api + endpoints.users.endpoint + '?id=' + id,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': authModule.getUserToken()
                }
            });

            if (response.status === 200) {
                renderUserDetails(response.data);
            } else if (response.status === 401) {
                window.location.replace('/exhbits-dashboard/login');
            } else {
                window.location.replace('/exhbits-dashboard/error?e=' + DOMPurify.sanitize(response.status));
            }

        })();
    };

    /**
     * Checks if user data is in session storage
     * @returns {boolean}
     */
    obj.check_user_data = function() {

        let data = window.sessionStorage.getItem('exhibits_user');

        if (data !== null) {
            return true;
        }

        return false;
    };

    /**
     * Validate user form fields
     * @param div_id
     * @param value
     * @return {boolean/string}
     */
    function validate(div_id, value) {
        if (value.length === 0) {
            domModule.html(`#${div_id}_error`, '<span style="color: red"><i class="fa fa-exclamation-circle"></i> Please enter a value</span>')
            return false;
        } else {
            domModule.html(`#${div_id}_error`, '');
            return value;
        }
    };

    /**
     * Retrieves user form data
     * @returns {object}
     */
    function get_user_form_data() {
        return {
            du_id: validate('username', domModule.val('#username', null)),
            email: validate('email', domModule.val('#email', null)),
            first_name: validate('first_name', domModule.val('#first_name', null)),
            last_name: validate('last_name', domModule.val('#last_name', null))
        };
    }

    /**
     * Adds new user
     */
    obj.add_user = function(event) {

        event.preventDefault();

        (async () => {

            let user = get_user_form_data();

            for (let prop in user) {
                if (user[prop] === false) {
                    return false;
                }
            }

            domModule.hide('#user-form');
            domModule.html('#message', '<div class="alert alert-info">Adding User...</div>');

            let response = await httpModule.req({
                method: 'POST',
                url: api + endpoints.users.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': authModule.getUserToken()
                },
                data: JSON.stringify(user),
            });

            if (response.status === 201) {
                domModule.html('#message', '<div class="alert alert-success">User added.</div>');

                setTimeout(() => {
                    window.location.replace('/exhibits-dashboard/users');
                }, 3000);

            } else if (response.status === 401) {
                window.location.replace('/exhibits-dashboard/login');
            } else if (response.status === 400) {
                console.log(response);
            } else {
                window.location.replace('/exhibits-dashboard/error?e=' + DOMPurify.sanitize(response.status));
            }

        })();

        return false;
    };

    /**
     * Updates user data
     */
    obj.update_user = function(event) {

        event.preventDefault();

        (async () => {

            let user = get_user_form_data();
            user.id = helperModule.get_parameter_by_name('id');

            if ($('#is_active').prop('checked')) {
                user.is_active = 1;
            } else {
                user.is_active = 0;
            }

            for (let prop in user) {
                if (user[prop] === false) {
                    return false;
                }
            }

            domModule.hide('#user-form');
            domModule.html('#message', '<div class="alert alert-info">Updating User...</div>');

            let response = await httpModule.req({
                method: 'PUT',
                url: api + endpoints.users.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': authModule.get_user_token()
                },
                data: JSON.stringify(user),
            });

            if (response.status === 201) {

                domModule.html('#message', '<div class="alert alert-success">User updated.</div>');

                setTimeout(() => {
                    window.location.replace('/exhibits-dashboard/users');
                }, 3000);

            } else if (response.status === 401) {
                window.location.replace('/exhibits-dashboard/login');
            } else {
                window.location.replace('/exhibits-dashboard/error?e=' + DOMPurify.sanitize(response.status));
            }

        })();
    };

    /** TODO:
     * Deletes user data
     */
    obj.delete_user = function() {

        // const endpoints = endpointsModule.endpoints();
        let id = helperModule.get_parameter_by_name('id');
        domModule.hide('#user-delete-form');
        domModule.html('#message', '<div class="alert alert-info">Deleting User...</div>');

        let token = authModule.get_user_token();
        let url = api + endpoints.users.endpoint + '?id=' + id,
            request = new Request(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                mode: 'cors'
            });

        const callback = function (response) {

            if (response.status === 204) {

                domModule.html('#message', '<div class="alert alert-success">User deleted</div>');
                setTimeout(function () {
                    domModule.html('#message', null);
                    window.location.replace('/exhibits-dashboard/users');
                }, 3000);

                return false;

            } else if (response.status === 401) {

                response.json().then(function (response) {

                    helperModule.renderError('Error: (HTTP status ' + response.status + '). Your session has expired.  You will be redirected to the login page momentarily.');

                    setTimeout(function () {
                        window.location.replace('/login');
                    }, 3000);
                });

            } else {
                helperModule.renderError('Error: (HTTP status ' + response.status + ').  Unable to delete user.');
            }
        };

        httpModule.req(request, callback);
    };

    obj.init = function () {};

    return obj;

}());
