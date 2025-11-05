const uploadsModule = (function() {

    'use strict';

    /**
     * Get application path safely
     */
    const get_app_path = () => {
        try {
            const app_path = window.localStorage.getItem('exhibits_app_path');
            if (!app_path) {
                console.error('Application path not found in localStorage');
                return '';
            }
            return app_path;
        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return '';
        }
    };

    const APP_PATH = get_app_path();
    const UPLOAD_ENDPOINT = `${location.protocol}//${location.host}${APP_PATH}/uploads`;

    let obj = {};

    /**
     * Display filename safely (XSS-safe)
     */
    const display_filename = (element, filename) => {
        if (!element) {
            return;
        }

        const span = document.createElement('span');
        span.style.fontSize = '11px';
        span.textContent = filename;

        element.textContent = '';
        element.appendChild(span);
    };

    /**
     * Display thumbnail image safely (XSS-safe)
     */
    const display_thumbnail_image = (element, image_url, alt_text = 'Thumbnail') => {
        if (!element) {
            return;
        }

        const paragraph = document.createElement('p');
        const img = document.createElement('img');
        img.src = image_url;
        img.alt = alt_text;
        img.height = 200;

        paragraph.appendChild(img);

        element.textContent = '';
        element.appendChild(paragraph);
    };

    /**
     * Display error message safely (XSS-safe)
     */
    const display_upload_error = (element, error_message) => {
        if (!element) {
            console.error('Error element not found:', error_message);
            return;
        }

        const span = document.createElement('span');
        span.className = 'alert alert-danger';
        span.style.border = 'solid 1px';

        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation';
        span.appendChild(icon);

        const text = document.createTextNode(` ${error_message}`);
        span.appendChild(text);

        element.textContent = '';
        element.appendChild(span);
    };

    /**
     * Clear error message
     */
    const clear_upload_error = (element) => {
        if (element) {
            element.textContent = '';
        }
    };

    /**
     * Show trash icon
     */
    const show_trash_icon = (element) => {
        if (element) {
            element.style.display = 'inline';
        }
    };

    /**
     * Generate timestamped filename
     */
    const generate_filename = (original_filename, file_type) => {
        const extension = original_filename.split('.').pop().toLowerCase();
        const timestamp = Date.now();
        return `${timestamp}_${file_type}.${extension}`;
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
        if (!mime_type) {
            return 'unknown';
        }

        const mime_lower = mime_type.toLowerCase();

        if (mime_lower.indexOf('image') !== -1) {
            return 'image';
        } else if (mime_lower.indexOf('video') !== -1) {
            return 'video';
        } else if (mime_lower.indexOf('audio') !== -1) {
            return 'audio';
        } else if (mime_lower.indexOf('pdf') !== -1) {
            return 'pdf';
        }

        return 'unknown';
    };

    /**
     * Get thumbnail URL for media type
     */
    const get_thumbnail_url_for_media = (media_type, filename) => {
        switch (media_type) {
            case 'image':
                return `${APP_PATH}/media?media=${encodeURIComponent(filename)}`;
            case 'video':
                return '/exhibits-dashboard/static/images/video-tn.png';
            case 'audio':
                return '/exhibits-dashboard/static/images/audio-tn.png';
            case 'pdf':
                return '/exhibits-dashboard/static/images/pdf-tn.png';
            default:
                return '/exhibits-dashboard/static/images/default-tn.png';
        }
    };

    /**
     * Create base Dropzone configuration
     */
    const create_base_dropzone_config = (options) => {
        const defaults = {
            url: UPLOAD_ENDPOINT,
            param_name: 'files',
            upload_multiple: false,
            max_files: 1,
            ignore_hidden_files: true,
            timeout: 30000,
            auto_process_queue: true,
            init: function() {
                console.log(`Dropzone initialized: ${options.zone_name}`);
            }
        };

        return {
            paramName: options.param_name || defaults.param_name,
            maxFilesize: options.max_filesize,
            url: defaults.url,
            uploadMultiple: defaults.upload_multiple,
            maxFiles: defaults.max_files,
            acceptedFiles: options.accepted_files,
            ignoreHiddenFiles: defaults.ignore_hidden_files,
            timeout: defaults.timeout,
            dictDefaultMessage: options.dict_message,
            autoProcessQueue: defaults.auto_process_queue,
            init: defaults.init,
            renameFile: function(file) {
                return generate_filename(file.name, options.file_type);
            },
            success: options.success_handler,
            error: options.error_handler || function(file, error) {
                const error_element = document.querySelector('.upload-error');
                display_upload_error(error_element, error);
                this.removeFile(file);
            }
        };
    };

    /**
     * Upload exhibit hero image
     */
    obj.upload_exhibit_hero_image = function() {
        const EXHIBIT_HERO = Dropzone;

        EXHIBIT_HERO.options.heroDropzone = create_base_dropzone_config({
            zone_name: 'Hero Image',
            max_filesize: 1000, // 1MB
            accepted_files: 'image/png,image/jpeg,image/jpg',
            dict_message: '<small><em>Drag and Drop Hero Image file here or Click to Upload</em></small>',
            file_type: 'exhibit_hero',
            success_handler: function(file, response) {
                // Cache DOM elements
                const elements = {
                    error: document.querySelector('.upload-error'),
                    hero_image: document.querySelector('#hero-image'),
                    filename_display: document.querySelector('#hero-image-filename-display'),
                    hero_trash: document.querySelector('#hero-trash'),
                    hero_display: document.querySelector('#hero-image-display')
                };

                // Validate upload
                if (!file.upload || !file.upload.filename) {
                    display_upload_error(elements.error, 'Upload failed - no filename received');
                    this.removeFile(file);
                    return;
                }

                const filename = file.upload.filename;

                // Validate file extension
                const allowed_extensions = ['png', 'jpeg', 'jpg'];
                if (!validate_file_extension(filename, allowed_extensions)) {
                    display_upload_error(elements.error, 'Invalid file type');
                    this.removeFile(file);
                    return;
                }

                // Clear error and update fields
                clear_upload_error(elements.error);

                if (elements.hero_image) {
                    elements.hero_image.value = filename;
                }

                display_filename(elements.filename_display, filename);
                show_trash_icon(elements.hero_trash);

                // Display image after delay
                setTimeout(() => {
                    this.removeFile(file);
                    const hero_url = `${APP_PATH}/media?media=${encodeURIComponent(filename)}`;
                    display_thumbnail_image(elements.hero_display, hero_url, filename);
                }, 1500);

                console.log('Hero image uploaded:', filename);
            }
        });
    };

    /**
     * Upload exhibit thumbnail image
     */
    obj.upload_exhibit_thumbnail_image = function() {
        const THUMBNAIL = Dropzone;

        THUMBNAIL.options.thumbnailDropzone = create_base_dropzone_config({
            zone_name: 'Thumbnail Image',
            max_filesize: 1000, // 1MB
            accepted_files: 'image/png,image/jpeg,image/jpg',
            dict_message: '<small><em>Drag and Drop Thumbnail Image file here or Click to Upload</em></small>',
            file_type: 'exhibit_thumbnail',
            success_handler: function(file, response) {
                // Cache DOM elements
                const elements = {
                    error: document.querySelector('.upload-error'),
                    thumbnail_image: document.querySelector('#thumbnail-image'),
                    filename_display: document.querySelector('#thumbnail-filename-display'),
                    thumbnail_trash: document.querySelector('#thumbnail-trash'),
                    thumbnail_display: document.querySelector('#thumbnail-image-display')
                };

                // Validate upload
                if (!file.upload || !file.upload.filename) {
                    display_upload_error(elements.error, 'Upload failed - no filename received');
                    this.removeFile(file);
                    return;
                }

                const filename = file.upload.filename;

                // Validate file extension
                const allowed_extensions = ['png', 'jpeg', 'jpg'];
                if (!validate_file_extension(filename, allowed_extensions)) {
                    display_upload_error(elements.error, 'Invalid file type');
                    this.removeFile(file);
                    return;
                }

                // Clear error and update fields
                clear_upload_error(elements.error);

                if (elements.thumbnail_image) {
                    elements.thumbnail_image.value = filename;
                }

                display_filename(elements.filename_display, filename);
                show_trash_icon(elements.thumbnail_trash);

                // Display thumbnail after delay
                setTimeout(() => {
                    const thumbnail_url = `${APP_PATH}/media?media=${encodeURIComponent(filename)}`;
                    display_thumbnail_image(elements.thumbnail_display, thumbnail_url, filename);
                    this.removeFile(file);
                }, 1500);

                console.log('Thumbnail image uploaded:', filename);
            }
        });
    };

    /**
     * Upload item media (images, PDFs, etc.)
     */
    obj.upload_item_media = function() {
        const ITEM_MEDIA = Dropzone;

        ITEM_MEDIA.options.itemDropzone = create_base_dropzone_config({
            zone_name: 'Item Media',
            max_filesize: 10000, // 10MB
            accepted_files: 'image/png,image/jpeg,image/jpg,application/pdf',
            dict_message: '<small><em>Drag and Drop Item Media file here or Click to Upload</em></small>',
            file_type: 'item_media',
            success_handler: function(file, response) {
                // Cache DOM elements
                const elements = {
                    error: document.querySelector('.upload-error'),
                    item_type: document.querySelector('#item-type'),
                    item_mime_type: document.querySelector('#item-mime-type'),
                    item_media: document.querySelector('#item-media'),
                    filename_display: document.querySelector('#item-media-filename-display'),
                    media_trash: document.querySelector('#item-media-trash'),
                    thumbnail_display: document.querySelector('#item-media-thumbnail-image-display'),
                    image_alt_text: document.querySelector('#image-alt-text'),
                    toggle_open_to_page: document.querySelector('#toggle-open-to-page')
                };

                // Validate upload
                if (!file.upload || !file.upload.filename) {
                    display_upload_error(elements.error, 'Upload failed - no filename received');
                    this.removeFile(file);
                    return;
                }

                const filename = file.upload.filename;
                const mime_type = file.type;

                // Validate file extension
                const allowed_extensions = ['png', 'jpeg', 'jpg', 'pdf'];
                if (!validate_file_extension(filename, allowed_extensions)) {
                    display_upload_error(elements.error, 'Invalid file type');
                    this.removeFile(file);
                    return;
                }

                // Determine media type
                const media_type = get_media_type_from_mime(mime_type);

                // Clear other media fields
                if (typeof helperMediaModule?.clear_media_fields === 'function') {
                    helperMediaModule.clear_media_fields('uploaded_media');
                }

                // Clear error
                clear_upload_error(elements.error);

                // Set form fields
                if (elements.item_type) {
                    elements.item_type.value = media_type;
                }

                if (elements.item_mime_type) {
                    elements.item_mime_type.value = mime_type;
                }

                if (elements.item_media) {
                    elements.item_media.value = filename;
                }

                display_filename(elements.filename_display, filename);
                show_trash_icon(elements.media_trash);

                // Show type-specific fields
                if (media_type === 'image' && elements.image_alt_text) {
                    elements.image_alt_text.style.display = 'block';
                }

                if (media_type === 'pdf' && elements.toggle_open_to_page) {
                    elements.toggle_open_to_page.style.visibility = 'visible';
                }

                // Display thumbnail after delay
                setTimeout(() => {
                    const thumbnail_url = get_thumbnail_url_for_media(media_type, filename);
                    display_thumbnail_image(elements.thumbnail_display, thumbnail_url, filename);
                    this.removeFile(file);
                }, 1500);

                console.log(`Item media uploaded: ${filename} (${media_type})`);
            }
        });
    };

    /**
     * Upload item thumbnail
     */
    obj.upload_item_thumbnail = function() {
        const ITEM_THUMBNAIL = Dropzone;

        ITEM_THUMBNAIL.options.itemThumbnailDropzone = create_base_dropzone_config({
            zone_name: 'Item Thumbnail',
            max_filesize: 1000, // 1MB
            accepted_files: 'image/png,image/jpeg,image/jpg',
            dict_message: '<small><em>Drag and Drop Item Thumbnail file here or Click to Upload</em></small>',
            file_type: 'item_thumbnail',
            success_handler: function(file, response) {
                // Cache DOM elements
                const elements = {
                    error: document.querySelector('.upload-error'),
                    item_thumbnail: document.querySelector('#item-thumbnail'),
                    filename_display: document.querySelector('#item-thumbnail-filename-display'),
                    thumbnail_trash: document.querySelector('#item-thumbnail-trash'),
                    thumbnail_display: document.querySelector('#item-thumbnail-image-display')
                };

                // Validate upload
                if (!file.upload || !file.upload.filename) {
                    display_upload_error(elements.error, 'Upload failed - no filename received');
                    this.removeFile(file);
                    return;
                }

                const filename = file.upload.filename;

                // Validate file extension
                const allowed_extensions = ['png', 'jpeg', 'jpg'];
                if (!validate_file_extension(filename, allowed_extensions)) {
                    display_upload_error(elements.error, 'Invalid file type');
                    this.removeFile(file);
                    return;
                }

                // Clear error and update fields
                clear_upload_error(elements.error);

                if (elements.item_thumbnail) {
                    elements.item_thumbnail.value = filename;
                }

                display_filename(elements.filename_display, filename);
                show_trash_icon(elements.thumbnail_trash);

                // Display thumbnail after delay
                setTimeout(() => {
                    const thumbnail_url = `${APP_PATH}/media?media=${encodeURIComponent(filename)}`;
                    display_thumbnail_image(elements.thumbnail_display, thumbnail_url, filename);
                    this.removeFile(file);
                }, 1500);

                console.log('Item thumbnail uploaded:', filename);
            }
        });
    };

    /**
     * Initialize uploads module
     */
    obj.init = function() {
        console.log('Uploads module initialized');

        // Validate APP_PATH
        if (!APP_PATH) {
            console.error('Application path not configured');
            return false;
        }

        console.log('Upload endpoint:', UPLOAD_ENDPOINT);
        return true;
    };

    return obj;

}());