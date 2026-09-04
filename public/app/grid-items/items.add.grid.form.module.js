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

const itemsAddGridFormModule = (function () {

    'use strict';

    const APP_PATH = endpointsModule.get_app_path();
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_grid_record = async function() {
        // CRITICAL: Check if we're in edit mode first
        const item_id = helperModule.get_parameter_by_name('item_id');
        if (item_id) {
            console.debug('Item ID exists - already in edit mode, preventing duplicate creation');
            console.debug('Current URL:', window.location.href);
            console.debug('item_id:', item_id);

            const message_element = document.querySelector('#message');
            domModule.set_alert(message_element, 'warning', 'Already in edit mode.');
            return false;
        }

        console.debug('CREATE FUNCTION CALLED - No item_id, proceeding with creation');

        // Prevent duplicate submissions
        if (this._is_creating_grid) {
            console.debug('Already creating, preventing duplicate submission');
            return false;
        }

        this._is_creating_grid = true;

        try {
            // Cache DOM element
            const message_element = document.querySelector('#message');

            // Scroll to top for user feedback
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

            if (!exhibit_id) {
                domModule.set_alert(message_element, 'warning', 'Missing exhibit ID. Cannot create grid record.');
                return false;
            }

            // Show loading state
            domModule.set_alert(message_element, 'info', 'Creating grid record...');

            // Get and validate form data
            const form_data = itemsCommonStandardGridFormModule.get_common_grid_form_fields();

            if (!form_data || form_data === false) {
                // domModule.set_alert(message_element, 'danger', 'Invalid form data. Please check all required fields.');
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
            const endpoint = construct_grid_create_endpoint(exhibit_id);

            // Make API request (null = missing token; httpModule.api has
            // already alerted and scheduled the logout)
            const response = await make_grid_create_request(endpoint, form_data);

            if (response === null) {
                return false;
            }

            // Handle successful response
            if (response && response.status === 201) {
                const new_grid_id = response.data?.data;

                if (!new_grid_id) {
                    throw new Error('Server did not return a valid grid ID');
                }

                console.debug('Grid record created successfully, ID:', new_grid_id);

                // Show success message
                domModule.set_alert(message_element, 'success', 'Grid record created successfully. Redirecting to edit page...');

                // Scroll to top to show success message
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

                // Gracefully redirect to edit page after showing success message
                setTimeout(() => {
                    redirect_to_grid_edit_page(exhibit_id, new_grid_id);
                }, 1200);

                return true;

            } else if (!response) {
                domModule.set_alert(message_element, 'danger', 'Permission denied. You do not have access to add items to this exhibit.');
                return false;
            } else {
                throw new Error('Unexpected response from server');
            }

        } catch (error) {
            console.error('Error creating grid record:', error);

            const message_element = document.querySelector('#message');
            const error_message = get_user_friendly_error_message(error);
            domModule.set_alert(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_creating_grid = false;
        }
    };

    /**
     * Gracefully redirect to grid edit page (prevents back button to create page)
     */
    function redirect_to_grid_edit_page(exhibit_id, grid_id) {
        console.debug('=== REDIRECTING TO GRID EDIT PAGE ===');
        console.debug('exhibit_id:', exhibit_id);
        console.debug('grid_id:', grid_id);

        const params = new URLSearchParams({
            exhibit_id: exhibit_id,
            item_id: grid_id
        });

        const edit_url = `${APP_PATH}/items/grid/edit?${params.toString()}`;

        console.debug('Redirecting to:', edit_url);
        console.debug('Note: Back button will NOT return to create page');

        // Use window.location.replace() to prevent back button to create page
        window.location.replace(edit_url);
    }

    /**
     * Construct grid create endpoint with URL encoding
     */
    function construct_grid_create_endpoint(exhibit_id) {
        if (!EXHIBITS_ENDPOINTS?.exhibits?.grid_records?.post?.endpoint) {
            throw new Error('API endpoint configuration missing');
        }

        const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.grid_records.post.endpoint, {
            exhibit_id: exhibit_id
        });

        if (!endpoint) {
            throw new Error('Missing exhibit ID. Cannot create grid record.');
        }

        return endpoint;
    }

    /**
     * Make the grid create request to the API
     */
    async function make_grid_create_request(endpoint, data) {
        if (!httpModule?.api) {
            throw new Error('HTTP module not available');
        }

        return httpModule.api({
            method: 'POST',
            url: endpoint,
            data: data
        });
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
        return 'Unable to create grid record. Please try again.';
    }

    obj.init = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const redirect = '/items?exhibit_id=' + exhibit_id + '&status=403';
        await authModule.check_permissions(['add_item', 'add_item_to_any_exhibit'], 'grid', exhibit_id, null, redirect);
        exhibitsModule.set_exhibit_title(exhibit_id);
        domModule.on('#save-item-btn', 'click', itemsAddGridFormModule.create_grid_record);
    };

    return obj;

}());
