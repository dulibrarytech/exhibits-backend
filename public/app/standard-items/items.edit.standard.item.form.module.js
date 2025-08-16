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

const itemsEditStandardItemFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    let obj = {};

    async function get_item_record() {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/exhibits-dashboard/auth');
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

    async function display_edit_record() {

        const record = await get_item_record();
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

        helperModule.check_if_locked(record, '#exhibit-submit-card');

        if (created_by !== null) {
            item_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
        }

        if (updated_by !== null) {
            item_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
        }

        document.querySelector('#created').innerHTML = item_created;

        if (document.querySelector('#is-published') !== null && is_published === 1) {
            document.querySelector('#is-published').value = true;
        } else if (document.querySelector('#is-published') !== null && is_published === 0) {
            document.querySelector('#is-published').value = false;
        }

        // item data
        document.querySelector('#item-title-input').value = helperModule.unescape(record.title);
        document.querySelector('#item-text-input').value = helperModule.unescape(record.text);

        if (window.location.pathname.indexOf('media') !== -1) {
            await helperMediaModule.display_media_fields_common(record);
        }

        let layouts = document.getElementsByName('layout');

        for (let j = 0; j < layouts.length; j++) {
            if (layouts[j].value === record.layout) {
                document.querySelector('#' + layouts[j].id).checked = true;
            }
        }

        let media_width = document.getElementsByName('media_width');

        for (let j = 0; j < media_width.length; j++) {
            if (parseInt(media_width[j].value) === parseInt(record.media_width)) {
                document.querySelector('#' + media_width[j].id).checked = true;
            }
        }

        // TODO: move to style helper
        let styles = JSON.parse(record.styles);

        if (Object.keys(styles).length !== 0) {

            if (styles.backgroundColor !== undefined) {
                document.querySelector('#item-background-color').value = styles.backgroundColor;
                document.querySelector('#item-background-color-picker').value = styles.backgroundColor;
            } else {
                document.querySelector('#item-background-color').value = '';
            }

            if (styles.color !== undefined) {
                document.querySelector('#item-font-color').value = styles.color;
                document.querySelector('#item-font-color-picker').value = styles.color;
            } else {
                document.querySelector('#item-font-color').value = '';
            }

            let font_values = document.querySelector('#item-font');

            for (let i = 0; i < font_values.length; i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#item-font').value = styles.fontFamily;
                }
            }

            if (styles.fontSize !== undefined) {
                document.querySelector('#item-font-size').value = styles.fontSize.replace('px', '');
            } else {
                document.querySelector('#item-font-size').value = '';
            }
        }

        return false;
    }

    obj.update_item_record = async function () {

        try {

            scrollTo(0, 0);
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let data = itemsCommonStandardItemFormModule.get_common_standard_item_form_fields();
            let token = authModule.get_user_token();
            let response;

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

            if (data === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === false) {
                return false;
            }

            const user = JSON.parse(sessionStorage.getItem('exhibits_user'));

            if (user.name === null) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to retrieve your name</div>`;
                return false;
            }

            data.updated_by = user.name;

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating item record...</div>`;

            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);

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

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Item record updated</div>`;

                setTimeout(() => {
                    window.location.reload();
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            let type = 'media';

            if (window.location.pathname.indexOf('text')) {
                type = 'text';
            }

            const redirect = '/items/standard/' + type + '/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'item', exhibit_id, item_id, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            await display_edit_record();
            document.querySelector('#update-item-btn').addEventListener('click', itemsEditStandardItemFormModule.update_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
