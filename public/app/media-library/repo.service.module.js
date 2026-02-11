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

const repoServiceModule = (function() {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    // Module state
    let selected_items = new Map();
    let current_search_results = [];
    let current_total = 0;

    let obj = {};

    // HTTP status constants
    const HTTP_STATUS = {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    };

    /**
     * Get application path safely
     */
    const get_app_path = () => {
        try {
            const app_path = window.localStorage.getItem('exhibits_app_path');
            if (!app_path) {
                return '/exhibits-dashboard';
            }
            return app_path;
        } catch (error) {
            return '/exhibits-dashboard';
        }
    };

    const APP_PATH = get_app_path();

    /**
     * Escape HTML to prevent XSS
     */
    const escape_html = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Truncate text to specified length
     */
    const truncate_text = (text, max_length = 100) => {
        if (!text) return '';
        if (text.length <= max_length) return text;
        return text.substring(0, max_length) + '...';
    };

    /**
     * Get object type icon class
     */
    const get_object_type_icon = (object_type) => {
        const icons = {
            'image': 'fa-file-image-o',
            'object': 'fa-file-image-o',
            'pdf': 'fa-file-pdf-o',
            'video': 'fa-file-video-o',
            'audio': 'fa-file-audio-o',
            'collection': 'fa-folder-o',
            'compound': 'fa-files-o'
        };
        return icons[object_type] || 'fa-file-o';
    };

    /**
     * Get object type label
     */
    const get_object_type_label = (object_type) => {
        const labels = {
            'image': 'Image',
            'object': 'Object',
            'pdf': 'PDF',
            'video': 'Video',
            'audio': 'Audio',
            'collection': 'Collection',
            'compound': 'Compound Object'
        };
        return labels[object_type] || 'Unknown';
    };

    /**
     * Build the thumbnail URL for a repository item
     * Uses the repo_thumbnail endpoint with UUID and token
     * The endpoint returns binary image data directly for use in img src
     * @param {string} uuid - Repository item UUID
     * @returns {string} Thumbnail URL or empty string if no uuid
     */
    const build_thumbnail_url = (uuid) => {
        if (!uuid) {
            return '';
        }

        // Get the token for authentication
        const token = authModule.get_user_token();
        if (!token) {
            return '';
        }

        // Validate endpoint configuration
        if (!EXHIBITS_ENDPOINTS?.repo_thumbnail?.get?.endpoint) {
            console.warn('Repo thumbnail endpoint not configured');
            return '';
        }

        // Build URL with uuid and token as query parameters
        // This URL returns binary image data directly (not JSON)
        const endpoint = EXHIBITS_ENDPOINTS.repo_thumbnail.get.endpoint;
        return endpoint + '?uuid=' + encodeURIComponent(uuid) + '&token=' + encodeURIComponent(token);
    };

    /**
     * Get the thumbnail URL for a repository item
     * Public method to build thumbnail URL for external use
     * @param {string} uuid - Repository item UUID
     * @returns {string} Thumbnail URL or empty string if invalid
     */
    obj.get_repo_tn_url = function(uuid) {
        if (!uuid || typeof uuid !== 'string' || uuid.trim().length === 0) {
            return '';
        }
        return build_thumbnail_url(uuid.trim());
    };

    /**
     * Display message in the repo search message area
     * @param {string} type - Message type ('success', 'danger', 'warning', 'info')
     * @param {string} message - Message text
     */
    const display_message = (type, message) => {
        const message_container = document.getElementById('repo-search-message');

        if (!message_container) return;

        const icon_map = {
            'success': 'fa-check-circle',
            'danger': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };

        const icon = icon_map[type] || 'fa-info-circle';

        message_container.innerHTML = '<div class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' +
            '<i class="fa ' + icon + '" style="margin-right: 8px;" aria-hidden="true"></i>' +
            escape_html(message) +
            '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
            '<span aria-hidden="true">&times;</span>' +
            '</button>' +
            '</div>';

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                clear_message();
            }, 5000);
        }
    };

    /**
     * Clear message area
     */
    const clear_message = () => {
        const message_container = document.getElementById('repo-search-message');
        if (message_container) {
            message_container.innerHTML = '';
        }
    };

    /**
     * Show loading indicator
     */
    const show_loading = () => {
        // Show form/results container using helper module to fix CSS visibility
        if (typeof helperModule !== 'undefined' && typeof helperModule.show_form === 'function') {
            helperModule.show_form();
        }

        const results_container = document.getElementById('repo-search-results');
        if (results_container) {
            results_container.innerHTML = '<div class="text-center py-5">' +
                '<i class="fa fa-spinner fa-spin fa-3x" aria-hidden="true"></i>' +
                '<p class="mt-3 text-muted">Searching repository...</p>' +
                '</div>';
        }
    };

    /**
     * Hide loading indicator and show default state
     */
    const hide_loading = () => {
        const results_container = document.getElementById('repo-search-results');
        if (results_container) {
            results_container.innerHTML = '<div class="text-center py-4 text-muted">' +
                '<i class="fa fa-search fa-3x mb-3" aria-hidden="true"></i>' +
                '<p>Enter a search term above to find repository items</p>' +
                '</div>';
        }
    };

    /**
     * Update the import button visibility based on selection
     */
    const update_import_button = () => {
        const import_btn = document.getElementById('repo-import-btn');
        const selected_count = document.getElementById('repo-selected-count');

        if (import_btn) {
            if (selected_items.size > 0) {
                import_btn.style.display = 'inline-block';
                import_btn.disabled = false;
            } else {
                import_btn.style.display = 'none';
            }
        }

        if (selected_count) {
            selected_count.textContent = selected_items.size;
        }
    };

    /**
     * Handle checkbox change for item selection
     * @param {Event} event - Change event
     * @param {Object} item - The search result item
     */
    const handle_item_selection = (event, item) => {
        const checkbox = event.target;
        const uuid = item.uuid;
        const card = checkbox.closest('.repo-result-item');

        if (checkbox.checked) {
            selected_items.set(uuid, item);
            if (card) card.classList.add('selected');
        } else {
            selected_items.delete(uuid);
            if (card) card.classList.remove('selected');
        }

        update_import_button();
        update_select_all_checkbox();
    };

    /**
     * Update select all checkbox state based on current page
     */
    const update_select_all_checkbox = () => {
        const select_all = document.getElementById('repo-select-all');
        if (!select_all) return;

        const checkboxes = document.querySelectorAll('.repo-item-checkbox');
        const checked_count = document.querySelectorAll('.repo-item-checkbox:checked').length;

        if (checked_count === 0) {
            select_all.checked = false;
            select_all.indeterminate = false;
        } else if (checked_count === checkboxes.length) {
            select_all.checked = true;
            select_all.indeterminate = false;
        } else {
            select_all.checked = false;
            select_all.indeterminate = true;
        }
    };

    /**
     * Handle select all checkbox - only affects current page
     * @param {Event} event - Change event
     */
    const handle_select_all = (event) => {
        const is_checked = event.target.checked;
        const checkboxes = document.querySelectorAll('.repo-item-checkbox');

        // Get current page results from pagination module
        let current_page_results = [];
        if (typeof repoPaginationModule !== 'undefined' && 
            typeof repoPaginationModule.get_current_page_results === 'function') {
            current_page_results = repoPaginationModule.get_current_page_results() || [];
        }
        
        // Fallback if pagination not available
        if (current_page_results.length === 0 && current_search_results) {
            current_page_results = current_search_results.slice(0, 10);
        }

        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = is_checked;
            const item = current_page_results[index];
            const card = checkbox.closest('.repo-result-item');
            
            if (item) {
                if (is_checked) {
                    selected_items.set(item.uuid, item);
                    if (card) card.classList.add('selected');
                } else {
                    selected_items.delete(item.uuid);
                    if (card) card.classList.remove('selected');
                }
            }
        });

        update_import_button();
    };

    /**
     * Build HTML for a single search result item
     * @param {Object} item - Search result item
     * @param {number} index - Item index (global index across all results)
     * @returns {string} HTML string
     */
    const build_result_item_html = (item, index) => {
        // Defensive checks
        if (!item) {
            return '';
        }

        const uuid = escape_html(item.uuid || item._id || 'unknown-' + index);
        const title = escape_html(item.title || 'Untitled');
        const abstract = escape_html(truncate_text(item.abstract || item.description || '', 150));
        const object_type = item.object_type || item.type || 'unknown';
        const type_icon = get_object_type_icon(object_type);
        const type_label = get_object_type_label(object_type);
        const pid = escape_html(item.pid || '');
        const handle = escape_html(item.handle || '');
        const creator = escape_html(item.creator || '');
        const is_checked = selected_items.has(item.uuid);

        // Build thumbnail URL using the repo thumbnail endpoint
        // Falls back to placeholder if thumbnail cannot be fetched
        const thumbnail_url = build_thumbnail_url(item.uuid);

        // Build thumbnail HTML with inline styles for reliability
        // Uses the repo thumbnail endpoint URL, with onerror fallback to icon placeholder
        let thumbnail_html;
        if (thumbnail_url) {
            thumbnail_html = '<img src="' + escape_html(thumbnail_url) + '" ' +
                'alt="Thumbnail for ' + title + '" ' +
                'class="img-fluid rounded repo-thumbnail" ' +
                'style="max-height: 80px; width: 80px; object-fit: cover;" ' +
                'onerror="this.onerror=null; this.parentElement.innerHTML=\'<div style=\\\'width:80px;height:80px;background:#f8f9fa;display:flex;align-items:center;justify-content:center;border-radius:4px;\\\'><i class=\\\'fa ' + type_icon + ' fa-2x\\\' style=\\\'color:#6c757d;\\\' aria-hidden=\\\'true\\\'></i></div>\';">';
        } else {
            thumbnail_html = '<div style="width: 80px; height: 80px; background-color: #f8f9fa; display: flex; align-items: center; justify-content: center; border-radius: 4px;">' +
                '<i class="fa ' + type_icon + ' fa-2x" style="color: #6c757d;" aria-hidden="true"></i>' +
                '</div>';
        }

        // Use inline styles for card to ensure visibility
        let html = '<div class="repo-result-item card mb-3' + (is_checked ? ' selected' : '') + '" data-uuid="' + uuid + '" data-index="' + index + '" style="border: 1px solid #dee2e6; border-radius: 4px;">';
        html += '<div class="card-body" style="padding: 15px;">';
        html += '<div class="row align-items-center">';

        // Checkbox column
        html += '<div class="col-auto" style="padding-right: 10px;">';
        html += '<div class="form-check">';
        html += '<input type="checkbox" class="form-check-input repo-item-checkbox" id="repo-item-' + uuid + '" data-uuid="' + uuid + '" data-global-index="' + index + '" style="width: 18px; height: 18px; cursor: pointer;"' + (is_checked ? ' checked' : '') + '>';
        html += '<label class="form-check-label sr-only" for="repo-item-' + uuid + '">Select ' + title + '</label>';
        html += '</div>';
        html += '</div>';

        // Thumbnail column
        html += '<div class="col-auto" style="padding-right: 15px;">';
        html += thumbnail_html;
        html += '</div>';

        // Content column
        html += '<div class="col">';
        html += '<h6 class="mb-1" style="font-weight: 600; font-size: 1rem; color: #333;">' + title + '</h6>';

        if (creator) {
            html += '<p class="mb-1 small text-muted"><i class="fa fa-user" style="margin-right: 6px;" aria-hidden="true"></i>' + creator + '</p>';
        }

        if (abstract) {
            html += '<p class="mb-1 small text-muted">' + abstract + '</p>';
        }

        html += '<div style="margin-top: 8px;">';
        // Use Bootstrap 4 badge classes (badge-*) instead of Bootstrap 5 (bg-*)
        html += '<span class="badge badge-secondary" style="margin-right: 5px; font-weight: normal;"><i class="fa ' + type_icon + '" style="margin-right: 4px;" aria-hidden="true"></i>' + type_label + '</span>';

        if (pid) {
            html += '<span class="badge badge-light" style="margin-right: 5px; font-weight: normal; border: 1px solid #dee2e6;">PID: ' + pid + '</span>';
        }

        if (item.has_children && item.children_count > 0) {
            html += '<span class="badge badge-info" style="font-weight: normal;"><i class="fa fa-files-o" style="margin-right: 4px;" aria-hidden="true"></i>' + item.children_count + ' parts</span>';
        }

        html += '</div>';
        html += '</div>';

        // Actions column
        html += '<div class="col-auto">';
        if (handle) {
            html += '<a href="' + escape_html(handle) + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary" title="View in repository">';
            html += '<i class="fa fa-external-link" aria-hidden="true"></i>';
            html += '<span class="sr-only">View in repository</span>';
            html += '</a>';
        }
        html += '</div>';

        html += '</div>'; // row
        html += '</div>'; // card-body
        html += '</div>'; // card

        return html;
    };

    /**
     * Render search results with pagination
     * @param {Array} results - Array of search result items
     * @param {number} total - Total number of results from API
     */
    const render_search_results = (results, total) => {
        const results_container = document.getElementById('repo-search-results');

        if (!results_container) {
            console.error('Results container not found');
            return;
        }

        // Ensure results is always an array
        const results_array = Array.isArray(results) ? results : [];
        
        // Store all results
        current_search_results = results_array;
        current_total = total || results_array.length;

        if (results_array.length === 0) {
            // Clear the results container - message is shown via display_message
            results_container.innerHTML = '';
            return;
        }

        // Initialize pagination with all results
        if (typeof repoPaginationModule !== 'undefined') {
            repoPaginationModule.set_results(results_array);
            repoPaginationModule.on_page_change(handle_page_change);
        }

        // Render current page
        render_current_page();
    };

    /**
     * Render the current page of results
     */
    const render_current_page = () => {
        const results_container = document.getElementById('repo-search-results');
        if (!results_container) return;

        // Get page results from pagination module
        let page_results = [];
        let pagination_html = '';
        
        // Check if pagination module is available and working
        if (typeof repoPaginationModule !== 'undefined' && 
            typeof repoPaginationModule.get_current_page_results === 'function') {
            page_results = repoPaginationModule.get_current_page_results() || [];
            pagination_html = repoPaginationModule.render() || '';
        }
        
        // Fallback: if pagination returns empty but we have results, use current_search_results directly
        if (page_results.length === 0 && current_search_results && current_search_results.length > 0) {
            page_results = current_search_results.slice(0, 10);
        }

        // Build results header
        let html = '<div class="repo-results-header d-flex justify-content-between align-items-center mb-3">';
        html += '<div class="form-check">';
        html += '<input type="checkbox" class="form-check-input" id="repo-select-all" style="width: 18px; height: 18px; cursor: pointer;">';
        html += '<label class="form-check-label" for="repo-select-all" style="margin-left: 8px;">Select all on this page</label>';
        html += '</div>';
        html += '<div class="text-muted small">' + (current_search_results ? current_search_results.length : 0) + ' items found</div>';
        html += '</div>';

        // Build results list
        html += '<div class="repo-results-list">';
        page_results.forEach((item, page_index) => {
            // Calculate global index - use pagination if available, otherwise just use page_index
            let global_index = page_index;
            if (typeof repoPaginationModule !== 'undefined' && 
                typeof repoPaginationModule.get_global_index === 'function') {
                global_index = repoPaginationModule.get_global_index(page_index);
            }
            html += build_result_item_html(item, global_index);
        });
        html += '</div>';

        // Add pagination
        html += pagination_html;

        results_container.innerHTML = html;

        // CRITICAL: Call show_form() AFTER HTML is injected so the new .card elements exist in DOM
        if (typeof helperModule !== 'undefined' && typeof helperModule.show_form === 'function') {
            helperModule.show_form();
        }

        // Setup event handlers for checkboxes
        setup_checkbox_handlers();

        // Bind pagination events if module available
        if (typeof repoPaginationModule !== 'undefined' && 
            typeof repoPaginationModule.bind_events === 'function') {
            repoPaginationModule.bind_events(results_container);
        }
    };

    /**
     * Handle page change from pagination
     * @param {number} page - New page number
     */
    const handle_page_change = (page) => {
        render_current_page();
    };

    /**
     * Setup checkbox event handlers
     */
    const setup_checkbox_handlers = () => {
        // Individual item checkboxes
        const checkboxes = document.querySelectorAll('.repo-item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const global_index = parseInt(checkbox.getAttribute('data-global-index'), 10);
                const item = current_search_results[global_index];
                if (item) {
                    handle_item_selection(event, item);
                }
            });
        });

        // Select all checkbox
        const select_all = document.getElementById('repo-select-all');
        if (select_all) {
            select_all.addEventListener('change', handle_select_all);
        }

        // Update select all state based on current selections
        update_select_all_checkbox();
    };

    /**
     * Search the repository
     * @param {string} query - Search query
     * @returns {Promise<Object>} Search result
     */
    obj.search = async function(query) {

        try {

            if (!query || query.trim().length === 0) {
                display_message('warning', 'Please enter a search term');
                return { success: false, message: 'No search term' };
            }

            // Clear previous selections
            selected_items.clear();
            update_import_button();

            show_loading();
            clear_message();

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.repo_media_search?.get?.endpoint) {
                hide_loading();
                display_message('danger', 'Repository search endpoint not configured');
                return { success: false, message: 'Endpoint not configured' };
            }

            // Validate authentication
            const token = authModule.get_user_token();
            if (!token || token === false) {
                hide_loading();
                display_message('danger', 'Session expired. Please log in again.');
                return { success: false, message: 'Authentication required' };
            }

            const endpoint = EXHIBITS_ENDPOINTS.repo_media_search.get.endpoint;

            // Make search request
            const response = await httpModule.req({
                method: 'GET',
                url: endpoint + '?q=' + encodeURIComponent(query.trim()),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            hide_loading();

            if (!response) {
                display_message('danger', 'No response from server');
                render_search_results([], 0);
                return { success: false, message: 'No response' };
            }

            if (response.status === HTTP_STATUS.OK && response.data?.success) {
                // Handle different possible response structures
                let results = [];
                let total = 0;
                
                // Check for nested data.records structure first (most common)
                if (response.data.data?.records && Array.isArray(response.data.data.records)) {
                    results = response.data.data.records;
                    total = response.data.data.total || response.data.total || results.length;
                } else if (Array.isArray(response.data.data)) {
                    results = response.data.data;
                    total = response.data.total || results.length;
                } else if (Array.isArray(response.data.results)) {
                    results = response.data.results;
                    total = response.data.total || results.length;
                } else if (Array.isArray(response.data)) {
                    results = response.data;
                    total = results.length;
                }

                if (results.length === 0) {
                    display_message('info', 'No results found for "' + escape_html(query) + '"');
                }

                // Filter out collection records - only show object records
                results = results.filter(item => {
                    const object_type = (item.object_type || item.type || '').toLowerCase();
                    return object_type !== 'collection';
                });

                if (results.length === 0 && total > 0) {
                    display_message('info', 'No importable object records found for "' + escape_html(query) + '"');
                }

                render_search_results(results, results.length);
                return { success: true, results: results, total: total };
            }

            const error_message = response.data?.message || 'Search failed';
            display_message('danger', error_message);
            render_search_results([], 0);
            return { success: false, message: error_message };

        } catch (error) {
            console.error('Error searching repository:', error);
            hide_loading();
            display_message('danger', 'An unexpected error occurred while searching.');
            render_search_results([], 0);
            return { success: false, message: error.message };
        }
    };

    /**
     * Get currently selected items
     * @returns {Array} Array of selected items
     */
    obj.get_selected_items = function() {
        return Array.from(selected_items.values());
    };

    /**
     * Get selected items count
     * @returns {number} Number of selected items
     */
    obj.get_selected_count = function() {
        return selected_items.size;
    };

    /**
     * Clear all selections
     */
    obj.clear_selections = function() {
        selected_items.clear();
        current_search_results = [];

        // Uncheck all checkboxes
        const checkboxes = document.querySelectorAll('.repo-item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        const select_all = document.getElementById('repo-select-all');
        if (select_all) {
            select_all.checked = false;
            select_all.indeterminate = false;
        }

        update_import_button();
    };

    /**
     * Import selected repository items to media library
     * Opens the repo import modal for user to fill in details
     * @returns {Promise<Object>} Import result
     */
    obj.import_selected = async function() {

        try {

            const items = obj.get_selected_items();

            if (items.length === 0) {
                display_message('warning', 'No items selected for import');
                return { success: false, message: 'No items selected' };
            }

            // Check if repoModalsModule is available
            if (typeof repoModalsModule === 'undefined' || typeof repoModalsModule.open_repo_media_modal !== 'function') {
                console.error('repoModalsModule not available');
                display_message('danger', 'Import modal not available. Please refresh the page.');
                return { success: false, message: 'Modal module not loaded' };
            }

            // Open the repo import modal with selected items
            // The modal will handle individual saves and show the Done button when complete
            repoModalsModule.open_repo_media_modal(items, (saved_count) => {
                // Callback when modal is closed via Done button
                if (saved_count > 0) {
                    // Show a single success message in the search message area
                    display_message('success', 'Import complete! ' + saved_count + ' item(s) added to your media library.');

                    // Clear search results after successful import
                    const results_container = document.getElementById('repo-search-results');
                    if (results_container) {
                        results_container.innerHTML = '';
                    }

                    // Refresh media library table if available
                    if (typeof mediaLibraryModule !== 'undefined' && mediaLibraryModule.refresh_media_table) {
                        mediaLibraryModule.refresh_media_table();
                    }
                }
            });

            return { success: true, message: 'Import modal opened' };

        } catch (error) {
            console.error('Error opening import modal:', error);
            display_message('danger', 'An unexpected error occurred.');
            return { success: false, message: error.message };
        }
    };

    /**
     * Initialize event listeners for repo search
     */
    const init_event_listeners = () => {
        // Search button click
        const search_btn = document.getElementById('repo-uuid-btn');
        if (search_btn) {
            search_btn.addEventListener('click', async (event) => {
                event.preventDefault();
                const search_input = document.getElementById('repo-uuid');
                if (search_input) {
                    await obj.search(search_input.value);
                }
            });
        }

        // Search on Enter key
        const search_input = document.getElementById('repo-uuid');
        if (search_input) {
            search_input.addEventListener('keypress', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    await obj.search(search_input.value);
                }
            });
        }

        // Import button click
        const import_btn = document.getElementById('repo-import-btn');
        if (import_btn) {
            import_btn.addEventListener('click', async (event) => {
                event.preventDefault();
                await obj.import_selected();
            });
        }
    };

    /**
     * Initialize the repo service module
     */
    obj.init = function() {
        // Initialize pagination module first
        if (typeof repoPaginationModule !== 'undefined') {
            repoPaginationModule.init();
        }

        init_event_listeners();
        console.log('Repo service module initialized');
        return true;
    };

    return obj;

}());
