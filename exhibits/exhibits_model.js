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

const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const EXHIBITS_CREATE_RECORD_SCHEMA = require('../exhibits/schemas/exhibit_create_record_schema')();
const EXHIBITS_UPDATE_RECORD_SCHEMA = require('../exhibits/schemas/exhibit_update_record_schema')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('./tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('./tasks/exhibit_heading_record_tasks');
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const LOGGER = require('../libs/log4');
const INDEXER_MODEL = require('../indexer/model');

/**
 * Creates exhibit record
 * @param data
 */
exports.create_exhibit_record = async function (data) {

    try {

        const HELPER_TASK = new HELPER();
        data.uuid = HELPER_TASK.create_uuid();

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_RECORD_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (create_exhibit_record)] ' + is_valid[0].dataPath + ' ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        HELPER_TASK.check_storage_path(data.uuid);

        if (data.hero_image.length > 0) {
            data.hero_image = HELPER_TASK.process_uploaded_media(data.uuid, null, data.hero_image);
        }

        if (data.thumbnail.length > 0) {
            data.thumbnail = HELPER_TASK.process_uploaded_media(data.uuid, null, data.thumbnail);
        }

        if (data.styles === undefined || data.styles.length === 0) {
            data.styles = {};
        }

        data.styles = JSON.stringify(data.styles);

        const CREATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_exhibit_record(data);

        if (result === false) {

            return {
                status: 200,
                message: 'Unable to create exhibit record'
            };

        } else {

            return {
                status: 201,
                message: 'Exhibit record created',
                data: data.uuid
            };
        }

    } catch (error) {

        LOGGER.module().error('ERROR: [/exhibits/model (create_exhibit_record)] Unable to create exhibit record ' + error.message);

        return {
            status: 200,
            message: 'Unable to create record ' + error.message
        };
    }
};

/**
 * Gets all exhibit records
 */
