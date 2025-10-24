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

// HTTP Status Code Constants
const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500
});

// Singleton Pattern Implementation
class SingletonManager {
    constructor() {
        if (SingletonManager.instance) {
            return SingletonManager.instance;
        }

        this.helper_instance = null;
        this.validator_create_instance = null;
        this.validator_update_instance = null;
        this.exhibit_tasks_instance = null;
        this.item_tasks_instance = null;
        this.heading_tasks_instance = null;
        this.grid_tasks_instance = null;
        this.timeline_tasks_instance = null;

        SingletonManager.instance = this;
    }

    get_helper() {
        if (!this.helper_instance) {
            this.helper_instance = new HELPER();
        }
        return this.helper_instance;
    }

    get_validator_create() {
        if (!this.validator_create_instance) {
            this.validator_create_instance = new VALIDATOR(EXHIBITS_CREATE_RECORD_SCHEMA);
        }
        return this.validator_create_instance;
    }

    get_validator_update() {
        if (!this.validator_update_instance) {
            this.validator_update_instance = new VALIDATOR(EXHIBITS_UPDATE_RECORD_SCHEMA);
        }
        return this.validator_update_instance;
    }

    get_exhibit_tasks() {
        if (!this.exhibit_tasks_instance) {
            this.exhibit_tasks_instance = new EXHIBIT_RECORD_TASKS(DB, TABLES);
        }
        return this.exhibit_tasks_instance;
    }

    get_item_tasks() {
        if (!this.item_tasks_instance) {
            this.item_tasks_instance = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
        }
        return this.item_tasks_instance;
    }

    get_heading_tasks() {
        if (!this.heading_tasks_instance) {
            this.heading_tasks_instance = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
        }
        return this.heading_tasks_instance;
    }

    get_grid_tasks() {
        if (!this.grid_tasks_instance) {
            this.grid_tasks_instance = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
        }
        return this.grid_tasks_instance;
    }

    get_timeline_tasks() {
        if (!this.timeline_tasks_instance) {
            this.timeline_tasks_instance = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
        }
        return this.timeline_tasks_instance;
    }

    // Method to reset all instances (useful for testing)
    reset_instances() {
        this.helper_instance = null;
        this.validator_create_instance = null;
        this.validator_update_instance = null;
        this.exhibit_tasks_instance = null;
        this.item_tasks_instance = null;
        this.heading_tasks_instance = null;
        this.grid_tasks_instance = null;
        this.timeline_tasks_instance = null;
    }
}

// Initialize Singleton Manager
const singleton_manager = new SingletonManager();

/**
 * Validates UUID format for security
 * @param {string} uuid - UUID to validate
 * @returns {boolean} - True if valid UUID format
 */
function is_valid_uuid(uuid) {
    const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof uuid === 'string' && uuid_regex.test(uuid);
}

/**
 * Standardized error response builder
 * @param {number} status - HTTP status code
 * @param {string|Array} message - Error message or validation errors
 * @param {*} data - Response data (defaults to empty array)
 * @returns {Object} - Standardized error response
 */
function build_error_response(status, message, data = []) {
    return {
        status,
        message,
        data
    };
}

/**
 * Standardized success response builder
 * @param {number} status - HTTP status code
 * @param {string} message - Success message
 * @param {*} data - Response data (defaults to empty array)
 * @returns {Object} - Standardized success response
 */
function build_success_response(status, message, data = []) {
    return {
        status,
        message,
        data
    };
}

/**
 * Processes media files (hero image and thumbnail) in parallel
 * @param {Object} data - Exhibit data containing media information
 * @param {string} uuid - Exhibit UUID
 * @param {string} storage_path - Storage path configuration
 * @returns {Promise<Object>} - Updated data with processed media paths
 */
