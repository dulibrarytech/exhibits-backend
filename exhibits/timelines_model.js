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
const REINDEX_COALESCER = require('./reindex_coalescer');
const {validate_internal_name} = require('../exhibits/common_helper');
const {make_component_model} = require('./component_model_factory');

// Initialize task instances
const helper_task = new HELPER();
const timeline_record_task = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);
const exhibit_tasks = new EXHIBIT_RECORD_TASKS(DB, TABLES);

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

/**
 * Suppress gate for a timeline item: the item must belong to THIS exhibit and
 * timeline before the container doc is touched (code review 2026-09-02, H3).
 *
 * Timelines have no minimum-items rule — the grid equivalent of this hook
 * also enforces one — so this is the membership guard alone.
 *
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID
 * @param {string} timeline_item_id - Timeline item UUID
 * @returns {Promise<Object|null>} Failure envelope or null
 */
const timeline_item_suppress_gate = async (exhibit_id, timeline_id, timeline_item_id) => {

    const member_item_record = await timeline_record_task.get_timeline_item_record(
        exhibit_id,
        timeline_id,
        timeline_item_id
    );

    if (!member_item_record) {
        return {status: false, message: 'Timeline item not found'};
    }

    return null;
};

/* ==================== GENERATED MODELS ==================== */

/*
 * The timeline container: a standalone component with its own Elasticsearch
 * doc. Suppressing it cascades to its own items only, keyed by the timeline
 * uuid (code review 2026-09-02, H8).
 */
const timeline_model = make_component_model({
    module_name: 'timelines_model',
    label: 'Timeline',
    db: DB,
    helper: helper_task,
    task: timeline_record_task,
    exhibit_task: exhibit_tasks,
    indexer: INDEXER_MODEL,
    coalescer: REINDEX_COALESCER,
    rte_profiles: TIMELINE_RTE_PROFILES,
    uuid_param: 'timeline_id',
    order_fn: (data) => helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES),
    index_fn: (exhibit_id, timeline_id) => INDEXER_MODEL.index_timeline_record(exhibit_id, timeline_id),
    task_methods: {
        create: 'create_timeline_record',
        create_public_name: 'create_timeline_record',
        update: 'update_timeline_record',
        update_public_name: 'update_timeline_record',
        get: 'get_timeline_record',
        set_publish: 'set_timeline_to_publish',
        publish_public_name: 'publish_timeline_record',
        set_suppress: 'set_timeline_to_suppress',
        suppress_public_name: 'suppress_timeline_record'
    },
    hooks: {
        prepare_create: (data) => validate_internal_name(data, true, 'Timeline'),
        /* an omitted internal_name leaves the stored value untouched — the
           publish/suppress flows send partial updates */
        prepare_update: (data) => validate_internal_name(data, false, 'Timeline'),
        cascade_suppress: (timeline_id) => timeline_record_task.set_to_suppressed_timeline_items(timeline_id)
    },
    reads: [
        {
            name: 'get_timeline_record',
            task_method: 'get_timeline_record',
            label: 'Timeline record',
            params: ['is_member_of_exhibit', 'timeline_id']
        }
    ],
    reorder: [
        {
            name: 'reorder_timelines',
            task_method: 'reorder_timelines',
            id_label: 'exhibit',
            data_label: 'timeline'
        }
    ]
});

/*
 * The timeline item: a NESTED component, embedded in the timeline doc's
 * items[]. Timeline items are date-ordered on the public site, so `order` is
 * set on create and by an explicit reorder only — never recomputed on update
 * (Phase 0 #2).
 */
