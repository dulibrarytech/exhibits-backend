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

const itemsModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     *
     * @param uuid
     * @return array
     */
    async function get_items(uuid) {

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.item_records.endpoint.replace(':exhibit_id', uuid),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    }

    /**
     * Sets exhibit title
     * @param uuid
     */
    obj.set_exhibit_title = async function (uuid) {
        let title = await exhibitsModule.get_exhibit_title(uuid);
        document.querySelector('#exhibit-title').innerHTML = `${title}`;
        return false;
    };

    /**
     * Gets exhibit items
     */
    obj.display_items = async function () {

        const uuid = helperModule.get_parameter_by_name('uuid');
        await itemsModule.set_exhibit_title(uuid);
        const items = await get_items(uuid);
        console.log('items: ', items);
        let item_data = '';

        if (items.length === 0) {
            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert">Exhibit is empty.</div>';
            return false;
        }

        for (let i = 0; i < items.length; i++) {

            let uuid = items[i].uuid;
            let type = items[i].type;
            let order = items[i].order;
            let is_published = items[i].is_published;
            let status;

            if (is_published === 1) {
                status = `<span title="published"><i class="fa fa-cloud"></i><br>Published</span>`;
            } else if (is_published === 0) {
                status = `<span title="suppressed"><i class="fa fa-cloud-upload"></i><br>Suppressed</span>`;
            }

            item_data += '<tr>';
            item_data += `<td style="width: 5%">${order}</td>`;

            if (items[i].type === 'item') {

                let media = items[i].media;
                let title = helperModule.unescape(items[i].title);
                let description = helperModule.unescape(items[i].description);
                let date = items[i].date;

                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p>${media}</p>
                    <p>${title}</p>
                    <p><small>${description}</small></p>
                    <p><small>${date}</small></p>
                    </td>`;

            } else if (items[i].type === 'heading') {

                let text = helperModule.unescape(items[i].text);
                let subtext = helperModule.unescape(items[i].subtext);

                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p>${text}</p>
                    <p><small>${subtext}</small></p>
                    </td>`;
            } else if (items[i].type === 'grid') {
                // render grid items here
                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p>Grid UUID: ${uuid}</p>
                    <p>${items[i].columns} columns </p>
                    <div id="grid-items">Grid items here</div>
                    </td>`;
            }

            item_data += `<td style="width: 5%">${status}</td>`;
            item_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    <a href="#" title="Edit"><i class="fa fa-edit pr-1"></i></a>&nbsp;
                                    <a href="#" title="Delete"><i class="fa fa-minus pr-1"></i></a>
                                </div>
                            </td>`;
            item_data += '</tr>';
        }

        item_data += '</tr>';

        document.querySelector('#item-data').innerHTML = item_data;
        let items_table = new DataTable('#items');
        setTimeout(() => {
            document.querySelector('#item-card').style.visibility = 'visible';
            document.querySelector('#message').innerHTML = '';
        }, 1000);
    };

    obj.set_item_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let heading_link = `/dashboard/items/heading?uuid=${uuid}`;
        let standard_item_link = `/dashboard/items/standard?uuid=${uuid}`;
        let item_grid_link = `/dashboard/items/grid?uuid=${uuid}`;
        let item_vertical_timeline_link = `/dashboard/items/vertical-timeline?uuid=${uuid}`;
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
                                class=" menu-icon fa fa-th"></i>Create Item Grid</a>
                </li>
                <li>
                    <a href="${item_vertical_timeline_link}" data-keyboard="false">
                        <i class=" menu-icon ti-calendar"></i>Create Vertical Timeline
                    </a>
                </li>
                <li>
                    <a href="/dashboard/trash" data-keyboard="false">
                        <i class=" menu-icon fa fa-trash-o"></i>Trash
                    </a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = items_menu_fragment;
    };

    obj.init = function () {
        document.querySelector('#message').innerHTML = '<div class="alert alert-primary" role="alert">Loading...</div>';
        itemsModule.set_item_nav_menu_links();
        document.querySelector('#logout').addEventListener('click', authModule.logout);
        itemsModule.display_items();
        setTimeout(() => {
            document.querySelector('#items-menu').style.visibility = 'visible';
        }, 100);
    };

    return obj;

}())
