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
const EXHIBITS_ENDPOINTS = require('../exhibits/endpoints')();
const USERS_ENDPOINTS = require('../users/endpoints')();
const INDEXER_ENDPOINTS = require('../indexer/endpoints')();
const LOGGER = require('../libs/log4');
const ROLE_TASKS = require("./tasks/roles_tasks");

/**
 * Checks auth user
 * @param username
 */
exports.check_auth_user = async function (username) {

    try {

        const TASKS = new AUTH_TASKS(DB, TABLE);
        return await TASKS.check_auth_user(username);

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/model (check_auth_user)] unable to check user auth data ' + error.message);
        return false;
    }
};

/**
 * Gets user auth data
 * @param id
 */
exports.get_auth_user_data = async function (id) {

    try {

        const TASKS = new AUTH_TASKS(DB, TABLE);
        const data = await TASKS.get_auth_user_data(id);
        let auth_data = {
            user_data: data,
            endpoints: {
                exhibits: EXHIBITS_ENDPOINTS,
                users: USERS_ENDPOINTS,
                indexer: INDEXER_ENDPOINTS
            }
        };

        let response = {
            status: 200,
            message: 'User data retrieved.',
            data: auth_data
        };

        if (data === false) {
            response = {
                status: 500,
                message: 'Unable to retrieve user data.',
                data: []
            };
        }

        return response;

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/model (get_auth_user_data)] unable to get user auth data ' + error.message);
        return false;
    }
};

/**
 * Saves token to user table
 * @param id
 * @param token
 */
exports.save_token = async function (id, token) {

    try {

        const TASKS = new AUTH_TASKS(DB, TABLE);
        return await TASKS.save_token(id, token);

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/model (save_token)] unable to save token ' + error.message);
        return false;
    }
};

/**
 * Gets roles
 */
exports.get_roles = async function () {

    try {

        const TASKS = new ROLES_TASKS(DB, TABLE);
        return {
            status: 200,
            data: await TASKS.get_roles()
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/model (get_roles)] unable to get roles ' + error.message);
        return false;
    }
};

/**
 * Gets user role
 * @param user_id
 */
exports.get_user_role = async function (user_id) {

    try {

        const TASKS = new ROLES_TASKS(DB, TABLE);
        return {
            status: 200,
            data: await TASKS.get_user_role(user_id)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/model (get_user_role)] unable to get user role ' + error.message);
        return false;
    }
};

exports.update_user_role = async function (user_id, role_id) {

    try {

        const ROLE_TASK = new ROLE_TASKS(DB, USERS_ROLES_TABLE);
        return {
            status: 200,
            data: await ROLE_TASK.update_user_role(user_id, role_id)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/model (update_user_role)] unable to update user role ' + error.message);
        return false;
    }
};
