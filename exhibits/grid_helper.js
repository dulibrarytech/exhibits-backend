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

// Shared ID format regex (alphanumeric, hyphens, underscores)
const ID_FORMAT_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates that a value is a non-empty string matching the safe ID format.
 * Sends 400 with structured log if invalid.
 * @param {Object} res - Express response object
 * @param {*} value - Value to validate
 * @param {string} label - Human-readable label (e.g. 'exhibit_id')
 * @param {string} context - Controller function name for logging
 * @returns {boolean} True if valid, false if response was sent
 */
const validate_id = (res, value, label, context) => {

    if (!value) {
        LOGGER.module().error(`${context}: Missing ${label}`, {[label]: value});
        res.status(400).send({
            message: `Invalid request: ${label} is required`
        });
        return false;
    }

    if (!ID_FORMAT_REGEX.test(value)) {
        LOGGER.module().error(`${context}: Invalid ${label} format`, {[label]: value});
        res.status(400).send({
            message: `Invalid ${label} format`
        });
        return false;
    }

    return true;
};

/**
 * Validates a request body is a non-empty object. Sends 400 if invalid.
 * @param {Object} res - Express response object
 * @param {*} data - Request body to validate
 * @param {string} context - Controller function name for logging
 * @param {Object} [log_meta] - Additional metadata for logging
 * @returns {boolean} True if valid, false if response was sent
 */
const validate_body = (res, data, context, log_meta = {}) => {

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        LOGGER.module().error(`${context}: Invalid request parameters`, {
            has_data: !!data,
            data_type: typeof data,
            ...log_meta
        });
        res.status(400).send({
            message: 'Invalid request: data is required'
        });
        return false;
    }

    return true;
};

/**
 * Checks authorization and sends 403 if unauthorized. Logs attempt on failure.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Array<string>} permissions - Required permissions
 * @param {string} record_type - Record type for authorization
 * @param {string} parent_id - Parent (exhibit) UUID
 * @param {string|null} child_id - Child UUID or null
 * @param {string} context - Controller function name for logging
 * @param {Object} [log_meta] - Additional metadata for logging
 * @returns {Promise<boolean>} True if authorized, false if response was sent
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

    if (!is_authorized) {
        LOGGER.module().error(`${context}: Unauthorized attempt`, {
            user_id: req.user?.id,
            permissions,
            ...log_meta
        });
        res.status(403).send({
            message: 'Unauthorized request'
        });
        return false;
    }

    return true;
};

/**
 * Validates a model result has a numeric status. Sends 500 if invalid.
 * @param {Object} res - Express response object
 * @param {*} result - Model result to validate
 * @param {string} context - Controller function name for logging
 * @param {Object} [log_meta] - Additional metadata for logging
 * @returns {boolean} True if valid, false if response was sent
 */
const validate_model_result = (res, result, context, log_meta = {}) => {

    if (!result || typeof result.status !== 'number') {
        LOGGER.module().error(`${context}: Invalid response from database model`, {
            result,
            ...log_meta
        });
        res.status(500).send({
            message: 'Invalid response from database model'
        });
        return false;
    }

    return true;
};

/**
 * Logs error and sends 500 response. Includes error detail in development mode.
 * @param {Object} res - Express response object
 * @param {string} context - Controller function name for logging
 * @param {Error} error - Error object
 * @param {string} message - User-facing error message
 * @param {Object} [log_meta] - Additional metadata for logging
 */
const handle_error = (res, context, error, message, log_meta = {}) => {

    LOGGER.module().error(`${context}: ${message}`, {
        error: error.message,
        stack: error.stack,
        ...log_meta
    });

    res.status(500).send({
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

module.exports = {
    validate_id,
    validate_body,
    check_authorization,
    validate_model_result,
    handle_error
};
