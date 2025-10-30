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
                return response.data.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

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

        return false;
    }

    obj.init = async function () {

        const status = helperModule.get_parameter_by_name('status');

        if (status !== null && status === '403') {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to edit this record.</div>`;
        }

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        exhibitsModule.set_exhibit_title(exhibit_id);
        await display_edit_record();
    };

    return obj;

}());
