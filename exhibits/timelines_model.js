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

// Constants
const CONSTANTS = {
    STATUS_CODES: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400
    },
    ITEM_TYPES: {
        TEXT: 'text'
    },
    PUBLICATION_STATUS: {
        PUBLISHED: 1,
        UNPUBLISHED: 0
    }
};

// Initialize task instances
const helper_task = new HELPER();
const validate_create_timeline_task = new VALIDATOR(EXHIBITS_CREATE_TIMELINE_SCHEMA);
const validate_update_timeline_task = new VALIDATOR(EXHIBITS_UPDATE_TIMELINE_SCHEMA);
const validate_create_timeline_item_task = new VALIDATOR(EXHIBITS_CREATE_TIMELINE_ITEM_SCHEMA);
const validate_update_timeline_item_task = new VALIDATOR(EXHIBITS_UPDATE_TIMELINE_ITEM_SCHEMA);
const timeline_record_task = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
const exhibit_tasks = new EXHIBIT_RECORD_TASKS(DB, TABLES);

/**
 * Validates UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid
 */
const is_valid_uuid = (uuid) => {
    return uuid && typeof uuid === 'string' && uuid.length > 0;
};

/**
 * Builds standardized response object
 * @param {number} status - HTTP status code
 * @param {string} message - Response message
 * @param {*} data - Optional response data
 * @returns {Object} Response object
 */
const build_response = (status, message, data = null) => {
    const response = {status, message};
    if (data !== null) {
        response.data = data;
    }
    return response;
};

/**
 * Validates input data
 * @param {Object} data - Data to validate
 * @param {Object} validator - Validator instance
 * @param {string} context - Context for error logging
 * @returns {Object|true} Validation result
 */
const validate_input = (data, validator, context) => {
    if (!data || typeof data !== 'object') {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (${context})] Invalid input data format`);
        return [{message: 'Invalid input data format'}];
    }

    const validation_result = validator.validate(data);

    if (validation_result !== true) {
        const error_msg = validation_result[0].message || 'Validation failed';
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (${context})] ${error_msg}`);
    }

    return validation_result;
};

/**
 * Prepares styles data for storage
 * @param {Object|string|undefined} styles - Styles object or string
 * @returns {string} JSON stringified styles
 */
const prepare_styles = (styles) => {
    if (!styles || (typeof styles === 'object' && Object.keys(styles).length === 0)) {
        return JSON.stringify({});
    }
    return typeof styles === 'string' ? styles : JSON.stringify(styles);
};

/**
 * Processes media files for timeline items
 * @param {Object} data - Timeline item data
 * @returns {Object} Processed data
 */
const process_timeline_item_media = (data) => {
    const processed_data = {...data};

    // Only process media if item type is not text
    if (processed_data.item_type === CONSTANTS.ITEM_TYPES.TEXT) {
        return processed_data;
    }

    // Process main media
    if (processed_data.media &&
        processed_data.media.length > 0 &&
        processed_data.media !== processed_data.media_prev) {
        processed_data.media = helper_task.process_uploaded_media(
            processed_data.is_member_of_exhibit,
            processed_data.uuid,
            processed_data.media,
            STORAGE_CONFIG.storage_path
        );
    }

    // Process thumbnail
    if (processed_data.thumbnail &&
        processed_data.thumbnail.length > 0 &&
        processed_data.thumbnail !== processed_data.thumbnail_prev) {
        processed_data.thumbnail = helper_task.process_uploaded_media(
            processed_data.is_member_of_exhibit,
            processed_data.uuid,
            processed_data.thumbnail,
            STORAGE_CONFIG.storage_path
        );
    }

    // Handle Kaltura items
    if (processed_data.kaltura && processed_data.kaltura.length > 0) {
        processed_data.media = processed_data.kaltura;
        processed_data.is_kaltura_item = 1;
    }
    // Handle repository items
    else if (processed_data.repo_uuid && processed_data.repo_uuid.length > 0) {
        processed_data.media = processed_data.repo_uuid;
        processed_data.is_repo_item = 1;
    }

    // Clean up temporary fields
    delete processed_data.kaltura;
    delete processed_data.repo_uuid;
    delete processed_data.media_prev;
    delete processed_data.thumbnail_prev;

    return processed_data;
};

/**
 * Creates timeline record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Object} data - Timeline data
 * @returns {Promise<Object>} Response object
 */
exports.create_timeline_record = async (is_member_of_exhibit, data) => {

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
        data.styles = prepare_styles(data.styles);

        // Validate
        const validation_result = validate_input(data, validate_create_timeline_task, 'create_timeline_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Get order
        data.order = await helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        // Create record
        const result = await timeline_record_task.create_timeline_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (create_timeline_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to create timeline record'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Timeline record created',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (create_timeline_record)] ${error.message}`, {
            is_member_of_exhibit,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to create timeline record: ${error.message}`
        );
    }
};

