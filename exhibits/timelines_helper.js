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

const AUTHORIZE = require('../auth/authorize');

/**
 * Validates that a value is defined and non-empty. Sends 400 if invalid.
 * @param {Object} res - Express response object
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid, false if response was sent
 */
const validate_param = (res, value) => {

    if (value === undefined || (typeof value === 'string' && value.length === 0)) {
        res.status(400).send('Bad request.');
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
 * @param {string|null} child_id - Child UUID or null
 * @returns {Promise<boolean>} True if authorized, false if response was sent
 */
const check_authorization = async (req, res, permissions, record_type, parent_id, child_id) => {

    const options = {
        req,
        permissions,
        record_type,
        parent_id,
        child_id
    };

    const is_authorized = await AUTHORIZE.check_permission(options);

    if (is_authorized === false) {
        res.status(403).send({
            message: 'Unauthorized request'
        });
        return false;
    }

    return true;
};

/**
 * Sends 500 response with error message
 * @param {Object} res - Express response object
 * @param {string} message - User-facing error message prefix
 * @param {Error} error - Error object
 */
const handle_error = (res, message, error) => {
    res.status(500).send({
        message: `${message} ${error.message}`
    });
};

module.exports = {
    validate_param,
    check_authorization,
    handle_error
};
