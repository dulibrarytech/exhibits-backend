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
    console.log('edit item');
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
            console.log(endpoint);
            let response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                console.log(response.data.data);
                // return response.data.data[0];
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    }

    /**
     * Gets data from item edit form
     */
    function get_item_data () {

        let exhibit = {};

        // exhibit data
        exhibit.title = rich_text_data['exhibit-title-input'].getHTMLCode();
        exhibit.subtitle = rich_text_data['exhibit-sub-title-input'].getHTMLCode();
        exhibit.alert_text = rich_text_data['exhibit-alert-text-input'].getHTMLCode();
        exhibit.description = rich_text_data['exhibit-description-input'].getHTMLCode();

        // exhibit media
        exhibit.hero_image = document.querySelector('#hero-image').value;
        exhibit.hero_image_prev = document.querySelector('#hero-image-prev').value;
        exhibit.thumbnail = document.querySelector('#thumbnail-image').value;
        exhibit.thumbnail_prev = document.querySelector('#thumbnail-image-prev').value;

        // exhibit banner
        exhibit.banner_template = helperModule.get_checked_radio_button(document.getElementsByName('banner_template'));

        // exhibit page layout
        exhibit.page_layout = helperModule.get_checked_radio_button(document.getElementsByName('page_layout'));

        // exhibit template layout - TODO: only on option set by default
        exhibit.template = document.querySelector('#exhibit-template').value;
        // exhibit.template = helperModule.get_checked_radio_button(document.getElementsByName('template'));

        // Exhibit styles
        let exhibit_nav_menu_background_color = document.querySelector('#nav-menu-background-color').value;
        let exhibit_nav_menu_font_color = document.querySelector('#nav-menu-font-color').value;
        let exhibit_nav_menu_font = document.querySelector('#nav-menu-font').value;

        exhibit.styles = {
            exhibit: {
                navigation: {
                    menu: {
                        backgroundColor: exhibit_nav_menu_background_color.length > 1 ? exhibit_nav_menu_background_color : '',
                        color: exhibit_nav_menu_font_color.length > 1 ? exhibit_nav_menu_font_color : '',
                        fontFamily: exhibit_nav_menu_font.length > 1 ? exhibit_nav_menu_font : ''
                    }
                }
            }
        };

        return exhibit;
    };

    /**
     * Populates edit form with exhibit record data
     */
    async function display_edit_record () {

        let record = await get_item_record();
        console.log('display: ', record);

        let hero_image_url = '';
        let hero_image_fragment = '';
        let thumbnail_url = '';
        let thumbnail_fragment = '';

        // exhibit data
        rich_text_data['exhibit-title-input'] = helperModule.set_rich_text_editor('exhibit-title-input');
        rich_text_data['exhibit-title-input'].setHTMLCode(helperModule.unescape(record.title));

        rich_text_data['exhibit-sub-title-input'] = helperModule.set_rich_text_editor('exhibit-sub-title-input');
        rich_text_data['exhibit-sub-title-input'].setHTMLCode(helperModule.unescape(record.subtitle));

        rich_text_data['exhibit-alert-text-input'] = helperModule.set_rich_text_editor('exhibit-alert-text-input');
        rich_text_data['exhibit-alert-text-input'].setHTMLCode(helperModule.unescape(record.alert_text));

        rich_text_data['exhibit-description-input'] = helperModule.set_rich_text_editor('exhibit-description-input');
        rich_text_data['exhibit-description-input'].setHTMLCode(helperModule.unescape(record.description));

        // TODO item media
        if (record.hero_image.length > 0) {
            hero_image_url = `/api/v1/exhibits/${record.uuid}/media/${record.hero_image}`;
            hero_image_fragment = `<p><img src="${hero_image_url}" height="200"></p>`;
            document.querySelector('#hero-image-filename-display').innerHTML = hero_image_fragment;
            document.querySelector('#hero-image').value = record.hero_image;
            document.querySelector('#hero-image-prev').value = record.hero_image;
        }

        if (record.thumbnail.length > 0) {
            thumbnail_url = `/api/v1/exhibits/${record.uuid}/media/${record.thumbnail}`;
            thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
            document.querySelector('#thumbnail-filename-display').innerHTML = thumbnail_fragment;
            document.querySelector('#thumbnail-image').value = record.thumbnail;
            document.querySelector('#thumbnail-image-prev').value = record.thumbnail;
        }

        // exhibit banner
        let banner_templates = document.getElementsByName('banner_template');

        for (let i = 0; i < banner_templates.length; i++) {
            if (banner_templates[i].value === record.banner_template) {
                document.querySelector('#' + banner_templates[i].id).checked = true;
            }
        }

        // exhibit layout
        let page_layouts = document.getElementsByName('page_layout');

        for (let j = 0; j < page_layouts.length; j++) {
            if (page_layouts[j].value === record.page_layout) {
                document.querySelector('#' + page_layouts[j].id).checked = true;
            }
        }

        // Exhibit styles
        let styles = JSON.parse(record.styles);
        document.querySelector('#nav-menu-background-color').value = styles.exhibit.navigation.menu.backgroundColor;
        document.querySelector('#nav-menu-font-color').value = styles.exhibit.navigation.menu.color;

        let font_values = document.querySelector('#nav-menu-font');

        for (let i = 0;i<font_values.length;i++) {

            if (font_values[i].value === styles.exhibit.navigation.menu.fontFamily) {
                document.querySelector('#nav-menu-font').value = styles.exhibit.navigation.menu.fontFamily;
            }
        }

        return false;
    }

    /** TODO: hero and thumb values
     * Updates exhibit record
     */
    obj.update_item_record = async function () {

        try {

            document.querySelector('.card').style.visibility = 'hidden';
            scrollTo(0, 0);
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

        await get_item_record();

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
