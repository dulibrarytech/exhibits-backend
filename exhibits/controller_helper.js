/**

 Copyright 2026 University of Denver

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

const LOGGER = require('../libs/log4');
const AUTHORIZE = require('../auth/authorize');
const { send_error, send_ok } = require('../libs/http');

/*
 * Single controller helper for the exhibits module (DRY review 2026-09-03,
 * cluster S1, Phase 2 item 13).
 *
 * It replaces four forked copies that had drifted into incompatible
 * signatures and, worse, four different 400 bodies:
 *
 *   items_helper      validate_param(res, value, label)         -> {message: 'Bad request. Missing or invalid <label>.'}
 *   grid_helper       validate_id(res, value, label, context)    -> {message: 'Invalid request: <label> is required'}
 *   timelines_helper  validate_param(res, value)                 -> 'Bad request.'   (a bare string body)
 *   headings_controller (inline)                                 -> 'Bad request.'   (a bare string body)
 *   exhibits_helper   pure validators; the controller builds     -> {success:false, message, data:null}
 *                     the envelope itself
 *
 * Phase 3 item 19 finished the job on the wire: every response below now
 * leaves as the shared `{success, message, data}` envelope built by
 * `libs/http`. The bare-string 'Bad request.' body the 'plain' format used to
 * send is gone, so those 400s changed Content-Type from text/html to
 * application/json — the dashboard client and the e2e suites were updated in
 * the same pass, and the dashboard API has no other consumers.
 *
 * What survives per format is the MESSAGE WORDING and the validation
 * PREDICATES, both of which are behaviour rather than envelope:
 *
 *   'detailed' — grid_helper's wording. Structured LOGGER metadata on every
 *                branch, an ID character-class check, and `validate_model_result`.
 *                The most complete of the four, so it is the default.
 *   'labeled'  — items_helper's wording. One 400 message parameterized by a
 *                human-readable label; no per-branch logging.
 *   'plain'    — timelines_helper / headings_controller's wording: a flat
 *                'Bad request.', and a 500 whose message concatenates the
 *                caller's text with the error's.
 *
 * The predicates differ too — 'plain' accepts null and 0 where 'labeled'
 * rejects them, and timelines_controller leans on that — so each format still
 * owns its predicate. Collapsing those would change WHICH requests get a 400,
 * which is a behaviour change and deliberately not part of this item.
 *
 * `AUTHORIZE.check_permission` stays the single authorization decision point.
 * Every format's gate reads it as `!== true` (fail closed): the three forks
 * spelled that test three ways (`!x`, `x === false`, `x !== true`), which is
 * only distinguishable for a non-boolean return, and check_permission returns
 * a strict boolean on every path including its own catch.
 */

const UNAUTHORIZED_MESSAGE = 'Unauthorized request';
const INVALID_MODEL_RESULT_MESSAGE = 'Invalid response from database model';

/* The 'plain' format's single 400 wording, kept verbatim from the two forks it
   replaced; only the envelope around it changed (Phase 3 item 19). */
const PLAIN_BAD_REQUEST_MESSAGE = 'Bad request.';

/* Safe ID character class: alphanumerics, hyphens, underscores. */
const ID_FORMAT_REGEX = /^[a-zA-Z0-9_-]+$/;

/* ==================== PURE VALIDATORS ==================== */

/*
 * These return a verdict instead of sending a response, for callers that
 * build their own envelope (exhibits_controller's {success, message, data}).
 * They send nothing and log nothing.
 */

/**
 * Validates that a value is a non-empty string
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid
 */
const is_valid_string = (value) => {
    return value && typeof value === 'string' && value.trim() !== '';
};

/**
 * Validates and sanitizes a required string parameter (UUID, filename, UID, etc.)
 * @param {*} value - The value to validate
 * @param {string} [field_name='Parameter'] - Human-readable field name for error messages
 * @param {number} [max_length=255] - Maximum allowed length after trimming
 * @returns {{ valid: boolean, sanitized: string|null, error_message: string|null }}
 */
