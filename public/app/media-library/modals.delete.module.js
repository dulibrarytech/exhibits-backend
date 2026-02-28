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

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    // Delete modal state
    let delete_modal_callback = null;
    let current_delete_uuid = null;
    let current_delete_name = null;

    let obj = {};

    // HTTP status constants
    const HTTP_STATUS = {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    };

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    const escape_html = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Decode HTML entities (e.g., &#x27; -> ')
     * @param {string} str - String to decode
     * @returns {string} Decoded string
     */
    const decode_html_entities = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent;
    };

    // ========================================
    // DELETE MODAL FUNCTIONS
    // ========================================

    /**
     * Get Font Awesome icon class for item type
     * @param {string} item_type - The item type
     * @returns {string} Font Awesome icon class
     */
    const get_delete_icon_class = (item_type) => {
        const icons = {
            'image': 'fa-file-image-o',
            'pdf': 'fa-file-pdf-o',
            'video': 'fa-file-video-o',
            'audio': 'fa-file-audio-o'
        };
        return icons[item_type] || 'fa-file-o';
    };

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
     * Close the delete media modal
     */
    const close_delete_modal = () => {
        const modal_element = document.getElementById('delete-media-modal');
        
        if (!modal_element) return;

        // Try Bootstrap 5 first
        if (typeof bootstrap !== 'undefined' && 
            bootstrap.Modal && 
            typeof bootstrap.Modal.getInstance === 'function') {
            const modal = bootstrap.Modal.getInstance(modal_element);
            if (modal) {
                modal.hide();
                console.log('Delete media modal closed (Bootstrap 5)');
                return;
            }
        }
        
        // Try Bootstrap 4 / jQuery
        if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal('hide');
            console.log('Delete media modal closed (Bootstrap 4/jQuery)');
        }
        
        // Always perform manual cleanup
        setTimeout(() => {
            modal_element.classList.remove('show');
            modal_element.style.display = 'none';
            modal_element.setAttribute('aria-hidden', 'true');
            modal_element.removeAttribute('aria-modal');
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('overflow');
            
            // Remove all backdrops
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            
            console.log('Delete modal cleanup complete');
        }, 150);

        // Reset state
        current_delete_uuid = null;
        current_delete_name = null;
        delete_modal_callback = null;
    };

    /**
     * Handle delete confirmation
     */
    const handle_delete_confirm = async () => {
        const confirm_btn = document.getElementById('delete-media-confirm-btn');
        const uuid = current_delete_uuid;

        if (!uuid) {
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

            // Handle response
            if (response && response.status === HTTP_STATUS.OK && response.data?.success) {
                // Store callback reference before closing modal (close_delete_modal nullifies it)
                const callback = delete_modal_callback;

                // Close modal
                close_delete_modal();

                // Execute callback if provided (to refresh table and show success message)
                if (typeof callback === 'function') {
                    callback(true, 'Media record deleted successfully.');
                }

            } else {
                const error_message = response?.data?.message || 'Failed to delete media record.';
                display_delete_modal_message('danger', error_message);
            }

        } catch (error) {
            console.error('Error deleting media record:', error);
            display_delete_modal_message('danger', 'An unexpected error occurred while deleting the media record.');
        } finally {
            // Re-enable confirm button
            if (confirm_btn) {
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

        // Show modal
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = new bootstrap.Modal(modal_element, {
                backdrop: 'static',
                keyboard: false
            });
            modal.show();
        } else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal({
                backdrop: 'static',
                keyboard: false
            });
            $(modal_element).modal('show');
        } else {
            modal_element.classList.add('show');
            modal_element.style.display = 'block';
            document.body.classList.add('modal-open');
            
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'delete-media-modal-backdrop';
            document.body.appendChild(backdrop);
        }

        console.log('Delete media modal opened for: ' + name);
    };

    /**
     * Close the delete media modal (public method)
     */
    obj.close_delete_media_modal = function() {
        close_delete_modal();
    };

    return obj;

}());
