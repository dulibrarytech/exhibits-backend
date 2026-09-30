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

const itemsCommonContentBlockFormModule = (function () {

    'use strict';


    let obj = {};
    let styles_promise = null;

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
        'accent1': 'Accent Style 1',
        'accent2': 'Accent Style 2',
        'accent3': 'Accent Style 3'
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

            // Extract accent-relevant keys that have at least one non-empty value
            exhibit_style_map = {};

            for (const [key, value] of Object.entries(style_root)) {

                if (!key.startsWith('accent')) continue;
                if (!has_style_values(value)) continue;

                exhibit_style_map[key] = value;
            }

            if (Object.keys(exhibit_style_map).length === 0) {
                exhibit_style_map = null;
                console.warn('[styles] No accent style presets found in exhibit styles');
                return;
            }

            // Render the style presets as a radio swatch chooser.
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

    obj.get_common_content_block_item_form_fields = function () {

        try {

            const item_content_block = {};

            // Helper function for safe DOM queries
            const get_element_value = (selector, default_value = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? default_value;
            };

            const get_checkbox_value = (selector) => {
                const element = document.querySelector(selector);
                return element?.checked ?? false;
            };

            const show_error = (message, field_selector) => {

                const message_el = document.querySelector('#message');

                if (message_el) {
                    domModule.set_alert(message_el, 'danger', message);
                }

                if (field_selector) {
                    const error_id = field_selector.replace('#', '') + '-error';
                    domModule.set_field_error(field_selector, error_id, message);
                }
            };

            [
                '#button-text-input',
                '#button-size',
                '#button-url-input',
                '#button-transparent',
                '#card-title-input',
                '#card-text-input',
                '#divider-size',
                '#emphasis-text-input',
                '#quote-text-input',
                '#quote-attribution-input',
            ].forEach(s => {
                domModule.clear_field_error(s, s.replace('#', '') + '-error');
            });

            item_content_block.content_type = get_element_value('#content-type');

            // Set content block data
            if (item_content_block.content_type === 'button') {
                item_content_block.text = rteModule.get_html('button-text-input');
                item_content_block.size = get_element_value('#button-size');
                item_content_block.url = get_element_value('#button-url-input');
                item_content_block.transparent = get_checkbox_value('#button-transparent');

                // Validate
                ['url', 'text'].forEach(val => {
                    if (!item_content_block[val] || item_content_block[val].length === 0) {
                        show_error(`Please enter button ${val}`, `#button-${val}-input`);
                        return false;
                    }
                })

                if (!item_content_block.size || item_content_block.size.length === 0) {
                    show_error('Please select button size', '#button-size');
                    return false;
                }
            } else if (item_content_block.content_type === 'card') {
                item_content_block.title = rteModule.get_html('card-title-input');
                item_content_block.text = rteModule.get_html('card-text-input');

                // Validate
                ['title', 'text'].forEach(val => {
                    if (!item_content_block[val] || item_content_block[val].length === 0) {
                        show_error(`Please enter card ${val}`, `#card-${val}-input`);
                        return false;
                    }
                })
            } else if (item_content_block.content_type === 'divider') {
                item_content_block.size = get_element_value('#divider-size');

                if (!item_content_block.size || item_content_block.size.length === 0) {
                    show_error('Please select divider size', '#divider-size');
                    return false;
                }
            } else if (item_content_block.content_type === 'emphasis') {
                item_content_block.text = rteModule.get_html('emphasis-text-input');

                if (!item_content_block.text || item_content_block.text.length === 0) {
                    show_error('Please enter emphasis text', '#emphasis-text-input');
                    return false;
                }
            } else if (item_content_block.content_type === 'quote') {
                item_content_block.text = rteModule.get_html('quote-text-input');
                item_content_block.attribution = get_element_value('#quote-attribution-input');

                // Validate
                ['attribution', 'text'].forEach(val => {
                    if (!item_content_block[val] || item_content_block[val].length === 0) {
                        show_error(`Please enter quote ${val}`, `#quote-${val}-input`);
                        return false;
                    }
                })
            }

            // Get optional published status
            const published_el = document.querySelector('#is-published');

            if (published_el) {
                item_content_block.is_published = published_el.value;
            }

            // Collect the selected style preset (radio "swatch chooser"); None → null.
            item_content_block.styles = helperModule.get_checked_radio_button(document.getElementsByName('styles'));

            return item_content_block;

        } catch (error) {
            console.error('Error in get_common_content_block_item_form_fields:', error.message);
            const message_el = document.querySelector('#message');
            if (message_el) {
                domModule.set_alert(message_el, 'danger', error.message);
            }
            return false;
        }
    };

    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();

            helperModule.show_form();

            // Fetch and populate styles dropdown
            styles_promise = fetch_and_populate_styles();

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());
