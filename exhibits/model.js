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
const EXHIBITS_CREATE_HEADING_SCHEMA = require('../exhibits/schemas/exhibit_heading_create_record_schema')();
const EXHIBITS_UPDATE_HEADING_SCHEMA = require('../exhibits/schemas/exhibit_heading_update_record_schema')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('../exhibits/tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('../exhibits/tasks/exhibit_heading_record_tasks');
const EXHIBIT_TRASHED_RECORD_TASKS = require('../exhibits/tasks/exhibit_trashed_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const LOGGER = require('../libs/log4');

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

            LOGGER.module().error('ERROR: [/exhibits/model (create_exhibit_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        if (data.styles.length === 0) {
            data.styles = '{}';
        } else {
            data.styles = VALIDATE_TASK.validator_unescape(data.styles);
        }

        const CREATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);
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

        const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);

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

        const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);

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

/** TODO: version record
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

        const CREATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);
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

        const TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);
        const ITEM_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);
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
 * Creates item record
 * @param is_member_of_exhibit
 * @param data
 */
exports.create_item_record = async function (is_member_of_exhibit, data) {

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

            return {
                status: 400,
                message: is_valid
            };
        }

        if (data.styles.length === 0) {
            data.styles = '{}';
        } else {
            data.styles = VALIDATE_TASK.validator_unescape(data.styles);
        }

        const CREATE_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);
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
        LOGGER.module().error('ERROR: [/exhibits/model (create_item_record)] Unable to create item record' + error.message);
        return {
            status: 200,
            message: 'Unable to create record ' + error.message
        };
    }
};

/**
 * Gets item records by exhibit
 * @param is_member_of_exhibit
 */
exports.get_item_records = async function (is_member_of_exhibit) {

    try {

        const ITEM_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);
        const HEADING_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES.heading_records);
        let items =  await ITEM_TASK.get_item_records(is_member_of_exhibit);
        let headings = await HEADING_TASK.get_heading_records(is_member_of_exhibit);
        let records = [...items,  ...headings];

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

        const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);

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
            data.columns = parseInt(data.columns);
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

        const UPDATE_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);
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

        const TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES.item_records);

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
        data.order = parseInt(data.order);

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_HEADING_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (create_heading_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        const CREATE_RECORD_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES.heading_records);
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

        const TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES.heading_records);

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

        const UPDATE_RECORD_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES.heading_records);
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

        const TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES.heading_records);

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
