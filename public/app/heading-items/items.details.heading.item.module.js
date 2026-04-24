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

const itemsDetailsHeadingModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_item_heading_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.heading_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':heading_id', item_id);

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

    async function display_edit_record () {

        let record = await get_item_heading_record();
        let is_published = record.is_published;
        let created_by = record.created_by;
        let created = record.created;
        let create_date = new Date(created);
        let updated_by = record.updated_by;
        let updated = record.updated;
        let update_date = new Date(updated);
        let item_created = '';
        let create_date_time = helperModule.format_date(create_date);
        let update_date_time = helperModule.format_date(update_date);

        // lockModule.check_if_locked(record, '#item-submit-card');

        if (created_by !== null) {
            item_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
        }

        if (updated_by !== null) {
            item_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
        }

        const created_elem = document.querySelector('#created');
        if (created_elem) {
            created_elem.innerHTML = item_created;
        }
        document.querySelector('#item-heading-text-input').value = helperModule.unescape(record.text);
        document.querySelector('#item-heading-type-input').value = record.type;

        if (document.querySelector('#is-published') !== null && is_published === 1) {
            document.querySelector('#is-published').value = true;
        } else if (document.querySelector('#is-published') !== null && is_published === 0) {
            document.querySelector('#is-published').value = false;
        }

        return false;
    }

    /*
    obj.update_item_heading_record = async function () {

        try {

            scrollTo(0, 0);
            domModule.set_alert(document.querySelector('#message'), 'info', 'Updating heading record...');
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let token = authModule.get_user_token();
            let data = itemsCommonHeadingFormModule.get_common_heading_form_fields(rich_text_data);
            let response;

            if (data === false) {
                return false;
            }

            if (exhibit_id === undefined || item_id === undefined) {
                domModule.set_alert(document.querySelector('#message'), 'danger', 'Unable to get record ID');
                return false;
            }

            if (token === false) {
                setTimeout(() => {
                    domModule.set_alert(document.querySelector('#message'), 'danger', 'Unable to get session token');
                    authModule.logout();
                }, 1000);

                return false;
            }

            const user = JSON.parse(sessionStorage.getItem('exhibits_user'));

            if (user.name === null) {
                domModule.set_alert(document.querySelector('#message'), 'danger', 'Unable to retrieve your name');
                return false;
            }

            data.updated_by = user.name;

            let tmp = EXHIBITS_ENDPOINTS.exhibits.heading_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':heading_id', item_id);

            response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                domModule.set_alert(document.querySelector('#message'), 'success', 'Heading record updated');

                setTimeout(() => {
                    window.location.reload();
                    // window.location.replace('edit?exhibit_id=' + exhibit_id + '&item_id=' + item_id);
                }, 900);
            }

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

     */

    obj.init = async function () {

        try {

            const status = helperModule.get_parameter_by_name('status');

            if (status !== null && status === '403') {
                window.scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to edit this record.');
            }

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            await exhibitsModule.set_exhibit_title(exhibit_id);

            await display_edit_record();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
