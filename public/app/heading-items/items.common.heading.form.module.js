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
    let styles_promise = null;

    /**
     * Gets common heading form fields
     */
    obj.get_common_heading_form_fields = function () {

        try {

            const item_heading = {};

            // Helper function for safe DOM queries
            const get_element_value = (selector, default_value = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? default_value;
            };

            ['#item-heading-text-input', '#item-heading-type-input'].forEach(s => {
                domModule.clear_field_error(s, s.replace('#', '') + '-error');
            });

            // Get heading text (rich text; serialized HTML, '' when empty)
            item_heading.text = rteModule.get_html('item-heading-text-input');

            // Validate required heading text
            if (!item_heading.text || item_heading.text.length === 0) {
                domModule.show_field_error('Please enter heading text', '#item-heading-text-input');
                return false;
            }

            // Get heading type
            item_heading.type = get_element_value('#item-heading-type-input');

            // Validate required heading type
            if (!item_heading.type || item_heading.type.length === 0) {
                domModule.show_field_error('Please select heading type', '#item-heading-type-input');
                return false;
            }

            // Get optional published status
            const published_el = document.querySelector('#is-published');

            if (published_el) {
                item_heading.is_published = published_el.value;
            }

            // Collect the selected style preset (radio "swatch chooser"); None → null.
            item_heading.styles = helperModule.get_checked_radio_button(document.getElementsByName('styles'));
            
            item_heading.margins = get_element_value('#margins');
            item_heading.text_alignment = get_element_value('#text-align');

            return item_heading;

        } catch (error) {
            console.error('Error in get_common_heading_form_fields:', error.message);
            const message_el = document.querySelector('#message');
            if (message_el) {
                domModule.set_alert(message_el, 'danger', error.message);
            }
            return false;
        }
    };

    // ==================== PUBLIC STYLES API ====================

    /**
     * Sets the Styles dropdown to a previously saved value (called by edit module)
     * @param {string|null} styles_value - Saved style key (e.g. "heading1") or null
     */
    obj.set_item_style = function (styles_value) {
        helperModule.check_item_style_option(styles_value);
    };

    /**
     * Returns a promise that resolves when exhibit styles have been fetched
     * and the dropdown populated. Used by edit module to await before pre-selecting.
     * @returns {Promise}
     */
    obj.wait_for_styles = function () {
        return styles_promise || Promise.resolve();
    };

    /**
     * Init function for exhibits common add/edit forms
     */
    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();

            helperModule.show_form();

            // Fetch and populate styles dropdown
            styles_promise = helperModule.load_style_presets({ prefix: 'heading' });

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
