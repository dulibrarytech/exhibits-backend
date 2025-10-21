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

const itemsCommonGridItemFormModule = (function () {

    'use strict';

    let obj = {};

    obj.get_common_grid_item_form_fields = function () {

        try {

            const item = { styles: {} };
            const path = window.location.pathname;
            const is_text_path = path.includes('text');
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

            // Validate required modules exist
            if (!helperModule) {
                console.error('helperModule is not available');
                show_error('System configuration error.');
                return false;
            }

            // Get item metadata
            item.title = get_element_value('#item-title-input');
            item.text = get_element_value('#item-text-input');

            // Validate text content for text paths
            if (is_text_path && item.text.length === 0) {
                show_error('Please enter "Text" for this item');
                return false;
            }

            // Get optional published status
            const published_el = document.querySelector('#is-published');

            if (published_el) {
                item.is_published = published_el.value;
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

            // Get layout radio button selections
            item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));
            item.media_width = helperModule.get_checked_radio_button(document.getElementsByName('media_width'));

            return item;

        } catch (error) {
            console.error('Error in get_common_grid_item_form_fields:', error.message);
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

            if (window.location.pathname.indexOf('text') !== -1) {
                document.querySelector('#is-required-text').innerHTML = '<span style="color: darkred">*</span> Text<small><em>(Required)</em></small>';
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_grid_items();
            navModule.set_preview_link();

            let item_background_color_picker = document.querySelector('#item-background-color-picker');

            if (item_background_color_picker) {
                document.querySelector('#item-background-color-picker').addEventListener('input', () => {
                    if (document.querySelector('#item-background-color')) {
                        document.querySelector('#item-background-color').value = document.querySelector('#item-background-color-picker').value;
                    }
                });

                document.querySelector('#item-background-color').addEventListener('input', () => {
                    document.querySelector('#item-background-color-picker').value = document.querySelector('#item-background-color').value;
                });
            }

            let item_font_color_picker = document.querySelector('#item-font-color-picker');

            if (item_font_color_picker) {
                document.querySelector('#item-font-color-picker').addEventListener('input', () => {
                    if (document.querySelector('#item-font-color')) {
                        document.querySelector('#item-font-color').value = document.querySelector('#item-font-color-picker').value;
                    }
                });

                document.querySelector('#item-font-color').addEventListener('input', () => {
                    document.querySelector('#item-font-color-picker').value = document.querySelector('#item-font-color').value;
                });
            }

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