exports.get_exhibit_records = async function () {

    try {

        const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);

        return {
            status: 200,
            message: 'Exhibit records',
            data: await TASK.get_exhibit_records()
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_exhibit_records)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Gets exhibit record by uuid
 * @param uuid
 */
exports.get_exhibit_record = async function (uuid) {

    try {

        const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);

        return {
            status: 200,
            message: 'Exhibit records',
            data: await TASK.get_exhibit_record(uuid)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_exhibit_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Updates exhibit record
 * @param uuid
 * @param data
 */
exports.update_exhibit_record = async function (uuid, data) {

    try {

        const HELPER_TASK = new HELPER();
        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_RECORD_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (update_exhibit_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        HELPER_TASK.check_storage_path(uuid);

        if (data.hero_image.length > 0 && data.hero_image !== data.hero_image_prev) {
            data.hero_image = HELPER_TASK.process_uploaded_media(uuid, null, data.hero_image);
        }

        if (data.thumbnail.length > 0 && data.thumbnail !== data.thumbnail_prev) {
            data.thumbnail = HELPER_TASK.process_uploaded_media(uuid, null, data.thumbnail);
        }

        delete data.hero_image_prev;
        delete data.thumbnail_prev;

        if (data.styles === undefined || data.styles.length === 0) {
            data.styles = {};
        }

        data.styles = JSON.stringify(data.styles);

        const UPDATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        let result = await UPDATE_RECORD_TASK.update_exhibit_record(uuid, data);

        if (result !== true) {
            return {
                status: 400,
                message: 'Unable to update exhibit record'
            };
        } else {
            return {
                status: 201,
                message: 'Exhibit record updated'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (update_exhibit_record)] ' + error.message);
        return {
            status: 400,
            message: 'Unable to update record ' + error.message
        };
    }
};

/**
 * Deletes exhibit record
 * @param uuid
 */
exports.delete_exhibit_record = async function (uuid) {

    try {

        const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        const ITEM_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        let results = await ITEM_TASK.get_item_records(uuid);

        if (results.length > 0) {

            return {
                status: 200,
                message: 'Cannot delete exhibit because it contains items'
            };
        }

        if (await TASK.delete_exhibit_record(uuid) === true) {
            return {
                status: 204,
                message: 'Record deleted'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_exhibit_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Clears out media value
 * @param uuid
 * @param media
 */
exports.delete_media_value = async function (uuid, media) {

    try {

        const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);

        if (await TASK.delete_media_value(uuid, media) === true) {
            LOGGER.module().info('INFO: [/exhibits/model (delete_media_value)] Media value deleted');
        } else {
            LOGGER.module().error('ERROR: [/exhibits/model (delete_media_value)] Unable to delete media value');
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_media_value)] ' + error.message);
    }
};

/**
 * Builds exhibit preview
 * @param uuid
 */
exports.build_exhibit_preview = async function (uuid) {

    try {

        const SET_PREVIEW_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        let result = await SET_PREVIEW_RECORD_TASK.set_preview(uuid);

        if (result === false) {

            return {
                status: false,
                message: 'Unable to preview exhibit'
            };

        } else {

            const is_indexed = await INDEXER_MODEL.index_exhibit(uuid);

            if (is_indexed.status === 201) {

                return {
                    status: true,
                    message: 'Exhibit preview built'
                };
            }
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (build_exhibit_preview)] ' + error.message);
    }
};

/**
 * Publishes exhibit
 * @param uuid
 */
exports.publish_exhibit = async function (uuid) {

    try {

        const EXHIBIT_TASKS = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        const ITEM_TASKS = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        const HEADING_TASKS = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        const GRID_TASKS = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);

        const heading_count = await HEADING_TASKS.get_record_count(uuid);
        const item_count = await ITEM_TASKS.get_record_count(uuid);
        const grid_count = await GRID_TASKS.get_record_count(uuid);
        const total_count = heading_count + item_count + grid_count;

        if (total_count === 0) {
            LOGGER.module().info('INFO: [/exhibits/model (publish_exhibit)] Exhibit does not have any items');
            return {
                status: 'no_items',
                message: 'Exhibit does not have any items'
            };
        }

        const is_exhibit_published = await EXHIBIT_TASKS.set_to_publish(uuid);
        const is_item_published = await ITEM_TASKS.set_to_publish(uuid);
        const is_heading_published = await HEADING_TASKS.set_to_publish(uuid);
        const is_grid_published = await GRID_TASKS.set_to_publish(uuid);

        if (is_exhibit_published === false || is_item_published === false || is_heading_published === false || is_grid_published === false) {
            LOGGER.module().error('ERROR: [/exhibits/model (publish_exhibit)] Unable to publish exhibit');
            return {
                status: false,
                message: 'Unable to publish Exhibit'
            };
        }

        const is_indexed = await INDEXER_MODEL.index_exhibit(uuid);

        if (is_indexed.status === 201) {

            return {
                status: true,
                message: 'Exhibit published'
            };

        } else {

            return {
                status: false,
                message: 'Unable to publish (index) exhibit'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (publish_exhibit)] ' + error.message);
    }
};

/**
 * Suppresses exhibit
 * @param uuid
 */
exports.suppress_exhibit = async function (uuid) {

    try {

        const EXHIBIT_TASKS = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        const ITEM_TASKS = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        const HEADING_TASKS = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        const GRID_TASKS = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);

        const is_exhibit_suppressed = await EXHIBIT_TASKS.set_to_suppress(uuid);
        const is_item_suppressed = await ITEM_TASKS.set_to_suppress(uuid);
        const is_heading_suppressed = await HEADING_TASKS.set_to_suppress(uuid);
        const is_grid_suppressed = await GRID_TASKS.set_to_suppress(uuid);

        if (is_exhibit_suppressed === false || is_item_suppressed === false || is_heading_suppressed === false || is_grid_suppressed === false) {
            LOGGER.module().error('ERROR: [/exhibits/model (publish_exhibit)] Unable to suppress exhibit');
            return false;
        }

        const items = await ITEM_TASKS.get_item_records(uuid);
        const grids = await GRID_TASKS.get_grid_records(uuid);

        let is_exhibit_deleted = await INDEXER_MODEL.delete_record(uuid);

        if (is_exhibit_deleted.status === 204) {

            for (let i=0;i<items.length;i++) {

                let is_deleted = await INDEXER_MODEL.delete_record(items[i].uuid);

                if (is_deleted.status !== 204) {
                    LOGGER.module().error('ERROR: [/exhibits/model (suppress_exhibit)] Unable to delete item ' + items[i].uuid + ' from index');
                }
            }

            for (let g=0;g<grids.length;g++) {

                let is_deleted = await INDEXER_MODEL.delete_record(grids[g].uuid);

                if (is_deleted.status !== 204) {
                    LOGGER.module().error('ERROR: [/exhibits/model (suppress_exhibit)] Unable to delete grid ' + grids[g].uuid + ' from index');
                }
            }
        }

        return {
            status: true,
            message: 'Exhibit suppressed.'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (suppress_exhibit)] ' + error.message);
    }
};
