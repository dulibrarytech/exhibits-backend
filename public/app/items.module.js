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

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Gets items
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
                window.localStorage.removeItem('items');
                window.localStorage.setItem('items', JSON.stringify(response.data.data));
                return response.data.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    /**
     * Gets exhibit items
     */
    obj.display_items = async function (event) {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const items = await get_items(exhibit_id);
        let item_data = '';

        if (items.length === 0) {
            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert"><span id="exhibit-title"></span> exhibit is empty.</div>';
            await exhibitsModule.set_exhibit_title(exhibit_id);
            return false;
        }

        for (let i = 0; i < items.length; i++) {

            let item_id = items[i].uuid;
            let type = items[i].type;
            let order = items[i].order;
            let is_published = items[i].is_published;
            let status;
            let item_details = '';
            let add_grid_items = '';
            let edit_type;
            let edit;
            let delete_item;

            if (type === 'item') {
                edit_type = 'standard';
            } else if (type === 'heading') {
                edit_type = type;
            } else if (type === 'grid') {
                edit_type = type;
            } else {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to determine edit type.</div>`;
                return false;
            }

            if (is_published === 1) {
                status = `<a href="#" id="${item_id}" class="suppress-item"><span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span></a>`;
                edit = '';
                delete_item = '';
            } else if (is_published === 0) {
                status = `<a href="#" id="${item_id}" class="publish-item"><span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span></a>`;
                edit = `<a href="${APP_PATH}/items/${edit_type}/edit?exhibit_id=${exhibit_id}&item_id=${item_id}" title="Edit"><i class="fa fa-edit pr-1"></i></a>`;
                delete_item = `<a href="${APP_PATH}/items/delete?exhibit_id=${exhibit_id}&item_id=${item_id}&type=${type}" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;
            }

            item_data += `<tr id="${item_id}-${type}" draggable='true'>`;
            item_data += `<td style="width: 5%">${order}</td>`;

            if (type === 'item') { // standard

                let title = `<a href="#">${helperModule.unescape(items[i].title)}</a>`;
                let description = helperModule.unescape(items[i].description);
                let thumbnail = '';
                let img = '';
                let item_type;

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
                    thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', exhibit_id).replace(':media', items[i].thumbnail);
                    img = `<p><img alt="${thumbnail}" src="${thumbnail}" height="100" width="100"></p>`;
                }

                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p><strong>${title}</strong></p>
                    ${img}
                    ${item_type}
                    <!--<p><strong>${description}</strong></p>-->
                    </td>`;

            } else if (items[i].type === 'heading') {

                let text = helperModule.unescape(items[i].text);
                edit_type = 'heading';

                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p><strong>${text}</strong></p>
                    </td>`;

            } else if (items[i].type === 'grid') {

                let grid_items_fragment = '';
                let grid_item_count = '';

                add_grid_items = `<a href="${APP_PATH}/items/grid/item?exhibit_id=${exhibit_id}&grid_id=${item_id}" title="Add Grid Item"><i class="fa fa-plus pr-1"></i></a>&nbsp;`;
                edit_type = 'grid';

                if (items[i].grid_items.length === 0) {
                    grid_items_fragment += '<p><strong>No items</strong></p>';

                } else {

                    item_details = `<a href="${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${item_id}" title="View grid Items"><i class="fa fa-search pr-1"></i></a>`;
                    grid_item_count += `Contains ${items[i].grid_items.length} items`;
                    delete_item = ''; // Can't delete grid if it contain items
                }

                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p>${items[i].columns} columns </p>
                    <p>${grid_item_count}</p>
                    <div id="grid-items-${exhibit_id}"><em>${grid_items_fragment}</em></div>
                    <i class="fa fa-th"></i>
                    </td>`;
            }

            item_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
            item_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${item_details}                                    
                                    ${add_grid_items}&nbsp;
                                    ${edit}&nbsp;
                                    ${delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';
        }

        // item_data += '</tr>';

        document.querySelector('#item-data').innerHTML = item_data;
        let items_table = new DataTable('#items');

        bind_publish_item_events();
        bind_suppress_item_events();

        // TODO: drag and drop to re-order - move to helper
        const tr_elem = Array.from(document.getElementsByTagName('tr'));
        let row;
        let children;
        let updated_order = [];
        let reorder_obj = {};

        tr_elem.forEach(tr => {

            tr.addEventListener('dragstart', (event) => {
                row = event.target;
            });

            tr.addEventListener('dragover', (event) => {

                let e = event;
                e.preventDefault();

                children = Array.from(e.target.parentNode.parentNode.children);

                if (children.indexOf(e.target.parentNode) > children.indexOf(row)) {
                    // move down
                    e.target.parentNode.after(row);
                } else {
                    // move up
                    e.target.parentNode.before(row);
                }
            });

            tr.addEventListener('drop', async (event) => {

                for (let i=0;i<children.length;i++ ) {

                    let child = children[i];
                    let id = child.getAttribute('id');
                    let id_arr = id.split('-');
                    reorder_obj.type = id_arr.pop();
                    reorder_obj.uuid = id_arr.join('-');
                    reorder_obj.order = i + 1;
                    updated_order.push(reorder_obj);
                    reorder_obj = {};
                }

                const token = authModule.get_user_token();
                const response = await httpModule.req({
                    method: 'POST',
                    url: EXHIBITS_ENDPOINTS.exhibits.reorder_records.post.endpoint.replace(':exhibit_id', exhibit_id),
                    data: updated_order,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 201) {

                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Items reordered</div>`;
                    await itemsModule.display_items(event);

                    /*
                    setTimeout(() => {
                        location.replace(`${APP_PATH}/items?exhibit_id=${uuid}`);
                    }, 3000);

                     */
                }
            });
        });

        setTimeout(() => {
            document.querySelector('#item-card').style.visibility = 'visible';
            document.querySelector('#message').innerHTML = '';
        }, 100);
    };

    /**
     * Deletes item
     */
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

    /**
     * Publishes item
     * @param uuid
     */
    async function publish_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = uuid;
            const elems = document.getElementsByTagName('tr');
            let type;

            for (let i = 0; i < elems.length; i++) {
                if (elems[i].id.length !== 0 && elems[i].id.indexOf(uuid) !== -1) {
                    let tmp = elems[i].id.split('-');
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

    /**
     * Suppresses item
     * @param uuid
     */
    async function suppress_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = uuid;
            const elems = document.getElementsByTagName('tr');
            let type;

            for (let i = 0; i < elems.length; i++) {
                if (elems[i].id.length !== 0 && elems[i].id.indexOf(uuid) !== -1) {
                    let tmp = elems[i].id.split('-');
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

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Item suppressed</div>`;

                setTimeout(() => {
                    location.reload();
                }, 1000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    /**
     * Binds publish click behavior to exhibit links
     */
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

    /**
     * Binds suppress click behavior to exhibit links
     */
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
            navModule.set_preview_link();
            navModule.set_item_nav_menu_links();
            itemsModule.display_items();


            /*
            setTimeout(() => {

                let row;

                function start(){
                    console.log('start');
                    row = event.target;
                }

                function dragover(){
                    console.log('dragover');
                    let e = event;
                    e.preventDefault();

                    let children= Array.from(e.target.parentNode.parentNode.children);

                    if(children.indexOf(e.target.parentNode)>children.indexOf(row))
                        e.target.parentNode.after(row);
                    else
                        e.target.parentNode.before(row);
                }

            }, 500);

             */

            setTimeout(() => {
                document.querySelector('#items-menu').style.visibility = 'visible';
            }, 100);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
