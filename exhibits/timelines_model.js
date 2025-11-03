/**

 Copyright 2024 University of Denver

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
const EXHIBITS_CREATE_TIMELINE_SCHEMA = require('../exhibits/schemas/exhibit_timeline_create_record_schema')();
const EXHIBITS_UPDATE_TIMELINE_SCHEMA = require('../exhibits/schemas/exhibit_timeline_update_record_schema')();
const EXHIBITS_CREATE_TIMELINE_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_timeline_item_create_record_schema')();
const EXHIBITS_UPDATE_TIMELINE_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_timeline_item_update_record_schema')();
const EXHIBIT_TIMELINE_RECORD_TASKS = require('./tasks/exhibit_timeline_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const EXHIBIT_RECORD_TASKS = require('./tasks/exhibit_record_tasks');
const INDEXER_MODEL = require('../indexer/model');
const LOGGER = require('../libs/log4');

/**
 * Create timeline record
 * @param is_member_of_exhibit
 * @param data
 */
exports.create_timeline_record = async function (is_member_of_exhibit, data) {

    try {

        const HELPER_TASK = new HELPER();
        data.uuid = HELPER_TASK.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;
        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_TIMELINE_SCHEMA);
        data.styles = JSON.stringify(data.styles);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/timeline_model (create_timeline_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        const CREATE_RECORD_TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_timeline_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to create timeline record'
            };
        } else {
            return {
                status: 201,
                message: 'Timeline record created',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (create_timeline_record)] ' + error.message);
    }
};

/**
 * Updates timeline record
 * @param is_member_of_exhibit
 * @param timeline_id
 * @param data
 */
exports.update_timeline_record = async function (is_member_of_exhibit, timeline_id, data) {

    try {

        // const HELPER_TASK = new HELPER();
        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_TIMELINE_SCHEMA);

        data.is_member_of_exhibit = is_member_of_exhibit;
        data.uuid = timeline_id;
        data.styles = JSON.stringify(data.styles);

        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/timeline_model (update_timeline_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        // data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        const CREATE_RECORD_TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.update_timeline_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to update timeline record'
            };
        } else {
            return {
                status: 201,
                message: 'Timeline record updated',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (update_timeline_record)] ' + error.message);
    }
};

/**
 *  Gets timeline record
 * @param is_member_of_exhibit
 * @param timeline_id
 */
exports.get_timeline_record = async function (is_member_of_exhibit, timeline_id) {

    try {

        const GRID_TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        const record = await GRID_TASK.get_timeline_record(is_member_of_exhibit, timeline_id);

        return {
            status: 200,
            message: 'Timeline record',
            data: record
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_timeline_record)] ' + error.message);
    }
};

/**
 * Creates timeline item record
 * @param is_member_of_exhibit
 * @param timeline_id
 * @param data
 */
exports.create_timeline_item_record = async function (is_member_of_exhibit, timeline_id, data) {

    try {

        const HELPER_TASK = new HELPER();
        data.uuid = HELPER_TASK.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;
        data.is_member_of_timeline = timeline_id;

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_TIMELINE_ITEM_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/timeline_model (create_timeline_record)] ' + is_valid[0].message);

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

        data.styles = JSON.stringify(data.styles);
        data.order = await HELPER_TASK.order_timeline_items(data.is_member_of_timeline, DB, TABLES);

        const CREATE_RECORD_TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        let result = await CREATE_RECORD_TASK.create_timeline_item_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to create timeline item record'
            };
        } else {
            return {
                status: 201,
                message: 'Timeline item record created',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (create_timeline_item_record)] ' + error.message);
    }
};

/**
 * Gets timeline items
 * @param is_member_of_exhibit
 * @param is_member_of_timeline
 */
exports.get_timeline_item_records = async function (is_member_of_exhibit, is_member_of_timeline) {

    try {

        const TIMELINE_TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        const grid_items = await TIMELINE_TASK.get_timeline_item_records(is_member_of_exhibit, is_member_of_timeline);

        return {
            status: 200,
            message: 'Exhibit timeline item records',
            data: grid_items
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_timeline_item_records)] ' + error.message);
    }
};

/**
 * Gets timeline item record
 * @param is_member_of_exhibit
 * @param is_member_of_timeline
 * @param item_id
 */
exports.get_timeline_item_record = async function (is_member_of_exhibit, is_member_of_timeline, item_id) {

    try {

        const TIMELINE_TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        const timeline_items = await TIMELINE_TASK.get_timeline_item_record(is_member_of_exhibit, is_member_of_timeline, item_id);

        return {
            status: 200,
            message: 'Exhibit timeline item record',
            data: timeline_items
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_timeline_item_record)] ' + error.message);
    }
};

