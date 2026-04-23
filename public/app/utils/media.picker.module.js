/**

 Copyright 2026 University of Denver

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

const mediaPickerModule = (function () {

    'use strict';

    // ==================== DEPENDENCY GUARD ====================

    if (typeof endpointsModule === 'undefined' || typeof endpointsModule.get_exhibits_endpoints !== 'function') {
        console.error('FATAL: mediaPickerModule requires endpointsModule to be loaded first');
        return {};
    }

    if (typeof httpModule === 'undefined' || typeof httpModule.req !== 'function') {
        console.error('FATAL: mediaPickerModule requires httpModule to be loaded first');
        return {};
    }

    if (typeof authModule === 'undefined' || typeof authModule.get_user_token !== 'function') {
        console.error('FATAL: mediaPickerModule requires authModule to be loaded first');
        return {};
    }

    // ==================== CONSTANTS ====================

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    // Exhibits endpoints are fetched lazily at call time — capturing them
    // at IIFE parse time runs before authModule.save_user_auth_data() has
    // populated localStorage, leaving the value null on first page load.
    const PAGE_SIZE = 20;
    const SEARCH_DEBOUNCE_MS = 300;

    // ==================== STATE ====================

    let obj = {};
    let _selected_media = null;
    let _current_role = null;
    let _current_exhibit_uuid = null;
    let _previous_media_uuid = null;
    let _on_select_callback = null;
    let _media_type_filter = null;
    let _create_exhibit_binding = true;
    let _current_page = 1;
    let _search_term = '';
    let _search_timeout = null;
    let _request_id = 0;

    // ==================== PRIVATE HELPERS ====================

    /**
     * Resolves the media_exhibits PUT endpoint URL.
     * Tries the frontend endpoint registry first; falls back to constructing
     * from APP_PATH if the registry hasn't been updated yet.
     * @returns {string|null} Endpoint URL template with :media_id placeholder, or null
     */
    function get_media_exhibits_endpoint() {
        try {
            const ml_endpoints = endpointsModule.get_media_library_endpoints();
            if (ml_endpoints && ml_endpoints.media_exhibits && ml_endpoints.media_exhibits.put && ml_endpoints.media_exhibits.put.endpoint) {
                return ml_endpoints.media_exhibits.put.endpoint;
            }
        } catch (e) {
            // Endpoint not registered in frontend config — fall through
        }
        // Fallback: construct from APP_PATH
        if (APP_PATH) {
            return APP_PATH + '/api/v1/media/library/record/:media_id/exhibits';
        }
        return null;
    }

    /**
     * Builds a thumbnail URL for a media library asset based on its ingest method
     * @param {Object} media - Media library record
     * @returns {string} Thumbnail URL
     */
    function get_thumbnail_url(media) {

        if (!media) return '';

        // Kaltura assets use their own thumbnail URL
        if (media.ingest_method === 'kaltura' && media.kaltura_thumbnail_url) {
            let url = decode_html_entities(media.kaltura_thumbnail_url);

            // Upgrade http to https to prevent mixed content warnings
            if (url.startsWith('http://')) {
                url = url.replace('http://', 'https://');
            }

            return url;
        }

        // Same-origin thumbnail requests rely on the HttpOnly exhibits_token
        // cookie for authentication, so the JWT is never embedded in <img src>.
        if (media.ingest_method === 'repository' && media.repo_uuid) {
            return `${APP_PATH}/api/v1/media/library/repo/thumbnail?uuid=${encodeURIComponent(media.repo_uuid)}`;
        }

        if (media.uuid && media.thumbnail_path) {
            return `${APP_PATH}/api/v1/media/library/thumbnail/${media.uuid}`;
        }

        return '';
    }

    /**
     * Decodes HTML entities in a string (e.g., &#x2F; → /)
     * Required because the XSS middleware encodes values at input time,
     * and JavaScript's img.src assignment does not decode HTML entities
     * the way an HTML-parsed attribute would.
     * @param {string} str - String potentially containing HTML entities
     * @returns {string} Decoded string
     */
    function decode_html_entities(str) {
        if (!str || typeof str !== 'string') return str;
        const textarea = document.createElement('textarea');
        textarea.innerHTML = str;
        return textarea.value;
    }

    /**
     * Strips HTML tags from a string, returning plain text.
     * Used to sanitize media names that may contain legacy HTML markup.
     * @param {string} str - String potentially containing HTML tags
     * @returns {string} Plain text with tags removed
     */
    function strip_html_tags(str) {
        if (!str || typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    }

    /**
     * Gets a Font Awesome icon class based on media type
     * @param {string} media_type - e.g. 'image', 'video', 'audio', 'pdf'
     * @returns {string} FA icon class
     */
    function get_media_type_icon(media_type) {
        const icons = {
            'image': 'fa-file-image-o',
            'video': 'fa-file-video-o',
            'audio': 'fa-file-audio-o',
            'pdf': 'fa-file-pdf-o',
            'moving image': 'fa-file-video-o',
            'sound': 'fa-file-audio-o'
        };
        return icons[(media_type || '').toLowerCase()] || 'fa-file-o';
    }

    /**
     * Creates a single media card element
     * @param {Object} media - Media library record
     * @returns {HTMLElement} Card element
     */
    function create_media_card(media) {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.uuid = media.uuid;

        // Thumbnail area
        const thumb_url = get_thumbnail_url(media);

        if (thumb_url) {
            const thumb_div = document.createElement('div');
            thumb_div.className = 'media-card-thumbnail';
            const img = document.createElement('img');
            img.src = thumb_url;
            img.alt = media.alt_text || media.name || '';
            img.loading = 'lazy';
            img.onerror = function () {
                // Replace broken image with placeholder icon
                // Capture parent references before DOM mutation detaches this element
                const thumb_div = this.parentElement;
                if (!thumb_div) return;

                const card_el = thumb_div.parentElement;
                if (!card_el) return;

                const placeholder = document.createElement('div');
                placeholder.className = 'media-card-placeholder';
                const icon = document.createElement('i');
                icon.className = `fa ${get_media_type_icon(media.media_type)}`;
                placeholder.appendChild(icon);
                card_el.replaceChild(placeholder, thumb_div);
            };
            thumb_div.appendChild(img);
            card.appendChild(thumb_div);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'media-card-placeholder';
            const icon = document.createElement('i');
            icon.className = `fa ${get_media_type_icon(media.media_type)}`;
            placeholder.appendChild(icon);
            card.appendChild(placeholder);
        }

        // Info area
        const info = document.createElement('div');
        info.className = 'media-card-info';

        const name_el = document.createElement('div');
        name_el.className = 'media-card-name';
        const raw_name = media.name || media.original_filename || 'Untitled';
        const clean_name = strip_html_tags(raw_name);
        name_el.textContent = clean_name;
        name_el.title = clean_name;
        info.appendChild(name_el);

        const type_el = document.createElement('div');
        type_el.className = 'media-card-type';
        type_el.textContent = media.media_type || '';
        info.appendChild(type_el);

        card.appendChild(info);

        // Click handler — selection toggle
        card.addEventListener('click', function () {
            handle_card_select(media, card);
        });

        return card;
    }

    /**
     * Handles clicking a media card to toggle selection
     * @param {Object} media - Media library record
     * @param {HTMLElement} card_el - The clicked card element
     */
    function handle_card_select(media, card_el) {

        // Deselect all cards
        const all_cards = document.querySelectorAll('#media-picker-modal .media-card');
        all_cards.forEach(function (c) {
            c.classList.remove('selected');
        });

        // If clicking the already-selected card, deselect
        if (_selected_media && _selected_media.uuid === media.uuid) {
            _selected_media = null;
            update_selection_bar(null);
            return;
        }

        // Select this card
        card_el.classList.add('selected');
        _selected_media = media;
        update_selection_bar(media);
    }

    /**
     * Updates the selection bar at the bottom of the modal
     * @param {Object|null} media - Selected media or null
     */
    function update_selection_bar(media) {
        const bar = document.querySelector('#media-picker-selection-bar');
        const confirm_btn = document.querySelector('#media-picker-confirm-btn');

        if (!media) {
            if (bar) bar.style.visibility = 'hidden';
            if (confirm_btn) confirm_btn.disabled = true;
            return;
        }

        if (bar) bar.style.visibility = 'visible';
        if (confirm_btn) confirm_btn.disabled = false;

        // Update selection preview using textContent (XSS safe)
        const name_el = document.querySelector('#media-picker-selection-name');
        const type_el = document.querySelector('#media-picker-selection-type');
        const dims_el = document.querySelector('#media-picker-selection-dims');
        const thumb_el = document.querySelector('#media-picker-selection-thumb');

        if (name_el) name_el.textContent = strip_html_tags(media.name || media.original_filename || 'Untitled');
        if (type_el) type_el.textContent = media.media_type || '';

        if (dims_el) {
            dims_el.textContent = (media.media_width && media.media_height)
                ? ` | ${media.media_width}×${media.media_height}`
                : '';
        }

        if (thumb_el) {
            const thumb_url = get_thumbnail_url(media);
            if (thumb_url) {
                thumb_el.src = thumb_url;
                thumb_el.style.display = 'inline';
            } else {
                thumb_el.style.display = 'none';
            }
        }
    }

    /**
     * Renders pagination controls
     * @param {number} total_count - Total number of results
     * @param {number} current_page - Current page number
     */
    function render_pagination(total_count, current_page) {
        const container = document.querySelector('#media-picker-pagination');
        if (!container) return;

        container.innerHTML = '';

        const total_pages = Math.ceil(total_count / PAGE_SIZE);
        if (total_pages <= 1) return;

        // Previous button
        if (current_page > 1) {
            const prev_btn = document.createElement('button');
            prev_btn.className = 'page-btn';
            prev_btn.innerHTML = '&#9664;';
            prev_btn.addEventListener('click', function () {
                load_media_grid(current_page - 1, _search_term, _media_type_filter);
            });
            container.appendChild(prev_btn);
        }

        // Page number buttons (show max 7)
        let start_page = Math.max(1, current_page - 3);
        let end_page = Math.min(total_pages, start_page + 6);

        if (end_page - start_page < 6) {
            start_page = Math.max(1, end_page - 6);
        }

        for (let i = start_page; i <= end_page; i++) {
            const page_btn = document.createElement('button');
            page_btn.className = 'page-btn' + (i === current_page ? ' active' : '');
            page_btn.textContent = i;
            page_btn.addEventListener('click', (function (page_num) {
                return function () {
                    load_media_grid(page_num, _search_term, _media_type_filter);
                };
            })(i));
            container.appendChild(page_btn);
        }

        // Next button
        if (current_page < total_pages) {
            const next_btn = document.createElement('button');
            next_btn.className = 'page-btn';
            next_btn.innerHTML = '&#9654;';
            next_btn.addEventListener('click', function () {
                load_media_grid(current_page + 1, _search_term, _media_type_filter);
            });
            container.appendChild(next_btn);
        }
    }

    // ==================== CORE METHODS ====================

    /**
     * Loads media library items into the browse grid
     * @param {number} page - Page number (1-based)
     * @param {string} search_term - Search query
     * @param {string} media_type - Media type filter
     */
    async function load_media_grid(page, search_term, media_type) {

        const container = document.querySelector('#media-picker-grid-container');
        if (!container) return;

        // Increment request counter so earlier in-flight responses are discarded
        const this_request = ++_request_id;

        _current_page = page || 1;

        // Determine whether we already have content on screen.
        // If the container only holds the initial loading spinner (or is empty)
        // show the full spinner; otherwise keep existing cards visible and dim
        // them to signal a refresh without a jarring flash.
        const has_existing_content = container.querySelector('.media-grid') || container.querySelector('.media-empty');

        if (has_existing_content) {
            container.style.opacity = '0.5';
            container.style.pointerEvents = 'none';
        } else {
            container.innerHTML = '';
            const loading = document.createElement('div');
            loading.className = 'media-loading';
            loading.innerHTML = '<i class="fa fa-spinner fa-spin fa-2x"></i>&nbsp;&nbsp;Loading media...';
            container.appendChild(loading);
        }

        try {

            const token = authModule.get_user_token();
            if (!token) {
                throw new Error('Authentication token not available');
            }

            // Build query parameters
            const params = new URLSearchParams();
            params.append('page', _current_page);
            params.append('limit', PAGE_SIZE);

            if (search_term && search_term.trim()) {
                params.append('q', search_term.trim());
            }

            if (media_type && media_type.trim()) {
                params.append('media_type', media_type.trim());
            }

            // Use the media library browse endpoint (fetched lazily, not at IIFE time)
            const ml_endpoints = endpointsModule.get_media_library_endpoints();
            const endpoint_base = ml_endpoints?.media_records?.get?.endpoint || null;

            if (!endpoint_base) {
                throw new Error('Media library endpoint configuration not found');
            }

            const endpoint = `${endpoint_base}?${params.toString()}`;

            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            // Discard stale response — a newer request has been issued
            if (this_request !== _request_id) return;

            if (!response || !response.data) {
                throw new Error('Failed to load media library');
            }

            const records = response.data.data || [];
            const total_count = response.data.total || records.length;

            // Clear container and restore full opacity
            container.innerHTML = '';
            container.style.opacity = '';
            container.style.pointerEvents = '';

            if (records.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'media-empty';
                empty.textContent = search_term
                    ? 'No media found matching your search.'
                    : 'No media available in the library.';
                container.appendChild(empty);
                render_pagination(0, 1);
                return;
            }

            // Build grid
            const grid = document.createElement('div');
            grid.className = 'media-grid';

            for (let i = 0; i < records.length; i++) {
                const card = create_media_card(records[i]);

                // Restore selection state if this card was previously selected
                if (_selected_media && _selected_media.uuid === records[i].uuid) {
                    card.classList.add('selected');
                }

                grid.appendChild(card);
            }

            container.appendChild(grid);
            render_pagination(total_count, _current_page);

        } catch (error) {

            // Discard stale error — a newer request has superseded this one
            if (this_request !== _request_id) return;

            console.error('Error loading media grid:', error);

            container.innerHTML = '';
            container.style.opacity = '';
            container.style.pointerEvents = '';
            const error_div = document.createElement('div');
            error_div.className = 'media-empty';
            error_div.textContent = 'Error loading media library. Please try again.';
            container.appendChild(error_div);
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Opens the media picker modal
     * @param {Object} options
     * @param {string} options.role - 'hero_image' | 'item_media' | 'thumbnail'
     * @param {string} options.exhibit_uuid - Exhibit UUID (null for add form)
     * @param {string} options.previous_media_uuid - UUID of currently-bound media asset being replaced (null if none)
     * @param {string} options.media_type_filter - 'image' | 'video' | 'audio' | null
     * @param {boolean} options.create_exhibit_binding - Whether to create an exhibit_media_library junction record (default true; false for item forms)
     * @param {Function} options.on_select - Callback: (media_asset) => void
     */
    obj.open = function (options) {

        if (!options || typeof options !== 'object') {
            console.error('mediaPickerModule.open() requires an options object');
            return;
        }

        try {

            _current_role = options.role || null;
            _current_exhibit_uuid = options.exhibit_uuid || null;
            _previous_media_uuid = options.previous_media_uuid || null;
            _on_select_callback = options.on_select || null;
            _media_type_filter = options.media_type_filter || null;
            _create_exhibit_binding = options.create_exhibit_binding !== false;
            _selected_media = null;
            _search_term = '';
            _current_page = 1;

            // Reset UI state
            const search_input = document.querySelector('#media-picker-search');
            if (search_input) search_input.value = '';

            const type_filter = document.querySelector('#media-picker-type-filter');
            if (type_filter) {
                if (_media_type_filter) {
                    type_filter.value = _media_type_filter;
                    type_filter.disabled = true;
                } else {
                    type_filter.value = '';
                    type_filter.disabled = false;
                }
            }

            update_selection_bar(null);

            // Load first page
            load_media_grid(1, '', _media_type_filter);

        } catch (error) {
            console.error('Error in mediaPickerModule.open():', error);
        }

        // Show modal (Bootstrap 4) — always attempt even if grid load fails
        $('#media-picker-modal').modal('show');
    };

    /**
     * Confirms selection: invokes the callback with the selected media asset
     */
    obj.confirm_selection = async function () {

        if (!_selected_media) {
            console.warn('No media selected');
            return;
        }

        // If exhibit UUID is known and we have a role, manage bindings and exhibits field
        if (_current_exhibit_uuid && _current_role) {

            // Create exhibit_media_library junction record (exhibit-level bindings only).
            // Item forms set create_exhibit_binding=false because items store their own
            // media_uuid — the junction table is only for exhibit-level media slots.
            if (_create_exhibit_binding) {
                try {

                    const token = authModule.get_user_token();
                    if (!token) {
                        throw new Error('Authentication token not available');
                    }

                    const exhibits_endpoints = endpointsModule.get_exhibits_endpoints();
                    const endpoint_base = exhibits_endpoints?.exhibits?.exhibit_media_library?.post?.endpoint;

                    if (endpoint_base) {
                        const endpoint = endpoint_base.replace(':exhibit_id', encodeURIComponent(_current_exhibit_uuid));

                        await httpModule.req({
                            method: 'POST',
                            url: endpoint,
                            data: {
                                media_uuid: _selected_media.uuid,
                                media_role: _current_role
                            },
                            headers: {
                                'Content-Type': 'application/json',
                                'x-access-token': token
                            }
                        });
                    }

                } catch (error) {
                    console.error('Error creating media binding:', error);
                    // Continue — the callback will still fire so the UI updates
                }
            }

            // Update the exhibits field on media library records (fire-and-forget).
            // This runs for ALL contexts (exhibit and item forms) so the media record
            // always knows which exhibits reference it.
            try {

                const token = authModule.get_user_token();
                const exhibits_endpoint_base = get_media_exhibits_endpoint();

                if (token && exhibits_endpoint_base) {

                    // If replacing existing media, remove exhibit UUID from old media record
                    if (_previous_media_uuid && _previous_media_uuid !== _selected_media.uuid) {

                        const remove_endpoint = exhibits_endpoint_base.replace(':media_id', encodeURIComponent(_previous_media_uuid));

                        httpModule.req({
                            method: 'PUT',
                            url: remove_endpoint,
                            data: {
                                exhibit_uuid: _current_exhibit_uuid,
                                action: 'remove',
                                media_role: _current_role || null
                            },
                            headers: {
                                'Content-Type': 'application/json',
                                'x-access-token': token
                            }
                        }).catch(function (err) {
                            console.error('Error removing exhibit from previous media record:', err);
                        });
                    }

                    // Add exhibit UUID to newly selected media record
                    const add_endpoint = exhibits_endpoint_base.replace(':media_id', encodeURIComponent(_selected_media.uuid));

                    httpModule.req({
                        method: 'PUT',
                        url: add_endpoint,
                        data: {
                            exhibit_uuid: _current_exhibit_uuid,
                            action: 'add',
                            media_role: _current_role || null
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            'x-access-token': token
                        }
                    }).catch(function (err) {
                        console.error('Error adding exhibit to media record:', err);
                    });
                }

            } catch (error) {
                console.error('Error updating media exhibits field:', error);
                // Non-blocking — UI update proceeds regardless
            }
        }

        // Invoke callback
        if (_on_select_callback && typeof _on_select_callback === 'function') {
            _on_select_callback(_selected_media);
        }

        // Close modal
        $('#media-picker-modal').modal('hide');
    };

    /**
     * Resets modal state on close
     */
    obj.reset = function () {
        _selected_media = null;
        _current_role = null;
        _current_exhibit_uuid = null;
        _previous_media_uuid = null;
        _on_select_callback = null;
        _media_type_filter = null;
        _create_exhibit_binding = true;
        _current_page = 1;
        _search_term = '';
        _request_id = 0;
    };

    /**
     * Removes an exhibit UUID from a media record's exhibits field.
     * Use when media is cleared/unbound from an exhibit without opening the picker
     * (e.g., a "Remove hero image" button on the exhibit edit page).
     *
     * @param {string} media_uuid - UUID of the media record to update
     * @param {string} exhibit_uuid - UUID of the exhibit to disassociate
     * @param {string|null} media_role - Role context for logging ('item_media', 'thumbnail', 'hero_image', etc.)
     * @returns {Promise<boolean>} Whether the API call succeeded
     */
    obj.remove_exhibit_association = async function (media_uuid, exhibit_uuid, media_role) {

        if (!media_uuid || !exhibit_uuid) {
            console.warn('remove_exhibit_association: media_uuid and exhibit_uuid are required');
            return false;
        }

        try {

            const token = authModule.get_user_token();
            if (!token) {
                throw new Error('Authentication token not available');
            }

            const exhibits_endpoint_base = get_media_exhibits_endpoint();

            if (!exhibits_endpoint_base) {
                throw new Error('Media exhibits endpoint not found');
            }

            const endpoint = exhibits_endpoint_base.replace(':media_id', encodeURIComponent(media_uuid));

            const response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: {
                    exhibit_uuid: exhibit_uuid,
                    action: 'remove',
                    media_role: media_role || null
                },
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            return !!(response && response.data && response.data.success);

        } catch (error) {
            console.error('Error removing exhibit association:', error);
            return false;
        }
    };

    /**
     * Initialize event listeners for the modal
     * Called once when the page loads
     */
    obj.init = function () {

        // Confirm button
        const confirm_btn = document.querySelector('#media-picker-confirm-btn');
        if (confirm_btn) {
            confirm_btn.addEventListener('click', obj.confirm_selection);
        }

        // Search input with debounce
        const search_input = document.querySelector('#media-picker-search');
        if (search_input) {
            search_input.addEventListener('input', function () {
                if (_search_timeout) {
                    clearTimeout(_search_timeout);
                }
                _search_timeout = setTimeout(function () {
                    _search_term = search_input.value;
                    _selected_media = null;
                    update_selection_bar(null);
                    load_media_grid(1, _search_term, _media_type_filter);
                }, SEARCH_DEBOUNCE_MS);
            });
        }

        // Type filter change
        const type_filter = document.querySelector('#media-picker-type-filter');
        if (type_filter) {
            type_filter.addEventListener('change', function () {
                // Only allow filter changes when not locked by caller
                if (!type_filter.disabled) {
                    _media_type_filter = type_filter.value || null;
                    _selected_media = null;
                    update_selection_bar(null);
                    load_media_grid(1, _search_term, _media_type_filter);
                }
            });
        }

        // Reset state when modal is hidden
        $('#media-picker-modal').on('hidden.bs.modal', function () {
            obj.reset();
        });

        console.debug('mediaPickerModule initialized');
    };

    return obj;

}());
