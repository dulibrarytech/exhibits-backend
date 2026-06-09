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

            // Get timeline metadata
            timeline.text = get_element_value('#timeline-text-input');

            // Collect the selected style preset (radio "swatch chooser"); None → null.
            timeline.styles = helperModule.get_checked_radio_button(document.getElementsByName('styles'));

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

            // Render the style presets as a radio "swatch chooser" — each option
            // shows the preset's background + font colors as circles (mirrors the
            // exhibit Styles form). Reuses helperModule + the .color-swatch visual.
            const sorted_keys = Object.keys(exhibit_style_map).sort();
            helperModule.build_item_style_swatch_options('#item-style-options', sorted_keys, exhibit_style_map, STYLE_KEY_LABELS);

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

            // Nav links wired by navModule.wire_nav_links() from the view
            // using data-nav-path + NAV_CONFIGS.timeline_{add,edit}_form / _details.
            navModule.init();

            domModule.on('#timeline-background-color-picker', 'input', () => {
                domModule.set_value('#timeline-background-color', domModule.get_value('#timeline-background-color-picker'));
            });

            domModule.on('#timeline-font-color-picker', 'input', () => {
                domModule.set_value('#timeline-font-color', domModule.get_value('#timeline-font-color-picker'));
            });

            helperModule.show_form();

            // Fetch and populate styles dropdown
            styles_promise = fetch_and_populate_styles();

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
