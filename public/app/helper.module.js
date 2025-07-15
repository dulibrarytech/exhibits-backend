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

        try {

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

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * https://stackoverflow.com/questions/7394748/whats-the-right-way-to-decode-a-string-that-has-special-html-entities-in-it
     * Unescapes HTML elements
     * @param data
     */
    obj.unescape = function (data) {

        try {

            let elem = document.createElement('textarea');
            elem.innerHTML = data;
            return elem.value;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Strips HTML elements - used in item list displays to prevent HTML render
     * @param html
     */
    obj.strip_html = function (html) {

        try {
            return html.replace(/(<([^>]+)>)/gi, '');
        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Removes exploitable HTML elements
     * @param html
     */
    obj.clean_html = function (html) {

        try {

            let div = document.createElement('div');

            div.innerHTML = html;

            let list = ['script',
                'iframe',
                'html',
                'head',
                'body',
                'head',
                'title',
                'img',
                'embed',
                'applet',
                'object',
                'style',
                'link',
                'form',
                'input',
                'video',
                'source',
                'math',
                'maction',
                'picture',
                'map',
                'svg',
                'details',
                'frameset',
                'comment',
                'base'];

            for (let i = 0;i<list.length;i++) {

                let elements = div.getElementsByTagName(list[i]);
                while (elements[0]) {
                    elements[0].parentNode.removeChild(elements[0]);
                }
            }

            return div.innerHTML.replace(/&amp;/g, '&');

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Previews HTML entered in form fields
     * @param id
     */
    obj.preview_html = function (id) {

        try {

            const cleaned_html = helperModule.clean_html(document.querySelector('#' + id).value);
            document.querySelector('#preview-html').innerHTML = cleaned_html;
            document.querySelector('#' + id).value = cleaned_html;
            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Gets checked radio button value
     * @param radio_buttons
     */
    obj.get_checked_radio_button = function(radio_buttons) {

        try {

            for (let i = 0; i < radio_buttons.length; i++) {
                if (radio_buttons[i].checked) {
                    return radio_buttons[i].value;
                }
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Gets current year
     */
    obj.get_current_year = function () {

        try {
            const cdate = new Date().getFullYear();
            domModule.html('#cdate', DOMPurify.sanitize(cdate));
        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Formats date
     * @param date
     */
    obj.format_date = function formatDate(date) {
        const month = (1 + date.getMonth()).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${month}/${day}/${year} @ ${hours}:${minutes}:${seconds}`;
    };

    /**
     * Gets repo item metadata
     * @param uuid
     */
    obj.get_repo_item_data = async function (uuid) {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            let is_list = true;

            if (uuid === null) {
                uuid = document.querySelector('#repo-uuid').value;
                helperModule.clear_media_fields('repo_media');
                is_list = false;
            }

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

                const mime_type = response.data.data.mime_type;
                let item_type;
                let tn = document.querySelector('#tn');
                let item_mime_type = document.querySelector('#item-mime-type');
                let type = document.querySelector('#item-type');
                let repo_item_metadata = document.querySelector('#repo-item-metadata');
                let is_repo_item = document.querySelector('#is-repo-item');

                if (tn !== null) {
                    const tn_url = helperModule.render_repo_thumbnail(response.data.data.thumbnail.data);
                    tn.innerHTML = `<img src="${tn_url}" alt="thumbnail" height="200" width="200">`;
                }

                if (item_mime_type !== null) {
                    item_mime_type.value = mime_type;
                }

                if (mime_type.indexOf('image') !== -1) {

                    item_type = 'image';

                    let alt_text = document.querySelector('#image-alt-text');

                    if (alt_text !== null) {
                        document.querySelector('#image-alt-text').style.display = 'block';
                    }

                } else if (mime_type.indexOf('video') !== -1) {
                    item_type = 'video';
                } else if (mime_type.indexOf('audio') !== -1) {
                    item_type = 'audio';
                } else if (mime_type.indexOf('pdf') !== -1) {
                    item_type = 'pdf';
                } else {
                    item_type = 'Unable to Determine Type';
                }

                if (type !== null) {
                    type.value = item_type;
                }

                if (repo_item_metadata !== null) {
                    repo_item_metadata.innerHTML = `<p><strong>${response.data.data.title}</strong><br><em>${mime_type}</em></p>`;
                }

                if (is_repo_item !== null) {
                    is_repo_item.value = 1;
                }

                if (is_list === true) {
                    return response.data.data;
                }

            } else {
                document.querySelector('#repo-item-metadata').innerHTML = `<p style="color:red">Metadata record not found in repository.</p>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.render_repo_thumbnail = function (thumbnail_data_array) {

        try {

            const array_buffer_view = new Uint8Array(thumbnail_data_array);
            const blob = new Blob([array_buffer_view], {type: 'image/jpeg'});
            const url_creator = window.URL || window.webkitURL;
            return url_creator.createObjectURL(blob);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

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

    obj.show_form = function () {

        try {

            const form_cards = Array.from(document.getElementsByClassName('card'));

            setTimeout(() => {

                form_cards.forEach(card => {
                    card.style.visibility = 'visible';
                });

            }, 250*2);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.toggle_alt_text = function () {

        try {

            let toggle_elem = document.querySelector('#item-alt-text-input');
            let is_decorative_toggle = toggle_elem.disabled;

            if (is_decorative_toggle === false) {
                toggle_elem.disabled = true;
            } else if (is_decorative_toggle === true) {
                toggle_elem.disabled = false;
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Set alt text
     * @param record
     */
    obj.set_alt_text = function (record) {

        document.querySelector('#image-alt-text').style.display = 'block';

        if (record.is_alt_text_decorative === 1) {
            document.querySelector('#is-alt-text-decorative').checked = true;
            let toggle_elem = document.querySelector('#item-alt-text-input');
            toggle_elem.disabled = true;
        } else {
            document.querySelector('#is-alt-text-decorative').checked = false;
            document.querySelector('#item-alt-text-input').value = helperModule.unescape(record.alt_text);
        }
    };

    /**
     * Reorders exhibit list via drag and drop
     * @param e
     * @param reordered_exhibits
     */
    obj.reorder_exhibits = async function (e, reordered_exhibits) {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let reorder_obj = {};
            let updated_order = [];

            for (let i = 0, ien = reordered_exhibits.length; i < ien; i++) {

                let node = reordered_exhibits[i].node;
                let id = node.getAttribute('id');
                let id_arr = id.split('_');

                reorder_obj.type = id_arr.pop();
                reorder_obj.uuid = id_arr.pop();
                reorder_obj.order = reordered_exhibits[i].node.childNodes[0].childNodes[1].innerText;
                updated_order.push(reorder_obj);
                reorder_obj = {};
            }

            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.reorder_exhibits_records.post.endpoint.replace(':exhibit_id', exhibit_id),
                data: updated_order,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {
                console.log(response);
            } else {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An HTTP request error occurred while reordering items.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Reorders item list via drag and drop
     * @param e
     * @param reordered_items
     */
    obj.reorder_items = async function (e, reordered_items) {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            let reorder_obj = {};
            let updated_order = [];

            for (let i = 0, ien = reordered_items.length; i < ien; i++) {

                let node = reordered_items[i].node;
                let id = node.getAttribute('id');
                let id_arr = id.split('_');

                reorder_obj.type = id_arr.pop();
                reorder_obj.uuid = id_arr.pop();
                reorder_obj.order = reordered_items[i].node.childNodes[0].childNodes[1].innerText;

                if (grid_id !== null) {
                    reorder_obj.grid_id = grid_id;
                }

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
                console.log(response);
            } else {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An HTTP request error occurred while reordering items.</div>`;
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

    obj.check_app_env = function () {

        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === 'libwebapw01-vlt.du.edu' || hostname === 'exhibits.dev') {

            const app_message = document.querySelector('#app-message');

            if (app_message !== null) {
                app_message.innerHTML = '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> <strong>"STOP! Do not use Development Site"</strong>&nbsp;&nbsp;&nbsp;<a class="btn btn-info" href="https://exhibits-backend.library.du.edu/exhibits-dashboard/auth" target="_blank">Go to Live Site </a> </div>';
            }
        }
    };

    obj.init = function () {};

    return obj;

}());

helperModule.init();