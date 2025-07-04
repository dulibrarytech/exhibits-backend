/**

 Copyright 2024 University of Denver

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
 * Object contains tasks used to manage exhibit timeline records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_timeline_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Creates timeline record
     * @param data
     */
    async create_timeline_record(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE.timeline_records)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (create_timeline_record)] ' + result.length + ' Timeline record created.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (create_timeline_record)] unable to create timeline record ' + error.message);
        }
    }

    /**
     * Gets all timeline records by exhibit
     * @param is_member_of_exhibit
     */
    async get_timeline_records(is_member_of_exhibit) {

        try {

            return await this.DB(this.TABLE.timeline_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_timeline_records)] unable to get timeline records ' + error.message);
        }
    }

    /**
     * Updates timeline record
     * @param data
     */
    async update_timeline_record(data) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (update_timeline_record)] Timeline record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (update_timeline_record)] unable to update timeline record ' + error.message);
        }
    }

    /**
     * Gets timeline record by id
     * @param is_member_of_exhibit
     * @param timeline_id
     */
    async get_timeline_record(is_member_of_exhibit, timeline_id) {

        try {

            return await this.DB(this.TABLE.timeline_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: timeline_id,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_timeline_record)] unable to get timeline record ' + error.message);
        }
    }

    /**
     * Gets timeline items
     * @param is_member_of_exhibit
     * @param is_member_of_timeline
     */
    async get_timeline_item_records(is_member_of_exhibit, is_member_of_timeline) {

        try {

            return await this.DB(this.TABLE.timeline_item_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_member_of_timeline: is_member_of_timeline,
                is_deleted: 0
            })
            .orderBy('order');

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_timeline_item_records)] unable to get timeline records ' + error.message);
        }
    }

    /**
     * Create timeline item records
     * @param data
     */
    async create_timeline_item_record(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE.timeline_item_records)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (create_timeline_item_record)] ' + result.length + ' Timeline item record created.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (create_timeline_item_record)] unable to create timeline item record ' + error.message);
        }
    }

    /**
     * Gets timeline item record
     * @param is_member_of_exhibit
     * @param timeline_id
     * @param item_id
     */
    async get_timeline_item_record(is_member_of_exhibit, timeline_id, item_id) {

        try {

            return await this.DB(this.TABLE.timeline_item_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_member_of_timeline: timeline_id,
                uuid: item_id,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_timeline_item_record)] unable to get timeline item record ' + error.message);
        }
    }

    /**
     * Update timeline item record
     * @param data
     */
    async update_timeline_item_record(data) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                is_member_of_timeline: data.is_member_of_timeline,
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (update_timeline_item_record)] Timeline item record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (update_timeline_item_record)] unable to update timeline item record ' + error.message);
        }
    }

    /**
     * Clears out media value
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

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                uuid: uuid
            })
            .update(update);

            LOGGER.module().info('INFO: [/exhibits/timeline_record_tasks (delete_media_value)] Media value deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/timeline_record_tasks (delete_media_value)] unable to delete media value ' + error.message);
            return false;
        }
    }

    /** * delete occurs in exhibit_item_record_tasks.js
     * Deletes timeline record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async delete_timeline_record(is_member_of_exhibit, uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (delete_timeline_record)] Timeline record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (delete_timeline_record)] unable to delete timeline record ' + error.message);
        }
    }

    /**
     * Deletes timeline item
     * @param is_member_of_exhibit
     * @param timeline_id
     * @param timeline_item_id
     */
    async delete_timeline_item_record(is_member_of_exhibit, timeline_id, timeline_item_id) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_member_of_timeline: timeline_id,
                uuid: timeline_item_id
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (delete_timeline_item_record)] Timeline item record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (delete_timeline_item_record)] unable to delete timeline item record ' + error.message);
        }
    }

    /**
     * Gets timeline record count
     * @param uuid
     */
    async get_record_count(uuid) {

        try {

            const count = await this.DB(this.TABLE.timeline_records).count('id as count')
            .where({
                is_member_of_exhibit: uuid
            });

            return count[0].count;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_record_count)] unable to get timeline record count ' + error.message);
        }
    }

    /**
     * Sets is_published flogs to true
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_to_publish)] Timeline is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_to_publish)] unable to set timeline is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to true for each timeline item record
     * @param uuid
     */
    async set_timeline_item_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_timeline_item_to_publish)] Timeline item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_timeline_item_to_publish)] unable to set timeline item is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to true for timeline record
     * @param uuid
     */
    async set_timeline_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_timeline_to_publish)] Timeline is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_timeline_to_publish)] unable to set timeline is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to true for all timeline by timeline id
     * @param uuid
     */
    async set_to_publish_timeline_items(uuid) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_timeline: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_to_publish_timeline_items)] Timeline items is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_to_publish_timeline_items)] unable to set timeline items is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false for all timeline records by exhibit id
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_to_suppress)] Timeline is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_to_suppress)] unable to set timeline is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to false for timeline record
     * @param uuid
     */
    async set_timeline_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_timeline_to_suppress)] Timeline is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_timeline_to_suppress)] unable to set timeline is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false for timeline item records by timeline id
     * @param uuid
     */
    async set_to_suppressed_timeline_items(uuid) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_timeline: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_to_suppressed_timeline_items)] Timeline items is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_to_suppressed_timeline_items)] unable to set timeline items is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Reorders timelines
     * @param is_member_of_exhibit
     * @param timelines
     */
    async reorder_timelines(is_member_of_exhibit, timelines) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: timelines.uuid
            })
            .update({
                order: timelines.order
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (reorder_timelines)] Timeline reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (reorder_timelines)] unable to reorder timeline ' + error.message);
            return false;
        }
    }

    /**
     * Reorders timeline items
     * @param is_member_of_timeline
     * @param timelines
     */
    async reorder_timeline_items(is_member_of_timeline, timelines) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_timeline: is_member_of_timeline,
                uuid: timelines.uuid
            })
            .update({
                order: timelines.order
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (reorder_timeline_items)] Timeline item reordered.');
            return true;


        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (reorder_timeline_items)] unable to reorder timeline item ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_timeline_record_tasks;
