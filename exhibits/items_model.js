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
        NOT_FOUND: 404,
        INTERNAL_SERVER_ERROR: 500
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
        const validation_result = validate_input(data, validate_create_item_task, 'items_model (create_item_record)');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Prepare styles and get order
        data.styles = prepare_styles(data.styles);
        data.order = await helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        // Create record
        const result = await item_task.create_item_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (create_item_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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

        // Re-index just this item in place — no suppress. ES index upserts by id, so
        // re-indexing overwrites; suppressing would only blank the item from public
        // search for the delay window. (publish_item_record re-indexes just this item.)
        // Coalesced per item: a burst of edits collapses to one near-real-time
        // re-index (was a flat 5s delay + one independent timer per edit).
        REINDEX_COALESCER.schedule_reindex(`item:${item_id}`, async () => {
            const publish_result = await publish_item_record(is_member_of_exhibit, item_id);

            if (publish_result && publish_result.status === true) {
                LOGGER.module().info('INFO: [/exhibits/items_model (handle_item_republish)] Item re-indexed after edit.');
            } else {
                LOGGER.module().error('ERROR: [/exhibits/items_model (handle_item_republish)] Failed to re-index item');
            }
        });
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
        const validation_result = validate_input(data, validate_update_item_task, 'items_model (update_item_record)');

        if (validation_result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

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

        if (!is_valid_user_id(uid) || !is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
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
 * Gets item details record with media library metadata (no lock)
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} uuid - Item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_item_details_record = async (is_member_of_exhibit, uuid) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) || !is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await item_task.get_item_details_record(is_member_of_exhibit, uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Item details record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (get_item_details_record)] ${error.message}`, {
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

/** TODO: deprecate - moved to media library module
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

/** TODO: move to media library module
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
 * Reorders all of an exhibit's items in ONE atomic transaction, using a single
 * bulk CASE update per target table — replacing the controller's per-item loop of
 * N non-atomic single-row UPDATEs (each on its own connection). A mixed top-level
 * drag becomes <= 4 statements (item / heading / grid / timeline), plus one per
 * distinct grid for grid-item reorders, all-or-nothing inside one transaction.
 * Mirrors the gap-healer `helper.apply_reorder` (also transactional, also bumps
 * `updated`); the `{ type, uuid, order, [grid_id] }` payload is unchanged.
 *
 * @param {string} exhibit_id - Exhibit UUID (scope for top-level items)
 * @param {Array<Object>} updated_order - [{ type, uuid, order, [grid_id] }, ...]
 * @param {string} [updated_by=null] - User id; bumps updated_by when provided
 * @returns {Promise<boolean>} true on success; false on validation/DB failure
 */
exports.reorder_exhibit_items = async (exhibit_id, updated_order, updated_by = null) => {

    try {

        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (reorder_exhibit_items)] Invalid exhibit UUID provided');
            return false;
        }

        if (!Array.isArray(updated_order) || updated_order.length === 0) {
            LOGGER.module().error('ERROR: [/exhibits/items_model (reorder_exhibit_items)] Invalid or empty order data');
            return false;
        }

        // type -> { table, scope_column }. heading + subheading share heading_records;
        // grid items scope to their grid (is_member_of_grid), everything else to the
        // exhibit (is_member_of_exhibit).
        const TYPE_MAP = {
            item:       { table: TABLES.item_records,      scope_column: 'is_member_of_exhibit' },
            grid:       { table: TABLES.grid_records,      scope_column: 'is_member_of_exhibit' },
            heading:    { table: TABLES.heading_records,   scope_column: 'is_member_of_exhibit' },
            subheading: { table: TABLES.heading_records,   scope_column: 'is_member_of_exhibit' },
            timeline:   { table: TABLES.timeline_records,  scope_column: 'is_member_of_exhibit' },
            griditem:   { table: TABLES.grid_item_records, scope_column: 'is_member_of_grid' }
        };

        // Group rows by (table, scope value).
        const groups = new Map();

        for (const row of updated_order) {

            const mapping = TYPE_MAP[row && row.type];

            if (!mapping) {
                LOGGER.module().error(`ERROR: [/exhibits/items_model (reorder_exhibit_items)] Unknown item type: ${row && row.type}`);
                return false;
            }

            const scope_value = mapping.scope_column === 'is_member_of_grid' ? row.grid_id : exhibit_id;

            if (!is_valid_uuid(row.uuid) || !is_valid_uuid(scope_value) || typeof row.order !== 'number') {
                LOGGER.module().error('ERROR: [/exhibits/items_model (reorder_exhibit_items)] Invalid uuid, scope, or order in payload');
                return false;
            }

            const key = `${mapping.table}::${scope_value}`;

            if (!groups.has(key)) {
                groups.set(key, { table: mapping.table, scope_column: mapping.scope_column, scope_value, items: [] });
            }

            groups.get(key).items.push({ uuid: row.uuid, order: row.order });
        }

        // Reject duplicate uuids or duplicate order values within a scope — either
        // corrupts the ordering (ambiguous CASE / two rows in the same slot).
        for (const group of groups.values()) {
            const seen_uuids = new Set();
            const seen_orders = new Set();
            for (const it of group.items) {
                if (seen_uuids.has(it.uuid) || seen_orders.has(it.order)) {
                    LOGGER.module().error('ERROR: [/exhibits/items_model (reorder_exhibit_items)] Duplicate uuid or order in reorder payload');
                    return false;
                }
                seen_uuids.add(it.uuid);
                seen_orders.add(it.order);
            }
        }

        // Apply every group inside one transaction: a single CASE update per table.
        // Any failure throws -> knex auto-rolls back -> no half-reordered exhibit.
        await DB.transaction(async (trx) => {
            for (const group of groups.values()) {

                const uuids = group.items.map((it) => it.uuid);
                const when = group.items.map(() => 'WHEN ? THEN ?').join(' ');
                // `??` binds the `uuid` column identifier (quoted by knex); the `?`s
                // bind each uuid/order value — never string-interpolated.
                const bindings = ['uuid'];
                group.items.forEach((it) => bindings.push(it.uuid, it.order));

                const update_data = {
                    order: trx.raw(`CASE ?? ${when} END`, bindings),
                    updated: trx.fn.now()
                };

                if (updated_by) {
                    update_data.updated_by = updated_by;
                }

                await trx(group.table)
                    .where(group.scope_column, group.scope_value)
                    .whereIn('uuid', uuids)
                    .update(update_data);
            }
        });

        return true;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/items_model (reorder_exhibit_items)] ${error.message}`, {
            exhibit_id,
            stack: error.stack
        });

        return false;
    }
};

