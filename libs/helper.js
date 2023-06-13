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
const LOGGER = require('../libs/log4');

/**
 * Object contains helper tasks
 * @type {Helper}
 */
const Helper = class {

    constructor() {}

    /**
     * Generates uuid
     * @returns Promise string
     */
    create_uuid() {

        try {
            return uuidv4();
        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (create_uuid)] unable to generate uuid ' + error.message);
            return false;
        }
    }

    /**
     * Locks record
     * @param uuid
     * @param db
     * @param table
     */
    lock_record(uuid, db, table){

        let promise = new Promise((resolve, reject) => {

            db(table)
            .where({
                uuid: uuid
            })
            .update({
                is_locked: 1
            })
            .then((data) => {
                LOGGER.module().info('INFO: [/exhibits/helper (lock_record)] record locked.');
                this.lock_timer(uuid, db, table);
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/helper (lock_record)] unable to lock record ' + error.message);
                reject(false);
            });
        });

        return promise.then((result) => {
            return result;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Unlocks record after a period of inactivity
     * @param uuid
     * @param db
     * @param table
     */
    lock_timer(uuid, db, table) {

        setTimeout(() => {

            db(table)
            .where({
                uuid: uuid
            })
            .update({
                is_locked: 0
            })
            .then((data) => {
                LOGGER.module().info('INFO: [/exhibits/helper (lock_record)] record unlocked.');
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/helper (lock_record)] unable to unlock record ' + error.message);
            });
        }, 60000*30); // 30 min
    }

    /**
     * Converts byte size to human readable format
     * @param bytes
     * @param decimals
     * @return {string|{batch_size: number, size_type: string}}
     */
    format_bytes(bytes, decimals = 2) {

        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return {
            size_type:sizes[i],
            batch_size: parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
        };
    };
};

module.exports = Helper;
