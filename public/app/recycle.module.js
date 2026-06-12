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

const recycleModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    // Built directly from APP_PATH (same approach as index.management.module.js) so
    // the page does not depend on the cached endpoints map carrying recycled_records.
    const LIST_ENDPOINT = APP_PATH + '/api/v1/recycle';
    const PAGE_SIZE = 25;

    let obj = {};
    let pending_delete = null;   // { exhibit_id, uuid, type } staged by the confirm modal
    let all_records = [];        // full result set (paginated client-side)
    let current_page = 1;

    function el(id) {
        return document.getElementById(id);
    }

    function set_alert(type, message) {
        domModule.set_alert(document.querySelector('#message'), type, message);
    }

    function close_modal(selector) {
        if (window.jQuery) {
            try { window.jQuery(selector).modal('hide'); } catch (e) { /* manual fallback not required */ }
        }
    }

    // Per-record op URL: /recycle/:exhibit_id/:uuid/:type. For an exhibit the
    // exhibit_id IS its own uuid; for a child it is the parent exhibit uuid.
    function record_url(exhibit_id, uuid, type) {
        return `${LIST_ENDPOINT}/${encodeURIComponent(exhibit_id)}/${encodeURIComponent(uuid)}/${encodeURIComponent(type)}`;
    }

    function exhibit_id_of(record) {
        return record.type === 'exhibit' ? record.uuid : (record.is_member_of_exhibit || '');
    }

    function display_label(record) {
        let raw = record.title || record.text || record.name || '';
        let label;
        try {
            label = helperModule.strip_html(helperModule.unescape(raw));
        } catch (e) {
            label = raw;
        }
        label = (label || '').trim();
        return label || `(untitled ${record.type})`;
    }

    // ---- Rendering (DOM-built, never innerHTML with record data → XSS-safe) ----

    // Font Awesome icon class for a record's type, mirroring the item list
    // (heading → header "H", grid → th, timeline → clock; items by item_type).
    function type_icon_class(record) {
        switch (record.type) {
            case 'heading': return 'fa fa-header';
            case 'grid': return 'fa fa-th';
            case 'timeline': return 'fa fa-clock-o';
            case 'exhibit': return 'fa fa-folder-open-o';
            default: {
                const map = {
                    text: 'fa fa-file-text-o',
                    image: 'fa fa-image',
                    video: 'fa fa-file-video-o',
                    audio: 'fa fa-file-audio-o',
                    pdf: 'fa fa-file-pdf-o'
                };
                return map[record.item_type] || 'fa fa-file-o';
            }
        }
    }

    // Title cell modelled on the item list's "Item" cell: thumbnail (or a type-icon
    // placeholder) on the left, then the bold title with the type + its icon below.
    // Thumbnails use the existing media-library thumbnail-by-UUID endpoint (no API
    // change); a missing/unsupported thumbnail falls back to the standard placeholder
    // image, and records without media get the gray type-icon box.
    function build_title_cell(record, token) {

        const td = document.createElement('td');
        const label = display_label(record);
        const icon_class = type_icon_class(record);
        const thumb_uuid = record.thumbnail_media_uuid || record.media_uuid;

        const cell = document.createElement('div');
        cell.className = 'recycle-cell';

        if (thumb_uuid && token) {
            const img = document.createElement('img');
            img.className = 'recycle-thumb';
            img.src = `${APP_PATH}/api/v1/media/library/thumbnail/${encodeURIComponent(thumb_uuid)}?token=${encodeURIComponent(token)}`;
            img.alt = '';
            img.loading = 'lazy';
            const fallback = `${APP_PATH}/static/images/image-tn.png`;
            img.addEventListener('error', function () {
                if (this.src !== fallback) {
                    this.src = fallback;
                }
            });
            cell.appendChild(img);
        } else {
            const box = document.createElement('div');
            box.className = 'recycle-thumb-placeholder';
            const icon = document.createElement('i');
            icon.className = icon_class;
            icon.setAttribute('aria-hidden', 'true');
            box.appendChild(icon);
            cell.appendChild(box);
        }

        const text = document.createElement('div');
        text.className = 'recycle-text';

        const title = document.createElement('div');
        title.className = 'recycle-title';
        title.textContent = label;
        title.setAttribute('title', label);
        text.appendChild(title);

        const type_div = document.createElement('div');
        const type_small = document.createElement('small');
        type_small.className = 'recycle-type';
        const type_icon = document.createElement('i');
        type_icon.className = icon_class;
        type_icon.setAttribute('aria-hidden', 'true');
        type_icon.style.marginRight = '4px';
        type_small.appendChild(type_icon);
        type_small.appendChild(document.createTextNode(record.type));
        type_div.appendChild(type_small);
        text.appendChild(type_div);

        cell.appendChild(text);
        td.appendChild(cell);
        return td;
    }

    function build_row(record, token) {

        const exhibit_id = exhibit_id_of(record);
        const tr = document.createElement('tr');

        tr.appendChild(build_title_cell(record, token));

        const td_owner = document.createElement('td');
        td_owner.textContent = record.created_by || '—';
        tr.appendChild(td_owner);

        const td_actions = document.createElement('td');
        td_actions.appendChild(build_actions_dropdown(record, exhibit_id));
        tr.appendChild(td_actions);

        return tr;
    }

    // Kebab (⋮) actions menu — mirrors the item list's `item-actions` dropdown
    // (fa-ellipsis-v toggle + Bootstrap dropdown-menu). The Restore / Permanently
    // Delete items keep the recycle-restore / recycle-delete classes + data-*
    // attributes the delegated tbody click handler reads.
    function dropdown_item(extra_class, icon_class, text, record, exhibit_id, label) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dropdown-item ' + extra_class;
        btn.style.fontSize = '0.875rem';
        btn.dataset.exhibitId = exhibit_id;
        btn.dataset.uuid = record.uuid;
        btn.dataset.type = record.type;
        if (label !== undefined) {
            btn.dataset.label = label;
        }
        const icon = document.createElement('i');
        icon.className = icon_class + ' mr-2';
        icon.setAttribute('aria-hidden', 'true');
        icon.style.width = '16px';
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode(text));
        return btn;
    }

    function build_actions_dropdown(record, exhibit_id) {

        const wrapper = document.createElement('div');
        wrapper.className = 'dropdown';
        wrapper.style.cssText = 'display: inline-block; position: relative;';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn btn-link p-0 border-0 recycle-actions-toggle';
        toggle.style.cssText = 'color: #6c757d; font-size: 1.25rem; line-height: 1; background: none;';
        toggle.setAttribute('aria-haspopup', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('title', 'Actions');
        const dots = document.createElement('i');
        dots.className = 'fa fa-ellipsis-v';
        dots.setAttribute('aria-hidden', 'true');
        toggle.appendChild(dots);

        const menu = document.createElement('div');
        menu.className = 'dropdown-menu recycle-actions-menu';
        menu.appendChild(dropdown_item('recycle-restore', 'fa fa-undo', 'Restore', record, exhibit_id));
        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';
        menu.appendChild(divider);
        menu.appendChild(dropdown_item('text-danger recycle-delete', 'fa fa-trash', 'Permanently Delete', record, exhibit_id, display_label(record)));

        wrapper.appendChild(toggle);
        wrapper.appendChild(menu);
        return wrapper;
    }

    // The kebab menus are driven manually (no Bootstrap dropdown JS / Popper) so
    // positioning and close-on-outside-click are fully predictable. Close any open
    // menu by removing the `.show` class Bootstrap's CSS keys its display off.
    function close_all_menus() {
        document.querySelectorAll('#recycled .recycle-actions-menu.show').forEach((menu) => {
            menu.classList.remove('show');
            const wrapper = menu.parentElement;
            const toggle = wrapper && wrapper.querySelector('.recycle-actions-toggle');
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function total_pages() {
        return Math.max(1, Math.ceil(all_records.length / PAGE_SIZE));
    }

    function render_pager(pages, start_index, shown) {
        const pager = el('recycle-pager');
        if (!pager) {
            return;
        }
        if (pages <= 1) {
            pager.style.display = 'none';
            return;
        }
        pager.style.display = '';
        const info = el('recycle-page-info');
        if (info) {
            info.textContent = `Showing ${start_index + 1}–${start_index + shown} of ${all_records.length} (page ${current_page} of ${pages})`;
        }
        const prev = el('recycle-prev');
        if (prev) prev.disabled = current_page <= 1;
        const next = el('recycle-next');
        if (next) next.disabled = current_page >= pages;
    }

    function render_page() {

        const tbody = el('recycled-data');
        const table_wrap = el('recycled-table-wrap');
        const empty_state = el('recycle-empty-state');
        const pager = el('recycle-pager');
        if (!tbody) {
            return;
        }

        tbody.textContent = '';

        if (all_records.length === 0) {
            if (table_wrap) table_wrap.style.display = 'none';
            if (empty_state) empty_state.style.display = '';
            if (pager) pager.style.display = 'none';
            return;
        }

        if (table_wrap) table_wrap.style.display = '';
        if (empty_state) empty_state.style.display = 'none';

        const pages = total_pages();
        if (current_page > pages) current_page = pages;
        if (current_page < 1) current_page = 1;

        const start_index = (current_page - 1) * PAGE_SIZE;
        const slice = all_records.slice(start_index, start_index + PAGE_SIZE);
        const token = authModule.get_user_token();
        slice.forEach((record) => tbody.appendChild(build_row(record, token)));

        render_pager(pages, start_index, slice.length);
    }

    // Replace the result set and re-render. current_page is preserved (and clamped
    // by render_page) so a refresh after a delete keeps you near where you were.
    function set_records(records) {
        all_records = Array.isArray(records) ? records : [];
        render_page();
    }

    // ---- Data load ----

    async function load_records() {

        const token = authModule.get_user_token();
        if (token === false) {
            return;
        }

        try {

            const response = await httpModule.req({
                method: 'GET',
                url: LIST_ENDPOINT,
                headers: { 'x-access-token': token }
            });

            if (response !== undefined && response.status === 200 && response.data) {
                set_records(response.data.data || []);
            } else if (response !== undefined && response.status === 403) {
                set_alert('danger', 'You are not authorized to view the recycle bin.');
                set_records([]);
            } else {
                set_alert('danger', 'Unable to load recycled records.');
                set_records([]);
            }

        } catch (error) {
            set_alert('danger', 'Unable to load recycled records.');
            set_records([]);
        }
    }

    obj.display_recycled_records = load_records;

    // ---- Restore ----

    async function restore_record(exhibit_id, uuid, type) {

        const token = authModule.get_user_token();
        if (token === false) {
            return;
        }

        try {

            const response = await httpModule.req({
                method: 'PUT',
                url: record_url(exhibit_id, uuid, type),
                headers: { 'x-access-token': token }
            });

            if (response !== undefined && (response.status === 200 || response.status === 204)) {
                set_alert('success', 'Record restored.');
                await load_records();
            } else if (response !== undefined && response.status === 403) {
                set_alert('danger', 'You are not authorized to restore this record.');
            } else if (response !== undefined && response.status === 404) {
                set_alert('warning', 'Record not found — it may already have been restored or deleted.');
                await load_records();
            } else {
                set_alert('danger', 'Unable to restore record.');
            }

        } catch (error) {
            set_alert('danger', 'Unable to restore record.');
        }
    }

    // ---- Permanent delete (single, via confirm modal) ----

    function open_delete_modal(exhibit_id, uuid, type, label) {
        pending_delete = { exhibit_id, uuid, type };
        const target = el('delete-confirm-target');
        if (target) {
            target.textContent = label || `${type} ${uuid}`;
        }
        if (window.jQuery) {
            try { window.jQuery('#delete-confirm-modal').modal('show'); } catch (e) { /* noop */ }
        }
    }

    async function delete_record() {

        if (!pending_delete) {
            return;
        }

        const { exhibit_id, uuid, type } = pending_delete;
        const token = authModule.get_user_token();
        if (token === false) {
            return;
        }

        const confirm_btn = el('delete-confirm-btn');

        try {

            if (confirm_btn) {
                confirm_btn.disabled = true;
                confirm_btn.textContent = 'Deleting…';
            }

            const response = await httpModule.req({
                method: 'DELETE',
                url: record_url(exhibit_id, uuid, type),
                headers: { 'x-access-token': token }
            });

            if (response !== undefined && (response.status === 200 || response.status === 204)) {
                set_alert('success', 'Record permanently deleted.');
                await load_records();
            } else if (response !== undefined && response.status === 403) {
                set_alert('danger', 'You are not authorized to delete this record.');
            } else if (response !== undefined && response.status === 404) {
                set_alert('warning', 'Record not found — it may already have been deleted.');
                await load_records();
            } else {
                set_alert('danger', 'Unable to delete record.');
            }

        } catch (error) {
            set_alert('danger', 'Unable to delete record.');
        } finally {
            if (confirm_btn) {
                confirm_btn.disabled = false;
                confirm_btn.textContent = 'Permanently Delete';
            }
            pending_delete = null;
            close_modal('#delete-confirm-modal');
        }
    }

    // ---- Empty bin (type-to-confirm modal) ----

    function reset_empty_input() {
        const input = el('empty-confirm-input');
        if (input) input.value = '';
        const btn = el('empty-confirm-btn');
        if (btn) btn.disabled = true;
    }

    async function empty_bin() {

        const token = authModule.get_user_token();
        if (token === false) {
            return;
        }

        const confirm_btn = el('empty-confirm-btn');

        try {

            if (confirm_btn) {
                confirm_btn.disabled = true;
                confirm_btn.textContent = 'Emptying…';
            }

            const response = await httpModule.req({
                method: 'DELETE',
                url: `${LIST_ENDPOINT}/all`,
                headers: { 'x-access-token': token }
            });

            if (response !== undefined && (response.status === 200 || response.status === 204)) {
                set_alert('success', 'Recycle bin emptied.');
                await load_records();
            } else if (response !== undefined && response.status === 403) {
                set_alert('danger', 'You are not authorized to empty the recycle bin.');
            } else {
                set_alert('danger', 'Unable to empty the recycle bin.');
            }

        } catch (error) {
            set_alert('danger', 'Unable to empty the recycle bin.');
        } finally {
            if (confirm_btn) {
                confirm_btn.textContent = 'Empty Recycle Bin';
            }
            close_modal('#empty-confirm-modal');
            reset_empty_input();
        }
    }

    // ---- Event wiring ----

    function wire_table() {
        // Delegated: the tbody persists across re-renders, so wire once.
        const tbody = el('recycled-data');
        if (!tbody) {
            return;
        }

        tbody.addEventListener('click', async function (event) {

            // Kebab toggle: open this row's menu, closing any other open one.
            const toggle = event.target.closest('.recycle-actions-toggle');
            if (toggle) {
                event.preventDefault();
                event.stopPropagation(); // don't let the document handler immediately close it
                const menu = toggle.parentElement.querySelector('.recycle-actions-menu');
                const was_open = menu && menu.classList.contains('show');
                close_all_menus();
                if (menu && !was_open) {
                    menu.classList.add('show');
                    toggle.setAttribute('aria-expanded', 'true');
                }
                return;
            }

            // Menu items.
            const btn = event.target.closest('button.dropdown-item');
            if (!btn) {
                return;
            }
            close_all_menus();
            if (btn.classList.contains('recycle-restore')) {
                await restore_record(btn.dataset.exhibitId, btn.dataset.uuid, btn.dataset.type);
            } else if (btn.classList.contains('recycle-delete')) {
                open_delete_modal(btn.dataset.exhibitId, btn.dataset.uuid, btn.dataset.type, btn.dataset.label);
            }
        });

        // Close any open kebab menu when clicking outside it (wired once).
        document.addEventListener('click', function (event) {
            if (event.target.closest('.recycle-actions-toggle') || event.target.closest('.recycle-actions-menu')) {
                return;
            }
            close_all_menus();
        });
    }

    function wire_controls() {

        const refresh = el('refresh-recycle');
        if (refresh) {
            refresh.addEventListener('click', function () {
                load_records();
            });
        }

        const prev = el('recycle-prev');
        if (prev) {
            prev.addEventListener('click', function () {
                if (current_page > 1) {
                    current_page--;
                    render_page();
                }
            });
        }

        const next = el('recycle-next');
        if (next) {
            next.addEventListener('click', function () {
                if (current_page < total_pages()) {
                    current_page++;
                    render_page();
                }
            });
        }

        const delete_confirm = el('delete-confirm-btn');
        if (delete_confirm) {
            delete_confirm.addEventListener('click', function () {
                if (pending_delete) {
                    delete_record();
                }
            });
        }

        // Empty-bin: destructive button only enables on an exact "EMPTY".
        const empty_input = el('empty-confirm-input');
        const empty_confirm = el('empty-confirm-btn');
        if (empty_input && empty_confirm) {
            empty_input.addEventListener('input', function () {
                empty_confirm.disabled = empty_input.value.trim().toUpperCase() !== 'EMPTY';
            });
            empty_confirm.addEventListener('click', function () {
                if (empty_input.value.trim().toUpperCase() === 'EMPTY') {
                    empty_bin();
                }
            });
        }
    }

    obj.init = async function () {

        if (typeof navModule !== 'undefined' && typeof navModule.wire_nav_links === 'function') {
            navModule.wire_nav_links();
        }

        // Access gate: the recycle bin is an admin tool. Gate on the Administrator
        // role (same as Index Management) — the server still authorizes every
        // operation (manage_recycle_bin for system-wide view/empty; delete_* +
        // ownership for per-record restore/delete).
        const is_admin = await authModule.is_administrator();
        if (is_admin !== true) {
            window.location.replace(APP_PATH + '/access-denied');
            return;
        }

        const content = el('recycle-content');
        if (content) {
            content.style.display = '';
        }

        // Dashboard `.card` elements are `visibility: hidden` by default (style.css);
        // reveal them the way every other dashboard page does.
        if (typeof helperModule !== 'undefined' && typeof helperModule.show_form === 'function') {
            helperModule.show_form();
        }

        wire_table();
        wire_controls();
        await load_records();
    };

    return obj;

}());
