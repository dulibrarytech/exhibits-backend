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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
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

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/exhibits-dashboard/auth');
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
                return response.data.data[0];
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.update_grid_record = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('item_id');
            const data = itemsCommonStandardGridFormModule.get_common_grid_form_fields();

            if (exhibit_id === undefined || grid_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to update grid record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating grid record...</div>`;

            const user = JSON.parse(sessionStorage.getItem('exhibits_user'));

            if (user.name === null) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to retrieve your name</div>`;
                return false;
            }

            data.updated_by = user.name;

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
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Grid record updated</div>`;
                const grid_id = response.data.data;

                setTimeout(() => {
                    window.location.reload();
                    // location.replace(`${APP_PATH}/items?exhibit_id=${exhibit_id}`);
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
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

        document.querySelector('#created').innerHTML = item_created;
        document.querySelector('#grid-title-input').value = helperModule.unescape(record.title);
        document.querySelector('#grid-text-input').value = helperModule.unescape(record.text);
        document.querySelector('#grid-columns').value = record.columns;

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

        return false;
    }

    obj.init = async function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        exhibitsModule.set_exhibit_title(exhibit_id);
        document.querySelector('#save-item-btn').addEventListener('click', itemsEditGridFormModule.update_grid_record);
        await display_edit_record();
    };

    return obj;

}());
