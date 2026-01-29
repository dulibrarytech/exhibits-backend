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

    // Module state
    let uploaded_files_data = [];
    let saved_files_count = 0;
    let on_complete_callback = null;

    let obj = {};

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

    /** TODO
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
            if (saved_files_count === total) {
                done_btn.classList.remove('btn-outline-secondary');
                done_btn.classList.add('btn-success');
                done_btn.innerHTML = '<i class="fa fa-check" style="margin-right: 6px;" aria-hidden="true"></i>Done';
            }
        }
    };

    /**
     * Handle individual file save
     */
    const handle_individual_save = (index) => {
        const card = document.querySelector('.file-form-card[data-file-index="' + index + '"]');
        if (!card) {
            console.error('Card not found for index:', index);
            return;
        }

        const form = card.querySelector('.file-details-form');
        if (!form) {
            console.error('Form not found in card:', index);
            return;
        }

        // Validate form
        form.classList.add('was-validated');
        if (!form.checkValidity()) {
            console.log('Form validation failed for file:', index);
            return;
        }

        // Collect form data
        const form_data = new FormData(form);
        const data = Object.fromEntries(form_data.entries());
        data.index = index;

        console.log('Saving media details for file:', index, data);

        // TODO: Send data to server

        // Update card UI to show saved state
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

        const save_btn = card.querySelector('.btn-save-file');
        if (save_btn) {
            save_btn.disabled = true;
            save_btn.classList.remove('btn-primary');
            save_btn.classList.add('btn-success');
            save_btn.innerHTML = '<i class="fa fa-check" style="margin-right: 6px;" aria-hidden="true"></i>Saved';
        }

        saved_files_count++;
        update_modal_status();
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
        html += '<input type="text" class="form-control file-name" id="file-name-' + index + '" name="name" value="" placeholder="Enter a name" required aria-required="true">';
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
        html += '<select class="form-control form-select custom-select file-topics" id="file-topics-' + index + '" name="topics">';
        html += '<option value="">Select a topic...</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="file-genre-form-' + index + '">Genre/Form</label>';
        html += '<select class="form-control form-select custom-select file-genre-form" id="file-genre-form-' + index + '" name="genre_form">';
        html += '<option value="">Select genre/form...</option>';
        html += '</select>';
        html += '</div></div>';
        
        // Row 4: Places, Item Type dropdowns
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="file-places-' + index + '">Places</label>';
        html += '<select class="form-control form-select custom-select file-places" id="file-places-' + index + '" name="places">';
        html += '<option value="">Select a place...</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="file-item-type-' + index + '">Item Type</label>';
        html += '<select class="form-control form-select custom-select file-item-type" id="file-item-type-' + index + '" name="item_type">';
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
        html += '<input type="hidden" class="file-media-type" name="media_type" value="' + media_type + '">';
        html += '<input type="hidden" class="file-mime-type" name="mime_type" value="' + escaped_mime + '">';

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

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modal_element);
            if (modal) {
                modal.hide();
            }
        }
        else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal('hide');
        }
        else {
            modal_element.classList.remove('show');
            modal_element.style.display = 'none';
            document.body.classList.remove('modal-open');
            
            const backdrop = document.getElementById('uploaded-media-modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
        }

        console.log('Uploaded media modal closed');
    };

    /**
     * Handle done/close button click in modal
     */
    const handle_modal_done = () => {
        console.log('Closing modal - ' + saved_files_count + ' files were saved');

        close_modal();

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

    /**
     * Initialize the modals module
     */
    obj.init = function() {
        console.log('Media modals module initialized');
        return true;
    };

    return obj;

}());
