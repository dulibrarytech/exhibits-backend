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

const ES_CONFIG = require('../config/elasticsearch_config')();
const DB = require('../config/db_config')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('../exhibits/tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('../exhibits/tasks/exhibit_heading_record_tasks');
const EXHIBIT_GRID_RECORD_TASKS = require('../exhibits/tasks/exhibit_grid_record_tasks');
const EXHIBIT_TIMELINE_RECORD_TASKS = require('../exhibits/tasks/exhibit_timeline_record_tasks');
const INDEXER_INDEX_TASKS = require('../indexer/tasks/indexer_index_tasks');
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const LOGGER = require('../libs/log4');

const {
    CLIENT,
    CONSTANTS,
    is_valid_uuid,
    build_response,
    construct_exhibit_index_record,
    construct_heading_index_record,
    construct_item_index_record,
    construct_grid_index_record,
    construct_timeline_index_record,
    batch_index_records,
    process_container_records,
    index_container_child_record,
    index_standalone_record,
    index_container_records
} = require('../indexer/indexer_helper');

// Initialize task instances
const index_tasks = new INDEXER_INDEX_TASKS(CLIENT, ES_CONFIG.elasticsearch_index);
const exhibit_record_task = new EXHIBIT_RECORD_TASKS(DB, TABLES);
const heading_record_task = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
const item_record_task = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
const grid_record_task = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
const timeline_record_task = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);

/**
 * Indexes exhibit and all its components
 * @param {string} uuid - Exhibit UUID
 * @param {string} type - Index type (publish/preview)
 * @returns {Promise<Object>} Response object
 */
