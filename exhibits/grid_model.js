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

const STORAGE_CONFIG = require('../config/storage_config')();
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const EXHIBITS_CREATE_GRID_SCHEMA = require('../exhibits/schemas/exhibit_create_grid_record_schema')();
const EXHIBITS_UPDATE_GRID_SCHEMA = require('../exhibits/schemas/exhibit_grid_update_record_schema')();
const EXHIBITS_CREATE_GRID_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_grid_item_create_record_schema')();
const EXHIBITS_UPDATE_GRID_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_grid_item_update_record_schema')();
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const EXHIBIT_RECORD_TASKS = require('./tasks/exhibit_record_tasks');
const INDEXER_MODEL = require('../indexer/model');
const LOGGER = require('../libs/log4');

/**
 * Create grid record
 * @param is_member_of_exhibit
 * @param data
 */
exports.create_grid_record = async function (is_member_of_exhibit, data) {

    try {

        const HELPER_TASK = new HELPER();
        data.uuid = HELPER_TASK.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;
        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_GRID_SCHEMA);
        data.styles = JSON.stringify(data.styles);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/grid_model (create_grid_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        data.columns = parseInt(data.columns);
        data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        const CREATE_RECORD_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_grid_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to create grid record'
            };
        } else {
            return {
                status: 201,
                message: 'Grid record created',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (create_grid_record)] ' + error.message);
    }
};

/**
 * Updates grid record
 * @param is_member_of_exhibit
 * @param grid_id
 * @param data
 */
exports.update_grid_record = async function (is_member_of_exhibit, grid_id, data) {

    try {

        const HELPER_TASK = new HELPER();
        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_GRID_SCHEMA);

        data.is_member_of_exhibit = is_member_of_exhibit;
        data.uuid = grid_id;
        data.styles = JSON.stringify(data.styles);
        data.columns = parseInt(data.columns);

        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/grid_model (update_grid_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        const CREATE_RECORD_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.update_grid_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to update grid record'
            };
        } else {
            return {
                status: 201,
                message: 'Grid record updated',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (update_grid_record)] ' + error.message);
    }
};

/**
 *  Gets grid record
 * @param is_member_of_exhibit
 * @param grid_id
 */
exports.get_grid_record = async function (is_member_of_exhibit, grid_id) {

    try {

        const GRID_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        const record = await GRID_TASK.get_grid_record(is_member_of_exhibit, grid_id);

        return {
            status: 200,
            message: 'Grid record created',
            data: record
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_grid_record)] ' + error.message);
    }
};

/**
 * Creates grid item record
 * @param is_member_of_exhibit
 * @param grid_id
 * @param data
 */
exports.create_grid_item_record = async function (is_member_of_exhibit, grid_id, data) {

    try {

        const HELPER_TASK = new HELPER();
        data.uuid = HELPER_TASK.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;
        data.is_member_of_grid = grid_id;

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_GRID_ITEM_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/grid_model (create_grid_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        if (data.item_type !== 'text') {

            if (data.media.length > 0 && data.media !== data.media_prev) {
                data.media = HELPER_TASK.process_uploaded_media(data.is_member_of_exhibit, data.uuid, data.media, STORAGE_CONFIG.storage_path);
            }

            if (data.thumbnail.length > 0 && data.thumbnail !== data.thumbnail_prev) {
                data.thumbnail = HELPER_TASK.process_uploaded_media(data.is_member_of_exhibit, data.uuid, data.thumbnail, STORAGE_CONFIG.storage_path);
            }

            if (data.kaltura.length > 0) {
                data.media = data.kaltura;
                data.is_kaltura_item = 1;
            } else if (data.repo_uuid.length > 0) {
                data.media = data.repo_uuid;
                data.is_repo_item = 1;
            }

            delete data.kaltura;
            delete data.repo_uuid;
            delete data.media_prev;
            delete data.thumbnail_prev;
        } else {
            data.mime_type = 'text/plain';
        }

        data.styles = JSON.stringify(data.styles);
        data.order = await HELPER_TASK.order_grid_items(data.is_member_of_grid, DB, TABLES);

        const CREATE_RECORD_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_grid_item_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to create grid item record'
            };
        } else {
            return {
                status: 201,
                message: 'Grid item record created',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (create_grid_item_record)] ' + error.message);
    }
};

/**
 * Gets grid items
 * @param is_member_of_exhibit
 * @param is_member_of_grid
 */
exports.get_grid_item_records = async function (is_member_of_exhibit, is_member_of_grid) {

    try {

        const GRID_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        const grid_items = await GRID_TASK.get_grid_item_records(is_member_of_exhibit, is_member_of_grid);

        return {
            status: 200,
            message: 'Exhibit grid item records',
            data: grid_items
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_grid_item_records)] ' + error.message);
    }
};

/**
 * Gets grid item record
 * @param is_member_of_exhibit
 * @param is_member_of_grid
 * @param item_id
 */
exports.get_grid_item_record = async function (is_member_of_exhibit, is_member_of_grid, item_id) {

    try {

        const GRID_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        const grid_items = await GRID_TASK.get_grid_item_record(is_member_of_exhibit, is_member_of_grid, item_id);

        return {
            status: 200,
            message: 'Exhibit grid item record',
            data: grid_items
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_grid_item_record)] ' + error.message);
    }
};

