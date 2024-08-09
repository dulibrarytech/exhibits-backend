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

const navModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

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
     * sets item navigation
     */
    obj.set_item_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let heading_link = `${APP_PATH}/items/heading?uuid=${uuid}`;
        let standard_item_link = `${APP_PATH}/items/standard?uuid=${uuid}`;
        let item_grid_link = `${APP_PATH}/items/grid?uuid=${uuid}`;
        let item_vertical_timeline_link = `${APP_PATH}/items/vertical-timeline?uuid=${uuid}`;
        let items_menu_fragment = `
                <li>
                    <a href="${heading_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Headings
                    </a>
                </li>
                <li>
                    <a href="${standard_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Items
                    </a>
                </li>
                <li>
                    <a href="${item_grid_link}" data-keyboard="false"> <i
                                class=" menu-icon fa fa-th"></i>Add Item Grid</a>
                </li>
                <li>
                    <a href="${item_vertical_timeline_link}" data-keyboard="false">
                        <i class=" menu-icon ti-calendar"></i>Add Vertical Timeline
                    </a>
                </li>`;

        // <li>
        //                     <a href="${APP_PATH}/dashboard/trash" data-keyboard="false">
        //                         <i class=" menu-icon fa fa-trash-o"></i>Trash
        //                     </a>
        //                 </li>
        document.querySelector('#items-menu').innerHTML = items_menu_fragment;
    };

    /**
     * Sets preview link
     */
    obj.set_preview_link = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let preview_link = `${APP_PATH}/preview?uuid=${uuid}`;
        let preview_menu_fragment = `
                    <a href="#" onclick="exhibitsModule.open_preview('${preview_link}')">
                        <i class=" menu-icon fa fa-eye"></i>Preview
                    </a>`;

        document.querySelector('#preview-link').innerHTML = preview_menu_fragment;
    };

    /**
     * Init function for headings form
     */
    obj.init = function () {
        // navModule.set_headings_form_nav_menu_links();
    };

    return obj;

}());
