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

            const app_path = window.localStorage.getItem('exhibits_app_path');

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
     * Get exhibits endpoints safely
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
     * Display message
     */
    const display_message = (element, type, message) => {
        if (!element) {
            console.error('Message element not found:', message);
            return;
        }

        const valid_types = ['info', 'success', 'danger', 'warning'];
        const alert_type = valid_types.includes(type) ? type : 'danger';

        const alert_div = document.createElement('div');
        alert_div.className = `alert alert-${alert_type}`;
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = get_icon_class(alert_type);
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);

        const text = document.createTextNode(` ${message}`);
        alert_div.appendChild(text);

        element.textContent = '';
        element.appendChild(alert_div);
    };

    /**
     * Get icon class for alert type
     */
    const get_icon_class = (alert_type) => {
        const icon_map = {
            'info': 'fa fa-info',
            'success': 'fa fa-check',
            'danger': 'fa fa-exclamation',
            'warning': 'fa fa-exclamation-triangle'
        };
        return icon_map[alert_type] || 'fa fa-exclamation';
    };

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
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Invalid exhibit UUID');
            return false;
        }

        // Get endpoints
        const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.endpoint) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Item records endpoint not configured');
            return false;
        }

        // Validate authentication
        const token = authModule.get_user_token();

        if (!token || token === false) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Session expired. Please log in again.');
            return false;
        }

        // Construct endpoint with URL encoding
        const endpoint = EXHIBITS_ENDPOINTS.exhibits.item_records.endpoint
            .replace(':exhibit_id', encodeURIComponent(uuid));

        // Make API request
        const response = await httpModule.req({
            method: 'GET',
            url: endpoint,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            timeout: 30000,
            validateStatus: (status) => status >= 200 && status < 600
        });

        // Handle 403 Forbidden
        if (response?.status === HTTP_STATUS.FORBIDDEN) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'You do not have permission to view items for this exhibit');
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
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Unable to retrieve items. Please check your connection and try again.');
            return false;
        }

        // Handle other error responses
        const message_element = document.querySelector('#message');
        display_message(message_element, 'danger', 'Failed to retrieve items. Please try again.');
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
                const message_element = document.querySelector('#message');
                display_message(message_element, 'warning', 'No exhibit ID provided');
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

            // Destroy existing DataTable instance if it exists
            const items_table = document.querySelector('#items');
            if (items_table && DataTable.isDataTable('#items')) {
                const existing_table = new DataTable('#items');
                existing_table.destroy();
            }

            // Initialize DataTable with row reordering
            const ITEM_LIST = new DataTable('#items', {
                paging: false,
                rowReorder: true
            });

            // Handle row reordering
            ITEM_LIST.on('row-reordered', async (e, reordered_items) => {
                await helperModule.reorder_items(e, reordered_items);
            });

            // Use event delegation for publish/suppress buttons (vanilla JS)
            // This is more efficient than binding individual event listeners to each button
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
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', get_user_friendly_error_message(error));
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
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Missing required parameters for delete operation');
            return false;
        }

        // Get endpoints
        const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.delete?.endpoint) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Delete endpoint not configured');
            return false;
        }

        // Validate authentication
        const token = authModule.get_user_token();

        if (!token || token === false) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Session expired. Please log in again.');
            return false;
        }

        // Construct endpoint
        const endpoint = EXHIBITS_ENDPOINTS.exhibits.item_records.delete.endpoint
            .replace(':exhibit_id', encodeURIComponent(exhibit_id))
            .replace(':item_id', encodeURIComponent(item_id));

        const url_with_type = `${endpoint}?type=${encodeURIComponent(type)}`;

        // Make delete request
        const response = await httpModule.req({
            method: 'DELETE',
            url: url_with_type,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            timeout: 30000,
            validateStatus: (status) => status >= 200 && status < 600
        });

        // Handle 403 Forbidden
        if (response?.status === HTTP_STATUS.FORBIDDEN) {
            window.scrollTo({ top: 0, behavior: 'smooth' });

            const delete_card = document.querySelector('#delete-card');
            if (delete_card) {
                delete_card.textContent = '';
            }

            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'You do not have permission to delete this record');
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
            const message_element = document.querySelector('#message');
            display_message(message_element, 'warning', message);
            return false;
        }

        // Handle undefined response (network/server error)
        if (!response) {
            window.scrollTo({ top: 0, behavior: 'smooth' });

            const delete_card = document.querySelector('#delete-card');
            if (delete_card) {
                delete_card.textContent = '';
            }

            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Unable to delete item. Please check your connection and try again.');
            return false;
        }

        // Handle other error responses
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const delete_card = document.querySelector('#delete-card');
        if (delete_card) {
            delete_card.textContent = '';
        }

        const message_element = document.querySelector('#message');
        display_message(message_element, 'danger', 'Failed to delete item. Please try again.');
        return false;
    };

    /**
     * Publish item
     */
    async function publish_item(uuid) {

        // Validate UUID
        if (!uuid) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Invalid item UUID');
            return false;
        }

        // Get parameters
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Exhibit ID not found');
            return false;
        }

        // Find item type from table row ID
        const table_rows = document.getElementsByTagName('tr');
        let item_type = null;

        for (let i = 0; i < table_rows.length; i++) {
            if (table_rows[i].id && table_rows[i].id.indexOf(uuid) !== -1) {
                const id_parts = table_rows[i].id.split('_');
                item_type = id_parts[id_parts.length - 1];
                break;
            }
        }

        if (!item_type) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Could not determine item type');
            return false;
        }

        // Get endpoints
        const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.item_publish?.post?.endpoint) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Publish endpoint not configured');
            return false;
        }

        // Construct endpoint
        const endpoint = EXHIBITS_ENDPOINTS.exhibits.item_records.item_publish.post.endpoint
            .replace(':exhibit_id', encodeURIComponent(exhibit_id))
            .replace(':item_id', encodeURIComponent(uuid));

        const url_with_type = `${endpoint}?type=${encodeURIComponent(item_type)}`;

        // Validate authentication
        const token = authModule.get_user_token();

        if (!token || token === false) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Session expired. Please log in again.');
            return false;
        }

        // Make publish request
        const response = await httpModule.req({
            method: 'POST',
            url: url_with_type,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            timeout: 30000,
            validateStatus: (status) => status >= 200 && status < 600
        });

        // Handle 403 Forbidden
        if (response?.status === HTTP_STATUS.FORBIDDEN) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'You do not have permission to publish this record');
            return false;
        }

        // Handle success
        if (response?.status === HTTP_STATUS.OK) {
            // Update UI to show published state
            update_item_status_to_published(uuid, item_type, exhibit_id);
            return true;
        }

        // Handle 422 Unprocessable Entity - exhibit must contain at least one item
        if (response?.status === 422) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message_element = document.querySelector('#message');
            display_message(message_element, 'warning', 'Cannot publish item. Exhibit must be published.');
            return false;
        }

        if (response?.status === 429) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message = response.data.message;
            const message_element = document.querySelector('#message');
            display_message(message_element, 'warning', message);
            return false;
        }

        // Handle undefined response (network/server error)
        if (!response) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Unable to publish item. Please check your connection and try again.');
            return false;
        }

        // Handle other error responses
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const message_element = document.querySelector('#message');
        display_message(message_element, 'danger', 'Failed to publish item. Please try again.');
        return false;
    }

    /**
     * Suppress (unpublish) item
     */
    async function suppress_item(uuid) {

        // Validate UUID
        if (!uuid) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Invalid item UUID');
            return false;
        }

        // Get parameters
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Exhibit ID not found');
            return false;
        }

        // Find item type from table row ID
        const table_rows = document.getElementsByTagName('tr');
        let item_type = null;

        for (let i = 0; i < table_rows.length; i++) {
            if (table_rows[i].id && table_rows[i].id.indexOf(uuid) !== -1) {
                const id_parts = table_rows[i].id.split('_');
                item_type = id_parts[id_parts.length - 1];
                break;
            }
        }

        if (!item_type) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Could not determine item type');
            return false;
        }

        // Get endpoints
        const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.item_suppress?.post?.endpoint) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Suppress endpoint not configured');
            return false;
        }

        // Construct endpoint
        const endpoint = EXHIBITS_ENDPOINTS.exhibits.item_records.item_suppress.post.endpoint
            .replace(':exhibit_id', encodeURIComponent(exhibit_id))
            .replace(':item_id', encodeURIComponent(uuid));

        const url_with_type = `${endpoint}?type=${encodeURIComponent(item_type)}`;

        // Validate authentication
        const token = authModule.get_user_token();

        if (!token || token === false) {
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Session expired. Please log in again.');
            return false;
        }

        // Make suppress request
        const response = await httpModule.req({
            method: 'POST',
            url: url_with_type,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            timeout: 30000,
            validateStatus: (status) => status >= 200 && status < 600
        });

        // Handle 403 Forbidden
        if (response?.status === HTTP_STATUS.FORBIDDEN) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'You do not have permission to unpublish this record');
            return false;
        }

        // Handle success
        if (response?.status === HTTP_STATUS.OK) {
            // Update UI to show unpublished state
            update_item_status_to_unpublished(uuid, item_type, exhibit_id);
            return true;
        }

        if (response?.status === 429) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message = response.data.message;
            const message_element = document.querySelector('#message');
            display_message(message_element, 'warning', message);
            return false;
        }

        // Handle undefined response (network/server error)
        if (!response) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', 'Unable to unpublish item. Please check your connection and try again.');
            return false;
        }

        // Handle other error responses
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const message_element = document.querySelector('#message');
        display_message(message_element, 'danger', 'Failed to unpublish item. Please try again.');
        return false;
    }

    /**
     * Update UI to show published status
     */
    function update_item_status_to_published(uuid, item_type, exhibit_id) {

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
        span.appendChild(document.createTextNode('Published'));

        status_element.textContent = '';
        status_element.appendChild(span);

        // Update action buttons immediately
        update_action_buttons(uuid, item_type, exhibit_id, true);
    }

    /**
     * Update UI to show unpublished status
     */
    function update_item_status_to_unpublished(uuid, item_type, exhibit_id) {

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
        span.appendChild(document.createTextNode('Unpublished'));

        status_element.textContent = '';
        status_element.appendChild(span);

        // Update action buttons immediately
        update_action_buttons(uuid, item_type, exhibit_id, false);
    }

    /**
     * Update action buttons based on publication status
     */
    function update_action_buttons(uuid, item_type, exhibit_id, is_published) {

        const actions_element = document.getElementById(`${uuid}-item-actions`);

        if (!actions_element) {
            return;
        }

        // Create actions container
        const actions_div = document.createElement('div');
        actions_div.className = 'card-text text-sm-center';

        // Determine paths based on item type
        let edit_path = '';
        let delete_path = '';
        let view_items_link = null;
        let item_category = 'item';

        const encoded_exhibit_id = encodeURIComponent(exhibit_id);
        const encoded_uuid = encodeURIComponent(uuid);

        switch(item_type) {
            case 'heading':
                item_category = 'heading';
                if (is_published) {
                    edit_path = `${APP_PATH}/items/heading/details?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                } else {
                    edit_path = `${APP_PATH}/items/heading/edit?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                }
                break;

            case 'text':
                if (is_published) {
                    edit_path = `${APP_PATH}/items/standard/text/details?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                } else {
                    edit_path = `${APP_PATH}/items/standard/text/edit?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                }
                break;

            case 'grid':
                item_category = 'grid';
                if (is_published) {
                    edit_path = `${APP_PATH}/items/grid/details?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                } else {
                    edit_path = `${APP_PATH}/items/grid/edit?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                }

                // Add view items link for grids
                const view_grid_url = `${APP_PATH}/items/grid/items?exhibit_id=${encoded_exhibit_id}&grid_id=${encoded_uuid}`;
                view_items_link = document.createElement('a');
                view_items_link.href = view_grid_url;
                view_items_link.setAttribute('title', 'View grid items');
                view_items_link.setAttribute('aria-label', 'view-grid-items');

                const grid_icon = document.createElement('i');
                grid_icon.className = 'fa fa-list pr-1';
                grid_icon.setAttribute('aria-hidden', 'true');
                view_items_link.appendChild(grid_icon);
                break;

            case 'timeline':
                item_category = 'timeline';
                if (is_published) {
                    edit_path = `${APP_PATH}/items/vertical-timeline/details?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                } else {
                    edit_path = `${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                }

                // Add view items link for timelines
                const view_timeline_url = `${APP_PATH}/items/timeline/items?exhibit_id=${encoded_exhibit_id}&timeline_id=${encoded_uuid}`;
                view_items_link = document.createElement('a');
                view_items_link.href = view_timeline_url;
                view_items_link.setAttribute('title', 'View timeline items');
                view_items_link.setAttribute('aria-label', 'view-timeline-items');

                const timeline_icon = document.createElement('i');
                timeline_icon.className = 'fa fa-list pr-1';
                timeline_icon.setAttribute('aria-hidden', 'true');
                view_items_link.appendChild(timeline_icon);
                break;

            default:
                // Image and other media types
                if (is_published) {
                    edit_path = `${APP_PATH}/items/standard/media/details?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                } else {
                    edit_path = `${APP_PATH}/items/standard/media/edit?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}`;
                }
        }

        delete_path = `${APP_PATH}/items/delete?exhibit_id=${encoded_exhibit_id}&item_id=${encoded_uuid}&type=${encodeURIComponent(item_category)}`;

        // Add view items link if exists
        if (view_items_link) {
            actions_div.appendChild(view_items_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));
        }

        // Add edit/view link
        const edit_link = document.createElement('a');
        edit_link.href = edit_path;
        edit_link.setAttribute('title', is_published ? 'View details' : 'Edit item');
        edit_link.setAttribute('aria-label', is_published ? 'view-item-details' : 'edit-item');

        const edit_icon = document.createElement('i');
        edit_icon.className = is_published ? 'fa fa-folder-open pr-1' : 'fa fa-edit pr-1';
        edit_icon.setAttribute('aria-hidden', 'true');
        edit_link.appendChild(edit_icon);

        actions_div.appendChild(edit_link);
        actions_div.appendChild(document.createTextNode('\u00A0'));

        // Add delete button (only if unpublished)
        if (is_published) {
            const delete_icon = document.createElement('i');
            delete_icon.className = 'fa fa-trash pr-1';
            delete_icon.setAttribute('title', 'Can only delete if unpublished');
            delete_icon.setAttribute('aria-label', 'delete-disabled');
            delete_icon.style.color = '#d3d3d3';
            delete_icon.setAttribute('aria-hidden', 'true');
            actions_div.appendChild(delete_icon);
        } else {
            const delete_link = document.createElement('a');
            delete_link.href = delete_path;
            delete_link.setAttribute('title', 'Delete item');
            delete_link.setAttribute('aria-label', 'delete-item');

            const delete_icon = document.createElement('i');
            delete_icon.className = 'fa fa-trash pr-1';
            delete_icon.setAttribute('aria-hidden', 'true');
            delete_link.appendChild(delete_icon);

            actions_div.appendChild(delete_link);
        }

        // Replace content
        actions_element.textContent = '';
        actions_element.appendChild(actions_div);
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
                const message_element = document.querySelector('#message');
                display_message(message_element, 'danger', 'You do not have permission to add item.');

                // Clean up URL
                setTimeout(() => {
                    const clean_url = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
                    window.history.replaceState({ page: 'items' }, '', clean_url);
                }, 0);
            }

            // Check authentication
            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            // Initialize page
            exhibitsModule.set_exhibit_title(exhibit_id);
            await obj.display_items();
            helperModule.show_form();
            navModule.set_preview_link();
            navModule.set_item_nav_menu_links();
            navModule.set_logout_link();

            console.log('Items module initialized');

        } catch (error) {
            console.error('Error initializing items module:', error);
            const message_element = document.querySelector('#message');
            display_message(message_element, 'danger', get_user_friendly_error_message(error));
        }
    };

    return obj;

}());