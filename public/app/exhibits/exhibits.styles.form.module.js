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

const exhibitsStylesFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    const REQUEST_TIMEOUT = 30000;
    const MESSAGE_CLEAR_DELAY = 3000;
    const TOKEN_ERROR_DELAY = 1000;

    let obj = {};

    /**
     * Cached exhibit record loaded on init.
     * Used to reconstruct the full PUT payload on save so that
     * the model-layer schema validation passes even though
     * the styles page DOM only contains style fields.
     * @type {Object|null}
     */
    let cached_record = null;

    // ==================== PRIVATE HELPERS ====================

    /**
     * Safely displays a message in the #message container (prevents XSS)
     * @param {string} message - Message text
     * @param {string} [type='danger'] - Bootstrap alert type
     * @param {string} [icon='fa-exclamation'] - Font Awesome icon class
     */
    const show_message = function (message, type, icon) {
        type = type || 'danger';
        icon = icon || 'fa-exclamation';

        const message_el = document.querySelector('#message');

        if (!message_el) {
            console.error('Message element not found');
            return;
        }

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-' + type;
        alert_div.setAttribute('role', 'alert');

        const icon_el = document.createElement('i');
        icon_el.className = 'fa ' + icon;

        const text = document.createTextNode(' ' + message);

        alert_div.appendChild(icon_el);
        alert_div.appendChild(text);

        message_el.innerHTML = '';
        message_el.appendChild(alert_div);
    };

    /**
     * Clears the #message container after a delay
     * @param {number} [delay] - Delay in ms (defaults to MESSAGE_CLEAR_DELAY)
     * @returns {number} Timeout ID
     */
    const clear_message_after_delay = function (delay) {
        delay = delay || MESSAGE_CLEAR_DELAY;

        return setTimeout(function () {
            const message_el = document.querySelector('#message');

            if (message_el) {
                message_el.innerHTML = '';
            }
        }, delay);
    };

    /**
     * Builds a URLSearchParams query string from a plain object
     * @param {Object} params - Key/value pairs
     * @returns {string} Encoded query string
     */
    const build_query_string = function (params) {
        const query_params = new URLSearchParams();

        for (const key in params) {
            if (params.hasOwnProperty(key) && params[key] != null) {
                query_params.append(key, params[key]);
            }
        }

        return query_params.toString();
    };

    /**
     * Safely sets the text content of an element
     * @param {string} selector - CSS selector
     * @param {string} text - Text to set
     */
    const set_text_content = function (selector, text) {
        const el = document.querySelector(selector);

        if (el) {
            el.textContent = text || '';
        }
    };

    /**
     * Adds a click event listener to an element, with null-safety
     * @param {string} selector - CSS selector
     * @param {Function} handler - Click handler
     */
    const add_click_listener = function (selector, handler) {
        const el = document.querySelector(selector);

        if (el && typeof handler === 'function') {
            el.addEventListener('click', handler);
        } else if (!el) {
            console.warn('Element not found for click listener: ' + selector);
        }
    };

    // ==================== RECORD FETCH ====================

    /**
     * Fetches the exhibit record from the API (type=edit to acquire lock)
     * @returns {Promise<Object|null>} The exhibit record, or null on failure
     */
    async function fetch_exhibit_record() {

        try {

            // Validate endpoints
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                console.error('EXHIBITS_ENDPOINTS is not available');
                show_message('Configuration error: API endpoints not available');
                helperModule.redirect_to_auth();
                return null;
            }

            // Get exhibit_id from URL
            const uuid = helperModule.get_parameter_by_name('exhibit_id');

            if (!uuid) {
                show_message('Missing required parameter: exhibit_id');
                return null;
            }

            // Validate auth
            const token = authModule.get_user_token();

            if (!token) {
                console.error('Authentication token not available');
                show_message('Authentication error: Please log in again', 'warning', 'fa-lock');
                helperModule.redirect_to_auth();
                return null;
            }

            // Get user profile for uid (needed for ?type=edit lock)
            const profile = authModule.get_user_profile_data();

            if (!profile || !profile.uid) {
                console.error('User profile not available');
                show_message('User profile error: Please log in again', 'warning', 'fa-user');
                helperModule.redirect_to_auth();
                return null;
            }

            // Resolve endpoint
            const endpoint_config = EXHIBITS_ENDPOINTS.exhibits?.exhibit_records?.endpoints?.get?.endpoint;

            if (!endpoint_config) {
                throw new Error('Endpoint configuration not found');
            }

            const encoded_uuid = encodeURIComponent(uuid);
            const endpoint_base = endpoint_config.replace(':exhibit_id', encoded_uuid);
            const query_string = build_query_string({
                type: 'edit',
                uid: profile.uid
            });
            const endpoint = endpoint_base + '?' + query_string;

            // Fetch with timeout
            const response = await Promise.race([
                httpModule.req({
                    method: 'GET',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                }),
                new Promise(function (_, reject) {
                    setTimeout(function () {
                        reject(new Error('Request timeout'));
                    }, REQUEST_TIMEOUT);
                })
            ]);

            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 200) {
                throw new Error('Server returned status ' + response.status);
            }

            if (!response.data || !response.data.data) {
                throw new Error('Invalid response structure from server');
            }

            if (response.data.data.length === 0) {
                throw new Error('Exhibit record not found');
            }

            return response.data.data;

        } catch (error) {
            console.error('Error fetching exhibit record:', error);
            show_message(error.message || 'An unexpected error occurred while loading the exhibit record');
            return null;
        }
    }

    // ==================== DISPLAY ====================

    /**
     * Loads the exhibit record into the styles form fields.
     * Handles record locking, title display, and styles population.
     * @returns {Promise<boolean>} True if display succeeded
     */
    async function display_styles_record() {

        /**
         * Checks whether the record is locked by a different user
         * @param {Object} record - Exhibit record
         * @returns {boolean}
         */
        const is_locked_by_other_user = function (record) {

            if (!record || record.is_locked !== 1) {
                return false;
            }

            const profile = authModule.get_user_profile_data();

            if (!profile || !profile.uid) {
                return false;
            }

            const user_id = parseInt(profile.uid, 10);
            const locked_by_user = parseInt(record.locked_by_user, 10);

            if (isNaN(user_id) || isNaN(locked_by_user)) {
                return false;
            }

            return user_id !== locked_by_user;
        };

        /**
         * Disables all interactive form elements when the record is locked
         * @param {boolean} is_admin - Whether the current user is an administrator
         */
        const disable_form_fields = function (is_admin) {
            const form_elements = document.querySelectorAll(
                'input:not([type="hidden"]), textarea, select, button[type="button"]'
            );

            form_elements.forEach(function (element) {

                if (is_admin && element.id === 'unlock-record') {
                    return;
                }

                if (!element.disabled && !element.readOnly) {
                    element.disabled = true;
                    element.style.cursor = 'not-allowed';
                    element.style.opacity = '0.6';
                }
            });

            const custom_buttons = document.querySelectorAll('.btn:not([disabled])');

            custom_buttons.forEach(function (button) {

                if (is_admin && button.id === 'unlock-record') {
                    return;
                }

                button.disabled = true;
                button.style.cursor = 'not-allowed';
                button.style.opacity = '0.6';
            });
        };

        /**
         * Checks if the current user has the Administrator role
         * @returns {Promise<boolean>}
         */
        const is_user_administrator = async function () {

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

        try {

            const record = await fetch_exhibit_record();

            if (!record) {
                throw new Error('Failed to retrieve exhibit record');
            }

            // Cache the full record for building the PUT payload later
            cached_record = record;

            // Record locking
            await lockModule.check_if_locked(record, '#exhibit-submit-card');

            if (is_locked_by_other_user(record)) {
                const is_admin = await is_user_administrator();
                disable_form_fields(is_admin);
            }

            lockModule.setup_auto_unlock(record);

            // Set exhibit title in the page header. Strip HTML before
            // textContent render so rich-text markup (e.g. <b>…</b>) saved
            // on the record does not show as literal tags.
            set_text_content('#exhibit-title', helperModule.strip_html(helperModule.unescape(record.title || '')));

            // Populate style fields from the record
            if (record.styles) {

                try {
                    const styles = typeof record.styles === 'string'
                        ? JSON.parse(record.styles)
                        : record.styles;

                    exhibitsStylesModule.set_styles(styles);
                } catch (parse_error) {
                    console.error('Error parsing styles JSON:', parse_error);
                }
            }

            // Initialize color picker sync after fields are populated
            exhibitsStylesModule.init();

            return true;

        } catch (error) {
            console.error('Error displaying styles record:', error);
            show_message(error.message || 'An error occurred while loading styles');
            return false;
        }
    }

    // ==================== UPDATE ====================

    /**
     * Validates styles, rebuilds the full exhibit payload from the
     * cached record (replacing only the styles blob), and PUTs to
     * the existing exhibit update endpoint.
     * @returns {Promise<boolean>} True if update succeeded
     */
    obj.update_styles = async function () {

        let timeout_id = null;

        try {

            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Validate exhibit_id
            const uuid = helperModule.get_parameter_by_name('exhibit_id');

            if (!uuid) {
                show_message('Unable to get record UUID');
                return false;
            }

            // Validate auth token
            const token = authModule.get_user_token();

            if (!token) {
                show_message('Unable to get session token');

                timeout_id = setTimeout(function () {
                    authModule.logout();
                }, TOKEN_ERROR_DELAY);

                return false;
            }

            // Validate cached record is available
            if (!cached_record) {
                show_message('Exhibit record not loaded. Please reload the page.');
                return false;
            }

            // Run required-styles validation (highlights empty fields, expands accordion)
            const validation = exhibitsStylesModule.validate_required();

            if (!validation.valid) {
                show_message('Please complete all required style fields', 'warning', 'fa-exclamation');
                return false;
            }

            // Gather styles from the DOM
            const styles = exhibitsStylesModule.get_styles();

            if (!styles) {
                show_message('Unable to gather style values');
                return false;
            }

            // Build full payload from the cached record so the model-layer
            // schema validation passes (it may require fields like title).
            const data = {
                title: cached_record.title || '',
                subtitle: cached_record.subtitle || '',
                description: cached_record.description || '',
                about_the_curators: cached_record.about_the_curators || '',
                alert_text: cached_record.alert_text || '',
                hero_image: cached_record.hero_image || '',
                thumbnail: cached_record.thumbnail || '',
                banner_template: cached_record.banner_template || '',
                page_layout: cached_record.page_layout || 'top_nav',
                exhibit_template: cached_record.exhibit_template || 'vertical_scroll',
                is_featured: cached_record.is_featured || 0,
                is_student_curated: cached_record.is_student_curated || 0,
                is_published: cached_record.is_published || 0,
                styles: styles,
                updated_by: helperModule.get_user_name()
            };

            // Include owner if present
            if (cached_record.owner != null) {
                data.owner = cached_record.owner;
            }

            // Show loading state
            show_message('Updating exhibit styles...', 'info', 'fa-info');

            // PUT to the existing exhibit update endpoint
            const encoded_uuid = encodeURIComponent(uuid);
            const update_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.put.endpoint
                .replace(':exhibit_id', encoded_uuid);

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
                new Promise(function (_, reject) {
                    setTimeout(function () {
                        reject(new Error('Request timeout'));
                    }, REQUEST_TIMEOUT);
                })
            ]);

            if (!response || response.status !== 201) {
                throw new Error('Failed to update exhibit styles');
            }

            // Success
            show_message('Exhibit styles updated successfully', 'success', 'fa-check');

            // Re-fetch to refresh cache and confirm round-trip
            try {
                await display_styles_record();
                console.debug('Styles form re-rendered with updated data');
            } catch (render_error) {
                console.error('Error re-rendering styles form:', render_error);
                show_message('Styles updated, but form refresh failed. Please reload the page.', 'warning', 'fa-exclamation');
            }

            timeout_id = clear_message_after_delay();
            return true;

        } catch (error) {

            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            console.error('Update styles error:', error);
            show_message(error.message || 'An unexpected error occurred while updating styles');
            return false;
        }
    };

    // ==================== INIT ====================

    /**
     * Initializes the standalone styles form page:
     * - Checks authentication and permissions
     * - Loads and displays the exhibit record's styles
     * - Wires Save and Cancel button handlers
     * - Sets up the side-nav Exhibit Items link
     *
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    obj.init = async function () {

        /**
         * Builds a redirect URL for the 403 fallback
         * @param {string} exhibit_id
         * @returns {string}
         */
        const build_redirect_url = function (exhibit_id) {
            const params = new URLSearchParams({
                exhibit_id: exhibit_id,
                status: '403'
            });
            return '/exhibits/exhibit/details?' + params.toString();
        };

        try {

            // Validate endpoints
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                throw new Error('API endpoints configuration not available');
            }

            // Check authentication
            const token = authModule.get_user_token();

            if (!token) {
                throw new Error('Authentication token not available');
            }

            await authModule.check_auth(token);

            // Get exhibit_id
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (!exhibit_id) {
                throw new Error('Missing required parameter: exhibit_id');
            }

            // Check permissions
            const redirect_url = build_redirect_url(exhibit_id);

            await authModule.check_permissions(
                ['update_exhibit', 'update_any_exhibit'],
                'exhibit',
                exhibit_id,
                null,
                redirect_url
            );

            // Initialize navigation (preview link + logout handler)
            if (navModule && typeof navModule.init === 'function') {
                navModule.init();
            }

            // Note: #item-list and #edit-exhibit hrefs are now wired by
            // navModule.wire_nav_links() via data-nav-path attributes
            // set in the unified nav partial (see NAV_CONFIGS.styles_form).

            // Show form
            if (helperModule && typeof helperModule.show_form === 'function') {
                helperModule.show_form();
            }

            // Wire Save button
            add_click_listener('#save-exhibit-btn', obj.update_styles);

            // Wire Cancel button — navigate to exhibit details page
            add_click_listener('#cancel-exhibit-btn', function () {
                const url = APP_PATH + '/exhibits/exhibit/details?exhibit_id=' + encodeURIComponent(exhibit_id);
                window.location.href = url;
            });

            // Load and display styles
            await display_styles_record();

            console.debug('Styles form module initialized successfully');
            return true;

        } catch (error) {
            console.error('Error initializing styles form module:', error);
            show_message(error.message || 'An error occurred during initialization');
            return false;
        }
    };

    return obj;

}());