const validate_string_param = (value, field_name = 'Parameter', max_length = 255) => {

    if (!value || typeof value !== 'string' || value.trim().length === 0) {
        return {
            valid: false,
            sanitized: null,
            error_message: `Valid ${field_name} is required`
        };
    }

    const sanitized = value.trim();

    if (sanitized.length > max_length) {
        return {
            valid: false,
            sanitized: null,
            error_message: `${field_name} exceeds maximum length`
        };
    }

    return {
        valid: true,
        sanitized,
        error_message: null
    };
};

/**
 * Checks whether a string contains path traversal sequences
 * @param {string} value - The string to check
 * @returns {boolean} True if path traversal characters are detected
 */
const has_path_traversal = (value) => {
    return value.includes('..') || value.includes('/') || value.includes('\\');
};

/**
 * Validates that a request body is present and non-empty
 * @param {*} body - The request body to validate
 * @returns {boolean} True if the body is a non-empty object
 */
const validate_request_body = (body) => {
    return body && typeof body === 'object' && Object.keys(body).length > 0;
};

/**
 * Validates a model result has the expected structure (numeric status)
 * @param {*} result - The result object from a model call
 * @returns {boolean} True if result is an object with a numeric status property
 */
const is_valid_model_result = (result) => {
    return result && typeof result === 'object' && typeof result.status === 'number';
};

/**
 * Parses and validates an HTTP status code from a model response
 * @param {*} status - The status value to validate
 * @returns {{ valid: boolean, status_code: number|null }}
 */
const validate_status_code = (status) => {
    const status_code = parseInt(status, 10);

    if (isNaN(status_code) || status_code < 100 || status_code > 599) {
        return { valid: false, status_code: null };
    }

    return { valid: true, status_code };
};

/* ==================== RESPONSE FORMATS ==================== */

/*
 * Each format owns its validation predicates, its 400 message wording and
 * whether the branch is logged. Every string below is reproduced verbatim from
 * the fork it replaces. The envelope is no longer per-format — all three send
 * through `libs/http`.
 */

const FORMATS = {

    detailed: {
        logs: true,
        checks_id_format: true,
        is_valid_id: (value) => !!value,
        send_missing_id: (res, label) => send_error(res, 400, `Invalid request: ${label} is required`),
        send_invalid_id_format: (res, label) => send_error(res, 400, `Invalid ${label} format`),
        is_valid_body: (data) => !(!data || typeof data !== 'object' || Object.keys(data).length === 0),
        send_invalid_body: (res) => send_error(res, 400, 'Invalid request: data is required'),
        send_server_error: (res, context, error, message, log_meta) => {

            LOGGER.module().error(`${context}: ${message}`, {
                error: error.message,
                stack: error.stack,
                ...(log_meta || {})
            });

            /* The development-only `error` detail rides alongside the envelope
               rather than inside `data`, exactly as it did before. */
            return send_error(res, 500, message,
                process.env.NODE_ENV === 'development' ? {error: error.message} : undefined);
        }
    },

    labeled: {
        logs: false,
        checks_id_format: false,
        is_valid_id: is_valid_string,
        send_missing_id: (res, label) => send_error(res, 400, `Bad request. Missing or invalid ${label}.`),
        send_invalid_id_format: (res, label) => send_error(res, 400, `Bad request. Missing or invalid ${label}.`),
        is_valid_body: (data) => !(!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0),
        send_invalid_body: (res, label) => send_error(res, 400, `Bad request. Missing or invalid ${label}.`),
        send_server_error: (res, context, error, message, detail, log_prefix) => {

            const detail_suffix = detail ? ' ' + detail : '';
            LOGGER.module().error(`ERROR: [${log_prefix} (${context})]${detail_suffix} ${message}: ${error.message}`);

            return send_error(res, 500, message);
        }
    },

    plain: {
        logs: false,
        checks_id_format: false,
        /*
         * Deliberately loose, and the loosest of the three: only `undefined`
         * and the empty string are rejected, so null, 0 and `{}` all pass.
         * timelines_controller leans on that — it runs `validate_param` over
         * `req.body`, which express.json() delivers as `{}` for an empty POST.
         */
        is_valid_id: (value) => !(value === undefined || (typeof value === 'string' && value.length === 0)),
        send_missing_id: (res) => send_error(res, 400, PLAIN_BAD_REQUEST_MESSAGE),
        send_invalid_id_format: (res) => send_error(res, 400, PLAIN_BAD_REQUEST_MESSAGE),
        is_valid_body: (data) => !(data === undefined || (typeof data === 'string' && data.length === 0)),
        send_invalid_body: (res) => send_error(res, 400, PLAIN_BAD_REQUEST_MESSAGE),
        send_server_error: (res, context, error, message) => {

            LOGGER.module().error(`ERROR: [${context}] ${message} ${error.message}`);

            return send_error(res, 500, `${message} ${error.message}`);
        }
    }
};

