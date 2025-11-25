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
const EXHIBITS_CREATE_RECORD_SCHEMA = require('../exhibits/schemas/exhibit_create_record_schema')();
const EXHIBITS_UPDATE_RECORD_SCHEMA = require('../exhibits/schemas/exhibit_update_record_schema')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('./tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('./tasks/exhibit_heading_record_tasks');
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
const EXHIBIT_TIMELINE_RECORD_TASKS = require('./tasks/exhibit_timeline_record_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const INDEXER_MODEL = require('../indexer/model');
const ITEMS_MODEL = require('../exhibits/items_model');
const GRIDS_MODEL = require('../exhibits/grid_model');
const TIMELINES_MODEL = require('../exhibits/timelines_model');
const LOGGER = require('../libs/log4');

// Constants
const CONSTANTS = {
    REPUBLISH_DELAY_MS: 5000,
    DEFAULT_STYLES: {},
    STATUS_CODES: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400
    },
    RECORD_TYPES: {
        GRID: 'grid',
        VERTICAL_TIMELINE: 'vertical_timeline',
        TIMELINE: 'timeline'
    }
};

// Initialize task instances
const helper_task = new HELPER();
const validate_create_task = new VALIDATOR(EXHIBITS_CREATE_RECORD_SCHEMA);
const validate_update_task = new VALIDATOR(EXHIBITS_UPDATE_RECORD_SCHEMA);
const exhibit_record_task = new EXHIBIT_RECORD_TASKS(DB, TABLES);
const item_record_task = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
const heading_record_task = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
const grid_record_task = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
const timeline_record_task = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);

/**
 * Standardized response builder
 * @param {number} status - HTTP status code
 * @param {string} message - Response message
 * @param {*} data - Optional response data
 * @returns {Object} Standardized response object
 */
const build_response = (status, message, data = null) => {
    const response = { status, message };
    if (data !== null) {
        response.data = data;
    }
    return response;
};

/**
 * Validates and sanitizes input data
 * @param {Object} data - Input data to validate
 * @param {Object} validator - Validator instance
 * @returns {Object|true} Validation result
 */
const validate_input = (data, validator) => {
    if (!data || typeof data !== 'object') {
        return [{ message: 'Invalid input data format' }];
    }
    return validator.validate(data);
};

/**
 * Processes media files for exhibit
 * @param {string} uuid - Exhibit UUID
 * @param {Object} data - Data containing media fields
 * @returns {Object} Processed data with updated media paths
 */
const process_exhibit_media = (uuid, data) => {
    const processed_data = { ...data };

    if (processed_data.hero_image && processed_data.hero_image.length > 0) {
        processed_data.hero_image = helper_task.process_uploaded_media(
            uuid,
            null,
            processed_data.hero_image,
            STORAGE_CONFIG.storage_path
        );
    }

    if (processed_data.thumbnail && processed_data.thumbnail.length > 0) {
        processed_data.thumbnail = helper_task.process_uploaded_media(
            uuid,
            null,
            processed_data.thumbnail,
            STORAGE_CONFIG.storage_path
        );
    }

    return processed_data;
};

/**
 * Prepares styles data
 * @param {Object|string} styles - Styles object or string
 * @returns {string} JSON stringified styles
 */
const prepare_styles = (styles) => {
    if (!styles || (typeof styles === 'object' && Object.keys(styles).length === 0)) {
        return JSON.stringify(CONSTANTS.DEFAULT_STYLES);
    }
    return typeof styles === 'string' ? styles : JSON.stringify(styles);
};

/**
 * Creates exhibit record
 * @param {Object} data - Exhibit data
 * @returns {Promise<Object>} Response object
 */
