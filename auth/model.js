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

const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLE = DB_TABLES.exhibits;
const USERS_ROLES_TABLE = DB_TABLES.exhibits.users_roles;
const AUTH_TASKS = require('../auth/tasks/auth_tasks');
const ROLES_TASKS = require('../auth/tasks/roles_tasks');
const EXHIBITS_ENDPOINTS = require('../exhibits/endpoints/index')();
const USERS_ENDPOINTS = require('../users/endpoints')();
const INDEXER_ENDPOINTS = require('../indexer/endpoints')();
const MEDIA_LIBRARY_ENDPOINTS = require('../media-library/endpoints')();
const LOGGER = require('../libs/log4');
const ROLE_TASKS = require("./tasks/roles_tasks");

// Module-level singleton instances
let AUTH_TASKS_INSTANCE = null;
let ROLES_TASKS_INSTANCE = null;
let ROLE_TASKS_INSTANCE = null;

/**
 * Gets or creates singleton AUTH_TASKS instance
 * @returns {Object|null} AUTH_TASKS instance or null on error
 */
function get_auth_tasks_instance() {

    if (AUTH_TASKS_INSTANCE !== null) {
        return AUTH_TASKS_INSTANCE;
    }

    if (typeof AUTH_TASKS === 'undefined' || typeof DB === 'undefined' || typeof TABLE === 'undefined') {
        LOGGER.module().error('ERROR: [/auth/model] AUTH_TASKS, DB, or TABLE is not defined');
        return null;
    }

    try {
        AUTH_TASKS_INSTANCE = new AUTH_TASKS(DB, TABLE);
        LOGGER.module().debug('DEBUG: [/auth/model] AUTH_TASKS singleton instance created');
        return AUTH_TASKS_INSTANCE;
    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model] failed to create AUTH_TASKS instance: ${error.message}`);
        return null;
    }
}

/**
 * Gets or creates singleton ROLES_TASKS instance
 * @returns {Object|null} ROLES_TASKS instance or null on error
 */
function get_roles_tasks_instance() {

    if (ROLES_TASKS_INSTANCE !== null) {
        return ROLES_TASKS_INSTANCE;
    }

    if (typeof ROLES_TASKS === 'undefined' || typeof DB === 'undefined' || typeof TABLE === 'undefined') {
        LOGGER.module().error('ERROR: [/auth/model] ROLES_TASKS, DB, or TABLE is not defined');
        return null;
    }

    try {
        ROLES_TASKS_INSTANCE = new ROLES_TASKS(DB, TABLE);
        LOGGER.module().debug('DEBUG: [/auth/model] ROLES_TASKS singleton instance created');
        return ROLES_TASKS_INSTANCE;
    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model] failed to create ROLES_TASKS instance: ${error.message}`);
        return null;
    }
}

/**
 * Gets or creates singleton ROLE_TASKS instance
 * @returns {Object|null} ROLE_TASKS instance or null on error
 */
function get_role_tasks_instance() {

    if (ROLE_TASKS_INSTANCE !== null) {
        return ROLE_TASKS_INSTANCE;
    }

    if (typeof ROLE_TASKS === 'undefined' || typeof DB === 'undefined' || typeof USERS_ROLES_TABLE === 'undefined') {
        LOGGER.module().error('ERROR: [/auth/model] ROLE_TASKS, DB, or USERS_ROLES_TABLE is not defined');
        return null;
    }

    try {
        ROLE_TASKS_INSTANCE = new ROLE_TASKS(DB, USERS_ROLES_TABLE);
        LOGGER.module().debug('DEBUG: [/auth/model] ROLE_TASKS singleton instance created');
        return ROLE_TASKS_INSTANCE;
    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model] failed to create ROLE_TASKS instance: ${error.message}`);
        return null;
    }
}

/**
 * Checks if user is authenticated (model layer - optimized)
 * @param {string} username - Username to check
 * @returns {Object} - {auth: boolean, data: Object|null} Auth result and user data
 */
exports.check_auth_user = async function (username) {

    try {
        if (!username || typeof username !== 'string') {
            LOGGER.module().warn('WARNING: [/auth/model (check_auth_user)] invalid username parameter');
            return {auth: false, data: null};
        }

        const trimmed_username = username.trim();
        if (trimmed_username.length === 0) {
            LOGGER.module().warn('WARNING: [/auth/model (check_auth_user)] empty username after trimming');
            return {auth: false, data: null};
        }

        if (trimmed_username.length > 255) {
            LOGGER.module().warn(`WARNING: [/auth/model (check_auth_user)] username too long: ${trimmed_username.length} characters`);
            return {auth: false, data: null};
        }

        const TASKS = get_auth_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/auth/model (check_auth_user)] failed to get AUTH_TASKS instance');
            return {auth: false, data: null};
        }

        if (typeof TASKS.check_auth_user !== 'function') {
            LOGGER.module().error('ERROR: [/auth/model (check_auth_user)] AUTH_TASKS instance missing check_auth_user method');
            return {auth: false, data: null};
        }

        const result = await TASKS.check_auth_user(trimmed_username);

        if (!result || typeof result !== 'object' || typeof result.auth !== 'boolean' || !result.hasOwnProperty('data')) {
            LOGGER.module().error('ERROR: [/auth/model (check_auth_user)] invalid result format from tasks layer');
            return {auth: false, data: null};
        }

        if (result.auth) {
            LOGGER.module().debug(`DEBUG: [/auth/model (check_auth_user)] user authenticated successfully`);
        } else {
            LOGGER.module().debug(`DEBUG: [/auth/model (check_auth_user)] user authentication failed`);
        }

        return {auth: result.auth, data: result.data};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model (check_auth_user)] unable to check user auth data: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/auth/model (check_auth_user)] stack trace: ${error.stack}`);
        }
        return {auth: false, data: null};
    }
};

