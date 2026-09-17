/**
 * Copyright 2026 University of Denver
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const mediaDeleteModalModule = (function() {

    'use strict';

    // Shared helpers
    const escape_html = helperMediaLibraryModule.escape_html;
    const decode_html_entities = helperMediaLibraryModule.decode_html_entities;
    const HTTP_STATUS = helperMediaLibraryModule.HTTP_STATUS;
    const get_delete_icon_class = helperMediaLibraryModule.get_media_type_icon;

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    // Delete modal state
    let delete_modal_callback = null;
    let current_delete_uuid = null;
    let current_delete_name = null;
    // In-flight guard for the DELETE request. The button's `disabled`
    // attribute alone isn't sufficient: setup_delete_modal_handlers
    // clones-and-replaces the confirm button on every modal open, so
    // a freshly-opened modal starts with a non-disabled button. A
    // tight double-click before the first response lands would hit
    // the cloned button and fire a second DELETE.
    let is_deleting = false;
    // Set once the server has answered 409 (media still bound to items or
    // exhibits). From then on the modal is read-only for this record: the
    // confirm button stays disabled and only Cancel/close remain — the
    // record cannot be deleted until it is unbound, so a retry is pointless.
    let is_in_use = false;

    let obj = {};

    // ========================================
    // DELETE MODAL FUNCTIONS
    // ========================================

    /**
     * Display message in delete modal
     * @param {string} type - Message type ('success', 'danger', 'warning')
     * @param {string} message - Message text
     */
    const display_delete_modal_message = (type, message) => {
        const message_container = document.getElementById('delete-media-message');
        
        if (!message_container) return;

        message_container.innerHTML = '<div class="alert alert-' + type + ' mb-3" role="alert">' + 
            '<i class="fa fa-' + (type === 'success' ? 'check' : type === 'danger' ? 'exclamation-circle' : 'warning') + '" style="margin-right: 6px;"></i>' +
            escape_html(message) + 
            '</div>';
    };

    /**
     * Clear delete modal message
     */
    const clear_delete_modal_message = () => {
        const message_container = document.getElementById('delete-media-message');
        if (message_container) {
            message_container.innerHTML = '';
        }
    };

    /**
     * Switch the modal between its confirm state and the locked "in use"
     * state: the confirmation prompt and irreversibility notice make no
     * sense for a record that cannot be deleted, and the Delete button is
     * disabled (not just visually) so it cannot be clicked again.
     * @param {boolean} in_use - true after a 409 in-use refusal
     */
    const set_in_use_state = (in_use) => {
        const prompt_el = document.getElementById('delete-media-prompt');
        const irreversible_el = document.getElementById('delete-media-irreversible');
        const confirm_btn = document.getElementById('delete-media-confirm-btn');

        if (prompt_el) prompt_el.style.display = in_use ? 'none' : '';
        if (irreversible_el) irreversible_el.style.display = in_use ? 'none' : '';

        if (confirm_btn) {
            confirm_btn.disabled = in_use;
            confirm_btn.setAttribute('aria-disabled', in_use ? 'true' : 'false');
            confirm_btn.innerHTML = '<i class="fa fa-trash" style="margin-right: 6px;"></i>Delete';

            if (in_use) {
                confirm_btn.title = 'This media is in use and cannot be deleted';
            } else {
                confirm_btn.removeAttribute('title');
            }
        }
    };

    /**
     * Close the delete media modal
     */
    const close_delete_modal = () => {
        const modal_element = document.getElementById('delete-media-modal');
        if (!modal_element) return;

        helperMediaLibraryModule.hide_bootstrap_modal(modal_element);

        // Reset state
        current_delete_uuid = null;
        current_delete_name = null;
        delete_modal_callback = null;
        is_in_use = false;
    };

    /**
     * Handle delete confirmation
     */
    const handle_delete_confirm = async () => {
        // Module-level guard — survives confirm-button cloning across
        // modal opens, where `disabled` does not. A record already known to
        // be in use is never re-submitted.
        if (is_deleting || is_in_use) {
            return;
        }
        is_deleting = true;

        const confirm_btn = document.getElementById('delete-media-confirm-btn');
        const uuid = current_delete_uuid;

        if (!uuid) {
            is_deleting = false;
            display_delete_modal_message('danger', 'No media record selected for deletion.');
            return;
        }

        // Disable confirm button and show loading state
        if (confirm_btn) {
            confirm_btn.disabled = true;
            confirm_btn.innerHTML = '<i class="fa fa-spinner fa-spin" style="margin-right: 6px;"></i>Deleting...';
        }

        try {
            // Get endpoints configuration
            if (!EXHIBITS_ENDPOINTS?.media_records?.delete?.endpoint) {
                display_delete_modal_message('danger', 'Delete endpoint not configured.');
                return;
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_delete_modal_message('danger', 'Session expired. Please log in again.');
                return;
            }

            // Construct endpoint with media_id
            const endpoint = EXHIBITS_ENDPOINTS.media_records.delete.endpoint.replace(':media_id', uuid);

            // Make API request
            const response = await httpModule.req({
                method: 'DELETE',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            // Handle undefined response (network/server error)
            if (!response) {
                display_delete_modal_message('danger', 'Unable to delete media record. Please check your connection and try again.');
                return;
            }

            // Handle 403 Forbidden
            if (response.status === HTTP_STATUS.FORBIDDEN) {
                display_delete_modal_message('danger', response.data?.message || 'You do not have permission to delete this media record.');
                return;
            }

            // Handle 404 Not Found
            if (response.status === HTTP_STATUS.NOT_FOUND) {
                display_delete_modal_message('danger', response.data?.message || 'Media record not found.');
                return;
            }

            // Handle 409 Conflict - the media is still selected on items or
            // exhibits. The server message names them; nothing was deleted.
            // Lock the modal: deleting is not possible until the record is
            // unbound, so the Delete button stays disabled from here on.
            if (response.status === HTTP_STATUS.CONFLICT) {
                is_in_use = true;
                display_delete_modal_message('warning', response.data?.message || 'This media is still in use and cannot be deleted.');
                set_in_use_state(true);
                return;
            }

            // Handle success
            if (response.status === HTTP_STATUS.OK && response.data?.success) {
                // Store callback reference before closing modal (close_delete_modal nullifies it)
                const callback = delete_modal_callback;

                // Close modal
                close_delete_modal();

                // Execute callback if provided (to refresh table and show success message)
                if (typeof callback === 'function') {
                    callback(true, 'Media record deleted successfully.');
                }
                return;
            }

            // Any other non-success response
            const error_message = response.data?.message || 'Failed to delete media record.';
            display_delete_modal_message('danger', error_message);

        } catch (error) {
            console.error('Error deleting media record:', error);
            display_delete_modal_message('danger', 'An unexpected error occurred while deleting the media record.');
        } finally {
            // Clear the in-flight guard so the user can retry after
            // a failure (the success path closes the modal anyway).
            is_deleting = false;
            // Re-enable confirm button — unless the record turned out to be
            // in use, in which case the locked state set above stands.
            if (confirm_btn && !is_in_use) {
                confirm_btn.disabled = false;
                confirm_btn.innerHTML = '<i class="fa fa-trash" style="margin-right: 6px;"></i>Delete';
            }
        }
    };

    /**
     * Setup delete modal event handlers
     */
    const setup_delete_modal_handlers = () => {
        // Confirm button handler
        const confirm_btn = document.getElementById('delete-media-confirm-btn');
        if (confirm_btn) {
            // Remove existing listeners by cloning
            const new_confirm_btn = confirm_btn.cloneNode(true);
            confirm_btn.parentNode.replaceChild(new_confirm_btn, confirm_btn);
            new_confirm_btn.addEventListener('click', handle_delete_confirm);
        }

        // Cancel button handler
        const cancel_btn = document.getElementById('delete-media-cancel-btn');
        if (cancel_btn) {
            const new_cancel_btn = cancel_btn.cloneNode(true);
            cancel_btn.parentNode.replaceChild(new_cancel_btn, cancel_btn);
            new_cancel_btn.addEventListener('click', close_delete_modal);
        }

        // Close button (X) handler
        const close_btn = document.getElementById('delete-media-close-btn');
        if (close_btn) {
            const new_close_btn = close_btn.cloneNode(true);
            close_btn.parentNode.replaceChild(new_close_btn, close_btn);
            new_close_btn.addEventListener('click', close_delete_modal);
        }
    };

    /**
     * Open the delete confirmation modal
     * @param {string} uuid - Media record UUID
     * @param {string} name - Media record name for display
     * @param {string} filename - Original filename for display
     * @param {string} item_type - Item type for icon selection
     * @param {string} thumbnail_url - Thumbnail URL for preview display
     * @param {Function} callback - Callback function(success, message) when delete completes
     */
    obj.open_delete_media_modal = function(uuid, name, filename, item_type, thumbnail_url, callback) {
        const modal_element = document.getElementById('delete-media-modal');
        
        if (!modal_element) {
            console.error('Delete media modal not found');
            // Fall back to confirm dialog if modal not available
            if (confirm('Are you sure you want to delete "' + (name || 'this media record') + '"?\n\nThis action cannot be undone.')) {
                if (typeof callback === 'function') {
                    callback(true, null);
                }
            }
            return;
        }

        // Store state
        current_delete_uuid = uuid;
        current_delete_name = name;
        delete_modal_callback = callback || null;
        is_in_use = false;

        // Clear previous messages
        clear_delete_modal_message();

        // Update modal content
        const name_el = document.getElementById('delete-media-name');
        const filename_el = document.getElementById('delete-media-filename');
        const icon_el = document.getElementById('delete-media-icon');
        const uuid_input = document.getElementById('delete-media-uuid');

        if (name_el) {
            name_el.textContent = decode_html_entities(name) || 'Untitled';
        }

        if (filename_el) {

            if (!filename || filename === 'N/A') {
                filename_el.textContent = '';
                filename_el.style.display = 'none';
            } else {
                filename_el.textContent = decode_html_entities(filename);
                filename_el.style.display = '';
            }
        }

        if (icon_el) {
            // Update icon based on item type
            icon_el.className = 'fa ' + get_delete_icon_class(item_type) + ' fa-2x text-muted';
        }

        // Update thumbnail image
        const thumbnail_el = document.getElementById('delete-media-thumbnail');

        if (thumbnail_el) {

            if (thumbnail_url) {
                thumbnail_el.src = thumbnail_url;
                thumbnail_el.alt = 'Thumbnail for ' + decode_html_entities(name || 'media');
                thumbnail_el.style.display = 'block';

                if (icon_el) {
                    icon_el.style.display = 'none';
                }

                // Fall back to icon if thumbnail fails to load
                thumbnail_el.onerror = function() {
                    this.style.display = 'none';

                    if (icon_el) {
                        icon_el.style.display = '';
                    }
                };
            } else {
                thumbnail_el.src = '';
                thumbnail_el.style.display = 'none';

                if (icon_el) {
                    icon_el.style.display = '';
                }
            }
        }

        if (uuid_input) {
            uuid_input.value = uuid;
        }

        // Setup event handlers
        setup_delete_modal_handlers();

        // Fresh open: confirm state (the handlers step clones the confirm
        // button, so this must run after it)
        set_in_use_state(false);

        // Show modal
        helperMediaLibraryModule.show_bootstrap_modal(modal_element);

        console.debug('Delete media modal opened for: ' + name);
    };

    /**
     * Close the delete media modal (public method)
     */
    obj.close_delete_media_modal = function() {
        close_delete_modal();
    };

    return obj;

}());
