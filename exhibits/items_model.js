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

const STORAGE_CONFIG = require('../config/storage_config')();
const HTTP = require('axios');
const KALTURA = require('kaltura-client');
const CONFIG = require('../config/webservices_config')();
const KALTURA_CONFIG = require('../config/kaltura_config')();
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const EXHIBITS_CREATE_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_item_create_record_schema')();
const EXHIBITS_UPDATE_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_item_update_record_schema')();
const EXHIBIT_ITEM_RECORD_TASKS = require('../exhibits/tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('./tasks/exhibit_heading_record_tasks');
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
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
        BAD_REQUEST: 400,
        NOT_FOUND: 404
    },
    ITEM_TYPES: {
        TEXT: 'text',
        AUDIO: 'audio',
        VIDEO: 'video'
    },
    MIME_TYPES: {
        TEXT_PLAIN: 'text/plain'
    },
    PUBLICATION_STATUS: {
        PUBLISHED: 1,
        UNPUBLISHED: 0
    },
    REPUBLISH_DELAY_MS: 5000,
    HTTP_TIMEOUT_MS: 45000,
    KALTURA_SESSION_EXPIRY: 86400
};

// Initialize task instances
const helper_task = new HELPER();
const validate_create_item_task = new VALIDATOR(EXHIBITS_CREATE_ITEM_SCHEMA);
const validate_update_item_task = new VALIDATOR(EXHIBITS_UPDATE_ITEM_SCHEMA);
const exhibit_tasks = new EXHIBIT_RECORD_TASKS(DB, TABLES);
const item_task = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
const heading_task = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
const grid_task = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
const timeline_task = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);

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
        LOGGER.module().error(`ERROR: [/exhibits/items_model (${context})] Invalid input data format`);
        return [{message: 'Invalid input data format'}];
    }

    const validation_result = validator.validate(data);

    if (validation_result !== true) {
        const error_msg = validation_result[0].message || 'Validation failed';
        LOGGER.module().error(`ERROR: [/exhibits/items_model (${context})] ${error_msg}`);
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
 * Processes media files for items
 * @param {Object} data - Item data
 * @returns {Object} Processed data
 */
const process_item_media = (data) => {
    const processed_data = {...data};

    // Handle text items separately
    if (processed_data.item_type === CONSTANTS.ITEM_TYPES.TEXT) {
        processed_data.mime_type = CONSTANTS.MIME_TYPES.TEXT_PLAIN;
        return processed_data;
    }

    // Ensure storage path exists
    helper_task.check_storage_path(processed_data.is_member_of_exhibit, STORAGE_CONFIG.storage_path);

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
 * Processes media files for item updates
 * @param {Object} data - Item update data
 * @returns {Object} Processed data
 */
const process_item_update_media = (data) => {
    const processed_data = {...data};

    // Handle text items separately
    if (processed_data.item_type === CONSTANTS.ITEM_TYPES.TEXT) {
        return processed_data;
    }

    // Ensure storage path exists
    helper_task.check_storage_path(processed_data.is_member_of_exhibit, STORAGE_CONFIG.storage_path);

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

    // Handle Kaltura items - complex logic for audio/video
    if (processed_data.kaltura && processed_data.kaltura.length > 0) {
        processed_data.media = processed_data.kaltura;
        processed_data.is_kaltura_item = 1;
    }

    // Reset Kaltura flag if not audio/video and no Kaltura ID
    if ((!processed_data.kaltura || processed_data.kaltura.length === 0) &&
        processed_data.item_type !== CONSTANTS.ITEM_TYPES.AUDIO &&
        processed_data.item_type !== CONSTANTS.ITEM_TYPES.VIDEO) {
        processed_data.is_kaltura_item = 0;
    }

    // Set Kaltura flag for audio/video items
    if (processed_data.item_type === CONSTANTS.ITEM_TYPES.AUDIO ||
        processed_data.item_type === CONSTANTS.ITEM_TYPES.VIDEO) {
        processed_data.is_kaltura_item = 1;
    }

    // Handle repository items
    if (processed_data.repo_uuid && processed_data.repo_uuid.length > 0) {
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
 * Fetches grid items for grids in parallel
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Array} grids - Grid records
 * @returns {Promise<Array>} Grids with their items
 */
const fetch_grid_items = async (is_member_of_exhibit, grids) => {
    if (!Array.isArray(grids) || grids.length === 0) {
        return [];
    }

    const grid_promises = grids.map(async (grid) => {
        try {
            grid.grid_items = await grid_task.get_grid_item_records(is_member_of_exhibit, grid.uuid);
            return grid;
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/items_model (fetch_grid_items)] ${error.message}`,
                {grid_uuid: grid.uuid, stack: error.stack}
            );
            grid.grid_items = [];
            return grid;
        }
    });

    return await Promise.all(grid_promises);
};

/**
 * Fetches timeline items for timelines in parallel
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Array} timelines - Timeline records
 * @returns {Promise<Array>} Timelines with their items
 */
const fetch_timeline_items = async (is_member_of_exhibit, timelines) => {
    if (!Array.isArray(timelines) || timelines.length === 0) {
        return [];
    }

    const timeline_promises = timelines.map(async (timeline) => {
        try {
            timeline.timeline_items = await timeline_task.get_timeline_item_records(
                is_member_of_exhibit,
                timeline.uuid
            );
            return timeline;
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/items_model (fetch_timeline_items)] ${error.message}`,
                {timeline_uuid: timeline.uuid, stack: error.stack}
            );
            timeline.timeline_items = [];
            return timeline;
        }
    });

    return await Promise.all(timeline_promises);
};

/**
 * Gets item records by exhibit
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @returns {Promise<Object>} Response object with records
 */
exports.get_item_records = async (is_member_of_exhibit) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid exhibit UUID provided'
            );
        }

        // Fetch all record types in parallel
        const [items, headings, grids_raw, timelines_raw] = await Promise.all([
            item_task.get_item_records(is_member_of_exhibit),
            heading_task.get_heading_records(is_member_of_exhibit),
            grid_task.get_grid_records(is_member_of_exhibit),
            timeline_task.get_timeline_records(is_member_of_exhibit)
        ]);

        // Fetch nested items in parallel
        const [grids, timelines] = await Promise.all([
            fetch_grid_items(is_member_of_exhibit, grids_raw),
            fetch_timeline_items(is_member_of_exhibit, timelines_raw)
        ]);

        // Combine and sort all records
        const records = [...items, ...headings, ...grids, ...timelines];
        // console.log('PRE SORT ', records);
        records.sort((a, b) => {
            return (a.order || 0) - (b.order || 0);
        });

        // Check for order gaps and reorder if needed
        const has_gaps = helper_task.has_order_gaps(records);

        if (has_gaps) {
            const new_order = await helper_task.reorder(is_member_of_exhibit, DB, TABLES);
            const new_order_applied = await helper_task.apply_reorder(
                is_member_of_exhibit,
                new_order,
                DB,
                TABLES
            );

            if (new_order_applied.success === false) {
                LOGGER.module().error(
                    'ERROR: [/exhibits/items_model (get_item_records)] Failed to reorder records',
                    {result: new_order_applied}
                );
            }

            // Recursively call to get reordered records
            return await this.get_item_records(is_member_of_exhibit);
        }

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit item records',
            records
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (get_item_records)] ${error.message}`, {
            is_member_of_exhibit,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Creates item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Object} data - Item data
 * @returns {Promise<Object>} Response object
 */
exports.create_item_record = async (is_member_of_exhibit, data) => {

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
        const validation_result = validate_input(data, validate_create_item_task, 'create_item_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Process media
        data = process_item_media(data);

        // Prepare styles and get order
        data.styles = prepare_styles(data.styles);
        data.order = await helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        // Create record
        const result = await item_task.create_item_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (create_item_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to create item record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Item record created',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (create_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to create record: ${error.message}`
        );
    }
};

