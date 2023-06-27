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
 * Object contains tasks used to manage trashed records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Trashed_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Gets trashed exhibit records
     * @return {Promise<unknown | boolean>}
     */
    get_trashed_exhibit_records() {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE.exhibit_records)
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
                is_published: 0,
                is_deleted: 1
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (get_trashed_exhibit_records)] unable to get records ' + error.message);
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
     * Gets trashed heading records
     * @return {Promise<unknown | boolean>}
     */
    get_trashed_heading_records() {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE.heading_records)
            .select('is_member_of_exhibit',
                'uuid',
                'type',
                'text',
                'subtext',
                'order',
                'is_published',
                'is_locked',
                'created'
            )
            .where({
                is_published: 0,
                is_deleted: 1
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (get_trashed_heading_records)] unable to get records ' + error.message);
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
     * Gets trashed item records
     * @return {Promise<unknown | boolean>}
     */
    get_trashed_item_records() {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE.item_records)
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
                is_published: 0,
                is_deleted: 1
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (get_trashed_item_records)] unable to get records ' + error.message);
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
     * Permanently deletes trashed record
     * @param is_member_of_exhibit
     * @param uuid
     * @return {Promise<unknown | boolean>}
     */
    delete_trashed_record(is_member_of_exhibit, uuid) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .delete()
            .then(() => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_trashed_record_tasks (delete_trashed_record)] Record permanently deleted.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (delete_trashed_record)] unable to delete record ' + error.message);
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
     * Restores trashed records
     * @param uuid
     * @return {Promise<unknown | boolean>}
     */
    restore_trashed_record(uuid) {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .where({
                uuid: uuid
            })
            .update({
                is_deleted: 0
            })
            .then(() => {
                LOGGER.module().info('INFO: [/exhibits/exhibit_trashed_record_tasks (restore_trashed_record)] Trashed record restored.');
                resolve(true);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (restore_trashed_record)] unable to restore record ' + error.message);
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

module.exports = Trashed_record_tasks;
