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
            console.log('ERROR: ', error.message);
        }
    }

    /**
     * Gets exhibit items
     */
    obj.display_items = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('uuid');
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
            let edit_type = 'standard';
            let delete_item = `<a href="#" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;

            if (is_published === 1) {
                status = `<a href="#" id="${item_id}" class="suppress-item"><span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span></a>`;
            } else if (is_published === 0) {
                status = `<a href="#" id="${item_id}" class="publish-item"><span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span></a>`;
            }

            item_data += '<tr>';
            item_data += `<td style="width: 5%">${order}</td>`;

            if (items[i].type === 'item') { // standard

                let thumbnail = '';
                let title = `<a href="${APP_PATH}/items/details?uuid=${exhibit_id}&item_id=${item_id}">${helperModule.unescape(items[i].title)}</a>`;
                let description = helperModule.unescape(items[i].description);
                let date = items[i].date;

                if (items[i].thumbnail.length > 0) {
                    thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', uuid).replace(':media', items[i].thumbnail);
                    item_data = `<p><img alt="${thumbnail}" src="${thumbnail}" height="100" width="100"></p>`;
                }

                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p><strong>${title}</strong></p>
                    ${thumbnail}
                    <p><small>${description}</small></p>
                    <p><small>${date}</small></p>
                    </td>`;

                item_details = `<a href="${APP_PATH}/items/details?uuid=${exhibit_id}&item_id=${item_id}" title="Item details"><i class="fa fa-search pr-1"></i></a>`;

            } else if (items[i].type === 'heading') {

                let text = helperModule.unescape(items[i].text);
                edit_type = 'heading';

                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p><strong>${text}</strong></p>
                    </td>`;

            } else if (items[i].type === 'grid') {

                // render grid items here
                let grid_items_fragment = '';
                let grid_item_thumbnail = '';
                let grid_item_count = '';

                add_grid_items = `<a href="${APP_PATH}/items/grid/item?exhibit_id=${exhibit_id}&grid_id=${item_id}" title="Add Grid Item"><i class="fa fa-plus pr-1"></i></a>&nbsp;`;
                edit_type = 'grid';

                if (items[i].grid_items.length === 0) {
                    grid_items_fragment += '<p><strong>No items</strong></p>';

                } else {

                    item_details = `<a href="${APP_PATH}/items/grid/list?exhibit_id=${exhibit_id}&grid_id=${item_id}" title="View grid Items"><i class="fa fa-search pr-1"></i></a>`;
                    grid_item_count += `Contains ${items[i].grid_items.length} items`;
                    delete_item = ''; // Can't delete grid if it contain items

                    /* Display grid item titles?
                    for (let j=0;j<items[i].grid_items.length;j++) {
                        grid_items_fragment += `<p><strong><small>${helperModule.unescape(items[i].grid_items[j].title)}</small></strong></p>`;
                    }

                     */
                }

                item_data += `<td style="width: 35%">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p>${items[i].columns} columns </p>
                    <p>${grid_item_count}</p>
                    <div id="grid-items-${exhibit_id}">${grid_items_fragment}</div>
                    </td>`;
            }

            item_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
            item_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${add_grid_items}
                                    ${item_details}&nbsp;
                                    <a href="${APP_PATH}/items/${edit_type}/edit?exhibit_id=${exhibit_id}&item_id=${item_id}" title="Edit"><i class="fa fa-edit pr-1"></i></a>&nbsp;
                                    ${delete_item}
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

    /**
     * Gets item details
     */
    obj.get_item_details = async function () {

        const uuid = helperModule.get_parameter_by_name('uuid');
        const item_id = helperModule.get_parameter_by_name('item_id');
        let items;
        let item_record;
        let item_media;
        let media_type;
        let layout_image;
        let layout_image_img;
        let message = document.querySelector('#message');

        document.querySelector('#exhibit-title').innerHTML = await exhibitsModule.get_exhibit_title(uuid);

        if (uuid === undefined || item_id === undefined) {
            message.innerHTML = '<div class="alert alert-info" role="alert">Error: Unable to get item record id.</div>';
            return false;
        }

        items = JSON.parse(window.localStorage.getItem('items'));

        if (items === null) {
            message.innerHTML = '<div class="alert alert-info" role="alert">Error: Unable to get item records from storage.</div>';
            return false;
        }

        item_record = items.find(o => o.uuid === item_id);

        item_media = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', uuid).replace(':media', item_record.media);
        document.querySelector('#item-media').innerHTML = `<img src="${item_media}" width="100%" height="400" title="${item_record.title}">`;
        document.querySelector('.item-title').innerHTML = item_record.title;
        document.querySelector('#item-description').innerHTML = `<p>${item_record.description}</p>`;
        document.querySelector('#item-date').innerHTML = `<p>${item_record.date}</p>`;
        document.querySelector('#item-order').innerHTML = `<p><small>Item order ${item_record.order}</small></p>`;

        if (item_record.is_published === 0) {
            document.querySelector('#item-status').innerHTML = `<p><small>Item is not published</small></p>`;
        } else if (item_record.is_published === 1) {
            document.querySelector('#item-status').innerHTML = `<p><small>Item is published</small></p>`;
        }

        document.querySelector('#item-id').innerHTML = `<p><small>${item_record.uuid}</small></p>`;

        if (item_record.item_type === 'image') {
            media_type = `<i class="fa fa-file-image-o" title="${item_record.item_type}"></i>`;
        } else if (item_record.item_type === 'video') {
            document.querySelector('#item-type').innerHTML = `<i class="fa fa-file-movie-o" title="${item_record.item_type}"></i>`;
        } else if (item_record.item_type === 'audio') {
            document.querySelector('#item-type').innerHTML = `<i class="fa fa-file-audio-o" title="${item_record.item_type}"></i>`;
        }

        document.querySelector('#item-caption').innerHTML = `${media_type}&nbsp;&nbsp;&nbsp;${item_record.caption}`;

        if (item_record.layout === 'media_top') {
            layout_image = 'item_layout_media_top_text_bottom.png';
        } else if (item_record.layout === 'media_bottom') {
            layout_image = 'item_layout_text_top_media_bottom.png';
        } else if (item_record.layout === 'media_right') {
            layout_image = 'item_layout_text_left_media_right.png';
        } else if (item_record.layout === 'media_left') {
            layout_image = 'item_layout_media_left_text_right.png';
        } else if (item_record.layout === 'media_only') {
            layout_image = 'item_layout_media_only.png';
        } else if (item_record.layout === 'text_only') {
            layout_image = 'item_layout_text_only.png';
        } else {
            layout_image = 'no image';
        }

        layout_image_img = `<img src="${APP_PATH}/static/images/${layout_image}" height="85" title="${item_record.layout}"><p><small>Item layout</small></p>`;

        document.querySelector('#item-layout').innerHTML = layout_image_img;
        document.querySelector('#item-media-width').innerHTML = item_record.media_width;
        document.querySelector('#item-created').innerHTML = `<small>${item_record.created}</small>`;

        const styles = JSON.parse(item_record.styles);
        console.log(styles);

        if (Object.keys(styles).length > 0) {
            // TODO:
            console.log('render styles here');
        }

        console.log(item_record);
    };

    /** TODO: use the one in exhibit module
     * Sets exhibit title
     * @param uuid
     */
    obj.set_exhibit_title = async function (uuid) {
        let title = await exhibitsModule.get_exhibit_title(uuid);
        document.querySelector('#exhibit-title').innerHTML = `${title}`;
        return false;
    };

    obj.init = function () {
        document.querySelector('#message').innerHTML = '<div class="alert alert-primary" role="alert">Loading...</div>';
        navModule.set_item_nav_menu_links();
        navModule.set_logout_link();
        itemsModule.display_items();
        setTimeout(() => {
            document.querySelector('#items-menu').style.visibility = 'visible';
        }, 100);
    };

    return obj;

}())
