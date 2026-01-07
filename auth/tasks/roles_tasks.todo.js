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

const LOGGER = require('../../libs/log4');

/**
 * Roles record tasks
 * @type {Roles_tasks}
 */
const Roles_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Gets all roles
     * @returns {Promise<Array|boolean>} Array of roles or false on error
     */
    async get_roles() {

        try {

            return await this.DB(this.TABLE.roles_records)
                .select('id', 'role', 'description');

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_roles)] unable to get roles ' + error.message);
            return false;
        }
    }

    /**
     * Gets user role by user ID
     * @param {string} user_id
     * @returns {Promise<Array|boolean>} User role data or false on error
     */
    async get_user_role(user_id) {

        if (user_id === undefined || user_id === null) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_user_role)] missing user_id parameter');
            return false;
        }

        try {

            return await this.DB(this.TABLE.user_roles)
                .select(
                    'cur.user_id',
                    'cur.role_id',
                    'ur.role'
                )
                .from(this.TABLE.user_roles + ' AS cur')
                .leftJoin(this.TABLE.roles_records + ' AS ur', 'cur.role_id', 'ur.id')
                .where('cur.user_id', user_id);

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_user_role)] unable to get user role ' + error.message);
            return false;
        }
    }

    /**
     * Saves user role data
     * @param {string} user_id
     * @param {number} role_id
     * @returns {Promise<boolean>} true on success, false on error
     */
    async save_user_role(user_id, role_id) {

        if (user_id === undefined || user_id === null) {
            LOGGER.module().error('ERROR: [/users/tasks (save_user_role)] missing user_id parameter');
            return false;
        }

        if (role_id === undefined || role_id === null) {
            LOGGER.module().error('ERROR: [/users/tasks (save_user_role)] missing role_id parameter');
            return false;
        }

        try {

            await this.DB(this.TABLE.user_roles)
                .insert({
                    user_id: user_id,
                    role_id: role_id
                });

            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (save_user_role)] unable to save user role data ' + error.message);
            return false;
        }
    }

    /**
     * Updates user role
     * @param {string} user_id
     * @param {number} role_id
     * @returns {Promise<boolean>} true on success, false on error
     */
    async update_user_role(user_id, role_id) {

        if (user_id === undefined || user_id === null) {
            LOGGER.module().error('ERROR: [/users/tasks (update_user_role)] missing user_id parameter');
            return false;
        }

        if (role_id === undefined || role_id === null) {
            LOGGER.module().error('ERROR: [/users/tasks (update_user_role)] missing role_id parameter');
            return false;
        }

        try {

            await this.DB(this.TABLE.user_roles)
                .where({
                    user_id: user_id
                })
                .update({
                    role_id: role_id
                });

            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (update_user_role)] unable to update user role data ' + error.message);
            return false;
        }
    }
};

module.exports = Roles_tasks;
