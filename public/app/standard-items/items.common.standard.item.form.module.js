/**

 Copyright 2024 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

const itemsCommonStandardItemFormModule = (function () {

    'use strict';

    const APP_PATH = endpointsModule.get_app_path();

    let obj = {};
    let styles_promise = null;
    // ==================== MEDIA PICKER HELPERS ====================

    const MEDIA_TYPE_ICONS = {
        'image': 'fa-file-image-o',
        'video': 'fa-file-video-o',
        'audio': 'fa-file-audio-o',
        'pdf': 'fa-file-pdf-o',
        'moving image': 'fa-file-video-o',
        'sound': 'fa-file-audio-o'
    };

    /**
     * Decodes HTML entities in a string (XSS middleware encodes at input time)
     */
    function decode_html_entities(str) {
        if (!str || typeof str !== 'string') return str;
        const textarea = document.createElement('textarea');
        textarea.innerHTML = str;
        return textarea.value;
    }

    /**
     * Strips HTML tags from a string, returning plain text. Media names can carry
     * legacy HTML markup (e.g. "<strong>Name</strong>"); strip it so selected-media
     * card labels show clean text, matching the picker grid.
     */
    function strip_html_tags(str) {
        if (!str || typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    }

    /**
     * Builds a thumbnail URL for a media library asset based on its ingest method
     * @param {Object} media - Object with uuid, ingest_method, kaltura_thumbnail_url, repo_uuid, thumbnail_path
     * @returns {string} Thumbnail URL or empty string
     */
    function build_thumbnail_url(media) {

        if (!media || !media.uuid) return '';

        const token = authModule.get_user_token();

        // Kaltura assets use their own thumbnail URL
        if (media.ingest_method === 'kaltura' && media.kaltura_thumbnail_url) {
            let url = decode_html_entities(media.kaltura_thumbnail_url);
            if (url.startsWith('http://')) {
                url = url.replace('http://', 'https://');
            }
            return url;
        }

        // Repository imports: repo thumbnail endpoint
        if (media.ingest_method === 'repository' && media.repo_uuid) {
            return `${APP_PATH}/api/v1/media/library/repo/thumbnail?uuid=${encodeURIComponent(media.repo_uuid)}&token=${encodeURIComponent(token)}`;
        }

        // Uploaded files: media library thumbnail endpoint
        if (media.thumbnail_path) {
            return `${APP_PATH}/api/v1/media/library/thumbnail/${media.uuid}?token=${encodeURIComponent(token)}`;
        }

        return '';
    }

    /**
     * Gets a Font Awesome icon class for a media type
     */
    function get_media_type_icon(media_type) {
        return MEDIA_TYPE_ICONS[(media_type || '').toLowerCase()] || 'fa-file-o';
    }

    /**
     * Updates a preview area with a media asset's thumbnail or type icon
     * @param {string} display_selector - Preview area container selector
     * @param {string} filename_selector - Filename display span selector
     * @param {string} trash_selector - Trash link selector
     * @param {Object} media - Media object with uuid, name, media_type, etc.
     */
    function update_media_preview(display_selector, filename_selector, trash_selector, media) {
        const display_el = document.querySelector(display_selector);
        const filename_el = document.querySelector(filename_selector);
        const trash_el = document.querySelector(trash_selector);

        if (!display_el) return;

        const thumb_url = build_thumbnail_url(media);
        const display_name = strip_html_tags(media.name || media.original_filename || 'Untitled');

        if (thumb_url) {
            const img = document.createElement('img');
            img.src = thumb_url;
            img.alt = display_name;
            img.onerror = function () {
                // Fall back to type icon on broken image
                display_el.innerHTML = '';
                const placeholder = document.createElement('div');
                placeholder.className = 'media-placeholder';
                placeholder.style.color = '#007bff';
                const icon = document.createElement('i');
                icon.className = `fa ${get_media_type_icon(media.media_type)}`;
                icon.style.fontSize = '3rem';
                const label = document.createElement('span');
                label.textContent = media.media_type || 'Media';
                placeholder.appendChild(icon);
                placeholder.appendChild(label);
                display_el.appendChild(placeholder);
            };
            display_el.innerHTML = '';
            display_el.appendChild(img);
        } else {
            // Non-image types without thumbnails: show type icon
            display_el.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.className = 'media-placeholder';
            placeholder.style.color = '#007bff';
            const icon = document.createElement('i');
            icon.className = `fa ${get_media_type_icon(media.media_type)}`;
            icon.style.fontSize = '3rem';
            const label = document.createElement('span');
            label.textContent = media.media_type || 'Media';
            placeholder.appendChild(icon);
            placeholder.appendChild(label);
            display_el.appendChild(placeholder);
        }

        if (filename_el) {
            filename_el.textContent = display_name;
        }

        if (trash_el) {
            trash_el.style.display = 'inline';
        }
    }

    /**
     * Resets a preview area back to its default empty state
     */
    function reset_media_preview(display_selector, filename_selector, trash_selector, placeholder_icon, placeholder_text) {
        const display_el = document.querySelector(display_selector);
        const filename_el = document.querySelector(filename_selector);
        const trash_el = document.querySelector(trash_selector);

        if (display_el) {
            display_el.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.className = 'media-placeholder';
            const icon = document.createElement('i');
            icon.className = `fa ${placeholder_icon}`;
            const label = document.createElement('span');
            label.textContent = placeholder_text;
            placeholder.appendChild(icon);
            placeholder.appendChild(label);
            display_el.appendChild(placeholder);
        }

        if (filename_el) {
            filename_el.textContent = '';
        }

        if (trash_el) {
            trash_el.style.display = 'none';
        }
    }

    /**
     * Toggles the PDF "Open to page" field visibility based on media type
     * @param {string} media_type - The selected media type
     */
    function toggle_pdf_open_to_page(media_type) {
        const group = document.querySelector('#pdf-open-to-page-group');
        if (!group) return;

        const is_pdf = (media_type || '').toLowerCase() === 'pdf';
        group.style.display = is_pdf ? '' : 'none';

        // Reset to default value when hidden
        if (!is_pdf) {
            const input = document.querySelector('#pdf-open-to-page');
            if (input) input.value = '1';
        }
    }

    /**
     * Shows or hides the read-only alt text display based on the selected media asset.
     * Displays alt text when the media is an image, has alt_text populated,
     * and is_alt_text_decorative is 0.
     * @param {Object|null} media - Media object (null to hide)
     */
    function toggle_alt_text_display(media) {
        const container = document.querySelector('#image-alt-text');
        if (!container) return;

        const display_el = document.querySelector('#item-alt-text-display');
        const is_image = (media?.media_type || '').toLowerCase() === 'image';
        const alt_text = (media?.alt_text || '').trim();
        const is_not_decorative = Number(media?.is_alt_text_decorative) === 0;

        if (is_image && alt_text.length > 0 && is_not_decorative) {
            if (display_el) display_el.value = alt_text;
            container.style.display = '';
        } else {
            if (display_el) display_el.value = '';
            container.style.display = 'none';
        }
    }

    // ── Smart caption auto-fill (add forms) ──────────────────────────────────
    // Mirror the selected media's description into the Caption field, refreshing
    // on each new selection, until the user edits the caption (then leave it).
    let _caption_autofill_enabled = false;
    let _caption_user_edited = false;

    function autofill_caption_from_media(media, previous_media_uuid) {
        if (!_caption_autofill_enabled || _caption_user_edited) {
            return;
        }
        // Only act when the media actually changed — re-selecting the same media,
        // or the saved media on first load of an edit form, must not overwrite the
        // caption. On the add form the previous uuid is empty, so the first pick fills.
        if (((media && media.uuid) || '') === (previous_media_uuid || '')) {
            return;
        }
        const caption_el = document.querySelector('#item-caption-input');
        if (!caption_el) {
            return;
        }
        // description is entity-encoded at input time; decode so the caption holds
        // real text and round-trips correctly on save.
        caption_el.value = decode_html_entities((media && media.description) || '');
    }

    /**
     * Handles media asset selection from the picker for Item Media
     */
    function handle_item_media_selected(media) {
        const previous_media_uuid = (document.querySelector('#item-media-uuid') || {}).value || '';
        const set_val = (sel, val) => {
            const el = document.querySelector(sel);
            if (el) el.value = val;
        };

        set_val('#item-media-uuid', media.uuid || '');
        set_val('#item-media-uuid-prev', media.uuid || '');
        set_val('#item-media-type', media.media_type || '');
        set_val('#item-mime-type', media.mime_type || '');

        update_media_preview(
            '#item-media-display',
            '#item-media-filename-display',
            '#item-media-trash',
            media
        );

        toggle_pdf_open_to_page(media.media_type);
        toggle_alt_text_display(media);

        autofill_caption_from_media(media, previous_media_uuid);
    }

    /**
     * Handles media asset selection from the picker for Thumbnail
     */
    function handle_thumbnail_selected(media) {
        const set_val = (sel, val) => {
            const el = document.querySelector(sel);
            if (el) el.value = val;
        };

        set_val('#thumbnail-media-uuid', media.uuid || '');
        set_val('#thumbnail-media-uuid-prev', media.uuid || '');

        update_media_preview(
            '#thumbnail-image-display',
            '#thumbnail-filename-display',
            '#thumbnail-trash',
            media
        );
    }

    /**
     * Clears the Item Media selection
     */
    function clear_item_media() {
        const previous_media_uuid = (document.querySelector('#item-media-uuid') || {}).value || '';
        const set_val = (sel, val) => {
            const el = document.querySelector(sel);
            if (el) el.value = val;
        };

        // Remove exhibit association from the media record being cleared (fire-and-forget)
        const exhibit_uuid = helperModule.get_parameter_by_name('exhibit_id');
        const prev_uuid_el = document.querySelector('#item-media-uuid-prev');
        const prev_uuid = prev_uuid_el ? prev_uuid_el.value : null;

        if (exhibit_uuid && prev_uuid && typeof mediaPickerModule !== 'undefined') {
            mediaPickerModule.remove_exhibit_association(prev_uuid, exhibit_uuid, 'item_media');
        }

        set_val('#item-media-uuid', '');
        set_val('#item-media-uuid-prev', '');
        set_val('#item-media-type', '');
        set_val('#item-mime-type', '');

        reset_media_preview(
            '#item-media-display',
            '#item-media-filename-display',
            '#item-media-trash',
            'fa-file-o',
            'No media selected'
        );

        toggle_pdf_open_to_page('');
        toggle_alt_text_display(null);

        autofill_caption_from_media(null, previous_media_uuid);
    }

    /**
     * Clears the Thumbnail selection
     */
    function clear_thumbnail() {
        // Remove exhibit association from the thumbnail media record being cleared (fire-and-forget)
        const exhibit_uuid = helperModule.get_parameter_by_name('exhibit_id');
        const prev_uuid_el = document.querySelector('#thumbnail-media-uuid-prev');
        const prev_uuid = prev_uuid_el ? prev_uuid_el.value : null;

        if (exhibit_uuid && prev_uuid && typeof mediaPickerModule !== 'undefined') {
            mediaPickerModule.remove_exhibit_association(prev_uuid, exhibit_uuid, 'thumbnail');
        }

        const el = document.querySelector('#thumbnail-media-uuid');
        if (el) el.value = '';

        const prev_el = document.querySelector('#thumbnail-media-uuid-prev');
        if (prev_el) prev_el.value = '';

        reset_media_preview(
            '#thumbnail-image-display',
            '#thumbnail-filename-display',
            '#thumbnail-trash',
            'fa-picture-o',
            'No image selected'
        );
    }

    /**
     * Wires up media picker button handlers and trash links
     */
    function init_media_picker_buttons() {

        if (typeof mediaPickerModule === 'undefined') {
            console.error('FATAL: init_media_picker_buttons requires mediaPickerModule to be loaded');
            return;
        }

        // Smart caption auto-fill (add + edit forms): mirror the selected media's
        // description into the Caption whenever the media changes — the add form
        // starts empty so the first pick fills; the edit form updates when a
        // different file is picked. The user typing in the caption turns it off so
        // their text is never overwritten.
        _caption_autofill_enabled = true;
        const caption_input = document.querySelector('#item-caption-input');
        if (caption_input) {
            caption_input.addEventListener('input', function () {
                _caption_user_edited = true;
            });
        }

        // Select Media button — no type filter (all asset types)
        const pick_media_btn = document.querySelector('#pick-item-media-btn');
        if (pick_media_btn) {
            pick_media_btn.addEventListener('click', function () {
                const prev_el = document.querySelector('#item-media-uuid-prev');
                mediaPickerModule.open({
                    role: 'item_media',
                    exhibit_uuid: helperModule.get_parameter_by_name('exhibit_id') || null,
                    previous_media_uuid: prev_el ? prev_el.value || null : null,
                    media_type_filter: null,
                    create_exhibit_binding: false,
                    on_select: handle_item_media_selected
                });
            });
        }

        // Select Thumbnail button — filtered to images
        const pick_thumb_btn = document.querySelector('#pick-thumbnail-btn');
        if (pick_thumb_btn) {
            pick_thumb_btn.addEventListener('click', function () {
                const prev_el = document.querySelector('#thumbnail-media-uuid-prev');
                mediaPickerModule.open({
                    role: 'thumbnail',
                    exhibit_uuid: helperModule.get_parameter_by_name('exhibit_id') || null,
                    previous_media_uuid: prev_el ? prev_el.value || null : null,
                    media_type_filter: 'image',
                    create_exhibit_binding: false,
                    on_select: handle_thumbnail_selected
                });
            });
        }

        // Trash handlers
        const media_trash = document.querySelector('#item-media-trash');
        if (media_trash) {
            media_trash.addEventListener('click', function (e) {
                e.preventDefault();
                clear_item_media();
            });
        }

        const thumb_trash = document.querySelector('#thumbnail-trash');
        if (thumb_trash) {
            thumb_trash.addEventListener('click', function (e) {
                e.preventDefault();
                clear_thumbnail();
            });
        }
    }

    // ==================== STYLES DROPDOWN ====================

    /**
     * Cache of parsed exhibit style options keyed by style key (e.g. "item1")
     * @type {Object|null}
     */
    let exhibit_style_map = null;

    /**
     * Human-readable labels for style keys
     */
    const STYLE_KEY_LABELS = {
        'item1': 'Item Style 1',
        'item2': 'Item Style 2',
        'item3': 'Item Style 3'
    };

    /**
     * Checks whether a style object has at least one non-empty property
     * @param {Object} style_obj - Style properties object
     * @returns {boolean}
     */
    function has_style_values(style_obj) {
        if (!style_obj || typeof style_obj !== 'object') return false;
        return Object.values(style_obj).some(v => v !== undefined && v !== null && v !== '');
    }

    /**
     * Fetches the exhibit record and populates the Styles dropdown
     * with any defined item style presets from tbl_exhibits.styles.
     * Shows the dropdown group only when at least one option is available.
     */
    async function fetch_and_populate_styles() {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            console.warn('[styles] No exhibit_id in URL params');
            return;
        }

        const token = authModule.get_user_token();

        if (!token) {
            console.warn('[styles] No auth token available');
            return;
        }

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.exhibit_records?.endpoints?.get?.endpoint) {
            console.warn('[styles] Exhibit GET endpoint not found in endpoints config. Available keys:',
                EXHIBITS_ENDPOINTS?.exhibits?.exhibit_records
                    ? Object.keys(EXHIBITS_ENDPOINTS.exhibits.exhibit_records)
                    : 'exhibit_records missing');
            return;
        }

        const endpoint = EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.get.endpoint
            .replace(':exhibit_id', encodeURIComponent(exhibit_id));

        try {

            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (!response || response.status !== 200 || !response.data?.data) {
                console.warn('[styles] Exhibit API response invalid. Status:', response?.status, 'Data:', response?.data);
                return;
            }

            const exhibit_record = response.data.data;
            let styles_raw = exhibit_record.styles;

            if (!styles_raw) {
                console.warn('[styles] Exhibit record has no styles field');
                return;
            }

            // Parse JSON string if needed
            if (typeof styles_raw === 'string') {

                try {
                    styles_raw = JSON.parse(styles_raw);
                } catch (e) {
                    console.warn('Failed to parse exhibit styles JSON:', e.message);
                    return;
                }
            }

            // Navigate into the "exhibit" wrapper if present
            const style_root = styles_raw.exhibit || styles_raw;
            console.info('[styles] Exhibit style keys:', Object.keys(style_root),
                'Raw item entries:', JSON.stringify(
                    Object.fromEntries(Object.entries(style_root).filter(([k]) => k.startsWith('item')))
                ));

            // Extract item-relevant keys that have at least one non-empty value
            exhibit_style_map = {};

            for (const [key, value] of Object.entries(style_root)) {

                if (!key.startsWith('item')) continue;
                if (!has_style_values(value)) continue;

                exhibit_style_map[key] = value;
            }

            if (Object.keys(exhibit_style_map).length === 0) {
                exhibit_style_map = null;
                console.warn('[styles] No item style presets found in exhibit styles');
                return;
            }

            // Render the style presets as a radio "swatch chooser" — each option
            // shows the preset's background + font colors as circles (mirrors the
            // exhibit Styles form). Reuses helperModule + the .color-swatch visual.
            const sorted_keys = Object.keys(exhibit_style_map).sort();
            helperModule.build_item_style_swatch_options('#item-style-options', sorted_keys, exhibit_style_map, STYLE_KEY_LABELS);

            // Show the styles card
            const card_el = document.querySelector('#item-styles-card');
            if (card_el) card_el.style.display = '';

        } catch (error) {
            console.error('Failed to fetch exhibit styles:', error.message);
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Populates the media preview areas from an existing item record (used by edit module)
     * @param {Object} record - Item record from the API
     */
    obj.populate_media_previews = function (record) {

        if (!record) return;

        // Item Media preview
        if (record.media_uuid) {
            const set_val = (sel, val) => {
                const el = document.querySelector(sel);
                if (el) el.value = val;
            };

            set_val('#item-media-uuid', record.media_uuid);
            set_val('#item-media-uuid-prev', record.media_uuid);
            set_val('#item-media-type', record.item_type || '');
            set_val('#item-mime-type', record.mime_type || '');

            // Build a minimal media object for the preview renderer
            // Fields like ingest_method, kaltura_thumbnail_url, repo_uuid, and
            // thumbnail_path come from the LEFT JOIN with tbl_media_library
            const media_obj = {
                uuid: record.media_uuid,
                media_type: record.item_type || '',
                mime_type: record.mime_type || '',
                name: record.media_name || record.title || '',
                ingest_method: record.media_ingest_method || null,
                kaltura_thumbnail_url: record.media_kaltura_thumbnail_url || null,
                repo_uuid: record.media_repo_uuid || null,
                thumbnail_path: record.media_thumbnail_path || null,
                alt_text: record.media_alt_text || null,
                is_alt_text_decorative: record.media_is_alt_text_decorative ?? null
            };

            update_media_preview(
                '#item-media-display',
                '#item-media-filename-display',
                '#item-media-trash',
                media_obj
            );

            // Toggle PDF open-to-page field and populate saved value
            toggle_pdf_open_to_page(record.item_type);

            if ((record.item_type || '').toLowerCase() === 'pdf' && record.pdf_open_to_page) {
                const page_input = document.querySelector('#pdf-open-to-page');
                if (page_input) page_input.value = record.pdf_open_to_page;
            }

            // Show read-only alt text from the media library asset
            toggle_alt_text_display(media_obj);
        }

        // Thumbnail preview
        if (record.thumbnail_media_uuid) {
            const set_val = (sel, val) => {
                const el = document.querySelector(sel);
                if (el) el.value = val;
            };

            set_val('#thumbnail-media-uuid', record.thumbnail_media_uuid);
            set_val('#thumbnail-media-uuid-prev', record.thumbnail_media_uuid);

            const thumb_obj = {
                uuid: record.thumbnail_media_uuid,
                media_type: 'image',
                name: record.thumbnail_media_name || 'Thumbnail',
                ingest_method: record.thumbnail_ingest_method || null,
                kaltura_thumbnail_url: null,
                repo_uuid: record.thumbnail_repo_uuid || null,
                thumbnail_path: record.thumbnail_media_thumbnail_path || null
            };

            update_media_preview(
                '#thumbnail-image-display',
                '#thumbnail-filename-display',
                '#thumbnail-trash',
                thumb_obj
            );
        }
    };

    /**
     * Sets the Styles dropdown to a previously saved value (called by edit module)
     * @param {string|null} styles_value - Saved style key (e.g. "item1") or null
     */
    obj.set_item_style = function (styles_value) {
        helperModule.check_item_style_option(styles_value);
    };

    /**
     * Returns a promise that resolves when exhibit styles have been fetched
     * and the dropdown populated. Used by edit module to await before pre-selecting.
     * @returns {Promise}
     */
    obj.wait_for_styles = function () {
        return styles_promise || Promise.resolve();
    };

    obj.get_common_standard_item_form_fields = function () {

        try {

            const item = {};
            const path_segments = window.location.pathname.split('/').filter(Boolean);
            const isTextPath = path_segments.includes('text');
            const isMediaPath = path_segments.includes('media');

            // Helper function for safe DOM queries
            const getElementValue = (selector, defaultValue = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? defaultValue;
            };

            // ShowError now optionally accepts a field
            // selector. When provided, the message is associated with
            // the field via domModule.set_field_error (aria-invalid +
            // aria-describedby) in addition to the page-level alert.
            const showError = (message, field_selector) => {
                const messageEl = document.querySelector('#message');
                if (messageEl) {
                    domModule.set_alert(messageEl, 'danger', message);
                }
                if (field_selector) {
                    const error_id = field_selector.replace('#', '') + '-error';
                    domModule.set_field_error(field_selector, error_id, message);
                }
            };

            // Clear any prior field-level error state from a
            // previous submission so the now-valid fields lose their
            // aria-invalid="true" and the stale message is removed.
            ['#item-text-input', '#item-media-uuid'].forEach(s => {
                domModule.clear_field_error(s, s.replace('#', '') + '-error');
            });

            // Get item metadata
            item.text = getElementValue('#item-text-input');

            // Validate text content for text paths
            if (isTextPath && item.text.length === 0) {
                showError('Please enter "Text" for this item', '#item-text-input');
                return false;
            }

            // Get optional published status
            const publishedEl = document.querySelector('#is-published');
            if (publishedEl) {
                item.is_published = publishedEl.value;
            }

            // Get radio button selections
            item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));
            item.media_width = helperModule.get_checked_radio_button(document.getElementsByName('media_width'));

            // Collect the selected style preset (radio "swatch chooser"); None → null.
            item.styles = helperModule.get_checked_radio_button(document.getElementsByName('styles'));

            item.margins = getElementValue('#margins');
            item.text_alignment = getElementValue('#text-align');

            // Handle media-specific logic
            if (isMediaPath) {

                // Collect media picker values
                item.media_uuid = getElementValue('#item-media-uuid');
                item.item_type = getElementValue('#item-media-type');
                item.mime_type = getElementValue('#item-mime-type');
                item.thumbnail_media_uuid = getElementValue('#thumbnail-media-uuid');

                // Collect optional Pop-up Window Description + Caption (media items only)
                item.description = getElementValue('#item-description-input');
                item.caption = getElementValue('#item-caption-input');

                // Collect Embed Item flag (audio/video embed inline; embedded items
                // skip the pop-up viewer). Mirrors grid/timeline item handling.
                const embed_item_el = document.querySelector('#embed-item');
                item.is_embedded = (embed_item_el && embed_item_el.checked) ? 1 : 0;

                const media_padding_el = document.querySelector('#media-padding');
                item.media_padding = (media_padding_el && media_padding_el.checked) ? 0 : 1;

                const wrap_text_el = document.querySelector('#wrap-text');
                item.wrap_text = (wrap_text_el && !wrap_text_el.checked) ? 0 : 1;

                // Collect PDF open-to-page value when media type is PDF
                if (item.item_type.toLowerCase() === 'pdf') {
                    const page_val = parseInt(getElementValue('#pdf-open-to-page', '1'), 10);
                    item.pdf_open_to_page = (!isNaN(page_val) && page_val >= 1) ? page_val : 1;
                } else {
                    item.pdf_open_to_page = 1;
                }

                // Validate media content
                if (!item.media_uuid) {
                    showError('Please select a media item', '#item-media-uuid');
                    return false;
                }

            } else {
                // Default to text type for non-media paths
                item.item_type = 'text';
                item.mime_type = 'text/plain';
            }

            return item;

        } catch (error) {
            const messageEl = document.querySelector('#message');
            if (messageEl) {
                domModule.set_alert(messageEl, 'danger', error.message);
            }
            return false; // Return false on error for consistency
        }
    };

    obj.init = async function () {

        try {

            if (window.location.pathname.indexOf('text') !== -1) {
                const required_text = document.querySelector('#is-required-text');
                if (required_text) {
                    required_text.innerHTML = 'Exhibit Text <span class="badge badge-required">Required</span>';
                }
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            // Note: #back-to-items href is now wired by navModule.wire_nav_links()
            // via data-nav-path attributes set in the unified nav partial.
            // set_preview_link() is already called inside init().

            helperModule.show_form();

            // Wire up media picker buttons on media paths
            if (window.location.pathname.indexOf('media') !== -1) {
                init_media_picker_buttons();

                // Move the created/updated metadata ("Created by ... | Last updated by ...")
                // from the Item Data card header to the Media card header. It is populated
                // later by the edit/details module via #created; relocating the element
                // (with its float-right wrapper) preserves that wiring. Scoped to media
                // paths, so the shared text form keeps it in the Item Data card.
                const created_meta = document.querySelector('#created');
                const media_card_header = document.querySelector('#item-media-card .card-header');
                if (created_meta && media_card_header) {
                    media_card_header.appendChild(created_meta.closest('.btn-group') || created_meta);
                }

                // Exhibit Text is optional on media items (only required on text
                // items) — relabel, drop the "Preview Field" link, and move the Wrap
                // Text checkbox to sit directly under this label (above the text box).
                // Scoped to the media form so the shared text form is untouched.
                const exhibit_text_label = document.querySelector('#is-required-text');
                if (exhibit_text_label) {
                    exhibit_text_label.innerHTML = 'Exhibit Text';

                    const exhibit_text_block = exhibit_text_label.closest('.form-text');
                    if (exhibit_text_block) {
                        // Remove the "Preview Field" link beside the Exhibit Text label.
                        const preview_link = exhibit_text_block.querySelector('a');
                        if (preview_link) {
                            preview_link.remove();
                        }

                        // Relocate the Wrap Text checkbox (with its info text) to
                        // directly below the Exhibit Text text box.
                        const text_box = document.querySelector('#item-text-input');
                        const wrap_text_group = document.querySelector('#wrap-text-group');
                        if (text_box && wrap_text_group) {
                            // Drop the separator the Wrap Text block brought from the media card.
                            const wrap_hr = wrap_text_group.previousElementSibling;
                            if (wrap_hr && wrap_hr.tagName === 'HR') {
                                wrap_hr.remove();
                            }
                            text_box.insertAdjacentElement('afterend', wrap_text_group);
                        }
                    }
                }

                // Reveal the media-only optional fields, hidden by default so they
                // never appear on text item forms: Pop-up Window Description (in the
                // shared item-data-card partial) and Caption (in the item-caption
                // partial, inside the Media card).
                ['#is-media-only-description', '#is-media-only-caption'].forEach(selector => {
                    const field = document.querySelector(selector);
                    if (field) field.style.display = '';
                });

                // Group the Embed Item control with the Pop-up Window Description:
                // relocate the checkbox to directly below the description text box.
                // Embedded audio/video skip the pop-up viewer, so the two belong together.
                const embed_group = document.querySelector('#embed-item-group');
                const description_box = document.querySelector('#item-description-input');
                if (embed_group && description_box) {
                    description_box.insertAdjacentElement('afterend', embed_group);
                }

                // Disable the Pop-up Window Description while Embed Item is checked
                // (embedded items do not open the pop-up). The edit form dispatches a
                // 'change' event after loading so the initial state stays in sync.
                const embed_checkbox = document.querySelector('#embed-item');
                const description_field = document.querySelector('#item-description-input');
                if (embed_checkbox && description_field) {
                    const sync_description_state = () => {
                        description_field.disabled = embed_checkbox.checked;
                        description_field.style.opacity = embed_checkbox.checked ? '0.5' : '';
                    };
                    embed_checkbox.addEventListener('change', sync_description_state);
                    sync_description_state();
                }
            }

            // Fetch and populate styles dropdown (both media and text paths)
            styles_promise = fetch_and_populate_styles();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
