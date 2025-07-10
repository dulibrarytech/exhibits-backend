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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_grid_items(exhibit_id, grid_id) {

        try {

            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            const token = authModule.get_user_token();
            const endpoint = tmp.replace(':grid_id', grid_id);
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

    obj.display_grid_items = async function (event) {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        await exhibitsModule.set_exhibit_title(exhibit_id);
        const items = await get_grid_items(exhibit_id, grid_id);
        let item_data = '';
        let item_order = [];

        if (items === false) {
            document.querySelector('#item-card').innerHTML = '';
            return false;
        }

        if (items.length === 0) {
            document.querySelector('.card').innerHTML = '';
            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert">Grid is empty.</div>';
            return false;
        }

        for (let i = 0; i < items.length; i++) {
            item_order.push(items[i].order);
            item_data += await itemsListDisplayModule.display_grid_items(items[i]);
        }

        document.querySelector('#grid-item-list').innerHTML = item_data;

        const GRID_ITEM_LIST = new DataTable('#grid-items', {
            paging: false,
            rowReorder: true
        });

        GRID_ITEM_LIST.on('row-reordered', async (e, reordered_items) => {
            await helperModule.reorder_items(e, reordered_items);
        });

        bind_publish_grid_item_events();
        bind_suppress_grid_item_events();
    };

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

                setTimeout(() => {
                    let elem = document.getElementById(uuid);
                    document.getElementById(uuid).classList.remove('publish-item');
                    document.getElementById(uuid).classList.add('suppress-item');
                    document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                    document.getElementById(uuid).innerHTML = '<span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span>';
                    document.getElementById(uuid).addEventListener('click', async (event) => {
                        event.preventDefault();
                        const uuid = elem.getAttribute('id');
                        await suppress_grid_item(uuid);
                    }, false);
                }, 0);

                // TODO
                setTimeout(() => {

                    const trIds = Array.from(document.querySelectorAll('tr')).map(tr => tr.id).filter(id => id);
                    let uuid_found = trIds.find((arr_result) => {

                        let uuid_arr = arr_result.split('_');

                        if (uuid === uuid_arr[0]) {
                            return true;
                        } else {
                            return false;
                        }
                    });

                    let type = uuid_found.split('_');
                    let details_path;
                    let view_items = '';

                     // TODO: check item_type e.g. 'text'
                    console.log('grid ', type);

                    if (type[1] === 'griditem' && type[2] === 'text') {
                        console.log('grid item text');
                    } else {
                        console.log('grid item media');
                    }

                    /*
                    if (type[1] === 'heading') {
                        details_path = `${APP_PATH}/items/heading/details?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                    } else if (type[1] === 'text') {
                        details_path = `${APP_PATH}/items/grid/text/details?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                    } else if (type[1] === 'grid') {
                        details_path = `${APP_PATH}/items/grid/edit?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                        view_items = `<a href="${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${uuid}" title="View grid Items" aria-label="view-grid-items"><i class="fa fa-list pr-1"></i></a>`;
                    } else if (type[1] === 'timeline') {
                        details_path = `${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                        view_items = `<a href="${APP_PATH}/items/timeline/items?exhibit_id=${exhibit_id}&timeline_id=${uuid}" title="View Timeline Items" aria-label="view-timeline-items"><i class="fa fa-list pr-1"></i></a>`;
                    } else {
                        details_path = `${APP_PATH}/items/standard/media/edit?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                    }

                     */

                    /*
                    let uuid_actions = `${uuid}-item-actions`;
                    let elem = document.getElementById(uuid_actions);
                    let item_edit = `<a href="${details_path}" title="View details" aria-label="item-details"><i class="fa fa-folder-open pr-1"></i> </a>`;
                    let trash = `<i title="Can only delete if unpublished" style="color: #d3d3d3" class="fa fa-trash pr-1" aria-label="delete-exhibit"></i>`;
                    elem.innerHTML = `
                        <div class="card-text text-sm-center">
                        ${view_items}&nbsp;
                        ${item_edit}&nbsp;
                        ${trash}
                        </div>`;

                     */
                }, 0);
            }

            if (response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to publish grid item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function suppress_grid_item(uuid) {
        console.log('suppress_grid_item', uuid);
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
            console.log(endpoint);
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint + '?type=' + type,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });
            console.log('test', response);
            if (response.status === 200) {

                setTimeout(() => {
                    let elem = document.getElementById(uuid);
                    document.getElementById(uuid).classList.remove('suppress-item');
                    document.getElementById(uuid).classList.add('publish-item');
                    document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                    document.getElementById(uuid).innerHTML = '<span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span>';
                    document.getElementById(uuid).addEventListener('click', async (event) => {
                        event.preventDefault();
                        const uuid = elem.getAttribute('id');
                        await publish_grid_item(uuid);
                    }, false);
                }, 0);

                // TODO
                setTimeout(() => {

                    const trIds = Array.from(document.querySelectorAll('tr')).map(tr => tr.id).filter(id => id);
                    let uuid_found = trIds.find((arr_result) => {

                        let uuid_arr = arr_result.split('_');

                        if (uuid === uuid_arr[0]) {
                            return true;
                        } else {
                            return false;
                        }
                    });

                    let type = uuid_found.split('_');
                    let edit_path;
                    let delete_path;
                    let item_type = 'item';
                    let view_items = '';

                    if (type[1] === 'griditem' && type[2] === 'text') {
                        console.log('grid item text');
                    } else {
                        console.log('grid item media');
                    }

                    // edit paths
                    /*
                    if (type[1] === 'heading') {
                        edit_path = `${APP_PATH}/items/heading/edit?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                        item_type = 'heading';
                    } else if (type[1] === 'text') {
                        edit_path = `${APP_PATH}/items/standard/text/edit?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                    } else if (type[1] === 'grid') {
                        edit_path = `${APP_PATH}/items/grid/edit?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                        item_type = 'grid';
                        view_items = `<a href="${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${uuid}" title="View grid Items" aria-label="view-grid-items"><i class="fa fa-list pr-1"></i></a>`;
                    } else if (type[1] === 'timeline') {
                        edit_path = `${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                        item_type = 'timeline';
                        view_items = `<a href="${APP_PATH}/items/timeline/items?exhibit_id=${exhibit_id}&timeline_id=${uuid}" title="View Timeline Items" aria-label="view-timeline-items"><i class="fa fa-list pr-1"></i></a>`;
                    } else {
                        edit_path = `${APP_PATH}/items/standard/media/edit?exhibit_id=${exhibit_id}&item_id=${uuid}`;
                    }

                    delete_path = `${APP_PATH}/items/delete?exhibit_id=${exhibit_id}&item_id=${uuid}&type=${item_type}`;

                    /*

                    let uuid_actions = `${uuid}-item-actions`;
                    let elem = document.getElementById(uuid_actions);
                    let item_edit = `<a href="${edit_path}" title="Edit item" aria-label="edit-item"><i class="fa fa-edit pr-1"></i> </a>`;
                    let trash = `<a href="${delete_path}" title="Delete item" aria-label="delete-item"><i class="fa fa-trash pr-1"></i></a>`;
                    elem.innerHTML = `
                        <div class="card-text text-sm-center">
                        ${view_items}&nbsp;
                        ${item_edit}&nbsp;
                        ${trash}
                        </div>`;

                     */
                }, 0);
            }

            if (response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-warning"></i> Unable to unpublish grid item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_publish_grid_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('publish-item'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const uuid = exhibit_link.getAttribute('id');
                    await publish_grid_item(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_suppress_grid_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('suppress-item'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const uuid = exhibit_link.getAttribute('id');
                    await suppress_grid_item(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.delete_grid_item = async function () {

        try {

            document.querySelector('#delete-message').innerHTML = 'Deleting grid item...';
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const grid_item_id = helperModule.get_parameter_by_name('item_id');
            const type = 'grid_item';
            const etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.delete.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':grid_id', grid_id);
            const endpoint = gtmp.replace(':item_id', grid_item_id);
            const token = authModule.get_user_token();
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
                    window.location.replace(`${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${grid_id}`);
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_items();
            navModule.set_preview_link();
            navModule.set_grid_item_nav_menu_links();
            navModule.set_logout_link();
            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