/**
 * Gets timeline item edit record
 * @param is_member_of_exhibit
 * @param is_member_of_timeline
 * @param item_id
 * @param uid
 */
exports.get_timeline_item_edit_record = async function (uid, is_member_of_exhibit, is_member_of_timeline, item_id) {

    try {

        const TIMELINE_TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        const timeline_items = await TIMELINE_TASK.get_timeline_item_edit_record(uid, is_member_of_exhibit, is_member_of_timeline, item_id);

        return {
            status: 200,
            message: 'Exhibit grid item record',
            data: timeline_items
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (get_timeline_item_record)] ' + error.message);
    }
};

/**
 * Updates timeline item
 * @param is_member_of_exhibit
 * @param is_member_of_timeline
 * @param item_id
 * @param data
 */
exports.update_timeline_item_record = async function (is_member_of_exhibit, is_member_of_timeline, item_id, data) {

    try {

        const HELPER_TASK = new HELPER();
        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_UPDATE_TIMELINE_ITEM_SCHEMA);
        data.is_member_of_exhibit = is_member_of_exhibit;
        data.is_member_of_timeline = is_member_of_timeline;
        data.uuid = item_id;
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/timeline_model (update_timeline_item_record)] ' + is_valid[0].message);

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

            if (data.styles === undefined || data.styles.length === 0) {
                data.styles = {};
            }

            delete data.kaltura;
            delete data.repo_uuid;
            delete data.media_prev;
            delete data.thumbnail_prev;
        }

        data.styles = JSON.stringify(data.styles);
        data.order = await HELPER_TASK.order_exhibit_items(data.is_member_of_timeline, DB, TABLES);
        const UPDATE_RECORD_TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        let result = await UPDATE_RECORD_TASK.update_timeline_item_record(data);

        if (result === false) {
            return {
                status: 200,
                message: 'Unable to update timeline item record'
            };
        } else {
            return {
                status: 201,
                message: 'Timeline item record updated',
                data: data.uuid
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (update_timeline_item_record)] ' + error.message);
    }
};

/**
 *
 * @param is_member_of_exhibit
 * @param timeline_id
 * @param timeline_item_id
 */
exports.delete_timeline_item_record = async function (is_member_of_exhibit, timeline_id, timeline_item_id) {

    try {

        const TASK = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);

        return {
            status: 204,
            message: 'Record deleted',
            data: await TASK.delete_timeline_item_record(is_member_of_exhibit, timeline_id, timeline_item_id)
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (delete_timeline_item_record)] ' + error.message);
        return {
            status: 400,
            message: error.message
        };
    }
};

/**
 * Publishes timeline
 * @param exhibit_id
 * @param timeline_id
 */
exports.publish_timeline_record = async function (exhibit_id, timeline_id) {

    try {

        const EXHIBIT_TASKS = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        const TIMELINE_TASKS = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        const exhibit_record = await EXHIBIT_TASKS.get_exhibit_record(exhibit_id);

        if (exhibit_record.is_published === 0) {

            LOGGER.module().error('ERROR: [/exhibits/timelines_model (publish_timeline_record)] Unable to publish timeline');

            return {
                status: false,
                message: 'Unable to publish timeline. Exhibit must be published first'
            };
        }

        const is_item_published = await TIMELINE_TASKS.set_timeline_to_publish(timeline_id);

        if (is_item_published === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_timeline_record)] Unable to publish timeline');

            return {
                status: false,
                message: 'Unable to publish timeline'
            };

        }

        const is_indexed = await INDEXER_MODEL.index_timeline_record(exhibit_id, timeline_id);

        if (is_indexed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_timeline_record)] Unable to publish timeline');

            return {
                status: false,
                message: 'Unable to publish timeline'
            };
        }

        return {
            status: true,
            message: 'Timeline published'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (publish_timeline_record)] ' + error.message);
    }
};

/**
 * Suppress timeline
 * @param exhibit_id
 * @param item_id
 */
