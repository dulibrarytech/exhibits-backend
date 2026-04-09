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

const helperMediaLibraryModule = (function() {

    'use strict';

    let obj = {};

    // HTTP status constants shared across media library modules
    obj.HTTP_STATUS = Object.freeze({
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    });

    // Icon map for alert types
    const ICON_MAP = Object.freeze({
        'success': 'fa-check-circle',
        'danger': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    });

    // Auto-hide delay for success messages (ms)
    const SUCCESS_AUTO_HIDE_DELAY = 5000;

    /**
     * Escape HTML to prevent XSS
     * Uses DOM textContent for safe encoding
     * @param {string} str - String to escape
     * @returns {string} Escaped HTML string
     */
    obj.escape_html = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Display a Bootstrap 4 dismissible alert in the specified container
     * @param {string} container_id - DOM element ID for the message area
     * @param {string} type - Alert type ('success', 'danger', 'warning', 'info')
     * @param {string} message - Message text (will be HTML-escaped)
     */
    obj.display_message = (container_id, type, message) => {
        const message_container = document.getElementById(container_id);

        if (!message_container) return;

        const icon = ICON_MAP[type] || ICON_MAP.info;

        message_container.innerHTML = '<div class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' +
            '<i class="fa ' + icon + '" style="margin-right: 8px;" aria-hidden="true"></i>' +
            obj.escape_html(message) +
            '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
            '<span aria-hidden="true">&times;</span>' +
            '</button>' +
            '</div>';

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                obj.clear_message(container_id);
            }, SUCCESS_AUTO_HIDE_DELAY);
        }
    };

    /**
     * Clear the message area for a given container
     * @param {string} container_id - DOM element ID for the message area
     */
    obj.clear_message = (container_id) => {
        const message_container = document.getElementById(container_id);
        if (message_container) {
            message_container.innerHTML = '';
        }
    };

    /**
     * Create a bound message helper scoped to a specific container.
     * Returns an object with display_message and clear_message pre-bound
     * to the given container ID, matching the original per-module
     * function signatures: display_message(type, message), clear_message().
     * @param {string} container_id - DOM element ID for the message area
     * @returns {Object} { display_message, clear_message, escape_html }
     */
    obj.create_message_helper = (container_id) => {
        return {
            display_message: (type, message) => obj.display_message(container_id, type, message),
            clear_message: () => obj.clear_message(container_id),
            escape_html: obj.escape_html
        };
    };

    /**
     * Decode HTML entities (e.g., &#x27; -> ')
     * Uses DOM innerHTML parsing for safe decoding
     * @param {string} str - String to decode
     * @returns {string} Decoded string
     */
    obj.decode_html_entities = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent;
    };

    /**
     * Strip HTML tags from a string
     * Useful for cleaning API metadata that contains HTML markup
     * @param {string} str - String containing HTML
     * @returns {string} Plain text string
     */
    obj.strip_html = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    };

    /**
     * Get the application base path from localStorage
     * Falls back to '/exhibits-dashboard' if not set or on error
     * @returns {string} Application base path
     */
    obj.get_app_path = () => {
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

    /**
     * Get Font Awesome icon class for a media/object type
     * Merged superset covering uploads, Kaltura, repository, and collection types
     * @param {string} media_type - The media or object type
     * @returns {string} Font Awesome icon class (without 'fa ' prefix)
     */
    obj.get_media_type_icon = (media_type) => {
        const icons = {
            'image': 'fa-file-image-o',
            'object': 'fa-file-image-o',
            'pdf': 'fa-file-pdf-o',
            'video': 'fa-file-video-o',
            'audio': 'fa-file-audio-o',
            'collection': 'fa-folder-o',
            'compound': 'fa-files-o',
            'unknown': 'fa-file-o'
        };
        return icons[media_type] || 'fa-file-o';
    };

    /**
     * Get human-readable label for a media/object type
     * Merged superset covering uploads, Kaltura, repository, and collection types
     * @param {string} media_type - The media or object type
     * @returns {string} Human-readable label
     */
    obj.get_media_type_label = (media_type) => {
        const labels = {
            'image': 'Image',
            'object': 'Object',
            'pdf': 'PDF Document',
            'video': 'Video',
            'audio': 'Audio',
            'collection': 'Collection',
            'compound': 'Compound Object',
            'unknown': 'Unknown'
        };
        return labels[media_type] || 'Unknown';
    };

    /**
     * Format file size for display with adaptive units
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size string (e.g., '1.5 MB', '256 KB')
     */
    obj.format_file_size = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    /**
     * Clean a filename for use as a default display title
     * Strips extension, replaces underscores/hyphens with spaces
     * @param {string} filename - Original filename
     * @returns {string} Cleaned title string
     */
    obj.clean_filename_for_title = (filename) => {
        if (!filename) return '';
        return filename
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    /**
     * Safely get media library endpoints configuration
     * @returns {Object|null} Endpoints configuration object
     */
    const get_endpoints = () => {
        try {
            return endpointsModule.get_media_library_endpoints();
        } catch (error) {
            console.error('Error getting media library endpoints:', error);
            return null;
        }
    };

    /**
     * Build media thumbnail URL using the dedicated thumbnail endpoint
     * Returns the raw endpoint URL without authentication token
     * @param {string} media_id - Media UUID
     * @returns {string|null} Thumbnail URL or null
     */
    obj.build_thumbnail_url = (media_id) => {
        if (!media_id) return null;

        const endpoints = get_endpoints();

        if (!endpoints?.media_thumbnail?.get?.endpoint) {
            console.warn('Media thumbnail endpoint not configured');
            return null;
        }

        return endpoints.media_thumbnail.get.endpoint.replace(':media_id', encodeURIComponent(media_id));
    };

    /**
     * Build media file URL for full-size file retrieval
     * Returns the raw endpoint URL without authentication token
     * @param {string} media_id - Media UUID
     * @returns {string|null} URL to media file or null
     */
    obj.build_media_url = (media_id) => {
        if (!media_id) return null;

        const endpoints = get_endpoints();

        if (!endpoints?.media_file?.get?.endpoint) {
            console.warn('Media file endpoint not configured');
            return null;
        }

        return endpoints.media_file.get.endpoint.replace(':media_id', encodeURIComponent(media_id));
    };

    /**
     * Get repository thumbnail URL for repo-ingested media
     * Delegates to repoServiceModule when available, with direct fallback
     * @param {string} uuid - Repository item UUID (repo_uuid)
     * @returns {string} Thumbnail URL or empty string
     */
    obj.get_repo_thumbnail_url = (uuid) => {
        if (!uuid) return '';

        if (typeof repoServiceModule !== 'undefined' && typeof repoServiceModule.get_repo_tn_url === 'function') {
            return repoServiceModule.get_repo_tn_url(uuid);
        }

        const token = authModule.get_user_token();
        if (!token) return '';

        const endpoints = get_endpoints();

        if (!endpoints?.repo_thumbnail?.get?.endpoint) {
            console.warn('Repo thumbnail endpoint not configured');
            return '';
        }

        const endpoint = endpoints.repo_thumbnail.get.endpoint;
        return endpoint + '?uuid=' + encodeURIComponent(uuid) + '&token=' + encodeURIComponent(token);
    };

    /**
     * Get thumbnail URL for a media item based on type
     * Uses server-generated thumbnails for images and PDFs (with auth token),
     * falls back to static placeholder images for other types
     * @param {string} media_type - Media type (image, pdf, video, audio)
     * @param {string} uuid - File UUID for server-generated thumbnails
     * @returns {string} Thumbnail URL
     */
    obj.get_thumbnail_url_for_media = (media_type, uuid) => {
        const static_path = '/exhibits-dashboard/static/images';

        if ((media_type === 'image' || media_type === 'pdf') && uuid) {
            const token = authModule.get_user_token();
            const thumbnail_url = obj.build_thumbnail_url(uuid);
            if (thumbnail_url) {
                return thumbnail_url + '?token=' + encodeURIComponent(token || '');
            }
        }

        switch (media_type) {
            case 'image':
                return static_path + '/image-tn.png';
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

    // ========================================
    // BOOTSTRAP MODAL LIFECYCLE HELPERS
    // ========================================

    /**
     * Show a Bootstrap modal with BS5 -> BS4/jQuery -> manual fallback chain
     * @param {HTMLElement} modal_element - The modal DOM element
     * @param {Object} [options] - Modal options (default: static backdrop, no keyboard dismiss)
     * @param {string|boolean} [options.backdrop='static'] - Backdrop behavior
     * @param {boolean} [options.keyboard=false] - Whether ESC key closes modal
     */
    obj.show_bootstrap_modal = (modal_element, options) => {
        const opts = options || { backdrop: 'static', keyboard: false };

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = new bootstrap.Modal(modal_element, opts);
            modal.show();
        } else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal(opts);
            $(modal_element).modal('show');
        } else {
            modal_element.classList.add('show');
            modal_element.style.display = 'block';
            document.body.classList.add('modal-open');

            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }
    };

    /**
     * Hide a Bootstrap modal with BS5 -> BS4/jQuery -> manual fallback chain
     * Always performs manual cleanup after a short delay to handle edge cases
     * @param {HTMLElement} modal_element - The modal DOM element
     * @param {Function} [cleanup_callback] - Optional callback for modal-specific cleanup,
     *                                         called after the standard DOM cleanup completes
     */
    obj.hide_bootstrap_modal = (modal_element, cleanup_callback) => {
        if (!modal_element) return;

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal &&
            typeof bootstrap.Modal.getInstance === 'function') {
            const modal = bootstrap.Modal.getInstance(modal_element);
            if (modal) {
                modal.hide();
            }
        } else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            $(modal_element).modal('hide');
        }

        setTimeout(() => {
            modal_element.classList.remove('show');
            modal_element.style.display = 'none';
            modal_element.setAttribute('aria-hidden', 'true');
            modal_element.removeAttribute('aria-modal');
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('overflow');

            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());

            if (typeof cleanup_callback === 'function') {
                cleanup_callback();
            }
        }, 150);
    };

    return obj;

}());
