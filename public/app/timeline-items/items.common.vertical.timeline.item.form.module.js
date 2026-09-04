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

    const APP_PATH = endpointsModule.get_app_path();

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

        // Kaltura assets use their own thumbnail URL
        if (media.ingest_method === 'kaltura' && media.kaltura_thumbnail_url) {
            let url = decode_html_entities(media.kaltura_thumbnail_url);
            if (url.startsWith('http://')) {
                url = url.replace('http://', 'https://');
            }
            return url;
        }

        // Same-origin thumbnail requests rely on the HttpOnly exhibits_token
        // cookie for authentication, so the JWT is never embedded in <img src>.
        if (media.ingest_method === 'repository' && media.repo_uuid) {
            return `${APP_PATH}/api/v1/media/library/repo/thumbnail?uuid=${encodeURIComponent(media.repo_uuid)}`;
        }

        // Uploaded files: media library thumbnail endpoint
        if (media.thumbnail_path) {
            return `${APP_PATH}/api/v1/media/library/thumbnail/${encodeURIComponent(media.uuid)}`;
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
        const display_name = strip_html_tags(media.name || media.original_filename || media.uuid || '');

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
     * Shows or hides the read-only Media Name display for the selected media asset
     * @param {Object|null} media - Media object (null to hide)
     */
    function toggle_media_name_display(media) {
        const group = document.querySelector('#item-media-name-display-group');
        if (!group) return;

        const display_el = document.querySelector('#item-media-name-display');
        const name = decode_html_entities((media && media.name) || '').trim();

        if (name.length > 0) {
            if (display_el) display_el.value = name;
            group.style.display = '';
        } else {
            if (display_el) display_el.value = '';
            group.style.display = 'none';
        }
    }

    // ── Smart caption auto-fill (add forms) ──────────────────────────────────
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

        domModule.set_value('#item-media-uuid', media.uuid || '');
        domModule.set_value('#item-media-uuid-prev', media.uuid || '');
        domModule.set_value('#item-media-type', media.media_type || '');
        domModule.set_value('#item-mime-type', media.mime_type || '');

        update_media_preview(
            '#item-media-display',
            '#item-media-filename-display',
            '#item-media-trash',
            media
        );

        toggle_media_name_display(media);

        autofill_caption_from_media(media, previous_media_uuid);
    }

    /**
     * Handles media asset selection from the picker for Thumbnail
     */
    function handle_thumbnail_selected(media) {

        domModule.set_value('#thumbnail-media-uuid', media.uuid || '');
        domModule.set_value('#thumbnail-media-uuid-prev', media.uuid || '');

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

        // Remove exhibit association from the media record being cleared (fire-and-forget)
        const exhibit_uuid = helperModule.get_parameter_by_name('exhibit_id');
        const prev_uuid_el = document.querySelector('#item-media-uuid-prev');
        const prev_uuid = prev_uuid_el ? prev_uuid_el.value : null;

        if (exhibit_uuid && prev_uuid && typeof mediaPickerModule !== 'undefined') {
            mediaPickerModule.remove_exhibit_association(prev_uuid, exhibit_uuid, 'item_media');
        }

        domModule.set_value('#item-media-uuid', '');
        domModule.set_value('#item-media-uuid-prev', '');
        domModule.set_value('#item-media-type', '');
        domModule.set_value('#item-mime-type', '');

        reset_media_preview(
            '#item-media-display',
            '#item-media-filename-display',
            '#item-media-trash',
            'fa-file-o',
            'No media selected'
        );

        toggle_media_name_display(null);

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

        // Smart caption auto-fill: mirror the selected media's description into the Caption until the user edits it.
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

    // ==================== PUBLIC API ====================

    /**
     * Populates the media preview areas from an existing timeline item record (used by edit module)
     * @param {Object} record - Timeline item record from the API (with joined media library metadata)
     */
    obj.populate_media_previews = function (record) {

        if (!record) return;

        // Item Media preview
        if (record.media_uuid) {

            domModule.set_value('#item-media-uuid', record.media_uuid);
            domModule.set_value('#item-media-uuid-prev', record.media_uuid);
            domModule.set_value('#item-media-type', record.item_type || '');
            domModule.set_value('#item-mime-type', record.mime_type || '');

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

            toggle_media_name_display(media_obj);
        }

        // Thumbnail preview
        if (record.thumbnail_media_uuid) {

            domModule.set_value('#thumbnail-media-uuid', record.thumbnail_media_uuid);
            domModule.set_value('#thumbnail-media-uuid-prev', record.thumbnail_media_uuid);

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
            const is_media_path = window.location.pathname.split('/').filter(Boolean).includes('media');

            // Helper function for safe DOM queries
            const get_element_value = (selector, default_value = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? default_value;
            };

            ['#item-date-input', '#item-media-uuid'].forEach(s => {
                domModule.clear_field_error(s, s.replace('#', '') + '-error');
            });

            // Get item metadata (rich text; serialized HTML, '' when empty)
            item.title = rteModule.get_html('item-title-input');
            item.text = rteModule.get_html('item-text-input');
            item.date = get_element_value('input[type="date"]');

            // Validate required date field
            if (!item.date || item.date.length === 0) {
                domModule.show_field_error('Please enter a timeline date', '#item-date-input');
                return false;
            }

            // Validate date format (YYYY-MM-DD)
            const date_pattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!date_pattern.test(item.date)) {
                domModule.show_field_error('Please enter a valid date format (YYYY-MM-DD)', '#item-date-input');
                return false;
            }

            // Validate date is a real date
            const date_obj = new Date(item.date);
            if (isNaN(date_obj.getTime())) {
                domModule.show_field_error('Please enter a valid date', '#item-date-input');
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
                    domModule.show_field_error('Please select a media item', '#item-media-uuid');
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

                // Collect optional Pop-up Window Description + Caption (media items only)
                item.description = rteModule.get_html('item-description-input');
                item.caption = rteModule.get_html('item-caption-input');

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

            navModule.init();
            helperModule.show_form();

            // Wire up media picker buttons if on a media form
            if (window.location.pathname.split('/').filter(Boolean).includes('media')) {
                init_media_picker_buttons();

                const created_meta = document.querySelector('#created');
                const media_card_header = document.querySelector('#item-media-card .card-header');
                if (created_meta && media_card_header) {
                    media_card_header.appendChild(created_meta.closest('.btn-group') || created_meta);
                }

                const exhibit_text_label = document.querySelector('#item-text-input-label');
                if (exhibit_text_label) {
                    exhibit_text_label.innerHTML = 'Exhibit Text';
                    const exhibit_text_block = exhibit_text_label.closest('.form-text');
                    if (exhibit_text_block) {
                        const preview_link = exhibit_text_block.querySelector('a');
                        if (preview_link) {
                            preview_link.remove();
                        }
                    }
                }

                const title_label = document.querySelector('#item-title-input-label');
                if (title_label) {
                    title_label.innerHTML = 'Title';
                    const title_block = title_label.closest('.form-text');
                    if (title_block) {
                        const preview_link = title_block.querySelector('a');
                        if (preview_link) {
                            preview_link.remove();
                        }
                    }
                }

                ['#is-media-only-description', '#is-media-only-caption'].forEach(selector => {
                    const field = document.querySelector(selector);
                    if (field) field.style.display = '';
                });

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

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
