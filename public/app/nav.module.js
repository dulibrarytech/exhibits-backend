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
    let obj = {};

    /**
     * sets item navigation
     */
    obj.set_item_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('exhibit_id');
        let heading_link = `${APP_PATH}/items/heading?exhibit_id=${uuid}`;
        let standard_item_link = `${APP_PATH}/items/standard?exhibit_id=${uuid}`;
        let item_grid_link = `${APP_PATH}/items/grid?exhibit_id=${uuid}`;
        let item_vertical_timeline_link = `${APP_PATH}/items/vertical-timeline?exhibit_id=${uuid}`;
        let items_menu_fragment = `
                <li>
                    <a href="${heading_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Heading
                    </a>
                </li>
                <li>
                    <a href="${standard_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Item
                    </a>
                </li>
                <li>
                    <a href="${item_grid_link}" data-keyboard="false"> <i
                                class=" menu-icon fa fa-th"></i>Add Grid</a>
                </li>
                <li>
                    <a href="${item_vertical_timeline_link}" data-keyboard="false">
                        <i class=" menu-icon ti-calendar"></i>Add Vertical Timeline
                    </a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = items_menu_fragment;
    };

    /**
     * sets grid item menu link
     */
    obj.set_grid_item_nav_menu_links = function () {

        let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        let grid_id = helperModule.get_parameter_by_name('grid_id');
        let grid_item_link = `${APP_PATH}/items/grid/item?exhibit_id=${exhibit_id}&grid_id=${grid_id}`;
        let items_menu_fragment = `
                <li>
                    <a href="${grid_item_link}" data-keyboard="false"> <i
                                class=" menu-icon fa fa-th"></i>Add Grid Item</a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = items_menu_fragment;
    };

    /**
     * Creates back to menu items link in item forms
     */
    obj.back_to_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        document.querySelector('#back-to-items').setAttribute('href', `${APP_PATH}/items?exhibit_id=${exhibit_id}`);
    };

    /**
     * Creates back to menu grid items link in grid item edit form
     */
    obj.back_to_grid_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        document.querySelector('#back-to-items').setAttribute('href', `${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${grid_id}`);
    };

    /**
     * Sets preview link
     */
    obj.set_preview_link = function () {

        let uuid = helperModule.get_parameter_by_name('exhibit_id');
        let preview_link = `${APP_PATH}/preview?uuid=${uuid}`;
        let preview_menu_fragment = `
                    <a href="#" onclick="exhibitsModule.open_preview('${preview_link}')">
                        <i class=" menu-icon fa fa-eye"></i>Preview
                    </a>`;

        document.querySelector('#preview-link').innerHTML = preview_menu_fragment;
    };

    /**
     * Sets logout link
     */
    obj.set_logout_link = function () {
        document.querySelector('#logout').addEventListener('click', authModule.logout);
    };

    /**
     * Init function for navigation menu
     */
    obj.init = function () {
        navModule.set_logout_link();
    };

    return obj;

}());
