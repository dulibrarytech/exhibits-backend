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

const exhibitsAddFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    function get_exhibit_data() {

        // Helper function to safely convert to number
        const to_number = (value, default_value = null) => {

            if (value === null || value === undefined || value === '') {
                return default_value;
            }
            const num = Number(value);
            return isNaN(num) ? default_value : num;
        };

        // Helper function to safely display error messages (prevents XSS)
        const show_error = (message) => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = 'alert alert-danger';
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-exclamation';

            const text = document.createTextNode(` ${message}`);

            alert_div.appendChild(icon);
            alert_div.appendChild(text);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        // Helper function to validate module exists and has required methods
        const validate_module = (module, required_methods = []) => {
            if (!module || typeof module !== 'object') {
                return false;
            }

            for (const method of required_methods) {
                if (typeof module[method] !== 'function') {
                    console.error(`Required method '${method}' not found in module`);
                    return false;
                }
            }

            return true;
        };

        try {
            // Validate exhibitsCommonFormModule exists and has required methods
            if (!validate_module(exhibitsCommonFormModule, ['get_common_form_fields', 'get_exhibit_styles'])) {
                throw new Error('exhibitsCommonFormModule is not properly configured');
            }

            // Get common form fields
            const exhibit = exhibitsCommonFormModule.get_common_form_fields();

            // Check if form fields retrieval failed
            if (exhibit === false || !exhibit) {
                // Error message should already be displayed by get_common_form_fields
                return false;
            }

            // Validate that exhibit is an object
            if (typeof exhibit !== 'object') {
                throw new Error('Invalid exhibit data format');
            }

            // Get exhibit styles
            const styles = exhibitsCommonFormModule.get_exhibit_styles();

            // Validate styles were retrieved successfully
            if (!styles || typeof styles !== 'object') {
                throw new Error('Failed to retrieve exhibit styles');
            }

            exhibit.styles = styles;

            // Convert is_published to Number if it exists
            if ('is_published' in exhibit) {
                exhibit.is_published = to_number(exhibit.is_published, 0);
            }

            // Convert owner to Number if it exists
            if ('owner' in exhibit) {
                exhibit.owner = to_number(exhibit.owner, null);
            }

            return exhibit;

        } catch (error) {
            // Log error for debugging
            console.error('Error getting exhibit data:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred while processing exhibit data';
            show_error(error_message);

            return false;
        }
    }

    obj.create_exhibit_record = async function () {

        // Cache DOM element and constants
        const messageEl = document.querySelector('#message');
        const REDIRECT_DELAY = 900;
        const TOKEN_ERROR_DELAY = 1000;

        // Helper function to safely display messages (prevents XSS)
        const showMessage = (type, message, icon = 'fa-info') => {
            if (!messageEl) {
                console.error('Message element not found');
                return;
            }

            // Use textContent for security, create elements programmatically
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type}`;
            alertDiv.setAttribute('role', 'alert');

            const iconEl = document.createElement('i');
            iconEl.className = `fa ${icon}`;

            const textNode = document.createTextNode(` ${message}`);

            alertDiv.appendChild(iconEl);
            alertDiv.appendChild(textNode);

            // Clear and append
            messageEl.innerHTML = '';
            messageEl.appendChild(alertDiv);
        };

        // Store timeout IDs for cleanup
        let timeoutId = null;

        try {
            // Cross-browser scroll to top
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Validate token early
            const token = authModule.get_user_token();
            if (!token) {
                showMessage('warning', 'Unable to get session token');

                timeoutId = setTimeout(() => {
                    authModule.logout();
                }, TOKEN_ERROR_DELAY);

                return false;
            }

            // Validate exhibit data
            const data = get_exhibit_data();

            if (!data) {
                return false;
            }

            // Show loading state
            showMessage('info', 'Creating exhibit record...');

            // Add user metadata
            data.created_by = helperModule.get_user_name();
            data.owner = helperModule.get_owner();

            // Make API request with timeout
            const response = await Promise.race([
                httpModule.req({
                    method: 'POST',
                    url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                    data: data,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), 30000)
                )
            ]);

            // Validate response structure
            if (!response || response.status !== 201) {
                throw new Error('Failed to create exhibit record');
            }

            if (!response.data?.data) {
                throw new Error('Invalid response from server');
            }

            // Show success message
            showMessage('success', 'Exhibit record created');

            // Bind media library assets if selected
            const exhibitUuid = response.data.data; // the new exhibit UUID
            const heroMediaUuid = document.querySelector('#hero-image-media-uuid')?.value?.trim();
            const thumbnailMediaUuid = document.querySelector('#thumbnail-media-uuid')?.value?.trim();

            if (heroMediaUuid || thumbnailMediaUuid) {
                try {
                    const bindEndpoint = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media_library?.post?.endpoint;

                    if (bindEndpoint) {
                        const bindUrl = bindEndpoint.replace(':exhibit_id', encodeURIComponent(exhibitUuid));

                        if (heroMediaUuid) {
                            await httpModule.req({
                                method: 'POST',
                                url: bindUrl,
                                data: { media_uuid: heroMediaUuid, media_role: 'hero_image' },
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-access-token': token
                                }
                            });
                        }

                        if (thumbnailMediaUuid) {
                            await httpModule.req({
                                method: 'POST',
                                url: bindUrl,
                                data: { media_uuid: thumbnailMediaUuid, media_role: 'thumbnail' },
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-access-token': token
                                }
                            });
                        }
                    }
                } catch (bindError) {
                    console.error('Error binding media to new exhibit:', bindError);
                    // Continue to redirect — the exhibit was created successfully
                }
            }

            // Redirect after delay
            const exhibitId = encodeURIComponent(exhibitUuid);
            timeoutId = setTimeout(() => {
                window.location.href = `${APP_PATH}/items?exhibit_id=${exhibitId}`;
            }, REDIRECT_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Log error for debugging
            console.error('Create exhibit error:', error);

            // Display user-friendly error message
            const errorMessage = error.message || 'An unexpected error occurred';
            showMessage('danger', errorMessage, 'fa-exclamation');

            return false;
        }
    };

    obj.init = async function () {

        // Helper function to safely display error messages (prevents XSS)
        const show_error = (message) => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = 'alert alert-danger';
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-exclamation';

            const text = document.createTextNode(` ${message}`);

            alert_div.appendChild(icon);
            alert_div.appendChild(text);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        // Helper function to safely add event listener
        const add_event_listener = (selector, event, handler, handler_name) => {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn(`Element not found: ${selector}`);
                return false;
            }

            if (!handler || typeof handler !== 'function') {
                console.error(`Invalid handler for ${selector}: ${handler_name}`);
                return false;
            }

            element.addEventListener(event, handler);
            return true;
        };

        // Helper function to safely clear element content
        const clear_element = (selector) => {
            const element = document.querySelector(selector);
            if (element) {
                element.innerHTML = '';
            } else {
                console.warn(`Element not found: ${selector}`);
            }
        };

        // Helper function to render a media preview thumbnail from a media library asset
        const render_media_preview = (selector, media) => {
            const container = document.querySelector(selector);
            if (!container) return;

            container.innerHTML = '';

            const token = authModule.get_user_token();
            let thumb_url = '';

            if (media.ingest_method === 'kaltura' && media.kaltura_thumbnail_url) {
                thumb_url = media.kaltura_thumbnail_url;
            } else if (media.ingest_method === 'repository' && media.repo_uuid) {
                thumb_url = `${APP_PATH}/api/v1/media/library/repo/thumbnail?uuid=${encodeURIComponent(media.repo_uuid)}&token=${encodeURIComponent(token)}`;
            } else if (media.uuid && media.thumbnail_path) {
                thumb_url = `${APP_PATH}/api/v1/media/library/thumbnail/${media.uuid}?token=${encodeURIComponent(token)}`;
            }

            if (thumb_url) {
                const img = document.createElement('img');
                img.src = thumb_url;
                img.alt = media.alt_text || media.name || '';
                container.appendChild(img);
            }
        };

        // Helper function to render filename display
        const render_filename = (selector, name) => {
            const el = document.querySelector(selector);
            if (!el) return;
            el.textContent = name || '';
        };

        // Helper function to show an element
        const show_element = (selector) => {
            const el = document.querySelector(selector);
            if (el) el.style.display = 'inline';
        };

        // Helper function to restore placeholder inside a media preview area
        const restore_placeholder = (display_selector) => {
            const display_el = document.querySelector(display_selector);
            if (!display_el) return;

            display_el.innerHTML = '';

            const placeholder = document.createElement('div');
            placeholder.className = 'media-placeholder';

            const icon = document.createElement('i');
            icon.className = 'fa fa-picture-o';
            placeholder.appendChild(icon);

            const span = document.createElement('span');
            span.textContent = 'No image selected';
            placeholder.appendChild(span);

            display_el.appendChild(placeholder);
        };

        // Client-side clear for hero image slot (no API call on add form)
        const clear_hero_image = function (e) {
            e.preventDefault();
            restore_placeholder('#hero-image-display');

            const hero_input = document.querySelector('#hero-image');
            if (hero_input) hero_input.value = '';

            const hero_uuid = document.querySelector('#hero-image-media-uuid');
            if (hero_uuid) hero_uuid.value = '';

            const filename_el = document.querySelector('#hero-image-filename-display');
            if (filename_el) filename_el.textContent = '';

            const trash_el = document.querySelector('#hero-trash');
            if (trash_el) trash_el.style.display = 'none';
        };

        // Client-side clear for thumbnail slot (no API call on add form)
        const clear_thumbnail = function (e) {
            e.preventDefault();
            restore_placeholder('#thumbnail-image-display');

            const thumb_input = document.querySelector('#thumbnail-image');
            if (thumb_input) thumb_input.value = '';

            const thumb_uuid = document.querySelector('#thumbnail-media-uuid');
            if (thumb_uuid) thumb_uuid.value = '';

            const filename_el = document.querySelector('#thumbnail-filename-display');
            if (filename_el) filename_el.textContent = '';

            const trash_el = document.querySelector('#thumbnail-trash');
            if (trash_el) trash_el.style.display = 'none';
        };

        try {

            // Validate required modules exist
            if (!exhibitsAddFormModule || typeof exhibitsAddFormModule !== 'object') {
                throw new Error('exhibitsAddFormModule is not available');
            }

            if (!exhibitsCommonFormModule || typeof exhibitsCommonFormModule !== 'object') {
                throw new Error('exhibitsCommonFormModule is not available');
            }

            if (!helperModule || typeof helperModule !== 'object') {
                throw new Error('helperModule is not available');
            }

            // Add event listeners with validation
            const listeners = [
                {
                    selector: '#save-exhibit-btn',
                    event: 'click',
                    handler: exhibitsAddFormModule.create_exhibit_record,
                    name: 'create_exhibit_record'
                },
                {
                    selector: '#hero-trash',
                    event: 'click',
                    handler: clear_hero_image,
                    name: 'clear_hero_image'
                },
                {
                    selector: '#thumbnail-trash',
                    event: 'click',
                    handler: clear_thumbnail,
                    name: 'clear_thumbnail'
                }
            ];

            // Track successful and failed listener attachments
            let attached_count = 0;
            let failed_count = 0;

            for (const listener of listeners) {
                const success = add_event_listener(
                    listener.selector,
                    listener.event,
                    listener.handler,
                    listener.name
                );

                if (success) {
                    attached_count++;
                } else {
                    failed_count++;
                }
            }

            // Wire media picker buttons
            const pick_hero_btn = document.querySelector('#pick-hero-image-btn');
            if (pick_hero_btn) {
                pick_hero_btn.addEventListener('click', function () {
                    mediaPickerModule.open({
                        role: 'hero_image',
                        exhibit_uuid: null, // null on add form — binding created after exhibit create
                        media_type_filter: 'image',
                        on_select: function (media) {
                            document.querySelector('#hero-image-media-uuid').value = media.uuid;
                            render_media_preview('#hero-image-display', media);
                            render_filename('#hero-image-filename-display', media.name || media.original_filename);
                            show_element('#hero-trash');
                        }
                    });
                });
                attached_count++;
            }

            const pick_thumbnail_btn = document.querySelector('#pick-thumbnail-btn');
            if (pick_thumbnail_btn) {
                pick_thumbnail_btn.addEventListener('click', function () {
                    mediaPickerModule.open({
                        role: 'thumbnail',
                        exhibit_uuid: null,
                        media_type_filter: 'image',
                        on_select: function (media) {
                            document.querySelector('#thumbnail-media-uuid').value = media.uuid;
                            render_media_preview('#thumbnail-image-display', media);
                            render_filename('#thumbnail-filename-display', media.name || media.original_filename);
                            show_element('#thumbnail-trash');
                        }
                    });
                });
                attached_count++;
            }

            // Log initialization summary
            console.log(`Initialization complete: ${attached_count} listeners attached, ${failed_count} failed`);

            // Clear item list navigation
            clear_element('#item-list-nav');

            // Validate helperModule method exists
            /*
            if (typeof helperModule.create_subjects_menu !== 'function') {
                throw new Error('helperModule.create_subjects_menu is not available');
            }

            // Create subjects menu
            await helperModule.create_subjects_menu();
            */

            return true;

        } catch (error) {
            // Log error for debugging
            console.error('Error initializing module:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred during initialization';
            show_error(error_message);

            return false;
        }
    };

    return obj;

}());
