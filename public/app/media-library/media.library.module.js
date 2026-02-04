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

    let obj = {};

    // DataTable instance reference
    let media_data_table = null;

    // HTTP status constants
    const HTTP_STATUS = {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    };

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
     * Get media library endpoints
     * @returns {Object|null} Endpoints configuration object
     */
    const get_media_library_endpoints = () => {
        try {
            return endpointsModule.get_media_library_endpoints();
        } catch (error) {
            console.error('Error getting media library endpoints:', error);
            return null;
        }
    };

    /**
     * Build media file URL for thumbnail display
     * @param {string} filename - The filename to build URL for
     * @returns {string|null} URL to media file or null if not available
     */
    const build_media_url = (filename) => {
        if (!filename) {
            return null;
        }

        const MEDIA_ENDPOINTS = get_media_library_endpoints();

        if (!MEDIA_ENDPOINTS?.media_file?.get?.endpoint) {
            console.warn('Media file endpoint not configured');
            return null;
        }

        // Replace :filename placeholder with actual filename
        const endpoint = MEDIA_ENDPOINTS.media_file.get.endpoint.replace(':filename', encodeURIComponent(filename));
        return endpoint;
    };

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
     * Get file type icon class based on mime type or extension
     * @param {string} item_type - The item type (image, pdf, etc.)
     * @param {string} mime_type - The MIME type
     * @returns {string} Font Awesome icon class
     */
    const get_file_type_icon = (item_type, mime_type) => {
        if (item_type === 'image' || (mime_type && mime_type.startsWith('image/'))) {
            return 'fa fa-file-image-o';
        }
        if (item_type === 'pdf' || mime_type === 'application/pdf') {
            return 'fa fa-file-pdf-o';
        }
        if (item_type === 'audio' || (mime_type && mime_type.startsWith('audio/'))) {
            return 'fa fa-file-audio-o';
        }
        if (item_type === 'video' || (mime_type && mime_type.startsWith('video/'))) {
            return 'fa fa-file-video-o';
        }
        return 'fa fa-file-o';
    };

    /**
     * Convert bytes to megabytes with formatting
     * @param {number} bytes - File size in bytes
     * @param {number} decimals - Number of decimal places (default: 2)
     * @returns {string} Formatted file size string
     */
    const format_file_size = (bytes, decimals = 2) => {
        if (!bytes || bytes === 0) {
            return '0 MB';
        }

        const mb = bytes / (1024 * 1024);

        if (mb < 0.01) {
            return '< 0.01 MB';
        }

        return mb.toFixed(decimals) + ' MB';
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
     * Sanitize string for safe HTML display
     * @param {string} str - String to sanitize
     * @returns {string} Sanitized string
     */
    const sanitize_html = (str) => {
        if (!str || typeof str !== 'string') {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
                // Clear any previous error messages on success
                clear_message(message_element);
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
     * Get a single media record by UUID
     * @param {string} uuid - Media record UUID
     * @returns {Promise<Object|null>} Media record data or null on failure
     */
    obj.get_media_record = async function(uuid) {

        try {

            const MEDIA_ENDPOINTS = get_media_library_endpoints();

            if (!uuid || typeof uuid !== 'string') {
                console.error('Invalid UUID provided');
                return null;
            }

            // Validate endpoint configuration
            if (!MEDIA_ENDPOINTS?.media_record?.get?.endpoint) {
                console.error('Media record get endpoint not configured');
                return null;
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.error('Session expired');
                return null;
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
                return null;
            }

            if (response.status === HTTP_STATUS.OK && response.data?.success) {
                return response.data.data;
            }

            console.error('Failed to get media record:', response.data?.message);
            return null;

        } catch (error) {
            console.error('Error getting media record:', error);
            return null;
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

        // Open edit modal via modals module
        if (typeof mediaModalsModule !== 'undefined' && typeof mediaModalsModule.open_edit_media_modal === 'function') {
            await mediaModalsModule.open_edit_media_modal(uuid, async () => {
                // Refresh the data table after edit
                await obj.refresh_media_records();
            });
        } else {
            console.error('mediaModalsModule.open_edit_media_modal not available');
        }
    };

    /**
     * Handle thumbnail click to view media
     * @param {string} uuid - Media record UUID
     * @param {string} name - Media record name
     * @param {string} filename - Original filename for display
     * @param {string} size - Formatted file size
     * @param {string} media_type - Media type (image, pdf, etc.)
     * @param {string} storage_filename - Storage filename for URL building
     */
    const handle_view_click = (uuid, name, filename, size, media_type, storage_filename) => {
        if (!uuid) {
            console.error('No UUID provided for view');
            return;
        }

        // Open view modal via modals module
        if (typeof mediaModalsModule !== 'undefined' && typeof mediaModalsModule.open_view_media_modal === 'function') {
            mediaModalsModule.open_view_media_modal(uuid, name, filename, size, media_type, storage_filename);
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
     */
    const handle_delete_click = async (uuid, name, filename, item_type) => {
        if (!uuid) {
            console.error('No UUID provided for delete');
            return;
        }

        const message_element = document.querySelector('#message');

        // Open delete confirmation modal via modals module
        if (typeof mediaModalsModule !== 'undefined' && typeof mediaModalsModule.open_delete_media_modal === 'function') {
            mediaModalsModule.open_delete_media_modal(uuid, name, filename, item_type, async (success, message) => {
                if (success) {
                    // Show success message
                    display_message(message_element, 'success', message || 'Media record deleted successfully.');
                    
                    // Refresh the data table
                    await obj.refresh_media_records();

                    // Clear success message after delay
                    setTimeout(() => {
                        clear_message(message_element);
                    }, 3000);
                }
            });
        } else {
            // Fallback to confirm dialog if modal not available
            const confirmed = confirm(`Are you sure you want to delete "${name || 'this media record'}"?\n\nThis action cannot be undone.`);
            
            if (!confirmed) {
                return;
            }

            try {
                // Get endpoints configuration
                const MEDIA_ENDPOINTS = get_media_library_endpoints();

                if (!MEDIA_ENDPOINTS?.media_records?.delete?.endpoint) {
                    display_message(message_element, 'danger', 'Delete endpoint not configured');
                    return;
                }

                // Validate authentication
                const token = authModule.get_user_token();

                if (!token || token === false) {
                    display_message(message_element, 'danger', 'Session expired. Please log in again.');
                    return;
                }

                // Construct endpoint with media_id
                const endpoint = MEDIA_ENDPOINTS.media_records.delete.endpoint.replace(':media_id', uuid);

                // Make API request
                const response = await httpModule.req({
                    method: 'DELETE',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    },
                    timeout: 30000,
                    validateStatus: (status) => status >= 200 && status < 600
                });

                // Handle response
                if (response && response.status === HTTP_STATUS.OK && response.data?.success) {
                    display_message(message_element, 'success', 'Media record deleted successfully.');
                    
                    // Refresh the data table
                    await obj.refresh_media_records();

                    // Clear success message after delay
                    setTimeout(() => {
                        clear_message(message_element);
                    }, 3000);
                } else {
                    const error_message = response?.data?.message || 'Failed to delete media record.';
                    display_message(message_element, 'danger', error_message);
                }

            } catch (error) {
                console.error('Error deleting media record:', error);
                display_message(message_element, 'danger', 'An unexpected error occurred while deleting the media record.');
            }
        }
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
        const escaped_name = sanitize_html(name).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const escaped_filename = sanitize_html(filename).replace(/'/g, "\\'").replace(/"/g, '&quot;');

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
        // Inject CSS for dropdown positioning and thumbnail hover (only once)
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

        // Close dropdowns when clicking outside (works for both Bootstrap 4 and 5)
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
                const storage_filename = this.getAttribute('data-storage-filename');
                handle_view_click(uuid, name, filename, size, media_type, storage_filename);
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
                handle_delete_click(uuid, name, filename, item_type);
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

        // Also handle Bootstrap 4 jQuery dropdowns
        if (typeof $ !== 'undefined' && typeof $.fn.dropdown !== 'undefined') {
            $('.dropdown-menu.show').removeClass('show');
            $('.media-actions-toggle[aria-expanded="true"]').attr('aria-expanded', 'false');
        }
    };

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

                // Get storage filename from upload_uuid + extension or original_filename
                const storage_filename = record.filename;

                return {
                    uuid: record.uuid || null,
                    name: sanitize_html(record.name) || 'Untitled',
                    filename: sanitize_html(record.original_filename) || 'N/A',
                    storage_filename: storage_filename || null,
                    thumbnail_url: storage_filename ? build_media_url(storage_filename) : null,
                    is_image: is_image_file(record.original_filename),
                    media_type: sanitize_html(record.media_type) || 'N/A',
                    mime_type: record.mime_type || null,
                    ingest_method: sanitize_html(record.ingest_method) || 'N/A',
                    created: record.created || null,
                    created_display: format_date(record.created),
                    upload_uuid: record.upload_uuid || null,
                    size: record.size || 0,
                    size_display: format_file_size(record.size)
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
                                const is_viewable = row.ingest_method === 'upload' && (row.is_image || row.media_type === 'pdf');
                                const cursor_style = is_viewable ? 'cursor: pointer;' : '';
                                const clickable_class = is_viewable ? 'media-thumbnail-clickable' : '';

                                // Build thumbnail or icon
                                if (row.is_image && row.thumbnail_url) {
                                    // Image thumbnail with token for authentication
                                    const img_url = row.thumbnail_url + (row.thumbnail_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
                                    thumbnail_html = `
                                        <img src="${img_url}" 
                                             alt="Thumbnail for ${display_name}"
                                             class="media-thumbnail ${clickable_class}"
                                             style="width: ${THUMBNAIL_SIZE.width}px; height: ${THUMBNAIL_SIZE.height}px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; ${cursor_style}"
                                             loading="lazy"
                                             ${is_viewable ? `data-uuid="${row.uuid}" data-name="${sanitize_html(row.name)}" data-filename="${sanitize_html(row.filename)}" data-size="${row.size_display}" data-media-type="${row.media_type}" data-storage-filename="${row.storage_filename}" title="Click to view"` : ''}
                                             onerror="this.onerror=null; this.src='${PLACEHOLDER_IMAGE}';">`;
                                } else {
                                    // Placeholder image for non-images (check if it's a viewable PDF)
                                    const is_pdf_viewable = row.ingest_method === 'upload' && row.media_type === 'pdf';
                                    const pdf_clickable_class = is_pdf_viewable ? 'media-thumbnail-clickable' : '';
                                    const pdf_cursor_style = is_pdf_viewable ? 'cursor: pointer;' : '';
                                    thumbnail_html = `
                                        <img src="${PLACEHOLDER_IMAGE}" 
                                             alt="Placeholder for ${display_name}"
                                             class="media-thumbnail-placeholder ${pdf_clickable_class}"
                                             style="width: ${THUMBNAIL_SIZE.width}px; height: ${THUMBNAIL_SIZE.height}px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; ${pdf_cursor_style}"
                                             ${is_pdf_viewable ? `data-uuid="${row.uuid}" data-name="${sanitize_html(row.name)}" data-filename="${sanitize_html(row.filename)}" data-size="${row.size_display}" data-media-type="${row.media_type}" data-storage-filename="${row.storage_filename}" title="Click to view"` : ''}>`;
                                }

                                // Combine thumbnail and name
                                return `
                                    <div class="media-name-cell" style="display: flex; align-items: center;">
                                        ${thumbnail_html}
                                        <small class="media-name" title="${row.filename !== 'N/A' ? 'File: ' + row.filename : ''}">${display_name}</small>
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
                                // Truncate long filenames with tooltip
                                const max_length = 40;
                                let filename_display = data || 'N/A';
                                if (data && data.length > max_length) {
                                    filename_display = `<span title="${data}">${data.substring(0, max_length)}...</span>`;
                                }
                                // Return filename with file size below it
                                return `<small>${filename_display}</small><br><small><em>${row.size_display}</em></small>`;
                            }
                            return data;
                        }
                    },
                    {
                        data: 'ingest_method',
                        title: 'Import Type',
                        render: function(data, type, row) {
                            if (type === 'display') {
                                return `<small>${data || 'N/A'}</small>`;
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
                order: [[3, 'desc']], // Sort by created date descending (newest first)
                pageLength: 25,
                lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
                responsive: true,
                autoWidth: false,
                language: {
                    emptyTable: 'No media files found in the library',
                    zeroRecords: 'No matching media files found',
                    info: 'Showing _START_ to _END_ of _TOTAL_ media files',
                    infoEmpty: 'No media files available',
                    infoFiltered: '(filtered from _MAX_ total files)',
                    search: 'Search media:',
                    lengthMenu: 'Show _MENU_ files per page',
                    paginate: {
                        first: 'First',
                        last: 'Last',
                        next: 'Next',
                        previous: 'Previous'
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

                    // Setup action button handlers after each draw
                    setup_action_handlers();
                }
            });

            // Display success message if records exist
            if (records.length > 0) {
                console.log(`Media library loaded: ${records.length} record(s)`);
            }

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

        console.log('Dropzone and uploads module initialized successfully');
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

            // Initialize page - display media records in DataTable
            await obj.display_media_records();

            // Show form and setup navigation
            helperModule.show_form();
            navModule.set_logout_link();

            console.log('Media library module initialized');

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
