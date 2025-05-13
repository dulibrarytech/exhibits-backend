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

const itemsAddVerticalTimelineItemFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_grid_item_record = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');

            if (timeline_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create timeline item record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating timeline item record...</div>`;

            let data = itemsCommonVerticalTimelineItemFormModule.get_common_timeline_item_form_fields();

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

            data.created_by = user.name;

            let tmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.post.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':timeline_id', timeline_id);
            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                let message = 'Timeline item record created';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> ${message}</div>`;

                const timeline_item_id = response.data.data;

                setTimeout(() => {
                    window.location.replace(`${APP_PATH}/items/vertical-timeline/item/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${timeline_item_id}`);
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            exhibitsModule.set_exhibit_title(exhibit_id);

            uploadsModule.upload_item_media();
            uploadsModule.upload_item_thumbnail();

            document.querySelector('#save-item-btn').addEventListener('click', itemsAddVerticalTimelineItemFormModule.create_grid_item_record);
            document.querySelector('#item-media-trash').style.display = 'none';
            document.querySelector('#item-thumbnail-trash').style.display = 'none';
            document.querySelectorAll('.item-layout-left-right-radio-btn').forEach((radio_input) => {
                radio_input.addEventListener('click', () => {
                    document.querySelector('#item-media-width').style.display = 'block';
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
