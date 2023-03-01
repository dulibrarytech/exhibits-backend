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

const {v4: uuidv4} = require('uuid');
const LOGGER = require('../../libs/log4');

/**
 * Object contains tasks used to create an exhibit record
 * @param DB
 * @param TABLE
 * @type {Create_exhibits_tasks}
 */
const Create_exhibits_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Checks uri to determine if collection already exists
     */
    example = () => {

        let promise = new Promise((resolve, reject) => {

            resolve(true);

            // if error
            reject(false);
        });

        return promise.then((result) => {
            return result;
        }).catch((error) => {
            return error;
        });
    }

    /**
     * Saves record to database
     * @param record
     * @returns boolean
     */
    save_record = (record) => {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
                .insert(record)
                .then((result) => {

                    if (result.length === 1) {
                        resolve(true);
                    }
                })
                .catch((error) => {
                    LOGGER.module().error('ERROR: [/exhibits/tasks (create_exhibits_tasks/save_record)] unable to save exhibit record ' + error.message);
                    reject(false);
                });
        });

        return promise.then(() => {
            return true;
        }).catch(() => {
            return false;
        });
    }
};

module.exports = Create_exhibits_tasks;
