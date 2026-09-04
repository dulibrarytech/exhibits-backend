/**

 Copyright 2025 University of Denver

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

'use strict';

/*
 * Small pure helpers shared by the media-library controller and services.
 * Kept in a module of its own (not on iiif-service) because the route suite
 * mocks iiif-service wholesale and the controller needs these regardless.
 */

/**
 * Decodes HTML entities in a string
 * Handles common entities that may be injected by XSS sanitization middleware
 * (e.g., &#x2F; → /, &amp; → &, &#x27; → ', &lt; → <, &gt; → >, &quot; → ")
 * @param {string} str - String to decode
 * @returns {string} Decoded string
 */
const decode_html_entities = (str) => {
    if (!str || typeof str !== 'string') {
        return str;
    }
    return str
        .replace(/&#x2F;/gi, '/')
        .replace(/&#x27;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&');
};

module.exports = {
    decode_html_entities
};
