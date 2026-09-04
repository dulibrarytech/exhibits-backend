/**

 Copyright 2026 University of Denver

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

const LOGGER = require('../../libs/log4');
const HELPER = require('../../libs/helper');
const { UUID_REGEX } = require('../../libs/uuid');
const { is_valid_user_id } = require('../common_helper');
const KALTURA_THUMBNAIL = require('../../media-library/kaltura_thumbnail');

/*
 * Column projections for the media-library JOIN, one per variant.
 *
 * The aliases are CLIENT-VISIBLE — public/app reads `media_repo_uuid`,
 * `thumbnail_repo_uuid`, `thumb_thumbnail_path` and friends off the JSON by
 * name — so the three surviving variants are kept apart rather than unified:
 * reconciling them would change what the dashboard receives. Every alias is
 * locked by test/tasks/media_library_projection_pin.test.js.
 *
 * Entry shapes:
 *   ['media_lib.name', 'media_name'] -> `media_lib.name as media_name`
 *   ['media_lib.kaltura_entry_id']   -> `media_lib.kaltura_entry_id`
 *   {kaltura: 'media_lib', as: 'x'}  -> kaltura_thumbnail_url_sql(DB, alias, x)
 */
const MEDIA_LIBRARY_PROJECTIONS = Object.freeze({

    /* Item list + single item, grid item list, timeline item list. Carries the
     * extra v2 indexer columns (IIIF dimensions, Kaltura id, media-lib uuids). */
    list: Object.freeze([
        ['media_lib.name', 'media_name'],
        ['media_lib.ingest_method', 'media_ingest_method'],
        {kaltura: 'media_lib', as: 'media_kaltura_thumbnail_url'},
        ['media_lib.repo_uuid', 'media_repo_uuid'],
        ['media_lib.thumbnail_path', 'media_thumbnail_path'],
        ['media_lib.alt_text', 'media_alt_text'],
        ['media_lib.is_alt_text_decorative', 'media_is_alt_text_decorative'],
        ['media_lib.uuid', 'media_lib_uuid'],
        ['media_lib.kaltura_entry_id'],
        ['media_lib.media_width', 'ml_media_width'],
        ['media_lib.media_height', 'ml_media_height'],
        ['media_lib.media_type', 'ml_media_type'],
        ['media_lib.filename', 'ml_media_filename'],
        ['media_lib.topics_subjects', 'media_topics_subjects'],
        ['media_lib.genre_form_subjects', 'media_genre_form_subjects'],
        ['media_lib.places_subjects', 'media_places_subjects'],
        ['thumb_lib.name', 'thumbnail_media_name'],
        ['thumb_lib.ingest_method', 'thumbnail_ingest_method'],
        {kaltura: 'thumb_lib', as: 'thumbnail_media_kaltura_thumbnail_url'},
        ['thumb_lib.repo_uuid', 'thumbnail_media_repo_uuid'],
        ['thumb_lib.thumbnail_path', 'thumbnail_media_thumbnail_path'],
        ['thumb_lib.uuid', 'thumb_lib_uuid']
    ]),

    /* Item edit/details and grid item edit/details. Note `thumbnail_repo_uuid`
     * (the list variant calls the same column `thumbnail_media_repo_uuid`) and
     * no thumbnail Kaltura URL at all. */
    edit: Object.freeze([
        ['media_lib.name', 'media_name'],
        ['media_lib.ingest_method', 'media_ingest_method'],
        {kaltura: 'media_lib', as: 'media_kaltura_thumbnail_url'},
        ['media_lib.repo_uuid', 'media_repo_uuid'],
        ['media_lib.thumbnail_path', 'media_thumbnail_path'],
        ['media_lib.alt_text', 'media_alt_text'],
        ['media_lib.is_alt_text_decorative', 'media_is_alt_text_decorative'],
        ['media_lib.topics_subjects', 'media_topics_subjects'],
        ['media_lib.genre_form_subjects', 'media_genre_form_subjects'],
        ['media_lib.places_subjects', 'media_places_subjects'],
        ['thumb_lib.name', 'thumbnail_media_name'],
        ['thumb_lib.ingest_method', 'thumbnail_ingest_method'],
        ['thumb_lib.repo_uuid', 'thumbnail_repo_uuid'],
        ['thumb_lib.thumbnail_path', 'thumbnail_media_thumbnail_path']
    ]),

    /* Timeline item edit/details. Adds the original filenames and uses
     * `thumb_*` where item/grid use `thumbnail_*`. */
    timeline_edit: Object.freeze([
        ['media_lib.name', 'media_name'],
        ['media_lib.original_filename', 'media_filename'],
        ['media_lib.ingest_method', 'media_ingest_method'],
        {kaltura: 'media_lib', as: 'media_kaltura_thumbnail_url'},
        ['media_lib.repo_uuid', 'media_repo_uuid'],
        ['media_lib.thumbnail_path', 'media_thumbnail_path'],
        ['media_lib.alt_text', 'media_alt_text'],
        ['media_lib.is_alt_text_decorative', 'media_is_alt_text_decorative'],
        ['media_lib.topics_subjects', 'media_topics_subjects'],
        ['media_lib.genre_form_subjects', 'media_genre_form_subjects'],
        ['media_lib.places_subjects', 'media_places_subjects'],
        ['thumb_lib.name', 'thumbnail_media_name'],
        ['thumb_lib.original_filename', 'thumbnail_filename'],
        ['thumb_lib.ingest_method', 'thumb_ingest_method'],
        {kaltura: 'thumb_lib', as: 'thumb_kaltura_thumbnail_url'},
        ['thumb_lib.repo_uuid', 'thumbnail_repo_uuid'],
        ['thumb_lib.thumbnail_path', 'thumb_thumbnail_path']
    ])
});

