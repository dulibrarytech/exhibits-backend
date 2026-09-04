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

const exhibitsCommonFormModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Configurable message container selector.
     * Defaults to '#message' (standalone page).
     * Call set_message_selector('#add-exhibit-message') before init()
     * when the form is rendered inside the add-exhibit modal.
     * @type {string}
     */
    let message_selector = '#message';

    /**
     * Sets the CSS selector used for displaying form messages.
     * Must be called before init() when the form lives in a modal
     * whose message container differs from the page-level '#message'.
     *
     * @param {string} selector - CSS selector for the message container
     */
    obj.set_message_selector = function (selector) {

        if (typeof selector === 'string' && selector.trim().length > 0) {
            message_selector = selector.trim();
        } else {
            console.warn('Invalid message selector provided, keeping current:', message_selector);
        }
    };

    obj.get_common_form_fields = function () {

        // Cache all DOM selectors
        const selectors = {
            title: '#exhibit-title-input',
            subtitle: '#exhibit-sub-title-input',
            description: '#exhibit-description-input',
            curators: '#exhibit-about-the-curators-input',
            alert_text: '#exhibit-alert-text-input',
            is_featured: '#is-featured',
            is_student_curated: '#is-student-curated',
            is_content_advisory: '#is-content-advisory',
            owner: '#exhibit-owner',
            is_published: '#is-published',
            hero_image: '#hero-image',
            thumbnail: '#thumbnail-image',
            page_layout: '#exhibit-page-layout',
            template: '#exhibit-template',
            message: message_selector
        };

        // Helper function to safely get element value
        const get_element_value = (selector, default_value = '') => {
            const element = document.querySelector(selector);
            return element?.value?.trim() || default_value;
        };

        // Helper function to safely get checkbox state
        const get_checkbox_value = (selector) => {
            const element = document.querySelector(selector);
            return element?.checked ?? false;
        };

        // Helper function to convert boolean to binary integer
        const bool_to_int = (value) => value ? 1 : 0;

        // Helper function to safely convert to number
        const to_number = (value, default_value = null) => {
            if (value === null || value === undefined || value === '') {
                return default_value;
            }
            const num = Number(value);
            return isNaN(num) ? default_value : num;
        };

        try {
            // Clear any previous title validation state.
            const title_el = document.querySelector(selectors.title);
            const TITLE_ERROR_ID = 'exhibit-title-input-error';

            if (title_el) {
                title_el.classList.remove('is-invalid');
                domModule.clear_field_error(title_el, TITLE_ERROR_ID);
            }

            // Get rich text field values (serialized HTML; '' when empty)
            const title = rteModule.get_html('exhibit-title-input');
            const subtitle = rteModule.get_html('exhibit-sub-title-input');
            const description = rteModule.get_html('exhibit-description-input');
            const about_curators = rteModule.get_html('exhibit-about-the-curators-input');

            // Validate required field.
            if (!title) {

                if (title_el) {
                    title_el.classList.add('is-invalid');
                    domModule.set_field_error(title_el, TITLE_ERROR_ID, 'Title is required');
                    title_el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                return false;
            }

            // Get checkbox values
            const is_featured = get_checkbox_value(selectors.is_featured);
            const is_student_curated = get_checkbox_value(selectors.is_student_curated);
            const is_content_advisory = get_checkbox_value(selectors.is_content_advisory);

            // Get conditional alert text (fixed boilerplate in a hidden input)
            const alert_text = is_content_advisory
                ? get_element_value(selectors.alert_text)
                : '';

            // Get optional fields (may not exist in all forms)
            const owner_value = get_element_value(selectors.owner);
            const is_published_value = get_element_value(selectors.is_published);

            // Get media fields
            const hero_image = get_element_value(selectors.hero_image);
            const thumbnail = get_element_value(selectors.thumbnail);

            // Get media library UUIDs (from picker flow)
            const hero_image_media_uuid = get_element_value('#hero-image-media-uuid');
            const thumbnail_media_uuid = get_element_value('#thumbnail-media-uuid');

            // Get banner template from radio buttons
            const banner_elements = document.getElementsByName('banner_template');
            const banner_template = banner_elements.length > 0
                ? helperModule.get_checked_radio_button(banner_elements)
                : '';

            // Get layout fields
            const page_layout = get_element_value(selectors.page_layout);
            const exhibit_template = get_element_value(selectors.template);

            // Construct exhibit object
            const exhibit = {
                title,
                subtitle,
                description,
                about_the_curators: about_curators,
                is_featured: bool_to_int(is_featured),
                is_student_curated: bool_to_int(is_student_curated),
                alert_text: alert_text,
                hero_image: hero_image,
                thumbnail: thumbnail,
                banner_template: banner_template,
                page_layout: page_layout,
                exhibit_template: exhibit_template
            };

            // Add media library UUIDs if present (from media picker flow)
            if (hero_image_media_uuid) {
                exhibit.hero_image_media_uuid = hero_image_media_uuid;
            }

            if (thumbnail_media_uuid) {
                exhibit.thumbnail_media_uuid = thumbnail_media_uuid;
            }

            // Add optional fields only if they have values, converted to Number
            if (owner_value) {
                const owner_number = to_number(owner_value, null);
                if (owner_number !== null) {
                    exhibit.owner = owner_number;
                }
            }

            if (is_published_value) {
                const is_published_number = to_number(is_published_value, null);
                if (is_published_number !== null) {
                    exhibit.is_published = is_published_number;
                }
            }

            return exhibit;

        } catch (error) {
            // Log error for debugging
            console.error('Error getting form fields:', error);

            // Display safe error message
            domModule.set_alert(selectors.message, 'danger', 'An error occurred while processing form data');

            return false;
        }
    };

    /**
     * Deletes hero image
     */
    obj.delete_hero_image = async function () {

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
            set_element_display('#hero-trash', 'none');
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

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                throw new Error('API endpoints configuration not available');
            }

            // Get and validate hero image value
            const hero_image_el = document.querySelector('#hero-image');
            if (!hero_image_el) {
                throw new Error('Hero image input element not found');
            }

            const hero_image = hero_image_el.value?.trim();
            if (!hero_image) {
                domModule.set_alert(message_selector, 'warning', 'No hero image to delete');
                return false;
            }

            // Validate endpoint configuration exists
            const endpoint_base = EXHIBITS_ENDPOINTS.exhibits?.media?.delete?.endpoint;
            if (!endpoint_base) {
                throw new Error('Endpoint configuration not found');
            }

            // Build endpoint URL with safe query parameter encoding
            const query_string = build_query_string({ media: hero_image });
            const endpoint = `${endpoint_base}?${query_string}`;

            // Show loading state
            domModule.set_alert(message_selector, 'info', 'Deleting hero image...');

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
            domModule.set_alert(message_selector, 'success', 'Hero image deleted successfully');

            // Clear message after delay
            timeout_id = setTimeout(() => {
                clear_element(message_selector);
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
            domModule.set_alert(message_selector, 'danger', error_message);

            return false;
        }
    };

    obj.delete_thumbnail_image = async function () {

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
            set_element_display('#thumbnail-trash', 'none');
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

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                throw new Error('API endpoints configuration not available');
            }

            // Get and validate thumbnail image value
            const thumbnail_image_el = document.querySelector('#thumbnail-image');
            if (!thumbnail_image_el) {
                throw new Error('Thumbnail image input element not found');
            }

            const thumbnail_image = thumbnail_image_el.value?.trim();
            if (!thumbnail_image) {
                domModule.set_alert(message_selector, 'warning', 'No thumbnail image to delete');
                return false;
            }

            // Validate endpoint configuration exists
            const endpoint_base = EXHIBITS_ENDPOINTS.exhibits?.media?.delete?.endpoint;
            if (!endpoint_base) {
                throw new Error('Endpoint configuration not found');
            }

            // Build endpoint URL with safe query parameter encoding
            const query_string = build_query_string({ media: thumbnail_image });
            const endpoint = `${endpoint_base}?${query_string}`;

            // Show loading state
            domModule.set_alert(message_selector, 'info', 'Deleting thumbnail image...');

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
            domModule.set_alert(message_selector, 'success', 'Thumbnail image deleted successfully');

            // Clear success message after delay
            timeout_id = setTimeout(() => {
                clear_element(message_selector);
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
            domModule.set_alert(message_selector, 'danger', error_message);

            return false;
        }
    };

    obj.init = async function () {

        // Helper function to safely set element display
        const set_element_display = (selector, display_value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = display_value;
            } else {
                console.warn(`Element not found: ${selector}`);
            }
        };

        try {

            // Check authentication
            const token = authModule.get_user_token();
            if (!token) {
                throw new Error('Authentication token not available');
            }
            await authModule.check_auth(token);

            // Initialize navigation
            if (navModule && typeof navModule.init === 'function') {
                navModule.init();
            }

            // Hide trash buttons initially
            set_element_display('#hero-trash', 'none');
            set_element_display('#thumbnail-trash', 'none');

            // Show form
            if (helperModule && typeof helperModule.show_form === 'function') {
                helperModule.show_form();
            }

            console.debug('Module initialized successfully');
            return true;

        } catch (error) {
            // Log error for debugging
            console.error('Error initializing module:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred during initialization';
            domModule.set_alert(message_selector, 'danger', error_message);

            return false;
        }
    };

    return obj;

}());
