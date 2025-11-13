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
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const EXHIBITS_CREATE_GRID_SCHEMA = require('../exhibits/schemas/exhibit_create_grid_record_schema')();
const EXHIBITS_UPDATE_GRID_SCHEMA = require('../exhibits/schemas/exhibit_grid_update_record_schema')();
const EXHIBITS_CREATE_GRID_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_grid_item_create_record_schema')();
const EXHIBITS_UPDATE_GRID_ITEM_SCHEMA = require('../exhibits/schemas/exhibit_grid_item_update_record_schema')();
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
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
    MIME_TYPES: {
        TEXT_PLAIN: 'text/plain'
    },
    PUBLICATION_STATUS: {
        PUBLISHED: 1,
        UNPUBLISHED: 0
    },
    REPUBLISH_DELAY_MS: 5000
};

// Initialize task instances
const helper_task = new HELPER();
const validate_create_grid_task = new VALIDATOR(EXHIBITS_CREATE_GRID_SCHEMA);
const validate_update_grid_task = new VALIDATOR(EXHIBITS_UPDATE_GRID_SCHEMA);
const validate_create_grid_item_task = new VALIDATOR(EXHIBITS_CREATE_GRID_ITEM_SCHEMA);
const validate_update_grid_item_task = new VALIDATOR(EXHIBITS_UPDATE_GRID_ITEM_SCHEMA);
const grid_record_task = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
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
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (${context})] Invalid input data format`);
        return [{message: 'Invalid input data format'}];
    }

    const validation_result = validator.validate(data);

    if (validation_result !== true) {
        const error_msg = validation_result[0].message || 'Validation failed';
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (${context})] ${error_msg}`);
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
 * Safely parses integer value
 * @param {*} value - Value to parse
 * @param {number} default_value - Default value if parsing fails
 * @returns {number} Parsed integer or default
 */
const safe_parse_int = (value, default_value = 0) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? default_value : parsed;
};

/**
 * Processes media files for grid items
 * @param {Object} data - Grid item data
 * @returns {Object} Processed data
 */