/**
 * Updates timeline record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Response object
 */
exports.update_timeline_record = async (is_member_of_exhibit, timeline_id, data) => {

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(timeline_id)) {
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
        data.uuid = timeline_id;
        data.styles = prepare_styles(data.styles);

        // Validate
        const validation_result = validate_input(data, validate_update_timeline_task, 'update_timeline_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Update record
        const result = await timeline_record_task.update_timeline_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to update timeline record'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Timeline record updated',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (update_timeline_record)] ${error.message}`, {
            is_member_of_exhibit,
            timeline_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to update timeline record: ${error.message}`
        );
    }
};

/**
 * Gets timeline record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_timeline_record = async (is_member_of_exhibit, timeline_id) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(timeline_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await timeline_record_task.get_timeline_record(is_member_of_exhibit, timeline_id);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Timeline record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (get_timeline_record)] ${error.message}`, {
            is_member_of_exhibit,
            timeline_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Creates timeline item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @param {Object} data - Timeline item data
 * @returns {Promise<Object>} Response object
 */
exports.create_timeline_item_record = async (is_member_of_exhibit, timeline_id, data) => {

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(timeline_id)) {
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
        data.uuid = helper_task.create_uuid();
        data.is_member_of_exhibit = is_member_of_exhibit;
        data.is_member_of_timeline = timeline_id;

        // Validate with create schema
        const validation_result = validate_input(data, validate_create_timeline_item_task, 'create_timeline_item_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Process media
        data = process_timeline_item_media(data);

        // Prepare styles and get order
        data.styles = prepare_styles(data.styles);
        data.order = await helper_task.order_timeline_items(data.is_member_of_timeline, DB, TABLES);

        // Create record
        const result = await timeline_record_task.create_timeline_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to create timeline item record'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Timeline item record created',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (create_timeline_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            timeline_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to create timeline item record: ${error.message}`
        );
    }
};

/**
 * Gets timeline item records
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_timeline - Timeline UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_timeline_item_records = async (is_member_of_exhibit, is_member_of_timeline) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(is_member_of_timeline)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const timeline_items = await timeline_record_task.get_timeline_item_records(
            is_member_of_exhibit,
            is_member_of_timeline
        );

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit timeline item records',
            timeline_items
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (get_timeline_item_records)] ${error.message}`, {
            is_member_of_exhibit,
            is_member_of_timeline,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Gets timeline item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_timeline - Timeline UUID
 * @param {string} item_id - Timeline item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_timeline_item_record = async (is_member_of_exhibit, is_member_of_timeline, item_id) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(is_member_of_timeline) ||
            !is_valid_uuid(item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const timeline_item = await timeline_record_task.get_timeline_item_record(
            is_member_of_exhibit,
            is_member_of_timeline,
            item_id
        );

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit timeline item record',
            timeline_item
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (get_timeline_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            is_member_of_timeline,
            item_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Gets timeline item edit record
 * @param {string} uid - User ID
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_timeline - Timeline UUID
 * @param {string} item_id - Timeline item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_timeline_item_edit_record = async (uid, is_member_of_exhibit, is_member_of_timeline, item_id) => {

    try {

        if (!is_valid_uuid(uid) ||
            !is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(is_member_of_timeline) ||
            !is_valid_uuid(item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const timeline_item = await timeline_record_task.get_timeline_item_edit_record(
            uid,
            is_member_of_exhibit,
            is_member_of_timeline,
            item_id
        );

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit timeline item edit record',
            timeline_item
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (get_timeline_item_edit_record)] ${error.message}`, {
            uid,
            is_member_of_exhibit,
            is_member_of_timeline,
            item_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Updates timeline item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_timeline - Timeline UUID
 * @param {string} item_id - Timeline item UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Response object
 */
exports.update_timeline_item_record = async (is_member_of_exhibit, is_member_of_timeline, item_id, data) => {

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(is_member_of_timeline) ||
            !is_valid_uuid(item_id)) {
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
        data.is_member_of_timeline = is_member_of_timeline;
        data.uuid = item_id;

        // Validate with update schema
        const validation_result = validate_input(data, validate_update_timeline_item_task, 'update_timeline_item_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Process media
        data = process_timeline_item_media(data);

        // Prepare styles and get order
        data.styles = prepare_styles(data.styles);
        data.order = await helper_task.order_exhibit_items(data.is_member_of_timeline, DB, TABLES);

        // Update record
        const result = await timeline_record_task.update_timeline_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to update timeline item record'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Timeline item record updated',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (update_timeline_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            is_member_of_timeline,
            item_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to update timeline item record: ${error.message}`
        );
    }
};

/**
 * Deletes timeline item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @param {string} timeline_item_id - Timeline item UUID
 * @returns {Promise<Object>} Response object
 */
exports.delete_timeline_item_record = async (is_member_of_exhibit, timeline_id, timeline_item_id) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(timeline_id) ||
            !is_valid_uuid(timeline_item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const result = await timeline_record_task.delete_timeline_item_record(
            is_member_of_exhibit,
            timeline_id,
            timeline_item_id
        );

        return build_response(
            CONSTANTS.STATUS_CODES.NO_CONTENT,
            'Record deleted',
            result
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (delete_timeline_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            timeline_id,
            timeline_item_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Publishes timeline record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @returns {Promise<Object>} Response object
 */
exports.publish_timeline_record = async (exhibit_id, timeline_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(timeline_id)) {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Check if exhibit is published
        const exhibit_record = await exhibit_tasks.get_exhibit_record(exhibit_id);

        if (!exhibit_record || exhibit_record.is_published === CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (publish_timeline_record)] Exhibit not published');

            return {
                status: false,
                message: 'Unable to publish timeline. Exhibit must be published first'
            };
        }

        // Set timeline to published
        const is_timeline_published = await timeline_record_task.set_timeline_to_publish(timeline_id);

        if (is_timeline_published === false) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (publish_timeline_record)] Unable to set timeline to published');

            return {
                status: false,
                message: 'Unable to publish timeline'
            };
        }

        // Index timeline
        const is_indexed = await INDEXER_MODEL.index_timeline_record(exhibit_id, timeline_id);

        if (is_indexed === false) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (publish_timeline_record)] Unable to index timeline');

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
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (publish_timeline_record)] ${error.message}`, {
            exhibit_id,
            timeline_id,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Suppresses timeline items in parallel
 * @param {Array} timeline_records - Timeline records
 * @returns {Promise<void>}
 */
const suppress_timeline_items_parallel = async (timeline_records) => {

    if (!Array.isArray(timeline_records) || timeline_records.length === 0) {
        return;
    }

    const suppress_promises = timeline_records.map(async (timeline_record) => {

        try {

            await timeline_record_task.set_to_suppressed_timeline_items(timeline_record.is_member_of_exhibit);

            const items = await timeline_record_task.get_timeline_item_records(
                timeline_record.is_member_of_exhibit,
                timeline_record.uuid
            );

            if (items && items.length > 0) {
                const item_promises = items.map(item =>
                    timeline_record_task.set_to_suppressed_timeline_items(item.is_member_of_timeline)
                );
                await Promise.allSettled(item_promises);
            }
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/timelines_model (suppress_timeline_items_parallel)] ${error.message}`,
                {timeline_uuid: timeline_record.uuid, stack: error.stack}
            );
        }
    });

    await Promise.allSettled(suppress_promises);
};

