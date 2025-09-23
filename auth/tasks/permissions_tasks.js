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
 * Permissions record tasks
 * @type {Permissions_tasks}
 */
const Permissions_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /** TODO
     * Gets role permissions
     * @param role
     */
    async get_role_permissions(role) {

        try {

            // TODO
            console.log(role);

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_role_permissions)] unable to get role permissions ' + error.message);
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
};

module.exports = Permissions_tasks;