/**
 * Handles post-update republishing for item
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} item_id - Item UUID
 * @returns {Promise<void>}
 */
const handle_item_republish = async (is_member_of_exhibit, item_id) => {

    try {

        const suppress_result = await suppress_item_record(is_member_of_exhibit, item_id);

        if (suppress_result && suppress_result.status === true) {
            setTimeout(async () => {
                try {
                    const publish_result = await publish_item_record(is_member_of_exhibit, item_id);

                    if (publish_result && publish_result.status === true) {
                        LOGGER.module().info('INFO: [/exhibits/items_model (handle_item_republish)] Item re-published successfully.');
                    } else {
                        LOGGER.module().error('ERROR: [/exhibits/items_model (handle_item_republish)] Failed to re-publish item');
                    }
                } catch (error) {
                    LOGGER.module().error(`ERROR: [/exhibits/items_model (handle_item_republish)] ${error.message}`, {
                        is_member_of_exhibit,
                        item_id,
                        stack: error.stack
                    });
                }
            }, CONSTANTS.REPUBLISH_DELAY_MS);
        }
    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (handle_item_republish)] ${error.message}`, {
            is_member_of_exhibit,
            item_id,
            stack: error.stack
        });
    }
};

/**
 * Updates item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} item_id - Item UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Response object
 */
exports.update_item_record = async (is_member_of_exhibit, item_id, data) => {

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(item_id)) {
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
        data.uuid = item_id;

        // Extract is_published before validation
        const is_published = data.is_published;
        delete data.is_published;

        // Validate
        const validation_result = validate_input(data, validate_update_item_task, 'update_item_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Process media
        data = process_item_update_media(data);

        // Prepare styles
        data.styles = prepare_styles(data.styles);

        // Update record
        const result = await item_task.update_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Unable to update item record'
            );
        }

        // Handle republishing if needed (check for truthy values)
        if (is_published === 'true' || is_published === true || is_published === 1) {
            setImmediate(() => handle_item_republish(is_member_of_exhibit, item_id));
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Item record updated'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (update_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            item_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            `Unable to update record: ${error.message}`
        );
    }
};

/**
 * Clears media value from item
 * @param {string} uuid - Item UUID
 * @param {string} media - Media field name
 * @param {string} type - Media type
 * @returns {Promise<void>}
 */
exports.delete_media_value = async (uuid, media, type) => {

    try {

        if (!is_valid_uuid(uuid) || !media || !type) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (delete_media_value)] Invalid parameters');
            return;
        }

        const result = await item_task.delete_media_value(uuid, media, type);

        if (result && result.success === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model (delete_media_value)] Media value deleted');
        } else {
            LOGGER.module().error('ERROR: [/exhibits/items_model (delete_media_value)] Unable to delete media value');
        }

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (delete_media_value)] ${error.message}`, {
            uuid,
            media,
            type,
            stack: error.stack
        });
    }
};

