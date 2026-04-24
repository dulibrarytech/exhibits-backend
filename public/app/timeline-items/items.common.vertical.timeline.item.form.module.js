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

const itemsCommonVerticalTimelineItemFormModule = (function () {

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
            return `${APP_PATH}/api/v1/media/library/thumbnail/${encodeURIComponent(media.uuid)}?token=${encodeURIComponent(token)}`;
        }

        return '';
    }

    /**
     * Updates a preview area with media thumbnail or type icon
     */
    function update_media_preview(display_selector, filename_selector, trash_selector, media) {
        const display_el = document.querySelector(display_selector);
        const filename_el = document.querySelector(filename_selector);
        const trash_el = document.querySelector(trash_selector);

        if (!display_el) return;

        const thumb_url = build_thumbnail_url(media);
        const display_name = media.name || media.original_filename || media.uuid || '';

        display_el.innerHTML = '';

        if (thumb_url) {
            const img = document.createElement('img');
            img.src = thumb_url;
            img.alt = display_name;
            img.onerror = function () {
                this.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'media-placeholder';
                const icon = document.createElement('i');
                const icon_class = MEDIA_TYPE_ICONS[media.media_type] || 'fa-file-o';
                icon.className = `fa ${icon_class}`;
                const label = document.createElement('span');
                label.textContent = display_name;
                placeholder.appendChild(icon);
                placeholder.appendChild(label);
                display_el.appendChild(placeholder);
            };
            display_el.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'media-placeholder';
            const icon = document.createElement('i');
            const icon_class = MEDIA_TYPE_ICONS[media.media_type] || 'fa-file-o';
            icon.className = `fa ${icon_class}`;
            const label = document.createElement('span');
            label.textContent = display_name;
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

    // ==================== MEDIA SELECTION HANDLERS ====================

    /**
     * Handles media asset selection from the picker for Item Media
     */
    function handle_item_media_selected(media) {
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

    // ==================== PUBLIC API ====================

    /**
     * Populates the media preview areas from an existing timeline item record (used by edit module)
     * @param {Object} record - Timeline item record from the API (with joined media library metadata)
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
            const media_obj = {
                uuid: record.media_uuid,
                media_type: record.item_type || '',
                mime_type: record.mime_type || '',
                name: record.media_name || record.media_filename || record.title || '',
                ingest_method: record.media_ingest_method || null,
                kaltura_thumbnail_url: record.media_kaltura_thumbnail_url || null,
                repo_uuid: record.media_repo_uuid || null,
                thumbnail_path: record.media_thumbnail_path || null
            };

            update_media_preview(
                '#item-media-display',
                '#item-media-filename-display',
                '#item-media-trash',
                media_obj
            );
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
                name: record.thumbnail_media_name || record.thumbnail_filename || 'Thumbnail',
                ingest_method: record.thumb_ingest_method || record.thumbnail_ingest_method || null,
                kaltura_thumbnail_url: record.thumb_kaltura_thumbnail_url || null,
                repo_uuid: record.thumbnail_repo_uuid || null,
                thumbnail_path: record.thumb_thumbnail_path || record.thumbnail_media_thumbnail_path || null
            };

            update_media_preview(
                '#thumbnail-image-display',
                '#thumbnail-filename-display',
                '#thumbnail-trash',
                thumb_obj
            );
        }
    };

    obj.get_common_timeline_item_form_fields = function () {

        try {

            const item = { styles: {} };
            const path = window.location.pathname;
            const is_media_path = path.includes('media');

            // Helper function for safe DOM queries
            const get_element_value = (selector, default_value = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? default_value;
            };

            const show_error = (message) => {
                const message_el = document.querySelector('#message');
                if (message_el) {
                    domModule.set_alert(message_el, 'danger', message);
                }
            };

            // Get item metadata
            item.title = get_element_value('#item-title-input');
            item.text = get_element_value('#item-text-input');
            item.date = get_element_value('input[type="date"]');

            // Validate required date field
            if (!item.date || item.date.length === 0) {
                show_error('Please enter a timeline date');
                return false;
            }

            // Validate date format (YYYY-MM-DD)
            const date_pattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!date_pattern.test(item.date)) {
                show_error('Please enter a valid date format (YYYY-MM-DD)');
                return false;
            }

            // Validate date is a real date
            const date_obj = new Date(item.date);
            if (isNaN(date_obj.getTime())) {
                show_error('Please enter a valid date');
                return false;
            }

            // Handle media-specific logic
            if (is_media_path) {

                // Read media fields from hidden inputs (media picker pattern)
                const media_uuid = get_element_value('#item-media-uuid');
                const media_type = get_element_value('#item-media-type');
                const mime_type = get_element_value('#item-mime-type');
                const thumbnail_media_uuid = get_element_value('#thumbnail-media-uuid');

                // Validate that a media item has been selected
                if (!media_uuid || media_uuid.length === 0) {
                    show_error('Please select a media item');
                    return false;
                }

                item.media_uuid = media_uuid;
                item.thumbnail_media_uuid = thumbnail_media_uuid || '';

                if (media_type) {
                    item.item_type = media_type;
                }

                if (mime_type) {
                    item.mime_type = mime_type;
                }

            } else {
                // Default to text type for non-media paths
                item.item_type = 'text';
                item.mime_type = 'text/plain';
            }

            // Get embed item checkbox value
            const embed_item_el = document.getElementById('embed-item');
            if (embed_item_el) {
                item.is_embedded = embed_item_el.checked ? 1 : 0;
            }

            return item;

        } catch (error) {
            console.error('Error in get_common_timeline_item_form_fields:', error.message);
            const message_el = document.querySelector('#message');
            if (message_el) {
                domModule.set_alert(message_el, 'danger', error.message);
            }
            return false;
        }
    };

    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            // Nav links wired by navModule.wire_nav_links() from the view
            // using data-nav-path + NAV_CONFIGS.timeline_item_form.
            navModule.init();
            helperModule.show_form();

            // Wire up media picker buttons if on a media form
            const path = window.location.pathname;
            if (path.includes('media')) {
                init_media_picker_buttons();
            }

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
