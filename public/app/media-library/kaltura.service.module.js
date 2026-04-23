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

const kalturaServiceModule = (function() {

    'use strict';

    // Dependency guard — fail fast if shared helper is not loaded
    if (typeof helperMediaLibraryModule === 'undefined') {
        console.error('FATAL: helperMediaLibraryModule must be loaded before kaltura.service.module.js. Check script order in dashboard-media-home.ejs.');
        return {};
    }

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    let obj = {};

    // Shared helpers scoped to the Kaltura tab message container
    const { display_message, clear_message, escape_html } = helperMediaLibraryModule.create_message_helper('kaltura-item-data');
    const HTTP_STATUS = helperMediaLibraryModule.HTTP_STATUS;

    /**
     * Show loading indicator
     */
    const show_loading = () => {
        const message_container = document.getElementById('kaltura-item-data');
        if (message_container) {
            message_container.innerHTML = '<div class="text-center py-4">' +
                '<i class="fa fa-spinner fa-spin fa-2x" aria-hidden="true"></i>' +
                '<p class="mt-2 text-muted">Retrieving Kaltura media metadata...</p>' +
                '</div>';
        }
    };

    /**
     * Hide loading indicator
     */
    const hide_loading = () => {
        const message_container = document.getElementById('kaltura-item-data');
        if (message_container) {
            message_container.innerHTML = '';
        }
    };

    /**
     * Show the Kaltura thumbnail
     * @param {string} thumbnail_url - Kaltura thumbnail URL
     * @param {string} title - Media title for alt text
     */
    const show_thumbnail = (thumbnail_url, title) => {
        const container = document.getElementById('kaltura-thumbnail-container');
        const img = document.getElementById('kaltura-thumbnail');
        const caption = document.getElementById('kaltura-thumbnail-caption');

        if (!container || !img) return;

        if (thumbnail_url) {
            img.src = thumbnail_url;
            img.alt = 'Thumbnail for ' + (title || 'Kaltura media');
            if (caption) {
                caption.textContent = title || 'Kaltura media thumbnail';
            }
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    };

    /**
     * Hide the Kaltura thumbnail
     */
    const hide_thumbnail = () => {
        const container = document.getElementById('kaltura-thumbnail-container');
        if (container) {
            container.style.display = 'none';
        }
    };

    /**
     * Get Kaltura media metadata by entry ID
     * @param {string} entry_id - Kaltura entry ID
     * @returns {Promise<Object>} Result with media data
     */
    obj.get_kaltura_media = async function(entry_id) {

        try {

            if (!entry_id || entry_id.trim().length === 0) {
                display_message('warning', 'Please enter a Kaltura entry ID');
                return { success: false, message: 'No entry ID' };
            }

            const trimmed_id = entry_id.trim();

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.kaltura_media?.get?.endpoint) {
                display_message('danger', 'Kaltura endpoint not configured');
                return { success: false, message: 'Endpoint not configured' };
            }

            // Validate authentication
            const token = authModule.get_user_token();
            if (!token || token === false) {
                display_message('danger', 'Session expired. Please log in again.');
                return { success: false, message: 'Authentication required' };
            }

            show_loading();
            clear_message();
            hide_thumbnail();

            // Check for duplicate before fetching from Kaltura API
            if (EXHIBITS_ENDPOINTS?.media_duplicate_check?.get?.endpoint) {
                try {
                    const dup_endpoint = EXHIBITS_ENDPOINTS.media_duplicate_check.get.endpoint +
                        '?field=kaltura_entry_id&value=' + encodeURIComponent(trimmed_id);

                    const dup_response = await httpModule.req({
                        method: 'GET',
                        url: dup_endpoint,
                        headers: {
                            'Content-Type': 'application/json',
                            'x-access-token': token
                        },
                        timeout: 10000,
                        validateStatus: (status) => status >= 200 && status < 600
                    });

                    if (dup_response && dup_response.status === HTTP_STATUS.OK &&
                        dup_response.data?.success && dup_response.data?.data?.exists) {

                        hide_loading();
                        const existing = dup_response.data.data.record;
                        const display_name = existing?.name ? ' (' + escape_html(existing.name) + ')' : '';
                        display_message('warning',
                            'This item already exists in the media library' + display_name +
                            '.');
                        return { success: false, message: 'Duplicate entry' };
                    }
                } catch (dup_error) {
                    // Log but don't block — allow the import to proceed if the check itself fails
                    console.warn('Duplicate check failed, proceeding with import:', dup_error);
                }
            }

            // Build endpoint URL - replace :entry_id placeholder with actual entry ID
            const endpoint = EXHIBITS_ENDPOINTS.kaltura_media.get.endpoint.replace(':entry_id', encodeURIComponent(trimmed_id));

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

            hide_loading();

            if (!response) {
                display_message('danger', 'No response from server');
                return { success: false, message: 'No response' };
            }

            if (response.status === HTTP_STATUS.OK && response.data?.success) {

                const media_data = response.data.data;

                if (!media_data) {
                    display_message('warning', 'No media data returned for entry ID: ' + escape_html(trimmed_id));
                    return { success: false, message: 'No media data' };
                }

                // Show thumbnail on the tab
                show_thumbnail(media_data.thumbnail, media_data.title);

                // Set the hidden item type field
                const item_type_field = document.getElementById('kaltura-item-type');
                if (item_type_field) {
                    item_type_field.value = media_data.item_type || '';
                }

                // Set the is-kaltura-item flag
                const kaltura_flag = document.getElementById('is-kaltura-item');
                if (kaltura_flag) {
                    kaltura_flag.value = '1';
                }

                // Open the Kaltura modal with the media data
                if (typeof kalturaModalsModule !== 'undefined' && typeof kalturaModalsModule.open_kaltura_media_modal === 'function') {
                    kalturaModalsModule.open_kaltura_media_modal(media_data, (saved) => {
                        if (saved) {
                            display_message('success', 'Kaltura media imported successfully to your media library.');
                            hide_thumbnail();

                            // Clear the entry ID input
                            const entry_input = document.getElementById('audio-video');
                            if (entry_input) {
                                entry_input.value = '';
                            }

                            // Reset hidden fields
                            if (item_type_field) item_type_field.value = '';
                            if (kaltura_flag) kaltura_flag.value = '0';

                            // Refresh media library table
                            if (typeof mediaLibraryModule !== 'undefined' && typeof mediaLibraryModule.refresh_media_records === 'function') {
                                mediaLibraryModule.refresh_media_records();
                            }
                        }
                    });
                } else {
                    console.error('kalturaModalsModule not available');
                    display_message('danger', 'Import modal not available. Please refresh the page.');
                }

                return { success: true, data: media_data };
            }

            // Handle error responses
            const error_message = response.data?.message || 'Failed to retrieve Kaltura media metadata';
            display_message('danger', error_message);
            return { success: false, message: error_message };

        } catch (error) {
            console.error('Error getting Kaltura media:', error);
            hide_loading();
            display_message('danger', 'An unexpected error occurred while retrieving Kaltura media.');
            return { success: false, message: error.message };
        }
    };

    /**
     * Initialize event listeners for Kaltura tab
     */
    const init_event_listeners = () => {

        // Get Item metadata button click
        const kaltura_btn = document.getElementById('kaltura-btn');
        if (kaltura_btn) {
            kaltura_btn.addEventListener('click', async (event) => {
                event.preventDefault();
                const entry_input = document.getElementById('audio-video');
                if (entry_input) {
                    await obj.get_kaltura_media(entry_input.value);
                }
            });
        }

        // Search on Enter key
        const entry_input = document.getElementById('audio-video');
        if (entry_input) {
            entry_input.addEventListener('keypress', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    await obj.get_kaltura_media(entry_input.value);
                }
            });
        }
    };

    /**
     * Initialize the Kaltura service module
     */
    obj.init = function() {
        init_event_listeners();
        console.debug('Kaltura service module initialized');
        return true;
    };

    return obj;

}());
