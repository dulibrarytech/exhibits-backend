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

const itemsEditHeadingFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    async function get_item_heading_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.heading_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':heading_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/login');
                }, 1000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint + '?type=edit&uid=' + profile.uid,
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

    async function display_edit_record () {

        let record = await get_item_heading_record();
        let styles;
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

        helperModule.check_if_locked(record, '#item-submit-card');

        if (created_by !== null) {
            item_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
        }

        if (updated_by !== null) {
            item_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
        }

        document.querySelector('#created').innerHTML = item_created;
        document.querySelector('#item-heading-text-input').value = helperModule.unescape(record.text);

        if (document.querySelector('#is-published') !== null && is_published === 1) {
            document.querySelector('#is-published').value = true;
        } else if (document.querySelector('#is-published') !== null && is_published === 0) {
            document.querySelector('#is-published').value = false;
        }

        if (typeof record.styles === 'string') {
            styles = JSON.parse(record.styles);
        }

        if (Object.keys(styles).length !== 0) {

            if (styles.backgroundColor !== undefined && styles.backgroundColor.length !== 0) {
                document.querySelector('#heading-background-color').value = styles.backgroundColor;
                document.querySelector('#heading-background-color-picker').value = styles.backgroundColor;
            }

            if (styles.color !== undefined && styles.color.length !== 0) {
                document.querySelector('#heading-font-color').value = styles.color;
                document.querySelector('#heading-font-color-picker').value = styles.color;
            }

            if (styles.fontSize !== undefined) {
                document.querySelector('#heading-font-size').value = styles.fontSize.replace('px', '');
            } else {
                document.querySelector('#heading-font-size').value = '';
            }

            let font_values = document.querySelector('#heading-font');

            for (let i = 0;i<font_values.length;i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#heading-font').value = styles.fontFamily;
                }
            }
        }

        return false;
    }

    obj.update_item_heading_record = async function () {

        try {

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating heading record...</div>`;
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let token = authModule.get_user_token();
            let data = itemsCommonHeadingFormModule.get_common_heading_form_fields(rich_text_data);
            let response;

            if (data === false) {
                return false;
            }

            if (exhibit_id === undefined || item_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get record ID</div>`;
                return false;
            }

            if (token === false) {
                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            const user = JSON.parse(sessionStorage.getItem('exhibits_user'));

            if (user.name === null) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to retrieve your name</div>`;
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

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Heading record updated</div>`;

                setTimeout(() => {
                    window.location.reload();
                    // window.location.replace('edit?exhibit_id=' + exhibit_id + '&item_id=' + item_id);
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const heading_id = helperModule.get_parameter_by_name('item_id');
            const redirect = '/items/heading/details?exhibit_id=' + exhibit_id + '&item_id=' + heading_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'heading_item', exhibit_id, redirect);
            await exhibitsModule.set_exhibit_title(exhibit_id);

            document.querySelector('#save-heading-btn').addEventListener('click', await itemsEditHeadingFormModule.update_item_heading_record);
            await display_edit_record();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
