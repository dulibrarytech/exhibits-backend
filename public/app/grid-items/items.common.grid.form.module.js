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

const itemsCommonStandardGridFormModule = (function () {

    'use strict';

    let obj = {};
    let styles_promise = null;

    // Column counts offered by the Grid Columns <select>. Keep in sync with
    // views/grid-items/partials/item-grid-data-card.ejs and the server-side
    // check in exhibits/grid_model.js.
    const ALLOWED_COLUMN_VALUES = ['2', '3', '4'];

    obj.get_common_grid_form_fields = function () {

        try {

            const grid = { styles: {} };

            // Helper function for safe DOM queries
            const get_element_value = (selector, default_value = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? default_value;
            };

            // Clear any prior field-level error state.
            domModule.clear_field_error('#grid-columns', 'grid-columns-error');
            domModule.clear_field_error('#grid-internal-name-input', 'grid-internal-name-input-error');

            // Get grid metadata (rich text; serialized HTML, '' when empty)
            grid.text = rteModule.get_html('grid-text-input');

            // Internal name — required; dashboard-only label, never indexed
            // (see indexer_helper construct_grid_index_record).
            const internal_name_value = get_element_value('#grid-internal-name-input');

            if (internal_name_value === '') {
                domModule.show_field_error('Please enter an internal name', '#grid-internal-name-input');
                return false;
            }

            grid.internal_name = internal_name_value;

            const columns_value = get_element_value('#grid-columns');

            // Validate columns against the dropdown's allowed set
            if (!columns_value || columns_value === '') {
                domModule.show_field_error('Please select the number of columns', '#grid-columns');
                return false;
            }

            if (!ALLOWED_COLUMN_VALUES.includes(columns_value)) {
                domModule.show_field_error('Please select 2, 3, or 4 columns', '#grid-columns');
                return false;
            }

            grid.columns = columns_value; // converted to number at server

            // Collect the selected style preset (radio "swatch chooser"); None → null.
            grid.styles = helperModule.get_checked_radio_button(document.getElementsByName('styles'));

            grid.margins = get_element_value('#margins');
            grid.text_alignment = get_element_value('#text-align');

            return grid;

        } catch (error) {
            console.error('Error in get_common_grid_form_fields:', error.message);
            const message_el = document.querySelector('#message');
            if (message_el) {
                domModule.set_alert(message_el, 'danger', error.message);
            }
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
     * Sets the Grid Columns dropdown to a previously saved value (called by
     * edit module). Legacy records saved before the field became a dropdown
     * may hold values outside the allowed set — for those a disabled
     * placeholder option is inserted and selected (the normal form has no
     * empty option) and the field hint explains that a new value must be
     * chosen, so the required-field validation forces a re-selection on save.
     * Records with no saved value keep the form's default selection.
     * @param {number|string|null} columns - Saved column count
     */
    obj.set_grid_columns = function (columns) {

        const select_el = document.querySelector('#grid-columns');

        if (!select_el) {
            return;
        }

        const saved_value = columns === null || columns === undefined ? '' : String(columns);

        if (ALLOWED_COLUMN_VALUES.includes(saved_value)) {
            select_el.value = saved_value;
            return;
        }

        if (saved_value === '') {
            return;
        }

        let placeholder_el = select_el.querySelector('option[value=""]');

        if (!placeholder_el) {
            placeholder_el = document.createElement('option');
            placeholder_el.value = '';
            placeholder_el.disabled = true;
            placeholder_el.textContent = 'Select number of columns';
            select_el.insertBefore(placeholder_el, select_el.firstChild);
        }

        placeholder_el.selected = true;

        const hint_el = document.querySelector('#grid-columns-hint');

        if (hint_el) {
            hint_el.textContent = `This grid was saved with ${saved_value} columns, which is no longer supported. Select 2, 3, or 4 columns before saving.`;
        }
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

            domModule.on('#grid-background-color-picker', 'input', () => {
                domModule.set_value('#grid-background-color', domModule.get_value('#grid-background-color-picker'));
            });

            domModule.on('#grid-background-color', 'input', () => {
                domModule.set_value('#grid-background-color-picker', domModule.get_value('#grid-background-color'));
            });

            domModule.on('#grid-font-color-picker', 'input', () => {
                domModule.set_value('#grid-font-color', domModule.get_value('#grid-font-color-picker'));
            });

            domModule.on('#grid-font-color', 'input', () => {
                domModule.set_value('#grid-font-color-picker', domModule.get_value('#grid-font-color'));
            });

            helperModule.show_form();

            // Fetch and populate styles dropdown
            styles_promise = helperModule.load_style_presets();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
