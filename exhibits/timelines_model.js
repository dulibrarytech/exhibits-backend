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

const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const EXHIBIT_TIMELINE_RECORD_TASKS = require('./tasks/exhibit_timeline_record_tasks');
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
    PUBLICATION_STATUS: {
        PUBLISHED: 1,
        UNPUBLISHED: 0
    }
};

// Initialize task instances
const helper_task = new HELPER();
const timeline_record_task = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
const exhibit_tasks = new EXHIBIT_RECORD_TASKS(DB, TABLES);

/**
 * Creates timeline record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {Object} data - Timeline data
 * @returns {Promise<Object>} Response object
 */
const RTE_VOCABULARY = require('../libs/rte_vocabulary');

/*
 * Field → rich-text profile maps enforced on create/update. Mirror the
 * dashboard editor configuration (public/app/utils/rte.module.js).
 */
const TIMELINE_RTE_PROFILES = {
    text: 'full',
    internal_name: 'plain'
};

const TIMELINE_ITEM_RTE_PROFILES = {
    title: 'reduced',
    text: 'full',
    description: 'full',
    caption: 'full',
    alt_text: 'plain',
    date: 'plain'
};

exports.create_timeline_record = async (is_member_of_exhibit, data) => {

    RTE_VOCABULARY.apply(data, TIMELINE_RTE_PROFILES);

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

        const internal_name_error = validate_internal_name(data, true, 'Timeline');

        if (internal_name_error !== null) {
            return internal_name_error;
        }

        // The former ajv create schema only re-checked is_member_of_exhibit,
        // injected above from the already-validated route param — provably
        // unreachable as a guard — so it was removed.

        // Get order
        data.order = await helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES);

        // Create record
        const result = await timeline_record_task.create_timeline_record(data);

        if (result === false) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (create_timeline_record)] Database operation failed');
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to create timeline record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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

    RTE_VOCABULARY.apply(data, TIMELINE_RTE_PROFILES);

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

        // Omitted internal_name leaves the stored value untouched (the
        // publish/suppress flows send partial updates); a supplied value
        // must be a non-empty string.
        const internal_name_error = validate_internal_name(data, false, 'Timeline');

        if (internal_name_error !== null) {
            return internal_name_error;
        }

        // The former ajv update schema only re-checked the two identity fields
        // injected above from already-validated route params — provably
        // unreachable as a guard — so it was removed. Field-level protection
        // lives in the task layer (UPDATABLE_FIELDS whitelist).

        // Update record
        const result = await timeline_record_task.update_timeline_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to update timeline record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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

    RTE_VOCABULARY.apply(data, TIMELINE_ITEM_RTE_PROFILES);

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

        // The former ajv create schema only re-checked the two identity fields
        // injected above from already-validated route params — provably
        // unreachable as a guard — so it was removed.

        // Prepare styles and get order
        data.styles = prepare_styles(data.styles);
        data.order = await helper_task.order_timeline_items(data.is_member_of_timeline, DB, TABLES);

        // Create record
        const result = await timeline_record_task.create_timeline_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to create timeline item record'
            );
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/items_model - Exhibit timestamp updated successfully.');
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
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

        if (!is_valid_user_id(uid) ||
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
 * Gets timeline item details record (read-only, no locking)
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_timeline - Timeline UUID
 * @param {string} item_id - Timeline item UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_timeline_item_details_record = async (is_member_of_exhibit, is_member_of_timeline, item_id) => {

    try {

        if (!is_valid_uuid(is_member_of_exhibit) ||
            !is_valid_uuid(is_member_of_timeline) ||
            !is_valid_uuid(item_id)) {
            return build_response(
                CONSTANTS.STATUS_CODES.BAD_REQUEST,
                'Invalid UUID provided'
            );
        }

        const timeline_item = await timeline_record_task.get_timeline_item_details_record(
            is_member_of_exhibit,
            is_member_of_timeline,
            item_id
        );

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Exhibit timeline item details record',
            timeline_item
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (get_timeline_item_details_record)] ${error.message}`, {
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

    RTE_VOCABULARY.apply(data, TIMELINE_ITEM_RTE_PROFILES);

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

// Field-level validation happens in the task layer (update_timeline_item_record:
        // UPDATABLE_FIELDS whitelist via _sanitize_data + _validate_uuids +
        // exists/lock checks). The former ajv update schema only re-checked the
        // three identity fields injected above from already-validated route
        // params — provably unreachable as a guard — so it was removed
        // (same rationale as the standard-item schema removal).

        /*
         * `is_published` is a publish-state flag, not an editable field: it is
         * pulled out before the update so the DB write cannot flip it, and used
         * afterwards to decide whether the live index copy must be refreshed
         * (same contract as update_grid_item_record).
         */
        const is_published = data.is_published;
        delete data.is_published;

        /*
         * `order` is deliberately NOT recomputed here. The former call to
         * order_exhibit_items(is_member_of_timeline) passed a timeline uuid to
         * the exhibit-scoped helper and moved the item to the end of the
         * timeline on every edit. Order is set on create and by reorder.
         */
        data.styles = prepare_styles(data.styles);

        // Update record
        const result = await timeline_record_task.update_timeline_item_record(data);

        if (result === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to update timeline item record'
            );
        }

        if (is_published === 'true' || is_published === true || is_published === 1) {
            setImmediate(() => handle_timeline_item_republish(is_member_of_exhibit, is_member_of_timeline, item_id));
        }

        const is_updated = await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

        if (is_updated === true) {
            LOGGER.module().info('INFO: [/exhibits/timelines_model - Exhibit timestamp updated successfully.');
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
            CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
            `Unable to update timeline item record: ${error.message}`
        );
    }
};

/**
 * Handles post-update republishing for timeline items
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} is_member_of_timeline - Timeline UUID
 * @param {string} item_id - Timeline item UUID
 * @returns {Promise<void>}
 */
const handle_timeline_item_republish = async (is_member_of_exhibit, is_member_of_timeline, item_id) => {

    try {

        /*
         * Re-index just this timeline item in place. The nested-child indexer
         * upserts by id, so the fresh copy replaces the stale one in the
         * timeline doc's items[] without a delete. Coalesced per item so a
         * burst of edits collapses to one re-index (mirrors
         * handle_grid_item_republish).
         */
        REINDEX_COALESCER.schedule_reindex(`timeline_item:${item_id}`, async () => {
            const publish_result = await exports.publish_timeline_item_record(is_member_of_exhibit, is_member_of_timeline, item_id);

            if (publish_result && publish_result.status === true) {
                LOGGER.module().info('INFO: [/exhibits/timelines_model (handle_timeline_item_republish)] Timeline item re-indexed after edit.');
            } else {
                LOGGER.module().error('ERROR: [/exhibits/timelines_model (handle_timeline_item_republish)] Failed to re-index timeline item');
            }
        });
    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (handle_timeline_item_republish)] ${error.message}`, {
            is_member_of_exhibit,
            is_member_of_timeline,
            item_id,
            stack: error.stack
        });
    }
};

