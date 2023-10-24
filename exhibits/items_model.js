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
const FS = require('fs');
const LOGGER = require('../libs/log4');


/**
 * Creates item record
 * @param is_member_of_exhibit
 * @param data
 */
exports.create_item_record = async function (is_member_of_exhibit, data) {

    try {
        console.log(data.is_member_of_item_grid);
        const HELPER_TASK = new HELPER();
        data.uuid = HELPER_TASK.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;
        // data.is_member_of_item_grid = data.is_member_of_item_grid === typeof 'object' ? data.is_member_of_item_grid : 0;

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_ITEM_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (create_item_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        if (data.item_type.length > 0) {

            if (data.media.length > 0) {

                FS.rename(`./storage/${data.media}`, `./storage/${data.is_member_of_exhibit}/${data.uuid}_${data.media}`, (error) => {
                    if (error) {
                        console.log('ERROR: ' + error);
                    }
                });

                data.media = `${data.uuid}_${data.media}`;
            }

            if (data.thumbnail.length > 0) {

                FS.rename(`./storage/${data.thumbnail}`, `./storage/${data.is_member_of_exhibit}/${data.uuid}_${data.thumbnail}`, (error) => {
                    if (error) {
                        console.log('ERROR: ' + error);
                    }
                });

                data.thumbnail = `${data.uuid}_${data.thumbnail}`;
            }
        }

        if (data.media.length === 0) {
            data.media = data.repo_uuid;
        }

        delete data.repo_uuid;
        console.log(data);

        // TODO: handle in client
        if (data.styles === undefined || data.styles.length === 0) {
            data.styles = '{}';
        }

        data.styles = JSON.stringify(data.styles);

        if (data.is_member_of_item_grid !== undefined) {
            data.order = await HELPER_TASK.order_grid_items(data.is_member_of_item_grid, DB, TABLES);
        } else {
            data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);
        }

        const CREATE_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_item_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/model (create_item_record)] Unable to create item record');
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
        LOGGER.module().error('ERROR: [/exhibits/model (create_item_record)] Unable to create item record ' + error.message);
        return {
            status: 200,
            message: 'Unable to create record ' + error.message
        };
    }
};

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

            LOGGER.module().error('ERROR: [/exhibits/model (create_grid_record)] ' + is_valid[0].message);

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
        callback({
            status: 200,
            message: 'Unable to create record ' + error.message
        });
    }
};

/**
 * Gets item records by exhibit
 * @param is_member_of_exhibit
 */
exports.get_item_records = async function (is_member_of_exhibit) {

    try {

        const ITEM_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        const HEADING_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        const GRID_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let items =  await ITEM_TASK.get_item_records(is_member_of_exhibit);
        let headings = await HEADING_TASK.get_heading_records(is_member_of_exhibit);
        let grids = await GRID_TASK.get_grid_records(is_member_of_exhibit);

        for (let i=0;i<grids.length;i++) {
            grids[i].grid_items = await GRID_TASK.get_grid_item_records(grids[i].uuid);
        }

        let records = [...items,  ...headings, ...grids];

        records.sort((a, b) => {
            return a.order - b.order;
        });

        return {
            status: 200,
            message: 'Exhibit item and heading records',
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

/** TODO: version record
 * Updates item record
 * @param is_member_of_exhibit
 * @param uuid
 * @param data
 */
exports.update_item_record = async function (is_member_of_exhibit, uuid, data) {

    try {

        if (data.is_published !== undefined && data.is_locked !== undefined) {
            data.is_published = parseInt(data.is_published);
            data.is_locked = parseInt(data.is_locked);
            data.order = parseInt(data.order);
        } else {
            return {
                status: 400,
                message: 'Bad Request.'
            };
        }

        data.is_member_of_exhibit = is_member_of_exhibit;
        data.uuid = uuid;

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_ITEM_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (update_item_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        const UPDATE_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        let result = await UPDATE_RECORD_TASK.update_item_record(data);

        if (result === false) {
            return {
                status: 400,
                message: 'Unable to update item record'
            };
        } else {
            return {
                status: 204,
                message: 'Item record updated'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (update_item_record)] ' + error.message);
        return {
            status: 400,
            message: 'Unable to update record ' + error.message
        };
    }
};

/**
 * Deletes item record
 * @param is_member_of_exhibit
 * @param uuid
 */
exports.delete_item_record = async function (is_member_of_exhibit, uuid) {

    try {

        const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);

        return {
            status: 204,
            message: 'Record deleted',
            data: await TASK.delete_item_record(is_member_of_exhibit, uuid)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_item_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};
