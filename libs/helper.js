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
const VALIDATOR = require('validator');

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
        // TODO: refactor / async/await
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

            try {

                db(table)
                .where({
                    uuid: uuid
                })
                .update({
                    is_locked: 0
                })
                .then(() => {
                    LOGGER.module().info('INFO: [/exhibits/helper (lock_record)] record unlocked.');
                })
                .catch((error) => {
                    LOGGER.module().error('ERROR: [/exhibits/helper (lock_record)] unable to unlock record ' + error.message);
                });

            } catch(error) {
                LOGGER.module().error('ERROR: [/libs/helper (lock_timer)] unable to unlock record ' + error.message);
                return false;
            }

        }, 60000); // 30 min *30
    }

    /**
     * Checks if required env config values are set
     * @param config
     */
    check_config(config) {

        try {

            let obj = {};
            let keys = Object.keys(config);

            keys.map((prop) => {

                if (config[prop].length === 0) {
                    LOGGER.module().error('ERROR: [/config/app_config] ' + prop + ' env is missing config value');
                    return false;
                }

                if (VALIDATOR.isURL(config[prop]) === true) {
                    obj[prop] = encodeURI(config[prop]);
                }

                obj[prop] = VALIDATOR.trim(config[prop]);
            });

            return obj;

        } catch(error) {
            LOGGER.module().error('ERROR: [/libs/helper (check_config)] unable to check config ' + error.message);
            return false;
        }

    }

    /**
     * Orders exhibit items
     * @param uuid
     * @param db
     * @param tables
     */
    async order_exhibit_items(uuid, db, tables) {

        try {

            let heading_order;
            let item_order;
            let grid_order;
            let order = [];

            heading_order = await db(tables.heading_records).select('order').where('is_member_of_exhibit', uuid);
            item_order = await db(tables.item_records).select('order').where('is_member_of_exhibit', uuid);
            grid_order = await db(tables.grid_records).select('order').where('is_member_of_exhibit', uuid);

            const merged = [...heading_order, ...item_order, ...grid_order];

            if (merged.length === 0) {
                return 1;
            }

            for (let i=0;i<merged.length;i++) {
                order.push(merged[i].order);
            }

            const ordered = order.sort((a, b) => {
                return a - b;
            });

            const order_number = ordered.pop();
            return order_number + 1;

        } catch(error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_exhibit_items)] unable to order items ' + error.message);
            return false;
        }
    }

    /**
     * Orders grid items
     * @param uuid
     * @param db
     * @param tables
     */
    async order_grid_items(uuid, db, tables) {

        try {

            let item_order;
            let order = [];

            item_order = await db(tables.item_records).select('order').where('is_member_of_item_grid', uuid);

            if (item_order.length === 0) {
                return 1;
            }

            for (let i=0;i<item_order.length;i++) {
                order.push(item_order[i].order);
            }

            const ordered = order.sort((a, b) => {
                return a - b;
            });

            const order_number = ordered.pop();
            return order_number + 1;

        } catch(error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_grid_items)] unable to order items ' + error.message);
            return false;
        }
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