const timeline_item_model = make_component_model({
    module_name: 'timelines_model',
    label: 'Timeline item',
    kind: 'nested',
    container_label: 'Timeline',
    parent_key: 'is_member_of_timeline',
    parent_params: ['is_member_of_exhibit', 'timeline_id'],
    uuid_param: 'item_id',
    db: DB,
    helper: helper_task,
    task: timeline_record_task,
    exhibit_task: exhibit_tasks,
    indexer: INDEXER_MODEL,
    coalescer: REINDEX_COALESCER,
    rte_profiles: TIMELINE_ITEM_RTE_PROFILES,
    republish_key: 'timeline_item',
    order_fn: (data) => helper_task.order_timeline_items(data.is_member_of_timeline, DB, TABLES),
    index_fn: (timeline_id, item_id, record) => INDEXER_MODEL.index_timeline_item_record(timeline_id, item_id, record),
    task_methods: {
        create: 'create_timeline_item_record',
        create_public_name: 'create_timeline_item_record',
        update: 'update_timeline_item_record',
        update_public_name: 'update_timeline_item_record',
        get: 'get_timeline_item_record',
        get_container: 'get_timeline_record',
        publish_public_name: 'publish_timeline_item_record',
        suppress_public_name: 'suppress_timeline_item_record',
        delete: 'delete_timeline_item_record',
        delete_public_name: 'delete_timeline_item_record'
    },
    messages: {
        /*
         * Preserved divergence: where the grid says "Invalid indexed record"
         * for a 200 with no _source, the timeline has always reported it as
         * "not found in index" — and the controller contract test pins that
         * string.
         */
        index_invalid_message: 'Timeline not found in index'
    },
    hooks: {
        suppress_gate: timeline_item_suppress_gate
    },
    reads: [
        {
            name: 'get_timeline_item_records',
            task_method: 'get_timeline_item_records',
            label: 'Exhibit timeline item records',
            params: ['is_member_of_exhibit', 'is_member_of_timeline']
        },
        {
            name: 'get_timeline_item_record',
            task_method: 'get_timeline_item_record',
            label: 'Exhibit timeline item record',
            params: ['is_member_of_exhibit', 'is_member_of_timeline', 'item_id']
        },
        {
            name: 'get_timeline_item_edit_record',
            task_method: 'get_timeline_item_edit_record',
            label: 'Exhibit timeline item edit record',
            params: ['uid', 'is_member_of_exhibit', 'is_member_of_timeline', 'item_id']
        },
        {
            /* read-only, no locking */
            name: 'get_timeline_item_details_record',
            task_method: 'get_timeline_item_details_record',
            label: 'Exhibit timeline item details record',
            params: ['is_member_of_exhibit', 'is_member_of_timeline', 'item_id']
        }
    ],
    reorder: [
        {
            name: 'reorder_timeline_items',
            task_method: 'reorder_timeline_items',
            id_label: 'timeline',
            data_label: 'timeline'
        }
    ],
    unlock: [
        {
            name: 'unlock_timeline_item_record',
            table: TABLES.timeline_item_records
        }
    ]
});

exports.create_timeline_record = timeline_model.create_record;
exports.update_timeline_record = timeline_model.update_record;
exports.get_timeline_record = timeline_model.reads.get_timeline_record;
exports.publish_timeline_record = timeline_model.publish_record;
exports.suppress_timeline_record = timeline_model.suppress_record;
exports.reorder_timelines = timeline_model.reorder.reorder_timelines;

exports.create_timeline_item_record = timeline_item_model.create_record;
exports.update_timeline_item_record = timeline_item_model.update_record;
exports.get_timeline_item_records = timeline_item_model.reads.get_timeline_item_records;
exports.get_timeline_item_record = timeline_item_model.reads.get_timeline_item_record;
exports.get_timeline_item_edit_record = timeline_item_model.reads.get_timeline_item_edit_record;
exports.get_timeline_item_details_record = timeline_item_model.reads.get_timeline_item_details_record;
exports.delete_timeline_item_record = timeline_item_model.delete_record;
exports.publish_timeline_item_record = timeline_item_model.publish_record;
exports.suppress_timeline_item_record = timeline_item_model.suppress_record;
exports.reorder_timeline_items = timeline_item_model.reorder.reorder_timeline_items;
exports.unlock_timeline_item_record = timeline_item_model.unlock.unlock_timeline_item_record;
