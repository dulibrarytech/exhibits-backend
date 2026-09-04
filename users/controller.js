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

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

'use strict';

const MODEL = require('../users/model');
const LOGGER = require("../libs/log4");
const AUTHORIZE = require("../auth/authorize");
const GATE = require('../auth/permission_gate');
const { send_error, send_ok } = require('../libs/http');

/*
 * Every gate in this controller is a user-management check (`users: true`,
 * no ownership lookup).
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Array<string>} permissions - Required permissions
 * @param {string} deny_log - Warning logged when denied
 * @returns {Promise<boolean>} True when authorized; false after the 403 was sent
 */
const authorize_users_request = (req, res, permissions, deny_log) => {
    /* No `envelope` option: this controller speaks the shared
       {success, message, data} envelope, which is the gate's default. */
    return GATE.authorize_request(req, res, permissions, {
        users: true,
        deny_log
    });
};

/**
 * Gets all users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_users = async function (req, res) {

    try {

        // Check authorization to view users
        const is_authorized = await authorize_users_request(req, res, ['view_users'],
            `WARNING: [/user/controller (get_users)] unauthorized attempt to view users by ${req.decoded?.sub || 'unknown'}`
        );

        if (!is_authorized) {
            return;
        }

        // Fetch users from model
        const response = await MODEL.get_users();

        // Validate model response structure
        if (!response || typeof response !== 'object') {
            LOGGER.module().error('ERROR: [/user/controller (get_users)] invalid response structure from model');
            return send_error(res, 500, 'Invalid server response format.');
        }

        // Check if users data exists
        if (!response.data) {
            LOGGER.module().warn('WARNING: [/user/controller (get_users)] no users data returned from model');
            return send_error(res, 404, 'No users found.');
        }

        // Validate users data is an array
        if (!Array.isArray(response.data)) {
            LOGGER.module().error('ERROR: [/user/controller (get_users)] invalid users data format from model');
            return send_error(res, 500, 'Invalid users data format.');
        }

        // Return successful response with users data
        return send_ok(res, response.data, 'User records retrieved.');

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (get_users)] unable to get user records: ${error.message}`
        );

        // Return error response without exposing internal error details
        send_error(res, 500, 'An error occurred while retrieving user records.');
    }
};

/**
 * Gets user by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_user = async function (req, res) {

    try {

        if (!req.params || typeof req.params !== 'object') {
            return send_error(res, 400, 'Invalid request parameters.');
        }

        // Extract and validate user_id
        const user_id = req.params.user_id;

        if (!user_id || user_id === '') {
            return send_error(res, 400, 'Missing required parameter: user_id');
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);

        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return send_error(res, 400, 'Invalid user_id format.');
        }

        /*
         * Same gate as get_users: reading a profile is a view_users action.
         */
        const is_authorized = await authorize_users_request(req, res, ['view_users'],
            `WARNING: [/user/controller (get_user)] unauthorized attempt to view user ${parsed_user_id} by ${req.decoded?.sub || 'unknown'}`
        );

        if (!is_authorized) {
            return;
        }

        // Fetch user from model
        const response = await MODEL.get_user(parsed_user_id);

        // Validate model response structure
        if (!response || typeof response !== 'object') {
            LOGGER.module().error(
                `ERROR: [/user/controller (get_user)] invalid response structure from model for user ID: ${parsed_user_id}`
            );
            return send_error(res, 500, 'Invalid server response format.');
        }

        // Check if user was found
        if (!response.data) {
            return send_error(res, 404, 'User not found.');
        }

        // Validate user_data is an object
        if (typeof response.data !== 'object') {
            LOGGER.module().error(
                `ERROR: [/user/controller (get_user)] invalid user data format from model for user ID: ${parsed_user_id}`
            );
            return send_error(res, 500, 'Invalid user data format.');
        }

        // Return successful response with user data
        return send_ok(res, response.data, 'User record retrieved.');

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (get_user)] unable to get user: ${error.message}`
        );

        // Return error response without exposing internal error details
        send_error(res, 500, 'An error occurred while retrieving user record.');
    }
};

/**
 * Updates user record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.update_user = async function (req, res) {

    try {

        if (!req.params || typeof req.params !== 'object') {
            return send_error(res, 400, 'Invalid request parameters.');
        }

        // Validate request body exists
        if (!req.body || typeof req.body !== 'object') {
            return send_error(res, 400, 'Invalid request body.');
        }

        // Extract and validate user_id
        const user_id = req.params.user_id;

        if (!user_id || user_id === '') {
            return send_error(res, 400, 'Missing required parameter: user_id');
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);
        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return send_error(res, 400, 'Invalid user_id format.');
        }

        const user_data = req.body;

        // Validate at least one field is being updated
        const updatable_fields = ['du_id', 'first_name', 'last_name', 'email', 'role_id', 'is_active'];
        const has_updates = updatable_fields.some(field => user_data[field] !== undefined);

        if (!has_updates) {
            return send_error(res, 400, 'No valid fields provided for update.');
        }

        // Validate email format if provided
        if (user_data.email) {
            const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email_pattern.test(user_data.email)) {
                return send_error(res, 400, 'Invalid email format.');
            }
        }

        // Validate role_id if provided
        if (user_data.role_id !== undefined) {
            const role_id = Number(user_data.role_id);
            if (!Number.isInteger(role_id) || role_id <= 0) {
                return send_error(res, 400, 'Invalid role_id format.');
            }
        }

        /*
         * Authorization is split into two decisions, because the two
         * permissions mean different things (see db/seeds/03_role_permissions.js):
         *
         *   update_users — edit ANY user's profile (Administrator, Power User)
         *   update_user  — edit YOUR OWN profile (every role, including Student)
         *
         * They must NOT be checked as one list with the `users` short-circuit:
         * resolve the actor from the JWT, allow update_user only when
         * target === actor, and gate any role CHANGE behind the
         * Administrator-only update_user_role regardless of which path
         * admitted the request. role_id rides on this same PUT.
         */
        const actor_id = await AUTHORIZE.get_actor_id(req);

        if (actor_id === null) {
            LOGGER.module().warn(
                `WARNING: [/user/controller (update_user)] unable to resolve actor for ${req.decoded?.sub || 'unknown'}`
            );
            return GATE.send_unauthorized(res);
        }

        /*
         * Two-step decision, so the tuple is built here and check_permission
         * is called directly rather than through authorize_request.
         */
        const permission_options = (permission) => GATE.build_auth_options(req, [permission], { users: true });

        let is_authorized = await AUTHORIZE.check_permission(permission_options('update_users'));

        if (!is_authorized && actor_id === parsed_user_id) {
            is_authorized = await AUTHORIZE.check_permission(permission_options('update_user'));
        }

        if (!is_authorized) {
            LOGGER.module().warn(
                `WARNING: [/user/controller (update_user)] unauthorized attempt to update user ${parsed_user_id} by ${req.decoded?.sub || 'unknown'}`
            );
            return GATE.send_unauthorized(res);
        }

        /*
         * The edit form always posts role_id, so only a DIFFERENT role counts
         * as a role change. A user with no role row counts as a change too —
         * assigning a first role is the same privilege as changing one.
         */
        if (user_data.role_id !== undefined) {

            const requested_role_id = Number(user_data.role_id);
            const current_role_id = await MODEL.get_user_role_id(parsed_user_id);
            const is_role_change = current_role_id === null || requested_role_id !== current_role_id;

            if (is_role_change) {

                const can_change_role = await authorize_users_request(req, res, ['update_user_role'],
                    `WARNING: [/user/controller (update_user)] unauthorized role change on user ${parsed_user_id} (${current_role_id} -> ${requested_role_id}) by ${req.decoded?.sub || 'unknown'}`
                );

                if (!can_change_role) {
                    return;
                }
            }
        }

        // Update user in database
        const updated_user = await MODEL.update_user(parsed_user_id, user_data);

        // Validate model response
        if (updated_user === null) {
            return send_error(res, 404, 'User not found.');
        }

        if (updated_user === false) {
            LOGGER.module().error(
                `ERROR: [/user/controller (update_user)] update failed for user ID: ${parsed_user_id}`
            );
            return send_error(res, 500, 'Failed to update user record.');
        }

        // Validate model returned a valid user object
        if (typeof updated_user !== 'object') {
            LOGGER.module().error(
                'ERROR: [/user/controller (update_user)] invalid response format from model'
            );
            return send_error(res, 500, 'Invalid server response.');
        }

        // OWASP A09 — audit successful update (actor + affected id).
        LOGGER.module().info(
            `INFO: [/user/controller (update_user)] user updated (id: ${parsed_user_id}) by ${req.decoded?.sub || 'unknown'}`
        );

        // Return successful response with updated user data
        return send_ok(res, {id: parsed_user_id}, 'User updated successfully.', 201);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (update_user)] unable to update user record: ${error.message}`
        );

        // Return error response without exposing internal error details
        send_error(res, 500, 'An error occurred while updating user record.');
    }
};