async function process_media_files(data, uuid, storage_path) {

    const HELPER_TASK = singleton_manager.get_helper();
    const media_processing_tasks = [];

    if (data.hero_image && data.hero_image.length > 0) {
        media_processing_tasks.push(
            Promise.resolve(HELPER_TASK.process_uploaded_media(uuid, null, data.hero_image, storage_path))
                .then(result => { data.hero_image = result; })
        );
    }

    if (data.thumbnail && data.thumbnail.length > 0) {
        media_processing_tasks.push(
            Promise.resolve(HELPER_TASK.process_uploaded_media(uuid, null, data.thumbnail, storage_path))
                .then(result => { data.thumbnail = result; })
        );
    }

    await Promise.all(media_processing_tasks);
    return data;
}

/**
 * Deletes multiple records from index in parallel
 * @param {Array} records - Array of records to delete
 * @param {string} record_type - Type of record for logging
 * @returns {Promise<Array>} - Array of deletion results
 */
async function delete_records_from_index(records, record_type) {

    if (!Array.isArray(records) || records.length === 0) {
        return [];
    }

    const deletion_promises = records.map(async (record) => {

        try {
            const result = await INDEXER_MODEL.delete_record(record.uuid);
            if (result.status !== HTTP_STATUS.NO_CONTENT) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model] Unable to delete ${record_type} ${record.uuid} from index`
                );
                return { uuid: record.uuid, success: false };
            }
            return { uuid: record.uuid, success: true };
        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/exhibits/model] Exception deleting ${record_type} ${record.uuid}: ${error.message}`
            );
            return { uuid: record.uuid, success: false, error: error.message };
        }
    });

    return Promise.all(deletion_promises);
}

/**
 * Creates exhibit record
 * @param {Object} data - Exhibit data
 * @returns {Promise<Object>} - Response object with status and message
 */
exports.create_exhibit_record = async function (data) {

    try {
        // Input validation
        if (!data || typeof data !== 'object') {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid input data');
        }

        const HELPER_TASK = singleton_manager.get_helper();
        const VALIDATE_TASK = singleton_manager.get_validator_create();

        // Generate UUID
        data.uuid = HELPER_TASK.create_uuid();

        // Validate data
        const validation_result = VALIDATE_TASK.validate(data);

        if (validation_result !== true) {
            const error_path = validation_result[0]?.dataPath || 'unknown';
            const error_message = validation_result[0]?.message || 'Validation failed';

            LOGGER.module().error(
                `ERROR: [/exhibits/model (create_exhibit_record)] ${error_path} ${error_message}`
            );

            return build_error_response(HTTP_STATUS.BAD_REQUEST, validation_result);
        }

        // Create storage path
        HELPER_TASK.check_storage_path(data.uuid, STORAGE_CONFIG.storage_path);

        // Process media files in parallel
        await process_media_files(data, data.uuid, STORAGE_CONFIG.storage_path);

        // Handle styles
        if (!data.styles || (Array.isArray(data.styles) && data.styles.length === 0)) {
            data.styles = {};
        }
        data.styles = JSON.stringify(data.styles);

        // Get order
        data.order = await HELPER_TASK.order_exhibits(data.uuid, DB, TABLES);

        // Create record
        const CREATE_RECORD_TASK = singleton_manager.get_exhibit_tasks();
        const result = await CREATE_RECORD_TASK.create_exhibit_record(data);

        if (result === false) {
            return build_error_response(
                HTTP_STATUS.INTERNAL_SERVER_ERROR,
                'Unable to create exhibit record'
            );
        }

        return build_success_response(
            HTTP_STATUS.CREATED,
            'Exhibit record created',
            data.uuid
        );

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (create_exhibit_record)] ${error.message}`
        );
        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            `Unable to create record: ${error.message}`
        );
    }
};

/**
 * Gets all exhibit records
 * @returns {Promise<Object>} - Response object with exhibit records
 */
exports.get_exhibit_records = async function () {

    try {
        const TASK = singleton_manager.get_exhibit_tasks();
        const records = await TASK.get_exhibit_records();

        return build_success_response(HTTP_STATUS.OK, 'Exhibit records', records);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (get_exhibit_records)] ${error.message}`
        );
        return build_error_response(HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message);
    }
};

