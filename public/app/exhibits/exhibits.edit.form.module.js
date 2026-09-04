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

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    function get_exhibit_data() {

        // Helper function to safely get element value
        const get_element_value = (selector, default_value = '') => {
            const element = document.querySelector(selector);
            return element?.value?.trim() || default_value;
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
            if (!validate_module(exhibitsCommonFormModule, ['get_common_form_fields'])) {
                throw new Error('exhibitsCommonFormModule is not properly configured');
            }

            // Get common form fields
            const exhibit = exhibitsCommonFormModule.get_common_form_fields();

            // Validate that common fields were retrieved successfully
            if (!exhibit || typeof exhibit !== 'object') {
                throw new Error('Failed to retrieve common form fields');
            }

            // Get previous image values (used for comparison on update)
            exhibit.hero_image_prev = get_element_value('#hero-image-prev');
            exhibit.thumbnail_prev = get_element_value('#thumbnail-image-prev');

            // Validate that at least title exists (basic sanity check)
            if (!exhibit.title || exhibit.title.length === 0) {
                console.error('Exhibit data validation failed: missing title');
                domModule.set_alert('#message', 'danger', 'Please enter an exhibit title');
                return false;
            }

            return exhibit;

        } catch (error) {
            // Log error for debugging
            console.error('Error getting exhibit data:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred while processing exhibit data';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    }

    /**
     * Loads the exhibit record into the edit form.
     *
     * The record fetch, the dozen DOM helpers and the whole populate pass now
     * live in exhibitsCommonFormModule and are shared with the details page;
     * only the lock handling is edit-specific.
     *
     * @returns {Promise<boolean>} always false (legacy contract - the caller
     *     is a click handler that must not submit)
     */
    async function display_edit_record() {

        try {

            const record = await exhibitsCommonFormModule.get_exhibit_record({ type: 'edit' });

            if (!record) {
                throw new Error('Failed to retrieve exhibit record');
            }

            // Check if record is locked
            await lockModule.check_if_locked(record, '#exhibit-submit-card');

            // Disable form fields if locked by another user
            if (lockModule.is_locked_by_other_user(record)) {
                // Check if current user is an administrator
                const is_admin = await lockModule.is_user_administrator();

                // Disable form fields, but preserve unlock button for admins
                lockModule.disable_form_fields({ preserve_selectors: is_admin ? ['#unlock-record'] : [] });
            }

            // Setup automatic unlock when user navigates away (only if current user has it locked)
            lockModule.setup_auto_unlock(record);

            await exhibitsCommonFormModule.apply_record_to_form(record, { editable: true });

            return false;

        } catch (error) {
            // Log error for debugging
            console.error('Error displaying edit record:', error);

            // Display safe error message
            const error_message = error.message || 'An error occurred while loading the exhibit record';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    }


    obj.update_exhibit_record = async function () {

        // Cache DOM element and constants
        const message_el = document.querySelector('#message');
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {

            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Get and validate UUID
            const uuid = helperModule.get_parameter_by_name('exhibit_id');
            if (!uuid) {
                domModule.set_alert('#message', 'danger', 'Unable to get record UUID');
                return false;
            }

            // Get and validate exhibit data
            const data = get_exhibit_data();

            if (!data) {
                domModule.set_alert('#message', 'danger', 'Unable to get exhibit data');
                return false;
            }

            // Show loading state
            domModule.set_alert('#message', 'info', 'Updating exhibit record...');

            // Add user metadata
            data.updated_by = helperModule.get_user_name();

            const update_url = endpointsModule.build(
                EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.put.endpoint,
                { exhibit_id: uuid }
            );

            if (!update_url) {
                throw new Error('Failed to update exhibit record');
            }

            const response = await httpModule.api({
                method: 'PUT',
                url: update_url,
                data: data
            });

            // Validate response
            if (!response || response.status !== 201) {
                throw new Error('Failed to update exhibit record');
            }

            // Show success message
            domModule.set_alert('#message', 'success', 'Exhibit record updated successfully');

            // Re-render the form with updated data
            try {
                await display_edit_record();
                console.debug('Form re-rendered with updated data');
            } catch (render_error) {
                console.error('Error re-rendering form:', render_error);
                // Don't fail the whole operation if re-render fails
                domModule.set_alert('#message', 'warning', 'Record updated, but form refresh failed. Please reload the page.');
            }

            // Clear success message after delay
            timeout_id = setTimeout(() => {
                if (message_el) {
                    message_el.innerHTML = '';
                }
            }, MESSAGE_CLEAR_DELAY);

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
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    };

    /**
     * Role-specific wording for the legacy media delete flow. The hero and
     * thumbnail delete functions were byte-identical apart from these strings
     * and the slot they clear.
     */
    const LEGACY_MEDIA_LABELS = {
        hero_image: { lower: 'hero image', title: 'Hero image' },
        thumbnail: { lower: 'thumbnail image', title: 'Thumbnail image' }
    };

    /**
     * Deletes a legacy filename-based exhibit image through the API and
     * clears its slot in the form.
     *
     * @param {string} role - 'hero_image' or 'thumbnail'
     * @returns {Promise<boolean>} true when the file was deleted
     */
    async function delete_legacy_media(role) {

        // Constants
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds
        const labels = LEGACY_MEDIA_LABELS[role];
        const slot = exhibitsCommonFormModule.get_media_slot(role);

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

            // Get and validate the stored filename
            const media_el = document.querySelector(slot.legacy_input);
            if (!media_el) {
                throw new Error(`${labels.title} input element not found`);
            }

            const media_filename = media_el.value?.trim();
            if (!media_filename) {
                domModule.set_alert('#message', 'warning', `No ${labels.lower} to delete`);
                return false;
            }

            // Validate endpoint configuration exists
            const endpoint_template = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media?.get?.endpoint;
            if (!endpoint_template) {
                throw new Error('Endpoint configuration not found');
            }

            const endpoint = endpointsModule.build(endpoint_template, { exhibit_id: uuid, media: media_filename });

            if (!endpoint) {
                throw new Error('Endpoint configuration not found');
            }

            // Show loading state
            domModule.set_alert('#message', 'info', `Deleting ${labels.lower}...`);

            const response = await httpModule.api({
                method: 'DELETE',
                url: endpoint
            });

            // Validate response
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 204) {
                throw new Error(`Failed to delete ${labels.lower}. Server returned status ${response.status}`);
            }

            // Clear the slot's UI elements
            exhibitsCommonFormModule.clear_media_slot_ui(role);

            // Show success message
            domModule.set_alert('#message', 'success', `${labels.title} deleted successfully`);

            // Clear success message after delay
            timeout_id = setTimeout(() => {
                const message_el = document.querySelector('#message');
                if (message_el) message_el.innerHTML = '';
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error(`Error deleting ${labels.lower}:`, error);

            // Display user-friendly error message
            const error_message = error.message || `An unexpected error occurred while deleting the ${labels.lower}`;
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    }

    obj.init = async function () {

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

        /*
         * Wires one media slot's trash affordance. A legacy filename-based
         * image goes through the API delete; a media library asset is
         * unbound from the exhibit and cleared client-side.
         */
        const setup_image_delete_handler = (role) => {

            const slot = exhibitsCommonFormModule.get_media_slot(role);
            const image_el = document.querySelector(slot.legacy_input);
            const trash_el = document.querySelector(slot.trash);

            if (!image_el || !trash_el) {
                console.warn(`Image elements not found: ${slot.legacy_input} or ${slot.trash}`);
                return;
            }

            // Remove any existing listeners by cloning the element
            const new_trash_el = trash_el.cloneNode(true);
            trash_el.parentNode.replaceChild(new_trash_el, trash_el);

            new_trash_el.addEventListener('click', async function (e) {
                e.preventDefault();

                const has_legacy_image = image_el.value && image_el.value.trim().length > 0;

                if (has_legacy_image) {
                    // Legacy filename-based image — use API delete, then restore placeholder
                    const result = await delete_legacy_media(role);

                    if (result) {
                        exhibitsCommonFormModule.restore_media_placeholder(slot.display);
                    }

                    return;
                }

                // Media library asset — unbind via API, then clear UI
                const uuid_el = document.querySelector(slot.uuid_input);
                const media_uuid = uuid_el ? uuid_el.value.trim() : '';

                if (media_uuid) {
                    try {
                        const exhibit_uuid = helperModule.get_parameter_by_name('exhibit_id');

                        if (exhibit_uuid) {
                            const endpoint_base = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media_library?.delete?.endpoint;
                            const endpoint = endpoint_base
                                ? endpointsModule.build(endpoint_base, { exhibit_id: exhibit_uuid, media_role: role })
                                : null;

                            if (endpoint) {
                                const response = await httpModule.api({
                                    method: 'DELETE',
                                    url: endpoint
                                });

                                if (response && (response.status === 204 || response.status === 200)) {
                                    console.debug(`Media library binding unbound for role: ${role}`);
                                } else {
                                    console.warn(`Unexpected response unbinding media role ${role}:`, response?.status);
                                }
                            } else {
                                console.warn('exhibit_media_library DELETE endpoint not configured');
                            }

                            // Remove exhibit UUID from media record's exhibits field (fire-and-forget)
                            if (typeof mediaPickerModule !== 'undefined' && typeof mediaPickerModule.remove_exhibit_association === 'function') {
                                mediaPickerModule.remove_exhibit_association(media_uuid, exhibit_uuid, role);
                            }
                        }
                    } catch (unbind_error) {
                        console.error(`Error unbinding media role ${role}:`, unbind_error);
                    }
                }

                exhibitsCommonFormModule.clear_media_slot_ui(role);
            });
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

            // Add save button listener
            add_listener('#save-exhibit-btn', 'click', exhibitsEditFormModule?.update_exhibit_record);

            // Load and display edit record
            await display_edit_record();

            // Wire media picker buttons
            exhibitsCommonFormModule.wire_media_picker({
                button_selector: '#pick-hero-image-btn',
                role: 'hero_image',
                exhibit_uuid: exhibit_id
            });

            exhibitsCommonFormModule.wire_media_picker({
                button_selector: '#pick-thumbnail-btn',
                role: 'thumbnail',
                exhibit_uuid: exhibit_id
            });

            // Setup image delete handlers after record is loaded
            setup_image_delete_handler('hero_image');
            setup_image_delete_handler('thumbnail');

            console.debug('Module initialized successfully');
            return true;

        } catch (error) {
            // Log error for debugging
            console.error('Error initializing module:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred during initialization';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    };

    return obj;

}());
