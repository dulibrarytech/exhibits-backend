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

const repoModalsModule = (function() {

    'use strict';

    // Shared helpers
    const escape_html = helperMediaLibraryModule.escape_html;
    const decode_html_entities = helperMediaLibraryModule.decode_html_entities;
    const HTTP_STATUS = helperMediaLibraryModule.HTTP_STATUS;
    const get_media_type_icon = helperMediaLibraryModule.get_media_type_icon;
    const get_media_type_label = helperMediaLibraryModule.get_media_type_label;
    const build_media_url = helperMediaLibraryModule.build_media_url;
    const get_repo_thumbnail_url = helperMediaLibraryModule.get_repo_thumbnail_url;

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    // Module state for repo import modal
    let imported_items_data = [];
    let saved_items_count = 0;
    let on_complete_callback = null;

    let obj = {};

    /**
     * Extract and categorize subjects from a repository display_record.
     *
     * Each subject's `terms[]` is iterated and *every* term is routed to the
     * bucket matching that term's own `type` ('topical' → Topics,
     * 'genre_form' → Genre/Form, 'geographic' → Places). This is required
     * because a single subject heading (e.g. "Student protesters -- Colorado
     * -- Denver") is a compound of multiple typed terms — a topical term plus
     * geographic terms — that belong in different dropdowns. The previous
     * implementation classified the whole subject into one bucket by its
     * first-matching term type and pushed the concatenated `subject.title`,
     * which both put the wrong (un-matchable) value into the dropdown and
     * dropped the other terms entirely.
     *
     * Subjects with no `terms[]` array fall back to authority-based mapping of
     * the whole `subject.title`. Values are de-duplicated (the same term can
     * appear across multiple compound subjects, e.g. "Colorado"/"Denver").
     *
     * @param {Object|null} display_record - The display_record from a repo item
     * @returns {Object} { topics: string, genre_form: string, places: string, resource_type: string }
     *                    Each value is a pipe-separated string for data-selected
     *                    attributes. Pipe (not ", ") is used because a single LCSH
     *                    heading can itself contain ", " (e.g. "Vietnam War,
     *                    1961-1975"); a comma join+split would shred such a term.
     *                    Subject headings never contain a literal pipe, so it is a
     *                    collision-free separator shared with the DB storage format
     *                    and the multi-select widget consumer.
     */
    const extract_repo_subjects = (display_record) => {
        const result = { topics: '', genre_form: '', places: '', resource_type: '' };

        if (!display_record) {
            return result;
        }

        // Extract resource_type for Item Type pre-selection
        if (display_record.resource_type) {
            result.resource_type = display_record.resource_type;
        }

        if (Array.isArray(display_record.subjects)) {
            const topics = [];
            const genre_form = [];
            const places = [];

            const push_unique = (arr, value) => {
                const v = (typeof value === 'string') ? value.trim() : '';
                if (v && arr.indexOf(v) === -1) arr.push(v);
            };

            display_record.subjects.forEach(subject => {
                if (!subject) return;

                const terms = Array.isArray(subject.terms) ? subject.terms : [];

                if (terms.length > 0) {
                    // Route each term individually by its own type.
                    terms.forEach(t => {
                        if (!t || typeof t.type !== 'string') return;
                        const type = t.type.trim().toLowerCase();
                        const value = (typeof t.term === 'string') ? t.term : '';
                        if (type === 'topical') {
                            push_unique(topics, value);
                        } else if (type === 'genre_form') {
                            push_unique(genre_form, value);
                        } else if (type === 'geographic') {
                            push_unique(places, value);
                        }
                        // Other term types (e.g. temporal) have no dropdown — skipped.
                    });
                } else if (subject.title) {
                    // No terms[] — classify the whole title by authority.
                    const authority = (subject.authority || '').toLowerCase();
                    if (authority === 'lcsh') push_unique(topics, subject.title);
                    else if (authority === 'aat') push_unique(genre_form, subject.title);
                    else if (authority === 'lcnaf') push_unique(places, subject.title);
                }
            });

            if (topics.length > 0) result.topics = topics.join('|');
            if (genre_form.length > 0) result.genre_form = genre_form.join('|');
            if (places.length > 0) result.places = places.join('|');
        }

        return result;
    };

    /**
     * Derive media_type from a MIME type string.
     * MIME type is the sole source of truth for media_type classification.
     * @param {string|null} mime_type - MIME type (e.g. 'image/tiff', 'application/pdf')
     * @returns {string} One of: 'image', 'pdf', 'audio', 'video', or 'unknown'
     */
    const derive_media_type = (mime_type) => {
        if (!mime_type || typeof mime_type !== 'string') return 'unknown';

        const mt = mime_type.toLowerCase();

        if (mt.startsWith('image/')) return 'image';
        if (mt === 'application/pdf') return 'pdf';
        if (mt.startsWith('audio/')) return 'audio';
        if (mt.startsWith('video/')) return 'video';

        return 'unknown';
    };

    /**
     * Derive an Item Type label when display_record.resource_type is missing.
     * Some repository records don't carry an explicit resource_type on the
     * display_record. Falls back to the top-level `type` field, then to a
     * mime-type-derived canonical archival term (still image / moving image /
     * sound recording / text). The Item Type dropdown matches case-insensitively
     * against option labels, so casing here doesn't matter.
     * @param {Object} item_data - The repository item data
     * @returns {string} A best-guess resource type label, or empty string
     */
    const derive_item_type_fallback = (item_data) => {
        if (!item_data || typeof item_data !== 'object') return '';
        if (typeof item_data.type === 'string' && item_data.type.trim()) {
            return item_data.type.trim();
        }
        const mt = (item_data.mime_type || '').toLowerCase().trim();
        if (mt.startsWith('image/')) return 'still image';
        if (mt.startsWith('video/')) return 'moving image';
        if (mt.startsWith('audio/')) return 'sound recording';
        if (mt === 'application/pdf') return 'text';
        return '';
    };

    /**
     * Extract the archival local identifier (e.g. "U116.01.0001.00050") from a
     * repository item. Lives in display_record.identifiers as the entry whose
     * `type === "local"`. Returns the raw identifier value (NOT html-escaped)
     * for use in API payloads; HTML callers should escape as needed.
     * @param {Object} item_data - The repository item data
     * @returns {string} The local identifier value, or empty string if absent
     */
    const get_local_identifier = (item_data) => {
        const ids = item_data && item_data.display_record && item_data.display_record.identifiers;
        if (!Array.isArray(ids)) return '';
        const entry = ids.find(i => i && i.type === 'local' && i.identifier);
        return entry ? entry.identifier : '';
    };

    // Separator used when joining multiple part filenames for a compound repo
    // record. Chosen because filenames almost never contain "; " — keeps the
    // joined string parseable when we later need to count or split it back out.
    const PART_FILENAMES_JOINER = '; ';

    /**
     * Build a joined filename string from a repository item's parts array.
     * Each part's `title` is a filename (e.g. "U116.01.0001.00050.tif").
     * Single-part records yield one filename; compound records yield a
     * joined list. Returns the raw value (NOT html-escaped).
     * @param {Object} item_data - The repository item data
     * @returns {string} Joined filename(s), or empty string if absent
     */
    const get_part_filenames = (item_data) => {
        const parts = item_data && item_data.display_record && item_data.display_record.parts;
        if (!Array.isArray(parts)) return '';
        const titles = parts
            .map(p => (p && typeof p.title === 'string') ? p.title.trim() : '')
            .filter(t => t.length > 0);
        return titles.join(PART_FILENAMES_JOINER);
    };

    /**
     * Format a stored filename string for display under the thumbnail.
     * Single-part → "Filename"; compound → "Files (N)". Caller html-escapes
     * the returned `value`.
     * @param {string} filename - The stored filename string (possibly joined)
     * @returns {{label: string, value: string}|null} Display info, or null if empty
     */
    const format_filename_display = (filename) => {
        if (!filename || typeof filename !== 'string') return null;
        const trimmed = filename.trim();
        if (!trimmed) return null;
        const parts = trimmed.split(PART_FILENAMES_JOINER).filter(s => s.length > 0);
        const label = parts.length > 1 ? 'Files (' + parts.length + ')' : 'Filename';
        return { label: label, value: trimmed };
    };

    // ========================================
    // REPO IMPORT MODAL FUNCTIONS
    // ========================================

    /**
     * Update repo import modal footer status
     */
    const update_repo_modal_status = () => {
        const validation_message = document.getElementById('repo-modal-validation-message');
        const done_btn = document.getElementById('repo-media-done-btn');
        const total = imported_items_data.length;

        if (validation_message) {
            if (saved_items_count === total) {
                validation_message.innerHTML = '<i class="fa fa-check-circle text-success" style="margin-right: 6px;"></i>All items saved!';
            } else {
                validation_message.textContent = saved_items_count + ' of ' + total + ' items saved';
            }
        }

        if (done_btn) {
            if (saved_items_count === total && total > 0) {
                done_btn.style.display = 'inline-block';
            } else {
                done_btn.style.display = 'none';
            }
        }
    };

    /**
     * Display status message in repo import card
     * @param {HTMLElement} card - The card element
     * @param {string} type - Message type ('success', 'danger', 'warning')
     * @param {string} message - Message text
     */
    const display_repo_card_message = (card, type, message) => {
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
     * Handle individual repo item save
     * @param {number} index - Index of the item in imported_items_data
     */
    const handle_repo_individual_save = async (index) => {
        const card = document.querySelector('.repo-form-card[data-item-index="' + index + '"]');
        const form = card ? card.querySelector('.repo-details-form') : null;
        const save_btn = card ? card.querySelector('.btn-save-repo-item') : null;

        if (!card || !form) {
            console.error('Card or form not found for index:', index);
            return;
        }

        // Validate form
        form.classList.add('was-validated');

        // Validate required subject fields (Genre/Form multi-select, Item Type)
        let subjects_valid = true;

        if (typeof repoSubjectsModule !== 'undefined' && typeof repoSubjectsModule.validate_required_fields === 'function') {
            subjects_valid = repoSubjectsModule.validate_required_fields(card);
        }

        if (!form.checkValidity() || !subjects_valid) {
            return;
        }

        // Get item data
        const item_data = imported_items_data[index];
        if (!item_data) {
            display_repo_card_message(card, 'danger', 'Item data not found');
            return;
        }

        // Show loading state
        if (save_btn) {
            save_btn.disabled = true;
            save_btn.innerHTML = '<i class="fa fa-spinner fa-spin" style="margin-right: 6px;" aria-hidden="true"></i>Saving...';
        }

        try {
            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.media_records?.post?.endpoint) {
                throw new Error('Media records endpoint not configured');
            }

            // Validate authentication
            const token = authModule.get_user_token();
            if (!token || token === false) {
                throw new Error('Session expired. Please log in again.');
            }

            // Get form data
            const form_data = new FormData(form);
            
            // Build media record data from form and repo item
            const media_data = {
                name: form_data.get('name') || item_data.title || 'Untitled',
                description: form_data.get('description') || '',
                alt_text: form_data.get('alt_text') || '',
                topics_subjects: form_data.get('topics_subjects') || null,
                genre_form_subjects: form_data.get('genre_form_subjects') || null,
                places_subjects: form_data.get('places_subjects') || null,
                item_type: form_data.get('item_type') || null,
                repo_uuid: item_data.uuid,
                repo_handle: item_data.handle || null,
                call_number: get_local_identifier(item_data) || null,
                original_filename: get_part_filenames(item_data) || null,
                mime_type: item_data.mime_type || null,
                media_type: derive_media_type(item_data.mime_type),
                ingest_method: 'repository'
            };

            const endpoint = EXHIBITS_ENDPOINTS.media_records.post.endpoint;

            // Helper to reset the save button on error paths
            const reset_save_btn = () => {
                if (save_btn) {
                    save_btn.disabled = false;
                    save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
                }
            };

            // Make API request
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: JSON.stringify(media_data),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            // Handle undefined response (network/server error)
            if (!response) {
                display_repo_card_message(card, 'danger', 'Unable to save media record. Please check your connection and try again.');
                reset_save_btn();
                return;
            }

            // Handle 403 Forbidden
            if (response.status === HTTP_STATUS.FORBIDDEN) {
                display_repo_card_message(card, 'danger', response.data?.message || 'You do not have permission to create media records.');
                reset_save_btn();
                return;
            }

            // Handle 400 Bad Request
            if (response.status === HTTP_STATUS.BAD_REQUEST) {
                display_repo_card_message(card, 'danger', response.data?.message || 'Invalid media data. Please check the form and try again.');
                reset_save_btn();
                return;
            }

            // Handle success - expect 201 Created
            if (response.status !== HTTP_STATUS.CREATED || !response.data?.success) {
                const error_message = response.data?.message || 'Failed to create media record.';
                display_repo_card_message(card, 'danger', error_message);
                reset_save_btn();
                return;
            }

            const response_data = response.data;
            const new_item_id = response_data?.data;

            if (!new_item_id) {
                display_repo_card_message(card, 'danger', 'Server did not return a valid item ID.');
                reset_save_btn();
                return;
            }

            // SUCCESS: Update UI to saved state
            card.classList.add('saved');

            const card_header = card.querySelector('.card-header');
            if (card_header) {
                card_header.classList.remove('bg-light');
                card_header.classList.add('bg-success', 'text-white');
            }

            const item_number = card.querySelector('.item-number');
            if (item_number) {
                item_number.innerHTML = '<i class="fa fa-check"></i>';
                item_number.style.backgroundColor = '#fff';
                item_number.style.color = '#198754';
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

            saved_items_count++;
            update_repo_modal_status();

            // Show success message
            display_repo_card_message(card, 'success', 'Media record created successfully');

        } catch (error) {
            // Catch block is reserved for truly unexpected errors (runtime exceptions, not HTTP failures)
            console.error('Error saving repo item:', error);

            // Revert button state
            if (save_btn) {
                save_btn.disabled = false;
                save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
            }

            // Show error feedback to user
            display_repo_card_message(card, 'danger', 'An unexpected error occurred while saving the media record.');
        }
    };

    /**
     * Build repo item form HTML string with individual save button
     * @param {Object} item_data - Repository item data
     * @param {number} index - Item index
     * @returns {string} HTML string
     */
    const build_repo_form_html = (item_data, index) => {
        const item_number = index + 1;
        const title = escape_html(item_data.title || 'Untitled');
        const abstract = escape_html(item_data.abstract || item_data.description || '');
        const object_type = item_data.object_type || item_data.type || 'unknown';
        const type_label = get_media_type_label(object_type);
        const type_icon = get_media_type_icon(object_type);
        const uuid = escape_html(item_data.uuid || '');
        const creator = escape_html(item_data.creator || '');
        // Alt Text is an image-only accessibility field. Decide by the
        // MIME-derived media type (the same source of truth as
        // media_data.media_type), NOT object_type: repo items are commonly
        // object_type "object" regardless of the underlying file, so keying
        // off object_type forces a required Alt Text field onto non-image
        // imports (letters, PDFs, audio, video).
        const is_image = derive_media_type(item_data.mime_type) === 'image';

        // Local identifier (e.g. "U116.01.0001.00050") surfaced under the thumbnail
        // so curators can cross-reference the source archival call number.
        const local_identifier = escape_html(get_local_identifier(item_data));

        // Original filename(s) from display_record.parts. Single-part records show
        // "Filename:", compound records show "Files (N):" so it's obvious at a
        // glance which records bring more than one file along.
        const filename_display = format_filename_display(get_part_filenames(item_data));

        // Extract subjects and resource_type from display_record for pre-selection
        const repo_subjects = extract_repo_subjects(item_data.display_record || null);

        // Records that lack `display_record.resource_type` (some archival items
        // omit it) still deserve an auto-populated Item Type. Fall back to the
        // top-level `type` field, then derive from mime_type.
        if (!repo_subjects.resource_type) {
            repo_subjects.resource_type = derive_item_type_fallback(item_data);
        }

        // Get thumbnail URL using repoServiceModule
        const thumbnail_url = get_repo_thumbnail_url(item_data.uuid);

        // Preview HTML with repo thumbnail
        let preview_html;
        if (thumbnail_url) {
            preview_html = '<img src="' + escape_html(thumbnail_url) + '" ' +
                'alt="Thumbnail for ' + title + '" ' +
                'style="max-width:100%;max-height:100%;object-fit:cover;" ' +
                'onerror="this.onerror=null; this.parentElement.innerHTML=\'<i class=\\\'fa ' + type_icon + ' file-icon\\\' aria-hidden=\\\'true\\\'></i>\';">';
        } else {
            preview_html = '<i class="fa ' + type_icon + ' file-icon" aria-hidden="true"></i>';
        }

        // Alt text field HTML (only for images - required)
        let alt_text_html = '';
        if (is_image) {
            alt_text_html = '<div class="col-md-6 mb-3">' +
                '<label class="form-label" for="repo-alt-text-' + index + '">Alt Text <span class="badge badge-required">Required</span></label>' +
                '<input type="text" class="form-control repo-alt-text" id="repo-alt-text-' + index + '" name="alt_text" placeholder="Describe the image for screen readers" required aria-required="true">' +
                '<div class="invalid-feedback">Please provide alt text for accessibility.</div>' +
                '<small class="form-text text-muted"><i class="fa fa-universal-access" style="margin-right: 8px;" aria-hidden="true"></i>Required for accessibility</small>' +
                '</div>';
        }

        // Build the complete card HTML
        let html = '<div class="repo-form-card card mb-4" data-item-index="' + index + '">';

        // Card header
        html += '<div class="card-header bg-light d-flex align-items-center justify-content-between">';
        html += '<div class="d-flex align-items-center">';
        html += '<span class="item-number">' + item_number + '</span>';
        html += '<span class="item-form-title fw-bold" style="margin-left: 12px;">' + title + '</span>';
        html += '</div>';
        html += '<span class="badge bg-secondary item-type-badge type-' + object_type + '">' + type_label + '</span>';
        html += '</div>';

        // Card body
        html += '<div class="card-body">';
        html += '<div class="row">';

        // Preview column
        html += '<div class="col-md-3 mb-3 mb-md-0">';
        html += '<div class="item-preview-container text-center">';
        html += '<div class="item-preview mb-2">' + preview_html + '</div>';
        html += '<div class="item-meta small text-muted">';
        if (local_identifier) {
            html += '<div class="item-local-id-display text-truncate" title="' + local_identifier + '">' + local_identifier + '</div>';
        }
        if (filename_display) {
            const filename_value = escape_html(filename_display.value);
            html += '<div class="item-filename-display text-truncate" title="' + filename_value + '"><strong>' + filename_display.label + ':</strong> ' + filename_value + '</div>';
        }
        if (creator) {
            html += '<div class="item-creator-display text-truncate" title="' + creator + '"><i class="fa fa-user" style="margin-right: 4px;" aria-hidden="true"></i>' + creator + '</div>';
        }
        html += '</div></div></div>';

        // Form column
        html += '<div class="col-md-9">';
        html += '<form class="repo-details-form" novalidate>';

        // Row 1: Name (required) - populated from title - and Alt Text (images only - required)
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="repo-name-' + index + '">Name <span class="badge badge-required">Required</span></label>';
        html += '<input type="text" class="form-control repo-name" id="repo-name-' + index + '" name="name" value="' + title + '" placeholder="Enter a name" required aria-required="true">';
        html += '<div class="invalid-feedback">Please provide a name.</div>';
        html += '</div>';
        html += alt_text_html;
        html += '</div>';

        // Row 2: Description - populated from abstract
        html += '<div class="row">';
        html += '<div class="col-12 mb-3">';
        html += '<label class="form-label" for="repo-description-' + index + '">Description <span class="badge badge-required">Required</span></label>';
        html += '<textarea class="form-control repo-description" id="repo-description-' + index + '" name="description" rows="2" placeholder="Enter a description" required aria-required="true">' + abstract + '</textarea>';
        html += '<div class="invalid-feedback">Please provide a description.</div>';
        html += '</div></div>';

        // Subjects section — Topics, Genre/Form, Places, Item Type. A single instruction
        // introduces the group and is programmatically associated with it (role="group"
        // + aria-describedby) so assistive tech announces it and sighted users see it
        // (WCAG 1.3.1 / 3.3.2). Replaces the old per-Topics "choose 2-3" hint.
        html += '<div role="group" aria-label="Subjects" aria-describedby="repo-subjects-help-' + index + '">';
        html += '<p id="repo-subjects-help-' + index + '" class="form-text text-muted mt-0 mb-2">Choose 2–4 of the following tags to support search.</p>';

        // Row 3: Topics, Genre/Form dropdowns
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="repo-topics-' + index + '">Topics <span class="badge badge-required">Required</span></label>';
        html += '<select class="form-control form-select custom-select repo-topics" id="repo-topics-' + index + '" name="topics_subjects" required' + (repo_subjects.topics ? ' data-selected="' + escape_html(repo_subjects.topics) + '"' : '') + '>';
        html += '<option value="">Select a topic...</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="repo-genre-form-' + index + '">Genre/Form <span class="badge badge-required">Required</span></label>';
        html += '<select class="form-control form-select custom-select repo-genre-form" id="repo-genre-form-' + index + '" name="genre_form_subjects"' + (repo_subjects.genre_form ? ' data-selected="' + escape_html(repo_subjects.genre_form) + '"' : '') + '>';
        html += '<option value="">Select genre/form...</option>';
        html += '</select>';
        html += '</div></div>';

        // Row 4: Places, Item Type dropdowns
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="repo-places-' + index + '">Places</label>';
        html += '<select class="form-control form-select custom-select repo-places" id="repo-places-' + index + '" name="places_subjects"' + (repo_subjects.places ? ' data-selected="' + escape_html(repo_subjects.places) + '"' : '') + '>';
        html += '<option value="">Select a place...</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="repo-item-type-' + index + '">Item Type <span class="badge badge-required">Required</span></label>';
        html += '<select class="form-control form-select custom-select repo-item-type" id="repo-item-type-' + index + '" name="item_type" required' + (repo_subjects.resource_type ? ' data-selected="' + escape_html(repo_subjects.resource_type) + '"' : '') + '>';
        html += '<option value="">Select item type...</option>';
        html += '</select>';
        html += '</div></div>';
        html += '</div>'; // close Subjects group

        // Hidden fields for repo data
        html += '<input type="hidden" class="repo-uuid" name="repo_uuid" value="' + uuid + '">';

        // Save button row
        html += '<div class="row">';
        html += '<div class="col-12 text-end">';
        html += '<button type="button" class="btn btn-primary btn-save-repo-item" data-item-index="' + index + '">';
        html += '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
        html += '</button>';
        html += '</div></div>';

        html += '</form></div>';
        html += '</div></div>';
        html += '</div>';

        return html;
    };

    /**
     * Setup individual save button handlers for repo items
     */
    const setup_repo_individual_save_handlers = () => {
        const save_buttons = document.querySelectorAll('.btn-save-repo-item');
        save_buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-item-index'), 10);
                handle_repo_individual_save(index);
            });
        });
    };

    /**
     * Populate the repo import modal with individual forms for each selected item
     */
    const populate_repo_modal = () => {
        const forms_container = document.getElementById('repo-items-forms-container');
        const summary_text = document.getElementById('repo-import-summary-text');

        if (!forms_container) {
            console.error('Repo modal forms container not found');
            return;
        }

        // Reset saved counter
        saved_items_count = 0;

        // Clear existing content
        forms_container.innerHTML = '';

        // Build HTML for each item
        let all_html = '';
        imported_items_data.forEach((item_data, index) => {
            all_html += build_repo_form_html(item_data, index);
        });

        // Insert HTML
        forms_container.innerHTML = all_html;

        // Setup individual save handlers
        setup_repo_individual_save_handlers();

        // Populate subject and resource type dropdowns
        if (typeof repoSubjectsModule !== 'undefined') {
            repoSubjectsModule.populate_subjects_dropdowns(forms_container);
        }

        // Update summary text
        if (summary_text) {
            const count = imported_items_data.length;
            const item_word = count === 1 ? 'item has' : 'items have';
            summary_text.textContent = count + ' repository ' + item_word + ' been selected for import. Please provide details for each item below.';
        }

        // Update status
        update_repo_modal_status();

        console.debug('Populated repo modal with ' + imported_items_data.length + ' item forms');
    };

    /**
     * Close the repo import modal
     */
    const close_repo_modal = () => {
        const modal_element = document.getElementById('repo-media-modal');
        if (!modal_element) return;

        helperMediaLibraryModule.hide_bootstrap_modal(modal_element);
    };

    /**
     * Handle done/close button click in repo import modal
     * @param {boolean} [preserve_repo_selections=false] - When true, the repo
     *        search/selection state is left intact (used by Cancel so the Repo
     *        Import tab — including its Clear button — stays as the user left
     *        it). Done passes false: a completed import resets the tab.
     */
    const handle_repo_modal_done = async (preserve_repo_selections = false) => {
        console.debug('Closing repo modal - ' + saved_items_count + ' items were saved');

        close_repo_modal();

        // Refresh the data table if items were saved
        if (saved_items_count > 0 && typeof mediaLibraryModule !== 'undefined' && typeof mediaLibraryModule.refresh_media_records === 'function') {
            await mediaLibraryModule.refresh_media_records();
        }

        // Clear repo selections. Skipped when cancelling so the user returns to
        // the Repo Import tab with their search results still rendered — and
        // the Clear button (its visibility tracks current_search_results)
        // still visible — rather than having the tab silently reset.
        if (!preserve_repo_selections && typeof repoServiceModule !== 'undefined' && typeof repoServiceModule.clear_selections === 'function') {
            repoServiceModule.clear_selections();
        }

        // Execute callback if provided
        if (typeof on_complete_callback === 'function') {
            on_complete_callback(saved_items_count);
        }

        // Reset state
        imported_items_data = [];
        saved_items_count = 0;
        on_complete_callback = null;
    };

    /**
     * Setup repo import modal button handlers
     */
    const setup_repo_modal_handlers = () => {
        const done_btn = document.getElementById('repo-media-done-btn');

        if (done_btn) {
            // Remove existing listeners by cloning
            const new_done_btn = done_btn.cloneNode(true);
            done_btn.parentNode.replaceChild(new_done_btn, done_btn);
            // Wrapped so the click Event isn't passed as preserve_repo_selections.
            new_done_btn.addEventListener('click', () => handle_repo_modal_done());
        }

        // Cancel button: closes the modal at any point. Reuses
        // handle_repo_modal_done but passes preserve_repo_selections=true so the
        // Repo Import tab — including its Clear button — stays as the user left
        // it. Still closes, refreshes the table if anything was already saved,
        // fires the callback, and resets modal state. Items saved via per-card
        // Save remain saved (that's a server-side commit).
        const cancel_btn = document.getElementById('repo-media-cancel-btn');

        if (cancel_btn) {
            const new_cancel_btn = cancel_btn.cloneNode(true);
            cancel_btn.parentNode.replaceChild(new_cancel_btn, cancel_btn);
            new_cancel_btn.addEventListener('click', () => handle_repo_modal_done(true));
        }
    };

    /**
     * Open the repo import modal with selected items
     * @param {Array} items_data - Array of selected repository items
     * @param {Function} callback - Optional callback function when modal closes
     */
    obj.open_repo_media_modal = function(items_data, callback) {
        const modal_element = document.getElementById('repo-media-modal');

        if (!modal_element) {
            console.error('Repo media modal not found');
            return;
        }

        // Store data and callback
        imported_items_data = items_data || [];
        on_complete_callback = callback || null;

        // Setup modal button handlers
        setup_repo_modal_handlers();

        // Populate modal with selected items data
        populate_repo_modal();

        // Show form using helper module to fix CSS visibility
        if (typeof helperModule !== 'undefined' && typeof helperModule.show_form === 'function') {
            helperModule.show_form();
        }

        // Open modal
        helperMediaLibraryModule.show_bootstrap_modal(modal_element);

        console.debug('Repo media modal opened with ' + imported_items_data.length + ' items');
    };

    /**
     * Close the repo import modal
     */
    obj.close_repo_media_modal = function() {
        close_repo_modal();
        imported_items_data = [];
        saved_items_count = 0;
        on_complete_callback = null;
    };

    /**
     * Get count of saved repo items
     */
    obj.get_saved_count = function() {
        return saved_items_count;
    };

    /**
     * Get imported items data
     */
    obj.get_items_data = function() {
        return imported_items_data;
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
                return { success: false, message: 'Unable to update media record. Please check your connection and try again.' };
            }

            // Handle 403 Forbidden
            if (response.status === HTTP_STATUS.FORBIDDEN) {
                return { success: false, message: response.data?.message || 'You do not have permission to update this media record.' };
            }

            // Handle 404 Not Found
            if (response.status === HTTP_STATUS.NOT_FOUND) {
                return { success: false, message: response.data?.message || 'Media record not found.' };
            }

            // Handle 400 Bad Request
            if (response.status === HTTP_STATUS.BAD_REQUEST) {
                return { success: false, message: response.data?.message || 'Invalid update data. Please check the form and try again.' };
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
            return { success: false, message: 'An unexpected error occurred while updating the media record.' };
        }
    };

    // ========================================
    // VIEW MODAL FUNCTIONS
    // ========================================

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

            // Restore original info section HTML structure
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

        // Edit button: closes the preview and opens the edit form for the
        // currently-displayed record. Mirrors the wiring in modals.upload.module.js
        // (both modules share the same view-media-modal DOM element).
        const edit_btn = document.getElementById('view-media-edit-btn');
        if (edit_btn) {
            const new_edit_btn = edit_btn.cloneNode(true);
            edit_btn.parentNode.replaceChild(new_edit_btn, edit_btn);
            new_edit_btn.addEventListener('click', () => {
                const modal_el = document.getElementById('view-media-modal');
                const uuid = modal_el && modal_el.dataset ? modal_el.dataset.uuid : '';
                close_view_modal();
                if (uuid && typeof mediaEditModalModule !== 'undefined' && typeof mediaEditModalModule.open_edit_media_modal === 'function') {
                    setTimeout(() => { mediaEditModalModule.open_edit_media_modal(uuid); }, 200);
                }
            });
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
     * @param {string} storage_filename - (deprecated, unused) Kept for backward compatibility
     * @param {string} ingest_method - Ingest method (upload, repository, etc.)
     * @param {string} repo_uuid - Repository item UUID (for repo items)
     * @param {string} repo_handle - Repository handle URL (for repo items)
     * @param {string} call_number - Archival local identifier (for repo items)
     * @param {Object} [record] - Full row record (for audit fields: created_display, created_by, updated_by)
     */
    obj.open_view_media_modal = function(uuid, name, filename, size, media_type, ingest_method, repo_uuid, repo_handle, call_number, record) {
        const modal_element = document.getElementById('view-media-modal');

        // Decode HTML entities in name to prevent double-encoding
        name = decode_html_entities(name);

        if (!modal_element) {
            console.error('View media modal not found');
            return;
        }

        // Stash the uuid on the modal element so the Edit button click handler
        // can read it back without needing closure capture.
        if (uuid) {
            modal_element.dataset.uuid = uuid;
        } else {
            delete modal_element.dataset.uuid;
        }

        const is_repo = ingest_method === 'repository';

        // Determine display type - use passed media_type, fallback to filename detection
        const display_type = (media_type && media_type !== 'N/A')
            ? media_type.toLowerCase()
            : get_media_type_from_filename(filename);

        // Update modal title
        const title_el = document.getElementById('view-media-modal-title');
        if (title_el) {
            title_el.textContent = name || 'View Media';
        }

        // Update file info - show name for repo items, filename/size for uploads
        const info_el = document.getElementById('view-media-info');
        if (info_el) {
            if (is_repo) {
                // Build the metadata block to match the edit form's sidebar 1:1.
                // Row collection then render — keeps mb-0 on the very last row regardless
                // of which optional rows (Identifier / Filename / audit) are included.
                const rows = [
                    ['Name', name || '-'],
                    ['Repo ID', repo_uuid || '-']
                ];
                if (call_number) rows.push(['Identifier', call_number]);

                // `filename` carries record.original_filename (joined parts string for
                // repo records imported after this feature shipped). Empty/'N/A' means
                // the record predates the feature — silently skip in that case.
                const filename_display_view = format_filename_display(filename && filename !== 'N/A' ? filename : '');
                if (filename_display_view) rows.push([filename_display_view.label, filename_display_view.value]);

                const media_type_for_view = (record && record.media_type) || media_type;
                if (media_type_for_view && media_type_for_view !== 'N/A') rows.push(['Media Type', media_type_for_view]);

                const ingest_method_cap = ingest_method
                    ? ingest_method.charAt(0).toUpperCase() + ingest_method.slice(1)
                    : 'N/A';
                rows.push(['Ingest Method', ingest_method_cap]);

                // Exhibit associations (resolved to titles in handle_view_click) — rendered
                // as a stacked list beneath the label; special-cased in the render below.
                if (record && Array.isArray(record.exhibit_names) && record.exhibit_names.length > 0) {
                    rows.push(['__exhibits__', record.exhibit_names]);
                }

                // Audit rows — only when the full record was passed through
                if (record && record.created_display) rows.push(['Date Created', record.created_display]);
                if (record && record.created_by) rows.push(['Added By', record.created_by]);
                if (record && record.updated_by) {
                    const ub = String(record.updated_by).trim();
                    const ubl = ub.toLowerCase();
                    if (ub && ubl !== 'n/a' && ubl !== 'migration_script') {
                        rows.push(['Updated By', ub]);
                    }
                }

                info_el.innerHTML = rows.map((row, idx) => {
                    const cls = idx === rows.length - 1 ? 'mb-0' : 'mb-1';
                    if (row[0] === '__exhibits__') {
                        const names_html = row[1]
                            .map(n => '<div>' + escape_html(String(n)) + '</div>')
                            .join('');
                        return '<p class="mb-1"><strong>Exhibit(s):</strong></p><div class="' + cls + '">' + names_html + '</div>';
                    }
                    return '<p class="' + cls + '"><strong>' + row[0] + ':</strong> <span>' + escape_html(String(row[1])) + '</span></p>';
                }).join('');
            } else {
                // Uploaded item: show filename, size, and ingest method
                info_el.innerHTML = '<p class="mb-1">' +
                    '<strong>File:</strong> ' +
                    '<span id="view-media-filename">' + escape_html(filename || '-') + '</span>' +
                    '</p>' +
                    '<p class="mb-1">' +
                    '<strong>Size:</strong> ' +
                    '<span id="view-media-filesize">' + escape_html(size || '-') + '</span>' +
                    '</p>' +
                    '<p class="mb-0">' +
                    '<strong>Ingest Method:</strong> ' +
                    '<span id="view-media-ingest-method">' + escape_html(ingest_method || '-') + '</span>' +
                    '</p>';
            }
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

        // Build media URL based on ingest method
        let authenticated_url = null;
        const is_repo_non_image = is_repo && (display_type === 'audio' || display_type === 'video' || display_type === 'pdf');

        if (is_repo && repo_uuid) {
            // Repository item: use repo thumbnail endpoint
            const repo_tn_url = get_repo_thumbnail_url(repo_uuid);
            if (repo_tn_url) {
                authenticated_url = repo_tn_url;
            }
        } else {
            // Uploaded item: use UUID-based file endpoint
            const media_url = build_media_url(uuid);
            if (media_url) {
                const token = authModule.get_user_token();
                authenticated_url = media_url + (media_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
            }
        }

        // For repo audio/video/pdf without a thumbnail URL, use a static placeholder
        if (is_repo_non_image && !authenticated_url) {
            const static_path = '/exhibits-dashboard/static/images';
            if (display_type === 'audio') {
                authenticated_url = static_path + '/audio-tn.png';
            } else if (display_type === 'video') {
                authenticated_url = static_path + '/video-tn.png';
            } else {
                authenticated_url = static_path + '/pdf-tn.png';
            }
        }

        if (!authenticated_url) {
            if (loading_el) loading_el.style.display = 'none';
            if (error_el) {
                error_el.style.display = 'block';
                const error_text = document.getElementById('view-media-error-text');
                if (error_text) error_text.textContent = 'Unable to build media URL.';
            }
            return;
        }

        // Setup event handlers
        setup_view_modal_handlers();

        // Show modal (dismissible)
        helperMediaLibraryModule.show_bootstrap_modal(modal_element, { backdrop: true, keyboard: true });

        // Load media based on detected type
        if (is_repo_non_image) {
            // Repository audio/video/pdf: show thumbnail with link to repo handle
            if (image_el) {
                const container = document.getElementById('view-media-container');
                image_el.onload = function() {
                    if (loading_el) loading_el.style.display = 'none';
                    image_el.style.display = 'block';

                    // Wrap image in a clickable link to repo handle
                    if (repo_handle && container) {
                        image_el.style.cursor = 'pointer';
                        image_el.title = 'Click to open in repository';
                        image_el.onclick = function(e) {
                            e.preventDefault();
                            window.open(repo_handle, '_blank', 'noopener,noreferrer');
                        };

                        // Add helper text below the image
                        let link_hint = container.parentNode.querySelector('.repo-handle-hint');
                        if (!link_hint) {
                            link_hint = document.createElement('p');
                            link_hint.className = 'repo-handle-hint text-muted small mt-2 text-center';
                            link_hint.innerHTML = '<i class="fa fa-external-link" style="margin-right: 4px;" aria-hidden="true"></i>' +
                                '<a href="' + escape_html(repo_handle) + '" target="_blank" rel="noopener noreferrer">View in repository</a>';
                            // Insert after the container (which is a flex div) so the link appears below
                            container.parentNode.insertBefore(link_hint, container.nextSibling);
                        }
                    }
                };
                image_el.onerror = function() {
                    // Fallback to static placeholder on error
                    const static_path = '/exhibits-dashboard/static/images';
                    let fallback;
                    if (display_type === 'audio') {
                        fallback = static_path + '/audio-tn.png';
                    } else if (display_type === 'video') {
                        fallback = static_path + '/video-tn.png';
                    } else {
                        fallback = static_path + '/pdf-tn.png';
                    }
                    if (this.src !== fallback) {
                        this.src = fallback;
                    } else {
                        if (loading_el) loading_el.style.display = 'none';
                        if (error_el) {
                            error_el.style.display = 'block';
                            const error_text = document.getElementById('view-media-error-text');
                            if (error_text) error_text.textContent = 'Unable to load thumbnail.';
                        }
                    }
                };
                image_el.src = authenticated_url;
                image_el.alt = 'Thumbnail for ' + (name || 'media');
            }
        } else if (display_type === 'image') {
            // Load image
            if (image_el) {
                image_el.onload = function() {
                    if (loading_el) loading_el.style.display = 'none';
                    image_el.style.display = 'block';

                    // Repository image items: make thumbnail clickable to open in repo viewer
                    if (is_repo && repo_handle) {
                        const container = document.getElementById('view-media-container');
                        image_el.style.cursor = 'pointer';
                        image_el.title = 'Click to open in repository';
                        image_el.onclick = function(e) {
                            e.preventDefault();
                            window.open(repo_handle, '_blank', 'noopener,noreferrer');
                        };

                        // Add helper text below the image
                        if (container) {
                            let link_hint = container.parentNode.querySelector('.repo-handle-hint');
                            if (!link_hint) {
                                link_hint = document.createElement('p');
                                link_hint.className = 'repo-handle-hint text-muted small mt-2 text-center';
                                link_hint.innerHTML = '<i class="fa fa-external-link" style="margin-right: 4px;" aria-hidden="true"></i>' +
                                    '<a href="' + escape_html(repo_handle) + '" target="_blank" rel="noopener noreferrer">View in repository</a>';
                                container.parentNode.insertBefore(link_hint, container.nextSibling);
                            }
                        }
                    }
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

        console.debug('View media modal opened for: ' + name);
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
        console.debug('Repo modals module initialized');
        return true;
    };

    return obj;

}());
