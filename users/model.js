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
const TABLE = DB_TABLES.exhibits.user_records;
const USERS_ROLES_TABLE = DB_TABLES.exhibits.users_roles;
const USER_TASKS = require('../users/tasks/user_tasks');
const ROLE_TASKS = require('../auth/tasks/roles_tasks');
const LOGGER = require('../libs/log4');

// Module-level singleton instances
let USER_TASKS_INSTANCE = null;
let ROLE_TASKS_INSTANCE = null;

/**
 * Gets or creates singleton USER_TASKS instance
 * @returns {Object|null} USER_TASKS instance or null on error
 */
function get_user_tasks_instance() {

    if (USER_TASKS_INSTANCE !== null) {
        return USER_TASKS_INSTANCE;
    }

    if (typeof USER_TASKS === 'undefined' || typeof DB === 'undefined' || typeof TABLE === 'undefined') {
        LOGGER.module().error('ERROR: [/users/model] USER_TASKS, DB, or TABLE is not defined');
        return null;
    }

    try {
        USER_TASKS_INSTANCE = new USER_TASKS(DB, TABLE);
        LOGGER.module().debug('DEBUG: [/users/model] USER_TASKS singleton instance created');
        return USER_TASKS_INSTANCE;
    } catch (error) {
        LOGGER.module().error(`ERROR: [/users/model] failed to create USER_TASKS instance: ${error.message}`);
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
        LOGGER.module().error('ERROR: [/users/model] ROLE_TASKS, DB, or USERS_ROLES_TABLE is not defined');
        return null;
    }

    try {
        ROLE_TASKS_INSTANCE = new ROLE_TASKS(DB, USERS_ROLES_TABLE);
        LOGGER.module().debug('DEBUG: [/users/model] ROLE_TASKS singleton instance created');
        return ROLE_TASKS_INSTANCE;
    } catch (error) {
        LOGGER.module().error(`ERROR: [/users/model] failed to create ROLE_TASKS instance: ${error.message}`);
        return null;
    }
}

/**
 * Gets all users with their roles (optimized)
 * @returns {Object} - {status: number, message: string, data: Array}
 */
exports.get_users = async function () {

    try {

        const USER_TASK = get_user_tasks_instance();
        const ROLE_TASK = get_role_tasks_instance();

        if (!USER_TASK || !ROLE_TASK) {
            LOGGER.module().error('ERROR: [/users/model (get_users)] failed to get task instances');
            return {status: 500, message: 'Server configuration error.', data: []};
        }

        if (typeof USER_TASK.get_users !== 'function' || typeof ROLE_TASK.get_user_role !== 'function') {
            LOGGER.module().error('ERROR: [/users/model (get_users)] required methods missing');
            return {status: 500, message: 'Unable to retrieve users.', data: []};
        }

        const data = await USER_TASK.get_users();

        if (!Array.isArray(data)) {
            LOGGER.module().error(`ERROR: [/users/model (get_users)] users result is not an array: ${typeof data}`);
            return {status: 500, message: 'Unable to retrieve users.', data: []};
        }

        if (data.length === 0) {
            LOGGER.module().debug('DEBUG: [/users/model (get_users)] no users found in database');
            return {status: 200, message: 'User data retrieved.', data: []};
        }

        const users = [];

        for (let i = 0; i < data.length; i++) {
            if (!data[i] || typeof data[i] !== 'object' || !data[i].id) {
                LOGGER.module().warn(`WARNING: [/users/model (get_users)] invalid user object at index ${i}`);
                continue;
            }

            const user_obj = {...data[i]};

            try {
                const role = await ROLE_TASK.get_user_role(data[i].id);

                if (Array.isArray(role) && role.length > 0 && role[0] && role[0].role) {
                    user_obj.role = role[0].role;
                } else {
                    user_obj.role = 'N/A';
                }
            } catch (role_error) {
                LOGGER.module().warn(`WARNING: [/users/model (get_users)] error getting role for user id ${data[i].id}: ${role_error.message}`);
                user_obj.role = 'N/A';
            }

            users.push(user_obj);
        }

        LOGGER.module().debug(`DEBUG: [/users/model (get_users)] retrieved ${users.length} users successfully`);

        return {status: 200, message: 'User data retrieved.', data: users};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/users/model (get_users)] unable to get user profiles: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/users/model (get_users)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to retrieve users.', data: []};
    }
};

