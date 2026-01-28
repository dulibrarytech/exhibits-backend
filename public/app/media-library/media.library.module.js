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

const mediaLibraryModule = (function() {

    'use strict';

    let obj = {};

    /**
     * Wait for a dependency to be available
     * @param {Function} check_fn - Function that returns true when dependency is ready
     * @param {number} max_attempts - Maximum number of attempts (default: 50)
     * @param {number} interval - Interval between checks in ms (default: 100)
     * @returns {Promise<boolean>} Resolves true if dependency loaded, false if timed out
     */
    const wait_for_dependency = (check_fn, max_attempts = 50, interval = 100) => {
        return new Promise((resolve) => {
            let attempts = 0;

            const check = () => {
                attempts++;
                if (check_fn()) {
                    resolve(true);
                } else if (attempts < max_attempts) {
                    setTimeout(check, interval);
                } else {
                    resolve(false);
                }
            };

            check();
        });
    };

    /**
     * Initialize Dropzone and uploads functionality
     * @returns {Promise<boolean>} True if initialization successful
     */
    const init_dropzone = async () => {
        // Wait for Dropzone library to load
        const dropzone_loaded = await wait_for_dependency(() => typeof Dropzone !== 'undefined');

        if (!dropzone_loaded) {
            console.error('Dropzone library failed to load');
            return false;
        }

        // Disable Dropzone auto-discover to prevent double initialization
        Dropzone.autoDiscover = false;

        // Wait for uploads module to be available
        const uploads_loaded = await wait_for_dependency(() => typeof mediaUploadsModule !== 'undefined');

        if (!uploads_loaded) {
            console.error('Uploads module failed to load');
            return false;
        }

        // Initialize uploads module
        const init_success = mediaUploadsModule.init();

        if (!init_success) {
            console.error('Failed to initialize uploads module');
            return false;
        }

        // Setup tab switching handler for lazy initialization
        obj.setup_upload_tab_handler();

        console.log('Dropzone and uploads module initialized successfully');
        return true;
    };

    /**
     * Setup handler for upload tab switching
     * Re-initializes dropzone when tab becomes visible
     */
    obj.setup_upload_tab_handler = function() {
        const upload_tab = document.getElementById('upload-media-tab');

        if (!upload_tab) {
            console.warn('Upload media tab not found');
            return;
        }

        upload_tab.addEventListener('shown.bs.tab', function() {
            const dropzone_el = document.getElementById('item-dropzone');

            // Initialize dropzone if not already initialized
            if (dropzone_el && !dropzone_el.dropzone && typeof mediaUploadsModule !== 'undefined') {
                mediaUploadsModule.upload_item_media();
            }
        });
    };

    /**
     * Initialize module
     */
    obj.init = async function() {

        try {

            // Check authentication
            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            // Initialize Dropzone and uploads
            await init_dropzone();

            // Initialize page
            // TODO await obj.display_media_items();
            helperModule.show_form();
            navModule.set_logout_link();

            console.log('Media library module initialized');

        } catch (error) {
            console.error('Error initializing media library module:', error);
            const message_element = document.querySelector('#message');

            if (message_element) {
                message_element.innerHTML = '<div class="alert alert-danger">Error initializing media library. Please refresh the page.</div>';
            }
        }
    };

    return obj;

}());