/**
 * Targeted re-index after a reorder. Re-indexes ONLY the components named in the
 * reorder payload — each top-level component is its own ES doc, and grid items are
 * re-indexed via their parent grid's doc — instead of a full `index_exhibit` over
 * every component. Re-indexing reads the fresh DB order, so re-indexing per the
 * payload reflects the new ordering.
 *
 * Each op is debounced per component by reindex_coalescer, which both coalesces a
 * burst of drags (per component) AND covers the union across the burst: a component
 * appearing in any drag of the burst gets a pending re-index that re-reads the DB.
 * Grid items collapse to ONE re-index of their parent grid doc (rebuilt with all
 * items in their new order) — avoiding a per-item read-modify-write race on the
 * shared grid doc.
 *
 * Fire-and-forget: schedules timers and returns. The caller must have confirmed the
 * exhibit is published (an unpublished exhibit must not be added to the public index).
 *
 * @param {string} exhibit_id - Exhibit UUID
 * @param {Array<{type:string, uuid:string, order:number, grid_id?:string}>} updated_order
 */
exports.schedule_reorder_reindex = (exhibit_id, updated_order) => {

    if (!is_valid_uuid(exhibit_id) || !Array.isArray(updated_order)) {
        return;
    }

    // Dedupe to one op per component. Grid items (and a moved grid) collapse to a
    // single re-index of the grid doc, keyed `grid:<grid_uuid>`.
    const ops = new Map();

    for (const row of updated_order) {

        if (!row || typeof row !== 'object') {
            continue;
        }

        if (row.type === 'item' && is_valid_uuid(row.uuid)) {
            ops.set(`item:${row.uuid}`, () => INDEXER_MODEL.index_item_record(exhibit_id, row.uuid));
        } else if ((row.type === 'heading' || row.type === 'subheading') && is_valid_uuid(row.uuid)) {
            ops.set(`heading:${row.uuid}`, () => INDEXER_MODEL.index_heading_record(exhibit_id, row.uuid));
        } else if (row.type === 'grid' && is_valid_uuid(row.uuid)) {
            ops.set(`grid:${row.uuid}`, () => INDEXER_MODEL.index_grid_record(exhibit_id, row.uuid));
        } else if (row.type === 'timeline' && is_valid_uuid(row.uuid)) {
            ops.set(`timeline:${row.uuid}`, () => INDEXER_MODEL.index_timeline_record(exhibit_id, row.uuid));
        } else if (row.type === 'griditem' && is_valid_uuid(row.grid_id)) {
            ops.set(`grid:${row.grid_id}`, () => INDEXER_MODEL.index_grid_record(exhibit_id, row.grid_id));
        }
    }

    for (const [key, run] of ops) {
        REINDEX_COALESCER.schedule_reindex(key, async () => {
            const indexed = await run();

            if (indexed === true) {
                LOGGER.module().info(`INFO: [/exhibits/items_model (schedule_reorder_reindex)] Re-indexed ${key} after reorder.`);
            } else {
                LOGGER.module().error(`ERROR: [/exhibits/items_model (schedule_reorder_reindex)] Failed to re-index ${key} after reorder.`);
            }
        });
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

        if (!is_valid_user_id(uid) || !is_valid_uuid(uuid)) {
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

/** TODO: deprecate - moved to media library module
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