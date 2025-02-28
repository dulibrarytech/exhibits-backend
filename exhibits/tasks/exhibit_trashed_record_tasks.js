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
     */
    async get_trashed_exhibit_records() {

        try {

            return await this.DB(this.TABLE.exhibit_records)
            .select('*')
            .where({
                is_published: 0,
                is_deleted: 1
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (get_trashed_exhibit_records)] unable to get trashed records ' + error.message);
        }
    }

    /**
     * Gets trashed heading records
     */
    async get_trashed_heading_records() {

        try {

            return await this.DB(this.TABLE.heading_records)
            .select('*')
            .where({
                is_published: 0,
                is_deleted: 1
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (get_trashed_heading_records)] unable to get trashed heading records ' + error.message);
        }
    }

    /**
     * Gets trashed item records
     */
    async get_trashed_item_records() {

        try {

            return await this.DB(this.TABLE.item_records)
            .select('*')
            .where({
                is_published: 0,
                is_deleted: 1
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (get_trashed_item_records)] unable to get trashed item records ' + error.message);
        }
    }

    /**
     * Permanently deletes trashed record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async delete_trashed_record(is_member_of_exhibit, uuid) {

        try {

            await this.DB(this.TABLE)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .delete();

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (delete_trashed_record)] unable to permanently delete record ' + error.message);
        }
    }

    /**
     * Permanently deletes all trashed records
     */
    async delete_all_trashed_records() {

        try {

            await this.DB(this.TABLE)
            .where({
                is_published: 0,
                is_deleted: 1
            })
            .delete();

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (delete_all_trashed_records)] unable to delete all records ' + error.message);
        }
    }

    /**
     * Restores trashed records
     * @param is_member_of_exhibit
     * @param uuid
     */
    async restore_trashed_record(is_member_of_exhibit, uuid) {

        try {

            await this.DB(this.TABLE)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .update({
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_trashed_record_tasks (restore_trashed_record)] unable to restore record ' + error.message);
        }
    }
};

module.exports = Trashed_record_tasks;