/**
 * Deletes timeline item record
 * @param {string} is_member_of_exhibit - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @param {string} timeline_item_id - Timeline item UUID
 * @returns {Promise<Object>} Response object
 */
/*
 * Drops one item from its timeline's PUBLIC index doc (the timeline doc
 * embeds its items). No-op when the timeline is not indexed. Used on item
 * delete so a soft-deleted item does not stay visible until the next full
 * re-index (code review 2026-09-02, M4). Upserts in place — no delete gap.
 * @returns {Promise<boolean>} false only when the doc exists and the upsert failed
 */
const remove_timeline_item_from_index = async (timeline_id, timeline_item_id) => {
    const indexed = await INDEXER_MODEL.get_indexed_record(timeline_id);

    if (!indexed || indexed.status !== CONSTANTS.STATUS_CODES.OK || !indexed.data || !indexed.data.source) {
        return true;
    }

    const source = indexed.data.source;
    const items = Array.isArray(source.items) ? source.items : [];

    if (!items.some(item => item.uuid === timeline_item_id)) {
        return true;
    }

    source.items = items.filter(item => item.uuid !== timeline_item_id);
    return await INDEXER_MODEL.index_record(source) === true;
};

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

        /* Index BEFORE the row — see grid_model.delete_grid_item_record (M4). */
        const index_updated = await remove_timeline_item_from_index(timeline_id, timeline_item_id);

        if (index_updated === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.INTERNAL_SERVER_ERROR,
                'Unable to remove the timeline item from the public index; item not deleted'
            );
        }

        const result = await timeline_record_task.delete_timeline_item_record(
            is_member_of_exhibit,
            timeline_id,
            timeline_item_id
        );

        await exhibit_tasks.update_exhibit_timestamp(is_member_of_exhibit);

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
        /*
         * The timeline must belong to THIS exhibit before it is flagged or indexed.
         * (code review 2026-09-02, H3)
         */
        const member_timeline_record = await timeline_record_task.get_timeline_record(exhibit_id, timeline_id);

        if (!member_timeline_record) {
            return {
                status: false,
                message: 'Timeline not found in exhibit'
            };
        }

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
        /*
         * The timeline must belong to THIS exhibit before its index doc is removed.
         * (code review 2026-09-02, H3)
         */
        const member_timeline_record = await timeline_record_task.get_timeline_record(exhibit_id, item_id);

        if (!member_timeline_record) {
            return {
                status: false,
                message: 'Timeline not found in exhibit'
            };
        }

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
        /*
         * Suppress THIS timeline's items only (code review 2026-09-02, H8 —
         * same shape as the grid bug: a one-argument task called with two
         * returned every timeline, and every timeline's items were flagged).
         */
        await timeline_record_task.set_to_suppressed_timeline_items(item_id);

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
 * @returns {Promise<{status: boolean, message: string}>} Result object
 *   (same contract as suppress_grid_item_record)
 */
