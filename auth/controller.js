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

const CONFIG = require('../config/webservices_config')();
const APP_CONFIG = require('../config/app_config')();
const TOKEN = require('../libs/tokens');
const MODEL = require('../auth/model');
const LOGGER = require('../libs/log4');
const AUTHORIZE = require('./authorize');
const { is_valid_uuid } = require('../libs/uuid');
const { send_error, send_ok } = require('../libs/http');
const APP_PATH = APP_CONFIG.app_path;

exports.get_auth_landing = function (req, res) {
    res.render('dist/auth-landing', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        build_version: CONFIG.build_version,
        is_dev_env: process.env.NODE_ENV !== 'production'
    });
};

/**
 * Starts the SSO round-trip for the Authenticate button on the landing
 * page. Always redirects to the SSO URL regardless of current auth state;
 * the SSO callback issues a fresh session cookie on return.
 */
exports.initiate_login = function (req, res) {

    try {

        const encoded_callback = encodeURIComponent(CONFIG.sso_response_url);
        const redirect_url = CONFIG.sso_url + '?app_url=' + encoded_callback;
        res.redirect(redirect_url);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (initiate_login)] unable to redirect to SSO: ${error.message}`
        );
        /* Deliberately NOT the JSON envelope: this endpoint answers a
           top-level browser navigation from the landing page's Authenticate
           button, so its siblings render HTML and nothing parses this body
           (Phase 3 item 19). */
        res.status(500).send('Unable to start authentication.');
    }
};

exports.sso = async function (req, res) {

    try {

        if (!req.body) {
            return send_error(res, 400, 'Invalid request.');
        }

        const sso_host = req.body.HTTP_HOST;
        const username = req.body.employeeID;

        // Validate required parameters
        if (!sso_host || !username || typeof username !== 'string') {
            return send_error(res, 400, 'Missing required parameters.');
        }

        // Validate SSO host against whitelist
        if (sso_host !== CONFIG.sso_host) {
            LOGGER.module().warn(
                `SSO attempt from unauthorized host: ${sso_host}`
            );
            return send_error(res, 403, 'Unauthorized host.');
        }

        // Sanitize username to prevent injection
        const sanitized_username = username.trim();
        if (sanitized_username.length === 0 || sanitized_username.length > 255) {
            return send_error(res, 400, 'Invalid username format.');
        }

        // Check user authentication
        const auth_result = await MODEL.check_auth_user(sanitized_username);

        if (!auth_result?.auth) {
            return send_error(res, 401, 'Authentication failed.');
        }

        // Create token
        const token = TOKEN.create(sanitized_username);
        if (!token) {
            LOGGER.module().error('Failed to create authentication token');
            return send_error(res, 500, 'Authentication failed.');
        }

        /*
         * The session JWT is NOT persisted. Authorization resolves the user from the verified
         * JWT subject (du_id) on every request.
         */
        const encoded_token = encodeURIComponent(token);

        // Validate user ID is numeric to prevent injection in redirect
        if (!Number.isInteger(auth_result.data)) {
            LOGGER.module().error(
                `Invalid user ID type for user: ${sanitized_username}`
            );
            return send_error(res, 500, 'Authentication failed.');
        }

        // Primary auth transport: HttpOnly cookie read by TOKEN.verify /
        // TOKEN.verify_with_query. Preview windows and media <img> requests
        // now authenticate via this cookie instead of a URL query string.
        TOKEN.set_auth_cookie(res, token);

        // Record successful authentication (who + source IP) so the
        // audit trail has login events, not only failures.
        LOGGER.module().info(
            `INFO: [/auth/controller (sso)] successful login for user: ${sanitized_username} from IP: ${req.ip}`
        );

        // Successful authentication - redirect with token
        const redirect_url = `${APP_PATH}/exhibits?t=${encoded_token}&id=${auth_result.data}`;
        res.redirect(redirect_url);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (sso)] unable to complete authentication: ${error.message}`
        );
        send_error(res, 500, 'Authentication failed.');
    }
};

