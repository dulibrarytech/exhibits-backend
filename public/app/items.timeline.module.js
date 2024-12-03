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

const itemsTimelineModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_timeline_items(exhibit_id, timeline_id) {

        try {

            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            const endpoint = tmp.replace(':timeline_id', timeline_id);
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

    obj.display_timeline_items = async function (event) {

        if ($.fn.dataTable.isDataTable('#timeline-items')) {
            $('#grid-items').DataTable().clear().destroy();
        }

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');
        await exhibitsModule.set_exhibit_title(exhibit_id);
        const items = await get_timeline_items(exhibit_id, timeline_id);
        let item_data = '';

        if (items.length === 0) {
            document.querySelector('.card').innerHTML = '';
            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert">Timeline is empty.</div>';
            return false;
        }

        for (let i = 0; i < items.length; i++) {

            let title = helperModule.unescape(items[i].title);
            let order = items[i].order;
            let is_published = items[i].is_published;
            let status;
            let item_id = items[i].uuid;
            let thumbnail;
            let url;
            let item_type;
            let item_order;
            let img = '';
            let edit;
            let delete_item;
            let draggable;

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
                draggable = `<tr id="${item_id}_timelineitem">`;
                item_order = `<td class="item-order"><span style="padding-left: 4px;">${order}</span></td>`;
                status = `<a href="#" id="${item_id}" class="suppress"><span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span></a>`;
                edit = '';
                delete_item = '';
            } else if (is_published === 0) {
                draggable = `<tr class="dropzone" id="${item_id}_timelineitem" draggable='true'>`;
                item_order = `<td class="grabbable item-order"><i class="fa fa-reorder"></i><span style="padding-left: 4px;">${order}</span></td>`;
                status = `<a href="#" id="${item_id}" class="publish"><span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Unpublished</span></a>`;
                edit = `<a href="${APP_PATH}/items/grid/item/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}" title="Edit"><i class="fa fa-edit pr-1"></i></a>`;
                delete_item = `<a href="${APP_PATH}/items/grid/item/delete?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;
            }

            // start rows
            item_data += draggable;
            item_data += item_order;

            if (items[i].thumbnail.length > 0) {
                thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', exhibit_id).replace(':media', items[i].thumbnail);
                img = `<p><img alt="thumbnail" src="${thumbnail}" height="75" width="75"></p>`;
            }

            item_data += `<td class="item-metadata">
                    <p><button class="btn btn-default">${item_type} <small>timeline item</small></button></p>
                    <p><strong>${title}</strong></p>
                    ${img}
                   
                    </td>`;

            item_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
            item_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${edit}&nbsp;
                                    ${delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';
        }

        document.querySelector('#timeline-item-list').innerHTML = item_data;

        let timeline_items_table = new DataTable('#timeline-items', {
            paging: false
        });

        bind_publish_grid_item_events();
        bind_suppress_grid_item_events();
        helperModule.reorder_timeline_items(event, timeline_id, 'timeline_items');
    };

    async function publish_timeline_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const timeline_item_id = uuid;
            const type = 'timeline_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.grid_item_publish.post.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':timeline_id', timeline_id);
            const endpoint = gtmp.replace(':timeline_item_id', timeline_item_id);
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

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Timeline item published</div>`;

                setTimeout(() => {
                    location.reload();
                }, 1000);
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

    async function suppress_timeline_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const timeline_item_id = uuid;
            const type = 'timeline_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.grid_item_suppress.post.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':timeline_id', timeline_id);
            const endpoint = gtmp.replace(':timeline_item_id', timeline_item_id);
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

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Timeline item unpublished</div>`;

                setTimeout(() => {
                    location.reload();
                }, 1000);
            }

            if (response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-warning"></i> Unable to unpublish timeline item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_publish_timeline_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('publish'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    const uuid = exhibit_link.getAttribute('id');
                    await publish_timeline_item(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_suppress_timeline_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('suppress'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async () => {
                    const uuid = exhibit_link.getAttribute('id');
                    await suppress_timeline_item(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.delete_timeline_item = async function () {

        try {

            document.querySelector('#delete-message').innerHTML = 'Deleting timeline item...';
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const timeline_item_id = helperModule.get_parameter_by_name('item_id');
            const type = 'timeline_item';
            const etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.delete.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':timeline_id', timeline_id);
            const endpoint = gtmp.replace(':item_id', timeline_item_id);
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
                    window.location.replace(`${APP_PATH}/items/timeline/items?exhibit_id=${exhibit_id}&timeline_id=${grid_id}`);
                }, 2000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            navModule.init();
            navModule.back_to_items();
            navModule.set_grid_item_nav_menu_links();
            navModule.set_logout_link();
            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
