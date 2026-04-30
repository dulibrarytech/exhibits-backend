/**
 * Copyright 2026 University of Denver
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

const mediaLibraryModule = (function() {

    'use strict';

    // Shared helpers
    const sanitize_html = helperMediaLibraryModule.escape_html;
    const HTTP_STATUS = helperMediaLibraryModule.HTTP_STATUS;
    const format_file_size = helperMediaLibraryModule.format_file_size;
    const build_thumbnail_url = helperMediaLibraryModule.build_thumbnail_url;
    const build_media_url = helperMediaLibraryModule.build_media_url;
    const get_repo_thumbnail_url = helperMediaLibraryModule.get_repo_thumbnail_url;
    const get_media_library_endpoints = endpointsModule.get_media_library_endpoints;

    /**
     * Strip HTML tags from a string
     * @param {string} value - String potentially containing HTML
     * @returns {string} Plain text with HTML tags removed
     */
    const strip_html = (value) => {
        if (!value || typeof value !== 'string') {
            return value || '';
        }
        const tmp = document.createElement('div');
        tmp.innerHTML = value;
        return tmp.textContent || tmp.innerText || '';
    };

    let obj = {};

    // DataTable instance reference
    let media_data_table = null;

    // Exhibit filter state
    let exhibit_titles_cache = null;   // Map<uuid, title>
    let selected_exhibit_uuid = null;  // Currently selected exhibit UUID for filtering

    // Image file extensions for thumbnail display
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

    // Thumbnail dimensions
    const THUMBNAIL_SIZE = {
        width: 50,
        height: 50
    };

    // Placeholder image for missing thumbnails
    const PLACEHOLDER_IMAGE = '/exhibits-dashboard/static/images/image-tn.png';

    /**
     * Check if filename is an image type
     * @param {string} filename - Filename to check
     * @returns {boolean} True if file is an image
     */
    const is_image_file = (filename) => {
        if (!filename || typeof filename !== 'string') {
            return false;
        }

        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return IMAGE_EXTENSIONS.includes(ext);
    };

    /**
     * Format date for display
     * @param {string|Date} date_value - Date to format
     * @returns {string} Formatted date string (MM/DD/YYYY @ HH:MM:SS)
     */
    const format_date = (date_value) => {
        if (!date_value) {
            return 'N/A';
        }

        try {
            const date = new Date(date_value);

            if (isNaN(date.getTime())) {
                return 'N/A';
            }

            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return `${month}/${day}/${year} @ ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'N/A';
        }
    };

    /**
     * Get icon class for alert type
     * @param {string} alert_type - Type of alert
     * @returns {string} Font Awesome icon class
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
     * Display message to user
     * @param {HTMLElement} element - Element to display message in
     * @param {string} type - Message type (info, success, danger, warning)
     * @param {string} message - Message text
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
     * Clear message display
     * @param {HTMLElement} element - Element to clear
     */
    const clear_message = (element) => {
        if (element) {
            element.textContent = '';
        }
    };

    /**
     * Get media records from API
     * @returns {Promise<Array|boolean>} Array of media records or false on failure
     */
    obj.get_media_records = async function() {

        const message_element = document.querySelector('#message');

        try {
            // Get endpoints configuration
            const MEDIA_ENDPOINTS = get_media_library_endpoints();

            if (!MEDIA_ENDPOINTS?.media_records?.get?.endpoint) {
                display_message(message_element, 'danger', 'Media records endpoint not configured');
                return false;
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Session expired. Please log in again.');
                return false;
            }

            // Construct endpoint
            const endpoint = MEDIA_ENDPOINTS.media_records.get.endpoint;

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

            // Handle undefined response (network/server error)
            if (!response) {
                display_message(message_element, 'danger', 'Unable to retrieve media records. Please check your connection and try again.');
                return false;
            }

            // Handle 403 Forbidden
            if (response.status === HTTP_STATUS.FORBIDDEN) {
                display_message(message_element, 'danger', 'You do not have permission to view media records');
                return false;
            }

            // Handle 404 Not Found (no records)
            if (response.status === HTTP_STATUS.NOT_FOUND) {
                // Not an error - just no records found
                return [];
            }

            // Handle successful response
            if (response.status === HTTP_STATUS.OK && response.data?.success) {
                // Clear any previous error/warning messages on success, but
                // preserve success/info alerts written by other flows (e.g., a
                // post-delete success alert that triggered this refresh).
                const existing_alert = message_element?.querySelector('.alert');
                const preserve = existing_alert && (
                    existing_alert.classList.contains('alert-success') ||
                    existing_alert.classList.contains('alert-info')
                );
                if (!preserve) {
                    clear_message(message_element);
                }
                return response.data.data || [];
            }

            // Handle other error responses
            const error_message = response.data?.message || 'Failed to retrieve media records. Please try again.';
            display_message(message_element, 'danger', error_message);
            return false;

        } catch (error) {
            console.error('Error fetching media records:', error);
            display_message(message_element, 'danger', 'An unexpected error occurred while retrieving media records.');
            return false;
        }
    };

    /**
     * Get a single media record by UUID.
     *
     * @param {string} uuid - Media record UUID
     * @returns {Promise<{record: Object|null, status: number|null}>}
     *   record: media record data on success, null otherwise.
     *   status: HTTP status when a response was received; null on
     *           pre-request validation failure or network/timeout
     *           error. The caller uses status to surface a context-
     *           specific message (403 vs 404 vs network) instead of
     *           one generic alert.
     */
    obj.get_media_record = async function(uuid) {

        try {

            const MEDIA_ENDPOINTS = get_media_library_endpoints();

            if (!uuid || typeof uuid !== 'string') {
                console.error('Invalid UUID provided');
                return { record: null, status: null };
            }

            // Validate endpoint configuration
            if (!MEDIA_ENDPOINTS?.media_record?.get?.endpoint) {
                console.error('Media record get endpoint not configured');
                return { record: null, status: null };
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.error('Session expired');
                return { record: null, status: null };
            }

            // Construct endpoint with media_id
            const endpoint = MEDIA_ENDPOINTS.media_record.get.endpoint.replace(':media_id', uuid);

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

            // Handle response
            if (!response) {
                console.error('No response from server');
                return { record: null, status: null };
            }

            if (response.status === HTTP_STATUS.OK && response.data?.success) {
                return { record: response.data.data, status: response.status };
            }

            console.error('Failed to get media record:', response.data?.message);
            return { record: null, status: response.status };

        } catch (error) {
            console.error('Error getting media record:', error);
            return { record: null, status: null };
        }
    };

    /**
     * Handle edit button click
     * @param {string} uuid - Media record UUID
     */
    const handle_edit_click = async (uuid) => {
        if (!uuid) {
            console.error('No UUID provided for edit');
            return;
        }

        // Open edit modal directly via mediaEditModalModule. The
        // mediaModalsModule.open_edit_media_modal shim was a deprecated
        // delegate; routing through it added a stack frame for no
        // benefit and obscured the actual owning module.
        if (typeof mediaEditModalModule !== 'undefined' && typeof mediaEditModalModule.open_edit_media_modal === 'function') {
            await mediaEditModalModule.open_edit_media_modal(uuid, async () => {
                // Refresh the data table after edit
                await obj.refresh_media_records();
            });
        } else {
            console.error('mediaEditModalModule.open_edit_media_modal not available');
        }
    };

    /**
     * Open the Kaltura view media modal
     * @param {string} name - Media record name
     * @param {string} kaltura_entry_id - Kaltura entry ID
     * @param {string} ingest_method - Ingest method label
     * @param {string} kaltura_thumbnail_url - Kaltura thumbnail URL
     * @param {string} media_type - Media type (audio or video)
     */
    const open_kaltura_view_modal = (name, kaltura_entry_id, ingest_method, kaltura_thumbnail_url, media_type) => {

        const modal = document.getElementById('view-kaltura-media-modal');

        if (!modal) {
            console.error('Kaltura view media modal not found');
            return;
        }

        // Set the record data for the player Play button bridge
        if (typeof kalturaModalsModule !== 'undefined' && typeof kalturaModalsModule.set_view_modal_record === 'function') {
            kalturaModalsModule.set_view_modal_record({
                kaltura_entry_id: kaltura_entry_id || '',
                name: name || '',
                item_type: media_type || ''
            });
        }

        // Populate modal fields
        const name_el = document.getElementById('view-kaltura-media-name');
        const entry_id_el = document.getElementById('view-kaltura-media-entry-id');
        const ingest_method_el = document.getElementById('view-kaltura-media-ingest-method');
        const image_el = document.getElementById('view-kaltura-media-image');
        const placeholder_el = document.getElementById('view-kaltura-media-placeholder');

        if (name_el) name_el.textContent = name || '-';
        if (entry_id_el) entry_id_el.textContent = kaltura_entry_id || '-';
        if (ingest_method_el) ingest_method_el.textContent = ingest_method || 'Kaltura';

        // Show thumbnail or placeholder
        if (kaltura_thumbnail_url && image_el) {
            image_el.src = kaltura_thumbnail_url;
            image_el.alt = 'Thumbnail for ' + (name || 'Kaltura media');
            image_el.style.display = 'block';
            if (placeholder_el) placeholder_el.style.display = 'none';

            image_el.onerror = function() {
                this.style.display = 'none';
                if (placeholder_el) placeholder_el.style.display = 'block';
            };
        } else {
            if (image_el) image_el.style.display = 'none';
            if (placeholder_el) placeholder_el.style.display = 'block';
        }

        // Show modal (Bootstrap 4)
        if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal).modal('show');
        } else if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const bs_modal = new bootstrap.Modal(modal);
            bs_modal.show();
        }
    };

    /**
     * Initialize Kaltura view modal close handlers
     */
    const init_kaltura_view_modal = () => {

        const modal = document.getElementById('view-kaltura-media-modal');

        if (!modal) return;

        const close_btn = document.getElementById('view-kaltura-media-close-btn');
        const cancel_btn = document.getElementById('view-kaltura-media-cancel-btn');

        const close_modal = () => {
            if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
                $(modal).modal('hide');
            } else if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const bs_modal = bootstrap.Modal.getInstance(modal);
                if (bs_modal) bs_modal.hide();
            }
        };

        if (close_btn) close_btn.addEventListener('click', close_modal);
        if (cancel_btn) cancel_btn.addEventListener('click', close_modal);
    };

    /**
     * Handle thumbnail click to view media
     * @param {string} uuid - Media record UUID
     * @param {string} name - Media record name
     * @param {string} filename - Original filename for display
     * @param {string} size - Formatted file size
     * @param {string} media_type - Media type (image, pdf, etc.)
     * @param {string} ingest_method - Ingest method (upload, repository, kaltura)
     * @param {string} repo_uuid - Repository item UUID (for repo items)
     * @param {string} repo_handle - Repository handle URL (for repo items)
     * @param {string} kaltura_thumbnail_url - Kaltura thumbnail URL (for kaltura items)
     * @param {string} kaltura_entry_id - Kaltura entry ID (for kaltura items)
     */
    const handle_view_click = (uuid, name, filename, size, media_type, ingest_method, repo_uuid, repo_handle, kaltura_thumbnail_url, kaltura_entry_id) => {
        if (!uuid) {
            console.error('No UUID provided for view');
            return;
        }

        // Kaltura items: open player modal directly
        if (ingest_method === 'kaltura') {

            if (typeof kalturaModalsModule !== 'undefined' && typeof kalturaModalsModule.open_kaltura_player_modal === 'function') {
                kalturaModalsModule.open_kaltura_player_modal({
                    kaltura_entry_id: kaltura_entry_id || '',
                    name: name || '',
                    item_type: media_type || ''
                });
            } else {
                console.error('kalturaModalsModule.open_kaltura_player_modal not available');
            }

            return;
        }

        // Repository items: use repoModalsModule which handles repo thumbnail URLs
        if (ingest_method === 'repository' && typeof repoModalsModule !== 'undefined' && typeof repoModalsModule.open_view_media_modal === 'function') {
            repoModalsModule.open_view_media_modal(uuid, name, filename, size, media_type, ingest_method, repo_uuid, repo_handle);
            return;
        }

        // Uploaded items: use mediaModalsModule
        if (typeof mediaModalsModule !== 'undefined' && typeof mediaModalsModule.open_view_media_modal === 'function') {
            mediaModalsModule.open_view_media_modal(uuid, name, filename, size, media_type, ingest_method);
        } else {
            console.error('mediaModalsModule.open_view_media_modal not available');
        }
    };

    /**
     * Handle delete button click
     * @param {string} uuid - Media record UUID
     * @param {string} name - Media record name for confirmation
     * @param {string} filename - Original filename for display
     * @param {string} item_type - Item type for icon display
     * @param {string} thumbnail_url - Thumbnail URL for preview display
     */
    const handle_delete_click = async (uuid, name, filename, item_type, thumbnail_url) => {
        if (!uuid) {
            console.error('No UUID provided for delete');
            return;
        }

        const message_element = document.querySelector('#message');

        if (typeof mediaDeleteModalModule === 'undefined' || typeof mediaDeleteModalModule.open_delete_media_modal !== 'function') {
            console.error('mediaDeleteModalModule.open_delete_media_modal not available');
            display_message(message_element, 'danger', 'Delete dialog is not available. Please refresh the page.');
            return;
        }

        mediaDeleteModalModule.open_delete_media_modal(uuid, name, filename, item_type, thumbnail_url, async (success, message) => {
            if (success) {
                display_message(message_element, 'success', message || 'Media record deleted successfully.');

                await obj.refresh_media_records();

                setTimeout(() => {
                    clear_message(message_element);
                }, 3000);
            }
        });
    };

    /**
     * Build actions column HTML with vertical ellipsis dropdown
     * @param {Object} row - DataTable row data
     * @returns {string} HTML string for actions column
     */
    const build_actions_html = (row) => {
        const uuid = row.uuid || '';
        const name = row.name || 'Untitled';
        const filename = row.filename || 'Unknown file';
        const item_type = row.item_type || 'unknown';
        const escaped_name = sanitize_html(name);
        const escaped_filename = sanitize_html(filename);

        // Build Play action for Kaltura items
        let play_action_html = '';

        if (row.ingest_method === 'kaltura' && row.kaltura_entry_id) {
            play_action_html = `
                    <a class="dropdown-item btn-play-kaltura" 
                       href="#" 
                       data-uuid="${uuid}"
                       data-name="${escaped_name}"
                       data-kaltura-entry-id="${sanitize_html(row.kaltura_entry_id)}"
                       data-media-type="${sanitize_html(row.media_type || '')}"
                       style="font-size: 0.875rem;">
                        <i class="fa fa-play-circle mr-2" aria-hidden="true" style="width: 16px;"></i>
                        Play
                    </a>
                    <div class="dropdown-divider"></div>`;
        }

        return `
            <div class="dropdown" style="display: inline-block; position: relative;">
                <button type="button" 
                        class="btn btn-link p-0 border-0 media-actions-toggle" 
                        style="color: #6c757d; font-size: 1.25rem; line-height: 1; background: none;"
                        data-toggle="dropdown"
                        data-bs-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false"
                        aria-label="Actions for ${escaped_name}"
                        title="Actions">
                    <i class="fa fa-ellipsis-v" aria-hidden="true"></i>
                </button>
                <div class="dropdown-menu media-actions-menu" aria-label="Actions menu for ${escaped_name}">
                    ${play_action_html}
                    <a class="dropdown-item btn-edit-media" 
                       href="#" 
                       data-uuid="${uuid}"
                       style="font-size: 0.875rem;">
                        <i class="fa fa-edit mr-2" aria-hidden="true" style="width: 16px;"></i>
                        Edit
                    </a>
                    <a class="dropdown-item btn-delete-media text-danger" 
                       href="#" 
                       data-uuid="${uuid}"
                       data-name="${escaped_name}"
                       data-filename="${escaped_filename}"
                       data-item-type="${item_type}"
                       data-thumbnail-url="${row.delete_thumbnail_url || ''}"
                       style="font-size: 0.875rem;">
                        <i class="fa fa-trash mr-2" aria-hidden="true" style="width: 16px;"></i>
                        Delete
                    </a>
                </div>
            </div>
        `;
    };

    /**
     * Setup action button event handlers and initialize dropdowns
     */
    const setup_action_handlers = () => {
        // Inject CSS for dropdown positioning and thumbnail hover
        if (!document.getElementById('media-actions-dropdown-styles')) {
            const style = document.createElement('style');
            style.id = 'media-actions-dropdown-styles';
            style.textContent = `
                .media-actions-menu.dropdown-menu {
                    right: 0 !important;
                    left: auto !important;
                    transform: none !important;
                    margin-top: 0;
                }
                .media-actions-menu.dropdown-menu.show {
                    right: 0 !important;
                    left: auto !important;
                    transform: none !important;
                }
                .media-thumbnail-clickable:hover {
                    opacity: 0.8;
                    box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
                    transition: opacity 0.2s, box-shadow 0.2s;
                }
            `;
            document.head.appendChild(style);
        }

        // Initialize Bootstrap dropdowns (support both Bootstrap 4 and 5)
        document.querySelectorAll('.media-actions-toggle').forEach(toggle => {
            // Bootstrap 5
            if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                new bootstrap.Dropdown(toggle);
            }
            // Bootstrap 4 - uses jQuery
            else if (typeof $ !== 'undefined' && typeof $.fn.dropdown !== 'undefined') {
                $(toggle).dropdown();
            }
        });

        // Close dropdowns when clicking outside
        document.removeEventListener('click', close_open_dropdowns);
        document.addEventListener('click', close_open_dropdowns);

        // Thumbnail click handlers for viewing media
        document.querySelectorAll('.media-thumbnail-clickable').forEach(thumbnail => {
            thumbnail.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const uuid = this.getAttribute('data-uuid');
                const name = this.getAttribute('data-name');
                const filename = this.getAttribute('data-filename');
                const size = this.getAttribute('data-size');
                const media_type = this.getAttribute('data-media-type');
                const ingest_method = this.getAttribute('data-ingest-method');
                const repo_uuid = this.getAttribute('data-repo-uuid');
                const repo_handle = this.getAttribute('data-repo-handle');
                const kaltura_thumbnail_url = this.getAttribute('data-kaltura-thumbnail-url');
                const kaltura_entry_id = this.getAttribute('data-kaltura-entry-id');
                handle_view_click(uuid, name, filename, size, media_type, ingest_method, repo_uuid, repo_handle, kaltura_thumbnail_url, kaltura_entry_id);
            });
        });

        // Edit button handlers (dropdown items)
        document.querySelectorAll('.btn-edit-media').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                close_open_dropdowns();
                const uuid = this.getAttribute('data-uuid');
                handle_edit_click(uuid);
            });
        });

        // Play button handlers for Kaltura items (dropdown items)
        document.querySelectorAll('.btn-play-kaltura').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                close_open_dropdowns();

                const record = {
                    kaltura_entry_id: this.getAttribute('data-kaltura-entry-id'),
                    name: this.getAttribute('data-name'),
                    item_type: this.getAttribute('data-media-type') || ''
                };

                if (typeof kalturaModalsModule !== 'undefined' && typeof kalturaModalsModule.open_kaltura_player_modal === 'function') {
                    kalturaModalsModule.open_kaltura_player_modal(record);
                } else {
                    console.error('kalturaModalsModule.open_kaltura_player_modal not available');
                }
            });
        });

        // Delete button handlers (dropdown items)
        document.querySelectorAll('.btn-delete-media').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                close_open_dropdowns();
                const uuid = this.getAttribute('data-uuid');
                const name = this.getAttribute('data-name');
                const filename = this.getAttribute('data-filename');
                const item_type = this.getAttribute('data-item-type');
                const thumbnail_url = this.getAttribute('data-thumbnail-url');
                handle_delete_click(uuid, name, filename, item_type, thumbnail_url);
            });
        });
    };

    /**
     * Close all open dropdown menus
     * @param {Event} [e] - Optional click event
     */
    const close_open_dropdowns = (e) => {
        // If event provided, check if click was inside a dropdown
        if (e && e.target.closest('.dropdown')) {
            return;
        }

        // Close all open dropdowns
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
            const toggle = menu.previousElementSibling;
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    };

    // ==================== EXHIBIT FILTER ====================

    /**
     * Fetches exhibit titles from the exhibits API and caches them.
     * @returns {Promise<Map<string, string>|null>} Map of uuid→title or null on failure
     */
    const fetch_exhibit_titles = async () => {

        if (exhibit_titles_cache !== null) {
            return exhibit_titles_cache;
        }

        try {

            const token = authModule.get_user_token();

            if (!token) {
                return null;
            }

            let endpoint = null;

            if (typeof endpointsModule !== 'undefined' && typeof endpointsModule.get_exhibits_endpoints === 'function') {
                const EXHIBIT_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
                endpoint = EXHIBIT_ENDPOINTS?.exhibits?.exhibit_records?.endpoint || null;
            }

            if (!endpoint) {
                console.warn('Exhibits endpoint not configured for filter');
                return null;
            }

            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 15000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            if (!response || response.status !== HTTP_STATUS.OK || !response.data) {
                return null;
            }

            // Handle both response shapes:
            // Exhibits module: { status: 200, message: '...', data: [...] }
            // Direct array: [...]
            const payload = response.data;
            const records = Array.isArray(payload) ? payload
                : Array.isArray(payload.data) ? payload.data
                : [];

            const titles_map = new Map();

            if (Array.isArray(records)) {
                records.forEach(record => {
                    if (record.uuid && record.title) {
                        titles_map.set(record.uuid, strip_html(record.title));
                    }
                });
            }

            exhibit_titles_cache = titles_map;
            return titles_map;

        } catch (error) {
            console.error('Error fetching exhibit titles:', error);
            return null;
        }
    };

    /**
     * Builds the searchable exhibit filter dropdown inside the DataTable layout
     * @param {Map<string, string>} titles_map - Map of exhibit UUID → title
     */
    const build_exhibit_filter = (titles_map) => {

        const container = document.getElementById('exhibit-filter-container');

        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (!titles_map || titles_map.size === 0) {
            return;
        }

        const sorted_entries = Array.from(titles_map.entries())
            .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));

        // Build wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'exhibit-filter-wrapper';
        wrapper.setAttribute('role', 'combobox');
        wrapper.setAttribute('aria-expanded', 'false');
        wrapper.setAttribute('aria-haspopup', 'listbox');
        wrapper.setAttribute('aria-label', 'Filter by Exhibit');

        // Label
        const label = document.createElement('label');
        label.className = 'exhibit-filter-label';
        label.setAttribute('for', 'exhibit-filter-input');
        label.textContent = 'Filter by Exhibit:';
        wrapper.appendChild(label);

        // Input container
        const input_container = document.createElement('div');
        input_container.className = 'exhibit-filter-input-container';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'exhibit-filter-input';
        input.className = 'exhibit-filter-input';
        input.placeholder = 'All exhibits';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('aria-controls', 'exhibit-filter-listbox');
        input.setAttribute('role', 'searchbox');
        input_container.appendChild(input);

        const clear_btn = document.createElement('button');
        clear_btn.type = 'button';
        clear_btn.className = 'exhibit-filter-clear d-none';
        clear_btn.innerHTML = '&times;';
        clear_btn.setAttribute('aria-label', 'Clear exhibit filter');
        clear_btn.setAttribute('tabindex', '-1');
        input_container.appendChild(clear_btn);

        const caret = document.createElement('span');
        caret.className = 'exhibit-filter-caret';
        caret.innerHTML = '<i class="fa fa-caret-down" aria-hidden="true"></i>';
        input_container.appendChild(caret);

        wrapper.appendChild(input_container);

        // Dropdown listbox
        const listbox = document.createElement('ul');
        listbox.id = 'exhibit-filter-listbox';
        listbox.className = 'exhibit-filter-listbox d-none';
        listbox.setAttribute('role', 'listbox');

        sorted_entries.forEach(([uuid, title]) => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.setAttribute('data-uuid', uuid);
            li.className = 'exhibit-filter-option';
            li.textContent = title;
            listbox.appendChild(li);
        });

        const empty_li = document.createElement('li');
        empty_li.className = 'exhibit-filter-empty d-none';
        empty_li.setAttribute('aria-live', 'polite');
        empty_li.textContent = 'No matching exhibits';
        listbox.appendChild(empty_li);

        wrapper.appendChild(listbox);
        container.appendChild(wrapper);

        // ---- Event handlers ----
        let active_index = -1;

        const open_list = () => {
            listbox.classList.remove('d-none');
            wrapper.setAttribute('aria-expanded', 'true');
        };

        const close_list = () => {
            listbox.classList.add('d-none');
            wrapper.setAttribute('aria-expanded', 'false');
            active_index = -1;
            listbox.querySelectorAll('.exhibit-filter-option.active').forEach(el => el.classList.remove('active'));
            input.removeAttribute('aria-activedescendant');
        };

        const get_visible_options = () => {
            return Array.from(listbox.querySelectorAll('.exhibit-filter-option:not(.d-none)'));
        };

        const set_active = (index) => {
            const options = get_visible_options();
            if (options.length === 0) return;

            listbox.querySelectorAll('.exhibit-filter-option.active').forEach(el => el.classList.remove('active'));

            if (index < 0) index = options.length - 1;
            if (index >= options.length) index = 0;
            active_index = index;
            options[active_index].classList.add('active');
            options[active_index].scrollIntoView({ block: 'nearest' });
            input.setAttribute('aria-activedescendant', options[active_index].getAttribute('data-uuid'));
        };

        const apply_filter = (uuid, title) => {
            selected_exhibit_uuid = uuid;
            input.value = title;
            clear_btn.classList.remove('d-none');
            caret.classList.add('d-none');
            close_list();
            if (media_data_table) {
                media_data_table.draw();
            }
        };

        const clear_filter = () => {
            selected_exhibit_uuid = null;
            input.value = '';
            clear_btn.classList.add('d-none');
            caret.classList.remove('d-none');
            close_list();
            filter_options('');
            if (media_data_table) {
                media_data_table.draw();
            }
        };

        const filter_options = (search_text) => {
            const lower = search_text.toLowerCase();
            let visible_count = 0;

            listbox.querySelectorAll('.exhibit-filter-option').forEach(li => {
                const match = li.textContent.toLowerCase().includes(lower);
                li.classList.toggle('d-none', !match);
                if (match) visible_count++;
            });

            empty_li.classList.toggle('d-none', visible_count > 0);
            active_index = -1;
        };

        input.addEventListener('focus', () => {
            if (!selected_exhibit_uuid) {
                filter_options(input.value);
                open_list();
            }
        });

        input.addEventListener('input', () => {
            if (selected_exhibit_uuid) {
                selected_exhibit_uuid = null;
                clear_btn.classList.add('d-none');
                caret.classList.remove('d-none');
                if (media_data_table) {
                    media_data_table.draw();
                }
            }
            filter_options(input.value);
            open_list();
        });

        input.addEventListener('keydown', (e) => {
            const options = get_visible_options();

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (listbox.classList.contains('d-none')) {
                        open_list();
                    }
                    set_active(active_index + 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    set_active(active_index - 1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (active_index >= 0 && active_index < options.length) {
                        const selected = options[active_index];
                        apply_filter(selected.getAttribute('data-uuid'), selected.textContent);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    if (!listbox.classList.contains('d-none')) {
                        close_list();
                    } else if (selected_exhibit_uuid) {
                        clear_filter();
                    }
                    break;
                case 'Tab':
                    close_list();
                    break;
            }
        });

        listbox.addEventListener('click', (e) => {
            const option = e.target.closest('.exhibit-filter-option');
            if (option) {
                apply_filter(option.getAttribute('data-uuid'), option.textContent);
            }
        });

        clear_btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clear_filter();
            input.focus();
        });

        caret.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (listbox.classList.contains('d-none')) {
                filter_options('');
                open_list();
                input.focus();
            } else {
                close_list();
            }
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                close_list();
            }
        });

        // Restore previous selection if set (e.g., after refresh)
        if (selected_exhibit_uuid && titles_map.has(selected_exhibit_uuid)) {
            input.value = titles_map.get(selected_exhibit_uuid);
            clear_btn.classList.remove('d-none');
            caret.classList.add('d-none');
        }
    };

    /**
     * Registers the DataTable custom search function for exhibit filtering.
     * Idempotent — subsequent calls are no-ops.
     */
    const register_exhibit_search_filter = (() => {
        let registered = false;

        return () => {
            if (registered) return;
            registered = true;

            if (typeof $ !== 'undefined' && typeof $.fn !== 'undefined' && typeof $.fn.dataTable !== 'undefined') {
                $.fn.dataTable.ext.search.push((settings, data, dataIndex, rowData) => {
                    if (settings.nTable && settings.nTable.id !== 'items') {
                        return true;
                    }
                    if (!selected_exhibit_uuid) {
                        return true;
                    }
                    const exhibits = rowData.exhibits;
                    if (!Array.isArray(exhibits) || exhibits.length === 0) {
                        return false;
                    }
                    return exhibits.includes(selected_exhibit_uuid);
                });
            }
        };
    })();

    /**
     * Display media records in DataTable
     * @returns {Promise<boolean>} True if successful, false otherwise
     */
    obj.display_media_records = async function() {
        const message_element = document.querySelector('#message');

        try {
            // Fetch records from API
            const records = await obj.get_media_records();

            // Check if fetch failed
            if (records === false) {
                return false;
            }

            // Destroy existing DataTable instance if it exists
            if (media_data_table !== null) {
                media_data_table.destroy();
                media_data_table = null;
            }

            // Clear existing table body
            const table_body = document.querySelector('#media-data');

            if (table_body) {
                table_body.innerHTML = '';
            }

            // Check if DataTable library is available
            if (typeof DataTable === 'undefined' && typeof $.fn.DataTable === 'undefined') {
                console.error('DataTable library not loaded');
                display_message(message_element, 'danger', 'Unable to display media records. Please refresh the page.');
                return false;
            }

            // Get auth token for thumbnail URLs
            const token = authModule.get_user_token();

            // Prepare data for DataTable
            const table_data = records.map(record => {

                // Determine if this item has a server-generated thumbnail
                const has_thumbnail = !!record.thumbnail_path;

                return {
                    uuid: record.uuid || null,
                    name: strip_html(record.name) || 'Untitled',
                    filename: record.original_filename || 'N/A',
                    thumbnail_url: has_thumbnail ? build_thumbnail_url(record.uuid) : null,
                    media_url: record.uuid ? build_media_url(record.uuid) : null,
                    has_thumbnail: has_thumbnail,
                    is_image: is_image_file(record.original_filename),
                    media_type: sanitize_html(record.media_type) || 'N/A',
                    mime_type: record.mime_type || null,
                    ingest_method: sanitize_html(record.ingest_method) || 'N/A',
                    created: record.created || null,
                    created_display: format_date(record.created),
                    created_by: sanitize_html(record.created_by) || null,
                    upload_uuid: record.upload_uuid || null,
                    repo_uuid: record.repo_uuid || null,
                    repo_handle: record.repo_handle || null,
                    kaltura_thumbnail_url: record.kaltura_thumbnail_url || null,
                    kaltura_entry_id: record.kaltura_entry_id || null,
                    size: record.size || 0,
                    size_display: format_file_size(record.size),
                    delete_thumbnail_url: (() => {
                        if (record.ingest_method === 'repository' && record.repo_uuid) {
                            return get_repo_thumbnail_url(record.repo_uuid);
                        }
                        if (record.ingest_method === 'kaltura' && record.kaltura_thumbnail_url) {
                            return record.kaltura_thumbnail_url;
                        }
                        if (has_thumbnail && record.uuid) {
                            const tn_url = build_thumbnail_url(record.uuid);
                            if (tn_url) {
                                return tn_url + (tn_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
                            }
                        }
                        return '';
                    })(),
                    exhibits: (() => {
                        if (!record.exhibits) return [];
                        if (Array.isArray(record.exhibits)) return record.exhibits;
                        if (typeof record.exhibits === 'string') {
                            try {
                                const parsed = JSON.parse(record.exhibits);
                                return Array.isArray(parsed) ? parsed : [];
                            } catch (e) {
                                return [];
                            }
                        }
                        return [];
                    })()
                };
            });

            // Initialize DataTable with configuration
            media_data_table = new DataTable('#items', {
                data: table_data,
                columns: [
                    {
                        data: 'name',
                        title: 'Name',
                        render: function(data, type, row) {
                            if (type === 'display') {
                                const display_name = data || 'Untitled';
                                let thumbnail_html = '';
                                const is_repo = row.ingest_method === 'repository';

                                if (is_repo && row.repo_uuid) {
                                    // Repository item: use repo thumbnail endpoint
                                    const repo_tn_url = get_repo_thumbnail_url(row.repo_uuid);
                                    if (repo_tn_url) {
                                        thumbnail_html = `
                                            <img src="${repo_tn_url}" 
                                                 alt="Thumbnail for ${display_name}"
                                                 class="media-thumbnail media-thumbnail-clickable"
                                                 style="width: ${THUMBNAIL_SIZE.width}px; height: ${THUMBNAIL_SIZE.height}px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; cursor: pointer;"
                                                 loading="lazy"
                                                 data-uuid="${row.uuid}" data-name="${sanitize_html(row.name)}" data-filename="${sanitize_html(row.filename)}" data-size="${row.size_display}" data-media-type="${row.media_type}" data-ingest-method="${row.ingest_method}" data-repo-uuid="${row.repo_uuid}" data-repo-handle="${row.repo_handle || ''}" title="Click to view"
                                                 data-fallback="placeholder" data-fallback-src="${PLACEHOLDER_IMAGE}">`;
                                    } else {
                                        thumbnail_html = `
                                            <img src="${PLACEHOLDER_IMAGE}" 
                                                 alt="Placeholder for ${display_name}"
                                                 class="media-thumbnail-placeholder media-thumbnail-clickable"
                                                 style="width: ${THUMBNAIL_SIZE.width}px; height: ${THUMBNAIL_SIZE.height}px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; cursor: pointer;"
                                                 data-uuid="${row.uuid}" data-name="${sanitize_html(row.name)}" data-filename="${sanitize_html(row.filename)}" data-size="${row.size_display}" data-media-type="${row.media_type}" data-ingest-method="${row.ingest_method}" data-repo-uuid="${row.repo_uuid}" data-repo-handle="${row.repo_handle || ''}" title="Click to view">`;
                                    }
                                } else if (row.ingest_method === 'kaltura' && row.kaltura_thumbnail_url) {
                                    // Kaltura item: use kaltura thumbnail URL from database
                                    thumbnail_html = `
                                        <img src="${row.kaltura_thumbnail_url}" 
                                             alt="Thumbnail for ${display_name}"
                                             class="media-thumbnail media-thumbnail-clickable"
                                             style="width: ${THUMBNAIL_SIZE.width}px; height: ${THUMBNAIL_SIZE.height}px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; cursor: pointer;"
                                             loading="lazy"
                                             data-uuid="${row.uuid}" data-name="${sanitize_html(row.name)}" data-ingest-method="${row.ingest_method}" data-media-type="${row.media_type || ''}" data-kaltura-thumbnail-url="${row.kaltura_thumbnail_url}" data-kaltura-entry-id="${row.kaltura_entry_id || ''}" title="Click to view"
                                             data-fallback="placeholder" data-fallback-src="${PLACEHOLDER_IMAGE}">`;
                                } else if (row.ingest_method === 'kaltura') {
                                    // Kaltura item without thumbnail: show place
                                    thumbnail_html = `
                                        <img src="${PLACEHOLDER_IMAGE}" 
                                             alt="Placeholder for ${display_name}"
                                             class="media-thumbnail-placeholder media-thumbnail-clickable"
                                             style="width: ${THUMBNAIL_SIZE.width}px; height: ${THUMBNAIL_SIZE.height}px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; cursor: pointer;"
                                             data-uuid="${row.uuid}" data-name="${sanitize_html(row.name)}" data-ingest-method="${row.ingest_method}" data-media-type="${row.media_type || ''}" data-kaltura-thumbnail-url="" data-kaltura-entry-id="${row.kaltura_entry_id || ''}" title="Click to view">`;
                                } else if (row.has_thumbnail && row.thumbnail_url) {
                                    // Uploaded item with server-generated thumbnail (images and PDFs)
                                    const is_viewable = row.ingest_method === 'upload' && (row.is_image || row.media_type === 'pdf');
                                    const tn_cursor_style = is_viewable ? 'cursor: pointer;' : '';
                                    const tn_clickable_class = is_viewable ? 'media-thumbnail-clickable' : '';
                                    const img_url = row.thumbnail_url + (row.thumbnail_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
                                    thumbnail_html = `
                                        <img src="${img_url}" 
                                             alt="Thumbnail for ${display_name}"
                                             class="media-thumbnail ${tn_clickable_class}"
                                             style="width: ${THUMBNAIL_SIZE.width}px; height: ${THUMBNAIL_SIZE.height}px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; ${tn_cursor_style}"
                                             loading="lazy"
                                             ${is_viewable ? `data-uuid="${row.uuid}" data-name="${sanitize_html(row.name)}" data-filename="${sanitize_html(row.filename)}" data-size="${row.size_display}" data-media-type="${row.media_type}" data-ingest-method="${row.ingest_method}" title="Click to view"` : ''}
                                             data-fallback="placeholder" data-fallback-src="${PLACEHOLDER_IMAGE}">`;
                                } else {
                                    // Placeholder image for items without thumbnails
                                    const is_upload_viewable = row.ingest_method === 'upload' && (row.is_image || row.media_type === 'pdf');
                                    const placeholder_clickable_class = is_upload_viewable ? 'media-thumbnail-clickable' : '';
                                    const placeholder_cursor_style = is_upload_viewable ? 'cursor: pointer;' : '';
                                    thumbnail_html = `
                                        <img src="${PLACEHOLDER_IMAGE}" 
                                             alt="Placeholder for ${display_name}"
                                             class="media-thumbnail-placeholder ${placeholder_clickable_class}"
                                             style="width: ${THUMBNAIL_SIZE.width}px; height: ${THUMBNAIL_SIZE.height}px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; ${placeholder_cursor_style}"
                                             ${is_upload_viewable ? `data-uuid="${row.uuid}" data-name="${sanitize_html(row.name)}" data-filename="${sanitize_html(row.filename)}" data-size="${row.size_display}" data-media-type="${row.media_type}" data-ingest-method="${row.ingest_method}" title="Click to view"` : ''}>`;
                                }

                                // Combine thumbnail and name
                                return `
                                    <div class="media-name-cell" style="display: flex; align-items: center;">
                                        ${thumbnail_html}
                                        <small class="media-name" title="${sanitize_html(display_name)}">${sanitize_html(display_name)}</small>
                                    </div>`;
                            }
                            return data;
                        }
                    },
                    {
                        data: 'filename',
                        title: 'File Name',
                        render: function(data, type, row) {
                            if (type === 'display') {
                                // Repository items: show "Repository media" instead of filename/size
                                if (row.ingest_method === 'repository') {
                                    return '<small><i class="fa fa-database" style="margin-right: 4px;" aria-hidden="true"></i>Repository media</small>';
                                }

                                // Kaltura items: show "Kaltura Media" with audio/video icon
                                // dispatched on media_type. Every other branch in this file
                                // reads media_type; mime_type was an inconsistent outlier
                                // (harmless today since Kaltura rows carry both, but worth
                                // harmonizing).
                                if (row.ingest_method === 'kaltura') {
                                    const kaltura_icon = row.media_type === 'audio' ? 'fa-volume-up' : 'fa-film';
                                    return '<small><i class="fa ' + kaltura_icon + '" style="margin-right: 4px;" aria-hidden="true"></i>Kaltura media</small>';
                                }

                                // Uploaded items: show filename with tooltip
                                const safe_filename = sanitize_html(data || 'N/A');
                                return `<small class="media-filename" title="${safe_filename}">${safe_filename}</small>`;
                            }
                            return data;
                        }
                    },
                    {
                        data: 'created',
                        title: 'Date Added',
                        render: function(data, type, row) {
                            // Use raw date for sorting, formatted string for display
                            if (type === 'sort' || type === 'type') {
                                return data ? new Date(data).getTime() : 0;
                            }
                            return `<small>${row.created_display}</small>`;
                        }
                    },
                    {
                        data: 'created_by',
                        title: 'Added By',
                        defaultContent: '<small>N/A</small>',
                        render: function(data, type, row) {
                            if (type === 'display') {
                                return `<small>${data || 'N/A'}</small>`;
                            }
                            return data || '';
                        }
                    },
                    {
                        data: null,
                        title: 'Actions',
                        orderable: false,
                        searchable: false,
                        className: 'text-center',
                        render: function(data, type, row) {
                            if (type === 'display') {
                                return build_actions_html(row);
                            }
                            return '';
                        }
                    }
                ],
                order: [[2, 'desc']], // Sort by created date descending
                pageLength: 25,
                lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
                responsive: true,
                autoWidth: false,
                language: {
                    emptyTable: 'No media files found in the library',
                    zeroRecords: 'No matching media files found',
                    info: 'Showing _START_ - _END_ of _TOTAL_ results',
                    infoEmpty: 'No media files available',
                    infoFiltered: '(filtered from _MAX_ total files)',
                    search: 'Search media:',
                    lengthMenu: 'Show _MENU_ files per page',
                    paginate: {
                        first: '<i class="fa fa-angle-double-left" aria-hidden="true"></i><span class="sr-only">First</span>',
                        last: '<i class="fa fa-angle-double-right" aria-hidden="true"></i><span class="sr-only">Last</span>',
                        next: '<i class="fa fa-chevron-right" aria-hidden="true"></i><span class="sr-only">Next</span>',
                        previous: '<i class="fa fa-chevron-left" aria-hidden="true"></i><span class="sr-only">Previous</span>'
                    }
                },
                dom: '<"row align-items-end"<"col-sm-12 col-md-3"l><"col-sm-12 col-md-6"<"#exhibit-filter-container">><"col-sm-12 col-md-3"f>>' +
                     '<"row"<"col-sm-12"tr>>' +
                     '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
                drawCallback: function() {
                    // Accessibility improvements after each draw
                    const table = this.api().table().node();

                    // Add scope attributes to header cells
                    table.querySelectorAll('thead th').forEach(th => {
                        th.setAttribute('scope', 'col');
                    });

                    // Setup action button handlers after each draw
                    setup_action_handlers();

                    // Wire CSP-safe <img> error handlers on the new
                    // thumbnails. Row markup carries data-fallback="placeholder"
                    // / data-fallback-src="..." instead of inline onerror.
                    helperMediaLibraryModule.wire_image_fallbacks(table);
                }
            });

            // Display success message if records exist
            if (records.length > 0) {
                console.debug(`Media library loaded: ${records.length} record(s)`);
            }

            // Register the exhibit custom search filter (idempotent)
            register_exhibit_search_filter();

            // Fetch exhibit titles and build the filter dropdown
            fetch_exhibit_titles().then(titles_map => {
                if (titles_map && titles_map.size > 0) {
                    build_exhibit_filter(titles_map);
                    // Re-apply filter if a selection was preserved from previous load
                    if (selected_exhibit_uuid && media_data_table) {
                        media_data_table.draw();
                    }
                }
            }).catch(err => {
                console.warn('Could not load exhibit filter:', err);
            });

            return true;

        } catch (error) {
            console.error('Error displaying media records:', error);
            display_message(message_element, 'danger', 'An unexpected error occurred while displaying media records.');
            return false;
        }
    };

    /**
     * Refresh the media records display
     * @returns {Promise<boolean>} True if successful
     */
    obj.refresh_media_records = async function() {
        return await obj.display_media_records();
    };

    /**
     * Get current DataTable instance
     * @returns {DataTable|null} DataTable instance or null
     */
    obj.get_data_table = function() {
        return media_data_table;
    };

    /**
     * Wait for a dependency to be available
     * @param {Function} check_fn - Function that returns true when dependency is ready
     * @param {number} max_attempts - Maximum number of attempts (default: 50)
     * @param {number} interval - Interval between checks in ms (default: 100)
     * @returns {Promise<boolean>} Resolves true if dependency loaded, false if timed out
     */
    const wait_for_dependency = (check_fn, max_attempts = 50, interval = 100) => {
        return new Promise((resolve) => {
            let attempts = 0;

            const check = () => {
                attempts++;
                if (check_fn()) {
                    resolve(true);
                } else if (attempts < max_attempts) {
                    setTimeout(check, interval);
                } else {
                    resolve(false);
                }
            };

            check();
        });
    };

    /**
     * Initialize Dropzone and uploads functionality
     * @returns {Promise<boolean>} True if initialization successful
     */
    const init_dropzone = async () => {
        // Wait for Dropzone library to load
        const dropzone_loaded = await wait_for_dependency(() => typeof Dropzone !== 'undefined');

        if (!dropzone_loaded) {
            console.error('Dropzone library failed to load');
            return false;
        }

        // Disable Dropzone auto-discover to prevent double initialization
        Dropzone.autoDiscover = false;

        // Wait for uploads module to be available
        const uploads_loaded = await wait_for_dependency(() => typeof mediaUploadsModule !== 'undefined');

        if (!uploads_loaded) {
            console.error('Uploads module failed to load');
            return false;
        }

        // Initialize uploads module
        const init_success = mediaUploadsModule.init();

        if (!init_success) {
            console.error('Failed to initialize uploads module');
            return false;
        }

        // Setup tab switching handler for lazy initialization
        obj.setup_upload_tab_handler();

        console.debug('Dropzone and uploads module initialized successfully');
        return true;
    };

    /**
     * Setup handler for upload tab switching
     * Re-initializes dropzone when tab becomes visible
     */
    obj.setup_upload_tab_handler = function() {
        const upload_tab = document.getElementById('upload-media-tab');

        if (!upload_tab) {
            console.warn('Upload media tab not found');
            return;
        }

        upload_tab.addEventListener('shown.bs.tab', function() {
            const dropzone_el = document.getElementById('item-dropzone');

            // Initialize dropzone if not already initialized
            if (dropzone_el && !dropzone_el.dropzone && typeof mediaUploadsModule !== 'undefined') {
                mediaUploadsModule.upload_item_media();
            }
        });
    };

    /**
     * Initialize module
     */
    obj.init = async function() {
        try {
            // Check authentication
            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            // Initialize Dropzone and uploads
            await init_dropzone();

            // Initialize modals module if available
            if (typeof mediaModalsModule !== 'undefined' && typeof mediaModalsModule.init === 'function') {
                mediaModalsModule.init();
            }

            // Initialize Kaltura view modal close handlers
            init_kaltura_view_modal();

            // Initialize page - display media records in DataTable
            await obj.display_media_records();

            // Show form. Logout/preview wiring runs automatically on
            // DOMContentLoaded via nav.module.js auto-init.
            helperModule.show_form();

            console.debug('Media library module initialized');

        } catch (error) {
            console.error('Error initializing media library module:', error);
            const message_element = document.querySelector('#message');

            if (message_element) {
                message_element.innerHTML = '<div class="alert alert-danger">Error initializing media library. Please refresh the page.</div>';
            }
        }
    };

    return obj;

}());
