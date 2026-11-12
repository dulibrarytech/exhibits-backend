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

const itemsCommonContentBlockGridItemFormModule = (function () {

    'use strict';


    let obj = {};
    let styles_promise = null;
    let message_selector = '#message';
    let style_target = {
        card: '#item-styles-card',
        container: '#item-style-options',
        name: 'styles'
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
            helperModule.build_item_style_swatch_options(style_target.container, sorted_keys, exhibit_style_map, STYLE_KEY_LABELS, style_target.name);

            // Show the styles card
            const card_el = document.querySelector(style_target.card);
            if (card_el) card_el.style.display = '';

        } catch (error) {
            console.error('Failed to fetch exhibit styles:', error.message);
        }
    }

    const CHECKED_FIELDS = [
        '#content-type',
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
    ];

    // ==================== PUBLIC API ====================
    /**
     * Sets the Styles dropdown to a previously saved value (called by edit module)
     * @param {string|null} styles_value - Saved style key (e.g. "item1") or null
     */
    obj.set_item_style = function (styles_value) {
        helperModule.check_item_style_option(styles_value, style_target.name);
    };

    obj.set_message_selector = function (selector) {
        message_selector = selector || '#message';
    };

    obj.load_styles = function (options = {}) {
        style_target = { ...style_target, ...options };
        styles_promise = fetch_and_populate_styles();
        return styles_promise;
    };

    obj.reset = function () {

        const content_type = document.querySelector('#content-type');
        if (content_type) {
            content_type.selectedIndex = 0;
        }

        [
            'button-text-input',
            'card-title-input',
            'card-text-input',
            'emphasis-text-input',
            'quote-text-input'
        ].forEach(id => {
            rteModule.set_html(id, '');
        });

        ['#button-url-input', '#quote-attribution-input'].forEach(selector => {
            const field = document.querySelector(selector);
            if (field) field.value = '';
        });

        const button_size = document.querySelector('#button-size');
        if (button_size) {
            button_size.selectedIndex = 0;
        }

        const transparent = document.querySelector('#button-transparent');
        if (transparent) {
            transparent.checked = false;
        }

        obj.set_item_style('');

        CHECKED_FIELDS.forEach(selector => {
            domModule.clear_field_error(selector, selector.replace('#', '') + '-error');
        });
    };

    /**
     * Returns a promise that resolves when exhibit styles have been fetched
     * and the dropdown populated. Used by edit module to await before pre-selecting.
     * @returns {Promise}
     */
    obj.wait_for_styles = function () {
        return styles_promise || Promise.resolve();
    };

    obj.fill = async function (record) {

        if (!record) {
            return;
        }

        const set_value = (selector, value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.value = value;
            }
        };

        const set_rte_text = (id, text) => {
            rteModule.set_html(id, text ? helperModule.unescape(text) : '');
        };

        set_value('#content-type', record.content_type);
        set_rte_text('button-text-input', record.text);
        set_rte_text('card-text-input', record.text);
        set_rte_text('card-title-input', record.title);
        set_rte_text('emphasis-text-input', record.text);
        set_rte_text('quote-text-input', record.text);
        set_value('#button-size', record.size);

        const transparent = document.querySelector('#button-transparent');
        if (transparent) {
            transparent.checked = Boolean(record.transparent);
        }

        set_value('#button-url-input', record.url);
        set_value('#quote-attribution-input', record.attribution);

        // Set saved style selection after dropdown is populated
        // Style keys are simple strings like "accent1"; skip "{}" (prepare_styles default) and legacy JSON blobs
        if (record.styles && typeof record.styles === 'string'
            && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
            await obj.wait_for_styles();
            obj.set_item_style(record.styles);
        }
    };

    obj.get_common_content_block_item_form_fields = function () {

        try {

            const item_content_block = {};
            const errors = [];

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

                const message_el = document.querySelector(message_selector);

                if (message_el) {
                    domModule.set_alert(message_el, 'danger', message);
                }

                if (field_selector) {
                    const error_id = field_selector.replace('#', '') + '-error';
                    domModule.set_field_error(field_selector, error_id, message);
                }
            };

            const add_error = (message, field_selector) => {
                errors.push({ message, field_selector });
            };

            CHECKED_FIELDS.forEach(s => {
                domModule.clear_field_error(s, s.replace('#', '') + '-error');
            });

            item_content_block.content_type = get_element_value('#content-type');

            if (!item_content_block.content_type || item_content_block.content_type.length === 0) {
                show_error('Please select a content block type', '#content-type');
                return false;
            }

            // Set content block data
            if (item_content_block.content_type === 'button') {
                item_content_block.text = rteModule.get_html('button-text-input');
                item_content_block.size = get_element_value('#button-size');
                item_content_block.url = get_element_value('#button-url-input');
                item_content_block.transparent = get_checkbox_value('#button-transparent');

                // Validate
                for (const val of ['url', 'text']) {
                    if (!item_content_block[val] || item_content_block[val].length === 0) {
                        add_error(`Please enter button ${val}`, `#button-${val}-input`);
                    }
                }

                if (item_content_block.url && !helperModule.is_valid_link_url(item_content_block.url)) {
                    add_error('Please enter a web address, such as https://library.du.edu', '#button-url-input');
                }

                if (!item_content_block.size || item_content_block.size.length === 0) {
                    add_error('Please select button size', '#button-size');
                }
            } else if (item_content_block.content_type === 'card') {
                item_content_block.title = rteModule.get_html('card-title-input');
                item_content_block.text = rteModule.get_html('card-text-input');

                // Validate
                for (const val of ['title', 'text']) {
                    if (!item_content_block[val] || item_content_block[val].length === 0) {
                        add_error(`Please enter card ${val}`, `#card-${val}-input`);
                    }
                }
            } else if (item_content_block.content_type === 'divider') {
                item_content_block.size = get_element_value('#divider-size');

                if (!item_content_block.size || item_content_block.size.length === 0) {
                    add_error('Please select divider size', '#divider-size');
                }
            } else if (item_content_block.content_type === 'emphasis') {
                item_content_block.text = rteModule.get_html('emphasis-text-input');

                if (!item_content_block.text || item_content_block.text.length === 0) {
                    add_error('Please enter emphasis text', '#emphasis-text-input');
                }
            } else if (item_content_block.content_type === 'quote') {
                item_content_block.text = rteModule.get_html('quote-text-input');
                item_content_block.attribution = get_element_value('#quote-attribution-input');

                // Validate
                if (!item_content_block.text || item_content_block.text.length === 0) {
                    add_error(`Please enter quote text`, `#quote-text-input`);
                }
            }

            if (errors.length > 0) {
                show_error(errors[0].message);
                errors.forEach(error => {
                    const error_id = error.field_selector.replace('#', '') + '-error';
                    domModule.set_field_error(error.field_selector, error_id, error.message);
                });
                return false;
            }

            // Get optional published status
            const published_el = document.querySelector('#is-published');

            if (published_el) {
                item_content_block.is_published = published_el.value;
            }

            // Collect the selected style preset (radio "swatch chooser"); None → null.
            item_content_block.styles = helperModule.get_checked_radio_button(document.getElementsByName(style_target.name));

            return item_content_block;

        } catch (error) {
            console.error('Error in get_common_content_block_item_form_fields:', error.message);
            const message_el = document.querySelector(message_selector);
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
