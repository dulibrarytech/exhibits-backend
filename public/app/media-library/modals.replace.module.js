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

const mediaReplaceModalModule = (function() {

    'use strict';

    // Shared helpers
    const escape_html = helperMediaLibraryModule.escape_html;
    const decode_html_entities = helperMediaLibraryModule.decode_html_entities;
    const get_media_type_icon = helperMediaLibraryModule.get_media_type_icon;
    const get_thumbnail_url_for_media = helperMediaLibraryModule.get_thumbnail_url_for_media;
    const append_cache_version = helperMediaLibraryModule.append_cache_version;

    const EXHIBITS_ENDPOINTS = endpointsModule.get_media_library_endpoints();

    // Accepted replacement types keyed by the record's media type. The server
    // enforces same-type replacement; this mirrors it so mismatches fail fast
    // client-side with a clear Dropzone message.
    const REPLACE_FILE_TYPES = {
        image: {
            mime_types: 'image/png,image/jpeg,image/jpg,image/gif,image/webp',
            label: 'an image (PNG, JPG, GIF, or WebP)',
            max_size_mb: 50
        },
        pdf: {
            mime_types: 'application/pdf',
            label: 'a PDF',
            max_size_mb: 100
        }
    };

    // How long the success state stays visible before the modal auto-closes.
    const SUCCESS_CLOSE_DELAY_MS = 2000;

    // Replace modal state
    let replace_modal_callback = null;
    let close_timer = null;

    let obj = {};

    /**
     * Display message in replace modal
     * @param {string} type - Message type ('success', 'danger', 'warning')
     * @param {string} message - Message text
     */
    const display_replace_modal_message = (type, message) => {
        const message_container = document.getElementById('replace-media-message');

        if (!message_container) return;

        message_container.innerHTML = '<div class="alert alert-' + type + ' mb-3" role="alert">' +
            '<i class="fa fa-' + (type === 'success' ? 'check' : type === 'danger' ? 'exclamation-circle' : 'warning') + '" style="margin-right: 6px;"></i>' +
            escape_html(message) +
            '</div>';
    };

    /**
     * Clear replace modal message
     */
    const clear_replace_modal_message = () => {
        const message_container = document.getElementById('replace-media-message');
        if (message_container) {
            message_container.innerHTML = '';
        }
    };

    /**
     * Resolves the accepted-type config for a record. Falls back through the
     * record's media_type to its mime_type so legacy rows still resolve.
     * @param {Object} record - Media row record
     * @returns {Object|null} REPLACE_FILE_TYPES entry or null
     */
    const resolve_file_type_config = (record) => {
        if (!record) return null;

        if (REPLACE_FILE_TYPES[record.media_type]) {
            return REPLACE_FILE_TYPES[record.media_type];
        }

        const mime = (record.mime_type || '').toLowerCase();

        if (mime.startsWith('image/')) return REPLACE_FILE_TYPES.image;
        if (mime.includes('pdf')) return REPLACE_FILE_TYPES.pdf;

        return null;
    };

    /**
     * Extracts a human-readable message from a Dropzone error payload,
     * which may be our JSON envelope ({message} or {error}) or plain text.
     * @param {*} error_payload - Dropzone error argument
     * @returns {string} Error message
     */
    const extract_error_message = (error_payload) => {
        if (!error_payload) return 'File replacement failed.';

        if (typeof error_payload === 'string') return error_payload;

        return error_payload.message || error_payload.error || 'File replacement failed.';
    };

    /**
     * Close the replace media modal
     */
    const close_replace_modal = () => {
        const modal_element = document.getElementById('replace-media-modal');
        if (!modal_element) return;

        if (close_timer) {
            clearTimeout(close_timer);
            close_timer = null;
        }

        helperMediaLibraryModule.hide_bootstrap_modal(modal_element);

        destroy_dropzone();

        replace_modal_callback = null;
    };

    /**
     * Destroy any Dropzone instance attached to the replace zone
     */
    const destroy_dropzone = () => {
        const dropzone_el = document.getElementById('replace-media-dropzone');
        if (dropzone_el && dropzone_el.dropzone) {
            dropzone_el.dropzone.destroy();
        }
    };

    /**
     * Handle a successful replace response from the server
     * @param {Object} dropzone - The Dropzone instance
     */
    const handle_replace_success = (dropzone) => {
        display_replace_modal_message('success', 'Success: File replaced');

        // No further uploads from this modal instance — the job is done.
        dropzone.disable();

        // Store callback reference before closing (close nullifies it), and
        // refresh the list behind the modal right away so the new file is
        // visible the moment the modal closes.
        const callback = replace_modal_callback;

        if (typeof callback === 'function') {
            callback(true, 'File replaced successfully.');
        }

        replace_modal_callback = null;

        close_timer = setTimeout(() => {
            close_replace_modal();
        }, SUCCESS_CLOSE_DELAY_MS);
    };

    /**
     * Initialize the Dropzone for the replace zone, scoped to the current
     * record's endpoint and accepted type. One file per replace.
     * @param {Object} record - Media row record
     * @param {Object} type_config - REPLACE_FILE_TYPES entry
     * @returns {boolean} Whether the zone initialized
     */
    const init_replace_dropzone = (record, type_config) => {

        if (typeof Dropzone === 'undefined') {
            display_replace_modal_message('danger', 'Upload component is not available. Please refresh the page.');
            return false;
        }

        if (!EXHIBITS_ENDPOINTS?.media_file_replace?.post?.endpoint) {
            display_replace_modal_message('danger', 'Replace endpoint not configured. Please refresh the page.');
            return false;
        }

        const dropzone_el = document.getElementById('replace-media-dropzone');

        if (!dropzone_el) {
            display_replace_modal_message('danger', 'Upload zone not found. Please refresh the page.');
            return false;
        }

        Dropzone.autoDiscover = false;

        destroy_dropzone();

        const endpoint = EXHIBITS_ENDPOINTS.media_file_replace.post.endpoint
            .replace(':media_id', encodeURIComponent(record.uuid));

        new Dropzone('#replace-media-dropzone', {
            url: endpoint,
            paramName: 'file',
            maxFiles: 1,
            maxFilesize: type_config.max_size_mb,
            uploadMultiple: false,
            parallelUploads: 1,
            acceptedFiles: type_config.mime_types,
            ignoreHiddenFiles: true,
            timeout: 120000,
            autoProcessQueue: true,
            createImageThumbnails: true,
            addRemoveLinks: false,
            dictDefaultMessage: '<i class="fa fa-cloud-upload fa-3x text-muted mb-3" aria-hidden="true"></i><br><small><em>Drag and Drop the replacement file here or Click to Upload</em></small>',
            dictMaxFilesExceeded: 'Only one replacement file is allowed.',
            dictFileTooBig: 'File is too big ({{filesize}}MB). Max filesize: {{maxFilesize}}MB.',
            dictInvalidFileType: 'Invalid file type. The replacement must be ' + type_config.label + '.',

            init: function() {
                // Attach the session token as x-access-token on each upload.
                this.on('sending', function(file, xhr) {
                    const token = (typeof authModule !== 'undefined' && typeof authModule.get_user_token === 'function')
                        ? authModule.get_user_token()
                        : null;
                    if (token) {
                        xhr.setRequestHeader('x-access-token', token);
                    }
                });

                this.on('addedfile', function() {
                    clear_replace_modal_message();
                });

                this.on('maxfilesexceeded', function(file) {
                    this.removeFile(file);
                    display_replace_modal_message('warning', 'Only one replacement file is allowed.');
                });
            },

            success: function(file, response) {
                if (!response || response.success !== true) {
                    this.removeFile(file);
                    display_replace_modal_message('danger', extract_error_message(response));
                    return;
                }

                handle_replace_success(this);
            },

            error: function(file, error_payload) {
                this.removeFile(file);
                display_replace_modal_message('danger', extract_error_message(error_payload));
            }
        });

        return true;
    };

    /**
     * Setup replace modal close/cancel handlers. Buttons are cloned to drop
     * listeners from prior opens (same idiom as the delete modal).
     */
    const setup_replace_modal_handlers = () => {
        ['replace-media-cancel-btn', 'replace-media-close-btn'].forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) {
                const new_btn = btn.cloneNode(true);
                btn.parentNode.replaceChild(new_btn, btn);
                new_btn.addEventListener('click', close_replace_modal);
            }
        });
    };

    /**
     * Populate the current-file card (thumbnail, name, filename)
     * @param {Object} record - Media row record
     */
    const populate_current_file_card = (record) => {
        const name_el = document.getElementById('replace-media-name');
        const filename_el = document.getElementById('replace-media-filename');
        const icon_el = document.getElementById('replace-media-icon');
        const thumbnail_el = document.getElementById('replace-media-thumbnail');

        if (name_el) {
            name_el.textContent = decode_html_entities(record.name) || 'Untitled';
        }

        if (filename_el) {
            const filename = record.filename && record.filename !== 'N/A' ? decode_html_entities(record.filename) : '';
            filename_el.textContent = filename;
            filename_el.style.display = filename ? '' : 'none';
        }

        if (icon_el) {
            icon_el.className = 'fa ' + get_media_type_icon(record.media_type) + ' fa-2x text-muted';
            icon_el.style.display = '';
        }

        if (thumbnail_el) {
            const thumbnail_url = append_cache_version(
                get_thumbnail_url_for_media(record.media_type, record.uuid),
                record.updated
            );

            if (thumbnail_url) {
                thumbnail_el.src = thumbnail_url;
                thumbnail_el.alt = 'Thumbnail for ' + (decode_html_entities(record.name) || 'media');
                thumbnail_el.style.display = 'block';

                if (icon_el) {
                    icon_el.style.display = 'none';
                }

                thumbnail_el.onerror = function() {
                    this.style.display = 'none';

                    if (icon_el) {
                        icon_el.style.display = '';
                    }
                };
            } else {
                thumbnail_el.src = '';
                thumbnail_el.style.display = 'none';
            }
        }
    };

    /**
     * Open the replace-file modal for an uploaded media record
     * @param {Object} record - Media row record (uuid, name, filename, media_type, mime_type, updated)
     * @param {Function} callback - Callback function(success, message) when the replace completes
     */
    obj.open_replace_media_modal = function(record, callback) {
        const modal_element = document.getElementById('replace-media-modal');

        if (!modal_element) {
            console.error('Replace media modal not found');
            return;
        }

        if (!record || !record.uuid) {
            console.error('No media record provided for replace');
            return;
        }

        const type_config = resolve_file_type_config(record);

        if (!type_config) {
            console.error('Unsupported media type for replace: ' + record.media_type);
            return;
        }

        replace_modal_callback = callback || null;

        clear_replace_modal_message();
        populate_current_file_card(record);

        const hint_text_el = document.getElementById('replace-media-type-hint-text');

        if (hint_text_el) {
            hint_text_el.textContent = 'The replacement must be ' + type_config.label + ', up to ' + type_config.max_size_mb + 'MB.';
        }

        if (!init_replace_dropzone(record, type_config)) {
            return;
        }

        setup_replace_modal_handlers();

        helperMediaLibraryModule.show_bootstrap_modal(modal_element);

        console.debug('Replace media modal opened for: ' + record.name);
    };

    /**
     * Close the replace media modal (public method)
     */
    obj.close_replace_media_modal = function() {
        close_replace_modal();
    };

    return obj;

}());