/**
 * Gets one user by ID (optimized)
 * @param {number|string} id - User ID to retrieve
 * @returns {Object} - {status: number, message: string, data: Object|null}
 */
exports.get_user = async function (id) {

    try {

        if (id === null || id === undefined) {
            LOGGER.module().warn('WARNING: [/users/model (get_user)] id parameter is null or undefined');
            return {status: 400, message: 'Invalid user ID provided.', data: null};
        }

        if (typeof id === 'string' && id.trim().length === 0) {
            LOGGER.module().warn('WARNING: [/users/model (get_user)] id parameter is empty string');
            return {status: 400, message: 'Invalid user ID provided.', data: null};
        }

        const numeric_id = Number(id);
        if (isNaN(numeric_id) || !Number.isInteger(numeric_id) || numeric_id <= 0 || numeric_id > Number.MAX_SAFE_INTEGER) {
            LOGGER.module().warn(`WARNING: [/users/model (get_user)] invalid id: ${id}`);
            return {status: 400, message: 'Invalid user ID format.', data: null};
        }

        const TASKS = get_user_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/users/model (get_user)] failed to get USER_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: null};
        }

        if (typeof TASKS.get_user !== 'function') {
            LOGGER.module().error('ERROR: [/users/model (get_user)] USER_TASKS instance missing get_user method');
            return {status: 500, message: 'Unable to retrieve user.', data: null};
        }

        const user_data = await TASKS.get_user(numeric_id);

        if (user_data === null || user_data === undefined) {
            LOGGER.module().debug(`DEBUG: [/users/model (get_user)] user not found for id: ${numeric_id}`);
            return {status: 404, message: 'User not found.', data: null};
        }

        if (typeof user_data !== 'object') {
            LOGGER.module().error(`ERROR: [/users/model (get_user)] invalid user data type: ${typeof user_data}`);
            return {status: 500, message: 'Unable to retrieve user.', data: null};
        }

        LOGGER.module().debug(`DEBUG: [/users/model (get_user)] user retrieved successfully for id: ${numeric_id}`);

        return {status: 200, message: 'User data retrieved.', data: user_data};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/users/model (get_user)] unable to get user profile: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/users/model (get_user)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to retrieve user.', data: null};
    }
};

/**
 * Updates user profile and role (optimized)
 * @param {number|string} id - User ID to update
 * @param {Object} user - User data object containing fields to update
 * @returns {Object} - {status: number, message: string, data: Object|null}
 */
