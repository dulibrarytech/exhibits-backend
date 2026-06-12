/**

 Copyright 2026 University of Denver

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

const indexManagementModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const ENDPOINT = APP_PATH + '/api/v1/indexer/manage';
    let obj = {};

    function el(id) {
        return document.getElementById(id);
    }

    function set_alert(type, message) {
        domModule.set_alert(document.querySelector('#message'), type, message);
    }

    function render_status(data) {
        const idx = el('status-index');
        const exists = el('status-exists');
        const count = el('status-count');
        const published = el('status-published');
        const confirm_published = el('confirm-published-count');
        if (idx) idx.textContent = (data && data.index) ? data.index : '—';
        if (exists) exists.textContent = (data && data.exists === true) ? 'Yes' : 'No';
        if (count) count.textContent =
            (data && data.count !== null && data.count !== undefined) ? String(data.count) : '—';
        const pub = (data && data.published_exhibits !== null && data.published_exhibits !== undefined)
            ? String(data.published_exhibits) : '—';
        if (published) published.textContent = pub;
        if (confirm_published) confirm_published.textContent = pub;
    }

    function render_status_unavailable() {
        const exists = el('status-exists');
        const count = el('status-count');
        if (exists) exists.textContent = 'Unavailable';
        if (count) count.textContent = '—';
    }

    async function load_status() {

        try {

            const token = authModule.get_user_token();
            if (token === false) {
                return;
            }

            const response = await httpModule.req({
                method: 'GET',
                url: ENDPOINT,
                headers: { 'x-access-token': token }
            });

            if (response !== undefined && response.status === 200 && response.data && response.data.data) {
                render_status(response.data.data);
            } else {
                render_status_unavailable();
            }

        } catch (error) {
            render_status_unavailable();
        }
    }

    function close_confirm_modal() {
        const input = el('rebuild-confirm-input');
        if (input) {
            input.value = '';
        }
        const confirm_btn = el('rebuild-confirm-btn');
        if (confirm_btn) {
            confirm_btn.disabled = true;
        }
        if (window.jQuery) {
            try {
                window.jQuery('#rebuild-confirm-modal').modal('hide');
            } catch (e) { /* manual fallback not required — modal stays, alert shows result */ }
        }
    }

    async function rebuild_index() {

        const confirm_btn = el('rebuild-confirm-btn');

        try {

            const token = authModule.get_user_token();
            if (token === false) {
                return;
            }

            if (confirm_btn) {
                confirm_btn.disabled = true;
                confirm_btn.textContent = 'Rebuilding…';
            }
            set_alert('info', 'Rebuilding the search index…');

            const response = await httpModule.req({
                method: 'POST',
                url: ENDPOINT,
                headers: { 'x-access-token': token }
            });

            if (response !== undefined && (response.status === 200 || response.status === 201)) {
                set_alert('success', 'Index rebuilt — reindexing published exhibits in the background. Use Refresh to watch the document count populate.');
            } else if (response !== undefined && response.status === 403) {
                set_alert('danger', 'You do not have permission to rebuild the index.');
            } else {
                set_alert('danger', 'Unable to rebuild the search index.');
            }

        } catch (error) {
            set_alert('danger', 'Unable to rebuild the search index.');
        } finally {
            if (confirm_btn) {
                confirm_btn.textContent = 'Rebuild Index';
            }
            close_confirm_modal();
            await load_status();
        }
    }

    function wire_events() {

        const input = el('rebuild-confirm-input');
        const confirm_btn = el('rebuild-confirm-btn');

        // Type-to-confirm: the destructive button only enables on exact "REBUILD".
        if (input && confirm_btn) {
            input.addEventListener('input', function () {
                confirm_btn.disabled = input.value.trim().toUpperCase() !== 'REBUILD';
            });
            confirm_btn.addEventListener('click', function () {
                if (input.value.trim().toUpperCase() === 'REBUILD') {
                    rebuild_index();
                }
            });
        }

        const refresh = el('refresh-status');
        if (refresh) {
            refresh.addEventListener('click', function () {
                load_status();
            });
        }
    }

    obj.init = async function () {

        if (typeof navModule !== 'undefined' && typeof navModule.wire_nav_links === 'function') {
            navModule.wire_nav_links();
        }

        // Access gate: index management is admin-only. We can't use
        // authModule.check_permissions here — its /auth/permissions endpoint
        // requires a record UUID (parent_id), and this is a system operation with
        // no record, so it would 400 and wrongly deny. Gate on the Administrator
        // role instead (manage_index is granted only to admins); the server-side
        // /manage APIs still enforce the manage_index permission on every call.
        const is_admin = await authModule.is_administrator();
        if (is_admin !== true) {
            window.location.replace(APP_PATH + '/access-denied');
            return;
        }

        const content = el('index-management-content');
        if (content) {
            content.style.display = '';
        }

        // Dashboard `.card` elements are `visibility: hidden` by default (style.css);
        // reveal them the same way every other dashboard page does. Without this the
        // cards render invisibly and the page looks blank.
        if (typeof helperModule !== 'undefined' && typeof helperModule.show_form === 'function') {
            helperModule.show_form();
        }

        wire_events();
        await load_status();
    };

    return obj;

}());
