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

const itemsCommonVerticalTimelineFormModule = (function () {

    'use strict';

    let obj = {};
    let styles_promise = null;

    obj.get_common_timeline_form_fields = function () {

        try {

            const timeline = { styles: {} };

            // Helper function for safe DOM queries
            const get_element_value = (selector, default_value = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? default_value;
            };

            // Clear any prior field-level error state.
            domModule.clear_field_error('#timeline-internal-name-input', 'timeline-internal-name-input-error');

            // Get timeline metadata (rich text; serialized HTML, '' when empty)
            timeline.text = rteModule.get_html('timeline-text-input');

            // Internal name — required; dashboard-only label, never indexed
            // (see indexer_helper construct_timeline_index_record).
            const internal_name_value = get_element_value('#timeline-internal-name-input');

            if (internal_name_value === '') {
                domModule.show_field_error('Please enter an internal name', '#timeline-internal-name-input');
                return false;
            }

            timeline.internal_name = internal_name_value;

            // Collect the selected style preset (radio "swatch chooser"); None → null.
            timeline.styles = helperModule.get_checked_radio_button(document.getElementsByName('styles'));

            timeline.margins = get_element_value('#margins');
            timeline.text_alignment = get_element_value('#text-align');

            return timeline;

        } catch (error) {
            console.error('Error in get_common_timeline_form_fields:', error.message);
            domModule.set_alert('#message', 'danger', error.message);
            return false;
        }
    };

    // ==================== PUBLIC API ====================

    /**
     * Sets the Styles dropdown to a previously saved value (called by edit module)
     * @param {string|null} styles_value - Saved style key (e.g. "item1") or null
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

    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();

            domModule.on('#timeline-background-color-picker', 'input', () => {
                domModule.set_value('#timeline-background-color', domModule.get_value('#timeline-background-color-picker'));
            });

            domModule.on('#timeline-font-color-picker', 'input', () => {
                domModule.set_value('#timeline-font-color', domModule.get_value('#timeline-font-color-picker'));
            });

            helperModule.show_form();

            // Fetch and populate styles dropdown
            styles_promise = helperModule.load_style_presets();

        } catch (error) {
            // domModule.set_alert is a no-op if #message is absent, so a
            // missing target cannot mask the original error with a
            // secondary "Cannot set properties of null" TypeError.
            domModule.set_alert('#message', 'danger', error.message);
            console.error('itemsCommonVerticalTimelineFormModule.init failed:', error);
        }
    };

    return obj;

}());
