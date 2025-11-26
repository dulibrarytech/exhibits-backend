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

const itemsGridModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    const obj = {};

    let grid_item_data_table = null;

    /**
     * Displays a message in the message container
     * @param {string} message - Message text to display
     * @param {string} type - Alert type: 'danger', 'warning', 'info', 'success'
     * @param {number|null} auto_hide_ms - Auto-hide after milliseconds, null to persist
     */
    function display_message(message, type = 'danger', auto_hide_ms = null) {
        const message_el = document.querySelector('#message');
        if (message_el === null) {
            return;
        }

        const alert_div = document.createElement('div');
        alert_div.className = `alert alert-${type}`;
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        const icon_class_map = {
            danger: 'fa-exclamation',
            warning: 'fa-warning',
            info: 'fa-info-circle',
            success: 'fa-check'
        };
        icon.className = `fa ${icon_class_map[type] || 'fa-exclamation'}`;

        alert_div.appendChild(icon);
        alert_div.appendChild(document.createTextNode(` ${message}`));

        message_el.innerHTML = '';
        message_el.appendChild(alert_div);

        if (auto_hide_ms !== null) {
            setTimeout(() => {
                message_el.innerHTML = '';
            }, auto_hide_ms);
        }
    }

    /**
     * Gets exhibit and grid IDs from URL parameters
     * @returns {{exhibit_id: string, grid_id: string}}
     */
    function get_context_ids() {
        return {
            exhibit_id: helperModule.get_parameter_by_name('exhibit_id'),
            grid_id: helperModule.get_parameter_by_name('grid_id')
        };
    }

    /**
     * Fetches grid items from the API
     * @param {string} exhibit_id
     * @param {string} grid_id
     * @returns {Promise<Array|false>}
     */
    async function get_grid_items(exhibit_id, grid_id) {
        try {
            const token = authModule.get_user_token();
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.get.endpoint
                .replace(':exhibit_id', exhibit_id)
                .replace(':grid_id', grid_id);

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

            return false;

        } catch (error) {
            display_message(error.message);
            return false;
        }
    }

    /**
     * Determines the item type from a table row ID
     * @param {string} uuid - The item UUID
     * @returns {{is_text: boolean, type_string: string}}
     */
    function get_item_type_from_row(uuid) {
        const row = document.getElementById(`${uuid}_griditem_text`) ||
            document.getElementById(`${uuid}_griditem_media`);

        if (row !== null && row.id.includes('_text')) {
            return { is_text: true, type_string: 'text' };
        }

        return { is_text: false, type_string: 'media' };
    }

    /**
     * Creates the action buttons HTML element for a grid item
     * @param {string} uuid - Item UUID
     * @param {boolean} is_published - Whether item is published
     * @returns {HTMLElement}
     */
    function create_action_buttons(uuid, is_published) {
        const { exhibit_id, grid_id } = get_context_ids();
        const { is_text, type_string } = get_item_type_from_row(uuid);

        const container = document.createElement('div');
        container.className = 'card-text text-sm-center';

        if (is_published) {
            const details_path = is_text
                ? `${APP_PATH}/items/grid/item/text/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`
                : `${APP_PATH}/items/grid/item/media/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`;

            const details_link = document.createElement('a');
            details_link.href = details_path;
            details_link.title = 'View details';
            details_link.setAttribute('aria-label', 'item-details');

            const details_icon = document.createElement('i');
            details_icon.className = 'fa fa-folder-open pr-1';
            details_link.appendChild(details_icon);

            const trash_icon = document.createElement('i');
            trash_icon.title = 'Can only delete if unpublished';
            trash_icon.style.color = '#d3d3d3';
            trash_icon.className = 'fa fa-trash pr-1';
            trash_icon.setAttribute('aria-label', 'delete-grid-item');

            container.appendChild(details_link);
            container.appendChild(document.createTextNode('\u00A0'));
            container.appendChild(trash_icon);
        } else {
            const edit_path = is_text
                ? `${APP_PATH}/items/grid/item/text/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`
                : `${APP_PATH}/items/grid/item/media/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`;

            const delete_path = `${APP_PATH}/items/grid/item/delete?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`;

            const edit_link = document.createElement('a');
            edit_link.href = edit_path;
            edit_link.title = 'Edit item';
            edit_link.setAttribute('aria-label', 'edit-item');

            const edit_icon = document.createElement('i');
            edit_icon.className = 'fa fa-edit pr-1';
            edit_link.appendChild(edit_icon);

            const delete_link = document.createElement('a');
            delete_link.href = delete_path;
            delete_link.title = 'Delete item';
            delete_link.setAttribute('aria-label', 'delete-item');

            const delete_icon = document.createElement('i');
            delete_icon.className = 'fa fa-trash pr-1';
            delete_link.appendChild(delete_icon);

            container.appendChild(edit_link);
            container.appendChild(document.createTextNode('\u00A0'));
            container.appendChild(delete_link);
        }

        return container;
    }

    /**
     * Updates the publish/suppress button UI
     * @param {HTMLElement} button_el - The button element
     * @param {boolean} is_published - New published state
     */
    function update_publish_button_ui(button_el, is_published) {
        if (button_el === null) {
            return;
        }

        button_el.classList.remove('publish-item', 'suppress-item');
        button_el.classList.add(is_published ? 'suppress-item' : 'publish-item');
        button_el.innerHTML = '';

        const span = document.createElement('span');
        span.id = is_published ? 'suppress' : 'publish';
        span.title = is_published ? 'published' : 'suppressed';

        const icon = document.createElement('i');
        icon.className = 'fa ' + (is_published ? 'fa-cloud' : 'fa-cloud-upload');
        icon.style.color = is_published ? 'green' : 'darkred';

        span.appendChild(icon);
        span.appendChild(document.createElement('br'));
        span.appendChild(document.createTextNode(is_published ? 'Published' : 'Suppressed'));

        button_el.appendChild(span);
    }

    /**
     * Updates the actions column after publish/suppress
     * @param {string} uuid - Item UUID
     * @param {boolean} is_published - New published state
     */
    function update_actions_column(uuid, is_published) {
        const actions_el = document.getElementById(`${uuid}-item-actions`);
        if (actions_el === null) {
            return;
        }

        const new_buttons = create_action_buttons(uuid, is_published);
        actions_el.innerHTML = '';
        actions_el.appendChild(new_buttons);
    }

    /**
     * Publishes a grid item
     * @param {string} uuid - Grid item UUID
     * @returns {Promise<boolean>}
     */
    async function publish_grid_item(uuid) {
        try {
            const { exhibit_id, grid_id } = get_context_ids();
            const token = authModule.get_user_token();
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.grid_item_publish.post.endpoint
                .replace(':exhibit_id', exhibit_id)
                .replace(':grid_id', grid_id)
                .replace(':grid_item_id', uuid);

            const response = await httpModule.req({
                method: 'POST',
                url: `${endpoint}?type=grid_item`,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 10000,
                validateStatus: function (status) {
                    return status >= 200 && status < 600;
                }
            });

            if (response.status === 200) {
                const button_el = document.getElementById(uuid);
                update_publish_button_ui(button_el, true);
                update_actions_column(uuid, true);
                return true;
            }

            if (response.status === 403) {
                scrollTo(0, 0);
                display_message('You do not have permission to publish this record.', 'danger', 5000);
                return false;
            }

            if (response.status === 500) {
                scrollTo(0, 0);
                display_message(response.data.message);
                return false;
            }

            return false;

        } catch (error) {
            display_message(error.message);
            return false;
        }
    }

    /**
     * Suppresses (unpublishes) a grid item
     * @param {string} uuid - Grid item UUID
     * @returns {Promise<boolean>}
     */
    async function suppress_grid_item(uuid) {
        try {
            const { exhibit_id, grid_id } = get_context_ids();
            const token = authModule.get_user_token();
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.grid_item_suppress.post.endpoint
                .replace(':exhibit_id', exhibit_id)
                .replace(':grid_id', grid_id)
                .replace(':grid_item_id', uuid);

            const response = await httpModule.req({
                method: 'POST',
                url: `${endpoint}?type=grid_item`,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                const button_el = document.getElementById(uuid);
                update_publish_button_ui(button_el, false);
                update_actions_column(uuid, false);
                return true;
            }

            if (response === undefined) {
                scrollTo(0, 0);
                display_message('You do not have permission to unpublish this record.', 'danger', 5000);
                return false;
            }

            if (response.status === 204) {
                scrollTo(0, 0);
                display_message('Unable to unpublish grid item', 'warning', 5000);
                return false;
            }

            return false;

        } catch (error) {
            display_message(error.message);
            return false;
        }
    }

    /**
     * Sets up delegated event handlers on the DataTable for publish/suppress actions
     * @param {DataTable} data_table - The DataTable instance
     */
    function setup_datatable_events(data_table) {
        const table_body = document.querySelector('#grid-items tbody');
        if (table_body === null) {
            return;
        }

        table_body.addEventListener('click', async function (event) {
            const target = event.target.closest('.publish-item, .suppress-item');
            if (target === null) {
                return;
            }

            event.preventDefault();
            const uuid = target.getAttribute('id');

            if (uuid === null) {
                return;
            }

            if (target.classList.contains('publish-item')) {
                await publish_grid_item(uuid);
            } else if (target.classList.contains('suppress-item')) {
                await suppress_grid_item(uuid);
            }
        });
    }

    /**
     * Displays grid items in the DataTable
     * @param {Event} event - Optional event object
     */
    obj.display_grid_items = async function (event) {
        const { exhibit_id, grid_id } = get_context_ids();
        await exhibitsModule.set_exhibit_title(exhibit_id);

        const items = await get_grid_items(exhibit_id, grid_id);

        if (items === false) {
            const item_card = document.querySelector('#item-card');
            if (item_card !== null) {
                item_card.innerHTML = '';
            }
            return false;
        }

        if (items.length === 0) {
            const card = document.querySelector('.card');
            if (card !== null) {
                card.innerHTML = '';
            }
            display_message('Grid is empty.', 'info');
            return false;
        }

        let item_data = '';
        for (let i = 0; i < items.length; i++) {
            item_data += await itemsListDisplayModule.display_grid_items(items[i]);
        }

        const grid_item_list = document.querySelector('#grid-item-list');
        if (grid_item_list !== null) {
            grid_item_list.innerHTML = item_data;
        }

        if (grid_item_data_table !== null) {
            grid_item_data_table.destroy();
        }

        grid_item_data_table = new DataTable('#grid-items', {
            paging: false,
            rowReorder: true
        });

        grid_item_data_table.on('row-reordered', async (e, reordered_items) => {
            await helperModule.reorder_grid_items(e, reordered_items);
        });

        setup_datatable_events(grid_item_data_table);

        return true;
    };

    /**
     * Deletes a grid item
     * @returns {Promise<boolean>}
     */
    obj.delete_grid_item = async function () {
        try {
            const delete_message = document.querySelector('#delete-message');
            const delete_card = document.querySelector('#delete-card');

            if (delete_message !== null) {
                delete_message.textContent = 'Deleting grid item...';
            }

            if (delete_card !== null) {
                delete_card.style.display = 'none';
            }

            const { exhibit_id, grid_id } = get_context_ids();
            const grid_item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.delete.endpoint
                .replace(':exhibit_id', exhibit_id)
                .replace(':grid_id', grid_id)
                .replace(':item_id', grid_item_id);

            const response = await httpModule.req({
                method: 'DELETE',
                url: `${endpoint}?type=grid_item`,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 204) {
                setTimeout(() => {
                    window.location.replace(`${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${grid_id}`);
                }, 900);
                return true;
            }

            if (response === undefined) {
                display_message('You do not have permission to delete this item.');
            }

            return false;

        } catch (error) {
            display_message(error.message);
            return false;
        }
    };

    /**
     * Initializes the grid items module
     * @returns {Promise<void>}
     */
    obj.init = async function () {
        try {
            const status = helperModule.get_parameter_by_name('status');

            if (status === '403') {
                const { exhibit_id, grid_id } = get_context_ids();

                window.history.replaceState(
                    { page: 'items' },
                    '',
                    `/exhibits-dashboard/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${grid_id}`
                );

                setTimeout(() => {
                    display_message('You do not have permission to add item.');
                }, 50);
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_items();
            navModule.set_preview_link();
            navModule.set_grid_item_nav_menu_links();
            navModule.set_logout_link();
            helperModule.show_form();

        } catch (error) {
            display_message(error.message);
        }
    };

    return obj;

}());
