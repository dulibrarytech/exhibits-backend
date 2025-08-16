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

const itemsDetailsTimelineItemModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_timeline_item_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_record.get.endpoint.replace(':exhibit_id', exhibit_id);
            let itmp = etmp.replace(':timeline_id', timeline_id);
            let endpoint = itmp.replace(':item_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

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
                return response.data.data[0];
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function display_edit_record () {

        try {

            let record = await get_timeline_item_record();
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

            // item data
            document.querySelector('#item-title-input').value = helperModule.unescape(record.title);
            document.querySelector('#item-text-input').value = helperModule.unescape(record.text);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.display_media_fields_common(record);
            }

            let date_arr = record.date.split('T');
            document.querySelector('#item-date-input').value = date_arr.shift();

            /*
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

                for (let i=0;i<font_values.length;i++) {
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

             */

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.init = async function () {

        try {

            const status = helperModule.get_parameter_by_name('status');

            if (status !== null && status === '403') {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to edit this record.</div>`;
            }

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            exhibitsModule.set_exhibit_title(exhibit_id);
            navModule.set_timeline_item_nav_menu_links();
            await display_edit_record();

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());