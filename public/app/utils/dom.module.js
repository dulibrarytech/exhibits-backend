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

const domModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Injects data into DOM via id or class
     * @param selector
     * @param data
     * @returns {boolean}
     */
    obj.html = function(selector, data) {

        let result = true;

        if (selector.indexOf('#') !== -1) {

            let id = document.querySelector(selector);

            if (id) {
                id.innerHTML = data;
            }

        } else if (selector.indexOf('.') !== -1) {

            let classArr = document.querySelectorAll(selector);

            if (classArr.length > 1) {
                for (let i=0;i<classArr.length;i++) {
                    classArr[i].innerHTML = data;
                }

            } else if (classArr.length === 1) {
                document.querySelector(selector).innerHTML = data;
            } else {
                // Class not found
                result = false;
            }

        } else {
            // A proper selector (id or class) has not been defined
            result = false;
        }

        return result;
    };

    /**
     * Straight-through value setter: it does not sanitize or trim — use
     * when the caller has already validated/shaped the value
     * (e.g. internal state being restored). Safe no-op on missing target.
     * @param {string|Element} target
     * @param value
     */
    obj.set_value = function(target, value) {
        const el = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!el) return;
        el.value = value;
    };

    /**
     * Safe value getter. Returns fallback when target is missing or has no
     * value property.
     * @param {string|Element} target
     * @param {*} [fallback='']
     * @returns {*}
     */
    obj.get_value = function(target, fallback = '') {
        const el = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!el || typeof el.value === 'undefined') return fallback;
        return el.value;
    };

    /**
     * Safe addEventListener. No-op when target is missing.
     * @param {string|Element} target
     * @param {string} event
     * @param {Function} handler
     * @param {boolean|Object} [options]
     */
    obj.on = function(target, event, handler, options) {
        const el = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!el) return;
        el.addEventListener(event, handler, options);
    };

    /**
     * Safe text setter. Writes via textContent (not innerHTML) so the value
     * is never parsed as HTML. No-op when target is missing.
     * @param {string|Element} target
     * @param {string} text
     */
    obj.set_text = function(target, text) {
        const el = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!el) return;
        el.textContent = text == null ? '' : String(text);
    };

    /**
     * Empties contents of element. Safe no-op when the target is missing —
     * callers run this inside their own error handlers, so it must never
     * throw. Accepts selector string or element.
     * @param {string|Element} target
     */
    obj.empty = function(target) {

        const elem = (typeof target === 'string') ? document.querySelector(target) : target;

        if (!elem) {
            return;
        }

        while (elem.firstChild) {
            elem.removeChild(elem.firstChild);
        }
    };

    /**
     * Renders a Bootstrap alert into a container using safe DOM construction.
     * Accepts either a CSS selector string or a direct element reference as the
     * first argument so callers that already hold a reference avoid a second
     * querySelector call.
     *
     * Accessibility (WCAG 4.1.3 Status Messages):
     * The inserted alert element carries the live-region semantics so it is
     * announced regardless of how the surrounding container is wired in
     * markup. Severity is mapped to politeness:
     *   danger / warning -> aria-live="assertive" (interrupts SR speech)
     *   success / info   -> aria-live="polite"    (queued behind current speech)
     * aria-atomic="true" ensures the entire alert is read on each insertion
     * even when the same container is reused with a new message.
     *
     * @param {string|Element} target  - CSS selector or DOM element
     * @param {string}         type    - Bootstrap context: 'danger'|'warning'|'success'|'info'
     * @param {string}         message - Plain-text message (never inserted as HTML)
     */
    obj.set_alert = function(target, type, message) {
        const el = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!el) return;

        const icon_map = {
            danger:  'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            success: 'fa-check',
            info:    'fa-info-circle'
        };

        const live_map = {
            danger:  'assertive',
            warning: 'assertive',
            success: 'polite',
            info:    'polite'
        };

        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-' + (type || 'danger');
        alert_div.setAttribute('role', 'alert');
        alert_div.setAttribute('aria-live', live_map[type] || 'assertive');
        alert_div.setAttribute('aria-atomic', 'true');

        const icon = document.createElement('i');
        icon.className = 'fa ' + (icon_map[type] || 'fa-exclamation-circle');
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);
        alert_div.appendChild(document.createTextNode(' ' + (message || '')));

        el.appendChild(alert_div);
    };

    /**
     * Marks a form field as invalid and associates a programmatic error
     * message with it. Idempotent: calling it twice with the same field +
     * message_id replaces the existing message in place.
     *
     * Accessibility (WCAG 3.3.1 Error Identification, 3.3.3 Error Suggestion,
     * 4.1.2 Name, Role, Value):
     *   - Sets aria-invalid="true" on the field so screen readers announce
     *     the invalid state when focus enters the input.
     *   - Inserts (or updates) a sibling <div role="alert"> with the message
     *     and the supplied id. The id is appended to the field's
     *     aria-describedby so the message is announced after the label.
     *   - Existing aria-describedby tokens are preserved (Bootstrap form-text
     *     hints, etc.); duplicates are deduplicated.
     *
     * Forms call this from their validation pipelines; the page-level
     * set_alert summary call remains for cross-field / submission errors.
     *
     * @param {string|Element} target     - field selector or element
     * @param {string}         message_id - unique DOM id for the message node
     * @param {string}         message    - plain-text error message
     */
    obj.set_field_error = function(target, message_id, message) {
        const field = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!field || !message_id) return;

        field.setAttribute('aria-invalid', 'true');

        // Insert or update the message node. Place it as the next sibling
        // of the field so it stays inside the same .form-group when one
        // exists; callers needing a different anchor can pre-create the
        // node with the message_id and we'll just update its text.
        let msg = document.getElementById(message_id);
        if (!msg) {
            msg = document.createElement('div');
            msg.id = message_id;
            msg.className = 'invalid-feedback d-block';
            msg.setAttribute('role', 'alert');
            if (field.parentNode) {
                if (field.nextSibling) {
                    field.parentNode.insertBefore(msg, field.nextSibling);
                } else {
                    field.parentNode.appendChild(msg);
                }
            }
        }
        msg.textContent = message == null ? '' : String(message);

        // Append message_id to aria-describedby without clobbering existing
        // tokens (e.g. Bootstrap form-text hint ids).
        const existing = (field.getAttribute('aria-describedby') || '')
            .split(/\s+/).filter(Boolean);
        if (existing.indexOf(message_id) === -1) {
            existing.push(message_id);
        }
        field.setAttribute('aria-describedby', existing.join(' '));
    };

    /**
     * Clears the invalid state and message previously set by set_field_error.
     * Safe to call when no error is currently set. Removes the message_id
     * token from aria-describedby (preserving any other tokens) and removes
     * the message node from the DOM.
     *
     * @param {string|Element} target     - field selector or element
     * @param {string}         message_id - id used in the matching set_field_error call
     */
    obj.clear_field_error = function(target, message_id) {
        const field = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!field) return;

        field.removeAttribute('aria-invalid');

        if (message_id) {
            const tokens = (field.getAttribute('aria-describedby') || '')
                .split(/\s+/).filter(function (t) { return t && t !== message_id; });
            if (tokens.length) {
                field.setAttribute('aria-describedby', tokens.join(' '));
            } else {
                field.removeAttribute('aria-describedby');
            }

            const msg = document.getElementById(message_id);
            if (msg && msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        }
    };

    /**
     * Writes a danger alert (with aria-live/aria-atomic, via set_alert) into
     * the message container and, when a field is named, marks it invalid with
     * a linked error message via set_field_error.
     *
     * The error node id is derived as '#item-text-input' →
     * 'item-text-input-error'; matching clear_field_error calls must derive it
     * the same way. For a non-id selector or an Element the field's own id is
     * used; with no usable id the field step is skipped.
     * Does not move focus.
     *
     * @param {string}          message
     * @param {string|Element}  [field_selector]   - field to mark invalid
     * @param {string|Element}  [container_selector='#message']
     * @returns {string|null} the error node id that was set, or null when no
     *          field was marked
     */
    obj.show_field_error = function(message, field_selector, container_selector = '#message') {
        const text = message == null ? '' : String(message);
        const container = (typeof container_selector === 'string')
            ? document.querySelector(container_selector)
            : container_selector;

        if (container) {
            obj.set_alert(container, 'danger', text);
        }

        if (!field_selector) return null;

        const field = (typeof field_selector === 'string')
            ? document.querySelector(field_selector)
            : field_selector;

        if (!field) return null;

        let base_id = '';
        if (typeof field_selector === 'string' && field_selector.charAt(0) === '#') {
            base_id = field_selector.slice(1);
        } else {
            base_id = field.id || '';
        }

        if (!base_id) return null;

        const error_id = base_id + '-error';
        obj.set_field_error(field, error_id, text);
        return error_id;
    };

    /**
     * Renders a spinner / loading indicator into a container using safe DOM
     * construction (no innerHTML). Used for in-progress status messages.
     *
     * Accessibility (WCAG 4.1.3 Status Messages):
     * Same approach as set_alert — the live-region semantics ride on the
     * inserted element rather than the container, because most of the
     * containers these are injected into (the generic #message divs) are not
     * declared as live regions in markup, so an injected child with no role
     * is never announced. Progress is always 'polite': a loading notice must
     * not interrupt whatever the screen reader is currently reading. The
     * spinner glyph stays aria-hidden so only the message text is spoken.
     *
     * @param {string|Element} target  - CSS selector or DOM element
     * @param {string}         message - Plain-text loading message
     */
    obj.set_loading = function(target, message) {
        const el = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!el) return;

        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }

        const status = document.createElement('span');
        status.className = 'loading-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');

        const icon = document.createElement('i');
        icon.className = 'fa fa-spinner fa-spin';
        icon.setAttribute('aria-hidden', 'true');
        status.appendChild(icon);
        status.appendChild(document.createTextNode(' ' + (message || '')));

        el.appendChild(status);
    };

    return obj;

}());