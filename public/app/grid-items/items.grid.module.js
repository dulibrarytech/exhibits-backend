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

    const APP_PATH = endpointsModule.get_app_path();
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Fetches grid items for a specific exhibit and grid
     * @param {string} exhibit_id - The exhibit identifier
     * @param {string} grid_id - The grid identifier
     * @returns {Promise<Array|null>} Grid items array or null on failure
     */
    async function get_grid_items(exhibit_id, grid_id) {

        const message_element = document.querySelector('#message');

        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(grid_id)) {
            domModule.set_alert(message_element, 'danger', 'Invalid exhibit or grid identifier');
            return null;
        }

        try {

            const endpoint = endpointsModule.build(
                EXHIBITS_ENDPOINTS.exhibits.grid_item_records.get.endpoint,
                { exhibit_id: exhibit_id, grid_id: grid_id }
            );

            const response = await httpModule.api({
                method: 'GET',
                url: endpoint
            });

            if (response === null || response === undefined) {
                domModule.set_alert(message_element, 'danger', 'No response received from server');
                return null;
            }

            if (response.status === 200) {
                return response.data?.data ?? [];
            }

            if (response.status === 401 || response.status === 403) {
                domModule.set_alert(message_element, 'danger', 'You do not have permission to view these grid items');
                return null;
            }

            if (response.status === 404) {
                domModule.set_alert(message_element, 'danger', 'Grid items not found');
                return null;
            }

            domModule.set_alert(message_element, 'danger', `Unexpected server response: ${response.status}`);
            return null;

        } catch (error) {
            const safe_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            domModule.set_alert(message_element, 'danger', safe_message);
            return null;
        }
    }

    /**
     * Fetches the grid record (for the columns value used by the
     * minimum-items advisory). Returns null on any failure — the advisory
     * is guidance only, so errors here must not block the item list.
     * @param {string} exhibit_id - The exhibit identifier
     * @param {string} grid_id - The grid identifier
     * @returns {Promise<Object|null>} Grid record or null
     */
    async function get_grid_record(exhibit_id, grid_id) {

        try {

            const endpoint = endpointsModule.build(
                EXHIBITS_ENDPOINTS.exhibits.grid_records.get.endpoint,
                { exhibit_id: exhibit_id, grid_id: grid_id }
            );

            const response = await httpModule.api({
                method: 'GET',
                url: endpoint,
                logout_on_missing_token: false
            });

            if (response !== undefined && response !== null && response.status === 200) {
                return response.data?.data ?? null;
            }

            return null;

        } catch (error) {
            return null;
        }
    }

    // Column counts the Grid form's dropdown offers — keep in sync with
    // ALLOWED_COLUMNS in exhibits/grid_model.js, which enforces the same
    // minimum-items rule at publish time.
    const ALLOWED_COLUMN_COUNTS = [2, 3, 4];

    /**
     * Builds the minimum-items advisory for the grid item list. A grid must
     * hold at least one full row (items >= columns) before it can be
     * published; the server refuses to publish it otherwise. Legacy grids
     * saved with a column value outside the allowed set fall back to the
     * smallest allowed count, matching the server rule.
     * @param {*} columns - The grid's saved column count
     * @param {number} item_count - Number of grid items in the list
     * @returns {string|null} Advisory text, or null when the minimum is met
     */
    obj.build_min_items_notice = function (columns, item_count) {

        const parsed_columns = parseInt(columns, 10);
        const minimum = ALLOWED_COLUMN_COUNTS.includes(parsed_columns)
            ? parsed_columns
            : Math.min(...ALLOWED_COLUMN_COUNTS);

        if (item_count >= minimum) {
            return null;
        }

        const needed = minimum - item_count;
        const intro = ALLOWED_COLUMN_COUNTS.includes(parsed_columns)
            ? `This grid is set to ${minimum} columns and needs at least ${minimum} grid items — `
            : `Grids need at least ${minimum} grid items — `;

        return `${intro}${item_count} of ${minimum} added. ` +
            `Add ${needed} more grid item${needed === 1 ? '' : 's'}, or reduce the number of columns, before publishing this grid.`;
    };

    /**
     * Shows or clears the minimum-items advisory above the item list. The
     * container is a polite live region (role="status" in the view), so the
     * notice is announced without interrupting, and the shortfall is stated
     * in text — never by color alone.
     * @param {Object|null} grid_record - Grid record (null skips the notice)
     * @param {number} item_count - Number of grid items in the list
     */
    function render_min_items_notice(grid_record, item_count) {

        const status_el = document.querySelector('#grid-min-items-status');

        if (status_el === null) {
            return;
        }

        const notice = grid_record === null
            ? null
            : obj.build_min_items_notice(grid_record.columns, item_count);

        if (notice === null) {
            status_el.textContent = '';
            return;
        }

        domModule.set_alert(status_el, 'warning', notice);
    }

    obj.display_grid_items = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');

        // Hide table and show loading indicator before fetching data
        const grid_items_table = document.querySelector('#grid-items');
        const card_element = document.querySelector('.card');

        if (grid_items_table !== null) {
            grid_items_table.style.visibility = 'hidden';
        }

        if (card_element !== null) {
            card_element.style.minHeight = '200px';
        }

        domModule.set_loading('#message', 'Loading grid items...');

        await exhibitsModule.set_exhibit_title(exhibit_id);
        const items = await get_grid_items(exhibit_id, grid_id);

        // Clear loading message
        domModule.empty('#message');

        if (items === null) {
            domModule.empty('#item-card');
            if (grid_items_table !== null) {
                grid_items_table.style.visibility = 'visible';
            }
            return false;
        }

        // Advisory: warn while the grid holds fewer items than its column
        // count — publishing is refused server-side until the minimum is met.
        const grid_record = await get_grid_record(exhibit_id, grid_id);
        render_min_items_notice(grid_record, items.length);

        if (items.length === 0) {
            const item_card = document.querySelector('#item-card');
            const exhibit_title = document.querySelector('#exhibit-title');

            if (item_card !== null) {
                item_card.remove();
            }

            if (exhibit_title !== null && exhibit_title.parentElement !== null) {
                exhibit_title.parentElement.style.display = 'none';
            }

            domModule.set_alert('#message', 'info', 'Grid is empty.');
            return false;
        }

        let item_data = '';
        let item_order = [];

        // Build all item HTML before inserting into DOM
        for (let i = 0; i < items.length; i++) {
            item_order.push(items[i].order);
            item_data += await itemsListDisplayModule.display_grid_items(items[i]);
        }

        // Insert all rows at once via a DocumentFragment.
        const grid_item_list = document.querySelector('#grid-item-list');
        const grid_template = document.createElement('template');
        grid_template.innerHTML = item_data;
        grid_item_list.textContent = '';
        grid_item_list.appendChild(grid_template.content);

        // Initialize action dropdown handlers
        if (typeof itemsListDisplayModule !== 'undefined' && typeof itemsListDisplayModule.setup_item_action_handlers === 'function') {
            itemsListDisplayModule.setup_item_action_handlers();
        }

        // Initialize DataTable.
        const GRID_ITEM_LIST = new DataTable('#grid-items', {
            paging: false,
            rowReorder: {
                excludedChildren: 'a, .reorder-btn, .reorder-btn *'
            },
            language: {
                emptyTable: 'No grid items found',
                zeroRecords: 'No matching grid items found',
                info: 'Showing _START_ - _END_ of _TOTAL_ results',
                infoEmpty: 'No grid items available',
                infoFiltered: '(filtered from _MAX_ total grid items)',
                search: 'Search grid items:'
            }
        });

        GRID_ITEM_LIST.on('row-reordered', async (e, reordered_items) => {
            await reorderModule.reorder_grid_items(e, reordered_items);
        });

        // Wire keyboard reorder buttons (Move up / Move down).
        const grid_id_for_reorder = helperModule.get_parameter_by_name('grid_id');
        if (typeof reorderModule.attach_keyboard_reorder_handlers === 'function') {
            reorderModule.attach_keyboard_reorder_handlers('#grid-items', { grid_id: grid_id_for_reorder });
        }
        GRID_ITEM_LIST.on('draw', () => {
            if (typeof reorderModule.update_reorder_button_states === 'function') {
                reorderModule.update_reorder_button_states('#grid-items');
            }
        });

        // Use delegated events on table body for publish/suppress actions
        const table_body = document.querySelector('#grid-items tbody');

        if (table_body !== null) {
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

        // Show table after DataTable is initialized and content is ready
        if (grid_items_table !== null) {
            grid_items_table.style.visibility = 'visible';
        }

        if (card_element !== null) {
            card_element.style.minHeight = '';
        }
    };

    async function publish_grid_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const type = 'grid_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const endpoint = endpointsModule.build(
                EXHIBITS_ENDPOINTS.exhibits.grid_item_records.grid_item_publish.post.endpoint,
                { exhibit_id: exhibit_id, grid_id: grid_id, grid_item_id: uuid }
            );
            const response = await httpModule.api({
                method: 'POST',
                url: endpoint + '?type=' + type
            });

            if (response.status === 200) {

                const elem = document.getElementById(uuid);
                elem.classList.remove('publish-item');
                elem.classList.add('suppress-item');
                elem.innerHTML = '<span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br><small>Published</small></span>';

                itemsListDisplayModule.update_actions_cell(uuid, { exhibit_id: exhibit_id, grid_id: grid_id, is_published: 1 });

            } else if (response.status === 403) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to publish this record.');

                setTimeout(() => {
                    domModule.empty('#message');
                }, 5000);
            }

            // 422: publish refused by a server-side rule (e.g. the parent
            // grid is not published). Show the server's message and leave it
            // on screen — it is actionable, not a passing notice.
            if (response.status === 422) {
                scrollTo(0, 0);
                const server_message = response.data?.message ?? 'Unable to publish grid item';
                domModule.set_alert(document.querySelector('#message'), 'warning', server_message);
            }

            if (response.status === 500) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'danger', response.data.message);

                setTimeout(() => {
                    // domModule.empty('#message');
                }, 5000);
            }

            return false;

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    }

    async function suppress_grid_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const type = 'grid_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const endpoint = endpointsModule.build(
                EXHIBITS_ENDPOINTS.exhibits.grid_item_records.grid_item_suppress.post.endpoint,
                { exhibit_id: exhibit_id, grid_id: grid_id, grid_item_id: uuid }
            );

            const response = await httpModule.api({
                method: 'POST',
                url: endpoint + '?type=' + type
            });

            if (response !== undefined && response.status === 403) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to unpublish this record.');

                setTimeout(() => {
                    domModule.empty('#message');
                }, 5000);

                return false;
            }

            // 422: unpublish refused by a server-side rule (e.g. the grid is
            // published and would drop below its minimum item count). Show the
            // server's message — it names the rule and the remedy — and keep
            // it on screen: it is actionable, not a passing notice.
            if (response !== undefined && response.status === 422) {
                scrollTo(0, 0);
                const server_message = response.data?.message ?? 'Unable to unpublish grid item';
                domModule.set_alert(document.querySelector('#message'), 'warning', server_message);
                return false;
            }

            if (response !== undefined && response.status === 200) {

                const elem = document.getElementById(uuid);
                elem.classList.remove('suppress-item');
                elem.classList.add('publish-item');
                elem.innerHTML = '<span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br><small>Unpublished</small></span>';

                itemsListDisplayModule.update_actions_cell(uuid, { exhibit_id: exhibit_id, grid_id: grid_id, is_published: 0 });

            } else if (response === undefined) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to unpublish this record.');

                setTimeout(() => {
                    domModule.empty('#message');
                }, 5000);
            }

            if (response !== undefined && response.status === 204) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'warning', 'Unable to unpublish grid item');

                setTimeout(() => {
                    domModule.empty('#message');
                }, 5000);
            }

            return false;

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    }

    /**
     * Validates UUID format
     * @param {string} value - Value to validate
     * @returns {boolean} True if valid UUID format
     */
    function is_valid_uuid(value) {

        if (typeof value !== 'string' || value.length === 0) {
            return false;
        }

        const uuid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuid_pattern.test(value);
    }

    /**
     * Deletes a grid item and redirects to the grid items list
     * @returns {Promise<boolean>} Success status
     */
    obj.delete_grid_item = async function () {

        // Cache DOM elements
        const elements = {
            message: document.querySelector('#message'),
            delete_card: document.querySelector('#delete-card')
        };

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        const grid_item_id = helperModule.get_parameter_by_name('item_id');

        // Validate required parameters
        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(grid_id) || !is_valid_uuid(grid_item_id)) {
            domModule.set_alert(elements.message, 'danger', 'Invalid exhibit, grid, or item identifier');
            return false;
        }

        // Hide delete card and show deleting message
        if (elements.delete_card !== null) {
            elements.delete_card.style.display = 'none';
        }

        domModule.set_loading(elements.message, 'Deleting grid item...');

        try {

            const endpoint = endpointsModule.build(
                EXHIBITS_ENDPOINTS.exhibits.grid_item_records.delete.endpoint,
                { exhibit_id: exhibit_id, grid_id: grid_id, item_id: grid_item_id }
            );

            const response = await httpModule.api({
                method: 'DELETE',
                url: `${endpoint}?type=grid_item`
            });

            if (response === null || response === undefined) {
                domModule.set_alert(elements.message, 'danger', 'No response received from server');
                restore_delete_card(elements);
                return false;
            }

            if (response.status === 204) {
                redirect_to_grid_items(exhibit_id, grid_id);
                return true;
            }

            if (response.status === 403) {
                domModule.set_alert(elements.message, 'danger', 'You do not have permission to delete this item.');
                restore_delete_card(elements);
                return false;
            }

            if (response.status === 404) {
                domModule.set_alert(elements.message, 'danger', 'Grid item not found.');
                restore_delete_card(elements);
                return false;
            }

            if (response.status === 500) {
                const error_text = response.data?.message ?? 'Internal server error';
                domModule.set_alert(elements.message, 'danger', error_text);
                restore_delete_card(elements);
                return false;
            }

            domModule.set_alert(elements.message, 'danger', `Unexpected server response: ${response.status}`);
            restore_delete_card(elements);
            return false;

        } catch (error) {
            const safe_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            domModule.set_alert(elements.message, 'danger', safe_message);
            restore_delete_card(elements);
            return false;
        }
    };

    /**
     * Restores the delete card visibility after an error
     * @param {Object} elements - Cached DOM elements
     */
    function restore_delete_card(elements) {

        /*
         * Restores the card only — every caller writes an error message via
         * domModule.set_alert immediately before this runs, so clearing
         * #message here would erase the explanation the user needs to see.
         */
        if (elements.delete_card !== null) {
            elements.delete_card.style.display = '';
        }
    }

    /**
     * Redirects to the grid items list page
     * @param {string} exhibit_id - The exhibit identifier
     * @param {string} grid_id - The grid identifier
     */
    function redirect_to_grid_items(exhibit_id, grid_id) {

        const encoded_exhibit_id = encodeURIComponent(exhibit_id);
        const encoded_grid_id = encodeURIComponent(grid_id);
        const redirect_url = `${APP_PATH}/items/grid/items?exhibit_id=${encoded_exhibit_id}&grid_id=${encoded_grid_id}`;

        setTimeout(() => {
            window.location.replace(redirect_url);
        }, 900);
    }

    obj.init = async function () {

        try {

            const status = helperModule.get_parameter_by_name('status');

            if (status !== null && status === '403') {

                const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
                const grid_id = helperModule.get_parameter_by_name('grid_id');

                setTimeout(() => {
                    window.history.replaceState({page: 'items'}, '', '/exhibits-dashboard/items/grid/items?exhibit_id=' + exhibit_id + '&grid_id=' + grid_id);
                }, 0);

                setTimeout(() => {
                    domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to add item.');
                }, 50);
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            helperModule.show_form();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());