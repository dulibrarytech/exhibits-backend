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

const itemsHeadingEditFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-backend';
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

            if (token === false) {  //  || EXHIBITS_ENDPOINTS === null

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/dashboard/login');
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
     * Gets data from item edit form
     */
    function get_item_heading_data () {

        let item = {};
        item.styles = {
            item: {}
        };

        // item data
        item.title = rich_text_data['item-title-input'].getHTMLCode();
        item.caption = rich_text_data['item-caption-input'].getHTMLCode();
        item.description = rich_text_data['item-description-input'].getHTMLCode();
        item.text = rich_text_data['item-text-input'].getHTMLCode();

        // grid item only
        if (document.querySelector('#item-date')) {
            item.date = document.querySelector('#item-date').value;
        }

        // item media
        if (document.querySelector('#item-thumbnail')) {
            item.thumbnail = document.querySelector('#item-thumbnail').value;
        }

        // TODO: get item type from upload module?
        if (document.querySelector('#item-type')) {
            item.item_type = document.querySelector('#item-type').value;
        }

        if (document.querySelector('#repo-uuid').value.length > 0) {
            item.media = document.querySelector('#repo-uuid').value;
        } else {
            item.media = document.querySelector('#item-media').value;
        }

        item.media_prev = document.querySelector('#item-media-prev').value;

        // item layout - standard item only
        if (document.getElementsByName('layout')) {
            item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));
        }

        if (item.layout.length === 0) {
            item.layout = 'grid';
        }

        // item styles
        let item_background_color = document.querySelector('#item-background-color').value;
        let item_color = document.querySelector('#item-font-color').value;
        let item_font = document.querySelector('#item-font').value;

        if (item_background_color.length > 0) {
            item.styles.item.backGroundColor = item_background_color;
        }

        if (item_color.length > 0) {
            item.styles.item.color = item_color;
        }

        if (item_font.length > 0) {
            item.styles.item.fontFamily = item_font;
        }

        console.log('edit item data ', item.styles);

        return item;
    }

    /**
     * Populates edit form with exhibit record data
     */
    async function display_edit_record () {

        let record = await get_item_heading_record();
        console.log('display: ', record);

        // item data
        document.querySelector('#item-heading-text').value = record.text;

        // item styles
        let styles;

        if (typeof record.styles === 'string') {
            styles = JSON.parse(record.styles);
        }

        if (Object.keys(styles).length !== 0) {

            console.log(styles);

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
            document.querySelector('.card').style.visibility = 'hidden';
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating item record...</div>`;
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let data = get_item_data();
            let token = authModule.get_user_token();
            let response;
            console.log(data);
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

            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);

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
                    // TODO
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

        /*
        document.querySelector('#save-item-btn').addEventListener('click', itemsHeadingEditFormModule.update_item_heading_record);
        document.querySelector('#logout').addEventListener('click', authModule.logout);
        */

        /*
        // bind color pickers to input fields
        document.querySelector('#item-background-color-picker').addEventListener('input', () => {
            if (document.querySelector('#item-background-color')) {
                document.querySelector('#item-background-color').value = document.querySelector('#item-background-color-picker').value;
            }
        });

        document.querySelector('#item-font-color-picker').addEventListener('input', () => {
            if (document.querySelector('#item-font-color')) {
                document.querySelector('#item-font-color').value = document.querySelector('#item-font-color-picker').value;
            }
        });

         */

        await display_edit_record();
    };

    return obj;

}());