exports.get_auth_user_data = async function (req, res) {

    try {

        if (!req.query || typeof req.query !== 'object') {
            return send_error(res, 400, 'Invalid request parameters.');
        }

        // Extract and validate user ID
        const user_id = req.query.id;

        if (!user_id) {
            return send_error(res, 400, 'Missing required parameter: id');
        }

        // Validate user ID is numeric and positive
        const parsed_id = Number(user_id);
        if (!Number.isInteger(parsed_id) || parsed_id <= 0) {
            return send_error(res, 400, 'Invalid user ID format.');
        }

        // Fetch user data from model
        const response = await MODEL.get_auth_user_data(parsed_id);

        // Validate model response
        if (!response || !response.data) {
            return send_error(res, 404, 'User not found.');
        }

        // Check if user_data is the expected object structure
        if (typeof response.data !== 'object') {
            LOGGER.module().error(
                `ERROR: [/auth/controller (get_auth_user_data)] invalid response from model for user ID: ${parsed_id}`
            );
            return send_error(res, 500, 'Invalid user data format.');
        }

        // Return successful response with user data
        return send_ok(res, response.data, 'User authentication data retrieved.');

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (get_auth_user_data)] unable to get user auth data: ${error.message}`
        );

        // Return error response
        send_error(res, 500, 'An error occurred while retrieving user data.');
    }
};

exports.get_roles = async function (req, res) {

    try {

        const response = await MODEL.get_roles();

        if (!response || !response.data || !Array.isArray(response.data)) {
            return send_error(res, 404, 'No roles found.');
        }

        // Validate roles is an array
        if (!Array.isArray(response.data)) {
            LOGGER.module().error('ERROR: [/auth/controller (get_roles)] invalid response format from model');
            return send_error(res, 500, 'Invalid roles data format.');
        }

        // Return successful response with roles
        return send_ok(res, response.data, 'Roles retrieved.');

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (get_roles)] unable to get roles: ${error.message}`
        );

        // Return error response
        send_error(res, 500, 'An error occurred while retrieving roles.');
    }
};

exports.get_user_role = async function (req, res) {

    try {

        if (!req.query || typeof req.query !== 'object') {
            return send_error(res, 400, 'Invalid request parameters.');
        }

        // Extract and validate user_id
        const user_id = req.query.user_id;

        if (!user_id || user_id === '') {
            return send_error(res, 400, 'Missing required parameter: user_id');
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);

        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return send_error(res, 400, 'Invalid user_id format.');
        }

        const response = await MODEL.get_user_role(parsed_user_id);

        if (!response || !response.data || !Array.isArray(response.data)) {
            return send_error(res, 404, 'User role not found.');
        }

        // Return successful response with user role
        return send_ok(res, response.data, 'User role retrieved.');

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (get_user_role)] unable to get user role: ${error.message}`
        );

        // Return error response
        send_error(res, 500, 'An error occurred while retrieving user role.');
    }
};

exports.check_permissions = async function (req, res) {

    try {

        if (!req.body || typeof req.body !== 'object') {
            return send_error(res, 400, 'Invalid request body.');
        }

        // Extract and validate required parameters
        const { permissions, record_type, parent_id, child_id } = req.body;

        // Validate permissions is an array
        if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
            return send_error(res, 400, 'Invalid or missing permissions parameter.');
        }

        // Validate record_type is a string
        if (!record_type || typeof record_type !== 'string') {
            return send_error(res, 400, 'Invalid or missing record_type parameter.');
        }

        // Validate parent_id is a valid UUID (strict RFC shape, see libs/uuid)
        if (!is_valid_uuid(parent_id)) {
            return send_error(res, 400, 'Invalid or missing parent_id parameter.');
        }

        // Validate child_id is a valid UUID if provided
        if (child_id !== null && child_id !== undefined && child_id !== '') {
            if (!is_valid_uuid(child_id)) {
                return send_error(res, 400, 'Invalid child_id parameter.');
            }
        }

        // Build options object for authorization check
        const options = {
            req,
            permissions,
            record_type,
            parent_id,
            child_id: child_id || null
        };

        // Check authorization
        const is_authorized = await AUTHORIZE.check_permission(options);

        // Handle authorization result
        if (is_authorized === true) {
            return send_ok(res, null, 'Authorized');
        } else if (is_authorized === false) {
            // Log permission denials with actor/permission/resource
            // so privilege-probing is visible.
            LOGGER.module().warn(
                `WARNING: [/auth/controller (check_permissions)] permission denied for user: ${req.decoded?.sub || 'unknown'} — permissions: ${Array.isArray(permissions) ? permissions.join(',') : permissions}, record_type: ${record_type || 'n/a'}`
            );
            return send_error(res, 403, 'Unauthorized request');
        }

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (check_permissions)] unable to check permissions: ${error.message}`
        );

        // Return error response
        send_error(res, 500, 'An error occurred while checking permissions.');
    }
};
