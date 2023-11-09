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
     */
    async create_exhibit_record(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE.exhibit_records)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            if (result.length !== 1) {
                LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (create_exhibit_record)] Unable to create exhibit record.');
                return false;
            } else {
                LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (create_exhibit_record)] ' + result.length + ' Exhibit record created.');
                return true;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] unable to create record ' + error.message);
        }
    }

    /**
     * Gets all active exhibit records
     */
    async get_exhibit_records() {

        try {

            return await this.DB(this.TABLE.exhibit_records)
            .select('uuid',
                'type',
                'title',
                'subtitle',
                'banner_template',
                'alert_text',
                'hero_image',
                'thumbnail',
                'description',
                'page_layout',
                'template',
                'styles',
                'is_published',
                'is_preview',
                'is_featured',
                'created'
            )
            .where({
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_records)] unable to get records ' + error.message);
        }
    }

    /**
     * Gets exhibit record by uuid
     * @param uuid
     */
    async get_exhibit_record(uuid) {

        try {

            let data = await this.DB(this.TABLE.exhibit_records)
            .select('uuid',
                'type',
                'title',
                'subtitle',
                'banner_template',
                'hero_image',
                'thumbnail',
                'description',
                'page_layout',
                'template',
                'styles',
                'is_published',
                'is_preview',
                'is_featured',
                'is_locked',
                'created'
            )
            .where({
                uuid: uuid,
                is_deleted: 0
            });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uuid, this.DB, this.TABLE.exhibit_records);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to get records ' + error.message);
        }
    }

    /**
     * Updates record
     * @param data
     */
    async update_exhibit_record(data) {

        try {

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (update_exhibit_record)] Exhibit record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (update_exhibit_record)] unable to update record ' + error.message);
        }
    }

    /**
     * Deletes exhibit record
     * @param uuid
     * @return {Promise<unknown | boolean>}
     */
    async delete_exhibit_record(uuid) {

        try {

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (delete_exhibit_record)] Exhibit record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (delete_item_record)] unable to delete record ' + error.message);
        }
    }

    /**
     * Sets preview flag
     * @param uuid
     */
    async set_preview(uuid) {

        try {

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_preview: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (set_preview)] Exhibit preview set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (set_preview)] unable to set exhibit preview ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to true
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_preview: 0,
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (set_to_publish)] Exhibit is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (set_to_publish)] unable to set exhibit is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to false
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (set_to_suppress)] Exhibit is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (set_to_suppress)] unable to set exhibit is_published. ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_record_tasks;
