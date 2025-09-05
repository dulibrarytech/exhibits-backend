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

/**
 * Gets all users
 */
exports.get_users = async function () {

    try {

        const TASKS = new USER_TASKS(DB, TABLE);
        let data = await TASKS.get_users();

        const ROLE_TASK = new ROLE_TASKS(DB, USERS_ROLES_TABLE);
        let role;
        let users = [];

        for (let i=0;i<data.length;i++) {

            let obj = data[i];
            role = await ROLE_TASK.get_user_role(data[i].id);

            if (role.length > 0) {
                obj.role = role[0].role;
            } else {
                obj.role = 'N/A';
            }

            users.push(obj);
        }

        return {
            status: 200,
            message: 'User data retrieved.',
            data: users
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/users/model (get_users)] unable to get user profiles ' + error.message);
        return false;
    }
};

/**
 * Gets one user
 * @param id
 */
exports.get_user = async function (id) {

    try {

        const TASKS = new USER_TASKS(DB, TABLE);
        return {
            status: 200,
            message: 'User data retrieved.',
            data: await TASKS.get_user(id)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/users/model (get_user)] unable to get user profile ' + error.message);
        return false;
    }
};

/**
 * Updates user profile
 * @param id
 * @param user
 */
exports.update_user = async function (id, user) {

    try {

        const TASKS = new USER_TASKS(DB, TABLE);
        const data = await TASKS.update_user(id, user);

        return {
            status: 201,
            message: 'User updated.',
            data: data
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/users/model (update_user)] unable to update user data' + error.message);
        return false;
    }
};

/**
 * Saves user data
 * @param user
 */
exports.save_user = async function (user) {

    try {

        const TASKS = new USER_TASKS(DB, TABLE);
        const ROLE_TASK = new ROLE_TASKS(DB, USERS_ROLES_TABLE);
        const is_duplicate = await TASKS.check_username(user.du_id);

        if (is_duplicate === true) {

            LOGGER.module().info('INFO: [/users/model (save_user)] user already exists');

            return {
                status: 200,
                message: 'User already exists.'
            };
        }

        const role_id = parseInt(user.role_id);
        delete user.role_id;

        const data = await TASKS.save_user(user);
        const user_id = parseInt(data.pop());

        await ROLE_TASK.save_user_role(user_id, role_id);

        if (typeof data === 'object') {

            return {
                status: 201,
                message: 'User saved.',
                data: [user_id]
            };

        } else {
            return {
                status: 200,
                message: 'User not saved.',
                data: data
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/users/model (save_user)] unable to save user data' + error.message);
        return false;
    }
};

/**
 * Deletes user
 * @param user_id
 */
exports.delete_user = async function (user_id) {

    try {

        const TASKS = new USER_TASKS(DB, TABLE);
        const data = await TASKS.delete_user(user_id);

        if (data !== 1) {
            return {
                status: 200,
                message: 'Unable to delete user record.'
            };
        }

        return {
            status: 204,
            message: 'User deleted.'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/users/model (delete_user)] unable to delete user record' + error.message);
        return false;
    }
};

/**
 * Updates user status
 * @param id
 * @param is_active
 */
exports.update_status = async function (id, is_active) {

    try {

        const TASKS = new USER_TASKS(DB, TABLE);
        await TASKS.update_status(id, is_active);
        return {
            status: 200,
            message: 'User status updated.'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/users/model (update_status)] unable to get user profiles ' + error.message);
        return false;
    }
};
