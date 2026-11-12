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

const gridItemModalModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    const MODAL = '#grid-item-modal';
    const MESSAGE = '#grid-item-modal-message';
    const PUBLISHED_VALUES = [1, true, '1', 'true'];
    const MEDIA_ONLY_CARDS = ['#item-media-card', '#item-layout-card', '#item-media-widths-card'];
    const TITLES = {
        add: 'Add grid item',
        edit: 'Edit grid item',
        details: 'Grid item details'
    };

    const KINDS = {
        media: {
            tab: '#grid-item-tab-media',
            pane: '#grid-item-pane-media',
            fill: (record) => itemsCommonGridItemFormModule.fill(record, 'media'),
            collect: () => itemsCommonGridItemFormModule.collect('media')
        },
        text: {
            tab: '#grid-item-tab-text',
            pane: '#grid-item-pane-text',
            fill: (record) => itemsCommonGridItemFormModule.fill(record, 'text'),
            collect: () => itemsCommonGridItemFormModule.collect('text')
        },
        content_block: {
            tab: '#grid-item-tab-content-block',
            pane: '#grid-item-pane-content-block',
            fill: (record) => itemsCommonContentBlockGridItemFormModule.fill(record),
            collect: () => {

                const item = itemsCommonContentBlockGridItemFormModule.get_common_content_block_item_form_fields();

                if (!item) {
                    return false;
                }

                item.type = 'content_block';
                item.item_type = 'content_block';
                item.title = item.title || '';

                return item;
            }
        }
    };

    let obj = {};
    let ids = { exhibit_id: null, grid_id: null };
    let request = null;
    let on_saved = null;
    let on_load_failed = null;
    let opener = null;
    let last_picker_button = null;
    let saved_snapshot = '';
    let state = new_state();

    function new_state() {
        return {
            mode: 'add',
            kind: 'media',
            item_id: null,
            is_locked_by_me: false,
            is_saving: false
        };
    }

    function kind_of(item_type) {

        if (item_type === 'text') {
            return 'text';
        }

        return item_type === 'content_block' ? 'content_block' : 'media';
    }

    function element(selector) {
        return document.querySelector(selector);
    }

    function set_hidden(selector, is_hidden) {
        const target = element(selector);
        if (target !== null) {
            target.hidden = is_hidden;
        }
    }

    function set_message(type, text) {
        domModule.set_alert(MESSAGE, type, text);
        const body = element(`${MODAL} .modal-body`);
        if (body !== null) {
            body.scrollTop = 0;
        }
    }

    function clear_message() {
        domModule.empty(MESSAGE);
    }

    function item_ids() {
        return { exhibit_id: ids.exhibit_id, grid_id: ids.grid_id, item_id: state.item_id };
    }

    function show_kind(kind) {

        state.kind = kind;

        if (kind === 'content_block') {
            return;
        }

        const form = element('#grid-item-form');
        const pane = element(KINDS[kind].pane);

        if (form !== null && pane !== null && form.parentElement !== pane) {
            pane.appendChild(form);
        }

        itemsCommonGridItemFormModule.prepare(kind);

        const is_media = kind === 'media';

        MEDIA_ONLY_CARDS.forEach(selector => set_hidden(selector, !is_media));

        const text_only = element('#item-layout-text-only');

        if (text_only === null) {
            return;
        }

        if (is_media === false) {
            text_only.checked = true;
            const half_width = element('#item-width-50');
            if (half_width !== null) {
                half_width.checked = true;
            }
            const embed_item = element('#embed-item');
            if (embed_item !== null && embed_item.checked === true) {
                embed_item.checked = false;
                embed_item.dispatchEvent(new Event('change'));
            }
            return;
        }

        if (text_only.checked === true) {
            document.getElementsByName('layout').forEach(radio => {
                radio.checked = radio.defaultChecked;
            });
        }
    }

    function activate_tab(kind) {

        Object.keys(KINDS).forEach(name => {
            const tab = element(KINDS[name].tab);
            if (tab !== null) {
                tab.disabled = false;
                tab.classList.remove('disabled');
            }
        });

        $(KINDS[kind].tab).tab('show');
        show_kind(kind);
    }

    function lock_tabs(kind) {

        Object.keys(KINDS).forEach(name => {

            const tab = element(KINDS[name].tab);

            if (tab === null) {
                return;
            }

            const is_locked = kind !== null && name !== kind;
            tab.disabled = is_locked;
            tab.classList.toggle('disabled', is_locked);

            const tab_item = tab.closest('li');

            if (tab_item !== null) {
                tab_item.hidden = is_locked;
            }
        });
    }

    function set_read_only(is_read_only) {

        const body = element(`${MODAL} .modal-body`);

        if (body === null) {
            return;
        }

        body.querySelectorAll('input:not([type="hidden"]), textarea, select, button').forEach(field => {

            if (field.closest('#grid-item-tabs') !== null || field.closest('.ql-toolbar') !== null) {
                return;
            }

            field.disabled = is_read_only;
        });

        body.querySelectorAll('[data-rte]').forEach(container => {
            rteModule.set_enabled(container.id, !is_read_only);
        });

        ['#pick-item-media-btn', '#pick-thumbnail-btn'].forEach(selector => set_hidden(selector, is_read_only));

        if (is_read_only) {
            ['#item-media-trash', '#thumbnail-trash'].forEach(selector => {
                const link = element(selector);
                if (link !== null) {
                    link.style.display = 'none';
                }
            });
        }
    }

    function set_buttons(options) {
        set_hidden('#grid-item-save-btn', options.save !== true);
        set_hidden('#grid-item-edit-btn', options.edit !== true);
        set_hidden('#grid-item-unlock-btn', options.unlock !== true);
        set_hidden('#grid-item-modal-published-note', options.published_note !== true);

        const cancel_label = element('#grid-item-cancel-btn .btn-label');
        if (cancel_label !== null) {
            cancel_label.textContent = options.save === true ? 'Cancel' : 'Close';
        }
    }

    function set_mode(mode) {
        state.mode = mode;
        const title = element('#grid-item-modal-label');
        if (title !== null) {
            title.textContent = TITLES[mode];
        }
    }

    function set_meta(record) {

        const meta = element('#grid-item-modal-meta');

        if (meta === null) {
            return;
        }

        const parts = [];

        if (record && record.created_by && record.created) {
            parts.push(`Created by ${record.created_by} on ${helperModule.format_date(new Date(record.created))}`);
        }

        if (record && record.updated_by && record.updated) {
            parts.push(`Last updated by ${record.updated_by} on ${helperModule.format_date(new Date(record.updated))}`);
        }

        meta.textContent = parts.join(' | ');
    }

    function set_published_field(record) {
        const field = element('#is-published');
        if (field !== null) {
            field.value = record && PUBLISHED_VALUES.includes(record.is_published) ? 'true' : 'false';
        }
    }

    function is_published(record) {
        return PUBLISHED_VALUES.includes(record.is_published);
    }

    function is_locked_by_other_user(record) {

        const profile = authModule.get_user_profile_data();
        const user_id = profile ? parseInt(profile.uid, 10) : NaN;
        const is_locked = record.is_locked === 1 || record.is_locked === true;

        if (is_locked === false || !record.locked_by_user) {
            return false;
        }

        return parseInt(record.locked_by_user, 10) !== user_id;
    }

    function read_snapshot() {

        const body = element(`${MODAL} .modal-body`);

        if (body === null) {
            return '';
        }

        const fields = Array.from(body.querySelectorAll('input, select, textarea')).map(field => {
            return field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.value;
        });

        const editors = Array.from(body.querySelectorAll('[data-rte]')).map(container => rteModule.get_html(container.id));

        return JSON.stringify([fields, editors]);
    }

    function reset() {

        itemsCommonGridItemFormModule.reset();
        itemsCommonContentBlockGridItemFormModule.reset();

        clear_message();
        set_meta(null);

        const published_field = element('#is-published');
        if (published_field !== null) {
            published_field.value = '';
        }

        set_read_only(false);
        lock_tabs(null);
        state = new_state();
    }

    async function fetch_record(item_id, type) {

        try {

            const profile = authModule.get_user_profile_data();

            if (!profile || !profile.uid) {
                return null;
            }

            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_record.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(ids.exhibit_id))
                .replace(':grid_id', encodeURIComponent(ids.grid_id))
                .replace(':item_id', encodeURIComponent(item_id));

            const params = new URLSearchParams({ type: type });

            if (type === 'edit') {
                params.append('uid', profile.uid);
            }

            const response = await request('GET', `${endpoint}?${params.toString()}`);

            if (!response || response.status !== 200 || !response.data?.data) {
                return null;
            }

            return response.data.data;

        } catch (error) {
            console.error('Error loading grid item:', error.message);
            return null;
        }
    }

    function show_modal() {
        $(MODAL).modal('show');
        saved_snapshot = read_snapshot();
    }

    async function show_record(record, kind, mode) {

        set_mode(mode);
        activate_tab(kind);
        lock_tabs(kind);

        await KINDS[kind].fill(record);

        set_meta(record);
        set_published_field(record);
    }

    async function show_locked_notice() {

        set_message('warning', 'This record is currently being worked on by another user.');

        const profile = authModule.get_user_profile_data();
        const role = profile ? await authModule.get_user_role(parseInt(profile.uid, 10)) : null;

        set_buttons({ unlock: role === 'Administrator' });
    }

    async function load_for_edit(item_id, kind) {

        const record = await fetch_record(item_id, 'edit');

        if (record === null) {
            return false;
        }

        state.item_id = item_id;
        await show_record(record, kind, 'edit');

        if (is_locked_by_other_user(record)) {
            state.is_locked_by_me = false;
            set_read_only(true);
            await show_locked_notice();
            return true;
        }

        state.is_locked_by_me = record.is_locked === 1 || record.is_locked === true;
        set_read_only(false);
        clear_message();

        const embed_item = element('#embed-item');
        if (embed_item !== null) {
            embed_item.dispatchEvent(new Event('change'));
        }

        set_buttons({ save: true, published_note: is_published(record) });

        return true;
    }

    async function load_for_details(item_id, kind) {

        const record = await fetch_record(item_id, 'details');

        if (record === null) {
            return false;
        }

        state.item_id = item_id;
        await show_record(record, kind, 'details');
        set_read_only(true);
        set_buttons({ edit: true, published_note: is_published(record) });

        return true;
    }

    function show_load_failure() {
        if (typeof on_load_failed === 'function') {
            on_load_failed();
        }
    }

    obj.open_add = function (trigger) {

        opener = trigger || document.activeElement;
        set_mode('add');
        activate_tab('media');
        set_buttons({ save: true });
        show_modal();

        return true;
    };

    obj.open_details = async function (item_id, item_type, trigger) {

        opener = trigger || document.activeElement;

        if (await load_for_details(item_id, kind_of(item_type)) === false) {
            show_load_failure();
            return false;
        }

        show_modal();

        return true;
    };

    obj.open_edit = async function (item_id, item_type, trigger) {

        opener = trigger || document.activeElement;

        const kind = kind_of(item_type);
        const is_allowed = await authModule.has_permissions(['update_item', 'update_any_item'], 'grid_item', ids.exhibit_id, item_id);

        if (is_allowed === false) {

            if (await load_for_details(item_id, kind) === false) {
                show_load_failure();
                return false;
            }

            set_buttons({});
            set_message('danger', 'You do not have permission to edit this record.');
            show_modal();

            return true;
        }

        if (await load_for_edit(item_id, kind) === false) {
            show_load_failure();
            return false;
        }

        show_modal();

        return true;
    };

    async function switch_to_edit() {

        const item_id = state.item_id;
        const kind = state.kind;
        const is_allowed = await authModule.has_permissions(['update_item', 'update_any_item'], 'grid_item', ids.exhibit_id, item_id);

        if (is_allowed === false) {
            set_message('danger', 'You do not have permission to edit this record.');
            return false;
        }

        if (await load_for_edit(item_id, kind) === false) {
            set_message('danger', 'Unable to load the grid item. Please try again.');
            return false;
        }

        saved_snapshot = read_snapshot();

        return true;
    }

    async function unlock() {

        const is_released = await lockModule.release_grid_item(item_ids(), { force: true });

        if (is_released === false) {
            set_message('danger', 'Failed to unlock record. Please try again.');
            return false;
        }

        return await switch_to_edit();
    }

    function build_request(item) {

        const user_name = helperModule.get_user_name();

        if (state.mode === 'add') {

            delete item.is_published;

            if (user_name) {
                item.created_by = user_name;
            }

            const owner = helperModule.get_owner();

            if (owner) {
                item.owner = owner;
            }

            return {
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.grid_item_records.post.endpoint
                    .replace(':exhibit_id', encodeURIComponent(ids.exhibit_id))
                    .replace(':grid_id', encodeURIComponent(ids.grid_id))
            };
        }

        if (user_name) {
            item.updated_by = user_name;
        }

        return {
            method: 'PUT',
            url: EXHIBITS_ENDPOINTS.exhibits.grid_item_records.put.endpoint
                .replace(':exhibit_id', encodeURIComponent(ids.exhibit_id))
                .replace(':grid_id', encodeURIComponent(ids.grid_id))
                .replace(':item_id', encodeURIComponent(state.item_id))
        };
    }

    async function save() {

        if (state.is_saving === true || state.mode === 'details') {
            return false;
        }

        clear_message();

        const item = KINDS[state.kind].collect();

        if (!item) {
            const body = element(`${MODAL} .modal-body`);
            if (body !== null) {
                body.scrollTop = 0;
            }
            return false;
        }

        if (!authModule.get_user_token()) {
            set_message('danger', 'Session expired. Please log in again.');
            return false;
        }

        const mode = state.mode;
        const edited_item_id = state.item_id;
        const target = build_request(item);
        const save_button = element('#grid-item-save-btn');

        state.is_saving = true;

        if (save_button !== null) {
            save_button.disabled = true;
        }

        try {

            const response = await request(target.method, target.url, item);

            if (response && response.status === 201) {

                saved_snapshot = read_snapshot();
                $(MODAL).modal('hide');

                if (typeof on_saved === 'function') {
                    await on_saved({
                        action: mode === 'add' ? 'added' : 'updated',
                        item_id: mode === 'add' ? response.data?.data : edited_item_id
                    });
                }

                return true;
            }

            if (response && response.status === 403) {
                set_message('danger', mode === 'add'
                    ? 'You do not have permission to add items to this grid.'
                    : 'You do not have permission to edit this record.');
                return false;
            }

            const server_message = response?.data?.message;

            set_message('danger', typeof server_message === 'string' && server_message.length > 0
                ? server_message
                : 'Unable to save the grid item. Please try again.');

            return false;

        } catch (error) {
            console.error('Error saving grid item:', error.message);
            set_message('danger', 'Unable to save the grid item. Please try again.');
            return false;

        } finally {

            state.is_saving = false;

            if (save_button !== null) {
                save_button.disabled = false;
            }
        }
    }

    function request_close() {

        if (state.is_saving === true) {
            return false;
        }

        const has_changes = state.mode !== 'details' && read_snapshot() !== saved_snapshot;

        if (has_changes && window.confirm('Discard the changes to this grid item?') === false) {
            return false;
        }

        $(MODAL).modal('hide');

        return true;
    }

    function on_hidden() {

        if (state.is_locked_by_me === true && state.item_id !== null) {
            lockModule.release_grid_item(item_ids());
        }

        reset();

        const target = typeof opener === 'function' ? opener() : opener;

        if (target && document.body.contains(target) && typeof target.focus === 'function') {
            target.focus();
        }

        opener = null;
    }

    function on_picker_hidden() {

        const modal = element(MODAL);

        if (modal === null || modal.classList.contains('show') === false) {
            return;
        }

        document.body.classList.add('modal-open');

        if (last_picker_button !== null) {
            last_picker_button.focus();
        }
    }

    function keep_focus_inside(event) {

        const modal = element(MODAL);

        if (modal === null || modal.classList.contains('show') === false || modal.contains(event.target)) {
            return;
        }

        if (typeof event.target.closest === 'function' && event.target.closest('.modal.show') !== null) {
            return;
        }

        modal.focus();
    }

    obj.init = function (options) {

        ids = { exhibit_id: options.exhibit_id, grid_id: options.grid_id };
        request = options.request;
        on_saved = options.on_saved || null;
        on_load_failed = options.on_load_failed || null;

        itemsCommonGridItemFormModule.set_message_selector(MESSAGE);
        itemsCommonContentBlockGridItemFormModule.set_message_selector(MESSAGE);

        mediaPickerModule.init();

        itemsCommonContentBlockGridItemFormModule.load_styles({
            card: '#grid-item-content-block-styles-card',
            container: '#grid-item-content-block-style-options',
            name: 'content_block_styles'
        });

        show_kind('media');

        Object.keys(KINDS).forEach(name => {
            $(KINDS[name].tab).on('show.bs.tab', function () {
                if (state.kind !== name) {
                    show_kind(name);
                }
            });
        });

        domModule.on('#grid-item-save-btn', 'click', save);
        domModule.on('#grid-item-cancel-btn', 'click', request_close);
        domModule.on('#grid-item-modal-close-btn', 'click', request_close);
        domModule.on('#grid-item-edit-btn', 'click', switch_to_edit);
        domModule.on('#grid-item-unlock-btn', 'click', unlock);

        ['#pick-item-media-btn', '#pick-thumbnail-btn'].forEach(selector => {
            domModule.on(selector, 'click', function () {
                last_picker_button = element(selector);
            });
        });

        $(MODAL).on('hidden.bs.modal', on_hidden);
        $('#media-picker-modal').on('hidden.bs.modal', on_picker_hidden);
        document.addEventListener('focusin', keep_focus_inside);

        window.addEventListener('pagehide', function () {
            if (state.is_locked_by_me === true && state.item_id !== null) {
                lockModule.release_grid_item(item_ids(), { keepalive: true });
            }
        });
    };

    return obj;

}());
