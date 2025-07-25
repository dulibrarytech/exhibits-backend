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
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] unable to create exhibit record ' + error.message);
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
                'about_the_curators',
                'alert_text',
                'hero_image',
                'thumbnail',
                'description',
                'page_layout',
                'exhibit_template',
                'styles',
                'order',
                'is_published',
                'is_preview',
                'is_featured',
                'is_student_curated',
                'created',
                'updated',
                'created_by',
                'updated_by'
            )
            .where({
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_records)] unable to get exhibit records ' + error.message);
        }
    }

    /**
     * Gets exhibit title
     * @param uuid
     */
    async get_exhibit_title(uuid) {

        try {

            return await this.DB(this.TABLE.exhibit_records)
                .select('uuid',
                    'title'
                )
                .where({
                    uuid: uuid,
                    is_deleted: 0
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_title)] unable to get exhibit title ' + error.message);
        }
    }

    /**
     * Gets exhibit record by uuid
     * @param uuid
     */
    async get_exhibit_record(uuid) {

        try {

            return await this.DB(this.TABLE.exhibit_records)
                .select('*')
                .where({
                    uuid: uuid,
                    is_deleted: 0
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to get exhibit record ' + error.message);
        }
    }

    /**
     * Gets exhibit record by uuid
     * @param uuid
     * @param uid
     */
    async get_exhibit_edit_record(uid, uuid) {

        try {

            let data = await this.DB(this.TABLE.exhibit_records)
            .select('uuid',
                'type',
                'title',
                'subtitle',
                'banner_template',
                'about_the_curators',
                'alert_text',
                'hero_image',
                'thumbnail',
                'description',
                'page_layout',
                'exhibit_template',
                'styles',
                'order',
                'is_published',
                'is_preview',
                'is_featured',
                'is_student_curated',
                'is_locked',
                'locked_by_user',
                'created',
                'updated',
                'created_by',
                'updated_by'
            )
            .where({
                uuid: uuid,
                is_deleted: 0
            });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uid, uuid, this.DB, this.TABLE.exhibit_records);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to get exhibit record ' + error.message);
        }
    }

    /**
     * Updates record
     * @param uuid
     * @param data
     */
    async update_exhibit_record(uuid, data) {

        try {

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (update_exhibit_record)] Exhibit record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (update_exhibit_record)] unable to update exhibit record ' + error.message);
            return false;
        }
    }

    /**
     * Deletes exhibit record
     * @param uuid
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
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (delete_item_record)] unable to delete exhibit record ' + error.message);
        }
    }

    /**
     * Deletes media value
     * @param uuid
     * @param media
     */
    async delete_media_value(uuid, media) {

        try {

            let update = {};
            let tmp = media.split('_');
            let image = tmp.pop();

            if (image.indexOf('hero') !== -1) {
                update.hero_image = '';
            } else if (image.indexOf('thumbnail') !== -1) {
                update.thumbnail = '';
            }

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update(update);

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (delete_media_value)] Media value deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (delete_media_value)] unable to delete media value ' + error.message);
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
     * Changes preview flag to false
     * @param uuid
     */
    async unset_preview(uuid) {

        try {

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_preview: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (unset_preview)] Exhibit preview set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (unset_preview)] unable to unset exhibit preview ' + error.message);
            return false;
        }
    }

    /**
     * Reorder exhibits
     * @param uuid
     * @param order
     */
    async reorder_exhibits(uuid, order) {

        try {

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                order: order
            });

            LOGGER.module().info('INFO: [/exhibits/item_record_tasks (reorder_exhibits)] Exhibits reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (reorder_exhibits)] unable to reorder exhibits ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_record_tasks;
