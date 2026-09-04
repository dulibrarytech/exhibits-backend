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

const itemsEditHeadingFormModule = (function () {

    'use strict';

    const APP_PATH = endpointsModule.get_app_path();
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_item_heading_record() {

        // Cache DOM element reference
        const message_element = document.querySelector('#message');

        try {

            // Validate required parameters early
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            if (!exhibit_id || !item_id) {
                throw new Error('Missing required parameters: exhibit_id or item_id');
            }

            const profile = authModule.get_user_profile_data();

            if (!profile?.uid) {
                throw new Error('Invalid user profile data');
            }

            const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.heading_records.get.endpoint, {
                exhibit_id: exhibit_id,
                heading_id: item_id
            });

            // Construct URL with query parameters safely
            const params = new URLSearchParams({
                type: 'edit',
                uid: profile.uid
            });
            const full_url = `${endpoint}?${params.toString()}`;

            /* null = missing token; httpModule.api has alerted and scheduled the logout */
            const response = await httpModule.api({
                method: 'GET',
                url: full_url
            });

            // Validate response structure
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            if (!response.data?.data) {
                throw new Error('Invalid response structure');
            }

            return response.data.data;

        } catch (error) {
            // Log error for debugging (remove in production or use proper logging service)
            console.error('Error in get_item_heading_record:', error);

            // Generic message to avoid leaking sensitive error details
            domModule.set_alert(message_element, 'danger', 'Unable to load the heading record. Please try again.');

            return null;
        }
    }

    async function display_edit_record() {

        try {

            // Fetch record data
            const record = await get_item_heading_record();

            if (!record) {
                throw new Error('Failed to load record data');
            }

            // Check if record is locked
            await lockModule.check_if_locked(record, '#item-submit-card');

            // Disable form fields if locked by another user
            if (lockModule.is_locked_by_other_user(record)) {
                const is_admin = await lockModule.is_user_administrator();
                lockModule.disable_form_fields({ preserve_selectors: is_admin ? ['#unlock-record'] : [] });
            }

            // Setup automatic unlock when user navigates away (only if current user has it locked)
            // setup_auto_unlock(record);
            lockModule.setup_auto_unlock(record);

            // Cache all DOM elements once
            const dom_elements = cache_dom_elements();

            // Display metadata (creation/update info)
            display_metadata_info(record, dom_elements.created);

            // Set heading text value
            set_heading_text(record.text, dom_elements.heading_text_input);

            // Set heading type value
            set_heading_type(record.type, dom_elements.heading_type_input);

            // Set published status
            set_published_status(record.is_published, dom_elements.is_published);

            // Set saved style selection after dropdown is populated
            // Style keys are simple strings like "heading1"; skip "{}" (prepare_styles default) and legacy JSON blobs
            if (record.styles && typeof record.styles === 'string'
                && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
                await itemsCommonHeadingFormModule.wait_for_styles();
                itemsCommonHeadingFormModule.set_item_style(record.styles);
            }

            domModule.set_value('#margins', record.margins ?? 'medium');
            domModule.set_value('#text-align', record.text_alignment ?? 'left');

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error);
            domModule.set_alert('#message', 'danger', 'Unable to display the record. Please try again.');
            return false;
        }
    }

    /**
     * Cache all required DOM elements to avoid repeated queries
     */
    function cache_dom_elements() {
        return {
            created: document.querySelector('#created'),
            heading_text_input: document.querySelector('#item-heading-text-input'),
            heading_type_input: document.querySelector('#item-heading-type-input'),
            is_published: document.querySelector('#is-published'),
        };
    }

    /**
     * Display creation and update metadata securely
     */
    function display_metadata_info(record, created_element) {

        if (!created_element || !record) {
            return;
        }

        const metadata_parts = [];

        // Add creation info
        if (record.created_by && record.created) {
            const create_date = new Date(record.created);

            if (is_valid_date(create_date)) {
                const create_date_time = helperModule.format_date(create_date);
                const created_em = document.createElement('em');
                created_em.textContent = `Created by ${record.created_by} on ${create_date_time}`;
                metadata_parts.push(created_em);
            }
        }

        // Add update info
        if (record.updated_by && record.updated) {
            const update_date = new Date(record.updated);

            if (is_valid_date(update_date)) {
                const update_date_time = helperModule.format_date(update_date);
                const updated_em = document.createElement('em');
                updated_em.textContent = `Last updated by ${record.updated_by} on ${update_date_time}`;
                metadata_parts.push(updated_em);
            }
        }

        // Clear existing content and append new content safely
        created_element.textContent = '';

        metadata_parts.forEach((part, index) => {
            if (index > 0) {
                created_element.appendChild(document.createTextNode(' | '));
            }
            created_element.appendChild(part);
        });
    }

    /**
     * Set heading text input value
     */
    function set_heading_text(text, element) {
        rteModule.set_html('item-heading-text-input', text ? helperModule.unescape(text) : '');
    }

    /**
     * Set heading type input value
     */
    function set_heading_type(type, element) {
        if (!element) {
            return;
        }

        element.value = type;
    }

    /**
     * Set published status checkbox
     */
    function set_published_status(is_published, element) {
        if (!element) {
            return;
        }

        // Handle both numeric (0/1) and boolean values
        const PUBLISHED_VALUES = [1, true, '1', 'true'];
        element.checked = PUBLISHED_VALUES.includes(is_published);
    }

    /**
     * Validate if a date object is valid
     */
    function is_valid_date(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }

    /**
     * Update item heading record
     * @returns {Promise<boolean>}
     */
    obj.update_item_heading_record = async function() {
        // Prevent duplicate submissions
        if (this._is_updating) {
            return false;
        }

        this._is_updating = true;

        try {
            // Cache DOM element
            const message_element = document.querySelector('#message');

            // Scroll to top for user feedback
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Show loading state
            domModule.set_alert(message_element, 'info', 'Updating heading record...');

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            if (!exhibit_id || !item_id) {
                domModule.set_alert(message_element, 'danger', 'Missing required record identifiers');
                return false;
            }

            // Get and validate form data
            const form_data = itemsCommonHeadingFormModule.get_common_heading_form_fields();

            if (!form_data || form_data === false) {
                domModule.set_alert(message_element, 'danger', 'Invalid form data. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            if (user_name) {
                form_data.updated_by = user_name;
            }

            // Construct endpoint with URL encoding
            const endpoint = construct_update_endpoint(exhibit_id, item_id);

            // Make API request (null = missing token; httpModule.api has
            // already alerted and scheduled the logout)
            const response = await make_update_request(endpoint, form_data);

            if (response === null) {
                return false;
            }

            // Handle successful response
            if (response && response.status === 201) {
                domModule.set_alert(message_element, 'success', 'Heading record updated successfully');

                // Refresh the display with updated data instead of reloading
                await refresh_record_display();

                // Auto-dismiss success message after a delay
                setTimeout(() => {
                    helperModule.clear_status_message(message_element);
                }, 3000);

                return true;
            } else {
                throw new Error('Unexpected response from server');
            }

        } catch (error) {
            console.error('Error updating heading record:', error);

            const message_element = document.querySelector('#message');
            const error_message = get_user_friendly_error_message(error);
            domModule.set_alert(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_updating = false;
        }
    };

    /**
     * Refresh the record display without reloading the page
     */
    async function refresh_record_display() {
        try {
            // Re-fetch and display the updated record
            if (typeof display_edit_record === 'function') {
                await display_edit_record();
            }

            // Reset any form states that need resetting
            reset_form_states();

        } catch (error) {
            console.error('Error refreshing display:', error);
            // Don't throw - we already saved successfully
        }
    }

    /**
     * Reset form states after successful update
     */
    function reset_form_states() {
        // Disable save button temporarily to prevent duplicate saves
        const submit_button = document.querySelector('#item-submit-card button[type="submit"]');
        if (submit_button) {
            submit_button.disabled = true;

            // Re-enable after a short delay
            setTimeout(() => {
                submit_button.disabled = false;
            }, 1000);
        }

        // Clear any unsaved changes warnings
        window.onbeforeunload = null;
    }

    /**
     * Construct update endpoint with URL encoding
     */
    function construct_update_endpoint(exhibit_id, item_id) {
        if (!EXHIBITS_ENDPOINTS?.exhibits?.heading_records?.put?.endpoint) {
            throw new Error('API endpoint configuration missing');
        }

        const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.heading_records.put.endpoint, {
            exhibit_id: exhibit_id,
            heading_id: item_id
        });

        if (!endpoint) {
            throw new Error('Missing required record identifiers');
        }

        return endpoint;
    }

    /**
     * Make the update request to the API
     */
    async function make_update_request(endpoint, data) {
        if (!httpModule?.api) {
            throw new Error('HTTP module not available');
        }

        return httpModule.api({
            method: 'PUT',
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
                return 'Authentication failed. Please log in again.';
            } else if (status === 404) {
                return 'Record not found.';
            } else if (status === 422) {
                return 'Invalid data submitted. Please check your inputs.';
            } else if (status >= 500) {
                return 'Server error. Please try again later.';
            }
        }

        // Generic fallback message
        return 'Unable to update heading record. Please try again.';
    }

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const heading_id = helperModule.get_parameter_by_name('item_id');

            const redirect = '/items/heading/details?exhibit_id=' + exhibit_id + '&item_id=' + heading_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'heading', exhibit_id, heading_id, redirect);
            await exhibitsModule.set_exhibit_title(exhibit_id);

            domModule.on('#save-heading-btn', 'click', await itemsEditHeadingFormModule.update_item_heading_record);
            await display_edit_record();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