exports.create_exhibit_record = async (data) => {

    try {
        // Generate UUID
        data.uuid = helper_task.create_uuid();

        // Validate input
        const validation_result = validate_input(data, validate_create_task);

        if (validation_result !== true) {
            const error_path = validation_result[0].dataPath || 'unknown';
            const error_msg = validation_result[0].message || 'Validation failed';
            LOGGER.module().error(`ERROR: [/exhibits/model (create_exhibit_record)] ${error_path} ${error_msg}`);

            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Ensure storage path exists
        helper_task.check_storage_path(data.uuid, STORAGE_CONFIG.storage_path);

        // Process media files
        data = process_exhibit_media(data.uuid, data);

        // Prepare styles
        data.styles = prepare_styles(data.styles);

        // Create record
        const result = await exhibit_record_task.create_exhibit_record(data);

        if (!result) {
            LOGGER.module().error('ERROR: [/exhibits/model (create_exhibit_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to create exhibit record'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Exhibit record created',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (create_exhibit_record)] ${error.message}`, {
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to create record: ${error.message}`
        );
    }
};

/**
 * Gets all exhibit records
 * @returns {Promise<Object>} Response object with records
 */
exports.get_exhibit_records = async () => {

    try {
        const records = await exhibit_record_task.get_exhibit_records();

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit records',
            records
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (get_exhibit_records)] ${error.message}`, {
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            error.message
        );
    }
};

/**
 * Gets exhibit title by UUID
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object with title
 */
exports.get_exhibit_title = async (uuid) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const title = await exhibit_record_task.get_exhibit_title(uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit title',
            title
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (get_exhibit_title)] ${error.message}`, {
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
 * Gets exhibit record by UUID
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object with record
 */
exports.get_exhibit_record = async (uuid) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const record = await exhibit_record_task.get_exhibit_record(uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (get_exhibit_record)] ${error.message}`, {
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
 * Gets exhibit edit record by UUID and user ID
 * @param {string} uid - User ID
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object with record
 */
exports.get_exhibit_edit_record = async (uid, uuid) => {

    try {

        if (!uid || !uuid || typeof uid !== 'string' || typeof uuid !== 'string') {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UID or UUID provided'
            );
        }

        const record = await exhibit_record_task.get_exhibit_edit_record(uid, uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit edit record',
            record
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (get_exhibit_edit_record)] ${error.message}`, {
            uid,
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
 * Processes media updates for exhibit
 * @param {string} uuid - Exhibit UUID
 * @param {Object} data - Data containing media fields
 * @returns {Object} Processed data
 */
const process_media_updates = (uuid, data) => {
    const processed_data = { ...data };

    // Process hero image if changed
    if (processed_data.hero_image &&
        processed_data.hero_image.length > 0 &&
        processed_data.hero_image !== processed_data.hero_image_prev) {
        processed_data.hero_image = helper_task.process_uploaded_media(
            uuid,
            null,
            processed_data.hero_image,
            STORAGE_CONFIG.storage_path
        );
    }

    // Process thumbnail if changed
    if (processed_data.thumbnail &&
        processed_data.thumbnail.length > 0 &&
        processed_data.thumbnail !== processed_data.thumbnail_prev) {
        processed_data.thumbnail = helper_task.process_uploaded_media(
            uuid,
            null,
            processed_data.thumbnail,
            STORAGE_CONFIG.storage_path
        );
    }

    // Clean up temporary fields
    delete processed_data.hero_image_prev;
    delete processed_data.thumbnail_prev;

    return processed_data;
};

/**
 * Handles post-update republishing
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<void>}
 */
const handle_republish = async (uuid) => {

    try {

        const suppress_result = await suppress_exhibit(uuid);

        if (suppress_result && suppress_result.status === true) {
            setTimeout(async () => {
                try {
                    const publish_result = await publish_exhibit(uuid);

                    if (publish_result && publish_result.status === true) {
                        LOGGER.module().info('INFO: [/exhibits/model (handle_republish)] Exhibit re-published successfully.');
                    } else {
                        LOGGER.module().error('ERROR: [/exhibits/model (handle_republish)] Failed to re-publish exhibit');
                    }
                } catch (error) {
                    LOGGER.module().error(`ERROR: [/exhibits/model (handle_republish)] ${error.message}`, {
                        uuid,
                        stack: error.stack
                    });
                }
            }, CONSTANTS.REPUBLISH_DELAY_MS);
        }
    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (handle_republish)] ${error.message}`, {
            uuid,
            stack: error.stack
        });
    }
};

/**
 * Updates exhibit record
 * @param {string} uuid - Exhibit UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Response object
 */
exports.update_exhibit_record = async (uuid, data) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        // Validate input
        const validation_result = validate_input(data, validate_update_task);

        if (validation_result !== true) {
            const error_msg = validation_result[0].message || 'Validation failed';
            LOGGER.module().error(`ERROR: [/exhibits/model (update_exhibit_record)] ${error_msg}`);

            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Ensure storage path exists
        helper_task.check_storage_path(uuid, STORAGE_CONFIG.storage_path);

        // Process media updates
        data = process_media_updates(uuid, data);

        // Prepare styles
        data.styles = prepare_styles(data.styles);

        // Extract and remove is_published flag
        const is_published = data.is_published;
        delete data.is_published;

        // Update record
        const result = await exhibit_record_task.update_exhibit_record(uuid, data);

        if (result !== true) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Unable to update exhibit record'
            );
        }

        // Handle republishing if needed (non-blocking)
        if (is_published === 1) {
            setImmediate(() => handle_republish(uuid));
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Exhibit record updated'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (update_exhibit_record)] ${error.message}`, {
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
 * Deletes grid items for an exhibit item
 * @param {Object} item - Exhibit item
 * @returns {Promise<void>}
 */
const delete_grid_items = async (item) => {

    try {

        const grid_items = await GRIDS_MODEL.get_grid_item_records(
            item.is_member_of_exhibit,
            item.uuid
        );

        if (!grid_items.data || grid_items.data.length === 0) {
            return;
        }

        const delete_promises = grid_items.data.map(async (grid_item) => {
            try {
                const delete_result = await GRIDS_MODEL.delete_grid_item_record(
                    grid_item.is_member_of_exhibit,
                    grid_item.is_member_of_grid,
                    grid_item.uuid
                );

                if (delete_result.data !== true) {
                    LOGGER.module().error(
                        `ERROR: [/exhibits/model (delete_grid_items)] Unable to delete grid item ${grid_item.uuid}`
                    );
                }
            } catch (error) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model (delete_grid_items)] ${error.message}`,
                    { grid_item_uuid: grid_item.uuid, stack: error.stack }
                );
            }
        });

        await Promise.allSettled(delete_promises);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (delete_grid_items)] ${error.message}`, {
            item_uuid: item.uuid,
            stack: error.stack
        });
    }
};

/**
 * Deletes timeline items for an exhibit item
 * @param {Object} item - Exhibit item
 * @returns {Promise<void>}
 */
const delete_timeline_items = async (item) => {

    try {

        const timeline_items = await TIMELINES_MODEL.get_timeline_item_records(
            item.is_member_of_exhibit,
            item.uuid
        );

        if (!timeline_items.data || timeline_items.data.length === 0) {
            return;
        }

        const delete_promises = timeline_items.data.map(async (timeline_item) => {

            try {

                const delete_result = await TIMELINES_MODEL.delete_timeline_item_record(
                    timeline_item.is_member_of_exhibit,
                    timeline_item.is_member_of_timeline,
                    timeline_item.uuid
                );

                if (delete_result.data !== true) {
                    LOGGER.module().error(
                        `ERROR: [/exhibits/model (delete_timeline_items)] Unable to delete timeline item ${timeline_item.uuid}`
                    );
                }
            } catch (error) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model (delete_timeline_items)] ${error.message}`,
                    { timeline_item_uuid: timeline_item.uuid, stack: error.stack }
                );
            }
        });

        await Promise.allSettled(delete_promises);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (delete_timeline_items)] ${error.message}`, {
            item_uuid: item.uuid,
            stack: error.stack
        });
    }
};

/**
 * Deletes all exhibit items and their children
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<void>}
 */
const delete_all_exhibit_items = async (uuid) => {

    try {

        const item_records = await item_record_task.get_item_records(uuid);

        if (!item_records || item_records.length === 0) {
            return;
        }

        const items_result = await ITEMS_MODEL.get_item_records(uuid);

        if (!items_result.data || items_result.data.length === 0) {
            return;
        }

        // Process each item
        for (const item of items_result.data) {

            try {
                // Handle grid items
                if (item.type === CONSTANTS.RECORD_TYPES.GRID) {
                    await delete_grid_items(item);
                }

                // Handle timeline items
                if (item.type === CONSTANTS.RECORD_TYPES.VERTICAL_TIMELINE) {
                    await delete_timeline_items(item);
                    item.type = CONSTANTS.RECORD_TYPES.TIMELINE;
                }

                // Delete the item itself
                const delete_result = await item_record_task.delete_item_record(
                    item.is_member_of_exhibit,
                    item.uuid,
                    item.type
                );

                if (delete_result === false) {
                    LOGGER.module().error(
                        `ERROR: [/exhibits/model (delete_all_exhibit_items)] Unable to delete exhibit item ${item.uuid} / ${item.type}`
                    );
                }
            } catch (error) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model (delete_all_exhibit_items)] ${error.message}`,
                    { item_uuid: item.uuid, stack: error.stack }
                );
            }
        }

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (delete_all_exhibit_items)] ${error.message}`, {
            uuid,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Deletes exhibit record and all associated items
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object
 */
exports.delete_exhibit_record = async (uuid) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        // Delete all exhibit items
        await delete_all_exhibit_items(uuid);

        // Delete the exhibit record itself
        const delete_result = await exhibit_record_task.delete_exhibit_record(uuid);

        if (delete_result === true) {
            return build_response(
                CONSTANTS.STATUS_CODES.NO_CONTENT,
                'Record deleted'
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.BAD_REQUEST,
            'Unable to delete exhibit record'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (delete_exhibit_record)] ${error.message}`, {
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
 * Clears media value from exhibit
 * @param {string} uuid - Exhibit UUID
 * @param {string} media - Media field name
 * @returns {Promise<void>}
 */
exports.delete_media_value = async (uuid, media) => {

    try {

        if (!uuid || !media || typeof uuid !== 'string' || typeof media !== 'string') {
            LOGGER.module().error('ERROR: [/exhibits/model (delete_media_value)] Invalid parameters');
            return;
        }

        const result = await exhibit_record_task.delete_media_value(uuid, media);

        if (result === true) {
            LOGGER.module().info('INFO: [/exhibits/model (delete_media_value)] Media value deleted');
        } else {
            LOGGER.module().error('ERROR: [/exhibits/model (delete_media_value)] Unable to delete media value');
        }

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (delete_media_value)] ${error.message}`, {
            uuid,
            media,
            stack: error.stack
        });
    }
};

/**
 * Builds exhibit preview
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object
 */
exports.build_exhibit_preview = async (uuid) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        const preview_result = await exhibit_record_task.set_preview(uuid);

        if (preview_result === false) {
            return {
                status: false,
                message: 'Unable to preview exhibit'
            };
        }

        const index_result = await INDEXER_MODEL.index_exhibit(uuid, 'preview');

        if (index_result.status === CONSTANTS.STATUS_CODES.CREATED) {
            return {
                status: true,
                message: 'Exhibit preview built'
            };
        }

        return {
            status: false,
            message: 'Unable to index exhibit preview'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (build_exhibit_preview)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Gets record counts for all exhibit components
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Object containing counts
 */
const get_exhibit_counts = async (uuid) => {
    const [heading_count, item_count, grid_count, timeline_count] = await Promise.all([
        heading_record_task.get_record_count(uuid),
        item_record_task.get_record_count(uuid),
        grid_record_task.get_record_count(uuid),
        timeline_record_task.get_record_count(uuid)
    ]);

    return {
        heading_count,
        item_count,
        grid_count,
        timeline_count,
        total_count: heading_count + item_count + grid_count + timeline_count
    };
};

/**
 * Sets all exhibit components to published state
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Array>} Array of publish results
 */
const set_all_to_publish = async (uuid) => {
    return await Promise.all([
        exhibit_record_task.set_to_publish(uuid),
        item_record_task.set_to_publish(uuid),
        heading_record_task.set_to_publish(uuid),
        grid_record_task.set_to_publish(uuid),
        timeline_record_task.set_to_publish(uuid),
        grid_record_task.set_to_publish_grid_items(uuid),
        timeline_record_task.set_to_publish_timeline_items(uuid)
    ]);
};

/**
 * Publishes exhibit
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object
 */
const publish_exhibit = async (uuid) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Check if exhibit has content
        const counts = await get_exhibit_counts(uuid);

        if (counts.total_count === 0) {
            LOGGER.module().info('INFO: [/exhibits/model (publish_exhibit)] Exhibit does not have any items');
            return {
                status: 'no_items',
                message: 'Exhibit does not have any items'
            };
        }

        // Set all components to published
        const publish_results = await set_all_to_publish(uuid);

        // Check for errors
        const has_errors = publish_results.some(result => result === false);

        if (has_errors) {
            LOGGER.module().error('ERROR: [/exhibits/model (publish_exhibit)] Unable to publish exhibit components');
            return {
                status: false,
                message: 'Unable to publish exhibit'
            };
        }

        // Index the exhibit
        const index_result = await INDEXER_MODEL.index_exhibit(uuid, 'publish');

        if (index_result.status === CONSTANTS.STATUS_CODES.CREATED) {
            return {
                status: true,
                message: 'Exhibit published'
            };
        }

        return {
            status: false,
            message: 'Unable to publish (index) exhibit'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (publish_exhibit)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Sets all exhibit components to suppressed state
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Array>} Array of suppress results
 */
const set_all_to_suppress = async (uuid) => {
    return await Promise.all([
        exhibit_record_task.set_to_suppress(uuid),
        item_record_task.set_to_suppress(uuid),
        heading_record_task.set_to_suppress(uuid),
        grid_record_task.set_to_suppress(uuid),
        timeline_record_task.set_to_suppress(uuid)
    ]);
};

/**
 * Gets all exhibit component records
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Object containing all records
 */
const get_all_exhibit_records = async (uuid) => {
    const [headings, items, grids, timelines] = await Promise.all([
        heading_record_task.get_heading_records(uuid),
        item_record_task.get_item_records(uuid),
        grid_record_task.get_grid_records(uuid),
        timeline_record_task.get_timeline_records(uuid)
    ]);

    return { headings, items, grids, timelines };
};

/**
 * Deletes items from index
 * @param {Array} items - Array of items to delete
 * @returns {Promise<void>}
 */
const delete_items_from_index = async (items) => {

    if (!items || items.length === 0) {
        return;
    }

    const delete_promises = items.map(async (item) => {

        try {

            const delete_result = await INDEXER_MODEL.delete_record(item.uuid);

            if (delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model (delete_items_from_index)] Unable to delete item ${item.uuid} from index`
                );
            }
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/model (delete_items_from_index)] ${error.message}`,
                { item_uuid: item.uuid, stack: error.stack }
            );
        }
    });

    await Promise.allSettled(delete_promises);
};

/**
 * Deletes grids from index
 * @param {Array} grids - Array of grids to delete
 * @returns {Promise<void>}
 */
const delete_grids_from_index = async (grids) => {

    if (!grids || grids.length === 0) {
        return;
    }

    const delete_promises = grids.map(async (grid) => {

        try {

            await grid_record_task.set_to_suppressed_grid_items(grid.uuid);
            const delete_result = await INDEXER_MODEL.delete_record(grid.uuid);

            if (delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model (delete_grids_from_index)] Unable to delete grid ${grid.uuid} from index`
                );
            }
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/model (delete_grids_from_index)] ${error.message}`,
                { grid_uuid: grid.uuid, stack: error.stack }
            );
        }
    });

    await Promise.allSettled(delete_promises);
};

/**
 * Deletes timelines from index
 * @param {Array} timelines - Array of timelines to delete
 * @returns {Promise<void>}
 */
const delete_timelines_from_index = async (timelines) => {

    if (!timelines || timelines.length === 0) {
        return;
    }

    const delete_promises = timelines.map(async (timeline) => {

        try {

            await timeline_record_task.set_to_suppressed_timeline_items(timeline.uuid);
            const delete_result = await INDEXER_MODEL.delete_record(timeline.uuid);

            if (delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model (delete_timelines_from_index)] Unable to delete timeline ${timeline.uuid} from index`
                );
            }
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/model (delete_timelines_from_index)] ${error.message}`,
                { timeline_uuid: timeline.uuid, stack: error.stack }
            );
        }
    });

    await Promise.allSettled(delete_promises);
};

/**
 * Deletes headings from index
 * @param {Array} headings - Array of headings to delete
 * @returns {Promise<void>}
 */
const delete_headings_from_index = async (headings) => {

    if (!headings || headings.length === 0) {
        return;
    }

    const delete_promises = headings.map(async (heading) => {

        try {

            const delete_result = await INDEXER_MODEL.delete_record(heading.uuid);

            if (delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model (delete_headings_from_index)] Unable to delete heading ${heading.uuid} from index`
                );
            }
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/model (delete_headings_from_index)] ${error.message}`,
                { heading_uuid: heading.uuid, stack: error.stack }
            );
        }
    });

    await Promise.allSettled(delete_promises);
};