/**
 * Gets authenticated user data with endpoints (model layer - optimized)
 * @param {number|string} id - User ID to retrieve
 * @returns {Object} - {status: number, message: string, data: Object|Array}
 */
exports.get_auth_user_data = async function (id) {

    try {
        if (id === null || id === undefined) {
            LOGGER.module().warn('WARNING: [/auth/model (get_auth_user_data)] id parameter is null or undefined');
            return {status: 400, message: 'Invalid user ID provided.', data: []};
        }

        if (typeof id === 'string' && id.trim().length === 0) {
            LOGGER.module().warn('WARNING: [/auth/model (get_auth_user_data)] id parameter is empty string');
            return {status: 400, message: 'Invalid user ID provided.', data: []};
        }

        const numeric_id = Number(id);
        if (isNaN(numeric_id)) {
            LOGGER.module().warn(`WARNING: [/auth/model (get_auth_user_data)] id is not numeric: ${id}`);
            return {status: 400, message: 'Invalid user ID format.', data: []};
        }

        if (!Number.isInteger(numeric_id) || numeric_id <= 0) {
            LOGGER.module().warn(`WARNING: [/auth/model (get_auth_user_data)] id is not a positive integer: ${numeric_id}`);
            return {status: 400, message: 'Invalid user ID format.', data: []};
        }

        if (numeric_id > Number.MAX_SAFE_INTEGER) {
            LOGGER.module().warn(`WARNING: [/auth/model (get_auth_user_data)] id exceeds safe integer: ${numeric_id}`);
            return {status: 400, message: 'Invalid user ID format.', data: []};
        }

        const TASKS = get_auth_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/auth/model (get_auth_user_data)] failed to get AUTH_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: []};
        }

        if (typeof TASKS.get_auth_user_data !== 'function') {
            LOGGER.module().error('ERROR: [/auth/model (get_auth_user_data)] AUTH_TASKS instance missing get_auth_user_data method');
            return {status: 500, message: 'Unable to retrieve user data.', data: []};
        }

        const data = await TASKS.get_auth_user_data(numeric_id);

        if (data === false) {
            LOGGER.module().warn(`WARNING: [/auth/model (get_auth_user_data)] user data not found or error occurred for id: ${numeric_id}`);
            return {status: 500, message: 'Unable to retrieve user data.', data: []};
        }

        if (data === null || data === undefined) {
            LOGGER.module().warn(`WARNING: [/auth/model (get_auth_user_data)] user data is null or undefined for id: ${numeric_id}`);
            return {status: 404, message: 'User not found.', data: []};
        }

        const endpoints = {
            exhibits: (typeof EXHIBITS_ENDPOINTS !== 'undefined') ? EXHIBITS_ENDPOINTS : {},
            users: (typeof USERS_ENDPOINTS !== 'undefined') ? USERS_ENDPOINTS : {},
            indexer: (typeof INDEXER_ENDPOINTS !== 'undefined') ? INDEXER_ENDPOINTS : {},
            media_library: (typeof MEDIA_LIBRARY_ENDPOINTS !== 'undefined') ? MEDIA_LIBRARY_ENDPOINTS : {}
        };

        const auth_data = {user_data: data, endpoints: endpoints};
        LOGGER.module().debug(`DEBUG: [/auth/model (get_auth_user_data)] user data retrieved successfully for id: ${numeric_id}`);

        return {status: 200, message: 'User data retrieved.', data: auth_data};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model (get_auth_user_data)] unable to get user auth data: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/auth/model (get_auth_user_data)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to retrieve user data.', data: []};
    }
};

/**
 * Saves authentication token to user table (optimized)
 * @param {number|string} id - User ID
 * @param {string} token - Authentication token to save
 * @returns {Object} - {status: number, message: string, data: boolean}
 */
