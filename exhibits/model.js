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
const EXHIBITS_CREATE_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_item_create_record_schema')();
const EXHIBITS_UPDATE_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_item_update_record_schema')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('../exhibits/tasks/exhibit_item_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const LOGGER = require('../libs/log4');

/**
 * Creates exhibit record
 * @param data
 * @param callback
 */
exports.create_exhibit_record = (data, callback) => {

    (async () => {

        try {

            const HELPER_TASK = new HELPER();
            data.uuid = HELPER_TASK.create_uuid();

            const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_RECORD_SCHEMA);
            let is_valid = VALIDATE_TASK.validate(data);

            if (is_valid !== true) {

                LOGGER.module().error('ERROR: [/exhibits/model (create_exhibit_record)] ' + is_valid[0].message);

                callback({
                    status: 400,
                    message: is_valid
                });

                return false;
            }

            const CREATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);
            let result = await CREATE_RECORD_TASK.create_exhibit_record(data);

            if (result === false) {
                callback({
                    status: 200,
                    message: 'Unable to create exhibit record'
                });
            } else {
                callback({
                    status: 201,
                    message: 'Exhibit record created',
                    data: data.uuid
                });
            }

        } catch (error) {

            callback({
                status: 200,
                message: 'Unable to create record ' + error.message
            });
        }

    })();
};

/**
 * Gets exhibit records
 * @param callback
 */
exports.get_exhibit_records = (callback) => {

    (async () => {

        try {

            const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);

            callback({
                status: 200,
                message: 'Exhibit records',
                data:  await TASK.get_exhibit_records()
            });

        } catch (error) {

            callback({
                status: 400,
                message: error.message
            });
        }

    })();
};

/**
 * Gets exhibit record by uuid
 * @param uuid
 * @param callback
 */
exports.get_exhibit_record = (uuid, callback) => {

    (async () => {

        try {

            const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);

            callback({
                status: 200,
                message: 'Exhibit records',
                data:  await TASK.get_exhibit_record(uuid)
            });

        } catch (error) {

            callback({
                status: 400,
                message: error.message
            });
        }

    })();
};

/**
 * Updates exhibit record
 * @param data
 * @param callback
 */
exports.update_exhibit_record = (data, callback) => {

    (async () => {

        try {

            if (data.is_published !== undefined && data.is_active !== undefined) {
                data.is_published = parseInt(data.is_published);
                data.is_active = parseInt(data.is_active);
            } else {
                callback({
                    status: 400,
                    message: 'Missing data'
                });
                return false;
            }

            const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_RECORD_SCHEMA);
            let is_valid = VALIDATE_TASK.validate(data);

            if (is_valid !== true) {

                LOGGER.module().error('ERROR: [/exhibits/model (update_exhibit_record)] ' + is_valid[0].message);

                callback({
                    status: 400,
                    message: is_valid
                });

                return false;
            }

            const CREATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);
            let result = await CREATE_RECORD_TASK.update_exhibit_record(data);

            if (result === false) {
                callback({
                    status: 400,
                    message: 'Unable to update exhibit record'
                });
            } else {
                callback({
                    status: 204,
                    message: 'Exhibit record updated'
                });
            }

        } catch (error) {

            callback({
                status: 400,
                message: 'Unable to update record ' + error.message
            });
        }

    })();
};

/**
 * Deletes exhibit record
 * @param uuid
 * @param callback
 */
exports.delete_exhibit_record = (uuid, callback) => {

    (async () => {

        try {

            const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);
            const ITEM_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);
            let results = await ITEM_TASK.get_item_records(uuid);

            if (results.length > 0) {

                callback({
                    status: 200,
                    message: 'Cannot delete exhibit',
                    data:  await TASK.delete_exhibit_record(uuid)
                });

                return false;
            }


            callback({
                status: 204,
                message: 'Record deleted',
                data:  await TASK.delete_exhibit_record(uuid)
            });

        } catch (error) {

            callback({
                status: 400,
                message: error.message
            });
        }

    })();
};

/**
 * Gets item records by exhibit
 * @param is_member_of_exhibit
 * @param callback
 */
exports.get_item_records = (is_member_of_exhibit, callback) => {

    (async () => {

        try {

            const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);

            callback({
                status: 200,
                message: 'Exhibit item records',
                data:  await TASK.get_item_records(is_member_of_exhibit)
            });

        } catch (error) {

            callback({
                status: 400,
                message: error.message
            });
        }

    })();
};

/**
 * Creates item record
 * @param is_member_of_exhibit
 * @param data
 * @param callback
 */
