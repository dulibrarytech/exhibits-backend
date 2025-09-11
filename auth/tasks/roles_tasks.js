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
     * Checks user access
     */
    async get_roles() {

        try {

            return await this.DB(this.TABLE.roles_records)
                .select('id', 'role', 'description');

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_roles)] unable to get roles ' + error.message);
        }
    }

    /**
     * Gets user role
     * @param user_id
     */
    async get_user_role(user_id) {

        try {

            return await this.DB.select(
                'cur.user_id',
                'cur.role_id',
                'ur.role'
            ).from('ctbl_user_roles AS cur')
                .leftJoin('tbl_user_roles AS ur', 'cur.role_id', 'ur.id')
                .where('cur.user_id', '=', user_id);

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_user_role)] unable to get user role ' + error.message);
        }
    }

    /**
     * Saves user role data
     * @param user_id
     * @param role_id
     */
    async save_user_role(user_id, role_id) {

        try {

            return await this.DB(this.TABLE)
                .insert({
                    user_id: user_id,
                    role_id: role_id
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (save_user_role)] unable to save user role data ' + error.message);
            return error.sqlMessage;
        }
    }

    async update_user_role(user_id, role_id) {

        try {

            return this.DB(this.TABLE)
                .where({
                    user_id: user_id
                })
                .update({
                    role_id: role_id
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (save_user_role)] unable to update user role data ' + error.message);
        }
    }
};

module.exports = Roles_tasks;
