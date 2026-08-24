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
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
const HELPER = require('../libs/helper');
const EXHIBIT_RECORD_TASKS = require('./tasks/exhibit_record_tasks');
const INDEXER_MODEL = require('../indexer/model');
const LOGGER = require('../libs/log4');
const REINDEX_COALESCER = require('./reindex_coalescer');
const {
    is_valid_uuid,
    is_valid_user_id,    build_response,
    prepare_styles,
    validate_internal_name
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
    ITEM_TYPES: {
        TEXT: 'text'
    },
    MIME_TYPES: {
        TEXT_PLAIN: 'text/plain'
    },
    PUBLICATION_STATUS: {
        PUBLISHED: 1,
        UNPUBLISHED: 0
    }
};

// Initialize task instances
const helper_task = new HELPER();
const grid_record_task = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
const exhibit_tasks = new EXHIBIT_RECORD_TASKS(DB, TABLES);

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

// Column counts the dashboard's Grid Columns dropdown offers. Keep in sync
// with views/grid-items/partials/item-grid-data-card.ejs and
// public/app/grid-items/items.common.grid.form.module.js.
const ALLOWED_COLUMNS = [2, 3, 4];

/**
 * Returns the minimum number of grid items a grid must hold before it can
 * be published: one full row, i.e. the selected column count. Legacy grids
 * saved with a column value outside the allowed set fall back to the
 * smallest allowed count so they aren't blocked harder than the edit form
 * (which forces a re-selection) would require.
 * @param {*} columns - Stored column value
 * @returns {number} Minimum required grid items
 */
const get_minimum_grid_items = (columns) => {
    const parsed = safe_parse_int(columns, 0);
    return ALLOWED_COLUMNS.includes(parsed) ? parsed : Math.min(...ALLOWED_COLUMNS);
};

/**
 * Checks a grid against the minimum-items rule (items >= columns).
 * @param {string} exhibit_id - Exhibit UUID
 * @param {Object} grid_record - Grid DB record (uuid, columns, internal_name)
 * @param {Object} [count_options] - Passed to get_grid_item_count
 * @returns {Promise<Object|null>} Violation {uuid, internal_name, minimum, item_count} or null
 */
const check_grid_minimum_items = async (exhibit_id, grid_record, count_options = {}) => {

    const minimum = get_minimum_grid_items(grid_record.columns);
    const item_count = await grid_record_task.get_grid_item_count(
        exhibit_id,
        grid_record.uuid,
        count_options
    );

    if (item_count >= minimum) {
        return null;
    }

    return {
        uuid: grid_record.uuid,
        internal_name: grid_record.internal_name || 'Untitled grid',
        minimum,
        item_count
    };
};

/**
 * Builds the user-facing message for a minimum-items violation. Written for
 * non-technical staff: states the problem and both remedies.
 * @param {Object} violation - {minimum, item_count}
 * @returns {string} Message
 */
const build_minimum_items_message = (violation) => {

    const {minimum, item_count} = violation;
    const have = item_count === 0
        ? 'has no grid items yet'
        : `has only ${item_count} grid item${item_count === 1 ? '' : 's'}`;

    return `This grid is set to ${minimum} columns but ${have}. ` +
        `Add at least ${minimum} grid items, or reduce the number of columns, before publishing.`;
};

/**
 * Returns grids in an exhibit that hold fewer items than their selected
 * column count. Used by the exhibit publish gate in exhibits_model.
 * @param {string} exhibit_id - Exhibit UUID
 * @returns {Promise<Array>} Violations ({uuid, internal_name, minimum, item_count})
 */
exports.get_under_filled_grids = async (exhibit_id) => {

    const grid_records = await grid_record_task.get_grid_records(exhibit_id);

    if (!Array.isArray(grid_records) || grid_records.length === 0) {
        return [];
    }

    const checks = await Promise.all(
        grid_records.map((grid_record) => check_grid_minimum_items(exhibit_id, grid_record))
    );

    return checks.filter((violation) => violation !== null);
};

/**
 * Creates grid record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Object} data - Grid data
 * @returns {Promise<Object>} Response object
 */
const RTE_VOCABULARY = require('../libs/rte_vocabulary');

/*
 * Field → rich-text profile maps enforced on create/update. Mirror the
 * dashboard editor configuration (public/app/utils/rte.module.js).
 */
const GRID_RTE_PROFILES = {
    text: 'full',
    internal_name: 'plain'
};

const GRID_ITEM_RTE_PROFILES = {
    title: 'reduced',
    text: 'full',
    description: 'full',
    caption: 'full',
    alt_text: 'plain'
};

