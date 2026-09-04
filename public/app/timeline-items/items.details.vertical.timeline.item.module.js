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

const itemsDetailsVerticalTimelineItemModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_timeline_item_record() {

        const message_element = document.querySelector('#message');

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
                domModule.set_alert(message_element, 'danger', validation.error);
                return null;
            }

            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_item_record?.get?.endpoint) {
                domModule.set_alert(message_element, 'danger', 'API endpoint configuration missing');
                return null;
            }

            const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.timeline_item_record.get.endpoint, {
                exhibit_id: exhibit_id,
                timeline_id: timeline_id,
                item_id: item_id
            });

            const params = new URLSearchParams({
                type: 'details'
            });
            const full_url = `${endpoint}?${params.toString()}`;

            /* null = missing token; httpModule.api has alerted and scheduled the logout */
            const response = await httpModule.api({
                method: 'GET',
                url: full_url
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
            domModule.set_alert(message_element, 'danger', error_message);

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

        // Rich text editors are div-based and not caught by the selector above
        if (typeof rteModule !== 'undefined') {
            rteModule.set_all_enabled(false);
        }

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

        try {

            const record = await get_timeline_item_record();

            if (!record) {
                throw new Error('Failed to load timeline item record data');
            }

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
            rteModule.render_static('item-title-input', record.title ? helperModule.unescape(record.title) : '');
            rteModule.render_static('item-text-input', record.text ? helperModule.unescape(record.text) : '');

            // Set date field (extract date portion from ISO string)
            if (record.date) {
                const date_str = String(record.date);
                const date_parts = date_str.split('T');
                domModule.set_value('#item-date-input', date_parts.length > 0 ? date_parts[0] : '');
            } else {
                domModule.set_value('#item-date-input', '');
            }

            // Populate media previews using the shared common module
            if (window.location.pathname.indexOf('media') !== -1) {
                itemsCommonVerticalTimelineItemFormModule.populate_media_previews(record);

                // Surface the Pop-up Window Description + Caption read-only.
                rteModule.render_static('item-description-input', record.description ? helperModule.unescape(record.description) : '');
                rteModule.render_static('item-caption-input', record.caption ? helperModule.unescape(record.caption) : '');
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
            domModule.set_alert('#message', 'danger', 'Unable to display the timeline item record. Please try again.');
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
            await display_details_record();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
