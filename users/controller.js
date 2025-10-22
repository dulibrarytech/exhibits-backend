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

const MODEL = require('../users/model');
const LOGGER = require("../libs/log4");
const AUTHORIZE = require("../auth/authorize");

/**
 * Gets all users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_users = async function (req, res) {

    try {

        // Check authorization to view users
        const auth_options = {
            req,
            permissions: ['view_users'],
            record_type: null,
            parent_id: null,
            child_id: null,
            users: true
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().warn(
                `WARNING: [/user/controller (get_users)] unauthorized attempt to view users by ${req.user?.id || 'unknown'}`
            );
            return res.status(403).json({
                message: 'Unauthorized request'
            });
        }

        // Fetch users from model
        const response = await MODEL.get_users();

        // Validate model response structure
        if (!response || typeof response !== 'object') {
            LOGGER.module().error('ERROR: [/user/controller (get_users)] invalid response structure from model');
            return res.status(500).json({
                message: 'Invalid server response format.'
            });
        }

        // Check if users data exists
        if (!response.data) {
            LOGGER.module().warn('WARNING: [/user/controller (get_users)] no users data returned from model');
            return res.status(404).json({
                message: 'No users found.'
            });
        }

        // Validate users data is an array
        if (!Array.isArray(response.data)) {
            LOGGER.module().error('ERROR: [/user/controller (get_users)] invalid users data format from model');
            return res.status(500).json({
                message: 'Invalid users data format.'
            });
        }

        // Return successful response with users data
        return res.status(200).json(response.data);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (get_users)] unable to get user records: ${error.message}`
        );

        // Return error response without exposing internal error details
        res.status(500).json({
            message: 'An error occurred while retrieving user records.'
        });
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
            return res.status(400).json({
                message: 'Invalid request parameters.'
            });
        }

        // Extract and validate user_id
        const user_id = req.params.user_id;

        if (!user_id || user_id === '') {
            return res.status(400).json({
                message: 'Missing required parameter: user_id'
            });
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);

        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return res.status(400).json({
                message: 'Invalid user_id format.'
            });
        }

        // Fetch user from model
        const response = await MODEL.get_user(parsed_user_id);

        // Validate model response structure
        if (!response || typeof response !== 'object') {
            LOGGER.module().error(
                `ERROR: [/user/controller (get_user)] invalid response structure from model for user ID: ${parsed_user_id}`
            );
            return res.status(500).json({
                message: 'Invalid server response format.'
            });
        }

        // Check if user was found
        if (!response.data) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        // Validate user_data is an object
        if (typeof response.data !== 'object') {
            LOGGER.module().error(
                `ERROR: [/user/controller (get_user)] invalid user data format from model for user ID: ${parsed_user_id}`
            );
            return res.status(500).json({
                message: 'Invalid user data format.'
            });
        }

        // Return successful response with user data
        return res.status(200).json(response.data);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (get_user)] unable to get user: ${error.message}`
        );

        // Return error response without exposing internal error details
        res.status(500).json({
            message: 'An error occurred while retrieving user record.'
        });
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
            return res.status(400).json({
                message: 'Invalid request parameters.'
            });
        }

        // Validate request body exists
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({
                message: 'Invalid request body.'
            });
        }

        // Extract and validate user_id
        const user_id = req.params.user_id;

        if (!user_id || user_id === '') {
            return res.status(400).json({
                message: 'Missing required parameter: user_id'
            });
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);
        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return res.status(400).json({
                message: 'Invalid user_id format.'
            });
        }

        const user_data = req.body;

        // Validate at least one field is being updated
        const updatable_fields = ['du_id', 'first_name', 'last_name', 'email', 'role_id', 'is_active'];
        const has_updates = updatable_fields.some(field => user_data[field] !== undefined);

        if (!has_updates) {
            return res.status(400).json({
                message: 'No valid fields provided for update.'
            });
        }

        // Validate email format if provided
        if (user_data.email) {
            const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email_pattern.test(user_data.email)) {
                return res.status(400).json({
                    message: 'Invalid email format.'
                });
            }
        }

        // Validate role_id if provided
        if (user_data.role_id !== undefined) {
            const role_id = Number(user_data.role_id);
            if (!Number.isInteger(role_id) || role_id <= 0) {
                return res.status(400).json({
                    message: 'Invalid role_id format.'
                });
            }
        }

        // Check authorization to update users
        const auth_options = {
            req,
            permissions: ['update_users', 'update_user'],
            record_type: null,
            parent_id: null,
            child_id: null,
            users: true
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().warn(
                `WARNING: [/user/controller (update_user)] unauthorized attempt to update user ${parsed_user_id} by ${req.user?.id || 'unknown'}`
            );
            return res.status(403).json({
                message: 'Unauthorized request'
            });
        }

        // Update user in database
        const updated_user = await MODEL.update_user(parsed_user_id, user_data);

        // Validate model response
        if (updated_user === null) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        if (updated_user === false) {
            LOGGER.module().error(
                `ERROR: [/user/controller (update_user)] update failed for user ID: ${parsed_user_id}`
            );
            return res.status(500).json({
                message: 'Failed to update user record.'
            });
        }

        // Validate model returned a valid user object
        if (typeof updated_user !== 'object') {
            LOGGER.module().error(
                'ERROR: [/user/controller (update_user)] invalid response format from model'
            );
            return res.status(500).json({
                message: 'Invalid server response.'
            });
        }

        // Return successful response with updated user data
        return res.status(201).json({
            message: 'User updated successfully.',
            user: updated_user
        });

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (update_user)] unable to update user record: ${error.message}`
        );

        // Return error response without exposing internal error details
        res.status(500).json({
            message: 'An error occurred while updating user record.'
        });
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
            return res.status(400).json({
                message: 'Invalid request body.'
            });
        }

        const user_data = req.body;

        // Validate required user fields
        const required_fields = ['du_id', 'first_name', 'last_name', 'email'];
        const missing_fields = required_fields.filter(field => !user_data[field]);

        if (missing_fields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missing_fields.join(', ')}`
            });
        }

        // Validate email format
        const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email_pattern.test(user_data.email)) {
            return res.status(400).json({
                message: 'Invalid email format.'
            });
        }

        // Check authorization to add users
        const auth_options = {
            req,
            permissions: ['add_users'],
            record_type: null,
            parent_id: null,
            child_id: null,
            users: true
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().warn(
                `WARNING: [/user/controller (save_user)] unauthorized attempt to add user by ${req.user?.id || 'unknown'}`
            );
            return res.status(403).json({
                message: 'Unauthorized request'
            });
        }

        // Save user to database
        const saved_user = await MODEL.save_user(user_data);
        console.log('saved user: ', saved_user);
        // Validate model response
        if (saved_user.data === null || saved_user.data === undefined) {
            LOGGER.module().error(
                'ERROR: [/user/controller (save_user)] model returned null/undefined response'
            );
            return res.status(500).json({
                message: 'Failed to save user record.'
            });
        }

        // Check if save was successful
        if (saved_user.data === false) { // 409
            return res.status(200).json({
                message: 'User already exists'
            });
        }

        // Return successful response with saved user data
        return res.status(201).json({
            message: 'User created successfully.',
            user: saved_user
        });

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (save_user)] unable to save user record: ${error.message}`
        );

        // Return error response without exposing internal error details
        res.status(500).json({
            message: 'An error occurred while saving user record.'
        });
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
            return res.status(400).json({
                message: 'Invalid request parameters.'
            });
        }

        // Extract and validate user_id
        const user_id = req.params.user_id;

        if (!user_id || user_id === '') {
            return res.status(400).json({
                message: 'Missing required parameter: user_id'
            });
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);
        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return res.status(400).json({
                message: 'Invalid user_id format.'
            });
        }

        // Check authorization to delete users
        const auth_options = {
            req,
            permissions: ['delete_users'],
            record_type: null,
            parent_id: null,
            child_id: null,
            users: true
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().warn(
                `WARNING: [/user/controller (delete_user)] unauthorized attempt to delete user ${parsed_user_id} by ${req.user?.id || 'unknown'}`
            );
            return res.status(403).json({
                message: 'Unauthorized request'
            });
        }

        // Delete user from database
        const delete_result = await MODEL.delete_user(parsed_user_id);

        // Validate model response
        if (delete_result === null) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        if (delete_result === false) {
            LOGGER.module().error(
                `ERROR: [/user/controller (delete_user)] delete failed for user ID: ${parsed_user_id}`
            );
            return res.status(500).json({
                message: 'Failed to delete user record.'
            });
        }

        // Check for conflict (user cannot be deleted due to dependencies)
        if (delete_result.conflict) {
            return res.status(409).json({
                message: delete_result.message || 'User cannot be deleted due to existing dependencies.'
            });
        }

        // Return successful response (204 No Content for DELETE operations)
        return res.status(204).send();

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (delete_user)] unable to delete user record: ${error.message}`
        );

        // Return error response without exposing internal error details
        res.status(500).json({
            message: 'An error occurred while deleting user record.'
        });
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
            return res.status(400).json({
                message: 'Invalid request parameters.'
            });
        }

        // Extract and validate user id
        const user_id = req.params.id;

        if (!user_id || user_id === '') {
            return res.status(400).json({
                message: 'Missing required parameter: id'
            });
        }

        // Validate user_id is numeric and positive
        const parsed_user_id = Number(user_id);
        if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
            return res.status(400).json({
                message: 'Invalid user ID format.'
            });
        }

        // Extract and validate is_active parameter
        const is_active = req.params.is_active;

        if (is_active === undefined || is_active === '') {
            return res.status(400).json({
                message: 'Missing required parameter: is_active'
            });
        }

        // Validate is_active is 0 or 1
        const parsed_is_active = Number(is_active);
        if (parsed_is_active !== 0 && parsed_is_active !== 1) {
            return res.status(400).json({
                message: 'Invalid is_active value. Must be 0 or 1.'
            });
        }

        // Check authorization to update user status
        const auth_options = {
            req,
            permissions: ['update_users', 'update_user_status'],
            record_type: null,
            parent_id: null,
            child_id: null,
            users: true
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().warn(
                `WARNING: [/user/controller (update_status)] unauthorized attempt to update status for user ${parsed_user_id} by ${req.user?.id || 'unknown'}`
            );
            return res.status(403).json({
                message: 'Unauthorized request'
            });
        }

        // Update user status in database
        const update_result = await MODEL.update_status(parsed_user_id, parsed_is_active);

        // Validate model response
        if (update_result === null) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        if (update_result === false) {
            LOGGER.module().error(
                `ERROR: [/user/controller (update_status)] status update failed for user ID: ${parsed_user_id}`
            );
            return res.status(500).json({
                message: 'Failed to update user status.'
            });
        }

        // Validate model returned a valid result
        if (typeof update_result !== 'object') {
            LOGGER.module().error(
                'ERROR: [/user/controller (update_status)] invalid response format from model'
            );
            return res.status(500).json({
                message: 'Invalid server response.'
            });
        }

        // Return successful response
        return res.status(200).json({
            message: 'User status updated successfully.',
            user_id: parsed_user_id,
            is_active: parsed_is_active
        });

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/user/controller (update_status)] unable to update status: ${error.message}`
        );

        // Return error response without exposing internal error details
        res.status(500).json({
            message: 'An error occurred while updating user status.'
        });
    }
};
