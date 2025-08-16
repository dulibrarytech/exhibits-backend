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
};

module.exports = Roles_tasks;
