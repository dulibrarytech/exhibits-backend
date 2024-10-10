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

const itemsGridModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Gets grid items
     * @param exhibit_id
     * @param grid_id
     * @return array
     */
    async function get_grid_items(exhibit_id, grid_id) {

        try {

            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            const endpoint = tmp.replace(':grid_id', grid_id);
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
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
     * Gets grid items
     */
    obj.display_grid_items = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        await exhibitsModule.set_exhibit_title(exhibit_id);
        const items = await get_grid_items(exhibit_id, grid_id);
        let item_data = '';

        if (items.length === 0) {
            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert">Grid is empty.</div>';
            return false;
        }

        for (let i = 0; i < items.length; i++) {

            let status;
            let item_id = items[i].uuid;
            let thumbnail;
            let url;
            let title = helperModule.unescape(items[i].title);
            let order = items[i].order;
            let is_published = items[i].is_published;
            let item_type;
            let edit;
            let delete_item;

            if (items[i].mime_type.indexOf('image') !== -1) {
                item_type = '<i class="fa fa-image"></i>';
            } else if (items[i].mime_type.indexOf('video') !== -1) {
                item_type = '<i class="fa fa-file-video-o"><i>';
            } else if (items[i].mime_type.indexOf('audio') !== -1) {
                item_type = '<i class="fa fa-file-audio-o"></i>';
            } else if (items[i].mime_type.indexOf('pdf') !== -1) {
                item_type = '<i class="fa fa-file-pdf-o"></i>';
            } else {
                item_type = '<i class="fa fa-file-o"></i>';
            }

            if (items[i].thumbnail.length > 0) {
                url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', exhibit_id).replace(':media', items[i].thumbnail);
                thumbnail = `<p><img alt="${url}" src="${url}" height="100" width="100"></p>`;
            } else {
                thumbnail = '';
            }

            if (is_published === 1) {
                status = `<a href="#" id="${item_id}" class="suppress-item"><span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span></a>`;
                edit = '';
                delete_item = '';
            } else if (is_published === 0) {
                status = `<a href="#" id="${item_id}" class="publish-item"><span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span></a>`;
                edit = `<a href="${APP_PATH}/items/grid/item/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}" title="Edit"><i class="fa fa-edit pr-1"></i></a>`;
                delete_item = `<a href="#" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;
            }

            item_data += '<tr>';
            item_data += `<td style="width: 5%">${order}</td>`;
            item_data += `<td style="width: 35%">
                            <p><strong>${title}</strong></p>
                             ${thumbnail}
                             ${item_type}
                          </td>`;
            item_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
            item_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${edit}&nbsp;
                                    ${delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';

            document.querySelector('#grid-item-list').innerHTML = item_data;
        }

        let grid_items_table = new DataTable('#grid-items');

        setTimeout(() => {
            // document.querySelector('#item-card').style.visibility = 'visible';
            // document.querySelector('#message').innerHTML = '';
        }, 1000);
    };

    obj.init = async function () {

        try {

            navModule.init();
            navModule.back_to_items();
            navModule.set_grid_item_nav_menu_links();

        } catch (error) {
            console.log(error);
        }
    };

    return obj;

}());
