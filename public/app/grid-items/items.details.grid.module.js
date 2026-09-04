/**

 Copyright 2025 University of Denver

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

const itemsDetailsGridFormModule = (function () {

    'use strict';

    // const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_grid_record() {

        // Cache DOM element
        const message_element = document.querySelector('#message');

        /**
         * Validate required parameters
         */
        const validate_parameters = (exhibit_id, grid_id) => {
            if (!exhibit_id || !grid_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id or grid_id'
                };
            }

            // Validate reasonable string lengths
            if (exhibit_id.length > 255 || grid_id.length > 255) {
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
            const grid_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, grid_id);
            if (!validation.valid) {
                domModule.set_alert(message_element, 'danger', validation.error);
                return null;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.grid_records?.get?.endpoint) {
                domModule.set_alert(message_element, 'danger', 'API endpoint configuration missing');
                return null;
            }

            const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.grid_records.get.endpoint, {
                exhibit_id: exhibit_id,
                grid_id: grid_id
            });

            /* null = missing token; httpModule.api has alerted and scheduled the logout */
            const response = await httpModule.api({
                method: 'GET',
                url: endpoint
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
            console.error('Error in get_grid_record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || 'Unable to load the grid record. Please try again.';
            domModule.set_alert(message_element, 'danger', error_message);

            return null;
        }
    }

    async function display_details_record() {

        /**
         * Cache all required DOM elements to avoid repeated queries
         */
        const cache_dom_elements = () => {
            return {
                created: document.querySelector('#created'),
                grid_text: document.querySelector('#grid-text-input'),
                grid_internal_name: document.querySelector('#grid-internal-name-input'),
                grid_columns: document.querySelector('#grid-columns')
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

            // Clear existing content and append new content safely
            created_element.textContent = '';

            metadata_parts.forEach((part, index) => {
                if (index > 0) {
                    created_element.appendChild(document.createTextNode(' | '));
                }
                created_element.appendChild(part);
            });
        };

        /**
         * Set grid text input value
         */
        const set_grid_text = (text, element) => {
            if (!element) {
                return;
            }

            const unescaped_text = text ? helperModule.unescape(text) : '';

            /* the text field is a rich text editor; internal name is a plain input */
            if (element.dataset.rte !== undefined) {
                rteModule.set_html(element.id, unescaped_text);
            } else {
                element.value = unescaped_text;
            }
        };

        /**
         * Set grid columns value
         */
        const set_grid_columns = (columns, element) => {
            if (!element) {
                return;
            }

            // Validate columns value is a reasonable number
            let column_value = parseInt(columns, 10);

            // Set default or validate range (e.g., 1-12 for typical grid systems)
            if (isNaN(column_value) || column_value < 1 || column_value > 12) {
                column_value = 3; // Default value
            }

            element.value = column_value;
        };

        /**
         * Validate if a date object is valid
         */
        const is_valid_date = (date) => {
            return date instanceof Date && !isNaN(date.getTime());
        };

        try {
            // Fetch record data
            const record = await get_grid_record();

            if (!record) {
                throw new Error('Failed to load grid record data');
            }

            // Cache all DOM elements once
            const dom_elements = cache_dom_elements();

            // Display metadata (creation/update info)
            display_metadata_info(record, dom_elements.created);

            // Set form field values
            set_grid_text(record.text, dom_elements.grid_text);
            set_grid_text(record.internal_name, dom_elements.grid_internal_name);
            set_grid_columns(record.columns, dom_elements.grid_columns);

            return false;

        } catch (error) {
            console.error('Error in display_details_record:', error);
            domModule.set_alert('#message', 'danger', 'Unable to display the grid record. Please try again.');
            return false;
        }
    }

    obj.init = async function () {

        const status = helperModule.get_parameter_by_name('status');

        if (status !== null && status === '403') {
            domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to edit this record.');
        }

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        exhibitsModule.set_exhibit_title(exhibit_id);
        await display_details_record();
    };

    return obj;

}());
