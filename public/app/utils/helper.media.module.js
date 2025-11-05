/**

 Copyright 2025 University of Denver

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

const helperMediaModule = (function () {

    'use strict';

    let obj = {};

    obj.get_repo_item_data = async function(uuid) {

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                message: document.querySelector('#message'),
                repo_uuid_input: document.querySelector('#repo-uuid'),
                repo_item_metadata: document.querySelector('#repo-item-metadata'),
                thumbnail: document.querySelector('#tn'),
                item_mime_type: document.querySelector('#item-mime-type'),
                item_type: document.querySelector('#item-type'),
                is_repo_item: document.querySelector('#is-repo-item'),
                image_alt_text: document.querySelector('#image-alt-text')
            };
        };

        /**
         * Display status message to user
         */
        const display_message = (element, type, message) => {

            if (!element) {
                return;
            }

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = get_icon_class(alert_type);
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

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
         * Display metadata error message (XSS-safe)
         */
        const display_metadata_error = (element, message) => {
            if (!element) {
                return;
            }

            const error_paragraph = document.createElement('p');
            error_paragraph.style.color = 'red';
            error_paragraph.textContent = message;

            element.textContent = '';
            element.appendChild(error_paragraph);
        };

        /**
         * Display repository item metadata (XSS-safe)
         */
        const display_repo_metadata = (element, title, mime_type) => {
            if (!element) {
                return;
            }

            const paragraph = document.createElement('p');

            const title_strong = document.createElement('strong');
            title_strong.textContent = title;
            paragraph.appendChild(title_strong);

            const line_break = document.createElement('br');
            paragraph.appendChild(line_break);

            const mime_em = document.createElement('em');
            mime_em.textContent = mime_type;
            paragraph.appendChild(mime_em);

            element.textContent = '';
            element.appendChild(paragraph);
        };

        /**
         * Display repository thumbnail (XSS-safe)
         */
        const display_thumbnail = (element, thumbnail_url) => {
            if (!element) {
                return;
            }

            const img = document.createElement('img');
            img.src = thumbnail_url;
            img.alt = 'Repository item thumbnail';
            img.height = 200;
            img.width = 200;
            img.style.border = 'solid';

            element.textContent = '';
            element.appendChild(img);
        };

        /**
         * Determine item type from MIME type
         */
        const determine_item_type = (mime_type) => {
            if (!mime_type) {
                return 'unknown';
            }

            const mime_lower = mime_type.toLowerCase();

            if (mime_lower.indexOf('image') !== -1) {
                return 'image';
            } else if (mime_lower.indexOf('video') !== -1) {
                return 'video';
            } else if (mime_lower.indexOf('audio') !== -1) {
                return 'audio';
            } else if (mime_lower.indexOf('pdf') !== -1) {
                return 'pdf';
            }

            return 'unknown';
        };

        /**
         * Validate UUID format
         */
        const is_valid_uuid = (uuid_string) => {
            if (!uuid_string || typeof uuid_string !== 'string') {
                return false;
            }

            const uuid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuid_pattern.test(uuid_string.trim());
        };

        /**
         * Update UI with repository item data
         */
        const update_ui_with_repo_data = (repo_data, elements) => {
            const mime_type = repo_data.mime_type;
            const item_type = determine_item_type(mime_type);

            // Display thumbnail
            if (elements.thumbnail && repo_data.thumbnail?.data) {
                const thumbnail_url = helperMediaModule.render_repo_thumbnail(repo_data.thumbnail.data);
                display_thumbnail(elements.thumbnail, thumbnail_url);
            }

            // Set MIME type
            if (elements.item_mime_type) {
                elements.item_mime_type.value = mime_type;
            }

            // Set item type
            if (elements.item_type) {
                elements.item_type.value = item_type;
            }

            // Display metadata
            if (elements.repo_item_metadata) {
                display_repo_metadata(elements.repo_item_metadata, repo_data.title, mime_type);
            }

            // Mark as repository item
            if (elements.is_repo_item) {
                elements.is_repo_item.value = '1';
            }

            // Show alt text field for images
            if (item_type === 'image' && elements.image_alt_text) {
                elements.image_alt_text.style.display = 'block';
            }
        };

        try {
            // Cache DOM elements
            const elements = cache_dom_elements();

            // Determine if this is a list call or direct call
            let is_list = true;
            let uuid_to_fetch = uuid;

            // If uuid is null, get from input field
            if (uuid_to_fetch === null || uuid_to_fetch === undefined) {
                if (!elements.repo_uuid_input) {
                    display_message(elements.message, 'danger', 'Repository UUID input field not found');
                    return false;
                }

                uuid_to_fetch = elements.repo_uuid_input.value.trim();
                is_list = false;

                // Clear media fields when fetching from input
                if (typeof helperMediaModule?.clear_media_fields === 'function') {
                    helperMediaModule.clear_media_fields('repo_media');
                }
            }

            // Validate UUID
            if (!uuid_to_fetch || uuid_to_fetch.length === 0) {
                display_message(elements.message, 'danger', 'Please enter a Repository UUID');
                return false;
            }

            if (!is_valid_uuid(uuid_to_fetch)) {
                display_message(elements.message, 'danger', 'Invalid UUID format. Please check and try again.');
                return false;
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(elements.message, 'danger', 'Session expired. Please log in again.');
                return false;
            }

            // Get API endpoints
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            if (!EXHIBITS_ENDPOINTS?.exhibits?.repo_items?.endpoint) {
                display_message(elements.message, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.repo_items.endpoint
                .replace(':uuid', encodeURIComponent(uuid_to_fetch));

            // Make API request
            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 200) {
                display_metadata_error(elements.repo_item_metadata, 'Metadata record not found in repository.');
                return false;
            }

            if (!response.data?.data) {
                display_metadata_error(elements.repo_item_metadata, 'Invalid response structure from repository.');
                return false;
            }

            const repo_data = response.data.data;

            // Check if compound object (not supported)
            if (repo_data.is_compound === 1 || repo_data.is_compound === true) {
                display_metadata_error(elements.repo_item_metadata, 'Repository compound objects are not supported.');
                return false;
            }

            // Update UI with repository data
            update_ui_with_repo_data(repo_data, elements);

            // Return data if this is a list call
            if (is_list === true) {
                return repo_data;
            }

            return true;

        } catch (error) {
            console.error('Error fetching repository item data:', error);

            const elements = cache_dom_elements();
            const error_message = error.user_message || error.message || 'Unable to fetch repository item data. Please try again.';
            display_message(elements.message, 'danger', error_message);

            return false;
        }
    };

    /**
     * Get icon class for alert type (shared utility)
     */
    function get_icon_class(alert_type) {
        const icon_map = {
            'info': 'fa fa-info',
            'success': 'fa fa-check',
            'danger': 'fa fa-exclamation',
            'warning': 'fa fa-exclamation-triangle'
        };

        return icon_map[alert_type] || 'fa fa-info';
    }

    obj.render_repo_thumbnail = function(thumbnail_data_array, mime_type = 'image/jpeg') {

        /**
         * Display error message
         */
        const display_error_message = (message) => {
            const message_element = document.querySelector('#message');

            if (!message_element) {
                console.error('Message element not found:', message);
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = 'alert alert-danger';
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-exclamation';
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            message_element.textContent = '';
            message_element.appendChild(alert_div);
        };

        /**
         * Validate thumbnail data array
         */
        const validate_thumbnail_data = (data_array) => {
            if (!data_array) {
                return {
                    valid: false,
                    error: 'Thumbnail data is required'
                };
            }

            // Check if it's an array or array-like object
            if (!Array.isArray(data_array) && !(data_array instanceof Uint8Array) &&
                (typeof data_array !== 'object' || typeof data_array.length !== 'number')) {
                return {
                    valid: false,
                    error: 'Invalid thumbnail data format. Expected array or array-like object.'
                };
            }

            // Check if array is empty
            if (data_array.length === 0) {
                return {
                    valid: false,
                    error: 'Thumbnail data array is empty'
                };
            }

            // Validate data size (reasonable limits)
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            if (data_array.length > MAX_SIZE) {
                return {
                    valid: false,
                    error: 'Thumbnail data exceeds maximum size limit'
                };
            }

            return { valid: true };
        };

        /**
         * Validate MIME type
         */
        const validate_mime_type = (mime) => {
            if (!mime || typeof mime !== 'string') {
                return 'image/jpeg'; // Default fallback
            }

            const valid_image_types = [
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/svg+xml',
                'image/bmp'
            ];

            const mime_lower = mime.toLowerCase().trim();

            if (valid_image_types.includes(mime_lower)) {
                return mime_lower;
            }

            // If not valid, return default
            console.warn(`Invalid MIME type "${mime}", using default image/jpeg`);
            return 'image/jpeg';
        };

        try {
            // Validate input data
            const validation = validate_thumbnail_data(thumbnail_data_array);
            if (!validation.valid) {
                display_error_message(validation.error);
                return null;
            }

            // Validate and normalize MIME type
            const validated_mime_type = validate_mime_type(mime_type);

            // Convert to Uint8Array if not already
            let array_buffer_view;
            if (thumbnail_data_array instanceof Uint8Array) {
                array_buffer_view = thumbnail_data_array;
            } else {
                array_buffer_view = new Uint8Array(thumbnail_data_array);
            }

            // Create blob from binary data
            const blob = new Blob([array_buffer_view], { type: validated_mime_type });

            // Validate blob was created successfully
            if (!blob || blob.size === 0) {
                throw new Error('Failed to create blob from thumbnail data');
            }

            // Create object URL
            // Note: Modern browsers all support URL.createObjectURL
            // window.webkitURL fallback is no longer needed
            if (!window.URL || typeof window.URL.createObjectURL !== 'function') {
                throw new Error('Browser does not support URL.createObjectURL');
            }

            const object_url = window.URL.createObjectURL(blob);

            if (!object_url) {
                throw new Error('Failed to create object URL');
            }

            // Log for debugging (helpful for memory leak tracking)
            console.log('Created object URL for thumbnail:', object_url);

            // IMPORTANT: The caller should revoke this URL when done using it
            // Example: window.URL.revokeObjectURL(url) when image loads or component unmounts

            return object_url;

        } catch (error) {
            console.error('Error rendering repository thumbnail:', error);

            const error_message = error.message || 'Unable to render thumbnail. Please try again.';
            display_error_message(error_message);

            return null;
        }
    };

    /**
     * Revoke object URL to free memory
     * Should be called when thumbnail is no longer needed
     *
     * @param {string} object_url - The URL to revoke
     */
    obj.revoke_thumbnail_url = function(object_url) {
        if (!object_url || typeof object_url !== 'string') {
            return;
        }

        try {
            if (window.URL && typeof window.URL.revokeObjectURL === 'function') {
                window.URL.revokeObjectURL(object_url);
                console.log('Revoked object URL:', object_url);
            }
        } catch (error) {
            console.error('Error revoking object URL:', error);
        }
    };

    /**
     * Helper function to display thumbnail with automatic cleanup
     *
     * @param {Uint8Array|Array} thumbnail_data_array - Binary thumbnail data
     * @param {HTMLImageElement} img_element - Image element to display thumbnail
     * @param {string} mime_type - MIME type (default: 'image/jpeg')
     */
    obj.display_repo_thumbnail_safe = function(thumbnail_data_array, img_element, mime_type = 'image/jpeg') {
        if (!img_element || !(img_element instanceof HTMLImageElement)) {
            console.error('Valid image element required');
            return;
        }

        const object_url = obj.render_repo_thumbnail(thumbnail_data_array, mime_type);

        if (!object_url) {
            console.error('Failed to create thumbnail URL');
            return;
        }

        // Set the image source
        img_element.src = object_url;

        // Automatically revoke URL after image loads to prevent memory leak
        img_element.onload = function() {
            // Small delay to ensure rendering is complete
            setTimeout(() => {
                obj.revoke_thumbnail_url(object_url);
            }, 100);
        };

        // Also revoke on error
        img_element.onerror = function() {
            obj.revoke_thumbnail_url(object_url);
            console.error('Failed to load thumbnail image');
        };
    };

    obj.clear_media_fields = function(type) {

        /**
         * Define field configurations for each media type
         */
        const media_type_fields = {
            'uploaded_media': {
                clear_repo: true,
                clear_kaltura: true
            },
            'repo_media': {
                clear_repo: false,
                clear_kaltura: true
            },
            'kaltura_media': {
                clear_repo: true,
                clear_kaltura: false
            }
        };

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                // Type-specific fields
                repo_uuid: document.querySelector('#repo-uuid'),
                audio_video: document.querySelector('#audio-video'),
                is_kaltura_item: document.querySelector('#is-kaltura-item'),
                is_repo_item: document.querySelector('#is-repo-item'),

                // Common fields
                item_type: document.querySelector('#item-type'),
                item_mime_type: document.querySelector('#item-mime-type'),
                item_media: document.querySelector('#item-media'),
                media_thumbnail_display: document.querySelector('#item-media-thumbnail-image-display'),
                media_filename_display: document.querySelector('#item-media-filename-display'),
                media_trash: document.querySelector('#item-media-trash')
            };
        };

        /**
         * Clear repository-specific fields
         */
        const clear_repo_fields = (elements) => {
            if (elements.repo_uuid) {
                elements.repo_uuid.value = '';
            }

            if (elements.is_repo_item) {
                elements.is_repo_item.value = '0';
            }
        };

        /**
         * Clear Kaltura-specific fields
         */
        const clear_kaltura_fields = (elements) => {
            if (elements.audio_video) {
                elements.audio_video.value = '';
            }

            if (elements.is_kaltura_item) {
                elements.is_kaltura_item.value = '0';
            }
        };

        /**
         * Clear common media fields
         */
        const clear_common_fields = (elements) => {
            if (elements.item_type) {
                elements.item_type.value = '';
            }

            if (elements.item_mime_type) {
                elements.item_mime_type.value = '';
            }

            if (elements.item_media) {
                elements.item_media.value = '';
            }

            // Use textContent instead of innerHTML for security
            if (elements.media_thumbnail_display) {
                elements.media_thumbnail_display.textContent = '';
            }

            if (elements.media_filename_display) {
                elements.media_filename_display.textContent = '';
            }

            if (elements.media_trash) {
                elements.media_trash.style.display = 'none';
            }
        };

        try {
            // Validate type parameter
            const valid_types = ['uploaded_media', 'repo_media', 'kaltura_media'];

            if (!type || !valid_types.includes(type)) {
                console.warn(`Invalid media type "${type}". Expected one of: ${valid_types.join(', ')}`);
                return false;
            }

            // Cache DOM elements once
            const elements = cache_dom_elements();

            // Get field configuration for this type
            const config = media_type_fields[type];

            // Clear type-specific fields based on configuration
            if (config.clear_repo) {
                clear_repo_fields(elements);
            }

            if (config.clear_kaltura) {
                clear_kaltura_fields(elements);
            }

            // Always clear common fields
            clear_common_fields(elements);

            console.log(`Media fields cleared for type: ${type}`);
            return true;

        } catch (error) {
            console.error('Error clearing media fields:', error);
            return false;
        }
    };

    obj.get_kaltura_item_data = async function(entry_id) {

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                message: document.querySelector('#message'),
                audio_video_input: document.querySelector('#audio-video'),
                kaltura_item_data: document.querySelector('#kaltura-item-data'),
                kaltura_thumbnail: document.querySelector('#kaltura-thumbnail'),
                kaltura_item_type: document.querySelector('#kaltura-item-type')
            };
        };

        /**
         * Display status message
         */
        const display_message = (element, type, message) => {
            if (!element) {
                return;
            }

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = get_icon_class(alert_type);
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

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
         * Display error message
         */
        const display_error_message = (element, message) => {
            if (!element) {
                return;
            }

            const paragraph = document.createElement('p');
            paragraph.style.color = 'red';
            paragraph.textContent = message;

            element.textContent = '';
            element.appendChild(paragraph);
        };

        /**
         * Display Kaltura item metadata
         */
        const display_kaltura_metadata = (element, kaltura_data) => {

            if (!element) {
                return;
            }

            const paragraph = document.createElement('p');

            // Title
            const title_strong = document.createElement('strong');
            title_strong.textContent = kaltura_data.title || 'Untitled';
            paragraph.appendChild(title_strong);

            // Line break
            paragraph.appendChild(document.createElement('br'));

            // Item type in parentheses (italic)
            const type_text = document.createTextNode(' (');
            paragraph.appendChild(type_text);

            const type_em = document.createElement('em');
            type_em.textContent = kaltura_data.item_type || 'unknown';
            paragraph.appendChild(type_em);

            const close_paren = document.createTextNode(')');
            paragraph.appendChild(close_paren);

            // if (kaltura_data.description) {
            //     paragraph.appendChild(document.createElement('br'));
            //     const desc_small = document.createElement('small');
            //     desc_small.textContent = kaltura_data.description;
            //     paragraph.appendChild(desc_small);
            // }

            element.textContent = '';
            element.appendChild(paragraph);
        };

        /**
         * Validate Kaltura entry ID format
         */
        const validate_entry_id = (id) => {
            if (!id || typeof id !== 'string') {
                return {
                    valid: false,
                    error: 'Entry ID is required'
                };
            }

            const trimmed_id = id.trim();

            if (trimmed_id.length === 0) {
                return {
                    valid: false,
                    error: 'Please enter a Kaltura ID'
                };
            }

            // Format: 0_xxxxxxxx or 1_xxxxxxxx (partner ID + random string)
            const entry_id_pattern = /^[0-9]_[a-zA-Z0-9_-]+$/;

            if (!entry_id_pattern.test(trimmed_id)) {
                console.warn(`Entry ID "${trimmed_id}" has non-standard format`);
                // Allow it but log warning - some Kaltura IDs may vary
            }

            // Reasonable length check (Kaltura IDs are typically 10-20 chars)
            if (trimmed_id.length > 50) {
                return {
                    valid: false,
                    error: 'Entry ID appears to be invalid (too long)'
                };
            }

            return {
                valid: true,
                id: trimmed_id
            };
        };

        /**
         * Update UI with Kaltura item data
         */
        const update_ui_with_kaltura_data = (kaltura_data, elements) => {
            // Display metadata
            if (elements.kaltura_item_data) {
                display_kaltura_metadata(elements.kaltura_item_data, kaltura_data);
            }

            // Set thumbnail
            if (elements.kaltura_thumbnail && kaltura_data.thumbnail) {
                elements.kaltura_thumbnail.src = kaltura_data.thumbnail;
                elements.kaltura_thumbnail.alt = kaltura_data.title || 'Kaltura item thumbnail';
                elements.kaltura_thumbnail.style.visibility = 'visible';
            }

            // Set item type
            if (elements.kaltura_item_type) {
                elements.kaltura_item_type.value = kaltura_data.item_type || '';
            }
        };

        try {
            // Cache DOM elements
            const elements = cache_dom_elements();

            // Determine if this is a list call or direct call
            let is_list = true;
            let entry_id_to_fetch = entry_id;

            // If entry_id is null, get from input field
            if (entry_id_to_fetch === null || entry_id_to_fetch === undefined) {
                if (!elements.audio_video_input) {
                    display_message(elements.message, 'danger', 'Kaltura ID input field not found');
                    return false;
                }

                entry_id_to_fetch = elements.audio_video_input.value.trim();
                is_list = false;

                // Clear media fields when fetching from input
                if (typeof helperMediaModule?.clear_media_fields === 'function') {
                    helperMediaModule.clear_media_fields('kaltura_media');
                }
            }

            // Validate entry ID
            const validation = validate_entry_id(entry_id_to_fetch);
            if (!validation.valid) {
                display_message(elements.message, 'danger', validation.error);
                return false;
            }

            // Use validated/trimmed ID
            const validated_entry_id = validation.id;

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(elements.message, 'danger', 'Session expired. Please log in again.');
                return false;
            }

            // Get API endpoints
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            if (!EXHIBITS_ENDPOINTS?.exhibits?.kaltura_items?.endpoint) {
                display_message(elements.message, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.kaltura_items.endpoint
                .replace(':entry_id', encodeURIComponent(validated_entry_id));

            // Make API request
            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 200) {
                display_error_message(elements.kaltura_item_data, 'Kaltura item not found or unavailable.');
                return false;
            }

            if (!response.data?.data) {
                display_error_message(elements.kaltura_item_data, 'Invalid response structure from Kaltura service.');
                return false;
            }

            const kaltura_data = response.data.data;

            // Check if item_type is missing (indicates error from API)
            if (!kaltura_data.item_type || kaltura_data.item_type === undefined) {
                const error_msg = kaltura_data.message || 'Kaltura item is invalid or unavailable';
                display_error_message(elements.kaltura_item_data, error_msg);
                return false;
            }

            // Update UI with Kaltura data
            update_ui_with_kaltura_data(kaltura_data, elements);

            console.log('Kaltura item loaded:', validated_entry_id);

            // Return data if this is a list call
            if (is_list === true) {
                return kaltura_data;
            }

            return true;

        } catch (error) {
            console.error('Error fetching Kaltura item data:', error);

            const elements = cache_dom_elements();
            const error_message = error.user_message || error.message || 'Unable to fetch Kaltura item data. Please try again.';
            display_message(elements.message, 'danger', error_message);

            return false;
        }
    };

    obj.toggle_alt_text = function() {

        /**
         * Display error message (XSS-safe)
         */
        const display_error_message = (message) => {
            const message_element = document.querySelector('#message');

            if (!message_element) {
                console.error('Message element not found:', message);
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = 'alert alert-danger';
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-exclamation';
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            message_element.textContent = '';
            message_element.appendChild(alert_div);
        };

        /**
         * Update ARIA attributes for accessibility
         */
        const update_aria_attributes = (input_element, is_disabled) => {
            if (!input_element) {
                return;
            }

            if (is_disabled) {
                input_element.setAttribute('aria-label', 'Alt text (decorative image - disabled)');
                input_element.setAttribute('aria-disabled', 'true');
            } else {
                input_element.setAttribute('aria-label', 'Alt text for image');
                input_element.setAttribute('aria-disabled', 'false');
            }
        };

        /**
         * Clear alt text when marking as decorative
         */
        const handle_decorative_state = (input_element, is_disabled) => {
            if (!input_element) {
                return;
            }

            if (is_disabled) {
                // Store current value in case user wants to undo
                input_element.setAttribute('data-previous-value', input_element.value);
                input_element.value = '';
                input_element.placeholder = 'Decorative image (no alt text needed)';
            } else {
                // Restore previous value if it exists
                const previous_value = input_element.getAttribute('data-previous-value');
                if (previous_value) {
                    input_element.value = previous_value;
                    input_element.removeAttribute('data-previous-value');
                }
                input_element.placeholder = 'Enter descriptive alt text for the image';
            }
        };

        /**
         * Update related checkbox if it exists
         */
        const update_decorative_checkbox = (is_disabled) => {
            const decorative_checkbox = document.querySelector('#is-decorative-image, #image-is-decorative');

            if (decorative_checkbox) {
                decorative_checkbox.checked = is_disabled;
            }
        };

        try {
            // Get alt text input element
            const alt_text_input = document.querySelector('#item-alt-text-input');

            // Validate element exists
            if (!alt_text_input) {
                console.error('Alt text input element (#item-alt-text-input) not found');
                display_error_message('Alt text input field not found');
                return false;
            }

            // Get current disabled state
            const is_currently_disabled = alt_text_input.disabled;

            // Toggle the disabled state (simplified logic)
            const new_disabled_state = !is_currently_disabled;
            alt_text_input.disabled = new_disabled_state;

            // Update ARIA attributes for accessibility
            update_aria_attributes(alt_text_input, new_disabled_state);

            // Handle decorative state (clear/restore value)
            handle_decorative_state(alt_text_input, new_disabled_state);

            // Update related checkbox if it exists
            update_decorative_checkbox(new_disabled_state);

            // Log state change for debugging
            console.log(`Alt text input ${new_disabled_state ? 'disabled' : 'enabled'} (decorative: ${new_disabled_state})`);

            // Return the new state
            return {
                disabled: new_disabled_state,
                is_decorative: new_disabled_state
            };

        } catch (error) {
            console.error('Error toggling alt text:', error);
            display_error_message('Unable to toggle alt text field. Please try again.');
            return false;
        }
    };

    /**
     * Set alt text for image (helper function)
     */
    obj.set_alt_text = function(record) {
        try {
            const alt_text_input = document.querySelector('#item-alt-text-input');
            const decorative_checkbox = document.querySelector('#is-decorative-image, #image-is-decorative');

            if (!alt_text_input) {
                console.warn('Alt text input not found');
                return false;
            }

            // Set alt text value
            if (record.alt_text !== undefined && record.alt_text !== null) {
                alt_text_input.value = helperModule.unescape(record.alt_text) || '';
                alt_text_input.disabled = false;

                // Update ARIA attributes
                alt_text_input.setAttribute('aria-label', 'Alt text for image');
                alt_text_input.setAttribute('aria-disabled', 'false');

                // Uncheck decorative if there's alt text
                if (decorative_checkbox) {
                    decorative_checkbox.checked = false;
                }
            } else {
                // No alt text - might be decorative
                alt_text_input.value = '';

                if (record.is_decorative === 1 || record.is_decorative === true) {
                    alt_text_input.disabled = true;
                    alt_text_input.placeholder = 'Decorative image (no alt text needed)';

                    if (decorative_checkbox) {
                        decorative_checkbox.checked = true;
                    }
                }
            }

            return true;

        } catch (error) {
            console.error('Error setting alt text:', error);
            return false;
        }
    };

    /**
     * Validate alt text requirement
     */
    obj.validate_alt_text = function() {
        try {
            const alt_text_input = document.querySelector('#item-alt-text-input');
            const item_type = document.querySelector('#item-type');

            // Only validate for images
            if (item_type && item_type.value !== 'image') {
                return { valid: true };
            }

            if (!alt_text_input) {
                return { valid: false, error: 'Alt text field not found' };
            }

            // If decorative (disabled), alt text not required
            if (alt_text_input.disabled) {
                return { valid: true, is_decorative: true };
            }

            // If not decorative, alt text is required
            const alt_text_value = alt_text_input.value.trim();

            if (alt_text_value.length === 0) {
                return {
                    valid: false,
                    error: 'Alt text is required for non-decorative images'
                };
            }

            // Check for meaningful alt text (not just whitespace or placeholder text)
            const placeholder_phrases = ['image', 'picture', 'photo', 'alt text', 'description'];
            const is_placeholder = placeholder_phrases.some(phrase =>
                alt_text_value.toLowerCase() === phrase
            );

            if (is_placeholder) {
                return {
                    valid: false,
                    error: 'Please provide descriptive alt text (avoid generic terms)'
                };
            }

            return { valid: true, alt_text: alt_text_value };

        } catch (error) {
            console.error('Error validating alt text:', error);
            return { valid: false, error: 'Validation error' };
        }
    };

    obj.set_alt_text = function(record) {

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                image_alt_text_container: document.querySelector('#image-alt-text'),
                is_alt_text_decorative: document.querySelector('#is-alt-text-decorative'),
                alt_text_input: document.querySelector('#item-alt-text-input')
            };
        };

        /**
         * Update ARIA attributes for accessibility
         */
        const update_aria_attributes = (input_element, is_decorative) => {
            if (!input_element) {
                return;
            }

            if (is_decorative) {
                input_element.setAttribute('aria-label', 'Alt text (decorative image - disabled)');
                input_element.setAttribute('aria-disabled', 'true');
                input_element.setAttribute('aria-required', 'false');
            } else {
                input_element.setAttribute('aria-label', 'Alt text for image');
                input_element.setAttribute('aria-disabled', 'false');
                input_element.setAttribute('aria-required', 'true');
            }
        };

        /**
         * Handle decorative image state
         */
        const handle_decorative_state = (elements) => {
            if (!elements.alt_text_input) {
                return;
            }

            // Disable input
            elements.alt_text_input.disabled = true;

            // Clear value
            elements.alt_text_input.value = '';

            // Set placeholder
            elements.alt_text_input.placeholder = 'Decorative image (no alt text needed)';

            // Update ARIA attributes
            update_aria_attributes(elements.alt_text_input, true);

            // Store that this is decorative (for form submission)
            elements.alt_text_input.setAttribute('data-is-decorative', '1');
        };

        /**
         * Handle non-decorative image state
         */
        const handle_non_decorative_state = (elements, alt_text_value) => {
            if (!elements.alt_text_input) {
                return;
            }

            // Enable input
            elements.alt_text_input.disabled = false;

            // Set value (unescape and validate)
            const unescaped_alt_text = alt_text_value ? helperModule.unescape(alt_text_value) : '';
            elements.alt_text_input.value = unescaped_alt_text;

            // Set placeholder
            elements.alt_text_input.placeholder = 'Enter descriptive alt text for the image';

            // Update ARIA attributes
            update_aria_attributes(elements.alt_text_input, false);

            // Remove decorative flag
            elements.alt_text_input.removeAttribute('data-is-decorative');
        };

        /**
         * Show alt text container
         */
        const show_alt_text_container = (element) => {
            if (!element) {
                return;
            }

            element.style.display = 'block';

            // Add fade-in effect if supported
            if (element.style.opacity !== undefined) {
                element.style.opacity = '0';
                element.style.transition = 'opacity 0.3s ease-in';

                // Trigger reflow
                void element.offsetWidth;

                element.style.opacity = '1';
            }
        };

        /**
         * Validate record structure
         */
        const validate_record = (record) => {
            if (!record || typeof record !== 'object') {
                return {
                    valid: false,
                    error: 'Invalid record: must be an object'
                };
            }

            // Check if is_alt_text_decorative is a valid value
            if (record.is_alt_text_decorative !== undefined &&
                record.is_alt_text_decorative !== null) {
                const decorative_value = record.is_alt_text_decorative;

                // Allow 0, 1, true, false
                if (decorative_value !== 0 && decorative_value !== 1 &&
                    decorative_value !== true && decorative_value !== false) {
                    console.warn('Unexpected is_alt_text_decorative value:', decorative_value);
                }
            }

            return { valid: true };
        };

        try {
            // Validate record
            const validation = validate_record(record);
            if (!validation.valid) {
                console.error(validation.error);
                return false;
            }

            // Cache DOM elements
            const elements = cache_dom_elements();

            // Validate critical elements exist
            if (!elements.alt_text_input) {
                console.error('Alt text input element (#item-alt-text-input) not found');
                return false;
            }

            // Show alt text container
            show_alt_text_container(elements.image_alt_text_container);

            // Determine if image is decorative
            const is_decorative = record.is_alt_text_decorative === 1 ||
                record.is_alt_text_decorative === true;

            // Update decorative checkbox if it exists
            if (elements.is_alt_text_decorative) {
                elements.is_alt_text_decorative.checked = is_decorative;
            }

            // Handle state based on decorative flag
            if (is_decorative) {
                handle_decorative_state(elements);
                console.log('Alt text set: decorative image');
            } else {
                handle_non_decorative_state(elements, record.alt_text);
                console.log('Alt text set:', record.alt_text || '(empty)');
            }

            return true;

        } catch (error) {
            console.error('Error setting alt text:', error);
            return false;
        }
    };

    /**
     * Clear alt text field
     */
    obj.clear_alt_text = function() {

        try {
            const alt_text_input = document.querySelector('#item-alt-text-input');
            const is_decorative_checkbox = document.querySelector('#is-alt-text-decorative');

            if (alt_text_input) {
                alt_text_input.value = '';
                alt_text_input.disabled = false;
                alt_text_input.placeholder = 'Enter descriptive alt text for the image';
                alt_text_input.removeAttribute('data-is-decorative');
            }

            if (is_decorative_checkbox) {
                is_decorative_checkbox.checked = false;
            }

            return true;

        } catch (error) {
            console.error('Error clearing alt text:', error);
            return false;
        }
    };

    /**
     * Get alt text data for submission
     */
    obj.get_alt_text_data = function() {

        try {
            const alt_text_input = document.querySelector('#item-alt-text-input');
            const is_decorative_checkbox = document.querySelector('#is-alt-text-decorative');

            if (!alt_text_input) {
                return null;
            }

            const is_decorative = alt_text_input.disabled ||
                (is_decorative_checkbox && is_decorative_checkbox.checked);

            return {
                alt_text: is_decorative ? '' : alt_text_input.value.trim(),
                is_alt_text_decorative: is_decorative ? 1 : 0
            };

        } catch (error) {
            console.error('Error getting alt text data:', error);
            return null;
        }
    };

    /**
     * Validate alt text before submission
     */
    obj.validate_alt_text_submission = function() {
        try {
            const alt_text_input = document.querySelector('#item-alt-text-input');
            const item_type = document.querySelector('#item-type');

            // Only validate for images
            if (!item_type || item_type.value !== 'image') {
                return { valid: true };
            }

            if (!alt_text_input) {
                return {
                    valid: false,
                    error: 'Alt text field not found'
                };
            }

            // If decorative (disabled), validation passes
            if (alt_text_input.disabled) {
                return {
                    valid: true,
                    is_decorative: true
                };
            }

            // Non-decorative images require alt text
            const alt_text_value = alt_text_input.value.trim();

            if (alt_text_value.length === 0) {
                return {
                    valid: false,
                    error: 'Alt text is required for non-decorative images',
                    field: alt_text_input
                };
            }

            // Check minimum length (at least 3 characters)
            if (alt_text_value.length < 3) {
                return {
                    valid: false,
                    error: 'Alt text must be at least 3 characters long',
                    field: alt_text_input
                };
            }

            // Check for generic/placeholder text
            const generic_phrases = [
                'image', 'picture', 'photo', 'img',
                'alt text', 'description', 'graphic'
            ];

            const is_generic = generic_phrases.some(phrase =>
                alt_text_value.toLowerCase() === phrase
            );

            if (is_generic) {
                return {
                    valid: false,
                    error: 'Please provide descriptive alt text (avoid generic terms like "image" or "picture")',
                    field: alt_text_input
                };
            }

            return {
                valid: true,
                alt_text: alt_text_value
            };

        } catch (error) {
            console.error('Error validating alt text:', error);
            return {
                valid: false,
                error: 'Validation error occurred'
            };
        }
    };

    obj.delete_thumbnail_image = function () {

        try {

            (async function () {

                const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
                let thumbnail_image = document.querySelector('#item-thumbnail').value;
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: EXHIBITS_ENDPOINTS.exhibits.media.delete.endpoint + '?media=' + thumbnail_image,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#item-thumbnail').value = '';
                    document.querySelector('#item-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#item-thumbnail-filename-display').innerHTML = '';
                    document.querySelector('#item-thumbnail-trash').style.display = 'none';
                    document.querySelector('#item-media-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Thumbnail image deleted</div>`;

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                    }, 3000);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    };

    obj.delete_media = function () {

        try {

            (async function () {

                const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
                let media = document.querySelector('#item-media').value;
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: EXHIBITS_ENDPOINTS.exhibits.media.delete.endpoint + '?media=' + media,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#item-type').value = '';
                    document.querySelector('#item-mime-type').value = '';
                    document.querySelector('#item-media').value = '';
                    document.querySelector('#item-media-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#item-media-filename-display').innerHTML = '';
                    document.querySelector('#item-media-trash').style.display = 'none';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Media deleted</div>`;
                    // only for PDF
                    document.querySelector('#toggle-open-to-page').style.visibility = 'hidden';
                    document.querySelector('#image-alt-text').style.display = 'none';
                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                    }, 3000);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    };

    obj.delete_media_edit = async function() {

        // Prevent duplicate submissions
        if (this._is_deleting_media) {
            return false;
        }

        this._is_deleting_media = true;

        // Cache DOM elements and constants
        const message_element = document.querySelector('#message');
        const MESSAGE_CLEAR_DELAY = 3000;
        const FADE_DURATION = 300;

        /**
         * Display status message to user (XSS-safe)
         */
        const display_message = (element, type, message) => {
            if (!element) {
                return;
            }

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = get_icon_class(alert_type);
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            element.style.opacity = '1';
            element.style.transition = '';
            element.textContent = '';
            element.appendChild(alert_div);
        };

        /**
         * Clear message with smooth fade effect
         */
        const clear_message_smoothly = () => {
            if (!message_element) {
                return;
            }

            message_element.style.transition = `opacity ${FADE_DURATION}ms ease-out`;
            message_element.style.opacity = '0';

            setTimeout(() => {
                message_element.textContent = '';
                message_element.style.opacity = '1';
                message_element.style.transition = '';
            }, FADE_DURATION);
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
         * Determine item type from URL pathname
         */
        const get_item_type_from_pathname = () => {
            const pathname = window.location.pathname;

            // Check for specific media paths
            if (pathname.indexOf('items/standard/media') !== -1) {
                return 'standard_item';
            } else if (pathname.indexOf('items/grid/item/media') !== -1) {
                return 'grid_item';
            } else if (pathname.indexOf('items/vertical-timeline/item/media') !== -1) {
                return 'timeline_item';
            }

            // Default fallback
            return 'standard_item';
        };

        /**
         * Clear media display elements
         */
        const clear_media_display = () => {
            const media_input = document.querySelector('#item-media');
            const media_filename = document.querySelector('#item-media-filename-display');
            const media_trash = document.querySelector('#item-media-trash');
            const media_thumbnail = document.querySelector('#item-media-thumbnail-image-display');

            if (media_input) {
                media_input.value = '';
            }

            if (media_filename) {
                media_filename.textContent = '';
            }

            if (media_trash) {
                media_trash.style.display = 'none';
            }

            if (media_thumbnail) {
                media_thumbnail.textContent = '';
            }
        };

        /**
         * Validate parameters
         */
        const validate_parameters = (exhibit_id, item_id, media) => {
            if (!exhibit_id || !item_id || !media) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, item_id, or media filename'
                };
            }

            if (exhibit_id.length > 255 || item_id.length > 255 || media.length > 255) {
                return {
                    valid: false,
                    error: 'Invalid parameter length'
                };
            }

            return { valid: true };
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Get and validate parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            const media_input = document.querySelector('#item-media');
            if (!media_input) {
                display_message(message_element, 'danger', 'Media input element not found');
                return false;
            }

            const media = media_input.value;

            const validation = validate_parameters(exhibit_id, item_id, media);
            if (!validation.valid) {
                display_message(message_element, 'danger', validation.error);
                return false;
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Session expired. Please log in again.');

                timeout_id = setTimeout(() => {
                    authModule.logout();
                }, 1000);

                return false;
            }

            // Get API endpoints
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            if (!EXHIBITS_ENDPOINTS?.exhibits?.item_media?.delete?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Determine item type from URL pathname
            const type = get_item_type_from_pathname();

            console.log('Item type detected:', type);
            console.log('Current pathname:', window.location.pathname);

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.item_media.delete.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':item_id', encodeURIComponent(item_id))
                .replace(':media', encodeURIComponent(media));

            // Append type to endpoint as query parameter
            const params = new URLSearchParams({ type: type });
            const full_url = `${endpoint}?${params.toString()}`;

            // Make API request
            const response = await httpModule.req({
                method: 'DELETE',
                url: full_url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 204) {
                throw new Error('Failed to delete media file');
            }

            // Clear media display elements
            clear_media_display();

            // Show success message
            display_message(message_element, 'success', 'Media deleted successfully');

            // Smoothly clear success message after delay
            timeout_id = setTimeout(() => {
                clear_message_smoothly();
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error deleting media:', error);

            // Display error message
            const error_message = error.user_message || error.message || 'Unable to delete media. Please try again.';
            display_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_deleting_media = false;
        }
    };

    obj.delete_thumbnail_image_edit = async function() {

        // Prevent duplicate submissions
        if (this._is_deleting_thumbnail) {
            return false;
        }

        this._is_deleting_thumbnail = true;

        console.log('DELETE MEDIA THUMBNAIL');

        // Cache DOM elements and constants
        const message_element = document.querySelector('#message');
        const MESSAGE_CLEAR_DELAY = 3000;
        const FADE_DURATION = 300;

        /**
         * Display status message to user (XSS-safe)
         */
        const display_message = (element, type, message) => {
            if (!element) {
                return;
            }

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = get_icon_class(alert_type);
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            element.style.opacity = '1';
            element.style.transition = '';
            element.textContent = '';
            element.appendChild(alert_div);
        };

        /**
         * Clear message with smooth fade effect
         */
        const clear_message_smoothly = () => {
            if (!message_element) {
                return;
            }

            message_element.style.transition = `opacity ${FADE_DURATION}ms ease-out`;
            message_element.style.opacity = '0';

            setTimeout(() => {
                message_element.textContent = '';
                message_element.style.opacity = '1';
                message_element.style.transition = '';
            }, FADE_DURATION);
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
         * Determine item type from URL pathname
         */
        const get_item_type_from_pathname = () => {
            const pathname = window.location.pathname;

            // Check for specific media paths
            if (pathname.indexOf('items/standard/media') !== -1) {
                return 'standard_item';
            } else if (pathname.indexOf('items/grid/item/media') !== -1) {
                return 'grid_item';
            } else if (pathname.indexOf('items/vertical-timeline/item/media') !== -1) {
                return 'timeline_item';
            }

            // Default fallback
            return 'standard_item';
        };

        /**
         * Clear thumbnail display elements
         */
        const clear_thumbnail_display = () => {
            const thumbnail_input = document.querySelector('#item-thumbnail');
            const thumbnail_filename = document.querySelector('#item-thumbnail-filename-display');
            const thumbnail_trash = document.querySelector('#item-thumbnail-trash');
            const thumbnail_image = document.querySelector('#item-thumbnail-image-display');

            if (thumbnail_input) {
                thumbnail_input.value = '';
            }

            if (thumbnail_filename) {
                thumbnail_filename.textContent = '';
            }

            if (thumbnail_trash) {
                thumbnail_trash.style.display = 'none';
            }

            if (thumbnail_image) {
                thumbnail_image.textContent = '';
            }
        };

        /**
         * Validate parameters
         */
        const validate_parameters = (exhibit_id, item_id, thumbnail) => {
            if (!exhibit_id || !item_id || !thumbnail) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, item_id, or thumbnail filename'
                };
            }

            if (exhibit_id.length > 255 || item_id.length > 255 || thumbnail.length > 255) {
                return {
                    valid: false,
                    error: 'Invalid parameter length'
                };
            }

            return { valid: true };
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {

            // Get and validate parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            const thumbnail_input = document.querySelector('#item-thumbnail');
            if (!thumbnail_input) {
                display_message(message_element, 'danger', 'Thumbnail input element not found');
                return false;
            }

            const thumbnail = thumbnail_input.value;

            const validation = validate_parameters(exhibit_id, item_id, thumbnail);
            if (!validation.valid) {
                display_message(message_element, 'danger', validation.error);
                return false;
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Session expired. Please log in again.');

                timeout_id = setTimeout(() => {
                    authModule.logout();
                }, 1000);

                return false;
            }

            // Get API endpoints
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            if (!EXHIBITS_ENDPOINTS?.exhibits?.item_media?.delete?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Determine item type from URL pathname
            const type = get_item_type_from_pathname();

            console.log('Item type detected:', type);
            console.log('Current pathname:', window.location.pathname);
            console.log('Deleting thumbnail:', thumbnail);

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.item_media.delete.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':item_id', encodeURIComponent(item_id))
                .replace(':media', encodeURIComponent(thumbnail));

            // Append type to endpoint as query parameter
            const params = new URLSearchParams({ type: type });
            const full_url = `${endpoint}?${params.toString()}`;

            // Make API request
            const response = await httpModule.req({
                method: 'DELETE',
                url: full_url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 204) {
                throw new Error('Failed to delete thumbnail');
            }

            // Clear thumbnail display elements
            clear_thumbnail_display();

            // Show success message
            display_message(message_element, 'success', 'Thumbnail deleted successfully');

            // Smoothly clear success message after delay
            timeout_id = setTimeout(() => {
                clear_message_smoothly();
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error deleting thumbnail:', error);

            // Display error message
            const error_message = error.user_message || error.message || 'Unable to delete thumbnail. Please try again.';
            display_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_deleting_thumbnail = false;
        }
    };

    /**
     * Processes media specific fields
     * @param item
     */
    obj.process_media_fields_common = function (item) {

        let media = [];
        item.description = document.querySelector('#item-description-input').value;
        item.caption = document.querySelector('#item-caption-input').value;
        item.pdf_open_to_page = document.querySelector('#pdf-open-to-page').value;
        item.is_alt_text_decorative = document.querySelector('#is-alt-text-decorative').checked;

        let embed_item = document.querySelector('#embed-item');
        let wrap_text = document.querySelector('#wrap-text');
        let media_padding = document.querySelector('#media-padding');

        if (embed_item) {
            item.is_embedded = embed_item.checked;
        }

        if (wrap_text) {
            item.media_padding = wrap_text.checked;
        }

        if (media_padding) {
            item.media_padding = media_padding.checked;
        }

        if (item.wrap_text === true) {
            item.wrap_text = 1;
        } else if (item.wrap_text === false) {
            item.wrap_text = 0;
        }

        if (item.is_embedded === true) {
            item.is_embedded = 1;
        } else if (item.is_embedded === false) {
            item.is_embedded = 0;
        }

        if (item.media_padding === true) {
            item.media_padding = 0;
        } else if (item.media_padding === false) {
            item.media_padding = 1;
        }

        // item media
        item.thumbnail = document.querySelector('#item-thumbnail').value;
        item.thumbnail_prev = document.querySelector('#item-thumbnail-image-prev').value;
        item.item_type = document.querySelector('#item-type').value;
        item.mime_type = document.querySelector('#item-mime-type').value;
        item.media = document.querySelector('#item-media').value;
        item.media_prev = document.querySelector('#item-media-prev').value;
        item.kaltura = document.querySelector('#audio-video').value;
        item.repo_uuid = document.querySelector('#repo-uuid').value;
        item.is_repo_item = parseInt(document.querySelector('#is-repo-item').value);
        item.is_kaltura_item = parseInt(document.querySelector('#is-kaltura-item').value);

        if (item.media.length > 0 && item.repo_uuid.length > 0 && item.media === item.repo_uuid) {
            item.repo_uuid = '';
        }

        if (item.media.length > 0 && item.kaltura.length > 0 && item.media === item.kaltura) {
            item.kaltura = '';
        }

        if (item.media.length > 0) {
            media.push(item.media);
        }

        if (item.kaltura.length > 0) {
            media.push(item.kaltura);
            item.item_type = 'kaltura';
        }

        if (item.repo_uuid.length > 0) {
            media.push(item.repo_uuid);
        }

        if (media.length > 1) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please upload or import only one media item</div>`;
            return false;
        }

        if (item.item_type === 'kaltura') {
            item.item_type = document.querySelector('#kaltura-item-type').value;
        }

        return item;
    };

    obj.display_media_fields_common = async function(record) {

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                // Form inputs
                description_input: document.querySelector('#item-description-input'),
                caption_input: document.querySelector('#item-caption-input'),
                pdf_open_to_page: document.querySelector('#pdf-open-to-page'),
                embed_item: document.querySelector('#embed-item'),
                wrap_text: document.querySelector('#wrap-text'),
                media_padding: document.querySelector('#media-padding'),
                item_type: document.querySelector('#item-type'),
                item_mime_type: document.querySelector('#item-mime-type'),
                item_media: document.querySelector('#item-media'),
                item_media_prev: document.querySelector('#item-media-prev'),
                item_thumbnail: document.querySelector('#item-thumbnail'),
                item_thumbnail_prev: document.querySelector('#item-thumbnail-image-prev'),

                // Display elements
                media_trash: document.querySelector('#item-media-trash'),
                media_filename_display: document.querySelector('#item-media-filename-display'),
                media_thumbnail_display: document.querySelector('#item-media-thumbnail-image-display'),
                thumbnail_trash: document.querySelector('#item-thumbnail-trash'),
                thumbnail_filename_display: document.querySelector('#item-thumbnail-filename-display'),
                thumbnail_image_display: document.querySelector('#item-thumbnail-image-display'),
                toggle_open_to_page: document.querySelector('#toggle-open-to-page'),

                // Repository fields
                repo_uuid: document.querySelector('#repo-uuid'),
                is_repo_item: document.querySelector('#is-repo-item'),

                // Kaltura fields
                audio_video: document.querySelector('#audio-video'),
                is_kaltura_item: document.querySelector('#is-kaltura-item'),
                kaltura_item_type: document.querySelector('#kaltura-item-type'),

                // Tab elements
                upload_media_tab: document.getElementById('upload-media-tab'),
                import_repo_media_tab: document.getElementById('import-repo-media-tab'),
                import_audio_video_tab: document.getElementById('import-audio-video-tab'),
                upload_media: document.getElementById('upload-media'),
                import_repo_media: document.getElementById('import-repo-media'),
                import_audio_video: document.getElementById('import-audio-video')
            };
        };

        /**
         * Create thumbnail image element (XSS-safe)
         */
        const create_thumbnail_element = (thumbnail_url, alt_text = 'Thumbnail') => {
            const paragraph = document.createElement('p');
            const img = document.createElement('img');
            img.src = thumbnail_url;
            img.alt = alt_text;
            img.height = 200;
            paragraph.appendChild(img);
            return paragraph;
        };

        /**
         * Display thumbnail in element (XSS-safe)
         */
        const display_thumbnail = (element, thumbnail_url, alt_text = 'Thumbnail') => {
            if (!element) {
                return;
            }

            element.textContent = '';
            const thumbnail_element = create_thumbnail_element(thumbnail_url, alt_text);
            element.appendChild(thumbnail_element);
        };

        /**
         * Display filename (XSS-safe)
         */
        const display_filename = (element, filename) => {
            if (!element) {
                return;
            }

            const span = document.createElement('span');
            span.style.fontSize = '11px';
            span.textContent = filename;

            element.textContent = '';
            element.appendChild(span);
        };

        /**
         * Determine media type from MIME type
         */
        const get_media_type = (mime_type) => {
            if (!mime_type) {
                return 'unknown';
            }

            const mime_lower = mime_type.toLowerCase();

            if (mime_lower.indexOf('image') !== -1) {
                return 'image';
            } else if (mime_lower.indexOf('video') !== -1) {
                return 'video';
            } else if (mime_lower.indexOf('audio') !== -1) {
                return 'audio';
            } else if (mime_lower.indexOf('pdf') !== -1) {
                return 'pdf';
            }

            return 'unknown';
        };

        /**
         * Get thumbnail URL for media type
         */
        const get_thumbnail_url_for_type = (media_type, record, endpoints) => {
            switch (media_type) {
                case 'image':
                    return endpoints.exhibits.exhibit_media.get.endpoint
                        .replace(':exhibit_id', encodeURIComponent(record.is_member_of_exhibit))
                        .replace(':media', encodeURIComponent(record.media));
                case 'video':
                    return '/exhibits-dashboard/static/images/video-tn.png';
                case 'audio':
                    return '/exhibits-dashboard/static/images/audio-tn.png';
                case 'pdf':
                    return '/exhibits-dashboard/static/images/pdf-tn.png';
                default:
                    return null;
            }
        };

        /**
         * Switch to specific tab
         */
        const switch_to_tab = (elements, tab_to_show) => {
            const tabs = {
                upload: {
                    tab: elements.upload_media_tab,
                    content: elements.upload_media
                },
                repo: {
                    tab: elements.import_repo_media_tab,
                    content: elements.import_repo_media
                },
                kaltura: {
                    tab: elements.import_audio_video_tab,
                    content: elements.import_audio_video
                }
            };

            // Deactivate all tabs
            Object.values(tabs).forEach(({ tab, content }) => {
                if (tab) {
                    tab.classList.remove('active');
                    tab.setAttribute('aria-selected', 'false');
                }
                if (content) {
                    content.classList.remove('active', 'show');
                }
            });

            // Activate selected tab
            const selected = tabs[tab_to_show];
            if (selected) {
                if (selected.tab) {
                    selected.tab.classList.add('active');
                    selected.tab.setAttribute('aria-selected', 'true');
                }
                if (selected.content) {
                    selected.content.classList.add('show', 'active');
                }
            }
        };

        /**
         * Handle repository item display
         */
        const handle_repository_item = async (record, elements) => {
            if (!record.is_repo_item || record.is_repo_item !== 1) {
                return;
            }

            // Switch to repository tab
            switch_to_tab(elements, 'repo');

            // Set repository fields
            if (elements.repo_uuid) {
                elements.repo_uuid.value = record.media || '';
            }

            if (elements.is_repo_item) {
                elements.is_repo_item.value = '1';
            }

            // Fetch repository data
            if (typeof helperMediaModule?.get_repo_item_data === 'function') {
                await helperMediaModule.get_repo_item_data(null);
            }

            // Set alt text for images
            if (record.item_type === 'image' && typeof helperMediaModule?.set_alt_text === 'function') {
                helperMediaModule.set_alt_text(record);
            }
        };

        /**
         * Handle Kaltura item display
         */
        const handle_kaltura_item = async (record, elements) => {
            if (!record.is_kaltura_item || record.is_kaltura_item !== 1) {
                return;
            }

            // Switch to Kaltura tab
            switch_to_tab(elements, 'kaltura');

            // Set Kaltura fields
            if (elements.audio_video) {
                elements.audio_video.value = record.media || '';
            }

            if (elements.is_kaltura_item) {
                elements.is_kaltura_item.value = '1';
            }

            // Fetch Kaltura data
            if (typeof helperMediaModule?.get_kaltura_item_data === 'function') {
                await helperMediaModule.get_kaltura_item_data(null);
            }

            // Set Kaltura item type
            if (elements.kaltura_item_type) {
                elements.kaltura_item_type.value = record.item_type || '';
            }

            // Set item type to 'kaltura'
            if (elements.item_type) {
                elements.item_type.value = 'kaltura';
            }
        };

        /**
         * Handle local media display
         */
        const handle_local_media = (record, elements, endpoints) => {
            const is_local = record.is_repo_item === 0 && record.is_kaltura_item === 0;

            if (!is_local) {
                return;
            }

            const media_type = get_media_type(record.mime_type);
            const thumbnail_url = get_thumbnail_url_for_type(media_type, record, endpoints);

            if (thumbnail_url) {
                // Display thumbnail
                display_thumbnail(elements.media_thumbnail_display, thumbnail_url, 'Media thumbnail');

                // Set alt text for images
                if (media_type === 'image' && typeof helperMediaModule?.set_alt_text === 'function') {
                    helperMediaModule.set_alt_text(record);
                }

                // Show PDF-specific controls
                if (media_type === 'pdf' && elements.toggle_open_to_page) {
                    elements.toggle_open_to_page.style.visibility = 'visible';
                }
            } else {
                console.log('Unable to determine media type:', record.mime_type);
            }

            // Display filename
            if (elements.media_filename_display && record.media) {
                display_filename(elements.media_filename_display, record.media);
            }

            // Show delete button
            if (elements.media_trash) {
                elements.media_trash.style.display = 'inline';
            }
        };

        /**
         * Handle thumbnail display
         */
        const handle_thumbnail_display = (record, elements, endpoints) => {
            // Fixed logic: check if thumbnail exists and has length
            if (!record.thumbnail || record.thumbnail.length === 0) {
                return;
            }

            // Construct thumbnail URL
            const thumbnail_url = endpoints.exhibits.exhibit_media.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(record.is_member_of_exhibit))
                .replace(':media', encodeURIComponent(record.thumbnail));

            // Display thumbnail image
            display_thumbnail(elements.thumbnail_image_display, thumbnail_url, 'Item thumbnail');

            // Display filename
            if (elements.thumbnail_filename_display) {
                display_filename(elements.thumbnail_filename_display, record.thumbnail);
            }

            // Set hidden fields
            if (elements.item_thumbnail) {
                elements.item_thumbnail.value = record.thumbnail;
            }

            if (elements.item_thumbnail_prev) {
                elements.item_thumbnail_prev.value = record.thumbnail;
            }

            // Show delete button
            if (elements.thumbnail_trash) {
                elements.thumbnail_trash.style.display = 'inline';
            }
        };

        try {
            // Validate record
            if (!record) {
                console.error('No record provided to display_media_fields_common');
                return false;
            }

            // Cache DOM elements
            const elements = cache_dom_elements();

            // Get API endpoints
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            if (!EXHIBITS_ENDPOINTS?.exhibits?.exhibit_media?.get?.endpoint) {
                console.error('API endpoint configuration missing');
                return false;
            }

            // Set basic form fields
            if (elements.description_input) {
                elements.description_input.value = helperModule.unescape(record.description) || '';
            }

            if (elements.caption_input) {
                elements.caption_input.value = helperModule.unescape(record.caption) || '';
            }

            if (elements.pdf_open_to_page) {
                elements.pdf_open_to_page.value = record.pdf_open_to_page || '';
            }

            // Set checkboxes
            if (elements.embed_item) {
                elements.embed_item.checked = record.is_embedded === 1;
            }

            if (elements.wrap_text) {
                elements.wrap_text.checked = record.wrap_text === 1;
            }

            if (elements.media_padding) {
                // Note: Logic inverted - when padding=1, checkbox is unchecked
                elements.media_padding.checked = record.media_padding === 0;
            }

            // Handle media if present
            if (record.media && record.media.length > 0) {

                // Handle different media sources
                if (record.is_repo_item === 1) {
                    await handle_repository_item(record, elements);
                } else if (record.is_kaltura_item === 1) {
                    await handle_kaltura_item(record, elements);
                } else {
                    handle_local_media(record, elements, EXHIBITS_ENDPOINTS);
                }

                // Set common media fields
                if (elements.item_type) {
                    elements.item_type.value = record.item_type || '';
                }

                if (elements.item_mime_type) {
                    elements.item_mime_type.value = helperModule.unescape(record.mime_type) || '';
                }

                if (elements.item_media) {
                    elements.item_media.value = record.media;
                }

                if (elements.item_media_prev) {
                    elements.item_media_prev.value = record.media;
                }
            }

            // Handle thumbnail display
            handle_thumbnail_display(record, elements, EXHIBITS_ENDPOINTS);

            return true;

        } catch (error) {
            console.error('Error in display_media_fields_common:', error);
            return false;
        }
    };

    /**
     * Initializes common code for media card
     */
    obj.media_common_init = function () {

        uploadsModule.upload_item_media();
        uploadsModule.upload_item_thumbnail();

        let item_media_trash = document.querySelector('#item-media-trash');
        let item_thumbnail_trash = document.querySelector('#item-thumbnail-trash');
        let is_media_only_description = document.querySelector('#is-media-only-description');
        let is_media_only_caption = document.querySelector('#is-media-only-caption');

        if (item_media_trash) {
            item_media_trash.style.display = 'none';
        }

        if (item_thumbnail_trash) {
            item_thumbnail_trash.style.display = 'none';
        }

        if (is_media_only_description) {
            is_media_only_description.style.display = 'block';
        }

        if (is_media_only_caption) {
            is_media_only_caption.style.display = 'block';
        }

        setTimeout(() => {
            item_thumbnail_trash.addEventListener('click', helperMediaModule.delete_thumbnail_image);
            item_media_trash.addEventListener('click', helperMediaModule.delete_media);
        }, 1000);

        document.querySelector('#repo-uuid-btn').addEventListener('click', async () => {
            await helperMediaModule.get_repo_item_data(null);
        });

        document.querySelector('#kaltura-btn').addEventListener('click', async () => {
            await helperMediaModule.get_kaltura_item_data(null);
        });
    };

    /**
     * Initializes edit code for media card
     */
    obj.media_edit_init = function () {

        setTimeout(() => {

            if (document.querySelector('#item-media').value.length === 0) {
                document.querySelector('#item-media-trash').removeEventListener('click', helperMediaModule.delete_media_edit);
                document.querySelector('#item-media-trash').addEventListener('click', helperMediaModule.delete_media);
            } else if (document.querySelector('#item-media').value !== 0) {
                document.querySelector('#item-media-trash').removeEventListener('click', helperMediaModule.delete_media);
                document.querySelector('#item-media-trash').addEventListener('click', helperMediaModule.delete_media_edit);
            }

            if (document.querySelector('#item-thumbnail').value.length === 0) {
                document.querySelector('#item-thumbnail-trash').removeEventListener('click', helperMediaModule.delete_thumbnail_image_edit);
                document.querySelector('#item-thumbnail-trash').addEventListener('click', helperMediaModule.delete_thumbnail_image);
            } else if (document.querySelector('#item-thumbnail').value.length !== 0) {
                document.querySelector('#item-thumbnail-trash').removeEventListener('click', helperMediaModule.delete_thumbnail_image);
                document.querySelector('#item-thumbnail-trash').addEventListener('click', helperMediaModule.delete_thumbnail_image_edit);
            }


        }, 1000);
    };

    obj.init = function () {

        const elem_id = document.querySelector('#is-alt-text-decorative');

        if (elem_id) {
            document.querySelector('#is-alt-text-decorative').addEventListener('click', () => {
                helperMediaModule.toggle_alt_text();
            });
        }
    };

    return obj;

}());

helperMediaModule.init();