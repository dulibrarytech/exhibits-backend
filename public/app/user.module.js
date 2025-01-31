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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const USER_ENDPOINTS = endpointsModule.get_users_endpoints();
    let obj = {};

    async function get_user_records() {

        try {

            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: USER_ENDPOINTS.users.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function get_user_record() {

        try {

            const user_id = helperModule.get_parameter_by_name('user_id');
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: USER_ENDPOINTS.users.get_user.endpoint.replace(':user_id', user_id),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.display_user_records = async function () {

        try {

            const users = await get_user_records();
            let user_data = '';

            if (users === false) {
                document.querySelector('#user-card').innerHTML = '';
                return false;
            }

            if (users.length === 0) {
                document.querySelector('.card').innerHTML = '';
                document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert"><span id="exhibit-title"></span> No User Profiles found.</div>';
                return false;
            }

            for (let i = 0; i < users.length; i++) {

                const is_active = users[i].is_active;
                let status;
                let user_edit = '';
                let trash = '';
                const user = JSON.parse(window.sessionStorage.getItem('exhibits_user'));

                if (user === null) {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get your user id</div>`;
                    return false;
                }

                if (is_active === 1) {

                    if (parseInt(user.uid) === users[i].id) {
                        status = `<span id="inactive" title="active"><i class="fa fa-user" style="color: green"></i><br>Active</span>`;
                        user_edit = `<a href="${APP_PATH}/users/edit?user_id=${users[i].id}" title="Edit"><i class="fa fa-edit pr-1"></i> </a>`;
                        trash = `<i title="Can only delete if unpublished" style="color: #d3d3d3" class="fa fa-trash pr-1"></i>`;
                    } else {
                        status = `<a href="#" id="${users[i].id}" class="inactive-user"><span id="inactive" title="active"><i class="fa fa-user" style="color: green"></i><br>Active</span></a>`;
                        user_edit = `<i title="Can only edit if unpublished" style="color: #d3d3d3" class="fa fa-edit pr-1"></i>`;
                        trash = `<i title="Can only delete if unpublished" style="color: #d3d3d3" class="fa fa-trash pr-1"></i>`;
                    }

                } else if (is_active === 0) {
                    status = `<a href="#" id="${users[i].id}" class="active-user"><span id="active" title="inactive"><i class="fa fa-user" style="color: darkred"></i><br>Inactive</span></a>`;
                    user_edit = `<a href="${APP_PATH}/users/edit?user_id=${users[i].id}" title="Edit"><i class="fa fa-edit pr-1"></i> </a>`;
                    trash = `<a href="${APP_PATH}/users/delete?user_id=${users[i].id}" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;
                }

                user_data += '<tr>';
                user_data += `<td style="width: 35%;padding-left: 7%">
                    <p><i class="fa fa-user"></i>&nbsp;&nbsp;<strong>${users[i].first_name} ${users[i].last_name}</strong></p>
                    <p><i class="fa fa-envelope"></i>&nbsp;&nbsp;${users[i].email}</p>
                    </td>`;

                user_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
                user_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${user_edit}
                                    &nbsp;
                                    ${trash}
                                </div>
                               </td>`;
                user_data += '</tr>';
            }

            document.querySelector('#user-data').innerHTML = user_data;

            new DataTable('#users', {
                order: [
                    [0, 'asc']
                ]
            });

            bind_activate_user_events();
            bind_deactivate_user_events();
            helperModule.show_form();

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.display_user_record = async function () {

        try {

            const record = await get_user_record();
            const user = record.pop();
            console.log(user);
            // user data
            document.querySelector('#first-name-input').value = user.first_name;
            document.querySelector('#last-name-input').value = user.last_name;
            document.querySelector('#email-input').value = user.email;
            document.querySelector('#du-id-input').value = user.du_id;

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Checks if user data is in session storage
     * @returns {boolean}
     */
    obj.check_user_data = function () {

        let data = window.sessionStorage.getItem('exhibits_user');

        if (data !== null) {
            return true;
        }

        return false;
    };

    function validate(div_id, value) {

        if (value.length === 0) {
            document.querySelector('#' + div_id + '-error').innerHTML = '<span style="color: red"><i class="fa fa-exclamation-circle"></i> Please enter a value</span>';
            return false;
        } else {
            document.querySelector('#' + div_id + '-error').innerHTML = '';
            return value;
        }
    }

    function get_user_form_data() {
        return {
            first_name: validate('first-name-input', document.querySelector('#first-name-input').value),
            last_name: validate('last-name-input', document.querySelector('#last-name-input').value),
            email: validate('email-input', document.querySelector('#email-input').value),
            du_id: validate('du-id-input', document.querySelector('#du-id-input').value)
        };
    }

    obj.update_user_record = async function (event) {

        try {

            event.preventDefault();
            const user_id = helperModule.get_parameter_by_name('user_id');
            const data = get_user_form_data();
            const token = authModule.get_user_token();

            if (user_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get user ID</div>`;
                return false;
            }

            if (token === false) {
                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            if (data === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === false) {
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating user record...</div>`;

            const endpoint = USER_ENDPOINTS.users.update_user.put.endpoint.replace(':user_id', user_id);
            const response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> User record updated</div>`;

                setTimeout(() => {
                    window.location.reload();
                }, 900);
            }
            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.update_user = function (event) {

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

    /**
     * Adds new user
     */
    obj.add_user = function (event) {

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

    /** TODO:
     * Deletes user data
     */
    obj.delete_user = function () {

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

    function bind_activate_user_events() {

        try {

            const user_links = Array.from(document.getElementsByClassName('active-user'));

            user_links.forEach(user_link => {
                user_link.addEventListener('click', async (event) => {
                    const id = user_link.getAttribute('id');
                    await activate_user(id);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_deactivate_user_events() {

        try {

            const user_links = Array.from(document.getElementsByClassName('inactive-user'));

            user_links.forEach(user_link => {
                user_link.addEventListener('click', async () => {
                    const id = user_link.getAttribute('id');
                    await deactivate_user(id);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function activate_user(id) {

        const token = authModule.get_user_token();
        const response = await httpModule.req({
            method: 'PUT',
            url: USER_ENDPOINTS.users.user_status.endpoint.replace(':id', id).replace(':is_active', '1'),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });

        if (response.status === 200) {

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> User activated</div>`;

            setTimeout(() => {
                location.reload();
            }, 500);

            /*
            setTimeout(() => {
                let elem = document.getElementById(uuid);
                document.getElementById(uuid).classList.remove('publish-exhibit');
                document.getElementById(uuid).classList.add('suppress-exhibit');
                document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                document.getElementById(uuid).innerHTML = '<span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span>';
                document.getElementById(uuid).addEventListener('click', async () => {
                    const uuid = elem.getAttribute('id');
                    await suppress_exhibit(uuid);
                }, false);
            }, 0);

             */
        }
    }

    async function deactivate_user(id) {

        const token = authModule.get_user_token();
        const response = await httpModule.req({
            method: 'PUT',
            url: USER_ENDPOINTS.users.user_status.endpoint.replace(':id', id).replace(':is_active', '0'),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });

        if (response.status === 200) {

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> User deactivated</div>`;

            setTimeout(() => {
                location.reload();
            }, 500);

            /*
            setTimeout(() => {
                let elem = document.getElementById(uuid);
                document.getElementById(uuid).classList.remove('suppress-exhibit');
                document.getElementById(uuid).classList.add('publish-exhibit');
                document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                document.getElementById(uuid).innerHTML = '<span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span>';
                document.getElementById(uuid).addEventListener('click', async (event) => {
                    const uuid = elem.getAttribute('id');
                    await publish_exhibit(uuid);
                }, false);
            }, 0);

             */
        }
    }

    obj.init = function () {
    };

    return obj;

}());


/**
 * Renders user profile data for edit form
 * @param data
 */
/*
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

 */
