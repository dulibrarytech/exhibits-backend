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

const helperModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Gets url parameter
     * @param name
     * @param url
     */
    obj.get_parameter_by_name = function (name, url) {

        if (!url) {
            url = window.location.href;
        }

        name = name.replace(/[\[\]]/g, "\\$&");

        let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);

        if (!results) {
            return null;
        }

        if (!results[2]) {
            return '';
        }

        return decodeURIComponent(DOMPurify.sanitize(results[2].replace(/\+/g, " ")));
    };

    /**
     * https://stackoverflow.com/questions/7394748/whats-the-right-way-to-decode-a-string-that-has-special-html-entities-in-it
     * Unescapes HTML elements
     * @param data
     */
    obj.unescape = function (data) {
        let elem = document.createElement('textarea');
        elem.innerHTML = data;
        return elem.value;
    };

    /**
     * Strips HTML elements
     * @param data
     */
    obj.strip_html = function (data) {
        return data.replace(/(<([^>]+)>)/gi, '');
    };

    /**
     * Set text editor config
     */
    obj.set_rich_text_editor_config = function () {

        const BASE_URL = '/exhibits-dashboard/static/libs';
        window.RTE_DefaultConfig.url_base = BASE_URL + "/richtexteditor";
        window.RTE_DefaultConfig.contentCssUrl = window.RTE_DefaultConfig.url_base + "/runtime/richtexteditor_content.css"; // Specifies the location of the style sheet that will be used by the editable area.
        window.RTE_DefaultConfig.previewCssUrl = window.RTE_DefaultConfig.url_base + "/runtime/richtexteditor_preview.css"; // Specifies the location of the style sheet that will be used by the preview window.
        window.RTE_DefaultConfig.previewScriptUrl = window.RTE_DefaultConfig.url_base + "/runtime/richtexteditor_preview.js"; // Specifies the location of javascript file that will be used by the preview window.
        window.RTE_DefaultConfig.helpUrl = window.RTE_DefaultConfig.url_base + "/runtime/help.htm";
    };

    /**
     * Sets rte to designated fields
     * @param id
     */
    obj.set_rich_text_editor = function (id) {
        return helperModule.render_rich_text_editor('#' + id);
    };

    /**
     * Creates rich text editor object
     * @param id
     */
    obj.render_rich_text_editor = function(id) {
        const editor_config = {}
        editor_config.toolbar = 'custom';
        editor_config.toolbar_custom = '{code} | {bold, italic, underline, superscript, subscript} | {justifyleft, justifycenter, justifyright, indent} | {preview}';
        editor_config.enterKeyTag = '';
        return new RichTextEditor(id, editor_config);
    };

    /**
     * Sets rich text editor on defined input fields
     * @param ids
     */
    obj.set_rich_text_editors = function(ids) {

        let rich_text_data = {};

        for (let i=0;i<ids.length;i++) {
            rich_text_data[i] = helperModule.set_rich_text_editor(i);
        }

        return rich_text_data;
    };

    /**
     * Gets checked radio button value
     * @param radio_buttons
     */
    obj.get_checked_radio_button = function(radio_buttons) {
        for (let i = 0; i < radio_buttons.length; i++) {
            if (radio_buttons[i].checked) {
                return radio_buttons[i].value;
            }
        }
    };

    /**
     * Gets current year
     */
    obj.get_current_year = function () {
        let cdate = new Date().getFullYear();
        domModule.html('#cdate', DOMPurify.sanitize(cdate));
    };

    /**
     * Gets repo item metadata
     */
    obj.get_repo_item_data = async function () {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const uuid = document.querySelector('#repo-uuid').value;

            if (uuid.length === 0) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter a Repository UUID</div>`;
            }

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.repo_items.endpoint.replace(':uuid', uuid),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {

                if (response.data.data.is_compound === 1) {
                    document.querySelector('#repo-item-metadata').innerHTML = `<p style="color:red">Repository compound objects are not supported.</p>`;
                    return false;
                }

                const tn_array = response.data.data.thumbnail.data;
                const array_buffer_view = new Uint8Array(tn_array);
                const blob = new Blob([array_buffer_view], { type: "image/jpeg" });
                const url_creator = window.URL || window.webkitURL;
                const tn_url = url_creator.createObjectURL(blob);
                const mime_type = response.data.data.mime_type;
                let item_type;

                document.querySelector('#tn').innerHTML = `<img src="${tn_url}" alt="thumbnail" height="200" width="200">`;
                document.querySelector('#item-mime-type').value = response.data.data.mime_type;

                if (mime_type.indexOf('image') !== -1) {
                    item_type = 'image';
                } else if (mime_type.indexOf('video') !== -1) {
                    item_type = 'video';
                } else if (mime_type.indexOf('audio') !== -1) {
                    item_type = 'audio';
                } else if (mime_type.indexOf('pdf') !== -1) {
                    item_type = 'pdf';
                } else {
                    item_type = 'Unable to Determine Type';
                }

                document.querySelector('#item-type').value = item_type;
                document.querySelector('#repo-item-metadata').innerHTML = `<p><strong>${response.data.data.title}</strong><br><em>${response.data.data.mime_type}</em></p>`;
                document.querySelector('#is-repo-item').value = 1;
                helperModule.clear_media_fields('repo_media');

            } else {
                document.querySelector('#repo-item-metadata').innerHTML = `<p style="color:red">Metadata record not found in repository.</p>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Clears media fields
     */
    obj.clear_media_fields = function (type) {

        if (type === 'uploaded_media') {
            document.querySelector('#repo-uuid').value = '';
            document.querySelector('#audio-video').value = '';
            document.querySelector('#is-kaltura-item').value = 0;
            document.querySelector('#is-repo-item').value = 0;
        }

        if (type === 'repo_media') {
            document.querySelector('#audio-video').value = '';
            document.querySelector('#is-kaltura-item').value = 0;
        }

        if (type === 'kaltura_media') {
            document.querySelector('#repo-uuid').value = '';
            document.querySelector('#is-repo-item').value = 0;
        }

        document.querySelector('#item-type').value = '';
        document.querySelector('#item-mime-type').value = '';
        document.querySelector('#item-media').value = '';
        document.querySelector('#item-media-thumbnail-image-display').innerHTML = '';
        document.querySelector('#item-media-filename-display').innerHTML = '';
        document.querySelector('#item-media-trash').style.display = 'none';
    };

    /**
     * Shows form - changes .card class to visible
     */
    obj.show_form = function () {

        try {

            const form_cards = Array.from(document.getElementsByClassName('card'));

            setTimeout(() => {

                form_cards.forEach(card => {
                    card.style.visibility = 'visible';
                });

            }, 250);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /** TODO: DOMException: Element.after: The new child is an ancestor of the parent
     * Reorders item list via drag and drop
     * @param event
     * @param id (exhibit or grid)
     * @param type
     */
    obj.reorder_items = function (event, id, type) {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
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

                    try {

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

                    } catch (error) {
                        console.log(error);
                        // document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
                    }
                });

                tr.addEventListener('drop', async (event) => {

                    try {

                        if (event.target.className === 'dropzone') {
                            row.parentNode.removeChild(row);
                            event.target.appendChild(row);
                        }

                        for (let i=0;i<children.length;i++ ) {

                            let child = children[i];
                            let id = child.getAttribute('id');
                            let id_arr = id.split('_');
                            reorder_obj.type = id_arr.pop();
                            reorder_obj.uuid = id_arr.pop();
                            reorder_obj.order = i + 1;
                            updated_order.push(reorder_obj);
                            reorder_obj = {};
                        }

                        const token = authModule.get_user_token();
                        const response = await httpModule.req({
                            method: 'POST',
                            url: EXHIBITS_ENDPOINTS.exhibits.reorder_records.post.endpoint.replace(':exhibit_id', id),
                            data: updated_order,
                            headers: {
                                'Content-Type': 'application/json',
                                'x-access-token': token
                            }
                        });

                        if (response !== undefined && response.status === 201) {

                            if (type === 'items') {
                                await itemsModule.display_items(event);
                            }

                            /*
                            if (type === 'grid_items') {
                                await itemsGridModule.display_grid_items(event);
                            }

                             */

                        } else {
                            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An error occurred while reordering items.</div>`;
                        }

                    } catch (error) {
                        console.log(error);
                    }
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /** TODO: merge with reorder items
     * Reorders grid item list via drag and drop
     * @param event
     * @param id
     */
    obj.reorder_grid_items = function (event, id) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
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

                    try {

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

                    } catch (error) {
                        console.log(error);
                        // document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
                    }
                });

                tr.addEventListener('drop', async (event) => {

                    try {

                        if (event.target.className === 'dropzone') {
                            row.parentNode.removeChild(row);
                            event.target.appendChild(row);
                        }

                        for (let i=0;i<children.length;i++ ) {
                            let child = children[i];
                            let id = child.getAttribute('id');
                            let id_arr = id.split('_');
                            reorder_obj.type = id_arr.pop();
                            reorder_obj.uuid = id_arr.pop();
                            reorder_obj.grid_id = grid_id;
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
                            await itemsGridModule.display_grid_items(event);
                        } else {
                            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An error occurred while reordering items.</div>`;
                        }

                    } catch (error) {
                        console.log(error);
                    }
                });
            });

        } catch (error) {
            console.log(error);
            // document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.reorder_items_after_action = async function (item_order, type) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const tr_elem = Array.from(document.getElementsByTagName('tr'));
            let reorder_obj = {};
            let updated_order = [];
            let order_check = [];
            // remove header tr
            tr_elem.shift();

            for (let i = 0; i < tr_elem.length; i++) {

                let id_arr = tr_elem[i].id.split('_');
                reorder_obj.type = id_arr.pop();
                reorder_obj.uuid = id_arr.pop();
                reorder_obj.order = i + 1;

                if (type === 'grid_items') {
                    reorder_obj.grid_id = helperModule.get_parameter_by_name('grid_id');
                }

                /*
                if (type === 'timeline_items') {
                    reorder_obj.timeline_id = helperModule.get_parameter_by_name('timeline_id');
                }
                 */

                updated_order.push(reorder_obj);
                order_check.push(reorder_obj.order);
                reorder_obj = {};
            }

            if (JSON.stringify(item_order) === JSON.stringify(order_check)) {
                return false;
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
                location.reload();
            } else {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An error occurred while reordering items.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.check_bandwidth = function (cb) {

        const URL = 'https://upload.wikimedia.org/wikipedia/commons/9/90/ODJBcard.JPG';
        const FILE_SIZE = 55 // KB
        // const URL = 'http://upload.wikimedia.org/wikipedia/commons/5/51/Google.png';
        // const FILE_SIZE = 238; // KB
        let start = new Date().getTime();
        let bandwidth;
        let count = 10;
        let i = 0;

        (async function request() {

            const response = await httpModule.req({
                method: 'GET',
                url: URL
            });

            if (response.status === 200) {

                let x = new Date().getTime() - start;
                let bw = Number(((FILE_SIZE / (x / 1000))));
                bandwidth = ((bandwidth || bw) + bw) / 2;
                i++;

                if (i < count) {
                    start = new Date().getTime();
                    await request();
                 } else {
                    cb(bandwidth.toFixed(0));
                 }
            }

        })();
    };

    obj.init = function () {};

    return obj;

}());
