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
    const MESSAGE_SELECTOR = '#message';

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
        function determine_access_level(profile, user, profile_role) {

            const is_admin = profile_role.role === 'Administrator';
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

        async function process_user_record() {

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
                const role = await get_user_role(user.id); // for user edit record
                const profile_role = await get_user_role(profile.uid); // to determine if is_admin

                if (!role) {
                    show_error('Unable to retrieve user role');
                    return false;
                }

                if (!profile_role) {
                    show_error('Unable to retrieve profile role');
                    return false;
                }

                // Populate roles dropdown
                if (typeof userModule !== 'undefined' && userModule.list_roles) {
                    await userModule.list_roles(role);
                }

                // Determine access level and configure form
                const access_config = determine_access_level(profile, user, profile_role);
                configure_form(access_config, user, role);

                return true;

            } catch (error) {
                console.error('Error displaying user record:', error);
                show_error(error.message || 'An error occurred while loading the user record');
                return false;
            }
        }

        await process_user_record();
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

            // Prevent default form submission and scroll to top
            event?.preventDefault();
            window.scrollTo(0, 0);

            const show_message = (message, type = 'danger') => {
                const message_el = document.querySelector(MESSAGE_SELECTOR);
                if (message_el) {
                    message_el.innerHTML = `<div class="alert alert-${type}" role="alert"><i class="fa fa-${type === 'success' ? 'check' : type === 'info' ? 'info' : 'exclamation'}"></i> ${message}</div>`;
                }
            };

            // Validate required modules exist
            if (!authModule || !httpModule) {
                console.error('Required modules are not available');
                show_message('System configuration error.');
                return false;
            }

            // Get authentication token
            const token = authModule.get_user_token();

            if (!token || token === false) {
                show_message('Session expired. Redirecting to login...');
                setTimeout(() => {
                    authModule.logout();
                }, 1000);
                return false;
            }

            // Get form data
            const user_data = get_user_form_data();

            if (user_data === undefined) {
                show_message('Unable to retrieve form field values.');
                return false;
            }

            if (user_data === null || user_data === false) {
                // Form validation failed, error message already shown by get_user_form_data
                return false;
            }

            // Validate user data is an object
            if (typeof user_data !== 'object') {
                show_message('Invalid form data format.');
                return false;
            }

            // Show saving message
            show_message('Saving user record...', 'info');

            // Validate endpoint exists
            if (!USER_ENDPOINTS?.users?.endpoint) {
                console.error('User endpoint not configured');
                show_message('System configuration error.');
                return false;
            }

            const endpoint = USER_ENDPOINTS.users.endpoint;

            // Make API request to save user
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: user_data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 10000
            });

            // Validate response structure
            if (!response || typeof response !== 'object') {
                console.error('Invalid response from server');
                show_message('Server communication error.');
                return false;
            }

            // Handle successful user creation
            if (response.status === 201) {
                // Validate response contains user data
                if (!response.data || !response.data.user || !response.data.user.data.id) {
                    console.error('Invalid user data in response');
                    show_message('User saved but unable to retrieve user ID.');
                    return false;
                }

                const user_id = response.data.user.data.id;

                // Validate user ID
                if (!Number.isInteger(user_id) || user_id <= 0) {
                    console.error('Invalid user ID in response:', user_id);
                    show_message('User saved but invalid user ID received.');
                    return false;
                }

                show_message('User record saved successfully.', 'success');

                setTimeout(() => {
                    window.location.replace(`${APP_PATH}/users/edit?user_id=${user_id}`);
                }, 900);

                return true;
            }

            // Handle other success responses that indicate no save
            if (response.status === 200) { // 409
                const message = response.data?.message || 'User already exists.';
                show_message(message);
                return false;
            }

            // Handle authentication failures
            if (response.status === 401 || response.status === 403) {
                show_message('You do not have permission to create users.');
                setTimeout(() => {
                    authModule.logout();
                }, 2000);
                return false;
            }

            // Handle validation errors
            if (response.status === 400) {
                const message = response.data?.message || 'Invalid user data provided.';
                show_message(message);
                return false;
            }

            // Handle other HTTP errors
            console.error(`Unexpected response status: ${response.status}`);
            const error_message = response.data?.message || 'Failed to save user record.';
            show_message(error_message);
            return false;

        } catch (error) {
            console.error('Error in save_user_record:', error.message);

            const message_el = document.querySelector(MESSAGE_SELECTOR);
            if (message_el) {
                // Differentiate error types
                let error_message = 'An error occurred while saving user record.';

                if (error.message.includes('timeout')) {
                    error_message = 'Request timeout. Please try again.';
                } else if (error.message.includes('network')) {
                    error_message = 'Network error. Please check your connection.';
                } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
                    error_message = 'Session expired. Please log in again.';
                    setTimeout(() => {
                        authModule.logout();
                    }, 2000);
                }

                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error_message}</div>`;
            }

            return false;
        }
    };

    obj.delete_user = async function () {

        try {

            const show_message = (message, type = 'danger', selector = MESSAGE_SELECTOR) => {
                const message_el = document.querySelector(selector);
                if (message_el) {
                    if (type === 'loading') {
                        message_el.innerHTML = `<i class="fa fa-spinner fa-spin"></i> ${message}`;
                    } else {
                        message_el.innerHTML = `<div class="alert alert-${type}" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                    }
                }
            };

            // Show loading message
            show_message('Deleting user...', 'loading', '#delete-message');

            // Validate required modules exist
            if (!helperModule || !authModule || !httpModule) {
                console.error('Required modules are not available');
                show_message('System configuration error.');
                return false;
            }

            // Get and validate user_id parameter
            const user_id = helperModule.get_parameter_by_name('user_id');

            if (!user_id) {
                console.warn('Missing user_id parameter');
                show_message('Invalid user ID.', 'danger', '#exhibit-no-delete');
                return false;
            }

            // Validate user_id is numeric and positive
            const parsed_user_id = Number(user_id);
            if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
                console.warn(`Invalid user_id format: ${user_id}`);
                show_message('Invalid user ID format.', 'danger', '#exhibit-no-delete');
                return false;
            }

            // Get and validate authentication token
            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.warn('No authentication token available');
                show_message('Session expired. Please log in again.');
                setTimeout(() => {
                    authModule.logout();
                }, 2000);
                return false;
            }

            // Validate endpoint exists and build URL
            if (!USER_ENDPOINTS?.users?.delete_user?.delete?.endpoint) {
                console.error('Delete user endpoint not configured');
                show_message('System configuration error.');
                return false;
            }

            const endpoint = USER_ENDPOINTS.users.delete_user.delete.endpoint.replace(':user_id', parsed_user_id);

            // Make delete request
            const response = await httpModule.req({
                method: 'DELETE',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 10000
            });

            // Validate response structure
            if (!response || typeof response !== 'object') {
                console.error('Invalid response from server');
                show_message('Server communication error.', 'danger', '#exhibit-no-delete');
                return false;
            }

            // Handle successful deletion (204 No Content)
            if (response.status === 204) {

                document.querySelector('#delete-card').innerHTML = '';
                show_message('User deleted successfully.', 'success', '#message');

                setTimeout(() => {
                    window.location.replace(`${APP_PATH}/users`);
                }, 900);

                return true;
            }

            // Handle authentication failures
            if (response.status === 401 || response.status === 403) {
                const message = response.data?.message || 'You do not have permission to delete users.';
                show_message(message, 'danger', '#exhibit-no-delete');

                if (response.status === 401) {
                    setTimeout(() => {
                        authModule.logout();
                    }, 2000);
                }

                return false;
            }

            // Handle not found
            if (response.status === 404) {
                const message = response.data?.message || 'User not found.';
                show_message(message, 'danger', '#exhibit-no-delete');
                return false;
            }

            // Handle conflict (e.g., user cannot be deleted due to dependencies)
            if (response.status === 409) {
                const message = response.data?.message || 'User cannot be deleted due to existing dependencies.';
                show_message(message, 'danger', '#exhibit-no-delete');
                return false;
            }

            // Handle other errors
            console.error(`Unexpected response status: ${response.status}`);
            const error_message = response.data?.message || 'Failed to delete user.';
            show_message(error_message, 'danger', '#exhibit-no-delete');
            return false;

        } catch (error) {
            console.error('Error in delete_user:', error.message);

            const message_el = document.querySelector(MESSAGE_SELECTOR);
            if (message_el) {
                // Differentiate error types
                let error_message = 'An error occurred while deleting user.';

                if (error.message.includes('timeout')) {
                    error_message = 'Request timeout. Please try again.';
                } else if (error.message.includes('network')) {
                    error_message = 'Network error. Please check your connection.';
                } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
                    error_message = 'Session expired. Please log in again.';
                    setTimeout(() => {
                        authModule.logout();
                    }, 2000);
                }

                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error_message}</div>`;
            }

            return false;
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
    };

    async function get_roles() {

        try {

            const show_error = (message) => {
                const message_el = document.querySelector(MESSAGE_SELECTOR);
                if (message_el) {
                    message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                }
            };

            // Validate required modules exist
            if (!authModule || !httpModule) {
                console.error('Required modules are not available');
                show_error('System configuration error.');
                return null;
            }

            // Get and validate authentication token
            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.warn('No authentication token available');
                show_error('Session expired. Please log in again.');
                setTimeout(() => {
                    authModule.logout();
                }, 2000);
                return null;
            }

            // Make API request to get roles
            const response = await httpModule.req({
                method: 'GET',
                url: '/exhibits-dashboard/auth/roles',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 10000
            });

            // Validate response structure
            if (!response || typeof response !== 'object') {
                console.error('Invalid response from server');
                show_error('Server communication error.');
                return null;
            }

            // Handle successful response
            if (response.status === 200) {
                // Validate response data exists
                if (!response.data) {
                    console.warn('No roles data in response');
                    return [];
                }

                // Validate response data is an array
                if (!Array.isArray(response.data)) {
                    console.error('Invalid roles data format - expected array');
                    show_error('Invalid server response format.');
                    return null;
                }

                return response.data;
            }

            // Handle authentication failures
            if (response.status === 401 || response.status === 403) {
                console.warn(`Authorization failed with status ${response.status}`);
                show_error('You do not have permission to access roles.');

                if (response.status === 401) {
                    setTimeout(() => {
                        authModule.logout();
                    }, 2000);
                }

                return null;
            }

            // Handle not found
            if (response.status === 404) {
                console.warn('Roles endpoint not found');
                show_error('Roles service not available.');
                return null;
            }

            // Handle other HTTP errors
            console.error(`Unexpected response status: ${response.status}`);
            const error_message = response.data?.message || 'Failed to retrieve roles.';
            show_error(error_message);
            return null;

        } catch (error) {
            console.error('Error in get_roles:', error.message);

            const message_el = document.querySelector(MESSAGE_SELECTOR);
            if (message_el) {
                // Differentiate error types
                let error_message = 'An error occurred while retrieving roles.';

                if (error.message.includes('timeout')) {
                    error_message = 'Request timeout. Please try again.';
                } else if (error.message.includes('network')) {
                    error_message = 'Network error. Please check your connection.';
                } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
                    error_message = 'Session expired. Please log in again.';
                    setTimeout(() => {
                        authModule.logout();
                    }, 2000);
                }

                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error_message}</div>`;
            }

            return null;
        }
    }

    obj.list_roles = async function (role) {

        try {

            const show_error = (message) => {
                const message_el = document.querySelector(MESSAGE_SELECTOR);
                if (message_el) {
                    message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                }
            };

            // Validate get_roles function exists
            if (typeof get_roles !== 'function') {
                console.error('get_roles function is not available');
                show_error('System configuration error.');
                return false;
            }

            // Get roles from API
            const roles = await get_roles();

            // Validate roles data
            if (roles === null) {
                console.error('Failed to retrieve roles');
                show_error('Unable to load roles. Please refresh the page.');
                return false;
            }

            if (!Array.isArray(roles)) {
                console.error('Invalid roles data format');
                show_error('Invalid roles data received.');
                return false;
            }

            // Get select element and validate it exists
            const select_element = document.querySelector('#user-roles');

            if (!select_element) {
                console.error('User roles select element not found');
                show_error('Form element not found.');
                return false;
            }

            // Validate role parameter if provided
            let selected_role_id = null;
            if (role !== null && role !== undefined && typeof role === 'object') {
                selected_role_id = Number(role.role_id);

                if (!Number.isInteger(selected_role_id) || selected_role_id <= 0) {
                    console.warn('Invalid role_id in role parameter');
                    selected_role_id = null;
                }
            }

            // Build options array for better performance
            const options = [
                { value: '', text: 'Select From Menu', selected: false },
                { value: '', text: '----------', disabled: true, selected: false }
            ];

            // Add role options with HTML escaping
            for (const role_item of roles) {
                // Validate role item structure
                if (!role_item || typeof role_item !== 'object' || !role_item.id || !role_item.role) {
                    console.warn('Invalid role item structure:', role_item);
                    continue;
                }

                const role_id = Number(role_item.id);

                // Validate role ID
                if (!Number.isInteger(role_id) || role_id <= 0) {
                    console.warn('Invalid role ID:', role_item.id);
                    continue;
                }

                // Escape HTML to prevent XSS
                const escaped_role_name = escape_html(role_item.role);

                options.push({
                    value: role_id,
                    text: escaped_role_name,
                    selected: selected_role_id === role_id
                });
            }

            // Build HTML using array join (more efficient than string concatenation)
            const options_html = options.map(opt => {
                const value_attr = opt.value !== '' ? `value="${opt.value}"` : 'value=""';
                const selected_attr = opt.selected ? ' selected' : '';
                const disabled_attr = opt.disabled ? ' disabled' : '';

                return `<option ${value_attr}${selected_attr}${disabled_attr}>${opt.text}</option>`;
            }).join('');

            // Update select element
            select_element.innerHTML = options_html;

            return true;

        } catch (error) {
            console.error('Error in list_roles:', error.message);

            const message_el = document.querySelector(MESSAGE_SELECTOR);
            if (message_el) {
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An error occurred while loading roles.</div>`;
            }

            return false;
        }
    };

    // Helper function to escape HTML (prevent XSS)
    function escape_html(text) {
        if (typeof text !== 'string') {
            return String(text);
        }

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    obj.check_add_user_permission = async function () {

        try {

            const show_error = (message) => {
                const message_el = document.querySelector(MESSAGE_SELECTOR);
                if (message_el) {
                    message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                }
            };

            // Validate required modules exist
            if (!authModule) {
                console.error('authModule is not available');
                show_error('System configuration error.');
                return false;
            }

            // Get user profile data
            const profile = authModule.get_user_profile_data();

            // Validate profile exists
            if (!profile) {
                console.warn('No user profile found');
                show_error('User profile not found. Please log in again.');
                authModule.redirect_to_auth();
                return false;
            }

            // Validate profile has required fields
            if (!profile.uid || typeof profile.uid !== 'string') {
                console.warn('Invalid user profile structure');
                show_error('Invalid user profile data.');
                return false;
            }

            // Validate get_user_role function exists
            if (typeof get_user_role !== 'function') {
                console.error('get_user_role function is not available');
                show_error('System configuration error.');
                return false;
            }

            // Get user role data
            const role_data = await get_user_role(profile.uid);

            // Validate role data exists
            if (!role_data) {
                console.warn(`No role data found for user: ${profile.uid}`);
                show_error('Unable to verify user permissions.');
                return false;
            }

            // Validate role data structure
            if (typeof role_data !== 'object' || !role_data.role) {
                console.warn('Invalid role data structure');
                show_error('Invalid role data.');
                return false;
            }

            // Validate role is a string
            if (typeof role_data.role !== 'string') {
                console.warn('Role is not a string');
                return false;
            }

            // Check if user is Administrator (case-insensitive)
            const user_role = role_data.role.trim().toLowerCase();
            const is_admin = user_role === 'administrator';

            if (!is_admin) {
                console.debug(`User does not have add user permission. Role: ${role_data.role}`);
            }

            return is_admin;

        } catch (error) {
            console.error('Error in check_add_user_permission:', error.message);

            const message_el = document.querySelector(MESSAGE_SELECTOR);
            if (message_el) {
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An error occurred while checking permissions.</div>`;
            }

            return false;
        }
    };

    obj.init = async function () {
        await userModule.list_roles();
    };

    return obj;

}());
