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

            for (let i = 0; i < list.length; i++) {

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
    obj.get_checked_radio_button = function (radio_buttons) {

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
     * Shows hidden forms
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

    /** TODO: deprecate - we no longer reorder exhibits
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

            if (reordered_items.length === 0) {
                return false;
            }

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
                console.log('items reordered');
            } else {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An HTTP request error occurred while reordering items.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Reorders grid item list via drag and drop
     * @param e
     * @param reordered_items
     */
    obj.reorder_grid_items = async function (e, reordered_items) {

        try {

            if (reordered_items.length === 0) {
                return false;
            }

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            let reorder_obj = {};
            let updated_order = [];

            for (let i = 0, ien = reordered_items.length; i < ien; i++) {

                let node = reordered_items[i].node;
                let id = node.getAttribute('id');
                let id_arr = id.split('_');

                reorder_obj.grid_id = grid_id;
                reorder_obj.uuid = id_arr[0];
                reorder_obj.type = 'griditem';
                reorder_obj.order = reordered_items[i].node.childNodes[0].childNodes[1].innerText;

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
                console.log('items reordered');
            } else {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An HTTP request error occurred while reordering items.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Checks if a record is currently locked
     * @param record
     * @param card_id
     */
    obj.check_if_locked = function (record, card_id) {

        (async function () {

            try {

                const profile = authModule.get_user_profile_data();

                if (record.is_locked === 1 && record.locked_by_user !== parseInt(profile.uid)) {

                    document.querySelector(card_id).style.display = 'none';
                    const user_role = await authModule.get_user_role(parseInt(profile.uid));
                    let message_id = document.querySelector('#message');
                    let unlock = '';

                    if (message_id !== null) {

                        if (user_role === 'Administrator') {
                            unlock = `<br><span><div class="btn-group float-right">
                        <button id="unlock-record" class="btn btn-xs btn-secondary"><i class="fa fa-unlock-alt"></i> Unlock</button>
                        </div></span>`;
                        }

                        let message = `<i class="fa fa-lock"></i> This record is currently being worked on by another user.`;
                        document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert">${message}  ${unlock}</div>`;

                        if (document.querySelector('#unlock-record') !== null) {
                            document.querySelector('#unlock-record').addEventListener('click', helperModule.unlock_record);
                        }
                    }
                }

            } catch (error) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            }

        })();
    };

    /**
     * Unlocks record
     */
    obj.unlock_record = async function () {

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
        let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        let endpoint;

        if (window.location.pathname.includes('exhibits/exhibit/edit') === true) {
            endpoint = EXHIBITS_ENDPOINTS.exhibits.exhibit_unlock_record.post.endpoint.replace(':exhibit_id', exhibit_id);
        }

        if (window.location.pathname.includes('items/heading/edit') === true) {
            let heading_id = helperModule.get_parameter_by_name('item_id');
            let tmp = EXHIBITS_ENDPOINTS.exhibits.heading_unlock_record.post.endpoint.replace(':exhibit_id', exhibit_id);
            endpoint = tmp.replace(':heading_id', heading_id);
        }

        if (window.location.pathname.includes('items/standard/text/edit') === true || window.location.pathname.includes('items/standard/media/edit') === true) {
            let item_id = helperModule.get_parameter_by_name('item_id');
            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_unlock_record.post.endpoint.replace(':exhibit_id', exhibit_id);
            endpoint = tmp.replace(':item_id', item_id);
        }

        if (window.location.pathname.includes('items/grid/item/media/edit') === true || window.location.pathname.includes('items/grid/item/text/edit') === true) {
            let grid_id = helperModule.get_parameter_by_name('grid_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_unlock_record.post.endpoint.replace(':exhibit_id', exhibit_id);
            let tmp2 = tmp.replace(':grid_id', grid_id);
            endpoint = tmp2.replace(':item_id', item_id);
        }

        if (window.location.pathname.includes('items/vertical-timeline/item/media/edit') === true || window.location.pathname.includes('items/vertical-timeline/item/text/edit') === true) {
            let timeline_id = helperModule.get_parameter_by_name('timeline_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let tmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_unlock_record.post.endpoint.replace(':exhibit_id', exhibit_id);
            let tmp2 = tmp.replace(':timeline_id', timeline_id);
            endpoint = tmp2.replace(':item_id', item_id);
        }

        /* TODO
        if (window.location.pathname.indexOf('grid')) {
            console.log('grid');
            type = 'grid';
        }

        if (window.location.pathname.indexOf('vertical-timeline')) {
            console.log('vertical-timeline');
            type = 'timeline';
        }
         */

        const profile = authModule.get_user_profile_data();
        const token = authModule.get_user_token();
        const response = await httpModule.req({
            method: 'POST',
            url: endpoint + '?uid=' + profile.uid,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });

        if (response.status === 200) {

            document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert">Unlocked</div>`;
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } else {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An HTTP request error occurred unlocking record.</div>`;
        }
    };

    obj.get_user_name = function () {
        const profile = authModule.get_user_profile_data();
        return profile.name;
    }

    obj.get_owner = function () {
        const profile = authModule.get_user_profile_data();
        return parseInt(profile.uid);
    }

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

    obj.init = function () {
    };

    return obj;

}());

helperModule.init();