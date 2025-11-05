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

const itemsAddHeadingFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_heading_record = async function() {
        // CRITICAL: Check if we're in edit mode first
        const item_id = helperModule.get_parameter_by_name('item_id');
        if (item_id) {
            console.log('🔴 Item ID exists - already in edit mode, preventing duplicate creation');
            console.log('Current URL:', window.location.href);
            console.log('item_id:', item_id);

            // Call update instead if it exists
            if (obj.update_item_heading_record && typeof obj.update_item_heading_record === 'function') {
                console.log('Redirecting to update function...');
                return await obj.update_item_heading_record();
            }

            const message_element = document.querySelector('#message');
            display_status_message(message_element, 'warning', 'Already in edit mode. Update function not available.');
            console.error('ERROR: update_item_heading_record function not found!');
            return false;
        }

        console.log('🟢 CREATE FUNCTION CALLED - No item_id, proceeding with creation');

        // Prevent duplicate submissions
        if (this._is_creating) {
            console.log('Already creating, preventing duplicate submission');
            return false;
        }

        this._is_creating = true;

        try {
            // Cache DOM element
            const message_element = document.querySelector('#message');

            // Scroll to top for user feedback
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (!exhibit_id) {
                display_status_message(message_element, 'warning', 'Missing exhibit ID. Cannot create heading record.');
                return false;
            }

            // Show loading state
            display_status_message(message_element, 'info', 'Creating item heading record...');

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
            const form_data = itemsCommonHeadingFormModule.get_common_heading_form_fields();

            if (!form_data || form_data === false) {
                display_status_message(message_element, 'danger', 'Invalid form data. Please check all required fields.');
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

            // Construct endpoint with URL encoding
            const endpoint = construct_create_endpoint(exhibit_id);

            // Make API request
            const response = await make_create_request(endpoint, form_data, token);

            // Handle successful response
            if (response && response.status === 201) {
                const new_item_id = response.data?.data;

                if (!new_item_id) {
                    throw new Error('Server did not return a valid item ID');
                }

                console.log('✅ Heading record created successfully, ID:', new_item_id);

                // Show success message
                display_status_message(message_element, 'success', 'Heading record created successfully. Redirecting to edit page...');

                // Scroll to top to show success message
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Gracefully redirect to edit page after showing success message
                setTimeout(() => {
                    redirect_to_edit_page(exhibit_id, new_item_id);
                }, 1200);

                return true;

            } else if (!response) {
                display_status_message(message_element, 'danger', 'Permission denied. You do not have access to add items to this exhibit.');
                return false;
            } else {
                throw new Error('Unexpected response from server');
            }

        } catch (error) {
            console.error('❌ Error creating heading record:', error);

            const message_element = document.querySelector('#message');
            const error_message = get_user_friendly_error_message(error);
            display_status_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_creating = false;
        }
    };

    /**
     * Gracefully redirect to edit page (prevents back button to create page)
     */
    function redirect_to_edit_page(exhibit_id, item_id) {
        console.log('=== REDIRECTING TO EDIT PAGE ===');
        console.log('exhibit_id:', exhibit_id);
        console.log('item_id:', item_id);

        const params = new URLSearchParams({
            exhibit_id: exhibit_id,
            item_id: item_id
        });

        const edit_url = `${APP_PATH}/items/heading/edit?${params.toString()}`;

        console.log('Redirecting to:', edit_url);
        console.log('Note: Back button will NOT return to create page');

        // Use window.location.replace() to prevent back button to create page
        // This replaces the current history entry instead of adding a new one
        window.location.replace(edit_url);
    }

    /**
     * Construct create endpoint with URL encoding
     */
    function construct_create_endpoint(exhibit_id) {
        if (!EXHIBITS_ENDPOINTS?.exhibits?.heading_records?.post?.endpoint) {
            throw new Error('API endpoint configuration missing');
        }

        const endpoint_template = EXHIBITS_ENDPOINTS.exhibits.heading_records.post.endpoint;

        return endpoint_template.replace(':exhibit_id', encodeURIComponent(exhibit_id));
    }

    /**
     * Make the create request to the API
     */
    async function make_create_request(endpoint, data, token) {
        if (!httpModule?.req) {
            throw new Error('HTTP module not available');
        }

        const response = await httpModule.req({
            method: 'POST',
            url: endpoint,
            data: data,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            timeout: 30000
        });

        return response;
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
     * Clear status message with fade effect
     */
    function clear_status_message(element) {
        if (!element) {
            return;
        }

        // Fade out effect
        element.style.transition = 'opacity 0.3s ease-out';
        element.style.opacity = '0';

        setTimeout(() => {
            element.textContent = '';
            element.style.opacity = '1';
            element.style.transition = '';
        }, 300);
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

    /**
     * Get user-friendly error message
     */
    function get_user_friendly_error_message(error) {
        // Map specific errors to user-friendly messages
        const error_messages = {
            'NetworkError': 'Network connection error. Please check your internet connection.',
            'TimeoutError': 'Request timed out. Please try again.',
            'AbortError': 'Request was cancelled. Please try again.'
        };

        // Check for specific error types
        if (error.name && error_messages[error.name]) {
            return error_messages[error.name];
        }

        // Check for HTTP status codes
        if (error.response?.status) {
            const status = error.response.status;

            if (status === 401 || status === 403) {
                return 'Permission denied. You do not have access to create items in this exhibit.';
            } else if (status === 404) {
                return 'Exhibit not found.';
            } else if (status === 422) {
                return 'Invalid data submitted. Please check your inputs.';
            } else if (status >= 500) {
                return 'Server error. Please try again later.';
            }
        }

        // Generic fallback message
        return 'Unable to create heading record. Please try again.';
    }

    obj.create_heading_record__ = async function() {
        // Prevent duplicate submissions
        if (this._is_creating) {
            return false;
        }

        this._is_creating = true;

        try {
            // Cache DOM element
            const message_element = document.querySelector('#message');

            // Scroll to top for user feedback
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (!exhibit_id) {
                display_status_message(message_element, 'warning', 'Missing exhibit ID. Cannot create heading record.');
                return false;
            }

            // Show loading state
            display_status_message(message_element, 'info', 'Creating item heading record...');

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
            const form_data = itemsCommonHeadingFormModule.get_common_heading_form_fields();

            if (!form_data || form_data === false) {
                display_status_message(message_element, 'danger', 'Invalid form data. Please check all required fields.');
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

            // Construct endpoint with URL encoding
            const endpoint = construct_create_endpoint(exhibit_id);

            // Make API request
            const response = await make_create_request(endpoint, form_data, token);

            // Handle successful response
            if (response && response.status === 201) {
                const new_item_id = response.data?.data;

                if (!new_item_id) {
                    throw new Error('Server did not return a valid item ID');
                }

                display_status_message(message_element, 'success', 'Heading record created successfully');

                // Transition to edit mode without page reload
                await transition_to_edit_mode(exhibit_id, new_item_id);

                // Auto-dismiss success message after a delay
                setTimeout(() => {
                    clear_status_message(message_element);
                }, 3000);

                return true;

            } else if (!response) {
                display_status_message(message_element, 'danger', 'Permission denied. You do not have access to add items to this exhibit.');
                return false;
            } else {
                throw new Error('Unexpected response from server');
            }

        } catch (error) {
            console.error('Error creating heading record:', error);

            const message_element = document.querySelector('#message');
            const error_message = get_user_friendly_error_message(error);
            display_status_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_creating = false;
        }
    };

    /**
     * Transition from create mode to edit mode without page reload
     */
    async function transition_to_edit_mode(exhibit_id, item_id) {
        try {
            // Update URL without reload using History API
            update_url_to_edit_mode(exhibit_id, item_id);

            // Update page title
            update_page_title('Edit Heading');

            // Load the newly created record data
            await load_edit_record_data();

            // Update form behavior from create to edit
            update_form_mode_to_edit();

            // Update any UI elements that differ between create/edit
            update_ui_for_edit_mode();

        } catch (error) {
            console.error('Error transitioning to edit mode:', error);
            // Fallback: redirect to edit page
            fallback_redirect_to_edit(exhibit_id, item_id);
        }
    }

    /**
     * Update URL to edit mode using History API
     */
    function update_url_to_edit_mode(exhibit_id, item_id) {
        if (!window.history?.pushState) {
            return;
        }

        const params = new URLSearchParams({
            exhibit_id: exhibit_id,
            item_id: item_id
        });

        const new_url = `${APP_PATH}/items/heading/edit?${params.toString()}`;

        // Update URL in browser without reload
        window.history.pushState(
            { mode: 'edit', exhibit_id, item_id },
            '',
            new_url
        );
    }

    /**
     * Update page title
     */
    function update_page_title(title) {
        if (document.title) {
            document.title = title;
        }

        // Update heading if exists
        const page_heading = document.querySelector('h1, .page-title');
        if (page_heading) {
            page_heading.textContent = title;
        }
    }

    /**
     * Load the edit record data
     */
    async function load_edit_record_data() {
        // Call the display_edit_record function if it exists
        if (typeof display_edit_record === 'function') {
            await display_edit_record();
        }
    }

    /**
     * Update form behavior from create to edit
     */
    function update_form_mode_to_edit() {
        const form = document.querySelector('form#heading-form, form');
        if (!form) {
            return;
        }

        // Update form submit handler to use update instead of create
        const old_submit = form.onsubmit;
        form.onsubmit = async function(event) {
            event.preventDefault();

            // Call update function instead of create
            if (obj.update_item_heading_record && typeof obj.update_item_heading_record === 'function') {
                return await obj.update_item_heading_record();
            }

            return false;
        };

        // Update any hidden form fields
        const mode_input = form.querySelector('input[name="mode"]');
        if (mode_input) {
            mode_input.value = 'edit';
        }
    }

    /**
     * Update UI elements for edit mode
     */
    function update_ui_for_edit_mode() {
        // Update submit button text
        const submit_button = document.querySelector('button[type="submit"], #submit-button');
        if (submit_button) {
            const button_text = submit_button.querySelector('.button-text');
            if (button_text) {
                button_text.textContent = 'Update Heading';
            } else {
                submit_button.textContent = 'Update Heading';
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

        // Enable any fields that should only be editable after creation
        const created_metadata = document.querySelector('#created');
        if (created_metadata) {
            created_metadata.style.display = 'block';
        }
    }

    /**
     * Fallback redirect if transition fails
     */
    function fallback_redirect_to_edit(exhibit_id, item_id) {
        const params = new URLSearchParams({
            exhibit_id: exhibit_id,
            item_id: item_id
        });

        const edit_url = `${APP_PATH}/items/heading/edit?${params.toString()}`;
        window.location.replace(edit_url);
    }

    /**
     * Construct create endpoint with URL encoding
     */
    function construct_create_endpoint(exhibit_id) {
        if (!EXHIBITS_ENDPOINTS?.exhibits?.heading_records?.post?.endpoint) {
            throw new Error('API endpoint configuration missing');
        }

        const endpoint_template = EXHIBITS_ENDPOINTS.exhibits.heading_records.post.endpoint;

        return endpoint_template.replace(':exhibit_id', encodeURIComponent(exhibit_id));
    }

    /**
     * Make the create request to the API
     */
    async function make_create_request(endpoint, data, token) {
        if (!httpModule?.req) {
            throw new Error('HTTP module not available');
        }

        const response = await httpModule.req({
            method: 'POST',
            url: endpoint,
            data: data,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });

        return response;
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
     * Clear status message with fade effect
     */
    function clear_status_message(element) {
        if (!element) {
            return;
        }

        // Fade out effect
        element.style.transition = 'opacity 0.3s ease-out';
        element.style.opacity = '0';

        setTimeout(() => {
            element.textContent = '';
            element.style.opacity = '1';
        }, 300);
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

    /**
     * Get user-friendly error message
     */
    function get_user_friendly_error_message(error) {
        // Map specific errors to user-friendly messages
        const error_messages = {
            'NetworkError': 'Network connection error. Please check your internet connection.',
            'TimeoutError': 'Request timed out. Please try again.',
            'AbortError': 'Request was cancelled. Please try again.'
        };

        // Check for specific error types
        if (error.name && error_messages[error.name]) {
            return error_messages[error.name];
        }

        // Check for HTTP status codes
        if (error.response?.status) {
            const status = error.response.status;

            if (status === 401 || status === 403) {
                return 'Permission denied. You do not have access to create items in this exhibit.';
            } else if (status === 404) {
                return 'Exhibit not found.';
            } else if (status === 422) {
                return 'Invalid data submitted. Please check your inputs.';
            } else if (status >= 500) {
                return 'Server error. Please try again later.';
            }
        }

        // Generic fallback message
        return 'Unable to create heading record. Please try again.';
    }

    obj.init = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const redirect = '/items?exhibit_id=' + exhibit_id + '&status=403';
        await authModule.check_permissions(['add_item', 'add_item_to_any_exhibit'], 'heading', exhibit_id, null, redirect);

        exhibitsModule.set_exhibit_title(exhibit_id);
        document.querySelector('#save-heading-btn').addEventListener('click', itemsAddHeadingFormModule.create_heading_record);
    };

    return obj;

}());