const process_grid_item_media = (data) => {
    const processed_data = {...data};

    // Handle text items separately
    if (processed_data.item_type === CONSTANTS.ITEM_TYPES.TEXT) {
        processed_data.mime_type = CONSTANTS.MIME_TYPES.TEXT_PLAIN;
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
 * Creates grid record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Object} data - Grid data
 * @returns {Promise<Object>} Response object
 */
exports.create_grid_record = async (is_member_of_exhibit, data) => {

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
        data.columns = safe_parse_int(data.columns, 1);

        // Validate
        const validation_result = validate_input(data, validate_create_grid_task, 'create_grid_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Get order
        data.order = await helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        // Create record
        const result = await grid_record_task.create_grid_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (create_grid_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to create grid record'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Grid record created',
            data.uuid
        );

    } catch (error) {

        LOGGER.module().error(`ERROR: [/exhibits/grid_model (create_grid_record)] ${error.message}`, {
            is_member_of_exhibit,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to create grid record: ${error.message}`
        );
    }
};

/**
 * Updates grid record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Response object
 */
exports.update_grid_record = async (is_member_of_exhibit, grid_id, data) => {

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(grid_id)) {
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
        data.uuid = grid_id;
        data.styles = prepare_styles(data.styles);
        data.columns = safe_parse_int(data.columns, 1);

        // Validate
        const validation_result = validate_input(data, validate_update_grid_task, 'update_grid_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Update record
        const result = await grid_record_task.update_grid_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to update grid record'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Grid record updated',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (update_grid_record)] ${error.message}`, {
            is_member_of_exhibit,
            grid_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to update grid record: ${error.message}`
        );
    }
};

/**
 * Gets grid record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_grid_record = async (is_member_of_exhibit, grid_id) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(grid_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await grid_record_task.get_grid_record(is_member_of_exhibit, grid_id);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Grid record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (get_grid_record)] ${error.message}`, {
            is_member_of_exhibit,
            grid_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Creates grid item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @param {Object} data - Grid item data
 * @returns {Promise<Object>} Response object
 */
exports.create_grid_item_record = async (is_member_of_exhibit, grid_id, data) => {

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(grid_id)) {
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
        data.is_member_of_grid = grid_id;

        // Validate
        const validation_result = validate_input(data, validate_create_grid_item_task, 'create_grid_item_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Process media
        data = process_grid_item_media(data);

        // Prepare styles and get order
        data.styles = prepare_styles(data.styles);
        data.order = await helper_task.order_grid_items(data.is_member_of_grid, DB, TABLES);

        // Create record
        const result = await grid_record_task.create_grid_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to create grid item record'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Grid item record created',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (create_grid_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            grid_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to create grid item record: ${error.message}`
        );
    }
};

/**
 * Gets grid item records
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_grid - Grid UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_grid_item_records = async (is_member_of_exhibit, is_member_of_grid) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(is_member_of_grid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const grid_items = await grid_record_task.get_grid_item_records(
            is_member_of_exhibit,
            is_member_of_grid
        );

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit grid item records',
            grid_items
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (get_grid_item_records)] ${error.message}`, {
            is_member_of_exhibit,
            is_member_of_grid,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Gets grid item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_grid - Grid UUID
 * @param {string} item_id - Grid item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_grid_item_record = async (is_member_of_exhibit, is_member_of_grid, item_id) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(is_member_of_grid) ||
            !is_valid_uuid(item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const grid_item = await grid_record_task.get_grid_item_record(
            is_member_of_exhibit,
            is_member_of_grid,
            item_id
        );

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit grid item record',
            grid_item
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (get_grid_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            is_member_of_grid,
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
 * Gets grid item edit record
 * @param {string} uid - User ID
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_grid - Grid UUID
 * @param {string} item_id - Grid item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_grid_item_edit_record = async (uid, is_member_of_exhibit, is_member_of_grid, item_id) => {

    try {

        if (!is_valid_uuid(uid) ||
            !is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(is_member_of_grid) ||
            !is_valid_uuid(item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const grid_item = await grid_record_task.get_grid_item_edit_record(
            uid,
            is_member_of_exhibit,
            is_member_of_grid,
            item_id
        );

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit grid item edit record',
            grid_item
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (get_grid_item_edit_record)] ${error.message}`, {
            uid,
            is_member_of_exhibit,
            is_member_of_grid,
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
 * Handles post-update republishing for grid items
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_grid - Grid UUID
 * @param {string} item_id - Grid item UUID
 * @returns {Promise<void>}
 */
const handle_grid_item_republish = async (is_member_of_exhibit, is_member_of_grid, item_id) => {

    try {

        const suppress_result = await suppress_grid_item_record(is_member_of_exhibit, is_member_of_grid, item_id);

        if (suppress_result && suppress_result.status === true) {
            setTimeout(async () => {
                try {
                    const publish_result = await publish_grid_item_record(is_member_of_exhibit, is_member_of_grid, item_id);

                    if (publish_result && publish_result.status === true) {
                        LOGGER.module().info('INFO: [/exhibits/grid_model (handle_grid_item_republish)] Grid item re-published successfully.');
                    } else {
                        LOGGER.module().error('ERROR: [/exhibits/grid_model (handle_grid_item_republish)] Failed to re-publish grid item');
                    }
                } catch (error) {
                    LOGGER.module().error(`ERROR: [/exhibits/grid_model (handle_grid_item_republish)] ${error.message}`, {
                        is_member_of_exhibit,
                        is_member_of_grid,
                        item_id,
                        stack: error.stack
                    });
                }
            }, CONSTANTS.REPUBLISH_DELAY_MS);
        }
    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (handle_grid_item_republish)] ${error.message}`, {
            is_member_of_exhibit,
            is_member_of_grid,
            item_id,
            stack: error.stack
        });
    }
};

/**
 * Updates grid item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_grid - Grid UUID
 * @param {string} item_id - Grid item UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Response object
 */
exports.update_grid_item_record = async (is_member_of_exhibit, is_member_of_grid, item_id, data) => {

    try {
        // Validate inputs
        if (!is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(is_member_of_grid) ||
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
        data.is_member_of_grid = is_member_of_grid;
        data.uuid = item_id;

        // Extract is_published before validation
        const is_published = data.is_published;
        delete data.is_published;

        // Validate
        data.styles = prepare_styles(data.styles);
        const validation_result = validate_input(data, validate_update_grid_item_task, 'update_grid_item_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Process media
        data = process_grid_item_media(data);

        // Update record
        const result = await grid_record_task.update_grid_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to update grid item record'
            );
        }

        // Handle republishing if needed (check for truthy values including string 'true', number 1, and boolean true)
        if (is_published === 'true' || is_published === true || is_published === 1) {
            setImmediate(() => handle_grid_item_republish(is_member_of_exhibit, is_member_of_grid, item_id));
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Grid item record updated',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (update_grid_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            is_member_of_grid,
            item_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to update grid item record: ${error.message}`
        );
    }
};

/**
 * Deletes grid item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @param {string} grid_item_id - Grid item UUID
 * @returns {Promise<Object>} Response object
 */
exports.delete_grid_item_record = async (is_member_of_exhibit, grid_id, grid_item_id) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(grid_id) ||
            !is_valid_uuid(grid_item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const result = await grid_record_task.delete_grid_item_record(
            is_member_of_exhibit,
            grid_id,
            grid_item_id
        );

        return build_response(
            CONSTANTS.STATUS_CODES.NO_CONTENT,
            'Record deleted',
            result
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (delete_grid_item_record)] ${error.message}`, {
            is_member_of_exhibit,
            grid_id,
            grid_item_id,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Publishes grid record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @returns {Promise<Object>} Response object
 */
const publish_grid_record = async (exhibit_id, grid_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(grid_id)) {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Check if exhibit is published
        const exhibit_record = await exhibit_tasks.get_exhibit_record(exhibit_id);

        if (!exhibit_record || exhibit_record.is_published === CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (publish_grid_record)] Exhibit not published');

            return {
                status: false,
                message: 'Unable to publish grid. Exhibit must be published first'
            };
        }

        // Set grid to published
        const is_grid_published = await grid_record_task.set_grid_to_publish(grid_id);

        if (is_grid_published === false) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (publish_grid_record)] Unable to set grid to published');

            return {
                status: false,
                message: 'Unable to publish grid'
            };
        }

        // Index grid
        const is_indexed = await INDEXER_MODEL.index_grid_record(exhibit_id, grid_id);

        if (is_indexed === false) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (publish_grid_record)] Unable to index grid');

            return {
                status: false,
                message: 'Unable to publish grid'
            };
        }

        return {
            status: true,
            message: 'Grid published'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (publish_grid_record)] ${error.message}`, {
            exhibit_id,
            grid_id,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Suppresses grid items in parallel
 * @param {Array} grid_records - Grid records
 * @returns {Promise<void>}
 */
const suppress_grid_items_parallel = async (grid_records) => {

    if (!Array.isArray(grid_records) || grid_records.length === 0) {
        return;
    }

    const suppress_promises = grid_records.map(async (grid_record) => {

        try {

            await grid_record_task.set_to_suppressed_grid_items(grid_record.is_member_of_exhibit);

            const items = await grid_record_task.get_grid_item_records(
                grid_record.is_member_of_exhibit,
                grid_record.uuid
            );

            if (items && items.length > 0) {
                const item_promises = items.map(item =>
                    grid_record_task.set_to_suppressed_grid_items(item.is_member_of_grid)
                );
                await Promise.allSettled(item_promises);
            }
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/grid_model (suppress_grid_items_parallel)] ${error.message}`,
                {grid_uuid: grid_record.uuid, stack: error.stack}
            );
        }
    });

    await Promise.allSettled(suppress_promises);
};

/**
 * Suppresses grid record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} item_id - Grid UUID
 * @returns {Promise<Object>} Response object
 */
const suppress_grid_record = async (exhibit_id, item_id) => {

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
            LOGGER.module().error('ERROR: [/exhibits/grid_model (suppress_grid_record)] Unable to delete from index');

            return {
                status: false,
                message: 'Unable to suppress grid'
            };
        }

        // Set grid to suppressed
        const is_grid_suppressed = await grid_record_task.set_grid_to_suppress(item_id);

        // Get and suppress grid items
        const grid_records = await grid_record_task.get_grid_records(exhibit_id, item_id);
        await suppress_grid_items_parallel(grid_records);

        if (is_grid_suppressed === false) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (suppress_grid_record)] Unable to set grid to suppressed');

            return {
                status: false,
                message: 'Unable to suppress grid'
            };
        }

        return {
            status: true,
            message: 'Grid suppressed'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (suppress_grid_record)] ${error.message}`, {
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
 * Publishes grid item record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @param {string} grid_item_id - Grid item UUID
 * @returns {Promise<Object>} Response object
 */
const publish_grid_item_record = async (exhibit_id, grid_id, grid_item_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) ||
            !is_valid_uuid(grid_id) ||
            !is_valid_uuid(grid_item_id)) {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Check if grid is published
        const grid_record = await grid_record_task.get_grid_record(exhibit_id, grid_id);

        if (!grid_record || grid_record.is_published === CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (publish_grid_item_record)] Grid not published');

            return {
                status: false,
                message: 'Unable to publish item. Grid must be published first'
            };
        }

        // Get grid item record
        const grid_item_record = await grid_record_task.get_grid_item_record(
            exhibit_id,
            grid_id,
            grid_item_id
        );

        if (!grid_item_record) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (publish_grid_item_record)] Grid item not found');

            return {
                status: false,
                message: 'Grid item not found'
            };
        }

        // Index grid item
        const is_indexed = await INDEXER_MODEL.index_grid_item_record(
            grid_id,
            grid_item_id,
            grid_item_record
        );

        if (is_indexed === false) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (publish_grid_item_record)] Unable to index grid item');

            return {
                status: false,
                message: 'Unable to publish grid item'
            };
        }

        // Update grid item record
        const update_data = {
            is_member_of_exhibit: exhibit_id,
            is_member_of_grid: grid_id,
            uuid: grid_item_id,
            is_published: CONSTANTS.PUBLICATION_STATUS.PUBLISHED
        };

        await grid_record_task.update_grid_item_record(update_data);

        return {
            status: true,
            message: 'Grid item published'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (publish_grid_item_record)] ${error.message}`, {
            exhibit_id,
            grid_id,
            grid_item_id,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Suppresses grid item record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @param {string} grid_item_id - Grid item UUID
 * @returns {Promise<Object>} Response object
 */
const suppress_grid_item_record = async (exhibit_id, grid_id, grid_item_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) ||
            !is_valid_uuid(grid_id) ||
            !is_valid_uuid(grid_item_id)) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (suppress_grid_item_record)] Invalid UUID provided');
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Get indexed record
        const indexed_record = await INDEXER_MODEL.get_indexed_record(grid_id);

        if (indexed_record.status !== CONSTANTS.STATUS_CODES.OK) {
            LOGGER.module().error(
                `ERROR: [/exhibits/grid_model (suppress_grid_item_record)] Grid ${grid_id} not found in index`
            );
            return {
                status: false,
                message: 'Grid not found in index'
            };
        }

        if (!indexed_record.data || !indexed_record.data.source) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (suppress_grid_item_record)] Invalid indexed record structure');
            return {
                status: false,
                message: 'Invalid indexed record'
            };
        }

        // Filter out the grid item being suppressed
        const items = indexed_record.data.source.items || [];
        const updated_items = items.filter(item => item.uuid !== grid_item_id);

        indexed_record.data.source.items = updated_items;

        // Delete original grid record from index
        const delete_result = await INDEXER_MODEL.delete_record(grid_id);

        if (delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (suppress_grid_item_record)] Unable to delete grid from index');
            return {
                status: false,
                message: 'Unable to suppress grid item'
            };
        }

        // Update grid item record in database
        const update_data = {
            is_member_of_exhibit: exhibit_id,
            is_member_of_grid: grid_id,
            uuid: grid_item_id,
            is_published: CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED
        };

        await grid_record_task.update_grid_item_record(update_data);

        // Re-index grid with updated items
        const is_indexed = await INDEXER_MODEL.index_record(indexed_record.data.source);

        if (is_indexed === true) {
            return {
                status: true,
                message: 'Grid item suppressed'
            };
        }

        return {
            status: false,
            message: 'Unable to suppress grid item'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (suppress_grid_item_record)] ${error.message}`, {
            exhibit_id,
            grid_id,
            grid_item_id,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Reorders grids in exhibit
 * @param {string} exhibit_id - Exhibit UUID
 * @param {Object} grid - Grid order data
 * @returns {Promise<*>} Result from task
 */
exports.reorder_grids = async (exhibit_id, grid) => {

    try {

        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (reorder_grids)] Invalid exhibit UUID provided');
            return false;
        }

        if (!grid || typeof grid !== 'object') {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (reorder_grids)] Invalid grid data provided');
            return false;
        }

        return await grid_record_task.reorder_grids(exhibit_id, grid);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (reorder_grids)] ${error.message}`, {
            exhibit_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Reorders grid items in grid
 * @param {string} grid_id - Grid UUID
 * @param {Object} grid - Grid item order data
 * @returns {Promise<*>} Result from task
 */
exports.reorder_grid_items = async (grid_id, grid) => {

    try {

        if (!is_valid_uuid(grid_id)) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (reorder_grid_items)] Invalid grid UUID provided');
            return false;
        }

        if (!grid || typeof grid !== 'object') {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (reorder_grid_items)] Invalid grid data provided');
            return false;
        }

        return await grid_record_task.reorder_grid_items(grid_id, grid);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (reorder_grid_items)] ${error.message}`, {
            grid_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Unlocks grid item record for editing
 * @param {string} uid - User ID
 * @param {string} uuid - Grid item UUID
 * @param {object} options - {force: true/false}
 * @returns {Promise<*>} Unlock result
 */
exports.unlock_grid_item_record = async (uid, uuid, options) => {

    try {

        if (!is_valid_uuid(uid) || !is_valid_uuid(uuid)) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (unlock_grid_item_record)] Invalid UUID provided');
            return false;
        }

        return await helper_task.unlock_record(uid, uuid, DB, TABLES.grid_item_records, options);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (unlock_grid_item_record)] ${error.message}`, {
            uid,
            uuid,
            stack: error.stack
        });

        return false;
    }
};

exports.publish_grid_record = publish_grid_record;
exports.suppress_grid_record = suppress_grid_record;
exports.publish_grid_item_record = publish_grid_item_record;
exports.suppress_grid_item_record = suppress_grid_item_record;