exports.create_item_record = (is_member_of_exhibit, data, callback) => {

    (async () => {

        try {

            const HELPER_TASK = new HELPER();
            data.uuid = HELPER_TASK.create_uuid();
            data.is_member_of_exhibit = is_member_of_exhibit;
            data.columns = parseInt(data.columns);
            data.order = parseInt(data.order);

            const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_ITEM_SCHEMA);
            let is_valid = VALIDATE_TASK.validate(data);

            if (is_valid !== true) {

                LOGGER.module().error('ERROR: [/exhibits/model (create_item_record)] ' + is_valid[0].message);

                callback({
                    status: 400,
                    message: is_valid
                });

                return false;
            }

            const CREATE_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);
            let result = await CREATE_RECORD_TASK.create_item_record(data);

            if (result === false) {
                callback({
                    status: 200,
                    message: 'Unable to create item record'
                });
            } else {
                callback({
                    status: 201,
                    message: 'Item record created',
                    data: data.uuid
                });
            }

        } catch (error) {

            callback({
                status: 200,
                message: 'Unable to create record ' + error.message
            });
        }

    })();
};

/**
 * Gets item record by uuid and is_member_of_exhibit
 * @param is_member_of_exhibit
 * @param uuid
 * @param callback
 */
exports.get_item_record = (is_member_of_exhibit, uuid, callback) => {

    (async () => {

        try {

            const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);

            callback({
                status: 200,
                message: 'Item record',
                data:  await TASK.get_item_record(is_member_of_exhibit, uuid)
            });

        } catch (error) {

            callback({
                status: 400,
                message: error.message
            });
        }

    })();
};

/** Updates item record
 * @param is_member_of_exhibit
 * @param uuid
 * @param data
 * @param callback
*/
exports.update_item_record = (is_member_of_exhibit, uuid, data, callback) => {

    (async () => {

        try {

            if (data.is_published !== undefined && data.is_active !== undefined) {
                data.is_published = parseInt(data.is_published);
                data.is_active = parseInt(data.is_active);
                data.columns = parseInt(data.columns);
                data.order = parseInt(data.order);
            } else {
                callback({
                    status: 400,
                    message: 'Bad Request.'
                });

                return false;
            }

            data.is_member_of_exhibit = is_member_of_exhibit;
            data.uuid = uuid;

            const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_ITEM_SCHEMA);
            let is_valid = VALIDATE_TASK.validate(data);

            if (is_valid !== true) {

                LOGGER.module().error('ERROR: [/exhibits/model (update_item_record)] ' + is_valid[0].message);

                callback({
                    status: 400,
                    message: is_valid
                });

                return false;
            }

            const UPDATE_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);
            let result = await UPDATE_RECORD_TASK.update_item_record(data);

            if (result === false) {
                callback({
                    status: 400,
                    message: 'Unable to update item record'
                });
            } else {
                callback({
                    status: 204,
                    message: 'Item record updated'
                });
            }

        } catch (error) {

            callback({
                status: 400,
                message: 'Unable to update record ' + error.message
            });
        }

    })();
};

/**
 * Deletes item record
 * @param is_member_of_exhibit
 * @param uuid
 * @param callback
 */
exports.delete_item_record = (is_member_of_exhibit, uuid, callback) => {

    (async () => {

        try {

            const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);

            callback({
                status: 204,
                message: 'Record deleted',
                data:  await TASK.delete_item_record(is_member_of_exhibit, uuid)
            });

        } catch (error) {

            callback({
                status: 400,
                message: error.message
            });
        }

    })();
};

/**
 * Create heading record
 * @param is_member_of_exhibit
 * @param data
 * @param callback
 */
exports.create_heading_record = (is_member_of_exhibit, data, callback) => {

    (async () => {

        try {

            const HELPER_TASK = new HELPER();
            data.uuid = HELPER_TASK.create_uuid();
            data.is_member_of_exhibit = is_member_of_exhibit;
            data.columns = parseInt(data.columns);
            data.order = parseInt(data.order);

            const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_HEADING_SCHEMA);
            let is_valid = VALIDATE_TASK.validate(data);

            if (is_valid !== true) {

                LOGGER.module().error('ERROR: [/exhibits/model (create_heading_record)] ' + is_valid[0].message);

                callback({
                    status: 400,
                    message: is_valid
                });

                return false;
            }

            const CREATE_RECORD_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES.item_records);
            let result = await CREATE_RECORD_TASK.create_heading_record(data);

            if (result === false) {
                callback({
                    status: 200,
                    message: 'Unable to create heading record'
                });
            } else {
                callback({
                    status: 201,
                    message: 'Heading record created',
                    data: data.uuid
                });
            }

        } catch (error) {

            callback({
                status: 200,
                message: 'Unable to create record ' + error.message
            });
        }

    })();
};