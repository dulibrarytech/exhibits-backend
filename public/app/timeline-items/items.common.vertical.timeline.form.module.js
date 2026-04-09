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

            const show_error = (message) => {
                const message_el = document.querySelector('#message');
                if (message_el) {
                    message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                }
            };

            // Get timeline metadata
            timeline.text = get_element_value('#timeline-text-input');

            // Validate required title field
            /*
            if (!timeline.title || timeline.title.length === 0) {
                show_error('Please enter a title for the timeline');
                return false;
            }
            */

            // Collect selected style preset (empty string → null for DB storage)
            const style_val = get_element_value('#item-style-select');
            timeline.styles = style_val || null;

            return timeline;

        } catch (error) {
            console.error('Error in get_common_timeline_form_fields:', error.message);
            const message_el = document.querySelector('#message');
            if (message_el) {
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            }
            return false;
        }
    };

    // ==================== STYLES DROPDOWN ====================

    /**
     * Cache of parsed exhibit style options keyed by style key (e.g. "item1")
     * @type {Object|null}
     */
    let exhibit_style_map = null;

    /**
     * Human-readable labels for style keys
     */
    const STYLE_KEY_LABELS = {
        'item1': 'Item Style 1',
        'item2': 'Item Style 2',
        'item3': 'Item Style 3'
    };

    /**
     * Checks whether a style object has at least one non-empty property
     * @param {Object} style_obj - Style properties object
     * @returns {boolean}
     */
    function has_style_values(style_obj) {
        if (!style_obj || typeof style_obj !== 'object') return false;
        return Object.values(style_obj).some(v => v !== undefined && v !== null && v !== '');
    }

    /**
     * Fetches the exhibit record and populates the Styles dropdown
     * with any defined item style presets from tbl_exhibits.styles.
     * Shows the dropdown group only when at least one option is available.
     */
    async function fetch_and_populate_styles() {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            console.warn('[styles] No exhibit_id in URL params');
            return;
        }

        const token = authModule.get_user_token();

        if (!token) {
            console.warn('[styles] No auth token available');
            return;
        }

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.exhibit_records?.endpoints?.get?.endpoint) {
            console.warn('[styles] Exhibit GET endpoint not found in endpoints config. Available keys:',
                EXHIBITS_ENDPOINTS?.exhibits?.exhibit_records
                    ? Object.keys(EXHIBITS_ENDPOINTS.exhibits.exhibit_records)
                    : 'exhibit_records missing');
            return;
        }

        const endpoint = EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.get.endpoint
            .replace(':exhibit_id', encodeURIComponent(exhibit_id));

        try {

            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (!response || response.status !== 200 || !response.data?.data) {
                console.warn('[styles] Exhibit API response invalid. Status:', response?.status, 'Data:', response?.data);
                return;
            }

            const exhibit_record = response.data.data;
            let styles_raw = exhibit_record.styles;

            if (!styles_raw) {
                console.warn('[styles] Exhibit record has no styles field');
                return;
            }

            // Parse JSON string if needed
            if (typeof styles_raw === 'string') {

                try {
                    styles_raw = JSON.parse(styles_raw);
                } catch (e) {
                    console.warn('Failed to parse exhibit styles JSON:', e.message);
                    return;
                }
            }

            // Navigate into the "exhibit" wrapper if present
            const style_root = styles_raw.exhibit || styles_raw;
            console.info('[styles] Exhibit style keys:', Object.keys(style_root),
                'Raw item entries:', JSON.stringify(
                    Object.fromEntries(Object.entries(style_root).filter(([k]) => k.startsWith('item')))
                ));

            // Extract item-relevant keys that have at least one non-empty value
            exhibit_style_map = {};

            for (const [key, value] of Object.entries(style_root)) {

                if (!key.startsWith('item')) continue;
                if (!has_style_values(value)) continue;

                exhibit_style_map[key] = value;
            }

            if (Object.keys(exhibit_style_map).length === 0) {
                exhibit_style_map = null;
                console.warn('[styles] No item style presets found in exhibit styles');
                return;
            }

            // Populate the select element
            const select_el = document.querySelector('#item-style-select');

            if (!select_el) {
                console.warn('[styles] #item-style-select element not found in DOM');
                return;
            }

            // Sort keys for consistent ordering (item1, item2, item3)
            const sorted_keys = Object.keys(exhibit_style_map).sort();

            for (const key of sorted_keys) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = STYLE_KEY_LABELS[key] || key;
                select_el.appendChild(option);
            }

            // Show the styles card
            const card_el = document.querySelector('#item-styles-card');
            if (card_el) card_el.style.display = '';

        } catch (error) {
            console.error('Failed to fetch exhibit styles:', error.message);
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Sets the Styles dropdown to a previously saved value (called by edit module)
     * @param {string|null} styles_value - Saved style key (e.g. "item1") or null
     */
    obj.set_item_style = function (styles_value) {
        const select_el = document.querySelector('#item-style-select');
        if (!select_el || !styles_value) return;

        // If the value matches a known option, select it
        for (const option of select_el.options) {
            if (option.value === styles_value) {
                select_el.value = styles_value;
                return;
            }
        }

        // Value not found among options — might not have loaded yet or was removed
        console.warn('Saved style key not found in dropdown options:', styles_value);
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
            navModule.back_to_items();

            let timeline_background_color_picker =  document.querySelector('#timeline-background-color-picker');

            if (timeline_background_color_picker) {
                document.querySelector('#timeline-background-color-picker').addEventListener('input', () => {
                    if (document.querySelector('#timeline-background-color')) {
                        document.querySelector('#timeline-background-color').value = document.querySelector('#timeline-background-color-picker').value;
                    }
                });
            }

            let timeline_font_color_picker =  document.querySelector('#timeline-font_color-picker');

            if (timeline_font_color_picker) {
                document.querySelector('#timeline-font-color-picker').addEventListener('input', () => {
                    if (document.querySelector('#timeline-font-color')) {
                        document.querySelector('#timeline-font-color').value = document.querySelector('#timeline-font-color-picker').value;
                    }
                });
            }

            helperModule.show_form();

            // Fetch and populate styles dropdown
            styles_promise = fetch_and_populate_styles();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
