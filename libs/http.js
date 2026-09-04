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
 * Shared Express helpers (DRY review 2026-09-03, Phase 1). `async_handler`
 * used to be pasted into eight route files; `send_error` / `send_ok` give the
 * `{success, message, data}` envelope a single definition for the modules
 * that already speak it (media-library, indexer, exhibits).
 */

/**
 * Wraps an async route handler so a rejected promise reaches the global
 * error handler in config/express.js instead of hanging the request.
 * @param {Function} fn - async (req, res, next) handler
 * @returns {Function} Express middleware
 */
const async_handler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Sends a failure envelope
 * @param {Object} res - Express response
 * @param {number} status - HTTP status code
 * @param {string} message - Staff-facing message
 * @param {Object} [extra] - Additional envelope fields (e.g. a `code`)
 * @returns {Object} The response, for chaining/returning from a handler
 */
const send_error = (res, status, message, extra = undefined) => {
    return res.status(status).json({
        success: false,
        message,
        data: null,
        ...(extra && typeof extra === 'object' ? extra : {})
    });
};

/**
 * Sends a success envelope
 * @param {Object} res - Express response
 * @param {*} data - Payload (null when there is none)
 * @param {string} [message='OK'] - Staff-facing message
 * @param {number} [status=200] - HTTP status code
 * @param {Object} [extra] - Additional envelope fields (e.g. pagination
 *   counters that predate the envelope and are still read by the client)
 * @returns {Object} The response
 */
const send_ok = (res, data, message = 'OK', status = 200, extra = undefined) => {
    return res.status(status).json({
        success: true,
        message,
        data: data === undefined ? null : data,
        ...(extra && typeof extra === 'object' ? extra : {})
    });
};

module.exports = {
    async_handler,
    send_error,
    send_ok
};
