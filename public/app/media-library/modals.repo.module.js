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
    const get_media_type_icon = helperMediaLibraryModule.get_media_type_icon;
    const get_media_type_label = helperMediaLibraryModule.get_media_type_label;
    const build_media_url = helperMediaLibraryModule.build_media_url;
    const get_repo_thumbnail_url = helperMediaLibraryModule.get_repo_thumbnail_url;


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

    /* Card-level status messages — shared helper (success auto-clears after 3 s) */
    const display_repo_card_message = (card, type, message) => {
        helperMediaLibraryModule.display_card_message(card, type, message, { success_hide_ms: 3000 });
    };

    /**
     * Handle individual repo item save
     * @param {number} index - Index of the item in imported_items_data
     */
    const handle_repo_individual_save = async (index) => {
        const card = document.querySelector('.repo-form-card[data-item-index="' + index + '"]');
        const form = card ? card.querySelector('.repo-details-form') : null;

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

        // Build media record data from form and repo item
        const form_data = new FormData(form);

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

        await helperMediaLibraryModule.save_media_record(card, JSON.stringify(media_data), {
            save_button_selector: '.btn-save-repo-item',
            message: display_repo_card_message,
            error_log_label: 'repo item',
            on_success: () => {

                helperMediaLibraryModule.mark_card_saved(card, {
                    number_selector: '.item-number',
                    save_button_selector: '.btn-save-repo-item'
                });

                saved_items_count++;
                update_repo_modal_status();

                display_repo_card_message(card, 'success', 'Media record created successfully');
            }
        });
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
        html += '<label class="form-label" for="repo-description-' + index + '-rte">Description <span class="badge badge-required">Required</span></label>';
        html += '<div class="rte-container rte-modal" id="repo-description-' + index + '-rte" data-rte="full" data-rte-sync="repo-description-' + index + '"></div>';
        html += '<textarea class="form-control repo-description" id="repo-description-' + index + '" name="description" hidden required aria-required="true">' + abstract + '</textarea>';
        html += '<div class="invalid-feedback">Please provide a description.</div>';
        html += '</div></div>';

        // Subjects section — Topics, Genre/Form, Places, Item Type; built by the
        // shared helper, which also emits the role="group" + aria-describedby
        // instruction block (WCAG 1.3.1 / 3.3.2).
        html += repoSubjectsModule.build_subjects_html('repo', index, {
            help_id: 'repo-subjects-help-' + index,
            placeholders: {
                topics_subjects: 'Select a topic...',
                places_subjects: 'Select a place...'
            },
            selected: {
                topics_subjects: repo_subjects.topics,
                genre_form_subjects: repo_subjects.genre_form,
                places_subjects: repo_subjects.places,
                item_type: repo_subjects.resource_type
            }
        });

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

        // Instantiate description rich text editors (sync to hidden textareas)
        rteModule.init_all();

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

    // ========================================
    // VIEW MODAL FUNCTIONS
    // ========================================

    /* Static thumbnails used when a repository asset has no preview image. */
    const REPO_PLACEHOLDER_PATH = '/exhibits-dashboard/static/images';

    /**
     * Placeholder thumbnail for a non-image repository asset.
     * @param {string} display_type
     * @returns {string}
     */
    const repo_placeholder_url = (display_type) => {

        if (display_type === 'audio') {
            return REPO_PLACEHOLDER_PATH + '/audio-tn.png';
        }

        if (display_type === 'video') {
            return REPO_PLACEHOLDER_PATH + '/video-tn.png';
        }

        return REPO_PLACEHOLDER_PATH + '/pdf-tn.png';
    };

    /**
     * Adds the "View in repository" affordance under a loaded thumbnail and
     * makes the image itself open the handle.
     * @param {Object} ctx - view modal context (carries repo_handle)
     * @param {HTMLImageElement} image_el
     */
    const add_repo_handle_link = (ctx, image_el) => {

        const container = document.getElementById('view-media-container');

        if (!ctx.repo_handle || !container) {
            return;
        }

        image_el.style.cursor = 'pointer';
        image_el.title = 'Click to open in repository';
        image_el.onclick = function(e) {
            e.preventDefault();
            window.open(ctx.repo_handle, '_blank', 'noopener,noreferrer');
        };

        let link_hint = container.parentNode.querySelector('.repo-handle-hint');

        if (!link_hint) {
            link_hint = document.createElement('p');
            link_hint.className = 'repo-handle-hint text-muted small mt-2 text-center';
            link_hint.innerHTML = '<i class="fa fa-external-link" style="margin-right: 4px;" aria-hidden="true"></i>' +
                '<a href="' + escape_html(ctx.repo_handle) + '" target="_blank" rel="noopener noreferrer">View in repository</a>';
            // Insert after the container (a flex div) so the link appears below
            container.parentNode.insertBefore(link_hint, container.nextSibling);
        }
    };

    /**
     * Open the view media modal for a repository item.
     *
     * The dialog itself lives in viewMediaModalModule; the repository
     * specifics — the metadata rows, the thumbnail endpoint plus its static
     * placeholders, and the repository handle link — are passed in here.
     *
     * @param {string} uuid - Media record UUID
     * @param {string} name - Media record name for header
     * @param {string} filename - Original filename (joined parts) for display
     * @param {string} size - Formatted file size
     * @param {string} media_type - Media type (image, pdf, etc.)
     * @param {string} ingest_method - Ingest method (upload, repository, etc.)
     * @param {string} repo_uuid - Repository item UUID
     * @param {string} repo_handle - Repository handle URL
     * @param {string} call_number - Archival local identifier
     * @param {Object} [record] - Full row record (for audit fields)
     */
    obj.open_view_media_modal = function(uuid, name, filename, size, media_type, ingest_method, repo_uuid, repo_handle, call_number, record) {

        const is_repo = ingest_method === 'repository';

        viewMediaModalModule.open({
            uuid: uuid,
            name: name,
            filename: filename,
            size: size,
            media_type: media_type,
            ingest_method: ingest_method,
            record: record,
            repo_uuid: repo_uuid,
            repo_handle: repo_handle,
            call_number: call_number,
            is_repo: is_repo,
            strategy: {

                build_info_html: (ctx) => {

                    if (!ctx.is_repo) {
                        // Uploaded item: show filename, size, and ingest method
                        return '<p class="mb-1">' +
                            '<strong>File:</strong> ' +
                            '<span id="view-media-filename">' + escape_html(ctx.filename || '-') + '</span>' +
                            '</p>' +
                            '<p class="mb-1">' +
                            '<strong>Size:</strong> ' +
                            '<span id="view-media-filesize">' + escape_html(ctx.size || '-') + '</span>' +
                            '</p>' +
                            '<p class="mb-0">' +
                            '<strong>Ingest Method:</strong> ' +
                            '<span id="view-media-ingest-method">' + escape_html(ctx.ingest_method || '-') + '</span>' +
                            '</p>';
                    }

                    // Match the edit form's sidebar 1:1.
                    const rows = [
                        ['Name', ctx.name || '-'],
                        ['Repo ID', ctx.repo_uuid || '-']
                    ];

                    if (ctx.call_number) {
                        rows.push(['Identifier', ctx.call_number]);
                    }

                    /*
                     * `filename` carries record.original_filename (a joined
                     * parts string for repo records imported after this
                     * feature shipped). Empty/'N/A' means the record predates
                     * the feature — silently skip in that case.
                     */
                    const filename_display_view = format_filename_display(
                        ctx.filename && ctx.filename !== 'N/A' ? ctx.filename : ''
                    );

                    if (filename_display_view) {
                        rows.push([filename_display_view.label, filename_display_view.value]);
                    }

                    return viewMediaModalModule.render_info_rows(
                        rows.concat(viewMediaModalModule.build_tail_rows(ctx))
                    );
                },

                resolve_media_url: (ctx) => {

                    let url = null;

                    if (ctx.is_repo && ctx.repo_uuid) {
                        // Repository item: use the repo thumbnail endpoint
                        url = get_repo_thumbnail_url(ctx.repo_uuid) || null;
                    } else {
                        // Uploaded item: use the UUID-based file endpoint
                        const media_url = build_media_url(ctx.uuid);

                        if (media_url) {
                            const token = authModule.get_user_token();
                            url = media_url + (media_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token || '');
                        }
                    }

                    /* Repo audio/video/pdf with no thumbnail: static placeholder. */
                    if (!url && is_repo_non_image(ctx)) {
                        url = repo_placeholder_url(ctx.display_type);
                    }

                    return url;
                },

                render_as_image: (ctx) => is_repo_non_image(ctx),

                image_alt: (ctx) => (
                    is_repo_non_image(ctx)
                        ? 'Thumbnail for ' + (ctx.name || 'media')
                        : 'Preview of ' + (ctx.name || ctx.filename)
                ),

                on_image_load: (ctx, image_el) => {

                    if (is_repo_non_image(ctx) || ctx.is_repo) {
                        add_repo_handle_link(ctx, image_el);
                    }
                },

                on_image_error: (ctx, image_el) => {

                    if (!is_repo_non_image(ctx)) {
                        return false;
                    }

                    // Fallback to the static placeholder once, then give up
                    const fallback = repo_placeholder_url(ctx.display_type);

                    if (image_el.src !== fallback) {
                        image_el.src = fallback;
                        return true;
                    }

                    return false;
                },

                on_close: () => {
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
                }
            }
        });
    };

    /**
     * True for a repository asset whose preview is a thumbnail image standing
     * in for non-image content.
     * @param {Object} ctx
     * @returns {boolean}
     */
    function is_repo_non_image(ctx) {
        return ctx.is_repo && (ctx.display_type === 'audio' || ctx.display_type === 'video' || ctx.display_type === 'pdf');
    }

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
        console.debug('Repo modals module initialized');
        return true;
    };

    return obj;

}());
