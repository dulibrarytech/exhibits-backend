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
const EXHIBITS_CREATE_RECORD_SCHEMA = require('../exhibits/schemas/exhibit_create_record_schema')();
const EXHIBITS_UPDATE_RECORD_SCHEMA = require('../exhibits/schemas/exhibit_update_record_schema')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('./tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('./tasks/exhibit_heading_record_tasks');
const EXHIBIT_GRID_RECORD_TASKS = require('./tasks/exhibit_grid_record_tasks');
const EXHIBIT_TIMELINE_RECORD_TASKS = require('./tasks/exhibit_timeline_record_tasks');
const EXHIBIT_MEDIA_LIBRARY_TASKS = require('./tasks/exhibit_media_library_tasks');
const HELPER = require('../libs/helper');
const VALIDATOR = require('../libs/validate');
const INDEXER_MODEL = require('../indexer/model');
const ITEMS_MODEL = require('../exhibits/items_model');
const GRIDS_MODEL = require('../exhibits/grid_model');
const TIMELINES_MODEL = require('../exhibits/timelines_model');
const LOGGER = require('../libs/log4');
const { validate_string_param } = require('../exhibits/exhibits_helper');
const { build_response, validate_input, prepare_styles } = require('../exhibits/common_helper');

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
const exhibit_media_library_task = new EXHIBIT_MEDIA_LIBRARY_TASKS(DB, TABLES);

// build_response, validate_input, prepare_styles imported from common_helper

/**
 * Creates exhibit record
 * @param {Object} data - Exhibit data
 * @returns {Promise<Object>} Response object
 */
exports.create_exhibit_record = async (data) => {

    try {
        // Generate UUID
        data.uuid = helper_task.create_uuid();

        // Extract media library UUIDs before validation (not columns in exhibit table)
        const hero_image_media_uuid = data.hero_image_media_uuid || null;
        const thumbnail_media_uuid = data.thumbnail_media_uuid || null;
        delete data.hero_image_media_uuid;
        delete data.thumbnail_media_uuid;

        // Validate input
        const validation_result = validate_input(data, validate_create_task, 'exhibits_model (create_exhibit_record)');

        if (validation_result !== true) {
            const error_path = validation_result[0].dataPath || 'unknown';
            const error_msg = validation_result[0].message || 'Validation failed';
            LOGGER.module().error(`ERROR: [/exhibits/model (create_exhibit_record)] ${error_path} ${error_msg}`);

            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

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

        // Create media library bindings for any selected media assets
        const created_by = data.created_by || null;

        if (hero_image_media_uuid) {
            try {
                await exhibit_media_library_task.bind_media(data.uuid, hero_image_media_uuid, 'hero_image', created_by);
            } catch (bind_error) {
                LOGGER.module().error(`ERROR: [/exhibits/model (create_exhibit_record)] Failed to bind hero_image: ${bind_error.message}`);
            }
        }

        if (thumbnail_media_uuid) {
            try {
                await exhibit_media_library_task.bind_media(data.uuid, thumbnail_media_uuid, 'thumbnail', created_by);
            } catch (bind_error) {
                LOGGER.module().error(`ERROR: [/exhibits/model (create_exhibit_record)] Failed to bind thumbnail: ${bind_error.message}`);
            }
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

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                uuid_check.error_message
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

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                uuid_check.error_message
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

        const uid_check = validate_string_param(uid, 'UID');
        const uuid_check = validate_string_param(uuid, 'UUID');

        if (!uid_check.valid || !uuid_check.valid) {
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

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                uuid_check.error_message
            );
        }

        // Extract media library UUIDs before validation (not columns in exhibit table)
        const hero_image_media_uuid = data.hero_image_media_uuid || null;
        const thumbnail_media_uuid = data.thumbnail_media_uuid || null;
        delete data.hero_image_media_uuid;
        delete data.thumbnail_media_uuid;

        // Validate input
        const validation_result = validate_input(data, validate_update_task, 'exhibits_model (update_exhibit_record)');

        if (validation_result !== true) {
            const error_msg = validation_result[0].message || 'Validation failed';
            LOGGER.module().error(`ERROR: [/exhibits/model (update_exhibit_record)] ${error_msg}`);

            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                validation_result
            );
        }

        // Prepare styles only when the payload includes them (styles form).
        // The edit form no longer sends styles — omitting this field preserves
        // the existing styles value in the database.
        if (data.styles !== undefined) {
            data.styles = prepare_styles(data.styles);
        }

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

        // Create/update media library bindings for any selected media assets
        const updated_by = data.updated_by || null;

        if (hero_image_media_uuid) {
            try {
                await exhibit_media_library_task.bind_media(uuid, hero_image_media_uuid, 'hero_image', updated_by);
            } catch (bind_error) {
                LOGGER.module().error(`ERROR: [/exhibits/model (update_exhibit_record)] Failed to bind hero_image: ${bind_error.message}`);
            }
        }

        if (thumbnail_media_uuid) {
            try {
                await exhibit_media_library_task.bind_media(uuid, thumbnail_media_uuid, 'thumbnail', updated_by);
            } catch (bind_error) {
                LOGGER.module().error(`ERROR: [/exhibits/model (update_exhibit_record)] Failed to bind thumbnail: ${bind_error.message}`);
            }
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

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                uuid_check.error_message
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
 * Builds exhibit preview
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object
 */
exports.build_exhibit_preview = async (uuid) => {

    try {

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
            return {
                status: false,
                message: uuid_check.error_message
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

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
            return {
                status: false,
                message: uuid_check.error_message
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

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
            return {
                status: false,
                message: uuid_check.error_message
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

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
            return {
                status: false,
                message: uuid_check.error_message
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

        const uuid_check = validate_string_param(uuid, 'UUID');
        if (!uuid_check.valid) {
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

        const uid_check = validate_string_param(uid, 'UID');
        const uuid_check = validate_string_param(uuid, 'UUID');

        if (!uid_check.valid || !uuid_check.valid) {
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

// ==================== EXHIBIT MEDIA LIBRARY BINDINGS ====================

/**
 * Binds a media library asset to an exhibit in a given role
 * @param {string} exhibit_uuid - Exhibit UUID
 * @param {string} media_uuid - Media library asset UUID
 * @param {string} media_role - 'hero_image' | 'thumbnail'
 * @param {string} created_by - Username performing the action
 * @returns {Promise<Object>} Response object with binding data
 */
exports.bind_exhibit_media = async (exhibit_uuid, media_uuid, media_role, created_by) => {

    try {

        const exhibit_check = validate_string_param(exhibit_uuid, 'exhibit UUID');
        if (!exhibit_check.valid) {
            return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, exhibit_check.error_message);
        }

        const media_check = validate_string_param(media_uuid, 'media UUID');
        if (!media_check.valid) {
            return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, media_check.error_message);
        }

        const role_check = validate_string_param(media_role, 'media role');
        if (!role_check.valid) {
            return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, role_check.error_message);
        }

        const result = await exhibit_media_library_task.bind_media(
            exhibit_uuid,
            media_uuid,
            media_role,
            created_by
        );

        if (!result) {
            return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, 'Unable to bind media to exhibit');
        }

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Media bound to exhibit',
            result
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (bind_exhibit_media)] ${error.message}`, {
            exhibit_uuid,
            media_uuid,
            media_role,
            stack: error.stack
        });

        return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, `Unable to bind media: ${error.message}`);
    }
};

/**
 * Gets all active media library bindings for an exhibit
 * @param {string} exhibit_uuid - Exhibit UUID
 * @returns {Promise<Object>} Response object with bindings array
 */
exports.get_exhibit_media_bindings = async (exhibit_uuid) => {

    try {

        const uuid_check = validate_string_param(exhibit_uuid, 'exhibit UUID');
        if (!uuid_check.valid) {
            return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, uuid_check.error_message);
        }

        const bindings = await exhibit_media_library_task.get_exhibit_media_bindings(exhibit_uuid);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit media bindings',
            bindings
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (get_exhibit_media_bindings)] ${error.message}`, {
            exhibit_uuid,
            stack: error.stack
        });

        return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, error.message);
    }
};

/**
 * Removes (soft-deletes) a media binding from an exhibit by role
 * @param {string} exhibit_uuid - Exhibit UUID
 * @param {string} media_role - 'hero_image' | 'thumbnail'
 * @returns {Promise<Object>} Response object
 */
exports.unbind_exhibit_media = async (exhibit_uuid, media_role) => {

    try {

        const uuid_check = validate_string_param(exhibit_uuid, 'exhibit UUID');
        if (!uuid_check.valid) {
            return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, uuid_check.error_message);
        }

        const role_check = validate_string_param(media_role, 'media role');
        if (!role_check.valid) {
            return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, role_check.error_message);
        }

        const result = await exhibit_media_library_task.unbind_media(exhibit_uuid, media_role);

        if (result === true) {
            return build_response(CONSTANTS.STATUS_CODES.NO_CONTENT, 'Media binding removed');
        }

        return build_response(CONSTANTS.STATUS_CODES.OK, 'No active binding found for this role');

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/model (unbind_exhibit_media)] ${error.message}`, {
            exhibit_uuid,
            media_role,
            stack: error.stack
        });

        return build_response(CONSTANTS.STATUS_CODES.BAD_REQUEST, error.message);
    }
};
