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
const HELPER = require("../../libs/helper");

/**
 * Object contains tasks used to manage exhibit item records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_grid_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Creates grid record
     * @param data
     */
    async create_grid_record(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE.grid_records)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (create_grid_record)] ' + result.length + ' Grid record created.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (create_grid_record)] unable to create record ' + error.message);
        }
    }

    /**
     * Gets all grid records by exhibit
     * @param is_member_of_exhibit
     */
    async get_grid_records(is_member_of_exhibit) {

        try {

            return await this.DB(this.TABLE.grid_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_records)] unable to get records ' + error.message);
        }
    }

    /**
     * Gets grid items
     * @param uuid
     */
    async get_grid_item_records(uuid) {

        try {

            return await this.DB(this.TABLE.item_records)
            .select('*')
            .where({
                is_member_of_item_grid: uuid,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_item_records)] unable to get records ' + error.message);
        }
    }

    /**
     * Gets grid record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async get_grid_record(is_member_of_exhibit, uuid) {

        try {

            const data = await this.DB(this.TABLE.grid_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid,
                is_deleted: 0
            });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uuid, this.DB, this.TABLE);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR:[/exhibits/exhibit_grid_record_tasks (get_grid_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_record)] unable to get records ' + error.message);
        }
    }

    /**
     * Updates grid record
     * @param data
     */
    async update_grid_record(data) {

        try {

            await this.DB(this.TABLE.grid_records)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (update_heading_record)] Grid record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] unable to update record ' + error.message);
        }
    }

    /**
     * Deletes grid record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async delete_grid_record(is_member_of_exhibit, uuid) {

        try {

            await this.DB(this.TABLE.grid_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (delete_grid_record)] Grid record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (delete_heading_record)] unable to delete record ' + error.message);
        }
    }

    /**
     * Sets is_published flogs to true
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.grid_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (set_to_publish)] Heading is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (set_to_publish)] unable to set heading is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.grid_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (set_to_suppress)] Grid is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (set_to_suppress)] unable to set grid is_published. ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_grid_record_tasks;
