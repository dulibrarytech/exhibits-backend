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

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

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
const {build_response, validate_internal_name} = require('../exhibits/common_helper');
const {
    make_component_model,
    STATUS_CODES,
    PUBLICATION_STATUS
} = require('./component_model_factory');

// Initialize task instances
const helper_task = new HELPER();
const grid_record_task = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
const exhibit_tasks = new EXHIBIT_RECORD_TASKS(DB, TABLES);

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

/* ==================== MINIMUM-ITEMS RULE (grid only) ==================== */

/*
 * A grid must fill at least one full row — items >= columns — before it can
 * go public; fewer items breaks the frontend grid layout. Timelines have no
 * analogue, so this whole section stays hand-written and is injected into the
 * generated model as the publish / suppress / delete gates.
 */

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

/* ==================== PAYLOAD PREPARATION HOOKS ==================== */

/**
 * Validates the Grid Columns dropdown value and the staff-facing
 * internal_name on create: missing columns falls back to the task-layer
 * default (4); a supplied value must be one of the dropdown's counts.
 * @param {Object} data - Payload, mutated in place
 * @returns {Object|null} Error response or null
 */
const prepare_grid_create = (data) => {

    if (data.columns === undefined || data.columns === null || data.columns === '') {
        data.columns = 4;
    } else {
        data.columns = safe_parse_int(data.columns, 0);
    }

    if (!ALLOWED_COLUMNS.includes(data.columns)) {
        return build_response(STATUS_CODES.BAD_REQUEST, 'Grid columns must be 2, 3, or 4');
    }

    return validate_internal_name(data, true, 'Grid');
};

/**
 * Same on update, except that an omitted columns value or internal_name
 * leaves the stored one untouched — the publish/suppress flows send partial
 * updates.
 * @param {Object} data - Payload, mutated in place
 * @returns {Object|null} Error response or null
 */
const prepare_grid_update = (data) => {

    if (data.columns === undefined || data.columns === null || data.columns === '') {
        delete data.columns;
    } else {
        data.columns = safe_parse_int(data.columns, 0);

        if (!ALLOWED_COLUMNS.includes(data.columns)) {
            return build_response(STATUS_CODES.BAD_REQUEST, 'Grid columns must be 2, 3, or 4');
        }
    }

    return validate_internal_name(data, false, 'Grid');
};

/* ==================== GATES ==================== */

/**
 * Publish gate: the grid must belong to this exhibit AND fill at least one
 * full row. Replaces the factory's default membership guard, which is why the
 * "not found" branch keeps the grid's own wording.
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @returns {Promise<Object|null>} Failure envelope or null
 */
const grid_publish_gate = async (exhibit_id, grid_id) => {

    const grid_record = await grid_record_task.get_grid_record(exhibit_id, grid_id);

    if (!grid_record) {
        LOGGER.module().error('ERROR: [/exhibits/grid_model (publish_grid_record)] Grid record not found');
        return {status: false, message: 'Unable to publish grid'};
    }

    const violation = await check_grid_minimum_items(exhibit_id, grid_record);

    if (violation !== null) {
        LOGGER.module().info(
            `INFO: [/exhibits/grid_model (publish_grid_record)] Grid ${grid_id} has ${violation.item_count} item(s); minimum is ${violation.minimum}`
        );

        return {status: false, message: build_minimum_items_message(violation)};
    }

    return null;
};

/**
 * Suppress gate for a grid item.
 *
 * Both the grid and the item must belong to THIS exhibit: a foreign grid
 * would skip the minimum-items gate (null record) and then lose its index doc
 * before the scoped DB update threw. A published grid must also keep at least
 * one full row on the live site.
 *
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @param {string} grid_item_id - Grid item UUID
 * @returns {Promise<Object|null>} Failure envelope or null
 */
