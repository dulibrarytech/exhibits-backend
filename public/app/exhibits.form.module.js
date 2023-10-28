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

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = set_rich_text_editor();

    /**
     * Gets data from exhibit form
     */
    obj.get_exhibit_data = function () {

        let exhibit = {};

        // exhibit data
        exhibit.title = rich_text_data.exhibit_title.getHTMLCode();
        exhibit.subtitle = rich_text_data.exhibit_sub_title.getHTMLCode();
        exhibit.alert_text = rich_text_data.exhibit_alert_text.getHTMLCode();
        exhibit.description = rich_text_data.exhibit_description.getHTMLCode();

        // exhibit media
        exhibit.hero_image = document.querySelector('#hero-image').value;
        exhibit.thumbnail_image = document.querySelector('#thumbnail-image').value;

        // exhibit banner
        exhibit.banner_template = helperModule.get_checked_radio_button(document.getElementsByName('banner_template'));

        // exhibit layout
        exhibit.page_layout = helperModule.get_checked_radio_button(document.getElementsByName('page_layout'));

        // exhibit layout - TODO: only on option set by default
        exhibit.template = helperModule.get_checked_radio_button(document.getElementsByName('template'));

        // TODO:
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
            let data = exhibitsFormModule.get_exhibit_data();
            let token = authModule.get_user_token();
            let response;

            if (token === false) {

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Loading...</div>`;
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
                    window.location.replace('/dashboard/items?uuid=' + response.data.data);
                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Sets rich text editor on defined input fields
     */
    function set_rich_text_editor () {
        let rich_text_data = {};
        rich_text_data.exhibit_title = helperModule.render_rich_text_editor('#exhibit-title-input');
        rich_text_data.exhibit_sub_title = helperModule.render_rich_text_editor('#exhibit-sub-title-input');
        rich_text_data.exhibit_alert_text = helperModule.render_rich_text_editor('#exhibit-alert-text-input')
        rich_text_data.exhibit_description = helperModule.render_rich_text_editor('#exhibit-description-input');
        return rich_text_data;
    }

    obj.init = function () {
        document.querySelector('#save-exhibit-btn').addEventListener('click', exhibitsFormModule.create_exhibit_record);
    };

    return obj;

}());