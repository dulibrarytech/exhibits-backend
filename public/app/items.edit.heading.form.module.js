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

const itemsEditHeadingFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    /**
     * Gets item heading record
     */
    async function get_item_heading_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.heading_records.get.endpoint.replace(':exhibit_id', exhibit_id)
            let endpoint = tmp.replace(':heading_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/login');
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
            console.log('ERROR: ', error.message);
        }
    }

    /**
     * Populates edit form with item heading record data
     */
    async function display_edit_record () {

        let record = await get_item_heading_record();

        // item data
        document.querySelector('#item-heading-text').value = record.text;

        // item styles
        let styles;

        if (typeof record.styles === 'string') {
            styles = JSON.parse(record.styles);
        }

        if (Object.keys(styles).length !== 0) {

            document.querySelector('#heading-background-color').value = styles.backGroundColor;
            document.querySelector('#heading-font-color').value = styles.color;

            let font_values = document.querySelector('#heading-font');

            for (let i = 0;i<font_values.length;i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#heading-font').value = styles.fontFamily;
                }
            }
        }

        return false;
    }

    /**
     * Updates item record
     */
    obj.update_item_heading_record = async function () {

        try {

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating heading record...</div>`;
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let token = authModule.get_user_token();
            let data = itemsCommonHeadingFormModule.get_common_heading_form_fields();
            let response;

            if (exhibit_id === undefined || item_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get record ID</div>`;
                return false;
            }

            if (token === false) {
                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 3000);

                return false;
            }

            let tmp = EXHIBITS_ENDPOINTS.exhibits.heading_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':heading_id', item_id);

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
                    window.location.replace('edit?exhibit_id=' + exhibit_id + '&item_id=' + item_id);
                }, 2000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     *
     */
    obj.init = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        await exhibitsModule.set_exhibit_title(exhibit_id);

        document.querySelector('#save-heading-btn').addEventListener('click', await itemsEditHeadingFormModule.update_item_heading_record);
        await display_edit_record();
    };

    return obj;

}());
