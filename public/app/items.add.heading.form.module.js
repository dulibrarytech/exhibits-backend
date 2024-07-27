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
     * Gets item heading data
     */
    function get_heading_data() {

        let item_heading = {};
        item_heading.styles = {};
        item_heading.text = document.querySelector('#item-heading-text').value;
        let heading_background_color =  document.querySelector('#heading-background-color').value;
        let heading_color = document.querySelector('#heading-font-color').value;
        let font = document.querySelector('#heading-font').value;

        if (heading_background_color.length > 0) {
            item_heading.styles.backGroundColor = heading_background_color;
        }

        if (heading_color.length > 0) {
            item_heading.styles.color = heading_color;
        }

        if (font.length > 0) {
            item_heading.styles.fontFamily = font;
        }

        return item_heading;
    }

    /**
     * Creates item heading
     */
    obj.create_heading_record = async function () {

        window.scrollTo(0, 0);
        let uuid = helperModule.get_parameter_by_name('uuid');

        if (uuid === undefined) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create item heading record.</div>`;
            return false;
        }

        document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating item heading record...</div>`;
        let data = get_heading_data();

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.heading_records.post.endpoint.replace(':exhibit_id', uuid),
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
                    document.querySelector('#message').innerHTML = '';
                    document.querySelector('#item-heading-form').reset();
                    document.querySelector('#item-heading-card').style.visibility = 'visible';
                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Sets menu links for headings form
     */
    obj.set_headings_form_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let back_link = `${APP_PATH}/items?uuid=${uuid}`;
        let standard_item_link = `${APP_PATH}/items/standard?uuid=${uuid}`;
        let item_grid_link = `${APP_PATH}/items/grid?uuid=${uuid}`;
        let item_vertical_timeline_link = `${APP_PATH}/items/vertical-timeline?uuid=${uuid}`;
        let form_menu_fragment = `
                <li>
                    <a href="${back_link}" data-backdrop="static" data-keyboard="false">
                        <i class=" menu-icon fa fa-arrow-left"></i>Back to items
                    </a>
                </li>
                <li>
                    <a href="${standard_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Items
                    </a>
                </li>
                <li>
                    <a href="${item_grid_link}" data-keyboard="false"> <i
                                class=" menu-icon fa fa-th"></i>Create Item Grid</a>
                </li>
                <li>
                    <a href="${item_vertical_timeline_link}" data-keyboard="false">
                        <i class=" menu-icon ti-calendar"></i>Create Vertical Timeline
                    </a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = form_menu_fragment;
    };

    /**
     * Init function for headings form
     */
    obj.headings_init = function () {
        // itemsFormModule.set_headings_form_nav_menu_links();
        document.querySelector('#save-heading-btn').addEventListener('click', itemsFormModule.create_heading_record);
        document.querySelector('#heading-background-color-picker').addEventListener('input', () => {
            if (document.querySelector('#heading-background-color')) {
                document.querySelector('#heading-background-color').value = document.querySelector('#heading-background-color-picker').value;
            }
        });

        document.querySelector('#heading-font-color-picker').addEventListener('input', () => {
            if (document.querySelector('#heading-font-color')) {
                document.querySelector('#heading-font-color').value = document.querySelector('#heading-font-color-picker').value;
            }
        });
    };

    return obj;

}());
