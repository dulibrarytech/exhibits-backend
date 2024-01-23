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

const ItemsEditFormModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    /**
     * Gets item record
     */
    async function get_item_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);

            if (token === false) {  //  || EXHIBITS_ENDPOINTS === null

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace('/dashboard/login');
                }, 3000);

                return false;
            }

            // document.querySelector('#exhibit-title').innerHTML = await exhibitsModule.get_exhibit_title(uuid);
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
    function get_item_data () {

        let item = {};

        // item data
        item.title = rich_text_data['item-title-input'].getHTMLCode();
        item.caption = rich_text_data['item-caption-input'].getHTMLCode();
        item.description = rich_text_data['item-description-input'].getHTMLCode();
        item.text = rich_text_data['item-text-input'].getHTMLCode();

        // item media
        item.item_media = document.querySelector('#item-media').value;
        item.item_media_prev = document.querySelector('#item-media-prev').value;

        // item layout
        item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));

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
     * Populates edit form with exhibit record data
     */
    async function display_edit_record () {

        let record = await get_item_record();
        let media_url = '';
        let media_fragment = '';
        console.log('display: ', record);

        // item data
        rich_text_data['item-title-input'] = helperModule.set_rich_text_editor('item-title-input');
        rich_text_data['item-title-input'].setHTMLCode(helperModule.unescape(record.title));

        rich_text_data['item-caption-input'] = helperModule.set_rich_text_editor('item-caption-input');
        rich_text_data['item-caption-input'].setHTMLCode(helperModule.unescape(record.caption));

        rich_text_data['item-description-input'] = helperModule.set_rich_text_editor('item-description-input');
        rich_text_data['item-description-input'].setHTMLCode(helperModule.unescape(record.description));

        rich_text_data['item-text-input'] = helperModule.set_rich_text_editor('item-text-input');
        rich_text_data['item-text-input'].setHTMLCode(helperModule.unescape(record.text));

        if (record.media.length > 0) {
            media_url = `/api/v1/exhibits/${record.is_member_of_exhibit}/media/items/${record.media}`;
            media_fragment = `<p><img src="${media_url}" height="200"></p>`;
            document.querySelector('#item-media-filename-display').innerHTML = media_fragment;
            document.querySelector('#item-media').value = record.media;
            document.querySelector('#item-media-prev').value = record.media;
        }

        // item layouts
        let layouts = document.getElementsByName('layout');

        for (let j = 0; j < layouts.length; j++) {
            if (layouts[j].value === record.layout) {
                document.querySelector('#' + layouts[j].id).checked = true;
            }
        }

        // item styles
        if (record.styles !== '{}') {

            let styles = JSON.parse(record.styles);
            console.log(record.styles);
            document.querySelector('#nav-menu-background-color').value = styles.exhibit.navigation.menu.backgroundColor;
            document.querySelector('#nav-menu-font-color').value = styles.exhibit.navigation.menu.color;

            let font_values = document.querySelector('#nav-menu-font');

            for (let i = 0;i<font_values.length;i++) {
                if (font_values[i].value === styles.exhibit.navigation.menu.fontFamily) {
                    document.querySelector('#nav-menu-font').value = styles.exhibit.navigation.menu.fontFamily;
                }
            }
        }

        // TODO: media width?
        // console.log('media width ', record.media_width);
        // TODO: item type
        // console.log('item type ', record.item_type);

        return false;
    }

    /**
     * Updates item record
     */
    obj.update_item_record = async function () {

        try {

            scrollTo(0, 0);
            document.querySelector('.card').style.visibility = 'hidden';
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating item record...</div>`;
            let uuid = helperModule.get_parameter_by_name('uuid');
            let data = get_item_data();
            let token = authModule.get_user_token();
            let response;

            if (uuid === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get record UUID</div>`;
                return false;
            }

            if (token === false) {

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 3000);

                return false;
            }

            response = await httpModule.req({
                method: 'PUT',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.put.endpoint.replace(':exhibit_id', uuid),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#exhibit-card').innerHTML = '';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Exhibit record updated</div>`;

                setTimeout(() => {
                    window.location.replace('/dashboard/exhibits/exhibit/edit?uuid=' + uuid);
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
        await display_edit_record();
        // await get_item_record();

        /*
        document.querySelector('#save-exhibit-btn').addEventListener('click', exhibitsEditFormModule.update_exhibit_record);
        await display_edit_record();
        document.querySelector('#logout').addEventListener('click', authModule.logout);
        document.querySelector('#hero-trash').style.display = 'none';
        document.querySelector('#thumbnail-trash').style.display = 'none';

        // bind color pickers to input fields
        document.querySelector('#nav-menu-background-color-picker').addEventListener('input', () => {
            if (document.querySelector('#nav-menu-background-color')) {
                document.querySelector('#nav-menu-background-color').value = document.querySelector('#nav-menu-background-color-picker').value;
            }
        });

        document.querySelector('#nav-menu-font-color-picker').addEventListener('input', () => {
            if (document.querySelector('#nav-menu-font-color')) {
                document.querySelector('#nav-menu-font-color').value = document.querySelector('#nav-menu-font-color-picker').value;
            }
        });

         */
    };

    return obj;

}());
