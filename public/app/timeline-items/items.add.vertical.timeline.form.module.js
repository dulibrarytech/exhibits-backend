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

const itemsAddVerticalTimelineFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_timeline_record = async function () {

        try {

            window.scrollTo(0, 0);
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (exhibit_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create timeline record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating timeline record...</div>`;

            const data = itemsCommonVerticalTimelineFormModule.get_common_timeline_form_fields();

            if (data === false) {
                return false;
            }

            data.created_by = helperModule.get_user_name();
            data.owner = helperModule.get_owner();

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.timeline_records.post.endpoint.replace(':exhibit_id', exhibit_id),
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
                    window.location.replace(`${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${exhibit_id}&item_id=${timeline_id}`);
                }, 900);
            } else if (response === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to add item to this exhibit.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const redirect = '/items?exhibit_id=' + exhibit_id + '&status=403';
            await authModule.check_permissions(['add_item', 'add_item_to_any_exhibit'], 'grid', exhibit_id, null, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            document.querySelector('#save-timeline-btn').addEventListener('click', itemsAddVerticalTimelineFormModule.create_timeline_record);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