exports.save_token = async function (id, token) {

    try {
        if (id === null || id === undefined) {
            LOGGER.module().warn('WARNING: [/auth/model (save_token)] id parameter is null or undefined');
            return {status: 400, message: 'Invalid user ID provided.', data: false};
        }

        if (typeof id === 'string' && id.trim().length === 0) {
            LOGGER.module().warn('WARNING: [/auth/model (save_token)] id parameter is empty string');
            return {status: 400, message: 'Invalid user ID provided.', data: false};
        }

        const numeric_id = Number(id);
        if (isNaN(numeric_id) || !Number.isInteger(numeric_id) || numeric_id <= 0) {
            LOGGER.module().warn(`WARNING: [/auth/model (save_token)] invalid id: ${id}`);
            return {status: 400, message: 'Invalid user ID format.', data: false};
        }

        if (!token || typeof token !== 'string') {
            LOGGER.module().warn('WARNING: [/auth/model (save_token)] invalid token parameter');
            return {status: 400, message: 'Invalid token provided.', data: false};
        }

        const trimmed_token = token.trim();
        if (trimmed_token.length === 0 || trimmed_token.length < 10 || trimmed_token.length > 2000) {
            LOGGER.module().warn(`WARNING: [/auth/model (save_token)] invalid token length: ${trimmed_token.length}`);
            return {status: 400, message: 'Invalid token format.', data: false};
        }

        const TASKS = get_auth_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/auth/model (save_token)] failed to get AUTH_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: false};
        }

        if (typeof TASKS.save_token !== 'function') {
            LOGGER.module().error('ERROR: [/auth/model (save_token)] AUTH_TASKS instance missing save_token method');
            return {status: 500, message: 'Unable to save token.', data: false};
        }

        const result = await TASKS.save_token(numeric_id, trimmed_token);

        if (typeof result !== 'boolean' || result === false) {
            LOGGER.module().warn(`WARNING: [/auth/model (save_token)] failed to save token for user id: ${numeric_id}`);
            return {status: 500, message: 'Unable to save token.', data: false};
        }

        LOGGER.module().debug(`DEBUG: [/auth/model (save_token)] token saved successfully for user id: ${numeric_id}`);

        return {status: 200, message: 'Token saved successfully.', data: true};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model (save_token)] unable to save token: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/auth/model (save_token)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to save token.', data: false};
    }
};

/**
 * Gets all available roles (optimized)
 * @returns {Object} - {status: number, message: string, data: Array}
 */
exports.get_roles = async function () {

    try {
        const TASKS = get_roles_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/auth/model (get_roles)] failed to get ROLES_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: []};
        }

        if (typeof TASKS.get_roles !== 'function') {
            LOGGER.module().error('ERROR: [/auth/model (get_roles)] ROLES_TASKS instance missing get_roles method');
            return {status: 500, message: 'Unable to retrieve roles.', data: []};
        }

        const roles = await TASKS.get_roles();

        if (!Array.isArray(roles)) {
            LOGGER.module().error(`ERROR: [/auth/model (get_roles)] roles result is not an array: ${typeof roles}`);
            return {status: 500, message: 'Unable to retrieve roles.', data: []};
        }

        if (roles.length === 0) {
            LOGGER.module().warn('WARNING: [/auth/model (get_roles)] no roles found in database');
        }

        LOGGER.module().debug(`DEBUG: [/auth/model (get_roles)] retrieved ${roles.length} roles successfully`);

        return {status: 200, message: 'Roles retrieved successfully.', data: roles};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model (get_roles)] unable to get roles: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/auth/model (get_roles)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to retrieve roles.', data: []};
    }
};

/**
 * Gets role for specific user (optimized)
 * @param {number|string} user_id - User ID to get role for
 * @returns {Object} - {status: number, message: string, data: Object|null}
 */
exports.get_user_role = async function (user_id) {

    try {
        if (user_id === null || user_id === undefined) {
            LOGGER.module().warn('WARNING: [/auth/model (get_user_role)] user_id parameter is null or undefined');
            return {status: 400, message: 'Invalid user ID provided.', data: null};
        }

        if (typeof user_id === 'string' && user_id.trim().length === 0) {
            LOGGER.module().warn('WARNING: [/auth/model (get_user_role)] user_id parameter is empty string');
            return {status: 400, message: 'Invalid user ID provided.', data: null};
        }

        const numeric_user_id = Number(user_id);
        if (isNaN(numeric_user_id) || !Number.isInteger(numeric_user_id) || numeric_user_id <= 0) {
            LOGGER.module().warn(`WARNING: [/auth/model (get_user_role)] invalid user_id: ${user_id}`);
            return {status: 400, message: 'Invalid user ID format.', data: null};
        }

        const TASKS = get_roles_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/auth/model (get_user_role)] failed to get ROLES_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: null};
        }

        if (typeof TASKS.get_user_role !== 'function') {
            LOGGER.module().error('ERROR: [/auth/model (get_user_role)] ROLES_TASKS instance missing get_user_role method');
            return {status: 500, message: 'Unable to retrieve user role.', data: null};
        }

        const role = await TASKS.get_user_role(numeric_user_id);

        if (role === null || role === undefined) {
            LOGGER.module().debug(`DEBUG: [/auth/model (get_user_role)] no role found for user id: ${numeric_user_id}`);
            return {status: 404, message: 'User role not found.', data: null};
        }

        LOGGER.module().debug(`DEBUG: [/auth/model (get_user_role)] role retrieved successfully for user id: ${numeric_user_id}`);

        return {status: 200, message: 'User role retrieved successfully.', data: role};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model (get_user_role)] unable to get user role: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/auth/model (get_user_role)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to retrieve user role.', data: null};
    }
};

