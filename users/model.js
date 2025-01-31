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
const USER_TASKS = require('../users/tasks/user_tasks');
const LOGGER = require('../libs/log4');

/**
 * Gets all users
 */
exports.get_users = async function () {

    try {

        const TASKS = new USER_TASKS(DB, TABLE);
        return {
            status: 200,
            message: 'User data retrieved.',
            data: await TASKS.get_users()
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
        LOGGER.module().error('ERROR: [/users/model (update_user)] unable to update user ' + error.message);
        return false;
    }
};

/**
 * Updates user data
 * @param id
 * @param user
 * @param callback
 */
/*
exports.update_user = function (id, user, callback) {

    (async () => {

        const TASKS = new USER_TASKS(DB, TABLE);
        const data = await TASKS.update_user(id, user);
        let response = {
            status: 201,
            message: 'User record updated.',
            data: data
        };

        if (data === false) {
            response = {
                status: 400,
                message: 'Unable to update user record.',
                data: []
            }
        }

        callback(response);
    })();
};
*/

/**
 * Saves user data
 * @param user
 * @param callback
 */
/*
exports.save_user = function (user, callback) {

    (async () => {

        const TASKS = new USER_TASKS(DB, TABLE);
        const data = await TASKS.save_user(user);

        let response = {
            status: 201,
            message: 'User record saved.',
            data: data
        };

        if (data === false) {
            response = {
                status: 500,
                message: 'Unable to save user record.',
                data: []
            }
        }

        callback(response);
    })();
};
*/

/**
 * Deletes user data
 * @param id
 * @param callback
 */
/*
exports.delete_user = function (id, callback) {

    (async () => {

        const TASKS = new USER_TASKS(DB, TABLE);
        const data = await TASKS.delete_user(id);

        let response = {
            status: 204,
            message: 'User record deleted.'
        };

        if (data === false) {
            response = {
                status: 500,
                message: 'Unable to delete user record.'
            }
        }

        callback(response);
    })();
};

 */

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
