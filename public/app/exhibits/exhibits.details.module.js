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

const exhibitsDetailsModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_exhibit_details_record() {

        // Constants
        const REQUEST_TIMEOUT = 30000; // 30 seconds

        // Helper function to safely display messages (prevents XSS)
        const show_message = (message, type = 'danger', icon = 'fa-exclamation') => {
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

        // Helper function to redirect to login
        const redirect_to_login = () => {
            setTimeout(() => {
                window.location.href = `${APP_PATH}/dashboard/login`;
            }, 1000);
        };

        try {
            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                console.error('EXHIBITS_ENDPOINTS is not available');
                show_message('Configuration error: API endpoints not available', 'danger', 'fa-exclamation');
                redirect_to_login();
                return null;
            }

            // Get and validate UUID
            const uuid = helperModule.get_parameter_by_name('exhibit_id');
            if (!uuid) {
                show_message('Missing required parameter: exhibit_id', 'danger', 'fa-exclamation');
                return null;
            }

            // Get and validate authentication token
            const token = authModule.get_user_token();
            if (!token) {
                console.error('Authentication token not available');
                show_message('Authentication error: Please log in again', 'warning', 'fa-lock');
                redirect_to_login();
                return null;
            }

            // Get and validate user profile
            const profile = authModule.get_user_profile_data();
            if (!profile || !profile.uid) {
                console.error('User profile not available');
                show_message('User profile error: Please log in again', 'warning', 'fa-user');
                redirect_to_login();
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
            const encoded_uuid = encodeURIComponent(uuid);
            const endpoint_base = endpoint_config.replace(':exhibit_id', encoded_uuid);

            // Build query parameters safely
            const query_string = build_query_string({ uid: profile.uid });
            const endpoint = `${endpoint_base}?${query_string}`;

            // Make request with timeout
            const response = await Promise.race([
                httpModule.req({
                    method: 'GET',
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

            // Validate response structure
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response structure from server');
            }

            if (response.data.data.length === 0) {
                throw new Error('Exhibit record not found');
            }

            // Return the first record
            return response.data.data[0];

        } catch (error) {
            // Log error for debugging
            console.error('Error getting exhibit details record:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while loading the exhibit record';
            show_message(error_message, 'danger', 'fa-exclamation');

            return null;
        }
    }

    async function display_details_record() {

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
        const create_image_element = (alt_text, src, height = 200) => {
            const p = document.createElement('p');
            const img = document.createElement('img');
            img.alt = alt_text || '';
            img.src = src;
            img.height = height;
            p.appendChild(img);
            return p;
        };

        // Helper function to safely set element content
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

        // Helper function to display error messages safely
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

        // Helper function to set audit information safely
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

        // Helper function to set media display
        const set_media_display = (record, field_name, display_selector, filename_selector, input_selector, prev_selector, trash_selector) => {
            const media_value = record[field_name];
            if (!media_value || media_value.length === 0) return;

            const media_url = `${APP_PATH}/api/v1/exhibits/${record.uuid}/media/${media_value}`;
            const image_element = create_image_element(media_value, media_url, 200);
            const filename_element = create_filename_display(media_value);

            set_element_content(display_selector, image_element);
            set_element_content(filename_selector, filename_element);
            set_element_value(input_selector, media_value);
            set_element_value(prev_selector, media_value);
            set_element_display(trash_selector, 'inline');
        };

        // Helper function to set radio button selection
        const set_radio_selection = (name, value) => {
            if (!value) return;

            const radio_buttons = document.getElementsByName(name);
            for (let i = 0; i < radio_buttons.length; i++) {
                if (radio_buttons[i].value === value) {
                    radio_buttons[i].checked = true;
                    break;
                }
            }
        };

        // Helper function to set select option by value
        const set_select_value = (selector, value) => {
            const select_element = document.querySelector(selector);
            if (!select_element || !value) return;

            for (let i = 0; i < select_element.options.length; i++) {
                if (select_element.options[i].value === value) {
                    select_element.value = value;
                    break;
                }
            }
        };

        // Helper function to populate style fields for a section
        const populate_style_fields = (section_name, styles, config) => {
            if (!styles || !styles.exhibit || !styles.exhibit[section_name]) {
                return;
            }

            const section_styles = styles.exhibit[section_name];

            // Background color
            if (section_styles.backgroundColor) {
                set_element_value(config.backgroundColor.input, section_styles.backgroundColor);
                set_element_value(config.backgroundColor.picker, section_styles.backgroundColor);
            }

            // Font color
            if (section_styles.color) {
                set_element_value(config.color.input, section_styles.color);
                set_element_value(config.color.picker, section_styles.color);
            }

            // Font family
            if (section_styles.fontFamily) {
                set_select_value(config.fontFamily.select, section_styles.fontFamily);
            }

            // Font size (remove 'px' suffix)
            if (section_styles.fontSize) {
                const font_size_value = String(section_styles.fontSize).replace('px', '');
                set_element_value(config.fontSize.input, font_size_value);
            }
        };

        try {
            // Get exhibit record
            const record = await get_exhibit_details_record();

            if (!record) {
                throw new Error('Failed to retrieve exhibit record');
            }

            // Set audit information
            set_audit_info(record.created_by, record.created, record.updated_by, record.updated);

            // Set publish status
            const is_published = record.is_published === 1;
            set_element_value('#is-published', is_published);

            // Set basic exhibit data with proper unescaping
            set_element_value('#exhibit-title-input', helperModule.unescape(record.title || ''));
            set_element_value('#exhibit-sub-title-input', helperModule.unescape(record.subtitle || ''));
            set_element_value('#exhibit-description-input', helperModule.unescape(record.description || ''));
            set_element_value('#exhibit-about-the-curators-input', helperModule.unescape(record.about_the_curators || ''));

            // Set checkboxes
            set_checkbox_state('#is-featured', record.is_featured === 1);
            set_checkbox_state('#is-student-curated', record.is_student_curated === 1);

            // Set content advisory
            if (record.alert_text && record.alert_text.length > 0) {
                set_checkbox_state('#is-content-advisory', true);
                set_element_value('#exhibit-alert-text-input', helperModule.unescape(record.alert_text));
            }

            // Set media displays
            if (record.hero_image) {
                set_media_display(
                    record,
                    'hero_image',
                    '#hero-image-display',
                    '#hero-image-filename-display',
                    '#hero-image',
                    '#hero-image-prev',
                    '#hero-trash'
                );
            }

            if (record.thumbnail) {
                set_media_display(
                    record,
                    'thumbnail',
                    '#thumbnail-image-display',
                    '#thumbnail-filename-display',
                    '#thumbnail-image',
                    '#thumbnail-image-prev',
                    '#thumbnail-trash'
                );
            }

            // Set banner template selection
            if (record.banner_template) {
                set_radio_selection('banner_template', record.banner_template);
            }

            // Parse and set styles
            if (record.styles) {
                try {
                    const styles = JSON.parse(record.styles);

                    // Configuration for style selectors
                    const style_config = {
                        navigation: {
                            backgroundColor: { input: '#nav-background-color', picker: '#nav-background-color-picker' },
                            color: { input: '#nav-font-color', picker: '#nav-font-color-picker' },
                            fontFamily: { select: '#nav-font' },
                            fontSize: { input: '#nav-font-size' }
                        },
                        template: {
                            backgroundColor: { input: '#template-background-color', picker: '#template-background-color-picker' },
                            color: { input: '#template-font-color', picker: '#template-font-color-picker' },
                            fontFamily: { select: '#template-font' },
                            fontSize: { input: '#template-font-size' }
                        },
                        introduction: {
                            backgroundColor: { input: '#introduction-background-color', picker: '#introduction-background-color-picker' },
                            color: { input: '#introduction-font-color', picker: '#introduction-font-color-picker' },
                            fontFamily: { select: '#introduction-font' },
                            fontSize: { input: '#introduction-font-size' }
                        }
                    };

                    // Populate styles for each section
                    populate_style_fields('navigation', styles, style_config.navigation);
                    populate_style_fields('template', styles, style_config.template);
                    populate_style_fields('introduction', styles, style_config.introduction);

                } catch (parse_error) {
                    console.error('Error parsing styles JSON:', parse_error);
                    // Continue execution even if styles fail to parse
                }
            }

            return false;

        } catch (error) {
            // Log error for debugging
            console.error('Error displaying details record:', error);

            // Display safe error message
            const error_message = error.message || 'An error occurred while loading the exhibit record';
            show_error(error_message);

            return false;
        }
    }

    obj.init = async function () {

        // Helper function to safely display messages (prevents XSS)
        const show_message = (message, type = 'danger', icon = 'fa-exclamation') => {
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

        try {

            // Check for permission denied status
            const status = helperModule.get_parameter_by_name('status');
            if (status === '403') {
                show_message('You do not have permission to edit this record.', 'danger', 'fa-exclamation');
            }

            // Initialize navigation
            if (navModule && typeof navModule.back_to_exhibits === 'function') {
                navModule.back_to_exhibits();
            }

            // Add save button listener
            add_listener('#save-exhibit-btn', 'click', exhibitsDetailsModule?.update_exhibit_record);

            // Display the record details
            await display_details_record();

            console.log('Module initialized successfully');
            return true;

        } catch (error) {
            // Log error for debugging
            console.error('Error initializing module:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred during initialization';
            show_message(error_message, 'danger', 'fa-exclamation');

            return false;
        }
    };

    return obj;

}());