/**
 * Updates user role assignment (optimized)
 * @param {number|string} user_id - User ID to update
 * @param {number|string} role_id - Role ID to assign
 * @returns {Object} - {status: number, message: string, data: boolean}
 */
exports.update_user_role = async function (user_id, role_id) {

    try {
        if (user_id === null || user_id === undefined) {
            LOGGER.module().warn('WARNING: [/auth/model (update_user_role)] user_id parameter is null or undefined');
            return {status: 400, message: 'Invalid user ID provided.', data: false};
        }

        if (typeof user_id === 'string' && user_id.trim().length === 0) {
            LOGGER.module().warn('WARNING: [/auth/model (update_user_role)] user_id parameter is empty string');
            return {status: 400, message: 'Invalid user ID provided.', data: false};
        }

        const numeric_user_id = Number(user_id);
        if (isNaN(numeric_user_id) || !Number.isInteger(numeric_user_id) || numeric_user_id <= 0) {
            LOGGER.module().warn(`WARNING: [/auth/model (update_user_role)] invalid user_id: ${user_id}`);
            return {status: 400, message: 'Invalid user ID format.', data: false};
        }

        if (role_id === null || role_id === undefined) {
            LOGGER.module().warn('WARNING: [/auth/model (update_user_role)] role_id parameter is null or undefined');
            return {status: 400, message: 'Invalid role ID provided.', data: false};
        }

        if (typeof role_id === 'string' && role_id.trim().length === 0) {
            LOGGER.module().warn('WARNING: [/auth/model (update_user_role)] role_id parameter is empty string');
            return {status: 400, message: 'Invalid role ID provided.', data: false};
        }

        const numeric_role_id = Number(role_id);
        if (isNaN(numeric_role_id) || !Number.isInteger(numeric_role_id) || numeric_role_id <= 0) {
            LOGGER.module().warn(`WARNING: [/auth/model (update_user_role)] invalid role_id: ${role_id}`);
            return {status: 400, message: 'Invalid role ID format.', data: false};
        }

        const TASKS = get_role_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/auth/model (update_user_role)] failed to get ROLE_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: false};
        }

        if (typeof TASKS.update_user_role !== 'function') {
            LOGGER.module().error('ERROR: [/auth/model (update_user_role)] ROLE_TASKS instance missing update_user_role method');
            return {status: 500, message: 'Unable to update user role.', data: false};
        }

        const result = await TASKS.update_user_role(numeric_user_id, numeric_role_id);

        const success = result === true || (typeof result === 'number' && result > 0);

        if (!success) {
            LOGGER.module().warn(`WARNING: [/auth/model (update_user_role)] failed to update role for user id: ${numeric_user_id}`);
            return {status: 500, message: 'Unable to update user role.', data: false};
        }

        LOGGER.module().debug(`DEBUG: [/auth/model (update_user_role)] role updated successfully for user id: ${numeric_user_id}`);

        return {status: 200, message: 'User role updated successfully.', data: true};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/auth/model (update_user_role)] unable to update user role: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/auth/model (update_user_role)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to update user role.', data: false};
    }
};

/**
 * Resets all singleton instances (useful for testing)
 * @returns {void}
 */
exports._reset_all_instances = function () {
    AUTH_TASKS_INSTANCE = null;
    ROLES_TASKS_INSTANCE = null;
    ROLE_TASKS_INSTANCE = null;
    LOGGER.module().debug('DEBUG: [/auth/model] all singleton instances reset');
};

/**
 * Gets initialization status of all singletons (useful for monitoring)
 * @returns {Object} - Status of each singleton instance
 */
exports._get_instances_status = function () {
    return {
        auth_tasks: AUTH_TASKS_INSTANCE !== null,
        roles_tasks: ROLES_TASKS_INSTANCE !== null,
        role_tasks: ROLE_TASKS_INSTANCE !== null
    };
};