exports.suppress_timeline_record = async function (exhibit_id, item_id) {

    try {

        const TIMELINE_TASKS = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        const is_deleted = await INDEXER_MODEL.delete_record(item_id);

        if (is_deleted === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (suppress_timeline_record)] Unable to suppress timeline');

            return {
                status: false,
                message: 'Unable to suppress timeline'
            };
        }

        const is_item_suppressed = await TIMELINE_TASKS.set_timeline_to_suppress(item_id);
        const timeline_records = await TIMELINE_TASKS.get_timeline_records(exhibit_id, item_id);

        for (let i = 0; i < timeline_records.length; i++) {

            await TIMELINE_TASKS.set_to_suppressed_timeline_items(timeline_records[i].is_member_of_exhibit);
            let items = await TIMELINE_TASKS.get_timeline_item_records(timeline_records[i].is_member_of_exhibit, timeline_records[i].uuid);

            for (let j = 0; j < items.length; j++) {
                await TIMELINE_TASKS.set_to_suppressed_timeline_items(items[j].is_member_of_timeline);
            }
        }

        if (is_item_suppressed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (suppress_timeline_record)] Unable to suppress timeline');

            return {
                status: false,
                message: 'Unable to suppress timeline'
            };

        } else {

            return {
                status: true,
                message: 'Timeline suppressed'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (suppress_timeline_record)] ' + error.message);
    }
};

/**
 * Publishes timeline item
 * @param exhibit_id
 * @param timeline_id
 * @param timeline_item_id
 */
exports.publish_timeline_item_record = async function (exhibit_id, timeline_id, timeline_item_id) {

    try {

        const data = {
            is_member_of_exhibit: exhibit_id,
            is_member_of_timeline: timeline_id,
            uuid: timeline_item_id,
            is_published: 1
        };

        const TIMELINE_TASKS = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        let timeline_record = await TIMELINE_TASKS.get_timeline_record(exhibit_id, timeline_id);

        if (timeline_record[0].is_published === 0) {

            LOGGER.module().error('ERROR: [/exhibits/timelines_model (publish_timeline_item_record)] Unable to publish timeline item');

            return {
                status: false,
                message: 'Unable to publish item. Timeline must be published first'
            };
        }

        let timeline_item_record = await TIMELINE_TASKS.get_timeline_item_record(exhibit_id, timeline_id, timeline_item_id);
        const is_indexed = await INDEXER_MODEL.index_timeline_item_record(timeline_id, timeline_item_id, timeline_item_record.pop());

        if (is_indexed === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (publish_item_record)] Unable to publish timeline item');

            return {
                status: false,
                message: 'Unable to publish timeline item'
            };

        } else {

            await TIMELINE_TASKS.update_timeline_item_record(data);

            return {
                status: true,
                message: 'Timeline item published'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (publish_timeline_item_record)] ' + error.message);
    }
};

/**
 * Suppress timeline item
 * @param exhibit_id
 * @param timeline_id
 * @param timeline_item_id
 */
exports.suppress_timeline_item_record = async function (exhibit_id, timeline_id, timeline_item_id) {

    try {

        const data = {
            is_member_of_exhibit: exhibit_id,
            is_member_of_timeline: timeline_id,
            uuid: timeline_item_id,
            is_published: 0
        };

        const TIMELINE_TASKS = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        let indexed_record = await INDEXER_MODEL.get_indexed_record(timeline_id);
        let items = indexed_record.data._source.items;
        let updated_items = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].uuid !== timeline_item_id) {
                updated_items.push(items[i]);
            }
        }

        indexed_record.data._source.items = updated_items;

        // remove original timeline record
        const is_deleted = await INDEXER_MODEL.delete_record(timeline_id);

        if (is_deleted === false) {

            LOGGER.module().error('ERROR: [/exhibits/model (suppress_timeline_item_record)] Unable to suppress timeline item');

            return {
                status: false,
                message: 'Unable to suppress timeline item'
            };
        }

        await TIMELINE_TASKS.update_timeline_item_record(data);
        const is_indexed = await INDEXER_MODEL.index_record(indexed_record.data._source);

        if (is_indexed === true) {
            return true;
        } else {
            return false;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (suppress_timeline_item_record)] ' + error.message);
    }
};

/**
 * Updates timeline order in exhibit
 * @param exhibit_id
 * @param timeline
 */
exports.reorder_timelines = async function (exhibit_id, timeline) {

    try {
        const TASKS = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        return await TASKS.reorder_timelines(exhibit_id, timeline);
    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (reorder_timelines)] ' + error.message);
    }
};

/**
 * Updates timeline item order in timeline
 * @param timeline_id
 * @param timeline
 */
exports.reorder_timeline_items = async function (timeline_id, timeline) {

    try {
        const TASKS = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        return await TASKS.reorder_timeline_items(timeline_id, timeline);
    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (reorder_timeline_items)] ' + error.message);
    }
};

exports.unlock_timeline_item_record = async function (uid, uuid) {

    try {

        const HELPER_TASK = new HELPER();
        return await HELPER_TASK.unlock_record(uid, uuid, DB, TABLES.timeline_item_records);

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/model (unlock_timeline_item_record)] ' + error.message);
    }
};