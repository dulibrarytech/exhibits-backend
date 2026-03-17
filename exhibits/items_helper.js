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

'use strict';

const LOGGER = require('../libs/log4');
const AUTHORIZE = require('../auth/authorize');

/**
 * Validates that a value is a non-empty string
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid
 */
const is_valid_string = (value) => {
    return value && typeof value === 'string' && value.trim() !== '';
};

/**
 * Validates a required string path/query parameter. Sends 400 if invalid.
 * @param {Object} res - Express response object
 * @param {*} value - Parameter value to validate
 * @param {string} label - Human-readable label for error message
 * @returns {boolean} True if valid, false if response was sent
 */
const validate_param = (res, value, label) => {

    if (!is_valid_string(value)) {
        res.status(400).send({
            message: `Bad request. Missing or invalid ${label}.`
        });
        return false;
    }

    return true;
};

/**
 * Validates a required non-empty object request body. Sends 400 if invalid.
 * @param {Object} res - Express response object
 * @param {*} data - Request body to validate
 * @param {string} label - Human-readable label for error message
 * @returns {boolean} True if valid, false if response was sent
 */
const validate_body = (res, data, label) => {

    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        res.status(400).send({
            message: `Bad request. Missing or invalid ${label}.`
        });
        return false;
    }

    return true;
};

/**
 * Checks authorization and sends 403 if unauthorized
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Array<string>} permissions - Required permissions
 * @param {string} record_type - Record type for authorization
 * @param {string} parent_id - Parent (exhibit) UUID
 * @param {string|null} child_id - Child (item) UUID or null
 * @returns {Promise<boolean>} True if authorized, false if response was sent
 */
const check_authorization = async (req, res, permissions, record_type, parent_id, child_id) => {

    const auth_options = {
        req,
        permissions,
        record_type,
        parent_id,
        child_id
    };

    const is_authorized = await AUTHORIZE.check_permission(auth_options);

    if (is_authorized !== true) {
        res.status(403).send({
            message: 'Unauthorized request'
        });
        return false;
    }

    return true;
};

/**
 * Logs error and sends 500 response
 * @param {Object} res - Express response object
 * @param {string} context - Function name for log context
 * @param {Error} error - Error object
 * @param {string} message - User-facing error message
 * @param {string} [detail] - Optional additional detail for the log entry
 */
const handle_error = (res, context, error, message, detail = '') => {
    const detail_suffix = detail ? ' ' + detail : '';
    LOGGER.module().error(`ERROR: [/items/controller (${context})]${detail_suffix} ${message}: ${error.message}`);
    res.status(500).send({
        message
    });
};

// process_media_files moved to common_helper

// clean_media_fields moved to common_helper

module.exports = {
    is_valid_string,
    validate_param,
    validate_body,
    check_authorization,
    handle_error
};
