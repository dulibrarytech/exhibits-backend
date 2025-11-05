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

const itemsAddVerticalTimelineFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_timeline_record = async function() {
        // CRITICAL: Check if we're in edit mode first
        const item_id = helperModule.get_parameter_by_name('item_id');
        if (item_id) {
            console.log('🔴 Item ID exists - already in edit mode, preventing duplicate creation');
            console.log('Current URL:', window.location.href);
            console.log('item_id:', item_id);

            // Call update instead if it exists
            if (obj.update_timeline_record && typeof obj.update_timeline_record === 'function') {
                console.log('Redirecting to update function...');
                return await obj.update_timeline_record();
            }

            const message_element = document.querySelector('#message');
            display_status_message(message_element, 'warning', 'Already in edit mode. Update function not available.');
            console.error('ERROR: update_timeline_record function not found!');
            return false;
        }

        console.log('🟢 CREATE FUNCTION CALLED - No item_id, proceeding with creation');

        // Prevent duplicate submissions
        if (this._is_creating_timeline) {
            console.log('Already creating, preventing duplicate submission');
            return false;
        }

        this._is_creating_timeline = true;

        try {
            // Cache DOM element
            const message_element = document.querySelector('#message');

            // Scroll to top for user feedback
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (!exhibit_id) {
                display_status_message(message_element, 'warning', 'Missing exhibit ID. Cannot create timeline record.');
                return false;
            }

            // Show loading state
            display_status_message(message_element, 'info', 'Creating timeline record...');

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_status_message(message_element, 'danger', 'Session expired. Please log in again.');

                setTimeout(() => {
                    authModule.logout();
                }, 1000);

                return false;
            }

            // Get and validate form data
            const form_data = itemsCommonVerticalTimelineFormModule.get_common_timeline_form_fields();

            if (!form_data || form_data === false) {
                display_status_message(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            const owner = helperModule.get_owner();

            if (user_name) {
                form_data.created_by = user_name;
            }

            if (owner) {
                form_data.owner = owner;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_records?.post?.endpoint) {
                display_status_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.timeline_records.post.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id));

            // Make API request
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: form_data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 201) {
                if (!response) {
                    display_status_message(message_element, 'danger', 'Permission denied. You do not have access to add items to this exhibit.');
                    return false;
                }
                throw new Error('Failed to create timeline record');
            }

            const new_timeline_id = response.data?.data;

            if (!new_timeline_id) {
                throw new Error('Server did not return a valid timeline ID');
            }

            console.log('✅ Timeline record created successfully, ID:', new_timeline_id);

            // Show success message
            display_status_message(message_element, 'success', 'Timeline record created successfully. Redirecting to edit page...');

            // Scroll to top to show success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Gracefully redirect to edit page after showing success message
            setTimeout(() => {
                redirect_to_timeline_edit_page(exhibit_id, new_timeline_id);
            }, 1200);

            return true;

        } catch (error) {
            console.error('❌ Error creating timeline record:', error);

            const message_element = document.querySelector('#message');
            const error_message = error.user_message || error.message || 'Unable to create timeline record. Please try again.';
            display_status_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_creating_timeline = false;
        }
    };

    /**
     * Gracefully redirect to timeline edit page (prevents back button to create page)
     */
    function redirect_to_timeline_edit_page(exhibit_id, timeline_id) {
        console.log('=== REDIRECTING TO TIMELINE EDIT PAGE ===');
        console.log('exhibit_id:', exhibit_id);
        console.log('timeline_id:', timeline_id);

        const params = new URLSearchParams({
            exhibit_id: exhibit_id,
            item_id: timeline_id
        });

        const edit_url = `${APP_PATH}/items/vertical-timeline/edit?${params.toString()}`;

        console.log('Redirecting to:', edit_url);
        console.log('Note: Back button will NOT return to create page');

        // Use window.location.replace() to prevent back button to create page
        // This replaces the current history entry instead of adding a new one
        window.location.replace(edit_url);
    }

    /**
     * Display status message to user (XSS-safe)
     */
    function display_status_message(element, type, message) {
        if (!element) {
            return;
        }

        // Validate message type
        const valid_types = ['info', 'success', 'danger', 'warning'];
        const alert_type = valid_types.includes(type) ? type : 'info';

        // Create alert container
        const alert_div = document.createElement('div');
        alert_div.className = `alert alert-${alert_type}`;
        alert_div.setAttribute('role', 'alert');

        // Add icon based on type
        const icon = document.createElement('i');
        icon.className = get_icon_class(alert_type);
        alert_div.appendChild(icon);

        // Add message text
        const text_node = document.createTextNode(` ${message}`);
        alert_div.appendChild(text_node);

        // Clear and set new content
        element.textContent = '';
        element.appendChild(alert_div);
    }

    /**
     * Get appropriate icon class for alert type
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

    obj.create_timeline_record__ = async function() {

        // Prevent duplicate submissions
        if (this._is_creating_timeline) {
            return false;
        }

        this._is_creating_timeline = true;

        // Cache DOM element and constants
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
         * Transition from create mode to edit mode without page reload
         */
        const transition_to_edit_mode = async (exhibit_id, timeline_id) => {
            try {
                // Update URL without reload using History API
                update_url_to_edit_mode(exhibit_id, timeline_id);

                // Update page title
                update_page_title('Edit Timeline');

                // Load the newly created timeline record data
                await load_edit_record_data();

                // Update form behavior from create to edit
                update_form_mode_to_edit();

                // Update any UI elements that differ between create/edit
                update_ui_for_edit_mode();

            } catch (error) {
                console.error('Error transitioning to edit mode:', error);
                // Fallback: redirect to edit page
                fallback_redirect_to_edit(exhibit_id, timeline_id);
            }
        };

        /**
         * Update URL to edit mode using History API
         */
        const update_url_to_edit_mode = (exhibit_id, timeline_id) => {
            if (!window.history?.pushState) {
                return;
            }

            const params = new URLSearchParams({
                exhibit_id: exhibit_id,
                item_id: timeline_id
            });

            const new_url = `${APP_PATH}/items/vertical-timeline/edit?${params.toString()}`;

            // Update URL in browser without reload
            window.history.pushState(
                { mode: 'edit', exhibit_id, item_id: timeline_id, type: 'timeline' },
                '',
                new_url
            );
        };

        /**
         * Update page title
         */
        const update_page_title = (title) => {
            if (document.title) {
                document.title = title;
            }

            // Update heading if exists
            const page_heading = document.querySelector('h1, .page-title');
            if (page_heading) {
                page_heading.textContent = title;
            }
        };

        /**
         * Load the edit record data
         */
        const load_edit_record_data = async () => {
            // Call the display_edit_record function if it exists
            if (typeof display_edit_record === 'function') {
                await display_edit_record();
            }
        };

        /**
         * Update form behavior from create to edit
         */
        const update_form_mode_to_edit = () => {
            const form = document.querySelector('form#timeline-form, form');
            if (!form) {
                return;
            }

            // Update form submit handler to use update instead of create
            form.onsubmit = async function(event) {
                event.preventDefault();

                // Call update function instead of create
                if (obj.update_timeline_record && typeof obj.update_timeline_record === 'function') {
                    return await obj.update_timeline_record();
                }

                return false;
            };

            // Update any hidden form fields
            const mode_input = form.querySelector('input[name="mode"]');
            if (mode_input) {
                mode_input.value = 'edit';
            }
        };

        /**
         * Update UI elements for edit mode
         */
        const update_ui_for_edit_mode = () => {
            // Update submit button text
            const submit_button = document.querySelector('button[type="submit"], #submit-button, #timeline-submit-button');
            if (submit_button) {
                const button_text = submit_button.querySelector('.button-text');
                if (button_text) {
                    button_text.textContent = 'Update Timeline';
                } else {
                    // Extract text without icons
                    const icon = submit_button.querySelector('i');
                    if (icon) {
                        submit_button.childNodes.forEach(node => {
                            if (node.nodeType === Node.TEXT_NODE) {
                                node.textContent = ' Update Timeline';
                            }
                        });
                    } else {
                        submit_button.textContent = 'Update Timeline';
                    }
                }
            }

            // Show edit-only elements
            const edit_only_elements = document.querySelectorAll('.edit-only, [data-mode="edit"]');
            edit_only_elements.forEach(element => {
                element.style.display = '';
                element.classList.remove('hidden');
            });

            // Hide create-only elements
            const create_only_elements = document.querySelectorAll('.create-only, [data-mode="create"]');
            create_only_elements.forEach(element => {
                element.style.display = 'none';
                element.classList.add('hidden');
            });

            // Show metadata section
            const created_metadata = document.querySelector('#created, .metadata-section');
            if (created_metadata) {
                created_metadata.style.display = 'block';
                created_metadata.classList.remove('hidden');
            }

            // Show timeline events section if it exists
            const timeline_events_section = document.querySelector('#timeline-events, .timeline-events-section');
            if (timeline_events_section) {
                timeline_events_section.style.display = 'block';
                timeline_events_section.classList.remove('hidden');
            }
        };

        /**
         * Fallback redirect if transition fails
         */
        const fallback_redirect_to_edit = (exhibit_id, timeline_id) => {
            const params = new URLSearchParams({
                exhibit_id: exhibit_id,
                item_id: timeline_id
            });

            const edit_url = `${APP_PATH}/items/vertical-timeline/edit?${params.toString()}`;
            window.location.replace(edit_url);
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Scroll to top for user feedback
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (!exhibit_id) {
                display_message(message_element, 'warning', 'Missing exhibit ID. Cannot create timeline record.');
                return false;
            }

            // Show loading state
            display_message(message_element, 'info', 'Creating timeline record...');

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Session expired. Please log in again.');

                timeout_id = setTimeout(() => {
                    authModule.logout();
                }, 1000);

                return false;
            }

            // Get and validate form data
            const form_data = itemsCommonVerticalTimelineFormModule.get_common_timeline_form_fields();

            if (!form_data || form_data === false) {
                display_message(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            const owner = helperModule.get_owner();

            if (user_name) {
                form_data.created_by = user_name;
            }

            if (owner) {
                form_data.owner = owner;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_records?.post?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.timeline_records.post.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id));

            // Make API request
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: form_data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 201) {
                if (!response) {
                    display_message(message_element, 'danger', 'Permission denied. You do not have access to add items to this exhibit.');
                    return false;
                }
                throw new Error('Failed to create timeline record');
            }

            const new_timeline_id = response.data?.data;

            if (!new_timeline_id) {
                throw new Error('Server did not return a valid timeline ID');
            }

            // Scroll to top for success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Show success message
            display_message(message_element, 'success', 'Timeline record created successfully');

            // Log timeline ID for debugging
            console.log('Created timeline ID:', new_timeline_id);

            // Transition to edit mode without page reload
            await transition_to_edit_mode(exhibit_id, new_timeline_id);

            // Auto-dismiss success message after a delay
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
            console.error('Error creating timeline record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || error.message || 'Unable to create timeline record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_creating_timeline = false;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const redirect = '/items?exhibit_id=' + exhibit_id + '&status=403';
            await authModule.check_permissions(['add_item', 'add_item_to_any_exhibit'], 'timeline', exhibit_id, null, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            document.querySelector('#save-timeline-btn').addEventListener('click', itemsAddVerticalTimelineFormModule.create_timeline_record);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
