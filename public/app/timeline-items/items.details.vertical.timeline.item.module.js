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

const itemsDetailsTimelineItemModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_timeline_item_record() {

        const message_element = document.querySelector('#message');

        const display_message = (element, type, message) => {
            if (!element) return;

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const icon_map = {
                'info': 'fa fa-info',
                'success': 'fa fa-check',
                'danger': 'fa fa-exclamation',
                'warning': 'fa fa-exclamation-triangle'
            };

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = icon_map[alert_type] || 'fa fa-exclamation';
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            element.textContent = '';
            element.appendChild(alert_div);
        };

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

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, timeline_id, item_id);
            if (!validation.valid) {
                display_message(message_element, 'danger', validation.error);
                return null;
            }

            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Authentication required. Redirecting...');

                setTimeout(() => {
                    authModule.redirect_to_auth();
                }, 1000);

                return null;
            }

            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_item_record?.get?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return null;
            }

            const endpoint = EXHIBITS_ENDPOINTS.exhibits.timeline_item_record.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':timeline_id', encodeURIComponent(timeline_id))
                .replace(':item_id', encodeURIComponent(item_id));

            const params = new URLSearchParams({
                type: 'details'
            });
            const full_url = `${endpoint}?${params.toString()}`;

            const response = await httpModule.req({
                method: 'GET',
                url: full_url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

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
            console.error('Error in get_timeline_item_record:', error);

            const error_message = error.user_message || 'Unable to load the timeline item record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return null;
        }
    }

    /**
     * Disables all interactive form fields on the page.
     * Called after record data is populated so the details page is read-only.
     */
    function disable_all_fields() {

        const form_elements = document.querySelectorAll(
            'input:not([type="hidden"]), textarea, select, button[type="button"]:not(#edit-item-btn)'
        );

        form_elements.forEach(element => {
            if (!element.disabled && !element.readOnly) {
                element.disabled = true;
            }
        });

        // Hide media picker buttons and trash links (not applicable on details view)
        const picker_buttons = document.querySelectorAll('#pick-item-media-btn, #pick-thumbnail-btn');
        picker_buttons.forEach(btn => {
            btn.style.display = 'none';
        });

        const trash_links = document.querySelectorAll('#item-media-trash, #thumbnail-trash');
        trash_links.forEach(link => {
            link.style.display = 'none';
        });
    }

    async function display_details_record() {

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
            if (!message_element) return;

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

            const data = await get_timeline_item_record();

            if (!data || !data.item) {
                throw new Error('Failed to load timeline item record data');
            }

            const record = data.item;

            // Helper for safe DOM value setting
            const set_element_value = (selector, value) => {
                const el = document.querySelector(selector);
                if (el) el.value = value;
            };

            // Display creation/update metadata
            const created_el = document.querySelector('#created');
            if (created_el) {
                const metadata_parts = [];

                if (record.created_by && record.created) {
                    const create_date = new Date(record.created);
                    if (is_valid_date(create_date)) {
                        const created_em = document.createElement('em');
                        created_em.textContent = `Created by ${record.created_by} on ${helperModule.format_date(create_date)}`;
                        metadata_parts.push(created_em);
                    }
                }

                if (record.updated_by && record.updated) {
                    const update_date = new Date(record.updated);
                    if (is_valid_date(update_date)) {
                        const updated_em = document.createElement('em');
                        updated_em.textContent = `Last updated by ${record.updated_by} on ${helperModule.format_date(update_date)}`;
                        metadata_parts.push(updated_em);
                    }
                }

                created_el.textContent = '';
                metadata_parts.forEach((part, index) => {
                    if (index > 0) {
                        created_el.appendChild(document.createTextNode(' | '));
                    }
                    created_el.appendChild(part);
                });
            }

            // Set basic form fields
            set_element_value('#item-title-input', record.title ? helperModule.unescape(record.title) : '');
            set_element_value('#item-text-input', record.text ? helperModule.unescape(record.text) : '');

            // Set date field (extract date portion from ISO string)
            if (record.date) {
                const date_str = String(record.date);
                const date_parts = date_str.split('T');
                set_element_value('#item-date-input', date_parts.length > 0 ? date_parts[0] : '');
            } else {
                set_element_value('#item-date-input', '');
            }

            // Populate media previews using the shared common module
            if (window.location.pathname.indexOf('media') !== -1) {
                itemsCommonVerticalTimelineItemFormModule.populate_media_previews(record);
            }

            // Set embed item checkbox from record
            const embed_item_el = document.getElementById('embed-item');
            if (embed_item_el) {
                embed_item_el.checked = record.is_embedded === 1;
            }

            // Disable all form fields after population (details view is read-only)
            disable_all_fields();

            return false;

        } catch (error) {
            console.error('Error in display_details_record:', error);
            display_error_message('Unable to display the timeline item record. Please try again.');
            return false;
        }
    }

    obj.init = async function () {

        try {

            const status = helperModule.get_parameter_by_name('status');

            if (status !== null && status === '403') {
                domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to edit this record.');
            }

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            exhibitsModule.set_exhibit_title(exhibit_id);
            navModule.set_timeline_item_nav_menu_links();
            await display_details_record();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