/**
 * Forwards a model envelope as the shared HTTP envelope.
 *
 * Every exhibits model answers `{status, message, data?}` — the HTTP status
 * carried inside the body — and all seven controllers used to ship that object
 * verbatim with `res.status(result.status).send(result)`. The status now lives
 * only where it belongs, on the response, and the body is the same
 * `{success, message, data}` every other module sends (Phase 3 item 19).
 *
 * `success` follows the status, so a model that reports a soft failure as a 2xx
 * still reads as a success — exactly what the wire said before.
 *
 * @param {Object} res - Express response object
 * @param {Object} result - Model envelope `{status, message, data?}`
 * @returns {Object} The response
 */
const send_model_result = (res, result) => {

    if (result.status >= 400) {
        return send_error(res, result.status, result.message);
    }

    return send_ok(res, result.data === undefined ? null : result.data, result.message, result.status);
};

/* ==================== FORMAT-BOUND API ==================== */

/**
 * Builds the controller helper API for one controller's wire format.
 * @param {Object} [options]
 * @param {string} [options.format='detailed'] - 'detailed', 'labeled' or 'plain'
 * @param {string} [options.log_prefix] - Log label used by the 'labeled' 500 line
 * @returns {Object} validate_id, validate_body, check_authorization, validate_model_result, handle_error, with_handler
 */
