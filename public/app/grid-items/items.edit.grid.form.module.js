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

const itemsEditGridFormModule = (function () {

    'use strict';

    // const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_grid_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':grid_id', grid_id);

            if (token === false) {

                domModule.set_alert('#message', 'danger', 'Unable to get API endpoints');

                setTimeout(() => {
                    authModule.redirect_to_auth();
                }, 1000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint,
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

    obj.update_grid_record = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('item_id');
            const data = itemsCommonStandardGridFormModule.get_common_grid_form_fields();

            if (exhibit_id === undefined || grid_id === undefined) {
                domModule.set_alert(document.querySelector('#message'), 'warning', 'Unable to update grid record.');
                return false;
            }

            domModule.set_alert(document.querySelector('#message'), 'info', 'Updating grid record...');

            data.updated_by = helperModule.get_user_name();

            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':grid_id', grid_id);
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
                domModule.set_alert(document.querySelector('#message'), 'success', 'Grid record updated');

                // Refresh the display with updated data instead of reloading
                await display_edit_record();

                // Auto-dismiss success message after a delay
                setTimeout(() => {
                    const message_el = document.querySelector('#message');
                    if (message_el) {
                        message_el.innerHTML = '';
                    }
                }, 3000);
            }

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    async function display_edit_record () {

        let record = await get_grid_record();
        let created_by = record.created_by;
        let created = record.created;
        let create_date = new Date(created);
        let updated_by = record.updated_by;
        let updated = record.updated;
        let update_date = new Date(updated);
        let item_created = '';
        let create_date_time = helperModule.format_date(create_date);
        let update_date_time = helperModule.format_date(update_date);

        if (created_by !== null) {
            item_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
        }

        if (updated_by !== null) {
            item_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
        }

        domModule.html('#created', item_created);
        domModule.set_value('#grid-text-input', helperModule.unescape(record.text));
        domModule.set_value('#grid-columns', record.columns);

        // Set saved style selection after dropdown is populated
        // Style keys are simple strings like "item1"; skip "{}" (prepare_styles default) and legacy JSON blobs
        if (record.styles && typeof record.styles === 'string'
            && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
            await itemsCommonStandardGridFormModule.wait_for_styles();
            itemsCommonStandardGridFormModule.set_item_style(record.styles);
        }

        /*
        let styles = JSON.parse(record.styles);

        if (Object.keys(styles).length !== 0) {

            if (styles.backgroundColor !== undefined) {
                document.querySelector('#grid-background-color').value = styles.backgroundColor;
                document.querySelector('#grid-background-color-picker').value = styles.backgroundColor;
            } else {
                document.querySelector('#grid-background-color').value = '';
            }

            if (styles.color !== undefined) {
                document.querySelector('#grid-font-color').value = styles.color;
                document.querySelector('#grid-font-color-picker').value = styles.color;
            } else {
                document.querySelector('#grid-font-color').value = '';
            }

            let font_values = document.querySelector('#grid-font');

            for (let i=0;i<font_values.length;i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#grid-font').value = styles.fontFamily;
                }
            }

            if (styles.fontSize !== undefined) {
                document.querySelector('#grid-font-size').value = styles.fontSize.replace('px', '');
            } else {
                document.querySelector('#grid-font-size').value = '';
            }
        }

         */

        return false;
    }

    obj.init = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const item_id = helperModule.get_parameter_by_name('item_id');
        const redirect = '/items/grid/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
        await authModule.check_permissions(['update_item', 'update_any_item'], 'grid', exhibit_id, item_id, redirect);
        // Note: #back-to-items and #grid-items hrefs are now wired by navModule.wire_nav_links()
        exhibitsModule.set_exhibit_title(exhibit_id);
        domModule.on('#save-item-btn', 'click', itemsEditGridFormModule.update_grid_record);
        await display_edit_record();
    };

    return obj;

}());
