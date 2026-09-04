/**

 Copyright 2023 University of Denver

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

const helperModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Gets url parameter
     * @param name
     * @param url
     */
    obj.get_parameter_by_name = function (name, url) {

        try {

            if (!name || typeof name !== 'string') {
                console.warn('Invalid or missing parameter name');
                return null;
            }

            // Use provided URL or default to current location
            const target_url = url && typeof url === 'string' ? url : window.location.href;

            if (!target_url || typeof target_url !== 'string') {
                console.warn('Invalid URL provided');
                return null;
            }

            // Use URLSearchParams for modern, reliable parsing
            try {
                const url_obj = new URL(target_url);
                const search_params = new URLSearchParams(url_obj.search);

                const param_value = search_params.get(name);

                // Return null if parameter doesn't exist
                if (param_value === null) {
                    return null;
                }

                // Return empty string if parameter exists but has no value
                if (param_value === '') {
                    return '';
                }

                // Validate parameter value is a string
                if (typeof param_value !== 'string') {
                    console.warn(`Parameter value is not a string: ${name}`);
                    return null;
                }

                // Sanitize to prevent XSS attacks
                const sanitized_value = DOMPurify.sanitize(param_value, {ALLOWED_TAGS: []});

                // Validate sanitization didn't remove content (indicates malicious input)
                if (sanitized_value !== param_value) {
                    console.warn(`Parameter contained potentially malicious content: ${name}`);
                    return null;
                }

                return sanitized_value;

            } catch (url_error) {
                // Fallback to regex parsing for edge cases or invalid URLs
                console.debug('URLSearchParams failed, using regex fallback:', url_error.message);
                return parse_parameter_regex(name, target_url);
            }

        } catch (error) {
            console.error('Error in get_parameter_by_name:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
            return null;
        }
    };

    // Fallback regex-based parameter parsing
    function parse_parameter_regex(name, url) {

        try {

            if (!name || typeof name !== 'string' || !url || typeof url !== 'string') {
                return null;
            }

            // Escape special regex characters in parameter name
            const escaped_name = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Create regex pattern for parameter matching
            const param_pattern = new RegExp(`[?&]${escaped_name}(=([^&#]*)|&|#|$)`, 'i');
            const matches = param_pattern.exec(url);

            // Return null if parameter not found
            if (!matches) {
                return null;
            }

            // Return empty string if parameter has no value
            if (!matches[2]) {
                return '';
            }

            // Decode and sanitize parameter value
            const decoded_value = decodeURIComponent(matches[2].replace(/\+/g, ' '));

            // Validate decoded value is a string
            if (typeof decoded_value !== 'string') {
                console.warn(`Decoded parameter value is not a string: ${name}`);
                return null;
            }

            // Sanitize to prevent XSS attacks
            const sanitized_value = DOMPurify.sanitize(decoded_value, {ALLOWED_TAGS: []});

            // Validate sanitization didn't remove content
            if (sanitized_value !== decoded_value) {
                console.warn(`Parameter contained potentially malicious content: ${name}`);
                return null;
            }

            return sanitized_value;

        } catch (error) {
            console.error('Error in parse_parameter_regex:', error.message);
            return null;
        }
    }

    // Helper function for consistent error messaging
    function show_error_message(message) {
        try {
            const message_el = document.querySelector('#message');
            if (message_el) {
                domModule.set_alert(message_el, 'danger', message);
            }
        } catch (error) {
            console.error('Error displaying message:', error.message);
        }
    }

    obj.unescape = function (data) { // _safe

        try {
            // Validate input parameter
            if (data === null || data === undefined) {
                return '';
            }

            // Convert to string if necessary
            if (typeof data !== 'string') {
                console.warn(`Data is not a string, converting from ${typeof data}`);
                data = String(data);
            }

            // Return empty string for empty input
            if (data === '' || data.trim() === '') {
                return '';
            }

            // HTML entity map for common entities
            const entity_map = {
                '&amp;': '&',
                '&lt;': '<',
                '&gt;': '>',
                '&quot;': '"',
                '&#39;': "'",
                '&#x27;': "'",
                '&#x2F;': '/',
                '&apos;': "'"
            };

            // Replace HTML entities using the map
            let unescaped_value = data;
            for (const [entity, character] of Object.entries(entity_map)) {
                unescaped_value = unescaped_value.split(entity).join(character);
            }

            // Handle numeric character references (&#123; or &#xABC;)
            unescaped_value = unescaped_value.replace(/&#(\d+);/g, (match, dec) => {

                const code = parseInt(dec, 10);

                // Validate character code is in valid range
                if (code > 0 && code <= 0x10FFFF) {
                    return String.fromCharCode(code);
                }
                return match;
            });

            // Handle hex character references (&#xABC; or &#XABC;)
            unescaped_value = unescaped_value.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {

                const code = parseInt(hex, 16);

                // Validate character code is in valid range
                if (code > 0 && code <= 0x10FFFF) {
                    return String.fromCharCode(code);
                }
                return match;
            });

            // Validate result is a string
            if (typeof unescaped_value !== 'string') {
                console.warn('Unescaped value is not a string');
                return '';
            }

            return unescaped_value;

        } catch (error) {
            console.error('Error in unescape_safe:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
            return '';
        }
    };

    obj.strip_html = function (html) {

        try {

            if (html === null || html === undefined) {
                return '';
            }

            // Convert to string if necessary
            if (typeof html !== 'string') {
                console.warn(`Input is not a string, converting from ${typeof html}`);
                html = String(html);
            }

            // Return empty string for empty input
            if (html === '' || html.trim() === '') {
                return '';
            }

            try {
                const parser = new DOMParser();
                const dom = parser.parseFromString(html, 'text/html');
                const text_content = dom.body.textContent || '';

                return text_content;

            } catch (parser_error) {
                console.debug('DOMParser failed, using regex fallback:', parser_error.message);
                return strip_html_regex(html);
            }

        } catch (error) {
            console.error('Error in strip_html:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
            return '';
        }
    };

    // Fallback regex-based HTML stripping (less secure but works everywhere)
    function strip_html_regex(html) {

        try {
            // Validate input
            if (!html || typeof html !== 'string') {
                return '';
            }

            let stripped = html.replace(/<[^>]*>/g, '');

            // Remove multiple consecutive spaces
            stripped = stripped.replace(/\s+/g, ' ');

            // Trim leading and trailing whitespace
            stripped = stripped.trim();

            // Decode common HTML entities
            const entity_map = {
                '&amp;': '&',
                '&lt;': '<',
                '&gt;': '>',
                '&quot;': '"',
                '&#39;': "'",
                '&#x27;': "'",
                '&#x2F;': '/'
            };

            for (const [entity, character] of Object.entries(entity_map)) {
                stripped = stripped.split(entity).join(character);
            }

            // Handle numeric character references
            stripped = stripped.replace(/&#(\d+);/g, (match, dec) => {
                const code = parseInt(dec, 10);

                if (code > 0 && code <= 0x10FFFF) {
                    return String.fromCharCode(code);
                }
                return match;
            });

            // Handle hex character references
            stripped = stripped.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {

                const code = parseInt(hex, 16);

                if (code > 0 && code <= 0x10FFFF) {
                    return String.fromCharCode(code);
                }
                return match;
            });

            // Validate result is a string
            if (typeof stripped !== 'string') {
                console.warn('Stripped value is not a string');
                return '';
            }

            return stripped;

        } catch (error) {
            console.error('Error in strip_html_regex:', error.message);
            return '';
        }
    }

    obj.get_checked_radio_button = function (radio_buttons) {

        try {

            if (!radio_buttons) {
                console.warn('Missing radio_buttons parameter');
                return null;
            }

            // Validate input is array-like (NodeList or Array)
            if (!radio_buttons.length) {
                console.warn('radio_buttons is not array-like or is empty');
                return null;
            }

            // Ensure radio_buttons is iterable
            if (typeof radio_buttons[Symbol.iterator] !== 'function' && typeof radio_buttons.length !== 'number') {
                console.warn('radio_buttons is not iterable');
                return null;
            }

            const buttons_array = Array.from(radio_buttons);

            const checked_button = buttons_array.find(button => {
                // Validate button is an object with checked property
                if (!button || typeof button !== 'object' || !('checked' in button)) {
                    console.warn('Invalid radio button element in collection');
                    return false;
                }

                return button.checked === true;
            });

            // Return value of checked button or null if none found
            if (!checked_button) {
                console.debug('No radio button is currently checked');
                return null;
            }

            // Validate checked button has value property
            if (!('value' in checked_button)) {
                console.warn('Checked radio button does not have value property');
                return null;
            }

            // Validate value is a string
            const button_value = String(checked_button.value);

            if (button_value === '' || button_value === 'undefined') {
                console.warn('Checked radio button has empty or undefined value');
                return null;
            }

            return button_value;

        } catch (error) {
            console.error('Error in get_checked_radio_button:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
            return null;
        }
    };

    /**
     * Gets current year
     */
    obj.get_current_year = function () {

        try {
            const cdate = new Date().getFullYear();
            domModule.html('#cdate', DOMPurify.sanitize(cdate));
        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    /**
     * Formats date
     * @param date
     */
    obj.format_date = function formatDate(date) {
        const month = (1 + date.getMonth()).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${month}/${day}/${year} @ ${hours}:${minutes}:${seconds}`;
    };

    /**
     * Show form cards by making them visible
     *
     * @param {number} delay - Delay in milliseconds before showing (default: 0)
     * @param {string} selector - CSS selector for cards (default: '.card')
     * @param {boolean} use_animation - Whether to use fade-in animation (default: false)
     * @returns {boolean} True if successful, false otherwise
     */
    obj.show_form = function (delay = 0, selector = '.card', use_animation = false) {

        try {
            // Validate delay parameter
            const show_delay = validate_delay(delay);

            // Get form cards
            const form_cards = get_form_cards(selector);

            // Check if any cards found
            if (!form_cards || form_cards.length === 0) {
                console.warn(`No elements found with selector: ${selector}`);
                return false;
            }

            // Show cards immediately if no delay
            if (show_delay === 0) {
                show_cards(form_cards, use_animation);
                return true;
            }

            // Show cards after delay
            setTimeout(() => {
                show_cards(form_cards, use_animation);
            }, show_delay);

            return true;

        } catch (error) {
            console.error('Error showing form:', error);

            // Display safe error message
            const message_element = document.querySelector('#message');
            if (message_element) {
                display_error_message(
                    message_element,
                    error.message || 'Unable to show form'
                );
            }

            return false;
        }
    };

    /**
     * Validate delay parameter
     *
     * @param {number} delay - Delay value to validate
     * @returns {number} Valid delay (0 or positive integer)
     */
    function validate_delay(delay) {
        // Convert to number if string
        const delay_number = typeof delay === 'string' ? parseInt(delay, 10) : delay;

        // Validate is number
        if (typeof delay_number !== 'number' || isNaN(delay_number)) {
            console.warn('Invalid delay, using 0');
            return 0;
        }

        // Ensure non-negative
        if (delay_number < 0) {
            console.warn('Negative delay not allowed, using 0');
            return 0;
        }

        // Cap at reasonable maximum (10 seconds)
        if (delay_number > 10000) {
            console.warn('Delay too large, capping at 10 seconds');
            return 10000;
        }

        return Math.floor(delay_number);
    }

    /**
     * Get form cards using selector
     *
     * @param {string} selector - CSS selector
     * @returns {Array<HTMLElement>} Array of elements
     */
    function get_form_cards(selector) {

        try {

            // Validate selector
            if (!selector || typeof selector !== 'string') {
                console.error('Invalid selector');
                return [];
            }

            // Try querySelectorAll (more flexible)
            const elements = document.querySelectorAll(selector);

            if (!elements) {
                return [];
            }

            // Convert NodeList to Array
            return Array.from(elements);

        } catch (error) {
            console.error('Error getting form cards:', error);
            return [];
        }
    }

    /**
     * Show cards by making them visible
     *
     * @param {Array<HTMLElement>} cards - Array of card elements
     * @param {boolean} use_animation - Whether to use fade-in animation
     */
    function show_cards(cards, use_animation = false) {
        if (!cards || cards.length === 0) {
            return;
        }

        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            cards.forEach(card => {
                if (!card || !(card instanceof HTMLElement)) {
                    console.warn('Invalid card element, skipping');
                    return;
                }

                try {
                    if (use_animation) {
                        // Add fade-in animation class
                        show_card_with_animation(card);
                    } else {
                        // Simple visibility change
                        show_card_simple(card);
                    }
                } catch (error) {
                    console.error('Error showing card:', error);
                }
            });
        });
    }

    /**
     * Show card with simple visibility change
     *
     * @param {HTMLElement} card - Card element
     */
    function show_card_simple(card) {
        // Remove hidden class if present
        if (card.classList.contains('hidden')) {
            card.classList.remove('hidden');
        }

        // Set visibility to visible
        card.style.visibility = 'visible';

        // Also ensure display is not none
        if (card.style.display === 'none') {
            card.style.display = '';
        }

        // Set opacity to 1 if it was 0
        if (card.style.opacity === '0') {
            card.style.opacity = '1';
        }
    }

    /**
     * Show card with fade-in animation
     *
     * @param {HTMLElement} card - Card element
     */
    function show_card_with_animation(card) {
        // Set initial state
        card.style.visibility = 'visible';
        card.style.opacity = '0';
        card.style.transition = 'opacity 0.3s ease-in';

        // Remove display none if present
        if (card.style.display === 'none') {
            card.style.display = '';
        }

        // Trigger reflow to ensure transition works
        void card.offsetHeight;

        // Fade in
        requestAnimationFrame(() => {
            card.style.opacity = '1';
        });

        // Remove hidden class if present
        if (card.classList.contains('hidden')) {
            card.classList.remove('hidden');
        }
    }

    /**
     * Hide form cards (opposite of show_form)
     *
     * @param {string} selector - CSS selector for cards (default: '.card')
     * @param {boolean} use_animation - Whether to use fade-out animation (default: false)
     * @returns {boolean} True if successful, false otherwise
     */
    obj.hide_form = function (selector = '.card', use_animation = false) {

        try {

            const form_cards = get_form_cards(selector);

            if (!form_cards || form_cards.length === 0) {
                console.warn(`No elements found with selector: ${selector}`);
                return false;
            }

            hide_cards(form_cards, use_animation);
            return true;

        } catch (error) {
            console.error('Error hiding form:', error);
            return false;
        }
    };

    /**
     * Hide cards
     *
     * @param {Array<HTMLElement>} cards - Array of card elements
     * @param {boolean} use_animation - Whether to use fade-out animation
     */
    function hide_cards(cards, use_animation = false) {
        if (!cards || cards.length === 0) {
            return;
        }

        requestAnimationFrame(() => {
            cards.forEach(card => {
                if (!card || !(card instanceof HTMLElement)) {
                    return;
                }

                try {
                    if (use_animation) {
                        hide_card_with_animation(card);
                    } else {
                        hide_card_simple(card);
                    }
                } catch (error) {
                    console.error('Error hiding card:', error);
                }
            });
        });
    }

    /**
     * Hide card with simple visibility change
     *
     * @param {HTMLElement} card - Card element
     */
    function hide_card_simple(card) {
        card.style.visibility = 'hidden';
    }

    /**
     * Hide card with fade-out animation
     *
     * @param {HTMLElement} card - Card element
     */
    function hide_card_with_animation(card) {
        card.style.transition = 'opacity 0.3s ease-out';
        card.style.opacity = '0';

        // Set visibility hidden after animation completes
        setTimeout(() => {
            card.style.visibility = 'hidden';
        }, 300);
    }

    /**
     * Toggle form visibility
     *
     * @param {string} selector - CSS selector for cards (default: '.card')
     * @param {boolean} use_animation - Whether to use animation (default: false)
     * @returns {boolean} True if shown, false if hidden
     */
    obj.toggle_form = function (selector = '.card', use_animation = false) {

        try {

            const form_cards = get_form_cards(selector);

            if (!form_cards || form_cards.length === 0) {
                console.warn(`No elements found with selector: ${selector}`);
                return false;
            }

            // Check if first card is visible to determine action
            const first_card = form_cards[0];
            const is_visible = first_card.style.visibility !== 'hidden' &&
                getComputedStyle(first_card).visibility !== 'hidden';

            if (is_visible) {
                hide_cards(form_cards, use_animation);
                return false;
            } else {
                show_cards(form_cards, use_animation);
                return true;
            }

        } catch (error) {
            console.error('Error toggling form:', error);
            return false;
        }
    };

    function display_error_message(element, message) {
        if (!element) {
            return;
        }

        element.textContent = '';

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation';
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);

        const text = document.createTextNode(` ${message}`);
        alert_div.appendChild(text);

        element.appendChild(alert_div);
    }

    obj.get_user_name = function () {

        try {

            if (!authModule || typeof authModule.get_user_profile_data !== 'function') {
                console.error('authModule or get_user_profile_data not available');
                return null;
            }

            // Get user profile data
            const profile = authModule.get_user_profile_data();

            // Validate profile exists and has a name
            if (!profile || typeof profile !== 'object') {
                console.warn('User profile data not available');
                return null;
            }

            // Return name if it exists, otherwise return null
            return profile.name || null;

        } catch (error) {
            console.error('Error getting user name:', error);
            return null;
        }
    };

    obj.get_owner = function () {

        try {

            if (!authModule || typeof authModule.get_user_profile_data !== 'function') {
                console.error('authModule or get_user_profile_data not available');
                return null;
            }

            // Get user profile data
            const profile = authModule.get_user_profile_data();

            // Validate profile exists and has a uid
            if (!profile || typeof profile !== 'object') {
                console.warn('User profile data not available');
                return null;
            }

            if (!profile.uid) {
                console.warn('User UID not available in profile');
                return null;
            }

            // Parse UID to integer with radix
            const owner_id = parseInt(profile.uid, 10);

            // Validate parsed value is a valid number
            if (isNaN(owner_id)) {
                console.error('Invalid UID value:', profile.uid);
                return null;
            }

            return owner_id;

        } catch (error) {
            console.error('Error getting owner ID:', error);
            return null;
        }
    };

    /**
     * Fades a status/message container out and empties it. Shared replacement
     * for the per-form `clear_message_smoothly` / `clear_status_message`
     * copies (FADE_DURATION = 300 in each). After the fade the inline
     * transition is reset to '' (as the copies did) so a following
     * set_alert renders without a lingering transition.
     *
     * Callers should not write a new alert into the same container inside
     * the fade window — the pending clear would wipe it (same race the copies
     * had).
     *
     * @param {string|Element} element  - selector or element (e.g. '#message')
     * @param {Object} [options]
     * @param {number} [options.fade_ms=300] - fade duration; 0 clears at once
     */
    obj.clear_status_message = function (element, options = {}) {

        const el = (typeof element === 'string') ? document.querySelector(element) : element;

        if (!el) {
            return;
        }

        const requested = options && options.fade_ms;
        const fade_ms = (typeof requested === 'number' && Number.isFinite(requested) && requested >= 0)
            ? requested
            : 300;

        const finish = () => {
            el.textContent = '';
            el.style.opacity = '1';
            el.style.transition = '';
        };

        if (fade_ms === 0) {
            finish();
            return;
        }

        el.style.transition = `opacity ${fade_ms}ms ease-out`;
        el.style.opacity = '0';

        setTimeout(finish, fade_ms);
    };

    /**
     * Builds the item "Styles" preset chooser as radio rows with color swatches
     * (background + font colors), mirroring the exhibit Styles form. Appends one
     * row per preset key into the container, which already holds the static "None"
     * row. Idempotent — clears any previously-appended preset rows first.
     * @param {string} container_selector - e.g. '#item-style-options'
     * @param {string[]} sorted_keys - preset keys (e.g. ['item1','item2'])
     * @param {Object} style_map - key → { backgroundColor, color, ... }
     * @param {Object} labels - key → human label (e.g. 'Item Style 1')
     */
    obj.build_item_style_swatch_options = function (container_selector, sorted_keys, style_map, labels) {

        const container = document.querySelector(container_selector);

        if (!container) {
            return;
        }

        container.querySelectorAll('.item-style-option[data-preset]').forEach(function (el) {
            el.remove();
        });

        (sorted_keys || []).forEach(function (key) {

            const style = (style_map && style_map[key]) || {};

            const row = document.createElement('label');
            row.className = 'item-style-option';
            row.setAttribute('data-preset', '1');
            row.setAttribute('for', 'item-style-' + key);

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'styles';
            radio.value = key;
            radio.id = 'item-style-' + key;

            const swatches = document.createElement('span');
            swatches.className = 'item-style-swatches';

            [['backgroundColor', 'Background color'], ['color', 'Font color']].forEach(function (pair) {
                const dot = document.createElement('span');
                dot.className = 'color-swatch';
                dot.title = pair[1];
                const value = style[pair[0]];
                if (value) {
                    dot.style.backgroundColor = value;
                    dot.style.backgroundImage = 'none';
                }
                swatches.appendChild(dot);
            });

            const name = document.createElement('span');
            name.className = 'item-style-name';
            name.textContent = (labels && labels[key]) || key;

            row.appendChild(radio);
            row.appendChild(swatches);
            row.appendChild(name);
            container.appendChild(row);
        });

        // There is no "None" option — default-check the first preset (e.g.
        // "Item Style 1") so the radiogroup always has a selection. Edit forms
        // re-check the saved preset afterwards via check_item_style_option.
        const preset_radios = container.querySelectorAll('input[name="styles"]');

        if (preset_radios.length && !container.querySelector('input[name="styles"]:checked')) {
            preset_radios[0].checked = true;
        }
    };

    /*
     * Style-preset loader shared by the four item/heading common form modules.
     *
     * Each of standard-items / grid-items / timeline-items / heading-items
     * carried a byte-equivalent `fetch_and_populate_styles` +
     * `has_style_values` + `STYLE_KEY_LABELS` block (~130 lines each). The
     * only real differences were the exhibit-styles key prefix ('item' vs
     * 'heading'), the derived human labels, and the console log tag.
     */

    /**
     * True when a style object holds at least one non-empty property.
     * @param {Object} style_obj
     * @returns {boolean}
     */
    function has_style_values(style_obj) {

        if (!style_obj || typeof style_obj !== 'object') {
            return false;
        }

        return Object.values(style_obj).some(function (v) {
            return v !== undefined && v !== null && v !== '';
        });
    }

    /**
     * Derives the human label for a preset key: 'item1' -> 'Item Style 1',
     * 'heading2' -> 'Heading Style 2'. Replaces the hard-coded
     * STYLE_KEY_LABELS maps the four copies each carried.
     * @param {string} key
     * @param {string} prefix
     * @returns {string}
     */
    function build_style_label(key, prefix) {
        const suffix = String(key).slice(prefix.length);
        const heading = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        return `${heading} Style ${suffix}`.trim();
    }

    /**
     * Fetches the parent exhibit record and renders its style presets as the
     * item Styles radio/swatch chooser, then reveals the styles card.
     *
     * Resolves (never rejects) so callers can keep a module-level
     * `styles_promise` and await it before pre-selecting a saved value.
     *
     * @param {Object} [options]
     * @param {string} [options.prefix='item'] - exhibit style key prefix
     *     ('item' for standard/grid/timeline items, 'heading' for headings)
     * @param {string} [options.container_selector='#item-style-options']
     * @param {string} [options.card_selector='#item-styles-card']
     * @param {Object} [options.labels] - explicit key -> label overrides
     * @returns {Promise<Object|null>} the discovered key -> style map, or null
     *     when the exhibit defines no usable presets
     */
    obj.load_style_presets = async function (options = {}) {

        const opts = options || {};
        const prefix = (typeof opts.prefix === 'string' && opts.prefix.length > 0) ? opts.prefix : 'item';
        const container_selector = opts.container_selector || '#item-style-options';
        const card_selector = opts.card_selector || '#item-styles-card';
        const log_tag = prefix === 'item' ? '[styles]' : `[${prefix}-styles]`;

        const exhibit_id = obj.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            console.warn(`${log_tag} No exhibit_id in URL params`);
            return null;
        }

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
        const endpoint_template = EXHIBITS_ENDPOINTS?.exhibits?.exhibit_records?.endpoints?.get?.endpoint;

        if (!endpoint_template) {
            console.warn(`${log_tag} Exhibit GET endpoint not found in endpoints config.`);
            return null;
        }

        const endpoint = endpointsModule.build(endpoint_template, { exhibit_id: exhibit_id });

        try {

            const response = await httpModule.api({
                method: 'GET',
                url: endpoint,
                logout_on_missing_token: false
            });

            if (response === null) {
                console.warn(`${log_tag} No auth token available`);
                return null;
            }

            if (!response || response.status !== 200 || !response.data?.data) {
                console.warn(`${log_tag} Exhibit API response invalid. Status:`, response?.status);
                return null;
            }

            let styles_raw = response.data.data.styles;

            if (!styles_raw) {
                console.warn(`${log_tag} Exhibit record has no styles field`);
                return null;
            }

            if (typeof styles_raw === 'string') {

                try {
                    styles_raw = JSON.parse(styles_raw);
                } catch (parse_error) {
                    console.warn(`${log_tag} Failed to parse exhibit styles JSON:`, parse_error.message);
                    return null;
                }
            }

            /* Navigate into the "exhibit" wrapper when present. */
            const style_root = styles_raw.exhibit || styles_raw;
            const style_map = {};

            for (const [key, value] of Object.entries(style_root)) {

                if (!key.startsWith(prefix)) {
                    continue;
                }

                if (!has_style_values(value)) {
                    continue;
                }

                style_map[key] = value;
            }

            if (Object.keys(style_map).length === 0) {
                console.warn(`${log_tag} No ${prefix} style presets found in exhibit styles`);
                return null;
            }

            const sorted_keys = Object.keys(style_map).sort();
            const labels = {};

            sorted_keys.forEach(function (key) {
                labels[key] = (opts.labels && opts.labels[key]) || build_style_label(key, prefix);
            });

            obj.build_item_style_swatch_options(container_selector, sorted_keys, style_map, labels);

            const card_el = document.querySelector(card_selector);

            if (card_el) {
                card_el.style.display = '';
            }

            return style_map;

        } catch (error) {
            console.error(`${log_tag} Failed to fetch exhibit styles:`, error.message);
            return null;
        }
    };

    /**
     * Renders the "Created by X on DATE | Last updated by Y on DATE" audit
     * line into a container, building DOM nodes rather than interpolating
     * into innerHTML — the fourteen call sites this replaces were split
     * between a safe-DOM variant and an innerHTML variant that dropped
     * `created_by` / `updated_by` into markup unescaped.
     *
     * A half of the line is rendered only when both its actor and its
     * timestamp are present AND the timestamp parses; the innerHTML copies
     * rendered "Invalid Date" for a missing/unparsable value.
     *
     * @param {string|Element} element_or_selector - target container (e.g. '#created')
     * @param {Object} record - record carrying created_by/created/updated_by/updated
     * @returns {boolean} true when the container was found and written
     */
    obj.render_record_meta = function (element_or_selector, record) {

        const el = (typeof element_or_selector === 'string')
            ? document.querySelector(element_or_selector)
            : element_or_selector;

        if (!el) {
            return false;
        }

        const fragments = [];
        const data = record || {};

        const push_part = function (actor, timestamp, template) {

            if (!actor || !timestamp) {
                return;
            }

            const parsed = new Date(timestamp);

            if (isNaN(parsed.getTime())) {
                return;
            }

            if (fragments.length > 0) {
                fragments.push(document.createTextNode(' | '));
            }

            const em = document.createElement('em');
            em.textContent = template(actor, obj.format_date(parsed));
            fragments.push(em);
        };

        push_part(data.created_by, data.created, function (actor, when) {
            return `Created by ${actor} on ${when}`;
        });

        push_part(data.updated_by, data.updated, function (actor, when) {
            return `Last updated by ${actor} on ${when}`;
        });

        el.textContent = '';
        fragments.forEach(function (fragment) {
            el.appendChild(fragment);
        });

        return true;
    };

    /**
     * Checks the item-style radio matching the saved value. Empty/unknown
     * values (legacy records saved before presets were required) fall back to
     * the FIRST preset — the same default the builder applies; there is no
     * "None" option. Replaces the old <select>.value assignment.
     * @param {string|null} value - saved style key (e.g. 'item1') or null
     */
    obj.check_item_style_option = function (value) {

        const radios = document.getElementsByName('styles');

        if (!radios || !radios.length) {
            return;
        }

        const target = value || '';

        if (target) {
            for (let i = 0; i < radios.length; i++) {
                if (radios[i].value === target) {
                    radios[i].checked = true;
                    return;
                }
            }
        }

        // Empty or unknown value — fall back to the first preset.
        radios[0].checked = true;
    };

    /**
     * Removes editing-only field hints from the current page: "(Optional)" label
     * markers. Used on read-only details pages — the shared data-card partials
     * still render these affordances for the add/edit forms, where they belong.
     */
    obj.remove_field_hints = function () {
        try {
            // "(Optional)" markers, rendered as <small><em>(Optional)</em></small>.
            document.querySelectorAll('small').forEach(function (small) {
                if (small.textContent.trim() === '(Optional)') {
                    small.remove();
                }
            });
        } catch (error) {
            console.error('Error in remove_field_hints:', error.message);
        }
    };

    obj.init = function () {
        // On read-only details pages, strip the "(Optional)" markers and "Preview
        // Field" links the shared data-card partials carry for the add/edit forms.
        // Gated by URL so add/edit forms are untouched.
        if (window.location.pathname.indexOf('details') === -1) {
            return;
        }

        const clean_and_watch = function () {
            obj.remove_field_hints();
            // Some item form modules relabel fields *asynchronously* — their init
            // awaits an auth check, then sets innerHTML (e.g. the grid module re-adds
            // "Exhibit Text (Optional)") — which lands after this first pass. Watch for
            // any such additions and strip them too, so details pages stay clean
            // regardless of timing. Only genuine node additions trigger a re-scan, so
            // our own removals never loop.
            try {
                const observer = new MutationObserver(function (mutations) {
                    const has_additions = mutations.some(function (m) {
                        return m.addedNodes.length > 0;
                    });
                    if (has_additions) {
                        obj.remove_field_hints();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (error) {
                console.error('Error wiring field-hint observer:', error.message);
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', clean_and_watch);
        } else {
            clean_and_watch();
        }
    };

    return obj;

}());

helperModule.init();
