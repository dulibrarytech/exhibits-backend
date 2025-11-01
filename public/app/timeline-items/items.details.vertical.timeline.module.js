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

const itemsDetailsVerticalTimelineModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

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
                    const auth_url = `${APP_PATH}/exhibits-dashboard/auth`;
                    window.location.replace(auth_url);
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

    async function display_details_record() {

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                created: document.querySelector('#created'),
                timeline_title: document.querySelector('#timeline-title-input'),
                timeline_text: document.querySelector('#timeline-text-input')
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

            return false;

        } catch (error) {
            console.error('Error in display_details_record:', error);
            display_error_message('Unable to display the timeline record. Please try again.');
            return false;
        }
    }

    obj.init = async function () {

        const status = helperModule.get_parameter_by_name('status');

        if (status !== null && status === '403') {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to edit this record.</div>`;
        }

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        exhibitsModule.set_exhibit_title(exhibit_id);
        await display_details_record();

    };

    return obj;

}());
