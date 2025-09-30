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
const EXHIBIT_RECORD_TASKS = require("./tasks/exhibit_record_tasks");
const INDEXER_MODEL = require("../indexer/model");

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

        if (data.styles === undefined || data.styles.length === 0) {
            data.styles = '{}';
        }

        data.styles = JSON.stringify(data.styles);

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

/**
 * Gets heading edit record
 * @param is_member_of_exhibit
 * @param uuid
 * @param uid
 */
exports.get_heading_edit_record = async function (uid, is_member_of_exhibit, uuid) {

    try {

        const TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);

        return {
            status: 200,
            message: 'Heading record',
            data: await TASK.get_heading_edit_record(uid, is_member_of_exhibit, uuid)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_heading_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Updates heading record
 * @param is_member_of_exhibit
 * @param uuid
 * @param data
 */
exports.update_heading_record = async function (is_member_of_exhibit, uuid, data) {

    try {

        data.is_member_of_exhibit = is_member_of_exhibit;
        data.uuid = uuid;

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_HEADING_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);
        let is_published = false;

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (update_heading_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        data.styles = JSON.stringify(data.styles);
        is_published = data.is_published;
        delete data.is_published;

        const UPDATE_RECORD_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        let result = await UPDATE_RECORD_TASK.update_heading_record(data);

        if (result === false) {
            return {
                status: 400,
                message: 'Unable to update heading record'
            };
        } else {

            if (is_published === 'true') {

                const is_suppressed = await suppress_heading_record(is_member_of_exhibit, uuid);

                if (is_suppressed.status === true) {
                    setTimeout(async () => {

                        const is_published = await publish_heading_record(is_member_of_exhibit, uuid);

                        if (is_published.status === true) {
                            LOGGER.module().info('INFO: [/exhibits/model (update_heading_record)] Heading record re-published successfully.');
                        }

                    }, 5000);
                }
            }

            return {
                status: 201,
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
        const is_heading_deleted = await INDEXER_MODEL.delete_record(uuid);

        if (is_heading_deleted.status === 204) {
            console.log('Index record deleted');
        } else {
            console.log('Index record not deleted');
        }

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

/**
 * Publishes heading item
 * @param exhibit_id
 * @param heading_id
 */
const publish_heading_record = async function (exhibit_id, heading_id) {

    try {

        const EXHIBIT_TASKS = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        const HEADING_TASKS = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        const exhibit_record = await EXHIBIT_TASKS.get_exhibit_record(exhibit_id);

        if (exhibit_record[0].is_published === 0) {

            LOGGER.module().error('ERROR: [/exhibits/items_model (publish_item_record)] Unable to publish heading');

            return {
                status: false,
                message: 'Unable to publish heading. Exhibit must be published first'
            };
        }

        const is_item_published = await HEADING_TASKS.set_heading_to_publish(heading_id);
        const is_indexed = await INDEXER_MODEL.index_heading_record(exhibit_id, heading_id);

        if (is_indexed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_heading_record)] Unable to publish heading');

            return {
                status: false,
                message: 'Unable to publish heading'
            };
        }

        if (is_item_published === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_heading_record)] Unable to publish heading');

            return {
                status: false,
                message: 'Unable to publish heading'
            };

        } else {

            return {
                status: true,
                message: 'Heading published'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (publish_heading_record)] ' + error.message);
    }
};

/**
 * Suppress heading
 * @param exhibit_id
 * @param item_id
 */
const suppress_heading_record = async function (exhibit_id, item_id) {

    try {

        const HEADING_TASKS = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        const is_deleted = await INDEXER_MODEL.delete_record(item_id);

        if (is_deleted === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (suppress_heading_record)] Unable to suppress item');

            return {
                status: false,
                message: 'Unable to suppress heading'
            };
        }

        const is_item_suppressed = await HEADING_TASKS.set_heading_to_suppress(item_id);

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

/**
 * Updates item order in exhibit
 * @param exhibit_id
 * @param heading
 */
exports.reorder_headings = async function (exhibit_id, heading) {

    try {
        const TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        return await TASK.reorder_headings(exhibit_id, heading);
    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (reorder_headings)] ' + error.message);
    }
};

exports.unlock_heading_record = async function (uuid) {

    try {

        const HELPER_TASK = new HELPER();
        return await HELPER_TASK.unlock_record(0, uuid, DB, TABLES.heading_records);

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (unlock_heading_record)] ' + error.message);
    }
}

exports.publish_heading_record = publish_heading_record;
exports.suppress_heading_record = suppress_heading_record;
