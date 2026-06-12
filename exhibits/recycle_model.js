/**

 Copyright 2025 University of Denver

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
const EXHIBIT_RECYCLED_RECORD_TASKS = require('../exhibits/tasks/exhibit_recycled_record_tasks');
const LOGGER = require('../libs/log4');

// The five record types that carry is_deleted, mapped to their physical table.
const TYPE_TABLE = {
    exhibit: TABLES.exhibit_records,
    heading: TABLES.heading_records,
    item: TABLES.item_records,
    grid: TABLES.grid_records,
    timeline: TABLES.timeline_records
};

/**
 * Get recycled records across all five record types.
 * @param {string|null} created_by - when set, only that owner's records are
 *        returned; when null, all owners' records are returned (the caller must
 *        already have authorized a system-wide view).
 */
exports.get_recycled_records = async function (created_by = null) {

    try {

        const TASKS = new EXHIBIT_RECYCLED_RECORD_TASKS(DB, TABLES);

        const [exhibits, headings, items, grids, timelines] = await Promise.all([
            TASKS.get_recycled_exhibit_records(created_by),
            TASKS.get_recycled_heading_records(created_by),
            TASKS.get_recycled_item_records(created_by),
            TASKS.get_recycled_grid_records(created_by),
            TASKS.get_recycled_timeline_records(created_by)
        ]);

        return {
            status: 200,
            message: 'Recycled records',
            data: [...exhibits, ...headings, ...items, ...grids, ...timelines]
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/recycle_model (get_recycled_records)] ' + error.message);
        return { status: 500, message: error.message, data: [] };
    }
};

/**
 * Permanently delete a single recycled record.
 * @param {string} type - exhibit|heading|item|grid|timeline
 * @param {string} uuid - record uuid
 */
exports.delete_recycled_record = async function (type, uuid) {

    try {

        const table = TYPE_TABLE[type];
        if (!table) {
            return { status: 400, message: `Invalid record type: ${type}` };
        }

        const TASKS = new EXHIBIT_RECYCLED_RECORD_TASKS(DB, TABLES);
        const affected = await TASKS.delete_recycled_record(table, uuid);

        if (!affected) {
            return { status: 404, message: 'Recycled record not found' };
        }

        return { status: 200, message: 'Record permanently deleted' };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/recycle_model (delete_recycled_record)] ' + error.message);
        return { status: 500, message: error.message };
    }
};

/**
 * Permanently delete all recycled records, optionally owner-scoped.
 * @param {string|null} created_by - when set, only that owner's recycled records
 *        are purged; when null, all owners' (caller must hold manage_recycle_bin).
 */
exports.delete_all_recycled_records = async function (created_by = null) {

    try {

        const TASKS = new EXHIBIT_RECYCLED_RECORD_TASKS(DB, TABLES);
        let deleted = 0;

        // Sequential + awaited so a failure surfaces (no fire-and-forget).
        for (const table of Object.values(TYPE_TABLE)) {
            deleted += await TASKS.delete_all_recycled_records(table, created_by);
        }

        return { status: 200, message: 'Records permanently deleted', deleted };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/recycle_model (delete_all_recycled_records)] ' + error.message);
        return { status: 500, message: error.message };
    }
};

/**
 * Restore a single recycled record (clears is_deleted).
 * @param {string} type - exhibit|heading|item|grid|timeline
 * @param {string} uuid - record uuid
 */
exports.restore_recycled_record = async function (type, uuid) {

    try {

        const table = TYPE_TABLE[type];
        if (!table) {
            return { status: 400, message: `Invalid record type: ${type}` };
        }

        const TASKS = new EXHIBIT_RECYCLED_RECORD_TASKS(DB, TABLES);
        const affected = await TASKS.restore_recycled_record(table, uuid);

        if (!affected) {
            return { status: 404, message: 'Recycled record not found' };
        }

        return { status: 200, message: 'Record restored' };

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/recycle_model (restore_recycled_record)] ' + error.message);
        return { status: 500, message: error.message };
    }
};
