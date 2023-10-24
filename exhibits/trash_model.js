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
const EXHIBIT_TRASHED_RECORD_TASKS = require('../exhibits/tasks/exhibit_trashed_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const LOGGER = require('../libs/log4');

/**
 * Get all trashed records
 */
exports.get_trashed_records = async function () {

    try {

        const TASKS = new EXHIBIT_TRASHED_RECORD_TASKS(DB, TABLES);
        let exhibit_records = await TASKS.get_trashed_exhibit_records();
        let exhibit_heading_records = await TASKS.get_trashed_heading_records();
        let exhibit_item_records = await TASKS.get_trashed_item_records();
        let data = {};

        if (exhibit_records.length > 0) {
            data.exhibit_records = exhibit_records;
        }

        if (exhibit_heading_records.length > 0) {
            data.exhibit_heading_records = exhibit_heading_records;
        }

        if (exhibit_item_records.length > 0) {
            data.exhibit_item_records = exhibit_item_records;
        }

        return {
            status: 200,
            message: 'Trashed records',
            data: data
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_trashed_records)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Permanently deletes trashed record
 * @param is_member_of_exhibit
 * @param uuid
 * @param type
 */
exports.delete_trashed_record = async function (is_member_of_exhibit, uuid, type) {

    try {

        let table;

        if (type === 'exhibit') {
            table = TABLES.exhibit_records;
        } else if (type === 'heading') {
            table = TABLES.heading_records;
        } else if (type === 'item') {
            table = TABLES.item_records;
        }

        const TASKS = new EXHIBIT_TRASHED_RECORD_TASKS(DB, table);
        await TASKS.delete_trashed_record(is_member_of_exhibit, uuid);

        return {
            status: 204,
            message: 'Record permanently deleted'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_trashed_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Permanently deletes all trashed records
 */
exports.delete_all_trashed_records = function () {

    try {

        let tables = [TABLES.exhibit_records, TABLES.heading_records, TABLES.item_records];

        tables.forEach(async (table) => {
            const TASKS = new EXHIBIT_TRASHED_RECORD_TASKS(DB, table);
            await TASKS.delete_all_trashed_records();
        });

        return {
            status: 204,
            message: 'Records permanently deleted'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_all_trashed_records)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Restores trashed record
 * @param is_member_of_exhibit
 * @param uuid
 * @param type
 */
exports.restore_trashed_record = async function (is_member_of_exhibit, uuid, type) {

    try {

        let table;

        if (type === 'exhibit') {
            table = TABLES.exhibit_records;
        } else if (type === 'heading') {
            table = TABLES.heading_records;
        } else if (type === 'item') {
            table = TABLES.item_records;
        }

        const TASKS = new EXHIBIT_TRASHED_RECORD_TASKS(DB, table);
        await TASKS.restore_trashed_record(is_member_of_exhibit, uuid);

        return {
            status: 204,
            message: 'Record permanently deleted'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (restore_trashed_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};
