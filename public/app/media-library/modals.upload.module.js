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

const mediaModalsModule = (function() {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    // Module state
    let uploaded_files_data = [];
    let saved_files_count = 0;
    let on_complete_callback = null;

    // Edit modal state
    let edit_modal_callback = null;
    let current_edit_uuid = null;

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
     * Get application path safely
     */
    const get_app_path = () => {
        try {
            const app_path = window.localStorage.getItem('exhibits_app_path');
            if (!app_path) {
                return '/exhibits-dashboard';
            }
            return app_path;
        } catch (error) {
            return '/exhibits-dashboard';
        }
    };

    const APP_PATH = get_app_path();

    /**
     * Escape HTML to prevent XSS
     */
    const escape_html = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Clean filename for use as default title
     */
    const clean_filename_for_title = (filename) => {
        return filename
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    /**
     * Format file size for display
     */
    const format_file_size = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    /**
     * Get human-readable media type label
     */
    const get_media_type_label = (media_type) => {
        const labels = {
            'image': 'Image',
            'pdf': 'PDF Document',
            'video': 'Video',
            'audio': 'Audio',
            'unknown': 'Unknown'
        };
        return labels[media_type] || 'Unknown';
    };

    /**
     * Get Font Awesome icon class for media type
     */
    const get_media_type_icon = (media_type) => {
        const icons = {
            'image': 'fa-file-image-o',
            'pdf': 'fa-file-pdf-o',
            'video': 'fa-file-video-o',
            'audio': 'fa-file-audio-o',
            'unknown': 'fa-file-o'
        };
        return icons[media_type] || 'fa-file-o';
    };

    /**
     * Get thumbnail URL for media type
     */
    const get_thumbnail_url_for_media = (media_type, filename) => {
        const static_path = '/exhibits-dashboard/static/images';
        switch (media_type) {
            case 'image':
                return APP_PATH + '/media?media=' + encodeURIComponent(filename);
            case 'video':
                return static_path + '/video-tn.png';
            case 'audio':
                return static_path + '/audio-tn.png';
            case 'pdf':
                return static_path + '/pdf-tn.png';
            default:
                return static_path + '/default-tn.png';
        }
    };

    /**
     * Build media file URL for image display
     * @param {string} filename - The filename to build URL for
     * @returns {string|null} URL to media file
     */
    const build_media_url = (filename) => {
        if (!filename) return null;

        if (!EXHIBITS_ENDPOINTS?.media_file?.get?.endpoint) {
            console.warn('Media file endpoint not configured');
            return null;
        }

        const endpoint = EXHIBITS_ENDPOINTS.media_file.get.endpoint.replace(':filename', encodeURIComponent(filename));
        return endpoint;
    };

    /**
     * Get repository thumbnail URL for repo-ingested media
     * @param {string} uuid - Repository item UUID (repo_uuid)
     * @returns {string} Thumbnail URL or empty string
     */
    const get_repo_thumbnail_url = (uuid) => {
        if (!uuid) return '';

        // Use repoServiceModule's get_repo_tn_url if available
        if (typeof repoServiceModule !== 'undefined' && typeof repoServiceModule.get_repo_tn_url === 'function') {
            return repoServiceModule.get_repo_tn_url(uuid);
        }

        // Fallback: build the URL directly
        const token = authModule.get_user_token();
        if (!token) return '';

        if (!EXHIBITS_ENDPOINTS?.repo_thumbnail?.get?.endpoint) {
            console.warn('Repo thumbnail endpoint not configured');
            return '';
        }

        const endpoint = EXHIBITS_ENDPOINTS.repo_thumbnail.get.endpoint;
        return endpoint + '?uuid=' + encodeURIComponent(uuid) + '&token=' + encodeURIComponent(token);
    };

    /**
     * Update modal footer status
     */
    const update_modal_status = () => {

        const validation_message = document.getElementById('modal-validation-message');
        const done_btn = document.getElementById('uploaded-media-done-btn');
        const total = uploaded_files_data.length;
        
        if (validation_message) {
            if (saved_files_count === total) {
                validation_message.innerHTML = '<i class="fa fa-check-circle text-success" style="margin-right: 6px;"></i>All files saved!';
            } else {
                validation_message.textContent = saved_files_count + ' of ' + total + ' files saved';
            }
        }

        if (done_btn) {
            if (saved_files_count === total && total > 0) {
                done_btn.style.display = 'inline-block';
            } else {
                done_btn.style.display = 'none';
            }
        }
    };

    /**
     * Display status message in card
     * @param {HTMLElement} card - The card element
     * @param {string} type - Message type ('success', 'danger', 'warning')
     * @param {string} message - Message text
     */
    const display_card_message = (card, type, message) => {
        // Find or create message container
        let message_container = card.querySelector('.card-message');
        
        if (!message_container) {
            message_container = document.createElement('div');
            message_container.className = 'card-message mt-2';
            const card_body = card.querySelector('.card-body');
            if (card_body) {
                card_body.appendChild(message_container);
            }
        }

        message_container.innerHTML = '<div class="alert alert-' + type + ' mb-0" role="alert">' + 
            '<i class="fa fa-' + (type === 'success' ? 'check' : type === 'danger' ? 'exclamation-circle' : 'warning') + '" style="margin-right: 6px;"></i>' +
            escape_html(message) + 
            '</div>';

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (message_container.parentNode) {
                    message_container.innerHTML = '';
                }
            }, 3000);
        }
    };

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
        const type_label = get_media_type_label(media_type);
        const type_icon = get_media_type_icon(media_type);
        const file_size = format_file_size(record.size || 0);
        const display_name = escape_html(record.original_filename || record.filename || 'Unknown');

        // Get auth token for image URL
        const token = authModule.get_user_token();

        // Build preview HTML
        let preview_html;
        if (is_repo && record.repo_uuid) {
            // Repository item: use repo thumbnail endpoint
            const repo_tn_url = get_repo_thumbnail_url(record.repo_uuid);
            if (repo_tn_url) {
                preview_html = '<img src="' + repo_tn_url + '" alt="' + escape_html(record.name || 'Repository media') + '" class="img-fluid" style="max-width:100%;max-height:300px;object-fit:contain;" onerror="this.onerror=null; this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';">' +
                    '<i class="fa ' + type_icon + '" style="font-size: 80px; color: #6c757d; display: none;" aria-hidden="true"></i>';
            } else {
                preview_html = '<i class="fa ' + type_icon + '" style="font-size: 80px; color: #6c757d;" aria-hidden="true"></i>';
            }
        } else if (is_image && record.filename) {
            const media_url = build_media_url(record.filename);
            const img_url = media_url + (media_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
            preview_html = '<img src="' + img_url + '" alt="' + display_name + '" class="img-fluid" style="max-width:100%;max-height:300px;object-fit:contain;">';
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

        // PDF open to page field HTML (only for PDFs)
        let pdf_page_html = '';
        if (is_pdf) {
            pdf_page_html = '<div class="col-12 mb-3">' +
                '<div class="col-sm-4 my-1">' +
                '<label class="sr-only" for="edit-pdf-open-to-page">Open PDF to page</label>' +
                '<div class="input-group">' +
                '<div class="input-group-prepend">' +
                '<div class="input-group-text">Open PDF to page</div>' +
                '</div>' +
                '<input type="number" class="form-control" id="edit-pdf-open-to-page" name="pdf_open_to_page" min="1" value="' + (record.pdf_open_to_page || 1) + '">' +
                '</div>' +
                '</div>' +
                '<small class="form-text text-muted"><i class="fa fa-exclamation-circle"></i> <em>The viewer will automatically open to the page entered</em></small>' +
                '</div>';
        }

        // Build the form HTML
        let html = '<div class="row">';
        
        // Preview column
        html += '<div class="col-md-4 mb-3 mb-md-0">';
        html += '<div class="edit-preview-container text-center p-3 bg-light rounded">';
        html += '<div class="edit-preview mb-3">' + preview_html + '</div>';
        html += '<div class="file-meta small text-muted">';
        if (is_repo) {
            // Repository item: show "Repository media" with icon, no filename/size
            html += '<div class="mb-1"><i class="fa fa-database" style="margin-right: 4px;" aria-hidden="true"></i>Repository media</div>';
            html += '<span class="badge bg-secondary">' + type_label + '</span>';
        } else {
            // Uploaded item: show filename, size, and type badge
            html += '<div class="file-name-display text-truncate mb-1" title="' + display_name + '">' + display_name + '</div>';
            html += '<div class="file-size-display mb-1">' + file_size + '</div>';
            html += '<span class="badge bg-secondary">' + type_label + '</span>';
        }
        html += '</div></div></div>';
        
        // Form column
        html += '<div class="col-md-8">';
        html += '<form id="edit-media-form" class="edit-media-form" novalidate>';
        
        // Row 1: Name (required) and Alt Text (images only - required)
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
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
        
        // PDF open to page field (PDFs only)
        if (is_pdf) {
            html += '<div class="row">';
            html += pdf_page_html;
            html += '</div>';
        }

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
            if (key === 'pdf_open_to_page') {
                data[key] = value ? parseInt(value, 10) : null;
            } else if (key !== 'uuid') {
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

        // Try Bootstrap 5 first
        if (typeof bootstrap !== 'undefined' && 
            bootstrap.Modal && 
            typeof bootstrap.Modal.getInstance === 'function') {
            const modal = bootstrap.Modal.getInstance(modal_element);
            if (modal) {
                modal.hide();
                console.log('Edit media modal closed (Bootstrap 5)');
                return;
            }
        }
        
        // Try Bootstrap 4 / jQuery
        if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal('hide');
            console.log('Edit media modal closed (Bootstrap 4/jQuery)');
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
            
            console.log('Edit modal cleanup complete');
        }, 150);

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
            backdrop.id = 'edit-media-modal-backdrop';
            document.body.appendChild(backdrop);
        }

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

    // ========================================
    // UPLOAD MODAL FUNCTIONS (existing)
    // ========================================

    /**
     * Handle individual file save
     * @param {number} index - File index
     */
    const handle_individual_save = async (index) => {

        const card = document.querySelector('.file-form-card[data-file-index="' + index + '"]');

        if (!card) return;

        const form = card.querySelector('.file-details-form');
        if (!form) return;

        form.classList.add('was-validated');

        // Validate required subject fields (Genre/Form multi-select, Item Type)
        let subjects_valid = true;

        if (typeof repoSubjectsModule !== 'undefined' && typeof repoSubjectsModule.validate_required_fields === 'function') {
            subjects_valid = repoSubjectsModule.validate_required_fields(card);
        }

        if (!form.checkValidity() || !subjects_valid) return;

        const form_data = new FormData(form);
        
        // Convert FormData to plain JSON object
        const data = {};
        for (const [key, value] of form_data.entries()) {
            // Handle numeric fields
            if (key === 'size' || key === 'pdf_open_to_page') {
                data[key] = value ? parseInt(value, 10) : null;
            } else {
                data[key] = value;
            }
        }

        const save_btn = card.querySelector('.btn-save-file');

        // Show loading state
        if (save_btn) {
            save_btn.disabled = true;
            save_btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
        }

        try {

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_card_message(card, 'danger', 'Session expired. Please log in again.');

                setTimeout(() => {
                    authModule.logout();
                }, 2000);

                return false;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.media_records?.post?.endpoint) {
                display_card_message(card, 'danger', 'API endpoint configuration missing');
                if (save_btn) {
                    save_btn.disabled = false;
                    save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
                }
                return false;
            }

            // Construct endpoint
            const endpoint = EXHIBITS_ENDPOINTS.media_records.post.endpoint;

            // Make API request with JSON data
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            console.log('RESPONSE ', response);

            // Validate response - expect 201 Created
            if (!response || response.status !== 201) {
                const error_message = response?.data?.message || 'Failed to create media record';
                throw new Error(error_message);
            }

            const response_data = response.data;
            const new_item_id = response_data?.data;

            if (!new_item_id) {
                throw new Error('Server did not return a valid item ID');
            }

            // SUCCESS: Update UI to saved state
            card.classList.add('saved');

            const card_header = card.querySelector('.card-header');
            if (card_header) {
                card_header.classList.remove('bg-light');
                card_header.classList.add('bg-success', 'text-white');
            }

            const file_number = card.querySelector('.file-number');
            if (file_number) {
                file_number.innerHTML = '<i class="fa fa-check"></i>';
                file_number.style.backgroundColor = '#fff';
                file_number.style.color = '#198754';
            }

            // Disable inputs, textareas, and selects
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.setAttribute('readonly', true);
                input.classList.add('bg-light');
            });

            const selects = form.querySelectorAll('select');
            selects.forEach(select => {
                select.setAttribute('disabled', true);
                select.classList.add('bg-light');
            });

            if (save_btn) {
                save_btn.disabled = true;
                save_btn.classList.remove('btn-primary');
                save_btn.classList.add('btn-success');
                save_btn.innerHTML = '<i class="fa fa-check" style="margin-right: 6px;" aria-hidden="true"></i>Saved';
            }

            saved_files_count++;
            update_modal_status();

            // Show success message
            display_card_message(card, 'success', 'Media record created successfully');

        } catch (error) {
            console.error('Error saving file:', error);
            
            // Revert button state
            if (save_btn) {
                save_btn.disabled = false;
                save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
            }
            
            // Show error feedback to user
            display_card_message(card, 'danger', error.message || 'Failed to save media record');
        }
    };

    /**
     * Build file form HTML string with individual save button
     */
    const build_file_form_html = (file_data, index) => {

        const file_number = index + 1;
        const display_name = escape_html(file_data.original_name || file_data.filename);
        const media_type = file_data.media_type;
        const type_label = get_media_type_label(media_type);
        const type_icon = get_media_type_icon(media_type);
        const file_size = format_file_size(file_data.file_size);
        const is_image = media_type === 'image';
        const is_pdf = media_type === 'pdf';
        const escaped_filename = escape_html(file_data.filename);
        const escaped_mime = escape_html(file_data.mime_type);

        // Default name from filename
        const default_name = clean_filename_for_title(file_data.original_name || file_data.filename);

        // Preview HTML
        let preview_html;
        if (is_image) {
            const thumb_url = get_thumbnail_url_for_media(media_type, file_data.filename);
            preview_html = '<img src="' + thumb_url + '" alt="' + display_name + '" style="max-width:100%;max-height:100%;object-fit:cover;">';
        } else {
            preview_html = '<i class="fa ' + type_icon + ' file-icon" aria-hidden="true"></i>';
        }

        // Alt text field HTML (only for images - required)
        let alt_text_html = '';

        if (is_image) {
            alt_text_html = '<div class="col-md-6 mb-3">' +
                '<label class="form-label" for="file-alt-text-' + index + '">Alt Text <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control file-alt-text" id="file-alt-text-' + index + '" name="alt_text" placeholder="Describe the image for screen readers" required aria-required="true">' +
                '<div class="invalid-feedback">Please provide alt text for accessibility.</div>' +
                '<small class="form-text text-muted"><i class="fa fa-universal-access" style="margin-right: 8px;" aria-hidden="true"></i>Required for accessibility</small>' +
                '</div>';
        }

        // PDF open to page field HTML (only for PDFs)
        let pdf_page_html = '';
        if (is_pdf) {
            pdf_page_html = '<div class="col-12 mb-3">' +
                '<div class="col-sm-4 my-1">' +
                '<label class="sr-only" for="pdf-open-to-page-' + index + '">Open PDF to page</label>' +
                '<div class="input-group">' +
                '<div class="input-group-prepend">' +
                '<div class="input-group-text">Open PDF to page</div>' +
                '</div>' +
                '<input type="number" class="form-control" id="pdf-open-to-page-' + index + '" name="pdf_open_to_page" min="1" value="1">' +
                '</div>' +
                '</div>' +
                '<small class="form-text text-muted"><i class="fa fa-exclamation-circle"></i> <em>The viewer will automatically open to the page entered</em></small>' +
                '</div>';
        }

        // Build the complete card HTML
        let html = '<div class="file-form-card card mb-4" data-file-index="' + index + '">';
        
        // Card header
        html += '<div class="card-header bg-light d-flex align-items-center justify-content-between">';
        html += '<div class="d-flex align-items-center">';
        html += '<span class="file-number">' + file_number + '</span>';
        html += '<span class="file-form-title fw-bold" style="margin-left: 12px;">' + display_name + '</span>';
        html += '</div>';
        html += '<span class="badge bg-secondary file-type-badge type-' + media_type + '">' + type_label + '</span>';
        html += '</div>';
        
        // Card body
        html += '<div class="card-body">';
        html += '<div class="row">';
        
        // Preview column
        html += '<div class="col-md-3 mb-3 mb-md-0">';
        html += '<div class="file-preview-container text-center">';
        html += '<div class="file-preview mb-2">' + preview_html + '</div>';
        html += '<div class="file-meta small text-muted">';
        html += '<div class="file-name-display text-truncate" title="' + escaped_filename + '">' + display_name + '</div>';
        html += '<div class="file-size-display">' + file_size + '</div>';
        html += '</div></div></div>';
        
        // Form column
        html += '<div class="col-md-9">';
        html += '<form class="file-details-form" novalidate>';
        
        // Row 1: Name (required) and Alt Text (images only - required)
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="file-name-' + index + '">Name <span class="text-danger">*</span></label>';
        html += '<input type="text" class="form-control file-name" id="file-name-' + index + '" name="name" value="' + escape_html(default_name) + '" placeholder="Enter a name" required aria-required="true">';
        html += '<div class="invalid-feedback">Please provide a name.</div>';
        html += '</div>';
        html += alt_text_html;
        html += '</div>';
        
        // Row 2: Description
        html += '<div class="row">';
        html += '<div class="col-12 mb-3">';
        html += '<label class="form-label" for="file-description-' + index + '">Description</label>';
        html += '<textarea class="form-control file-description" id="file-description-' + index + '" name="description" rows="2" placeholder="Enter a description (optional)"></textarea>';
        html += '</div></div>';
        
        // Row 3: Topics, Genre/Form dropdowns
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="file-topics-' + index + '">Topics</label>';
        html += '<select class="form-control form-select custom-select file-topics" id="file-topics-' + index + '" name="topics_subjects">';
        html += '<option value="">Select a topic...</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="file-genre-form-' + index + '">Genre/Form <span class="text-danger">*</span></label>';
        html += '<select class="form-control form-select custom-select file-genre-form" id="file-genre-form-' + index + '" name="genre_form_subjects">';
        html += '<option value="">Select genre/form...</option>';
        html += '</select>';
        html += '</div></div>';
        
        // Row 4: Places, Item Type dropdowns
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="file-places-' + index + '">Places</label>';
        html += '<select class="form-control form-select custom-select file-places" id="file-places-' + index + '" name="places_subjects">';
        html += '<option value="">Select a place...</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="file-item-type-' + index + '">Item Type <span class="text-danger">*</span></label>';
        html += '<select class="form-control form-select custom-select file-item-type" id="file-item-type-' + index + '" name="item_type" required>';
        html += '<option value="">Select item type...</option>';
        html += '</select>';
        html += '</div></div>';
        
        // PDF open to page field (PDFs only)
        if (is_pdf) {
            html += '<div class="row">';
            html += pdf_page_html;
            html += '</div>';
        }
        
        // Hidden fields
        html += '<input type="hidden" class="file-filename" name="filename" value="' + escaped_filename + '">';
        html += '<input type="hidden" class="file-original-filename" name="original_filename" value="' + display_name + '">';
        html += '<input type="hidden" class="file-size" name="size" value="' + (file_data.file_size || 0) + '">';
        html += '<input type="hidden" class="file-media-type" name="media_type" value="' + media_type + '">';
        html += '<input type="hidden" class="file-mime-type" name="mime_type" value="' + escaped_mime + '">';
        html += '<input type="hidden" class="file-ingest-method" name="ingest_method" value="upload">';

        // Save button row
        html += '<div class="row">';
        html += '<div class="col-12 text-end">';
        html += '<button type="button" class="btn btn-primary btn-save-file" data-file-index="' + index + '">';
        html += '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
        html += '</button>';
        html += '</div></div>';
        
        html += '</form></div>';
        html += '</div></div>';
        html += '</div>';

        return html;
    };

    /**
     * Setup individual save button handlers
     */
    const setup_individual_save_handlers = () => {
        const save_buttons = document.querySelectorAll('.btn-save-file');
        save_buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-file-index'), 10);
                handle_individual_save(index);
            });
        });
    };

    /**
     * Populate the modal with individual forms for each uploaded file
     */
    const populate_modal = () => {
        const forms_container = document.getElementById('uploaded-files-forms-container');
        const summary_text = document.getElementById('upload-summary-text');

        if (!forms_container) {
            console.error('Modal forms container not found');
            return;
        }

        // Reset saved counter
        saved_files_count = 0;

        // Clear existing content
        forms_container.innerHTML = '';

        // Build HTML for each file
        let all_html = '';
        uploaded_files_data.forEach((file_data, index) => {
            all_html += build_file_form_html(file_data, index);
        });

        // Insert HTML
        forms_container.innerHTML = all_html;

        // Setup individual save handlers
        setup_individual_save_handlers();

        // Populate subject and resource type dropdowns (upgrades selects to multi-select widgets)
        if (typeof repoSubjectsModule !== 'undefined') {
            repoSubjectsModule.populate_subjects_dropdowns(forms_container);
        }

        // Update summary text
        if (summary_text) {
            const count = uploaded_files_data.length;
            const file_word = count === 1 ? 'file has' : 'files have';
            summary_text.textContent = count + ' ' + file_word + ' been uploaded to the media library. Please provide details for each file below.';
        }

        // Update status
        update_modal_status();

        // Store all filenames in hidden field
        const all_files_input = document.getElementById('modal-all-files');
        if (all_files_input) {
            all_files_input.value = uploaded_files_data.map(function(f) { return f.filename; }).join(',');
        }

        console.log('Populated modal with ' + uploaded_files_data.length + ' file forms');
    };

    /**
     * Close the uploaded media modal
     */
    const close_modal = () => {
        const modal_element = document.getElementById('uploaded-media-modal');
        
        if (!modal_element) return;

        // Try Bootstrap 5 first (check for getInstance method specifically)
        if (typeof bootstrap !== 'undefined' && 
            bootstrap.Modal && 
            typeof bootstrap.Modal.getInstance === 'function') {
            const modal = bootstrap.Modal.getInstance(modal_element);
            if (modal) {
                modal.hide();
                console.log('Uploaded media modal closed (Bootstrap 5)');
                return;
            }
        }
        
        // Try Bootstrap 4 / jQuery
        if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal('hide');
            console.log('Uploaded media modal closed (Bootstrap 4/jQuery)');
        }
        
        // Always perform manual cleanup to ensure modal is fully closed
        // This handles cases where Bootstrap's hide doesn't complete properly
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
            
            console.log('Modal cleanup complete');
        }, 150);
    };

    /**
     * Handle done/close button click in modal
     */
    const handle_modal_done = async () => {
        console.log('Closing modal - ' + saved_files_count + ' files were saved');

        close_modal();

        // Refresh the data table if files were saved
        if (saved_files_count > 0 && typeof mediaLibraryModule !== 'undefined' && typeof mediaLibraryModule.refresh_media_records === 'function') {
            await mediaLibraryModule.refresh_media_records();
        }

        // Execute callback if provided
        if (typeof on_complete_callback === 'function') {
            on_complete_callback(saved_files_count);
        }

        // Reset state
        uploaded_files_data = [];
        saved_files_count = 0;
        on_complete_callback = null;
    };

    /**
     * Setup modal button handlers
     */
    const setup_modal_handlers = () => {
        const done_btn = document.getElementById('uploaded-media-done-btn');

        if (done_btn) {
            // Remove existing listeners by cloning
            const new_done_btn = done_btn.cloneNode(true);
            done_btn.parentNode.replaceChild(new_done_btn, done_btn);
            new_done_btn.addEventListener('click', handle_modal_done);
        }
    };

    /**
     * Open the uploaded media modal
     * @param {Array} files_data - Array of uploaded file data objects
     * @param {Function} callback - Optional callback function when modal closes
     */
    obj.open_uploaded_media_modal = function(files_data, callback) {
        const modal_element = document.getElementById('uploaded-media-modal');
        
        if (!modal_element) {
            console.error('Uploaded media modal not found');
            return;
        }

        // Store data and callback
        uploaded_files_data = files_data || [];
        on_complete_callback = callback || null;

        // Setup modal button handlers
        setup_modal_handlers();

        // Populate modal with uploaded files data
        populate_modal();

        // Show form using helper module to fix CSS visibility
        if (typeof helperModule !== 'undefined' && typeof helperModule.show_form === 'function') {
            helperModule.show_form();
        }

        // Open modal using Bootstrap 5
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = new bootstrap.Modal(modal_element, {
                backdrop: 'static',
                keyboard: false
            });
            modal.show();
        } 
        // Fallback to Bootstrap 4 / jQuery
        else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal({
                backdrop: 'static',
                keyboard: false
            });
            $(modal_element).modal('show');
        }
        // Fallback to manual display
        else {
            modal_element.classList.add('show');
            modal_element.style.display = 'block';
            document.body.classList.add('modal-open');
            
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'uploaded-media-modal-backdrop';
            document.body.appendChild(backdrop);
        }

        console.log('Uploaded media modal opened with ' + uploaded_files_data.length + ' files');
    };

    /**
     * Close the uploaded media modal
     */
    obj.close_uploaded_media_modal = function() {
        close_modal();
        uploaded_files_data = [];
        saved_files_count = 0;
        on_complete_callback = null;
    };

    /**
     * Get count of saved files
     */
    obj.get_saved_count = function() {
        return saved_files_count;
    };

    /**
     * Get uploaded files data
     */
    obj.get_files_data = function() {
        return uploaded_files_data;
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
     * @param {Function} callback - Callback function(success, message) when delete completes
     */
    obj.open_delete_media_modal = function(uuid, name, filename, item_type, callback) {
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
            name_el.textContent = name || 'Untitled';
        }

        if (filename_el) {
            filename_el.textContent = filename || 'Unknown file';
        }

        if (icon_el) {
            // Update icon based on item type
            icon_el.className = 'fa ' + get_delete_icon_class(item_type) + ' fa-2x text-muted';
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

    // ============================================
    // VIEW MEDIA MODAL FUNCTIONS
    // ============================================

    /**
     * Close the view media modal
     */
    const close_view_modal = () => {
        const modal_element = document.getElementById('view-media-modal');
        
        if (!modal_element) {
            return;
        }

        // Try Bootstrap 5 first (check for getInstance method)
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal && typeof bootstrap.Modal.getInstance === 'function') {
            const modal_instance = bootstrap.Modal.getInstance(modal_element);
            if (modal_instance) {
                modal_instance.hide();
            }
        }
        // Try Bootstrap 4/jQuery
        else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal('hide');
        }
        
        // Manual cleanup
        setTimeout(() => {
            modal_element.classList.remove('show');
            modal_element.style.display = 'none';
            modal_element.setAttribute('aria-hidden', 'true');
            modal_element.removeAttribute('aria-modal');
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('overflow');
            
            // Remove backdrops
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());

            // Reset media elements
            const image_el = document.getElementById('view-media-image');
            const pdf_el = document.getElementById('view-media-pdf');
            if (image_el) {
                image_el.src = '';
                image_el.style.display = 'none';
                image_el.style.cursor = '';
                image_el.title = '';
                image_el.onclick = null;
            }
            if (pdf_el) {
                pdf_el.src = '';
            }

            // Remove repo handle hint if present
            const container = document.getElementById('view-media-container');
            if (container && container.parentNode) {
                const hint = container.parentNode.querySelector('.repo-handle-hint');
                if (hint) {
                    hint.remove();
                }
            }
        }, 150);
    };

    /**
     * Setup view modal event handlers
     */
    const setup_view_modal_handlers = () => {
        // Close button (X) handler
        const close_btn = document.getElementById('view-media-close-btn');
        if (close_btn) {
            const new_close_btn = close_btn.cloneNode(true);
            close_btn.parentNode.replaceChild(new_close_btn, close_btn);
            new_close_btn.addEventListener('click', close_view_modal);
        }

        // Cancel button handler
        const cancel_btn = document.getElementById('view-media-cancel-btn');
        if (cancel_btn) {
            const new_cancel_btn = cancel_btn.cloneNode(true);
            cancel_btn.parentNode.replaceChild(new_cancel_btn, cancel_btn);
            new_cancel_btn.addEventListener('click', close_view_modal);
        }
    };

    /**
     * Determine media type from filename extension
     * @param {string} filename - Filename to check
     * @returns {string} Media type ('image', 'pdf', or 'unknown')
     */
    const get_media_type_from_filename = (filename) => {
        if (!filename || typeof filename !== 'string') {
            return 'unknown';
        }
        
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        const image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const pdf_extensions = ['.pdf'];
        
        if (image_extensions.includes(ext)) {
            return 'image';
        }
        if (pdf_extensions.includes(ext)) {
            return 'pdf';
        }
        return 'unknown';
    };

    /**
     * Open the view media modal
     * @param {string} uuid - Media record UUID
     * @param {string} name - Media record name for header
     * @param {string} filename - Original filename for display
     * @param {string} size - Formatted file size
     * @param {string} media_type - Media type (image, pdf, etc.)
     * @param {string} storage_filename - Storage filename for URL building
     * @param {string} ingest_method - Ingest method (upload, kaltura, etc.)
     */
    obj.open_view_media_modal = function(uuid, name, filename, size, media_type, storage_filename, ingest_method) {
        const modal_element = document.getElementById('view-media-modal');
        
        if (!modal_element) {
            console.error('View media modal not found');
            return;
        }

        // Determine display type - use passed media_type, fallback to filename detection
        const display_type = (media_type && media_type !== 'N/A') 
            ? media_type.toLowerCase() 
            : get_media_type_from_filename(filename);

        // Update modal title
        const title_el = document.getElementById('view-media-modal-title');
        if (title_el) {
            title_el.textContent = name || 'View Media';
        }

        // Update file info - rebuild info section to ensure correct structure
        // (handles case where repo modal may have replaced the info HTML)
        const info_el = document.getElementById('view-media-info');
        if (info_el) {
            info_el.innerHTML = '<p class="mb-1">' +
                '<strong>File:</strong> ' +
                '<span id="view-media-filename">-</span>' +
                '</p>' +
                '<p class="mb-1">' +
                '<strong>Size:</strong> ' +
                '<span id="view-media-filesize">-</span>' +
                '</p>' +
                '<p class="mb-0">' +
                '<strong>Ingest Method:</strong> ' +
                '<span id="view-media-ingest-method">-</span>' +
                '</p>';
        }

        const filename_el = document.getElementById('view-media-filename');
        const filesize_el = document.getElementById('view-media-filesize');
        const ingest_method_el = document.getElementById('view-media-ingest-method');
        if (filename_el) {
            filename_el.textContent = filename || '-';
        }
        if (filesize_el) {
            filesize_el.textContent = size || '-';
        }
        if (ingest_method_el) {
            ingest_method_el.textContent = ingest_method || '-';
        }

        // Get elements
        const image_el = document.getElementById('view-media-image');
        const pdf_container = document.getElementById('view-media-pdf-container');
        const pdf_el = document.getElementById('view-media-pdf');
        const loading_el = document.getElementById('view-media-loading');
        const error_el = document.getElementById('view-media-error');

        // Reset display states
        if (image_el) image_el.style.display = 'none';
        if (pdf_container) pdf_container.style.display = 'none';
        if (loading_el) loading_el.style.display = 'block';
        if (error_el) error_el.style.display = 'none';

        // Build media URL
        const media_url = build_media_url(storage_filename);
        
        if (!media_url) {
            if (loading_el) loading_el.style.display = 'none';
            if (error_el) {
                error_el.style.display = 'block';
                const error_text = document.getElementById('view-media-error-text');
                if (error_text) error_text.textContent = 'Unable to build media URL.';
            }
            return;
        }

        // Add token for authentication
        const token = authModule.get_user_token();
        const authenticated_url = media_url + (media_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');

        // Setup event handlers
        setup_view_modal_handlers();

        // Show modal first
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = new bootstrap.Modal(modal_element, {
                backdrop: true,
                keyboard: true
            });
            modal.show();
        } else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal({
                backdrop: true,
                keyboard: true
            });
            $(modal_element).modal('show');
        } else {
            modal_element.classList.add('show');
            modal_element.style.display = 'block';
            document.body.classList.add('modal-open');
            
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }

        // Load media based on detected type
        if (display_type === 'image') {
            // Load image
            if (image_el) {
                image_el.onload = function() {
                    if (loading_el) loading_el.style.display = 'none';
                    image_el.style.display = 'block';
                };
                image_el.onerror = function() {
                    if (loading_el) loading_el.style.display = 'none';
                    if (error_el) {
                        error_el.style.display = 'block';
                        const error_text = document.getElementById('view-media-error-text');
                        if (error_text) error_text.textContent = 'Unable to load image.';
                    }
                };
                image_el.src = authenticated_url;
                image_el.alt = 'Preview of ' + (name || filename);
            }
        } else if (display_type === 'pdf') {
            // Load PDF in iframe
            if (pdf_el && pdf_container) {
                if (loading_el) loading_el.style.display = 'none';
                pdf_container.style.display = 'block';
                pdf_el.src = authenticated_url;
            }
        } else {
            // Unsupported type
            if (loading_el) loading_el.style.display = 'none';
            if (error_el) {
                error_el.style.display = 'block';
                const error_text = document.getElementById('view-media-error-text');
                if (error_text) error_text.textContent = 'This media type cannot be previewed.';
            }
        }

        console.log('View media modal opened for: ' + name);
    };

    /**
     * Close the view media modal (public method)
     */
    obj.close_view_media_modal = function() {
        close_view_modal();
    };

    /**
     * Initialize the modals module
     */
    obj.init = function() {
        console.log('Media modals module initialized');
        return true;
    };

    return obj;

}());