const grid_item_suppress_gate = async (exhibit_id, grid_id, grid_item_id) => {

    const parent_grid_record = await grid_record_task.get_grid_record(exhibit_id, grid_id);

    if (!parent_grid_record) {
        return {status: false, message: 'Grid not found in exhibit'};
    }

    const member_item_record = await grid_record_task.get_grid_item_record(exhibit_id, grid_id, grid_item_id);

    if (!member_item_record) {
        return {status: false, message: 'Grid item not found'};
    }

    if (parent_grid_record.is_published === PUBLICATION_STATUS.PUBLISHED) {

        const minimum = get_minimum_grid_items(parent_grid_record.columns);
        const published_count = await grid_record_task.get_grid_item_count(
            exhibit_id,
            grid_id,
            {published_only: true}
        );
        const item_record = await grid_record_task.get_grid_item_record(exhibit_id, grid_id, grid_item_id);
        const remaining_count = item_record && item_record.is_published === PUBLICATION_STATUS.PUBLISHED
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

    return null;
};

/**
 * Delete gate for a grid item: a PUBLISHED grid must keep at least `columns`
 * published items, the same rule publish and suppress enforce. Deleting a
 * published item that would take it below that is refused; unpublish the grid
 * first.
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} grid_id - Grid UUID
 * @param {string} grid_item_id - Grid item UUID
 * @returns {Promise<Object|null>} Error response or null
 */
const grid_item_delete_gate = async (exhibit_id, grid_id, grid_item_id) => {

    const parent_grid_record = await grid_record_task.get_grid_record(exhibit_id, grid_id);

    if (parent_grid_record && parent_grid_record.is_published === PUBLICATION_STATUS.PUBLISHED) {

        const item_record = await grid_record_task.get_grid_item_record(exhibit_id, grid_id, grid_item_id);

        if (item_record && item_record.is_published === PUBLICATION_STATUS.PUBLISHED) {

            const minimum = get_minimum_grid_items(parent_grid_record.columns);
            const published_count = await grid_record_task.get_grid_item_count(
                exhibit_id,
                grid_id,
                {published_only: true}
            );

            if (published_count - 1 < minimum) {
                return build_response(
                    STATUS_CODES.BAD_REQUEST,
                    `Cannot delete this grid item. The grid is published and needs at least ${minimum} items for its ${minimum} columns. Unpublish the grid first.`
                );
            }
        }
    }

    return null;
};

/* ==================== GENERATED MODELS ==================== */

/*
 * The grid container: a standalone component with its own Elasticsearch doc.
 * Suppressing it cascades to its own items only, keyed by the grid uuid.
 */
const grid_model = make_component_model({
    module_name: 'grid_model',
    label: 'Grid',
    db: DB,
    helper: helper_task,
    task: grid_record_task,
    exhibit_task: exhibit_tasks,
    indexer: INDEXER_MODEL,
    coalescer: REINDEX_COALESCER,
    rte_profiles: GRID_RTE_PROFILES,
    uuid_param: 'grid_id',
    order_fn: (data) => helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES),
    index_fn: (exhibit_id, grid_id) => INDEXER_MODEL.index_grid_record(exhibit_id, grid_id),
    task_methods: {
        create: 'create_grid_record',
        create_public_name: 'create_grid_record',
        update: 'update_grid_record',
        update_public_name: 'update_grid_record',
        get: 'get_grid_record',
        set_publish: 'set_grid_to_publish',
        publish_public_name: 'publish_grid_record',
        set_suppress: 'set_grid_to_suppress',
        suppress_public_name: 'suppress_grid_record'
    },
    hooks: {
        prepare_create: prepare_grid_create,
        prepare_update: prepare_grid_update,
        publish_gate: grid_publish_gate,
        cascade_suppress: (grid_id) => grid_record_task.set_to_suppressed_grid_items(grid_id)
    },
    reads: [
        {
            name: 'get_grid_record',
            task_method: 'get_grid_record',
            label: 'Grid record',
            params: ['is_member_of_exhibit', 'grid_id']
        }
    ],
    reorder: [
        {
            name: 'reorder_grids',
            task_method: 'reorder_grids',
            id_label: 'exhibit',
            data_label: 'grid'
        }
    ]
});

