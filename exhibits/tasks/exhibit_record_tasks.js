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

const HELPER = require('../../libs/helper');
const LOGGER = require('../../libs/log4');

/**
 * Object contains tasks used to manage exhibit records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Creates exhibit record
     * @param data
     * @return {Promise<unknown | boolean>}
     */
    create_exhibit_record(data) {

        let promise = new Promise((resolve, reject) => {

            this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            })
            .then((data) => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (create_exhibit_record)] ' + data.length + ' Exhibit record created.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] unable to create record ' + error.message);
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
     * Gets all active exhibit records
     * @return {Promise<unknown | boolean>}
     */
    get_exhibit_records() {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .select('uuid',
                'type',
                'title',
                'subtitle',
                'banner',
                'hero_image',
                'description',
                'page_layout',
                'template',
                'styles',
                'is_published',
                'created'
            )
            .where({
                is_deleted: 0
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_records)] unable to get records ' + error.message);
                reject(false);
            });
        });

        return promise.then((records) => {
            return records;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Gets exhibit record by uuid
     * @param uuid
     * @return {Promise<unknown | boolean>}
     */
    get_exhibit_record(uuid) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .select('uuid',
                'type',
                'title',
                'subtitle',
                'banner',
                'hero_image',
                'description',
                'page_layout',
                'template',
                'styles',
                'is_published',
                'is_locked',
                'created'
            )
            .where({
                uuid: uuid,
                is_deleted: 0
            })
            .then(async (data) => {

                if (data.length !== 0 && data[0].is_locked === 0) {

                    try {

                        const HELPER_TASK = new HELPER();
                        await HELPER_TASK.lock_record(uuid, this.DB, this.TABLE);
                        resolve(data);

                    } catch (error) {
                        LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to lock record ' + error.message);
                    }

                } else {
                    resolve(data);
                }
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to get records ' + error.message);
                reject(false);
            });
        });

        return promise.then((record) => {
            return record;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Updates record
     * @param data
     * @return {Promise<unknown | boolean>}
     */
    update_exhibit_record(data) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .where({
                uuid: data.uuid
            })
            .update(data)
            .then(() => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (update_exhibit_record)] Exhibit record updated.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (update_exhibit_record)] unable to update record ' + error.message);
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
     * Deletes exhibit record
     * @param uuid
     * @return {Promise<unknown | boolean>}
     */
    delete_exhibit_record(uuid) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .where({
                uuid: uuid
            })
            .update({
                is_deleted: 1
            })
            .then(() => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (delete_exhibit_record)] Exhibit record deleted.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (delete_item_record)] unable to delete record ' + error.message);
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
     * Permanently deletes record
     * @param uuid
     * @return {Promise<unknown | boolean>}
     * @private

    delete_exhibit_record_(uuid) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .where({
                uuid: uuid
            })
            .delete()
            .then(() => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (delete_exhibit_record)] Exhibit record deleted.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (delete_item_record)] unable to delete record ' + error.message);
                reject(false);
            });
        });

        return promise.then((result) => {
            return result;
        }).catch(() => {
            return false;
        });
    }
     */
};

module.exports = Exhibit_record_tasks;
