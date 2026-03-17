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

    obj.set_preview_link = function () {

        const uuid = helperModule.get_parameter_by_name('exhibit_id');
        const preview_link = APP_PATH + '/preview?uuid=' + uuid;
        const li = document.getElementById('preview-link');

        if (li === null) {
            return;
        }

        const anchor = document.createElement('a');
        anchor.title = 'Previews Exhibit';
        anchor.href = preview_link;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.innerHTML = '<i class="menu-icon fa fa-eye"></i>Preview';

        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            exhibitsModule.open_preview(preview_link);
        });

        li.textContent = '';
        li.appendChild(anchor);
    };

    // nav-dashboard-items.ejs
    obj.set_item_nav_menu_links = function () {

        const uuid = helperModule.get_parameter_by_name('exhibit_id');

        const link_map = {
            'exhibits-link': '/exhibits/exhibit/details',
            'heading-link': '/items/heading',
            'standard-media-item-link': '/items/standard/media',
            'standard-text-item-link': '/items/standard/text',
            'item-grid-link': '/items/grid',
            'item-vertical-timeline-link': '/items/vertical-timeline'
        };

        const entries = Object.entries(link_map);

        for (let i = 0; i < entries.length; i++) {
            const el = document.getElementById(entries[i][0]);

            if (el === null) {
                console.log('WARN: nav menu link element not found: #' + entries[i][0]);
                continue;
            }

            el.href = APP_PATH + entries[i][1] + '?exhibit_id=' + uuid;
        }
    };

    // nav-dashboard-grid-add-form.ejs
    // items.add.grid.form.module.js
    obj.back_to_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const backToItemsLink = document.getElementById('back-to-items');

        if (backToItemsLink) {
            backToItemsLink.href = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    // nav-dashboard-grid-edit-form.ejs
    // items.edit.grid.form.module.js
    obj.edit_grid_back_to_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('item_id');
        const params = `exhibit_id=${encodeURIComponent(exhibit_id)}&grid_id=${encodeURIComponent(grid_id)}`;

        const grid_items_link = document.getElementById('grid-items');
        const back_to_items_link = document.getElementById('back-to-items');

        if (grid_items_link) {
            grid_items_link.href = `${APP_PATH}/items/grid/items?${params}`;
        }

        if (back_to_items_link) {
            back_to_items_link.href = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    // nav-dashboard-grid-items.ejs
    obj.set_grid_item_nav_menu_links = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        const query = '?exhibit_id=' + exhibit_id + '&grid_id=' + grid_id;

        const link_map = {
            'back-to-items': '/items?exhibit_id=' + exhibit_id,
            'grid-media-item-link': '/items/grid/item/media' + query,
            'grid-text-item-link': '/items/grid/item/text' + query
        };

        const entries = Object.entries(link_map);

        for (let i = 0; i < entries.length; i++) {
            const el = document.getElementById(entries[i][0]);

            if (el === null) {
                console.log('WARN: nav menu link element not found: #' + entries[i][0]);
                continue;
            }

            el.href = APP_PATH + entries[i][1];
        }
    };

    // dashboard-timeline-items.ejs
    obj.set_timeline_item_nav_menu_links = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');
        const query = '?exhibit_id=' + exhibit_id + '&timeline_id=' + timeline_id;

        const link_map = {
            'back-to-items': '/items?exhibit_id=' + exhibit_id,
            'timeline-media-item-link': '/items/vertical-timeline/item/media' + query,
            'timeline-text-item-link': '/items/vertical-timeline/item/text' + query
        };

        const entries = Object.entries(link_map);

        for (let i = 0; i < entries.length; i++) {
            const el = document.getElementById(entries[i][0]);

            if (el === null) {
                console.log('WARN: nav menu link element not found: #' + entries[i][0]);
                continue;
            }

            el.href = APP_PATH + entries[i][1];
        }
    };

    obj.back_to_exhibits = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const backLink = document.getElementById('back-to-exhibits');

        if (backLink) {
            backLink.href = `${APP_PATH}/exhibits?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    obj.back_to_grid_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        const back_link = document.getElementById('back-to-items');

        if (back_link) {
            back_link.href = `${APP_PATH}/items/grid/items?exhibit_id=${encodeURIComponent(exhibit_id)}&grid_id=${encodeURIComponent(grid_id)}`;
        }
    };

    obj.back_to_timeline_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');
        const back_link = document.getElementById('back-to-items');

        if (back_link) {
            back_link.href = `${APP_PATH}/items/timeline/items?exhibit_id=${encodeURIComponent(exhibit_id)}&timeline_id=${encodeURIComponent(timeline_id)}`;
        }
    };

    // nav-dashboard-vertical-timeline-edit-form.ejs
    // items.edit.vertical.timeline.form.module.js
    obj.edit_timeline_back_to_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('item_id');
        const timeline_items = document.getElementById('timeline-items');
        const back_to_items_link = document.getElementById('back-to-items');

        if (timeline_items) {
            timeline_items.href = `${APP_PATH}/items/timeline/items?exhibit_id=${encodeURIComponent(exhibit_id)}&timeline_id=${encodeURIComponent(timeline_id)}`;
        }

        if (back_to_items_link) {
            back_to_items_link.href = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    // TODO: where is this used?
    obj.set_item_list_link = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (exhibit_id !== null) {
            document.querySelector('#item-list').setAttribute('href', `${APP_PATH}/items?exhibit_id=${exhibit_id}`);
        } else {
            document.querySelector('#item-list-nav').remove();
        }
    };

    obj.set_logout_link = function () {;
        document.querySelector('#logout').addEventListener('click', authModule.logout);
    };

    obj.init = function () {
        this.set_preview_link();
        this.set_logout_link();
    };

    return obj;

}());
