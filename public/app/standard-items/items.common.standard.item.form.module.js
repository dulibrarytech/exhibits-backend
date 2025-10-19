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

const itemsCommonStandardItemFormModule = (function () {

    'use strict';

    let obj = {};

    obj.get_common_standard_item_form_fields = function () {

        try {
            const item = { styles: {} };
            const path = window.location.pathname;
            const isTextPath = path.includes('text');
            const isMediaPath = path.includes('media');

            // Helper function for safe DOM queries
            const getElementValue = (selector, defaultValue = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? defaultValue;
            };

            const showError = (message) => {
                const messageEl = document.querySelector('#message');
                if (messageEl) {
                    messageEl.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                }
            };

            // Get item metadata
            item.title = getElementValue('#item-title-input');
            item.text = getElementValue('#item-text-input');

            // Validate text content for text paths
            if (isTextPath && item.text.length === 0) {
                showError('Please enter "Text" for this item');
                return false;
            }

            // Get optional published status
            const publishedEl = document.querySelector('#is-published');
            if (publishedEl) {
                item.is_published = publishedEl.value;
            }

            // Get radio button selections
            item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));
            item.media_width = helperModule.get_checked_radio_button(document.getElementsByName('media_width'));
            item.item_subjects = getElementValue('#selected-subjects');

            // Build styles object with safe access
            const buildStyles = () => {
                const styleMap = {
                    backgroundColor: '#item-background-color',
                    color: '#item-font-color',
                    fontFamily: '#item-font',
                };

                for (const [cssKey, selector] of Object.entries(styleMap)) {
                    const value = getElementValue(selector);
                    if (value) {
                        item.styles[cssKey] = value;
                    }
                }

                // Handle font size with unit
                const fontSize = getElementValue('#item-font-size');
                if (fontSize) {
                    item.styles.fontSize = `${fontSize}px`;
                }
            };

            buildStyles();

            // Handle media-specific logic
            if (isMediaPath) {
                helperMediaModule.process_media_fields_common(item);

                // Validate media content
                const hasMedia = (
                    (item.media?.length > 0) ||
                    (item.kaltura?.length > 0) ||
                    (item.repo_uuid?.length > 0)
                );

                if (!hasMedia) {
                    showError('Please upload or import a media item');
                    return false;
                }

                // Handle image alt text validation
                if (item.item_type === 'image') {
                    const altTextInput = document.querySelector('#item-alt-text-input');
                    const altText = altTextInput?.value?.trim() ?? '';

                    if (item.is_alt_text_decorative === true) {
                        item.is_alt_text_decorative = 1;
                        item.alt_text = '';
                    } else if (item.is_alt_text_decorative === false) {
                        item.is_alt_text_decorative = 0;
                        item.alt_text = altText;

                        if (altText.length === 0) {
                            showError('Please enter "alt text" for this item');
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
            const messageEl = document.querySelector('#message');
            if (messageEl) {
                messageEl.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            }
            return false; // Return false on error for consistency
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
            navModule.back_to_items();
            navModule.set_preview_link();

            document.querySelector('#item-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-background-color')) {
                    document.querySelector('#item-background-color').value = document.querySelector('#item-background-color-picker').value;
                }
            });

            document.querySelector('#item-background-color').addEventListener('input', () => {
                document.querySelector('#item-background-color-picker').value = document.querySelector('#item-background-color').value;
            });

            document.querySelector('#item-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-font-color')) {
                    document.querySelector('#item-font-color').value = document.querySelector('#item-font-color-picker').value;
                }
            });

            document.querySelector('#item-font-color').addEventListener('input', () => {
                document.querySelector('#item-font-color-picker').value = document.querySelector('#item-font-color').value;
            });

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
