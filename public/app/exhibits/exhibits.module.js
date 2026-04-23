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

        // Make API request with timeout and validateStatus
        const response = await httpModule.req({
            method: 'GET',
            url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            timeout: 30000,
            validateStatus: (status) => status >= 200 && status < 600
        });

        // Handle 403 Forbidden
        if (response?.status === 403) {
            display_exhibits_error_message('You do not have permission to view exhibits');
            return undefined;
        }

        if (response?.status === 429) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message = response.data.message;
            const message_element = document.querySelector('#message');
            display_message(message_element, 'warning', message);
            return false;
        }

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
            display_exhibits_error_message(`Request failed with status ${response.status}`);
            return undefined;
        }

        // Response is undefined - network or server error
        display_exhibits_error_message('Unable to load exhibits. Please check your connection and try again.');
        return undefined;
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
                display_message(message_elem, 'danger', get_user_friendly_error_message(error));
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
     * Display "no exhibits found" message
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

        // Column 1: Main content (thumbnail, title, created by)
        tr.appendChild(create_main_content_column(exhibit));

        // Column 2: Items link
        tr.appendChild(create_items_column(exhibit));

        // Column 3: Status
        tr.appendChild(create_status_column(exhibit));

        // Column 4: Created date
        tr.appendChild(create_date_column(exhibit.created, 'exhibit-created'));

        // Column 5: Updated date
        tr.appendChild(create_date_column(exhibit.updated, 'exhibit-updated'));

        // Column 6: Actions (dropdown)
        tr.appendChild(create_actions_column(exhibit));

        return tr;
    }

    /**
     * Create main content column with title, thumbnail, and action buttons
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Table cell
     */
    function create_main_content_column(exhibit) {

        const td = document.createElement('td');

        // Determine detail/edit URL based on publication status
        const app_path = typeof APP_PATH !== 'undefined' ? APP_PATH : '';
        const encoded_uuid = encodeURIComponent(exhibit.uuid);
        const exhibit_url = `${app_path}/exhibits/exhibit/details?exhibit_id=${encoded_uuid}`;

        // Flex container for thumbnail + title
        const flex_div = document.createElement('div');
        flex_div.className = 'exhibit-title-cell';
        flex_div.style.cssText = 'display: flex; align-items: center;';

        // Compact thumbnail (50x50) wrapped in link
        const thumbnail = create_thumbnail_element(exhibit);
        const thumbnail_link = document.createElement('a');
        thumbnail_link.href = exhibit_url;
        thumbnail_link.className = 'exhibit-thumbnail-link';
        thumbnail_link.setAttribute('aria-hidden', 'true');
        thumbnail_link.setAttribute('tabindex', '-1');
        thumbnail_link.appendChild(thumbnail);
        flex_div.appendChild(thumbnail_link);

        // Title container with featured/locked icons
        const title_wrapper = document.createElement('div');

        const title_text = helperModule.strip_html(helperModule.unescape(exhibit.title));

        // Title wrapped in link
        const title_link = document.createElement('a');
        title_link.href = exhibit_url;
        title_link.className = 'exhibit-title-link';
        title_link.setAttribute('title', title_text);

        const title_span = document.createElement('small');
        title_span.className = 'exhibit-title';
        title_span.textContent = title_text;
        title_span.style.fontWeight = 'bold';

        title_link.appendChild(title_span);
        title_wrapper.appendChild(title_link);

        // Featured icon (inline after title)
        if (exhibit.is_featured === 1) {
            title_wrapper.appendChild(document.createTextNode('  '));
            const featured_icon = create_icon(
                'fa fa-star',
                'Featured',
                'featured exhibit',
                '#BA8E23'
            );
            title_wrapper.appendChild(featured_icon);
        }

        // Locked icon (inline after title)
        if (exhibit.is_locked === 1) {
            title_wrapper.appendChild(document.createTextNode('  '));
            const locked_icon = create_icon(
                'fa fa-lock',
                'Record is currently locked',
                'exhibit-is-locked',
                '#BA8E23'
            );
            title_wrapper.appendChild(locked_icon);
        }

        // Created by info below title
        const created_by_div = document.createElement('div');
        const created_by_small = document.createElement('small');
        created_by_small.style.fontSize = 'x-small';
        const created_by_em = document.createElement('em');
        created_by_em.textContent = `Exhibit created by ${exhibit.created_by}`;
        created_by_small.appendChild(created_by_em);
        created_by_div.appendChild(created_by_small);
        title_wrapper.appendChild(created_by_div);

        flex_div.appendChild(title_wrapper);
        td.appendChild(flex_div);

        return td;
    }

    /**
     * Create items column with clickable icon linking to exhibit items
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Table cell
     */
    function create_items_column(exhibit) {

        const td = document.createElement('td');
        td.className = 'text-center';
        td.style.verticalAlign = 'middle';

        const app_path = typeof APP_PATH !== 'undefined' ? APP_PATH : '';
        const encoded_uuid = encodeURIComponent(exhibit.uuid);

        const link = document.createElement('a');
        link.href = `${app_path}/items?exhibit_id=${encoded_uuid}`;
        link.className = 'exhibit-items-link';

        const title_text = helperModule.strip_html(helperModule.unescape(exhibit.title));
        link.setAttribute('title', `View items for ${title_text}`);
        link.setAttribute('aria-label', `View items for ${title_text}`);

        const icon = document.createElement('i');
        icon.className = 'fa fa-list';
        icon.setAttribute('aria-hidden', 'true');

        link.appendChild(icon);
        td.appendChild(link);

        return td;
    }

    /**
     * Create thumbnail element
     * Prefers media library binding thumbnail; falls back to legacy exhibit thumbnail field
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Paragraph with image
     */
    function create_thumbnail_element(exhibit) {

        const img = document.createElement('img');

        const default_image_url = `${APP_PATH}/static/images/image-tn.png`;

        let thumbnail_url;

        if (exhibit.media_library_thumbnail_uuid) {
            // Media library binding exists for this exhibit's thumbnail role
            if (exhibit.media_library_thumbnail_ingest_method === 'kaltura' && exhibit.media_library_thumbnail_kaltura_url) {
                // Kaltura thumbnails are external URLs (no auth required)
                thumbnail_url = exhibit.media_library_thumbnail_kaltura_url;
            } else {
                // Same-origin thumbnails authenticate via the HttpOnly
                // exhibits_token cookie; no JWT is embedded in <img src>.
                thumbnail_url = `${APP_PATH}/api/v1/media/library/thumbnail/${encodeURIComponent(exhibit.media_library_thumbnail_uuid)}`;
            }
        } else if (exhibit.thumbnail && exhibit.thumbnail.length > 0) {
            // Legacy direct-upload thumbnail on the exhibit record
            thumbnail_url = `${APP_PATH}/api/v1/exhibits/${encodeURIComponent(exhibit.uuid)}/media/${encodeURIComponent(exhibit.thumbnail)}`;
        } else {
            thumbnail_url = default_image_url;
        }

        img.src = thumbnail_url;
        img.alt = `${exhibit.uuid} thumbnail`;
        img.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; flex-shrink: 0;';

        // Handle broken image (404 error)
        img.addEventListener('error', function () {
            if (this.src !== default_image_url) {
                console.warn(`Thumbnail failed to load for exhibit ${exhibit.uuid}, using default image`);
                this.src = default_image_url;
            }
        });

        return img;
    }

    /**
     * Create status column
     * @param {Object} exhibit - Exhibit data
     * @returns {HTMLElement} Table cell
     */
    function create_status_column(exhibit) {

        const td = document.createElement('td');
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

            const published_text = document.createElement('small');
            published_text.textContent = 'Published';
            span.appendChild(published_text);
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

            const unpublished_text = document.createElement('small');
            unpublished_text.textContent = 'Unpublished';
            span.appendChild(unpublished_text);
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
        td.className = 'text-center';
        td.style.width = '5%';

        const uuid = exhibit.uuid;
        const encoded_uuid = encodeURIComponent(uuid);
        const title = helperModule.strip_html(helperModule.unescape(exhibit.title));

        td.appendChild(build_exhibit_actions_dropdown(uuid, encoded_uuid, title || 'Untitled', exhibit.is_published));

        return td;
    }

    /**
     * Build the exhibit-actions dropdown as a DOM element. DOM construction
     * (setAttribute + textContent) replaces the former innerHTML template
     * so server-supplied title text cannot escape into markup.
     *
     * @param {string} uuid         - Exhibit UUID
     * @param {string} encoded_uuid - URL-encoded UUID (used in hrefs)
     * @param {string} title        - Plain-text title for ARIA labels
     * @param {number} is_published - Publication status (0 or 1)
     * @returns {HTMLElement} Dropdown container element
     */
    function build_exhibit_actions_dropdown(uuid, encoded_uuid, title, is_published) {

        const app_path = typeof APP_PATH !== 'undefined' ? APP_PATH : '';
        const display_title = title || 'Untitled';

        const make_item = (class_name, href, icon_class, label, options) => {

            const a = document.createElement('a');
            a.className = class_name;
            a.href = href;
            a.style.fontSize = '0.875rem';

            if (options && options.data_uuid) {
                a.setAttribute('data-uuid', options.data_uuid);
            }

            if (options && options.title_attr) {
                a.title = options.title_attr;
            }

            if (options && options.disabled) {
                a.style.pointerEvents = 'none';
                a.style.opacity = '0.5';
            }

            const icon = document.createElement('i');
            icon.className = `${icon_class} mr-2`;
            icon.setAttribute('aria-hidden', 'true');
            icon.style.width = '16px';
            a.appendChild(icon);
            a.appendChild(document.createTextNode(' ' + label));

            return a;
        };

        const make_divider = () => {
            const d = document.createElement('div');
            d.className = 'dropdown-divider';
            return d;
        };

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        dropdown.style.display = 'inline-block';
        dropdown.style.position = 'relative';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn btn-link p-0 border-0 exhibit-actions-toggle';
        toggle.style.color = '#6c757d';
        toggle.style.fontSize = '1.25rem';
        toggle.style.lineHeight = '1';
        toggle.style.background = 'none';
        toggle.setAttribute('data-toggle', 'dropdown');
        toggle.setAttribute('data-bs-toggle', 'dropdown');
        toggle.setAttribute('aria-haspopup', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', `Actions for ${display_title}`);
        toggle.title = 'Actions';

        const toggle_icon = document.createElement('i');
        toggle_icon.className = 'fa fa-ellipsis-v';
        toggle_icon.setAttribute('aria-hidden', 'true');
        toggle.appendChild(toggle_icon);

        dropdown.appendChild(toggle);

        const menu = document.createElement('div');
        menu.className = 'dropdown-menu exhibit-actions-menu';
        menu.setAttribute('aria-label', `Actions menu for ${display_title}`);

        if (is_published === 1) {
            menu.appendChild(make_item(
                'dropdown-item',
                `${app_path}/exhibits/exhibit/details?exhibit_id=${encoded_uuid}`,
                'fa fa-folder-open',
                'Details'
            ));
        } else {
            menu.appendChild(make_item(
                'dropdown-item',
                `${app_path}/exhibits/exhibit/edit?exhibit_id=${encoded_uuid}`,
                'fa fa-edit',
                'Edit'
            ));
        }

        menu.appendChild(make_divider());

        menu.appendChild(make_item(
            'dropdown-item btn-preview-exhibit',
            '#',
            'fa fa-eye',
            'Preview',
            { data_uuid: uuid }
        ));

        menu.appendChild(make_item(
            'dropdown-item btn-share-exhibit',
            '#',
            'fa fa-share-alt',
            'Share',
            { data_uuid: uuid }
        ));

        menu.appendChild(make_divider());

        if (is_published === 1) {
            menu.appendChild(make_item(
                'dropdown-item text-muted disabled',
                '#',
                'fa fa-trash',
                'Delete',
                { disabled: true, title_attr: 'Can only delete if unpublished' }
            ));
        } else {
            menu.appendChild(make_item(
                'dropdown-item text-danger',
                `${app_path}/exhibits/exhibit/delete?exhibit_id=${encoded_uuid}`,
                'fa fa-trash',
                'Delete'
            ));
        }

        dropdown.appendChild(menu);
        return dropdown;
    }

    /**
     * Setup exhibit action dropdown handlers after each DataTable draw
     */
    function setup_exhibit_action_handlers() {

        // Initialize Bootstrap dropdowns (support both Bootstrap 4 and 5)
        document.querySelectorAll('.exhibit-actions-toggle').forEach(toggle => {
            if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                new bootstrap.Dropdown(toggle);
            } else if (typeof $ !== 'undefined' && typeof $.fn.dropdown !== 'undefined') {
                $(toggle).dropdown();
            }
        });

        // Close dropdowns when clicking outside
        document.removeEventListener('click', close_open_exhibit_dropdowns);
        document.addEventListener('click', close_open_exhibit_dropdowns);

        // Preview button handlers (dropdown items)
        document.querySelectorAll('.btn-preview-exhibit').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                close_open_exhibit_dropdowns();
                const uuid = this.getAttribute('data-uuid');
                if (uuid) {
                    const preview_link = `${APP_PATH}/preview?uuid=${encodeURIComponent(uuid)}`;
                    exhibitsModule.open_preview(preview_link);
                }
            });
        });

        // Share button handlers (dropdown items)
        document.querySelectorAll('.btn-share-exhibit').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                close_open_exhibit_dropdowns();
                const uuid = this.getAttribute('data-uuid');
                if (uuid) {
                    // Open the share modal
                    const modal_el = document.querySelector('.shared-url-modal');
                    if (modal_el) {
                        if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
                            $(modal_el).modal('show');
                        } else if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                            const bs_modal = new bootstrap.Modal(modal_el);
                            bs_modal.show();
                        }
                    }
                    exhibitsModule.create_shared_preview_url(uuid);
                }
            });
        });
    }

    /**
     * Close all open exhibit dropdown menus
     * @param {Event} [e] - Optional click event
     */
    function close_open_exhibit_dropdowns(e) {
        // If event provided, check if click was inside a dropdown
        if (e && e.target.closest('.dropdown')) {
            return;
        }

        // Close all open dropdowns
        document.querySelectorAll('.exhibit-actions-menu.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
            const toggle = menu.previousElementSibling;
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Also handle Bootstrap 4 jQuery dropdowns
        if (typeof $ !== 'undefined' && typeof $.fn.dropdown !== 'undefined') {
            $('.exhibit-actions-menu.dropdown-menu.show').removeClass('show');
            $('.exhibit-actions-toggle[aria-expanded="true"]').attr('aria-expanded', 'false');
        }
    }

    /**
     * Create date column
     * @param {string} date_string - Date string
     * @param {string} aria_label - ARIA label
     * @returns {HTMLElement} Table cell
     */
    function create_date_column(date_string, aria_label) {

        const td = document.createElement('td');
        td.className = 'item-order';
        td.setAttribute('aria-label', aria_label);

        const small = document.createElement('small');
        const date = new Date(date_string);
        small.textContent = helperModule.format_date(date);

        td.appendChild(small);
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
                order: [[4, 'desc']], // Sort by updated date descending (column index 4)
                rowReorder: false,
                pageLength: 25,
                lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
                responsive: true,
                autoWidth: false,
                columnDefs: [
                    { orderable: false, searchable: false, targets: 1 }, // Items column
                    { orderable: false, searchable: false, targets: 5 } // Actions column
                ],
                language: {
                    emptyTable: 'No exhibits found',
                    zeroRecords: 'No matching exhibits found',
                    info: 'Showing _START_ - _END_ of _TOTAL_ results',
                    infoEmpty: 'No exhibits available',
                    infoFiltered: '(filtered from _MAX_ total exhibits)',
                    search: 'Search exhibits:',
                    lengthMenu: 'Show _MENU_ exhibits per page',
                    paginate: {
                        first: '<i class="fa fa-angle-double-left" aria-hidden="true"></i><span class="sr-only">First</span>',
                        last: '<i class="fa fa-angle-double-right" aria-hidden="true"></i><span class="sr-only">Last</span>',
                        next: '<i class="fa fa-chevron-right" aria-hidden="true"></i><span class="sr-only">Next</span>',
                        previous: '<i class="fa fa-chevron-left" aria-hidden="true"></i><span class="sr-only">Previous</span>'
                    }
                },
                dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
                     '<"row"<"col-sm-12"tr>>' +
                     '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
                drawCallback: function() {
                    // Accessibility improvements after each draw
                    const table = this.api().table().node();

                    // Add scope attributes to header cells
                    table.querySelectorAll('thead th').forEach(th => {
                        th.setAttribute('scope', 'col');
                    });

                    // Setup action dropdown handlers after each draw
                    setup_exhibit_action_handlers();
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
                    target_element.scrollIntoView({behavior: 'smooth', block: 'center'});

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

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
        const token = authModule.get_user_token();

        const response = await httpModule.req({
            method: 'GET',
            url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.get.endpoint.replace(':exhibit_id', uuid),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            validateStatus: (status) => status >= 200 && status < 600
        });

        // Handle 403 Forbidden
        if (response?.status === 403) {
            const message_elem = document.querySelector('#message');
            if (message_elem) {
                display_message(message_elem, 'danger', 'You do not have permission to view this exhibit');
            }
            return undefined;
        }

        if (response !== undefined && response.status === 200) {
            return helperModule.strip_html(helperModule.unescape(response.data.data.title));
        }

        // Response is undefined - network or server error
        if (response === undefined) {
            const message_elem = document.querySelector('#message');
            if (message_elem) {
                display_message(message_elem, 'danger', 'Unable to load exhibit title. Please check your connection and try again.');
            }
        }

        return undefined;
    };

    obj.set_exhibit_title = async function (uuid) {
        let title = await exhibitsModule.get_exhibit_title(uuid);
        document.querySelector('#exhibit-title').textContent = title;
        return false;
    };

    obj.open_preview = function (preview_link) {

        scrollTo(0, 0);

        if (link !== undefined) {
            exhibitsModule.close_preview();
        }

        domModule.set_alert(document.querySelector('#message'), 'info', 'Building Exhibit Preview...');

        setTimeout(() => {
            // Auth travels via the HttpOnly exhibits_token cookie set at
            // SSO callback; the JWT no longer appears in the preview URL.
            link = window.open(preview_link, '_blank', 'location=yes,scrollbars=yes,status=yes');
            document.querySelector('#message').innerHTML = '';
        }, 900);
    };

    obj.close_preview = function () {
        link.close();
    };

    obj.delete_exhibit = async function () {

        const message_elem = document.querySelector('#message');
        const delete_message_elem = document.querySelector('#delete-message');
        const delete_card_elem = document.querySelector('#delete-card');

        if (delete_message_elem) {
            delete_message_elem.textContent = 'Deleting exhibit...';
        }

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
        const uuid = helperModule.get_parameter_by_name('exhibit_id');
        const token = authModule.get_user_token();

        const response = await httpModule.req({
            method: 'DELETE',
            url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.delete.endpoint.replace(':exhibit_id', uuid),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            validateStatus: (status) => status >= 200 && status < 600
        });

        // Handle 403 Forbidden
        if (response?.status === 403) {
            scrollTo(0, 0);
            if (delete_card_elem) {
                delete_card_elem.textContent = '';
            }
            if (message_elem) {
                display_message(message_elem, 'danger', 'You do not have permission to delete this record');
            }
            return false;
        }

        if (response?.status === 429) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const message = response.data.message;
            const message_element = document.querySelector('#message');
            display_message(message_element, 'warning', message);
            return false;
        }

        if (response !== undefined && response.status === 204) {
            setTimeout(() => {
                window.location.replace(APP_PATH + '/exhibits');
            }, 900);
        } else if (response !== undefined && response.status === 200) {
            scrollTo(0, 0);
            if (delete_card_elem) {
                delete_card_elem.textContent = '';
            }
            if (message_elem) {
                display_message(message_elem, 'warning', 'Cannot delete an exhibit that contains items');
            }
        } else if (response === undefined) {
            scrollTo(0, 0);
            if (delete_card_elem) {
                delete_card_elem.textContent = '';
            }
            if (message_elem) {
                display_message(message_elem, 'danger', 'Unable to delete exhibit. Please check your connection and try again.');
            }
        }

        return false;
    };

    // Module-level constants
    const EXHIBIT_CONSTANTS = {
        STATUS_SUFFIX: '-status',
        MESSAGE_DURATION: 5000,
        HTTP_OK: 200,
        HTTP_NO_CONTENT: 204,
        HTTP_FORBIDDEN: 403,
        HTTP_UNPROCESSABLE_ENTITY: 422,
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
            is_published: 1
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
            is_published: 0
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

        // Update classes (DataTable event delegation will handle clicks)
        status_element.classList.remove(state_config.css_class_to_remove);
        status_element.classList.add(state_config.css_class_to_add);

        // Clear existing content safely
        while (status_element.firstChild) {
            status_element.removeChild(status_element.firstChild);
        }

        // Create new content using safe DOM methods
        const span = document.createElement('span');
        span.id = state_config.span_id;
        span.title = state_config.title;

        const icon = document.createElement('i');
        icon.className = state_config.icon_class;
        icon.style.color = state_config.icon_color;
        icon.setAttribute('aria-hidden', 'true');

        const br = document.createElement('br');
        const text = document.createElement('small');
        text.textContent = state_config.text;

        span.appendChild(icon);
        span.appendChild(br);
        span.appendChild(text);
        status_element.appendChild(span);
    }

    /**
     * Updates the exhibit actions UI based on state configuration
     * @param {string} clean_uuid - UUID without suffix
     * @param {Object} state_config - State configuration object
     */
    function update_exhibit_actions_ui_generic(clean_uuid, state_config) {
        // Find the row by UUID and update the last td (actions column)
        const row = document.getElementById(clean_uuid);

        if (!row) {
            console.warn(`Exhibit row not found: ${clean_uuid}`);
            return;
        }

        // Actions column is the last td in the row
        const cells = row.querySelectorAll('td');
        const actions_td = cells[cells.length - 1];

        if (!actions_td) {
            console.warn(`Actions cell not found for: ${clean_uuid}`);
            return;
        }

        const encoded_uuid = encodeURIComponent(clean_uuid);

        // Rebuild dropdown with new published state using safe DOM construction.
        while (actions_td.firstChild) {
            actions_td.removeChild(actions_td.firstChild);
        }
        actions_td.appendChild(build_exhibit_actions_dropdown(clean_uuid, encoded_uuid, 'Exhibit', state_config.is_published));

        // Re-initialize dropdown handlers for this new dropdown
        setup_exhibit_action_handlers();
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

            // Handle 403 Forbidden
            if (response?.status === EXHIBIT_CONSTANTS.HTTP_FORBIDDEN) {
                show_message('danger', 'You do not have permission to publish this record');
                return false;
            }

            // Handle 422 Unprocessable Entity - exhibit must contain at least one item
            if (response?.status === EXHIBIT_CONSTANTS.HTTP_UNPROCESSABLE_ENTITY) {
                show_message('warning', 'Exhibit must contain at least one item to publish');
                return false;
            }

            if (response?.status === 429) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                const message = response.data.message;
                const message_element = document.querySelector('#message');
                display_message(message_element, 'warning', message);
                return false;
            }

            // Handle responses
            if (response?.status === EXHIBIT_CONSTANTS.HTTP_OK) {
                update_exhibit_status_ui_generic(uuid, EXHIBIT_STATES.PUBLISHED);
                update_exhibit_actions_ui_generic(clean_uuid, EXHIBIT_STATES.PUBLISHED);
            } else if (!response) {
                show_message('danger', 'Unable to publish exhibit. Please check your connection and try again.');
            }

            return false;

        } catch (error) {
            console.error('Error publishing exhibit:', error);
            show_message('danger', get_user_friendly_error_message(error));
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

            // Handle 403 Forbidden
            if (response?.status === EXHIBIT_CONSTANTS.HTTP_FORBIDDEN) {
                show_message('danger', 'You do not have permission to unpublish this record');
                return false;
            }

            if (response?.status === 429) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                const message = response.data.message;
                const message_element = document.querySelector('#message');
                display_message(message_element, 'warning', message);
                return false;
            }

            // Handle responses
            if (response?.status === EXHIBIT_CONSTANTS.HTTP_OK) {
                update_exhibit_status_ui_generic(uuid, EXHIBIT_STATES.SUPPRESSED);
                update_exhibit_actions_ui_generic(clean_uuid, EXHIBIT_STATES.SUPPRESSED);
            } else if (!response) {
                show_message('danger', 'Unable to unpublish exhibit. Please check your connection and try again.');
            }

            return false;

        } catch (error) {
            console.error('Error suppressing exhibit:', error);
            show_message('danger', get_user_friendly_error_message(error));
            return false;
        }
    }

    /**
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
        window.scrollTo({top: 0, behavior: 'smooth'});

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

    /**
     * Creates a shared preview URL for an exhibit
     * @param {string} uuid - The exhibit UUID
     * @returns {Promise<boolean>} - Returns false to prevent default behavior
     */
    obj.create_shared_preview_url = async function (uuid) {
        // Constants
        const TOKEN_ERROR_DELAY = 1000;
        const SUCCESS_DISPLAY_DELAY = 900;
        const SHARED_URL_EXPIRY_DAYS = 7;
        const HTTP_CREATED = 201;

        // Input validation
        if (!uuid || typeof uuid !== 'string') {
            show_info_message('#shared-url', 'Invalid exhibit UUID provided');
            return false;
        }

        // Validate UUID format
        if (!/^[a-f0-9-]+$/i.test(uuid)) {
            show_info_message('#shared-url', 'Invalid UUID format');
            return false;
        }

        // Show loading state
        show_info_message('#shared-url', 'Generating Shared URL...');

        // Get endpoints and token
        const exhibits_endpoints = endpointsModule.get_exhibits_endpoints();
        const token = authModule.get_user_token();

        // Validate token
        if (!token || token === false) {
            setTimeout(() => {
                show_info_message('#message', 'Unable to get session token');
                authModule.logout();
            }, TOKEN_ERROR_DELAY);
            return false;
        }

        // Encode UUID for URL safety
        const encoded_uuid = encodeURIComponent(uuid);

        // Make API request
        const response = await httpModule.req({
            method: 'POST',
            url: `${exhibits_endpoints.exhibits.exhibit_shared.get.endpoint}?uuid=${encoded_uuid}`,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            validateStatus: (status) => status >= 200 && status < 600
        });

        // Handle 403 Forbidden
        if (response?.status === EXHIBIT_CONSTANTS.HTTP_FORBIDDEN) {
            show_error_message('#shared-url', 'You do not have permission to create a shared URL for this exhibit');
            return false;
        }

        // Handle successful response
        if (response?.status === HTTP_CREATED && response.data?.shared_url) {
            // Validate the shared URL
            if (!is_valid_url(response.data.shared_url)) {
                show_error_message('#shared-url', 'Invalid shared URL received from server');
                return false;
            }

            // Store the URL for copying
            const copy_target = document.querySelector('#shared-url-copy');
            if (copy_target) {
                copy_target.textContent = response.data.shared_url;
            }

            // Display success message with slight delay for UX
            setTimeout(() => {
                display_shared_url_success(SHARED_URL_EXPIRY_DAYS);
            }, SUCCESS_DISPLAY_DELAY);
        } else {
            // Handle unexpected response
            const error_message = response?.data?.message || 'Failed to create shared URL';
            show_info_message('#shared-url', error_message);
        }

        return false;
    };

    /**
     * Validates if a string is a valid URL
     * @param {string} url_string - The URL to validate
     * @returns {boolean} - True if valid URL
     */
    function is_valid_url(url_string) {
        try {
            const url = new URL(url_string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    /**
     * Displays the shared URL success message
     * @param {number} expiry_days - Number of days until expiry
     */
    function display_shared_url_success(expiry_days) {
        const container = document.querySelector('#shared-url');

        if (!container) {
            console.error('Shared URL container not found');
            return;
        }

        // Clear existing content
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Create wrapper div
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex align-items-center';

        // Create paragraph element
        const paragraph = document.createElement('p');

        // Create "Shared URL created" text
        const created_text = document.createTextNode('- Shared URL created.\u00A0\u00A0');
        paragraph.appendChild(created_text);

        // Create copy button
        const copy_button = document.createElement('button');
        copy_button.type = 'button';
        copy_button.className = 'btn btn-sm btn-primary';
        copy_button.setAttribute('aria-label', 'Copy shared URL');

        // Add click handler directly (no inline onclick)
        copy_button.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof exhibitsModule !== 'undefined' && typeof exhibitsModule.copy === 'function') {
                exhibitsModule.copy();
            } else {
                console.error('exhibitsModule.copy is not available');
            }
        });

        const copy_icon = document.createElement('i');
        copy_icon.className = 'fa fa-copy';
        copy_icon.setAttribute('aria-hidden', 'true');

        const copy_text = document.createTextNode(' Copy');

        copy_button.appendChild(copy_icon);
        copy_button.appendChild(copy_text);
        paragraph.appendChild(copy_button);

        // Add line break
        const br = document.createElement('br');
        paragraph.appendChild(br);

        // Add expiry text
        const expiry_text = document.createTextNode(`- Shared URL expires in ${expiry_days} days.`);
        paragraph.appendChild(expiry_text);

        // Assemble and append
        wrapper.appendChild(paragraph);
        container.appendChild(wrapper);
    }

    /**
     * Displays an info message in the specified container
     * @param {string} selector - CSS selector for the container
     * @param {string} message - Message to display
     */
    function show_info_message(selector, message) {
        display_alert_message(selector, 'info', message, 'fa-info-circle');
    }

    /**
     * Displays an error message in the specified container
     * @param {string} selector - CSS selector for the container
     * @param {string} message - Message to display
     */
    function show_error_message(selector, message) {
        display_alert_message(selector, 'danger', message, 'fa-exclamation-circle');
    }

    /**
     * Displays an alert message in the specified container
     * @param {string} selector - CSS selector for the container
     * @param {string} type - Alert type ('info', 'danger', 'warning', 'success')
     * @param {string} message - Message to display
     * @param {string} icon_class - FontAwesome icon class
     */
    function display_alert_message(selector, type, message, icon_class) {
        const container = document.querySelector(selector);

        if (!container) {
            console.error(`Container not found: ${selector}`);
            return;
        }

        // Clear existing content
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Create alert element
        const alert_div = document.createElement('div');
        alert_div.className = `alert alert-${type}`;
        alert_div.setAttribute('role', 'alert');

        // Create icon
        const icon = document.createElement('i');
        icon.className = `fa ${icon_class}`;
        icon.setAttribute('aria-hidden', 'true');

        // Create message text
        const message_text = document.createTextNode(` ${message}`);

        // Assemble and append
        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);
        container.appendChild(alert_div);
    }

    /**
     * Copies the shared URL to the clipboard
     * @returns {Promise<void>}
     */
    obj.copy = async function () {
        const COPY_MESSAGE_DURATION = 5000;
        const COPY_MESSAGE_SELECTOR = '#copy-message';
        const SHARED_URL_SELECTOR = '#shared-url-copy';

        try {
            // Get the shared URL element
            const url_element = document.querySelector(SHARED_URL_SELECTOR);

            if (!url_element) {
                throw new Error('Shared URL element not found');
            }

            // Get and validate the URL text
            const shared_url = url_element.textContent.trim();

            if (!shared_url) {
                throw new Error('No URL available to copy');
            }

            // Validate URL format
            if (!is_valid_url(shared_url)) {
                throw new Error('Invalid URL format');
            }

            // Attempt to copy to clipboard
            await copy_to_clipboard(shared_url);

            // Show success message
            show_copy_success_message(COPY_MESSAGE_SELECTOR, COPY_MESSAGE_DURATION);

        } catch (error) {
            console.error('Error copying to clipboard:', error);
            show_copy_error_message(COPY_MESSAGE_SELECTOR, get_user_friendly_error_message(error));
        }
    };

    /**
     * Copies text to clipboard with fallback support
     * @param {string} text - Text to copy
     * @returns {Promise<void>}
     * @throws {Error} - If copy operation fails
     */
    async function copy_to_clipboard(text) {
        // Try modern Clipboard API first (requires HTTPS)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return;
            } catch (error) {
                console.warn('Clipboard API failed, trying fallback:', error);
                // Fall through to legacy method
            }
        }

        // Fallback for older browsers or when Clipboard API is not available
        return copy_to_clipboard_fallback(text);
    }

    /**
     * Fallback clipboard copy for environments without Clipboard API
     * (non-secure contexts and very old browsers). Relies on the
     * deprecated document.execCommand('copy'), which may be removed
     * from future browser versions — when the minimum supported browser
     * is confirmed to always provide navigator.clipboard in the contexts
     * this app runs in, this whole function can be deleted.
     * @param {string} text - Text to copy
     * @throws {Error} - If copy operation fails
     */
    function copy_to_clipboard_fallback(text) {

        console.warn('copy_to_clipboard_fallback: using deprecated document.execCommand("copy") — Clipboard API was unavailable or failed.');

        // Create temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;

        // Prevent scrolling and make invisible
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        textarea.setAttribute('readonly', '');
        textarea.setAttribute('aria-hidden', 'true');

        // Add to DOM
        document.body.appendChild(textarea);

        try {
            // Select and copy
            textarea.select();
            textarea.setSelectionRange(0, text.length); // For mobile devices

            const successful = document.execCommand('copy');

            if (!successful) {
                throw new Error('Copy command was unsuccessful');
            }
        } finally {
            // Always remove the temporary element
            document.body.removeChild(textarea);
        }
    }

    /**
     * Displays a success message after copying
     * @param {string} selector - CSS selector for message container
     * @param {number} duration - How long to display the message
     */
    function show_copy_success_message(selector, duration) {
        const container = document.querySelector(selector);

        if (!container) {
            console.warn(`Copy message container not found: ${selector}`);
            return;
        }

        // Clear existing content
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Create alert element
        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-info';
        alert_div.setAttribute('role', 'alert');

        // Create icon
        const icon = document.createElement('i');
        icon.className = 'fa fa-info-circle';
        icon.setAttribute('aria-hidden', 'true');

        // Create message text
        const message_text = document.createTextNode(' URL copied to clipboard!');

        // Assemble
        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);
        container.appendChild(alert_div);

        // Auto-clear after duration
        setTimeout(() => {
            if (container.firstChild === alert_div) {
                container.removeChild(alert_div);
            }
        }, duration);
    }

    /**
     * Displays an error message after failed copy
     * @param {string} selector - CSS selector for message container
     * @param {string} error_message - Error message to display
     */
    function show_copy_error_message(selector, error_message) {
        const container = document.querySelector(selector);

        if (!container) {
            console.error(`Copy message container not found: ${selector}`);
            return;
        }

        // Clear existing content
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Create alert element
        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        // Create icon
        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation-circle';
        icon.setAttribute('aria-hidden', 'true');

        // Create message text (sanitize error message)
        const safe_error = error_message || 'Failed to copy URL to clipboard';
        const message_text = document.createTextNode(` ${safe_error}`);

        // Assemble
        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);
        container.appendChild(alert_div);
    }

    /**
     * Initializes the exhibits module
     * Verifies authentication, loads exhibits, and sets up the UI
     * @returns {Promise<void>}
     */
    obj.init = async function () {

        try {
            // Validate authentication first
            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.warn('No authentication token available');
                authModule.logout();
                return;
            }

            // Verify token is valid
            const is_authenticated = await authModule.check_auth(token);

            if (!is_authenticated) {
                console.warn('Authentication check failed');
                authModule.logout();
                return;
            }

            // Load and display exhibits first
            await display_exhibits_safely();

            // Then initialize UI components after exhibits are rendered
            initialize_ui_components();

        } catch (error) {
            console.error('Error initializing exhibits module:', error);
            handle_init_error(error);
        }
    };

    /**
     * Safely displays exhibits with error handling
     * @returns {Promise<void>}
     */
    async function display_exhibits_safely() {
        try {
            await exhibitsModule.display_exhibits();
        } catch (error) {
            console.error('Error displaying exhibits:', error);
            throw new Error('Failed to load exhibits. Please refresh the page.');
        }
    }

    /**
     * Initializes UI components (form and navigation)
     */
    function initialize_ui_components() {

        try {
            if (typeof helperModule !== 'undefined' && typeof helperModule.show_form === 'function') {
                helperModule.show_form();
            } else {
                console.warn('helperModule.show_form is not available');
            }

            if (typeof navModule !== 'undefined' && typeof navModule.set_logout_link === 'function') {
                navModule.set_logout_link();
            } else {
                console.warn('navModule.set_logout_link is not available');
            }
        } catch (error) {
            console.error('Error initializing UI components:', error);
            // Non-critical error, log but don't throw
        }
    }

    /**
     * Handles initialization errors by displaying appropriate messages
     * @param {Error} error - The error that occurred
     */
    function handle_init_error(error) {
        const message_container = document.querySelector('#message');

        if (!message_container) {
            console.error('Message container not found, cannot display error to user');
            return;
        }

        // Clear existing content
        while (message_container.firstChild) {
            message_container.removeChild(message_container.firstChild);
        }

        // Create alert element safely
        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        // Create icon
        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation-circle';
        icon.setAttribute('aria-hidden', 'true');

        // Create safe error message
        const error_message = get_user_friendly_error_message(error);
        const message_text = document.createTextNode(` ${error_message}`);

        // Assemble and display
        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);
        message_container.appendChild(alert_div);
    }

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
            'clipboard': 'Unable to copy to clipboard. Please try again.',
            'copy': 'Unable to copy to clipboard. Please try again.',
            'url': 'Invalid URL. Please try again.'
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

    return obj;

}());