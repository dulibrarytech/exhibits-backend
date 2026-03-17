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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');

    let obj = {};

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
        const display_name = media.name || media.original_filename || 'Untitled';

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

    // ==================== MEDIA SUBJECTS HELPERS ====================

    /**
     * Parses a subject field value into an array of trimmed, non-empty strings.
     * Handles JSON arrays, comma-separated strings, and semicolon-separated strings.
     * @param {string|null|undefined} raw - Raw subject value from the database
     * @returns {string[]} Parsed subject array
     */
    function parse_subject_field(raw) {
        if (!raw || typeof raw !== 'string') return [];

        const trimmed = raw.trim();
        if (trimmed.length === 0) return [];

        // Try JSON array first
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map(s => (typeof s === 'string' ? s.trim() : String(s).trim()))
                        .filter(s => s.length > 0);
                }
            } catch (_) {
                // Fall through to string splitting
            }
        }

        // Split on semicolons first (more common for multi-value subject fields), then commas
        const delimiter = trimmed.includes(';') ? ';' : ',';
        return trimmed
            .split(delimiter)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    /**
     * Renders badges into a container element
     * @param {string} container_id - Badge container element ID
     * @param {string} group_id - Group wrapper element ID
     * @param {string[]} subjects - Array of subject strings
     * @param {string} badge_modifier - CSS class modifier (topic, genre, place)
     * @returns {boolean} True if at least one badge was rendered
     */
    function render_subject_badges(container_id, group_id, subjects, badge_modifier) {
        const container = document.getElementById(container_id);
        const group = document.getElementById(group_id);
        if (!container || !group) return false;

        container.innerHTML = '';

        if (!subjects || subjects.length === 0) {
            group.style.display = 'none';
            return false;
        }

        subjects.forEach(subject => {
            const badge = document.createElement('span');
            badge.className = `media-subject-badge media-subject-badge--${badge_modifier}`;
            badge.textContent = subject;
            container.appendChild(badge);
        });

        group.style.display = '';
        return true;
    }

    /**
     * Renders the media subjects card for a selected media asset.
     * Parses topics_subjects, genre_form_subjects, and places_subjects
     * and displays them as color-coded badges grouped by type.
     *
     * @param {Object|null} media - Media object with subject fields (null to hide)
     */
    function render_media_subjects(media) {
        const card = document.getElementById('media-subjects-card');
        if (!card) return;

        // Hide and reset when no media or null
        if (!media) {
            card.style.display = 'none';
            return;
        }

        // Parse all three subject types
        const topics = parse_subject_field(media.topics_subjects);
        const genres = parse_subject_field(media.genre_form_subjects);
        const places = parse_subject_field(media.places_subjects);

        const has_any = topics.length > 0 || genres.length > 0 || places.length > 0;

        if (!has_any) {
            card.style.display = 'none';
            return;
        }

        // Render each group
        render_subject_badges('media-subjects-topics', 'media-subjects-topics-group', topics, 'topic');
        render_subject_badges('media-subjects-genre', 'media-subjects-genre-group', genres, 'genre');
        render_subject_badges('media-subjects-places', 'media-subjects-places-group', places, 'place');

        // Hide the empty-state message
        const empty_el = document.getElementById('media-subjects-empty');
        if (empty_el) empty_el.style.display = 'none';

        // Show the card (explicit 'flex' matches Bootstrap 4 .card layout and overrides CSS rule)
        card.style.display = 'flex';
    }

    /**
     * Hides and resets the media subjects card
     */
    function hide_media_subjects() {
        const card = document.getElementById('media-subjects-card');
        if (!card) return;
        card.style.display = 'none';

        // Clear badge containers
        ['media-subjects-topics', 'media-subjects-genre', 'media-subjects-places'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });

        // Hide groups
        ['media-subjects-topics-group', 'media-subjects-genre-group', 'media-subjects-places-group'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    /**
     * Handles media asset selection from the picker for Item Media
     */
    function handle_item_media_selected(media) {
        const set_val = (sel, val) => {
            const el = document.querySelector(sel);
            if (el) el.value = val;
        };

        set_val('#item-media-uuid', media.uuid || '');
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
        render_media_subjects(media);
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
        const set_val = (sel, val) => {
            const el = document.querySelector(sel);
            if (el) el.value = val;
        };

        set_val('#item-media-uuid', '');
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
        hide_media_subjects();
    }

    /**
     * Clears the Thumbnail selection
     */
    function clear_thumbnail() {
        const el = document.querySelector('#thumbnail-media-uuid');
        if (el) el.value = '';

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

        // Select Media button — no type filter (all asset types)
        const pick_media_btn = document.querySelector('#pick-item-media-btn');
        if (pick_media_btn) {
            pick_media_btn.addEventListener('click', function () {
                mediaPickerModule.open({
                    role: 'item_media',
                    exhibit_uuid: null,
                    media_type_filter: null,
                    on_select: handle_item_media_selected
                });
            });
        }

        // Select Thumbnail button — filtered to images
        const pick_thumb_btn = document.querySelector('#pick-thumbnail-btn');
        if (pick_thumb_btn) {
            pick_thumb_btn.addEventListener('click', function () {
                mediaPickerModule.open({
                    role: 'thumbnail',
                    exhibit_uuid: null,
                    media_type_filter: 'image',
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
                is_alt_text_decorative: record.media_is_alt_text_decorative ?? null,
                topics_subjects: record.media_topics_subjects || null,
                genre_form_subjects: record.media_genre_form_subjects || null,
                places_subjects: record.media_places_subjects || null
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

            // Show media subjects from the media library asset
            render_media_subjects(media_obj);
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

    obj.get_common_standard_item_form_fields = function () {

        try {

            const item = { styles: {} };
            const path = window.location.pathname;
            const isTextPath = path.includes('text');
            const isMediaPath = path.includes('media');

            // Helper function for safe DOM queries
            const getElementValue = (selector, defaultValue = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? defaultValue;
            };

            const showError = (message) => {
                const messageEl = document.querySelector('#message');
                if (messageEl) {
                    messageEl.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                }
            };

            // Get item metadata
            item.title = getElementValue('#item-title-input');
            item.text = getElementValue('#item-text-input');

            // Validate text content for text paths
            if (isTextPath && item.text.length === 0) {
                showError('Please enter "Text" for this item');
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

            // Build styles object with safe access
            const buildStyles = () => {
                const styleMap = {
                    backgroundColor: '#item-background-color',
                    color: '#item-font-color',
                    fontFamily: '#item-font',
                };

                for (const [cssKey, selector] of Object.entries(styleMap)) {
                    const value = getElementValue(selector);
                    if (value) {
                        item.styles[cssKey] = value;
                    }
                }

                // Handle font size with unit
                const fontSize = getElementValue('#item-font-size');
                if (fontSize) {
                    item.styles.fontSize = `${fontSize}px`;
                }
            };

            buildStyles();

            // Handle media-specific logic
            if (isMediaPath) {

                // Collect media picker values
                item.media_uuid = getElementValue('#item-media-uuid');
                item.item_type = getElementValue('#item-media-type');
                item.mime_type = getElementValue('#item-mime-type');
                item.thumbnail_media_uuid = getElementValue('#thumbnail-media-uuid');

                // Collect PDF open-to-page value when media type is PDF
                if (item.item_type.toLowerCase() === 'pdf') {
                    const page_val = parseInt(getElementValue('#pdf-open-to-page', '1'), 10);
                    item.pdf_open_to_page = (!isNaN(page_val) && page_val >= 1) ? page_val : 1;
                } else {
                    item.pdf_open_to_page = 1;
                }

                // Validate media content
                if (!item.media_uuid) {
                    showError('Please select a media item');
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
                messageEl.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            }
            return false; // Return false on error for consistency
        }
    };

    obj.init = async function () {

        try {

            if (window.location.pathname.indexOf('text') !== -1) {
                document.querySelector('#is-required-text').innerHTML = '<span style="color: darkred">*</span> Text<small><em>(Required)</em></small>';
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_items();
            navModule.set_preview_link();

            document.querySelector('#item-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-background-color')) {
                    document.querySelector('#item-background-color').value = document.querySelector('#item-background-color-picker').value;
                }
            });

            document.querySelector('#item-background-color').addEventListener('input', () => {
                document.querySelector('#item-background-color-picker').value = document.querySelector('#item-background-color').value;
            });

            document.querySelector('#item-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-font-color')) {
                    document.querySelector('#item-font-color').value = document.querySelector('#item-font-color-picker').value;
                }
            });

            document.querySelector('#item-font-color').addEventListener('input', () => {
                document.querySelector('#item-font-color-picker').value = document.querySelector('#item-font-color').value;
            });

            helperModule.show_form();

            // Wire up media picker buttons on media paths
            if (window.location.pathname.indexOf('media') !== -1) {
                init_media_picker_buttons();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
