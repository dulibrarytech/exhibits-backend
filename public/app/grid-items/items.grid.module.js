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
            display_error_message(message_element, 'Invalid exhibit or grid identifier');
            return null;
        }

        try {

            const token = authModule.get_user_token();

            if (token === null || token.length === 0) {
                display_error_message(message_element, 'Authentication required');
                return null;
            }

            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':grid_id', encodeURIComponent(grid_id));

            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            if (response === null || response === undefined) {
                display_error_message(message_element, 'No response received from server');
                return null;
            }

            if (response.status === 200) {
                return response.data?.data ?? [];
            }

            if (response.status === 401 || response.status === 403) {
                display_error_message(message_element, 'You do not have permission to view these grid items');
                return null;
            }

            if (response.status === 404) {
                display_error_message(message_element, 'Grid items not found');
                return null;
            }

            display_error_message(message_element, `Unexpected server response: ${response.status}`);
            return null;

        } catch (error) {
            const safe_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_error_message(message_element, safe_message);
            return null;
        }
    }

    /**
     * Displays sanitized error message
     * @param {Element|null} element - Target DOM element
     * @param {string} message - Error message to display
     */
    function display_error_message(element, message) {

        if (element === null) {
            return;
        }

        const sanitized_message = sanitize_html(message);
        element.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${sanitized_message}</div>`;
    }

    /**
     * Sanitizes string for safe HTML insertion
     * @param {string} text - Text to sanitize
     * @returns {string} Sanitized text
     */
    function sanitize_html(text) {

        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
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

        document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert"><i class="fa fa-spinner fa-spin"></i> Loading grid items...</div>';

        await exhibitsModule.set_exhibit_title(exhibit_id);
        const items = await get_grid_items(exhibit_id, grid_id);

        // Clear loading message
        document.querySelector('#message').innerHTML = '';

        if (items === false) {
            document.querySelector('#item-card').innerHTML = '';
            if (grid_items_table !== null) {
                grid_items_table.style.visibility = 'visible';
            }
            return false;
        }

        if (items.length === 0) {
            const item_card = document.querySelector('#item-card');
            const exhibit_title = document.querySelector('#exhibit-title');

            if (item_card !== null) {
                item_card.style.display = 'none';
            }

            if (exhibit_title !== null && exhibit_title.parentElement !== null) {
                exhibit_title.parentElement.style.display = 'none';
            }

            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert">Grid is empty.</div>';
            return false;
        }

        let item_data = '';
        let item_order = [];

        // Build all item HTML before inserting into DOM
        for (let i = 0; i < items.length; i++) {
            item_order.push(items[i].order);
            item_data += await itemsListDisplayModule.display_grid_items(items[i]);
        }

        // Insert all items at once
        document.querySelector('#grid-item-list').innerHTML = item_data;

        // Initialize DataTable
        const GRID_ITEM_LIST = new DataTable('#grid-items', {
            paging: false,
            rowReorder: true
        });

        GRID_ITEM_LIST.on('row-reordered', async (e, reordered_items) => {
            await helperModule.reorder_grid_items(e, reordered_items);
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
            const grid_item_id = uuid;
            const type = 'grid_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.grid_item_publish.post.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':grid_id', grid_id);
            const endpoint = gtmp.replace(':grid_item_id', grid_item_id);
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint + '?type=' + type,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 10000,
                validateStatus: function (status) {
                    return status >= 200 && status < 600; // Accept any status code
                }
            });

            if (response.status === 200) {

                let elem = document.getElementById(uuid);
                elem.classList.remove('publish-item');
                elem.classList.add('suppress-item');
                elem.innerHTML = '<span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span>';

                const trIds = Array.from(document.querySelectorAll('tr')).map(tr => tr.id).filter(id => id);
                let uuid_found = trIds.find((arr_result) => {

                    let uuid_arr = arr_result.split('_');

                    if (uuid === uuid_arr[0]) {
                        return true;
                    } else {
                        return false;
                    }
                });

                let type = uuid_found.split('_');
                let details_path;

                if (type[1] === 'griditem' && type[2] === 'text') {
                    details_path = `${APP_PATH}/items/grid/item/text/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`;
                } else {
                    details_path = `${APP_PATH}/items/grid/item/media/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`;
                }

                let uuid_actions = `${uuid}-item-actions`;
                let actions_elem = document.getElementById(uuid_actions);
                let item_details = `<a href="${details_path}" title="View details" aria-label="item-details"><i class="fa fa-folder-open pr-1"></i> </a>`;
                let trash = `<i title="Can only delete if unpublished" style="color: #d3d3d3" class="fa fa-trash pr-1" aria-label="delete-grid-item"></i>`;
                actions_elem.innerHTML = `
                    <div class="card-text text-sm-center">
                    ${item_details}&nbsp;
                    ${trash}
                    </div>`;

            } else if (response.status === 403) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-danger"></i> You do not have permission to publish this record.</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            if (response.status === 500) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${response.data.message}</div>`;

                setTimeout(() => {
                    // document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function suppress_grid_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const grid_item_id = uuid;
            const type = 'grid_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.grid_item_suppress.post.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':grid_id', grid_id);
            const endpoint = gtmp.replace(':grid_item_id', grid_item_id);
            const token = authModule.get_user_token();

            const response = await httpModule.req({
                method: 'POST',
                url: endpoint + '?type=' + type,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {

                let elem = document.getElementById(uuid);
                elem.classList.remove('suppress-item');
                elem.classList.add('publish-item');
                elem.innerHTML = '<span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span>';

                const trIds = Array.from(document.querySelectorAll('tr')).map(tr => tr.id).filter(id => id);
                let uuid_found = trIds.find((arr_result) => {

                    let uuid_arr = arr_result.split('_');

                    if (uuid === uuid_arr[0]) {
                        return true;
                    } else {
                        return false;
                    }
                });

                let type = uuid_found.split('_');
                let edit_path;
                let delete_path;
                let view_items = '';

                if (type[1] === 'griditem' && type[2] === 'text') {
                    edit_path = `${APP_PATH}/items/grid/item/text/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`;
                } else {
                    edit_path = `${APP_PATH}/items/grid/item/media/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`;
                }

                delete_path = `${APP_PATH}/items/grid/item/delete?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${uuid}`;

                let uuid_actions = `${uuid}-item-actions`;
                let actions_elem = document.getElementById(uuid_actions);
                let item_edit = `<a href="${edit_path}" title="Edit item" aria-label="edit-item"><i class="fa fa-edit pr-1"></i> </a>`;
                let trash = `<a href="${delete_path}" title="Delete item" aria-label="delete-item"><i class="fa fa-trash pr-1"></i></a>`;
                actions_elem.innerHTML = `
                    <div class="card-text text-sm-center">
                    ${view_items}&nbsp;
                    ${item_edit}&nbsp;
                    ${trash}
                    </div>`;

            } else if (response === undefined) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-danger"></i> You do not have permission to unpublish this record.</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            if (response !== undefined && response.status === 204) {
                scrollTo(0, 0);
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-warning"></i> Unable to unpublish grid item</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                }, 5000);
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
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
            display_error_message(elements.message, 'Invalid exhibit, grid, or item identifier');
            return false;
        }

        // Hide delete card and show deleting message
        if (elements.delete_card !== null) {
            elements.delete_card.style.display = 'none';
        }

        if (elements.message !== null) {
            elements.message.innerHTML = '<div class="alert alert-info" role="alert"><i class="fa fa-spinner fa-spin"></i> Deleting grid item...</div>';
        }

        try {

            const token = authModule.get_user_token();

            if (token === null || token.length === 0) {
                display_error_message(elements.message, 'Authentication required');
                restore_delete_card(elements);
                return false;
            }

            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.delete.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':grid_id', encodeURIComponent(grid_id))
                .replace(':item_id', encodeURIComponent(grid_item_id));

            const response = await httpModule.req({
                method: 'DELETE',
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

            if (response === null || response === undefined) {
                display_error_message(elements.message, 'No response received from server');
                restore_delete_card(elements);
                return false;
            }

            if (response.status === 204) {
                redirect_to_grid_items(exhibit_id, grid_id);
                return true;
            }

            if (response.status === 403) {
                display_error_message(elements.message, 'You do not have permission to delete this item.');
                restore_delete_card(elements);
                return false;
            }

            if (response.status === 404) {
                display_error_message(elements.message, 'Grid item not found.');
                restore_delete_card(elements);
                return false;
            }

            if (response.status === 500) {
                const error_text = response.data?.message ?? 'Internal server error';
                display_error_message(elements.message, error_text);
                restore_delete_card(elements);
                return false;
            }

            display_error_message(elements.message, `Unexpected server response: ${response.status}`);
            restore_delete_card(elements);
            return false;

        } catch (error) {
            const safe_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_error_message(elements.message, safe_message);
            restore_delete_card(elements);
            return false;
        }
    };

    /**
     * Restores the delete card visibility after an error
     * @param {Object} elements - Cached DOM elements
     */
    function restore_delete_card(elements) {

        if (elements.delete_card !== null) {
            elements.delete_card.style.display = '';
        }

        if (elements.message !== null) {
            elements.message.innerHTML = '';
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

    obj.delete_grid_item__ = async function () {

        try {

            document.querySelector('#delete-message').innerHTML = 'Deleting grid item...';
            document.querySelector('#delete-card').style.display = 'none';
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const grid_item_id = helperModule.get_parameter_by_name('item_id');
            const type = 'grid_item';
            const etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.delete.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':grid_id', grid_id);
            const endpoint = gtmp.replace(':item_id', grid_item_id);
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'DELETE',
                url: endpoint + '?type=' + type,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 204) {

                setTimeout(() => {
                    window.location.replace(`${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${grid_id}`);
                }, 900);
            } else if (response === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to delete this item.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

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
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to add item.</div>`;
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
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());