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

const exhibitsModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Gets all exhibits
     */
    async function get_exhibits() {

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                // domModule.html('#message', null);
                return response.data.data;
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
            // TODO: authModule.session_expired();
        }
    }

    /**
     * Displays exhibits
     */
    async function display_exhibits() {

        let exhibits = await get_exhibits();
        let exhibit_cards = '';
        exhibit_cards += '<div class="row">';

        for (let i=0;i<exhibits.length;i++) {

            let uuid = exhibits[i].uuid;
            let title = helperModule.unescape(exhibits[i].title);
            let description = helperModule.unescape(exhibits[i].description);
            // description = description.substring(0, description.length);
            // <div class="location text-sm-center"><i class=""></i> ${description}</div>

            exhibit_cards += `
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <strong class="card-title mb-3"><a href="/dashboard/items?uuid=${uuid}">${title}</a></strong>
                        </div>
                        <div class="card-body">
                            <div class="mx-auto d-block">
                                <img class="rounded-circle mx-auto d-block" src="../../images/thumbnail.jpg"
                                     alt="exhibit thumbnail here?">
                            </div>
                            <hr>
                            <div class="card-text text-sm-center">
                                <a href="#" title="Add Items"><i class="fa fa-plus pr-1"></i> </a>&nbsp;
                                <a href="#" title="Edit Items"><i class="fa fa-edit pr-1"></i> </a>&nbsp;
                                <a href="#" title="Delete items"><i class="fa fa-minus pr-1"></i> </a>
                            </div>
                        </div>
                    </div>
                </div>`;

            if (i % 3 === 2) {
                exhibit_cards += '</div>';
                exhibit_cards += '<div class="row">';
            }
        }

        document.querySelector('#exhibits').innerHTML = exhibit_cards;
    }

    obj.get_exhibit_data = function() {

        let exhibit = {};

        // Step 1
        exhibit.title = EXHIBIT_TITLE.getHTMLCode();
        exhibit.subtitle = EXHIBIT_SUB_TITLE.getHTMLCode();
        exhibit.alert_text = EXHIBIT_ALERT_TEXT.getHTMLCode();
        exhibit.description = EXHIBIT_DESCRIPTION.getHTMLCode();

        // Step 2
        exhibit.hero_image = document.querySelector('#hero-image').value;
        exhibit.thumbnail_image = document.querySelector('#thumbnail-image').value;

        // Step 3
        exhibit.banner_template =  helperModule.get_checked_radio_button(document.getElementsByName('banner_template'));

        // Step 4
        exhibit.page_layout = helperModule.get_checked_radio_button(document.getElementsByName('page_layout'));

        // Step 5
        exhibit.template = helperModule.get_checked_radio_button(document.getElementsByName('template'));

        // Step 6
        let exhibit_template_background_color = document.querySelector('#template-background-color').value;
        let exhibit_template_font_color = document.querySelector('#template-font-color').value;
        let exhibit_template_font_family = document.querySelector('#template-font-family').value;
        let exhibit_template_font_size = document.querySelector('#template-font-size').value;
        let exhibit_template_text_align = document.querySelector('#template-text-align').value;

        // Step 7
        //
        let exhibit_nav_menu_background_color = document.querySelector('#nav-menu-background-color').value;
        let exhibit_nav_menu_font_color = document.querySelector('#nav-menu-font-color').value;
        let exhibit_nav_menu_font_family = document.querySelector('#nav-menu-font-family').value;
        let exhibit_nav_menu_font_size = document.querySelector('#nav-menu-font-size').value;
        let exhibit_nav_menu_text_align = document.querySelector('#nav-menu-text-align').value;

        let exhibit_nav_menu_links_background_color = document.querySelector('#nav-menu-links-background-color').value;
        let exhibit_nav_menu_links_font_color = document.querySelector('#nav-menu-links-font-color').value;
        let exhibit_nav_menu_links_font_family = document.querySelector('#nav-menu-links-font-family').value;
        let exhibit_nav_menu_links_font_size = document.querySelector('#nav-menu-links-font-size').value;
        let exhibit_nav_menu_links_text_align = document.querySelector('#nav-menu-links-text-align').value;

        exhibit.styles = {
            exhibit: {
                navigation: {
                    menu: {
                        backgroundColor: exhibit_nav_menu_background_color.length > 1 ? exhibit_nav_menu_background_color : '',
                        color: exhibit_nav_menu_font_color.length > 1 ? exhibit_nav_menu_font_color : '',
                        fontFamily: exhibit_nav_menu_font_family.length > 1 ? exhibit_nav_menu_font_family : '',
                        fontSize: exhibit_nav_menu_font_size.length > 1 ? exhibit_nav_menu_font_size : '',
                        textAlign: exhibit_nav_menu_text_align.length > 1 ? exhibit_nav_menu_text_align : ''
                    },
                    links: {
                        backgroundColor: exhibit_nav_menu_links_background_color.length > 1 ? exhibit_nav_menu_links_background_color : '',
                        color: exhibit_nav_menu_links_font_color.length > 1 ? exhibit_nav_menu_links_font_color : '',
                        fontFamily: exhibit_nav_menu_links_font_family.length > 1 ? exhibit_nav_menu_links_font_family : '',
                        fontSize: exhibit_nav_menu_links_font_size.length > 1 ? exhibit_nav_menu_links_font_size : '',
                        textAlign: exhibit_nav_menu_links_text_align.length > 1 ? exhibit_nav_menu_links_text_align : ''
                    }
                },
                template: {
                    backgroundColor: exhibit_template_background_color.length > 1 ? exhibit_template_background_color : '',
                    color: exhibit_template_font_color.length > 1 ? exhibit_template_font_color : '',
                    fontFamily: exhibit_template_font_family.length > 1 ? exhibit_template_font_family : '',
                    fontSize: exhibit_template_font_size.length > 1 ? exhibit_template_font_size : '',
                    textAlign: exhibit_template_text_align.length > 1 ? exhibit_template_text_align : ''
                }
            }
        };

        return exhibit;
    };

    obj.display_exhibit_data = function() {

        let data = exhibitsModule.get_exhibit_data();
        let html = '';

        for (let prop in data) {
            if (prop === 'title') {
                html += `<p><strong>${data[prop]}</strong> Exhibit is ready</p>`;
            }
        }

        document.querySelector('#display-exhibit-data').innerHTML = html;
    };

    obj.create_exhibit_record = async function () {

        document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating exhibit record...</div>`;
        let data = exhibitsModule.get_exhibit_data();

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#display-exhibit-data').innerHTML = '';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Exhibit record created</div>`;

                setTimeout(() => {
                    window.location.replace('/dashboard/items?uuid=' + response.data.data);
                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = function () {
        setTimeout(async () => {
            await display_exhibits();
        }, 1000);
    };

    return obj;

}());