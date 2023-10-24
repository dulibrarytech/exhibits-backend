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
const EXHIBITS_CREATE_HEADING_SCHEMA = require('../exhibits/schemas/exhibit_heading_create_record_schema')();
const EXHIBITS_UPDATE_HEADING_SCHEMA = require('../exhibits/schemas/exhibit_heading_update_record_schema')();
const EXHIBIT_HEADING_RECORD_TASKS = require('../exhibits/tasks/exhibit_heading_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const LOGGER = require('../libs/log4');

/**
 * Create heading record
 * @param is_member_of_exhibit
 * @param data
 */
exports.create_heading_record = async function (is_member_of_exhibit, data) {

    try {

        const HELPER_TASK = new HELPER();
        data.uuid = HELPER_TASK.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_HEADING_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (create_heading_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        const CREATE_RECORD_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_heading_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to create heading record'
            };
        } else {
            return {
                status: 201,
                message: 'Heading record created',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (create_heading_record)] ' + error.message);
        callback({
            status: 200,
            message: 'Unable to create record ' + error.message
        });
    }
};

/**
 * Gets heading record
 * @param is_member_of_exhibit
 * @param uuid
 */
exports.get_heading_record = async function (is_member_of_exhibit, uuid) {

    try {

        const TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);

        return {
            status: 200,
            message: 'Heading record',
            data: await TASK.get_heading_record(is_member_of_exhibit, uuid)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_heading_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/** TODO: version record
 * Updates heading record
 * @param is_member_of_exhibit
 * @param uuid
 * @param data
 */
exports.update_heading_record = async function (is_member_of_exhibit, uuid, data) {

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

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_HEADING_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (update_heading_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        const UPDATE_RECORD_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        let result = await UPDATE_RECORD_TASK.update_heading_record(data);

        if (result === false) {
            return {
                status: 400,
                message: 'Unable to update heading record'
            };
        } else {
            return {
                status: 204,
                message: 'Heading record updated'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (update_heading_record)] ' + error.message);
        return {
            status: 400,
            message: 'Unable to update record ' + error.message
        };
    }
};

/**
 * Deletes heading record
 * @param is_member_of_exhibit
 * @param uuid
 */
exports.delete_heading_record = async function (is_member_of_exhibit, uuid) {

    try {

        const TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);

        return {
            status: 204,
            message: 'Record deleted',
            data: await TASK.delete_heading_record(is_member_of_exhibit, uuid)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_heading_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};
