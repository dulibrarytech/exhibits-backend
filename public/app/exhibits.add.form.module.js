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

const exhibitsAddFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    /*
    function set_rich_text_editors () {
        const ids = [//'exhibit-title-input',
            // 'exhibit-sub-title-input',
            // 'exhibit-alert-text-input',
            // 'exhibit-description-input',
            // 'exhibit-about-the-curators-input'
            ];

            ids.forEach((id) => {
            rich_text_data[id] = helperModule.set_rich_text_editor(id);
        });
    }

     */

    function get_exhibit_data () {

        try {

            let exhibit = exhibitsCommonFormModule.get_common_form_fields(rich_text_data);

            if (exhibit === false) {
                return exhibit;
            }

            exhibit.styles = exhibitsCommonFormModule.get_exhibit_styles();

            return exhibit;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.create_exhibit_record = async function () {

        try {

            scrollTo(0, 0);
            let token = authModule.get_user_token();
            let response;
            let data = get_exhibit_data();

            if (data === false) {
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating exhibit record...</div>`;

            if (token === false) {

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Exhibit record created</div>`;

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/items?exhibit_id=' + response.data.data);
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = function () {

        try {

            // helperModule.set_rich_text_editor_config();
            // set_rich_text_editors();
            document.querySelector('#save-exhibit-btn').addEventListener('click', exhibitsAddFormModule.create_exhibit_record);
            document.querySelector('#hero-trash').addEventListener('click', exhibitsCommonFormModule.delete_hero_image);
            document.querySelector('#thumbnail-trash').addEventListener('click', exhibitsCommonFormModule.delete_thumbnail_image);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
