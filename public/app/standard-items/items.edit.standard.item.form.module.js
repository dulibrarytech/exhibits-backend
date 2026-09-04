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

    const APP_PATH = endpointsModule.get_app_path();
    let obj = {};

    async function get_item_record() {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const profile = authModule.get_user_profile_data();
            const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.item_records.get.endpoint, {
                exhibit_id: exhibit_id,
                item_id: item_id
            });

            if (!endpoint) {
                throw new Error('Missing required parameters: exhibit_id or item_id');
            }

            const response = await httpModule.api({
                method: 'GET',
                url: endpoint + '?type=edit&uid=' + profile.uid
            });

            if (response && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    }

    async function display_edit_record() {

        try {

            const record = await get_item_record();

            if (!record) {
                console.error('No record returned from get_item_record()');
                return false;
            }

            // Check if record is locked
            await lockModule.check_if_locked(record, '#exhibit-submit-card');

            // Disable form fields if locked by another user
            if (lockModule.is_locked_by_other_user(record)) {
                const is_admin = await lockModule.is_user_administrator();
                lockModule.disable_form_fields({ preserve_selectors: is_admin ? ['#unlock-record'] : [] });
            }

            // Setup automatic unlock when user navigates away (only if current user has it locked)
            // setup_auto_unlock(record);
            lockModule.setup_auto_unlock(record);

            const is_media_path = window.location.pathname.split('/').filter(Boolean).includes('media');

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

            // Set published status
            const published_el = document.querySelector('#is-published');
            if (published_el) {
                published_el.value = record.is_published === 1;
            }

            // Set basic item data
            rteModule.set_html('item-text-input', helperModule.unescape(record.text));

            // Handle media-specific fields
            if (is_media_path) {
                itemsCommonStandardItemFormModule.populate_media_previews(record);

                // Populate optional Pop-up Window Description + Caption fields
                rteModule.set_html('item-description-input', helperModule.unescape(record.description));
                rteModule.set_html('item-caption-input', helperModule.unescape(record.caption));

                // Populate the Embed Item flag and sync the description's enabled
                // state (dispatch 'change' so the common module's listener runs).
                const embed_item_el = document.getElementById('embed-item');
                if (embed_item_el) {
                    embed_item_el.checked = record.is_embedded === 1;
                    embed_item_el.dispatchEvent(new Event('change'));
                }

                const media_padding_el = document.getElementById('media-padding');
                if (media_padding_el) {
                    media_padding_el.checked = record.media_padding === 0;
                }

                const wrap_text_el = document.getElementById('wrap-text');
                if (wrap_text_el) {
                    wrap_text_el.checked = record.wrap_text !== 0;
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

            // Set saved style selection after dropdown is populated
            // Style keys are simple strings like "item1"; skip "{}" (prepare_styles default) and legacy JSON blobs
            if (record.styles && typeof record.styles === 'string'
                && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
                await itemsCommonStandardItemFormModule.wait_for_styles();
                itemsCommonStandardItemFormModule.set_item_style(record.styles);
            }

            domModule.set_value('#margins', record.margins ?? 'medium');
            domModule.set_value('#text-align', record.text_alignment ?? 'left');

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error);
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
            return false;
        }
    }

    obj.update_item_record = async function () {

        // Prevent duplicate submissions
        if (this._is_updating_item) {
            return false;
        }

        this._is_updating_item = true;

        // Cache DOM element and constants
        const message_element = document.querySelector('#message');
        const MESSAGE_CLEAR_DELAY = 3000;

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

            return {valid: true};
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
            const item_id = helperModule.get_parameter_by_name('item_id');

            const validation = validate_parameters(exhibit_id, item_id);
            if (!validation.valid) {
                domModule.set_alert(message_element, 'danger', validation.error);
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
            domModule.set_alert(message_element, 'info', 'Updating item record...');

            // Get API endpoints
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

            if (!EXHIBITS_ENDPOINTS?.exhibits?.item_records?.put?.endpoint) {
                domModule.set_alert(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.item_records.put.endpoint, {
                exhibit_id: exhibit_id,
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
                throw new Error('Failed to update item record');
            }

            // Show success message
            domModule.set_alert(message_element, 'success', 'Item record updated successfully');

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
            console.error('Error updating item record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || error.message || 'Unable to update item record. Please try again.';
            domModule.set_alert(message_element, 'danger', error_message);

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

            if (window.location.pathname.indexOf('text') !== -1) {
                type = 'text';
            }

            const redirect = '/items/standard/' + type + '/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'item', exhibit_id, item_id, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            await display_edit_record();
            domModule.on('#save-item-btn', 'click', itemsEditStandardItemFormModule.update_item_record);

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
