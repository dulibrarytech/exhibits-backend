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

const FS = require('fs');
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const EXHIBITS_CREATE_RECORD_SCHEMA = require('../exhibits/schemas/exhibit_create_record_schema')();
const EXHIBITS_UPDATE_RECORD_SCHEMA = require('../exhibits/schemas/exhibit_update_record_schema')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('./tasks/exhibit_item_record_tasks');
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

        if (!FS.existsSync(`./storage/${data.uuid}`)){
            FS.mkdirSync(`./storage/${data.uuid}`);
        }

        if (data.hero_image.length > 0) {

            FS.rename(`./storage/${data.hero_image}`, `./storage/${data.uuid}/${data.uuid}_${data.hero_image}`, (error) => {
                if (error) {
                    console.log('ERROR: ' + error);
                }
            });

            data.hero_image = `${data.uuid}_${data.hero_image}`;
        }

        if (data.thumbnail_image.length > 0) {

            FS.rename(`./storage/${data.thumbnail_image}`, `./storage/${data.uuid}/${data.uuid}_${data.thumbnail_image}`, (error) => {
                if (error) {
                    console.log('ERROR: ' + error);
                }
            });

            data.thumbnail_image = `${data.uuid}_${data.thumbnail_image}`;
        }

        if (data.styles === undefined || data.styles.length === 0) {
            data.styles = '{}';
        }

        data.styles = JSON.stringify(data.styles);

        const CREATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_exhibit_record(data);
        console.log(result);
        if (result === false) {

            return {
                status: 200,
                message: 'Unable to create exhibit record'
            };

        } else {
            console.log('UUID: ', data.uuid);
            return {
                status: 201,
                message: 'Exhibit record created',
                data: data.uuid
            };

        }

    } catch (error) {
        // TODO: log
        console.log('ERROR: ' + error.message);
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
 * @param data
 */
exports.update_exhibit_record = async function (data) {

    try {

        if (data.is_published !== undefined && data.is_locked !== undefined) {
            data.is_published = parseInt(data.is_published);
            data.is_locked = parseInt(data.is_locked);
        } else {

            return {
                status: 400,
                message: 'Missing data'
            };
        }

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_RECORD_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (update_exhibit_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        const CREATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.update_exhibit_record(data);

        if (result === false) {
            return {
                status: 400,
                message: 'Unable to update exhibit record'
            };
        } else {
            return {
                status: 204,
                message: 'Exhibit record updated'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (update_exhibit_record)] ' + error.message);
        callback({
            status: 400,
            message: 'Unable to update record ' + error.message
        });
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
                message: 'Cannot delete exhibit'
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

/** TODO
 * Publishes exhibit
 * @param uuid
 */
exports.publish_exhibit = function (uuid) {
    // TODO: update publish field in db tables by uuid
    // TODO: make request to indexer "index_exhibit"
};

/** TODO
 * Suppresses exhibit
 * @param uuid
 */
exports.suppress_exhibit = function (uuid) {
    // TODO: update publish field in db tables
    // TODO: delete all exhibit records in index by uuid
};

// TODO: publish and suppress single records i.e. items, headings, grids, timelines
