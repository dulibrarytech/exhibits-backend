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

const itemsCommonHeadingFormModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Gets common heading form fields
     */
    obj.get_common_heading_form_fields = function () {

        try {

            const item_heading = { styles: {} };

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

            // Get heading text
            item_heading.text = get_element_value('#item-heading-text-input');

            // Validate required heading text
            if (!item_heading.text || item_heading.text.length === 0) {
                show_error('Please enter heading text');
                return false;
            }

            // Get optional published status
            const published_el = document.querySelector('#is-published');

            if (published_el) {
                item_heading.is_published = published_el.value;
            }

            // Build styles object efficiently
            const style_fields = {
                backgroundColor: '#heading-background-color',
                color: '#heading-font-color',
                fontFamily: '#heading-font',
                fontSize: '#heading-font-size'
            };

            for (const [style_key, selector] of Object.entries(style_fields)) {
                const value = get_element_value(selector);

                // Add 'px' suffix for fontSize if value exists
                if (style_key === 'fontSize' && value) {
                    item_heading.styles[style_key] = `${value}px`;
                } else {
                    // Set value or empty string
                    item_heading.styles[style_key] = value || '';
                }
            }

            return item_heading;

        } catch (error) {
            console.error('Error in get_common_heading_form_fields:', error.message);
            const message_el = document.querySelector('#message');
            if (message_el) {
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            }
            return false;
        }
    };

    /**
     * Init function for exhibits common add/edit forms
     */
    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_items();
            navModule.set_preview_link();

            document.querySelector('#heading-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#heading-background-color')) {
                    document.querySelector('#heading-background-color').value = document.querySelector('#heading-background-color-picker').value;
                }
            });

            document.querySelector('#heading-background-color').addEventListener('input', () => {
                document.querySelector('#heading-background-color-picker').value = document.querySelector('#heading-background-color').value;
            });

            document.querySelector('#heading-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#heading-font-color')) {
                    document.querySelector('#heading-font-color').value = document.querySelector('#heading-font-color-picker').value;
                }
            });

            document.querySelector('#heading-font-color').addEventListener('input', () => {
                document.querySelector('#heading-font-color-picker').value = document.querySelector('#heading-font-color').value;
            });

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
