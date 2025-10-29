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
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (create_item_record)] unable to create item record ' + error.message);
        }
    }

    /**
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
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_records)] unable to get item records ' + error.message);
        }
    }

    /**
     * Gets item record for standard item details page
     * @param is_member_of_exhibit
     * @param uuid
     * @returns {Promise<awaited Knex.QueryBuilder<TRecord, DeferredKeySelection.AddUnionMember<UnwrapArrayMember<TResult>, undefined>>|null>}
     */
    async get_item_record(is_member_of_exhibit, uuid) {

        /**
         * Validate UUID format (RFC 4122 compliant)
         */
        const is_valid_uuid = (uuid) => {
            if (typeof uuid !== 'string') {
                return false;
            }

            // UUID v4 regex pattern
            const uuid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuid_pattern.test(uuid);
        };

        /**
         * Validate exhibit ID format
         */
        const is_valid_exhibit_id = (exhibit_id) => {
            if (typeof exhibit_id !== 'string' && typeof exhibit_id !== 'number') {
                return false;
            }

            // If it's a UUID format
            if (typeof exhibit_id === 'string' && exhibit_id.includes('-')) {
                return is_valid_uuid(exhibit_id);
            }

            // If it's a numeric ID
            if (typeof exhibit_id === 'number' || /^\d+$/.test(exhibit_id)) {
                return true;
            }

            // For other string formats, ensure it's not empty and has reasonable length
            const exhibit_id_str = String(exhibit_id).trim();
            return exhibit_id_str.length > 0 && exhibit_id_str.length <= 255;
        };

        // Validate required parameters
        if (!is_member_of_exhibit || !uuid) {
            const error_msg = 'Missing required parameters: is_member_of_exhibit and uuid are required';
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ${error_msg}`);
            return null;
        }

        // Validate UUID format (basic check)
        if (!is_valid_uuid(uuid)) {
            const error_msg = `Invalid UUID format: ${uuid}`;
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ${error_msg}`);
            return null;
        }

        // Validate exhibit ID format
        if (!is_valid_exhibit_id(is_member_of_exhibit)) {
            const error_msg = `Invalid exhibit ID format: ${is_member_of_exhibit}`;
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ${error_msg}`);
            return null;
        }

        try {
            // Set query timeout to prevent long-running queries
            const QUERY_TIMEOUT = 5000; // 5 seconds

            const result = await this.DB(this.TABLE.item_records)
                .select('*') // Consider selecting specific columns: .select('id', 'uuid', 'title', ...)
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    uuid: uuid,
                    is_deleted: 0
                })
                .first() // Get single record instead of array
                .timeout(QUERY_TIMEOUT);

            // Return result or null if not found
            return result || null;

        } catch (error) {
            // Handle specific error types
            if (error.name === 'TimeoutError') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ` +
                    `Query timeout for exhibit: ${is_member_of_exhibit}, UUID: ${uuid}`
                );
            } else {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ` +
                    `Unable to get item record for exhibit: ${is_member_of_exhibit}, UUID: ${uuid} - ${error.message}`
                );
            }

            // Return null instead of undefined on error
            return null;
        }
    }

    /**
     * Gets item record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async get_item_record__(is_member_of_exhibit, uuid) {

        try {

            return await this.DB(this.TABLE.item_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] unable to get item records ' + error.message);
        }
    }

    /**
     * Gets item record
     * @param is_member_of_exhibit
     * @param uuid
     * @param uid
     */
    async get_item_edit_record(uid, is_member_of_exhibit, uuid) {

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
                    await HELPER_TASK.lock_record(uid, uuid, this.DB, this.TABLE.item_records);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] unable to get item records ' + error.message);
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
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (update_item_record)] unable to update item record ' + error.message);
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
            } else if (type === 'timeline') {
                table = this.TABLE.timeline_records;
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
     * @param uuid
     */
    async set_item_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                uuid: uuid
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

    /**
     * Reorders items
     * @param is_member_of_exhibit
     * @param item
     */
    async reorder_items(is_member_of_exhibit, item) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: item.uuid
            })
            .update({
                order: item.order
            });

            LOGGER.module().info('INFO: [/exhibits/item_record_tasks (reorder_items)] Item reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/item_record_tasks (reorder_items)] unable to reorder item ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_item_record_tasks;