exports.update_user = async function (id, user) {

    try {

        if (id === null || id === undefined || (typeof id === 'string' && id.trim().length === 0)) {
            LOGGER.module().warn('WARNING: [/users/model (update_user)] invalid id parameter');
            return {status: 400, message: 'Invalid user ID provided.', data: null};
        }

        const numeric_id = Number(id);
        if (isNaN(numeric_id) || !Number.isInteger(numeric_id) || numeric_id <= 0) {
            LOGGER.module().warn(`WARNING: [/users/model (update_user)] invalid id: ${id}`);
            return {status: 400, message: 'Invalid user ID format.', data: null};
        }

        if (!user || typeof user !== 'object' || Array.isArray(user) || Object.keys(user).length === 0) {
            LOGGER.module().warn('WARNING: [/users/model (update_user)] invalid user parameter');
            return {status: 400, message: 'Invalid user data provided.', data: null};
        }

        const USER_TASK = get_user_tasks_instance();
        const ROLE_TASK = get_role_tasks_instance();

        if (!USER_TASK) {
            LOGGER.module().error('ERROR: [/users/model (update_user)] failed to get USER_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: null};
        }

        if (typeof USER_TASK.update_user !== 'function') {
            LOGGER.module().error('ERROR: [/users/model (update_user)] USER_TASKS instance missing update_user method');
            return {status: 500, message: 'Unable to update user.', data: null};
        }

        let role_id = null;
        let should_update_role = false;

        if (user.hasOwnProperty('role_id')) {
            const numeric_role_id = Number(user.role_id);
            if (!isNaN(numeric_role_id) && Number.isInteger(numeric_role_id) && numeric_role_id > 0) {
                role_id = numeric_role_id;
                should_update_role = true;
            } else {
                LOGGER.module().warn(`WARNING: [/users/model (update_user)] invalid role_id: ${user.role_id}`);
                return {status: 400, message: 'Invalid role ID format.', data: null};
            }
        }

        const user_data = {...user};
        delete user_data.role_id;

        const update_result = await USER_TASK.update_user(numeric_id, user_data);

        if (update_result === false || update_result === null || update_result === undefined) {
            LOGGER.module().warn(`WARNING: [/users/model (update_user)] user update failed for id: ${numeric_id}`);
            return {status: 500, message: 'Unable to update user.', data: null};
        }

        if (should_update_role && ROLE_TASK && typeof ROLE_TASK.update_user_role === 'function') {
            try {
                await ROLE_TASK.update_user_role(numeric_id, role_id);
                LOGGER.module().debug(`DEBUG: [/users/model (update_user)] role updated for user id: ${numeric_id}`);
            } catch (role_error) {
                LOGGER.module().error(`ERROR: [/users/model (update_user)] error updating user role: ${role_error.message}`);
            }
        }

        LOGGER.module().debug(`DEBUG: [/users/model (update_user)] user updated successfully for id: ${numeric_id}`);

        return {status: 201, message: 'User updated.', data: update_result};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/users/model (update_user)] unable to update user data: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/users/model (update_user)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to update user.', data: null};
    }
};

/**
 * Saves new user with role (optimized)
 * @param {Object} user - User object containing user data and role_id
 * @returns {Object} - {status: number, message: string, data: Object|null}
 */
exports.save_user = async function (user) {

    try {

        if (!user || typeof user !== 'object' || Array.isArray(user)) {
            LOGGER.module().warn('WARNING: [/users/model (save_user)] invalid user parameter');
            return {status: 400, message: 'Invalid user data provided.', data: null};
        }

        const required_fields = ['du_id', 'first_name', 'last_name', 'email', 'role_id'];
        for (const field of required_fields) {
            if (!user[field]) {
                LOGGER.module().warn(`WARNING: [/users/model (save_user)] missing required field: ${field}`);
                return {status: 400, message: `Missing required field: ${field}.`, data: null};
            }
        }

        const string_fields = ['du_id', 'first_name', 'last_name', 'email'];
        for (const field of string_fields) {
            if (typeof user[field] === 'string' && user[field].trim().length === 0) {
                LOGGER.module().warn(`WARNING: [/users/model (save_user)] ${field} is empty after trimming`);
                return {status: 400, message: `Invalid ${field} provided.`, data: null};
            }
        }

        const role_id = Number(user.role_id);
        if (!Number.isInteger(role_id) || role_id <= 0) {
            LOGGER.module().warn(`WARNING: [/users/model (save_user)] invalid role_id: ${user.role_id}`);
            return {status: 400, message: 'Invalid role ID format.', data: null};
        }

        const email = String(user.email).trim();
        if (!email.includes('@') || email.length < 5) {
            LOGGER.module().warn(`WARNING: [/users/model (save_user)] invalid email format: ${email}`);
            return {status: 400, message: 'Invalid email format.', data: null};
        }

        const user_tasks = get_user_tasks_instance();
        const role_tasks = get_role_tasks_instance();

        if (!user_tasks || !role_tasks) {
            LOGGER.module().error('ERROR: [/users/model (save_user)] failed to get task instances');
            return {status: 500, message: 'Server configuration error.', data: null};
        }

        if (typeof user_tasks.check_username !== 'function' || typeof user_tasks.save_user !== 'function') {
            LOGGER.module().error('ERROR: [/users/model (save_user)] USER_TASKS instance missing required methods');
            return {status: 500, message: 'Unable to save user.', data: null};
        }

        const is_duplicate = await user_tasks.check_username(user.du_id);

        if (is_duplicate === true) {
            LOGGER.module().info(`INFO: [/users/model (save_user)] user already exists: ${user.du_id}`);
            return {status: 409, message: 'User already exists.', data: false};
        }

        const user_data = {...user};
        delete user_data.role_id;

        const save_result = await user_tasks.save_user(user_data);

        if (!save_result) {
            LOGGER.module().error('ERROR: [/users/model (save_user)] invalid save result from database');
            return {status: 500, message: 'Unable to save user.', data: null};
        }

        let user_id;
        if (Array.isArray(save_result)) {
            if (save_result.length === 0) {
                LOGGER.module().error('ERROR: [/users/model (save_user)] save result array is empty');
                return {status: 500, message: 'Unable to save user.', data: null};
            }
            user_id = Number(save_result[0]);
        } else {
            user_id = Number(save_result);
        }

        if (!Number.isInteger(user_id) || user_id <= 0) {
            LOGGER.module().error(`ERROR: [/users/model (save_user)] invalid user_id from database: ${save_result}`);
            return {status: 500, message: 'Unable to save user.', data: null};
        }

        if (typeof role_tasks.save_user_role === 'function') {
            try {
                const role_saved = await role_tasks.save_user_role(user_id, role_id);
                if (!role_saved) {
                    LOGGER.module().error(`ERROR: [/users/model (save_user)] failed to save user role for user_id: ${user_id}`);
                }
            } catch (role_error) {
                LOGGER.module().error(`ERROR: [/users/model (save_user)] error saving user role: ${role_error.message}`);
            }
        }

        LOGGER.module().debug(`DEBUG: [/users/model (save_user)] user saved successfully with id: ${user_id}`);

        return {
            status: 201,
            message: 'User saved.',
            data: {
                id: user_id,
                du_id: user_data.du_id,
                first_name: user_data.first_name,
                last_name: user_data.last_name,
                email: user_data.email,
                role_id: role_id
            }
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/users/model (save_user)] unable to save user data: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/users/model (save_user)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to save user.', data: null};
    }
};

