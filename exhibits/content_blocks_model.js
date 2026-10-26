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
const EXHIBITS_CREATE_CONTENT_BLOCK_SCHEMA = require('../exhibits/schemas/exhibit_content_block_create_record_schema')();
const EXHIBITS_UPDATE_CONTENT_BLOCK_SCHEMA = require('../exhibits/schemas/exhibit_content_block_update_record_schema')();
const EXHIBIT_CONTENT_BLOCK_RECORD_TASKS = require('../exhibits/tasks/exhibit_content_block_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const EXHIBIT_RECORD_TASKS = require('./tasks/exhibit_record_tasks');
const INDEXER_MODEL = require('../indexer/model');
const LOGGER = require('../libs/log4');
const REINDEX_COALESCER = require('./reindex_coalescer');
const {
    is_valid_uuid,
    is_valid_user_id,    build_response,
    validate_input,
    prepare_styles
} = require('../exhibits/common_helper');

// Constants
const CONSTANTS = {
    STATUS_CODES: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        INTERNAL_SERVER_ERROR: 500
    },
    PUBLICATION_STATUS: {
        PUBLISHED: 1,
        UNPUBLISHED: 0
    }
};

// Initialize task instances
const helper_task = new HELPER();
const validate_create_content_block_task = new VALIDATOR(EXHIBITS_CREATE_CONTENT_BLOCK_SCHEMA);
const validate_content_block_update_task = new VALIDATOR(EXHIBITS_UPDATE_CONTENT_BLOCK_SCHEMA);
const content_block_record_task = new EXHIBIT_CONTENT_BLOCK_RECORD_TASKS(DB, TABLES);
const exhibit_tasks = new EXHIBIT_RECORD_TASKS(DB, TABLES);

/**
 * Handles post-update republishing for content block
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - content block UUID
 * @returns {Promise<void>}
 */
const handle_content_block_republish = async (is_member_of_exhibit, uuid) => {

    try {

        // Re-index just this content block in place — no suppress. ES index upserts by id,
        // so re-indexing overwrites; suppressing would only blank it from public
        // search for the delay window. (publish_content_block_record re-indexes just this.)
        // Coalesced per content block: a burst of edits collapses to one near-real-time
        // re-index (was a flat 5s delay + one independent timer per edit).
        REINDEX_COALESCER.schedule_reindex(`content_block:${uuid}`, async () => {
            const publish_result = await publish_content_block_record(is_member_of_exhibit, uuid);

            if (publish_result && publish_result.status === true) {
                LOGGER.module().info('INFO: [/exhibits/content_blocks_model (handle_content_block_republish)] content block record re-indexed after edit.');
            } else {
                LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (handle_content_block_republish)] Failed to re-index content block');
            }
        });
    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (handle_content_block_republish)] ${error.message}`, {
            is_member_of_exhibit,
            uuid,
            stack: error.stack
        });
    }
};

/**
 * Creates content block record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Object} data - content block data
 * @returns {Promise<Object>} Response object
 */
const RTE_VOCABULARY = require('../libs/rte_vocabulary');

/* content block text renders inside <h2>/<h3> on the public site — inline formats only */
const CONTENT_BLOCK_RTE_PROFILES = {
    text: 'full',
    title: 'full',
};

exports.create_content_block_record = async (is_member_of_exhibit, data) => {

    RTE_VOCABULARY.apply(data, CONTENT_BLOCK_RTE_PROFILES);

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid exhibit UUID provided'
            );
        }

        if (!data || typeof data !== 'object') {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid data provided'
            );
        }

        // Prepare data
        data.uuid = helper_task.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;

        // Validate
        const validation_result = validate_input(data, validate_create_content_block_task, 'content_blocks_model (create_content_block_record)');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Get order and prepare styles
        data.order = await helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);
        data.styles = prepare_styles(data.styles);

        // Create record
        const result = await content_block_record_task.create_content_block_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (create_content_block_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to create content block record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'content block record created',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (create_content_block_record)] ${error.message}`, {
            is_member_of_exhibit,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
            `Unable to create record: ${error.message}`
        );
    }
};

/**
 * Gets content block record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - content block UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_content_block_record = async (is_member_of_exhibit, uuid) => {
    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await content_block_record_task.get_content_block_record(is_member_of_exhibit, uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'content block record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (get_content_block_record)] ${error.message}`, {
            is_member_of_exhibit,
            uuid,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Gets content block edit record
 * @param {string} uid - User ID
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - content block UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_content_block_edit_record = async (uid, is_member_of_exhibit, uuid) => {

    try {

        if (!is_valid_user_id(uid) || !is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await content_block_record_task.get_content_block_edit_record(uid, is_member_of_exhibit, uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'content block edit record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (get_content_block_edit_record)] ${error.message}`, {
            uid,
            is_member_of_exhibit,
            uuid,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Updates content block record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - content block UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Response object
 */
