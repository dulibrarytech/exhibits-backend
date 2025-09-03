/**

 Copyright 2025 University of Denver

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

const VALIDATOR = require('validator');
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLE = DB_TABLES.exhibits; // .user_records
const AUTH = require('../auth/tasks/auth_tasks');
const AUTH_TASKS = new AUTH(DB, TABLE);
const LOGGER = require('../libs/log4');

/**
 * Checks user permission
 * @param options
 * req, permissions, record_type
 */
exports.check_permission = async function (options) {

    try {

        const req = options.req;
        const actions = options.permissions;
        const record_type = options.record_type;
        const parent_id = options.parent_id;
        const child_id = options.child_id;
        const users_admin = options.users;
        let user_role_permissions = [];
        let token = req.headers['x-access-token'];

        if (token === undefined && !VALIDATOR.isJWT(token)) {
            return false;
        }

        // TODO: check option values here

        let user_id = await AUTH_TASKS.get_user_id(token);
        let user_permissions = await AUTH_TASKS.get_user_permissions(token);

        for (let i = 0; i < user_permissions.length; i++) {
            user_role_permissions.push(user_permissions[i].permission_id);
        }

        const all_permissions = await AUTH_TASKS.get_permissions();
        const get_user_permissions = (user_role_permissions, all_permissions) => {
            let result = [];
            result = all_permissions.filter(all => {
                return user_role_permissions.find(arr => {
                    if (all.id === arr) {
                        return arr;
                    }
                });
            });

            return result;
        };

        const user_permissions_found = get_user_permissions(user_role_permissions, all_permissions);
        const user_permission_matches = (actions, user_permissions_found) => {
            let result = [];
            result = user_permissions_found.filter(all => {
                return actions.find(arr => {
                    if (all.permission === arr) {
                        return arr;
                    }
                });
            });

            return result;
        };

        let user_has_permission = user_permission_matches(actions, user_permissions_found);

        // users
        if (user_has_permission.length > 0 && users_admin !== undefined && users_admin === true) {
            console.log('Authorized');
            return true;
        }

        if (user_has_permission.length > 0) {

            let permissions = [];

            for (let i = 0; i < user_has_permission.length; i++) {
                permissions.push(user_has_permission[i].permission);
            }

            if (permissions.length !== actions.length) {

                let record_owner = await AUTH_TASKS.check_ownership(user_id, parent_id, child_id, record_type);

                if (parseInt(user_id) !== parseInt(record_owner)) {
                    return false;
                }
            }

            return true;

        } else {
            return false;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/authorize lib (check_permission)] unable to check permission ' + error.message);
    }
};
