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
const EXHIBITS_CREATE_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_item_create_record_schema')();
const EXHIBITS_UPDATE_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_item_update_record_schema')();
const EXHIBIT_ITEM_RECORD_TASKS = require('../exhibits/tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('./tasks/exhibit_heading_record_tasks');
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const EXHIBIT_RECORD_TASKS = require('./tasks/exhibit_record_tasks');
const INDEXER_MODEL = require('../indexer/model');
const LOGGER = require('../libs/log4');

/**
 * Gets item records by exhibit
 * @param is_member_of_exhibit
 */
exports.get_item_records = async function (is_member_of_exhibit) {

    try {

        const ITEM_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        const HEADING_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        const GRID_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let items = await ITEM_TASK.get_item_records(is_member_of_exhibit);
        let headings = await HEADING_TASK.get_heading_records(is_member_of_exhibit);
        let grids = await GRID_TASK.get_grid_records(is_member_of_exhibit);

        for (let i = 0; i < grids.length; i++) {
            grids[i].grid_items = await GRID_TASK.get_grid_item_records(is_member_of_exhibit, grids[i].uuid);
        }

        let records = [...items, ...headings, ...grids];

        records.sort((a, b) => {
            return a.order - b.order;
        });

        return {
            status: 200,
            message: 'Exhibit item records',
            data: records
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_item_records)] Unable to get item records ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Creates item record
 * @param is_member_of_exhibit
 * @param data
 */
exports.create_item_record = async function (is_member_of_exhibit, data) {

    try {

        const HELPER_TASK = new HELPER();
        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_ITEM_SCHEMA);

        data.uuid = HELPER_TASK.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;

        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (create_item_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        HELPER_TASK.check_storage_path(data.is_member_of_exhibit);

        if (data.media.length > 0 && data.media !== data.media_prev) {
            data.media = HELPER_TASK.process_uploaded_media(data.is_member_of_exhibit, data.uuid, data.media);
        }

        if (data.thumbnail.length > 0 && data.thumbnail !== data.thumbnail_prev) {
            data.thumbnail = HELPER_TASK.process_uploaded_media(data.is_member_of_exhibit, data.uuid, data.thumbnail);
        }

        if (data.kaltura.length > 0) {
            data.media = data.kaltura;
            data.item_type = 'kaltura';
            data.is_kaltura_item = 1;
        } else if (data.repo_uuid.length > 0) {
            // TODO: get record mime type
            // https://specialcollections.du.edu/repository/data/{pid}?key=<>
            data.media = data.repo_uuid;
            data.item_type = 'repo'; // <-- determine mime type and add here
            data.is_repo_item = 1;
        }

        if (data.styles === undefined || data.styles.length === 0) {
            data.styles = {};
        }

        data.styles = JSON.stringify(data.styles);
        delete data.media_prev;
        delete data.kaltura;
        delete data.repo_uuid;
        data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        const CREATE_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        const result = await CREATE_RECORD_TASK.create_item_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/item_model (create_item_record)] Unable to create item record');
            return {
                status: 200,
                message: 'Unable to create item record'
            };
        } else {
            return {
                status: 201,
                message: 'Item record created',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/item_model (create_item_record)] Unable to create item record ' + error.message);
        return {
            status: 200,
            message: 'Unable to create record ' + error.message
        };
    }
};

/**
 * Updates item record
 * @param is_member_of_exhibit
 * @param item_id
 * @param data
 */
exports.update_item_record = async function (is_member_of_exhibit, item_id, data) {

    try {

        const HELPER_TASK = new HELPER();
        data.is_member_of_exhibit = is_member_of_exhibit;
        data.uuid = item_id;

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_ITEM_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/items/model (update_item_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        HELPER_TASK.check_storage_path(data.is_member_of_exhibit);

        if (data.media.length > 0 && data.media !== data.media_prev) {
            data.media = HELPER_TASK.process_uploaded_media(data.is_member_of_exhibit, data.uuid, data.media);
        }

        if (data.thumbnail.length > 0 && data.thumbnail !== data.thumbnail_prev) {
            data.thumbnail = HELPER_TASK.process_uploaded_media(data.is_member_of_exhibit, data.uuid, data.thumbnail);
        }

        if (data.kaltura.length > 0) {
            data.media = data.kaltura;
            data.item_type = 'kaltura';
            data.is_kaltura_item = 1;
        } else if (data.repo_uuid.length > 0) {
            // TODO: get record mime type
            // https://specialcollections.du.edu/repository/data/{pid}?key=<>
            data.media = data.repo_uuid;
            data.item_type = 'repo';
            data.is_repo_item = 1;
        }

        if (data.styles === undefined || data.styles.length === 0) {
            data.styles = {};
        }

        data.styles = JSON.stringify(data.styles);

        delete data.kaltura;
        delete data.repo_uuid;
        delete data.media_prev;
        delete data.thumbnail_prev;

        const UPDATE_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        const result = await UPDATE_RECORD_TASK.update_item_record(data);

        if (result === false) {
            return {
                status: 400,
                message: 'Unable to update item record'
            };
        } else {
            return {
                status: 201,
                message: 'Item record updated'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/items/model (update_item_record)] ' + error.message);
        return {
            status: 400,
            message: 'Unable to update record ' + error.message
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

        const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);

        if (await TASK.delete_media_value(uuid, media) === true) {
            LOGGER.module().info('INFO: [/exhibits/items/model (delete_media_value)] Media value deleted');
        } else {
            LOGGER.module().error('ERROR: [/exhibits/items/model (delete_media_value)] Unable to delete media value');
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/items/model (delete_media_value)] ' + error.message);
    }
};

/**
 * Gets item record by uuid and is_member_of_exhibit
 * @param is_member_of_exhibit
 * @param uuid
 */
exports.get_item_record = async function (is_member_of_exhibit, uuid) {

    try {

        const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);

        return {
            status: 200,
            message: 'Item record',
            data: await TASK.get_item_record(is_member_of_exhibit, uuid)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_item_record)] Unable to get item record ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Deletes item record
 * @param is_member_of_exhibit
 * @param item_id
 * @param type
 */
exports.delete_item_record = async function (is_member_of_exhibit, item_id, type) {

    try {

        const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);

        return {
            status: 204,
            message: 'Record deleted',
            data: await TASK.delete_item_record(is_member_of_exhibit, item_id, type)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_item_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Publishes item
 * @param exhibit_id
 * @param item_id
 */
exports.publish_item_record = async function (exhibit_id, item_id) {

    try {

        const EXHIBIT_TASKS = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        const ITEM_TASKS = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        const exhibit_record = await EXHIBIT_TASKS.get_exhibit_record(exhibit_id);

        if (exhibit_record[0].is_published === 0) {

            LOGGER.module().error('ERROR: [/exhibits/items_model (publish_item_record)] Unable to publish item');

            return {
                status: false,
                message: 'Unable to publish item. Exhibit must be published first'
            };
        }

        const is_indexed = await INDEXER_MODEL.index_item_record(exhibit_id, item_id);

        if (is_indexed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_item_record)] Unable to publish item');

            return {
                status: false,
                message: 'Unable to publish item'
            };
        }

        const is_item_published = await ITEM_TASKS.set_item_to_publish(item_id);

        if (is_item_published === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_item_record)] Unable to publish item');

            return {
                status: false,
                message: 'Unable to publish item'
            };

        } else {

            return {
                status: true,
                message: 'Item published'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (publish_item_record)] ' + error.message);
    }
};

/**
 * Suppress item
 * @param exhibit_id
 * @param item_id
 */
exports.suppress_item_record = async function (exhibit_id, item_id) {

    try {

        const ITEM_TASKS = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        const is_deleted = await INDEXER_MODEL.delete_record(item_id);

        if (is_deleted === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (suppress_item_record)] Unable to suppress item');

            return {
                status: false,
                message: 'Unable to suppress item'
            };
        }

        const is_item_suppressed = await ITEM_TASKS.set_item_to_suppress(item_id);

        if (is_item_suppressed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (suppress_item_record)] Unable to suppress item');

            return {
                status: false,
                message: 'Unable to suppress item'
            };

        } else {

            return {
                status: true,
                message: 'Item suppressed'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (suppress_item_record)] ' + error.message);
    }
};