exports.index_exhibit = async (uuid, type) => {

    try {
        if (!is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Invalid UUID provided'
            );
        }

        if (type !== CONSTANTS.INDEX_TYPES.PUBLISH && type !== CONSTANTS.INDEX_TYPES.PREVIEW) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Invalid index type provided'
            );
        }

        LOGGER.module().info(`INFO: [/indexer/model (index_exhibit)] Indexing exhibit ${uuid}...`);

        // Fetch all records in parallel
        const [
            exhibit_record,
            heading_records,
            item_records,
            grid_records,
            timeline_records
        ] = await Promise.all([
            exhibit_record_task.get_exhibit_record(uuid),
            heading_record_task.get_heading_records(uuid),
            item_record_task.get_item_records(uuid),
            grid_record_task.get_grid_records(uuid),
            timeline_record_task.get_timeline_records(uuid)
        ]);

        // Validate exhibit record exists
        if (!exhibit_record || !exhibit_record.uuid) {
            LOGGER.module().error(`ERROR: [/indexer/model (index_exhibit)] Exhibit ${uuid} not found`);
            return build_response(
                CONSTANTS.STATUS_CODES.NOT_FOUND,
                'Exhibit not found'
            );
        }

        // Index main exhibit record
        const exhibit_index_record = construct_exhibit_index_record(exhibit_record);
        const exhibit_response = await index_tasks.index_record(exhibit_index_record);

        if (exhibit_response.success === false) {
            LOGGER.module().error(`ERROR: [/indexer/model (index_exhibit)] Failed to index exhibit ${uuid}`);
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to index exhibit'
            );
        }

        LOGGER.module().info(
            `INFO: [/indexer/model (index_exhibit)] Exhibit record ${exhibit_index_record.uuid} indexed.`
        );

        // Process all component types in parallel
        const [
            heading_index_records,
            item_index_records,
            grid_index_records,
            timeline_index_records
        ] = await Promise.all([
            Promise.resolve(
                heading_records && heading_records.length > 0
                    ? heading_records.map(h => construct_heading_index_record(h))
                    : []
            ),
            Promise.resolve(
                item_records && item_records.length > 0
                    ? item_records.map(i => construct_item_index_record(i))
                    : []
            ),
            process_container_records({
                records: grid_records,
                type,
                record_task: grid_record_task,
                get_items_method: 'get_grid_item_records',
                set_publish_method: 'set_grid_item_to_publish',
                construct_parent: construct_grid_index_record,
                label: 'grid'
            }),
            process_container_records({
                records: timeline_records,
                type,
                record_task: timeline_record_task,
                get_items_method: 'get_timeline_item_records',
                set_publish_method: 'set_timeline_item_to_publish',
                construct_parent: construct_timeline_index_record,
                label: 'timeline'
            })
        ]);

        // Index all records in parallel batches
        await Promise.all([
            batch_index_records(heading_index_records, 'Heading', index_tasks),
            batch_index_records(item_index_records, 'Item', index_tasks),
            batch_index_records(grid_index_records, 'Grid', index_tasks),
            batch_index_records(timeline_index_records, 'Timeline', index_tasks)
        ]);

        LOGGER.module().info(`INFO: [/indexer/model (index_exhibit)] Exhibit ${uuid} indexing complete.`);

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Exhibit indexed'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_exhibit)] ${error.message}`, {
            uuid,
            type,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to index exhibit: ${error.message}`
        );
    }
};

/**
 * Gets indexed record by UUID
 * @param {string} uuid - Record UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_indexed_record = async (uuid) => {

    try {
        if (!is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Invalid UUID provided'
            );
        }

        const response = await index_tasks.get_indexed_record(uuid);

        if (!response) {
            return build_response(
                CONSTANTS.STATUS_CODES.NOT_FOUND,
                'Record not found'
            );
        }

        if (response.found === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.NOT_FOUND,
                'Record not found'
            );
        }

        if (response.found === true) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Record found',
                response
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Unexpected response format'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (get_indexed_record)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            error.message
        );
    }
};

/**
 * Deletes record from index
 * @param {string} uuid - Record UUID
 * @returns {Promise<Object>} Response object
 */
exports.delete_record = async (uuid) => {

    try {
        if (!is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Invalid UUID provided'
            );
        }

        const is_deleted = await index_tasks.delete_record(uuid);

        if (is_deleted.success === true) {
            LOGGER.module().info(`INFO: [/indexer/model (delete_record)] Indexed record ${uuid} deleted`);

            return build_response(
                CONSTANTS.STATUS_CODES.NO_CONTENT,
                'Record deleted'
            );
        }

        LOGGER.module().error(`ERROR: [/indexer/model (delete_record)] Unable to delete record ${uuid}`);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Unable to delete record'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (delete_record)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            error.message
        );
    }
};

/**
 * Indexes a single item record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} item_id - Item UUID
 * @returns {Promise<boolean>} Success status
 */
exports.index_item_record = async (exhibit_id, item_id) => {

    return index_standalone_record({
        exhibit_id,
        record_id: item_id,
        record_task: item_record_task,
        get_record_method: 'get_item_record',
        construct_fn: construct_item_index_record,
        index_tasks,
        label: 'Item'
    });
};

/**
 * Indexes a single heading record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} heading_id - Heading UUID
 * @returns {Promise<boolean>} Success status
 */
exports.index_heading_record = async (exhibit_id, heading_id) => {

    return index_standalone_record({
        exhibit_id,
        record_id: heading_id,
        record_task: heading_record_task,
        get_record_method: 'get_heading_record',
        construct_fn: construct_heading_index_record,
        index_tasks,
        label: 'Heading'
    });
};

/**
 * Indexes grid records with their items
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} grid_id - Grid UUID (optional)
 * @returns {Promise<boolean>} Success status
 */
exports.index_grid_record = async (exhibit_id, grid_id = null) => {

    return index_container_records({
        exhibit_id,
        container_id: grid_id,
        record_task: grid_record_task,
        get_records_method: 'get_grid_records',
        get_items_method: 'get_grid_item_records',
        set_publish_method: 'set_grid_item_to_publish',
        construct_parent: construct_grid_index_record,
        index_tasks,
        label: 'Grid'
    });
};

/**
 * Indexes a single grid item within a grid
 * @param {string} grid_id - Grid UUID
 * @param {string} grid_item_id - Grid item UUID
 * @param {Object} grid_item_record - Grid item record
 * @returns {Promise<boolean>} Success status
 */
exports.index_grid_item_record = async (grid_id, grid_item_id, grid_item_record) => {

    return index_container_child_record({
        parent_id: grid_id,
        child_id: grid_item_id,
        child_record: grid_item_record,
        label: 'Grid',
        get_indexed_record: exports.get_indexed_record,
        index_record: exports.index_record
    });
};

/**
 * Indexes timeline records with their items
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID (optional)
 * @returns {Promise<boolean>} Success status
 */
exports.index_timeline_record = async (exhibit_id, timeline_id = null) => {

    return index_container_records({
        exhibit_id,
        container_id: timeline_id,
        record_task: timeline_record_task,
        get_records_method: 'get_timeline_records',
        get_items_method: 'get_timeline_item_records',
        set_publish_method: 'set_timeline_item_to_publish',
        construct_parent: construct_timeline_index_record,
        index_tasks,
        label: 'Timeline'
    });
};

/**
 * Indexes a single timeline item within a timeline
 * @param {string} timeline_id - Timeline UUID
 * @param {string} timeline_item_id - Timeline item UUID
 * @param {Object} timeline_item_record - Timeline item record
 * @returns {Promise<boolean>} Success status
 */
exports.index_timeline_item_record = async (timeline_id, timeline_item_id, timeline_item_record) => {

    return index_container_child_record({
        parent_id: timeline_id,
        child_id: timeline_item_id,
        child_record: timeline_item_record,
        label: 'Timeline',
        get_indexed_record: exports.get_indexed_record,
        index_record: exports.index_record
    });
};

/**
 * Indexes a single record
 * @param {Object} record - Record to index
 * @returns {Promise<boolean>} Success status
 */
exports.index_record = async (record) => {

    try {
        if (!record || typeof record !== 'object' || !record.uuid) {
            LOGGER.module().error('ERROR: [/indexer/model (index_record)] Invalid record provided');
            return false;
        }

        const response = await index_tasks.index_record(record);

        if (response.success === true) {
            LOGGER.module().info(
                `INFO: [/indexer/model (index_record)] Record ${record.uuid} indexed.`
            );
            return true;
        }

        LOGGER.module().error(
            `ERROR: [/indexer/model (index_record)] Unable to index record ${record.uuid}.`
        );
        return false;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_record)] ${error.message}`, {
            uuid: record ? record.uuid : 'unknown',
            stack: error.stack
        });
        return false;
    }
};
