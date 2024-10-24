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
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
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
                status = `<a href="#" id="${item_id}" class="suppress"><span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span></a>`;
                edit = '';
                delete_item = '';
            } else if (is_published === 0) {
                status = `<a href="#" id="${item_id}" class="publish"><span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span></a>`;
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

        bind_publish_grid_item_events();
        bind_suppress_grid_item_events();

        setTimeout(() => {
            document.querySelector('#item-card').style.visibility = 'visible';
        }, 1000);
    };

    /**
     * Publishes grid item
     * @param uuid
     */
    async function publish_grid_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const grid_item_id = uuid;
            const type = 'grid_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.grid_item_publish.post.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':grid_id', grid_id);
            const endpoint = gtmp.replace(':grid_item_id', grid_item_id);
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint + '?type=' + type,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response.status === 200) {

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Grid item published</div>`;

                setTimeout(() => {
                    location.reload();
                }, 2000);
            }

            if (response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to publish grid item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    /**
     * Suppresses grid item
     * @param uuid
     */
    async function suppress_grid_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const grid_item_id = uuid;
            const type = 'grid_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.grid_item_suppress.post.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':grid_id', grid_id);
            const endpoint = gtmp.replace(':grid_item_id', grid_item_id);
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint + '?type=' + type,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response.status === 200) {

                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Grid item suppressed</div>`;

                setTimeout(() => {
                    location.reload();
                }, 2000);
            }

            if (response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-warning"></i> Unable to suppress grid item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    /**
     * Binds publish click behavior to exhibit links
     */
    function bind_publish_grid_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('publish'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    const uuid = exhibit_link.getAttribute('id');
                    await publish_grid_item(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    /**
     * Binds suppress click behavior to exhibit links
     */
    function bind_suppress_grid_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('suppress'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async () => {
                    const uuid = exhibit_link.getAttribute('id');
                    await suppress_grid_item(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.init = async function () {

        try {

            navModule.init();
            navModule.back_to_items();
            navModule.set_grid_item_nav_menu_links();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
