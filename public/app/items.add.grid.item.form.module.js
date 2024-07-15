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

const itemsAddGridItemFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    /** TODO: make it reusable
     * Sets rich text editor on defined input fields
     */
    function set_rich_text_editors() {
        const ids = ['item-title-input',
            'item-caption-input',
            'item-description-input',
            'item-text-input'];

        ids.forEach((id) => {
            rich_text_data[id] = helperModule.set_rich_text_editor(id);
        });
    }

    /**
     * Gets grid item data from form
     */
    function get_grid_item_data() {

        let item = {};
        item.styles = {};

        // item metadata
        item.title = rich_text_data['item-title-input'].getHTMLCode();
        item.caption = rich_text_data['item-caption-input'].getHTMLCode();
        item.description = rich_text_data['item-description-input'].getHTMLCode();
        item.text = rich_text_data['item-text-input'].getHTMLCode();

        item.date = document.querySelector('#item-date').value;

        // item media
        item.thumbnail = document.querySelector('#item-thumbnail').value;
        item.item_type = document.querySelector('#item-type').value;
        item.media = document.querySelector('#item-media').value;
        item.repo_uuid = document.querySelector('#repo-uuid').value;

        // item layout - standard item only
        item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));

        if (item.layout.length === 0) {
            item.layout = 'grid';
        }

        // item styles
        let item_background_color = document.querySelector('#item-background-color').value;
        let item_color = document.querySelector('#item-font-color').value;
        let item_font = document.querySelector('#item-font').value;

        if (item_background_color.length > 0) {
            item.styles.backGroundColor = item_background_color;
        }

        if (item_color.length > 0) {
            item.styles.color = document.querySelector('#item-font-color').value;
        }

        if (item_font.length > 0) {
            item.styles.fontFamily = item_font;
        }

        return item;
    }

    /**
     * Creates grid item
     */
    obj.create_grid_item_record = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');

            if (grid_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create item record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating item record...</div>`;

            let data = get_grid_item_data();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.post.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':grid_id', grid_id);
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

                document.querySelector('#item-card').style.visibility = 'hidden';

                let message = 'Grid item record created';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> ${message}</div>`;

                setTimeout(() => {

                    location.replace(`${APP_PATH}/items/grid/list?exhibit_id=${exhibit_id}&grid_id=${grid_id}`);

                    /* TODO: load template showing grid items and provide ability to add more items

                    if (itemsFormModule.check_grid() === true) {
                        location.replace(`${APP_PATH}/items/standard?uuid=${uuid}&grid=${grid_id}`);
                    } else {
                        location.replace(`${APP_PATH}/items/standard?uuid=${uuid}`);
                    }

                     */

                }, 2000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * init function for standard items form
     */
    obj.init = function () {

        helperModule.set_rich_text_editor_config();
        set_rich_text_editors();

        // itemsFormModule.set_items_form_nav_menu_links();
        uploadsModule.upload_item_media();
        uploadsModule.upload_item_thumbnail();
        // itemsFormModule.check_grid();

        document.querySelector('#save-item-btn').addEventListener('click', itemsAddGridItemFormModule.create_grid_item_record);
        document.querySelector('#item-media-trash').style.display = 'none';
        document.querySelector('#item-thumbnail-trash').style.display = 'none';
        document.querySelectorAll('.item-layout-left-right-radio-btn').forEach((radio_input) => {
            radio_input.addEventListener('click', () => {
                document.querySelector('#item-media-width').style.display = 'block';
            });
        });

        /*
        document.querySelectorAll('.item-layout-radio-btn').forEach((radio_input) => {
            radio_input.addEventListener('click', () => {
                document.querySelector('#item-media-width').style.display = 'none';
            });
        });

        document.querySelector('#item-background-color-picker').addEventListener('input', () => {
            if (document.querySelector('#item-background-color')) {
                document.querySelector('#item-background-color').value = document.querySelector('#item-background-color-picker').value;
            }
        });
        */

        /*
        document.querySelector('#item-font-color-picker').addEventListener('input', () => {
            if (document.querySelector('#item-font-color')) {
                document.querySelector('#item-font-color').value = document.querySelector('#item-font-color-picker').value;
            }
        });

         */
    };

    /**
     * Init function for grid form
     */
    obj.init__ = function () {

        // itemsAddGridFormModule.set_grid_items_form_nav_menu_links();
        // document.querySelector('#save-grid-btn').addEventListener('click', itemsAddGridFormModule.create_grid_record);
        uploadsModule.upload_item_media();
        uploadsModule.upload_item_thumbnail();

        /*
        document.querySelector('#grid-background-color-picker').addEventListener('input', () => {
            if (document.querySelector('#grid-background-color')) {
                document.querySelector('#grid-background-color').value = document.querySelector('#grid-background-color-picker').value;
            }
        });

        document.querySelector('#grid-font-color-picker').addEventListener('input', () => {
            if (document.querySelector('#grid-font-color')) {
                document.querySelector('#grid-font-color').value = document.querySelector('#grid-font-color-picker').value;
            }
        });

         */
    };

    return obj;

}());