const create_controller_helper = (options = {}) => {

    const { format = 'detailed', log_prefix = '/exhibits/controller' } = options;
    const SHAPE = FORMATS[format];

    if (SHAPE === undefined) {
        throw new Error(`Unknown controller helper format: ${format}`);
    }

    /**
     * Validates a required path/query parameter. Sends 400 if invalid.
     * @param {Object} res - Express response object
     * @param {*} value - Value to validate
     * @param {string} [label] - Human-readable label (used by 'detailed' and 'labeled')
     * @param {string} [context] - Controller function name (used by 'detailed' logging)
     * @returns {boolean} True if valid, false if a response was sent
     */
    const validate_id = (res, value, label, context) => {

        if (!SHAPE.is_valid_id(value)) {

            if (SHAPE.logs === true) {
                LOGGER.module().error(`${context}: Missing ${label}`, {[label]: value});
            }

            SHAPE.send_missing_id(res, label);
            return false;
        }

        if (SHAPE.checks_id_format === true && !ID_FORMAT_REGEX.test(value)) {

            if (SHAPE.logs === true) {
                LOGGER.module().error(`${context}: Invalid ${label} format`, {[label]: value});
            }

            SHAPE.send_invalid_id_format(res, label);
            return false;
        }

        return true;
    };

    /**
     * Validates a request body. Sends 400 if invalid.
     * @param {Object} res - Express response object
     * @param {*} data - Request body to validate
     * @param {string} [label_or_context] - Label ('labeled') or controller function name ('detailed')
     * @param {Object} [log_meta] - Additional metadata for logging ('detailed')
     * @returns {boolean} True if valid, false if a response was sent
     */
    const validate_body = (res, data, label_or_context, log_meta = {}) => {

        if (!SHAPE.is_valid_body(data)) {

            if (SHAPE.logs === true) {
                LOGGER.module().error(`${label_or_context}: Invalid request parameters`, {
                    has_data: !!data,
                    data_type: typeof data,
                    ...log_meta
                });
            }

            SHAPE.send_invalid_body(res, label_or_context);
            return false;
        }

        return true;
    };

    /**
     * Runs the RBAC check and sends 403 if unauthorized.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Array<string>} permissions - Required permissions
     * @param {string} record_type - Record type for the ownership check
     * @param {string} parent_id - Parent (exhibit) uuid
     * @param {string|null} child_id - Child record uuid, or null
     * @param {string} [context] - Controller function name (used by 'detailed' logging)
     * @param {Object} [log_meta] - Additional metadata for logging ('detailed')
     * @returns {Promise<boolean>} True if authorized, false if a response was sent
     */
    const check_authorization = async (req, res, permissions, record_type, parent_id, child_id, context, log_meta = {}) => {

        const auth_options = {
            req,
            permissions,
            record_type,
            parent_id,
            child_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (is_authorized !== true) {

            if (SHAPE.logs === true) {
                LOGGER.module().error(`${context}: Unauthorized attempt`, {
                    user_id: req.decoded?.sub,
                    permissions,
                    ...log_meta
                });
            }

            send_error(res, 403, UNAUTHORIZED_MESSAGE);

            return false;
        }

        return true;
    };

    /**
     * Validates that a model result carries a numeric status. Sends 500 if not.
     * @param {Object} res - Express response object
     * @param {*} result - Model result to validate
     * @param {string} context - Controller function name for logging
     * @param {Object} [log_meta] - Additional metadata for logging
     * @returns {boolean} True if valid, false if a response was sent
     */
    const validate_model_result = (res, result, context, log_meta = {}) => {

        if (!result || typeof result.status !== 'number') {

            LOGGER.module().error(`${context}: ${INVALID_MODEL_RESULT_MESSAGE}`, {
                result,
                ...log_meta
            });

            send_error(res, 500, INVALID_MODEL_RESULT_MESSAGE);

            return false;
        }

        return true;
    };

    /**
     * Logs the error and sends the 500 this controller's format specifies.
     * @param {Object} res - Express response object
     * @param {string} context - Controller function name for logging
     * @param {Error} error - The thrown error
     * @param {string} message - User-facing message
     * @param {Object|string} [extra] - Log metadata ('detailed') or a log detail string ('labeled')
     * @returns {Object} The response
     */
    const handle_error = (res, context, error, message, extra) => {
        return SHAPE.send_server_error(res, context, error, message, extra, log_prefix);
    };

    /**
     * Wraps a handler so it owns no try/catch: a thrown error becomes this
     * format's 500 via handle_error. Each handler then reads
     * validate -> authorize -> call model -> send.
     * @param {Function} fn - async (req, res) handler body
     * @param {Object} handler_options
     * @param {string} handler_options.context - Controller function name for logging
     * @param {string} handler_options.message - User-facing message for the 500
     * @param {Function|Object|string} [handler_options.meta] - Log metadata, or a (req) => metadata builder
     * @returns {Function} async (req, res) Express handler
     */
    const with_handler = (fn, handler_options) => {

        const { context, message, meta } = handler_options;

        return async function (req, res) {

            try {
                return await fn(req, res);
            } catch (error) {
                const resolved_meta = typeof meta === 'function' ? meta(req) : meta;
                return handle_error(res, context, error, message, resolved_meta);
            }
        };
    };

    return {
        validate_id,
        validate_body,
        check_authorization,
        validate_model_result,
        handle_error,
        with_handler
    };
};

module.exports = {
    UNAUTHORIZED_MESSAGE,
    INVALID_MODEL_RESULT_MESSAGE,
    PLAIN_BAD_REQUEST_MESSAGE,
    send_model_result,
    ID_FORMAT_REGEX,
    is_valid_string,
    validate_string_param,
    has_path_traversal,
    validate_request_body,
    is_valid_model_result,
    validate_status_code,
    create_controller_helper
};
