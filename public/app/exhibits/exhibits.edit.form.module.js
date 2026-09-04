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

const exhibitsEditFormModule = (function () {

    'use strict';

    const APP_PATH = endpointsModule.get_app_path();
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /*
     * Populates (or hides, when name is empty) a read-only Media Name display.
     * input_selector targets the input; its wrapper is `${input_selector}-group`.
     */
    function set_media_name_display(input_selector, name) {
        const group = document.querySelector(`${input_selector}-group`);
        const input_el = document.querySelector(input_selector);
        const decoded = helperModule.unescape(name || '').trim();

        if (input_el) input_el.value = decoded;
        if (group) group.style.display = decoded.length > 0 ? '' : 'none';
    }

    async function get_exhibit_record() {

        // Helper function to safely set title
        const set_exhibit_title = async (uuid) => {
            const title_el = document.querySelector('#exhibit-title');
            if (!title_el) {
                console.warn('Exhibit title element not found');
                return;
            }

            try {
                const title = await exhibitsModule.get_exhibit_title(uuid);

                if (title) {
                    title_el.textContent = title;
                }
            } catch (error) {
                console.error('Error getting exhibit title:', error);
                // Don't fail the entire operation if title fetch fails
            }
        };

        // Helper function to build query string safely
        const build_query_string = (params) => {
            const query_params = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value != null) {
                    query_params.append(key, value);
                }
            }
            return query_params.toString();
        };

        try {

            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                console.error('EXHIBITS_ENDPOINTS is not available');
                domModule.set_alert('#message', 'danger', 'Configuration error: API endpoints not available');
                helperModule.redirect_to_auth();
                return null;
            }

            // Get and validate UUID
            const uuid = helperModule.get_parameter_by_name('exhibit_id');

            if (!uuid) {
                domModule.set_alert('#message', 'danger', 'Missing required parameter: exhibit_id');
                return null;
            }

            // Get and validate user profile
            const profile = authModule.get_user_profile_data();

            if (!profile || !profile.uid) {
                console.error('User profile not available');
                domModule.set_alert('#message', 'warning', 'User profile error: Please log in again');
                helperModule.redirect_to_auth();
                return null;
            }

            // Validate endpoint configuration exists
            const endpoint_config = EXHIBITS_ENDPOINTS.exhibits?.exhibit_records?.endpoints?.get?.endpoint;

            if (!endpoint_config) {
                throw new Error('Endpoint configuration not found');
            }

            // Set exhibit title asynchronously (don't block on this)
            set_exhibit_title(uuid).catch(error => {
                console.error('Failed to set exhibit title:', error);
            });

            // Build endpoint URL with proper encoding
            const endpoint_base = endpointsModule.build(endpoint_config, { exhibit_id: uuid });

            if (!endpoint_base) {
                throw new Error('Endpoint configuration not found');
            }

            // Build query parameters safely
            const query_string = build_query_string({
                type: 'edit',
                uid: profile.uid
            });

            const endpoint = `${endpoint_base}?${query_string}`;

            const response = await httpModule.api({
                method: 'GET',
                url: endpoint
            });

            // Validate response structure
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            if (!response.data || !response.data.data) {
                throw new Error('Invalid response structure from server');
            }

            return response.data.data;

        } catch (error) {
            // Log error for debugging
            console.error('Error getting exhibit record:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while loading the exhibit record';
            domModule.set_alert('#message', 'danger', error_message);

            return null;
        }
    }

    function get_exhibit_data() {

        // Helper function to safely get element value
        const get_element_value = (selector, default_value = '') => {
            const element = document.querySelector(selector);
            return element?.value?.trim() || default_value;
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
            if (!validate_module(exhibitsCommonFormModule, ['get_common_form_fields'])) {
                throw new Error('exhibitsCommonFormModule is not properly configured');
            }

            // Get common form fields
            const exhibit = exhibitsCommonFormModule.get_common_form_fields();

            // Validate that common fields were retrieved successfully
            if (!exhibit || typeof exhibit !== 'object') {
                throw new Error('Failed to retrieve common form fields');
            }

            // Get previous image values (used for comparison on update)
            exhibit.hero_image_prev = get_element_value('#hero-image-prev');
            exhibit.thumbnail_prev = get_element_value('#thumbnail-image-prev');

            // Validate that at least title exists (basic sanity check)
            if (!exhibit.title || exhibit.title.length === 0) {
                console.error('Exhibit data validation failed: missing title');
                domModule.set_alert('#message', 'danger', 'Please enter an exhibit title');
                return false;
            }

            return exhibit;

        } catch (error) {
            // Log error for debugging
            console.error('Error getting exhibit data:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred while processing exhibit data';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    }

    async function display_edit_record() {

        // Helper function to safely set element value
        const set_element_value = (selector, value) => {
            const element = document.querySelector(selector);
            if (element && value != null) {
                element.value = value;
            }
        };

        // Helper function to safely set checkbox state
        const set_checkbox_state = (selector, is_checked) => {
            const element = document.querySelector(selector);
            if (element) {
                element.checked = Boolean(is_checked);
            }
        };

        // Helper function to safely set element display
        const set_element_display = (selector, display_value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = display_value;
            }
        };

        // Helper function to safely create image element
        const create_image_element = (alt_text, src) => {
            const img = document.createElement('img');
            img.alt = alt_text || '';
            img.src = src;
            return img;
        };

        // Helper function to safely set innerHTML with created element
        const set_element_content = (selector, content_element) => {
            const element = document.querySelector(selector);
            if (element && content_element) {
                element.innerHTML = '';
                element.appendChild(content_element);
            }
        };

        // Helper function to create filename display
        const create_filename_display = (filename) => {
            const span = document.createElement('span');
            span.style.fontSize = '11px';
            span.textContent = filename;
            return span;
        };

        // Helper function to set created/updated information safely
        const set_audit_info = (created_by, created, updated_by, updated) => {
            const created_el = document.querySelector('#created');
            if (!created_el) return;

            const fragments = [];

            if (created_by && created) {
                const create_date = new Date(created);
                const create_date_time = helperModule.format_date(create_date);
                const em1 = document.createElement('em');
                em1.textContent = `Created by ${created_by} on ${create_date_time}`;
                fragments.push(em1);
            }

            if (updated_by && updated) {
                const update_date = new Date(updated);
                const update_date_time = helperModule.format_date(update_date);

                if (fragments.length > 0) {
                    fragments.push(document.createTextNode(' | '));
                }

                const em2 = document.createElement('em');
                em2.textContent = `Last updated by ${updated_by} on ${update_date_time}`;
                fragments.push(em2);
            }

            created_el.innerHTML = '';
            fragments.forEach(fragment => created_el.appendChild(fragment));
        };

        // Helper function to set media display (legacy filename-based)
        const set_media_display = (record, field_name, display_selector, filename_selector, input_selector, prev_selector, trash_selector) => {
            const media_value = record[field_name];
            if (!media_value) return;

            const media_url = `${APP_PATH}/api/v1/exhibits/${record.uuid}/media/${media_value}`;
            const image_element = create_image_element(media_value, media_url);
            const filename_element = create_filename_display(media_value);

            set_element_content(display_selector, image_element);
            set_element_content(filename_selector, filename_element);
            set_element_value(input_selector, media_value);
            set_element_value(prev_selector, media_value);
            set_element_display(trash_selector, 'inline');
        };

        // Helper function to display media from a media library binding
        const set_media_binding_display = (binding, display_selector, filename_selector, uuid_input_selector, trash_selector, name_input_selector) => {

            if (!binding) return;

            // Same-origin thumbnail requests authenticate via the HttpOnly
            // exhibits_token cookie; no JWT is embedded in <img src>.
            let thumb_url = '';

            if (binding.ingest_method === 'kaltura' && binding.kaltura_thumbnail_url) {
                thumb_url = binding.kaltura_thumbnail_url;
            } else if (binding.ingest_method === 'repository' && binding.repo_uuid) {
                thumb_url = `${APP_PATH}/api/v1/media/library/repo/thumbnail?uuid=${encodeURIComponent(binding.repo_uuid)}`;
            } else if (binding.media_uuid && binding.thumbnail_path) {
                thumb_url = `${APP_PATH}/api/v1/media/library/thumbnail/${binding.media_uuid}`;
            }

            if (thumb_url) {
                const image_element = create_image_element(binding.alt_text || binding.name, thumb_url);
                set_element_content(display_selector, image_element);
            }

            const filename_element = create_filename_display(binding.name || binding.original_filename || '');
            set_element_content(filename_selector, filename_element);

            // Set the media UUID hidden input
            const uuid_el = document.querySelector(uuid_input_selector);
            if (uuid_el) uuid_el.value = binding.media_uuid;

            // Set the -prev tracking field for replace/clear operations
            const prev_el = document.querySelector(uuid_input_selector + '-prev');
            if (prev_el) prev_el.value = binding.media_uuid;

            if (name_input_selector) {
                set_media_name_display(name_input_selector, binding.name);
            }

            set_element_display(trash_selector, 'inline');
        };

        // Helper function to load media library bindings for the exhibit
        const load_media_bindings = async (exhibit_uuid) => {

            try {

                const endpoint_base = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media_library?.get?.endpoint;
                if (!endpoint_base) {
                    console.warn('exhibit_media_library GET endpoint not configured');
                    return null;
                }

                const endpoint = endpointsModule.build(endpoint_base, { exhibit_id: exhibit_uuid });

                if (!endpoint) {
                    return null;
                }

                const response = await httpModule.api({
                    method: 'GET',
                    url: endpoint
                });

                if (response && response.data && Array.isArray(response.data.data)) {
                    return response.data.data;
                }

                return [];

            } catch (error) {
                console.error('Error loading media bindings:', error);
                return null;
            }
        };

        // Helper function to set radio button selection
        const set_radio_selection = (name, value) => {
            const radio_buttons = document.getElementsByName(name);
            for (let i = 0; i < radio_buttons.length; i++) {
                if (radio_buttons[i].value === value) {
                    radio_buttons[i].checked = true;
                    break;
                }
            }
        };

        try {

            // Get exhibit record
            const record = await get_exhibit_record();

            if (!record) {
                throw new Error('Failed to retrieve exhibit record');
            }

            // Check if record is locked
            await lockModule.check_if_locked(record, '#exhibit-submit-card');

            // Disable form fields if locked by another user
            if (lockModule.is_locked_by_other_user(record)) {
                // Check if current user is an administrator
                const is_admin = await lockModule.is_user_administrator();

                // Disable form fields, but preserve unlock button for admins
                lockModule.disable_form_fields({ preserve_selectors: is_admin ? ['#unlock-record'] : [] });
            }

            // Setup automatic unlock when user navigates away (only if current user has it locked)
            // setup_auto_unlock(record);
            lockModule.setup_auto_unlock(record);

            // Set audit information
            set_audit_info(record.created_by, record.created, record.updated_by, record.updated);

            // Set publish status
            const is_published = record.is_published === 1;
            set_element_value('#is-published', is_published);

            // Set basic exhibit data with proper unescaping
            rteModule.set_html('exhibit-title-input', helperModule.unescape(record.title || ''));
            rteModule.set_html('exhibit-sub-title-input', helperModule.unescape(record.subtitle || ''));
            rteModule.set_html('exhibit-description-input', helperModule.unescape(record.description || ''));
            rteModule.set_html('exhibit-about-the-curators-input', helperModule.unescape(record.about_the_curators || ''));
            set_element_value('#exhibit-owner', record.owner);

            // Set checkboxes
            set_checkbox_state('#is-featured', record.is_featured === 1);
            set_checkbox_state('#is-student-curated', record.is_student_curated === 1);

            // Set content advisory
            if (record.alert_text) {
                set_checkbox_state('#is-content-advisory', true);
                set_element_value('#exhibit-alert-text-input', helperModule.unescape(record.alert_text));
            }

            // Load media library bindings first, fall back to legacy filename display
            const bindings = await load_media_bindings(record.uuid);
            const hero_binding = bindings ? bindings.find(function (b) { return b.media_role === 'hero_image'; }) : null;
            const thumbnail_binding = bindings ? bindings.find(function (b) { return b.media_role === 'thumbnail'; }) : null;

            // Set hero image display
            if (hero_binding) {
                set_media_binding_display(
                    hero_binding,
                    '#hero-image-display',
                    '#hero-image-filename-display',
                    '#hero-image-media-uuid',
                    '#hero-trash',
                    '#hero-image-media-name-display'
                );
            } else if (record.hero_image) {
                set_media_display(
                    record,
                    'hero_image',
                    '#hero-image-display',
                    '#hero-image-filename-display',
                    '#hero-image',
                    '#hero-image-prev',
                    '#hero-trash'
                );
                // Show legacy migration hint
                set_element_display('#hero-legacy-migrate', 'block');
            }

            // Set thumbnail display
            if (thumbnail_binding) {
                set_media_binding_display(
                    thumbnail_binding,
                    '#thumbnail-image-display',
                    '#thumbnail-filename-display',
                    '#thumbnail-media-uuid',
                    '#thumbnail-trash',
                    '#thumbnail-media-name-display'
                );
            } else if (record.thumbnail) {
                set_media_display(
                    record,
                    'thumbnail',
                    '#thumbnail-image-display',
                    '#thumbnail-filename-display',
                    '#thumbnail-image',
                    '#thumbnail-image-prev',
                    '#thumbnail-trash'
                );
                // Show legacy migration hint
                set_element_display('#thumbnail-legacy-migrate', 'block');
            }

            // Set banner template selection
            if (record.banner_template) {
                set_radio_selection('banner_template', record.banner_template);
            }

            return false;

        } catch (error) {
            // Log error for debugging
            console.error('Error displaying edit record:', error);

            // Display safe error message
            const error_message = error.message || 'An error occurred while loading the exhibit record';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    }

    obj.update_exhibit_record = async function () {

        // Cache DOM element and constants
        const message_el = document.querySelector('#message');
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {

            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Get and validate UUID
            const uuid = helperModule.get_parameter_by_name('exhibit_id');
            if (!uuid) {
                domModule.set_alert('#message', 'danger', 'Unable to get record UUID');
                return false;
            }

            // Get and validate exhibit data
            const data = get_exhibit_data();

            if (!data) {
                domModule.set_alert('#message', 'danger', 'Unable to get exhibit data');
                return false;
            }

            // Show loading state
            domModule.set_alert('#message', 'info', 'Updating exhibit record...');

            // Add user metadata
            data.updated_by = helperModule.get_user_name();

            const update_url = endpointsModule.build(
                EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.put.endpoint,
                { exhibit_id: uuid }
            );

            if (!update_url) {
                throw new Error('Failed to update exhibit record');
            }

            const response = await httpModule.api({
                method: 'PUT',
                url: update_url,
                data: data
            });

            // Validate response
            if (!response || response.status !== 201) {
                throw new Error('Failed to update exhibit record');
            }

            // Show success message
            domModule.set_alert('#message', 'success', 'Exhibit record updated successfully');

            // Re-render the form with updated data
            try {
                await display_edit_record();
                console.debug('Form re-rendered with updated data');
            } catch (render_error) {
                console.error('Error re-rendering form:', render_error);
                // Don't fail the whole operation if re-render fails
                domModule.set_alert('#message', 'warning', 'Record updated, but form refresh failed. Please reload the page.');
            }

            // Clear success message after delay
            timeout_id = setTimeout(() => {
                if (message_el) {
                    message_el.innerHTML = '';
                }
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Update exhibit error:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while updating the exhibit';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    };

    async function delete_hero_image() {

        // Constants
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds

        // Helper function to safely clear element content
        const clear_element = (selector) => {
            const element = document.querySelector(selector);
            if (element) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.value = '';
                } else {
                    element.innerHTML = '';
                }
            }
        };

        // Helper function to safely set element display
        const set_element_display = (selector, display_value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = display_value;
            }
        };

        // Helper function to clear hero image UI
        const clear_hero_image_ui = () => {
            clear_element('#hero-image');
            clear_element('#hero-image-filename-display');
            clear_element('#hero-image-display');
            clear_element('#hero-image-media-uuid');
            set_media_name_display('#hero-image-media-name-display', '');
            set_element_display('#hero-trash', 'none');
            set_element_display('#hero-legacy-migrate', 'none');
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                throw new Error('API endpoints configuration not available');
            }

            // Get and validate UUID
            const uuid = helperModule.get_parameter_by_name('exhibit_id');
            if (!uuid) {
                throw new Error('Missing required parameter: exhibit_id');
            }

            // Get and validate hero image value
            const hero_image_el = document.querySelector('#hero-image');
            if (!hero_image_el) {
                throw new Error('Hero image input element not found');
            }

            const hero_image = hero_image_el.value?.trim();
            if (!hero_image) {
                domModule.set_alert('#message', 'warning', 'No hero image to delete');
                return false;
            }

            // Validate endpoint configuration exists
            const endpoint_template = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media?.get?.endpoint;
            if (!endpoint_template) {
                throw new Error('Endpoint configuration not found');
            }

            const endpoint = endpointsModule.build(endpoint_template, { exhibit_id: uuid, media: hero_image });

            if (!endpoint) {
                throw new Error('Endpoint configuration not found');
            }

            // Show loading state
            domModule.set_alert('#message', 'info', 'Deleting hero image...');

            const response = await httpModule.api({
                method: 'DELETE',
                url: endpoint
            });

            // Validate response
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 204) {
                throw new Error(`Failed to delete hero image. Server returned status ${response.status}`);
            }

            // Clear hero image UI elements
            clear_hero_image_ui();

            // Show success message
            domModule.set_alert('#message', 'success', 'Hero image deleted successfully');

            // Clear success message after delay
            timeout_id = setTimeout(() => {
                clear_element('#message');
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error deleting hero image:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while deleting the hero image';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    }

    async function delete_thumbnail_image() {

        // Constants
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds

        // Helper function to safely clear element content
        const clear_element = (selector) => {
            const element = document.querySelector(selector);
            if (element) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.value = '';
                } else {
                    element.innerHTML = '';
                }
            }
        };

        // Helper function to safely set element display
        const set_element_display = (selector, display_value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = display_value;
            }
        };

        // Helper function to clear thumbnail image UI
        const clear_thumbnail_ui = () => {
            clear_element('#thumbnail-image');
            clear_element('#thumbnail-filename-display');
            clear_element('#thumbnail-image-display');
            clear_element('#thumbnail-media-uuid');
            set_media_name_display('#thumbnail-media-name-display', '');
            set_element_display('#thumbnail-trash', 'none');
            set_element_display('#thumbnail-legacy-migrate', 'none');
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                throw new Error('API endpoints configuration not available');
            }

            // Get and validate UUID
            const uuid = helperModule.get_parameter_by_name('exhibit_id');
            if (!uuid) {
                throw new Error('Missing required parameter: exhibit_id');
            }

            // Get and validate thumbnail image value
            const thumbnail_image_el = document.querySelector('#thumbnail-image');
            if (!thumbnail_image_el) {
                throw new Error('Thumbnail image input element not found');
            }

            const thumbnail_image = thumbnail_image_el.value?.trim();
            if (!thumbnail_image) {
                domModule.set_alert('#message', 'warning', 'No thumbnail image to delete');
                return false;
            }

            // Validate endpoint configuration exists
            const endpoint_template = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media?.get?.endpoint;
            if (!endpoint_template) {
                throw new Error('Endpoint configuration not found');
            }

            const endpoint = endpointsModule.build(endpoint_template, { exhibit_id: uuid, media: thumbnail_image });

            if (!endpoint) {
                throw new Error('Endpoint configuration not found');
            }

            // Show loading state
            domModule.set_alert('#message', 'info', 'Deleting thumbnail image...');

            const response = await httpModule.api({
                method: 'DELETE',
                url: endpoint
            });

            // Validate response
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 204) {
                throw new Error(`Failed to delete thumbnail image. Server returned status ${response.status}`);
            }

            // Clear thumbnail image UI elements
            clear_thumbnail_ui();

            // Show success message
            domModule.set_alert('#message', 'success', 'Thumbnail image deleted successfully');

            // Clear success message after delay
            timeout_id = setTimeout(() => {
                clear_element('#message');
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error deleting thumbnail image:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while deleting the thumbnail image';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    }

    obj.init = async function () {

        // Helper function to safely add event listener
        const add_listener = (selector, event, handler) => {
            const element = document.querySelector(selector);
            if (element && handler && typeof handler === 'function') {
                element.addEventListener(event, handler);
                return true;
            }
            console.warn(`Could not attach listener to: ${selector}`);
            return false;
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

        // Helper function to clear a media slot entirely (client-side only)
        const clear_media_slot = (display_selector, input_selector, uuid_selector, filename_selector, trash_selector, legacy_migrate_selector) => {
            restore_placeholder(display_selector);

            const input_el = document.querySelector(input_selector);
            if (input_el) input_el.value = '';

            const uuid_el = document.querySelector(uuid_selector);
            if (uuid_el) uuid_el.value = '';

            const filename_el = document.querySelector(filename_selector);
            if (filename_el) filename_el.textContent = '';

            // Both slots follow the `<slot>-media-uuid` / `<slot>-media-name-display` id pairing
            set_media_name_display(uuid_selector.replace('-media-uuid', '-media-name-display'), '');

            const trash_el = document.querySelector(trash_selector);
            if (trash_el) trash_el.style.display = 'none';

            if (legacy_migrate_selector) {
                const migrate_el = document.querySelector(legacy_migrate_selector);
                if (migrate_el) migrate_el.style.display = 'none';
            }
        };

        // Helper function to setup image delete handler
        // Uses legacy API delete when a filename-based image exists,
        // otherwise calls the unbind API for media library assets
        const setup_image_delete_handler = (image_selector, trash_selector, local_handler, display_selector, uuid_selector, filename_selector, legacy_migrate_selector, media_role) => {
            const image_el = document.querySelector(image_selector);
            const trash_el = document.querySelector(trash_selector);

            if (!image_el || !trash_el) {
                console.warn(`Image elements not found: ${image_selector} or ${trash_selector}`);
                return;
            }

            // Remove any existing listeners by cloning the element
            const new_trash_el = trash_el.cloneNode(true);
            trash_el.parentNode.replaceChild(new_trash_el, trash_el);

            new_trash_el.addEventListener('click', async function (e) {
                e.preventDefault();

                const has_legacy_image = image_el.value && image_el.value.trim().length > 0;

                if (has_legacy_image && local_handler && typeof local_handler === 'function') {
                    // Legacy filename-based image — use API delete, then restore placeholder
                    const result = await local_handler();

                    if (result) {
                        restore_placeholder(display_selector);
                    }
                } else {
                    // Media library asset — unbind via API, then clear UI
                    const uuid_el = document.querySelector(uuid_selector);
                    const media_uuid = uuid_el ? uuid_el.value.trim() : '';

                    if (media_uuid && media_role) {
                        try {
                            const exhibit_uuid = helperModule.get_parameter_by_name('exhibit_id');

                            if (exhibit_uuid) {
                                const endpoint_base = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media_library?.delete?.endpoint;
                                const endpoint = endpoint_base
                                    ? endpointsModule.build(endpoint_base, { exhibit_id: exhibit_uuid, media_role: media_role })
                                    : null;

                                if (endpoint) {
                                    const response = await httpModule.api({
                                        method: 'DELETE',
                                        url: endpoint
                                    });

                                    if (response && (response.status === 204 || response.status === 200)) {
                                        console.debug(`Media library binding unbound for role: ${media_role}`);
                                    } else {
                                        console.warn(`Unexpected response unbinding media role ${media_role}:`, response?.status);
                                    }
                                } else {
                                    console.warn('exhibit_media_library DELETE endpoint not configured');
                                }

                                // Remove exhibit UUID from media record's exhibits field (fire-and-forget)
                                if (typeof mediaPickerModule !== 'undefined' && typeof mediaPickerModule.remove_exhibit_association === 'function') {
                                    mediaPickerModule.remove_exhibit_association(media_uuid, exhibit_uuid, media_role);
                                }
                            }
                        } catch (unbind_error) {
                            console.error(`Error unbinding media role ${media_role}:`, unbind_error);
                        }
                    }

                    // Reset -prev tracking field
                    const prev_el = document.querySelector(uuid_selector + '-prev');
                    if (prev_el) prev_el.value = '';

                    clear_media_slot(display_selector, image_selector, uuid_selector, filename_selector, trash_selector, legacy_migrate_selector);
                }
            });
        };

        // Helper function to build redirect URL safely
        const build_redirect_url = (exhibit_id) => {
            const base_path = '/exhibits/exhibit/details';
            const params = new URLSearchParams({
                exhibit_id: exhibit_id,
                status: '403'
            });
            return `${base_path}?${params.toString()}`;
        };

        try {
            // Get and validate exhibit_id
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            if (!exhibit_id) {
                throw new Error('Missing required parameter: exhibit_id');
            }

            // Build redirect URL safely
            const redirect_url = build_redirect_url(exhibit_id);

            // Check permissions
            await authModule.check_permissions(
                ['update_exhibit', 'update_any_exhibit'],
                'exhibit',
                exhibit_id,
                null,
                redirect_url
            );


            // Add save button listener
            add_listener('#save-exhibit-btn', 'click', exhibitsEditFormModule?.update_exhibit_record);

            // Load and display edit record
            await display_edit_record();

            // Wire media picker buttons
            const exhibit_uuid = helperModule.get_parameter_by_name('exhibit_id');

            const pick_hero_btn = document.querySelector('#pick-hero-image-btn');
            if (pick_hero_btn) {
                pick_hero_btn.addEventListener('click', function () {
                    const prev_el = document.querySelector('#hero-image-media-uuid-prev');
                    mediaPickerModule.open({
                        role: 'hero_image',
                        exhibit_uuid: exhibit_uuid,
                        previous_media_uuid: prev_el ? prev_el.value || null : null,
                        media_type_filter: 'image',
                        on_select: function (media) {
                            // Update media UUID hidden input and -prev tracking field
                            const uuid_el = document.querySelector('#hero-image-media-uuid');
                            if (uuid_el) uuid_el.value = media.uuid;

                            const prev_track = document.querySelector('#hero-image-media-uuid-prev');
                            if (prev_track) prev_track.value = media.uuid;

                            // Show preview thumbnail
                            const display_el = document.querySelector('#hero-image-display');
                            if (display_el) {
                                display_el.innerHTML = '';
                                let thumb_url = '';

                                if (media.ingest_method === 'kaltura' && media.kaltura_thumbnail_url) {
                                    thumb_url = media.kaltura_thumbnail_url;
                                } else if (media.ingest_method === 'repository' && media.repo_uuid) {
                                    thumb_url = APP_PATH + '/api/v1/media/library/repo/thumbnail?uuid=' + encodeURIComponent(media.repo_uuid);
                                } else if (media.uuid && media.thumbnail_path) {
                                    thumb_url = APP_PATH + '/api/v1/media/library/thumbnail/' + media.uuid;
                                }

                                if (thumb_url) {
                                    const img = document.createElement('img');
                                    img.src = thumb_url;
                                    img.alt = media.alt_text || media.name || '';
                                    display_el.appendChild(img);
                                }
                            }

                            // Show filename + trash icon
                            const filename_el = document.querySelector('#hero-image-filename-display');
                            if (filename_el) {
                                filename_el.innerHTML = '';
                                const span = document.createElement('span');
                                span.style.fontSize = '11px';
                                span.textContent = media.name || media.original_filename || '';
                                filename_el.appendChild(span);
                            }

                            set_media_name_display('#hero-image-media-name-display', media.name);

                            const trash_el = document.querySelector('#hero-trash');
                            if (trash_el) trash_el.style.display = 'inline';

                            // Hide legacy migration hint
                            const migrate_el = document.querySelector('#hero-legacy-migrate');
                            if (migrate_el) migrate_el.style.display = 'none';
                        }
                    });
                });
            }

            const pick_thumbnail_btn = document.querySelector('#pick-thumbnail-btn');
            if (pick_thumbnail_btn) {
                pick_thumbnail_btn.addEventListener('click', function () {
                    const prev_el = document.querySelector('#thumbnail-media-uuid-prev');
                    mediaPickerModule.open({
                        role: 'thumbnail',
                        exhibit_uuid: exhibit_uuid,
                        previous_media_uuid: prev_el ? prev_el.value || null : null,
                        media_type_filter: 'image',
                        on_select: function (media) {
                            const uuid_el = document.querySelector('#thumbnail-media-uuid');
                            if (uuid_el) uuid_el.value = media.uuid;

                            const prev_track = document.querySelector('#thumbnail-media-uuid-prev');
                            if (prev_track) prev_track.value = media.uuid;

                            const display_el = document.querySelector('#thumbnail-image-display');
                            if (display_el) {
                                display_el.innerHTML = '';
                                let thumb_url = '';

                                if (media.ingest_method === 'kaltura' && media.kaltura_thumbnail_url) {
                                    thumb_url = media.kaltura_thumbnail_url;
                                } else if (media.ingest_method === 'repository' && media.repo_uuid) {
                                    thumb_url = APP_PATH + '/api/v1/media/library/repo/thumbnail?uuid=' + encodeURIComponent(media.repo_uuid);
                                } else if (media.uuid && media.thumbnail_path) {
                                    thumb_url = APP_PATH + '/api/v1/media/library/thumbnail/' + media.uuid;
                                }

                                if (thumb_url) {
                                    const img = document.createElement('img');
                                    img.src = thumb_url;
                                    img.alt = media.alt_text || media.name || '';
                                    display_el.appendChild(img);
                                }
                            }

                            const filename_el = document.querySelector('#thumbnail-filename-display');
                            if (filename_el) {
                                filename_el.innerHTML = '';
                                const span = document.createElement('span');
                                span.style.fontSize = '11px';
                                span.textContent = media.name || media.original_filename || '';
                                filename_el.appendChild(span);
                            }

                            set_media_name_display('#thumbnail-media-name-display', media.name);

                            const trash_el = document.querySelector('#thumbnail-trash');
                            if (trash_el) trash_el.style.display = 'inline';

                            const migrate_el = document.querySelector('#thumbnail-legacy-migrate');
                            if (migrate_el) migrate_el.style.display = 'none';
                        }
                    });
                });
            }

            // Setup image delete handlers after record is loaded
            setup_image_delete_handler(
                '#hero-image',
                '#hero-trash',
                delete_hero_image,
                '#hero-image-display',
                '#hero-image-media-uuid',
                '#hero-image-filename-display',
                '#hero-legacy-migrate',
                'hero_image'
            );

            setup_image_delete_handler(
                '#thumbnail-image',
                '#thumbnail-trash',
                delete_thumbnail_image,
                '#thumbnail-image-display',
                '#thumbnail-media-uuid',
                '#thumbnail-filename-display',
                '#thumbnail-legacy-migrate',
                'thumbnail'
            );

            console.debug('Module initialized successfully');
            return true;

        } catch (error) {
            // Log error for debugging
            console.error('Error initializing module:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred during initialization';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    };

    return obj;

}());