/**
 * Gets exhibit title by UUID
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} - Response object with exhibit title
 */
exports.get_exhibit_title = async function (uuid) {

    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid UUID format');
        }

        const TASK = singleton_manager.get_exhibit_tasks();
        const title = await TASK.get_exhibit_title(uuid);

        return build_success_response(HTTP_STATUS.OK, 'Exhibit title', title);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (get_exhibit_title)] ${error.message}`
        );
        return build_error_response(HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message);
    }
};

/**
 * Gets exhibit record by UUID
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} - Response object with exhibit record
 */
exports.get_exhibit_record = async function (uuid) {

    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid UUID format');
        }

        const TASK = singleton_manager.get_exhibit_tasks();
        const record = await TASK.get_exhibit_record(uuid);

        return build_success_response(HTTP_STATUS.OK, 'Exhibit record', record);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (get_exhibit_record)] ${error.message}`
        );
        return build_error_response(HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message);
    }
};

/**
 * Gets exhibit edit record by UUID
 * @param {string} uid - User ID
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} - Response object with exhibit edit record
 */
exports.get_exhibit_edit_record = async function (uid, uuid) {

    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid exhibit UUID format');
        }

        const TASK = singleton_manager.get_exhibit_tasks();
        const record = await TASK.get_exhibit_edit_record(uid, uuid);

        return build_success_response(HTTP_STATUS.OK, 'Exhibit edit record', record);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (get_exhibit_edit_record)] ${error.message}`
        );
        return build_error_response(HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message);
    }
};

/**
 * Updates exhibit record
 * @param {string} uuid - Exhibit UUID
 * @param {Object} data - Updated exhibit data
 * @returns {Promise<Object>} - Response object with update status
 */
exports.update_exhibit_record = async function (uuid, data) {

    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid UUID format');
        }

        // Input validation
        if (!data || typeof data !== 'object') {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid input data');
        }

        const HELPER_TASK = singleton_manager.get_helper();
        const VALIDATE_TASK = singleton_manager.get_validator_update();

        // Validate data
        const validation_result = VALIDATE_TASK.validate(data);
        if (validation_result !== true) {
            const error_message = validation_result[0]?.message || 'Validation failed';

            LOGGER.module().error(
                `ERROR: [/exhibits/model (update_exhibit_record)] ${error_message}`
            );

            return build_error_response(HTTP_STATUS.BAD_REQUEST, validation_result);
        }

        const is_published = data.is_published;

        // Create storage path
        HELPER_TASK.check_storage_path(uuid, STORAGE_CONFIG.storage_path);

        // Process media files conditionally
        if (data.hero_image && data.hero_image.length > 0 && data.hero_image !== data.hero_image_prev) {
            data.hero_image = HELPER_TASK.process_uploaded_media(
                uuid,
                null,
                data.hero_image,
                STORAGE_CONFIG.storage_path
            );
        }

        if (data.thumbnail && data.thumbnail.length > 0 && data.thumbnail !== data.thumbnail_prev) {
            data.thumbnail = HELPER_TASK.process_uploaded_media(
                uuid,
                null,
                data.thumbnail,
                STORAGE_CONFIG.storage_path
            );
        }

        // Clean up temporary fields
        delete data.hero_image_prev;
        delete data.thumbnail_prev;
        delete data.is_published;

        // Handle styles
        if (!data.styles || (Array.isArray(data.styles) && data.styles.length === 0)) {
            data.styles = {};
        }

        data.styles = JSON.stringify(data.styles);

        // Update record
        const UPDATE_RECORD_TASK = singleton_manager.get_exhibit_tasks();
        const result = await UPDATE_RECORD_TASK.update_exhibit_record(uuid, data);

        if (result !== true) {
            return build_error_response(
                HTTP_STATUS.INTERNAL_SERVER_ERROR,
                'Unable to update exhibit record'
            );
        }

        // Handle publishing with improved error handling
        if (is_published === 1) {
            try {
                const suppress_result = await suppress_exhibit(uuid);

                if (suppress_result && suppress_result.status === HTTP_STATUS.OK) {
                    // Use setTimeout with proper Promise handling
                    setTimeout(async () => {
                        try {
                            const publish_result = await publish_exhibit(uuid);

                            if (!publish_result || publish_result.status !== HTTP_STATUS.OK) {
                                LOGGER.module().error(
                                    `ERROR: [/exhibits/model (update_exhibit_record)] Failed to publish exhibit ${uuid}`
                                );
                            }
                        } catch (publish_error) {
                            LOGGER.module().error(
                                `ERROR: [/exhibits/model (update_exhibit_record)] Exception during publish: ${publish_error.message}`
                            );
                        }
                    }, 3000);
                }
            } catch (suppress_error) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/model (update_exhibit_record)] Exception during suppress: ${suppress_error.message}`
                );
            }
        }

        return build_success_response(HTTP_STATUS.OK, 'Exhibit record updated');

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (update_exhibit_record)] ${error.message}`
        );
        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            `Unable to update record: ${error.message}`
        );
    }
};

/**
 * Deletes exhibit record
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} - Response object with deletion status
 */
exports.delete_exhibit_record = async function (uuid) {

    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid UUID format');
        }

        const EXHIBIT_TASKS = singleton_manager.get_exhibit_tasks();
        const ITEM_TASKS = singleton_manager.get_item_tasks();
        const HEADING_TASKS = singleton_manager.get_heading_tasks();
        const GRID_TASKS = singleton_manager.get_grid_tasks();
        const TIMELINE_TASKS = singleton_manager.get_timeline_tasks();

        // Delete all components in parallel where possible
        const [
            is_exhibit_deleted,
            is_item_deleted,
            is_heading_deleted,
            is_grid_deleted,
            is_timeline_deleted
        ] = await Promise.all([
            EXHIBIT_TASKS.delete_exhibit(uuid),
            ITEM_TASKS.delete_exhibit_items(uuid),
            HEADING_TASKS.delete_exhibit_headings(uuid),
            GRID_TASKS.delete_exhibit_grids(uuid),
            TIMELINE_TASKS.delete_exhibit_timelines(uuid)
        ]);

        const errors = [
            is_exhibit_deleted,
            is_item_deleted,
            is_heading_deleted,
            is_grid_deleted,
            is_timeline_deleted
        ].filter(result => result === false);

        if (errors.length > 0) {
            LOGGER.module().error(
                `ERROR: [/exhibits/model (delete_exhibit_record)] ${errors.length} component(s) failed to delete`
            );
            return build_error_response(
                HTTP_STATUS.INTERNAL_SERVER_ERROR,
                'Failed to delete one or more exhibit components'
            );
        }

        // Fetch all related records in parallel
        const [headings, items, grids, timelines] = await Promise.all([
            HEADING_TASKS.get_heading_records(uuid),
            ITEM_TASKS.get_item_records(uuid),
            GRID_TASKS.get_grid_records(uuid),
            TIMELINE_TASKS.get_timeline_records(uuid)
        ]);

        // Delete from index
        const exhibit_delete_result = await INDEXER_MODEL.delete_record(uuid);

        if (exhibit_delete_result.status === HTTP_STATUS.NO_CONTENT) {
            // Delete all related records from index in parallel
            await Promise.all([
                delete_records_from_index(items, 'item'),
                delete_records_from_index(headings, 'heading'),
                delete_records_from_index(grids, 'grid').then(async () => {
                    // Suppress grid items for each grid
                    await Promise.all(
                        grids.map(grid => GRID_TASKS.set_to_suppressed_grid_items(grid.uuid))
                    );
                }),
                delete_records_from_index(timelines, 'timeline').then(async () => {
                    // Suppress timeline items for each timeline
                    await Promise.all(
                        timelines.map(timeline => TIMELINE_TASKS.set_to_suppressed_timeline_items(timeline.uuid))
                    );
                })
            ]);

            return build_success_response(HTTP_STATUS.OK, 'Exhibit record deleted');
        }

        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            'Unable to delete exhibit from index'
        );

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (delete_exhibit_record)] ${error.message}`
        );
        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            `Unable to delete record: ${error.message}`
        );
    }
};

