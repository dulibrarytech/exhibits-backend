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

    // Shared helpers
    const escape_html = helperMediaLibraryModule.escape_html;
    const decode_html_entities = helperMediaLibraryModule.decode_html_entities;
    const get_media_type_icon = helperMediaLibraryModule.get_media_type_icon;
    const get_media_type_label = helperMediaLibraryModule.get_media_type_label;
    const format_file_size = helperMediaLibraryModule.format_file_size;
    const clean_filename_for_title = helperMediaLibraryModule.clean_filename_for_title;
    const build_media_url = helperMediaLibraryModule.build_media_url;
    const get_thumbnail_url_for_media = helperMediaLibraryModule.get_thumbnail_url_for_media;

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    // Module state
    let uploaded_files_data = [];
    let saved_files_count = 0;
    let on_complete_callback = null;

    let obj = {};

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

    // ========================================
    // EDIT MODAL DELEGATION (backward-compatible)
    // Delegates to mediaEditModalModule; prefer
    // calling mediaEditModalModule directly.
    // ========================================

    /**
     * @deprecated Use mediaEditModalModule.update_media_record() instead
     */
    obj.update_media_record = function(uuid, data) {
        return mediaEditModalModule.update_media_record(uuid, data);
    };

    /**
     * @deprecated Use mediaEditModalModule.open_edit_media_modal() instead
     */
    obj.open_edit_media_modal = function(uuid, callback) {
        return mediaEditModalModule.open_edit_media_modal(uuid, callback);
    };

    /**
     * @deprecated Use mediaEditModalModule.close_edit_media_modal() instead
     */
    obj.close_edit_media_modal = function() {
        return mediaEditModalModule.close_edit_media_modal();
    };

    // ========================================
    // UPLOAD MODAL FUNCTIONS
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
            if (key === 'size' || key === 'media_width' || key === 'media_height') {
                data[key] = value ? parseInt(value, 10) : null;
            } else {
                data[key] = value;
            }
        }

        // Attach EXIF metadata from the upload response (not in form fields)
        if (uploaded_files_data[index] && uploaded_files_data[index].metadata) {
            data.exif_data = JSON.stringify(uploaded_files_data[index].metadata);
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
        const escaped_original_name = escape_html(file_data.original_name || file_data.filename);
        const escaped_mime = escape_html(file_data.mime_type);

        // Default name from filename
        const default_name = clean_filename_for_title(file_data.original_name || file_data.filename);

        // Preview HTML
        let preview_html;
        if (is_image || is_pdf) {
            // Use server-generated thumbnail for images and PDFs
            const thumb_url = get_thumbnail_url_for_media(media_type, file_data.uuid);
            preview_html = '<img src="' + thumb_url + '" alt="' + display_name + '" style="max-width:100%;max-height:100%;object-fit:cover;" onerror="this.onerror=null; this.parentNode.innerHTML=\'<i class=\\\'fa ' + type_icon + ' file-icon\\\' aria-hidden=\\\'true\\\'></i>\';">';
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
        html += '<div class="file-name-display text-truncate" title="' + escaped_original_name + '">' + display_name + '</div>';
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
        
        // Hidden fields
        html += '<input type="hidden" class="file-storage-path" name="storage_path" value="' + escape_html(file_data.storage_path || '') + '">';
        html += '<input type="hidden" class="file-thumbnail-path" name="thumbnail_path" value="' + escape_html(file_data.thumbnail_path || '') + '">';
        html += '<input type="hidden" class="file-original-filename" name="original_filename" value="' + display_name + '">';
        html += '<input type="hidden" class="file-size" name="size" value="' + (file_data.file_size || 0) + '">';
        html += '<input type="hidden" class="file-media-type" name="media_type" value="' + media_type + '">';
        html += '<input type="hidden" class="file-mime-type" name="mime_type" value="' + escaped_mime + '">';
        html += '<input type="hidden" class="file-ingest-method" name="ingest_method" value="upload">';
        html += '<input type="hidden" class="file-media-width" name="media_width" value="' + (file_data.media_width || '') + '">';
        html += '<input type="hidden" class="file-media-height" name="media_height" value="' + (file_data.media_height || '') + '">';

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

        helperMediaLibraryModule.hide_bootstrap_modal(modal_element);
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

        // Open modal
        helperMediaLibraryModule.show_bootstrap_modal(modal_element);

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

    // ============================================
    // VIEW MEDIA MODAL FUNCTIONS
    // ============================================

    /**
     * Close the view media modal
     */
    const close_view_modal = () => {
        const modal_element = document.getElementById('view-media-modal');
        if (!modal_element) return;

        helperMediaLibraryModule.hide_bootstrap_modal(modal_element, () => {
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
        });
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
     * @param {string} ingest_method - Ingest method (upload, kaltura, etc.)
     */
    obj.open_view_media_modal = function(uuid, name, filename, size, media_type, ingest_method) {
        const modal_element = document.getElementById('view-media-modal');

        // Decode HTML entities in name to prevent double-encoding
        name = decode_html_entities(name);
        
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

        // Build media URL using UUID
        const media_url = build_media_url(uuid);
        
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

        // Show modal (dismissible)
        helperMediaLibraryModule.show_bootstrap_modal(modal_element, { backdrop: true, keyboard: true });

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