/**
 * Gets grid item edit record
 * @param is_member_of_exhibit
 * @param is_member_of_grid
 * @param item_id
 * @param uid
 */
exports.get_grid_item_edit_record = async function (uid, is_member_of_exhibit, is_member_of_grid, item_id) {

    try {

        const GRID_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        const grid_items = await GRID_TASK.get_grid_item_edit_record(uid, is_member_of_exhibit, is_member_of_grid, item_id);

        return {
            status: 200,
            message: 'Exhibit grid item record',
            data: grid_items
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_grid_item_record)] ' + error.message);
    }
};

/**
 * Updates grid item
 * @param is_member_of_exhibit
 * @param is_member_of_grid
 * @param item_id
 * @param data
 */
exports.update_grid_item_record = async function (is_member_of_exhibit, is_member_of_grid, item_id, data) {

    try {

        const HELPER_TASK = new HELPER();
        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_GRID_ITEM_SCHEMA);
        data.is_member_of_exhibit = is_member_of_exhibit;
        data.is_member_of_grid = is_member_of_grid;
        data.uuid = item_id;
        data.styles = JSON.stringify(data.styles);
        let is_valid = VALIDATE_TASK.validate(data);
        let is_published = false;

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/grid_model (update_grid_item_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        if (data.item_type !== 'text') {

            if (data.media.length > 0 && data.media !== data.media_prev) {
                data.media = HELPER_TASK.process_uploaded_media(data.is_member_of_exhibit, data.uuid, data.media, STORAGE_CONFIG.storage_path);
            }

            if (data.thumbnail.length > 0 && data.thumbnail !== data.thumbnail_prev) {
                data.thumbnail = HELPER_TASK.process_uploaded_media(data.is_member_of_exhibit, data.uuid, data.thumbnail, STORAGE_CONFIG.storage_path);
            }

            if (data.kaltura.length > 0) {
                data.media = data.kaltura;
                data.is_kaltura_item = 1;
            } else if (data.repo_uuid.length > 0) {
                data.media = data.repo_uuid;
                data.is_repo_item = 1;
            }

            delete data.kaltura;
            delete data.repo_uuid;
            delete data.media_prev;
            delete data.thumbnail_prev;
        }

        if (data.styles === undefined || data.styles.length === 0) {
            data.styles = {};
        }

        is_published = data.is_published;
        delete data.is_published;

        const UPDATE_RECORD_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let result = await UPDATE_RECORD_TASK.update_grid_item_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to update grid item record'
            };
        } else {

            if (is_published === 'true') {

                const is_suppressed = await suppress_grid_item_record(is_member_of_exhibit, is_member_of_grid, item_id);

                if (is_suppressed.status === true) {
                    setTimeout(async () => {

                        const is_published = await publish_grid_item_record(is_member_of_exhibit, is_member_of_grid, item_id);

                        if (is_published.status === true) {
                            LOGGER.module().info('INFO: [/exhibits/grid_model (update_grid_item_record)] Grid item re-published successfully.');
                        }

                    }, 5000);
                }
            }

            return {
                status: 201,
                message: 'Grid item record updated',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (update_grid_item_record)] ' + error.message);
    }
};

/**
 *
 * @param is_member_of_exhibit
 * @param grid_id
 * @param grid_item_id
 */
exports.delete_grid_item_record = async function (is_member_of_exhibit, grid_id, grid_item_id) {

    try {

        const TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);

        return {
            status: 204,
            message: 'Record deleted',
            data: await TASK.delete_grid_item_record(is_member_of_exhibit, grid_id, grid_item_id)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_grid_item_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Publishes grid
 * @param exhibit_id
 * @param grid_id
 */
const publish_grid_record = async function (exhibit_id, grid_id) {

    try {

        const EXHIBIT_TASKS = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        const GRID_TASKS = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        const exhibit_record = await EXHIBIT_TASKS.get_exhibit_record(exhibit_id);

        if (exhibit_record.is_published === 0) {

            LOGGER.module().error('ERROR: [/exhibits/items_model (publish_grid_record)] Unable to publish grid');

            return {
                status: false,
                message: 'Unable to publish grid. Exhibit must be published first'
            };
        }

        const is_item_published = await GRID_TASKS.set_grid_to_publish(grid_id);

        if (is_item_published === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_grid_record)] Unable to publish grid');

            return {
                status: false,
                message: 'Unable to publish grid'
            };

        }

        const is_indexed = await INDEXER_MODEL.index_grid_record(exhibit_id, grid_id);

        if (is_indexed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_grid_record)] Unable to publish grid');

            return {
                status: false,
                message: 'Unable to publish heading'
            };
        }

        return {
            status: true,
            message: 'Grid published'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (publish_grid_record)] ' + error.message);
    }
};

/**
 * Suppress grid
 * @param exhibit_id
 * @param item_id
 */
