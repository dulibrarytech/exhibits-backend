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
            title_error: '#exhibit-title-error',
            message: '#message'
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

        // Helper function to display error messages safely (prevents XSS)
        const show_error = (selector, message) => {
            const element = document.querySelector(selector);
            if (!element) {
                console.error(`Error element ${selector} not found`);
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

            element.innerHTML = '';
            element.appendChild(alert_div);
        };

        try {
            // Get and clean text inputs
            const title = helperModule.clean_html(get_element_value(selectors.title));
            const subtitle = helperModule.clean_html(get_element_value(selectors.subtitle));
            const description = helperModule.clean_html(get_element_value(selectors.description));
            const about_curators = helperModule.clean_html(get_element_value(selectors.curators));

            // Validate required field
            if (!title) {
                show_error(selectors.title_error, 'Please enter an exhibit title');
                return false;
            }

            // Get checkbox values
            const is_featured = get_checkbox_value(selectors.is_featured);
            const is_student_curated = get_checkbox_value(selectors.is_student_curated);
            const is_content_advisory = get_checkbox_value(selectors.is_content_advisory);

            // Get conditional alert text
            const alert_text = is_content_advisory
                ? helperModule.clean_html(get_element_value(selectors.alert_text))
                : '';

            // Get optional fields (may not exist in all forms)
            const owner_value = get_element_value(selectors.owner);
            const is_published_value = get_element_value(selectors.is_published);

            // Get media fields
            const hero_image = get_element_value(selectors.hero_image);
            const thumbnail = get_element_value(selectors.thumbnail);

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
            show_error(selectors.message, 'An error occurred while processing form data');

            return false;
        }
    };

    obj.get_exhibit_styles = function () {

        // Configuration mapping for style fields
        const style_config = {
            navigation: {
                backgroundColor: { selector: '#nav-background-color', transform: null },
                color: { selector: '#nav-font-color', transform: null },
                fontFamily: { selector: '#nav-font', transform: null },
                fontSize: { selector: '#nav-font-size', transform: (val) => val ? `${val}px` : '' }
            },
            template: {
                backgroundColor: { selector: '#template-background-color', transform: null },
                color: { selector: '#template-font-color', transform: null },
                fontFamily: { selector: '#template-font', transform: null },
                fontSize: { selector: '#template-font-size', transform: (val) => val ? `${val}px` : '' }
            },
            introduction: {
                backgroundColor: { selector: '#introduction-background-color', transform: null },
                color: { selector: '#introduction-font-color', transform: null },
                fontFamily: { selector: '#introduction-font', transform: null },
                fontSize: { selector: '#introduction-font-size', transform: (val) => val ? `${val}px` : '' }
            }
        };

        // Helper function to safely get element value
        const get_element_value = (selector) => {
            const element = document.querySelector(selector);
            return element?.value?.trim() || '';
        };

        // Helper function to apply transformation if provided
        const apply_transform = (value, transform) => {
            if (!value) return '';
            return transform ? transform(value) : value;
        };

        // Helper function to display error messages safely (prevents XSS)
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

        // Build styles object from configuration
        const build_styles_object = (config) => {
            const result = {};

            for (const [section, properties] of Object.entries(config)) {
                result[section] = {};

                for (const [property, settings] of Object.entries(properties)) {
                    const raw_value = get_element_value(settings.selector);
                    result[section][property] = apply_transform(raw_value, settings.transform);
                }
            }

            return result;
        };

        try {

            const styles = build_styles_object(style_config);

            return {
                exhibit: styles
            };

        } catch (error) {
            // Log error for debugging
            console.error('Error getting exhibit styles:', error);

            // Display safe error message
            show_error('An error occurred while processing style data');

            return null;
        }
    };

    /**
     * Deletes hero image
     */
    obj.delete_hero_image = async function () {

        // Constants
        const REQUEST_TIMEOUT = 30000; // 30 seconds
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds

        // Helper function to safely display messages (prevents XSS)
        const show_message = (message, type = 'success', icon = 'fa-info') => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${type}`;
            alert_div.setAttribute('role', 'alert');

            const icon_el = document.createElement('i');
            icon_el.className = `fa ${icon}`;

            const text = document.createTextNode(` ${message}`);

            alert_div.appendChild(icon_el);
            alert_div.appendChild(text);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

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
                show_message('No hero image to delete', 'warning', 'fa-exclamation');
                return false;
            }

            // Get and validate authentication token
            const token = authModule.get_user_token();
            if (!token) {
                show_message('Authentication error: Please log in again', 'danger', 'fa-lock');
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
            show_message('Deleting hero image...', 'info');

            // Make DELETE request with timeout
            const response = await Promise.race([
                httpModule.req({
                    method: 'DELETE',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
                )
            ]);

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
            show_message('Hero image deleted successfully', 'success', 'fa-check');

            // Clear message after delay
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
            show_message(error_message, 'danger', 'fa-exclamation');

            return false;
        }
    };

    obj.delete_thumbnail_image = async function () {

        // Constants
        const REQUEST_TIMEOUT = 30000; // 30 seconds
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds

        // Helper function to safely display messages (prevents XSS)
        const show_message = (message, type = 'success', icon = 'fa-info') => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${type}`;
            alert_div.setAttribute('role', 'alert');

            const icon_el = document.createElement('i');
            icon_el.className = `fa ${icon}`;

            const text = document.createTextNode(` ${message}`);

            alert_div.appendChild(icon_el);
            alert_div.appendChild(text);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

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
                show_message('No thumbnail image to delete', 'warning', 'fa-exclamation');
                return false;
            }

            // Get and validate authentication token
            const token = authModule.get_user_token();
            if (!token) {
                show_message('Authentication error: Please log in again', 'danger', 'fa-lock');
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
            show_message('Deleting thumbnail image...', 'info');

            // Make DELETE request with timeout
            const response = await Promise.race([
                httpModule.req({
                    method: 'DELETE',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
                )
            ]);

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
            show_message('Thumbnail image deleted successfully', 'success', 'fa-check');

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
            show_message(error_message, 'danger', 'fa-exclamation');

            return false;
        }
    };

    obj.init = async function () {

        // Configuration for color picker pairs
        const color_picker_pairs = [
            {
                input: '#introduction-background-color',
                picker: '#introduction-background-color-picker'
            },
            {
                input: '#introduction-font-color',
                picker: '#introduction-font-color-picker'
            },
            {
                input: '#nav-background-color',
                picker: '#nav-background-color-picker'
            },
            {
                input: '#nav-font-color',
                picker: '#nav-font-color-picker'
            },
            {
                input: '#template-background-color',
                picker: '#template-background-color-picker'
            },
            {
                input: '#template-font-color',
                picker: '#template-font-color-picker'
            }
        ];

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

        // Helper function to safely set element display
        const set_element_display = (selector, display_value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = display_value;
            } else {
                console.warn(`Element not found: ${selector}`);
            }
        };

        // Helper function to sync color picker with input
        const sync_color_values = (source_el, target_el) => {
            if (source_el && target_el) {
                target_el.value = source_el.value;
            }
        };

        // Helper function to setup bidirectional color picker sync
        const setup_color_picker_sync = (input_selector, picker_selector) => {
            const input_el = document.querySelector(input_selector);
            const picker_el = document.querySelector(picker_selector);

            if (!input_el || !picker_el) {
                console.warn(`Color picker elements not found: ${input_selector} or ${picker_selector}`);
                return false;
            }

            // Picker to input sync
            picker_el.addEventListener('input', () => {
                sync_color_values(picker_el, input_el);
            });

            // Input to picker sync
            input_el.addEventListener('input', () => {
                sync_color_values(input_el, picker_el);
            });

            return true;
        };

        try {

            // Initialize upload modules
            if (uploadsModule) {
                uploadsModule.upload_exhibit_hero_image();
                uploadsModule.upload_exhibit_thumbnail_image();
            } else {
                console.warn('uploadsModule not available');
            }

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

            // Setup color picker synchronization
            let synced_count = 0;
            let failed_count = 0;

            for (const pair of color_picker_pairs) {
                const success = setup_color_picker_sync(pair.input, pair.picker);
                if (success) {
                    synced_count++;
                } else {
                    failed_count++;
                }
            }

            console.log(`Color pickers initialized: ${synced_count} synced, ${failed_count} failed`);

            // Show form
            if (helperModule && typeof helperModule.show_form === 'function') {
                helperModule.show_form();
            }

            console.log('Module initialized successfully');
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
