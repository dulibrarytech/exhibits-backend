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
 * Object contains tasks used to manage exhibit heading records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_heading_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Creates exhibit heading record
     * @param data
     */
    async create_heading_record(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE.heading_records)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (create_heading_record)] ' + result.length + ' Heading record created.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (create_heading_record)] unable to create heading record ' + error.message);
        }
    }

    /**
     * Gets all heading records by exhibit
     * @param is_member_of_exhibit
     */
    async get_heading_records(is_member_of_exhibit) {

        try {

            return await this.DB(this.TABLE.heading_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (get_heading_records)] unable to get heading records ' + error.message);
        }
    }

    /**
     * Gets heading record
     * @param is_member_of_exhibit
     * @param uuid
     * @param uid
     */
    async get_heading_record(uid, is_member_of_exhibit, uuid) {

        try {

            const data = await this.DB(this.TABLE.heading_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid,
                is_deleted: 0
            });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uid, uuid, this.DB, this.TABLE.heading_records);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR:[/exhibits/exhibit_heading_record_tasks (get_heading_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (get_heading_record)] unable to get heading records ' + error.message);
        }
    }

    /**
     * Updates item record
     * @param data
     */
    async update_heading_record(data) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (update_heading_record)] Heading record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (update_heading_record)] unable to update heading record ' + error.message);
        }
    }

    /**
     * Deletes heading record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async delete_heading_record(is_member_of_exhibit, uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (delete_heading_record)] Heading record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (delete_heading_record)] unable to delete heading record ' + error.message);
        }
    }

    /**
     * Gets heading record count
     * @param uuid
     */
    async get_record_count(uuid) {

        try {

            const count = await this.DB(this.TABLE.heading_records).count('id as count')
            .where({
                is_member_of_exhibit: uuid
            });

            return count[0].count;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (get_record_count)] unable to get heading record count ' + error.message);
        }
    }

    /**
     * Sets is_published flogs to true for heading records
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
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
     * Sets is_published flog to true
     * @param uuid
     */
    async set_heading_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_heading_to_publish)] Heading is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_heading_to_publish)] unable to set heading is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false for heading records
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (set_to_suppress)] Heading is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (set_to_suppress)] unable to set heading is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to false
     * @param uuid
     */
    async set_heading_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_heading_to_suppress)] Heading is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_heading_to_suppress)] unable to set heading is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Reorders headings
     * @param is_member_of_exhibit
     * @param heading
     */
    async reorder_headings(is_member_of_exhibit, heading) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: heading.uuid
            })
            .update({
                order: heading.order
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (reorder_headings)] Heading reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (reorder_headings)] unable to reorder heading ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_heading_record_tasks;
