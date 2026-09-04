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

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

'use strict';

const AUTHORIZE = require('./authorize');
const LOGGER = require('../libs/log4');
const { send_error } = require('../libs/http');

/*
 * RBAC gate. This module owns the `check_permission` option tuple and the 403
 * shape for every controller; `check_permission` in auth/authorize.js stays
 * the single decision point.
 *
 * Lives beside authorize.js rather than inside it on purpose: the route
 * suites (users, indexer, media uploads, media routes) mock `auth/authorize`
 * wholesale and expose only `check_permission`, so a factory exported from
 * that module would vanish under the mock. This module requires
 * `./authorize` at load, so the mock is what it calls.
 *
 * Every module answers the one `{success, message, data}` 403 body, so there
 * is a single shape here — the body is not caller-selectable.
 */

const UNAUTHORIZED_MESSAGE = 'Unauthorized request';

/**
 * Builds the option tuple `AUTHORIZE.check_permission` expects
 * @param {Object} req - Express request (req.decoded set by TOKEN.verify)
 * @param {Array<string>} permissions - Required permissions
 * @param {Object} [options]
 * @param {string|null} [options.record_type=null] - Ownership record type
 * @param {string|null} [options.parent_id=null] - Parent record uuid
 * @param {string|null} [options.child_id=null] - Child record uuid
 * @param {boolean} [options.users] - User-management short-circuit (no ownership check)
 * @returns {Object} check_permission options
 */
const build_auth_options = (req, permissions, options = {}) => {

    const auth_options = {
        req,
        permissions,
        record_type: options.record_type ?? null,
        parent_id: options.parent_id ?? null,
        child_id: options.child_id ?? null
    };

    if (options.users === true) {
        auth_options.users = true;
    }

    return auth_options;
};

/**
 * Sends the 403
 *
 * Every module speaks the one `{success, message, data}` envelope, so this
 * does not branch on a caller-supplied style. Takes `res` only.
 * @param {Object} res - Express response
 * @returns {Object} The response
 */
const send_unauthorized = (res) => {
    return send_error(res, 403, UNAUTHORIZED_MESSAGE);
};

/**
 * In-controller gate: runs the permission check and, on denial, sends the 403
 * (and the optional audit warning) itself. For controllers whose gate sits
 * after input validation, so it cannot move into route middleware without
 * reordering 400s and 403s.
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Array<string>} permissions - Required permissions
 * @param {Object} [options] - build_auth_options options, plus:
 * @param {string} [options.deny_log] - Warning logged when denied
 * @returns {Promise<boolean>} True when authorized; false after the 403 was sent
 */
const authorize_request = async (req, res, permissions, options = {}) => {

    const is_authorized = await AUTHORIZE.check_permission(build_auth_options(req, permissions, options));

    if (is_authorized === true) {
        return true;
    }

    if (typeof options.deny_log === 'string' && options.deny_log.length > 0) {
        LOGGER.module().warn(options.deny_log);
    }

    send_unauthorized(res);
    return false;
};

/**
 * Route-middleware factory. Runs after TOKEN.verify (needs req.decoded) and
 * before any body/file parsing, so a denied request never reaches multer or
 * the handler. A thrown check is logged and answered 403, never 500.
 * @param {Array<string>} permissions - Required permissions
 * @param {Object} [options] - build_auth_options options, plus:
 * @param {string} [options.parent_param] - req.params key to read parent_id from
 * @param {string} [options.child_param] - req.params key to read child_id from
 * @param {string} [options.context] - Log label for a thrown check
 * @returns {Function} Express middleware
 */
const require_permission = (permissions, options = {}) => {

    const { parent_param, child_param, context = '/auth/permission_gate (require_permission)', ...rest } = options;

    return async (req, res, next) => {

        try {

            const resolved = {
                ...rest,
                parent_id: parent_param ? (req.params?.[parent_param] || null) : (rest.parent_id ?? null),
                child_id: child_param ? (req.params?.[child_param] || null) : (rest.child_id ?? null)
            };

            const is_authorized = await authorize_request(req, res, permissions, resolved);

            if (is_authorized === true) {
                return next();
            }

        } catch (error) {
            LOGGER.module().error(`ERROR: [${context}] ${error.message}`);
            return send_unauthorized(res);
        }
    };
};

module.exports = {
    UNAUTHORIZED_MESSAGE,
    build_auth_options,
    send_unauthorized,
    authorize_request,
    require_permission
};
