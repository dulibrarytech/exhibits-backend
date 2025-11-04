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

const itemsEditStandardItemFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    let obj = {};

    async function get_item_record() {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/exhibits-dashboard/auth');
                }, 1000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint + '?type=edit&uid=' + profile.uid,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function display_edit_record() {

        // Helper function to check if current user is an administrator
        const is_user_administrator = async () => {

            try {
                const profile = authModule.get_user_profile_data();
                if (!profile || !profile.uid) {
                    return false;
                }

                const user_id = parseInt(profile.uid, 10);
                if (isNaN(user_id)) {
                    return false;
                }

                const user_role = await authModule.get_user_role(user_id);
                return user_role === 'Administrator';

            } catch (error) {
                console.error('Error checking user role:', error);
                return false;
            }
        };

        // Helper function to disable all form fields
        const disable_form_fields = async (is_admin) => {

            // Get all form elements
            const form_elements = document.querySelectorAll(
                'input:not([type="hidden"]), textarea, select, button[type="submit"], button[type="button"]'
            );

            let disabled_count = 0;

            form_elements.forEach(element => {
                // Skip the unlock button if user is an administrator
                if (is_admin && element.id === 'unlock-record') {
                    console.log('Preserving unlock button for administrator');
                    return;
                }

                // Don't disable already disabled elements or read-only elements
                if (!element.disabled && !element.readOnly) {
                    element.disabled = true;
                    element.style.cursor = 'not-allowed';
                    element.style.opacity = '0.6';
                    disabled_count++;
                }
            });

            // Also disable file upload areas and custom buttons (except unlock button for admins)
            const custom_buttons = document.querySelectorAll('.btn:not([disabled])');
            custom_buttons.forEach(button => {
                // Skip the unlock button if user is an administrator
                if (is_admin && button.id === 'unlock-record') {
                    return;
                }

                button.disabled = true;
                button.style.cursor = 'not-allowed';
                button.style.opacity = '0.6';
            });

            console.log(`Disabled ${disabled_count} form elements (record locked by another user)`);
        };

        // Helper function to check if record is locked by another user
        const is_locked_by_other_user = (record) => {

            // Check if record is locked
            if (!record || record.is_locked !== 1) {
                return false;
            }

            // Get current user profile
            const profile = authModule.get_user_profile_data();

            if (!profile || !profile.uid) {
                console.warn('Unable to get user profile data');
                return false;
            }

            // Parse user IDs safely
            const user_id = parseInt(profile.uid, 10);
            const locked_by_user = parseInt(record.locked_by_user, 10);

            // Check for valid numbers
            if (isNaN(user_id) || isNaN(locked_by_user)) {
                console.error('Invalid user ID values');
                return false;
            }

            // Return true if locked by someone else
            return user_id !== locked_by_user;
        };

        try {

            const record = await get_item_record();

            if (!record) {
                console.error('No record returned from get_item_record()');
                return false;
            }

            // Check if record is locked
            await helperModule.check_if_locked(record, '#item-submit-card');

            // Disable form fields if locked by another user
            if (is_locked_by_other_user(record)) {
                // Check if current user is an administrator
                const is_admin = await is_user_administrator();

                // Disable form fields, but preserve unlock button for admins
                await disable_form_fields(is_admin);
            }

            // Setup automatic unlock when user navigates away (only if current user has it locked)
            // setup_auto_unlock(record);
            helperModule.setup_auto_unlock(record);

            const is_media_path = window.location.pathname.includes('media');

            // Helper function for safe DOM queries
            const set_element_value = (selector, value) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.value = value;
                }
            };

            const set_element_checked = (selector, checked) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.checked = !!checked;
                }
            };

            // Format and display creation/update metadata
            const create_datetime = helperModule.format_date(new Date(record.created));
            const update_datetime = helperModule.format_date(new Date(record.updated));
            const metadata_parts = [];

            if (record.created_by) {
                metadata_parts.push(`<em>Created by ${record.created_by} on ${create_datetime}</em>`);
            }
            if (record.updated_by) {
                metadata_parts.push(`<em>Last updated by ${record.updated_by} on ${update_datetime}</em>`);
            }

            const created_el = document.querySelector('#created');
            if (created_el) {
                created_el.innerHTML = metadata_parts.join(' | ');
            }

            // Check if record is locked
            await helperModule.check_if_locked(record, '#exhibit-submit-card');

            // Set published status
            const published_el = document.querySelector('#is-published');
            if (published_el) {
                published_el.value = record.is_published === 1;
            }

            // Set basic item data
            set_element_value('#item-title-input', helperModule.unescape(record.title));
            set_element_value('#item-text-input', helperModule.unescape(record.text));

            // Handle media-specific fields
            if (is_media_path) {

                await helperMediaModule.display_media_fields_common(record);

                if (record.item_subjects !== null && record.item_subjects?.length > 0) {
                    const subjects = record.item_subjects.split('|');
                    await helperModule.create_subjects_menu(subjects);
                } else {
                    await helperModule.create_subjects_menu();
                }
            }

            // Set radio button selections
            const set_radio_value = (name, value) => {
                const elements = document.getElementsByName(name);
                for (const el of elements) {
                    if (el.value === value) {
                        set_element_checked(`#${el.id}`, true);
                        break; // Found match, exit early
                    }
                }
            };

            set_radio_value('layout', record.layout);
            set_radio_value('media_width', String(record.media_width));

            // Parse and apply styles
            const apply_styles = () => {
                let styles = {};

                try {
                    styles = JSON.parse(record.styles || '{}');
                } catch (e) {
                    console.error('Invalid styles JSON:', e.message);
                    return;
                }

                if (Object.keys(styles).length === 0) {
                    return;
                }

                const style_field_map = {
                    backgroundColor: ['#item-background-color', '#item-background-color-picker'],
                    color: ['#item-font-color', '#item-font-color-picker'],
                };

                // Apply color and background styles
                for (const [style_key, selectors] of Object.entries(style_field_map)) {
                    const value = styles[style_key] || '';
                    selectors.forEach(selector => set_element_value(selector, value));
                }

                // Set font family
                if (styles.fontFamily) {
                    set_element_value('#item-font', styles.fontFamily);
                }

                // Set font size (remove 'px' suffix)
                if (styles.fontSize) {
                    const font_size_value = styles.fontSize.replace(/px$/, '');
                    set_element_value('#item-font-size', font_size_value);
                } else {
                    set_element_value('#item-font-size', '');
                }
            };

            apply_styles();

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error.message);
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            return false;
        }
    }

    obj.update_item_record = async function() {

        // Prevent duplicate submissions
        if (this._is_updating_item) {
            return false;
        }

        this._is_updating_item = true;

        // Cache DOM element and constants
        const message_element = document.querySelector('#message');
        const MESSAGE_CLEAR_DELAY = 3000;
        const FADE_DURATION = 300;

        /**
         * Display status message to user (XSS-safe)
         */
        const display_message = (element, type, message) => {
            if (!element) {
                return;
            }

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = get_icon_class(alert_type);
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            element.style.opacity = '1';
            element.style.transition = '';
            element.textContent = '';
            element.appendChild(alert_div);
        };

        /**
         * Clear message with smooth fade effect
         */
        const clear_message_smoothly = () => {
            if (!message_element) {
                return;
            }

            message_element.style.transition = `opacity ${FADE_DURATION}ms ease-out`;
            message_element.style.opacity = '0';

            setTimeout(() => {
                message_element.textContent = '';
                message_element.style.opacity = '1';
                message_element.style.transition = '';
            }, FADE_DURATION);
        };

        /**
         * Get icon class for alert type
         */
        const get_icon_class = (alert_type) => {
            const icon_map = {
                'info': 'fa fa-info',
                'success': 'fa fa-check',
                'danger': 'fa fa-exclamation',
                'warning': 'fa fa-exclamation-triangle'
            };
            return icon_map[alert_type] || 'fa fa-exclamation';
        };

        /**
         * Validate parameters
         */
        const validate_parameters = (exhibit_id, item_id) => {
            if (!exhibit_id || !item_id) {
                return {
                    valid: false,
                    error: 'Missing required record identifiers'
                };
            }

            if (exhibit_id.length > 255 || item_id.length > 255) {
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
            // Mark form as clean if tracking dirty state
            if (typeof rich_text_data !== 'undefined' && rich_text_data?.setDirty) {
                rich_text_data.setDirty(false);
            }

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
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Get and validate parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, item_id);
            if (!validation.valid) {
                display_message(message_element, 'danger', validation.error);
                return false;
            }

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Session expired. Please log in again.');

                timeout_id = setTimeout(() => {
                    authModule.logout();
                }, 1000);

                return false;
            }

            // Get and validate form data
            const form_data = itemsCommonStandardItemFormModule.get_common_standard_item_form_fields();

            if (!form_data || form_data === false || form_data === undefined) {
                // display_message(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            if (user_name) {
                form_data.updated_by = user_name;
            }

            // Show loading state
            display_message(message_element, 'info', 'Updating item record...');

            // Get API endpoints
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.put?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.item_records.put.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':item_id', encodeURIComponent(item_id));

            // Make API request
            const response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: form_data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 201) {
                throw new Error('Failed to update item record');
            }

            // Show success message
            display_message(message_element, 'success', 'Item record updated successfully');

            // Refresh the display with updated data
            await refresh_record_display();

            // Smoothly clear success message after delay
            timeout_id = setTimeout(() => {
                clear_message_smoothly();
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error updating item record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || error.message || 'Unable to update item record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_updating_item = false;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            let type = 'media';

            if (window.location.pathname.indexOf('text')) {
                type = 'text';
            }

            const redirect = '/items/standard/' + type + '/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'item', exhibit_id, item_id, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            await display_edit_record();
            document.querySelector('#update-item-btn').addEventListener('click', itemsEditStandardItemFormModule.update_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
