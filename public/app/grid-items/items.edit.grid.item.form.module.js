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

const itemsEditGridItemFormModule = (function () {

    'use strict';

    // const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_grid_item_record() {

        // Cache DOM element
        const message_element = document.querySelector('#message');

        /**
         * Validate required parameters
         */
        const validate_parameters = (exhibit_id, grid_id, item_id) => {
            if (!exhibit_id || !grid_id || !item_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, grid_id, or item_id'
                };
            }

            // Validate reasonable string lengths
            if (exhibit_id.length > 255 || grid_id.length > 255 || item_id.length > 255) {
                return {
                    valid: false,
                    error: 'Invalid parameter length'
                };
            }

            return { valid: true };
        };

        try {

            // Get and validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const validation = validate_parameters(exhibit_id, grid_id, item_id);

            if (!validation.valid) {
                domModule.set_alert(message_element, 'danger', validation.error);
                return null;
            }

            // Get user profile
            const profile = authModule.get_user_profile_data();

            if (!profile?.uid) {
                domModule.set_alert(message_element, 'danger', 'Invalid user profile data');
                return null;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.grid_item_record?.get?.endpoint) {
                domModule.set_alert(message_element, 'danger', 'API endpoint configuration missing');
                return null;
            }

            const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.grid_item_record.get.endpoint, {
                exhibit_id: exhibit_id,
                grid_id: grid_id,
                item_id: item_id
            });

            // Construct URL with query parameters safely
            const params = new URLSearchParams({
                type: 'edit',
                uid: profile.uid
            });
            const full_url = `${endpoint}?${params.toString()}`;

            /* null = missing token; httpModule.api has alerted and scheduled the logout */
            const response = await httpModule.api({
                method: 'GET',
                url: full_url
            });

            // Validate response structure
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            if (!response.data?.data) {
                throw new Error('Invalid response structure');
            }

            return response.data.data;

        } catch (error) {
            // Log error for debugging
            console.error('Error in get_grid_item_record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || 'Unable to load the grid item record. Please try again.';
            domModule.set_alert(message_element, 'danger', error_message);

            return null;
        }
    }

    async function display_edit_record() {

        /**
         * Cache all required DOM elements
         */
        const cache_dom_elements = () => {
            return {
                created: document.querySelector('#created'),
                is_published: document.querySelector('#is-published'),
                item_title: document.querySelector('#item-title-input'),
                item_text: document.querySelector('#item-text-input'),
                item_bg_color: document.querySelector('#item-background-color'),
                item_bg_color_picker: document.querySelector('#item-background-color-picker'),
                item_font_color: document.querySelector('#item-font-color'),
                item_font_color_picker: document.querySelector('#item-font-color-picker'),
                item_font: document.querySelector('#item-font'),
                item_font_size: document.querySelector('#item-font-size'),
                layouts: document.getElementsByName('layout'),
                media_width: document.getElementsByName('media_width')
            };
        };

        /**
         * Display creation and update metadata securely
         */
        const display_metadata_info = (record, created_element) => {
            if (!created_element || !record) {
                return;
            }

            const metadata_parts = [];

            // Add creation info
            if (record.created_by && record.created) {
                const create_date = new Date(record.created);

                if (is_valid_date(create_date)) {
                    const create_date_time = helperModule.format_date(create_date);
                    const created_em = document.createElement('em');
                    created_em.textContent = `Created by ${record.created_by} on ${create_date_time}`;
                    metadata_parts.push(created_em);
                }
            }

            // Add update info
            if (record.updated_by && record.updated) {
                const update_date = new Date(record.updated);

                if (is_valid_date(update_date)) {
                    const update_date_time = helperModule.format_date(update_date);
                    const updated_em = document.createElement('em');
                    updated_em.textContent = `Last updated by ${record.updated_by} on ${update_date_time}`;
                    metadata_parts.push(updated_em);
                }
            }

            // Clear and append content safely
            created_element.textContent = '';

            metadata_parts.forEach((part, index) => {
                if (index > 0) {
                    created_element.appendChild(document.createTextNode(' | '));
                }
                created_element.appendChild(part);
            });
        };

        /**
         * Set published status
         */
        const set_published_status = (is_published, element) => {
            if (!element) {
                return;
            }

            const published_values = [1, true, '1', 'true'];
            element.checked = published_values.includes(is_published);
        };

        /**
         * Set basic form fields
         */
        const set_basic_fields = (record, elements) => {
            // Set title
            rteModule.set_html('item-title-input', record.title ? helperModule.unescape(record.title) : '');

            // Set text
            rteModule.set_html('item-text-input', record.text ? helperModule.unescape(record.text) : '');
        };

        /**
         * Set layout radio buttons
         */
        const set_layout_selection = (layout_value, layouts) => {
            if (!layouts || layouts.length === 0 || !layout_value) {
                return;
            }

            for (let i = 0; i < layouts.length; i++) {
                if (layouts[i].value === layout_value) {
                    layouts[i].checked = true;
                    break;
                }
            }
        };

        /**
         * Set media width radio buttons
         */
        const set_media_width_selection = (width_value, media_width_elements) => {
            if (!media_width_elements || media_width_elements.length === 0) {
                return;
            }

            const target_width = parseInt(width_value, 10);
            if (isNaN(target_width)) {
                return;
            }

            for (let i = 0; i < media_width_elements.length; i++) {
                const element_width = parseInt(media_width_elements[i].value, 10);
                if (element_width === target_width) {
                    media_width_elements[i].checked = true;
                    break;
                }
            }
        };

        /**
         * Apply style settings
         */
        const apply_style_settings = (styles_data, elements) => {
            if (!styles_data) {
                return;
            }

            let styles;

            // Safely parse styles JSON
            try {
                styles = typeof styles_data === 'string'
                    ? JSON.parse(styles_data)
                    : styles_data;
            } catch (error) {
                console.error('Failed to parse styles JSON:', error);
                return;
            }

            if (!styles || typeof styles !== 'object' || Object.keys(styles).length === 0) {
                return;
            }

            // Apply background color
            apply_color_setting(
                styles.backgroundColor,
                elements.item_bg_color,
                elements.item_bg_color_picker
            );

            // Apply font color
            apply_color_setting(
                styles.color,
                elements.item_font_color,
                elements.item_font_color_picker
            );

            // Apply font size
            apply_font_size(styles.fontSize, elements.item_font_size);

            // Apply font family
            apply_font_family(styles.fontFamily, elements.item_font);
        };

        /**
         * Apply color value to input and picker
         */
        const apply_color_setting = (color_value, input_element, picker_element) => {
            if (color_value) {
                const sanitized_color = String(color_value).trim();

                if (input_element) {
                    input_element.value = sanitized_color;
                }

                if (picker_element) {
                    picker_element.value = sanitized_color;
                }
            } else {
                if (input_element) {
                    input_element.value = '';
                }
                if (picker_element) {
                    picker_element.value = '';
                }
            }
        };

        /**
         * Apply font size setting
         */
        const apply_font_size = (font_size_value, element) => {
            if (!element) {
                return;
            }

            if (font_size_value) {
                const size_numeric = String(font_size_value).replace(/px$/i, '').trim();
                element.value = size_numeric;
            } else {
                element.value = '';
            }
        };

        /**
         * Apply font family if it exists in options
         */
        const apply_font_family = (font_family_value, element) => {
            if (!font_family_value || !element || !element.options) {
                return;
            }

            const sanitized_font = String(font_family_value).trim();

            // Check if font exists in options
            const options = Array.from(element.options);
            const has_match = options.some(option => option.value === sanitized_font);

            if (has_match) {
                element.value = sanitized_font;
            }
        };

        /**
         * Validate if a date is valid
         */
        const is_valid_date = (date) => {
            return date instanceof Date && !isNaN(date.getTime());
        };

        try {

            // Fetch record data
            const record = await get_grid_item_record();

            if (!record) {
                throw new Error('Failed to load grid item record data');
            }

            // Cache all DOM elements
            const elements = cache_dom_elements();

            // Check if record is locked
            await lockModule.check_if_locked(record, '#item-submit-card');

            // Disable form fields if locked by another user
            if (lockModule.is_locked_by_other_user(record)) {
                const is_admin = await lockModule.is_user_administrator();
                lockModule.disable_form_fields({ preserve_selectors: is_admin ? ['#unlock-record'] : [] });
            }

            // Setup automatic unlock when user navigates away
            lockModule.setup_auto_unlock(record);

            // Display metadata (creation/update info)
            display_metadata_info(record, elements.created);

            // Set published status
            set_published_status(record.is_published, elements.is_published);

            // Set basic form fields
            set_basic_fields(record, elements);

            // Populate media previews from record (media picker integration)
            const is_media_path = window.location.pathname.split('/').filter(Boolean).includes('media');
            if (is_media_path) {
                itemsCommonGridItemFormModule.populate_media_previews(record);

                // Populate optional Pop-up Window Description + Caption fields
                rteModule.set_html('item-description-input', helperModule.unescape(record.description));
                rteModule.set_html('item-caption-input', helperModule.unescape(record.caption));
            }

            // Set layout selection
            set_layout_selection(record.layout, elements.layouts);

            // Set media width selection
            set_media_width_selection(record.media_width, elements.media_width);

            // Set embed item checkbox from record
            const embed_item_el = document.getElementById('embed-item');
            if (embed_item_el) {
                embed_item_el.checked = record.is_embedded === 1;
                embed_item_el.dispatchEvent(new Event('change'));
            }

            // Apply style settings
            apply_style_settings(record.styles, elements);

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error);
            domModule.set_alert('#message', 'danger', 'Unable to display the record. Please try again.');
            return false;
        }
    }

    obj.update_grid_item_record = async function() {
        // Prevent duplicate submissions
        if (this._is_updating_grid_item) {
            return false;
        }

        this._is_updating_grid_item = true;

        // Cache DOM element and constants
        const message_element = document.querySelector('#message');
        const MESSAGE_CLEAR_DELAY = 3000;

        /**
         * Validate parameters
         */
        const validate_parameters = (exhibit_id, grid_id, item_id) => {
            if (!exhibit_id || !grid_id || !item_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, grid_id, or item_id'
                };
            }

            if (exhibit_id.length > 255 || grid_id.length > 255 || item_id.length > 255) {
                return {
                    valid: false,
                    error: 'Invalid parameter length'
                };
            }

            return { valid: true };
        };

        /**
         * Refresh the record display without reloading
         */
        const refresh_record_display = async () => {
            try {
                if (typeof display_edit_record === 'function') {
                    await display_edit_record();
                }

                reset_form_state();
            } catch (error) {
                console.error('Error refreshing display:', error);
            }
        };

        /**
         * Reset form state after update
         */
        const reset_form_state = () => {
            // Temporarily disable submit button
            const submit_button = document.querySelector('#item-submit-card button[type="submit"], button[type="submit"]');
            if (submit_button) {
                submit_button.disabled = true;
                setTimeout(() => {
                    submit_button.disabled = false;
                }, 1000);
            }

            // Clear unsaved changes warning
            window.onbeforeunload = null;
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Scroll to top for user feedback
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Get and validate parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, grid_id, item_id);
            if (!validation.valid) {
                domModule.set_alert(message_element, 'warning', validation.error);
                return false;
            }

            // Show loading state
            domModule.set_alert(message_element, 'info', 'Updating grid item record...');

            // Get and validate form data
            const form_data = itemsCommonGridItemFormModule.get_common_grid_item_form_fields();

            if (!form_data || form_data === false || form_data === undefined) {
                // domModule.set_alert(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            if (user_name) {
                form_data.updated_by = user_name;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.grid_item_records?.put?.endpoint) {
                domModule.set_alert(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.grid_item_records.put.endpoint, {
                exhibit_id: exhibit_id,
                grid_id: grid_id,
                item_id: item_id
            });

            // Make API request (null = missing token; httpModule.api has
            // already alerted and scheduled the logout)
            const response = await httpModule.api({
                method: 'PUT',
                url: endpoint,
                data: form_data
            });

            if (response === null) {
                return false;
            }

            // Validate response
            if (!response || response.status !== 201) {
                throw new Error('Failed to update grid item record');
            }

            // Show success message
            domModule.set_alert(message_element, 'success', 'Grid item record updated successfully');

            // Refresh the display with updated data
            await refresh_record_display();

            // Smoothly clear success message after delay
            timeout_id = setTimeout(() => {
                helperModule.clear_status_message(message_element);
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error updating grid item record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || error.message || 'Unable to update grid item record. Please try again.';
            domModule.set_alert(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_updating_grid_item = false;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const redirect = '/items/grid/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'grid_item', exhibit_id, item_id, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            await display_edit_record();
            domModule.on('#save-item-btn', 'click', itemsEditGridItemFormModule.update_grid_item_record);

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
