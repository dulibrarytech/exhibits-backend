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

const mediaEditModalModule = (function() {

    'use strict';

    // Shared helpers
    const escape_html = helperMediaLibraryModule.escape_html;
    const decode_html_entities = helperMediaLibraryModule.decode_html_entities;
    const HTTP_STATUS = helperMediaLibraryModule.HTTP_STATUS;
    const get_media_type_icon = helperMediaLibraryModule.get_media_type_icon;
    const get_media_type_label = helperMediaLibraryModule.get_media_type_label;
    const format_file_size = helperMediaLibraryModule.format_file_size;
    const build_thumbnail_url = helperMediaLibraryModule.build_thumbnail_url;
    const build_media_url = helperMediaLibraryModule.build_media_url;
    const get_repo_thumbnail_url = helperMediaLibraryModule.get_repo_thumbnail_url;

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    /**
     * Format date for display in edit modal
     * @param {string|Date} date_value - Date to format
     * @returns {string} Formatted date string (MM/DD/YYYY @ HH:MM)
     */
    const format_edit_date = (date_value) => {
        if (!date_value) {
            return 'N/A';
        }

        try {
            const date = new Date(date_value);

            if (isNaN(date.getTime())) {
                return 'N/A';
            }

            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            return month + '/' + day + '/' + year + ' @ ' + hours + ':' + minutes;
        } catch (error) {
            return 'N/A';
        }
    };

    // Edit modal state
    let edit_modal_callback = null;
    let current_edit_uuid = null;

    let obj = {};

    /**
     * Display message in edit modal
     * @param {string} type - Message type ('success', 'danger', 'warning')
     * @param {string} message - Message text
     */
    const display_edit_modal_message = (type, message) => {
        const message_container = document.getElementById('edit-media-message');
        
        if (!message_container) return;

        message_container.innerHTML = '<div class="alert alert-' + type + ' mb-0" role="alert">' + 
            '<i class="fa fa-' + (type === 'success' ? 'check' : type === 'danger' ? 'exclamation-circle' : 'warning') + '" style="margin-right: 6px;"></i>' +
            escape_html(message) + 
            '</div>';

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (message_container) {
                    message_container.innerHTML = '';
                }
            }, 3000);
        }
    };

    /**
     * Clear edit modal message
     */
    const clear_edit_modal_message = () => {
        const message_container = document.getElementById('edit-media-message');
        if (message_container) {
            message_container.innerHTML = '';
        }
    };

    /**
     * Update a media record
     * @param {string} uuid - Media record UUID
     * @param {Object} data - Update data
     * @returns {Promise<Object>} Result object with success status
     */
    obj.update_media_record = async function(uuid, data) {

        try {

            if (!uuid || typeof uuid !== 'string') {
                return { success: false, message: 'Invalid UUID provided' };
            }

            if (!data || typeof data !== 'object') {
                return { success: false, message: 'Invalid update data provided' };
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.media_records?.put?.endpoint) {
                return { success: false, message: 'Update endpoint not configured' };
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                return { success: false, message: 'Session expired. Please log in again.' };
            }

            // Construct endpoint with media_id
            const endpoint = EXHIBITS_ENDPOINTS.media_records.put.endpoint.replace(':media_id', uuid);

            // Make API request
            const response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            // Handle response
            if (!response) {
                return { success: false, message: 'No response from server' };
            }

            if (response.status === HTTP_STATUS.OK && response.data?.success) {
                return { 
                    success: true, 
                    message: response.data.message || 'Media record updated successfully',
                    record: response.data.data
                };
            }

            return { 
                success: false, 
                message: response.data?.message || 'Failed to update media record' 
            };

        } catch (error) {
            console.error('Error updating media record:', error);
            return { success: false, message: error.message || 'Error updating media record' };
        }
    };

    // ========================================
    // EDIT MODAL FUNCTIONS
    // ========================================

    /**
     * Build edit form HTML for a media record
     * @param {Object} record - Media record data
     * @returns {string} HTML string for edit form
     */
    const build_edit_form_html = (record) => {

        const media_type = record.media_type || 'unknown';
        const is_image = media_type === 'image';
        const is_pdf = media_type === 'pdf';
        const is_repo = record.ingest_method === 'repository';
        const is_kaltura = record.ingest_method === 'kaltura';
        const type_label = get_media_type_label(media_type);
        const type_icon = get_media_type_icon(media_type);
        const file_size = format_file_size(record.size || 0);
        const display_name = escape_html(record.original_filename || record.filename || 'Unknown');

        // Get auth token for image URL
        const token = authModule.get_user_token();

        // Build preview HTML
        let preview_html;
        if (is_kaltura && record.kaltura_thumbnail_url) {
            // Kaltura item: use kaltura thumbnail URL from database
            preview_html = '<img src="' + escape_html(record.kaltura_thumbnail_url) + '" alt="' + escape_html(record.name || 'Kaltura media') + '" class="img-fluid" style="max-width:100%;max-height:300px;object-fit:contain;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';">' +
                '<i class="fa ' + type_icon + '" style="font-size: 80px; color: #6c757d; display: none;" aria-hidden="true"></i>';
        } else if (is_kaltura) {
            // Kaltura item without thumbnail: show type icon
            preview_html = '<i class="fa ' + type_icon + '" style="font-size: 80px; color: #6c757d;" aria-hidden="true"></i>';
        } else if (is_repo && record.repo_uuid) {
            // Repository item: use repo thumbnail endpoint
            const repo_tn_url = get_repo_thumbnail_url(record.repo_uuid);
            if (repo_tn_url) {
                preview_html = '<img src="' + repo_tn_url + '" alt="' + escape_html(record.name || 'Repository media') + '" class="img-fluid" style="max-width:100%;max-height:300px;object-fit:contain;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';">' +
                    '<i class="fa ' + type_icon + '" style="font-size: 80px; color: #6c757d; display: none;" aria-hidden="true"></i>';
            } else {
                preview_html = '<i class="fa ' + type_icon + '" style="font-size: 80px; color: #6c757d;" aria-hidden="true"></i>';
            }
        } else if (is_image && record.uuid) {
            const media_url = build_media_url(record.uuid);
            const img_url = media_url + (media_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
            preview_html = '<img src="' + img_url + '" alt="' + display_name + '" class="img-fluid" style="max-width:100%;max-height:300px;object-fit:contain;">';
        } else if (is_pdf && record.uuid && record.thumbnail_path) {
            // PDF with server-generated thumbnail
            const tn_url = build_thumbnail_url(record.uuid);
            const tn_img_url = tn_url + (tn_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
            preview_html = '<img src="' + tn_img_url + '" alt="' + display_name + '" class="img-fluid" style="max-width:100%;max-height:300px;object-fit:contain;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';">' +
                '<i class="fa ' + type_icon + '" style="font-size: 80px; color: #6c757d; display: none;" aria-hidden="true"></i>';
        } else {
            preview_html = '<i class="fa ' + type_icon + '" style="font-size: 80px; color: #6c757d;" aria-hidden="true"></i>';
        }

        // Alt text field HTML (only for images - required)
        let alt_text_html = '';
        if (is_image) {
            alt_text_html = '<div class="col-md-6 mb-3">' +
                '<label class="form-label" for="edit-file-alt-text">Alt Text <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control" id="edit-file-alt-text" name="alt_text" value="' + escape_html(record.alt_text || '') + '" placeholder="Describe the image for screen readers" required aria-required="true">' +
                '<div class="invalid-feedback">Please provide alt text for accessibility.</div>' +
                '<small class="form-text text-muted"><i class="fa fa-universal-access" style="margin-right: 8px;" aria-hidden="true"></i>Required for accessibility</small>' +
                '</div>';
        }

        // Name field column width: full width unless image (which has alt text beside it)
        const name_col_class = is_image ? 'col-md-6' : 'col-12';

        // Build the form HTML
        let html = '<div class="row">';
        
        // Preview column
        html += '<div class="col-md-4 mb-3 mb-md-0">';
        html += '<div class="edit-preview-container text-center p-3 bg-light rounded">';
        html += '<div class="edit-preview mb-3">' + preview_html + '</div>';

        // Unified metadata section
        html += '<div class="edit-media-meta small text-muted text-left" style="border-top: 1px solid #dee2e6; padding-top: 0.5rem;">';
        if (is_kaltura) {
            // Kaltura: show entry ID as identifier
            if (record.kaltura_entry_id) {
                html += '<div class="mb-1 text-truncate" title="Entry ID: ' + escape_html(record.kaltura_entry_id) + '"><strong>Entry ID:</strong> ' + escape_html(record.kaltura_entry_id) + '</div>';
            }
        } else if (is_repo) {
            // Repository: show repo UUID as identifier
            if (record.repo_uuid) {
                html += '<div class="mb-1 text-truncate" title="' + escape_html(record.repo_uuid) + '"><strong>Repo ID:</strong> ' + escape_html(record.repo_uuid) + '</div>';
            }
        } else {
            // Uploaded: show filename and file size
            html += '<div class="mb-1 text-truncate" title="' + display_name + '"><strong>Filename:</strong> ' + display_name + '</div>';
            html += '<div class="mb-1"><strong>File Size:</strong> ' + file_size + '</div>';
        }
        html += '<div class="mb-1"><strong>Media Type:</strong> ' + type_label + '</div>';
        html += '<div class="mb-1"><strong>Date Created:</strong> ' + format_edit_date(record.created) + '</div>';
        html += '<div class="mb-1"><strong>Added By:</strong> ' + escape_html(record.created_by || 'N/A') + '</div>';
        html += '<div><strong>Updated By:</strong> ' + escape_html(record.updated_by || 'N/A') + '</div>';
        html += '</div>';

        html += '</div></div>'; // close edit-preview-container, col-md-4
        
        // Form column
        html += '<div class="col-md-8">';
        html += '<form id="edit-media-form" class="edit-media-form" novalidate>';
        
        // Row 1: Name (required) and Alt Text (images only - required)
        html += '<div class="row">';
        html += '<div class="' + name_col_class + ' mb-3">';
        html += '<label class="form-label" for="edit-file-name">Name <span class="text-danger">*</span></label>';
        html += '<input type="text" class="form-control" id="edit-file-name" name="name" value="' + escape_html(record.name || '') + '" placeholder="Enter a name" required aria-required="true">';
        html += '<div class="invalid-feedback">Please provide a name.</div>';
        html += '</div>';
        html += alt_text_html;
        html += '</div>';
        
        // Row 2: Description
        html += '<div class="row">';
        html += '<div class="col-12 mb-3">';
        html += '<label class="form-label" for="edit-file-description">Description</label>';
        html += '<textarea class="form-control" id="edit-file-description" name="description" rows="3" placeholder="Enter a description (optional)">' + escape_html(record.description || '') + '</textarea>';
        html += '</div></div>';
        
        // Row 3: Topics, Genre/Form dropdowns
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="edit-file-topics">Topics</label>';
        html += '<select class="form-control form-select custom-select" id="edit-file-topics" name="topics_subjects" data-selected="' + escape_html(record.topics_subjects || '') + '">';
        html += '<option value="">Select a topic...</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="edit-file-genre-form">Genre/Form <span class="text-danger">*</span></label>';
        html += '<select class="form-control form-select custom-select" id="edit-file-genre-form" name="genre_form_subjects" data-selected="' + escape_html(record.genre_form_subjects || '') + '">';
        html += '<option value="">Select genre/form...</option>';
        html += '</select>';
        html += '</div></div>';
        
        // Row 4: Places, Item Type dropdowns
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="edit-file-places">Places</label>';
        html += '<select class="form-control form-select custom-select" id="edit-file-places" name="places_subjects" data-selected="' + escape_html(record.places_subjects || '') + '">';
        html += '<option value="">Select a place...</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="edit-file-item-type">Item Type <span class="text-danger">*</span></label>';
        html += '<select class="form-control form-select custom-select" id="edit-file-item-type" name="item_type" required data-selected="' + escape_html(record.item_type || '') + '">';
        html += '<option value="">Select item type...</option>';
        html += '</select>';
        html += '</div></div>';

        // Hidden fields
        html += '<input type="hidden" id="edit-file-uuid" name="uuid" value="' + escape_html(record.uuid || '') + '">';
        
        html += '</form></div>';
        html += '</div>';

        return html;
    };

    /**
     * Handle edit form submission
     */
    const handle_edit_form_submit = async () => {

        const form = document.getElementById('edit-media-form');
        if (!form) return;

        // Validate form
        form.classList.add('was-validated');

        // Validate required subject fields (Genre/Form multi-select, Item Type)
        let subjects_valid = true;
        const edit_form_container = document.getElementById('edit-media-form-container');

        if (typeof repoSubjectsModule !== 'undefined' && typeof repoSubjectsModule.validate_required_fields === 'function') {
            subjects_valid = repoSubjectsModule.validate_required_fields(edit_form_container || form);
        }

        if (!form.checkValidity() || !subjects_valid) {
            return;
        }

        const uuid = current_edit_uuid;
        if (!uuid) {
            display_edit_modal_message('danger', 'No media record selected for editing');
            return;
        }

        // Get form data
        const form_data = new FormData(form);
        const data = {};

        for (const [key, value] of form_data.entries()) {
            if (key !== 'uuid') {
                data[key] = value;
            }
        }

        // Get save button and show loading state
        const save_btn = document.getElementById('edit-media-save-btn');
        if (save_btn) {
            save_btn.disabled = true;
            save_btn.innerHTML = '<i class="fa fa-spinner fa-spin" style="margin-right: 6px;"></i>Saving...';
        }

        // Clear previous messages
        clear_edit_modal_message();

        try {
            // Call update API
            const result = await obj.update_media_record(uuid, data);

            if (result.success) {
                display_edit_modal_message('success', result.message || 'Media record updated successfully');

                // Store callback reference before closing modal (close_edit_modal nullifies it)
                const callback = edit_modal_callback;

                // Close modal after short delay
                setTimeout(() => {
                    close_edit_modal();

                    // Execute callback if provided (to refresh table)
                    if (typeof callback === 'function') {
                        callback();
                    }
                }, 1500);

            } else {
                display_edit_modal_message('danger', result.message || 'Failed to update media record');
                
                // Re-enable save button
                if (save_btn) {
                    save_btn.disabled = false;
                    save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;"></i>Save Changes';
                }
            }

        } catch (error) {
            console.error('Error saving media record:', error);
            display_edit_modal_message('danger', error.message || 'An error occurred while saving');
            
            // Re-enable save button
            if (save_btn) {
                save_btn.disabled = false;
                save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;"></i>Save Changes';
            }
        }
    };

    /**
     * Setup edit modal event handlers
     */
    const setup_edit_modal_handlers = () => {
        // Save button handler
        const save_btn = document.getElementById('edit-media-save-btn');
        if (save_btn) {
            // Remove existing listeners by cloning
            const new_save_btn = save_btn.cloneNode(true);
            save_btn.parentNode.replaceChild(new_save_btn, save_btn);
            new_save_btn.addEventListener('click', handle_edit_form_submit);
        }

        // Cancel/close button handlers
        const cancel_btn = document.getElementById('edit-media-cancel-btn');
        if (cancel_btn) {
            const new_cancel_btn = cancel_btn.cloneNode(true);
            cancel_btn.parentNode.replaceChild(new_cancel_btn, cancel_btn);
            new_cancel_btn.addEventListener('click', close_edit_modal);
        }
    };

    /**
     * Close the edit media modal
     */
    const close_edit_modal = () => {
        const modal_element = document.getElementById('edit-media-modal');
        if (!modal_element) return;

        helperMediaLibraryModule.hide_bootstrap_modal(modal_element);

        // Reset state
        current_edit_uuid = null;
        edit_modal_callback = null;
    };

    /**
     * Open the edit media modal
     * @param {string} uuid - Media record UUID
     * @param {Function} callback - Optional callback function when modal closes after save
     */
    obj.open_edit_media_modal = async function(uuid, callback) {
        const modal_element = document.getElementById('edit-media-modal');
        const form_container = document.getElementById('edit-media-form-container');
        const loading_indicator = document.getElementById('edit-media-loading');
        
        if (!modal_element) {
            console.error('Edit media modal not found');
            return;
        }

        if (!form_container) {
            console.error('Edit media form container not found');
            return;
        }

        // Store callback and UUID
        edit_modal_callback = callback || null;
        current_edit_uuid = uuid;

        // Clear previous content and messages
        form_container.innerHTML = '';
        clear_edit_modal_message();

        // Show loading indicator
        if (loading_indicator) {
            loading_indicator.style.display = 'block';
        }

        // Show modal
        helperMediaLibraryModule.show_bootstrap_modal(modal_element);

        // Fetch media record data
        const record = await mediaLibraryModule.get_media_record(uuid);

        // Hide loading indicator
        if (loading_indicator) {
            loading_indicator.style.display = 'none';
        }

        if (!record) {
            form_container.innerHTML = '<div class="alert alert-danger">Failed to load media record. Please try again.</div>';
            return;
        }

        // Build and display edit form
        form_container.innerHTML = build_edit_form_html(record);

        // Populate subject and resource type dropdowns (upgrades selects to multi-select widgets)
        if (typeof repoSubjectsModule !== 'undefined') {
            await repoSubjectsModule.populate_subjects_dropdowns(form_container);
        }

        // Setup event handlers
        setup_edit_modal_handlers();

        // Re-enable save button
        const save_btn = document.getElementById('edit-media-save-btn');
        if (save_btn) {
            save_btn.disabled = false;
            save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;"></i>Save Changes';
        }

        console.log('Edit media modal opened for UUID:', uuid);
    };

    /**
     * Close the edit media modal (public method)
     */
    obj.close_edit_media_modal = function() {
        close_edit_modal();
    };

    /**
     * Initialize the edit modal module
     */
    obj.init = function() {
        console.log('Media edit modal module initialized');
        return true;
    };

    return obj;

}());
