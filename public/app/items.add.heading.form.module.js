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

const itemsAddHeadingFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Creates item heading
     */
    obj.create_heading_record = async function () {

        try {

            window.scrollTo(0, 0);
            let exhibit_id = helperModule.get_parameter_by_name('uuid');

            if (exhibit_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create item heading record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating item heading record...</div>`;
            let data = itemsCommonHeadingFormModule.get_common_heading_form_fields();

            if (data === false) {
                return false;
            }

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.heading_records.post.endpoint.replace(':exhibit_id', exhibit_id),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#item-heading-card').style.visibility = 'hidden';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Heading record created</div>`;

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/items?uuid=' + exhibit_id);
                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Init function for headings form
     */
    obj.init = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        exhibitsModule.set_exhibit_title(exhibit_id);

        document.querySelector('#save-heading-btn').addEventListener('click', itemsAddHeadingFormModule.create_heading_record);
    };

    return obj;

}());
