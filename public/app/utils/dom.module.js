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
     * Gets or sets form field data
     * @param selector
     * @param data
     * @returns {*}
     */
    obj.val = function(selector, data) {

        let result = true;

        if (selector.indexOf('#') !== -1 || selector.indexOf('.') !== -1) {

            let id = document.querySelector(selector);

            if (id && data !== null) {
                id.value = DOMPurify.sanitize(data);
            }

            return id.value.trim();

        } else {
            // A proper selector (id or class) has not been defined
            result = false;
        }

        return result;
    };

    /**
     * Gets form field data
     * @param selector
     * @returns {string}
     */
    obj.serialize = function(selector) {

        let vals = [];
        let form = document.querySelector(selector);

        for (let i = 0; i < form.elements.length; i++) {
            let elems = form.elements[i];
            if (elems.name.length !== 0 && elems.value.length !== 0) {
                vals.push(encodeURIComponent(DOMPurify.sanitize(elems.name)) + "=" + encodeURIComponent(DOMPurify.sanitize(elems.value).trim()));
            }
        }

        return vals.join('&');
    };

    /**
     * Hides element
     * @param selector
     */
    obj.hide = function(selector) {

        let result = true;

        if (selector.indexOf('#') !== -1) {

            let id = document.querySelector(selector);

            if (id) {
                id.style.display = 'none';
            }

        } else if (selector.indexOf('.') !== -1) {

            let classArr = document.querySelectorAll(selector);

            if (classArr.length > 1) {
                for (let i = 0; i < classArr.length; i++) {
                    classArr[i].style.display = 'none';
                }

            } else if (classArr.length === 1) {
                document.querySelector(selector).style.display = 'none';
            } else {
                // Class not found
                result = false;
            }
        }

        return result;
    };

    /**
     * Shows element
     * @param selector
     */
    obj.show = function(selector) {

        let result = true;

        if (selector.indexOf('#') !== -1) {

            let id = document.querySelector(selector);

            if (id) {
                id.style.display = 'block';
            }

        } else if (selector.indexOf('.') !== -1) {

            let classArr = document.querySelectorAll(selector);

            if (classArr.length > 1) {
                for (let i = 0; i < classArr.length; i++) {
                    classArr[i].style.display = 'block';
                }

            } else if (classArr.length === 1) {
                document.querySelector(selector).style.display = 'block';
            } else {
                // Class not found
                result = false;
            }
        }

        return result;
    };

    /**
     * Empties contents of element. Safe no-op when the target is missing
     * — previously threw "Cannot read properties of null" when the
     * selector didn't match, which cascade-crashed callers that ran this
     * inside their own error handlers. Accepts selector string or element.
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
     * Changes element id value
     * @param currentId
     * @param newId
     */
    obj.id = function(currentId, newId) {
        let elem = document.getElementById(currentId);
        elem.id = newId;
    };

    /**
     * Gets element reference by selector
     * @param selector
     * @returns {Element}
     */
    obj.getElement = function(selector) {
        return document.querySelector(selector);
    };

    /**
     * Renders a Bootstrap alert into a container using safe DOM construction.
     * Accepts either a CSS selector string or a direct element reference as the
     * first argument so callers that already hold a reference avoid a second
     * querySelector call.
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

        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-' + (type || 'danger');
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa ' + (icon_map[type] || 'fa-exclamation-circle');
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);
        alert_div.appendChild(document.createTextNode(' ' + (message || '')));

        el.appendChild(alert_div);
    };

    /**
     * Renders a spinner / loading indicator into a container using safe DOM
     * construction (no innerHTML). Used for in-progress status messages.
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

        const icon = document.createElement('i');
        icon.className = 'fa fa-spinner fa-spin';
        icon.setAttribute('aria-hidden', 'true');
        el.appendChild(icon);
        el.appendChild(document.createTextNode(' ' + (message || '')));
    };

    return obj;

}());