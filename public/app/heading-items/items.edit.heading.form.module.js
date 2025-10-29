/**

 Copyright 2024 University of Denver

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

const itemsEditHeadingFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    async function get_item_heading_record() {
        // Cache DOM element reference
        const message_element = document.querySelector('#message');

        try {
            // Validate required parameters early
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            if (!exhibit_id || !item_id) {
                throw new Error('Missing required parameters: exhibit_id or item_id');
            }

            // Get and validate authentication
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();

            if (!token || token === false) {
                if (message_element) {
                    message_element.textContent = 'Authentication required. Redirecting to login...';
                }

                setTimeout(() => {
                    const login_url = `${APP_PATH}/login`;
                    window.location.replace(login_url);
                }, 1000);

                return null;
            }

            if (!profile?.uid) {
                throw new Error('Invalid user profile data');
            }

            // Safely construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.heading_records.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':heading_id', encodeURIComponent(item_id));

            // Construct URL with query parameters safely
            const url_parts = [endpoint];
            const params = new URLSearchParams({
                type: 'edit',
                uid: profile.uid
            });
            const full_url = `${endpoint}?${params.toString()}`;

            // Make API request with timeout consideration
            const response = await httpModule.req({
                method: 'GET',
                url: full_url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            // Validate response structure
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            if (!response.data?.data) {
                throw new Error('Invalid response structure');
            }

            return response.data.data;

        } catch (error) {
            // Log error for debugging (remove in production or use proper logging service)
            console.error('Error in get_item_heading_record:', error);

            // Display user-friendly error message (prevent XSS)
            if (message_element) {
                // Create elements safely to prevent XSS
                const alert_div = document.createElement('div');
                alert_div.className = 'alert alert-danger';
                alert_div.setAttribute('role', 'alert');

                const icon = document.createElement('i');
                icon.className = 'fa fa-exclamation';
                alert_div.appendChild(icon);

                // Use generic message to avoid leaking sensitive error details
                const error_text = document.createTextNode(' Unable to load the heading record. Please try again.');
                alert_div.appendChild(error_text);

                // Clear and set new content
                message_element.textContent = '';
                message_element.appendChild(alert_div);
            }

            return null;
        }
    }

    /*
    async function get_item_heading_record__ () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.heading_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':heading_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/login');
                }, 1000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint + '?type=edit&uid=' + profile.uid,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }
    */

    async function display_edit_record() {

        // Helper function to check if current user is an administrator
        const is_user_administrator = async () => {

            try {
                const profile = authModule.get_user_profile_data();
                if (!profile || !profile.uid) {
                    return false;
                }

                const user_id = parseInt(profile.uid, 10);
                if (isNaN(user_id)) {
                    return false;
                }

                const user_role = await authModule.get_user_role(user_id);
                return user_role === 'Administrator';

            } catch (error) {
                console.error('Error checking user role:', error);
                return false;
            }
        };

        // Helper function to disable all form fields
        const disable_form_fields = async (is_admin) => {

            // Get all form elements
            const form_elements = document.querySelectorAll(
                'input:not([type="hidden"]), textarea, select, button[type="submit"], button[type="button"]'
            );

            let disabled_count = 0;

            form_elements.forEach(element => {
                // Skip the unlock button if user is an administrator
                if (is_admin && element.id === 'unlock-record') {
                    console.log('Preserving unlock button for administrator');
                    return;
                }

                // Don't disable already disabled elements or read-only elements
                if (!element.disabled && !element.readOnly) {
                    element.disabled = true;
                    element.style.cursor = 'not-allowed';
                    element.style.opacity = '0.6';
                    disabled_count++;
                }
            });

            // Also disable file upload areas and custom buttons (except unlock button for admins)
            const custom_buttons = document.querySelectorAll('.btn:not([disabled])');
            custom_buttons.forEach(button => {
                // Skip the unlock button if user is an administrator
                if (is_admin && button.id === 'unlock-record') {
                    return;
                }

                button.disabled = true;
                button.style.cursor = 'not-allowed';
                button.style.opacity = '0.6';
            });

            console.log(`Disabled ${disabled_count} form elements (record locked by another user)`);
        };

        // Helper function to check if record is locked by another user
        const is_locked_by_other_user = (record) => {

            // Check if record is locked
            if (!record || record.is_locked !== 1) {
                return false;
            }

            // Get current user profile
            const profile = authModule.get_user_profile_data();

            if (!profile || !profile.uid) {
                console.warn('Unable to get user profile data');
                return false;
            }

            // Parse user IDs safely
            const user_id = parseInt(profile.uid, 10);
            const locked_by_user = parseInt(record.locked_by_user, 10);

            // Check for valid numbers
            if (isNaN(user_id) || isNaN(locked_by_user)) {
                console.error('Invalid user ID values');
                return false;
            }

            // Return true if locked by someone else
            return user_id !== locked_by_user;
        };

        try {

            // Fetch record data
            const record = await get_item_heading_record();

            if (!record) {
                throw new Error('Failed to load record data');
            }

            // Check if record is locked
            await helperModule.check_if_locked(record, '#item-submit-card');

            // Disable form fields if locked by another user
            if (is_locked_by_other_user(record)) {
                // Check if current user is an administrator
                const is_admin = await is_user_administrator();

                // Disable form fields, but preserve unlock button for admins
                await disable_form_fields(is_admin);
            }

            // Setup automatic unlock when user navigates away (only if current user has it locked)
            // setup_auto_unlock(record);
            helperModule.setup_auto_unlock(record);

            // Cache all DOM elements once
            const dom_elements = cache_dom_elements();

            // Validate and check record lock status
            await helperModule.check_if_locked(record, '#item-submit-card');

            // Display metadata (creation/update info)
            display_metadata_info(record, dom_elements.created);

            // Set heading text value
            set_heading_text(record.text, dom_elements.heading_text_input);

            // Set published status
            set_published_status(record.is_published, dom_elements.is_published);

            // Apply style settings
            apply_style_settings(record.styles, dom_elements);

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error);
            display_error_message('Unable to display the record. Please try again.');
            return false;
        }
    }

    /**
     * Cache all required DOM elements to avoid repeated queries
     */
    function cache_dom_elements() {
        return {
            created: document.querySelector('#created'),
            heading_text_input: document.querySelector('#item-heading-text-input'),
            is_published: document.querySelector('#is-published'),
            background_color: document.querySelector('#heading-background-color'),
            background_color_picker: document.querySelector('#heading-background-color-picker'),
            font_color: document.querySelector('#heading-font-color'),
            font_color_picker: document.querySelector('#heading-font-color-picker'),
            font_size: document.querySelector('#heading-font-size'),
            font_family: document.querySelector('#heading-font')
        };
    }

    /**
     * Display creation and update metadata securely
     */
    function display_metadata_info(record, created_element) {

        if (!created_element || !record) {
            return;
        }

        const metadata_parts = [];

        // Add creation info
        if (record.created_by && record.created) {
            const create_date = new Date(record.created);

            if (is_valid_date(create_date)) {
                const create_date_time = helperModule.format_date(create_date);
                const created_em = document.createElement('em');
                created_em.textContent = `Created by ${record.created_by} on ${create_date_time}`;
                metadata_parts.push(created_em);
            }
        }

        // Add update info
        if (record.updated_by && record.updated) {
            const update_date = new Date(record.updated);

            if (is_valid_date(update_date)) {
                const update_date_time = helperModule.format_date(update_date);
                const updated_em = document.createElement('em');
                updated_em.textContent = `Last updated by ${record.updated_by} on ${update_date_time}`;
                metadata_parts.push(updated_em);
            }
        }

        // Clear existing content and append new content safely
        created_element.textContent = '';

        metadata_parts.forEach((part, index) => {
            if (index > 0) {
                created_element.appendChild(document.createTextNode(' | '));
            }
            created_element.appendChild(part);
        });
    }

    /**
     * Set heading text input value
     */
    function set_heading_text(text, element) {
        if (!element) {
            return;
        }

        const unescaped_text = text ? helperModule.unescape(text) : '';
        element.value = unescaped_text;
    }

    /**
     * Set published status checkbox
     */
    function set_published_status(is_published, element) {
        if (!element) {
            return;
        }

        // Handle both numeric (0/1) and boolean values
        const PUBLISHED_VALUES = [1, true, '1', 'true'];
        element.checked = PUBLISHED_VALUES.includes(is_published);
    }

    /**
     * Parse and apply style settings
     */
    function apply_style_settings(styles_data, elements) {
        if (!styles_data) {
            return;
        }

        let styles;

        // Safely parse styles JSON
        try {
            styles = typeof styles_data === 'string'
                ? JSON.parse(styles_data)
                : styles_data;
        } catch (error) {
            console.error('Failed to parse styles JSON:', error);
            return;
        }

        if (!styles || typeof styles !== 'object' || Object.keys(styles).length === 0) {
            return;
        }

        // Apply background color
        apply_color_setting(
            styles.backgroundColor,
            elements.background_color,
            elements.background_color_picker
        );

        // Apply font color
        apply_color_setting(
            styles.color,
            elements.font_color,
            elements.font_color_picker
        );

        // Apply font size
        apply_font_size(styles.fontSize, elements.font_size);

        // Apply font family
        apply_font_family(styles.fontFamily, elements.font_family);
    }

    /**
     * Apply color value to input and color picker
     */
    function apply_color_setting(color_value, input_element, picker_element) {
        if (!color_value) {
            return;
        }

        const sanitized_color = String(color_value).trim();

        if (sanitized_color && input_element) {
            input_element.value = sanitized_color;
        }

        if (sanitized_color && picker_element) {
            picker_element.value = sanitized_color;
        }
    }

    /**
     * Apply font size setting
     */
    function apply_font_size(font_size_value, element) {
        if (!element) {
            return;
        }

        if (font_size_value) {
            // Remove 'px' suffix (case-insensitive)
            const size_numeric = String(font_size_value).replace(/px$/i, '').trim();
            element.value = size_numeric;
        } else {
            element.value = '';
        }
    }

    /**
     * Apply font family if it exists in select options
     */
    function apply_font_family(font_family_value, element) {
        if (!font_family_value || !element) {
            return;
        }

        const sanitized_font = String(font_family_value).trim();

        // Check if the font family exists in the select options
        const options = Array.from(element.options);
        const has_matching_option = options.some(option => option.value === sanitized_font);

        if (has_matching_option) {
            element.value = sanitized_font;
        }
    }

    /**
     * Validate if a date object is valid
     */
    function is_valid_date(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }

    /**
     * Display error message to user
     */
    function display_error_message(message) {
        const message_element = document.querySelector('#message');

        if (!message_element) {
            return;
        }

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation';
        alert_div.appendChild(icon);

        const text_node = document.createTextNode(` ${message}`);
        alert_div.appendChild(text_node);

        message_element.textContent = '';
        message_element.appendChild(alert_div);
    }

    /*
    async function display_edit_record__ () {

        let record = await get_item_heading_record();
        let styles;
        let is_published = record.is_published;
        let created_by = record.created_by;
        let created = record.created;
        let create_date = new Date(created);
        let updated_by = record.updated_by;
        let updated = record.updated;
        let update_date = new Date(updated);
        let item_created = '';
        let create_date_time = helperModule.format_date(create_date);
        let update_date_time = helperModule.format_date(update_date);

        helperModule.check_if_locked(record, '#item-submit-card');

        if (created_by !== null) {
            item_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
        }

        if (updated_by !== null) {
            item_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
        }

        document.querySelector('#created').innerHTML = item_created;
        document.querySelector('#item-heading-text-input').value = helperModule.unescape(record.text);

        if (document.querySelector('#is-published') !== null && is_published === 1) {
            document.querySelector('#is-published').value = true;
        } else if (document.querySelector('#is-published') !== null && is_published === 0) {
            document.querySelector('#is-published').value = false;
        }

        if (typeof record.styles === 'string') {
            styles = JSON.parse(record.styles);
        }

        if (Object.keys(styles).length !== 0) {

            if (styles.backgroundColor !== undefined && styles.backgroundColor.length !== 0) {
                document.querySelector('#heading-background-color').value = styles.backgroundColor;
                document.querySelector('#heading-background-color-picker').value = styles.backgroundColor;
            }

            if (styles.color !== undefined && styles.color.length !== 0) {
                document.querySelector('#heading-font-color').value = styles.color;
                document.querySelector('#heading-font-color-picker').value = styles.color;
            }

            if (styles.fontSize !== undefined) {
                document.querySelector('#heading-font-size').value = styles.fontSize.replace('px', '');
            } else {
                document.querySelector('#heading-font-size').value = '';
            }

            let font_values = document.querySelector('#heading-font');

            for (let i = 0;i<font_values.length;i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#heading-font').value = styles.fontFamily;
                }
            }
        }

        return false;
    }
    */

    obj.update_item_heading_record = async function() {
        // Prevent duplicate submissions
        if (this._is_updating) {
            return false;
        }

        this._is_updating = true;

        try {
            // Cache DOM element
            const message_element = document.querySelector('#message');

            // Scroll to top for user feedback
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Show loading state
            display_status_message(message_element, 'info', 'Updating heading record...');

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            if (!exhibit_id || !item_id) {
                display_status_message(message_element, 'danger', 'Missing required record identifiers');
                return false;
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_status_message(message_element, 'danger', 'Session expired. Redirecting to login...');

                setTimeout(() => {
                    authModule.logout();
                }, 1000);

                return false;
            }

            // Get and validate form data
            const form_data = itemsCommonHeadingFormModule.get_common_heading_form_fields(rich_text_data);

            if (!form_data || form_data === false) {
                display_status_message(message_element, 'danger', 'Invalid form data. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            if (user_name) {
                form_data.updated_by = user_name;
            }

            // Construct endpoint with URL encoding
            const endpoint = construct_update_endpoint(exhibit_id, item_id);

            // Make API request
            const response = await make_update_request(endpoint, form_data, token);

            // Handle successful response
            if (response && response.status === 201) {
                display_status_message(message_element, 'success', 'Heading record updated successfully');

                // Refresh the display with updated data instead of reloading
                await refresh_record_display();

                // Auto-dismiss success message after a delay
                setTimeout(() => {
                    clear_status_message(message_element);
                }, 3000);

                return true;
            } else {
                throw new Error('Unexpected response from server');
            }

        } catch (error) {
            console.error('Error updating heading record:', error);

            const message_element = document.querySelector('#message');
            const error_message = get_user_friendly_error_message(error);
            display_status_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_updating = false;
        }
    };

    /**
     * Refresh the record display without reloading the page
     */
    async function refresh_record_display() {
        try {
            // Re-fetch and display the updated record
            if (typeof display_edit_record === 'function') {
                await display_edit_record();
            }

            // Reset any form states that need resetting
            reset_form_states();

        } catch (error) {
            console.error('Error refreshing display:', error);
            // Don't throw - we already saved successfully
        }
    }

    /**
     * Reset form states after successful update
     */
    function reset_form_states() {
        // Reset any dirty/modified flags if you're tracking them
        if (typeof rich_text_data !== 'undefined' && rich_text_data) {
            // Mark form as clean/unmodified
            if (rich_text_data.setDirty && typeof rich_text_data.setDirty === 'function') {
                rich_text_data.setDirty(false);
            }
        }

        // Disable save button temporarily to prevent duplicate saves
        const submit_button = document.querySelector('#item-submit-card button[type="submit"]');
        if (submit_button) {
            submit_button.disabled = true;

            // Re-enable after a short delay
            setTimeout(() => {
                submit_button.disabled = false;
            }, 1000);
        }

        // Clear any unsaved changes warnings
        window.onbeforeunload = null;
    }

    /**
     * Display status message to user (XSS-safe)
     */
    function display_status_message(element, type, message) {
        if (!element) {
            return;
        }

        // Validate message type
        const valid_types = ['info', 'success', 'danger', 'warning'];
        const alert_type = valid_types.includes(type) ? type : 'info';

        // Create alert container
        const alert_div = document.createElement('div');
        alert_div.className = `alert alert-${alert_type}`;
        alert_div.setAttribute('role', 'alert');

        // Add icon based on type
        const icon = document.createElement('i');
        icon.className = get_icon_class(alert_type);
        alert_div.appendChild(icon);

        // Add message text
        const text_node = document.createTextNode(` ${message}`);
        alert_div.appendChild(text_node);

        // Clear and set new content
        element.textContent = '';
        element.appendChild(alert_div);
    }

    /**
     * Clear status message
     */
    function clear_status_message(element) {

        if (!element) {
            return;
        }

        // Fade out effect (if you want animation)
        element.style.transition = 'opacity 0.3s ease-out';
        element.style.opacity = '0';

        setTimeout(() => {
            element.textContent = '';
            element.style.opacity = '1';
        }, 300);
    }

    /**
     * Get appropriate icon class for alert type
     */
    function get_icon_class(alert_type) {
        const icon_map = {
            'info': 'fa fa-info',
            'success': 'fa fa-check',
            'danger': 'fa fa-exclamation',
            'warning': 'fa fa-exclamation-triangle'
        };

        return icon_map[alert_type] || 'fa fa-info';
    }

    /**
     * Construct update endpoint with URL encoding
     */
    function construct_update_endpoint(exhibit_id, item_id) {
        if (!EXHIBITS_ENDPOINTS?.exhibits?.heading_records?.put?.endpoint) {
            throw new Error('API endpoint configuration missing');
        }

        const endpoint_template = EXHIBITS_ENDPOINTS.exhibits.heading_records.put.endpoint;

        return endpoint_template
            .replace(':exhibit_id', encodeURIComponent(exhibit_id))
            .replace(':heading_id', encodeURIComponent(item_id));
    }

    /**
     * Make the update request to the API
     */
    async function make_update_request(endpoint, data, token) {
        if (!httpModule?.req) {
            throw new Error('HTTP module not available');
        }

        const response = await httpModule.req({
            method: 'PUT',
            url: endpoint,
            data: data,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });

        return response;
    }

    /**
     * Get user-friendly error message
     */
    function get_user_friendly_error_message(error) {
        // Map specific errors to user-friendly messages
        const error_messages = {
            'NetworkError': 'Network connection error. Please check your internet connection.',
            'TimeoutError': 'Request timed out. Please try again.',
            'AbortError': 'Request was cancelled. Please try again.'
        };

        // Check for specific error types
        if (error.name && error_messages[error.name]) {
            return error_messages[error.name];
        }

        // Check for HTTP status codes
        if (error.response?.status) {
            const status = error.response.status;

            if (status === 401 || status === 403) {
                return 'Authentication failed. Please log in again.';
            } else if (status === 404) {
                return 'Record not found.';
            } else if (status === 422) {
                return 'Invalid data submitted. Please check your inputs.';
            } else if (status >= 500) {
                return 'Server error. Please try again later.';
            }
        }

        // Generic fallback message
        return 'Unable to update heading record. Please try again.';
    }

    /*
    obj.update_item_heading_record__ = async function () {

        try {

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating heading record...</div>`;
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let token = authModule.get_user_token();
            let data = itemsCommonHeadingFormModule.get_common_heading_form_fields(rich_text_data);
            let response;

            if (data === false) {
                return false;
            }

            if (exhibit_id === undefined || item_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get record ID</div>`;
                return false;
            }

            if (token === false) {
                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            data.updated_by = helperModule.get_user_name();

            let tmp = EXHIBITS_ENDPOINTS.exhibits.heading_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':heading_id', item_id);

            response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Heading record updated</div>`;

                setTimeout(() => {
                    window.location.reload();
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };
    */

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const heading_id = helperModule.get_parameter_by_name('item_id');

            const redirect = '/items/heading/details?exhibit_id=' + exhibit_id + '&item_id=' + heading_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'heading', exhibit_id, heading_id, redirect);
            await exhibitsModule.set_exhibit_title(exhibit_id);

            document.querySelector('#save-heading-btn').addEventListener('click', await itemsEditHeadingFormModule.update_item_heading_record);
            await display_edit_record();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
