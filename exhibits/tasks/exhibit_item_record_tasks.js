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
 * Object contains tasks used to manage exhibit item records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_item_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Creates item record
     * @param data
     * @return {Promise<unknown | boolean>}
     */
    create_item_record(data) {

        let promise = new Promise((resolve, reject) => {

            this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            })
            .then((data) => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (create_item_record)] ' + data.length + ' Item record created.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (create_item_record)] unable to create record ' + error.message);
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
     * Gets item records
     * @param is_member_of_exhibit
     * @return {Promise<unknown | boolean>}
     */
    get_item_records(is_member_of_exhibit) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .select('is_member_of_exhibit',
                'uuid',
                'type',
                'date',
                'title',
                'description',
                'caption',
                'template',
                'item_type',
                'url',
                'text',
                'layout',
                'styles',
                'columns',
                'order',
                'is_published',
                'created'
            )
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_active: 1
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_exhibit_records)] unable to get records ' + error.message);
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
     * Gets item record
     * @param is_member_of_exhibit
     * @param uuid
     * @return {Promise<unknown | boolean>}
     */
    get_item_record(is_member_of_exhibit, uuid) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .select('is_member_of_exhibit',
                'uuid',
                'type',
                'date',
                'title',
                'description',
                'caption',
                'template',
                'item_type',
                'url',
                'text',
                'layout',
                'styles',
                'columns',
                'order',
                'is_published',
                'created'
            )
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid,
                is_active: 1
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_exhibit_records)] unable to get records ' + error.message);
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
     * Updates item record
     * @param data
     * @return {Promise<unknown | boolean>}
     */
    update_item_record(data) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                uuid: data.uuid
            })
            .update(data)
            .then((data) => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (update_item_record)] Item record updated.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (update_item_record)] unable to update record ' + error.message);
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
     * Deletes item record
     * @param is_member_of_exhibit
     * @param uuid
     * @return boolean
     */
    delete_item_record(is_member_of_exhibit, uuid) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .delete()
            .then(() => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (delete_item_record)] Item record deleted.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (delete_item_record)] unable to delete record ' + error.message);
                reject(false);
            });
        });

        return promise.then((result) => {
            return result;
        }).catch(() => {
            return false;
        });
    }
};

module.exports = Exhibit_item_record_tasks;
