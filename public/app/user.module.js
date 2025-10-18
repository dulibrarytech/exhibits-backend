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
    // TODO
    const MESSAGE_SELECTOR = '#message';
    const DELETE_MESSAGE_SELECTOR = '#delete-message';
    const FORM_SELECTORS = {
        first_name: '#first-name-input',
        last_name: '#last-name-input',
        email: '#email-input',
        du_id: '#du-id-input',
        user_roles: '#user-roles'
    };

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

            if (response !== undefined && response.status === 200) {
                return response.data;
            } else if (response === undefined) {
                return false;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function get_user_record() {

        try {

            const user_id = helperModule.get_parameter_by_name('user_id');

            if (user_id === null) {
                return false;
            }

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
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function get_user_role(user_id) {

        try {

            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: '/exhibits-dashboard/auth/role?user_id=' + user_id,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response.status === 200) {
                return response.data[0];
            }

        } catch (error) {
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.display_user_records = async function () {

        // Configuration constants
        const CONFIG = {
            message_selector: '#message',
            user_data_selector: '#user-data',
            add_user_selector: '#add-user',
            card_selector: '.card',
            user_table_selector: '#users',
            app_path: APP_PATH,
        };

        // User status configuration
        const STATUS_CONFIG = {
            active: {
                value: 1,
                icon: 'fa-user',
                color: 'green',
                label: 'Active',
                title: 'active',
                class_name: 'inactive-user'
            },
            inactive: {
                value: 0,
                icon: 'fa-user',
                color: 'darkred',
                label: 'Inactive',
                title: 'inactive',
                class_name: 'active-user'
            }
        };

        // Cache DOM elements
        const cache = new Map();

        /**
         * Get or cache DOM element
         */
        function get_element(selector) {
            if (!cache.has(selector)) {
                cache.set(selector, document.querySelector(selector));
            }
            return cache.get(selector);
        }

        /**
         * Clear element cache
         */
        function clear_cache() {
            cache.clear();
        }

        /**
         * Display message to user
         */
        function show_message(message_text, type = 'danger') {
            const message_el = get_element(CONFIG.message_selector);
            if (!message_el) return;

            const icon = type === 'danger' ? 'exclamation' : 'info';
            message_el.innerHTML = `
            <div class="alert alert-${type}" role="alert">
                <i class="fa fa-${icon}"></i> ${message_text}
            </div>
        `;
        }

        /**
         * Get current user from session storage
         */
        function get_current_user() {
            try {
                const user_data = sessionStorage.getItem('exhibits_user');
                if (!user_data) {
                    show_message('Unable to get your user id', 'danger');
                    return null;
                }
                return JSON.parse(user_data);
            } catch (error) {
                console.error('Failed to parse user data:', error);
                show_message('Unable to parse user data', 'danger');
                return null;
            }
        }

        /**
         * Check if current user is admin
         */
        function is_current_user_admin(current_user, users) {
            return current_user && users.some(user =>
                parseInt(current_user.uid) === user.id && user.role === 'Administrator'
            );
        }

        /**
         * Generate status HTML based on user state
         */
        function generate_status_html(user, is_current_user, is_admin) {

            const status = STATUS_CONFIG[user.is_active === 1 ? 'active' : 'inactive'];

            if (is_current_user) {
                // Current user cannot change their own status
                return `
                <span id="${status.title}" title="${status.title}">
                    <i class="fa ${status.icon}" style="color: ${status.color}"></i>
                    <br>${status.label}
                </span>
            `;
            }

            if (is_admin && user.is_active === 1) {
                // Admin can deactivate active users
                return `
                <a href="#" id="${user.id}" class="inactive-user" role="button" aria-label="Deactivate user">
                    <span id="${status.title}" title="${status.title}">
                        <i class="fa ${status.icon}" style="color: ${status.color}"></i>
                        <br>${status.label}
                    </span>
                </a>
            `;
            }

            if (is_admin && user.is_active === 0) {
                // Admin can activate inactive users
                return `
                <a href="#" id="${user.id}" class="active-user" role="button" aria-label="Activate user">
                    <span id="${status.title}" title="${status.title}">
                        <i class="fa ${status.icon}" style="color: ${status.color}"></i>
                        <br>${status.label}
                    </span>
                </a>
            `;
            }

            // Non-admin: view only
            return `
            <span id="${status.title}" title="${status.title}">
                <i class="fa ${status.icon}" style="color: ${status.color}"></i>
                <br>${status.label}
            </span>
        `;
        }

        /**
         * Generate action buttons HTML
         */
        function generate_actions_html(user, is_current_user, is_admin) {

            const can_edit = is_admin && user.is_active === 0;
            const can_delete = is_admin && user.is_active === 0;

            const edit_button = can_edit
                ? `<a href="${CONFIG.app_path}/users/edit?user_id=${user.id}" title="Edit" aria-label="edit-user"><i class="fa fa-edit pr-1"></i></a>`
                : '<i title="Can only edit if inactive" style="color: #d3d3d3" class="fa fa-edit pr-1" aria-disabled="true"></i>';

            const delete_button = can_delete
                ? `<a href="${CONFIG.app_path}/users/delete?user_id=${user.id}" title="Delete" aria-label="delete-user"><i class="fa fa-trash pr-1"></i></a>`
                : '<i title="Can only delete if inactive" style="color: #d3d3d3" class="fa fa-trash pr-1" aria-disabled="true"></i>';

            return `${edit_button}&nbsp;${delete_button}`;
        }

        /**
         * Generate single user row HTML
         */
        function generate_user_row(user, current_user, is_admin) {

            const is_current_user = current_user && parseInt(current_user.uid) === user.id;
            const status_html = generate_status_html(user, is_current_user, is_admin);
            const actions_html = generate_actions_html(user, is_current_user, is_admin);

            return `
            <tr style="height: 10%">
                <td style="width: 35%; padding-left: 7%">
                    <small>${user.first_name} ${user.last_name}</small>
                </td>
                <td style="width: 15%; text-align: center">
                    <small>${user.role}</small>
                </td>
                <td style="width: 5%; text-align: center">
                    <small>${status_html}</small>
                </td>
                <td id="${user.id}-user-actions" style="width: 10%">
                    <div class="card-text text-sm-center">${actions_html}</div>
                </td>
            </tr>
        `;
        }

        /**
         * Initialize DataTable with event delegation
         */
        function initialize_data_table() {
            const table_el = get_element(CONFIG.user_table_selector);
            if (!table_el) {
                console.warn('User table element not found');
                return null;
            }

            // Initialize DataTable if library is available
            if (typeof DataTable === 'undefined') {
                console.warn('DataTable library not loaded');
                return null;
            }

            const data_table = new DataTable(table_el, {
                paging: true,
                order: [[0, 'asc']]
            });

            // Attach event listeners using DataTable's event delegation
            data_table.on('click', 'tbody tr .inactive-user', async (event) => {
                event.preventDefault();
                const user_id = event.currentTarget.getAttribute('id');
                if (user_id && typeof deactivate_user === 'function') {
                    await deactivate_user(user_id);
                }
            });

            data_table.on('click', 'tbody tr .active-user', async (event) => {
                event.preventDefault();
                const user_id = event.currentTarget.getAttribute('id');
                if (user_id && typeof activate_user === 'function') {
                    await activate_user(user_id);
                }
            });

            return data_table;
        }

        /**
         * Main display function
         */
        async function display_user_records() {
            try {

                clear_cache();

                // Fetch user records
                const users = await get_user_records();

                // Handle empty or unauthorized response
                if (!users || users === false) {
                    get_element(CONFIG.add_user_selector).style.display = 'none';
                    show_message('You do not have permission to view users.', 'danger');
                    return false;
                }

                if (!Array.isArray(users) || users.length === 0) {
                    get_element(CONFIG.card_selector).innerHTML = '';
                    show_message('No User Profiles found.', 'info');
                    return false;
                }

                // Get current user
                const current_user = get_current_user();
                if (!current_user) return false;

                // Check if current user is admin
                const is_admin = is_current_user_admin(current_user, users);

                // Generate all user rows at once (more efficient than concatenation)
                const user_rows = users.map(user => generate_user_row(user, current_user, is_admin)).join('');

                // Update DOM once
                const user_data_el = get_element(CONFIG.user_data_selector);
                if (user_data_el) {
                    user_data_el.innerHTML = user_rows;
                }

                // Initialize data table
                initialize_data_table();

                // Show form if helper module exists
                if (typeof helperModule !== 'undefined' && helperModule.show_form) {
                    helperModule.show_form();
                }

                return true;

            } catch (error) {
                console.error('Error displaying user records:', error);
                show_message(error.message || 'An error occurred while loading users', 'danger');
                return false;
            }
        }

        await display_user_records();
    };

    obj.display_user_records__ = async function () {

        try {

            const users = await get_user_records();

            if (users === false) {
                document.querySelector('#add-user').style.display = 'none';
                document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to view users.</div>`;
                return false;
            }

            let user_data = '';

            if (users === false) {
                document.querySelector('#user-card').innerHTML = '';
                return false;
            }

            if (users.length === 0) {
                document.querySelector('.card').innerHTML = '';
                document.querySelector(MESSAGE_SELECTOR).innerHTML = '<div class="alert alert-info" role="alert"><span id="exhibit-title"></span> No User Profiles found.</div>';
                return false;
            }

            let access = false;

            for (let i = 0; i < users.length; i++) {

                const is_active = users[i].is_active;
                let status;
                let user_edit = '';
                let trash = '';
                const user = JSON.parse(window.sessionStorage.getItem('exhibits_user'));

                if (user === null) {
                    document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get your user id</div>`;
                    return false;
                }

                if (parseInt(user.uid) === users[i].id && users[i].role === 'Administrator') {
                    access = true;
                }

                if (is_active === 1) {

                    if (parseInt(user.uid) === users[i].id) {

                        status = `<span id="inactive" title="active"><i class="fa fa-user" style="color: green"></i><br>Active</span>`;
                        user_edit = `<a href="${APP_PATH}/users/edit?user_id=${users[i].id}" title="Edit"><i class="fa fa-edit pr-1"></i> </a>`;
                        trash = `<i title="Can only delete if inactive" style="color: #d3d3d3" class="fa fa-trash pr-1"></i>`;

                    } else {

                        if (access === true) {
                            status = `<a href="#" id="${users[i].id}" class="inactive-user"><span id="inactive" title="active"><i class="fa fa-user" style="color: green"></i><br>Active</span></a>`;
                        } else {
                            status = `<span id="inactive" title="active"><i class="fa fa-user" style="color: green"></i><br>Active</span>`;
                        }

                        user_edit = `<i title="Can only edit if inactive" style="color: #d3d3d3" class="fa fa-edit pr-1"></i>`;
                        trash = `<i title="Can only delete if inactive" style="color: #d3d3d3" class="fa fa-trash pr-1"></i>`;
                    }

                } else if (is_active === 0) {

                    if (access === true) {
                        status = `<a href="#" id="${users[i].id}" class="active-user"><span id="active" title="inactive"><i class="fa fa-user" style="color: darkred"></i><br>Inactive</span></a>`;
                        user_edit = `<a href="${APP_PATH}/users/edit?user_id=${users[i].id}" title="Edit"><i class="fa fa-edit pr-1"></i> </a>`;
                        trash = `<a href="${APP_PATH}/users/delete?user_id=${users[i].id}" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;
                    } else {
                        status = `<span id="active" title="inactive"><i class="fa fa-user" style="color: darkred"></i><br>Inactive</span>`;
                        user_edit = `<i title="Can only edit if inactive" style="color: #d3d3d3" class="fa fa-edit pr-1"></i>`;
                        trash = `<i title="Can only delete if inactive" style="color: #d3d3d3" class="fa fa-trash pr-1"></i>`;
                    }
                }
                // <p><i class="fa fa-user"></i>&nbsp;&nbsp;<strong>${users[i].first_name} ${users[i].last_name}</strong></p>
                user_data += '<tr style="height: 10%">';
                user_data += `<td style="width: 35%;padding-left: 7%">
                    <small>${users[i].first_name} ${users[i].last_name}</small>
                    </td>`;

                user_data += `<td style="width: 15%;text-align: center"><small>${users[i].role}</small></td>`;
                user_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
                user_data += `<td id="${users[i].id}-user-actions" style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${user_edit}
                                    &nbsp;
                                    ${trash}
                                </div>
                               </td>`;
                user_data += '</tr>';
            }

            document.querySelector('#user-data').innerHTML = user_data;

            const USER_LIST = new DataTable('#users', {
                paging: true,
                order: [
                    [0, 'asc']
                ]
            });

            USER_LIST.on('click', 'tbody tr .inactive-user', async (event) => {
                event.preventDefault();
                const user_id = event.currentTarget.getAttribute('id');
                await deactivate_user(user_id);
            });

            USER_LIST.on('click', 'tbody tr .active-user', async (event) => {
                event.preventDefault();
                const user_id = event.currentTarget.getAttribute('id');
                await activate_user(user_id);
            });

            // bind_activate_user_events();
            // bind_deactivate_user_events();
            helperModule.show_form();

            return false;

        } catch (error) {
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.display_user_record = async function () {

        // Configuration
        const CONFIG = {
            message_selector: '#message',
            selectors: {
                edit_form: '#user-form',
                view_only_form: '#user-form-view-only',
                save_btn: '#save-user-btn',
                first_name: '#first-name-input',
                last_name: '#last-name-input',
                email: '#email-input',
                du_id: '#du-id-input',
                user_roles: '#user-roles',
                first_name_disabled: '#first-name-disabled',
                last_name_disabled: '#last-name-disabled',
                email_disabled: '#email-disabled',
                du_id_disabled: '#du-id-disabled',
                role_disabled: '#role-disabled'
            }
        };

        // Cache for DOM elements
        const element_cache = new Map();

        /**
         * Get or cache DOM element
         */
        function get_element(selector) {
            if (!element_cache.has(selector)) {
                const element = document.querySelector(selector);
                if (!element) {
                    console.warn(`Element not found: ${selector}`);
                }
                element_cache.set(selector, element);
            }
            return element_cache.get(selector);
        }

        /**
         * Set element value safely
         */
        function set_element_value(selector, value) {
            const element = get_element(selector);
            if (element) {
                element.value = value || '';
            }
        }

        /**
         * Set element disabled state
         */
        function set_disabled(selector, disabled = true) {
            const element = get_element(selector);
            if (element) {
                if (disabled) {
                    element.setAttribute('disabled', '');
                } else {
                    element.removeAttribute('disabled');
                }
            }
        }

        /**
         * Set element visibility
         */
        function set_visible(selector, visible = true) {
            const element = get_element(selector);
            if (element) {
                element.style.display = visible ? 'block' : 'none';
            }
        }

        /**
         * Show error message
         */
        function show_error(message) {
            const message_el = get_element(CONFIG.message_selector);
            if (message_el) {
                message_el.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="fa fa-exclamation"></i> ${message}
                </div>
            `;
            }
        }

        /**
         * Clear element cache
         */
        function clear_cache() {
            element_cache.clear();
        }

        /**
         * Populate editable form with user data
         */
        function populate_editable_form(user, role) {
            set_element_value(CONFIG.selectors.first_name, user.first_name);
            set_element_value(CONFIG.selectors.last_name, user.last_name);
            set_element_value(CONFIG.selectors.email, user.email);
            set_element_value(CONFIG.selectors.du_id, user.du_id);

            // Keep form visible
            set_visible(CONFIG.selectors.edit_form, true);
            set_visible(CONFIG.selectors.view_only_form, false);
            set_visible(CONFIG.selectors.save_btn, true);
        }

        /**
         * Populate read-only form
         */
        function populate_read_only_form(user, role) {
            set_element_value(CONFIG.selectors.first_name_disabled, user.first_name);
            set_element_value(CONFIG.selectors.last_name_disabled, user.last_name);
            set_element_value(CONFIG.selectors.email_disabled, user.email);
            set_element_value(CONFIG.selectors.du_id_disabled, user.du_id);
            set_element_value(CONFIG.selectors.role_disabled, role.role);

            // Hide edit form, show view-only form
            set_visible(CONFIG.selectors.edit_form, false);
            set_visible(CONFIG.selectors.view_only_form, true);
            set_visible(CONFIG.selectors.save_btn, false);
        }

        /**
         * Determine user access level and return configuration
         */
        function determine_access_level(profile, user, role) {
            const is_admin = role.role === 'Administrator';
            const is_own_profile = parseInt(profile.uid) === parseInt(user.id);

            if (is_admin && is_own_profile) {
                return {can_edit: true, can_disable_fields: false, form_type: 'editable'};
            }

            if (is_admin && !is_own_profile) {
                return {can_edit: true, can_disable_fields: false, form_type: 'editable'};
            }

            if (!is_admin && is_own_profile) {
                return {can_edit: true, can_disable_fields: true, form_type: 'editable'};
            }

            // Non-admin viewing someone else's profile
            return {can_edit: false, can_disable_fields: false, form_type: 'view_only'};
        }

        /**
         * Configure form based on access level
         */
        function configure_form(access_config, user, role) {
            if (access_config.form_type === 'view_only') {
                populate_read_only_form(user, role);
            } else {
                populate_editable_form(user, role);

                // Disable specific fields for non-admin users editing their own profile
                if (access_config.can_disable_fields) {
                    set_disabled(CONFIG.selectors.du_id, true);
                    set_disabled(CONFIG.selectors.user_roles, true);
                } else {
                    set_disabled(CONFIG.selectors.du_id, false);
                    set_disabled(CONFIG.selectors.user_roles, false);
                }
            }
        }

        /**
         * Display and populate user record form
         */
        async function display_user_record() {
            try {

                clear_cache();

                // Fetch required data
                const profile = authModule.get_user_profile_data();
                if (!profile || !profile.uid) {
                    show_error('Unable to retrieve profile data');
                    return false;
                }

                const record = await get_user_record();
                if (!record || !Array.isArray(record) || record.length === 0) {
                    show_error('Unable to retrieve user record');
                    setTimeout(() => {
                        window.location.replace(`${APP_PATH}/users`)
                    }, 1000)
                    return false;
                }

                // Extract user (record is an array, get last element)
                const user = record[record.length - 1];
                if (!user) {
                    show_error('User record is empty');
                    return false;
                }

                // Fetch user role
                const role = await get_user_role(user.id);
                if (!role) {
                    show_error('Unable to retrieve user role');
                    return false;
                }

                // Populate roles dropdown
                if (typeof userModule !== 'undefined' && userModule.list_roles) {
                    await userModule.list_roles(role);
                }

                // Determine access level and configure form
                const access_config = determine_access_level(profile, user, role);
                configure_form(access_config, user, role);

                return true;

            } catch (error) {
                console.error('Error displaying user record:', error);
                show_error(error.message || 'An error occurred while loading the user record');
                return false;
            }
        }

        await display_user_record();
    };

    /**
     *  Used by delete page
     * @param user_id
     */
    obj.display_user = async function (user_id) {
        return await get_user_record(user_id);
    };

    function get_user_form_data() {

        try {

            const field_selectors = {
                first_name: '#first-name-input',
                last_name: '#last-name-input',
                email: '#email-input',
                du_id: '#du-id-input',
                role_id: '#user-roles'
            };

            const form_data = {};
            let is_valid = true;

            for (const [key, selector] of Object.entries(field_selectors)) {
                const element = document.querySelector(selector);
                if (!element) {
                    console.error(`Element not found: ${selector}`);
                    is_valid = false;
                    continue;
                }

                const value = element.value || '';
                const error_id = selector.replace('#', '');
                const validated_value = validate_field(error_id, value);

                if (!validated_value && validated_value !== 0) {
                    is_valid = false;
                } else {
                    form_data[key] = validated_value;
                }
            }

            return is_valid ? form_data : null;

        } catch (error) {
            console.error('Error retrieving form data:', error);
            return null;
        }
    }

    function validate_field(error_id, value) {
        const error_element = document.querySelector(`#${error_id}-error`);

        if (!value || value.trim().length === 0) {
            if (error_element) {
                error_element.innerHTML = '<span style="color: red"><i class="fa fa-exclamation-circle"></i> Please enter a value</span>';
            }
            return false;
        }

        if (error_element) {
            error_element.innerHTML = '';
        }

        return value.trim();
    }

    obj.update_user_record = async function (event) {

        try {

            window.scrollTo(0, 0);
            event.preventDefault();
            const user_id = helperModule.get_parameter_by_name('user_id');
            const data = get_user_form_data();
            const token = authModule.get_user_token();

            if (user_id === undefined) {
                document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get user ID</div>`;
                return false;
            }

            if (token === false) {
                setTimeout(() => {
                    document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            if (data === undefined) {
                document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === null) {
                return false;
            }

            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating user record...</div>`;

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

                document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> User record updated</div>`;

                setTimeout(() => {
                    window.location.reload();
                }, 900);
            }

            return false;

        } catch (error) {
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.save_user_record = async function (event) {

        try {

            window.scrollTo(0, 0);
            event.preventDefault();
            const data = get_user_form_data();
            const token = authModule.get_user_token();

            if (token === false) {
                setTimeout(() => {
                    document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            if (data === undefined) {
                document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === null) {
                return false;
            }

            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Saving user record...</div>`;

            const endpoint = USER_ENDPOINTS.users.endpoint;
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                const user_id = response.data[0];
                document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> User record saved</div>`;

                setTimeout(() => {
                    window.location.replace(`${APP_PATH}/users/edit?user_id=${user_id}`);
                }, 900);

            } else if (response.status === 200) {
                document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> User already exists</div>`;
            }

            return false;

        } catch (error) {
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Deletes user data
     */
    obj.delete_user = async function () {

        try {

            document.querySelector('#delete-message').innerHTML = 'Deleting user...';
            const user_id = helperModule.get_parameter_by_name('user_id');
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'DELETE',
                url: USER_ENDPOINTS.users.delete_user.delete.endpoint.replace(':user_id', user_id),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 204) {

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/users');
                }, 900);

            } else {
                document.querySelector('#exhibit-no-delete').innerHTML = `<i class="fa fa-exclamation"></i> ${response.data.message}`;
            }

        } catch (error) {
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

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

            let id_elem = document.getElementById(id);
            document.getElementById(id).classList.remove('active-user');
            document.getElementById(id).classList.add('inactive-user');
            document.getElementById(id).replaceWith(id_elem.cloneNode(true));
            document.getElementById(id).innerHTML = '<span id="suppress" title="published"><i class="fa fa-user" style="color: green"></i><br>Active</span>';
            document.getElementById(id).addEventListener('click', async () => {
                await deactivate_user(id);
            }, false);

            let actions_id = `${id}-user-actions`;
            let actions_elem = document.getElementById(actions_id);
            let user_edit = `<i title="Only administrators can view user details" style="color: #d3d3d3" class="fa fa-edit pr-1"></i>`;
            let trash = `<i title="Only administrators can delete users" style="color: #d3d3d3" class="fa fa-trash pr-1" aria-label="delete-user"></i>`;

            actions_elem.innerHTML = `
                        <div class="card-text text-sm-center">
                        ${user_edit}&nbsp;
                        ${trash}
                        </div>`;

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

            let id_elem = document.getElementById(id);
            document.getElementById(id).classList.remove('inactive-user');
            document.getElementById(id).classList.add('active-user');
            document.getElementById(id).replaceWith(id_elem.cloneNode(true));
            document.getElementById(id).innerHTML = '<span id="publish" title="suppressed"><i class="fa fa-user" style="color: darkred"></i><br>Inactive</span>';
            document.getElementById(id).addEventListener('click', async (event) => {
                await activate_user(id);
            }, false);

            let actions_id = `${id}-user-actions`;
            let actions_elem = document.getElementById(actions_id);
            let user_edit = `<a href="${APP_PATH}/users/edit?user_id=${id}" title="View user details" aria-label="user-details"><i class="fa fa-edit pr-1"></i></a>`;
            let trash = `<a href="${APP_PATH}/users/delete?user_id=${id}" title="Delete User" aria-label="delete-user"><i class="fa fa-trash pr-1"></i></a>`;

            actions_elem.innerHTML = `
                        <div class="card-text text-sm-center">
                        ${user_edit}&nbsp;
                        ${trash}
                        </div>`;

        }
    }


    obj.user_status_manager = async function (status, user_id) {

        // Status configuration
        const STATUS_CONFIG = {
            active: {
                is_active: 1,
                remove_class: 'active-user',
                add_class: 'inactive-user',
                icon: 'fa-user',
                color: 'green',
                label: 'Active',
                title: 'active',
                span_id: 'suppress',
                next_action: 'deactivate',
                show_edit_delete: false
            },
            inactive: {
                is_active: 0,
                remove_class: 'inactive-user',
                add_class: 'active-user',
                icon: 'fa-user',
                color: 'darkred',
                label: 'Inactive',
                title: 'inactive',
                span_id: 'publish',
                next_action: 'activate',
                show_edit_delete: true
            }
        };

        // Cache for DOM elements
        const element_cache = new Map();

        /**
         * Safe DOM element retrieval with caching and error handling
         */
        function get_element(element_id) {
            if (!element_cache.has(element_id)) {
                const element = document.getElementById(element_id);
                if (!element) {
                    console.warn(`Element with id "${element_id}" not found in DOM`);
                }
                element_cache.set(element_id, element);
            }
            return element_cache.get(element_id);
        }

        /**
         * Clear element cache
         */
        function clear_cache() {
            element_cache.clear();
        }

        /**
         * Make HTTP request to update user status
         */
        async function update_user_status_api(user_id, is_active) {
            try {
                const token = authModule.get_user_token();
                if (!token) {
                    throw new Error('Authentication token not available');
                }

                const endpoint = USER_ENDPOINTS.users.user_status.endpoint
                    .replace(':id', user_id)
                    .replace(':is_active', is_active);

                const response = await httpModule.req({
                    method: 'PUT',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                return response?.status === 200;
            } catch (error) {
                console.error(`Failed to update user ${user_id} status:`, error);
                return false;
            }
        }

        /**
         * Update status display element HTML
         */
        function update_status_display(element, config) {
            if (!element) return;

            element.innerHTML = `
            <span id="${config.span_id}" title="${config.title}">
                <i class="fa ${config.icon}" style="color: ${config.color}"></i>
                <br>${config.label}
            </span>
        `;
        }

        /**
         * Generate action buttons HTML based on status
         */
        function generate_action_buttons(user_id, show_edit_delete) {
            if (show_edit_delete) {
                // Inactive: show edit and delete links
                const app_path = APP_PATH;
                const edit_button = `<a href="${app_path}/users/edit?user_id=${user_id}" title="View user details" aria-label="user-details"><i class="fa fa-edit pr-1"></i></a>`;
                const delete_button = `<a href="${app_path}/users/delete?user_id=${user_id}" title="Delete User" aria-label="delete-user"><i class="fa fa-trash pr-1"></i></a>`;
                return `${edit_button}&nbsp;${delete_button}`;
            } else {
                // Active: show disabled buttons
                const edit_button = '<i title="Only administrators can view user details" style="color: #d3d3d3" class="fa fa-edit pr-1"></i>';
                const delete_button = '<i title="Only administrators can delete users" style="color: #d3d3d3" class="fa fa-trash pr-1" aria-label="delete-user"></i>';
                return `${edit_button}&nbsp;${delete_button}`;
            }
        }

        /**
         * Update action buttons
         */
        function update_action_buttons(user_id, show_edit_delete) {
            const actions_element = get_element(`${user_id}-user-actions`);
            if (!actions_element) return;

            const buttons_html = generate_action_buttons(user_id, show_edit_delete);
            actions_element.innerHTML = `<div class="card-text text-sm-center">${buttons_html}</div>`;
        }

        /**
         * Attach click handler to status element
         */
        function attach_status_click_handler(element, user_id, next_action) {
            if (!element) return;

            // Clone to remove all existing listeners
            const new_element = element.cloneNode(false);
            if (element.parentNode) {
                element.parentNode.replaceChild(new_element, element);
            }

            // Attach new listener
            new_element.addEventListener('click', async (event) => {
                event.preventDefault();
                if (next_action === 'deactivate') {
                    await deactivate_user(user_id);
                } else if (next_action === 'activate') {
                    await activate_user(user_id);
                }
            });

            // Update cache with new element
            element_cache.set(user_id, new_element);
        }

        /**
         * Core status update logic
         */
        async function update_user_state(user_id, target_status) {
            try {
                const config = STATUS_CONFIG[target_status];
                if (!config) {
                    throw new Error(`Invalid status: ${target_status}`);
                }

                // Call API
                const success = await update_user_status_api(user_id, config.is_active);
                if (!success) {
                    console.error(`Failed to ${target_status} user ${user_id}`);
                    return false;
                }

                // Get status element and update it
                let status_element = get_element(user_id);
                if (status_element) {
                    // Update classes
                    status_element.classList.remove(config.remove_class);
                    status_element.classList.add(config.add_class);

                    // Update HTML
                    update_status_display(status_element, config);

                    // Attach handler for next action
                    attach_status_click_handler(status_element, user_id, config.next_action);
                }

                // Update action buttons
                update_action_buttons(user_id, config.show_edit_delete);

                return true;

            } catch (error) {
                console.error(`Error updating user ${user_id} to ${target_status}:`, error);
                return false;
            }
        }

        /**
         * Activate user account
         */
        async function activate_user(user_id) {
            return update_user_state(user_id, 'active');
        }

        /**
         * Deactivate user account
         */
        async function deactivate_user(user_id) {
            return update_user_state(user_id, 'inactive');
        }

        if (status === 'activate') {
            await activate_user(user_id);
        } else if (status === 'deactivate') {
            await deactivate_user(user_id);
        }

        // Public API
        /*
        return {
            activate_user: activate_user,
            deactivate_user: deactivate_user,
            update_status: update_user_status_api,
            clear_cache: clear_cache
        };

         */
    };

    /*
    async function activate_user(id) {
        console.log(id);
        return user_status_manager.activate_user(id);
    }

    async function deactivate_user(id) {
        console.log(id);
        return user_status_manager.deactivate_user(id);
    }

     */

    obj.check_user_data = function () {

        let data = window.sessionStorage.getItem('exhibits_user');

        if (data !== null) {
            return true;
        }

        return false;
    };

    async function get_roles() {

        try {

            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: '/exhibits-dashboard/auth/roles', // TODO
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.list_roles = async function (role) {

        try {

            const roles = await get_roles();
            let select = '';
            select += '<option value="">Select From Menu</option>';
            select += '<option value="">----------</option>';

            for (let i = 0; i < roles.length; i++) {

                if (role !== undefined && role.role_id === roles[i].id) {
                    select += `<option value="${roles[i].id}" selected>${roles[i].role}</option>`;
                } else {
                    select += `<option value="${roles[i].id}">${roles[i].role}</option>`;
                }
            }

            document.querySelector('#user-roles').innerHTML = select;

        } catch (error) {
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.init = async function () {
        await userModule.list_roles();
    };

    return obj;

}());


/*

// TODO: deprecate
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

    // TODO: deprecate
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
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }


 */

/*
obj.display_user_record_ = async function () {

        try {

            const profile = authModule.get_user_profile_data();
            const record = await get_user_record();
            const role = await get_user_role(profile.uid);
            const user = record.pop();

            // user data
            if (role.role === 'Administrator' && parseInt(profile.uid) === parseInt(user.id)) {

                const role = await get_user_role(user.id);
                await userModule.list_roles(role);
                document.querySelector('#first-name-input').value = user.first_name;
                document.querySelector('#last-name-input').value = user.last_name;
                document.querySelector('#email-input').value = user.email;
                document.querySelector('#du-id-input').value = user.du_id;

            } else if (role.role === 'Administrator' && parseInt(profile.uid) !== parseInt(user.id)) {

                const role = await get_user_role(user.id);
                await userModule.list_roles(role);
                document.querySelector('#first-name-input').value = user.first_name;
                document.querySelector('#last-name-input').value = user.last_name;
                document.querySelector('#email-input').value = user.email;
                document.querySelector('#du-id-input').value = user.du_id;

            } else if (role.role !== 'Administrator' && parseInt(profile.uid) === parseInt(user.id)) {

                await userModule.list_roles(role);
                document.querySelector('#first-name-input').value = user.first_name;
                document.querySelector('#last-name-input').value = user.last_name;
                document.querySelector('#email-input').value = user.email;
                document.querySelector('#du-id-input').value = user.du_id;
                document.querySelector('#du-id-input').setAttribute('disabled', '');
                document.querySelector('#user-roles').setAttribute('disabled', '');

            } else {

                document.querySelector('#user-form').style.display = 'none';
                document.querySelector('#user-form-view-only').style.display = 'block'
                document.querySelector('#save-user-btn').style.display = 'none';
                document.querySelector('#first-name-disabled').value = user.first_name;
                document.querySelector('#last-name-disabled').value = user.last_name;
                document.querySelector('#email-disabled').value = user.email;
                document.querySelector('#du-id-disabled').value = user.du_id;
                document.querySelector('#role-disabled').value = role.role;
            }

            return false;

        } catch (error) {
            document.querySelector(MESSAGE_SELECTOR).innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };
 */

/*

     */

/*
    function validate(div_id, value) {

        if (value.length === 0) {
            document.querySelector('#' + div_id + '-error').innerHTML = '<span style="color: red"><i class="fa fa-exclamation-circle"></i> Please enter a value</span>';
            return false;
        } else {
            document.querySelector('#' + div_id + '-error').innerHTML = '';
            return value;
        }
    }
    */

// TODO: cache ids
/*
function get_user_form_data_() {

    return {
        first_name: validate('first-name-input', document.querySelector('#first-name-input').value),
        last_name: validate('last-name-input', document.querySelector('#last-name-input').value),
        email: validate('email-input', document.querySelector('#email-input').value),
        du_id: validate('du-id-input', document.querySelector('#du-id-input').value),
        role_id: validate('user-roles', document.querySelector('#user-roles').value)
    };
}
*/
