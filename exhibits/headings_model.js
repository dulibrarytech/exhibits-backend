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
    PUBLICATION_STATUS: {
        PUBLISHED: 1,
        UNPUBLISHED: 0
    },
    REPUBLISH_DELAY_MS: 5000
};

// Initialize task instances
const helper_task = new HELPER();
const validate_create_heading_task = new VALIDATOR(EXHIBITS_CREATE_HEADING_SCHEMA);
const validate_heading_update_task = new VALIDATOR(EXHIBITS_UPDATE_HEADING_SCHEMA);
const heading_record_task = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
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
    const response = { status, message };
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
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (${context})] Invalid input data format`);
        return [{ message: 'Invalid input data format' }];
    }

    const validation_result = validator.validate(data);

    if (validation_result !== true) {
        const error_msg = validation_result[0].message || 'Validation failed';
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (${context})] ${error_msg}`);
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
 * Handles post-update republishing for heading
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - Heading UUID
 * @returns {Promise<void>}
 */
const handle_heading_republish = async (is_member_of_exhibit, uuid) => {

    try {

        const suppress_result = await suppress_heading_record(is_member_of_exhibit, uuid);

        if (suppress_result && suppress_result.status === true) {
            setTimeout(async () => {
                try {
                    const publish_result = await publish_heading_record(is_member_of_exhibit, uuid);

                    if (publish_result && publish_result.status === true) {
                        LOGGER.module().info('INFO: [/exhibits/headings_model (handle_heading_republish)] Heading record re-published successfully.');
                    } else {
                        LOGGER.module().error('ERROR: [/exhibits/headings_model (handle_heading_republish)] Failed to re-publish heading');
                    }
                } catch (error) {
                    LOGGER.module().error(`ERROR: [/exhibits/headings_model (handle_heading_republish)] ${error.message}`, {
                        is_member_of_exhibit,
                        uuid,
                        stack: error.stack
                    });
                }
            }, CONSTANTS.REPUBLISH_DELAY_MS);
        }
    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (handle_heading_republish)] ${error.message}`, {
            is_member_of_exhibit,
            uuid,
            stack: error.stack
        });
    }
};

/**
 * Creates heading record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Object} data - Heading data
 * @returns {Promise<Object>} Response object
 */
exports.create_heading_record = async (is_member_of_exhibit, data) => {

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
        const validation_result = validate_input(data, validate_create_heading_task, 'create_heading_record');

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
        const result = await heading_record_task.create_heading_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/headings_model (create_heading_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to create heading record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Heading record created',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (create_heading_record)] ${error.message}`, {
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
 * Gets heading record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - Heading UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_heading_record = async (is_member_of_exhibit, uuid) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await heading_record_task.get_heading_record(is_member_of_exhibit, uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Heading record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (get_heading_record)] ${error.message}`, {
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
 * Gets heading edit record
 * @param {string} uid - User ID
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - Heading UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_heading_edit_record = async (uid, is_member_of_exhibit, uuid) => {

    try {

        if (!is_valid_uuid(uid) || !is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await heading_record_task.get_heading_edit_record(uid, is_member_of_exhibit, uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Heading edit record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (get_heading_edit_record)] ${error.message}`, {
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
 * Updates heading record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - Heading UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Response object
 */
exports.update_heading_record = async (is_member_of_exhibit, uuid, data) => {

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
        const validation_result = validate_input(data, validate_heading_update_task, 'update_heading_record');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Prepare styles
        data.styles = prepare_styles(data.styles);

        // Update record
        const result = await heading_record_task.update_heading_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Unable to update heading record'
            );
        }

        // Handle republishing if needed (check for truthy values)
        if (is_published === 'true' || is_published === true || is_published === 1) {
            setImmediate(() => handle_heading_republish(is_member_of_exhibit, uuid));
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Heading record updated'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (update_heading_record)] ${error.message}`, {
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
 * Publishes heading record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} heading_id - Heading UUID
 * @returns {Promise<Object>} Response object
 */
const publish_heading_record = async (exhibit_id, heading_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(heading_id)) {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Check if exhibit is published
        const exhibit_record = await exhibit_tasks.get_exhibit_record(exhibit_id);

        if (!exhibit_record || exhibit_record.is_published === CONSTANTS.PUBLICATION_STATUS.UNPUBLISHED) {
            LOGGER.module().error('ERROR: [/exhibits/headings_model (publish_heading_record)] Exhibit not published');

            return {
                status: false,
                message: 'Unable to publish heading. Exhibit must be published first'
            };
        }

        // Set heading to published and index (order matters: publish first, then index)
        const is_heading_published = await heading_record_task.set_heading_to_publish(heading_id);
        const is_indexed = await INDEXER_MODEL.index_heading_record(exhibit_id, heading_id);

        if (is_indexed === false) {
            LOGGER.module().error('ERROR: [/exhibits/headings_model (publish_heading_record)] Unable to index heading');

            return {
                status: false,
                message: 'Unable to publish heading'
            };
        }

        if (is_heading_published === false) {
            LOGGER.module().error('ERROR: [/exhibits/headings_model (publish_heading_record)] Unable to set heading to published');

            return {
                status: false,
                message: 'Unable to publish heading'
            };
        }

        return {
            status: true,
            message: 'Heading published'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (publish_heading_record)] ${error.message}`, {
            exhibit_id,
            heading_id,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Suppresses heading record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} item_id - Heading UUID
 * @returns {Promise<Object>} Response object
 */
const suppress_heading_record = async (exhibit_id, item_id) => {

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
            LOGGER.module().error('ERROR: [/exhibits/headings_model (suppress_heading_record)] Unable to delete from index');

            return {
                status: false,
                message: 'Unable to suppress heading'
            };
        }

        // Set heading to suppressed
        const is_heading_suppressed = await heading_record_task.set_heading_to_suppress(item_id);

        if (is_heading_suppressed === false) {
            LOGGER.module().error('ERROR: [/exhibits/headings_model (suppress_heading_record)] Unable to set heading to suppressed');

            return {
                status: false,
                message: 'Unable to suppress heading'
            };
        }

        return {
            status: true,
            message: 'Heading suppressed'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (suppress_heading_record)] ${error.message}`, {
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
 * Reorders headings in exhibit
 * @param {string} exhibit_id - Exhibit UUID
 * @param {Object} heading - Heading order data
 * @returns {Promise<*>} Result from task
 */
exports.reorder_headings = async (exhibit_id, heading) => {

    try {

        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error('ERROR: [/exhibits/headings_model (reorder_headings)] Invalid exhibit UUID provided');
            return false;
        }

        if (!heading || typeof heading !== 'object') {
            LOGGER.module().error('ERROR: [/exhibits/headings_model (reorder_headings)] Invalid heading data provided');
            return false;
        }

        return await heading_record_task.reorder_headings(exhibit_id, heading);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (reorder_headings)] ${error.message}`, {
            exhibit_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Unlocks heading record for editing
 * @param {string} uid - User ID
 * @param {string} uuid - Heading UUID
 * @param {object} options - {force: true/false}
 * @returns {Promise<*>} Unlock result
 */
exports.unlock_heading_record = async (uid, uuid, options) => {

    try {

        if (!is_valid_uuid(uid) || !is_valid_uuid(uuid)) {
            LOGGER.module().error('ERROR: [/exhibits/headings_model (unlock_heading_record)] Invalid UUID provided');
            return false;
        }

        return await helper_task.unlock_record(uid, uuid, DB, TABLES.heading_records, options);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/headings_model (unlock_heading_record)] ${error.message}`, {
            uid,
            uuid,
            stack: error.stack
        });

        return false;
    }
};

exports.publish_heading_record = publish_heading_record;
exports.suppress_heading_record = suppress_heading_record;