exports.update_content_block_record = async (is_member_of_exhibit, uuid, data) => {

    RTE_VOCABULARY.apply(data, CONTENT_BLOCK_RTE_PROFILES);

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        if (!data || typeof data !== 'object') {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid data provided'
            );
        }

        // Prepare data
        data.is_member_of_exhibit = is_member_of_exhibit;
        data.uuid = uuid;

        // Extract is_published before validation
        const is_published = data.is_published;
        delete data.is_published;

        // Validate
        const validation_result = validate_input(data, validate_content_block_update_task, 'content_blocks_model (update_content_block_record)');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Prepare styles
        data.styles = prepare_styles(data.styles);

        // Update record
        const result = await content_block_record_task.update_content_block_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Unable to update content block record'
            );
        }

        // Handle republishing if needed (check for truthy values)
        if (is_published === 'true' || is_published === true || is_published === 1) {
            setImmediate(() => handle_content_block_republish(is_member_of_exhibit, uuid));
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'content block record updated'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (update_content_block_record)] ${error.message}`, {
            is_member_of_exhibit,
            uuid,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            `Unable to update record: ${error.message}`
        );
    }
};

/**
 * Publishes content block record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} content_block_id - content block UUID
 * @returns {Promise<Object>} Response object
 */
const publish_content_block_record = async (exhibit_id, content_block_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(content_block_id)) {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Check if exhibit is published
        const exhibit_record = await exhibit_tasks.get_exhibit_record(exhibit_id);

        if (!exhibit_record || exhibit_record.is_published === CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED) {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (publish_content_block_record)] Exhibit not published');

            return {
                status: false,
                message: 'Unable to publish content block. Exhibit must be published first'
            };
        }

        // Set content block to published and index (order matters: publish first, then index)
        const is_content_block_published = await content_block_record_task.set_content_block_to_publish(content_block_id);
        const is_indexed = await INDEXER_MODEL.index_content_block_record(exhibit_id, content_block_id);

        if (is_indexed === false) {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (publish_content_block_record)] Unable to index content block');

            return {
                status: false,
                message: 'Unable to publish content block'
            };
        }

        if (is_content_block_published === false) {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (publish_content_block_record)] Unable to set content block to published');

            return {
                status: false,
                message: 'Unable to publish content block'
            };
        }

        return {
            status: true,
            message: 'content block published'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (publish_content_block_record)] ${error.message}`, {
            exhibit_id,
            content_block_id,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Suppresses content block record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} item_id - content block UUID
 * @returns {Promise<Object>} Response object
 */
const suppress_content_block_record = async (exhibit_id, item_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(item_id)) {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Delete from index
        const delete_result = await INDEXER_MODEL.delete_record(item_id);

        if (delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (suppress_content_block_record)] Unable to delete from index');

            return {
                status: false,
                message: 'Unable to suppress content block'
            };
        }

        // Set content block to suppressed
        const is_content_block_suppressed = await content_block_record_task.set_content_block_to_suppress(item_id);

        if (is_content_block_suppressed === false) {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (suppress_content_block_record)] Unable to set content block to suppressed');

            return {
                status: false,
                message: 'Unable to suppress content block'
            };
        }

        return {
            status: true,
            message: 'content block suppressed'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (suppress_content_block_record)] ${error.message}`, {
            exhibit_id,
            item_id,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Reorders content blocks in exhibit
 * @param {string} exhibit_id - Exhibit UUID
 * @param {Object} content block - content block order data
 * @returns {Promise<*>} Result from task
 */
exports.reorder_content_blocks = async (exhibit_id, content_block) => {

    try {

        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (reorder_content_blocks)] Invalid exhibit UUID provided');
            return false;
        }

        if (!content_block || typeof content_block !== 'object') {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (reorder_content_blocks)] Invalid content block data provided');
            return false;
        }

        return await content_block_record_task.reorder_content_blocks(exhibit_id, content_block);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (reorder_content_blocks)] ${error.message}`, {
            exhibit_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Unlocks content block record for editing
 * @param {string} uid - User ID
 * @param {string} uuid - content block UUID
 * @param {object} options - {force: true/false}
 * @returns {Promise<*>} Unlock result
 */
exports.unlock_content_block_record = async (uid, uuid, options) => {

    try {

        if (!is_valid_user_id(uid) || !is_valid_uuid(uuid)) {
            LOGGER.module().error('ERROR: [/exhibits/content_blocks_model (unlock_content_block_record)] Invalid UUID provided');
            return false;
        }

        return await helper_task.unlock_record(uid, uuid, DB, TABLES.content_block_records, options);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/content_blocks_model (unlock_content_block_record)] ${error.message}`, {
            uid,
            uuid,
            stack: error.stack
        });

        return false;
    }
};

exports.publish_content_block_record = publish_content_block_record;
exports.suppress_content_block_record = suppress_content_block_record;