/**
 * Gets item record by UUID
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - Item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_item_record = async (is_member_of_exhibit, uuid) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await item_task.get_item_record(is_member_of_exhibit, uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Item record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (get_item_record)] ${error.message}`, {
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
 * Gets item edit record
 * @param {string} uid - User ID
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - Item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_item_edit_record = async (uid, is_member_of_exhibit, uuid) => {

    try {

        if (!is_valid_uuid(uid) || !is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await item_task.get_item_edit_record(uid, is_member_of_exhibit, uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Item edit record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (get_item_edit_record)] ${error.message}`, {
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
 * Deletes item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} item_id - Item UUID
 * @param {string} type - Item type
 * @returns {Promise<Object>} Response object
 */
exports.delete_item_record = async (is_member_of_exhibit, item_id, type) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        // Check if item exists in index
        const index_record = await INDEXER_MODEL.get_indexed_record(item_id);

        if (index_record.status !== CONSTANTS.STATUS_CODES.NOT_FOUND) {
            const delete_result = await INDEXER_MODEL.delete_record(item_id);

            if (delete_result.status === CONSTANTS.STATUS_CODES.NO_CONTENT) {
                LOGGER.module().info('INFO: [/exhibits/items_model (delete_item_record)] Item record deleted from index');
            } else {
                LOGGER.module().info('INFO: [/exhibits/items_model (delete_item_record)] Record not found in index');
            }
        }

        // Delete from database
        const result = await item_task.delete_item_record(is_member_of_exhibit, item_id, type);

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
        }

        return build_response(
            CONSTANTS.STATUS_CODES.NO_CONTENT,
            'Record deleted',
            result
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (delete_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            item_id,
            type,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Publishes item record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} item_id - Item UUID
 * @returns {Promise<Object>} Response object
 */
const publish_item_record = async (exhibit_id, item_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(item_id)) {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Check if exhibit is published
        const exhibit_record = await exhibit_tasks.get_exhibit_record(exhibit_id);

        if (!exhibit_record || exhibit_record.is_published === CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (publish_item_record)] Exhibit not published');

            return {
                status: false,
                message: 'Unable to publish item. Exhibit must be published first'
            };
        }

        // Set item to published
        const is_item_published = await item_task.set_item_to_publish(item_id);

        if (is_item_published === false) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (publish_item_record)] Unable to set item to published');

            return {
                status: false,
                message: 'Unable to publish item'
            };
        }

        // Index item
        const is_indexed = await INDEXER_MODEL.index_item_record(exhibit_id, item_id);

        if (is_indexed === false) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (publish_item_record)] Unable to index item');

            return {
                status: false,
                message: 'Unable to publish item'
            };
        }

        return {
            status: true,
            message: 'Item published'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (publish_item_record)] ${error.message}`, {
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
 * Suppresses item record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} item_id - Item UUID
 * @returns {Promise<Object>} Response object
 */
const suppress_item_record = async (exhibit_id, item_id) => {

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
            LOGGER.module().error('ERROR: [/exhibits/items_model (suppress_item_record)] Unable to delete from index');

            return {
                status: false,
                message: 'Unable to suppress item'
            };
        }

        // Set item to suppressed
        const is_item_suppressed = await item_task.set_item_to_suppress(item_id);

        if (is_item_suppressed === false) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (suppress_item_record)] Unable to set item to suppressed');

            return {
                status: false,
                message: 'Unable to suppress item'
            };
        }

        return {
            status: true,
            message: 'Item suppressed'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (suppress_item_record)] ${error.message}`, {
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
 * Gets repository item metadata
 * @param {string} uuid - Repository item UUID
 * @returns {Promise<*>} HTTP response
 */
exports.get_repo_item_record = async (uuid) => {

    try {

        if (!is_valid_uuid(uuid)) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (get_repo_item_record)] Invalid UUID provided');
            return null;
        }

        const response = await HTTP({
            method: 'GET',
            url: `${CONFIG.repo_item_api_url}${uuid}?key=${CONFIG.repo_item_api_key}`,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: CONSTANTS.HTTP_TIMEOUT_MS
        });

        return response;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (get_repo_item_record)] ${error.message}`, {
            uuid,
            stack: error.stack
        });
        return null;
    }
};

/**
 * Gets Kaltura session (promisified)
 * @param {Object} config - Kaltura configuration
 * @param {Object} client - Kaltura client
 * @returns {Promise<string>} Session token
 */
const get_kaltura_session_async = (config, client) => {
    return new Promise((resolve, reject) => {

        try {

            const secret = KALTURA_CONFIG.kaltura_secret_key;
            const user_id = KALTURA_CONFIG.kaltura_user_id;
            const type = KALTURA.enums.SessionType.USER;
            const partner_id = KALTURA_CONFIG.kaltura_partner_id;
            const expiry = CONSTANTS.KALTURA_SESSION_EXPIRY;
            const privileges = KALTURA.enums.SessionType.ADMIN;

            KALTURA.services.session.start(secret, user_id, type, partner_id, expiry, privileges)
                .execute(client)
                .then(result => resolve(result))
                .catch(error => reject(error));

        } catch (error) {
            LOGGER.module().error(`ERROR: [/exhibits/items_model (get_kaltura_session_async)] ${error.message}`, {
                stack: error.stack
            });
            reject(error);
        }
    });
};

/**
 * Gets Kaltura item metadata (callback-based for backward compatibility)
 * @param {string} entry_id - Kaltura entry ID
 * @param {Function} callback - Callback function
 */
exports.get_kaltura_item_record = (entry_id, callback) => {

    try {

        if (!entry_id || typeof entry_id !== 'string') {
            const error_msg = 'Invalid entry ID provided';
            LOGGER.module().error(`ERROR: [/exhibits/items_model (get_kaltura_item_record)] ${error_msg}`);
            callback(error_msg);
            return;
        }

        const config = new KALTURA.Configuration();
        const client = new KALTURA.Client(config);

        get_kaltura_session_async(config, client)
            .then(session => {
                client.setKs(session);
                const version = -1;

                KALTURA.services.media.get(entry_id, version)
                    .execute(client)
                    .then(result => callback(result))
                    .catch(error => {
                        LOGGER.module().error(
                            `ERROR: [/exhibits/items_model (get_kaltura_item_record)] ${error.message}`,
                            {entry_id, stack: error.stack}
                        );
                        callback(error.message);
                    });
            })
            .catch(error => {
                LOGGER.module().error(
                    `ERROR: [/exhibits/items_model (get_kaltura_item_record)] ${error.message}`,
                    {entry_id, stack: error.stack}
                );
                callback(error.message);
            });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (get_kaltura_item_record)] ${error.message}`, {
            entry_id,
            stack: error.stack
        });
        callback(error.message);
    }
};

