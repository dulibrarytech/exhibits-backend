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

const gridPageModule = (function () {

    'use strict';

    const APP_PATH = endpointsModule.get_app_path();
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    const ALLOWED_COLUMNS = [2, 3, 4];
    const MINIMUM_ITEMS_DELETE_MESSAGE = 'Grids cannot contain less items than there are columns. Reduce the amount of columns to delete items.';
    const MINIMUM_ITEMS_DELETE_ADD_ITEMS_MESSAGE = 'Grids cannot contain less items than there are columns. Add more items before deleting this one, or delete the whole grid.';
    const DELETE_MODAL = '#grid-item-delete-modal';
    const DELETE_MESSAGE = '#grid-item-delete-message';
    const PAGE_MESSAGE = '#message';
    const LIST_MESSAGE = '#grid-items-message';
    const SUCCESS_MESSAGE_DELAY = 3000;

    let obj = {};
    let ids = { exhibit_id: null, grid_id: null };
    let can_edit = null;
    let form_snapshot = '';
    let pending_delete = null;
    let is_saving = false;
    let is_deleting = false;

    function set_hidden(selector, is_hidden) {
        const target = document.querySelector(selector);
        if (target !== null) {
            target.hidden = is_hidden;
        }
    }

    function notify(selector, type, text) {
        itemsGridModule.show_message(type, text, type === 'success' ? SUCCESS_MESSAGE_DELAY : 0, selector);
    }

    function request(method, url, data) {
        return httpModule.req({
            method: method,
            url: url,
            data: data,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': authModule.get_user_token()
            },
            timeout: 30000,
            validateStatus: function (status) {
                return status >= 200 && status < 600;
            }
        });
    }

    function grid_endpoint(method) {
        return EXHIBITS_ENDPOINTS.exhibits.grid_records[method].endpoint
            .replace(':exhibit_id', encodeURIComponent(ids.exhibit_id))
            .replace(':grid_id', encodeURIComponent(ids.grid_id));
    }

    function minimum_items(columns) {
        const parsed = parseInt(columns, 10);
        return ALLOWED_COLUMNS.includes(parsed) ? parsed : Math.min(...ALLOWED_COLUMNS);
    }

    function row_toggle(item_id) {
        return document.querySelector(`#grid-item-list tr[id^="${item_id}_griditem_"] .item-actions-toggle`);
    }

    async function load_grid_record() {

        try {

            const response = await request('GET', grid_endpoint('get'));

            if (!response || response.status !== 200 || !response.data?.data) {
                return null;
            }

            return response.data.data;

        } catch (error) {
            console.error('Error loading grid:', error.message);
            return null;
        }
    }

    function set_created(record) {

        const created = document.querySelector('#created');

        if (created === null) {
            return;
        }

        const parts = [];

        if (record.created_by) {
            parts.push(`Created by ${record.created_by} on ${helperModule.format_date(new Date(record.created))}`);
        }

        if (record.updated_by) {
            parts.push(`Last updated by ${record.updated_by} on ${helperModule.format_date(new Date(record.updated))}`);
        }

        created.textContent = '';

        parts.forEach((part, index) => {

            if (index > 0) {
                created.appendChild(document.createTextNode(' | '));
            }

            const em = document.createElement('em');
            em.textContent = part;
            created.appendChild(em);
        });
    }

    async function fill_form(record) {

        set_created(record);
        rteModule.set_html('grid-text-input', record.text);
        domModule.set_value('#grid-internal-name-input', helperModule.unescape(record.internal_name || ''));
        itemsCommonStandardGridFormModule.set_grid_columns(record.columns);

        await itemsCommonStandardGridFormModule.wait_for_styles();

        if (record.styles && typeof record.styles === 'string'
            && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
            itemsCommonStandardGridFormModule.set_item_style(record.styles);
        }

        domModule.set_value('#margins', record.margins ?? 'medium');
        domModule.set_value('#text-align', record.text_alignment ?? 'left');
    }

    function read_form_state() {

        const style = document.querySelector('#item-style-options input:checked');

        return JSON.stringify([
            rteModule.get_html('grid-text-input'),
            domModule.get_value('#grid-internal-name-input'),
            domModule.get_value('#grid-columns'),
            style === null ? '' : style.value,
            domModule.get_value('#margins'),
            domModule.get_value('#text-align')
        ]);
    }

    function set_form_read_only(is_read_only) {

        document.querySelectorAll('#grid-data-card input, #grid-data-card select, #item-styles-card input, #item-styles-card select').forEach(field => {
            field.disabled = is_read_only;
        });

        rteModule.set_enabled('grid-text-input', !is_read_only);

        set_hidden('#save-item-btn', is_read_only);
        set_hidden('#cancel-exhibit-btn', is_read_only);
    }

    async function load_form() {

        const record = await load_grid_record();

        if (record === null) {
            notify(PAGE_MESSAGE, 'danger', 'Unable to load the grid. Please try again.');
            return false;
        }

        await fill_form(record);

        if (can_edit === null) {
            can_edit = await authModule.has_permissions(['update_item', 'update_any_item'], 'grid', ids.exhibit_id, ids.grid_id);
        }

        const is_published = record.is_published === 1;
        const offers_edit = is_published && can_edit;

        set_form_read_only(is_published || can_edit === false);
        set_hidden('#edit-grid-btn', !offers_edit);
        set_hidden('#grid-published-note', !offers_edit);
        set_hidden('#grid-no-permission-note', can_edit);
        form_snapshot = read_form_state();

        return true;
    }

    function edit_published_grid() {

        set_form_read_only(false);
        set_hidden('#edit-grid-btn', true);

        const first_field = document.querySelector('#grid-internal-name-input');

        if (first_field !== null) {
            first_field.focus();
        }
    }

    async function save_grid() {

        if (is_saving === true) {
            return false;
        }

        window.scrollTo(0, 0);

        const data = itemsCommonStandardGridFormModule.get_common_grid_form_fields();

        if (data === false) {
            return false;
        }

        data.updated_by = helperModule.get_user_name();
        is_saving = true;

        try {

            const response = await request('PUT', grid_endpoint('put'), data);

            if (response && response.status === 201) {
                await load_form();
                await itemsGridModule.display_grid_items();
                notify(PAGE_MESSAGE, 'success', 'Grid record updated');
                return true;
            }

            if (response && response.status === 403) {
                notify(PAGE_MESSAGE, 'danger', 'You do not have permission to update this grid.');
                return false;
            }

            const server_message = response?.data?.message;
            const error_text = typeof server_message === 'string' && server_message.length > 0
                ? server_message
                : 'Unable to update grid record. Please try again.';

            notify(PAGE_MESSAGE, 'danger', error_text);

            if (response && response.status === 422) {
                domModule.set_field_error('#grid-columns', 'grid-columns-error', error_text);
            }

            return false;

        } catch (error) {
            console.error('Error saving grid:', error.message);
            notify(PAGE_MESSAGE, 'danger', 'Unable to update grid record. Please try again.');
            return false;

        } finally {
            is_saving = false;
        }
    }

    function cancel() {

        if (read_form_state() !== form_snapshot
            && window.confirm('Discard unsaved changes and return to the exhibit item list?') === false) {
            return false;
        }

        window.location.href = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(ids.exhibit_id)}`;

        return true;
    }

    async function add_item(event) {

        event.preventDefault();

        const link = event.currentTarget;
        const is_allowed = await authModule.has_permissions(['add_item', 'add_item_to_any_exhibit'], 'grid_item', ids.exhibit_id, null);

        if (is_allowed === false) {
            notify(PAGE_MESSAGE, 'danger', 'You do not have permission to add item.');
            return false;
        }

        return gridItemModalModule.open_add(link);
    }

    function get_delete_refusal() {

        const columns = itemsGridModule.get_columns();

        if (columns === null) {
            return null;
        }

        const items_left = itemsGridModule.get_item_count() - 1;

        if (items_left >= minimum_items(columns)) {
            return null;
        }

        return items_left >= Math.min(...ALLOWED_COLUMNS)
            ? MINIMUM_ITEMS_DELETE_MESSAGE
            : MINIMUM_ITEMS_DELETE_ADD_ITEMS_MESSAGE;
    }

    async function request_delete(item_id, title) {

        if (get_delete_refusal() !== null) {
            await itemsGridModule.display_grid_items();
        }

        const refusal = get_delete_refusal();

        if (refusal !== null) {
            notify(LIST_MESSAGE, 'warning', refusal);
            return false;
        }

        pending_delete = { item_id: item_id };

        domModule.empty(DELETE_MESSAGE);
        domModule.set_text('#grid-item-delete-name', title);
        $(DELETE_MODAL).modal('show');

        return true;
    }

    async function confirm_delete() {

        if (is_deleting === true || pending_delete === null) {
            return false;
        }

        is_deleting = true;

        try {

            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.delete.endpoint
                .replace(':exhibit_id', encodeURIComponent(ids.exhibit_id))
                .replace(':grid_id', encodeURIComponent(ids.grid_id))
                .replace(':item_id', encodeURIComponent(pending_delete.item_id));

            const response = await request('DELETE', `${endpoint}?type=grid_item`);

            if (response && response.status === 204) {
                $(DELETE_MODAL).modal('hide');
                await itemsGridModule.display_grid_items();
                notify(LIST_MESSAGE, 'success', 'Grid item deleted');
                return true;
            }

            let error_text = 'Unable to delete the grid item. Please try again.';

            if (response && response.status === 403) {
                error_text = 'You do not have permission to delete this item.';
            } else if (response && response.status === 404) {
                error_text = 'Grid item not found.';
            } else if (response && typeof response.data?.message === 'string' && response.data.message.length > 0) {
                error_text = response.data.message;
            }

            domModule.set_alert(DELETE_MESSAGE, 'danger', error_text);

            return false;

        } catch (error) {
            console.error('Error deleting grid item:', error.message);
            domModule.set_alert(DELETE_MESSAGE, 'danger', 'Unable to delete the grid item. Please try again.');
            return false;

        } finally {
            is_deleting = false;
        }
    }

    function on_delete_hidden() {

        const toggle = pending_delete === null ? null : row_toggle(pending_delete.item_id);

        pending_delete = null;

        if (toggle !== null) {
            toggle.focus();
            return;
        }

        const main = document.querySelector('#main');

        if (main !== null) {
            main.focus({ preventScroll: true });
        }
    }

    function on_row_action(event) {

        const target = event.target.closest('[data-action="edit-item"], [data-action="details-item"], [data-action="delete-item"]');

        if (target === null) {
            return;
        }

        event.preventDefault();

        const row = target.closest('tr');

        if (row === null || !row.id) {
            return;
        }

        const parts = row.id.split('_');
        const item_id = parts[0];
        const item_type = parts.slice(2).join('_');
        const action = target.dataset.action;
        const trigger = () => row_toggle(item_id);

        if (action === 'delete-item') {
            const title = row.querySelector('.item-title');
            request_delete(item_id, title === null ? 'Untitled grid item' : title.textContent);
            return;
        }

        if (action === 'edit-item') {
            gridItemModalModule.open_edit(item_id, item_type, trigger);
            return;
        }

        gridItemModalModule.open_details(item_id, item_type, trigger);
    }

    async function on_item_saved(result) {

        await itemsGridModule.display_grid_items();
        notify(LIST_MESSAGE, 'success', result.action === 'added' ? 'Grid item added' : 'Grid item saved');

        if (result.item_id && document.activeElement === document.body) {
            const toggle = row_toggle(result.item_id);
            if (toggle !== null) {
                toggle.focus();
            }
        }
    }

    obj.init = async function () {

        ids = {
            exhibit_id: helperModule.get_parameter_by_name('exhibit_id'),
            grid_id: helperModule.get_parameter_by_name('grid_id')
        };

        await itemsCommonStandardGridFormModule.init();

        gridItemModalModule.init({
            exhibit_id: ids.exhibit_id,
            grid_id: ids.grid_id,
            request: request,
            on_saved: on_item_saved,
            on_load_failed: () => notify(LIST_MESSAGE, 'danger', 'Unable to load the grid item. Please try again.')
        });

        domModule.on('#save-item-btn', 'click', save_grid);
        domModule.on('#cancel-exhibit-btn', 'click', cancel);
        domModule.on('#edit-grid-btn', 'click', edit_published_grid);
        domModule.on('#add-grid-item-link', 'click', add_item);
        domModule.on('#grid-item-list', 'click', on_row_action);
        domModule.on('#grid-item-delete-confirm-btn', 'click', confirm_delete);
        $(DELETE_MODAL).on('hidden.bs.modal', on_delete_hidden);

        await itemsGridModule.display_grid_items();
        await load_form();
    };

    return obj;

}());
