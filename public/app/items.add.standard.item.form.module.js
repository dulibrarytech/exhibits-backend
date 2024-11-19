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

const itemsAddStandardItemFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    /**
     * Sets rich text editor on defined input fields
     */
    function set_rich_text_editors () {
        const ids = ['item-title-input',
            'item-caption-input',
            'item-text-input'];

        ids.forEach((id) => {
            rich_text_data[id] = helperModule.set_rich_text_editor(id);
        });
    }

    /**
     * Creates item
     */
    obj.create_item_record = async function () {

        try {

            window.scrollTo(0, 0);
            let uuid = helperModule.get_parameter_by_name('exhibit_id');

            if (uuid === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create item record.</div>`;
                return false;
            }

            let data = itemsCommonStandardItemFormModule.get_common_standard_item_form_fields(rich_text_data);

            if (data === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === false) {
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating item record...</div>`;

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.item_records.post.endpoint.replace(':exhibit_id', uuid),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Item record created</div>`;

                setTimeout(() => {
                    location.replace(`${APP_PATH}/items?exhibit_id=${uuid}`);
                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Init function for standard item add form
     */
    obj.init = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        exhibitsModule.set_exhibit_title(exhibit_id);

        helperModule.set_rich_text_editor_config();
        set_rich_text_editors();

        document.querySelector('#save-item-btn').addEventListener('click', itemsAddStandardItemFormModule.create_item_record);
    };

    return obj;

}());
