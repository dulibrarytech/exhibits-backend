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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    let obj = {};

    obj.set_item_nav_menu_links = function () {

        const uuid = helperModule.get_parameter_by_name('exhibit_id');
        // TODO: adjust exhibits link depending on published status
        const exhibits_link = `${APP_PATH}/exhibits/exhibit/details?exhibit_id=${uuid}`;
        const heading_link = `${APP_PATH}/items/heading?exhibit_id=${uuid}`;
        const standard_media_item_link = `${APP_PATH}/items/standard/media?exhibit_id=${uuid}`;
        const standard_text_item_link = `${APP_PATH}/items/standard/text?exhibit_id=${uuid}`;
        const item_grid_link = `${APP_PATH}/items/grid?exhibit_id=${uuid}`;
        const item_vertical_timeline_link = `${APP_PATH}/items/vertical-timeline?exhibit_id=${uuid}`;
        const items_menu_fragment = `
                <li>
                    <a href="${exhibits_link}" data-keyboard="false"> 
                        <i class=" menu-icon fa fa-arrow-left"></i>Back to Exhibit Details
                    </a>
                </li>
                <li>
                    <a href="${heading_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-layout-menu"></i>Add Heading
                    </a>
                </li>
                <li>
                    <a href="${standard_media_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-image"></i>Add Media Item
                    </a>
                </li>
                 <li>
                    <a href="${standard_text_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-align-center"></i>Add Text Item
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

    obj.set_item_list_link = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (exhibit_id !== null) {
            document.querySelector('#item-list').setAttribute('href', `${APP_PATH}/items?exhibit_id=${exhibit_id}`);
        } else {
            document.querySelector('#item-list-nav').remove();
        }
    };

    obj.set_grid_item_nav_menu_links = function () {

        let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        let grid_id = helperModule.get_parameter_by_name('grid_id');
        let grid_media_item_link = `${APP_PATH}/items/grid/item/media?exhibit_id=${exhibit_id}&grid_id=${grid_id}`;
        let grid_text_item_link = `${APP_PATH}/items/grid/item/text?exhibit_id=${exhibit_id}&grid_id=${grid_id}`;
        let items_menu_fragment = `
                <li>
                    <a href="${grid_media_item_link}" data-keyboard="false"> <i
                                class=" menu-icon ti-image"></i>Add Media Grid Item</a>
                </li>
                <li>
                    <a href="${grid_text_item_link}" data-keyboard="false"> <i
                                class=" menu-icon ti-align-center"></i>Add Text Grid Item</a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = items_menu_fragment;
    };

    obj.set_timeline_item_nav_menu_links = function () {

        let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        let timeline_id = helperModule.get_parameter_by_name('timeline_id');
        let timeline_item_link = `${APP_PATH}/items/vertical-timeline/item?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}`;
        let items_menu_fragment = `
                <li>
                    <a href="${timeline_item_link}" data-keyboard="false"> <i
                                class=" menu-icon fa fa-calendar"></i>Add Timeline Item</a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = items_menu_fragment;
    };

    obj.back_to_exhibits = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        document.querySelector('#back-to-exhibits').setAttribute('href', `${APP_PATH}/exhibits?exhibit_id=${exhibit_id}`);
    };

    obj.back_to_items = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');
        let id = '0';
        let type = '0';

        if (grid_id !== null) {
            id = grid_id;
            type = 'grid';
        } else if (timeline_id !== null) {
            id = timeline_id;
            type = 'timeline';
        }

        document.querySelector('#back-to-items').setAttribute('href', `${APP_PATH}/items?exhibit_id=${exhibit_id}&id=${id}&type=${type}`);
    };

    obj.back_to_grid_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        document.querySelector('#back-to-items').setAttribute('href', `${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${grid_id}`);
    };

    obj.back_to_timeline_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');
        document.querySelector('#back-to-items').setAttribute('href', `${APP_PATH}/items/timeline/items?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}`);
    };

    obj.set_preview_link = function () {

        let uuid = helperModule.get_parameter_by_name('exhibit_id');
        let preview_link = `${APP_PATH}/preview?uuid=${uuid}`;
        let preview_menu_fragment = `
                    <a title="Previews Exhibit" href="#" onclick="exhibitsModule.open_preview('${preview_link}')">
                        <i class=" menu-icon fa fa-eye"></i>Preview
                    </a>`;

        document.querySelector('#preview-link').innerHTML = preview_menu_fragment;
    };

    obj.set_logout_link = function () {;
        document.querySelector('#logout').addEventListener('click', authModule.logout);
    };

    obj.init = function () {
        navModule.set_logout_link();
    };

    return obj;

}());
