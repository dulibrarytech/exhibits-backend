/**

 Copyright 2023 University of Denver

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

const itemsAddGridFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_grid_record = async function () {

        try {

            window.scrollTo(0, 0);
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (exhibit_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create grid record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating grid record...</div>`;

            const data = itemsCommonStandardGridFormModule.get_common_grid_form_fields();

            if (data === false) {
                return false;
            }

            /*
            const user = JSON.parse(sessionStorage.getItem('exhibits_user'));

            if (user.name === null) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to retrieve your name</div>`;
                return false;
            }
            */

            data.created_by = helperModule.get_user_name(); // user.name;
            data.owner = helperModule.get_owner();

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.grid_records.post.endpoint.replace(':exhibit_id', exhibit_id),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                window.scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Grid record created</div>`;
                const grid_id = response.data.data;

                setTimeout(() => {
                    location.replace(`${APP_PATH}/items/grid/edit?exhibit_id=${exhibit_id}&item_id=${grid_id}`);
                }, 900);
            } else if (response === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to add item to this exhibit.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const redirect = '/items?exhibit_id=' + exhibit_id + '&status=403';
        await authModule.check_permissions(['add_item', 'add_item_to_any_exhibit'], 'grid', exhibit_id, null, redirect);

        exhibitsModule.set_exhibit_title(exhibit_id);
        document.querySelector('#save-item-btn').addEventListener('click', itemsAddGridFormModule.create_grid_record);

    };

    return obj;

}());
