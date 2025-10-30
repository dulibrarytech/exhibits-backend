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

const itemsAddStandardItemFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_item_record = async function() {
        // Prevent duplicate submissions
        if (this._is_creating_item) {
            return false;
        }

        this._is_creating_item = true;

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
         * Determine item form type from current path
         */
        const get_item_form_type = () => {
            if (window.location.pathname.indexOf('media') !== -1) {
                return 'media';
            }
            return 'text';
        };

        /**
         * Transition from create mode to edit mode without page reload
         */
        const transition_to_edit_mode = async (exhibit_id, item_id) => {
            try {
                // Determine form type
                const item_form = get_item_form_type();

                // Update URL without reload using History API
                update_url_to_edit_mode(exhibit_id, item_id, item_form);

                // Update page title
                update_page_title('Edit Item');

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
        };

        /**
         * Update URL to edit mode using History API
         */
        const update_url_to_edit_mode = (exhibit_id, item_id, item_form) => {
            if (!window.history?.pushState) {
                return;
            }

            const params = new URLSearchParams({
                exhibit_id: exhibit_id,
                item_id: item_id
            });

            const new_url = `${APP_PATH}/items/standard/${item_form}/edit?${params.toString()}`;

            // Update URL in browser without reload
            window.history.pushState(
                { mode: 'edit', exhibit_id, item_id, item_form },
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
            const form = document.querySelector('form#item-form, form');
            if (!form) {
                return;
            }

            // Update form submit handler to use update instead of create
            form.onsubmit = async function(event) {
                event.preventDefault();

                // Call update function instead of create
                if (obj.update_item_record && typeof obj.update_item_record === 'function') {
                    return await obj.update_item_record();
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
            const submit_button = document.querySelector('button[type="submit"], #submit-button');
            if (submit_button) {
                const button_text = submit_button.querySelector('.button-text');
                if (button_text) {
                    button_text.textContent = 'Update Item';
                } else {
                    // Extract text without icons
                    const icon = submit_button.querySelector('i');
                    if (icon) {
                        submit_button.childNodes.forEach(node => {
                            if (node.nodeType === Node.TEXT_NODE) {
                                node.textContent = ' Update Item';
                            }
                        });
                    } else {
                        submit_button.textContent = 'Update Item';
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
        };

        /**
         * Fallback redirect if transition fails
         */
        const fallback_redirect_to_edit = (exhibit_id, item_id) => {
            const item_form = get_item_form_type();
            const params = new URLSearchParams({
                exhibit_id: exhibit_id,
                item_id: item_id
            });

            const edit_url = `${APP_PATH}/items/standard/${item_form}/edit?${params.toString()}`;
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
                display_message(message_element, 'warning', 'Missing exhibit ID. Cannot create item record.');
                return false;
            }

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
            const form_data = itemsCommonStandardItemFormModule.get_common_standard_item_form_fields();

            if (!form_data || form_data === false || form_data === undefined) {
                display_message(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Show loading state
            display_message(message_element, 'info', 'Creating item record...');

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
            if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.post?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.item_records.post.endpoint
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
                throw new Error('Failed to create item record');
            }

            const new_item_id = response.data?.data;

            if (!new_item_id) {
                throw new Error('Server did not return a valid item ID');
            }

            // Show success message
            display_message(message_element, 'success', 'Item record created successfully');

            // Transition to edit mode without page reload
            await transition_to_edit_mode(exhibit_id, new_item_id);

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
            console.error('Error creating item record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || error.message || 'Unable to create item record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_creating_item = false;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const redirect = '/items?exhibit_id=' + exhibit_id + '&status=403';
            await authModule.check_permissions(['add_item', 'add_item_to_any_exhibit'], 'item', exhibit_id, null, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            document.querySelector('#save-item-btn').addEventListener('click', itemsAddStandardItemFormModule.create_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                await helperModule.create_subjects_menu();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
