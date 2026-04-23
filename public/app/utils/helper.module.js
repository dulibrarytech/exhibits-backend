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

            // Remove HTML tags using comprehensive regex pattern
            // This handles: <tag>, <tag/>, <tag attr="value">, etc.
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

    obj.clean_html = function (html) {

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

            // Use DOMPurify for comprehensive and secure HTML sanitization
            // This is the gold standard for HTML cleaning
            if (typeof DOMPurify !== 'undefined') {
                try {
                    const cleaned = DOMPurify.sanitize(html, {
                        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
                        ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
                        KEEP_CONTENT: true,
                        FORCE_BODY: false
                    });

                    // Validate output is a string
                    if (typeof cleaned !== 'string') {
                        console.warn('DOMPurify output is not a string');
                        return '';
                    }

                    return cleaned;

                } catch (dompur_error) {
                    console.error('DOMPurify sanitization failed:', dompur_error.message);
                    return manual_clean_html(html);
                }
            }

            // Fallback to manual cleaning if DOMPurify not available
            console.debug('DOMPurify not available, using manual HTML cleaning');
            return manual_clean_html(html);

        } catch (error) {
            console.error('Error in clean_html:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
            return '';
        }
    };

    // Manual HTML cleaning fallback (when DOMPurify not available)
    function manual_clean_html(html) {

        try {

            if (!html || typeof html !== 'string') {
                return '';
            }

            // List of dangerous tags to remove
            const dangerous_tags = [
                'script', 'iframe', 'html', 'head', 'body', 'title', 'img', 'embed',
                'applet', 'object', 'style', 'link', 'form', 'input', 'video',
                'source', 'math', 'maction', 'picture', 'map', 'svg', 'details',
                'frameset', 'comment', 'base', 'meta', 'noscript', 'onclick',
                'onerror', 'onload', 'onmouseover', 'frame', 'bgsound', 'marquee'
            ];

            // Create a container element for parsing
            const container = document.createElement('div');

            try {
                container.innerHTML = html;
            } catch (parse_error) {
                console.warn('Failed to parse HTML:', parse_error.message);
                return '';
            }

            // Remove dangerous tags and their content
            for (const tag of dangerous_tags) {
                const elements = container.querySelectorAll(tag);
                for (const element of elements) {
                    element.remove();
                }
            }

            // Remove event handler attributes (XSS prevention)
            const event_handlers = [
                'onclick', 'onerror', 'onload', 'onmouseover', 'onmouseout',
                'onkeydown', 'onkeyup', 'onfocus', 'onblur', 'onchange',
                'onsubmit', 'ondblclick', 'onmouseenter', 'onmouseleave',
                'oncontextmenu', 'onwheel', 'ondrag', 'ondrop'
            ];

            const all_elements = container.querySelectorAll('*');
            for (const element of all_elements) {
                // Remove dangerous attributes
                for (const handler of event_handlers) {
                    element.removeAttribute(handler);
                }

                // Whitelist allowed attributes
                const allowed_attrs = ['href', 'title', 'target', 'rel', 'class', 'id'];
                const attrs_to_remove = [];

                for (const attr of element.attributes) {
                    if (!allowed_attrs.includes(attr.name.toLowerCase())) {
                        attrs_to_remove.push(attr.name);
                    }
                }

                for (const attr of attrs_to_remove) {
                    element.removeAttribute(attr);
                }
            }

            // Get cleaned content
            let cleaned_html = container.innerHTML;

            // Decode HTML entities carefully (only safe entities)
            const entity_map = {
                '&amp;': '&',
                '&lt;': '<',
                '&gt;': '>',
                '&quot;': '"',
                '&#39;': "'"
            };

            for (const [entity, character] of Object.entries(entity_map)) {
                cleaned_html = cleaned_html.split(entity).join(character);
            }

            // Trim excessive whitespace
            cleaned_html = cleaned_html.replace(/\s+/g, ' ').trim();

            // Validate result is a string
            if (typeof cleaned_html !== 'string') {
                console.warn('Cleaned HTML is not a string');
                return '';
            }

            return cleaned_html;

        } catch (error) {
            console.error('Error in manual_clean_html:', error.message);
            return '';
        }
    }

    obj.preview_html = function (id) {

        try {

            if (!helperModule) {
                console.error('helperModule is not available');
                show_error_message('System configuration error.');
                return false;
            }

            // Validate input ID parameter
            if (!id || typeof id !== 'string') {
                console.warn('Invalid or missing element ID parameter');
                show_error_message('Invalid element ID provided.');
                return false;
            }

            // Sanitize element ID to prevent selector injection
            const sanitized_id = id.replace(/[^a-zA-Z0-9_-]/g, '');

            if (sanitized_id !== id) {
                console.warn(`Element ID contained invalid characters: ${id}`);
                show_error_message('Invalid element ID format.');
                return false;
            }

            // Get source element
            const source_element = document.getElementById(sanitized_id);

            if (!source_element) {
                console.warn(`Source element not found: ${sanitized_id}`);
                show_error_message(`Element with ID "${sanitized_id}" not found.`);
                return false;
            }

            // Validate source element has value property (textarea, input, etc.)
            if (typeof source_element.value !== 'string') {
                console.warn(`Source element does not have a string value property: ${sanitized_id}`);
                show_error_message('Source element has invalid value.');
                return false;
            }

            // Get HTML content to clean
            const raw_html = source_element.value;

            // Handle empty HTML content by clearing previous data
            if (!raw_html || raw_html.trim() === '') {
                console.debug('No HTML content to preview, clearing previous data');

                // Clear preview element
                const preview_element = document.getElementById('preview-html');
                if (preview_element) {
                    preview_element.innerHTML = '';
                }

                // Clear source element
                source_element.value = '';

                return false;
            }

            // Clean HTML using helper module
            const cleaned_html = helperModule.clean_html(raw_html);

            // Validate cleaned HTML is valid
            if (!cleaned_html || typeof cleaned_html !== 'string') {
                console.error('HTML cleaning failed or returned invalid result');
                show_error_message('Failed to clean HTML content.');
                return false;
            }

            // Get preview element
            const preview_element = document.getElementById('preview-html');
            if (!preview_element) {
                console.warn('Preview element not found: preview-html');
                show_error_message('Preview element not found in page.');
                return false;
            }

            try {
                preview_element.innerHTML = cleaned_html;
            } catch (preview_error) {
                console.error('Failed to set preview HTML:', preview_error.message);
                show_error_message('Failed to display HTML preview.');
                return false;
            }

            // Update source element with cleaned HTML
            try {
                source_element.value = cleaned_html;
            } catch (update_error) {
                console.error('Failed to update source element:', update_error.message);
                show_error_message('Failed to update HTML content.');
                return false;
            }

            // Log successful preview
            console.debug(`HTML preview successfully generated for element: ${sanitized_id}`);
            return false;

        } catch (error) {
            console.error('Error in preview_html:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
            return false;
        }
    };

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

    obj.clear_status_message = function (element) {

        if (!element) {
            return;
        }

        // Fade out effect
        element.style.transition = 'opacity 0.3s ease-out';
        element.style.opacity = '0';

        setTimeout(() => {
            element.textContent = '';
            element.style.opacity = '1';
        }, 300);

    }

    obj.init = function () {
    };

    return obj;

}());

helperModule.init();