/**
 * Publishes exhibit
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} - Response object with publish status
 */
async function publish_exhibit(uuid) {

    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid UUID format');
        }

        const EXHIBIT_TASKS = singleton_manager.get_exhibit_tasks();
        const ITEM_TASKS = singleton_manager.get_item_tasks();
        const HEADING_TASKS = singleton_manager.get_heading_tasks();
        const GRID_TASKS = singleton_manager.get_grid_tasks();
        const TIMELINE_TASKS = singleton_manager.get_timeline_tasks();

        // Set to published in parallel
        const [
            is_exhibit_published,
            is_item_published,
            is_heading_published,
            is_grid_published,
            is_timeline_published
        ] = await Promise.all([
            EXHIBIT_TASKS.set_to_publish(uuid),
            ITEM_TASKS.set_to_publish(uuid),
            HEADING_TASKS.set_to_publish(uuid),
            GRID_TASKS.set_to_publish(uuid),
            TIMELINE_TASKS.set_to_publish(uuid)
        ]);

        const errors = [
            is_exhibit_published,
            is_item_published,
            is_heading_published,
            is_grid_published,
            is_timeline_published
        ].filter(result => result === false);

        if (errors.length > 0) {
            LOGGER.module().error(
                'ERROR: [/exhibits/model (publish_exhibit)] Unable to publish exhibit'
            );
            return build_error_response(
                HTTP_STATUS.INTERNAL_SERVER_ERROR,
                'Unable to publish exhibit'
            );
        }

        // Get exhibit data
        const exhibit = await EXHIBIT_TASKS.get_exhibit_record(uuid);

        // Index exhibit
        const exhibit_index_result = await INDEXER_MODEL.create_or_update_exhibit_record(exhibit);

        if (exhibit_index_result.status !== HTTP_STATUS.CREATED && exhibit_index_result.status !== HTTP_STATUS.OK) {
            LOGGER.module().error(
                `ERROR: [/exhibits/model (publish_exhibit)] Unable to index exhibit ${uuid}`
            );
            return build_error_response(
                HTTP_STATUS.INTERNAL_SERVER_ERROR,
                'Unable to index exhibit'
            );
        }

        // Fetch all related records in parallel
        const [headings, items, grids, timelines] = await Promise.all([
            HEADING_TASKS.get_heading_records(uuid),
            ITEM_TASKS.get_item_records(uuid),
            GRID_TASKS.get_grid_records(uuid),
            TIMELINE_TASKS.get_timeline_records(uuid)
        ]);

        // Index all related records in parallel
        const indexing_promises = [];

        if (items.length > 0) {
            indexing_promises.push(
                ...items.map(item => ITEMS_MODEL.publish_item_record(item.uuid))
            );
        }

        if (grids.length > 0) {
            indexing_promises.push(
                ...grids.map(grid => GRIDS_MODEL.publish_grid_record(grid.uuid))
            );
        }

        if (timelines.length > 0) {
            indexing_promises.push(
                ...timelines.map(timeline => TIMELINES_MODEL.publish_timeline_record(timeline.uuid))
            );
        }

        if (headings.length > 0) {
            indexing_promises.push(
                ...headings.map(async (heading) => {
                    try {
                        const result = await INDEXER_MODEL.create_or_update_heading_record(heading);
                        if (result.status !== HTTP_STATUS.CREATED && result.status !== HTTP_STATUS.OK) {
                            LOGGER.module().error(
                                `ERROR: [/exhibits/model (publish_exhibit)] Unable to index heading ${heading.uuid}`
                            );
                        }
                    } catch (error) {
                        LOGGER.module().error(
                            `ERROR: [/exhibits/model (publish_exhibit)] Exception indexing heading: ${error.message}`
                        );
                    }
                })
            );
        }

        await Promise.all(indexing_promises);

        return build_success_response(HTTP_STATUS.OK, 'Exhibit published');

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (publish_exhibit)] ${error.message}`
        );
        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
}

/**
 * Suppresses exhibit
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} - Response object with suppress status
 */
async function suppress_exhibit(uuid) {
    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid UUID format');
        }

        const EXHIBIT_TASKS = singleton_manager.get_exhibit_tasks();
        const ITEM_TASKS = singleton_manager.get_item_tasks();
        const HEADING_TASKS = singleton_manager.get_heading_tasks();
        const GRID_TASKS = singleton_manager.get_grid_tasks();
        const TIMELINE_TASKS = singleton_manager.get_timeline_tasks();

        // Set to suppressed in parallel
        const [
            is_exhibit_suppressed,
            is_item_suppressed,
            is_heading_suppressed,
            is_grid_suppressed,
            is_timeline_suppressed
        ] = await Promise.all([
            EXHIBIT_TASKS.set_to_suppress(uuid),
            ITEM_TASKS.set_to_suppress(uuid),
            HEADING_TASKS.set_to_suppress(uuid),
            GRID_TASKS.set_to_suppress(uuid),
            TIMELINE_TASKS.set_to_suppress(uuid)
        ]);

        const errors = [
            is_exhibit_suppressed,
            is_item_suppressed,
            is_heading_suppressed,
            is_grid_suppressed,
            is_timeline_suppressed
        ].filter(result => result === false);

        if (errors.length > 0) {
            LOGGER.module().error(
                'ERROR: [/exhibits/model (suppress_exhibit)] Unable to suppress exhibit'
            );
            return build_error_response(
                HTTP_STATUS.INTERNAL_SERVER_ERROR,
                'Unable to suppress exhibit'
            );
        }

        // Fetch all related records in parallel
        const [headings, items, grids, timelines] = await Promise.all([
            HEADING_TASKS.get_heading_records(uuid),
            ITEM_TASKS.get_item_records(uuid),
            GRID_TASKS.get_grid_records(uuid),
            TIMELINE_TASKS.get_timeline_records(uuid)
        ]);

        // Delete exhibit from index
        const exhibit_delete_result = await INDEXER_MODEL.delete_record(uuid);

        if (exhibit_delete_result.status === HTTP_STATUS.NO_CONTENT) {
            // Delete all related records from index in parallel
            await Promise.all([
                delete_records_from_index(items, 'item'),
                delete_records_from_index(headings, 'heading'),
                delete_records_from_index(grids, 'grid').then(async () => {
                    await Promise.all(
                        grids.map(grid => GRID_TASKS.set_to_suppressed_grid_items(grid.uuid))
                    );
                }),
                delete_records_from_index(timelines, 'timeline').then(async () => {
                    await Promise.all(
                        timelines.map(timeline => TIMELINE_TASKS.set_to_suppressed_timeline_items(timeline.uuid))
                    );
                })
            ]);

            return build_success_response(HTTP_STATUS.OK, 'Exhibit suppressed');
        }

        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            'Unable to suppress exhibit'
        );

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (suppress_exhibit)] ${error.message}`
        );
        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
}