/**
 * Saves user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.save_user = async function (req, res) {

    try {

        if (!req.body || typeof req.body !== 'object') {
            return send_error(res, 400, 'Invalid request body.');
        }

        const user_data = req.body;

        // Validate required user fields
        const required_fields = ['du_id', 'first_name', 'last_name', 'email'];
        const missing_fields = required_fields.filter(field => !user_data[field]);

        if (missing_fields.length > 0) {
            return send_error(res, 400, `Missing required fields: ${missing_fields.join(', ')}`);
        }

        // Validate email format
        const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email_pattern.test(user_data.email)) {
            return send_error(res, 400, 'Invalid email format.');
        }

        // Check authorization to add users
        const is_authorized = await authorize_users_request(req, res, ['add_users'],
            `WARNING: [/user/controller (save_user)] unauthorized attempt to add user by ${req.decoded?.sub || 'unknown'}`
        );

        if (!is_authorized) {
            return;
        }

        /*
         * add_users says the actor may create accounts; it says nothing about
         * WHICH role. Without this gate a Power User could create an
         * Administrator. The rule (auth/authorize.can_assign_role): assign any
         * role with update_user_role, otherwise only a role that grants nothing
         * the actor lacks. (A missing role_id is rejected by the model.)
         */
        if (user_data.role_id !== undefined) {

            const can_assign_role = await AUTHORIZE.can_assign_role(req, user_data.role_id);

            if (!can_assign_role) {
                LOGGER.module().warn(
                    `WARNING: [/user/controller (save_user)] unauthorized role assignment (role_id: ${user_data.role_id}) by ${req.decoded?.sub || 'unknown'}`
                );
                return GATE.send_unauthorized(res);
            }
        }

        // Save user to database
        const saved_user = await MODEL.save_user(user_data);
        // Validate model response
        if (saved_user.data === null || saved_user.data === undefined) {
            LOGGER.module().error(
                'ERROR: [/user/controller (save_user)] model returned null/undefined response'
            );
            return send_error(res, 500, 'Failed to save user record.');
        }

        // Check if save was successful
        if (saved_user.data === false) {
            return send_error(res, 409, 'User already exists');
        }

        // OWASP A09 — audit successful user administration (actor + affected id,
        // no PII record dump).
        LOGGER.module().info(
            `INFO: [/user/controller (save_user)] user created (id: ${saved_user.data}) by ${req.decoded?.sub || 'unknown'}`
        );

        // Return successful response with saved user data
        return send_ok(res, saved_user.data, 'User created successfully.', 201);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (save_user)] unable to save user record: ${error.message}`
        );

        // Return error response without exposing internal error details
        send_error(res, 500, 'An error occurred while saving user record.');
    }
};

/**
 * Deletes user record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.delete_user = async function (req, res) {

    try {

        if (!req.params || typeof req.params !== 'object') {
            return send_error(res, 400, 'Invalid request parameters.');
        }

        // Extract and validate user_id
        const user_id = req.params.user_id;

        if (!user_id || user_id === '') {
            return send_error(res, 400, 'Missing required parameter: user_id');
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);
        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return send_error(res, 400, 'Invalid user_id format.');
        }

        // Check authorization to delete users
        const is_authorized = await authorize_users_request(req, res, ['delete_users'],
            `WARNING: [/user/controller (delete_user)] unauthorized attempt to delete user ${parsed_user_id} by ${req.decoded?.sub || 'unknown'}`
        );

        if (!is_authorized) {
            return;
        }

        // Delete user from database
        const delete_result = await MODEL.delete_user(parsed_user_id);

        // Validate model response
        if (delete_result === null) {
            return send_error(res, 404, 'User not found.');
        }

        if (delete_result === false) {
            LOGGER.module().error(
                `ERROR: [/user/controller (delete_user)] delete failed for user ID: ${parsed_user_id}`
            );
            return send_error(res, 500, 'Failed to delete user record.');
        }

        // Check for conflict (user cannot be deleted due to dependencies)
        if (delete_result.conflict) {
            return send_error(res, 409, delete_result.message || 'User cannot be deleted due to existing dependencies.');
        }

        // OWASP A09 — audit successful deletion (actor + affected id).
        LOGGER.module().info(
            `INFO: [/user/controller (delete_user)] user deleted (id: ${parsed_user_id}) by ${req.decoded?.sub || 'unknown'}`
        );

        // Return successful response (204 No Content for DELETE operations)
        return res.status(204).send();

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (delete_user)] unable to delete user record: ${error.message}`
        );

        // Return error response without exposing internal error details
        send_error(res, 500, 'An error occurred while deleting user record.');
    }
};