/**
 * Suppresses timeline record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} item_id - Timeline UUID
 * @returns {Promise<Object>} Response object
 */
exports.suppress_timeline_record = async (exhibit_id, item_id) => {

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
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (suppress_timeline_record)] Unable to delete from index');

            return {
                status: false,
                message: 'Unable to suppress timeline'
            };
        }

        // Set timeline to suppressed
        const is_timeline_suppressed = await timeline_record_task.set_timeline_to_suppress(item_id);

        // Get and suppress timeline items
        const timeline_records = await timeline_record_task.get_timeline_records(exhibit_id, item_id);
        await suppress_timeline_items_parallel(timeline_records);

        if (is_timeline_suppressed === false) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (suppress_timeline_record)] Unable to set timeline to suppressed');

            return {
                status: false,
                message: 'Unable to suppress timeline'
            };
        }

        return {
            status: true,
            message: 'Timeline suppressed'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (suppress_timeline_record)] ${error.message}`, {
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
 * Publishes timeline item record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @param {string} timeline_item_id - Timeline item UUID
 * @returns {Promise<Object>} Response object
 */
exports.publish_timeline_item_record = async (exhibit_id, timeline_id, timeline_item_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) ||
            !is_valid_uuid(timeline_id) ||
            !is_valid_uuid(timeline_item_id)) {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Check if timeline is published
        const timeline_record = await timeline_record_task.get_timeline_record(exhibit_id, timeline_id);

        if (!timeline_record || timeline_record.is_published === CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (publish_timeline_item_record)] Timeline not published');

            return {
                status: false,
                message: 'Unable to publish item. Timeline must be published first'
            };
        }

        // Get timeline item record
        const timeline_item_record = await timeline_record_task.get_timeline_item_record(
            exhibit_id,
            timeline_id,
            timeline_item_id
        );

        if (!timeline_item_record) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (publish_timeline_item_record)] Timeline item not found');

            return {
                status: false,
                message: 'Timeline item not found'
            };
        }

        // Index timeline item
        const is_indexed = await INDEXER_MODEL.index_timeline_item_record(
            timeline_id,
            timeline_item_id,
            timeline_item_record
        );

        if (is_indexed === false) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (publish_timeline_item_record)] Unable to index timeline item');

            return {
                status: false,
                message: 'Unable to publish timeline item'
            };
        }

        // Update timeline item record
        const update_data = {
            is_member_of_exhibit: exhibit_id,
            is_member_of_timeline: timeline_id,
            uuid: timeline_item_id,
            is_published: CONSTANTS.PUBLICATION_STATUS.PUBLISHED
        };

        await timeline_record_task.update_timeline_item_record(update_data);

        return {
            status: true,
            message: 'Timeline item published'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (publish_timeline_item_record)] ${error.message}`, {
            exhibit_id,
            timeline_id,
            timeline_item_id,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Suppresses timeline item record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @param {string} timeline_item_id - Timeline item UUID
 * @returns {Promise<boolean>} Success status
 */
exports.suppress_timeline_item_record = async (exhibit_id, timeline_id, timeline_item_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) ||
            !is_valid_uuid(timeline_id) ||
            !is_valid_uuid(timeline_item_id)) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (suppress_timeline_item_record)] Invalid UUID provided');
            return false;
        }

        // Get indexed record
        const indexed_record = await INDEXER_MODEL.get_indexed_record(timeline_id);

        if (!indexed_record.data || !indexed_record.data.source) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (suppress_timeline_item_record)] Timeline not found in index');
            return false;
        }

        // Filter out the timeline item being suppressed
        const items = indexed_record.data.source.items || [];
        const updated_items = items.filter(item => item.uuid !== timeline_item_id);

        indexed_record.data.source.items = updated_items;

        // Delete original timeline record from index
        const delete_result = await INDEXER_MODEL.delete_record(timeline_id);

        if (delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (suppress_timeline_item_record)] Unable to delete timeline from index');
            return false;
        }

        // Update timeline item record in database
        const update_data = {
            is_member_of_exhibit: exhibit_id,
            is_member_of_timeline: timeline_id,
            uuid: timeline_item_id,
            is_published: CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED
        };

        await timeline_record_task.update_timeline_item_record(update_data);

        // Re-index timeline with updated items
        const is_indexed = await INDEXER_MODEL.index_record(indexed_record.data.source);

        return is_indexed === true;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (suppress_timeline_item_record)] ${error.message}`, {
            exhibit_id,
            timeline_id,
            timeline_item_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Reorders timelines in exhibit
 * @param {string} exhibit_id - Exhibit UUID
 * @param {Object} timeline - Timeline order data
 * @returns {Promise<*>} Result from task
 */
exports.reorder_timelines = async (exhibit_id, timeline) => {
    console.log('TIMELINE ', timeline);
    try {

        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (reorder_timelines)] Invalid exhibit UUID provided');
            return false;
        }

        if (!timeline || typeof timeline !== 'object') {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (reorder_timelines)] Invalid timeline data provided');
            return false;
        }

        return await timeline_record_task.reorder_timelines(exhibit_id, timeline);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (reorder_timelines)] ${error.message}`, {
            exhibit_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Reorders timeline items in timeline
 * @param {string} timeline_id - Timeline UUID
 * @param {Object} timeline - Timeline item order data
 * @returns {Promise<*>} Result from task
 */
exports.reorder_timeline_items = async (timeline_id, timeline) => {

    try {

        if (!is_valid_uuid(timeline_id)) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (reorder_timeline_items)] Invalid timeline UUID provided');
            return false;
        }

        if (!timeline || typeof timeline !== 'object') {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (reorder_timeline_items)] Invalid timeline data provided');
            return false;
        }

        return await timeline_record_task.reorder_timeline_items(timeline_id, timeline);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (reorder_timeline_items)] ${error.message}`, {
            timeline_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Unlocks timeline item record for editing
 * @param {string} uid - User ID
 * @param {string} uuid - Timeline item UUID
 * @param {object} options - {force: true/false}
 * @returns {Promise<*>} Unlock result
 */
exports.unlock_timeline_item_record = async (uid, uuid, options) => {

    try {

        if (!is_valid_uuid(uid) || !is_valid_uuid(uuid)) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (unlock_timeline_item_record)] Invalid UUID provided');
            return false;
        }

        return await helper_task.unlock_record(uid, uuid, DB, TABLES.timeline_item_records, options);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (unlock_timeline_item_record)] ${error.message}`, {
            uid,
            uuid,
            stack: error.stack
        });

        return false;
    }
};