/**
 * Deletes exhibit preview instance
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<Object>} - Response object with deletion status
 */
exports.delete_exhibit_preview = async function (uuid) {

    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            return build_error_response(HTTP_STATUS.BAD_REQUEST, 'Invalid UUID format');
        }

        const EXHIBIT_TASKS = singleton_manager.get_exhibit_tasks();
        const ITEM_TASKS = singleton_manager.get_item_tasks();
        const HEADING_TASKS = singleton_manager.get_heading_tasks();
        const GRID_TASKS = singleton_manager.get_grid_tasks();
        const TIMELINE_TASKS = singleton_manager.get_timeline_tasks();

        const is_exhibit_preview_unset = await EXHIBIT_TASKS.unset_preview(uuid);

        if (is_exhibit_preview_unset === false) {
            LOGGER.module().error(
                'ERROR: [/exhibits/model (delete_exhibit_preview)] Unable to unset exhibit preview'
            );
            return build_error_response(
                HTTP_STATUS.INTERNAL_SERVER_ERROR,
                'Unable to unset exhibit preview'
            );
        }

        // Fetch all related records in parallel
        const [headings, items, grids, timelines] = await Promise.all([
            HEADING_TASKS.get_heading_records(uuid),
            ITEM_TASKS.get_item_records(uuid),
            GRID_TASKS.get_grid_records(uuid),
            TIMELINE_TASKS.get_timeline_records(uuid)
        ]);

        // Delete exhibit from index
        const exhibit_delete_result = await INDEXER_MODEL.delete_record(uuid);

        if (exhibit_delete_result.status === HTTP_STATUS.NO_CONTENT) {
            // Delete all related records from index in parallel
            await Promise.all([
                delete_records_from_index(items, 'item'),
                delete_records_from_index(headings, 'heading'),
                delete_records_from_index(grids, 'grid').then(async () => {
                    await Promise.all(
                        grids.map(grid => GRID_TASKS.set_to_suppressed_grid_items(grid.uuid))
                    );
                }),
                delete_records_from_index(timelines, 'timeline').then(async () => {
                    await Promise.all(
                        timelines.map(timeline => TIMELINE_TASKS.set_to_suppressed_timeline_items(timeline.uuid))
                    );
                })
            ]);

            return build_success_response(HTTP_STATUS.OK, 'Exhibit preview unset');
        }

        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            'Unable to unset exhibit preview'
        );

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (delete_exhibit_preview)] ${error.message}`
        );
        return build_error_response(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
};

/**
 * Checks if there is an existing exhibit preview instance
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<boolean>} - True if preview exists
 */
exports.check_preview = async function (uuid) {
    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            LOGGER.module().error(
                'ERROR: [/exhibits/model (check_preview)] Invalid UUID format'
            );
            return false;
        }

        const record = await INDEXER_MODEL.get_indexed_record(uuid);
        return record?.data?.found || false;

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (check_preview)] ${error.message}`
        );
        return false;
    }
};

