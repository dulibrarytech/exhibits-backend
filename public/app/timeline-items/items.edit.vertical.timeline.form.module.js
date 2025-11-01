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

const itemsEditVerticalTimelineFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    async function get_timeline_record() {

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
        const validate_parameters = (exhibit_id, timeline_id) => {
            if (!exhibit_id || !timeline_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id or timeline_id'
                };
            }

            // Validate reasonable string lengths
            if (exhibit_id.length > 255 || timeline_id.length > 255) {
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
            const timeline_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, timeline_id);
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
                }, 3000);

                return null;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_records?.get?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return null;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.timeline_records.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':timeline_id', encodeURIComponent(timeline_id));

            // Make API request with timeout
            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
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
            console.error('Error in get_timeline_record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || 'Unable to load the timeline record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return null;
        }
    }

    obj.update_timeline_record = async function() {

        // Prevent duplicate submissions
        if (this._is_updating_timeline) {
            return false;
        }

        this._is_updating_timeline = true;

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
        const validate_parameters = (exhibit_id, timeline_id) => {
            if (!exhibit_id || !timeline_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id or timeline_id'
                };
            }

            if (exhibit_id.length > 255 || timeline_id.length > 255) {
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
            const timeline_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, timeline_id);
            if (!validation.valid) {
                display_message(message_element, 'warning', validation.error);
                return false;
            }

            // Show loading state
            display_message(message_element, 'info', 'Updating timeline record...');

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
            const form_data = itemsCommonVerticalTimelineFormModule.get_common_timeline_form_fields(rich_text_data);

            if (!form_data || form_data === false) {
                display_message(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            if (user_name) {
                form_data.updated_by = user_name;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_records?.put?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.timeline_records.put.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':timeline_id', encodeURIComponent(timeline_id));

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
                throw new Error('Failed to update timeline record');
            }

            // Scroll to top for success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Show success message
            display_message(message_element, 'success', 'Timeline record updated successfully');

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
            console.error('Error updating timeline record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || error.message || 'Unable to update timeline record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_updating_timeline = false;
        }
    };

    obj.update_timeline_record_ = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('item_id');

            if (exhibit_id === undefined || timeline_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to update timeline record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating timeline record...</div>`;

            const data = itemsCommonVerticalTimelineFormModule.get_common_timeline_form_fields(rich_text_data);

            if (data === false) {
                return false;
            }

            data.updated_by = helperModule.get_user_name();

            let tmp = EXHIBITS_ENDPOINTS.exhibits.timeline_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':timeline_id', timeline_id);
            const token = authModule.get_user_token();
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

                window.scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Timeline record updated</div>`;
                const timeline_id = response.data.data;

                setTimeout(() => {
                    window.location.reload();
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    async function display_edit_record() {

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                created: document.querySelector('#created'),
                timeline_title: document.querySelector('#timeline-title-input'),
                timeline_text: document.querySelector('#timeline-text-input'),
                timeline_bg_color: document.querySelector('#timeline-background-color'),
                timeline_bg_color_picker: document.querySelector('#timeline-background-color-picker'),
                timeline_font_color: document.querySelector('#timeline-font-color'),
                timeline_font_color_picker: document.querySelector('#timeline-font-color-picker'),
                timeline_font: document.querySelector('#timeline-font'),
                timeline_font_size: document.querySelector('#timeline-font-size')
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
         * Set timeline title input value
         */
        const set_timeline_title = (title, element) => {
            if (!element) {
                return;
            }

            const unescaped_title = title ? helperModule.unescape(title) : '';
            element.value = unescaped_title;
        };

        /**
         * Set timeline text input value
         */
        const set_timeline_text = (text, element) => {
            if (!element) {
                return;
            }

            const unescaped_text = text ? helperModule.unescape(text) : '';
            element.value = unescaped_text;
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
                elements.timeline_bg_color,
                elements.timeline_bg_color_picker
            );

            // Apply font color
            apply_color_setting(
                styles.color,
                elements.timeline_font_color,
                elements.timeline_font_color_picker
            );

            // Apply font size
            apply_font_size(styles.fontSize, elements.timeline_font_size);

            // Apply font family
            apply_font_family(styles.fontFamily, elements.timeline_font);
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
            const record = await get_timeline_record();

            if (!record) {
                throw new Error('Failed to load timeline record data');
            }

            // Cache all DOM elements
            const elements = cache_dom_elements();

            // Display metadata (creation/update info)
            display_metadata_info(record, elements.created);

            // Set timeline form fields
            set_timeline_title(record.title, elements.timeline_title);
            set_timeline_text(record.text, elements.timeline_text);

            // Apply style settings
            apply_style_settings(record.styles, elements);

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error);
            display_error_message('Unable to display the timeline record. Please try again.');
            return false;
        }
    }

    obj.init = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const item_id = helperModule.get_parameter_by_name('item_id');
        const redirect = '/items/vertical-timeline/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
        await authModule.check_permissions(['update_item', 'update_any_item'], 'timeline', exhibit_id, item_id, redirect);

        exhibitsModule.set_exhibit_title(exhibit_id);
        document.querySelector('#save-timeline-btn').addEventListener('click', itemsEditVerticalTimelineFormModule.update_timeline_record);
        await display_edit_record();
    };

    return obj;

}());
