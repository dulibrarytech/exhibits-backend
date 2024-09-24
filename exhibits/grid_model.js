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
const EXHIBITS_CREATE_GRID_SCHEMA = require('../exhibits/schemas/exhibit_create_grid_record_schema')();
const EXHIBITS_UPDATE_GRID_SCHEMA = require('../exhibits/schemas/exhibit_grid_update_record_schema')();
const EXHIBITS_CREATE_GRID_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_grid_item_create_record_schema')();
const EXHIBITS_UPDATE_GRID_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_grid_item_update_record_schema')();
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
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

        data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

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
        data.styles = JSON.stringify(data.styles);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/grid_model (create_grid_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        // TODO: don't send in payload
        delete data.media_prev;
        data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_grid, DB, TABLES);
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
 * Updates grid item
 * @param is_member_of_exhibit
 * @param is_member_of_grid
 * @param item_id
 * @param data
 */
exports.update_grid_item_record = async function (is_member_of_exhibit, is_member_of_grid, item_id, data) {

    try {

        const HELPER_TASK = new HELPER();
        data.is_member_of_exhibit = is_member_of_exhibit;
        data.is_member_of_grid = is_member_of_grid;
        data.uuid = item_id;
        console.log(data);

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_GRID_ITEM_SCHEMA);
        data.styles = JSON.stringify(data.styles);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/grid_model (update_grid_item_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        // TODO: don't send in payload
        delete data.media_prev;
        data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_grid, DB, TABLES);
        const CREATE_RECORD_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_grid_item_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to update grid item record'
            };
        } else {
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