exports.suppress_timeline_item_record = async (exhibit_id, timeline_id, timeline_item_id) => {

    try {

        if (!is_valid_uuid(exhibit_id) ||
            !is_valid_uuid(timeline_id) ||
            !is_valid_uuid(timeline_item_id)) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (suppress_timeline_item_record)] Invalid UUID provided');
            return {
                status: false,
                message: 'Invalid UUID provided'
            };
        }

        /*
         * Both the timeline and the item must belong to THIS exhibit before the
         * container doc is touched (code review 2026-09-02, H3).
         */
        const member_item_record = await timeline_record_task.get_timeline_item_record(exhibit_id, timeline_id, timeline_item_id);

        if (!member_item_record) {
            return {
                status: false,
                message: 'Timeline item not found'
            };
        }

        const indexed_record = await INDEXER_MODEL.get_indexed_record(timeline_id);

        if (!indexed_record.data || !indexed_record.data.source) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (suppress_timeline_item_record)] Timeline not found in index');
            return {
                status: false,
                message: 'Timeline not found in index'
            };
        }

        // Filter out the timeline item being suppressed
        const items = indexed_record.data.source.items || [];
        const updated_items = items.filter(item => item.uuid !== timeline_item_id);

        indexed_record.data.source.items = updated_items;

        // Delete original timeline record from index
        const delete_result = await INDEXER_MODEL.delete_record(timeline_id);

        if (delete_result.status !== CONSTANTS.STATUS_CODES.NO_CONTENT) {
            LOGGER.module().error('ERROR: [/exhibits/timelines_model (suppress_timeline_item_record)] Unable to delete timeline from index');
            return {
                status: false,
                message: 'Unable to suppress timeline item'
            };
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

        if (is_indexed === true) {
            return {
                status: true,
                message: 'Timeline item suppressed'
            };
        }

        return {
            status: false,
            message: 'Unable to suppress timeline item'
        };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/exhibits/timelines_model (suppress_timeline_item_record)] ${error.message}`, {
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
 * Reorders timelines in exhibit
 * @param {string} exhibit_id - Exhibit UUID
 * @param {Object} timeline - Timeline order data
 * @returns {Promise<*>} Result from task
 */
exports.reorder_timelines = async (exhibit_id, timeline) => {

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

        if (!is_valid_user_id(uid) || !is_valid_uuid(uuid)) {
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