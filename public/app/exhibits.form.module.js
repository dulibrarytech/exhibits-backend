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

const exhibitsFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    /** TODO: make it reusable
     * Sets rich text editor on defined input fields
     */
    function set_rich_text_editors () {
        const ids = ['exhibit-title-input',
            'exhibit-sub-title-input',
            'exhibit-alert-text-input',
            'exhibit-description-input'];

        ids.forEach((id) => {
            rich_text_data[id] = helperModule.set_rich_text_editor(id);
        });
    }

    /**
     * Gets data from exhibit form
     */
    function get_exhibit_data () {

        let exhibit = {};

        // exhibit data
        exhibit.title = rich_text_data['exhibit-title-input'].getHTMLCode();
        exhibit.subtitle = rich_text_data['exhibit-sub-title-input'].getHTMLCode();
        exhibit.alert_text = rich_text_data['exhibit-alert-text-input'].getHTMLCode();
        exhibit.description = rich_text_data['exhibit-description-input'].getHTMLCode();

        // exhibit media
        exhibit.hero_image = document.querySelector('#hero-image').value;
        exhibit.thumbnail = document.querySelector('#thumbnail-image').value;

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
     * Creates exhibit record
     */
    obj.create_exhibit_record = async function () {

        try {

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating exhibit record...</div>`;
            let data = get_exhibit_data();
            let token = authModule.get_user_token();
            let response;

            if (token === false) {

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 3000);

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

                document.querySelector('#exhibit-card').innerHTML = '';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Exhibit record created</div>`;

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/dashboard/items?uuid=' + response.data.data);
                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Init function for exhibits form
     */
    obj.init = function () {

        helperModule.set_rich_text_editor_config();
        set_rich_text_editors ();
        document.querySelector('#save-exhibit-btn').addEventListener('click', exhibitsFormModule.create_exhibit_record);
        uploadsModule.upload_exhibit_hero_image();
        uploadsModule.upload_exhibit_thumbnail_image();
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

        /*
        document.querySelector('#nav-menu-links-font-color-picker').addEventListener('input', () => {
            if (document.querySelector('#nav-menu-links-font-color')) {
                document.querySelector('#nav-menu-links-font-color').value = document.querySelector('#nav-menu-links-font-color-picker').value;
            }
        });

         */
    };

    return obj;

}());
