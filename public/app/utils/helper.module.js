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
                const sanitized_value = DOMPurify.sanitize(param_value, { ALLOWED_TAGS: [] });

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
            const sanitized_value = DOMPurify.sanitize(decoded_value, { ALLOWED_TAGS: [] });

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
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
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

            // Use DOMParser for safe, reliable HTML stripping
            // This is more secure and standards-compliant than regex
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

            // Set preview content using textContent first for safety, then innerHTML
            // This two-step approach ensures proper rendering while maintaining security
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

            // Use find() method for cleaner, more efficient search
            // Convert to Array if NodeList to use Array methods
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
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
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
     * Shows hidden forms
     */
    obj.show_form = function () {

        try {

            const form_cards = Array.from(document.getElementsByClassName('card'));

            setTimeout(() => {

                form_cards.forEach(card => {
                    card.style.visibility = 'visible';
                });

            }, 250);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Reorders item list via drag and drop
     * @param e
     * @param reordered_items
     */
    obj.reorder_items = async function (e, reordered_items) {

        try {

            if (reordered_items.length === 0) {
                return false;
            }

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            let reorder_obj = {};
            let updated_order = [];

            for (let i = 0, ien = reordered_items.length; i < ien; i++) {

                let node = reordered_items[i].node;
                let id = node.getAttribute('id');
                let id_arr = id.split('_');

                reorder_obj.type = id_arr.pop();
                reorder_obj.uuid = id_arr.pop();
                reorder_obj.order = reordered_items[i].node.childNodes[0].childNodes[1].innerText;

                if (grid_id !== null) {
                    reorder_obj.grid_id = grid_id;
                }

                updated_order.push(reorder_obj);
                reorder_obj = {};
            }

            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.reorder_records.post.endpoint.replace(':exhibit_id', exhibit_id),
                data: updated_order,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {
                console.log('items reordered');
            } else {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An HTTP request error occurred while reordering items.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Reorders grid item list via drag and drop
     * @param e
     * @param reordered_items
     */
    obj.reorder_grid_items = async function (e, reordered_items) {

        try {

            if (reordered_items.length === 0) {
                return false;
            }

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            let reorder_obj = {};
            let updated_order = [];

            for (let i = 0, ien = reordered_items.length; i < ien; i++) {

                let node = reordered_items[i].node;
                let id = node.getAttribute('id');
                let id_arr = id.split('_');

                reorder_obj.grid_id = grid_id;
                reorder_obj.uuid = id_arr[0];
                reorder_obj.type = 'griditem';
                reorder_obj.order = reordered_items[i].node.childNodes[0].childNodes[1].innerText;

                updated_order.push(reorder_obj);
                reorder_obj = {};
            }

            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.reorder_records.post.endpoint.replace(':exhibit_id', exhibit_id),
                data: updated_order,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {
                console.log('items reordered');
            } else {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> An HTTP request error occurred while reordering items.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.check_if_locked = async function (record, card_id) {

        // Helper function to safely display messages (prevents XSS)
        const show_message = (type, message_content, additional_element = null) => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-lock';

            const text = document.createTextNode(` ${message_content}`);

            alert_div.appendChild(icon);
            alert_div.appendChild(text);

            // Add additional element if provided (like unlock button)
            if (additional_element) {
                alert_div.appendChild(document.createTextNode('  '));
                alert_div.appendChild(additional_element);
            }

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        // Helper function to create unlock button
        const create_unlock_button = () => {

            const btn_group = document.createElement('div');
            btn_group.className = 'btn-group float-right';

            const button = document.createElement('button');
            button.id = 'unlock-record';
            button.className = 'btn btn-xs btn-secondary';

            const icon = document.createElement('i');
            icon.className = 'fa fa-unlock-alt';

            const text = document.createTextNode(' Unlock');

            button.appendChild(icon);
            button.appendChild(text);

            // Add event listener
            button.addEventListener('click', handle_unlock_click);

            btn_group.appendChild(button);

            const span = document.createElement('span');
            const br = document.createElement('br');
            span.appendChild(br);
            span.appendChild(btn_group);

            return span;
        };

        // Event handler for unlock button (separated for better cleanup)
        const handle_unlock_click = () => {
            if (helperModule && typeof helperModule.unlock_record === 'function') {
                helperModule.unlock_record();
            } else {
                console.error('unlock_record function not available');
            }
        };

        // Helper function to hide card
        const hide_card = (selector) => {
            const card = document.querySelector(selector);
            if (card) {
                card.style.display = 'none';
            }
        };

        // Helper function to display error safely
        const show_error = (message) => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = 'alert alert-danger';
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-exclamation';

            const text = document.createTextNode(` ${message}`);

            alert_div.appendChild(icon);
            alert_div.appendChild(text);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        try {
            // Validate inputs
            if (!record || typeof record !== 'object') {
                console.error('Invalid record provided to check_if_locked');
                return;
            }

            if (!card_id || typeof card_id !== 'string') {
                console.error('Invalid card_id provided to check_if_locked');
                return;
            }

            // Get user profile
            const profile = authModule.get_user_profile_data();
            if (!profile || !profile.uid) {
                console.error('Unable to get user profile data');
                return;
            }

            // Parse user ID safely
            const user_id = parseInt(profile.uid, 10);
            if (isNaN(user_id)) {
                console.error('Invalid user ID in profile');
                return;
            }

            // Check if record is locked by another user
            const is_locked = record.is_locked === 1 || record.is_locked === true;
            const locked_by_other_user = record.locked_by_user && parseInt(record.locked_by_user, 10) !== user_id;

            if (is_locked && locked_by_other_user) {
                // Hide the card
                hide_card(card_id);

                // Check if message element exists
                const message_el = document.querySelector('#message');
                if (!message_el) {
                    console.warn('Message element not found, cannot display lock warning');
                    return;
                }

                // Get user role to determine if unlock button should be shown
                const user_role = await authModule.get_user_role(user_id);

                // Create unlock button for administrators
                let unlock_button = null;
                if (user_role === 'Administrator') {
                    unlock_button = create_unlock_button();
                }

                // Display lock message
                const lock_message = 'This record is currently being worked on by another user.';
                show_message('warning', lock_message, unlock_button);
            }

        } catch (error) {
            // Log error for debugging
            console.error('Error checking if record is locked:', error);

            // Display safe error message
            const error_message = error.message || 'An error occurred while checking record lock status';
            show_error(error_message);
        }
    };

    obj.unlock_record = async function () {

        // Constants
        const REQUEST_TIMEOUT = 30000; // 30 seconds

        // Path to endpoint configuration map
        const endpoint_config_map = [
            {
                paths: ['exhibits/exhibit/edit'],
                endpoint_key: 'exhibits.exhibit_unlock_record.post.endpoint',
                params: (exhibit_id) => ({ exhibit_id })
            },
            {
                paths: ['items/heading/edit'],
                endpoint_key: 'exhibits.heading_unlock_record.post.endpoint',
                params: (exhibit_id) => ({
                    exhibit_id,
                    heading_id: helperModule.get_parameter_by_name('item_id')
                })
            },
            {
                paths: ['items/standard/text/edit', 'items/standard/media/edit'],
                endpoint_key: 'exhibits.item_unlock_record.post.endpoint',
                params: (exhibit_id) => ({
                    exhibit_id,
                    item_id: helperModule.get_parameter_by_name('item_id')
                })
            },
            {
                paths: ['items/grid/item/media/edit', 'items/grid/item/text/edit'],
                endpoint_key: 'exhibits.grid_item_unlock_record.post.endpoint',
                params: (exhibit_id) => ({
                    exhibit_id,
                    grid_id: helperModule.get_parameter_by_name('grid_id'),
                    item_id: helperModule.get_parameter_by_name('item_id')
                })
            },
            {
                paths: ['items/vertical-timeline/item/media/edit', 'items/vertical-timeline/item/text/edit'],
                endpoint_key: 'exhibits.timeline_item_unlock_record.post.endpoint',
                params: (exhibit_id) => ({
                    exhibit_id,
                    timeline_id: helperModule.get_parameter_by_name('timeline_id'),
                    item_id: helperModule.get_parameter_by_name('item_id')
                })
            }
        ];

        // Helper function to safely get nested object value by dot notation
        const get_nested_value = (obj, path) => {
            if (!obj || !path) return null;

            const keys = path.split('.');
            let result = obj;

            for (const key of keys) {
                if (result && typeof result === 'object' && key in result) {
                    result = result[key];
                } else {
                    return null;
                }
            }

            return result;
        };

        // Helper function to safely display messages (prevents XSS)
        const show_message = (message, type = 'info', icon = 'fa-info') => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${type}`;
            alert_div.setAttribute('role', 'alert');

            if (icon) {
                const icon_el = document.createElement('i');
                icon_el.className = `fa ${icon}`;
                alert_div.appendChild(icon_el);
                alert_div.appendChild(document.createTextNode(' '));
            }

            const text_node = document.createTextNode(message);
            alert_div.appendChild(text_node);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        // Helper function to build endpoint URL with parameter replacement
        const build_endpoint_url = (template, params) => {
            if (!template || !params) return null;

            let endpoint = template;

            for (const [key, value] of Object.entries(params)) {
                if (!value) {
                    console.error(`Missing required parameter: ${key}`);
                    return null;
                }
                // URL encode the parameter value
                const encoded_value = encodeURIComponent(value);
                endpoint = endpoint.replace(`:${key}`, encoded_value);
            }

            return endpoint;
        };

        // Helper function to find matching endpoint configuration
        const find_endpoint_config = (pathname, config_map) => {
            for (const config of config_map) {
                const path_matches = config.paths.some(path => pathname.includes(path));
                if (path_matches) {
                    return config;
                }
            }
            return null;
        };

        try {
            // Get required data
            const exhibits_endpoints = endpointsModule.get_exhibits_endpoints();
            if (!exhibits_endpoints) {
                throw new Error('Unable to retrieve endpoints configuration');
            }

            const pathname = window.location.pathname;
            if (!pathname) {
                throw new Error('Unable to determine current page path');
            }

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            if (!exhibit_id) {
                throw new Error('Missing required parameter: exhibit_id');
            }

            // Find matching endpoint configuration
            const config = find_endpoint_config(pathname, endpoint_config_map);
            if (!config) {
                console.error('No matching endpoint found for current path:', pathname);
                show_message('Unable to determine record type.', 'danger', 'fa-exclamation');
                return false;
            }

            // Get endpoint template
            const endpoint_template = get_nested_value(exhibits_endpoints, config.endpoint_key);
            if (!endpoint_template) {
                throw new Error('Endpoint template not found in configuration');
            }

            // Get endpoint parameters
            const endpoint_params = typeof config.params === 'function'
                ? config.params(exhibit_id)
                : config.params;

            // Validate all required parameters exist
            for (const [key, value] of Object.entries(endpoint_params)) {
                if (!value) {
                    throw new Error(`Missing required parameter: ${key}`);
                }
            }

            // Build endpoint URL
            const endpoint = build_endpoint_url(endpoint_template, endpoint_params);
            if (!endpoint) {
                throw new Error('Failed to build endpoint URL');
            }

            // Get authentication data
            const profile = authModule.get_user_profile_data();
            const token = authModule.get_user_token();

            if (!profile || !profile.uid) {
                throw new Error('User profile data not available');
            }

            if (!token) {
                throw new Error('Authentication token not available');
            }

            // Build request URL with encoded UID
            const encoded_uid = encodeURIComponent(profile.uid);
            const request_url = `${endpoint}?uid=${encoded_uid}`;

            // prioritize beacon so unlock is more likely to occur
            if (navigator.sendBeacon) {

                // Beacon API only supports POST and sends as text/plain
                // We need to send the auth token in the URL as a query parameter
                const beacon_url = `${endpoint}&t=${encodeURIComponent(token)}`;
                const sent = navigator.sendBeacon(beacon_url, '');

                if (sent) {
                    console.log('Unlock beacon sent successfully');
                } else {
                    console.warn('Beacon API failed to send unlock request');
                }
            }

            // second request will trigger when unlock is clicked by an admin - success message is displayed
            // Make request with timeout
            const response = await Promise.race([
                httpModule.req({
                    method: 'POST',
                    url: request_url,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
                )
            ]);

            // Validate response
            if (!response) {
                throw new Error('No response received from server');
            }

            // Display result
            if (response.status === 200) {
                show_message('Record unlocked successfully', 'success', 'fa-check');
                return true;
            } else {
                show_message('Failed to unlock record. Please try again.', 'danger', 'fa-exclamation');
                return false;
            }

        } catch (error) {
            // Log error for debugging
            console.error('Error unlocking record:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while unlocking the record';
            show_message(error_message, 'danger', 'fa-exclamation');

            return false;
        }
    };

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

    obj.create_subjects_menu = async function (subjects = []) {

        try {

            if (!Array.isArray(subjects)) {
                console.warn('Subjects parameter is not an array, converting');
                subjects = [];
            }

            // Fetch all available subjects
            const all_items = await this.get_item_subjects();

            if (!all_items || !Array.isArray(all_items)) {
                console.error('Failed to retrieve item subjects');
                show_error_message('Failed to load subjects.');
                return;
            }

            // Get DOM elements with validation
            const elements = {
                header: document.getElementById('dropdownHeader'),
                list: document.getElementById('dropdownList'),
                virtual_list: document.getElementById('virtualList'),
                arrow: document.getElementById('arrow'),
                selected_text: document.getElementById('selectedText'),
                result_list: document.getElementById('resultList'),
                search_box: document.getElementById('searchBox'),
                search_input: document.getElementById('searchInput'),
                selected_subjects_input: document.getElementById('selected-subjects')
            };

            // Validate all required elements exist
            for (const [key, element] of Object.entries(elements)) {
                if (!element) {
                    console.error(`Required element not found: ${key}`);
                    show_error_message(`Missing required UI element: ${key}`);
                    return;
                }
            }

            // State management
            const state = {
                selected: new Set(subjects.filter(s => s && s.trim())), // Filter out empty strings
                filtered_items: [...all_items],
                item_map: new Map(),
                is_open: false,
                ITEM_HEIGHT: 48,
                BUFFER: 50
            };

            let search_timeout;

            // Debounced search handler
            elements.search_input.addEventListener('input', (e) => {
                clearTimeout(search_timeout);
                search_timeout = setTimeout(() => {
                    const query = e.target.value.toLowerCase().trim();
                    state.filtered_items = query
                        ? all_items.filter(item => item.toLowerCase().includes(query))
                        : [...all_items];
                    render_virtual_list();
                }, 150);
            });

            // Render virtual list for performance with large datasets
            function render_virtual_list() {
                elements.virtual_list.innerHTML = '';
                state.item_map.clear();

                // Calculate visible range
                const scroll_top = elements.list.scrollTop || 0;
                const start_idx = Math.max(0, Math.floor(scroll_top / state.ITEM_HEIGHT) - state.BUFFER);
                const end_idx = Math.min(
                    state.filtered_items.length,
                    Math.ceil((scroll_top + elements.list.clientHeight) / state.ITEM_HEIGHT) + state.BUFFER
                );

                // Set container height for proper scrollbar
                elements.virtual_list.style.height = `${state.filtered_items.length * state.ITEM_HEIGHT}px`;
                elements.virtual_list.style.position = 'relative';

                // Render only visible items
                for (let i = start_idx; i < end_idx; i++) {
                    const item = state.filtered_items[i];
                    const div = document.createElement('div');
                    div.className = 'dropdown-item';
                    div.style.position = 'absolute';
                    div.style.top = `${i * state.ITEM_HEIGHT}px`;
                    div.style.width = '100%';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = item;
                    checkbox.className = 'form-check-input';
                    checkbox.checked = state.selected.has(item);

                    const label = document.createElement('label');
                    label.className = 'ms-2';
                    label.style.cursor = 'pointer';
                    label.style.marginBottom = '0';
                    label.textContent = item;
                    label.style.paddingLeft = '30px';

                    // Checkbox change handler
                    checkbox.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            state.selected.add(item);
                        } else {
                            state.selected.delete(item);
                        }
                        update_selected();
                    });

                    // Label click handler
                    label.addEventListener('click', (e) => {
                        e.stopPropagation();
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    });

                    div.appendChild(checkbox);
                    div.appendChild(label);
                    elements.virtual_list.appendChild(div);
                    state.item_map.set(item, checkbox);
                }
            }

            // Scroll handler for virtual list
            elements.list.addEventListener('scroll', () => {
                render_virtual_list();
            });

            // Dropdown toggle handler
            elements.header.addEventListener('click', () => {
                state.is_open = !state.is_open;
                elements.list.classList.toggle('show');
                elements.header.classList.toggle('active');
                elements.arrow.classList.toggle('rotate');
                elements.search_box.classList.toggle('show');

                if (state.is_open) {
                    elements.search_input.focus();
                    render_virtual_list();
                } else {
                    elements.search_input.value = '';
                    state.filtered_items = [...all_items];
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown-container')) {
                    state.is_open = false;
                    elements.list.classList.remove('show');
                    elements.header.classList.remove('active');
                    elements.arrow.classList.remove('rotate');
                    elements.search_box.classList.remove('show');
                    elements.search_input.value = '';
                    state.filtered_items = [...all_items];
                }
            });

            // Update selected items display
            function update_selected() {
                // Convert Set to Array and filter out any empty strings
                const selected_array = Array.from(state.selected).filter(item => item && item.trim());

                // Update the Set to match the filtered array (removes any empty strings)
                state.selected = new Set(selected_array);

                const count = selected_array.length;

                if (count === 0) {
                    elements.selected_text.innerHTML = '<span class="placeholder">Select subjects...</span>';
                    elements.result_list.innerHTML = '<li style="color: #999;">None selected</li>';
                    elements.selected_subjects_input.value = '';
                } else {
                    const display = count <= 2
                        ? selected_array.join(', ')
                        : `${selected_array[0]}, ${selected_array[1]}...`;

                    elements.selected_text.innerHTML = `${display} <span class="selected-count">${count}</span>`;

                    elements.result_list.innerHTML = selected_array
                        .sort()
                        .map(item => {
                            // Escape HTML to prevent XSS
                            const escaped_item = document.createElement('div');
                            escaped_item.textContent = item;
                            const safe_item = escaped_item.innerHTML;

                            return `<li>
              <span>${safe_item}</span>
              <button class="uncheck-btn" title="Remove subject" data-item="${safe_item}" style="background: none; border: none; cursor: pointer; color: #999; padding: 0 5px; font-size: 18px; line-height: 1;">×</button>
            </li>`;
                        })
                        .join('');

                    // Add event listeners to remove buttons
                    elements.result_list.querySelectorAll('.uncheck-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const item = btn.dataset.item;

                            // Remove from selected Set
                            state.selected.delete(item);

                            // Uncheck the checkbox in the dropdown if visible
                            const checkbox = state.item_map.get(item);
                            if (checkbox) {
                                checkbox.checked = false;
                            }

                            // Re-render to ensure UI is in sync
                            update_selected();

                            // Also re-render the virtual list if dropdown is open
                            if (state.is_open) {
                                render_virtual_list();
                            }
                        });
                    });

                    // Update hidden input with pipe-separated values
                    elements.selected_subjects_input.value = selected_array.join('|');
                }
            }

            // Initial render with preselected items
            render_virtual_list();
            update_selected();

        } catch (error) {
            console.error('Error in create_subjects_menu:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
        }
    };

    obj.get_item_subjects = async function () {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const token = authModule.get_user_token();
            const response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.item_subjects.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.check_app_env = function () {

        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === 'libwebapw01-vlt.du.edu' || hostname === 'exhibits.dev') {

            const app_message = document.querySelector('#app-message');

            if (app_message !== null) {
                app_message.innerHTML = '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> <strong>"STOP! Do not use Development Site"</strong>&nbsp;&nbsp;&nbsp;<a class="btn btn-info" href="https://exhibits-backend.library.du.edu/exhibits-dashboard/auth" target="_blank">Go to Live Site </a> </div>';
            }
        }
    };

    obj.init = function () {
    };

    return obj;

}());

helperModule.init();

