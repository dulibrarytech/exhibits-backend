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

const itemsListDisplayModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    function check_published_status(item, item_route) {

        let published_obj = {};

        if (item.is_published === 1) {
            published_obj.draggable = `<tr id="${item.uuid}_${item.type}">`;
            published_obj.item_order = `<td class="item-order"><span style="padding-left: 4px;">${item.order}</span></td>`;
            published_obj.status = `<a href="#" id="${item.uuid}" class="suppress-item"><span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span></a>`;
            published_obj.edit = `<i title="Can only edit if unpublished" style="color: #d3d3d3" class="fa fa-edit pr-1"></i>`;
            published_obj.delete_item = `<i title="Can only delete if unpublished" style="color: #d3d3d3" class="fa fa-trash pr-1"></i>`;
        } else if (item.is_published === 0) {
            published_obj.draggable = `<tr class="dropzone" id="${item.uuid}_${item.type}" draggable='true'>`;
            published_obj.item_order = `<td class="grabbable item-order"><i class="fa fa-reorder"></i><span style="padding-left: 4px;">${item.order}</span></td>`;
            published_obj.status = `<a href="#" id="${item.uuid}" class="publish-item"><span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Unpublished</span></a>`;
            published_obj.edit = `<a href="${APP_PATH}/items/${item_route}/edit?exhibit_id=${item.is_member_of_exhibit}&item_id=${item.uuid}" title="Edit"><i class="fa fa-edit pr-1"></i></a>`;
            published_obj.delete_item = `<a href="${APP_PATH}/items/delete?exhibit_id=${item.is_member_of_exhibit}&item_id=${item.uuid}&type=${item.type}" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;
        }

        return published_obj;
    }

    obj.display_heading_items = async function(item) {

        try {

            const type = item.type;
            const text = helperModule.unescape(item.text);
            let item_obj = check_published_status(item, 'heading');
            let item_data = '';

            // start row
            item_data += item_obj.draggable;
            item_data += item_obj.item_order;

            item_data += `<td class="item-metadata">
                    <p><button class="btn btn-default"><small>${type}</small></button></p>
                    <p><strong>${text}</strong></p>
                    </td>`;

            item_data += `<td class="item-status"><small>${item_obj.status}</small></td>`;
            item_data += `<td class="item-actions">
                                <div class="card-text text-sm-center">
                                    ${item_obj.edit}&nbsp;
                                    ${item_obj.delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';

            return item_data;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.display_standard_items = async function(item) {

        try {

            const type = item.type;
            const item_obj = check_published_status(item, 'standard');
            let title = helperModule.strip_html(helperModule.unescape(item.title));
            // let title = helperModule.unescape(item.title);
            let item_data = '';
            let thumbnail = '';
            let img = '';
            let item_type;
            let media = item.media;

            if (item.mime_type.indexOf('image') !== -1 || item.item_type === 'image') {
                item_type = '<i class="fa fa-image"></i>';
            } else if (item.mime_type.indexOf('video') !== -1 || item.item_type === 'video') {
                item_type = '<i class="fa fa-file-video-o"></i>';
                thumbnail = `${APP_PATH}/static/images/video-tn.png`;
                img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
            } else if (item.mime_type.indexOf('audio') !== -1 || item.item_type === 'audio') {
                item_type = '<i class="fa fa-file-audio-o"></i>';
                thumbnail = `${APP_PATH}/static/images/audio-tn.png`;
                img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
            } else if (item.mime_type.indexOf('pdf') !== -1 || item.item_type === 'pdf') {
                item_type = '<i class="fa fa-file-pdf-o"></i>';
                thumbnail = `${APP_PATH}/static/images/pdf-tn.png`;
                img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
            } else if (item.item_type === 'text') {
                item_type = '<i class="fa fa-file-text-o"></i>';
                media = 'Text only';
            } else {
                item_type = '<i class="fa fa-file-o"></i>';
            }

            if (item.is_repo_item === 1) {

                const repo_record = await helperModule.get_repo_item_data(item.media);

                if (title.length === 0) {
                    title = repo_record.title;
                }

                thumbnail = helperModule.render_repo_thumbnail(repo_record.thumbnail.data);
                img = `<p><img alt="thumbnail" src="${thumbnail}" height="75" width="75"></p>`;
            }

            if (item.is_kaltura_item === 1) {

                if (title.length === 0) {
                    title = 'Kaltura Item';
                }
            }

            if (title.length === 0 && item.text.length > 0) {

                title = helperModule.strip_html(helperModule.unescape(item.text));

                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            if (img.length === 0) {

                if (item.thumbnail.length > 0) {
                    thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', item.is_member_of_exhibit).replace(':media', item.thumbnail);
                    img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
                } else if (item.thumbnail.length === 0 && item.item_type === 'image') {
                    thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', item.is_member_of_exhibit).replace(':media', item.media);
                    img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
                } else {
                    thumbnail = `${APP_PATH}/static/images/image-tn.png`;
                    img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
                }
            }

            // start row
            item_data += item_obj.draggable;
            item_data += item_obj.item_order;

            item_data += `<td class="item-metadata">
                    
                    <p><button class="btn btn-default">${item_type} <small>${type}</small></button></p>
                    <p><strong>${title}</strong></p>
                    ${img}                   
                    <small><em>${media}</em></small>
                    </td>`;

            item_data += `<td class="item-status"><small>${item_obj.status}</small></td>`;
            item_data += `<td class="item-actions">
                                <div class="card-text text-sm-center">
                                    ${item_obj.edit}&nbsp;
                                    ${item_obj.delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';

            return item_data;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.display_grids = async function(item) {

        try {

            const type = item.type;
            const title = helperModule.unescape(item.title);
            const item_obj = check_published_status(item, 'grid');
            let add_grid_items = `<a href="${APP_PATH}/items/grid/item?exhibit_id=${item.is_member_of_exhibit}&grid_id=${item.uuid}" title="Add Grid Item"><i class="fa fa-plus pr-1"></i></a>&nbsp;`;
            let item_data = '';
            let view_grid_items = '';
            let grid_items_fragment = '';
            let grid_item_count = '';

            if (item.grid_items.length === 0) {
                grid_items_fragment += '<p><strong>No items</strong></p>';

            } else {
                view_grid_items = `<a href="${APP_PATH}/items/grid/items?exhibit_id=${item.is_member_of_exhibit}&grid_id=${item.uuid}" title="View grid Items"><i class="fa fa-search pr-1"></i></a>`;
                grid_item_count += `Contains ${item.grid_items.length} items`;
            }

            // start row
            item_data += item_obj.draggable;
            item_data += item_obj.item_order;

            item_data += `<td class="item-metadata">
                    <p><button class="btn btn-default"><i class="fa fa-th"></i> <small>${type}</small></button></p>
                    <p><strong>${title}</strong></p>
                    <p>${item.columns} columns</p>
                    <p>${grid_item_count}</p>
                    <div id="grid-items-${item.is_member_of_exhibit}"><em>${grid_items_fragment}</em></div>
                    </td>`;

            item_data += `<td class="item-status"><small>${item_obj.status}</small></td>`;
            item_data += `<td class="item-actions">
                                <div class="card-text text-sm-center">
                                    ${view_grid_items}&nbsp;
                                    ${add_grid_items}&nbsp;
                                    ${item_obj.edit}&nbsp;
                                    ${item_obj.delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';

            return item_data;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.display_timelines = async function(item) {

        try {

            const type = item.type;
            item.type = '';
            item.type = 'timeline';
            const title = helperModule.unescape(item.title);
            const item_obj = check_published_status(item, 'vertical-timeline');
            let add_timeline_items = `<a href="${APP_PATH}/items/vertical-timeline/item?exhibit_id=${item.is_member_of_exhibit}&timeline_id=${item.uuid}" title="Add Timeline Item"><i class="fa fa-plus pr-1"></i></a>&nbsp;`;
            let item_data = '';
            let view_timeline_items = '';
            let timeline_items_fragment = '';
            let timeline_item_count = '';

            if (item.timeline_items.length === 0) {
                timeline_items_fragment += '<p><strong>No items</strong></p>';
            } else {
                view_timeline_items = `<a href="${APP_PATH}/items/timeline/items?exhibit_id=${item.is_member_of_exhibit}&timeline_id=${item.uuid}" title="View Timeline Items"><i class="fa fa-search pr-1"></i></a>`;
                timeline_item_count += `Contains ${item.timeline_items.length} items`;
            }

            // start row
            item_data += item_obj.draggable;
            item_data += item_obj.item_order;

            item_data += `<td class="item-metadata">
                    <p><button class="btn btn-default"><i class="fa fa-calendar"></i> <small>${type}</small></button></p>
                    <p><strong>${title}</strong></p>
                    <p>${timeline_item_count}</p>
                    <div id="grid-items-${item.is_member_of_exhibit}"><em>${timeline_items_fragment}</em></div>
                    </td>`;

            item_data += `<td class="item-status"><small>${item_obj.status}</small></td>`;
            item_data += `<td class="item-actions">
                                <div class="card-text text-sm-center">
                                    ${view_timeline_items}&nbsp;
                                    ${add_timeline_items}&nbsp;
                                    ${item_obj.edit}&nbsp;
                                    ${item_obj.delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';

            return item_data;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.display_grid_items = async function (item) {

        try {

            item.type = '';
            item.type = 'griditem';
            const item_obj = check_published_status(item, 'grid/item');
            let thumbnail;
            let media = '';
            let url;
            let item_type;
            let img = '';
            let item_data = '';
            let title = '';

            if (item.mime_type.indexOf('image') !== -1 || item.item_type === 'image') {
                item_type = '<i class="fa fa-image"></i>';
            } else if (item.mime_type.indexOf('video') !== -1 || item.item_type === 'video') {
                item_type = '<i class="fa fa-file-video-o"></i>';
                thumbnail = `${APP_PATH}/static/images/video-tn.png`;
                img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
            } else if (item.mime_type.indexOf('audio') !== -1 || item.item_type === 'audio') {
                item_type = '<i class="fa fa-file-audio-o"></i>';
                thumbnail = `${APP_PATH}/static/images/audio-tn.png`;
                img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
            } else if (item.mime_type.indexOf('pdf') !== -1 || item.item_type === 'pdf') {
                item_type = '<i class="fa fa-file-pdf-o"></i>';
                thumbnail = `${APP_PATH}/static/images/pdf-tn.png`;
                img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
            } else if (item.item_type === 'text') {
                item_type = '<i class="fa fa-file-text-o"></i>';
                media = 'Text only';
            } else {
                item_type = '<i class="fa fa-file-o"></i>';
            }

            if (item.is_repo_item === 1) {

                const repo_record = await helperModule.get_repo_item_data(item.media);

                if (title.length === 0) {
                    title = repo_record.title;
                }

                thumbnail = helperModule.render_repo_thumbnail(repo_record.thumbnail.data);
                img = `<p><img alt="thumbnail" src="${thumbnail}" height="75" width="75"></p>`;
            }

            if (item.is_kaltura_item === 1) {

                if (title.length === 0) {
                    title = 'Kaltura Item';
                }
            }

            if (title.length === 0 && item.text.length > 0) {

                title = helperModule.unescape(item.text);

                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            if (item.media.length > 0) {
                media = item.media;
            }

            if (img.length === 0) {

                if (item.thumbnail.length > 0) {
                    thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', item.is_member_of_exhibit).replace(':media', item.thumbnail);
                    img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
                } else if (item.thumbnail.length === 0 && item.item_type === 'image') {
                    thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', item.is_member_of_exhibit).replace(':media', item.media);
                    img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
                } else {
                    thumbnail = `${APP_PATH}/static/images/image-tn.png`;
                    img = `<p><img src="${thumbnail}" alt="thumbnail" height="75" width="75"></p>`;
                }
            }

            if (item.is_published === 0) {
                item_obj.edit = `<a href="${APP_PATH}/items/grid/item/edit?exhibit_id=${item.is_member_of_exhibit}&grid_id=${item.is_member_of_grid}&item_id=${item.uuid}" title="Edit"><i class="fa fa-edit pr-1"></i></a>`;
                item_obj.delete_item = `<a href="${APP_PATH}/items/grid/item/delete?exhibit_id=${item.is_member_of_exhibit}&grid_id=${item.is_member_of_grid}&item_id=${item.uuid}" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;
            }

            // start row
            item_data += item_obj.draggable;
            item_data += item_obj.item_order;

            if (item.thumbnail.length > 0) {
                thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', item.is_member_of_exhibit).replace(':media', item.thumbnail);
                img = `<p><img alt="thumbnail" src="${thumbnail}" height="75" width="75"></p>`;
            }

            item_data += `<td class="item-metadata">
                    <p><button class="btn btn-default">${item_type} <small>grid item</small></button></p>
                    <p><strong>${title}</strong></p>
                    ${img}
                    <small><em>${media}</em></small>
                    </td>`;

            item_data += `<td style="width: 5%;text-align: center"><small>${item_obj.status}</small></td>`;
            item_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${item_obj.edit}&nbsp;
                                    ${item_obj.delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';

            return item_data;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.display_timeline_items = function (item) {

        try {

            item.type = '';
            item.type = 'timelineitem';
            let title = helperModule.unescape(item.title);
            const item_obj = check_published_status(item, 'vertical-timeline/item');
            let item_data = '';
            let thumbnail;
            let url;
            let item_type;
            let img = '';
            let item_date = new Date(item.date);
            let year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(item_date);
            let month = new Intl.DateTimeFormat('en', { month: 'numeric' }).format(item_date);
            let day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(item_date);
            let date = `${month}/${day}/${year}`;

            if (item.mime_type.indexOf('image') !== -1) {
                item_type = '<i class="fa fa-image"></i>';
            } else if (item.mime_type.indexOf('video') !== -1) {
                item_type = '<i class="fa fa-file-video-o"></i>';
            } else if (item.mime_type.indexOf('audio') !== -1) {
                item_type = '<i class="fa fa-file-audio-o"></i>';
            } else if (item.mime_type.indexOf('pdf') !== -1) {
                item_type = '<i class="fa fa-file-pdf-o"></i>';
            } else {
                item_type = '<i class="fa fa-file-o"></i>';
            }

            if (item.thumbnail.length > 0) {
                url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', item.is_member_of_exhibit).replace(':media', item.thumbnail);
                thumbnail = `<p><img alt="${url}" src="${url}" height="100" width="100"></p>`;
            } else {
                thumbnail = `${APP_PATH}/static/images/image-tn.png`;
                img = `<p><img src="${thumbnail}" alt="thumbnail" height="100" width="100"></p>`;
            }

            if (item.is_published === 0) {
                item_obj.edit = `<a href="${APP_PATH}/items/vertical-timeline/item/edit?exhibit_id=${item.is_member_of_exhibit}&timeline_id=${item.is_member_of_timeline}&item_id=${item.uuid}" title="Edit"><i class="fa fa-edit pr-1"></i></a>`;
                item_obj.delete_item = `<a href="${APP_PATH}/items/vertical-timeline/item/delete?exhibit_id=${item.is_member_of_exhibit}&timeline_id=${item.is_member_of_timeline}&item_id=${item.uuid}" title="Delete"><i class="fa fa-trash pr-1"></i></a>`;
            }

            // start rows
            item_data += `<tr id="${item.uuid}_${item.type}">`;
            // item_data += `<td class="item-order"><span style="padding-left: 4px;">${item.order}</span></td>`;

            if (item.thumbnail.length > 0) {
                thumbnail = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', item.is_member_of_exhibit).replace(':media', item.thumbnail);
                img = `<p><img alt="thumbnail" src="${thumbnail}" height="75" width="75"></p>`;
            }

            item_data += `<td class="item-metadata">
                    <p><button class="btn btn-default">${item_type} <small>timeline item</small></button></p>
                    <p><strong>${title}</strong></p>
                    <p><strong>${date}</strong></p>
                    ${img}
                   
                    </td>`;

            item_data += `<td style="width: 5%;text-align: center"><small>${item_obj.status}</small></td>`;
            item_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${item_obj.edit}&nbsp;
                                    ${item_obj.delete_item}
                                </div>
                            </td>`;
            item_data += '</tr>';

            return item_data;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = function () {};

    return obj;

}());
