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

const itemsEditVerticalTimelineFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    function set_rich_text_editors () {
        const ids = ['timeline-title-input'];

        ids.forEach((id) => {
            rich_text_data[id] = helperModule.set_rich_text_editor(id);
        });
    }

    async function get_timeline_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.timeline_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':timeline_id', timeline_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/exhibits-dashboard/auth');
                }, 3000);

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

    obj.update_timeline_record = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('item_id');

            if (exhibit_id === undefined || timeline_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to update timeline record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating timeline record...</div>`;

            const data = itemsCommonVerticalTimelineFormModule.get_common_timeline_form_fields(rich_text_data);
            let tmp = EXHIBITS_ENDPOINTS.exhibits.timeline_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':timeline_id', timeline_id);
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
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Timeline record created</div>`;
                const timeline_id = response.data.data;
                console.log(timeline_id);
                setTimeout(() => {
                    location.replace(`${APP_PATH}/items?exhibit_id=${exhibit_id}`);
                }, 1000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    async function display_edit_record () {

        let record = await get_timeline_record();

        rich_text_data['timeline-title-input'] = helperModule.set_rich_text_editor('timeline-title-input');
        rich_text_data['timeline-title-input'].setHTMLCode(helperModule.unescape(record.title));

        let styles = JSON.parse(record.styles);

        if (Object.keys(styles).length !== 0) {

            if (styles.backgroundColor !== undefined) {
                document.querySelector('#timeline-background-color').value = styles.backgroundColor;
            } else {
                document.querySelector('#timeline-background-color').value = '';
            }

            if (styles.color !== undefined) {
                document.querySelector('#timeline-font-color').value = styles.color;
            } else {
                document.querySelector('#timeline-font-color').value = '';
            }

            let font_values = document.querySelector('#timeline-font');

            for (let i=0;i<font_values.length;i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#timeline-font').value = styles.fontFamily;
                }
            }

            if (styles.fontSize !== undefined) {
                document.querySelector('#timeline-font-size').value = styles.fontSize.replace('px', '');
            } else {
                document.querySelector('#timeline-font-size').value = '';
            }
        }

        return false;
    }

    obj.init = async function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        exhibitsModule.set_exhibit_title(exhibit_id);
        helperModule.set_rich_text_editor_config();
        set_rich_text_editors();
        document.querySelector('#save-timeline-btn').addEventListener('click', itemsEditVerticalTimelineFormModule.update_timeline_record);
        await display_edit_record();
    };

    return obj;

}());
