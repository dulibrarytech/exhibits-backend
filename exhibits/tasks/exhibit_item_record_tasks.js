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
     */
    async create_item_record(data) {

        try {

            await this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE.item_records)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (create_item_record)] unable to create record ' + error.message);
        }
    }

    /** TODO: refactor based on updated schema
     * Gets item records by exhibit
     * @param is_member_of_exhibit
     */
    async get_item_records(is_member_of_exhibit) {

        try {

            return await this.DB(this.TABLE.item_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_records)] unable to get records ' + error.message);
        }
    }

    /**
     * Gets item record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async get_item_record(is_member_of_exhibit, uuid) {

        try {

            const data = await this.DB(this.TABLE.item_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid,
                is_deleted: 0
            });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uuid, this.DB, this.TABLE.item_records);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] unable to get records ' + error.message);
        }
    }

    /**
     * Updates item record
     * @param data
     */
    async update_item_record(data) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (update_item_record)] Item record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (update_item_record)] unable to update record ' + error.message);
        }
    }

    /**
     * "Deletes" item record (sets to inactive)
     * @param is_member_of_exhibit
     * @param item_id
     * @param type
     */
    async delete_item_record(is_member_of_exhibit, item_id, type) {

        try {

            let table;

            if (type === 'item') {
                table = this.TABLE.item_records;
            } else if (type === 'grid') {
                table = this.TABLE.grid_records;
            } else if (type === 'heading') {
                table = this.TABLE.heading_records;
            } else {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (delete_item_record)] unable to determine item type');
                return false;
            }

            await this.DB(table)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: item_id
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (delete_item_record)] Item record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (delete_item_record)] unable to delete record ' + error.message);
        }
    }

    /**
     * Gets item record count
     * @param uuid
     */
    async get_record_count(uuid) {

        try {

            const count = await this.DB(this.TABLE.item_records).count('id as count')
            .where({
                is_member_of_exhibit: uuid
            });

            return count[0].count;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_record_count)] unable to get item record count ' + error.message);
        }
    }

    /**
     * Sets is_published flogs to true
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_to_publish)] Item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_to_publish)] unable to set item is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to true
     * @param item_id
     */
    async set_item_to_publish(item_id) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                uuid: item_id
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_item_to_publish)] Item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_item_to_publish)] unable to set item is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_to_suppress)] Item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_to_suppress)] unable to set item is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to false
     * @param uuid
     */
    async set_item_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_item_to_suppress)] Item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_item_to_suppress)] unable to set item is_published. ' + error.message);
            return false;
        }
    }
    /**
     * Deletes item media value
     * @param uuid
     * @param media
     */
    async delete_media_value(uuid, media) {

        try {

            let update = {};
            let tmp = media.split('_');
            let image = tmp.pop();

            if (image.indexOf('media') !== -1) {
                update.media = '';
            } else if (image.indexOf('thumbnail') !== -1) {
                update.thumbnail = '';
            }

            await this.DB(this.TABLE.item_records)
            .where({
                uuid: uuid
            })
            .update(update);

            LOGGER.module().info('INFO: [/exhibits/item_record_tasks (delete_media_value)] Media value deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/item_record_tasks (delete_media_value)] unable to delete media value ' + error.message);
            return false;
        }
    }

};

module.exports = Exhibit_item_record_tasks;
