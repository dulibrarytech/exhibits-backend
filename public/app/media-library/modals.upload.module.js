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
    const get_media_type_icon = helperMediaLibraryModule.get_media_type_icon;
    const get_media_type_label = helperMediaLibraryModule.get_media_type_label;
    const format_file_size = helperMediaLibraryModule.format_file_size;
    const clean_filename_for_title = helperMediaLibraryModule.clean_filename_for_title;
    const build_media_url = helperMediaLibraryModule.build_media_url;
    const get_thumbnail_url_for_media = helperMediaLibraryModule.get_thumbnail_url_for_media;
    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    /**
     * Build the preview URL for a staged (not-yet-saved) upload thumbnail.
     * The record-keyed thumbnail endpoint 404s here because no media record
     * exists until Save, so serve the just-generated staged thumbnail by its
     * storage-relative path instead. Returns null when there is nothing to
     * serve or no way to authenticate the <img src> (caller then falls back
     * to the static placeholder).
     * @param {string} thumbnail_path - Relative staged thumbnail path
     * @returns {string|null}
     */
    const build_staged_thumbnail_url = (thumbnail_path) => {
        if (!thumbnail_path) {
            return null;
        }
        const endpoint = EXHIBITS_ENDPOINTS?.upload?.get?.endpoint;
        if (!endpoint) {
            return null;
        }
        const token = authModule.get_user_token();
        if (!token || token === false) {
            return null;
        }
        return endpoint +
            '?path=' + encodeURIComponent(thumbnail_path) +
            '&token=' + encodeURIComponent(token);
    };

    // Module state
    let uploaded_files_data = [];
    let saved_files_count = 0;
    let on_complete_callback = null;
    // Indices of files the curator removed from this batch via the per-card
    // Remove action. Excluded from the effective total so modal completion
    // (the "X of Y files saved" line and the Done button) still resolves.
    let removed_indices = new Set();

    let obj = {};

    /**
     * Update modal footer status
     */
    const update_modal_status = () => {

        const validation_message = document.getElementById('modal-validation-message');
        const done_btn = document.getElementById('uploaded-media-done-btn');
        // Effective total excludes files removed from the batch.
        const total = uploaded_files_data.length - removed_indices.size;

        if (validation_message) {
            if (total > 0 && saved_files_count === total) {
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

    /* Card-level status messages — shared helper (success auto-clears after 3 s) */
    const display_card_message = (card, type, message) => {
        helperMediaLibraryModule.display_card_message(card, type, message, { success_hide_ms: 3000 });
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

        return helperMediaLibraryModule.save_media_record(card, JSON.stringify(data), {
            save_button_selector: '.btn-save-file',
            message: display_card_message,
            error_log_label: 'file',
            on_success: () => {

                helperMediaLibraryModule.mark_card_saved(card, {
                    number_selector: '.file-number',
                    save_button_selector: '.btn-save-file',
                    /*
                     * The file is now a committed library record — Remove no
                     * longer applies here (deleting a saved record is the
                     * Media Library's own delete flow).
                     */
                    hide_selectors: ['.file-remove-area']
                });

                saved_files_count++;
                update_modal_status();

                display_card_message(card, 'success', 'Media record created successfully');
            }
        });
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
        // Auto-populate Item Type from the uploaded file's media type, using
        // the same canonical archival terms the repo import modal uses
        // (matched case-insensitively against the resource-type options by
        // the shared subjects widget): image → "still image", pdf → "text".
        const default_item_type = is_image ? 'still image' : (is_pdf ? 'text' : '');
        const escaped_original_name = escape_html(file_data.original_name || file_data.filename);
        const escaped_mime = escape_html(file_data.mime_type);

        // Default name from filename
        const default_name = clean_filename_for_title(file_data.original_name || file_data.filename);

        // Preview HTML
        let preview_html;
        if (is_image || is_pdf) {
            // These files are staged (not yet saved), so the record-keyed
            // thumbnail endpoint would 404. Prefer the staged thumbnail served
            // by its on-disk path; fall back to the static placeholder.
            const thumb_url = build_staged_thumbnail_url(file_data.thumbnail_path)
                || get_thumbnail_url_for_media(media_type, file_data.uuid);
            preview_html = '<img src="' + thumb_url + '" alt="' + display_name + '" style="max-width:100%;max-height:100%;object-fit:cover;" onerror="this.onerror=null; this.parentNode.innerHTML=\'<i class=\\\'fa ' + type_icon + ' file-icon\\\' aria-hidden=\\\'true\\\'></i>\';">';
        } else {
            preview_html = '<i class="fa ' + type_icon + ' file-icon" aria-hidden="true"></i>';
        }

        // Alt text field HTML (only for images - required)
        let alt_text_html = '';

        if (is_image) {
            alt_text_html = '<div class="col-md-6 mb-3">' +
                '<label class="form-label" for="file-alt-text-' + index + '">Alt Text <span class="badge badge-required">Required</span></label>' +
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
        html += '<label class="form-label" for="file-name-' + index + '">Name <span class="badge badge-required">Required</span></label>';
        html += '<input type="text" class="form-control file-name" id="file-name-' + index + '" name="name" value="' + escape_html(default_name) + '" placeholder="Enter a name" required aria-required="true">';
        html += '<div class="invalid-feedback">Please provide a name.</div>';
        html += '</div>';
        html += alt_text_html;
        html += '</div>';
        
        // Row 2: Description
        html += '<div class="row">';
        html += '<div class="col-12 mb-3">';
        html += '<label class="form-label" for="file-description-' + index + '-rte">Description <span class="badge badge-required">Required</span></label>';
        html += '<div class="rte-container rte-modal" id="file-description-' + index + '-rte" data-rte="full" data-rte-sync="file-description-' + index + '"></div>';
        html += '<textarea class="form-control file-description" id="file-description-' + index + '" name="description" hidden required aria-required="true"></textarea>';
        html += '<div class="invalid-feedback">Please provide a description.</div>';
        html += '</div></div>';
        
        // Subjects section — Topics, Genre/Form, Places, Item Type; built by the
        // shared helper, which also emits the role="group" + aria-describedby
        // instruction block (WCAG 1.3.1 / 3.3.2).
        html += repoSubjectsModule.build_subjects_html('file', index, {
            help_id: 'file-subjects-help-' + index,
            placeholders: {
                topics_subjects: 'Select a topic...',
                places_subjects: 'Select a place...'
            },
            selected: {
                item_type: default_item_type
            }
        });

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

        // Action row: Remove (left, low-emphasis destructive) opposite Save
        // (right, primary). Remove uses an inline two-step confirm so a
        // destructive click isn't a single misclick, without stacking a
        // modal over the upload modal.
        html += '<div class="row">';
        html += '<div class="col-12 d-flex justify-content-between align-items-center file-action-row">';
        html += '<div class="file-remove-area">';
        html += '<button type="button" class="btn btn-outline-danger btn-remove-file" data-file-index="' + index + '">';
        html += '<i class="fa fa-trash" style="margin-right: 6px;" aria-hidden="true"></i>Remove';
        html += '</button>';
        html += '<span class="file-remove-confirm" style="display: none;">';
        html += '<span class="text-danger fw-bold" style="margin-right: 8px;">Remove this file?</span>';
        html += '<button type="button" class="btn btn-sm btn-danger btn-remove-confirm" data-file-index="' + index + '" style="margin-right: 6px;">Yes, remove</button>';
        html += '<button type="button" class="btn btn-sm btn-outline-secondary btn-remove-cancel" data-file-index="' + index + '">Keep</button>';
        html += '</span>';
        html += '</div>';
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
     * Drop the card from the DOM and reconcile batch state. Pure UI/state —
     * called only after the staged file is confirmed gone server-side (or
     * when there is nothing to delete).
     * @param {HTMLElement} card
     * @param {number} index
     */
    const finalize_card_removal = (card, index) => {
        removed_indices.add(index);
        card.remove();
        update_modal_status();

        const summary_text = document.getElementById('upload-summary-text');
        if (summary_text) {
            const remaining = uploaded_files_data.length - removed_indices.size;
            const file_word = remaining === 1 ? 'file' : 'files';
            summary_text.textContent = remaining + ' ' + file_word + ' remaining to review. Please provide details for each file below.';
        }
    };

    /**
     * Restore the card's footer from the inline confirm back to the Remove
     * button (used when the server delete fails so the user can retry).
     * @param {HTMLElement} card
     */
    const restore_remove_button = (card) => {
        const area = card.querySelector('.file-remove-area');
        if (!area) return;
        const trigger = area.querySelector('.btn-remove-file');
        const confirm_el = area.querySelector('.file-remove-confirm');
        const confirm_btn = area.querySelector('.btn-remove-confirm');
        if (confirm_btn) { confirm_btn.disabled = false; confirm_btn.textContent = 'Yes, remove'; }
        if (confirm_el) confirm_el.style.display = 'none';
        if (trigger) trigger.style.display = 'inline-block';
    };

    /**
     * Remove a file's card from the batch. The staged (not-yet-saved) upload
     * is deleted from server storage first so it doesn't orphan on disk;
     * only on success is the card dropped (other cards keep their
     * in-progress metadata and original data-file-index mapping — no
     * re-render, no re-index). On failure the card is kept and an inline
     * error is shown so the user can retry. If there is no staged path or
     * the endpoint isn't configured, removal degrades to client-only
     * (the orphan-cleanup CLI is the backstop).
     * @param {number} index - The file's data-file-index
     */
    const remove_file_card = async (index) => {
        const card = document.querySelector('.file-form-card[data-file-index="' + index + '"]');
        if (!card) return;

        const storage_path = (card.querySelector('.file-storage-path') || {}).value || '';
        const thumbnail_path = (card.querySelector('.file-thumbnail-path') || {}).value || '';
        const endpoint = EXHIBITS_ENDPOINTS?.upload?.delete?.endpoint;
        const token = authModule.get_user_token();

        // Nothing to clean up server-side, or no way to reach it — drop the
        // card client-side (orphan-cleanup CLI is the backstop).
        if (!storage_path || !endpoint || !token || token === false) {
            if (!endpoint) console.warn('Upload delete endpoint not configured; removing card client-side only');
            finalize_card_removal(card, index);
            return;
        }

        const confirm_btn = card.querySelector('.btn-remove-confirm');
        if (confirm_btn) { confirm_btn.disabled = true; confirm_btn.textContent = 'Removing...'; }

        try {
            const response = await httpModule.api({
                method: 'DELETE',
                url: endpoint,
                data: JSON.stringify({ storage_path: storage_path, thumbnail_path: thumbnail_path || null })
            });

            if (response && response.status === 200 && response.data?.success) {
                finalize_card_removal(card, index);
                return;
            }

            const msg = response?.data?.message || 'Unable to remove the uploaded file. Please try again.';
            display_card_message(card, 'danger', msg);
            restore_remove_button(card);

        } catch (error) {
            console.error('Error removing uploaded file:', error);
            display_card_message(card, 'danger', 'An unexpected error occurred while removing the file.');
            restore_remove_button(card);
        }
    };

    /**
     * Setup per-card Remove handlers. Remove is a two-step inline confirm:
     * the Remove button reveals "Remove this file? Yes, remove / Keep" in
     * the same footer, so a destructive action needs an explicit second
     * click but no modal is stacked over the upload modal.
     */
    const setup_individual_remove_handlers = () => {
        document.querySelectorAll('.btn-remove-file').forEach(btn => {
            btn.addEventListener('click', function() {
                const area = this.closest('.file-remove-area');
                if (!area) return;
                const confirm_el = area.querySelector('.file-remove-confirm');
                this.style.display = 'none';
                if (confirm_el) confirm_el.style.display = 'inline-block';
            });
        });

        document.querySelectorAll('.btn-remove-cancel').forEach(btn => {
            btn.addEventListener('click', function() {
                const area = this.closest('.file-remove-area');
                if (!area) return;
                const trigger = area.querySelector('.btn-remove-file');
                const confirm_el = area.querySelector('.file-remove-confirm');
                if (confirm_el) confirm_el.style.display = 'none';
                if (trigger) trigger.style.display = 'inline-block';
            });
        });

        document.querySelectorAll('.btn-remove-confirm').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-file-index'), 10);
                remove_file_card(index);
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
        removed_indices.clear();

        // Clear existing content
        forms_container.innerHTML = '';

        // Build HTML for each file
        let all_html = '';
        uploaded_files_data.forEach((file_data, index) => {
            all_html += build_file_form_html(file_data, index);
        });

        // Insert HTML
        forms_container.innerHTML = all_html;

        // Instantiate description rich text editors (sync to hidden textareas)
        rteModule.init_all();

        // Setup individual save handlers
        setup_individual_save_handlers();

        // Setup individual remove handlers
        setup_individual_remove_handlers();

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

        console.debug('Populated modal with ' + uploaded_files_data.length + ' file forms');
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
        console.debug('Closing modal - ' + saved_files_count + ' files were saved');

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
        removed_indices.clear();
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

        // Cancel button: closes the modal at any point. Reuses handle_modal_done
        // because the cleanup is identical — close, refresh the table if anything
        // was already saved, fire the callback with the saved count, reset state.
        // Files saved via per-card Save remain saved (that's a server-side commit).
        const cancel_btn = document.getElementById('uploaded-media-cancel-btn');

        if (cancel_btn) {
            const new_cancel_btn = cancel_btn.cloneNode(true);
            cancel_btn.parentNode.replaceChild(new_cancel_btn, cancel_btn);
            new_cancel_btn.addEventListener('click', handle_modal_done);
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

        console.debug('Uploaded media modal opened with ' + uploaded_files_data.length + ' files');
    };

    /**
     * Close the uploaded media modal
     */
    obj.close_uploaded_media_modal = function() {
        close_modal();
        uploaded_files_data = [];
        saved_files_count = 0;
        removed_indices.clear();
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
     * Open the view media modal for an uploaded (or Kaltura-less local) asset.
     *
     * The dialog itself lives in viewMediaModalModule; only the two
     * upload-specific decisions are passed in here.
     *
     * @param {string} uuid - Media record UUID
     * @param {string} name - Media record name for header
     * @param {string} filename - Original filename for display
     * @param {string} size - Formatted file size
     * @param {string} media_type - Media type (image, pdf, etc.)
     * @param {string} ingest_method - Ingest method (upload, kaltura, etc.)
     * @param {Object} [record] - Full row record (for audit fields)
     */
    obj.open_view_media_modal = function(uuid, name, filename, size, media_type, ingest_method, record) {

        viewMediaModalModule.open({
            uuid: uuid,
            name: name,
            filename: filename,
            size: size,
            media_type: media_type,
            ingest_method: ingest_method,
            record: record,
            strategy: {

                /* Full edit-form parity: Name / Filename / File Size, then the shared tail. */
                build_info_html: (ctx) => {

                    const rows = [
                        ['Name', ctx.name || '-'],
                        ['Filename', ctx.filename || '-'],
                        ['File Size', ctx.size || '-']
                    ].concat(viewMediaModalModule.build_tail_rows(ctx));

                    return viewMediaModalModule.render_info_rows(rows);
                },

                /*
                 * UUID-based file endpoint, versioned by the record's updated
                 * timestamp so a freshly replaced file isn't served from the
                 * browser's long-lived cache of the previous one.
                 */
                resolve_media_url: (ctx) => {

                    const url = helperMediaLibraryModule.append_cache_version(
                        build_media_url(ctx.uuid),
                        ctx.record?.updated
                    );

                    if (!url) {
                        return null;
                    }

                    const token = authModule.get_user_token();
                    return url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
                }
            }
        });
    };

    /**
     * Close the view media modal (public method)
     */
    obj.close_view_media_modal = function() {
        viewMediaModalModule.close();
    };

    /**
     * Initialize the modals module
     */
    obj.init = function() {
        console.debug('Media modals module initialized');
        return true;
    };

    return obj;

}());
