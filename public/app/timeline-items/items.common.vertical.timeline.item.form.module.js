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

    let obj = {};

    obj.get_common_timeline_item_form_fields = function () {

        try {

            const item = { styles: {} };
            const path = window.location.pathname;
            const is_media_path = path.includes('media');

            // Helper function for safe DOM queries
            const get_element_value = (selector, default_value = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? default_value;
            };

            const show_error = (message) => {
                const message_el = document.querySelector('#message');
                if (message_el) {
                    message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                }
            };

            // Get item metadata
            item.title = get_element_value('#item-title-input');
            item.text = get_element_value('#item-text-input');
            item.date = get_element_value('input[type="date"]');
            item.item_subjects = get_element_value('#selected-subjects');

            // Validate required date field
            if (!item.date || item.date.length === 0) {
                show_error('Please enter a timeline date');
                return false;
            }

            // Validate date format (YYYY-MM-DD)
            const date_pattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!date_pattern.test(item.date)) {
                show_error('Please enter a valid date format (YYYY-MM-DD)');
                return false;
            }

            // Validate date is a real date
            const date_obj = new Date(item.date);
            if (isNaN(date_obj.getTime())) {
                show_error('Please enter a valid date');
                return false;
            }

            // Handle media-specific logic
            if (is_media_path) {
                // Validate required module exists
                if (!helperMediaModule) {
                    console.error('helperMediaModule is not available');
                    show_error('System configuration error.');
                    return false;
                }

                helperMediaModule.process_media_fields_common(item);

                // Validate media content exists
                const has_media = (
                    (item.media?.length > 0) ||
                    (item.kaltura?.length > 0) ||
                    (item.repo_uuid?.length > 0)
                );

                if (!has_media) {
                    show_error('Please upload or import a media item');
                    return false;
                }

                // Handle image alt text validation
                if (item.item_type === 'image') {
                    const alt_text_input = document.querySelector('#item-alt-text-input');
                    const alt_text = alt_text_input?.value?.trim() ?? '';

                    if (item.is_alt_text_decorative === true) {
                        item.is_alt_text_decorative = 1;
                        item.alt_text = '';
                    } else if (item.is_alt_text_decorative === false) {
                        item.is_alt_text_decorative = 0;
                        item.alt_text = alt_text;

                        if (alt_text.length === 0) {
                            show_error('Please enter "alt text" for this item');
                            return false;
                        }
                    }
                }
            } else {
                // Default to text type for non-media paths
                item.item_type = 'text';
                item.mime_type = 'text/plain';
            }

            return item;

        } catch (error) {
            console.error('Error in get_common_timeline_item_form_fields:', error.message);
            const message_el = document.querySelector('#message');
            if (message_el) {
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            }
            return false;
        }
    };

    obj.init = async function () {

        try {

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_common_init();
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_timeline_items();
            navModule.set_preview_link();
            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