/**
 * Updates user active status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.update_status = async function (req, res) {

    try {

        if (!req.params || typeof req.params !== 'object') {
            return send_error(res, 400, 'Invalid request parameters.');
        }

        // Extract and validate user id
        const user_id = req.params.id;

        if (!user_id || user_id === '') {
            return send_error(res, 400, 'Missing required parameter: id');
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);
        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return send_error(res, 400, 'Invalid user ID format.');
        }

        // Extract and validate is_active parameter
        const is_active = req.params.is_active;

        if (is_active === undefined || is_active === '') {
            return send_error(res, 400, 'Missing required parameter: is_active');
        }

        // Validate is_active is 0 or 1
        const parsed_is_active = Number(is_active);
        if (parsed_is_active !== 0 && parsed_is_active !== 1) {
            return send_error(res, 400, 'Invalid is_active value. Must be 0 or 1.');
        }

        // Check authorization to update user status
        const is_authorized = await authorize_users_request(req, res, ['update_users', 'update_user_status'],
            `WARNING: [/user/controller (update_status)] unauthorized attempt to update status for user ${parsed_user_id} by ${req.decoded?.sub || 'unknown'}`
        );

        if (!is_authorized) {
            return;
        }

        // Update user status in database
        const update_result = await MODEL.update_status(parsed_user_id, parsed_is_active);

        // Validate model response
        if (update_result === null) {
            return send_error(res, 404, 'User not found.');
        }

        if (update_result === false) {
            LOGGER.module().error(
                `ERROR: [/user/controller (update_status)] status update failed for user ID: ${parsed_user_id}`
            );
            return send_error(res, 500, 'Failed to update user status.');
        }

        // Validate model returned a valid result
        if (typeof update_result !== 'object') {
            LOGGER.module().error(
                'ERROR: [/user/controller (update_status)] invalid response format from model'
            );
            return send_error(res, 500, 'Invalid server response.');
        }

        // OWASP A09 — audit successful status change (actor + affected id + new state).
        LOGGER.module().info(
            `INFO: [/user/controller (update_status)] user status changed (id: ${parsed_user_id}, is_active: ${parsed_is_active}) by ${req.decoded?.sub || 'unknown'}`
        );

        // Return successful response
        return send_ok(res, {id: parsed_user_id, is_active: parsed_is_active}, 'User status updated successfully.', 200);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (update_status)] unable to update status: ${error.message}`
        );

        // Return error response without exposing internal error details
        send_error(res, 500, 'An error occurred while updating user status.');
    }
};