/**
 * Base class providing shared validation, logging, and common database operations
 * for all exhibit task classes.
 *
 * @param DB - Knex database instance
 * @param TABLE - Table name configuration object
 */
const Base_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
        this.UUID_REGEX = UUID_REGEX;
        this.QUERY_TIMEOUT = 10000;
        /*
         * One helper instance per task object. The class is stateless, so a
         * member costs nothing and keeps the lock/reorder call sites to one
         * line.
         */
        this.HELPER = new HELPER();
    }

    // ==================== VALIDATION HELPERS ====================

    /**
     * Validates that database connection is available
     * @private
     */
    _validate_database() {
        if (!this.DB || typeof this.DB !== 'function') {
            throw new Error('Database connection is not available');
        }
    }

    /**
     * Validates that a specific table exists in config
     * @param {string} table_name - Name of the table key to validate
     * @private
     */
    _validate_table(table_name) {
        if (!this.TABLE?.[table_name]) {
            throw new Error(`Table name "${table_name}" is not defined`);
        }
    }

    /**
     * Validates a UUID string
     * @param {string} uuid - UUID to validate
     * @param {string} field_name - Name of the field for error message
     * @returns {string} Trimmed UUID
     * @private
     */
    _validate_uuid(uuid, field_name = 'UUID') {
        if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
            throw new Error(`Valid ${field_name} is required`);
        }

        const trimmed_uuid = uuid.trim();

        if (!this.UUID_REGEX.test(trimmed_uuid)) {
            throw new Error(`Invalid ${field_name} format`);
        }

        return trimmed_uuid;
    }

    /**
     * Validates multiple UUIDs at once
     * @param {Object} uuid_map - Object with uuid_value: field_name pairs
     * @returns {Object} Object with validated and trimmed UUIDs
     * @private
     */
    _validate_uuids(uuid_map) {
        const validated = {};
        for (const [value, name] of Object.entries(uuid_map)) {
            validated[name] = this._validate_uuid(value, name);
        }
        return validated;
    }

    /**
     * Validates a required string field
     * @param {string} value - Value to validate
     * @param {string} field_name - Name of the field for error message
     * @returns {string} Trimmed value
     * @private
     */
    _validate_string(value, field_name) {
        if (!value || typeof value !== 'string' || !value.trim()) {
            throw new Error(`Valid ${field_name} is required`);
        }
        return value.trim();
    }

    /**
     * Validates a record-lock user id (the numeric tbl_users.id).
     *
     * Replaces the `uid === null || uid === undefined || uid === ''` +
     * `Number(uid)`/`isNaN` pair that was copied into three edit-record
     * methods, and the `_validate_string` variant a fourth used. The validity
     * rule is common_helper's `is_valid_user_id` (positive integer) so there
     * is one definition of "a user id" on the server; both original error
     * messages are kept because callers and their tests read them.
     *
     * @param {string|number} uid - User ID
     * @returns {number} The id as a number
     * @private
     */
    _validate_user_id(uid) {

        if (uid === null || uid === undefined || uid === '') {
            throw new Error('Valid user ID is required');
        }

        if (!is_valid_user_id(uid)) {
            throw new Error('User ID must be a valid number');
        }

        return Number(uid);
    }

    /**
     * Validates a data object
     * @param {Object} data - Data object to validate
     * @private
     */
    _validate_data_object(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Data must be a valid object');
        }

        if (Object.keys(data).length === 0) {
            throw new Error('Data object cannot be empty');
        }
    }

    /**
     * Sanitizes data against a whitelist of allowed fields
     * @param {Object} data - Data to sanitize
     * @param {Array<string>} allowed_fields - Whitelist of allowed fields
     * @param {Array<string>} skip_fields - Fields to skip during sanitization
     * @returns {Object} Sanitized data and invalid fields
     * @private
     */
    _sanitize_data(data, allowed_fields, skip_fields = []) {
        const sanitized_data = {};
        const invalid_fields = [];

        for (const [key, value] of Object.entries(data)) {
            if (skip_fields.includes(key)) {
                continue;
            }

            // Security: prevent prototype pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                LOGGER.module().warn('Dangerous property skipped', {key});
                continue;
            }

            if (allowed_fields.includes(key)) {
                sanitized_data[key] = value;
            } else {
                invalid_fields.push(key);
            }
        }

        if (invalid_fields.length > 0) {
            LOGGER.module().warn('Invalid fields ignored', {
                fields: invalid_fields
            });
        }

        return {sanitized_data, invalid_fields};
    }

    /**
     * Fills in fields the caller left undefined.
     *
     * Six task methods carried a byte-identical
     * `for (const [key, default_value] of Object.entries(defaults))` loop.
     *
     * @param {Object} data - Data object, mutated in place
     * @param {Object} defaults - field -> default value
     * @returns {Object} The same data object
     * @private
     */
    _apply_defaults(data, defaults) {

        for (const [key, default_value] of Object.entries(defaults)) {
            if (data[key] === undefined) {
                data[key] = default_value;
            }
        }

        return data;
    }

    // ==================== LOGGING HELPERS ====================

    /**
     * Handles error logging and re-throwing
     * @param {Error} error - Error to handle
     * @param {string} method_name - Name of the method where error occurred
     * @param {Object} context - Additional context for logging
     * @private
     */
    _handle_error(error, method_name, context = {}) {
        const error_context = {
            method: method_name,
            ...context,
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack
        };

        LOGGER.module().error(
            `Failed to ${method_name.replace(/_/g, ' ')}`,
            error_context
        );

        throw error;
    }

    /**
     * Logs successful operation
     * @param {string} message - Success message
     * @param {Object} context - Context for logging
     * @private
     */
    _log_success(message, context = {}) {
        LOGGER.module().info(message, {
            ...context,
            timestamp: new Date().toISOString()
        });
    }

    // ==================== COMMON DATABASE OPERATIONS ====================

    /**
     * Wraps a query with timeout protection
     * @param {Promise} query_promise - The query promise
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Query result or timeout error
     * @private
     */
    async _with_timeout(query_promise, timeout = this.QUERY_TIMEOUT) {
        return Promise.race([
            query_promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Query timeout')), timeout)
            )
        ]);
    }

    /**
     * Inserts a row in a transaction and returns the row that was written:
     * insert -> guard the id -> select it back -> guard the row -> log.
     *
     * @param {string} table_name - Table name key
     * @param {Object} data - Row to insert
     * @param {Object} [options={}]
     * @param {string} [options.log_message] - Success message; omit to log nothing
     * @param {Object|Function} [options.log_context={}] - Extra log fields, or a
     *        function of the created record returning them
     * @returns {Promise<Object>} The created record
     * @private
     */
    async _insert_and_fetch(table_name, data, options = {}) {

        const {log_message = null, log_context = {}} = options;

        return await this.DB.transaction(async (trx) => {

            const [insert_id] = await trx(this.TABLE[table_name])
                .insert(data)
                .timeout(this.QUERY_TIMEOUT);

            if (!insert_id) {
                throw new Error('Insert failed: No ID returned');
            }

            const record = await trx(this.TABLE[table_name])
                .select('*')
                .where({id: insert_id})
                .first();

            if (!record) {
                throw new Error('Failed to retrieve created record');
            }

            if (log_message) {
                const extra = typeof log_context === 'function' ? log_context(record) : log_context;
                this._log_success(log_message, {
                    id: insert_id,
                    uuid: record.uuid,
                    ...extra
                });
            }

            return record;
        });
    }

    /**
     * Counts live rows in a table for a scope.
     *
     * Replaces four `get_record_count` bodies. Errors THROW (via the caller's
     * `_handle_error`): three of the four already did, and the exhibit publish
     * gate runs them under one `Promise.all`, so a swallowed error there could
     * only ever have produced a wrong count.
     *
     * @param {string} table_name - Table name key
     * @param {Object} where_clause - Scope, e.g. {is_member_of_exhibit, is_deleted: 0}
     * @returns {Promise<number>} Row count, 0 when the driver returns nothing
     * @private
     */
    async _get_record_count(table_name, where_clause) {

        this._validate_database();
        this._validate_table(table_name);

        const result = await this.DB(this.TABLE[table_name])
            .count('id as count')
            .where(where_clause)
            .timeout(this.QUERY_TIMEOUT);

        return result?.[0]?.count ? parseInt(result[0].count, 10) : 0;
    }

    /**
     * Locks a freshly-read record for editing, mutating it in place.
     *
     * A failed lock is a warning, not an error — the record is still returned.
     *
     * @param {Object} record - The row just read; mutated on a successful lock
     * @param {string|number} uid - User ID acquiring the lock (passed through
     *        to HELPER.lock_record unchanged, so callers keep their own coercion)
     * @param {string} table_name - Table name key
     * @param {Object} [options={}]
     * @param {string} options.label - Human label, e.g. 'Grid item'
     * @param {string} [options.uuid] - Record uuid; defaults to record.uuid
     * @param {string} [options.id_key='uuid'] - Key the uuid is logged under
     * @param {boolean} [options.set_locked_at=true] - Set locked_at on the row
     * @param {boolean} [options.throw_when_locked_by_other=false] - Throw rather
     *        than log when another user holds the lock
     * @returns {Promise<Object>} The same record
     * @private
     */
    async _lock_for_edit(record, uid, table_name, options = {}) {

        const {
            label,
            uuid = record.uuid,
            id_key = 'uuid',
            set_locked_at = true,
            throw_when_locked_by_other = false
        } = options;

        const uid_number = Number(uid);

        if (record.is_locked === 0) {

            try {

                await this.HELPER.lock_record(uid, uuid, this.DB, this.TABLE[table_name]);

                record.is_locked = 1;
                record.locked_by_user = uid_number;

                if (set_locked_at) {
                    record.locked_at = new Date();
                }

                this._log_success(`${label} record locked for editing`, {
                    [id_key]: uuid,
                    locked_by: uid_number
                });

            } catch (lock_error) {
                LOGGER.module().warn(`Failed to lock ${label.toLowerCase()} record`, {
                    [id_key]: uuid,
                    error: lock_error.message
                });
            }

            return record;
        }

        const locked_by_number = Number(record.locked_by_user);

        if (locked_by_number !== uid_number && throw_when_locked_by_other) {
            throw new Error(`${label} is locked by another user (ID: ${record.locked_by_user})`);
        }

        const status = locked_by_number === uid_number ? 'by this user' : 'by another user';

        this._log_success(`${label} record already locked ${status}`, {
            [id_key]: uuid,
            locked_by: record.locked_by_user
        });

        return record;
    }

    /**
     * Sanitizes, guards and applies an update scoped to one record:
     * exists-check -> is_deleted guard -> update -> "no rows affected" guard.
     *
     * @param {string} table_name - Table name key
     * @param {Object} where_clause - Scope identifying the record (no is_deleted)
     * @param {Object} data - Caller data, sanitized against allowed_fields
     * @param {Object} options
     * @param {Array<string>} options.allowed_fields - Update whitelist
     * @param {Array<string>} [options.skip_fields=[]] - Keys to drop silently
     * @param {string} options.label - Human label, e.g. 'Grid item'
     * @param {string} [options.uuid] - uuid echoed in the result; defaults to where.uuid
     * @param {string} [options.updated_by=null] - User ID
     * @param {Array<string>} [options.select_fields] - Columns the exists check reads
     * @param {boolean} [options.touch_updated=false] - Also set `updated`
     * @param {boolean} [options.warn_when_locked=false] - Log when another user holds the lock
     * @param {string} [options.no_rows_message] - Thrown when 0 rows changed
     * @returns {Promise<Object>} {success, uuid, affected_rows, fields_updated, message},
     *          or a {no_change: true} envelope when the whitelist left nothing to write
     * @private
     */
    async _update_scoped(table_name, where_clause, data, options = {}) {

        const {
            allowed_fields,
            skip_fields = [],
            label,
            uuid = where_clause.uuid,
            updated_by = null,
            select_fields = ['id', 'uuid', 'is_deleted'],
            touch_updated = false,
            warn_when_locked = false,
            no_rows_message = 'Update failed: No rows affected'
        } = options;

        this._validate_database();
        this._validate_table(table_name);

        const {sanitized_data} = this._sanitize_data(data, allowed_fields, skip_fields);

        if (Object.keys(sanitized_data).length === 0) {
            return {
                success: true,
                no_change: true,
                uuid,
                affected_rows: 0,
                message: 'No fields to update'
            };
        }

        if (touch_updated) {
            sanitized_data.updated = this.DB.fn.now();
        }

        if (updated_by) {
            sanitized_data.updated_by = updated_by;
        }

        const existing = await this.DB(this.TABLE[table_name])
            .select(...select_fields)
            .where(where_clause)
            .first()
            .timeout(this.QUERY_TIMEOUT);

        if (!existing) {
            throw new Error(`${label} record not found`);
        }

        if (existing.is_deleted === 1) {
            throw new Error(`Cannot update deleted ${label.toLowerCase()} record`);
        }

        if (warn_when_locked && existing.is_locked === 1 && updated_by
            && String(existing.locked_by_user) !== String(updated_by)) {
            LOGGER.module().warn('Attempting to update locked record', {
                uuid,
                locked_by: existing.locked_by_user,
                attempted_by: updated_by
            });
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({...where_clause, is_deleted: 0})
            .update(sanitized_data)
            .timeout(this.QUERY_TIMEOUT);

        if (affected_rows === 0) {
            throw new Error(no_rows_message);
        }

        const fields_updated = Object.keys(sanitized_data);

        this._log_success(`${label} record updated successfully`, {
            uuid,
            fields_updated,
            affected_rows,
            updated_by
        });

        return {
            success: true,
            uuid,
            affected_rows,
            fields_updated,
            message: `${label} record updated successfully`
        };
    }

    /**
     * Exists-check -> already-deleted short circuit -> soft delete -> row guard.
     *
     * The public result envelopes differ per type (`uuid` vs `grid_item_id`,
     * some carry `title` or `type`), so this returns the raw outcome and each
     * caller builds its own envelope.
     *
     * @param {string} table_name - Table name key
     * @param {Object} where_clause - Scope identifying the record (no is_deleted)
     * @param {Object} options
     * @param {string} options.label - Human label, e.g. 'Grid item'
     * @param {string} [options.deleted_by=null] - User ID
     * @param {Array<string>} [options.select_fields] - Columns the exists check reads
     * @param {boolean} [options.touch_updated=true] - Also set `updated`
     * @param {boolean} [options.warn_when_locked=false] - Log when another user holds the lock
     * @param {string} [options.not_found_message] - Thrown when the row is absent
     * @param {string} [options.no_rows_message] - Thrown when 0 rows changed
     * @returns {Promise<Object>} {already_deleted, existing, affected_rows}
     * @private
     */
    async _soft_delete_scoped(table_name, where_clause, options = {}) {

        const {
            label,
            deleted_by = null,
            select_fields = ['id', 'uuid', 'is_deleted'],
            touch_updated = true,
            warn_when_locked = false,
            not_found_message = `${label} record not found`,
            no_rows_message = `Failed to delete ${label.toLowerCase()} record: No rows affected`
        } = options;

        this._validate_database();
        this._validate_table(table_name);

        const existing = await this.DB(this.TABLE[table_name])
            .select(...select_fields)
            .where(where_clause)
            .first()
            .timeout(this.QUERY_TIMEOUT);

        if (!existing) {
            throw new Error(not_found_message);
        }

        if (existing.is_deleted === 1) {
            return {already_deleted: true, existing, affected_rows: 0};
        }

        if (warn_when_locked && existing.is_locked === 1 && deleted_by
            && String(existing.locked_by_user) !== String(deleted_by)) {
            LOGGER.module().warn('Attempting to delete locked record', {
                uuid: existing.uuid,
                locked_by: existing.locked_by_user,
                attempted_by: deleted_by
            });
        }

        const update_data = {is_deleted: 1};

        if (touch_updated) {
            update_data.updated = this.DB.fn.now();
        }

        if (deleted_by) {
            update_data.updated_by = deleted_by;
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({...where_clause, is_deleted: 0})
            .update(update_data)
            .timeout(this.QUERY_TIMEOUT);

        if (affected_rows === 0) {
            throw new Error(no_rows_message);
        }

        return {already_deleted: false, existing, affected_rows};
    }

    /**
     * Adds the media-library projection and its two LEFT JOINs to a query.
     *
     * See MEDIA_LIBRARY_PROJECTIONS above for why the three variants are kept
     * apart instead of unified.
     *
     * @param {Object} query - Knex query builder for the item table
     * @param {string} table_name - Table name key of the item table
     * @param {string} variant - 'list' | 'edit' | 'timeline_edit'
     * @returns {Object} The query, for chaining
     * @private
     */
    _with_media_library(query, table_name, variant) {

        const projection = MEDIA_LIBRARY_PROJECTIONS[variant];

        if (!projection) {
            throw new Error(`Unknown media library projection variant: ${variant}`);
        }

        const table = this.TABLE[table_name];
        const media_table = this.TABLE.media_library_records;

        const columns = projection.map((entry) => {

            if (Array.isArray(entry)) {
                const [source, alias] = entry;
                return alias ? `${source} as ${alias}` : source;
            }

            return KALTURA_THUMBNAIL.kaltura_thumbnail_url_sql(this.DB, entry.kaltura, entry.as);
        });

        return query
            .select(`${table}.*`, ...columns)
            .leftJoin(
                `${media_table} as media_lib`,
                `${table}.media_uuid`,
                '=',
                `media_lib.uuid`
            )
            .leftJoin(
                `${media_table} as thumb_lib`,
                `${table}.thumbnail_media_uuid`,
                '=',
                `thumb_lib.uuid`
            );
    }

    /**
     * Generic update publish status for multiple records
     * @param {string} table_name - Table name
     * @param {Object} where_clause - Where conditions
     * @param {number} status - 0 or 1
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     * @private
     */
    async _update_publish_status(table_name, where_clause, status, updated_by = null) {
        this._validate_database();
        this._validate_table(table_name);

        if (![0, 1].includes(status)) {
            throw new Error('Status must be 0 or 1');
        }

        /*
         * A publish-state change is an edit: bump `updated` so list sorting and
         * the "last updated" display reflect it, for EVERY record type.
         */
        const update_data = {
            is_published: status,
            updated: this.DB.fn.now()
        };
        if (updated_by) {
            update_data.updated_by = updated_by;
        }

        /*
         * Recycled rows are never part of a bulk publish/suppress: publishing
         * an exhibit must not resurrect items a curator threw away, and
         * suppressing must not rewrite the bin (pinned by
         * test/db/publish_gate_counts). Callers pass the exhibit scope.
         */
        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({ ...where_clause, is_deleted: 0 })
            .update(update_data)
            .timeout(this.QUERY_TIMEOUT);

        return {
            success: true,
            affected_rows,
            status: status === 1 ? 'published' : 'suppressed',
            message: `Records ${status === 1 ? 'published' : 'suppressed'} successfully`
        };
    }

    /**
     * Generic update single record publish status
     * @param {string} table_name - Table name
     * @param {string} uuid - Record UUID
     * @param {number} status - 0 or 1
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     * @private
     */
    async _update_single_publish_status(table_name, uuid, status, updated_by = null) {
        this._validate_database();
        this._validate_table(table_name);

        const uuid_trimmed = this._validate_uuid(uuid, `${table_name} UUID`);

        if (![0, 1].includes(status)) {
            throw new Error('Status must be 0 or 1');
        }

        const update_data = {
            is_published: status,
            updated: this.DB.fn.now()
        };
        if (updated_by) {
            update_data.updated_by = updated_by;
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({uuid: uuid_trimmed})
            .update(update_data)
            .timeout(this.QUERY_TIMEOUT);

        if (affected_rows === 0) {
            throw new Error(`No ${table_name} record found or updated`);
        }

        return {
            success: true,
            uuid: uuid_trimmed,
            affected_rows,
            updated_by,
            message: `${table_name} record ${status === 1 ? 'published' : 'suppressed'} successfully`
        };
    }

    /**
     * Generic reorder function
     * @param {string} table_name - Table name
     * @param {Object} where_clause - Where conditions
     * @param {Object} item - Item with uuid and order
     * @returns {Promise<Object>} Reorder result
     * @private
     */
    async _reorder_items(table_name, where_clause, item) {

        this._validate_database();
        this._validate_table(table_name);

        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error('Valid item object is required');
        }

        if (!item.uuid || typeof item.order !== 'number') {
            throw new Error('Item must have uuid and order properties');
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({
                ...where_clause,
                uuid: item.uuid
            })
            .update({order: item.order})
            .timeout(this.QUERY_TIMEOUT);

        return {
            success: true,
            affected_rows,
            uuid: item.uuid,
            order: item.order,
            message: `${table_name} reordered successfully`
        };
    }
};

/**
 * Defines table-driven publish/suppress methods on a task class.
 *
 * The `set_*_to_publish` / `set_*_to_suppress` / `set_exhibit_*_items_to_*`
 * methods across the four task classes are the same three lines each: validate
 * the uuid, call a publish-status helper, log. Each type declares a spec table
 * next to its class and this generator writes the methods.
 *
 * THE METHOD NAMES ARE LOAD-BEARING. `indexer/model.js` dispatches
 * `set_grid_item_to_publish` and `set_timeline_item_to_publish` BY STRING
 * (`record_task[set_publish_method](item.uuid)`), so a rename here is a silent
 * runtime break.
 *
 * Spec fields:
 *   method   - the public method name (never change one)
 *   table    - table name key the update runs against
 *   status   - 1 to publish, 0 to suppress
 *   log      - success message
 *   mode     - 'bulk'   : validate the uuid here, then _update_publish_status
 *              'single' : hand the raw uuid to _update_single_publish_status
 *   scope    - bulk only: the WHERE column the validated uuid goes in
 *   label    - bulk only: uuid label for the validation error message
 *   log_key  - key the uuid is logged under (default 'uuid')
 *   contract - 'result'  : resolve the result object, throw via _handle_error
 *              'boolean' : resolve true, log-and-resolve false on error
 *
 * @param {Function} target_class - Task class whose prototype gains the methods
 * @param {Array<Object>} specs - Spec table
 */
const define_publish_ops = (target_class, specs) => {

    for (const spec of specs) {

        const {
            method, table, status, log, mode = 'bulk',
            scope = null, label = 'UUID', log_key = 'uuid', contract = 'result'
        } = spec;

        const operation = async function (uuid, updated_by = null) {

            try {

                let result;
                let logged_uuid = uuid;

                if (mode === 'single') {
                    result = await this._update_single_publish_status(table, uuid, status, updated_by);
                } else {
                    logged_uuid = this._validate_uuid(uuid, label);
                    result = await this._update_publish_status(
                        table,
                        {[scope]: logged_uuid},
                        status,
                        updated_by
                    );
                }

                this._log_success(log, {
                    [log_key]: logged_uuid,
                    affected_rows: result.affected_rows
                });

                return contract === 'boolean' ? true : result;

            } catch (error) {

                if (contract === 'boolean') {
                    LOGGER.module().error(`Failed to ${status === 1 ? 'publish' : 'suppress'} ${spec.record_label} record: ` + error.message);
                    return false;
                }

                this._handle_error(error, method, {uuid});
            }
        };

        Object.defineProperty(operation, 'name', {value: method, configurable: true});

        Object.defineProperty(target_class.prototype, method, {
            value: operation,
            writable: true,
            enumerable: false,
            configurable: true
        });
    }
};

Base_tasks.define_publish_ops = define_publish_ops;
Base_tasks.MEDIA_LIBRARY_PROJECTIONS = MEDIA_LIBRARY_PROJECTIONS;

module.exports = Base_tasks;
