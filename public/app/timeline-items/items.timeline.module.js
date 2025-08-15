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

            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            const endpoint = tmp.replace(':timeline_id', timeline_id);
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

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');
        await exhibitsModule.set_exhibit_title(exhibit_id);
        const items = await get_timeline_items(exhibit_id, timeline_id);
        let item_data = '';

        if (items === false) {
            document.querySelector('#item-card').innerHTML = '';
            return false;
        }

        if (items.length === 0) {
            document.querySelector('.card').innerHTML = '';
            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert">Timeline is empty.</div>';
            return false;
        }

        for (let i = 0; i < items.length; i++) {
            item_data += await itemsListDisplayModule.display_timeline_items(items[i]);
        }

        document.querySelector('#timeline-item-list').innerHTML = item_data;

        new DataTable('#timeline-items', {
            paging: false,
            order: [[1, 'asc']],
            columnDefs: [
                {
                    target: 1,
                    visible: false,
                    searchable: true
                },
            ]
        });

        bind_publish_timeline_item_events();
        bind_suppress_timeline_item_events();
    };

    async function publish_timeline_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const timeline_item_id = uuid;
            const type = 'timeline_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.timeline_item_publish.post.endpoint.replace(':exhibit_id', exhibit_id);
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

            if (response !== undefined && response.status === 200) {

                setTimeout(() => {
                    let elem = document.getElementById(uuid);
                    document.getElementById(uuid).classList.remove('publish-item');
                    document.getElementById(uuid).classList.add('suppress-item');
                    document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                    document.getElementById(uuid).innerHTML = '<span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span>';
                    document.getElementById(uuid).addEventListener('click', async (event) => {
                        event.preventDefault();
                        const uuid = elem.getAttribute('id');
                        await suppress_timeline_item(uuid);
                    }, false);
                }, 0);

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

                    if (type[1] === 'timelineitem' && type[2] === 'text') {
                        details_path = `${APP_PATH}/items/vertical-timeline/item/text/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;
                    } else {
                        details_path = `${APP_PATH}/items/vertical-timeline/item/media/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;
                    }

                    let uuid_actions = `${uuid}-item-actions`;
                    let elem = document.getElementById(uuid_actions);
                    let item_details = `<a href="${details_path}" title="View details" aria-label="item-details"><i class="fa fa-folder-open pr-1"></i> </a>`;
                    let trash = `<i title="Can only delete if unpublished" style="color: #d3d3d3" class="fa fa-trash pr-1" aria-label="delete-timeline-item"></i>`;
                    elem.innerHTML = `
                        <div class="card-text text-sm-center">
                        ${item_details}&nbsp;
                        ${trash}
                        </div>`;
                }, 0);
            }

            if (response !== undefined && response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to publish timeline item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            } else if (response === undefined) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to publish timeline item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            return false;

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
            const etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.timeline_item_suppress.post.endpoint.replace(':exhibit_id', exhibit_id);
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

            if (response !== undefined && response.status === 200) {

                setTimeout(() => {
                    let elem = document.getElementById(uuid);
                    document.getElementById(uuid).classList.remove('suppress-item');
                    document.getElementById(uuid).classList.add('publish-item');
                    document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                    document.getElementById(uuid).innerHTML = '<span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Unpublished</span>';
                    document.getElementById(uuid).addEventListener('click', async (event) => {
                        event.preventDefault();
                        const uuid = elem.getAttribute('id');
                        await publish_timeline_item(uuid);
                    }, false);
                }, 0);

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
                    let view_items = '';

                    if (type[1] === 'timelineitem' && type[2] === 'text') {
                        edit_path = `${APP_PATH}/items/vertical-timeline/item/text/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;
                    } else {
                        edit_path = `${APP_PATH}/items/vertical-timeline/item/media/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;
                    }

                    delete_path = `${APP_PATH}/items/vertical-timeline/item/delete?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;

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
                }, 0);

            } else if (response === undefined) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-danger"></i> You do not have permission to unpublish this record.</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            if (response !== undefined && response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-warning"></i> Unable to unpublish timeline item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_publish_timeline_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('publish-item'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    event.preventDefault();
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

            const exhibit_links = Array.from(document.getElementsByClassName('suppress-item'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    event.preventDefault();
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
                    window.location.replace(`${APP_PATH}/items/timeline/items?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}`);
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            const status = helperModule.get_parameter_by_name('status');

            if (status !== null && status === '403') {

                const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
                const timeline_id = helperModule.get_parameter_by_name('timeline_id');

                setTimeout(() => {
                    window.history.replaceState({page: 'items'}, '', '/exhibits-dashboard/items/vertical-timeline/items?exhibit_id=' + exhibit_id + '&timeline_id=' + timeline_id);
                }, 0);

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to add item.</div>`;
                }, 50);
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.set_preview_link();
            navModule.back_to_items();
            navModule.set_timeline_item_nav_menu_links();
            navModule.set_logout_link();
            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