exports.create_grid_record = async (is_member_of_exhibit, data) => {

    RTE_VOCABULARY.apply(data, GRID_RTE_PROFILES);

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

        // Missing columns falls back to the task-layer default (4); a
        // supplied value must be one of the dropdown's allowed counts.
        if (data.columns === undefined || data.columns === null || data.columns === '') {
            data.columns = 4;
        } else {
            data.columns = safe_parse_int(data.columns, 0);
        }

        if (!ALLOWED_COLUMNS.includes(data.columns)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Grid columns must be 2, 3, or 4'
            );
        }

        const internal_name_error = validate_internal_name(data, true, 'Grid');

        if (internal_name_error !== null) {
            return internal_name_error;
        }

        // Get order
        data.order = await helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        // Create record
        const result = await grid_record_task.create_grid_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (create_grid_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to create grid record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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

    RTE_VOCABULARY.apply(data, GRID_RTE_PROFILES);

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

        // Omitted columns leaves the stored value untouched (partial update);
        // a supplied value must be one of the dropdown's allowed counts.
        if (data.columns === undefined || data.columns === null || data.columns === '') {
            delete data.columns;
        } else {
            data.columns = safe_parse_int(data.columns, 0);

            if (!ALLOWED_COLUMNS.includes(data.columns)) {
                return build_response(
                    CONSTANTS.STATUS_CODES.BAD_REQUEST,
                    'Grid columns must be 2, 3, or 4'
                );
            }
        }

        // Omitted internal_name leaves the stored value untouched (the
        // publish/suppress flows send partial updates); a supplied value
        // must be a non-empty string.
        const internal_name_error = validate_internal_name(data, false, 'Grid');

        if (internal_name_error !== null) {
            return internal_name_error;
        }

        // Update record
        const result = await grid_record_task.update_grid_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to update grid record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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

    RTE_VOCABULARY.apply(data, GRID_ITEM_RTE_PROFILES);

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

        // Prepare styles and get order
        data.styles = prepare_styles(data.styles);
        data.order = await helper_task.order_grid_items(data.is_member_of_grid, DB, TABLES);

        // Create record
        const result = await grid_record_task.create_grid_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to create grid item record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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

        if (!is_valid_user_id(uid) ||
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
 * Gets grid item details record with media library metadata (no lock)
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_grid - Grid UUID
 * @param {string} item_id - Grid item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_grid_item_details_record = async (is_member_of_exhibit, is_member_of_grid, item_id) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(is_member_of_grid) ||
            !is_valid_uuid(item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const grid_item = await grid_record_task.get_grid_item_details_record(
            is_member_of_exhibit,
            is_member_of_grid,
            item_id
        );

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Grid item details record',
            grid_item
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/grid_model (get_grid_item_details_record)] ${error.message}`, {
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

        // Re-index just this grid item in place — no suppress. The nested-child
        // indexer (index_container_child_record) now upserts by id, so the fresh
        // copy replaces the stale one in the grid doc's items[] without a delete.
        // Dropping the suppress removes the ~5s public blackout on every edit.
        // Coalesced per grid item: a burst of edits collapses to one near-real-time
        // re-index (was a flat 5s delay + one independent timer per edit).
        REINDEX_COALESCER.schedule_reindex(`grid_item:${item_id}`, async () => {
            const publish_result = await publish_grid_item_record(is_member_of_exhibit, is_member_of_grid, item_id);

            if (publish_result && publish_result.status === true) {
                LOGGER.module().info('INFO: [/exhibits/grid_model (handle_grid_item_republish)] Grid item re-indexed after edit.');
            } else {
                LOGGER.module().error('ERROR: [/exhibits/grid_model (handle_grid_item_republish)] Failed to re-index grid item');
            }
        });
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

    RTE_VOCABULARY.apply(data, GRID_ITEM_RTE_PROFILES);

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

        data.styles = prepare_styles(data.styles);

        // Update record
        const result = await grid_record_task.update_grid_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to update grid item record'
            );
        }

        // Handle republishing if needed (check for truthy values including string 'true', number 1, and boolean true)
        if (is_published === 'true' || is_published === true || is_published === 1) {
            setImmediate(() => handle_grid_item_republish(is_member_of_exhibit, is_member_of_grid, item_id));
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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

        // A grid must fill at least one full row (items >= columns) before
        // it can go public — fewer items breaks the frontend grid layout.
        const grid_record = await grid_record_task.get_grid_record(exhibit_id, grid_id);

        if (!grid_record) {
            LOGGER.module().error('ERROR: [/exhibits/grid_model (publish_grid_record)] Grid record not found');

            return {
                status: false,
                message: 'Unable to publish grid'
            };
        }

        const violation = await check_grid_minimum_items(exhibit_id, grid_record);

        if (violation !== null) {
            LOGGER.module().info(
                `INFO: [/exhibits/grid_model (publish_grid_record)] Grid ${grid_id} has ${violation.item_count} item(s); minimum is ${violation.minimum}`
            );

            return {
                status: false,
                message: build_minimum_items_message(violation)
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

        // A published grid must keep at least one full row (items >= columns)
        // on the live site — refuse to unpublish an item that would drop it
        // below that minimum.
        const parent_grid_record = await grid_record_task.get_grid_record(exhibit_id, grid_id);

        if (parent_grid_record && parent_grid_record.is_published === CONSTANTS.PUBLICATION_STATUS.PUBLISHED) {

            const minimum = get_minimum_grid_items(parent_grid_record.columns);
            const published_count = await grid_record_task.get_grid_item_count(
                exhibit_id,
                grid_id,
                {published_only: true}
            );
            const item_record = await grid_record_task.get_grid_item_record(exhibit_id, grid_id, grid_item_id);
            const remaining_count = item_record && item_record.is_published === CONSTANTS.PUBLICATION_STATUS.PUBLISHED
                ? published_count - 1
                : published_count;

            if (remaining_count < minimum) {
                LOGGER.module().info(
                    `INFO: [/exhibits/grid_model (suppress_grid_item_record)] Suppressing item ${grid_item_id} would leave grid ${grid_id} with ${remaining_count} published item(s); minimum is ${minimum}`
                );

                return {
                    status: false,
                    message: `Cannot unpublish this grid item. The grid is published and needs at least ${minimum} items for its ${minimum} columns. Unpublish the grid first.`
                };
            }
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

        if (!is_valid_user_id(uid) || !is_valid_uuid(uuid)) {
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