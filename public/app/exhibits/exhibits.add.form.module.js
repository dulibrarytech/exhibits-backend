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

const exhibitsAddFormModule = (function () {

    'use strict';

    const APP_PATH = endpointsModule.get_app_path();
    const MESSAGE_SELECTOR = '#add-exhibit-message';
    let obj = {};

    /**
     * Scrolls the modal body to the top so the message area is visible
     */
    function scroll_modal_to_top() {
        const modal_body = document.querySelector('#add-exhibit-modal .modal-body');

        if (modal_body) {
            modal_body.scrollTop = 0;
        } else {
            // Fallback for standalone page usage
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
    }

    function get_exhibit_data() {

        // Helper function to safely convert to number
        const to_number = (value, default_value = null) => {

            if (value === null || value === undefined || value === '') {
                return default_value;
            }
            const num = Number(value);
            return isNaN(num) ? default_value : num;
        };

        // Helper function to validate module exists and has required methods
        const validate_module = (module, required_methods = []) => {
            if (!module || typeof module !== 'object') {
                return false;
            }

            for (const method of required_methods) {
                if (typeof module[method] !== 'function') {
                    console.error(`Required method '${method}' not found in module`);
                    return false;
                }
            }

            return true;
        };

        try {
            // Validate exhibitsCommonFormModule exists and has required methods
            if (!validate_module(exhibitsCommonFormModule, ['get_common_form_fields'])) {
                throw new Error('exhibitsCommonFormModule is not properly configured');
            }

            // Validate exhibitsStylesModule exists and has required methods
            if (!validate_module(exhibitsStylesModule, ['get_styles', 'validate_required'])) {
                throw new Error('exhibitsStylesModule is not properly configured');
            }

            // Get common form fields
            const exhibit = exhibitsCommonFormModule.get_common_form_fields();

            // Check if form fields retrieval failed
            if (exhibit === false || !exhibit) {
                // Error message should already be displayed by get_common_form_fields
                return false;
            }

            // Validate that exhibit is an object
            if (typeof exhibit !== 'object') {
                throw new Error('Invalid exhibit data format');
            }

            // Validate required style sections are filled in
            const style_validation = exhibitsStylesModule.validate_required();

            if (!style_validation.valid) {
                return false;
            }

            // Get exhibit styles
            const styles = exhibitsStylesModule.get_styles();

            // Validate styles were retrieved successfully
            if (!styles || typeof styles !== 'object') {
                throw new Error('Failed to retrieve exhibit styles');
            }

            exhibit.styles = styles;

            // Convert is_published to Number if it exists
            if ('is_published' in exhibit) {
                exhibit.is_published = to_number(exhibit.is_published, 0);
            }

            // Convert owner to Number if it exists
            if ('owner' in exhibit) {
                exhibit.owner = to_number(exhibit.owner, null);
            }

            return exhibit;

        } catch (error) {
            // Log error for debugging
            console.error('Error getting exhibit data:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred while processing exhibit data';
            domModule.set_alert(MESSAGE_SELECTOR, 'danger', error_message);

            return false;
        }
    }

    obj.create_exhibit_record = async function () {

        const REDIRECT_DELAY = 900;

        // Store timeout IDs for cleanup
        let timeout_id = null;

        try {
            // Scroll modal body to top so message area is visible
            scroll_modal_to_top();

            const endpoints = endpointsModule.get_exhibits_endpoints();

            if (!endpoints || !endpoints.exhibits || !endpoints.exhibits.exhibit_records) {
                domModule.set_alert(MESSAGE_SELECTOR, 'danger', 'Session data could not be loaded. Please reload the page and try again.');
                return false;
            }

            // Validate exhibit data
            const data = get_exhibit_data();

            if (!data) {
                return false;
            }

            // Show loading state
            domModule.set_alert(MESSAGE_SELECTOR, 'info', 'Creating exhibit record...');

            // Add user metadata
            data.created_by = helperModule.get_user_name();
            data.owner = helperModule.get_owner();

            const response = await httpModule.api({
                method: 'POST',
                url: endpoints.exhibits.exhibit_records.endpoint,
                data: data
            });

            // Validate response structure
            if (!response || response.status !== 201) {
                throw new Error('Failed to create exhibit record');
            }

            if (!response.data?.data) {
                throw new Error('Invalid response from server');
            }

            // Show success message
            domModule.set_alert(MESSAGE_SELECTOR, 'success', 'Exhibit record created');

            // Bind media library assets if selected
            const exhibit_uuid = response.data.data; // the new exhibit UUID
            const hero_media_uuid = document.querySelector('#hero-image-media-uuid')?.value?.trim();
            const thumbnail_media_uuid = document.querySelector('#thumbnail-media-uuid')?.value?.trim();

            if (hero_media_uuid || thumbnail_media_uuid) {
                try {
                    const bind_endpoint = endpoints.exhibits?.exhibit_media_library?.post?.endpoint;
                    const bind_url = bind_endpoint
                        ? endpointsModule.build(bind_endpoint, { exhibit_id: exhibit_uuid })
                        : null;

                    if (bind_url) {

                        if (hero_media_uuid) {
                            await httpModule.api({
                                method: 'POST',
                                url: bind_url,
                                data: { media_uuid: hero_media_uuid, media_role: 'hero_image' }
                            });
                        }

                        if (thumbnail_media_uuid) {
                            await httpModule.api({
                                method: 'POST',
                                url: bind_url,
                                data: { media_uuid: thumbnail_media_uuid, media_role: 'thumbnail' }
                            });
                        }
                    }
                } catch (bind_error) {
                    console.error('Error binding media to new exhibit:', bind_error);
                    // Continue to redirect — the exhibit was created successfully
                }

                // Update the exhibits field on each media record (fire-and-forget)
                try {
                    const exhibits_field_endpoint = APP_PATH + '/api/v1/media/library/record/:media_id/exhibits';

                    if (hero_media_uuid) {
                        const hero_url = endpointsModule.build(exhibits_field_endpoint, { media_id: hero_media_uuid });
                        httpModule.api({
                            method: 'PUT',
                            url: hero_url,
                            data: { exhibit_uuid: exhibit_uuid, action: 'add', media_role: 'hero_image' }
                        }).catch(function (err) {
                            console.error('Error adding exhibit to hero image media record:', err);
                        });
                    }

                    if (thumbnail_media_uuid) {
                        const thumb_url = endpointsModule.build(exhibits_field_endpoint, { media_id: thumbnail_media_uuid });
                        httpModule.api({
                            method: 'PUT',
                            url: thumb_url,
                            data: { exhibit_uuid: exhibit_uuid, action: 'add', media_role: 'thumbnail' }
                        }).catch(function (err) {
                            console.error('Error adding exhibit to thumbnail media record:', err);
                        });
                    }
                } catch (exhibits_field_error) {
                    console.error('Error updating media exhibits field:', exhibits_field_error);
                    // Non-blocking — exhibit was created successfully
                }
            }

            // Redirect after delay
            const exhibit_id = encodeURIComponent(exhibit_uuid);
            timeout_id = setTimeout(() => {
                window.location.href = `${APP_PATH}/exhibits/exhibit/details?exhibit_id=${exhibit_id}`;
            }, REDIRECT_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Create exhibit error:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred';
            domModule.set_alert(MESSAGE_SELECTOR, 'danger', error_message);

            return false;
        }
    };

    /**
     * Resets all form fields inside the add-exhibit modal to their defaults.
     * Called on modal hidden.bs.modal to ensure a clean slate if re-opened.
     */
    obj.reset_form = function () {

        try {

            // ── Textareas ──
            const textareas = [
                '#exhibit-title-input',
                '#exhibit-sub-title-input',
                '#exhibit-description-input',
                '#exhibit-about-the-curators-input'
            ];

            for (const sel of textareas) {
                const el = document.querySelector(sel);
                if (el) el.value = '';
            }

            // ── Checkboxes ──
            const checkboxes = [
                '#is-content-advisory',
                '#is-featured',
                '#is-student-curated'
            ];

            for (const sel of checkboxes) {
                const el = document.querySelector(sel);
                if (el) el.checked = false;
            }

            // ── Banner radio buttons — reset to banner_1 ──
            const banner_default = document.querySelector('#exhibit-banner-1');
            if (banner_default) banner_default.checked = true;

            // ── Hidden inputs ──
            const hiddens = [
                '#hero-image',
                '#hero-image-media-uuid',
                '#thumbnail-image',
                '#thumbnail-media-uuid'
            ];

            for (const sel of hiddens) {
                const el = document.querySelector(sel);
                if (el) el.value = '';
            }

            // ── Media preview areas — restore placeholders ──
            ['#hero-image-display', '#thumbnail-image-display'].forEach(function (sel) {
                exhibitsCommonFormModule.restore_media_placeholder(sel);
            });

            // ── Filename displays ──
            const filename_el_hero = document.querySelector('#hero-image-filename-display');
            if (filename_el_hero) filename_el_hero.textContent = '';

            const filename_el_thumb = document.querySelector('#thumbnail-filename-display');
            if (filename_el_thumb) filename_el_thumb.textContent = '';

            // ── Trash links — hide ──
            const trash_links = ['#hero-trash', '#thumbnail-trash'];

            for (const sel of trash_links) {
                const el = document.querySelector(sel);
                if (el) el.style.display = 'none';
            }

            // ── Style fields — cleared by the styles module, which owns the
            //    section x property tables (was a hard-coded copy of the
            //    section list here) ──
            exhibitsStylesModule.reset();

            // ── Collapse all open accordion panels ──
            const open_panels = document.querySelectorAll('#add-exhibit-modal .collapse.show');

            for (let i = 0; i < open_panels.length; i++) {
                $(open_panels[i]).collapse('hide');
            }

            // ── Clear message area ──
            const message_el = document.querySelector(MESSAGE_SELECTOR);
            if (message_el) message_el.innerHTML = '';

        } catch (error) {
            console.error('Error resetting add-exhibit form:', error);
        }
    };

    obj.init = async function () {

        // Helper function to safely add event listener
        const add_event_listener = (selector, event, handler, handler_name) => {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn(`Element not found: ${selector}`);
                return false;
            }

            if (!handler || typeof handler !== 'function') {
                console.error(`Invalid handler for ${selector}: ${handler_name}`);
                return false;
            }

            element.addEventListener(event, handler);
            return true;
        };

        // Helper function to safely clear element content
        const clear_element = (selector) => {
            const element = document.querySelector(selector);
            if (element) {
                element.innerHTML = '';
            } else {
                console.warn(`Element not found: ${selector}`);
            }
        };

        /*
         * Client-side clear for one media slot (no API call on the add form —
         * nothing is bound until the exhibit exists).
         */
        const clear_media_slot = (role) => function (e) {
            e.preventDefault();
            exhibitsCommonFormModule.clear_media_slot_ui(role);
        };

        try {

            // Validate required modules exist
            if (!exhibitsAddFormModule || typeof exhibitsAddFormModule !== 'object') {
                throw new Error('exhibitsAddFormModule is not available');
            }

            if (!exhibitsCommonFormModule || typeof exhibitsCommonFormModule !== 'object') {
                throw new Error('exhibitsCommonFormModule is not available');
            }

            if (!helperModule || typeof helperModule !== 'object') {
                throw new Error('helperModule is not available');
            }

            // Add event listeners with validation
            const listeners = [
                {
                    selector: '#save-exhibit-btn',
                    event: 'click',
                    handler: exhibitsAddFormModule.create_exhibit_record,
                    name: 'create_exhibit_record'
                },
                {
                    selector: '#hero-trash',
                    event: 'click',
                    handler: clear_media_slot('hero_image'),
                    name: 'clear_hero_image'
                },
                {
                    selector: '#thumbnail-trash',
                    event: 'click',
                    handler: clear_media_slot('thumbnail'),
                    name: 'clear_thumbnail'
                }
            ];

            // Track successful and failed listener attachments
            let attached_count = 0;
            let failed_count = 0;

            for (const listener of listeners) {
                const success = add_event_listener(
                    listener.selector,
                    listener.event,
                    listener.handler,
                    listener.name
                );

                if (success) {
                    attached_count++;
                } else {
                    failed_count++;
                }
            }

            // Wire media picker buttons — shared with the edit form
            if (exhibitsCommonFormModule.wire_media_picker({
                button_selector: '#pick-hero-image-btn',
                role: 'hero_image',
                exhibit_uuid: null // null on add form — binding created after exhibit create
            })) {
                attached_count++;
            }

            if (exhibitsCommonFormModule.wire_media_picker({
                button_selector: '#pick-thumbnail-btn',
                role: 'thumbnail',
                exhibit_uuid: null
            })) {
                attached_count++;
            }

            // Log initialization summary
            console.debug(`Initialization complete: ${attached_count} listeners attached, ${failed_count} failed`);

            // Clear item list navigation
            clear_element('#item-list-nav');

            return true;

        } catch (error) {
            // Log error for debugging
            console.error('Error initializing module:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred during initialization';
            domModule.set_alert(MESSAGE_SELECTOR, 'danger', error_message);

            return false;
        }
    };

    return obj;

}());