/**
 * Suppresses exhibit
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object
 */
const suppress_exhibit = async (uuid) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Set all components to suppressed
        const suppress_results = await set_all_to_suppress(uuid);

        // Check for errors
        const has_errors = suppress_results.some(result => result === false);

        if (has_errors) {
            LOGGER.module().error('ERROR: [/exhibits/model (suppress_exhibit)] Unable to suppress exhibit components');
            return {
                status: false,
                message: 'Unable to suppress exhibit'
            };
        }

        // Get all exhibit records
        const records = await get_all_exhibit_records(uuid);

        // Delete exhibit from index
        const exhibit_delete_result = await INDEXER_MODEL.delete_record(uuid);

        if (exhibit_delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
            LOGGER.module().error('ERROR: [/exhibits/model (suppress_exhibit)] Unable to delete exhibit from index');
            return {
                status: false,
                message: 'Unable to suppress exhibit'
            };
        }

        // Delete all components from index in parallel
        await Promise.all([
            delete_items_from_index(records.items),
            delete_grids_from_index(records.grids),
            delete_timelines_from_index(records.timelines),
            delete_headings_from_index(records.headings)
        ]);

        return {
            status: true,
            message: 'Exhibit suppressed'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (suppress_exhibit)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Deletes exhibit preview instance
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object
 */
exports.delete_exhibit_preview = async (uuid) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        // Unset preview
        const unset_result = await exhibit_record_task.unset_preview(uuid);

        if (unset_result === false) {
            LOGGER.module().error('ERROR: [/exhibits/model (delete_exhibit_preview)] Unable to unset exhibit preview');
            return {
                status: false,
                message: 'Unable to unset exhibit preview'
            };
        }

        // Get all exhibit records
        const records = await get_all_exhibit_records(uuid);

        // Delete exhibit from index
        const exhibit_delete_result = await INDEXER_MODEL.delete_record(uuid);

        if (exhibit_delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
            LOGGER.module().error('ERROR: [/exhibits/model (delete_exhibit_preview)] Unable to delete exhibit preview from index');
            return {
                status: false,
                message: 'Unable to delete exhibit preview'
            };
        }

        // Delete all components from index in parallel
        await Promise.all([
            delete_items_from_index(records.items),
            delete_grids_from_index(records.grids),
            delete_timelines_from_index(records.timelines),
            delete_headings_from_index(records.headings)
        ]);

        return {
            status: true,
            message: 'Exhibit preview deleted'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (delete_exhibit_preview)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return {
            status: false,
            message: error.message
        };
    }
};

