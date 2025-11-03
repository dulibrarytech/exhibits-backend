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

    /**
     * Gets repo item metadata
     * @param uuid
     */
    obj.get_repo_item_data = async function (uuid) {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            let is_list = true;

            if (uuid === null) {
                uuid = document.querySelector('#repo-uuid').value;
                helperMediaModule.clear_media_fields('repo_media');
                is_list = false;
            }

            if (uuid.length === 0) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter a Repository UUID</div>`;
            }

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.repo_items.endpoint.replace(':uuid', uuid),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {

                if (response.data.data.is_compound === 1) {
                    document.querySelector('#repo-item-metadata').innerHTML = `<p style="color:red">Repository compound objects are not supported.</p>`;
                    return false;
                }

                const mime_type = response.data.data.mime_type;
                let item_type;
                let tn = document.querySelector('#tn');
                let item_mime_type = document.querySelector('#item-mime-type');
                let type = document.querySelector('#item-type');
                let repo_item_metadata = document.querySelector('#repo-item-metadata');
                let is_repo_item = document.querySelector('#is-repo-item');

                if (tn !== null) {
                    const tn_url = helperMediaModule.render_repo_thumbnail(response.data.data.thumbnail.data);
                    tn.innerHTML = `<img src="${tn_url}" alt="thumbnail" height="200" width="200" style="border: solid"">`;
                }

                if (item_mime_type !== null) {
                    item_mime_type.value = mime_type;
                }

                if (mime_type.indexOf('image') !== -1) {

                    item_type = 'image';

                    let alt_text = document.querySelector('#image-alt-text');

                    if (alt_text !== null) {
                        document.querySelector('#image-alt-text').style.display = 'block';
                    }

                } else if (mime_type.indexOf('video') !== -1) {
                    item_type = 'video';
                } else if (mime_type.indexOf('audio') !== -1) {
                    item_type = 'audio';
                } else if (mime_type.indexOf('pdf') !== -1) {
                    item_type = 'pdf';
                } else {
                    item_type = 'Unable to Determine Type';
                }

                if (type !== null) {
                    type.value = item_type;
                }

                if (repo_item_metadata !== null) {
                    repo_item_metadata.innerHTML = `<p><strong>${response.data.data.title}</strong><br><em>${mime_type}</em></p>`;
                }

                if (is_repo_item !== null) {
                    is_repo_item.value = 1;
                }

                if (is_list === true) {
                    return response.data.data;
                }

            } else {
                document.querySelector('#repo-item-metadata').innerHTML = `<p style="color:red">Metadata record not found in repository.</p>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     *  Renders repository item thumbnail
     * @param thumbnail_data_array
     */
    obj.render_repo_thumbnail = function (thumbnail_data_array) {

        try {

            const array_buffer_view = new Uint8Array(thumbnail_data_array);
            const blob = new Blob([array_buffer_view], {type: 'image/jpeg'});
            const url_creator = window.URL || window.webkitURL;
            return url_creator.createObjectURL(blob);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.clear_media_fields = function (type) {

        if (type === 'uploaded_media') {
            document.querySelector('#repo-uuid').value = '';
            document.querySelector('#audio-video').value = '';
            document.querySelector('#is-kaltura-item').value = 0;
            document.querySelector('#is-repo-item').value = 0;
        }

        if (type === 'repo_media') {
            document.querySelector('#audio-video').value = '';
            document.querySelector('#is-kaltura-item').value = 0;
        }

        if (type === 'kaltura_media') {
            document.querySelector('#repo-uuid').value = '';
            document.querySelector('#is-repo-item').value = 0;
        }

        document.querySelector('#item-type').value = '';
        document.querySelector('#item-mime-type').value = '';
        document.querySelector('#item-media').value = '';
        document.querySelector('#item-media-thumbnail-image-display').innerHTML = '';
        document.querySelector('#item-media-filename-display').innerHTML = '';
        document.querySelector('#item-media-trash').style.display = 'none';
    };

    /**
     * Gets kaltura item data
     * @param entry_id
     */
    obj.get_kaltura_item_data = async function (entry_id) {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            let is_list = true;

            if (entry_id === null) {
                entry_id = document.querySelector('#audio-video').value;
                helperMediaModule.clear_media_fields('kaltura_media');
                is_list = false;
            }

            if (entry_id.length === 0) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter a Kaltura ID</div>`;
            }

            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.kaltura_items.endpoint.replace(':entry_id', entry_id),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {

                if (response.data.data.item_type === undefined) {
                    document.querySelector('#kaltura-item-data').innerHTML = `<p style="color:red">${response.data.data.message}</p>`;
                    return false;
                }

                let kaltura_item_data = document.querySelector('#kaltura-item-data');
                kaltura_item_data.innerHTML = `<p>
                    <strong>${response.data.data.title}</strong><br>
                     (<em>${response.data.data.item_type}</em>)
                    <!--<small>${response.data.data.description}</small><br>-->
                    </p>`;

                document.querySelector('#kaltura-thumbnail').src = response.data.data.thumbnail;
                document.querySelector('#kaltura-item-type').value = response.data.data.item_type;
                document.querySelector('#kaltura-thumbnail').style.visibility = 'visible';

                if (is_list === true) {
                    return response.data.data;
                }

            } else {
                document.querySelector('#repo-item-metadata').innerHTML = `<p style="color:red">Metadata record not found in repository.</p>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Toggles alt text field based on whether it is decorative or not
     */
    obj.toggle_alt_text = function () {

        try {

            let toggle_elem = document.querySelector('#item-alt-text-input');
            let is_decorative_toggle = toggle_elem.disabled;

            if (is_decorative_toggle === false) {
                toggle_elem.disabled = true;
            } else if (is_decorative_toggle === true) {
                toggle_elem.disabled = false;
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Set alt text
     * @param record
     */
    obj.set_alt_text = function (record) {

        document.querySelector('#image-alt-text').style.display = 'block';

        if (record.is_alt_text_decorative === 1) {
            document.querySelector('#is-alt-text-decorative').checked = true;
            let toggle_elem = document.querySelector('#item-alt-text-input');
            toggle_elem.disabled = true;
        } else {
            document.querySelector('#is-alt-text-decorative').checked = false;
            document.querySelector('#item-alt-text-input').value = helperModule.unescape(record.alt_text);
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

    /**
     * Deletes saved media
     */
    /*
    obj.delete_media_edit__ = function () {

        try {

            (async function () {

                console.log(window.location.pathname);
                // TODO:
                // items/standard/media
                // items/grid/item/media
                // items/vertical-timeline/item/media

                const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
                const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
                const item_id = helperModule.get_parameter_by_name('item_id');
                let media = document.querySelector('#item-media').value;
                let etmp = EXHIBITS_ENDPOINTS.exhibits.item_media.delete.endpoint.replace(':exhibit_id', exhibit_id);
                let itmp = etmp.replace(':item_id', item_id);
                let endpoint = itmp.replace(':media', media);
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#item-media').value = '';
                    document.querySelector('#item-media-filename-display').innerHTML = '';
                    document.querySelector('#item-media-trash').style.display = 'none';
                    document.querySelector('#item-media-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Media deleted</div>`;

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                        // window.location.reload();
                    }, 900);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }
    */

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
     * Deletes saved thumbnail
     */
    obj.delete_thumbnail_image_edit__ = function () {
        console.log('DELETE MEDIA THUMBNAIL');
        try {

            (async function () {

                const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
                const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
                const item_id = helperModule.get_parameter_by_name('item_id');
                let thumbnail = document.querySelector('#item-thumbnail').value;
                let etmp = EXHIBITS_ENDPOINTS.exhibits.item_media.delete.endpoint.replace(':exhibit_id', exhibit_id);
                let itmp = etmp.replace(':item_id', item_id);
                let endpoint = itmp.replace(':media', thumbnail);
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#item-thumbnail').value = '';
                    document.querySelector('#item-thumbnail-filename-display').innerHTML = '';
                    document.querySelector('#item-thumbnail-trash').style.display = 'none';
                    document.querySelector('#item-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Thumbnail deleted</div>`;

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                        window.location.reload();
                    }, 900);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    }

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

    obj.display_media_fields_common = async function (record) {

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
        let thumbnail_fragment = '';
        let thumbnail_url = '';
        let wrap_text = document.querySelector('#wrap-text');
        let media_padding = document.querySelector('#media-padding');
        let embed_item = document.querySelector('#embed-item');

        document.querySelector('#item-description-input').value = helperModule.unescape(record.description);
        document.querySelector('#item-caption-input').value = helperModule.unescape(record.caption);
        document.querySelector('#pdf-open-to-page').value = record.pdf_open_to_page;

        if (embed_item) {
            if (record.is_embedded === 1) {
                embed_item.checked = true;
            } else {
                embed_item.checked = false;
            }
        }

        if (wrap_text) {
            if (record.wrap_text === 1) {
                wrap_text.checked = true;
            } else {
                wrap_text.checked = false;
            }
        }

        if (media_padding) {

            if (record.media_padding === 1) { // padding
                media_padding.checked = false;
            } else if (record.media_padding === 0) { // no padding
                media_padding.checked = true;
            }
        }

        if (record.media.length > 0) {

            if (record.is_repo_item === 0 && record.is_kaltura_item === 0) {

                if (record.mime_type.indexOf('image') !== -1) {

                    thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', record.is_member_of_exhibit).replace(':media', record.media);
                    thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                    helperMediaModule.set_alt_text(record);

                } else if (record.mime_type.indexOf('video') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/video-tn.png';
                    thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                } else if (record.mime_type.indexOf('audio') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/audio-tn.png';
                    thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                } else if (record.mime_type.indexOf('pdf') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/pdf-tn.png';
                    thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                    document.querySelector('#toggle-open-to-page').style.visibility = 'visible';
                } else {
                    console.log('Unable to Determine Type');
                }

                document.querySelector('#item-media-trash').style.display = 'inline';
                document.querySelector('#item-media-filename-display').innerHTML = `<span style="font-size: 11px">${record.media}</span>`;
            }

            document.querySelector('#item-type').value = record.item_type;

            if (record.is_repo_item === 1) {

                document.getElementById('upload-media-tab').classList.remove('active');
                document.getElementById('import-repo-media-tab').classList.add('active');
                document.getElementById('upload-media').classList.remove('active');
                document.getElementById('upload-media').classList.remove('show');
                document.getElementById('import-repo-media').classList.add('show');
                document.getElementById('import-repo-media').classList.add('active');
                document.getElementById('upload-media-tab').setAttribute('aria-selected', 'false');
                document.getElementById('import-repo-media-tab').setAttribute('aria-selected', 'true');
                document.querySelector('#repo-uuid').value = record.media;
                document.querySelector('#is-repo-item').value = 1;
                await helperMediaModule.get_repo_item_data(null);

                if (record.item_type === 'image') {
                    helperMediaModule.set_alt_text(record);
                }
            }

            if (record.is_kaltura_item === 1) {

                document.getElementById('upload-media-tab').classList.remove('active');
                document.getElementById('import-audio-video-tab').classList.add('active');
                document.getElementById('upload-media').classList.remove('active');
                document.getElementById('upload-media').classList.remove('show');
                document.getElementById('import-audio-video').classList.add('show');
                document.getElementById('import-audio-video').classList.add('active');
                document.getElementById('upload-media-tab').setAttribute('aria-selected', 'false');
                document.getElementById('import-audio-video-tab').setAttribute('aria-selected', 'true');
                document.querySelector('#audio-video').value = record.media;
                document.querySelector('#is-kaltura-item').value = 1;
                await helperMediaModule.get_kaltura_item_data(null);

                document.querySelector('#kaltura-item-type').value = record.item_type;
                document.querySelector('#item-type').value = 'kaltura';
            }

            document.querySelector('#item-mime-type').value = helperModule.unescape(record.mime_type);
            document.querySelector('#item-media-thumbnail-image-display').innerHTML = thumbnail_fragment;
            document.querySelector('#item-media').value = record.media;
            document.querySelector('#item-media-prev').value = record.media;
        }

        if (record.thumbnail.length > 0) {

            thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', record.is_member_of_exhibit).replace(':media', record.thumbnail);
            thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
            document.querySelector('#item-thumbnail-image-display').innerHTML = thumbnail_fragment;
            document.querySelector('#item-thumbnail-filename-display').innerHTML = `<span style="font-size: 11px">${record.thumbnail}</span>`;
            document.querySelector('#item-thumbnail').value = record.thumbnail;
            document.querySelector('#item-thumbnail-image-prev').value = record.thumbnail;
            document.querySelector('#item-thumbnail-trash').style.display = 'inline';
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