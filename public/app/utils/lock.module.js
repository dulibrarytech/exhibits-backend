/**

 Copyright 2023 University of Denver

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

const lockModule = (function () {

    'use strict';

    let obj = {};

    obj.check_if_locked = async function (record, card_id) {

        // Helper function to safely display messages (prevents XSS)
        const show_message = (type, message_content, additional_element = null) => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-lock';

            const text = document.createTextNode(` ${message_content}`);

            alert_div.appendChild(icon);
            alert_div.appendChild(text);

            // Add additional element if provided (like unlock button)
            if (additional_element) {
                alert_div.appendChild(document.createTextNode('  '));
                alert_div.appendChild(additional_element);
            }

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        // Helper function to create unlock button
        const create_unlock_button = () => {

            const btn_group = document.createElement('div');
            btn_group.className = 'btn-group float-right';

            const button = document.createElement('button');
            button.id = 'unlock-record';
            button.className = 'btn btn-xs btn-secondary';

            const icon = document.createElement('i');
            icon.className = 'fa fa-unlock-alt';

            const text = document.createTextNode(' Unlock');

            button.appendChild(icon);
            button.appendChild(text);

            // Add event listener
            button.addEventListener('click', handle_unlock_click);

            btn_group.appendChild(button);

            const span = document.createElement('span');
            const br = document.createElement('br');
            span.appendChild(br);
            span.appendChild(btn_group);

            return span;
        };

        // Event handler for unlock button
        const handle_unlock_click = () => {
            if (typeof obj.unlock_record === 'function') {

                obj.unlock_record(false, {
                    force: true
                });

            } else {
                console.error('unlock_record function not available');
            }
        };

        // Helper function to hide card
        const hide_card = (selector) => {
            const card = document.querySelector(selector);
            if (card) {
                card.style.display = 'none';
            }
        };

        // Helper function to display error safely
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

        try {
            // Validate inputs
            if (!record || typeof record !== 'object') {
                console.error('Invalid record provided to check_if_locked');
                return;
            }

            if (!card_id || typeof card_id !== 'string') {
                console.error('Invalid card_id provided to check_if_locked');
                return;
            }

            // Get user profile
            const profile = authModule.get_user_profile_data();
            if (!profile || !profile.uid) {
                console.error('Unable to get user profile data');
                return;
            }

            // Parse user ID safely
            const user_id = parseInt(profile.uid, 10);
            if (isNaN(user_id)) {
                console.error('Invalid user ID in profile');
                return;
            }

            // Check if record is locked by another user
            const is_locked = record.is_locked === 1 || record.is_locked === true;
            const locked_by_other_user = record.locked_by_user && parseInt(record.locked_by_user, 10) !== user_id;

            if (is_locked && locked_by_other_user) {
                // Hide the card
                hide_card(card_id);

                // Check if message element exists
                const message_el = document.querySelector('#message');
                if (!message_el) {
                    console.warn('Message element not found, cannot display lock warning');
                    return;
                }

                // Get user role to determine if unlock button should be shown
                const user_role = await authModule.get_user_role(user_id);

                // Create unlock button for administrators
                let unlock_button = null;
                if (user_role === 'Administrator') {
                    unlock_button = create_unlock_button();
                }

                // Display lock message
                const lock_message = 'This record is currently being worked on by another user.';
                show_message('warning', lock_message, unlock_button);
            }

        } catch (error) {
            console.error('Error checking if record is locked:', error);

            const error_message = error.message || 'An error occurred while checking record lock status';
            show_error(error_message);
        }
    };

    obj.unlock_record = async function (use_beacon_only = false, options = {}) {

        const { force = false } = options;

        const REQUEST_TIMEOUT = 30000; // 30 seconds

        // Path to endpoint configuration map
        const endpoint_config_map = [
            {
                paths: ['exhibits/exhibit/edit', 'styles'],
                endpoint_key: 'exhibits.exhibit_unlock_record.post.endpoint',
                params: (exhibit_id) => ({exhibit_id})
            },
            {
                paths: ['items/heading/edit'],
                endpoint_key: 'exhibits.heading_unlock_record.post.endpoint',
                params: (exhibit_id) => ({
                    exhibit_id,
                    heading_id: helperModule.get_parameter_by_name('item_id')
                })
            },
            {
                paths: ['items/standard/text/edit', 'items/standard/media/edit'],
                endpoint_key: 'exhibits.item_unlock_record.post.endpoint',
                params: (exhibit_id) => ({
                    exhibit_id,
                    item_id: helperModule.get_parameter_by_name('item_id')
                })
            },
            {
                paths: ['items/grid/item/media/edit', 'items/grid/item/text/edit'],
                endpoint_key: 'exhibits.grid_item_unlock_record.post.endpoint',
                params: (exhibit_id) => ({
                    exhibit_id,
                    grid_id: helperModule.get_parameter_by_name('grid_id'),
                    item_id: helperModule.get_parameter_by_name('item_id')
                })
            },
            {
                paths: ['items/vertical-timeline/item/media/edit', 'items/vertical-timeline/item/text/edit'],
                endpoint_key: 'exhibits.timeline_item_unlock_record.post.endpoint',
                params: (exhibit_id) => ({
                    exhibit_id,
                    timeline_id: helperModule.get_parameter_by_name('timeline_id'),
                    item_id: helperModule.get_parameter_by_name('item_id')
                })
            }
        ];

        // Helper function to safely get nested object value by dot notation
        const get_nested_value = (obj, path) => {
            if (!obj || !path) return null;

            const keys = path.split('.');
            let result = obj;

            for (const key of keys) {
                if (result && typeof result === 'object' && key in result) {
                    result = result[key];
                } else {
                    return null;
                }
            }

            return result;
        };

        // Helper function to safely display messages
        const show_message = (message, type = 'info', icon = 'fa-info') => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${type}`;
            alert_div.setAttribute('role', 'alert');

            if (icon) {
                const icon_el = document.createElement('i');
                icon_el.className = `fa ${icon}`;
                alert_div.appendChild(icon_el);
                alert_div.appendChild(document.createTextNode(' '));
            }

            const text_node = document.createTextNode(message);
            alert_div.appendChild(text_node);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        // Helper function to build endpoint URL with parameter replacement
        const build_endpoint_url = (template, params) => {
            if (!template || !params) return null;

            let endpoint = template;

            for (const [key, value] of Object.entries(params)) {
                if (!value) {
                    console.error(`Missing required parameter: ${key}`);
                    return null;
                }
                const encoded_value = encodeURIComponent(value);
                endpoint = endpoint.replace(`:${key}`, encoded_value);
            }

            return endpoint;
        };

        // Helper function to find matching endpoint configuration
        const find_endpoint_config = (pathname, config_map) => {
            for (const config of config_map) {
                const path_matches = config.paths.some(path => pathname.includes(path));
                if (path_matches) {
                    return config;
                }
            }
            return null;
        };

        try {
            const exhibits_endpoints = endpointsModule.get_exhibits_endpoints();
            if (!exhibits_endpoints) {
                throw new Error('Unable to retrieve endpoints configuration');
            }

            const pathname = window.location.pathname;
            if (!pathname) {
                throw new Error('Unable to determine current page path');
            }

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            if (!exhibit_id) {
                throw new Error('Missing required parameter: exhibit_id');
            }

            const config = find_endpoint_config(pathname, endpoint_config_map);
            if (!config) {
                console.error('No matching endpoint found for current path:', pathname);
                if (!use_beacon_only) {
                    show_message('Unable to determine record type.', 'danger', 'fa-exclamation');
                }
                return false;
            }

            const endpoint_template = get_nested_value(exhibits_endpoints, config.endpoint_key);
            if (!endpoint_template) {
                throw new Error('Endpoint template not found in configuration');
            }

            const endpoint_params = typeof config.params === 'function'
                ? config.params(exhibit_id)
                : config.params;

            for (const [key, value] of Object.entries(endpoint_params)) {
                if (!value) {
                    throw new Error(`Missing required parameter: ${key}`);
                }
            }

            const endpoint = build_endpoint_url(endpoint_template, endpoint_params);
            if (!endpoint) {
                throw new Error('Failed to build endpoint URL');
            }

            const profile = authModule.get_user_profile_data();
            const token = authModule.get_user_token();

            if (!profile || !profile.uid) {
                throw new Error('User profile data not available');
            }

            if (!token) {
                throw new Error('Authentication token not available');
            }

            const query_params = new URLSearchParams({
                uid: profile.uid
            });

            // If beacon-only mode (page unload scenario)
            if (use_beacon_only) {
                if (navigator.sendBeacon) {
                    query_params.append('t', token);
                    const beacon_url = `${endpoint}?${query_params.toString()}`;

                    const sent = navigator.sendBeacon(beacon_url, '');

                    if (sent) {
                        console.debug('Unlock beacon sent successfully');
                        return true;
                    } else {
                        console.warn('Beacon API failed to send unlock request');
                        return false;
                    }
                } else {
                    console.warn('Beacon API not available');
                    return false;
                }
            }

            // Regular mode (manual unlock via button click)
            let request_url = `${endpoint}?${query_params.toString()}`;

            if (options.force === true) {
                request_url = `${request_url}&force=${options.force}`;
            }

            const response = await Promise.race([
                httpModule.req({
                    method: 'POST',
                    url: request_url,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
                )
            ]);

            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status === 200) {
                show_message('Record unlocked successfully', 'success', 'fa-check');
                return true;
            } else {
                show_message('Failed to unlock record. Please try again.', 'danger', 'fa-exclamation');
                return false;
            }

        } catch (error) {
            console.error('Error unlocking record:', error);

            if (!use_beacon_only) {
                const error_message = error.message || 'An unexpected error occurred while unlocking the record';
                show_message(error_message, 'danger', 'fa-exclamation');
            }

            return false;
        }
    };

    // Setup automatic unlock on page unload
    obj.setup_auto_unlock = function (record) {

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

        let unlock_attempted = false;

        // Handler for visibility change (MOST RELIABLE - fires before page unload)
        const handle_visibility_change = () => {
            if (document.hidden && !unlock_attempted) {
                unlock_attempted = true;
                console.debug('Attempting unlock via beacon');

                obj.unlock_record(true).catch(error => {
                    console.error('Visibility unlock failed:', error);
                });
            }
        };

        // Handler for page hide (reliable for mobile browsers)
        const handle_page_hide = () => {
            if (!unlock_attempted) {
                unlock_attempted = true;
                console.debug('Page hiding - attempting unlock via beacon');

                obj.unlock_record(true).catch(error => {
                    console.error('Page hide unlock failed:', error);
                });
            }
        };

        // Handler for beforeunload (last resort for older browsers)
        const handle_before_unload = () => {
            if (!unlock_attempted) {
                unlock_attempted = true;
                console.debug('Page unloading - attempting unlock via beacon');

                obj.unlock_record(true).catch(error => {
                    console.error('Before unload unlock failed:', error);
                });
            }
        };

        // Priority order: visibilitychange → pagehide → beforeunload
        document.addEventListener('visibilitychange', handle_visibility_change);
        window.addEventListener('pagehide', handle_page_hide);
        window.addEventListener('beforeunload', handle_before_unload);

        console.debug('Auto-unlock setup complete for record (using beacon on visibility/page events)');
    };

    return obj;

}());
