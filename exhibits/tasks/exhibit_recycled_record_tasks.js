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

const Base_tasks = require('./tasks_helper');

/**
 * Tasks used to manage recycled (soft-deleted) records.
 *
 * Construct with the full tables config object (`DB_TABLES.exhibits`); read
 * methods resolve their own table from `this.TABLE.<key>`, and write methods
 * take the resolved table NAME as their first argument. A record is "recycled"
 * when `is_deleted = 1` (regardless of publish state, so a record deleted while
 * published is still visible/purgeable here rather than becoming an orphan).
 *
 * Errors are NOT swallowed here — they propagate to the model so a failed
 * delete/restore can never be reported as success.
 *
 * @type {Recycled_record_tasks}
 */
const Recycled_record_tasks = class extends Base_tasks {

    constructor(DB, TABLE) {
        super(DB, TABLE);
    }

    /**
     * Fetch recycled rows from a table, owner-scoped and tagged with their type.
     * @param {string} table - resolved table name
     * @param {string} type - record type tag added to each row (exhibit|heading|item|grid|timeline)
     * @param {string|null} created_by - when set, restrict to this owner's rows; null = all owners
     * @private
     */
    async _get_recycled(table, type, created_by) {

        const query = this.DB(table)
            .select('*')
            .where({ is_deleted: 1 });

        if (created_by) {
            query.andWhere('created_by', created_by);
        }

        const rows = await query.timeout(this.QUERY_TIMEOUT);
        // Tag each row so callers (list UI, restore/delete authz) can tell types apart.
        return rows.map((row) => ({ ...row, type }));
    }

    async get_recycled_exhibit_records(created_by = null) {
        return this._get_recycled(this.TABLE.exhibit_records, 'exhibit', created_by);
    }

    async get_recycled_heading_records(created_by = null) {
        return this._get_recycled(this.TABLE.heading_records, 'heading', created_by);
    }

    async get_recycled_item_records(created_by = null) {
        return this._get_recycled(this.TABLE.item_records, 'item', created_by);
    }

    async get_recycled_grid_records(created_by = null) {
        return this._get_recycled(this.TABLE.grid_records, 'grid', created_by);
    }

    async get_recycled_timeline_records(created_by = null) {
        return this._get_recycled(this.TABLE.timeline_records, 'timeline', created_by);
    }

    /**
     * Permanently delete a single recycled row. Scoped to `is_deleted = 1` so a
     * live (non-recycled) record can never be hard-deleted through this path.
     * @param {string} table - resolved table name
     * @param {string} uuid - record uuid
     * @returns {Promise<number>} affected row count
     */
    async delete_recycled_record(table, uuid) {
        return this.DB(table)
            .where({ uuid: uuid, is_deleted: 1 })
            .delete()
            .timeout(this.QUERY_TIMEOUT);
    }

    /**
     * Permanently delete all recycled rows in a table, optionally owner-scoped.
     * @param {string} table - resolved table name
     * @param {string|null} created_by - when set, only this owner's rows; null = all owners
     * @returns {Promise<number>} affected row count
     */
    async delete_all_recycled_records(table, created_by = null) {

        const query = this.DB(table).where({ is_deleted: 1 });

        if (created_by) {
            query.andWhere('created_by', created_by);
        }

        return query.delete().timeout(this.QUERY_TIMEOUT);
    }

    /**
     * Restore a single recycled row (clears is_deleted). Scoped to `is_deleted = 1`.
     * @param {string} table - resolved table name
     * @param {string} uuid - record uuid
     * @returns {Promise<number>} affected row count
     */
    async restore_recycled_record(table, uuid) {
        return this.DB(table)
            .where({ uuid: uuid, is_deleted: 1 })
            .update({ is_deleted: 0 })
            .timeout(this.QUERY_TIMEOUT);
    }
};

module.exports = Recycled_record_tasks;
