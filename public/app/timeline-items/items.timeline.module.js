/**

 Copyright 2024 University of Denver

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

const itemsTimelineModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Get timeline items from API
     *
     * @param {string} exhibit_id - The exhibit ID
     * @param {string} timeline_id - The timeline ID
     * @returns {Promise<Array|null>} Array of timeline items on success, null on error
     */
    async function get_timeline_items(exhibit_id, timeline_id) {

        try {
            // Validate input parameters
            if (!exhibit_id) {
                throw new Error('Exhibit ID is required');
            }

            if (!timeline_id) {
                throw new Error('Timeline ID is required');
            }

            // Validate parameter types
            if (typeof exhibit_id !== 'string' && typeof exhibit_id !== 'number') {
                throw new Error('Exhibit ID must be a string or number');
            }

            if (typeof timeline_id !== 'string' && typeof timeline_id !== 'number') {
                throw new Error('Timeline ID must be a string or number');
            }

            // Get endpoints configuration
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            // Validate endpoint configuration exists
            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_item_records?.get?.endpoint) {
                throw new Error('Timeline item records endpoint not configured');
            }

            // Get authentication token
            const token = authModule.get_user_token();

            // Validate token
            if (!token || token === false) {
                console.error('No authentication token available');
                authModule.redirect_to_auth();
                return null;
            }

            // Build endpoint URL with proper encoding
            const endpoint = build_timeline_endpoint(
                EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.get.endpoint,
                exhibit_id,
                timeline_id
            );

            // Make API request with timeout
            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response exists
            if (!response) {
                throw new Error('No response received from server');
            }

            // Validate status code
            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            // Validate response structure
            if (!response.data || typeof response.data !== 'object') {
                throw new Error('Invalid response data structure');
            }

            // Check if data exists
            if (!response.data.data) {
                console.warn('Response data.data is missing or empty');
                return [];
            }

            // Validate data is an array
            if (!Array.isArray(response.data.data)) {
                console.error('Response data.data is not an array');
                return [];
            }

            // Log success
            console.debug(`Retrieved ${response.data.data.length} timeline items`);

            return response.data.data;

        } catch (error) {
            console.error('Error getting timeline items:', error);

            // Display safe error message
            const message_element = document.querySelector('#message');
            if (message_element) {
                display_error_message(
                    message_element,
                    error.message || 'Unable to retrieve timeline items'
                );
            }

            return null;
        }
    }

    /**
     * Build timeline endpoint URL with proper parameter encoding
     *
     * @param {string} endpoint_template - Endpoint template with placeholders
     * @param {string|number} exhibit_id - Exhibit ID
     * @param {string|number} timeline_id - Timeline ID
     * @returns {string} Complete endpoint URL
     */
    function build_timeline_endpoint(endpoint_template, exhibit_id, timeline_id) {
        // Convert IDs to strings
        const exhibit_id_str = String(exhibit_id);
        const timeline_id_str = String(timeline_id);

        // Replace placeholders with encoded values
        let endpoint = endpoint_template
            .replace(':exhibit_id', encodeURIComponent(exhibit_id_str))
            .replace(':timeline_id', encodeURIComponent(timeline_id_str));

        return endpoint;
    }

    /**
     * Display error message
     *
     * @param {HTMLElement} element - The message container element
     * @param {string} message - The message text
     */
    function display_error_message(element, message) {

        if (!element) {
            console.error('Message element not found');
            return;
        }

        // Clear existing content safely
        element.textContent = '';

        // Create alert container
        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        // Create icon
        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation';
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);

        // Add message text safely
        const text = document.createTextNode(` ${message}`);
        alert_div.appendChild(text);

        // Append to container
        element.appendChild(alert_div);
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
     * Clears the loading message
     * @param {Element|null} message_element - Message container element
     */
    function clear_loading_message(message_element) {

        if (message_element !== null) {
            message_element.innerHTML = '';
        }
    }

    /**
     * Shows loading state for timeline items
     * @param {Object} elements - Cached DOM elements
     */
    function show_loading_state(elements) {

        if (elements.timeline_items_table !== null) {
            elements.timeline_items_table.style.visibility = 'hidden';
        }

        if (elements.card !== null) {
            elements.card.style.minHeight = '200px';
        }

        if (elements.message !== null) {
            elements.message.innerHTML = '<div class="alert alert-info" role="alert"><i class="fa fa-spinner fa-spin"></i> Loading timeline items...</div>';
        }
    }

    /**
     * Hides loading state and restores table visibility
     * @param {Object} elements - Cached DOM elements
     */
    function hide_loading_state(elements) {

        if (elements.timeline_items_table !== null) {
            elements.timeline_items_table.style.visibility = 'visible';
        }

        if (elements.card !== null) {
            elements.card.style.minHeight = '';
        }
    }

    /**
     * Handles empty card state when items fetch fails
     * @param {Object} elements - Cached DOM elements
     */
    function handle_empty_card(elements) {

        if (elements.card !== null) {
            elements.card.innerHTML = '';
        }

        if (elements.timeline_items_table !== null) {
            elements.timeline_items_table.style.visibility = 'visible';
        }
    }

    /**
     * Handles empty timeline state when no items exist
     * @param {Object} elements - Cached DOM elements
     */
    function handle_empty_timeline(elements) {

        if (elements.card !== null) {
            elements.card.remove();
        }

        if (elements.title_heading !== null) {
            elements.title_heading.style.display = 'none';
        }

        if (elements.message !== null) {
            elements.message.innerHTML = '<div class="alert alert-info" role="alert">Timeline is empty.</div>';
        }
    }

    /**
     * Displays timeline items for the current exhibit and timeline
     * @returns {Promise<boolean>} Success status
     */
    obj.display_timeline_items = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');

        // Cache DOM elements
        const elements = {
            message: document.querySelector('#message'),
            timeline_items_table: document.querySelector('#timeline-items'),
            card: document.querySelector('#item-card'),
            timeline_item_list: document.querySelector('#timeline-item-list'),
            title_heading: document.querySelector('#exhibit-title')?.parentElement ?? null
        };

        // Hide card and title immediately to prevent flash of content
        if (elements.card !== null) {
            elements.card.style.visibility = 'hidden';
        }

        if (elements.title_heading !== null) {
            elements.title_heading.style.visibility = 'hidden';
        }

        // Validate required parameters
        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(timeline_id)) {
            display_error_message(elements.message, 'Invalid exhibit or timeline identifier');
            return false;
        }

        // Validate required DOM elements
        if (elements.message === null || elements.timeline_item_list === null) {
            console.error('Required DOM elements not found');
            return false;
        }

        show_loading_state(elements);

        try {

            await exhibitsModule.set_exhibit_title(exhibit_id);
            const items = await get_timeline_items(exhibit_id, timeline_id);

            clear_loading_message(elements.message);

            if (items === null || items === false) {
                handle_empty_card(elements);
                return false;
            }

            if (Array.isArray(items) && items.length === 0) {
                handle_empty_timeline(elements);
                return false;
            }

            // Build item HTML using Promise.all for better performance
            const item_html_array = await Promise.all(
                items.map(item => itemsListDisplayModule.display_timeline_items(item))
            );

            // Insert all rows at once via a DocumentFragment — matches the
            // bulk batching pattern used in exhibits.module.js.
            const timeline_template = document.createElement('template');
            timeline_template.innerHTML = item_html_array.join('');
            elements.timeline_item_list.textContent = '';
            elements.timeline_item_list.appendChild(timeline_template.content);

            // Initialize action dropdown handlers
            if (typeof itemsListDisplayModule !== 'undefined' && typeof itemsListDisplayModule.setup_item_action_handlers === 'function') {
                itemsListDisplayModule.setup_item_action_handlers();
            }

            // Initialize DataTable
            new DataTable('#timeline-items', {
                paging: false,
                order: [[1, 'asc']],
                columnDefs: [
                    {
                        target: 1,
                        visible: false,
                        searchable: true
                    }
                ]
            });

            // Bind event listeners
            bind_publish_timeline_item_events();
            bind_suppress_timeline_item_events();

            // Show card and title after initialization
            show_timeline_content(elements);

            return true;

        } catch (error) {
            const safe_message = error instanceof Error ? error.message : 'Failed to load timeline items';
            display_error_message(elements.message, safe_message);
            return false;
        }
    };

    /**
     * Shows timeline content after successful load
     * @param {Object} elements - Cached DOM elements
     */
    function show_timeline_content(elements) {

        if (elements.card !== null) {
            elements.card.style.visibility = 'visible';
            elements.card.style.minHeight = '';
        }

        if (elements.title_heading !== null) {
            elements.title_heading.style.visibility = 'visible';
        }

        if (elements.timeline_items_table !== null) {
            elements.timeline_items_table.style.visibility = 'visible';
        }
    }

    async function publish_timeline_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const timeline_item_id = uuid;
            const type = 'timeline_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.timeline_item_publish.post.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':timeline_id', timeline_id);
            const endpoint = gtmp.replace(':timeline_item_id', timeline_item_id);
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

                setTimeout(() => {
                    let elem = document.getElementById(uuid);
                    document.getElementById(uuid).classList.remove('publish-item');
                    document.getElementById(uuid).classList.add('suppress-item');
                    document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                    const status_after_publish = document.getElementById(uuid);
                    if (status_after_publish) {
                        status_after_publish.innerHTML = '<span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br><small>Published</small></span>';
                    }
                    document.getElementById(uuid).addEventListener('click', async (event) => {
                        event.preventDefault();
                        const uuid = elem.getAttribute('id');
                        await suppress_timeline_item(uuid);
                    }, false);
                }, 0);

                setTimeout(() => {

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

                    if (type[1] === 'timelineitem' && type[2] === 'text') {
                        details_path = `${APP_PATH}/items/vertical-timeline/item/text/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;
                    } else {
                        details_path = `${APP_PATH}/items/vertical-timeline/item/media/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;
                    }

                    const delete_url = `${APP_PATH}/items/timeline/item/delete?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;

                    let uuid_actions = `${uuid}-item-actions`;
                    let elem = document.getElementById(uuid_actions);
                    elem.className = 'text-center';
                    elem.innerHTML = `
                        <div class="dropdown" style="display: inline-block; position: relative;">
                            <button type="button"
                                    class="btn btn-link p-0 border-0 item-actions-toggle"
                                    style="color: #6c757d; font-size: 1.25rem; line-height: 1; background: none;"
                                    data-toggle="dropdown"
                                    data-bs-toggle="dropdown"
                                    aria-haspopup="true"
                                    aria-expanded="false"
                                    title="Actions">
                                <i class="fa fa-ellipsis-v" aria-hidden="true"></i>
                            </button>
                            <div class="dropdown-menu item-actions-menu">
                                <a class="dropdown-item"
                                   href="${details_path}"
                                   style="font-size: 0.875rem;">
                                    <i class="fa fa-folder-open mr-2" aria-hidden="true" style="width: 16px;"></i>
                                    Details
                                </a>
                                <div class="dropdown-divider"></div>
                                <a class="dropdown-item text-muted disabled"
                                   href="#"
                                   style="font-size: 0.875rem; pointer-events: none; opacity: 0.5;"
                                   title="Can only delete if unpublished">
                                    <i class="fa fa-trash mr-2" aria-hidden="true" style="width: 16px;"></i>
                                    Delete
                                </a>
                            </div>
                        </div>
                    `;

                    if (typeof itemsListDisplayModule !== 'undefined' && typeof itemsListDisplayModule.setup_item_action_handlers === 'function') {
                        itemsListDisplayModule.setup_item_action_handlers();
                    }
                }, 0);
            }

            if (response !== undefined && response.status === 204) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'danger', 'Unable to publish timeline item');

                setTimeout(() => {
                    domModule.empty('#message');
                }, 5000);
            } else if (response === undefined) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'danger', 'Unable to publish timeline item');

                setTimeout(() => {
                    domModule.empty('#message');
                }, 5000);
            }

            return false;

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    }

    async function suppress_timeline_item(uuid) {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const timeline_item_id = uuid;
            const type = 'timeline_item';
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.timeline_item_suppress.post.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':timeline_id', timeline_id);
            const endpoint = gtmp.replace(':timeline_item_id', timeline_item_id);
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

                setTimeout(() => {
                    let elem = document.getElementById(uuid);
                    document.getElementById(uuid).classList.remove('suppress-item');
                    document.getElementById(uuid).classList.add('publish-item');
                    document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                    const status_after_suppress = document.getElementById(uuid);
                    if (status_after_suppress) {
                        status_after_suppress.innerHTML = '<span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br><small>Unpublished</small></span>';
                    }
                    document.getElementById(uuid).addEventListener('click', async (event) => {
                        event.preventDefault();
                        const uuid = elem.getAttribute('id');
                        await publish_timeline_item(uuid);
                    }, false);
                }, 0);

                setTimeout(() => {

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

                    if (type[1] === 'timelineitem' && type[2] === 'text') {
                        edit_path = `${APP_PATH}/items/vertical-timeline/item/text/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;
                    } else {
                        edit_path = `${APP_PATH}/items/vertical-timeline/item/media/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;
                    }

                    const delete_path = `${APP_PATH}/items/timeline/item/delete?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${uuid}`;

                    let uuid_actions = `${uuid}-item-actions`;
                    let elem = document.getElementById(uuid_actions);
                    elem.className = 'text-center';
                    elem.innerHTML = `
                        <div class="dropdown" style="display: inline-block; position: relative;">
                            <button type="button"
                                    class="btn btn-link p-0 border-0 item-actions-toggle"
                                    style="color: #6c757d; font-size: 1.25rem; line-height: 1; background: none;"
                                    data-toggle="dropdown"
                                    data-bs-toggle="dropdown"
                                    aria-haspopup="true"
                                    aria-expanded="false"
                                    title="Actions">
                                <i class="fa fa-ellipsis-v" aria-hidden="true"></i>
                            </button>
                            <div class="dropdown-menu item-actions-menu">
                                <a class="dropdown-item"
                                   href="${edit_path}"
                                   style="font-size: 0.875rem;">
                                    <i class="fa fa-edit mr-2" aria-hidden="true" style="width: 16px;"></i>
                                    Edit
                                </a>
                                <div class="dropdown-divider"></div>
                                <a class="dropdown-item text-danger"
                                   href="${delete_path}"
                                   style="font-size: 0.875rem;">
                                    <i class="fa fa-trash mr-2" aria-hidden="true" style="width: 16px;"></i>
                                    Delete
                                </a>
                            </div>
                        </div>
                    `;

                    if (typeof itemsListDisplayModule !== 'undefined' && typeof itemsListDisplayModule.setup_item_action_handlers === 'function') {
                        itemsListDisplayModule.setup_item_action_handlers();
                    }
                }, 0);

            } else if (response === undefined) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to unpublish this record.');

                setTimeout(() => {
                    domModule.empty('#message');
                }, 5000);
            }

            if (response !== undefined && response.status === 204) {
                scrollTo(0, 0);
                domModule.set_alert(document.querySelector('#message'), 'warning', 'Unable to unpublish timeline item');

                setTimeout(() => {
                    domModule.empty('#message');
                }, 5000);
            }

            return false;

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    }

    function bind_publish_timeline_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('publish-item'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const uuid = exhibit_link.getAttribute('id');
                    await publish_timeline_item(uuid);
                });
            });

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    }

    function bind_suppress_timeline_item_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('suppress-item'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const uuid = exhibit_link.getAttribute('id');
                    await suppress_timeline_item(uuid);
                });
            });

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    }

    obj.delete_timeline_item = async function () {

        try {

            const delete_message = document.querySelector('#delete-message');
            if (delete_message) {
                delete_message.innerHTML = 'Deleting timeline item...';
            }
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const timeline_item_id = helperModule.get_parameter_by_name('item_id');
            const type = 'timeline_item';
            const etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.delete.endpoint.replace(':exhibit_id', exhibit_id);
            const gtmp = etmp.replace(':timeline_id', timeline_id);
            const endpoint = gtmp.replace(':item_id', timeline_item_id);
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
                    window.location.replace(`${APP_PATH}/items/timeline/items?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}`);
                }, 900);
            }

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    obj.init = async function () {

        try {

            const status = helperModule.get_parameter_by_name('status');

            if (status !== null && status === '403') {

                const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
                const timeline_id = helperModule.get_parameter_by_name('timeline_id');

                setTimeout(() => {
                    window.history.replaceState({page: 'items'}, '', '/exhibits-dashboard/items/vertical-timeline/items?exhibit_id=' + exhibit_id + '&timeline_id=' + timeline_id);
                }, 0);

                setTimeout(() => {
                    domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to add item.');
                }, 50);
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            // Nav links wired by navModule.wire_nav_links() from the view
            // using data-nav-path + NAV_CONFIGS.timeline_items_list.
            navModule.init();
            helperModule.show_form();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
