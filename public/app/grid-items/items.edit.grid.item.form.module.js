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

const itemsEditGridItemFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_grid_item_record() {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();
            let etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_record.get.endpoint.replace(':exhibit_id', exhibit_id);
            let itmp = etmp.replace(':grid_id', grid_id);
            let endpoint = itmp.replace(':item_id', item_id);

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

        try {

            let record = await get_grid_item_record();
            let thumbnail_fragment = '';
            let thumbnail_url = '';
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

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.update_grid_item_record = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            if (exhibit_id === undefined || grid_id === undefined || item_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to update grid item record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating grid item record...</div>`;

            let data = itemsCommonGridItemFormModule.get_common_grid_item_form_fields();

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

            let etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let itmp = etmp.replace(':grid_id', grid_id);
            let endpoint = itmp.replace(':item_id', item_id);
            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                let message = 'Grid item record updated';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> ${message}</div>`;

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
            exhibitsModule.set_exhibit_title(exhibit_id);
            navModule.back_to_grid_items();
            await display_edit_record();
            document.querySelector('#save-item-btn').addEventListener('click', itemsEditGridItemFormModule.update_grid_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
