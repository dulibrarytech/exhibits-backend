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

const kalturaModalsModule = (function() {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    // Module state
    let kaltura_media_data = null;
    let on_complete_callback = null;

    let obj = {};

    // HTTP status constants
    const HTTP_STATUS = {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    };

    // Kaltura player configuration (fetched from API and cached)
    let kaltura_player_config = null;

    /**
     * Fetch Kaltura player configuration from the API
     * Caches the result so subsequent calls return immediately
     * @returns {Promise<Object|null>} Config object with partner_id and uiconf_id, or null on failure
     */
    const fetch_kaltura_player_config = async () => {

        // Return cached config if already fetched
        if (kaltura_player_config) {
            return kaltura_player_config;
        }

        try {

            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.error('Cannot fetch Kaltura config: no auth token');
                return null;
            }

            // Build endpoint URL
            let config_endpoint = '';

            if (EXHIBITS_ENDPOINTS?.kaltura_config?.get?.endpoint) {
                config_endpoint = EXHIBITS_ENDPOINTS.kaltura_config.get.endpoint;
            } else {
                // Fallback: construct URL directly
                config_endpoint = APP_PATH + '/api/v1/media/library/kaltura/config/player';
            }

            const response = await httpModule.req({
                method: 'GET',
                url: config_endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 15000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            if (response && response.status === HTTP_STATUS.OK && response.data?.success && response.data?.data) {
                kaltura_player_config = {
                    partner_id: response.data.data.partner_id || '',
                    uiconf_id: response.data.data.uiconf_id || ''
                };
                return kaltura_player_config;
            }

            console.error('Failed to fetch Kaltura player config:', response?.data?.message || 'Unknown error');
            return null;

        } catch (error) {
            console.error('Error fetching Kaltura player config:', error);
            return null;
        }
    };

    /**
     * Build the Kaltura iframe embed URL for a given entry ID
     * Uses the v2 (kWidget/Universal Studio) embed path
     * @param {string} entry_id - Kaltura entry ID
     * @param {Object} config - Player config with partner_id and uiconf_id
     * @returns {string|null} Embed URL or null if config is missing
     */
    const build_player_embed_url = (entry_id, config) => {

        const partner_id = config?.partner_id || '';
        const uiconf_id = config?.uiconf_id || '';

        if (!partner_id || !uiconf_id || !entry_id) {
            console.error('Missing Kaltura player config', { partner_id, uiconf_id, entry_id });
            return null;
        }

        const encoded_pid = encodeURIComponent(partner_id);
        const encoded_uiconf = encodeURIComponent(uiconf_id);
        const encoded_entry = encodeURIComponent(entry_id);

        return 'https://cdnapisec.kaltura.com/p/' + encoded_pid +
            '/sp/' + encoded_pid + '00' +
            '/embedIframeJs/uiconf_id/' + encoded_uiconf +
            '/partner_id/' + encoded_pid +
            '?iframeembed=true&entry_id=' + encoded_entry;
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
     * Strip HTML tags from a string, returning only the text content
     * @param {string} str - String potentially containing HTML
     * @returns {string} Plain text with all HTML tags removed
     */
    const strip_html = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    };

    /**
     * Get item type icon class
     */
    const get_item_type_icon = (item_type) => {
        const icons = {
            'video': 'fa-file-video-o',
            'audio': 'fa-file-audio-o'
        };
        return icons[item_type] || 'fa-file-o';
    };

    /**
     * Get item type label
     */
    const get_item_type_label = (item_type) => {
        const labels = {
            'video': 'Video',
            'audio': 'Audio'
        };
        return labels[item_type] || 'Unknown';
    };

    /**
     * Derive mime type from Kaltura item type
     * @param {string} item_type - 'audio' or 'video'
     * @returns {string} mime type string
     */
    const get_mime_type = (item_type) => {
        const mime_types = {
            'audio': 'audio/mpeg',
            'video': 'video/mp4'
        };
        return mime_types[item_type] || '';
    };

    /**
     * Build the Kaltura media form HTML
     * @param {Object} media_data - Kaltura media data from API
     * @returns {string} HTML string for the form
     */
    const build_kaltura_form_html = (media_data) => {

        if (!media_data) return '';

        const entry_id = escape_html(media_data.entry_id || '');
        const title = escape_html(strip_html(media_data.title || ''));
        const description = escape_html(strip_html(media_data.description || ''));
        const item_type = media_data.item_type || '';
        const type_icon = get_item_type_icon(item_type);
        const type_label = get_item_type_label(item_type);
        const thumbnail_url = media_data.thumbnail || '';

        let html = '';

        // Card container
        html += '<div class="kaltura-form-card card mb-3" id="kaltura-form-card">';

        // Card header
        html += '<div class="card-header d-flex align-items-center" style="background-color: #f8f9fa; padding: 0.75rem 1rem;">';
        html += '<span class="kaltura-item-number badge" style="background-color: #0d6efd; color: #fff; font-size: 0.85rem; padding: 0.35em 0.65em; margin-right: 10px;">1</span>';
        html += '<span class="kaltura-form-title" style="font-weight: 600; font-size: 0.95rem; flex-grow: 1;">' + (title || 'Kaltura Media') + '</span>';
        html += '<span class="badge badge-secondary" style="font-weight: normal;"><i class="fa ' + type_icon + '" style="margin-right: 4px;" aria-hidden="true"></i>' + type_label + '</span>';
        html += '</div>';

        // Card body
        html += '<div class="card-body" style="padding: 1.25rem;">';

        // Preview and form layout
        html += '<div class="row">';

        // Preview column (col-md-3 to match repo modal)
        html += '<div class="col-md-3 mb-3 mb-md-0">';
        html += '<div class="item-preview-container text-center p-3 bg-light rounded">';
        html += '<div class="item-preview mb-2">';

        if (thumbnail_url) {
            html += '<img src="' + escape_html(thumbnail_url) + '" ' +
                'alt="Thumbnail for ' + title + '" ' +
                'style="max-width:100%;max-height:100%;object-fit:cover;" ' +
                'onerror="this.onerror=null; this.parentElement.innerHTML=\'<i class=\\\'fa ' + type_icon + ' file-icon\\\' aria-hidden=\\\'true\\\'></i>\';">';
        } else {
            html += '<i class="fa ' + type_icon + ' file-icon" aria-hidden="true"></i>';
        }

        html += '</div>'; // item-preview

        // Entry ID badge below thumbnail
        html += '<div class="item-meta small text-muted">';
        html += '<div class="text-truncate" title="ID: ' + entry_id + '">ID: ' + entry_id + '</div>';
        html += '</div>';

        html += '</div>'; // item-preview-container
        html += '</div>'; // col-md-3

        // Form fields column (col-md-9 to match repo modal)
        html += '<div class="col-md-9">';
        html += '<form class="kaltura-details-form" novalidate>';

        // Name field (required) - pre-populated from Kaltura title
        html += '<div class="row">';
        html += '<div class="col-12 mb-3">';
        html += '<label class="form-label">Name <span class="text-danger">*</span></label>';
        html += '<input type="text" class="form-control kaltura-name" name="name" value="' + title + '" required>';
        html += '<div class="invalid-feedback">Name is required</div>';
        html += '</div></div>';

        // Description field - pre-populated from Kaltura description
        html += '<div class="row">';
        html += '<div class="col-12 mb-3">';
        html += '<label class="form-label">Description</label>';
        html += '<textarea class="form-control kaltura-description" name="description" rows="3">' + description + '</textarea>';
        html += '</div></div>';

        // Subjects and Item Type dropdowns (two-column layout via helper module)
        if (typeof repoSubjectsModule !== 'undefined' && typeof repoSubjectsModule.build_subjects_html === 'function') {
            html += repoSubjectsModule.build_subjects_html('kaltura', 0);
        } else {
            // Fallback: manual two-column layout if helper not available
            html += '<div class="row">';
            html += '<div class="col-md-6 mb-3">';
            html += '<label class="form-label">Topics</label>';
            html += '<select class="form-control" name="topics_subjects"><option value="">Select a topic...</option></select>';
            html += '</div>';
            html += '<div class="col-md-6 mb-3">';
            html += '<label class="form-label">Genre/Form <span class="text-danger">*</span></label>';
            html += '<select class="form-control" name="genre_form_subjects"><option value="">Select genre/form...</option></select>';
            html += '</div></div>';
            html += '<div class="row">';
            html += '<div class="col-md-6 mb-3">';
            html += '<label class="form-label">Places</label>';
            html += '<select class="form-control" name="places_subjects"><option value="">Select a place...</option></select>';
            html += '</div>';
            html += '<div class="col-md-6 mb-3">';
            html += '<label class="form-label">Item Type <span class="text-danger">*</span></label>';
            html += '<select class="form-control" name="item_type" required><option value="">Select item type...</option></select>';
            html += '</div></div>';
        }

        // Hidden fields for Kaltura data
        html += '<input type="hidden" class="kaltura-entry-id" name="entry_id" value="' + entry_id + '">';
        html += '<input type="hidden" class="kaltura-item-type" name="media_type" value="' + escape_html(item_type) + '">';
        html += '<input type="hidden" class="kaltura-mime-type" name="mime_type" value="' + escape_html(get_mime_type(item_type)) + '">';
        html += '<input type="hidden" class="kaltura-thumbnail-url" name="kaltura_thumbnail_url" value="' + escape_html(thumbnail_url) + '">';

        // Save button row
        html += '<div class="row">';
        html += '<div class="col-12 text-end">';
        html += '<button type="button" class="btn btn-primary btn-save-kaltura-item">';
        html += '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
        html += '</button>';
        html += '</div></div>';

        html += '</form>';
        html += '</div>'; // col-md-9

        html += '</div>'; // row
        html += '</div>'; // card-body
        html += '</div>'; // card

        return html;
    };

    /**
     * Handle save for the Kaltura media item
     */
    const handle_kaltura_save = async () => {

        try {

            const card = document.getElementById('kaltura-form-card');
            if (!card) {
                console.error('Kaltura form card not found');
                return;
            }

            const form = card.querySelector('.kaltura-details-form');
            if (!form) {
                console.error('Kaltura form not found');
                return;
            }

            // Validate required fields
            form.classList.add('was-validated');

            // Validate required multi-select fields (Genre/Form, Item Type)
            let subjects_valid = true;

            if (typeof repoSubjectsModule !== 'undefined' && typeof repoSubjectsModule.validate_required_fields === 'function') {
                subjects_valid = repoSubjectsModule.validate_required_fields(card);
            }

            if (!form.checkValidity() || !subjects_valid) {
                return;
            }

            // Collect form data
            const name = form.querySelector('.kaltura-name')?.value?.trim() || '';
            const description = form.querySelector('.kaltura-description')?.value?.trim() || '';
            const entry_id = form.querySelector('.kaltura-entry-id')?.value || '';
            const media_type = form.querySelector('.kaltura-item-type')?.value || '';
            const thumbnail_url = form.querySelector('.kaltura-thumbnail-url')?.value || '';
            const mime_type = form.querySelector('.kaltura-mime-type')?.value || '';

            // Collect dropdown values
            const item_type_select = form.querySelector('select[name="item_type"]');
            const item_type = item_type_select?.value || '';

            // Collect subjects (multi-select widgets or standard selects)
            const topics_subjects = collect_field_value(form, 'topics_subjects');
            const genre_form_subjects = collect_field_value(form, 'genre_form_subjects');
            const places_subjects = collect_field_value(form, 'places_subjects');

            if (!name) {
                display_card_message(card, 'danger', 'Name is required');
                return;
            }

            // Validate authentication
            const token = authModule.get_user_token();
            if (!token || token === false) {
                display_card_message(card, 'danger', 'Session expired. Please log in again.');
                return;
            }

            // Validate endpoint
            if (!EXHIBITS_ENDPOINTS?.media_records?.post?.endpoint) {
                display_card_message(card, 'danger', 'Create endpoint not configured');
                return;
            }

            // Disable save button
            const save_btn = card.querySelector('.btn-save-kaltura-item');
            if (save_btn) {
                save_btn.disabled = true;
                save_btn.innerHTML = '<i class="fa fa-spinner fa-spin" style="margin-right: 6px;" aria-hidden="true"></i>Saving...';
            }

            // Build record data
            const record_data = {
                name: name,
                description: description,
                kaltura_entry_id: entry_id,
                media_type: media_type,
                mime_type: mime_type,
                item_type: item_type,
                kaltura_thumbnail_url: thumbnail_url,
                topics_subjects: topics_subjects,
                genre_form_subjects: genre_form_subjects,
                places_subjects: places_subjects,
                ingest_method: 'kaltura'
            };

            // Make API request to create media record
            const response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.media_records.post.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                data: record_data,
                timeout: 30000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            if (response && (response.status === HTTP_STATUS.CREATED || response.status === HTTP_STATUS.OK) && response.data?.success) {

                // Mark card as saved
                const card_header = card.querySelector('.card-header');
                if (card_header) {
                    card_header.style.backgroundColor = '#d1e7dd';
                }

                const item_number = card.querySelector('.kaltura-item-number');
                if (item_number) {
                    item_number.style.backgroundColor = '#198754';
                }

                // Update save button to "Saved" state (matches repo modal)
                if (save_btn) {
                    save_btn.disabled = true;
                    save_btn.classList.remove('btn-primary');
                    save_btn.classList.add('btn-success');
                    save_btn.innerHTML = '<i class="fa fa-check" style="margin-right: 6px;" aria-hidden="true"></i>Saved';
                }

                // Disable all form fields
                const inputs = card.querySelectorAll('input, textarea, select');
                inputs.forEach(input => { input.disabled = true; });

                // Disable multi-select widgets
                const widgets = card.querySelectorAll('.ms-widget');
                widgets.forEach(w => w.classList.add('disabled'));

                // Update modal footer
                update_modal_status(true);

            } else {
                const error_message = response?.data?.message || 'Failed to save Kaltura media record';
                display_card_message(card, 'danger', error_message);

                // Re-enable save button
                if (save_btn) {
                    save_btn.disabled = false;
                    save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
                }
            }

        } catch (error) {
            console.error('Error saving Kaltura media record:', error);

            const card = document.getElementById('kaltura-form-card');
            if (card) {
                display_card_message(card, 'danger', 'An unexpected error occurred while saving');

                const save_btn = card.querySelector('.btn-save-kaltura-item');
                if (save_btn) {
                    save_btn.disabled = false;
                    save_btn.innerHTML = '<i class="fa fa-save" style="margin-right: 6px;" aria-hidden="true"></i>Save';
                }
            }
        }
    };

    /**
     * Collect field value from form (handles both multi-select widgets and standard selects)
     * @param {HTMLElement} form - Form element
     * @param {string} field_name - Field name
     * @returns {string} Field value (pipe-delimited for multi-select)
     */
    const collect_field_value = (form, field_name) => {
        // Check for multi-select widget hidden input first
        const widget = form.closest('.card')?.querySelector('.ms-widget[data-name="' + field_name + '"]');
        if (widget) {
            const hidden_input = widget.querySelector('input[type="hidden"]');
            if (hidden_input) {
                return hidden_input.value || '';
            }
        }

        // Fallback to standard select
        const select = form.querySelector('select[name="' + field_name + '"]');
        return select?.value || '';
    };

    /**
     * Display status message in card
     * @param {HTMLElement} card - The card element
     * @param {string} type - Message type ('success', 'danger', 'warning')
     * @param {string} message - Message text
     */
    const display_card_message = (card, type, message) => {
        let message_container = card.querySelector('.card-message');

        if (!message_container) {
            message_container = document.createElement('div');
            message_container.className = 'card-message mt-2';
            const card_body = card.querySelector('.card-body');
            if (card_body) {
                card_body.appendChild(message_container);
            }
        }

        const icon = type === 'success' ? 'fa-check' : type === 'danger' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';

        message_container.innerHTML = '<div class="alert alert-' + type + ' mb-0" role="alert">' +
            '<i class="fa ' + icon + '" style="margin-right: 6px;" aria-hidden="true"></i>' +
            escape_html(message) +
            '</div>';

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (message_container) {
                    message_container.innerHTML = '';
                }
            }, 5000);
        }
    };

    /**
     * Update modal footer status
     * @param {boolean} saved - Whether the item was saved
     */
    const update_modal_status = (saved) => {
        const validation_message = document.getElementById('kaltura-modal-validation-message');
        const done_btn = document.getElementById('kaltura-media-done-btn');

        if (validation_message) {
            if (saved) {
                validation_message.innerHTML = '<i class="fa fa-check-circle text-success" style="margin-right: 6px;"></i>Item saved!';
            } else {
                validation_message.textContent = '0 of 1 items saved';
            }
        }

        if (done_btn) {
            done_btn.style.display = saved ? 'inline-block' : 'none';
        }
    };

    /**
     * Close the Kaltura modal
     */
    const close_kaltura_modal = () => {
        const modal_element = document.getElementById('kaltura-media-modal');
        if (!modal_element) return;

        // Try Bootstrap 5 first
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal &&
            typeof bootstrap.Modal.getInstance === 'function') {
            const modal = bootstrap.Modal.getInstance(modal_element);
            if (modal) {
                modal.hide();
            }
        }
        // Try Bootstrap 4 / jQuery
        else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal('hide');
        }

        // Manual cleanup after short delay to ensure Bootstrap animations complete
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
        }, 150);
    };

    /**
     * Populate the Kaltura import modal with the form
     */
    const populate_kaltura_modal = () => {
        const forms_container = document.getElementById('kaltura-items-forms-container');

        if (!forms_container) {
            console.error('Kaltura modal forms container not found');
            return;
        }

        // Clear existing content
        forms_container.innerHTML = '';

        // Build the form HTML
        const form_html = build_kaltura_form_html(kaltura_media_data);
        forms_container.innerHTML = form_html;

        // CRITICAL: Call show_form() AFTER HTML is injected so the new .card elements exist in DOM
        if (typeof helperModule !== 'undefined' && typeof helperModule.show_form === 'function') {
            helperModule.show_form();
        }

        // Setup save handler
        const save_btn = document.querySelector('.btn-save-kaltura-item');
        if (save_btn) {
            save_btn.addEventListener('click', function() {
                handle_kaltura_save();
            });
        }

        // Populate subject dropdowns via helper module
        if (typeof repoSubjectsModule !== 'undefined' && typeof repoSubjectsModule.populate_subjects_dropdowns === 'function') {
            repoSubjectsModule.populate_subjects_dropdowns(forms_container);
        }

        // Reset modal footer
        update_modal_status(false);
    };

    /**
     * Open the Kaltura media import modal
     * @param {Object} media_data - Kaltura media data from API
     * @param {Function} callback - Callback when modal is closed via Done button
     */
    obj.open_kaltura_media_modal = function(media_data, callback) {

        if (!media_data) {
            console.error('No media data provided for Kaltura modal');
            return;
        }

        const modal_element = document.getElementById('kaltura-media-modal');
        if (!modal_element) {
            console.error('Kaltura media modal not found');
            return;
        }

        // Store data and callback
        kaltura_media_data = media_data;
        on_complete_callback = callback || null;

        // Populate the modal with form
        populate_kaltura_modal();

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
            backdrop.id = 'kaltura-media-modal-backdrop';
            document.body.appendChild(backdrop);

            // Manual bounce for fallback only
            backdrop.addEventListener('click', function() {
                const modal_content = modal_element.querySelector('.modal-content');
                if (modal_content) {
                    modal_content.classList.remove('bounce');
                    void modal_content.offsetWidth;
                    modal_content.classList.add('bounce');
                }
            });

            modal_element.addEventListener('click', function(e) {
                if (e.target === modal_element) {
                    const modal_content = modal_element.querySelector('.modal-content');
                    if (modal_content) {
                        modal_content.classList.remove('bounce');
                        void modal_content.offsetWidth;
                        modal_content.classList.add('bounce');
                    }
                }
            });
        }

        console.log('Kaltura media modal opened');
    };

    // ========================================
    // KALTURA PLAYER MODAL
    // ========================================

    // Stores the record currently displayed in the view modal (for Play button bridging)
    let current_view_record = null;

    /**
     * Set the record data for the view modal's Play button
     * Call this when opening the view modal for a Kaltura record
     * @param {Object} record - Media record with kaltura_entry_id, name, item_type
     */
    obj.set_view_modal_record = function(record) {

        current_view_record = record || null;

        const play_btn = document.getElementById('view-kaltura-media-play-btn');

        if (play_btn) {
            // Show the Play button only when the record has a kaltura_entry_id
            if (record && record.kaltura_entry_id) {
                play_btn.style.display = 'inline-block';
            } else {
                play_btn.style.display = 'none';
            }
        }
    };

    /**
     * Open the Kaltura player modal to play audio/video
     * @param {Object} record - Media record object containing kaltura_entry_id, name, item_type/media_type
     */
    obj.open_kaltura_player_modal = async function(record) {

        if (!record) {
            console.error('No record provided for Kaltura player modal');
            return;
        }

        const entry_id = record.kaltura_entry_id || '';
        const name = record.name || 'Kaltura Media';
        const item_type = record.item_type || record.media_type || '';

        if (!entry_id) {
            console.error('No kaltura_entry_id found in record');
            return;
        }

        // Fetch player config from API (uses cache after first call)
        const config = await fetch_kaltura_player_config();

        if (!config) {
            console.error('Could not retrieve Kaltura player config from API.');
            return;
        }

        // Build embed URL
        const embed_url = build_player_embed_url(entry_id, config);

        if (!embed_url) {
            console.error('Could not build Kaltura player embed URL. Check Kaltura config API response.');
            return;
        }

        const modal_element = document.getElementById('kaltura-player-modal');

        if (!modal_element) {
            console.error('Kaltura player modal element not found');
            return;
        }

        // Set modal content
        const iframe = document.getElementById('kaltura-player-iframe');
        const name_el = document.getElementById('kaltura-player-media-name');
        const entry_id_el = document.getElementById('kaltura-player-entry-id');
        const type_el = document.getElementById('kaltura-player-media-type');
        const header_text = document.getElementById('kaltura-player-header-text');
        const type_icon = document.getElementById('kaltura-player-type-icon');
        const responsive_container = document.getElementById('kaltura-player-responsive');
        const loading_el = document.getElementById('kaltura-player-loading');
        const error_el = document.getElementById('kaltura-player-error');

        // Populate info fields
        if (name_el) name_el.textContent = escape_html(name);
        if (entry_id_el) entry_id_el.textContent = escape_html(entry_id);

        // Configure based on media type (audio vs video)
        const is_audio = item_type === 'audio';

        if (type_el) {
            type_el.textContent = is_audio ? 'Audio' : 'Video';
        }

        if (header_text) {
            header_text.textContent = escape_html(name);
        }

        if (type_icon) {
            type_icon.className = is_audio
                ? 'fa fa-music'
                : 'fa fa-play-circle';
            type_icon.style.marginRight = '8px';
        }

        // Toggle audio/video mode classes and aspect ratio
        if (is_audio) {
            modal_element.classList.add('kaltura-audio-mode');
            if (responsive_container) {
                responsive_container.classList.remove('embed-responsive-16by9');
                responsive_container.classList.add('embed-responsive-audio');
            }
        } else {
            modal_element.classList.remove('kaltura-audio-mode');
            if (responsive_container) {
                responsive_container.classList.remove('embed-responsive-audio');
                responsive_container.classList.add('embed-responsive-16by9');
            }
        }

        // Show loading, hide error
        if (loading_el) loading_el.style.display = 'block';
        if (error_el) {
            error_el.style.display = 'none';
            error_el.innerHTML = '';
        }

        // Set iframe src to load the player
        if (iframe) {
            iframe.src = '';
            iframe.title = 'Kaltura media player - ' + escape_html(name);

            // Listen for iframe load to hide loading indicator
            iframe.onload = function() {
                if (loading_el) loading_el.style.display = 'none';
            };

            iframe.onerror = function() {
                if (loading_el) loading_el.style.display = 'none';
                if (error_el) {
                    error_el.style.display = 'block';
                    error_el.innerHTML = '<div class="alert alert-danger mb-0" role="alert">' +
                        '<i class="fa fa-exclamation-circle" style="margin-right: 8px;" aria-hidden="true"></i>' +
                        'Unable to load the media player. Please try again.' +
                        '</div>';
                }
            };

            // Set src after attaching handlers
            iframe.src = embed_url;
        }

        // Open modal
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
            // Manual fallback
            modal_element.classList.add('show');
            modal_element.style.display = 'block';
            modal_element.setAttribute('aria-hidden', 'false');
            modal_element.setAttribute('aria-modal', 'true');
            document.body.classList.add('modal-open');

            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'kaltura-player-modal-backdrop';
            document.body.appendChild(backdrop);
        }

        console.log('Kaltura player modal opened for entry:', entry_id);
    };

    /**
     * Close the Kaltura player modal and stop playback
     */
    obj.close_kaltura_player_modal = function() {

        const modal_element = document.getElementById('kaltura-player-modal');
        if (!modal_element) return;

        // CRITICAL: Clear iframe src to stop playback immediately
        const iframe = document.getElementById('kaltura-player-iframe');
        if (iframe) {
            iframe.src = '';
            iframe.onload = null;
            iframe.onerror = null;
        }

        // Hide loading/error
        const loading_el = document.getElementById('kaltura-player-loading');
        const error_el = document.getElementById('kaltura-player-error');
        if (loading_el) loading_el.style.display = 'none';
        if (error_el) {
            error_el.style.display = 'none';
            error_el.innerHTML = '';
        }

        // Reset mode classes
        modal_element.classList.remove('kaltura-audio-mode');

        // Reset aspect ratio container
        const responsive_container = document.getElementById('kaltura-player-responsive');
        if (responsive_container) {
            responsive_container.classList.remove('embed-responsive-audio');
            responsive_container.classList.add('embed-responsive-16by9');
        }

        // Close via Bootstrap 5
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal &&
            typeof bootstrap.Modal.getInstance === 'function') {
            const modal = bootstrap.Modal.getInstance(modal_element);
            if (modal) {
                modal.hide();
            }
        }
        // Close via Bootstrap 4 / jQuery
        else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal('hide');
        }

        // Manual cleanup after animation
        setTimeout(() => {
            modal_element.classList.remove('show');
            modal_element.style.display = 'none';
            modal_element.setAttribute('aria-hidden', 'true');
            modal_element.removeAttribute('aria-modal');
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('overflow');

            // Remove backdrop
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
        }, 150);

        console.log('Kaltura player modal closed');
    };

    // ========================================
    // KALTURA IMPORT MODAL
    // ========================================

    /**
     * Close the Kaltura import modal (public method)
     */
    obj.close_kaltura_media_modal = function() {
        close_kaltura_modal();
        kaltura_media_data = null;
        on_complete_callback = null;
    };

    /**
     * Initialize modal event listeners
     */
    const init_modal_events = () => {

        // ========================================
        // Import modal events
        // ========================================

        // Done button
        const done_btn = document.getElementById('kaltura-media-done-btn');
        if (done_btn) {
            done_btn.addEventListener('click', function() {
                const callback = on_complete_callback;
                close_kaltura_modal();
                kaltura_media_data = null;
                on_complete_callback = null;

                if (typeof callback === 'function') {
                    callback(true);
                }
            });
        }

        // ========================================
        // Player modal events
        // ========================================

        // Close button (X) in header
        const player_close_btn = document.getElementById('kaltura-player-close-btn');
        if (player_close_btn) {
            player_close_btn.addEventListener('click', function() {
                obj.close_kaltura_player_modal();
            });
        }

        // Cancel/Close button in footer
        const player_cancel_btn = document.getElementById('kaltura-player-cancel-btn');
        if (player_cancel_btn) {
            player_cancel_btn.addEventListener('click', function() {
                obj.close_kaltura_player_modal();
            });
        }

        // Handle modal hidden event to ensure playback stops
        // (covers Escape key, backdrop click, and programmatic close)
        const player_modal = document.getElementById('kaltura-player-modal');
        if (player_modal) {

            // Bootstrap 4 jQuery event
            if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
                $(player_modal).on('hidden.bs.modal', function() {
                    const iframe = document.getElementById('kaltura-player-iframe');
                    if (iframe && iframe.src) {
                        iframe.src = '';
                    }
                });
            }

            // Bootstrap 5 native event
            player_modal.addEventListener('hidden.bs.modal', function() {
                const iframe = document.getElementById('kaltura-player-iframe');
                if (iframe && iframe.src) {
                    iframe.src = '';
                }
            });
        }

        // ========================================
        // View modal Play button → opens player modal
        // ========================================

        const view_play_btn = document.getElementById('view-kaltura-media-play-btn');
        if (view_play_btn) {
            view_play_btn.addEventListener('click', function() {

                if (!current_view_record || !current_view_record.kaltura_entry_id) {
                    console.warn('No Kaltura record available for playback');
                    return;
                }

                // Close the view modal first
                const view_modal_el = document.getElementById('view-kaltura-media-modal');

                if (typeof bootstrap !== 'undefined' && bootstrap.Modal &&
                    typeof bootstrap.Modal.getInstance === 'function') {
                    const view_modal = bootstrap.Modal.getInstance(view_modal_el);
                    if (view_modal) view_modal.hide();
                } else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
                    $(view_modal_el).modal('hide');
                }

                // Open player modal after a brief delay for view modal to close
                setTimeout(async () => {
                    await obj.open_kaltura_player_modal(current_view_record);
                }, 200);
            });
        }

        // View modal close/cancel — reset the stored record
        const view_close_btn = document.getElementById('view-kaltura-media-close-btn');
        if (view_close_btn) {
            view_close_btn.addEventListener('click', function() {
                current_view_record = null;

                const play_btn = document.getElementById('view-kaltura-media-play-btn');
                if (play_btn) play_btn.style.display = 'none';
            });
        }

        const view_cancel_btn = document.getElementById('view-kaltura-media-cancel-btn');
        if (view_cancel_btn) {
            view_cancel_btn.addEventListener('click', function() {
                current_view_record = null;

                const play_btn = document.getElementById('view-kaltura-media-play-btn');
                if (play_btn) play_btn.style.display = 'none';
            });
        }
    };

    /**
     * Initialize the Kaltura modals module
     */
    obj.init = function() {
        init_modal_events();
        console.log('Kaltura modals module initialized');
        return true;
    };

    return obj;

}());
