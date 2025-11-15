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

const exhibitsModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    let obj = {};
    let link;

    async function get_exhibits() {

        try {
            // Get endpoints configuration
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            // Validate endpoints exist
            if (!EXHIBITS_ENDPOINTS?.exhibits?.exhibit_records?.endpoint) {
                throw new Error('Exhibits endpoint configuration not available');
            }

            // Get authentication token
            const token = authModule.get_user_token();

            // Validate token before making request
            if (!token || typeof token !== 'string') {
                throw new Error('Authentication token not available');
            }

            // Make API request with timeout
            const response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000  // 30 second timeout
            });

            // Validate response structure
            if (response && response.status === 200) {
                // Validate response data structure
                if (response.data && Array.isArray(response.data.data)) {
                    return response.data.data;
                }

                // Response successful but data structure unexpected
                console.warn('Unexpected response data structure:', response.data);
                return [];
            }

            // Response exists but status is not 200
            if (response) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            // Response is undefined - likely authentication issue
            return undefined;

        } catch (error) {
            // Log error for debugging
            console.error('Error fetching exhibits:', error);

            // Display user-friendly error message safely
            display_exhibits_error_message(error.message);

            // Return undefined to indicate failure
            return undefined;
        }
    }

    /**
     * Display error message
     *
     * @param {string} message - Error message to display
     * @returns {void}
     */
    function display_exhibits_error_message(message) {

        const message_elem = document.querySelector('#message');

        // Validate element exists
        if (!message_elem) {
            console.error('Message element #message not found in DOM');
            return;
        }

        // Clear previous content safely
        message_elem.textContent = '';

        // Create alert container
        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        // WCAG 2.1 - Make error announcements polite for screen readers
        alert_div.setAttribute('aria-live', 'polite');
        alert_div.setAttribute('aria-atomic', 'true');

        // Create icon (decorative, hidden from screen readers)
        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation';
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);

        // Add space between icon and text
        alert_div.appendChild(document.createTextNode(' '));

        // Create message text safely (prevents XSS)
        const message_text = document.createTextNode(message);
        alert_div.appendChild(message_text);

        // Append to message container
        message_elem.appendChild(alert_div);
    }

    /*
    async function get_exhibits__() {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }
    */

    obj.display_exhibits = async function () {

        try {
            // Fetch exhibits from API
            const exhibits = await get_exhibits();

            // Handle error cases
            if (exhibits === false) {
                const exhibit_card = document.querySelector('#exhibit-card');
                if (exhibit_card) {
                    exhibit_card.textContent = '';
                }
                return false;
            }

            // Handle authentication failure
            if (exhibits === undefined) {
                authModule.redirect_to_auth();
                return false;
            }

            // Handle empty results
            if (!exhibits || exhibits.length === 0) {
                clear_exhibits_display();
                display_no_exhibits_message();
                return false;
            }

            // Get table body element
            const tbody = document.querySelector('#exhibits-data');
            if (!tbody) {
                throw new Error('Table body element #exhibits-data not found');
            }

            // Clear existing content safely
            tbody.textContent = '';

            // Build rows using secure DOM manipulation
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < exhibits.length; i++) {
                const row = create_exhibit_row_for_display(exhibits[i]);
                fragment.appendChild(row);
            }

            // Append all rows at once (better performance)
            tbody.appendChild(fragment);

            // Initialize DataTable
            const exhibit_list = initialize_exhibits_datatable();

            // Bind event handlers
            bind_datatable_events(exhibit_list);

            // Handle exhibit_id query parameter
            handle_exhibit_id_parameter();

            return true;

        } catch (error) {
            console.error('Error displaying exhibits:', error);

            const message_elem = document.querySelector('#message');
            if (message_elem) {
                display_message(message_elem, 'danger', 'Error displaying exhibits: ' + error.message);
            }

            return false;
        }
    };

    /**
     * Clear exhibits display elements
     */
    function clear_exhibits_display() {
        const card = document.querySelector('.card');
        if (card) {
            card.textContent = '';
        }
    }

    /**
     * Display "no exhibits found" message with WCAG compliance
     */
    function display_no_exhibits_message() {

        const message_elem = document.querySelector('#message');

        if (!message_elem) {
            console.warn('Message element not found');
            return;
        }

        message_elem.textContent = '';

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-info';
        alert_div.setAttribute('role', 'status');
        alert_div.setAttribute('aria-live', 'polite');
        alert_div.setAttribute('aria-atomic', 'true');

        const text = document.createTextNode('No Exhibits found.');
        alert_div.appendChild(text);

        message_elem.appendChild(alert_div);
    }

    /**
     * Create complete exhibit row for DataTable
     * @param {Object} exhibit - Exhibit data object
     * @returns {HTMLElement} Table row element
     */
    function create_exhibit_row_for_display(exhibit) {

        const tr = document.createElement('tr');
        tr.id = exhibit.uuid;

        // Column 1: Main content (title, thumbnail, buttons)
        tr.appendChild(create_main_content_column(exhibit));

        // Column 2: Status
        tr.appendChild(create_status_column(exhibit));

        // Column 3: Actions
        tr.appendChild(create_actions_column(exhibit));

        // Column 4: Created date
        tr.appendChild(create_date_column(exhibit.created, 'exhibit-created'));

        // Column 5: Updated date
        tr.appendChild(create_date_column(exhibit.updated, 'exhibit-updated'));

        return tr;
    }

    /**
     * Create main content column with title, thumbnail, and action buttons
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Table cell
     */
    function create_main_content_column(exhibit) {

        const td = document.createElement('td');
        td.style.width = '35%';

        // Title section with featured/locked icons
        const title_paragraph = create_title_section(exhibit);
        td.appendChild(title_paragraph);

        // Thumbnail
        const thumbnail = create_thumbnail_element(exhibit);
        td.appendChild(thumbnail);

        // Button group (Preview, Share)
        const button_container = create_button_group(exhibit);
        td.appendChild(button_container);

        // Created by info
        const created_info = create_created_by_info(exhibit.created_by);
        td.appendChild(created_info);

        return td;
    }

    /**
     * Create title section with featured and locked icons
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Paragraph element
     */
    function create_title_section(exhibit) {

        const p = document.createElement('p');

        // Title in strong tag
        const strong = document.createElement('strong');
        const title = helperModule.strip_html(helperModule.unescape(exhibit.title));
        strong.textContent = title;
        p.appendChild(strong);

        // Featured icon
        if (exhibit.is_featured === 1) {
            p.appendChild(document.createTextNode('  '));
            const featured_icon = create_icon(
                'fa fa-star',
                'Featured',
                'featured exhibit',
                '#BA8E23'
            );
            p.appendChild(featured_icon);
        }

        // Locked icon
        if (exhibit.is_locked === 1) {
            p.appendChild(document.createTextNode('  '));
            const locked_icon = create_icon(
                'fa fa-lock',
                'Record is currently locked',
                'exhibit-is-locked',
                '#BA8E23'
            );
            p.appendChild(locked_icon);
        }

        return p;
    }

    /**
     * Create thumbnail element
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Paragraph with image
     */
    function create_thumbnail_element(exhibit) {

        const p = document.createElement('p');
        const img = document.createElement('img');

        const default_image_url = `${APP_PATH}/static/images/image-tn.png`;

        let thumbnail_url;
        if (exhibit.thumbnail && exhibit.thumbnail.length > 0) {
            thumbnail_url = `${APP_PATH}/api/v1/exhibits/${encodeURIComponent(exhibit.uuid)}/media/${encodeURIComponent(exhibit.thumbnail)}`;
        } else {
            thumbnail_url = default_image_url;
        }

        img.src = thumbnail_url;
        img.alt = `${exhibit.uuid} thumbnail`;
        img.height = 100;
        img.width = 100;

        // Handle broken image (404 error)
        img.addEventListener('error', function() {
            if (this.src !== default_image_url) {
                console.warn(`Thumbnail failed to load for exhibit ${exhibit.uuid}, using default image`);
                this.src = default_image_url;
            }
        });

        p.appendChild(img);
        return p;
    }

    /**
     * Create button group with Preview and Share buttons
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Button container div
     */
    function create_button_group(exhibit) {

        const container = document.createElement('div');
        container.className = 'd-flex justify-content-between align-items-center';

        const btn_group = document.createElement('div');
        btn_group.className = 'btn-group';

        // Preview button
        const preview_span = document.createElement('span');
        preview_span.id = 'preview-link';

        const preview_button = document.createElement('button');
        preview_button.type = 'button';
        preview_button.className = 'btn btn-sm btn-outline-secondary';
        preview_button.setAttribute('aria-label', 'Preview exhibit');

        const preview_icon = document.createElement('i');
        preview_icon.className = 'menu-icon fa fa-eye';
        preview_icon.setAttribute('aria-hidden', 'true');
        preview_button.appendChild(preview_icon);

        preview_button.appendChild(document.createTextNode(' '));

        const preview_small = document.createElement('small');
        preview_small.textContent = 'Preview';
        preview_button.appendChild(preview_small);

        const preview_link = `${APP_PATH}/preview?uuid=${encodeURIComponent(exhibit.uuid)}`;
        preview_button.addEventListener('click', () => {
            exhibitsModule.open_preview(preview_link);
        });

        preview_span.appendChild(preview_button);
        btn_group.appendChild(preview_span);

        // Space between buttons
        btn_group.appendChild(document.createTextNode('  '));

        // Share button
        const share_span = document.createElement('span');
        share_span.id = 'share-link';

        const share_button = document.createElement('button');
        share_button.type = 'button';
        share_button.className = 'btn btn-sm btn-outline-secondary';
        share_button.setAttribute('aria-label', 'Share exhibit');
        share_button.setAttribute('data-toggle', 'modal');
        share_button.setAttribute('data-target', '.shared-url-modal');

        const share_icon = document.createElement('i');
        share_icon.className = 'fa fa-share-alt';
        share_icon.setAttribute('aria-hidden', 'true');
        share_button.appendChild(share_icon);

        share_button.appendChild(document.createTextNode(' '));

        const share_small = document.createElement('small');
        share_small.textContent = 'Share';
        share_button.appendChild(share_small);

        // Event listener instead of onclick
        share_button.addEventListener('click', () => {
            exhibitsModule.create_shared_preview_url(exhibit.uuid);
        });

        share_span.appendChild(share_button);
        btn_group.appendChild(share_span);

        container.appendChild(btn_group);
        return container;
    }

    /**
     * Create "created by" info element
     * @param {string} created_by - Username who created the exhibit
     * @returns {HTMLElement} Paragraph element
     */
    function create_created_by_info(created_by) {

        const p = document.createElement('p');
        const span = document.createElement('span');
        span.style.fontSize = 'x-small';

        const em = document.createElement('em');
        em.textContent = `Exhibit created by ${created_by}`;

        span.appendChild(em);
        p.appendChild(span);

        return p;
    }

    /**
     * Create status column
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Table cell
     */
    function create_status_column(exhibit) {

        const td = document.createElement('td');
        td.style.width = '5%';
        td.style.textAlign = 'center';

        const small = document.createElement('small');
        const status_link = create_status_link(exhibit.uuid, exhibit.is_published);
        small.appendChild(status_link);

        td.appendChild(small);
        return td;
    }

    /**
     * Create status link (Published/Unpublished)
     * @param {string} uuid - Exhibit UUID
     * @param {number} is_published - Publication status (0 or 1)
     * @returns {HTMLElement} Link element
     */
    function create_status_link(uuid, is_published) {

        const link = document.createElement('a');
        link.href = '#';
        link.id = `${uuid}-status`;
        link.setAttribute('aria-label', 'Toggle publication status');

        const span = document.createElement('span');

        if (is_published === 1) {
            link.className = 'suppress-exhibit';
            span.id = 'suppress';
            span.setAttribute('title', 'published');

            const icon = document.createElement('i');
            icon.className = 'fa fa-cloud';
            icon.style.color = 'green';
            icon.setAttribute('aria-hidden', 'true');

            span.appendChild(icon);
            span.appendChild(document.createElement('br'));
            span.appendChild(document.createTextNode('Published'));
        } else {
            link.className = 'publish-exhibit';
            span.id = 'publish';
            span.setAttribute('title', 'suppressed');

            const icon = document.createElement('i');
            icon.className = 'fa fa-cloud-upload';
            icon.style.color = 'darkred';
            icon.setAttribute('aria-hidden', 'true');

            span.appendChild(icon);
            span.appendChild(document.createElement('br'));
            span.appendChild(document.createTextNode('Unpublished'));
        }

        link.appendChild(span);
        return link;
    }

    /**
     * Create actions column with view/edit/delete links
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Table cell
     */
    function create_actions_column(exhibit) {

        const td = document.createElement('td');
        td.style.width = '10%';

        const div = document.createElement('div');
        div.className = 'card-text text-sm-center';
        div.id = `${exhibit.uuid}-actions`;

        // View items link (always visible)
        const items_link = create_link_element(
            `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit.uuid)}`,
            'View Exhibit Items',
            'view-exhibit-items',
            'fa fa-list'
        );
        items_link.classList.add('pr-1');
        div.appendChild(items_link);
        div.appendChild(document.createTextNode(' '));

        if (exhibit.is_published === 1) {
            // Published: show details link and disabled delete
            const details_link = create_link_element(
                `${APP_PATH}/exhibits/exhibit/details?exhibit_id=${encodeURIComponent(exhibit.uuid)}`,
                'View details',
                'exhibit-details',
                'fa fa-folder-open'
            );
            details_link.classList.add('pr-1');
            div.appendChild(details_link);
            div.appendChild(document.createTextNode(' '));

            // Disabled delete icon
            const trash_icon = document.createElement('i');
            trash_icon.className = 'fa fa-trash pr-1';
            trash_icon.setAttribute('title', 'Can only delete if unpublished');
            trash_icon.setAttribute('aria-label', 'delete-exhibit');
            trash_icon.style.color = '#d3d3d3';
            div.appendChild(trash_icon);
        } else {
            // Unpublished: show edit and delete links
            const edit_link = create_link_element(
                `${APP_PATH}/exhibits/exhibit/edit?exhibit_id=${encodeURIComponent(exhibit.uuid)}`,
                'Edit',
                'edit-exhibit',
                'fa fa-edit'
            );
            edit_link.classList.add('pr-1');
            div.appendChild(edit_link);
            div.appendChild(document.createTextNode(' '));

            const delete_link = create_link_element(
                `${APP_PATH}/exhibits/exhibit/delete?exhibit_id=${encodeURIComponent(exhibit.uuid)}`,
                'Delete exhibit',
                'delete-exhibit',
                'fa fa-trash'
            );
            delete_link.classList.add('pr-1');
            div.appendChild(delete_link);
        }

        td.appendChild(div);
        return td;
    }

    /**
     * Create date column
     * @param {string} date_string - Date string
     * @param {string} aria_label - ARIA label
     * @returns {HTMLElement} Table cell
     */
    function create_date_column(date_string, aria_label) {

        const td = document.createElement('td');
        td.style.width = '4%';
        td.className = 'item-order';
        td.setAttribute('aria-label', aria_label);

        const span = document.createElement('span');
        span.style.paddingLeft = '4px';

        const date = new Date(date_string);
        const formatted_date = helperModule.format_date(date);
        span.textContent = formatted_date;

        td.appendChild(span);
        return td;
    }

    /**
     * Create icon element
     * @param {string} icon_class - Icon class
     * @param {string} title - Title attribute
     * @param {string} aria_label - ARIA label (empty string to hide from AT)
     * @param {string} color - Color style
     * @returns {HTMLElement} Icon element
     */
    function create_icon(icon_class, title, aria_label, color) {

        const icon = document.createElement('i');
        icon.className = icon_class;

        if (title) {
            icon.setAttribute('title', title);
        }

        if (aria_label) {
            icon.setAttribute('aria-label', aria_label);
        } else {
            icon.setAttribute('aria-hidden', 'true');
        }

        if (color) {
            icon.style.color = color;
        }

        return icon;
    }

    /**
     * Create link element with icon
     * @param {string} href - Link URL
     * @param {string} title - Title attribute
     * @param {string} aria_label - ARIA label
     * @param {string} icon_class - Icon class
     * @returns {HTMLElement} Link element
     */
    function create_link_element(href, title, aria_label, icon_class) {

        const link = document.createElement('a');
        link.href = href;

        if (title) {
            link.setAttribute('title', title);
        }

        if (aria_label) {
            link.setAttribute('aria-label', aria_label);
        }

        if (icon_class) {
            const icon = create_icon(icon_class, '', '', '');
            link.appendChild(icon);
            link.appendChild(document.createTextNode(' '));
        }

        return link;
    }

    /**
     * Display message helper (reusable across module)
     * @param {HTMLElement} element - Target element
     * @param {string} alert_type - Alert type ('info', 'success', 'danger', 'warning')
     * @param {string} message - Message text
     */
    function display_message(element, alert_type, message) {

        if (!element) {
            console.error('Display message: element not found');
            return;
        }

        element.textContent = '';

        const alert_div = document.createElement('div');
        alert_div.className = `alert alert-${alert_type}`;
        alert_div.setAttribute('role', 'alert');
        alert_div.setAttribute('aria-live', 'polite');
        alert_div.setAttribute('aria-atomic', 'true');

        const icon_class_map = {
            'info': 'fa fa-info',
            'success': 'fa fa-check',
            'danger': 'fa fa-exclamation',
            'warning': 'fa fa-exclamation-triangle'
        };

        const icon = create_icon(icon_class_map[alert_type] || 'fa fa-info', '', '', '');
        alert_div.appendChild(icon);
        alert_div.appendChild(document.createTextNode(' '));

        const text = document.createTextNode(message);
        alert_div.appendChild(text);

        element.appendChild(alert_div);
    }

    /**
     * Initialize DataTable with configuration
     * @returns {Object} DataTable instance
     */
    function initialize_exhibits_datatable() {

        try {
            const table = document.querySelector('#exhibits');

            if (!table) {
                throw new Error('Table element #exhibits not found');
            }

            const exhibit_list = new DataTable('#exhibits', {
                paging: true,
                order: [[4, 'desc']], // Sort by updated date descending
                rowReorder: false,
                language: {
                    bottomEnd: {
                        paging: {
                            firstLast: false
                        }
                    }
                }
            });

            return exhibit_list;

        } catch (error) {
            console.error('Error initializing DataTable:', error);
            throw error;
        }
    }

    /**
     * Bind event handlers to DataTable
     * @param {Object} exhibit_list - DataTable instance
     */
    function bind_datatable_events(exhibit_list) {

        if (!exhibit_list) {
            console.error('DataTable instance not provided');
            return;
        }

        try {
            // Publish event
            exhibit_list.on('click', 'tbody tr .publish-exhibit', async (event) => {
                event.preventDefault();
                const uuid = event.currentTarget.getAttribute('id');

                if (uuid) {
                    await publish_exhibit(uuid);
                } else {
                    console.error('No UUID found on publish button');
                }
            });

            // Suppress event
            exhibit_list.on('click', 'tbody tr .suppress-exhibit', async (event) => {
                event.preventDefault();
                const uuid = event.currentTarget.getAttribute('id');

                if (uuid) {
                    await suppress_exhibit(uuid);
                } else {
                    console.error('No UUID found on suppress button');
                }
            });

        } catch (error) {
            console.error('Error binding DataTable events:', error);
        }
    }

    /** TODO: doesn't work with paging
     * Handle exhibit_id query parameter
     * Scrolls to exhibit if ID is in URL
     */
    function handle_exhibit_id_parameter() {

        try {
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (exhibit_id !== null && exhibit_id !== '') {
                // Clean up URL without page reload
                history.replaceState({}, '', APP_PATH + '/exhibits');
                history.pushState({}, '', APP_PATH + '/exhibits');

                // Scroll to exhibit
                const target_element = document.getElementById(exhibit_id);
                if (target_element) {
                    target_element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Optional: Add highlight effect
                    target_element.style.backgroundColor = '#fffacd';
                    setTimeout(() => {
                        target_element.style.backgroundColor = '';
                    }, 2000);
                } else {
                    console.warn(`Exhibit with ID ${exhibit_id} not found in DOM`);
                }
            }

        } catch (error) {
            console.error('Error handling exhibit_id parameter:', error);
        }
    }

    obj.get_exhibit_title = async function (uuid) {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.get.endpoint.replace(':exhibit_id', uuid),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return helperModule.strip_html(helperModule.unescape(response.data.data.title));
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.set_exhibit_title = async function (uuid) {
        let title = await exhibitsModule.get_exhibit_title(uuid);
        document.querySelector('#exhibit-title').innerHTML = `${title}`;
        return false;
    };

    obj.open_preview = function (preview_link) {

        scrollTo(0, 0);
        const token = authModule.get_user_token();

        if (link !== undefined) {
            exhibitsModule.close_preview();
        }

        document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info-circle"></i> Building Exhibit Preview...</div>`;

        setTimeout(() => {
            link = window.open(preview_link + '&t=' + token, '_blank', 'location=yes,scrollbars=yes,status=yes');
            document.querySelector('#message').innerHTML = '';
        }, 900);
    };

    obj.close_preview = function () {
        link.close();
    };

    obj.delete_exhibit = function () {

        try {

            (async function () {

                document.querySelector('#delete-message').innerHTML = 'Deleting exhibit...';
                const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
                const uuid = helperModule.get_parameter_by_name('exhibit_id');
                const token = authModule.get_user_token();
                const response = await httpModule.req({
                    method: 'DELETE',
                    url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.delete.endpoint.replace(':exhibit_id', uuid),
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    setTimeout(() => {
                        window.location.replace(APP_PATH + '/exhibits');
                    }, 900);

                } else if (response !== undefined && response.status === 200) {

                    scrollTo(0, 0);
                    document.querySelector('#delete-card').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-warning"></i> Cannot delete an exhibit that contains items.</div>`;

                } else if (response === undefined) {
                    scrollTo(0, 0);
                    document.querySelector('#delete-card').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to delete this record.</div>`;
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    };

    // Module-level constants
    const EXHIBIT_CONSTANTS = {
        STATUS_SUFFIX: '-status',
        ACTIONS_SUFFIX: '-actions',
        MESSAGE_DURATION: 5000,
        HTTP_OK: 200,
        HTTP_NO_CONTENT: 204,
        UUID_PATTERN: /^[a-f0-9-]+$/i
    };

// Exhibit state configurations
    const EXHIBIT_STATES = {
        PUBLISHED: {
            span_id: 'suppress',
            title: 'published',
            icon_class: 'fa fa-cloud',
            icon_color: 'green',
            text: 'Published',
            css_class_to_add: 'suppress-exhibit',
            css_class_to_remove: 'publish-exhibit',
            click_handler: suppress_exhibit,
            actions: (app_path, encoded_uuid) => [
                { href: `${app_path}/items?exhibit_id=${encoded_uuid}`, title: 'View Exhibit Items', icon: 'fa fa-list pr-1', label: 'view-items' },
                { href: `${app_path}/exhibits/exhibit/details?exhibit_id=${encoded_uuid}`, title: 'View details', icon: 'fa fa-folder-open pr-1', label: 'exhibit-details' },
                { type: 'disabled-trash' }
            ]
        },
        SUPPRESSED: {
            span_id: 'publish',
            title: 'suppressed',
            icon_class: 'fa fa-cloud-upload',
            icon_color: 'darkred',
            text: 'Unpublished',
            css_class_to_add: 'publish-exhibit',
            css_class_to_remove: 'suppress-exhibit',
            click_handler: publish_exhibit,
            actions: (app_path, encoded_uuid) => [
                { href: `${app_path}/items?exhibit_id=${encoded_uuid}`, title: 'View Exhibit Items', icon: 'fa fa-list pr-1', label: 'view-items' },
                { href: `${app_path}/exhibits/exhibit/edit?exhibit_id=${encoded_uuid}`, title: 'Edit', icon: 'fa fa-edit pr-1', label: 'edit-exhibit' },
                { href: `${app_path}/exhibits/exhibit/delete?exhibit_id=${encoded_uuid}`, title: 'Delete exhibit', icon: 'fa fa-trash pr-1', label: 'delete-exhibit' }
            ]
        }
    };

    /**
     * Validates and cleans an exhibit UUID
     * @param {string} uuid - The UUID to validate
     * @returns {string} - Cleaned UUID without suffix
     * @throws {Error} - If UUID is invalid
     */
    function validate_and_clean_uuid(uuid) {
        if (!uuid || typeof uuid !== 'string') {
            throw new Error('Invalid exhibit UUID provided');
        }

        const clean_uuid = uuid.replace(EXHIBIT_CONSTANTS.STATUS_SUFFIX, '');

        if (!EXHIBIT_CONSTANTS.UUID_PATTERN.test(clean_uuid)) {
            throw new Error('Invalid UUID format');
        }

        return clean_uuid;
    }

    /**
     * Validates authentication token
     * @param {string} token - The token to validate
     * @throws {Error} - If token is not available
     */
    function validate_token(token) {
        if (!token) {
            throw new Error('Authentication token not available');
        }
    }

    /**
     * Makes an API request to change exhibit state
     * @param {string} endpoint - The API endpoint
     * @param {string} clean_uuid - The cleaned exhibit UUID
     * @param {string} token - Authentication token
     * @returns {Promise<Object>} - API response
     */
    async function make_exhibit_state_request(endpoint, clean_uuid, token) {
        return await httpModule.req({
            method: 'POST',
            url: endpoint.replace(':exhibit_id', clean_uuid),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            validateStatus: (status) => status >= 200 && status < 600
        });
    }

    /**
     * Updates the exhibit status UI based on state configuration
     * @param {string} uuid - Original UUID with suffix
     * @param {Object} state_config - State configuration object
     */
    function update_exhibit_status_ui_generic(uuid, state_config) {
        const status_element = document.getElementById(uuid);

        if (!status_element) {
            console.warn(`Status element not found: ${uuid}`);
            return;
        }

        // Clone the element to remove all existing event listeners
        const new_element = status_element.cloneNode(false);

        // Update classes
        new_element.classList.remove(state_config.css_class_to_remove);
        new_element.classList.add(state_config.css_class_to_add);

        // Create new content using safe DOM methods
        const span = document.createElement('span');
        span.id = state_config.span_id;
        span.title = state_config.title;

        const icon = document.createElement('i');
        icon.className = state_config.icon_class;
        icon.style.color = state_config.icon_color;
        icon.setAttribute('aria-hidden', 'true');

        const br = document.createElement('br');
        const text = document.createTextNode(state_config.text);

        span.appendChild(icon);
        span.appendChild(br);
        span.appendChild(text);
        new_element.appendChild(span);

        // Add event listener to the new element
        new_element.addEventListener('click', async (event) => {
            event.preventDefault();
            await state_config.click_handler(uuid);
        }, { once: false, passive: false });

        // Replace the old element with the new one
        status_element.replaceWith(new_element);
    }

    /**
     * Updates the exhibit actions UI based on state configuration
     * @param {string} clean_uuid - UUID without suffix
     * @param {Object} state_config - State configuration object
     */
    function update_exhibit_actions_ui_generic(clean_uuid, state_config) {
        const actions_id = `${clean_uuid}${EXHIBIT_CONSTANTS.ACTIONS_SUFFIX}`;
        const actions_element = document.getElementById(actions_id);

        if (!actions_element) {
            console.warn(`Actions element not found: ${actions_id}`);
            return;
        }

        // Clear existing content safely
        while (actions_element.firstChild) {
            actions_element.removeChild(actions_element.firstChild);
        }

        // Safely encode UUID for URL
        const encoded_uuid = encodeURIComponent(clean_uuid);

        // Validate APP_PATH is defined
        const app_path = typeof APP_PATH !== 'undefined' ? APP_PATH : '';

        // Get action configurations for this state
        const action_configs = state_config.actions(app_path, encoded_uuid);

        // Create action elements
        const actions = [];
        action_configs.forEach((config, index) => {
            if (config.type === 'disabled-trash') {
                actions.push(create_disabled_trash_icon());
            } else {
                actions.push(create_action_link(config.href, config.title, config.icon, config.label));
            }

            // Add spacing between actions (except after last action)
            if (index < action_configs.length - 1) {
                actions.push(document.createTextNode('\u00A0'));
            }
        });

        actions.forEach(action => actions_element.appendChild(action));
    }

    /**
     * Publishes an exhibit and updates the UI accordingly
     * @param {string} uuid - The exhibit UUID (may include '-status' suffix)
     * @returns {Promise<boolean>} - Always returns false to prevent default form behavior
     */
    async function publish_exhibit(uuid) {
        try {
            // Validate and clean UUID
            const clean_uuid = validate_and_clean_uuid(uuid);

            // Get endpoints and token
            const exhibits_endpoints = endpointsModule.get_exhibits_endpoints();
            const token = authModule.get_user_token();
            validate_token(token);

            // Make API request
            const response = await make_exhibit_state_request(
                exhibits_endpoints.exhibits.exhibit_publish.post.endpoint,
                clean_uuid,
                token
            );

            // Handle responses
            if (response?.status === EXHIBIT_CONSTANTS.HTTP_OK) {
                update_exhibit_status_ui_generic(uuid, EXHIBIT_STATES.PUBLISHED);
                update_exhibit_actions_ui_generic(clean_uuid, EXHIBIT_STATES.PUBLISHED);
            } else if (response?.status === EXHIBIT_CONSTANTS.HTTP_NO_CONTENT) {
                show_message('warning', 'Exhibit must contain at least one item to publish');
            } else if (!response) {
                show_message('danger', 'You do not have permission to publish this record');
            }

            return false;

        } catch (error) {
            console.error('Error publishing exhibit:', error);
            show_message('danger', error.message || 'An unexpected error occurred while publishing the exhibit');
            return false;
        }
    }

    /**
     * Suppresses (unpublishes) an exhibit and updates the UI accordingly
     * @param {string} uuid - The exhibit UUID (may include '-status' suffix)
     * @returns {Promise<boolean>} - Always returns false to prevent default form behavior
     */
    async function suppress_exhibit(uuid) {
        try {
            // Validate and clean UUID
            const clean_uuid = validate_and_clean_uuid(uuid);

            // Get endpoints and token
            const exhibits_endpoints = endpointsModule.get_exhibits_endpoints();
            const token = authModule.get_user_token();
            validate_token(token);

            // Make API request
            const response = await make_exhibit_state_request(
                exhibits_endpoints.exhibits.exhibit_suppress.post.endpoint,
                clean_uuid,
                token
            );

            // Handle responses
            if (response?.status === EXHIBIT_CONSTANTS.HTTP_OK) {
                update_exhibit_status_ui_generic(uuid, EXHIBIT_STATES.SUPPRESSED);
                update_exhibit_actions_ui_generic(clean_uuid, EXHIBIT_STATES.SUPPRESSED);
            } else if (!response) {
                show_message('danger', 'You do not have permission to unpublish this record');
            }

            return false;

        } catch (error) {
            console.error('Error suppressing exhibit:', error);
            show_message('danger', error.message || 'An error occurred while suppressing exhibit');
            return false;
        }
    }

    /**
     * Creates an action link element safely
     * @param {string} href - Link URL
     * @param {string} title - Link title
     * @param {string} icon_class - Icon class names
     * @param {string} aria_label - Aria label for accessibility
     * @returns {HTMLAnchorElement}
     */
    function create_action_link(href, title, icon_class, aria_label) {
        const link = document.createElement('a');
        link.href = href;
        link.title = title;
        link.setAttribute('aria-label', aria_label);

        const icon = document.createElement('i');
        icon.className = icon_class;
        icon.setAttribute('aria-hidden', 'true');

        link.appendChild(icon);
        return link;
    }

    /**
     * Creates a disabled trash icon element
     * @returns {HTMLElement}
     */
    function create_disabled_trash_icon() {
        const icon = document.createElement('i');
        icon.className = 'fa fa-trash pr-1';
        icon.title = 'Can only delete if unpublished';
        icon.style.color = '#d3d3d3';
        icon.setAttribute('aria-label', 'delete-exhibit');
        icon.setAttribute('aria-disabled', 'true');
        icon.setAttribute('aria-hidden', 'true');
        return icon;
    }

    /**
     * Displays a message to the user
     * @param {string} type - Message type ('warning', 'danger', 'success', 'info')
     * @param {string} message - Message text to display
     * @param {number} duration - How long to display message in milliseconds
     */
    function show_message(type, message, duration = EXHIBIT_CONSTANTS.MESSAGE_DURATION) {
        const message_container = document.querySelector('#message');

        if (!message_container) {
            console.error('Message container not found');
            return;
        }

        // Scroll to top for visibility
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Clear existing content
        while (message_container.firstChild) {
            message_container.removeChild(message_container.firstChild);
        }

        // Create alert element safely
        const alert_div = document.createElement('div');
        alert_div.className = `alert alert-${type}`;
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = type === 'warning' ? 'fa fa-warning' : 'fa fa-exclamation-circle';
        icon.setAttribute('aria-hidden', 'true');

        const message_text = document.createTextNode(` ${message}`);

        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);
        message_container.appendChild(alert_div);

        // Auto-clear message after delay
        setTimeout(() => {
            if (message_container.firstChild === alert_div) {
                message_container.removeChild(alert_div);
            }
        }, duration);
    }

    obj.create_shared_preview_url = function (uuid) {

        (async function () {

            document.querySelector('#shared-url').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Generating Shared URL...</div>`;

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            let token = authModule.get_user_token();
            let response;

            if (token === false) {

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_shared.get.endpoint + '?uuid=' + uuid,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#shared-url-copy').innerText = response.data.shared_url;
                setTimeout(async () => {

                    document.querySelector('#shared-url').innerHTML = `<div class="d-flex align-items-center">
                                                                                    <p>
                                                                                    - Shared URL created.&nbsp;&nbsp; 
                                                                                    <button type="button" class="btn btn-sm btn-primary" onclick="exhibitsModule.copy();">
                                                                                    <i class="fa fa-copy"> Copy</i>
                                                                                    </button>
                                                                                    <br>
                                                                                    - Shared URL expires in 7 days.
                                                                                    </p>
                                                                                </div>`;
                }, 900);
            }

            return false;

        })();
    };

    obj.copy = function () {

        try {

            (async function () {
                let elem = document.querySelector('#shared-url-copy');
                const shared_url = elem.textContent;
                await navigator.clipboard.writeText(shared_url);
                document.querySelector('#copy-message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> URL copied to clipboard!</div>`;

                setTimeout(() => {
                    document.querySelector('#copy-message').innerHTML = '';
                }, 5000);
            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Failed to copy shared URL to clipboard. Error: ${error.message}</div>`;
        }
    }

    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            await exhibitsModule.display_exhibits();
            helperModule.show_form();
            navModule.set_logout_link();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

    };

    return obj;

}());