/**
 * Updates exhibit order
 * @param {Array} data - Array of exhibit order data
 * @returns {Promise<boolean>} - True if successful
 * @deprecated This function is marked for deprecation
 */
exports.reorder_exhibits = async function (data) {
    try {
        // Input validation
        if (!Array.isArray(data) || data.length === 0) {
            LOGGER.module().error(
                'ERROR: [/exhibits/model (reorder_exhibits)] Invalid input data'
            );
            return false;
        }

        const TASKS = singleton_manager.get_exhibit_tasks();

        // Execute reorder operations in parallel
        const reorder_promises = data.map(item =>
            TASKS.reorder_exhibits(item.type, item.order)
        );

        const results = await Promise.all(reorder_promises);
        const has_errors = results.some(result => result === false);

        if (has_errors) {
            LOGGER.module().error(
                'ERROR: [/exhibits/model (reorder_exhibits)] Some reorder operations failed'
            );
            return false;
        }

        return true;

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (reorder_exhibits)] ${error.message}`
        );
        return false;
    }
};

/**
 * Unlocks exhibit record
 * @param {string} uid - User ID
 * @param {string} uuid - Exhibit UUID
 * @returns {Promise<*>} - Result from unlock operation
 */
exports.unlock_exhibit_record = async function (uid, uuid) {
    try {
        // Security: Validate UUID format
        if (!is_valid_uuid(uuid)) {
            LOGGER.module().error(
                'ERROR: [/exhibits/model (unlock_exhibit_record)] Invalid UUID format'
            );
            return false;
        }

        const HELPER_TASK = singleton_manager.get_helper();
        return await HELPER_TASK.unlock_record(uid, uuid, DB, TABLES.exhibit_records);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/model (unlock_exhibit_record)] ${error.message}`
        );
        return false;
    }
};

// Export internal functions for external use
exports.publish_exhibit = publish_exhibit;
exports.suppress_exhibit = suppress_exhibit;

// Export singleton manager for testing purposes
exports._singleton_manager = singleton_manager;