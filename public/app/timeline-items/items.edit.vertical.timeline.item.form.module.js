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

const itemsEditTimelineItemFormModule = (function () {

    'use strict';

    // const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_timeline_item_record() {
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
        const validate_parameters = (exhibit_id, timeline_id, item_id) => {
            if (!exhibit_id || !timeline_id || !item_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, timeline_id, or item_id'
                };
            }

            // Validate reasonable string lengths
            if (exhibit_id.length > 255 || timeline_id.length > 255 || item_id.length > 255) {
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
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, timeline_id, item_id);
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
            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_item_record?.get?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return null;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.timeline_item_record.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':timeline_id', encodeURIComponent(timeline_id))
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
            console.error('Error in get_timeline_item_record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || 'Unable to load the timeline item record. Please try again.';
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
                item_title: document.querySelector('#item-title-input'),
                item_text: document.querySelector('#item-text-input'),
                item_date: document.querySelector('#item-date-input'),
                // Commented out style elements for future use
                // item_bg_color: document.querySelector('#item-background-color'),
                // item_bg_color_picker: document.querySelector('#item-background-color-picker'),
                // item_font_color: document.querySelector('#item-font-color'),
                // item_font_color_picker: document.querySelector('#item-font-color-picker'),
                // item_font: document.querySelector('#item-font'),
                // item_font_size: document.querySelector('#item-font-size')
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
         * Set item title input value
         */
        const set_item_title = (title, element) => {
            if (!element) {
                return;
            }

            const unescaped_title = title ? helperModule.unescape(title) : '';
            element.value = unescaped_title;
        };

        /**
         * Set item text input value
         */
        const set_item_text = (text, element) => {
            if (!element) {
                return;
            }

            const unescaped_text = text ? helperModule.unescape(text) : '';
            element.value = unescaped_text;
        };

        /**
         * Set item date input value (extract date from ISO string)
         */
        const set_item_date = (date_value, element) => {
            if (!element) {
                return;
            }

            if (!date_value) {
                element.value = '';
                return;
            }

            // Extract date portion from ISO date string (e.g., "2024-01-15T00:00:00Z" -> "2024-01-15")
            const date_str = String(date_value);
            const date_parts = date_str.split('T');

            if (date_parts.length > 0 && date_parts[0]) {
                element.value = date_parts[0];
            } else {
                element.value = '';
            }
        };

        /**
         * Display media fields if on media page
         */
        const display_media_fields = async (record) => {
            if (window.location.pathname.indexOf('media') === -1) {
                return;
            }

            if (typeof helperMediaModule?.display_media_fields_common === 'function') {
                try {
                    await helperMediaModule.display_media_fields_common(record);
                } catch (error) {
                    console.error('Error displaying media fields:', error);
                }
            }
        };

        /**
         * Apply style settings (currently commented out)
         * Uncomment and use when style support is needed
         */
        const apply_style_settings = (styles_data, elements) => {
            if (!styles_data) {
                return;
            }

            let styles;

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

            // Style application code would go here
            // Currently commented out in original function
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
            const data = await get_timeline_item_record();

            if (!data || !data.item) {
                throw new Error('Failed to load timeline item record data');
            }

            const record = data.item;

            // Check if record is locked
            await helperModule.check_if_locked(record, '#item-submit-card');

            // Disable form fields if locked by another user
            if (is_locked_by_other_user(record)) {
                const is_admin = await is_user_administrator();
                disable_form_fields(is_admin);
            }

            // Setup automatic unlock when user navigates away
            helperModule.setup_auto_unlock(record);

            // Cache all DOM elements
            const elements = cache_dom_elements();

            // Check if record is locked
            await helperModule.check_if_locked(record, '#item-submit-card');

            // Display metadata (creation/update info)
            display_metadata_info(record, elements.created);

            // Set basic form fields
            set_item_title(record.title, elements.item_title);
            set_item_text(record.text, elements.item_text);
            set_item_date(record.date, elements.item_date);

            // Display media fields if on media page
            await display_media_fields(record);

            // Apply style settings (currently commented out)
            // apply_style_settings(record.styles, elements);

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error);
            display_error_message('Unable to display the timeline item record. Please try again.');
            return false;
        }
    }

    obj.update_timeline_item_record = async function() {

        // Prevent duplicate submissions
        if (this._is_updating_timeline_item) {
            return false;
        }

        this._is_updating_timeline_item = true;

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
        const validate_parameters = (exhibit_id, timeline_id, item_id) => {
            if (!exhibit_id || !timeline_id || !item_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, timeline_id, or item_id'
                };
            }

            if (exhibit_id.length > 255 || timeline_id.length > 255 || item_id.length > 255) {
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
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, timeline_id, item_id);
            if (!validation.valid) {
                display_message(message_element, 'warning', validation.error);
                return false;
            }

            // Show loading state
            display_message(message_element, 'info', 'Updating timeline item record...');

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
            const form_data = itemsCommonVerticalTimelineItemFormModule.get_common_timeline_item_form_fields();

            if (!form_data || form_data === false || form_data === undefined) {
                display_message(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            if (user_name) {
                form_data.updated_by = user_name;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_item_records?.put?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.put.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':timeline_id', encodeURIComponent(timeline_id))
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
                throw new Error('Failed to update timeline item record');
            }

            // Show success message
            display_message(message_element, 'success', 'Timeline item record updated successfully');

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
            console.error('Error updating timeline item record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || error.message || 'Unable to update timeline item record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_updating_timeline_item = false;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const redirect = '/items?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'timeline_item', exhibit_id, item_id, redirect);

            await exhibitsModule.set_exhibit_title(exhibit_id);
            navModule.set_timeline_item_nav_menu_links();
            await display_edit_record();
            document.querySelector('#save-item-btn').addEventListener('click', itemsEditTimelineItemFormModule.update_timeline_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
