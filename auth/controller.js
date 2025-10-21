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
const TOKEN = require('../libs/tokens');
const MODEL = require('../auth/model');
const LOGGER = require('../libs/log4');
const AUTHORIZE = require("./authorize");
const APP_PATH = '/exhibits-dashboard';

exports.get_auth_landing = function (req, res) {
    res.render('dist/auth-landing', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        build_version: CONFIG.build_version
    });
};

exports.sso = async function (req, res) {

    try {

        if (!req.body) {
            return res.status(400).json({ message: 'Invalid request.' });
        }

        const sso_host = req.body.HTTP_HOST;
        const username = req.body.employeeID;

        // Validate required parameters
        if (!sso_host || !username || typeof username !== 'string') {
            return res.status(400).json({ message: 'Missing required parameters.' });
        }

        // Validate SSO host against whitelist
        if (sso_host !== CONFIG.sso_host) {
            LOGGER.module().warn(
                `SSO attempt from unauthorized host: ${sso_host}`
            );
            return res.status(403).json({ message: 'Unauthorized host.' });
        }

        // Sanitize username to prevent injection
        const sanitized_username = username.trim();
        if (sanitized_username.length === 0 || sanitized_username.length > 255) {
            return res.status(400).json({ message: 'Invalid username format.' });
        }

        // Check user authentication
        const auth_result = await MODEL.check_auth_user(sanitized_username);

        if (!auth_result?.auth) {
            return res.status(401).json({ message: 'Authentication failed.' });
        }

        // Create and encode token
        const token = TOKEN.create(sanitized_username);
        if (!token) {
            LOGGER.module().error('Failed to create authentication token');
            return res.status(500).json({ message: 'Authentication failed.' });
        }

        const encoded_token = encodeURIComponent(token);

        // Save token to database
        const is_token_saved = await MODEL.save_token(auth_result.data, encoded_token);

        if (!is_token_saved) {
            LOGGER.module().error(
                `Failed to save token for user: ${sanitized_username}`
            );
            return res.status(500).json({ message: 'Authentication failed.' });
        }

        // Validate user ID is numeric to prevent injection in redirect
        if (!Number.isInteger(auth_result.data)) {
            LOGGER.module().error(
                `Invalid user ID type for user: ${sanitized_username}`
            );
            return res.status(500).json({ message: 'Authentication failed.' });
        }

        // Successful authentication - redirect with token
        const redirect_url = `${APP_PATH}/exhibits?t=${encoded_token}&id=${auth_result.data}`;
        res.redirect(redirect_url);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (sso)] unable to complete authentication: ${error.message}`
        );
        res.status(500).json({ message: 'Authentication failed.' });
    }
};

exports.get_auth_user_data = async function (req, res) {

    try {

        if (!req.query || typeof req.query !== 'object') {
            return res.status(400).json({
                message: 'Invalid request parameters.'
            });
        }

        // Extract and validate user ID
        const user_id = req.query.id;

        if (!user_id) {
            return res.status(400).json({
                message: 'Missing required parameter: id'
            });
        }

        // Validate user ID is numeric and positive
        const parsed_id = Number(user_id);
        if (!Number.isInteger(parsed_id) || parsed_id <= 0) {
            return res.status(400).json({
                message: 'Invalid user ID format.'
            });
        }

        // Fetch user data from model
        const response = await MODEL.get_auth_user_data(parsed_id);

        // Validate model response
        if (!response || !response.data) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        // Check if user_data is the expected object structure
        if (typeof response.data !== 'object') {
            LOGGER.module().error(
                `ERROR: [/auth/controller (get_auth_user_data)] invalid response from model for user ID: ${parsed_id}`
            );
            return res.status(500).json({
                message: 'Invalid user data format.'
            });
        }

        // Return successful response with user data
        return res.status(200).json(response.data);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (get_auth_user_data)] unable to get user auth data: ${error.message}`
        );

        // Return error response
        res.status(500).json({
            message: 'An error occurred while retrieving user data.'
        });
    }
};

exports.get_roles = async function (req, res) {

    try {

        const data = await MODEL.get_roles();
        res.status(data.status).send(data.data);

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/controller (get_roles)] unable to roles ' + error.message);
    }
};

exports.get_user_role = async function (req, res) {

    try {

        const user_id = req.query.user_id;

        if (user_id === undefined || user_id.length === 0) {
            res.status(400).send({
                message: 'Bad request'
            });
            return false;
        }

        const data = await MODEL.get_user_role(user_id);
        res.status(data.status).send(data.data);

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/controller (get_roles)] unable to roles ' + error.message);
    }
};

exports.update_user_role = async function (req, res) {

    try {

        const user_id = req.query.user_id;
        const role_id = req.query.role_id;

        if (user_id === undefined || user_id.length === 0) {
            res.status(400).send({
                message: 'Bad request'
            });
            return false;
        }

        if (role_id === undefined || role_id.length === 0) {
            res.status(400).send({
                message: 'Bad request'
            });
            return false;
        }

        const data = await MODEL.update_user_role(user_id, role_id);
        res.status(data.status).send(data);

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/controller (update_user_role)] unable to update user role ' + error.message);
    }
};

exports.check_permissions = async function (req, res) {

    try {

        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({
                message: 'Invalid request body.'
            });
        }

        // Extract and validate required parameters
        const { permissions, record_type, parent_id, child_id } = req.body;

        // Validate permissions is an array
        if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
            return res.status(400).json({
                message: 'Invalid or missing permissions parameter.'
            });
        }

        // Validate record_type is a string
        if (!record_type || typeof record_type !== 'string') {
            return res.status(400).json({
                message: 'Invalid or missing record_type parameter.'
            });
        }

        // Validate parent_id is a valid UUID
        const uuid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!parent_id || typeof parent_id !== 'string' || !uuid_pattern.test(parent_id)) {
            return res.status(400).json({
                message: 'Invalid or missing parent_id parameter.'
            });
        }

        // Validate child_id is a valid UUID if provided
        if (child_id !== null && child_id !== undefined && child_id !== '') {
            if (typeof child_id !== 'string' || !uuid_pattern.test(child_id)) {
                return res.status(400).json({
                    message: 'Invalid child_id parameter.'
                });
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
            return res.status(200).json({
                message: 'Authorized'
            });
        }

        // Authorization failed
        return res.status(403).json({
            message: 'Unauthorized request'
        });

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/controller (check_permissions)] unable to check permissions: ${error.message}`
        );

        // Return error response
        res.status(500).json({
            message: 'An error occurred while checking permissions.'
        });
    }
};
