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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

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
                window.localStorage.removeItem('items');
                window.localStorage.setItem('items', JSON.stringify(response.data.data));
                return response.data.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.display_items = async function (event) {

        try {

            if ($.fn.dataTable.isDataTable('#items')) {
                $('#items').DataTable().clear().destroy();
            }

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const items = await get_items(exhibit_id);
            let item_data = '';

            if (items.length === 0) {
                document.querySelector('.card').innerHTML = '';
                document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert"><span id="exhibit-title"></span> exhibit is empty.</div>';
                await exhibitsModule.set_exhibit_title(exhibit_id);
                return false;
            }

            for (let i = 0; i < items.length; i++) {

                const type = items[i].type;
                const record = items[i];

                switch(type) {
                    case 'heading':
                        item_data += await itemsListDisplayModule.display_heading_items(record);
                        break;
                    case 'item':
                        item_data += await itemsListDisplayModule.display_standard_items(record);
                        break;
                    case 'grid':
                        item_data += await itemsListDisplayModule.display_grids(record);
                        break;
                    case 'vertical_timeline':
                        item_data += await itemsListDisplayModule.display_timelines(record);
                        break;
                    default:
                        console.log('Item type not available');
                }
            }

            document.querySelector('#item-data').innerHTML = item_data;

            new DataTable('#items', {
                paging: false
            });

            bind_publish_item_events();
            bind_suppress_item_events();
            helperModule.reorder_items(event, exhibit_id, 'items');

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.delete_item = async function () {

        try {

            document.querySelector('#delete-message').innerHTML = 'Deleting item...';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const type = helperModule.get_parameter_by_name('type');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.delete.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);
            const response = await httpModule.req({
                method: 'DELETE',
                url: endpoint + '?type=' + type,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 204) {

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/items?exhibit_id=' + exhibit_id);
                }, 2000);
            }


        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    async function publish_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = uuid;
            const elems = document.getElementsByTagName('tr');
            let type;

            for (let i = 0; i < elems.length; i++) {
                if (elems[i].id.length !== 0 && elems[i].id.indexOf(uuid) !== -1) {
                    let tmp = elems[i].id.split('_');
                    type = tmp.pop();
                    break;
                }
            }

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.item_records.item_publish.post.endpoint.replace(':exhibit_id', exhibit_id);
            const endpoint = etmp.replace(':item_id', item_id);
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

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Item published</div>`;

                setTimeout(() => {
                    location.reload();
                }, 1000);
            }

            if (response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-warning"></i> Exhibit must be published in order to publish this item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function suppress_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = uuid;
            const elems = document.getElementsByTagName('tr');
            let type;

            for (let i = 0; i < elems.length; i++) {
                if (elems[i].id.length !== 0 && elems[i].id.indexOf(uuid) !== -1) {
                    let tmp = elems[i].id.split('_');
                    type = tmp.pop();
                    break;
                }
            }

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.item_records.item_suppress.post.endpoint.replace(':exhibit_id', exhibit_id);
            const endpoint = etmp.replace(':item_id', item_id);
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

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Item unpublished</div>`;

                setTimeout(() => {
                    location.reload();
                }, 1000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_publish_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('publish-item'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    const uuid = exhibit_link.getAttribute('id');
                    await publish_item(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_suppress_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('suppress-item'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async () => {
                    const uuid = exhibit_link.getAttribute('id');
                    await suppress_item(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.init = function (event) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            exhibitsModule.set_exhibit_title(exhibit_id);
            itemsModule.display_items();
            helperModule.show_form();
            navModule.set_preview_link();
            navModule.set_item_nav_menu_links();
            navModule.set_logout_link();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
