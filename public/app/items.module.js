/**
 * Copyright 2023 University of Denver
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const itemsModule = (function() {

    'use strict';

    // HTTP status constants
    const HTTP_STATUS = {
        OK: 200,
        NO_CONTENT: 204,
        FORBIDDEN: 403
    };

    /**
     * Get app path
     */
    const get_app_path = () => {

        try {

            const app_path = endpointsModule.get_app_path();

            if (!app_path) {
                console.error('App path not found in localStorage');
                return '';
            }

            return app_path;

        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return '';
        }
    };

    /**
     * Get exhibits endpoints
     */
    const get_exhibits_endpoints = () => {
        try {
            return endpointsModule.get_exhibits_endpoints();
        } catch (error) {
            console.error('Error getting exhibits endpoints:', error);
            return null;
        }
    };

    const APP_PATH = get_app_path();
    let obj = {};

    /**
     * Converts technical errors to user-friendly messages
     * @param {Error} error - The error object
     * @returns {string} - User-friendly error message
     */
    function get_user_friendly_error_message(error) {
        // Map of error patterns to user-friendly messages
        const error_patterns = {
            'network': 'Network error. Please check your connection and try again.',
            'timeout': 'Request timed out. Please try again.',
            'token': 'Session expired. Please log in again.',
            'auth': 'Authentication failed. Please log in again.',
            'permission': 'You do not have permission to access this resource.',
            'not found': 'The requested resource was not found.',
            'invalid': 'Invalid request. Please try again.',
            'uuid': 'Invalid identifier provided.'
        };

        if (!error || !error.message) {
            return 'An unexpected error occurred. Please try again.';
        }

        const error_message_lower = error.message.toLowerCase();

        // Check for known error patterns
        for (const [pattern, friendly_message] of Object.entries(error_patterns)) {
            if (error_message_lower.includes(pattern)) {
                return friendly_message;
            }
        }

        return 'An error occurred. Please try again.';
    }

    /**
     * Safe localStorage operations
     */
    const safe_set_items = (items) => {
        try {
            window.localStorage.removeItem('items');
            window.localStorage.setItem('items', JSON.stringify(items));
            return true;
        } catch (error) {
            console.error('Error saving items to localStorage:', error);
            return false;
        }
    };

    /**
     * Get items from API
     */
    obj.get_items = async function(uuid) {

        // Validate UUID
        if (!uuid || typeof uuid !== 'string') {
            domModule.set_alert('#message', 'danger', 'Invalid exhibit UUID');
            return false;
        }

        // Get endpoints
        const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.endpoint) {
            domModule.set_alert('#message', 'danger', 'Item records endpoint not configured');
            return false;
        }

        const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.item_records.endpoint, { exhibit_id: uuid });

        const response = await httpModule.api({
            method: 'GET',
            url: endpoint
        });

        // Handle 403 Forbidden
        if (response?.status === HTTP_STATUS.FORBIDDEN) {
            domModule.set_alert('#message', 'danger', 'You do not have permission to view items for this exhibit');
            return false;
        }

        // Validate response
        if (response?.status === HTTP_STATUS.OK && response.data?.data) {
            // Save to localStorage
            safe_set_items(response.data.data);
            return response.data.data;
        }

        // Handle undefined response (network/server error)
        if (!response) {
            domModule.set_alert('#message', 'danger', 'Unable to retrieve items. Please check your connection and try again.');
            return false;
        }

        // Handle other error responses
        domModule.set_alert('#message', 'danger', 'Failed to retrieve items. Please try again.');
        return false;
    };

    /**
     * Display items list
     */
    obj.display_items = async function() {

        try {
            // Get exhibit ID
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (!exhibit_id) {
                domModule.set_alert('#message', 'warning', 'No exhibit ID provided');
                return false;
            }

            // Get items
            const items = await obj.get_items(exhibit_id);

            if (items === false) {
                const item_card = document.querySelector('#item-card');
                if (item_card) {
                    item_card.textContent = '';
                }
                return false;
            }

            // Handle empty exhibit
            if (!items || items.length === 0) {
                const card = document.querySelector('.card');
                if (card) {
                    card.textContent = '';
                }

                const message_element = document.querySelector('#message');
                const info_div = document.createElement('div');
                info_div.className = 'alert alert-info';
                info_div.setAttribute('role', 'alert');

                const span = document.createElement('span');
                span.id = 'exhibit-title';
                info_div.appendChild(span);

                info_div.appendChild(document.createTextNode(' exhibit is empty.'));

                message_element.textContent = '';
                message_element.appendChild(info_div);

                await exhibitsModule.set_exhibit_title(exhibit_id);
                return false;
            }

            // Build item list HTML
            let item_data = '';

            for (let i = 0; i < items.length; i++) {
                const type = items[i].type;
                const record = items[i];

                switch(type) {
                    case 'heading':
                    case 'subheading':
                        item_data += await itemsListDisplayModule.display_heading_items(record);
                        break;
                    case 'item':
                        item_data += await itemsListDisplayModule.display_standard_items(record);
                        break;
                    case 'grid':
                        item_data += await itemsListDisplayModule.display_grids(record);
                        break;
                    case 'vertical_timeline':
                        item_data += await itemsListDisplayModule.display_timelines(record);
                        break;
                    default:
                        console.warn(`Unknown item type: ${type}`);
                }
            }

            // Display items
            const item_data_element = document.querySelector('#item-data');
            if (item_data_element) {
                item_data_element.innerHTML = item_data;
            }

            // Initialize action dropdown handlers
            if (typeof itemsListDisplayModule !== 'undefined' && typeof itemsListDisplayModule.setup_item_action_handlers === 'function') {
                itemsListDisplayModule.setup_item_action_handlers();
            }

            // Destroy existing DataTable instance if it exists
            const items_table = document.querySelector('#items');
            if (items_table && DataTable.isDataTable('#items')) {
                const existing_table = new DataTable('#items');
                existing_table.destroy();
            }

            // Initialize DataTable with row reordering.
            const ITEM_LIST = new DataTable('#items', {
                paging: false,
                rowReorder: {
                    excludedChildren: 'a, .reorder-btn, .reorder-btn *'
                },
                columnDefs: [
                    { orderable: false, searchable: false, targets: [2, 4] } // Child Items, Actions
                ],
                language: {
                    emptyTable: 'No items found',
                    zeroRecords: 'No matching items found',
                    info: 'Showing _START_ - _END_ of _TOTAL_ results',
                    infoEmpty: 'No items available',
                    infoFiltered: '(filtered from _MAX_ total items)',
                    search: 'Search items:'
                }
            });

            // Handle row reordering (drag-and-drop)
            ITEM_LIST.on('row-reordered', async (e, reordered_items) => {
                await reorderModule.reorder_items(e, reordered_items);
            });

            // Wire keyboard reorder buttons (Move up / Move down).
            if (typeof reorderModule.attach_keyboard_reorder_handlers === 'function') {
                reorderModule.attach_keyboard_reorder_handlers('#items');
            }
            ITEM_LIST.on('draw', () => {
                if (typeof reorderModule.update_reorder_button_states === 'function') {
                    reorderModule.update_reorder_button_states('#items');
                }
            });

            const items_tbody = document.querySelector('#items tbody');

            if (items_tbody) {
                // Remove existing listener if it exists
                if (items_tbody._publishSuppressHandler) {
                    items_tbody.removeEventListener('click', items_tbody._publishSuppressHandler);
                }

                // Create and store the event handler
                const publishSuppressHandler = async (event) => {
                    // Find the clicked button (might be the icon or text inside the link)
                    const target = event.target.closest('.publish-item, .suppress-item');

                    if (!target) {
                        return;
                    }

                    event.preventDefault();

                    const uuid = target.getAttribute('id');

                    if (!uuid) {
                        console.warn('Publish/suppress button missing ID');
                        return;
                    }

                    // Determine which action to take based on class
                    if (target.classList.contains('publish-item')) {
                        await publish_item(uuid);
                    } else if (target.classList.contains('suppress-item')) {
                        await suppress_item(uuid);
                    }
                };

                // Store reference for cleanup
                items_tbody._publishSuppressHandler = publishSuppressHandler;

                // Add the event listener
                items_tbody.addEventListener('click', publishSuppressHandler);
            }

            // Handle scroll to item from URL parameters
            const id = helperModule.get_parameter_by_name('id');
            const type = helperModule.get_parameter_by_name('type');

            if (id && type) {
                const clean_url = `${APP_PATH}/exhibits?exhibit_id=${encodeURIComponent(exhibit_id)}`;
                window.history.replaceState({}, '', clean_url);
                window.history.pushState({}, '', clean_url);
                window.location.href = `#${id}_${type}`;
            }

            return true;

        } catch (error) {
            console.error('Error displaying items:', error);
            domModule.set_alert('#message', 'danger', get_user_friendly_error_message(error));
            return false;
        }
    };

    /**
     * Delete item
     */
    obj.delete_item = async function() {

        // Update status message
        const delete_message = document.querySelector('#delete-message');
        if (delete_message) {
            delete_message.textContent = 'Deleting item...';
        }

        // Get parameters
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const item_id = helperModule.get_parameter_by_name('item_id');
        const type = helperModule.get_parameter_by_name('type');

        if (!exhibit_id || !item_id || !type) {
            domModule.set_alert('#message', 'danger', 'Missing required parameters for delete operation');
            return false;
        }

        // Get endpoints
        const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.delete?.endpoint) {
            domModule.set_alert('#message', 'danger', 'Delete endpoint not configured');
            return false;
        }

        const endpoint = endpointsModule.build(
            EXHIBITS_ENDPOINTS.exhibits.item_records.delete.endpoint,
            { exhibit_id: exhibit_id, item_id: item_id }
        );

        const url_with_type = `${endpoint}?type=${encodeURIComponent(type)}`;

        const response = await httpModule.api({
            method: 'DELETE',
            url: url_with_type
        });

        // Handle 403 Forbidden
        if (response?.status === HTTP_STATUS.FORBIDDEN) {
            window.scrollTo({ top: 0, behavior: 'smooth' });

            const delete_card = document.querySelector('#delete-card');
            if (delete_card) {
                delete_card.textContent = '';
            }

            domModule.set_alert('#message', 'danger', 'You do not have permission to delete this record');
            return false;
        }

        // Handle success
        if (response?.status === HTTP_STATUS.NO_CONTENT) {
            // Success - redirect after delay
            setTimeout(() => {
                const redirect_url = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
                window.location.replace(redirect_url);
            }, 900);

            return true;
        }

        if (response?.status === 429) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message = response.data.message;
            domModule.set_alert('#message', 'warning', message);
            return false;
        }

        // Handle undefined response (network/server error)
        if (!response) {
            window.scrollTo({ top: 0, behavior: 'smooth' });

            const delete_card = document.querySelector('#delete-card');
            if (delete_card) {
                delete_card.textContent = '';
            }

            domModule.set_alert('#message', 'danger', 'Unable to delete item. Please check your connection and try again.');
            return false;
        }

        // Handle other error responses
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const delete_card = document.querySelector('#delete-card');
        if (delete_card) {
            delete_card.textContent = '';
        }

        domModule.set_alert('#message', 'danger', 'Failed to delete item. Please try again.');
        return false;
    };

    /*
     * Maps the list row's classification to the `type` the publish /
     * suppress endpoints whitelist (item | heading | grid | timeline).
     */
    const SERVER_ITEM_TYPES = {
        standard: 'item',
        heading: 'heading',
        grid: 'grid',
        timeline: 'timeline'
    };

    function get_server_item_type(uuid) {
        const row = itemsListDisplayModule.get_row_type(uuid);
        return row ? (SERVER_ITEM_TYPES[row.row_type] || null) : null;
    }

    /**
     * Publish item
     */
    async function publish_item(uuid) {

        // Validate UUID
        if (!uuid) {
            domModule.set_alert('#message', 'danger', 'Invalid item UUID');
            return false;
        }

        // Get parameters
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            domModule.set_alert('#message', 'danger', 'Exhibit ID not found');
            return false;
        }

        // Server-side record type for the publish/suppress endpoint
        const item_type = get_server_item_type(uuid);

        if (!item_type) {
            domModule.set_alert('#message', 'danger', 'Could not determine item type');
            return false;
        }

        // Get endpoints
        const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.item_publish?.post?.endpoint) {
            domModule.set_alert('#message', 'danger', 'Publish endpoint not configured');
            return false;
        }

        const endpoint = endpointsModule.build(
            EXHIBITS_ENDPOINTS.exhibits.item_records.item_publish.post.endpoint,
            { exhibit_id: exhibit_id, item_id: uuid }
        );

        const url_with_type = `${endpoint}?type=${encodeURIComponent(item_type)}`;

        const response = await httpModule.api({
            method: 'POST',
            url: url_with_type
        });

        // Handle 403 Forbidden
        if (response?.status === HTTP_STATUS.FORBIDDEN) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            domModule.set_alert('#message', 'danger', 'You do not have permission to publish this record');
            return false;
        }

        // Handle success
        if (response?.status === HTTP_STATUS.OK) {
            // Update UI to show published state
            update_item_status_to_published(uuid, exhibit_id);
            return true;
        }

        // Handle 422 Unprocessable Entity - publish rejected by a server-side
        // rule (exhibit not published, grid below its minimum item count, ...).
        // Surface the server's message: it names the rule and the remedy.
        if (response?.status === 422) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message_element = document.querySelector('#message');
            const server_message = response.data?.message ?? 'Cannot publish item. Exhibit must be published.';
            domModule.set_alert(message_element, 'warning', server_message);

            // Move focus to the explanation so keyboard/screen-reader users land on it
            if (message_element) {
                message_element.setAttribute('tabindex', '-1');
                message_element.focus();
            }

            return false;
        }

        if (response?.status === 429) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message = response.data.message;
            domModule.set_alert('#message', 'warning', message);
            return false;
        }

        // Handle undefined response (network/server error)
        if (!response) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            domModule.set_alert('#message', 'danger', 'Unable to publish item. Please check your connection and try again.');
            return false;
        }

        // Handle other error responses
        window.scrollTo({ top: 0, behavior: 'smooth' });
        domModule.set_alert('#message', 'danger', 'Failed to publish item. Please try again.');
        return false;
    }

    /**
     * Suppress (unpublish) item
     */
    async function suppress_item(uuid) {

        // Validate UUID
        if (!uuid) {
            domModule.set_alert('#message', 'danger', 'Invalid item UUID');
            return false;
        }

        // Get parameters
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            domModule.set_alert('#message', 'danger', 'Exhibit ID not found');
            return false;
        }

        // Server-side record type for the publish/suppress endpoint
        const item_type = get_server_item_type(uuid);

        if (!item_type) {
            domModule.set_alert('#message', 'danger', 'Could not determine item type');
            return false;
        }

        // Get endpoints
        const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.item_suppress?.post?.endpoint) {
            domModule.set_alert('#message', 'danger', 'Suppress endpoint not configured');
            return false;
        }

        const endpoint = endpointsModule.build(
            EXHIBITS_ENDPOINTS.exhibits.item_records.item_suppress.post.endpoint,
            { exhibit_id: exhibit_id, item_id: uuid }
        );

        const url_with_type = `${endpoint}?type=${encodeURIComponent(item_type)}`;

        const response = await httpModule.api({
            method: 'POST',
            url: url_with_type
        });

        // Handle 403 Forbidden
        if (response?.status === HTTP_STATUS.FORBIDDEN) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            domModule.set_alert('#message', 'danger', 'You do not have permission to unpublish this record');
            return false;
        }

        // Handle success
        if (response?.status === HTTP_STATUS.OK) {
            // Update UI to show unpublished state
            update_item_status_to_unpublished(uuid, exhibit_id);
            return true;
        }

        if (response?.status === 429) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message = response.data.message;
            domModule.set_alert('#message', 'warning', message);
            return false;
        }

        // Handle undefined response (network/server error)
        if (!response) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            domModule.set_alert('#message', 'danger', 'Unable to unpublish item. Please check your connection and try again.');
            return false;
        }

        // Handle other error responses
        window.scrollTo({ top: 0, behavior: 'smooth' });
        domModule.set_alert('#message', 'danger', 'Failed to unpublish item. Please try again.');
        return false;
    }

    /**
     * Update UI to show published status
     */
    function update_item_status_to_published(uuid, exhibit_id) {

        const status_element = document.getElementById(uuid);

        if (!status_element) {
            console.error(`Status element not found for UUID: ${uuid}`);
            return;
        }

        // Update button classes
        status_element.classList.remove('publish-item');
        status_element.classList.add('suppress-item');

        // Create new status content
        const span = document.createElement('span');
        span.id = `suppress-${uuid}`;
        span.setAttribute('title', 'Published - click to unpublish');

        const icon = document.createElement('i');
        icon.className = 'fa fa-cloud';
        icon.style.color = 'green';
        icon.setAttribute('aria-hidden', 'true');
        span.appendChild(icon);

        span.appendChild(document.createElement('br'));

        const published_text = document.createElement('small');
        published_text.textContent = 'Published';
        span.appendChild(published_text);

        status_element.textContent = '';
        status_element.appendChild(span);

        // Update action buttons immediately
        itemsListDisplayModule.update_actions_cell(uuid, { exhibit_id: exhibit_id, is_published: true });
    }

    /**
     * Update UI to show unpublished status
     */
    function update_item_status_to_unpublished(uuid, exhibit_id) {

        const status_element = document.getElementById(uuid);

        if (!status_element) {
            console.error(`Status element not found for UUID: ${uuid}`);
            return;
        }

        // Update button classes
        status_element.classList.remove('suppress-item');
        status_element.classList.add('publish-item');

        // Create new status content
        const span = document.createElement('span');
        span.id = `publish-${uuid}`;
        span.setAttribute('title', 'Unpublished - click to publish');

        const icon = document.createElement('i');
        icon.className = 'fa fa-cloud-upload';
        icon.style.color = 'darkred';
        icon.setAttribute('aria-hidden', 'true');
        span.appendChild(icon);

        span.appendChild(document.createElement('br'));

        const unpublished_text = document.createElement('small');
        unpublished_text.textContent = 'Unpublished';
        span.appendChild(unpublished_text);

        status_element.textContent = '';
        status_element.appendChild(span);

        // Update action buttons immediately
        itemsListDisplayModule.update_actions_cell(uuid, { exhibit_id: exhibit_id, is_published: false });
    }

    /**
     * Initialize module
     */
    obj.init = async function() {

        try {
            // Get parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const status = helperModule.get_parameter_by_name('status');

            // Handle 403 status from URL
            if (status === '403') {
                domModule.set_alert('#message', 'danger', 'You do not have permission to add item.');

                // Clean up URL
                setTimeout(() => {
                    const clean_url = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
                    window.history.replaceState({ page: 'items' }, '', clean_url);
                }, 0);
            }

            // Check authentication
            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            exhibitsModule.set_exhibit_title(exhibit_id);
            await obj.display_items();
            helperModule.show_form();

            console.debug('Items module initialized');

        } catch (error) {
            console.error('Error initializing items module:', error);
            domModule.set_alert('#message', 'danger', get_user_friendly_error_message(error));
        }
    };

    return obj;

}());
