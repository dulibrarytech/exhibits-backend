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

'use strict';

const CREATEDOMPURIFY = require('dompurify'),
    {JSDOM} = require('jsdom'),
    WINDOW = new JSDOM('').window,
    DOMPURIFY = CREATEDOMPURIFY(WINDOW),
    VALIDATOR = require('validator');

// Top-level body keys the sanitizer leaves untouched (preserves prior behavior).
const SKIP_BODY_KEYS = new Set(['is_active']);

/**
 * Sanitizes a single string: trim, then strip dangerous HTML/scripts with
 * DOMPurify (safe markup is kept; scripts/event handlers are removed).
 *
 * @param {string} value
 * @returns {string}
 */
function sanitize_string(value) {
    return DOMPURIFY.sanitize(VALIDATOR.trim(value));
}

/**
 * Recursively sanitizes every string leaf in a parsed request container
 * (req.body / req.query / req.params), descending through nested objects AND
 * arrays. JSON bodies and qs bracket-notation queries both produce nesting, and
 * the previous top-level-only pass let nested string values bypass sanitization.
 *
 * Iterative (explicit stack) so a deeply nested payload cannot overflow the call
 * stack. Mutates the container in place. Request containers are JSON/qs-parsed and
 * therefore acyclic, so no cycle tracking is needed.
 *
 * @param {Object|Array} root - container to sanitize in place
 * @param {Set<string>} [skip_root_keys] - keys to leave untouched at the TOP level only
 */
function sanitize_in_place(root, skip_root_keys) {

    if (root === null || typeof root !== 'object') {
        return;
    }

    const stack = [{ node: root, is_root: true }];

    while (stack.length > 0) {

        const { node, is_root } = stack.pop();

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const value = node[i];
                if (typeof value === 'string') {
                    node[i] = sanitize_string(value);
                } else if (value !== null && typeof value === 'object') {
                    stack.push({ node: value, is_root: false });
                }
            }
            continue;
        }

        for (const key of Object.keys(node)) {

            if (is_root && skip_root_keys !== undefined && skip_root_keys.has(key)) {
                continue;
            }

            const value = node[key];
            if (typeof value === 'string') {
                node[key] = sanitize_string(value);
            } else if (value !== null && typeof value === 'object') {
                stack.push({ node: value, is_root: false });
            }
        }
    }
}

/**
 * Middleware: sanitize req.body, recursing through nested objects and arrays.
 *
 * @param req
 * @param res
 * @param next
 */
exports.sanitize_req_body = function(req, res, next) {
    sanitize_in_place(req.body, SKIP_BODY_KEYS);
    next();
};

/**
 * Middleware: sanitize req.params, recursing through nested objects and arrays.
 *
 * @param req
 * @param res
 * @param next
 */
exports.sanitize_req_params = function(req, res, next) {
    sanitize_in_place(req.params);
    next();
};

/**
 * Middleware: sanitize req.query, recursing through nested objects and arrays.
 *
 * @param req
 * @param res
 * @param next
 */
exports.sanitize_req_query = function(req, res, next) {
    sanitize_in_place(req.query);
    next();
};
