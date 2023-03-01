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
const TABLE = DB_TABLES.exhibits.exhibits_records;
const CREATE_EXHIBITS_TASKS = require('../exhibits/tasks/create_exhibits_tasks');
const LOGGER = require('../libs/log4');

/**
 * Creates exhibit record
 * @param is_member_of_exhibit
 * @param callback
 * @returns callback
 */
exports.create_exhibit_record = (is_member_of_exhibit, callback) => {

    const TASKS = new CREATE_EXHIBITS_TASKS(DB, TABLE);

    (async () => {

        try {

            // TODO:
            let data;

            callback({
                status: 201,
                message: 'Exhibit record created',
                data: data
            });


        } catch (error) {

            callback({
                status: 200,
                message: 'Unable to create collection record ' + error.message
            });
        }

    })();
};