/*
 * The grid item: a NESTED component. It has no index doc of its own — it
 * lives in the grid doc's items[] — so publish upserts it into that doc and
 * suppress rewrites the doc without it.
 */
const grid_item_model = make_component_model({
    module_name: 'grid_model',
    label: 'Grid item',
    kind: 'nested',
    container_label: 'Grid',
    parent_key: 'is_member_of_grid',
    parent_params: ['is_member_of_exhibit', 'grid_id'],
    uuid_param: 'item_id',
    db: DB,
    helper: helper_task,
    task: grid_record_task,
    exhibit_task: exhibit_tasks,
    indexer: INDEXER_MODEL,
    coalescer: REINDEX_COALESCER,
    rte_profiles: GRID_ITEM_RTE_PROFILES,
    republish_key: 'grid_item',
    order_fn: (data) => helper_task.order_grid_items(data.is_member_of_grid, DB, TABLES),
    index_fn: (grid_id, item_id, record) => INDEXER_MODEL.index_grid_item_record(grid_id, item_id, record),
    task_methods: {
        create: 'create_grid_item_record',
        create_public_name: 'create_grid_item_record',
        update: 'update_grid_item_record',
        update_public_name: 'update_grid_item_record',
        get: 'get_grid_item_record',
        get_container: 'get_grid_record',
        publish_public_name: 'publish_grid_item_record',
        suppress_public_name: 'suppress_grid_item_record',
        delete: 'delete_grid_item_record',
        delete_public_name: 'delete_grid_item_record'
    },
    hooks: {
        suppress_gate: grid_item_suppress_gate,
        delete_gate: grid_item_delete_gate
    },
    reads: [
        {
            name: 'get_grid_item_records',
            task_method: 'get_grid_item_records',
            label: 'Exhibit grid item records',
            params: ['is_member_of_exhibit', 'is_member_of_grid']
        },
        {
            name: 'get_grid_item_record',
            task_method: 'get_grid_item_record',
            label: 'Exhibit grid item record',
            params: ['is_member_of_exhibit', 'is_member_of_grid', 'item_id']
        },
        {
            name: 'get_grid_item_edit_record',
            task_method: 'get_grid_item_edit_record',
            label: 'Exhibit grid item edit record',
            params: ['uid', 'is_member_of_exhibit', 'is_member_of_grid', 'item_id']
        },
        {
            /* media-library metadata, no lock */
            name: 'get_grid_item_details_record',
            task_method: 'get_grid_item_details_record',
            label: 'Grid item details record',
            params: ['is_member_of_exhibit', 'is_member_of_grid', 'item_id']
        }
    ],
    reorder: [
        {
            name: 'reorder_grid_items',
            task_method: 'reorder_grid_items',
            id_label: 'grid',
            data_label: 'grid'
        }
    ],
    unlock: [
        {
            name: 'unlock_grid_item_record',
            table: TABLES.grid_item_records
        }
    ]
});

exports.create_grid_record = grid_model.create_record;
exports.update_grid_record = grid_model.update_record;
exports.get_grid_record = grid_model.reads.get_grid_record;
exports.publish_grid_record = grid_model.publish_record;
exports.suppress_grid_record = grid_model.suppress_record;
exports.reorder_grids = grid_model.reorder.reorder_grids;

exports.create_grid_item_record = grid_item_model.create_record;
exports.update_grid_item_record = grid_item_model.update_record;
exports.get_grid_item_records = grid_item_model.reads.get_grid_item_records;
exports.get_grid_item_record = grid_item_model.reads.get_grid_item_record;
exports.get_grid_item_edit_record = grid_item_model.reads.get_grid_item_edit_record;
exports.get_grid_item_details_record = grid_item_model.reads.get_grid_item_details_record;
exports.delete_grid_item_record = grid_item_model.delete_record;
exports.publish_grid_item_record = grid_item_model.publish_record;
exports.suppress_grid_item_record = grid_item_model.suppress_record;
exports.reorder_grid_items = grid_item_model.reorder.reorder_grid_items;
exports.unlock_grid_item_record = grid_item_model.unlock.unlock_grid_item_record;
