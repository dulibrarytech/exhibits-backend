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

const mediaUploadsModule = (function() {

    'use strict';

    // Module state
    let dropzone_instance = null;
    let initialized = false;
    let uploaded_files_data = [];

    // Configuration
    const MAX_FILES = 10;
    const MAX_FILE_SIZE_MB = 100;

    /**
     * Get application path safely
     */
    const get_app_path = () => {

        try {
            const app_path = window.localStorage.getItem('exhibits_app_path');
            if (!app_path) {
                console.warn('Application path not found in localStorage, using default');
                return '/exhibits-dashboard';
            }
            return app_path;
        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return '/exhibits-dashboard';
        }
    };

    const APP_PATH = get_app_path();
    const UPLOAD_ENDPOINT = `${location.protocol}//${location.host}${APP_PATH}/media/library/uploads`;

    // Allowed file types configuration (images and PDFs only)
    const FILE_TYPES = {
        images: {
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
            mime_types: 'image/png,image/jpeg,image/jpg,image/gif,image/webp',
            max_size: 50
        },
        pdf: {
            extensions: ['pdf'],
            mime_types: 'application/pdf',
            max_size: 100
        }
    };

    let obj = {};

    /**
     * Display filename safely with text content
     */
    const display_filename = (element, filename) => {
        if (!element) return;
        const span = document.createElement('span');
        span.style.fontSize = '11px';
        span.className = 'uploaded-filename';
        span.textContent = filename;
        element.textContent = '';
        element.appendChild(span);
    };

    /**
     * Display multiple filenames
     */
    const display_multiple_filenames = (element, filenames) => {
        if (!element) return;
        element.textContent = '';
        filenames.forEach((filename, index) => {
            const span = document.createElement('span');
            span.style.fontSize = '11px';
            span.className = 'uploaded-filename me-2 mb-1 d-inline-block';
            span.textContent = filename;
            element.appendChild(span);
            if (index < filenames.length - 1) {
                element.appendChild(document.createTextNode(' '));
            }
        });
    };

    /**
     * Display thumbnail image safely
     */
    const display_thumbnail_image = (element, image_url, alt_text = 'Thumbnail') => {
        if (!element) return;
        const paragraph = document.createElement('p');
        const img = document.createElement('img');
        img.src = image_url;
        img.alt = alt_text;
        img.height = 200;
        img.className = 'uploaded-thumbnail';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.maxHeight = '200px';
        paragraph.appendChild(img);
        element.textContent = '';
        element.appendChild(paragraph);
    };

    /**
     * Display error message safely
     */
    const display_upload_error = (element, error_message) => {
        if (!element) {
            console.error('Error element not found:', error_message);
            return;
        }
        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger d-flex align-items-center';
        alert_div.setAttribute('role', 'alert');
        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation-circle me-2';
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);
        const text = document.createTextNode(error_message);
        alert_div.appendChild(text);
        element.textContent = '';
        element.appendChild(alert_div);
    };

    /**
     * Display success message
     */
    const display_upload_success = (element, message) => {
        if (!element) return;
        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-success d-flex align-items-center';
        alert_div.setAttribute('role', 'alert');
        const icon = document.createElement('i');
        icon.className = 'fa fa-check-circle mr-2';
        icon.setAttribute('aria-hidden', 'true');
        icon.style.marginRight = '8px';
        alert_div.appendChild(icon);
        const text = document.createTextNode(message);
        alert_div.appendChild(text);
        element.textContent = '';
        element.appendChild(alert_div);
    };

    /**
     * Clear message from element
     */
    const clear_message = (element) => {
        if (element) {
            element.textContent = '';
        }
    };

    /**
     * Show element
     */
    const show_element = (element, display = 'inline') => {
        if (element) {
            element.style.display = display;
        }
    };

    /**
     * Hide element
     */
    const hide_element = (element) => {
        if (element) {
            element.style.display = 'none';
        }
    };

    /**
     * Generate timestamped filename
     */
    const generate_filename = (original_filename, file_type) => {
        const extension = original_filename.split('.').pop().toLowerCase();
        const timestamp = Date.now();
        const random_suffix = Math.random().toString(36).substring(2, 8);
        return `${timestamp}_${random_suffix}_${file_type}.${extension}`;
    };

    /**
     * Validate file extension against allowed types
     */
    const validate_file_extension = (filename, allowed_extensions) => {
        const extension = filename.split('.').pop().toLowerCase();
        return allowed_extensions.includes(extension);
    };

    /**
     * Get media type from MIME type
     */
    const get_media_type_from_mime = (mime_type) => {
        if (!mime_type) return 'unknown';
        const mime_lower = mime_type.toLowerCase();
        if (mime_lower.startsWith('image/')) return 'image';
        if (mime_lower.startsWith('video/')) return 'video';
        if (mime_lower.startsWith('audio/')) return 'audio';
        if (mime_lower.includes('pdf')) return 'pdf';
        return 'unknown';
    };

    /**
     * Get thumbnail URL for media type
     */
    const get_thumbnail_url_for_media = (media_type, filename) => {
        const static_path = '/exhibits-dashboard/static/images';
        switch (media_type) {
            case 'image':
                return APP_PATH + '/media?media=' + encodeURIComponent(filename);
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

    /**
     * Clear uploaded media fields
     */
    const clear_uploaded_media_fields = () => {
        const fields = ['item-media', 'item-type', 'item-mime-type'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const displays = ['item-media-filename-display', 'item-media-thumbnail-image-display'];
        displays.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });

        hide_element(document.getElementById('item-media-trash'));
        uploaded_files_data = [];
    };

    /**
     * Setup trash button handler
     */
    const setup_trash_handler = () => {
        const trash_btn = document.getElementById('item-media-trash');
        if (trash_btn) {
            trash_btn.addEventListener('click', function() {
                clear_uploaded_media_fields();
                if (dropzone_instance) {
                    dropzone_instance.removeAllFiles(true);
                }
            });
        }
    };

    /**
     * Handle modal completion callback
     */
    const handle_modal_complete = (saved_count) => {
        console.log('Modal completed - ' + saved_count + ' files saved');

        // Clear the upload area
        clear_uploaded_media_fields();
        
        if (dropzone_instance) {
            dropzone_instance.removeAllFiles(true);
        }

        // Show success message if any files were saved
        if (saved_count > 0) {
            const message_element = document.getElementById('upload-media-message');
            if (message_element) {
                const file_word = saved_count === 1 ? 'file' : 'files';
                display_upload_success(message_element, 'Media details saved successfully for ' + saved_count + ' ' + file_word);
                setTimeout(function() { clear_message(message_element); }, 5000);
            }
        }
    };

    /**
     * Open the uploaded media modal
     */
    const open_uploaded_media_modal = () => {
        if (typeof mediaModalsModule !== 'undefined' && 
            typeof mediaModalsModule.open_uploaded_media_modal === 'function') {
            mediaModalsModule.open_uploaded_media_modal(uploaded_files_data, handle_modal_complete);
        } else {
            console.error('mediaModalsModule not available');
        }
    };

    /**
     * Create Dropzone configuration
     */
    const create_dropzone_config = (options) => {
        const defaults = {
            url: UPLOAD_ENDPOINT,
            param_name: 'files',
            upload_multiple: false,
            max_files: MAX_FILES,
            parallel_uploads: MAX_FILES,
            ignore_hidden_files: true,
            timeout: 120000,
            auto_process_queue: true,
            create_image_thumbnails: true,
            add_remove_links: true
        };

        return {
            url: defaults.url,
            paramName: options.param_name || defaults.param_name,
            maxFilesize: options.max_filesize || MAX_FILE_SIZE_MB,
            uploadMultiple: options.upload_multiple !== undefined ? options.upload_multiple : defaults.upload_multiple,
            maxFiles: options.max_files || defaults.max_files,
            parallelUploads: options.parallel_uploads || defaults.parallel_uploads,
            acceptedFiles: options.accepted_files,
            ignoreHiddenFiles: defaults.ignore_hidden_files,
            timeout: options.timeout || defaults.timeout,
            dictDefaultMessage: options.dict_message || '<em>Drag and Drop up to ' + MAX_FILES + ' files here or Click to Upload</em>',
            dictMaxFilesExceeded: 'You can only upload up to ' + MAX_FILES + ' files at a time.',
            dictFileTooBig: 'File is too big ({{filesize}}MB). Max filesize: {{maxFilesize}}MB.',
            dictInvalidFileType: 'Invalid file type. Only images (PNG, JPG, GIF, WebP) and PDFs are allowed.',
            autoProcessQueue: defaults.auto_process_queue,
            createImageThumbnails: defaults.create_image_thumbnails,
            addRemoveLinks: defaults.add_remove_links,
            
            init: function() {
                console.log('Dropzone initialized: ' + (options.zone_name || 'unnamed') + ' (max ' + MAX_FILES + ' files)');
                dropzone_instance = this;

                this.on('addedfile', function(file) {
                    clear_message(document.querySelector('.upload-error'));
                    console.log('File added: ' + file.name + ' (' + this.files.length + '/' + MAX_FILES + ' files)');
                });

                this.on('processing', function(file) {
                    console.log('Processing: ' + file.name);
                });

                this.on('uploadprogress', function(file, progress) {
                    console.log('Upload progress for ' + file.name + ': ' + Math.round(progress) + '%');
                });

                this.on('queuecomplete', function() {
                    console.log('All files in queue processed');
                    if (uploaded_files_data.length > 0) {
                        setTimeout(function() {
                            open_uploaded_media_modal();
                        }, 500);
                    }
                });

                this.on('maxfilesexceeded', function(file) {
                    const error_element = document.querySelector('.upload-error');
                    display_upload_error(error_element, 'Maximum ' + MAX_FILES + ' files allowed. Remove some files to add more.');
                    this.removeFile(file);
                });
            },

            renameFile: function(file) {
                return generate_filename(file.name, options.file_type || 'media');
            },

            success: options.success_handler || function(file, response) {
                console.log('Upload successful:', response);
                this.removeFile(file);
            },

            error: options.error_handler || function(file, error_message) {
                const error_element = document.querySelector('.upload-error');
                const message = typeof error_message === 'object' 
                    ? (error_message.error || 'Upload failed')
                    : error_message;
                display_upload_error(error_element, message);
                this.removeFile(file);
            }
        };
    };

    /**
     * Initialize Dropzone for item media uploads
     */
    obj.upload_media = function() {

        if (typeof Dropzone === 'undefined') {
            console.error('Dropzone library not loaded');
            return;
        }

        Dropzone.autoDiscover = false;

        const dropzone_element = document.getElementById('item-dropzone');
        if (!dropzone_element) {
            console.warn('Dropzone element #item-dropzone not found');
            return;
        }

        if (dropzone_element.dropzone) {
            dropzone_element.dropzone.destroy();
        }

        const accepted_files = FILE_TYPES.images.mime_types + ',' + FILE_TYPES.pdf.mime_types;
        const allowed_extensions = FILE_TYPES.images.extensions.concat(FILE_TYPES.pdf.extensions);

        uploaded_files_data = [];

        const config = create_dropzone_config({
            zone_name: 'Item Media',
            max_filesize: MAX_FILE_SIZE_MB,
            max_files: MAX_FILES,
            parallel_uploads: MAX_FILES,
            accepted_files: accepted_files,
            dict_message: '<i class="fa fa-cloud-upload fa-3x text-muted mb-3" aria-hidden="true"></i><br><small><em>Drag and Drop up to ' + MAX_FILES + ' files here or Click to Upload</em></small>',
            file_type: 'media',
            
            success_handler: function(file, response) {
                const elements = {
                    error: document.querySelector('.upload-error'),
                    media_type: document.getElementById('media-type'),
                    item_mime_type: document.getElementById('item-mime-type'),
                    item_media: document.getElementById('item-media'),
                    filename_display: document.getElementById('item-media-filename-display'),
                    media_trash: document.getElementById('item-media-trash'),
                    thumbnail_display: document.getElementById('item-media-thumbnail-image-display')
                };

                if (!response || !response.success || !response.files || response.files.length === 0) {
                    display_upload_error(elements.error, 'Upload failed - invalid server response');
                    this.removeFile(file);
                    return;
                }

                const uploaded_file = response.files[0];
                const filename = uploaded_file.filename;
                const mime_type = uploaded_file.mime_type;

                if (!validate_file_extension(filename, allowed_extensions)) {
                    display_upload_error(elements.error, 'Invalid file type');
                    this.removeFile(file);
                    return;
                }

                const media_type = get_media_type_from_mime(mime_type);

                uploaded_files_data.push({
                    filename: filename,
                    original_name: file.name,
                    file_size: file.size,
                    mime_type: mime_type,
                    media_type: media_type,
                    uploaded_at: uploaded_file.uploaded_at || new Date().toISOString()
                });

                if (typeof helperMediaModule !== 'undefined' && 
                    typeof helperMediaModule.clear_media_fields === 'function') {
                    helperMediaModule.clear_media_fields('uploaded_media');
                }

                clear_message(elements.error);

                if (elements.media_type) {
                    elements.media_type.value = media_type;
                }

                if (elements.item_mime_type) {
                    elements.item_mime_type.value = mime_type;
                }

                if (elements.item_media) {
                    const current_value = elements.item_media.value;
                    if (current_value) {
                        elements.item_media.value = current_value + ',' + filename;
                    } else {
                        elements.item_media.value = filename;
                    }
                }

                if (elements.item_media && elements.item_media.value) {
                    const filenames = elements.item_media.value.split(',');
                    display_multiple_filenames(elements.filename_display, filenames);
                }
                
                show_element(elements.media_trash);

                setTimeout(function() {
                    const thumbnail_url = get_thumbnail_url_for_media(media_type, filename);
                    display_thumbnail_image(elements.thumbnail_display, thumbnail_url, filename);
                }, 500);

                const success_count = uploaded_files_data.length;
                display_upload_success(elements.error, success_count + ' file(s) uploaded successfully');

                // Remove success message after 4 seconds
                setTimeout(function() {
                    clear_message(elements.error);
                }, 4000);

                console.log('Item media uploaded: ' + filename + ' (' + media_type + ')');
            }
        });

        new Dropzone('#item-dropzone', config);
    };

    obj.reset_upload = function() {
        clear_uploaded_media_fields();
        if (dropzone_instance) {
            dropzone_instance.removeAllFiles(true);
        }
    };

    obj.get_dropzone_instance = function() {
        return dropzone_instance;
    };

    obj.get_max_files = function() {
        return MAX_FILES;
    };

    obj.get_uploaded_files = function() {
        return uploaded_files_data;
    };

    obj.open_modal = function() {
        open_uploaded_media_modal();
    };

    obj.close_modal = function() {
        if (typeof mediaModalsModule !== 'undefined' && 
            typeof mediaModalsModule.close_uploaded_media_modal === 'function') {
            mediaModalsModule.close_uploaded_media_modal();
        }
    };

    obj.init = function() {
        if (initialized) {
            console.log('Uploads module already initialized');
            return true;
        }

        console.log('Initializing uploads module...');

        if (typeof Dropzone === 'undefined') {
            console.error('Dropzone library not loaded - uploads module cannot initialize');
            return false;
        }

        if (!APP_PATH) {
            console.error('Application path not configured');
            return false;
        }

        // Initialize modals module if available
        if (typeof mediaModalsModule !== 'undefined' && 
            typeof mediaModalsModule.init === 'function') {
            mediaModalsModule.init();
        }

        console.log('Upload endpoint:', UPLOAD_ENDPOINT);
        console.log('Max files per upload:', MAX_FILES);

        Dropzone.autoDiscover = false;

        setup_trash_handler();
        obj.upload_media();

        initialized = true;
        console.log('Uploads module initialized successfully');
        return true;
    };

    return obj;

}());
