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
const AUTH_TASKS = require("../auth/tasks/auth_tasks");
const EXHIBITS_ENDPOINTS = require('../exhibits/endpoints')();
const USERS_ENDPOINTS = require('../users/endpoints')();
const INDEXER_ENDPOINTS = require('../indexer/endpoints')();
const LOGGER = require('../libs/log4');

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
        const DATA = await TASKS.get_auth_user_data(id);
        let auth_data = {
            user_data: DATA,
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

        if (DATA === false) {
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
