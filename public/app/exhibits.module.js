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

            if (token === false) {
                window.location.replace('/dashboard/login');
                return false;
            }

            if (EXHIBITS_ENDPOINTS === null) {
                setTimeout(() => {
                    location.reload();
                    return false;
                }, 0);
            }

            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });
            console.log(response);
            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    }

    /**
     *
     * @return {Promise<boolean>}
     */
    obj.display_exhibits = async function () {

        const exhibits = await get_exhibits();
        console.log('exhibits: ', exhibits);
        let exhibit_data = '';

        if (exhibits.length === 0) {
            document.querySelector('#exhibits').innerHTML = '<div class="alert alert-info" role="alert">No Exhibits found.</div>';
            return false;
        }

        for (let i = 0; i < exhibits.length; i++) {

            let uuid = exhibits[i].uuid;
            let is_published = exhibits[i].is_published;
            let status;

            if (is_published === 1) {
                status = `<span title="published"><i class="fa fa-cloud"></i><br>Published</span>`;
            } else if (is_published === 0) {
                status = `<span title="suppressed"><i class="fa fa-cloud-upload"></i><br>Suppressed</span>`;
            }

            exhibit_data += '<tr>';

            let thumbnail = exhibits[i].thumbnail_image;
            let title = helperModule.unescape(exhibits[i].title);
            // let description = helperModule.unescape(items[i].description);

            exhibit_data += `<td style="width: 35%">
                    <p><strong class="card-title mb-3"><a href="/dashboard/items?uuid=${uuid}">${title}</a></strong></p>
                    <p>${thumbnail}</p>
                    <p><a class="btn btn-outline-secondary" href="/preview" title="preview"><i class="fa fa-eye"></i>&nbsp;Preview</a></p>
                    </td>`;

            exhibit_data += `<td style="width: 5%">${status}</td>`;
            exhibit_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    <a href="#" title="Edit"><i class="fa fa-edit pr-1"></i> </a>&nbsp;
                                    <a href="#" title="Delete"><i class="fa fa-minus pr-1"></i> </a>&nbsp;
                                    <a href="#" title="Add Items"><i class="fa fa-plus pr-1"></i> </a>
                                </div>
                            </td>`;
            exhibit_data += '</tr>';
        }

        document.querySelector('#exhibits-data').innerHTML = exhibit_data;
        let table = new DataTable('#exhibits');
        setTimeout(() => {
            document.querySelector('#exhibit-card').style.visibility = 'visible';
            document.querySelector('#message').innerHTML = '';
        }, 1000);
    };

    /**
     * Gets exhibit title
     * @param uuid
     * @return {Promise<*>}
     */
    obj.get_exhibit_title = async function (uuid) {

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.get.endpoint.replace(':exhibit_id', uuid),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return helperModule.strip_html(helperModule.unescape(response.data.data[0].title));
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    };

    /**
     * TODO: move form functions to different module
     * @return {{}}
     */
    obj.get_exhibit_data = function () {

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
        exhibit.banner_template = helperModule.get_checked_radio_button(document.getElementsByName('banner_template'));

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
        let exhibit_nav_menu_background_color = document.querySelector('#nav-menu-background-color').value;
        let exhibit_nav_menu_font_color = document.querySelector('#nav-menu-font-color').value;
        let exhibit_nav_menu_font_family = document.querySelector('#nav-menu-font-family').value;
        let exhibit_nav_menu_font_size = document.querySelector('#nav-menu-font-size').value;
        let exhibit_nav_menu_text_align = document.querySelector('#nav-menu-text-align').value;

        let exhibit_nav_menu_links_background_color = document.querySelector('#nav-menu-links-background-color').value;
        let exhibit_nav_menu_links_font_color = document.querySelector('#nav-menu-links-font-color').value;
        // let exhibit_nav_menu_links_font_family = document.querySelector('#nav-menu-links-font-family').value;
        // let exhibit_nav_menu_links_font_size = document.querySelector('#nav-menu-links-font-size').value;
        // let exhibit_nav_menu_links_text_align = document.querySelector('#nav-menu-links-text-align').value;

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
                        color: exhibit_nav_menu_links_font_color.length > 1 ? exhibit_nav_menu_links_font_color : ''
                        // fontFamily: exhibit_nav_menu_links_font_family.length > 1 ? exhibit_nav_menu_links_font_family : '',
                        // fontSize: exhibit_nav_menu_links_font_size.length > 1 ? exhibit_nav_menu_links_font_size : '',
                        // textAlign: exhibit_nav_menu_links_text_align.length > 1 ? exhibit_nav_menu_links_text_align : ''
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

    // used in form
    obj.display_exhibit_data = function () {

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

    obj.set_preview_link = function() {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let preview_link = `/preview?uuid=${uuid}`;
        let preview_menu_fragment = `
                <li>
                    <a href="#" onClick="window.open('${preview_link}', '_blank', 'location=yes,scrollbars=yes,status=yes');">
                        <i class=" menu-icon fa fa-eye"></i>Preview
                    </a>
                </li>`;

        document.querySelector('#preview-link').innerHTML = preview_menu_fragment;
    };

    obj.init = async function () {
        await exhibitsModule.display_exhibits();
    };

    return obj;

}());
