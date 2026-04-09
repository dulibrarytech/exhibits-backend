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

            // Get heading type
            item_heading.type = get_element_value('#item-heading-type-input');

            // Validate required heading type
            if (!item_heading.type || item_heading.type.length === 0) {
                show_error('Please select heading type');
                return false;
            }

            // Get optional published status
            const published_el = document.querySelector('#is-published');

            if (published_el) {
                item_heading.is_published = published_el.value;
            }

            // Collect selected style preset (empty string → null for DB storage)
            const style_val = get_element_value('#item-style-select');
            item_heading.styles = style_val || null;

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

    // ==================== STYLES DROPDOWN ====================

    /**
     * Cache of parsed exhibit style options keyed by style key (e.g. "heading1")
     * @type {Object|null}
     */
    let exhibit_style_map = null;

    /**
     * Human-readable labels for heading style keys
     */
    const STYLE_KEY_LABELS = {
        'heading1': 'Heading Style 1',
        'heading2': 'Heading Style 2',
        'heading3': 'Heading Style 3'
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
     * with any defined heading style presets from tbl_exhibits.styles.
     * Shows the dropdown group only when at least one option is available.
     */
    async function fetch_and_populate_styles() {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            console.warn('[heading-styles] No exhibit_id in URL params');
            return;
        }

        const token = authModule.get_user_token();

        if (!token) {
            console.warn('[heading-styles] No auth token available');
            return;
        }

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.exhibit_records?.endpoints?.get?.endpoint) {
            console.warn('[heading-styles] Exhibit GET endpoint not found in endpoints config.');
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
                console.warn('[heading-styles] Exhibit API response invalid. Status:', response?.status);
                return;
            }

            const exhibit_record = response.data.data;
            let styles_raw = exhibit_record.styles;

            if (!styles_raw) {
                console.warn('[heading-styles] Exhibit record has no styles field');
                return;
            }

            // Parse JSON string if needed
            if (typeof styles_raw === 'string') {

                try {
                    styles_raw = JSON.parse(styles_raw);
                } catch (e) {
                    console.warn('[heading-styles] Failed to parse exhibit styles JSON:', e.message);
                    return;
                }
            }

            // Navigate into the "exhibit" wrapper if present
            const style_root = styles_raw.exhibit || styles_raw;

            // Extract heading-relevant keys that have at least one non-empty value
            exhibit_style_map = {};

            for (const [key, value] of Object.entries(style_root)) {

                if (!key.startsWith('heading')) continue;
                if (!has_style_values(value)) continue;

                exhibit_style_map[key] = value;
            }

            if (Object.keys(exhibit_style_map).length === 0) {
                exhibit_style_map = null;
                console.warn('[heading-styles] No heading style presets found in exhibit styles');
                return;
            }

            // Populate the select element
            const select_el = document.querySelector('#item-style-select');

            if (!select_el) {
                console.warn('[heading-styles] #item-style-select element not found in DOM');
                return;
            }

            // Sort keys for consistent ordering (heading1, heading2, heading3)
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
            console.error('[heading-styles] Failed to fetch exhibit styles:', error.message);
        }
    }

    // ==================== PUBLIC STYLES API ====================

    /**
     * Sets the Styles dropdown to a previously saved value (called by edit module)
     * @param {string|null} styles_value - Saved style key (e.g. "heading1") or null
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
        console.warn('[heading-styles] Saved style key not found in dropdown options:', styles_value);
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
            // Note: #back-to-items href is now wired by navModule.wire_nav_links()
            // via data-nav-path attributes set in the unified nav partial.
            // set_preview_link() is already called inside init().

            helperModule.show_form();

            // Fetch and populate styles dropdown
            styles_promise = fetch_and_populate_styles();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
