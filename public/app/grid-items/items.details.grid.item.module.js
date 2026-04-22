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

const itemsDetailsGridItemModule = (function () {

    'use strict';

    // const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_item_record() {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_record.get.endpoint.replace(':exhibit_id', exhibit_id);
            tmp = tmp.replace(':grid_id', grid_id);
            let endpoint = tmp.replace(':item_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

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

        const record = await get_item_record();

        if (!record) {
            console.error('No record returned from get_item_record()');
            return false;
        }

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

        // Set basic item data
        set_element_value('#item-title-input', helperModule.unescape(record.title));
        set_element_value('#item-text-input', helperModule.unescape(record.text));

        // Populate media previews using the shared common module
        if (window.location.pathname.indexOf('media') !== -1) {
            itemsCommonGridItemFormModule.populate_media_previews(record);
        }

        // Set radio button selections
        const set_radio_value = (name, value) => {
            const elements = document.getElementsByName(name);
            for (const el of elements) {
                if (el.value === value) {
                    const target = document.querySelector('#' + el.id);
                    if (target) target.checked = true;
                    break;
                }
            }
        };

        set_radio_value('layout', record.layout);
        set_radio_value('media_width', String(record.media_width));

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
