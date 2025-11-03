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

const itemsEditGridItemFormModule = (function () {

    'use strict';

    // const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_grid_item_record() {

        // Cache DOM element
        const message_element = document.querySelector('#message');

        /**
         * Display status message to user (XSS-safe)
         */
        const display_message = (element, type, message) => {
            if (!element) {
                return;
            }

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = get_icon_class(alert_type);
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            element.textContent = '';
            element.appendChild(alert_div);
        };

        /**
         * Get icon class for alert type
         */
        const get_icon_class = (alert_type) => {
            const icon_map = {
                'info': 'fa fa-info',
                'success': 'fa fa-check',
                'danger': 'fa fa-exclamation',
                'warning': 'fa fa-exclamation-triangle'
            };
            return icon_map[alert_type] || 'fa fa-exclamation';
        };

        /**
         * Validate required parameters
         */
        const validate_parameters = (exhibit_id, grid_id, item_id) => {
            if (!exhibit_id || !grid_id || !item_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, grid_id, or item_id'
                };
            }

            // Validate reasonable string lengths
            if (exhibit_id.length > 255 || grid_id.length > 255 || item_id.length > 255) {
                return {
                    valid: false,
                    error: 'Invalid parameter length'
                };
            }

            return { valid: true };
        };

        try {

            // Get and validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const validation = validate_parameters(exhibit_id, grid_id, item_id);

            if (!validation.valid) {
                display_message(message_element, 'danger', validation.error);
                return null;
            }

            // Get and validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Authentication required. Redirecting...');

                setTimeout(() => {
                    authModule.redirect_to_auth();
                }, 1000);

                return null;
            }

            // Get user profile
            const profile = authModule.get_user_profile_data();

            if (!profile?.uid) {
                display_message(message_element, 'danger', 'Invalid user profile data');
                return null;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.grid_item_record?.get?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return null;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_record.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':grid_id', encodeURIComponent(grid_id))
                .replace(':item_id', encodeURIComponent(item_id));

            // Construct URL with query parameters safely
            const params = new URLSearchParams({
                type: 'edit',
                uid: profile.uid
            });
            const full_url = `${endpoint}?${params.toString()}`;

            // Make API request with timeout
            const response = await httpModule.req({
                method: 'GET',
                url: full_url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
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
            // Log error for debugging
            console.error('Error in get_grid_item_record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || 'Unable to load the grid item record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return null;
        }
    }

    async function display_edit_record() {

        /**
         * Check if current user is an administrator
         */
        const is_user_administrator = async () => {
            try {
                const profile = authModule.get_user_profile_data();
                if (!profile?.uid) {
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

        /**
         * Disable all form fields (except unlock button for admins)
         */
        const disable_form_fields = (is_admin) => {
            const form_elements = document.querySelectorAll(
                'input:not([type="hidden"]), textarea, select, button[type="submit"], button[type="button"]'
            );

            let disabled_count = 0;

            form_elements.forEach(element => {
                // Skip unlock button for administrators
                if (is_admin && element.id === 'unlock-record') {
                    return;
                }

                // Only disable enabled, non-readonly elements
                if (!element.disabled && !element.readOnly) {
                    element.disabled = true;
                    element.style.cursor = 'not-allowed';
                    element.style.opacity = '0.6';
                    disabled_count++;
                }
            });

            // Disable custom buttons
            const custom_buttons = document.querySelectorAll('.btn:not([disabled])');
            custom_buttons.forEach(button => {
                if (is_admin && button.id === 'unlock-record') {
                    return;
                }

                button.disabled = true;
                button.style.cursor = 'not-allowed';
                button.style.opacity = '0.6';
            });

            console.log(`Disabled ${disabled_count} form elements (record locked by another user)`);
        };

        /**
         * Check if record is locked by another user
         */
        const is_locked_by_other_user = (record) => {
            if (!record || record.is_locked !== 1) {
                return false;
            }

            const profile = authModule.get_user_profile_data();
            if (!profile?.uid) {
                console.warn('Unable to get user profile data');
                return false;
            }

            const user_id = parseInt(profile.uid, 10);
            const locked_by_user = parseInt(record.locked_by_user, 10);

            if (isNaN(user_id) || isNaN(locked_by_user)) {
                console.error('Invalid user ID values');
                return false;
            }

            return user_id !== locked_by_user;
        };

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                created: document.querySelector('#created'),
                is_published: document.querySelector('#is-published'),
                item_title: document.querySelector('#item-title-input'),
                item_text: document.querySelector('#item-text-input'),
                item_bg_color: document.querySelector('#item-background-color'),
                item_bg_color_picker: document.querySelector('#item-background-color-picker'),
                item_font_color: document.querySelector('#item-font-color'),
                item_font_color_picker: document.querySelector('#item-font-color-picker'),
                item_font: document.querySelector('#item-font'),
                item_font_size: document.querySelector('#item-font-size'),
                layouts: document.getElementsByName('layout'),
                media_width: document.getElementsByName('media_width')
            };
        };

        /**
         * Display creation and update metadata securely
         */
        const display_metadata_info = (record, created_element) => {
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

            // Clear and append content safely
            created_element.textContent = '';

            metadata_parts.forEach((part, index) => {
                if (index > 0) {
                    created_element.appendChild(document.createTextNode(' | '));
                }
                created_element.appendChild(part);
            });
        };

        /**
         * Set published status
         */
        const set_published_status = (is_published, element) => {
            if (!element) {
                return;
            }

            const published_values = [1, true, '1', 'true'];
            element.checked = published_values.includes(is_published);
        };

        /**
         * Set basic form fields
         */
        const set_basic_fields = (record, elements) => {
            // Set title
            if (elements.item_title) {
                const title = record.title ? helperModule.unescape(record.title) : '';
                elements.item_title.value = title;
            }

            // Set text
            if (elements.item_text) {
                const text = record.text ? helperModule.unescape(record.text) : '';
                elements.item_text.value = text;
            }
        };

        /**
         * Set layout radio buttons
         */
        const set_layout_selection = (layout_value, layouts) => {
            if (!layouts || layouts.length === 0 || !layout_value) {
                return;
            }

            for (let i = 0; i < layouts.length; i++) {
                if (layouts[i].value === layout_value) {
                    layouts[i].checked = true;
                    break;
                }
            }
        };

        /**
         * Set media width radio buttons
         */
        const set_media_width_selection = (width_value, media_width_elements) => {
            if (!media_width_elements || media_width_elements.length === 0) {
                return;
            }

            const target_width = parseInt(width_value, 10);
            if (isNaN(target_width)) {
                return;
            }

            for (let i = 0; i < media_width_elements.length; i++) {
                const element_width = parseInt(media_width_elements[i].value, 10);
                if (element_width === target_width) {
                    media_width_elements[i].checked = true;
                    break;
                }
            }
        };

        /**
         * Apply style settings
         */
        const apply_style_settings = (styles_data, elements) => {
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
                elements.item_bg_color,
                elements.item_bg_color_picker
            );

            // Apply font color
            apply_color_setting(
                styles.color,
                elements.item_font_color,
                elements.item_font_color_picker
            );

            // Apply font size
            apply_font_size(styles.fontSize, elements.item_font_size);

            // Apply font family
            apply_font_family(styles.fontFamily, elements.item_font);
        };

        /**
         * Apply color value to input and picker
         */
        const apply_color_setting = (color_value, input_element, picker_element) => {
            if (color_value) {
                const sanitized_color = String(color_value).trim();

                if (input_element) {
                    input_element.value = sanitized_color;
                }

                if (picker_element) {
                    picker_element.value = sanitized_color;
                }
            } else {
                if (input_element) {
                    input_element.value = '';
                }
                if (picker_element) {
                    picker_element.value = '';
                }
            }
        };

        /**
         * Apply font size setting
         */
        const apply_font_size = (font_size_value, element) => {
            if (!element) {
                return;
            }

            if (font_size_value) {
                const size_numeric = String(font_size_value).replace(/px$/i, '').trim();
                element.value = size_numeric;
            } else {
                element.value = '';
            }
        };

        /**
         * Apply font family if it exists in options
         */
        const apply_font_family = (font_family_value, element) => {
            if (!font_family_value || !element || !element.options) {
                return;
            }

            const sanitized_font = String(font_family_value).trim();

            // Check if font exists in options
            const options = Array.from(element.options);
            const has_match = options.some(option => option.value === sanitized_font);

            if (has_match) {
                element.value = sanitized_font;
            }
        };

        /**
         * Validate if a date is valid
         */
        const is_valid_date = (date) => {
            return date instanceof Date && !isNaN(date.getTime());
        };

        /**
         * Display error message
         */
        const display_error_message = (message) => {
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
        };

        try {

            // Fetch record data
            const record = await get_grid_item_record();

            if (!record) {
                throw new Error('Failed to load grid item record data');
            }

            // Cache all DOM elements
            const elements = cache_dom_elements();

            // Check if record is locked
            await helperModule.check_if_locked(record, '#item-submit-card');

            // Disable form fields if locked by another user
            if (is_locked_by_other_user(record)) {
                const is_admin = await is_user_administrator();
                disable_form_fields(is_admin);
            }

            // Setup automatic unlock when user navigates away
            helperModule.setup_auto_unlock(record);

            // Display metadata (creation/update info)
            display_metadata_info(record, elements.created);

            // Set published status
            set_published_status(record.is_published, elements.is_published);

            // Set basic form fields
            set_basic_fields(record, elements);

            // Display media fields if on media page
            if (window.location.pathname.indexOf('media') !== -1) {
                if (typeof helperMediaModule?.display_media_fields_common === 'function') {
                    await helperMediaModule.display_media_fields_common(record);
                }
            }

            // Set layout selection
            set_layout_selection(record.layout, elements.layouts);

            // Set media width selection
            set_media_width_selection(record.media_width, elements.media_width);

            // Apply style settings
            apply_style_settings(record.styles, elements);

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error);
            display_error_message('Unable to display the record. Please try again.');
            return false;
        }
    }

    async function display_edit_record__() {

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

            let record = await get_grid_item_record();
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

            if (created_by !== null) {
                item_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
            }

            if (updated_by !== null) {
                item_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
            }

            document.querySelector('#created').innerHTML = item_created;

            if (document.querySelector('#is-published') !== null && is_published === 1) {
                document.querySelector('#is-published').value = true;
            } else if (document.querySelector('#is-published') !== null && is_published === 0) {
                document.querySelector('#is-published').value = false;
            }

            // item data
            document.querySelector('#item-title-input').value = helperModule.unescape(record.title);
            document.querySelector('#item-text-input').value = helperModule.unescape(record.text);

            if (window.location.pathname.indexOf('media') !== -1) {
                await helperMediaModule.display_media_fields_common(record);
            }

            let layouts = document.getElementsByName('layout');

            for (let j = 0; j < layouts.length; j++) {
                if (layouts[j].value === record.layout) {
                    document.querySelector('#' + layouts[j].id).checked = true;
                }
            }

            let media_width = document.getElementsByName('media_width');

            for (let j = 0; j < media_width.length; j++) {
                if (parseInt(media_width[j].value) === parseInt(record.media_width)) {
                    document.querySelector('#' + media_width[j].id).checked = true;
                }
            }

            let styles = JSON.parse(record.styles);

            if (Object.keys(styles).length !== 0) {

                if (styles.backgroundColor !== undefined) {
                    document.querySelector('#item-background-color').value = styles.backgroundColor;
                    document.querySelector('#item-background-color-picker').value = styles.backgroundColor;
                } else {
                    document.querySelector('#item-background-color').value = '';
                }

                if (styles.color !== undefined) {
                    document.querySelector('#item-font-color').value = styles.color;
                    document.querySelector('#item-font-color-picker').value = styles.color;
                } else {
                    document.querySelector('#item-font-color').value = '';
                }

                let font_values = document.querySelector('#item-font');

                for (let i = 0; i < font_values.length; i++) {
                    if (font_values[i].value === styles.fontFamily) {
                        document.querySelector('#item-font').value = styles.fontFamily;
                    }
                }

                if (styles.fontSize !== undefined) {
                    document.querySelector('#item-font-size').value = styles.fontSize.replace('px', '');
                } else {
                    document.querySelector('#item-font-size').value = '';
                }
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.update_grid_item_record = async function() {
        // Prevent duplicate submissions
        if (this._is_updating_grid_item) {
            return false;
        }

        this._is_updating_grid_item = true;

        // Cache DOM element and constants
        const message_element = document.querySelector('#message');
        const MESSAGE_CLEAR_DELAY = 3000;
        const FADE_DURATION = 300;

        /**
         * Display status message to user (XSS-safe)
         */
        const display_message = (element, type, message) => {
            if (!element) {
                return;
            }

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = get_icon_class(alert_type);
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            element.style.opacity = '1';
            element.style.transition = '';
            element.textContent = '';
            element.appendChild(alert_div);
        };

        /**
         * Clear message with smooth fade effect
         */
        const clear_message_smoothly = () => {
            if (!message_element) {
                return;
            }

            message_element.style.transition = `opacity ${FADE_DURATION}ms ease-out`;
            message_element.style.opacity = '0';

            setTimeout(() => {
                message_element.textContent = '';
                message_element.style.opacity = '1';
                message_element.style.transition = '';
            }, FADE_DURATION);
        };

        /**
         * Get icon class for alert type
         */
        const get_icon_class = (alert_type) => {
            const icon_map = {
                'info': 'fa fa-info',
                'success': 'fa fa-check',
                'danger': 'fa fa-exclamation',
                'warning': 'fa fa-exclamation-triangle'
            };
            return icon_map[alert_type] || 'fa fa-exclamation';
        };

        /**
         * Validate parameters
         */
        const validate_parameters = (exhibit_id, grid_id, item_id) => {
            if (!exhibit_id || !grid_id || !item_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, grid_id, or item_id'
                };
            }

            if (exhibit_id.length > 255 || grid_id.length > 255 || item_id.length > 255) {
                return {
                    valid: false,
                    error: 'Invalid parameter length'
                };
            }

            return { valid: true };
        };

        /**
         * Refresh the record display without reloading
         */
        const refresh_record_display = async () => {
            try {
                if (typeof display_edit_record === 'function') {
                    await display_edit_record();
                }

                reset_form_state();
            } catch (error) {
                console.error('Error refreshing display:', error);
            }
        };

        /**
         * Reset form state after update
         */
        const reset_form_state = () => {
            // Mark form as clean if tracking dirty state
            if (typeof rich_text_data !== 'undefined' && rich_text_data?.setDirty) {
                rich_text_data.setDirty(false);
            }

            // Temporarily disable submit button
            const submit_button = document.querySelector('#item-submit-card button[type="submit"], button[type="submit"]');
            if (submit_button) {
                submit_button.disabled = true;
                setTimeout(() => {
                    submit_button.disabled = false;
                }, 1000);
            }

            // Clear unsaved changes warning
            window.onbeforeunload = null;
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Scroll to top for user feedback
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Get and validate parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, grid_id, item_id);
            if (!validation.valid) {
                display_message(message_element, 'warning', validation.error);
                return false;
            }

            // Show loading state
            display_message(message_element, 'info', 'Updating grid item record...');

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Session expired. Please log in again.');

                timeout_id = setTimeout(() => {
                    authModule.logout();
                }, 1000);

                return false;
            }

            // Get and validate form data
            const form_data = itemsCommonGridItemFormModule.get_common_grid_item_form_fields();

            if (!form_data || form_data === false || form_data === undefined) {
                // display_message(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            if (user_name) {
                form_data.updated_by = user_name;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.grid_item_records?.put?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.put.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':grid_id', encodeURIComponent(grid_id))
                .replace(':item_id', encodeURIComponent(item_id));

            // Make API request
            const response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: form_data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 201) {
                throw new Error('Failed to update grid item record');
            }

            // Show success message
            display_message(message_element, 'success', 'Grid item record updated successfully');

            // Refresh the display with updated data
            await refresh_record_display();

            // Smoothly clear success message after delay
            timeout_id = setTimeout(() => {
                clear_message_smoothly();
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error updating grid item record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || error.message || 'Unable to update grid item record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_updating_grid_item = false;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const redirect = '/items/grid/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'grid_item', exhibit_id, item_id, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            navModule.back_to_grid_items();
            await display_edit_record();
            document.querySelector('#save-item-btn').addEventListener('click', itemsEditGridItemFormModule.update_grid_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
