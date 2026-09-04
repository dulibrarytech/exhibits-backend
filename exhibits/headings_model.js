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
const REINDEX_COALESCER = require('./reindex_coalescer');
const {validate_input, build_response} = require('../exhibits/common_helper');
const {make_component_model, STATUS_CODES} = require('./component_model_factory');

// Initialize task instances
const helper_task = new HELPER();
const validate_create_heading_task = new VALIDATOR(EXHIBITS_CREATE_HEADING_SCHEMA);
const validate_heading_update_task = new VALIDATOR(EXHIBITS_UPDATE_HEADING_SCHEMA);
const heading_record_task = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
const exhibit_tasks = new EXHIBIT_RECORD_TASKS(DB, TABLES);

/* heading text renders inside <h2>/<h3> on the public site — inline formats only */
const HEADING_RTE_PROFILES = {
    text: 'reduced'
};

/**
 * Runs a heading payload through its ajv schema.
 *
 * Headings are the only component type that still has create/update schemas;
 * the other three had theirs removed as provably-unreachable guards, so the
 * factory takes schema validation as an optional hook rather than a step.
 *
 * @param {Object} validator - VALIDATOR instance
 * @param {string} context - Module/function context for the error log
 * @returns {Function} (data) => error response | null
 */
const schema_gate = (validator, context) => {

    return (data) => {

        const validation_result = validate_input(data, validator, context);

        if (validation_result !== true) {
            return build_response(STATUS_CODES.BAD_REQUEST, validation_result);
        }

        return null;
    };
};

/*
 * Everything below is generated from this one declaration — see
 * exhibits/component_model_factory.js. Headings are the simplest type: no
 * media, no nested items, no container.
 */
const heading_model = make_component_model({
    module_name: 'headings_model',
    label: 'Heading',
    db: DB,
    helper: helper_task,
    task: heading_record_task,
    exhibit_task: exhibit_tasks,
    indexer: INDEXER_MODEL,
    coalescer: REINDEX_COALESCER,
    rte_profiles: HEADING_RTE_PROFILES,
    republish_key: 'heading',
    order_fn: (data) => helper_task.order_exhibit_items(data.is_member_of_exhibit, DB, TABLES),
    index_fn: (exhibit_id, uuid) => INDEXER_MODEL.index_heading_record(exhibit_id, uuid),
    task_methods: {
        create: 'create_heading_record',
        create_public_name: 'create_heading_record',
        update: 'update_heading_record',
        update_public_name: 'update_heading_record',
        get: 'get_heading_record',
        set_publish: 'set_heading_to_publish',
        publish_public_name: 'publish_heading_record',
        set_suppress: 'set_heading_to_suppress',
        suppress_public_name: 'suppress_heading_record'
    },
    messages: {
        /* headings and standard items say "record", not "heading record" */
        create_error_prefix: 'Unable to create record',
        update_error_prefix: 'Unable to update record',
        update_failure_status: STATUS_CODES.BAD_REQUEST,
        update_returns_uuid: false
    },
    hooks: {
        validate_create: schema_gate(validate_create_heading_task, 'headings_model (create_heading_record)'),
        validate_update: schema_gate(validate_heading_update_task, 'headings_model (update_heading_record)')
    },
    reads: [
        {
            name: 'get_heading_record',
            task_method: 'get_heading_record',
            label: 'Heading record',
            params: ['is_member_of_exhibit', 'uuid']
        },
        {
            name: 'get_heading_edit_record',
            task_method: 'get_heading_edit_record',
            label: 'Heading edit record',
            params: ['uid', 'is_member_of_exhibit', 'uuid']
        }
    ],
    reorder: [
        {
            name: 'reorder_headings',
            task_method: 'reorder_headings',
            id_label: 'exhibit',
            data_label: 'heading'
        }
    ],
    unlock: [
        {
            name: 'unlock_heading_record',
            table: TABLES.heading_records
        }
    ]
});

exports.create_heading_record = heading_model.create_record;
exports.update_heading_record = heading_model.update_record;
exports.get_heading_record = heading_model.reads.get_heading_record;
exports.get_heading_edit_record = heading_model.reads.get_heading_edit_record;
exports.publish_heading_record = heading_model.publish_record;
exports.suppress_heading_record = heading_model.suppress_record;
exports.reorder_headings = heading_model.reorder.reorder_headings;
exports.unlock_heading_record = heading_model.unlock.unlock_heading_record;