/**
 * Deletes user by ID (optimized)
 * @param {number|string} user_id - User ID to delete
 * @returns {Object} - {status: number, message: string, data: boolean}
 */
exports.delete_user = async function (user_id) {

    try {
        if (user_id === null || user_id === undefined || (typeof user_id === 'string' && user_id.trim().length === 0)) {
            LOGGER.module().warn('WARNING: [/users/model (delete_user)] invalid user_id parameter');
            return {status: 400, message: 'Invalid user ID provided.', data: false};
        }

        const numeric_user_id = Number(user_id);
        if (isNaN(numeric_user_id) || !Number.isInteger(numeric_user_id) || numeric_user_id <= 0) {
            LOGGER.module().warn(`WARNING: [/users/model (delete_user)] invalid user_id: ${user_id}`);
            return {status: 400, message: 'Invalid user ID format.', data: false};
        }

        const TASKS = get_user_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/users/model (delete_user)] failed to get USER_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: false};
        }

        if (typeof TASKS.delete_user !== 'function') {
            LOGGER.module().error('ERROR: [/users/model (delete_user)] USER_TASKS instance missing delete_user method');
            return {status: 500, message: 'Unable to delete user.', data: false};
        }

        const delete_result = await TASKS.delete_user(numeric_user_id);

        if (typeof delete_result !== 'number') {
            LOGGER.module().error(`ERROR: [/users/model (delete_user)] invalid delete result type: ${typeof delete_result}`);
            return {status: 500, message: 'Unable to delete user.', data: false};
        }

        if (delete_result !== 1) {
            LOGGER.module().warn(`WARNING: [/users/model (delete_user)] user not found or unable to delete for id: ${numeric_user_id}`);
            return {status: 404, message: 'User not found or unable to delete user record.', data: false};
        }

        LOGGER.module().debug(`DEBUG: [/users/model (delete_user)] user deleted successfully for id: ${numeric_user_id}`);

        return {status: 204, message: 'User deleted.', data: true};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/users/model (delete_user)] unable to delete user record: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/users/model (delete_user)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to delete user.', data: false};
    }
};

/**
 * Updates user active status (optimized)
 * @param {number|string} id - User ID
 * @param {number|boolean|string} is_active - Active status (1/0, true/false, '1'/'0')
 * @returns {Object} - {status: number, message: string, data: boolean}
 */