const suppress_grid_record = async function (exhibit_id, item_id) {

    try {

        const GRID_TASKS = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        const is_deleted = await INDEXER_MODEL.delete_record(item_id);

        if (is_deleted === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (suppress_grid_record)] Unable to suppress grid');

            return {
                status: false,
                message: 'Unable to suppress grid'
            };
        }

        const is_item_suppressed = await GRID_TASKS.set_grid_to_suppress(item_id);
        const grid_records = await GRID_TASKS.get_grid_records(exhibit_id, item_id);

        for (let i = 0; i < grid_records.length; i++) {

            await GRID_TASKS.set_to_suppressed_grid_items(grid_records[i].is_member_of_exhibit);
            let items = await GRID_TASKS.get_grid_item_records(grid_records[i].is_member_of_exhibit, grid_records[i].uuid);

            for (let j = 0; j < items.length; j++) {
                await GRID_TASKS.set_to_suppressed_grid_items(items[j].is_member_of_grid);
            }
        }

        if (is_item_suppressed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (suppress_grid_record)] Unable to suppress grid');

            return {
                status: false,
                message: 'Unable to suppress grid'
            };

        } else {

            return {
                status: true,
                message: 'Grid suppressed'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (suppress_grid_record)] ' + error.message);
    }
};

/**
 * Publishes grid item
 * @param exhibit_id
 * @param grid_id
 * @param grid_item_id
 */
const publish_grid_item_record = async function (exhibit_id, grid_id, grid_item_id) {

    try {

        const data = {
            is_member_of_exhibit: exhibit_id,
            is_member_of_grid: grid_id,
            uuid: grid_item_id,
            is_published: 1
        };

        const GRID_TASKS = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let grid_record = await GRID_TASKS.get_grid_record(exhibit_id, grid_id);

        if (grid_record.is_published === 0) {

            LOGGER.module().error('ERROR: [/exhibits/items_model (publish_grid_item_record)] Unable to publish grid item');

            return {
                status: false,
                message: 'Unable to publish item. Grid must be published first'
            };
        }

        let grid_item_record = await GRID_TASKS.get_grid_item_record(exhibit_id, grid_id, grid_item_id);
        const is_indexed = await INDEXER_MODEL.index_grid_item_record(grid_id, grid_item_id, grid_item_record);

        if (is_indexed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_grid_item_record)] Unable to publish grid item');

            return {
                status: false,
                message: 'Unable to publish grid item'
            };

        } else {

            await GRID_TASKS.update_grid_item_record(data);

            return {
                status: true,
                message: 'Grid item published'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (publish_item_record)] ' + error.message);
    }
};

/**
 * Suppress grid item
 * @param exhibit_id
 * @param grid_id
 * @param grid_item_id
 */
const suppress_grid_item_record = async function (exhibit_id, grid_id, grid_item_id) {

    try {

        const data = {
            is_member_of_exhibit: exhibit_id,
            is_member_of_grid: grid_id,
            uuid: grid_item_id,
            is_published: 0
        };

        const GRID_TASKS = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let indexed_record = await INDEXER_MODEL.get_indexed_record(grid_id);
        let items = indexed_record.data._source.items;
        let updated_items = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].uuid !== grid_item_id) {
                updated_items.push(items[i]);
            }
        }

        indexed_record.data._source.items = updated_items;

        // remove original grid record
        const is_deleted = await INDEXER_MODEL.delete_record(grid_id);

        if (is_deleted === false) {

            LOGGER.module().error('ERROR: [/grid/model (suppress_grid_item_record)] Unable to suppress grid item');

            return {
                status: false,
                message: 'Unable to suppress grid item'
            };
        }

        await GRID_TASKS.update_grid_item_record(data);
        const is_indexed = await INDEXER_MODEL.index_record(indexed_record.data._source);

        if (is_indexed === true) {
            return {
                status: true,
                message: 'Grid item suppressed'
            };
        } else {
            return {
                status: false,
                message: 'Unable to suppress grid item'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/grid/model (suppress_grid_item_record)] ' + error.message);
    }
};

/**
 * Updates item order in exhibit
 * @param exhibit_id
 * @param grid
 */
exports.reorder_grids = async function (exhibit_id, grid) {

    try {
        const TASKS = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        return await TASKS.reorder_grids(exhibit_id, grid);
    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (reorder_grids)] ' + error.message);
    }
};

/**
 * Updates grid item order in grid
 * @param grid_id
 * @param grid
 */
exports.reorder_grid_items = async function (grid_id, grid) {

    try {
        const TASKS = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        return await TASKS.reorder_grid_items(grid_id, grid);
    } catch (error) {
        LOGGER.module().error('ERROR: [/grid/model (reorder_grids)] ' + error.message);
    }
};

exports.unlock_grid_item_record = async function (uid, uuid) {

    try {

        const HELPER_TASK = new HELPER();
        return await HELPER_TASK.unlock_record(uid, uuid, DB, TABLES.grid_item_records);

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (unlock_grid_item_record)] ' + error.message);
    }
};

exports.publish_grid_record = publish_grid_record;
exports.suppress_grid_record = suppress_grid_record;
exports.publish_grid_item_record = publish_grid_item_record;
exports.suppress_grid_item_record = suppress_grid_item_record;