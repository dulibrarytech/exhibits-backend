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

const LOGGER = require('../../libs/log4');

/**
 * Auth record tasks
 * @type {Auth_tasks}
 */
const Auth_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Checks user access
     * @param username
     */
    async check_auth_user(username) {

        try {

            const data = await this.DB(this.TABLE)
            .select('id')
            .where({
                du_id: username,
                is_active: 1
            });

            if (data.length === 1) {

                return {
                    auth: true,
                    data: data[0].id
                };

            } else {

                return {
                    auth: false,
                    data: []
                };
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (check_auth_user)] unable to check auth ' + error.message);
        }
    };

    /**
     * Gets user data
     * @param id
     */
    async get_auth_user_data(id) {

        try {

            const data = await this.DB(this.TABLE)
            .select('id', 'du_id', 'email', 'first_name', 'last_name')
            .where({
                id: id,
                is_active: 1
            });

            if (data.length === 1) {

                return {
                    data: data
                };

            } else {
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_auth_user_data)] unable to get user data ' + error.message);
        }
    };

    /**
     * Saves token
     * @param user_id
     * @param token
     */
    async save_token(user_id, token) {

        try {

            await this.DB(this.TABLE)
                .where({
                    id: user_id
                })
                .update({
                    token: token
                });

            LOGGER.module().info('INFO: [/auth/tasks (save_token)] Token saved.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (save_token)] unable to save token ' + error.message);
            return false;
        }
    }

    async get_user_permissions(token) {

        try {

            return await this.DB.select(
                    'u.id',
                    'ur.role_id',
                    'rp.permission_id'
                ).from('tbl_users AS u')
                    .leftJoin('ctbl_user_roles AS ur', 'ur.user_id', 'u.id')
                    .leftJoin('ctbl_role_permissions AS rp', 'rp.role_id', 'ur.role_id')
                    .where('u.token', '=', token);

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_user_permissions)] unable to get user permissions ' + error.message);
        }
    }

    async get_role_permissions(permission_type) {

        try {

            return await this.DB('tbl_user_permissions')
                .select('id', 'permission')
                .where({
                    type: permission_type
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_role_permissions)] unable to get role permissions ' + error.message);
        }
    }
};

module.exports = Auth_tasks;
