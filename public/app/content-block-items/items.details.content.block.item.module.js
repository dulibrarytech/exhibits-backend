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

const itemsDetailsContentBlockModule = (function () {

    'use strict';

    // const APP_PATH = endpointsModule.get_app_path();
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_content_block_record() {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.content_block_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':content_block_id', item_id);

            if (token === false) {

                domModule.set_alert('#message', 'danger', 'Unable to get API endpoints');

                setTimeout(() => {
                    authModule.redirect_to_auth();
                }, 1000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint + '?type=details',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
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
    }

    async function display_details_record() {

        const record = await get_content_block_record();

        if (!record) {
            console.error('No record returned from get_content_block_record()');
            return false;
        }

        // Helper function to safely set checkbox state
        const set_checkbox_state = (selector, is_checked) => {
            const element = document.querySelector(selector);
            if (element) {
                element.checked = Boolean(is_checked);
            }
        };

        // Helper for safe DOM value setting
        const set_element_value = (selector, value) => {
            const el = document.querySelector(selector);
            if (el) el.value = value;
        };

        // Format and display creation/update metadata
        const create_datetime = helperModule.format_date(new Date(record.created));
        const update_datetime = helperModule.format_date(new Date(record.updated));
        const metadata_parts = [];

        if (record.created_by) {
            metadata_parts.push(`<em>Created by ${record.created_by} on ${create_datetime}</em>`);
        }
        if (record.updated_by) {
            metadata_parts.push(`<em>Last updated by ${record.updated_by} on ${update_datetime}</em>`);
        }

        const created_el = document.querySelector('#created');
        if (created_el) {
            created_el.innerHTML = metadata_parts.join(' | ');
        }

        // Set published status
        const published_el = document.querySelector('#is-published');
        if (published_el) {
            published_el.value = record.is_published === 1;
        }

        set_element_value('#content-type', record.content_type);

        // Set content block data
        if (record.content_type === 'button') {
            rteModule.render_static('button-text-input', helperModule.unescape(record.text));
            set_element_value('#button-size', record.size);
            set_checkbox_state('#button-transparent', record.transparent);
            set_element_value('#button-url-input', record.url);
        } else if (record.content_type === 'card') {
            rteModule.set_html('card-title-input', helperModule.unescape(record.title));
            rteModule.set_html('card-text-input', helperModule.unescape(record.text));
        } else if (record.content_type === 'divider') {
            set_element_value('#divider-size', record.size);
        } else if (record.content_type === 'emphasis') {
            rteModule.render_static('emphasis-text-input', helperModule.unescape(record.text));
        } else if (record.content_type === 'quote') {
            rteModule.render_static('quote-text-input', helperModule.unescape(record.text));
            set_element_value('#quote-attribution-input', record.attribution);
        }

        // Disable all form fields after population (details view is read-only)
        disable_all_fields();

        return false;
    }

    obj.init = async function () {

        try {

            const status = helperModule.get_parameter_by_name('status');

            if (status !== null && status === '403') {
                window.scrollTo(0, 0);
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