exports.update_status = async function (id, is_active) {

    try {

        if (id === null || id === undefined || (typeof id === 'string' && id.trim().length === 0)) {
            LOGGER.module().warn('WARNING: [/users/model (update_status)] invalid id parameter');
            return {status: 400, message: 'Invalid user ID provided.', data: false};
        }

        const numeric_id = Number(id);
        if (isNaN(numeric_id) || !Number.isInteger(numeric_id) || numeric_id <= 0) {
            LOGGER.module().warn(`WARNING: [/users/model (update_status)] invalid id: ${id}`);
            return {status: 400, message: 'Invalid user ID format.', data: false};
        }

        if (is_active === null || is_active === undefined) {
            LOGGER.module().warn('WARNING: [/users/model (update_status)] is_active parameter is null or undefined');
            return {status: 400, message: 'Invalid status value provided.', data: false};
        }

        let status_value;
        if (typeof is_active === 'boolean') {
            status_value = is_active ? 1 : 0;
        } else if (typeof is_active === 'number') {
            if (is_active === 0 || is_active === 1) {
                status_value = is_active;
            } else {
                LOGGER.module().warn(`WARNING: [/users/model (update_status)] invalid numeric is_active: ${is_active}`);
                return {status: 400, message: 'Invalid status value. Must be 0 or 1.', data: false};
            }
        } else if (typeof is_active === 'string') {
            const trimmed = is_active.trim();
            if (trimmed === '0' || trimmed === 'false' || trimmed === 'False') {
                status_value = 0;
            } else if (trimmed === '1' || trimmed === 'true' || trimmed === 'True') {
                status_value = 1;
            } else {
                LOGGER.module().warn(`WARNING: [/users/model (update_status)] invalid string is_active: ${is_active}`);
                return {status: 400, message: 'Invalid status value. Must be 0, 1, true, or false.', data: false};
            }
        } else {
            LOGGER.module().warn(`WARNING: [/users/model (update_status)] invalid is_active type: ${typeof is_active}`);
            return {status: 400, message: 'Invalid status value type.', data: false};
        }

        const TASKS = get_user_tasks_instance();
        if (!TASKS) {
            LOGGER.module().error('ERROR: [/users/model (update_status)] failed to get USER_TASKS instance');
            return {status: 500, message: 'Server configuration error.', data: false};
        }

        if (typeof TASKS.update_status !== 'function') {
            LOGGER.module().error('ERROR: [/users/model (update_status)] USER_TASKS instance missing update_status method');
            return {status: 500, message: 'Unable to update user status.', data: false};
        }

        const update_result = await TASKS.update_status(numeric_id, status_value);

        if (update_result === false || update_result === null || update_result === undefined) {
            LOGGER.module().warn(`WARNING: [/users/model (update_status)] status update failed for user id: ${numeric_id}`);
            return {status: 500, message: 'Unable to update user status.', data: false};
        }

        LOGGER.module().debug(`DEBUG: [/users/model (update_status)] status updated successfully for user id: ${numeric_id} to ${status_value}`);

        return {status: 200, message: 'User status updated.', data: true};

    } catch (error) {
        LOGGER.module().error(`ERROR: [/users/model (update_status)] unable to update user status: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            LOGGER.module().debug(`DEBUG: [/users/model (update_status)] stack trace: ${error.stack}`);
        }
        return {status: 500, message: 'Unable to update user status.', data: false};
    }
};

/**
 * Resets all singleton instances (useful for testing)
 * @returns {void}
 */
exports._reset_all_instances = function () {
    USER_TASKS_INSTANCE = null;
    ROLE_TASKS_INSTANCE = null;
    LOGGER.module().debug('DEBUG: [/users/model] all singleton instances reset');
};

/**
 * Gets initialization status of all singletons (useful for monitoring)
 * @returns {Object} - Status of each singleton instance
 */
exports._get_instances_status = function () {
    return {
        user_tasks: USER_TASKS_INSTANCE !== null,
        role_tasks: ROLE_TASKS_INSTANCE !== null
    };
};