/**
 * Checks if there is an existing exhibit preview instance
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<boolean>} True if preview exists
 */
exports.check_preview = async (uuid) => {

    try {

        if (!uuid || typeof uuid !== 'string') {
            LOGGER.module().error('ERROR: [/exhibits/model (check_preview)] Invalid UUID provided');
            return false;
        }

        const record = await INDEXER_MODEL.get_indexed_record(uuid);
        return record && record.data && record.data.found === true;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (check_preview)] ${error.message}`, {
            uuid,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Updates exhibit order
 * @deprecated
 * @param {Array} data - Array of order data
 * @returns {Promise<boolean>} Success status
 */
exports.reorder_exhibits = async (data) => {

    try {

        if (!Array.isArray(data) || data.length === 0) {
            LOGGER.module().error('ERROR: [/exhibits/model (reorder_exhibits)] Invalid data format');
            return false;
        }

        const update_promises = data.map(item =>
            exhibit_record_task.reorder_exhibits(item.type, item.order)
        );

        const results = await Promise.allSettled(update_promises);

        // Check if any updates failed
        const has_failures = results.some(result =>
            result.status === 'rejected' || result.value === false
        );

        return !has_failures;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (reorder_exhibits)] ${error.message}`, {
            stack: error.stack
        });
        return false;
    }
};

/**
 * Unlocks exhibit record for editing
 * @param {string} uid - User ID
 * @param {string} uuid - Exhibit UUID
 * @param {object} options - {force: true/false}
 * @returns {Promise<*>} Unlock result
 */
exports.unlock_exhibit_record = async (uid, uuid, options) => {

    try {

        if (!uid || !uuid || typeof uid !== 'string' || typeof uuid !== 'string') {
            LOGGER.module().error('ERROR: [/exhibits/model (unlock_exhibit_record)] Invalid parameters');
            return false;
        }

        return await helper_task.unlock_record(uid, uuid, DB, TABLES.exhibit_records, options);

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (unlock_exhibit_record)] ${error.message}`, {
            uid,
            uuid,
            stack: error.stack
        });
        return false;
    }
};

exports.publish_exhibit = publish_exhibit;
exports.suppress_exhibit = suppress_exhibit;