/**
 * Reorders items in exhibit
 * @param {string} exhibit_id - Exhibit UUID
 * @param {Object} item - Item order data
 * @returns {Promise<*>} Result from task
 */
exports.reorder_items = async (exhibit_id, item) => {

    try {

        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (reorder_items)] Invalid exhibit UUID provided');
            return false;
        }

        if (!item || typeof item !== 'object') {
            LOGGER.module().error('ERROR: [/exhibits/items_model (reorder_items)] Invalid item data provided');
            return false;
        }

        return await item_task.reorder_items(exhibit_id, item);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (reorder_items)] ${error.message}`, {
            exhibit_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Gets thumbnail from repository
 * @param {string} uuid - Repository item UUID
 * @returns {Promise<Buffer|null>} Thumbnail data or null
 */
exports.get_repo_tn = async (uuid) => {

    try {

        if (!is_valid_uuid(uuid)) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (get_repo_tn)] Invalid UUID provided');
            return null;
        }

        const endpoint = `${CONFIG.tn_service}datastream/${uuid}/tn?key=${CONFIG.tn_service_api_key}`;
        const response = await HTTP.get(endpoint, {
            timeout: CONSTANTS.HTTP_TIMEOUT_MS,
            responseType: 'arraybuffer'
        });

        if (response.status === CONSTANTS.STATUS_CODES.OK) {
            return response.data;
        }

        return null;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (get_repo_tn)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return null;
    }
};

/**
 * Unlocks item record for editing
 * @param {string} uid - User ID
 * @param {string} uuid - Item UUID
 * @param {object} options - {force: true/false}
 * @returns {Promise<*>} Unlock result
 */
exports.unlock_item_record = async (uid, uuid, options) => {

    try {

        if (!is_valid_uuid(uid) || !is_valid_uuid(uuid)) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (unlock_item_record)] Invalid UUID provided');
            return false;
        }

        return await helper_task.unlock_record(uid, uuid, DB, TABLES.item_records, options);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (unlock_item_record)] ${error.message}`, {
            uid,
            uuid,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Gets item subjects from external API
 * @returns {Promise<*>} Subjects data
 */
exports.get_item_subjects = async () => {

    try {

        const response = await HTTP({
            method: 'GET',
            url: `${CONFIG.item_subjects_api_url}?key=${CONFIG.item_subjects_api_key}`,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: CONSTANTS.HTTP_TIMEOUT_MS
        });

        return response.data;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (get_item_subjects)] ${error.message}`, {
            stack: error.stack
        });

        return null;
    }
};

exports.publish_item_record = publish_item_record;
exports.suppress_item_record = suppress_item_record;