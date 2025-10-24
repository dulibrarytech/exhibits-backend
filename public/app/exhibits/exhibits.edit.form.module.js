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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_exhibit_record() {

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

        try {

            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                console.error('EXHIBITS_ENDPOINTS is not available');
                show_message('Configuration error: API endpoints not available');
                helperModule.redirect_to_auth();
                return null;
            }

            // Get and validate UUID
            const uuid = helperModule.get_parameter_by_name('exhibit_id');

            if (!uuid) {
                show_message('Missing required parameter: exhibit_id');
                return null;
            }

            // Get and validate authentication token
            const token = authModule.get_user_token();

            if (!token) {
                console.error('Authentication token not available');
                show_message('Authentication error: Please log in again', 'warning', 'fa-lock');
                helperModule.redirect_to_auth();
                return null;
            }

            // Get and validate user profile
            const profile = authModule.get_user_profile_data();

            if (!profile || !profile.uid) {
                console.error('User profile not available');
                show_message('User profile error: Please log in again', 'warning', 'fa-user');
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
            const encoded_uuid = encodeURIComponent(uuid);
            const endpoint_base = endpoint_config.replace(':exhibit_id', encoded_uuid);

            // Build query parameters safely
            const query_string = build_query_string({
                type: 'edit',
                uid: profile.uid
            });

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
            console.error('Error getting exhibit record:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while loading the exhibit record';
            show_message(error_message);

            return null;
        }
    }

    function get_exhibit_data() {

        // Helper function to safely get element value
        const get_element_value = (selector, default_value = '') => {
            const element = document.querySelector(selector);
            return element?.value?.trim() || default_value;
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

            // Validate that common fields were retrieved successfully
            if (!exhibit || typeof exhibit !== 'object') {
                throw new Error('Failed to retrieve common form fields');
            }

            // Get exhibit styles
            const styles = exhibitsCommonFormModule.get_exhibit_styles();

            // Validate styles were retrieved successfully
            if (!styles || typeof styles !== 'object') {
                throw new Error('Failed to retrieve exhibit styles');
            }

            exhibit.styles = styles;

            // Get previous image values (used for comparison on update)
            exhibit.hero_image_prev = get_element_value('#hero-image-prev');
            exhibit.thumbnail_prev = get_element_value('#thumbnail-image-prev');

            // Validate that at least title exists (basic sanity check)
            if (!exhibit.title || exhibit.title.length === 0) {
                console.error('Exhibit data validation failed: missing title');
                show_error('Please enter an exhibit title');
                return false;
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

    async function display_edit_record() {

        // Configuration for style mappings
        const style_selectors = {
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

        // Helper function to set media display
        const set_media_display = (record, field_name, display_selector, filename_selector, input_selector, prev_selector, trash_selector) => {
            const media_value = record[field_name];
            if (!media_value) return;

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

        // Helper function to populate style fields
        const populate_style_fields = (section, styles, config) => {

            if (!styles || !styles.exhibit || !styles.exhibit[section]) return;

            const section_styles = styles.exhibit[section];
            const section_config = config[section];

            // Background color
            if (section_styles.backgroundColor) {
                set_element_value(section_config.backgroundColor.input, section_styles.backgroundColor);
                set_element_value(section_config.backgroundColor.picker, section_styles.backgroundColor);
            }

            // Font color
            if (section_styles.color) {
                set_element_value(section_config.color.input, section_styles.color);
                set_element_value(section_config.color.picker, section_styles.color);
            }

            // Font family
            if (section_styles.fontFamily) {
                set_select_value(section_config.fontFamily.select, section_styles.fontFamily);
            }

            // Font size (remove 'px' suffix)
            if (section_styles.fontSize) {
                const font_size_value = String(section_styles.fontSize).replace('px', '');
                set_element_value(section_config.fontSize.input, font_size_value);
            }
        };

        // Helper function to check if current user is an administrator
        const is_user_administrator = async () => {
            try {
                const profile = authModule.get_user_profile_data();
                if (!profile || !profile.uid) {
                    return false;
                }

                const user_id = parseInt(profile.uid, 10);
                if (isNaN(user_id)) {
                    return false;
                }

                const user_role = await authModule.get_user_role(user_id);
                return user_role === 'Administrator';

            } catch (error) {
                console.error('Error checking user role:', error);
                return false;
            }
        };

        // Helper function to disable all form fields
        const disable_form_fields = async (is_admin) => {

            // Get all form elements
            const form_elements = document.querySelectorAll(
                'input:not([type="hidden"]), textarea, select, button[type="submit"], button[type="button"]'
            );

            let disabled_count = 0;

            form_elements.forEach(element => {
                // Skip the unlock button if user is an administrator
                if (is_admin && element.id === 'unlock-record') {
                    console.log('Preserving unlock button for administrator');
                    return;
                }

                // Don't disable already disabled elements or read-only elements
                if (!element.disabled && !element.readOnly) {
                    element.disabled = true;
                    element.style.cursor = 'not-allowed';
                    element.style.opacity = '0.6';
                    disabled_count++;
                }
            });

            // Also disable file upload areas and custom buttons (except unlock button for admins)
            const custom_buttons = document.querySelectorAll('.btn:not([disabled])');
            custom_buttons.forEach(button => {
                // Skip the unlock button if user is an administrator
                if (is_admin && button.id === 'unlock-record') {
                    return;
                }

                button.disabled = true;
                button.style.cursor = 'not-allowed';
                button.style.opacity = '0.6';
            });

            console.log(`Disabled ${disabled_count} form elements (record locked by another user)`);
        };

        // Helper function to check if record is locked by another user
        const is_locked_by_other_user = (record) => {

            // Check if record is locked
            if (!record || record.is_locked !== 1) {
                return false;
            }

            // Get current user profile
            const profile = authModule.get_user_profile_data();
            if (!profile || !profile.uid) {
                console.warn('Unable to get user profile data');
                return false;
            }

            // Parse user IDs safely
            const user_id = parseInt(profile.uid, 10);
            const locked_by_user = parseInt(record.locked_by_user, 10);

            // Check for valid numbers
            if (isNaN(user_id) || isNaN(locked_by_user)) {
                console.error('Invalid user ID values');
                return false;
            }

            // Return true if locked by someone else
            return user_id !== locked_by_user;
        };

        // Helper function to setup automatic unlock on page navigation
        const setup_auto_unlock = (record) => {

            // Only setup auto-unlock if the current user has the record locked
            if (!record || record.is_locked !== 1) {
                return;
            }

            const profile = authModule.get_user_profile_data();
            if (!profile || !profile.uid) {
                return;
            }

            const user_id = parseInt(profile.uid, 10);
            const locked_by_user = parseInt(record.locked_by_user, 10);

            // Only unlock if current user is the one who locked it
            if (user_id !== locked_by_user) {
                return;
            }

            // Handler to unlock record when leaving page
            const handle_page_unload = () => {

                try {

                    // Call unlock function without awaiting
                    // The browser will attempt to complete the request before unload
                    if (helperModule && typeof helperModule.unlock_record === 'function') {
                        helperModule.unlock_record().catch(error => {
                            console.error('Error unlocking record during page unload:', error);
                        });
                    }
                } catch (error) {
                    console.error('Error in page unload handler:', error);
                }
            };

            // Add event listeners for various unload scenarios
            // beforeunload - fires when page is about to be unloaded
            window.addEventListener('beforeunload', handle_page_unload);

            // pagehide - more reliable for mobile browsers
            window.addEventListener('pagehide', handle_page_unload);

            // Log that auto-unlock has been setup
            console.log('Auto-unlock setup complete for record');
        };

        try {

            // Get exhibit record
            const record = await get_exhibit_record();

            if (!record) {
                throw new Error('Failed to retrieve exhibit record');
            }

            // Check if record is locked
            await helperModule.check_if_locked(record, '#exhibit-submit-card');

            // Disable form fields if locked by another user
            if (is_locked_by_other_user(record)) {
                // Check if current user is an administrator
                const is_admin = await is_user_administrator();

                // Disable form fields, but preserve unlock button for admins
                await disable_form_fields(is_admin);
            }

            // Setup automatic unlock when user navigates away (only if current user has it locked)
            setup_auto_unlock(record);

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
            set_element_value('#exhibit-owner', record.owner);

            // Set checkboxes
            set_checkbox_state('#is-featured', record.is_featured === 1);
            set_checkbox_state('#is-student-curated', record.is_student_curated === 1);

            // Set content advisory
            if (record.alert_text) {
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

                    // Populate styles for each section
                    populate_style_fields('navigation', styles, style_selectors);
                    populate_style_fields('template', styles, style_selectors);
                    populate_style_fields('introduction', styles, style_selectors);

                } catch (parse_error) {
                    console.error('Error parsing styles JSON:', parse_error);
                    // Continue execution even if styles fail to parse
                }
            }

            return false;

        } catch (error) {
            // Log error for debugging
            console.error('Error displaying edit record:', error);

            // Display safe error message
            const error_message = error.message || 'An error occurred while loading the exhibit record';
            show_error(error_message);

            return false;
        }
    }

    obj.update_exhibit_record = async function () {

        // Cache DOM element and constants
        const message_el = document.querySelector('#message');
        const RELOAD_DELAY = 900;
        const TOKEN_ERROR_DELAY = 1000;
        const REQUEST_TIMEOUT = 30000; // 30 seconds

        // Helper function to safely display messages (prevents XSS)
        const show_message = (type, message, icon = 'fa-info') => {

            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${type}`;
            alert_div.setAttribute('role', 'alert');

            const icon_el = document.createElement('i');
            icon_el.className = `fa ${icon}`;

            const text_node = document.createTextNode(` ${message}`);

            alert_div.appendChild(icon_el);
            alert_div.appendChild(text_node);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {

            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Get and validate UUID
            const uuid = helperModule.get_parameter_by_name('exhibit_id');
            if (!uuid) {
                show_message('danger', 'Unable to get record UUID', 'fa-exclamation');
                return false;
            }

            // Validate token early
            const token = authModule.get_user_token();
            if (!token) {
                show_message('danger', 'Unable to get session token', 'fa-exclamation');

                timeout_id = setTimeout(() => {
                    authModule.logout();
                }, TOKEN_ERROR_DELAY);

                return false;
            }

            // Get and validate exhibit data
            const data = get_exhibit_data();

            if (!data) {
                show_message('danger', 'Unable to get exhibit data', 'fa-exclamation');
                return false;
            }

            // Show loading state
            show_message('info', 'Updating exhibit record...');

            // Add user metadata
            data.updated_by = helperModule.get_user_name();

            // Encode UUID for URL safety
            const encoded_uuid = encodeURIComponent(uuid);
            const update_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.put.endpoint.replace(':exhibit_id', encoded_uuid);

            // Make API request with timeout
            const response = await Promise.race([
                httpModule.req({
                    method: 'PUT',
                    url: update_url,
                    data: data,
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
            if (!response || response.status !== 201) {
                throw new Error('Failed to update exhibit record');
            }

            // Show success message
            show_message('success', 'Exhibit record updated');

            // Reload page after delay
            timeout_id = setTimeout(() => {
                window.location.reload();
            }, RELOAD_DELAY);

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
            show_message('danger', error_message, 'fa-exclamation');

            return false;
        }
    };

    async function delete_hero_image() {

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
            const endpoint_template = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media?.get?.endpoint;
            if (!endpoint_template) {
                throw new Error('Endpoint configuration not found');
            }

            // Build endpoint URL with proper encoding
            const encoded_uuid = encodeURIComponent(uuid);
            const encoded_media = encodeURIComponent(hero_image);

            const endpoint = endpoint_template
                .replace(':exhibit_id', encoded_uuid)
                .replace(':media', encoded_media);

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
            show_message(error_message, 'danger', 'fa-exclamation');

            return false;
        }
    }

    async function delete_thumbnail_image() {

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
            const endpoint_template = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media?.get?.endpoint;
            if (!endpoint_template) {
                throw new Error('Endpoint configuration not found');
            }

            // Build endpoint URL with proper encoding
            const encoded_uuid = encodeURIComponent(uuid);
            const encoded_media = encodeURIComponent(thumbnail_image);

            const endpoint = endpoint_template
                .replace(':exhibit_id', encoded_uuid)
                .replace(':media', encoded_media);

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
    }

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
        const add_listener = (selector, event, handler) => {
            const element = document.querySelector(selector);
            if (element && handler && typeof handler === 'function') {
                element.addEventListener(event, handler);
                return true;
            }
            console.warn(`Could not attach listener to: ${selector}`);
            return false;
        };

        // Helper function to setup image delete handler
        const setup_image_delete_handler = (image_selector, trash_selector, local_handler, module_handler) => {
            const image_el = document.querySelector(image_selector);
            const trash_el = document.querySelector(trash_selector);

            if (!image_el || !trash_el) {
                console.warn(`Image elements not found: ${image_selector} or ${trash_selector}`);
                return;
            }

            // Determine which handler to use based on whether image exists
            const has_image = image_el.value && image_el.value.trim().length > 0;
            const handler = has_image ? local_handler : module_handler;

            // Remove any existing listeners by cloning the element
            const new_trash_el = trash_el.cloneNode(true);
            trash_el.parentNode.replaceChild(new_trash_el, trash_el);

            // Add the appropriate event listener
            if (handler && typeof handler === 'function') {
                new_trash_el.addEventListener('click', handler);
            }
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

            // Initialize navigation
            navModule.back_to_exhibits();

            // Add save button listener
            add_listener('#save-exhibit-btn', 'click', exhibitsEditFormModule?.update_exhibit_record);

            // Load and display edit record
            await display_edit_record();

            // Setup image delete handlers after record is loaded
            setup_image_delete_handler(
                '#hero-image',
                '#hero-trash',
                delete_hero_image,
                exhibitsCommonFormModule?.delete_hero_image
            );

            setup_image_delete_handler(
                '#thumbnail-image',
                '#thumbnail-trash',
                delete_thumbnail_image,
                exhibitsCommonFormModule?.delete_thumbnail_image
            );

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
