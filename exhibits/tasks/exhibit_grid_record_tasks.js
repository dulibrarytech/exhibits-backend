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

const LOGGER = require('../../libs/log4');
const HELPER = require('../../libs/helper');

/**
 * Object contains tasks used to manage exhibit grid and grid item records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_grid_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
        this.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        this.QUERY_TIMEOUT = 10000;
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
     * Validates that a specific table exists
     * @param {string} table_name - Name of the table to validate
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
            // Skip identifier fields
            if (skip_fields.includes(key)) {
                continue;
            }

            // Security: prevent prototype pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                LOGGER.module().warn('Dangerous property skipped', {key});
                continue;
            }

            // Whitelist check
            if (allowed_fields.includes(key)) {
                sanitized_data[key] = value;
            } else {
                invalid_fields.push(key);
            }
        }

        // Warn about invalid fields
        if (invalid_fields.length > 0) {
            LOGGER.module().warn('Invalid fields ignored', {
                fields: invalid_fields
            });
        }

        return {sanitized_data, invalid_fields};
    }

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

    /**
     * Sets default values for grid item fields
     * @param {Object} data - Data object to set defaults on
     * @private
     */
    _set_grid_item_defaults(data) {
        const defaults = {
            item_type: 'image',
            type: 'item',
            layout: 'media_top',
            wrap_text: 1,
            media_width: 50,
            media_padding: 1,
            is_alt_text_decorative: 0,
            pdf_open_to_page: 1,
            order: 0,
            is_repo_item: 0,
            is_kaltura_item: 0,
            is_embedded: 0,
            is_published: 0,
            is_locked: 0,
            locked_by_user: 0,
            is_deleted: 0,
            owner: 0
        };

        for (const [key, default_value] of Object.entries(defaults)) {
            if (data[key] === undefined) {
                data[key] = default_value;
            }
        }
    }

    /**
     * Sets default values for grid fields
     * @param {Object} data - Data object to set defaults on
     * @private
     */
    _set_grid_defaults(data) {
        const defaults = {
            type: 'grid',
            columns: 4,
            order: 0,
            is_published: 0,
            is_deleted: 0,
            owner: 0
        };

        for (const [key, default_value] of Object.entries(defaults)) {
            if (data[key] === undefined) {
                data[key] = default_value;
            }
        }
    }

    // ==================== COMMON OPERATIONS ====================

    /**
     * Generic update publish status for any table
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

        // Check existing records
        const existing_count = await this.DB(this.TABLE[table_name])
            .count('id as count')
            .where({
                ...where_clause,
                is_deleted: 0
            })
            .timeout(this.QUERY_TIMEOUT);

        const total_records = existing_count?.[0]?.count ? parseInt(existing_count[0].count, 10) : 0;

        if (total_records === 0) {
            return {
                success: true,
                affected_rows: 0,
                total_records: 0,
                message: `No records found to ${status === 1 ? 'publish' : 'suppress'}`
            };
        }

        const update_data = {
            is_published: status,
            updated: this.DB.fn.now()
        };

        if (updated_by) {
            update_data.updated_by = updated_by;
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({
                ...where_clause,
                is_deleted: 0
            })
            .update(update_data)
            .timeout(this.QUERY_TIMEOUT);

        return {
            success: true,
            affected_rows,
            total_records,
            status: status === 1 ? 'published' : 'suppressed',
            updated_by,
            message: `${affected_rows} record(s) ${status === 1 ? 'published' : 'suppressed'} successfully`
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

        // Check if record exists
        const existing = await this.DB(this.TABLE[table_name])
            .select('id', 'uuid', 'title', 'is_published', 'is_deleted')
            .where({uuid: uuid_trimmed})
            .first()
            .timeout(this.QUERY_TIMEOUT);

        if (!existing) {
            throw new Error(`${table_name} record not found`);
        }

        if (existing.is_deleted === 1) {
            throw new Error(`Cannot ${status === 1 ? 'publish' : 'suppress'} deleted ${table_name} record`);
        }

        if (existing.is_published === status) {
            return {
                success: true,
                already_set: true,
                uuid: uuid_trimmed,
                message: `${table_name} was already ${status === 1 ? 'published' : 'suppressed'}`
            };
        }

        const update_data = {
            is_published: status,
            updated: this.DB.fn.now()
        };

        if (updated_by) {
            update_data.updated_by = updated_by;
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({
                uuid: uuid_trimmed,
                is_deleted: 0
            })
            .update(update_data)
            .timeout(this.QUERY_TIMEOUT);

        if (affected_rows === 0) {
            throw new Error(`Failed to ${status === 1 ? 'publish' : 'suppress'} ${table_name} record: No rows affected`);
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

        if (!item.uuid || typeof item.order !== 'string') {
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

    // ==================== GRID RECORDS ====================

    /**
     * Creates a new grid record in the database
     * @param {Object} data - Grid record data
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created grid record with ID
     */
    async create_grid_record(data, created_by = null) {

        const ALLOWED_FIELDS = [
            'uuid', 'is_member_of_exhibit', 'type', 'columns', 'title',
            'text', 'styles', 'order', 'is_published', 'owner', 'created_by'
        ];

        try {
            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('grid_records');

            const {sanitized_data} = this._sanitize_data(data, ALLOWED_FIELDS);

            if (Object.keys(sanitized_data).length === 0) {
                throw new Error('No valid fields provided for insert');
            }

            // Set defaults
            this._set_grid_defaults(sanitized_data);

            // Add timestamps and metadata
            sanitized_data.created = this.DB.fn.now();
            sanitized_data.updated = this.DB.fn.now();

            if (created_by) {
                sanitized_data.created_by = created_by;
                sanitized_data.updated_by = created_by;
            }

            // Insert in transaction
            const created_record = await this.DB.transaction(async (trx) => {
                const [insert_id] = await trx(this.TABLE.grid_records)
                    .insert(sanitized_data)
                    .timeout(this.QUERY_TIMEOUT);

                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                const record = await trx(this.TABLE.grid_records)
                    .where({id: insert_id})
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                this._log_success('Grid record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    created_by
                });

                return record;
            });

            return created_record;

        } catch (error) {
            this._handle_error(error, 'create_grid_record', {
                data_keys: Object.keys(data || {}),
                created_by
            });
        }
    }

    /**
     * Gets all grid records by exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @returns {Promise<Array>} Array of grid records
     */
    async get_grid_records(is_member_of_exhibit) {
        try {
            this._validate_database();
            this._validate_table('grid_records');

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            const results = await this.DB(this.TABLE.grid_records)
                .select('*')
                .where({
                    is_member_of_exhibit: exhibit_uuid,
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(this.QUERY_TIMEOUT);

            return results || [];

        } catch (error) {
            this._handle_error(error, 'get_grid_records', {
                is_member_of_exhibit
            });
        }
    }

    /**
     * Gets a single grid record by exhibit and grid UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} grid_id - The grid UUID
     * @returns {Promise<Object|null>} Grid record or null
     */
    async get_grid_record(is_member_of_exhibit, grid_id) {
        try {
            this._validate_database();
            this._validate_table('grid_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [grid_id]: 'grid UUID'
            });

            const record = await this.DB(this.TABLE.grid_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['grid UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('Grid record not found', validated);
                return null;
            }

            this._log_success('Grid record retrieved', {
                uuid: validated['grid UUID']
            });

            return record;

        } catch (error) {
            this._handle_error(error, 'get_grid_record', {
                is_member_of_exhibit,
                grid_id
            });
        }
    }

    /**
     * Updates a grid record
     * @param {Object} data - Grid data to update
     * @returns {Promise<boolean>} Update success status
     */
    async update_grid_record(data) {

        const UPDATABLE_FIELDS = [
            'type', 'columns', 'title', 'text', 'styles',
            'order', 'is_deleted', 'is_published', 'updated_by'
        ];

        try {
            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('grid_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'grid UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            const {sanitized_data} = this._sanitize_data(
                data,
                UPDATABLE_FIELDS,
                ['uuid', 'is_member_of_exhibit']
            );

            if (Object.keys(sanitized_data).length === 0) {
                LOGGER.module().error('No valid fields to update');
                return false;
            }

            const rows_affected = await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['grid UUID'],
                    is_deleted: 0
                })
                .update(sanitized_data)
                .timeout(this.QUERY_TIMEOUT);

            if (rows_affected === 0) {
                LOGGER.module().warn('No grid record found or updated');
                return false;
            }

            this._log_success('Grid record updated successfully', {
                uuid: validated['grid UUID']
            });

            return true;

        } catch (error) {
            this._handle_error(error, 'update_grid_record', {
                uuid: data?.uuid
            });
        }
    }

    /**
     * Gets the count of grid records for an exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {Object} [options={}] - Count options
     * @returns {Promise<number>} Count of grid records
     */
    async get_record_count(is_member_of_exhibit, options = {}) {

        const {
            include_deleted = false,
            include_unpublished = true
        } = options;

        try {
            this._validate_database();
            this._validate_table('grid_records');

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            let query = this.DB(this.TABLE.grid_records)
                .count('id as count')
                .where({is_member_of_exhibit: exhibit_uuid});

            if (!include_deleted) {
                query = query.where({is_deleted: 0});
            }

            if (!include_unpublished) {
                query = query.where({is_published: 1});
            }

            const result = await query.timeout(this.QUERY_TIMEOUT);
            const count = result?.[0]?.count ? parseInt(result[0].count, 10) : 0;

            this._log_success('Grid record count retrieved', {
                is_member_of_exhibit: exhibit_uuid,
                count
            });

            return count;

        } catch (error) {
            this._handle_error(error, 'get_grid_record_count', {
                is_member_of_exhibit
            });
        }
    }

    // ==================== GRID ITEM RECORDS ====================

    /**
     * Gets all grid item records for a grid
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_grid - The grid UUID
     * @returns {Promise<Array>} Array of grid item records
     */
    async get_grid_item_records(is_member_of_exhibit, is_member_of_grid) {
        try {
            this._validate_database();
            this._validate_table('grid_item_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [is_member_of_grid]: 'grid UUID'
            });

            const records = await this.DB(this.TABLE.grid_item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_grid: validated['grid UUID'],
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Grid item records retrieved', {
                ...validated,
                count: records.length
            });

            return records || [];

        } catch (error) {
            this._handle_error(error, 'get_grid_item_records', {
                is_member_of_exhibit,
                is_member_of_grid
            });
        }
    }

    /**
     * Creates a new grid item record
     * @param {Object} data - Grid item record data
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created grid item record
     */
    async create_grid_item_record(data, created_by = null) {

        const ALLOWED_FIELDS = [
            'uuid', 'is_member_of_grid', 'is_member_of_exhibit', 'repo_uuid',
            'thumbnail', 'title', 'caption', 'item_type', 'mime_type', 'media',
            'text', 'wrap_text', 'description', 'type', 'layout', 'media_width',
            'media_padding', 'alt_text', 'is_alt_text_decorative', 'pdf_open_to_page',
            'item_subjects', 'styles', 'order', 'date', 'is_repo_item', 'is_kaltura_item',
            'is_embedded', 'is_published', 'is_locked', 'locked_by_user', 'locked_at',
            'is_deleted', 'owner'
        ];

        try {
            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('grid_item_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'grid item UUID',
                [data.is_member_of_grid]: 'grid UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            // this._validate_string(data.title, 'grid item title');

            const {sanitized_data} = this._sanitize_data(data, ALLOWED_FIELDS);

            // Set defaults
            this._set_grid_item_defaults(sanitized_data);

            if (created_by) {
                sanitized_data.created_by = created_by;
                sanitized_data.updated_by = created_by;
            }

            const created_record = await this.DB.transaction(async (trx) => {
                const [insert_id] = await trx(this.TABLE.grid_item_records)
                    .insert(sanitized_data)
                    .timeout(this.QUERY_TIMEOUT);

                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                const record = await trx(this.TABLE.grid_item_records)
                    .select('*')
                    .where({id: insert_id})
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                this._log_success('Grid item record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    created_by
                });

                return record;
            });

            return {
                success: true,
                id: created_record.id,
                uuid: created_record.uuid,
                record: created_record,
                message: 'Grid item record created successfully'
            };

        } catch (error) {
            this._handle_error(error, 'create_grid_item_record', {
                uuid: data?.uuid,
                created_by
            });
        }
    }

    /**
     * Gets a single grid item record
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} grid_id - The grid UUID
     * @param {string} item_id - The item UUID
     * @returns {Promise<Object|null>} Grid item record or null
     */
    async get_grid_item_record(is_member_of_exhibit, grid_id, item_id) {
        try {
            this._validate_database();
            this._validate_table('grid_item_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [grid_id]: 'grid UUID',
                [item_id]: 'item UUID'
            });

            const record = await this.DB(this.TABLE.grid_item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_grid: validated['grid UUID'],
                    uuid: validated['item UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('Grid item record not found', validated);
                return null;
            }

            this._log_success('Grid item record retrieved', {
                uuid: validated['item UUID']
            });

            return record;

        } catch (error) {
            this._handle_error(error, 'get_grid_item_record', {
                is_member_of_exhibit,
                grid_id,
                item_id
            });
        }
    }

    /**
     * Gets a grid item record for editing and locks it
     * @param {string|number} uid - User ID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} grid_id - The grid UUID
     * @param {string} item_id - The item UUID
     * @returns {Promise<Object|null>} Grid item record with lock status
     */
    async get_grid_item_edit_record(uid, is_member_of_exhibit, grid_id, item_id) {
        try {
            this._validate_database();
            this._validate_table('grid_item_records');

            if (uid === null || uid === undefined || uid === '') {
                throw new Error('Valid user ID is required');
            }

            const uid_number = Number(uid);
            if (isNaN(uid_number)) {
                throw new Error('User ID must be a valid number');
            }

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [grid_id]: 'grid UUID',
                [item_id]: 'item UUID'
            });

            const record = await this.DB(this.TABLE.grid_item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_grid: validated['grid UUID'],
                    uuid: validated['item UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('Grid item record not found', validated);
                return null;
            }

            // Handle locking
            if (record.is_locked === 0) {
                try {
                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(
                        uid,
                        validated['item UUID'],
                        this.DB,
                        this.TABLE.grid_item_records
                    );

                    record.is_locked = 1;
                    record.locked_by_user = uid_number;
                    record.locked_at = new Date();

                    this._log_success('Grid item record locked for editing', {
                        item_id: validated['item UUID'],
                        locked_by: uid_number
                    });

                } catch (lock_error) {
                    LOGGER.module().warn('Failed to lock grid item record', {
                        item_id: validated['item UUID'],
                        error: lock_error.message
                    });
                }
            } else {
                const locked_by_number = Number(record.locked_by_user);
                const status = locked_by_number === uid_number ? 'by this user' : 'by another user';
                this._log_success(`Grid item record already locked ${status}`, {
                    item_id: validated['item UUID'],
                    locked_by: record.locked_by_user
                });
            }

            return record;

        } catch (error) {
            this._handle_error(error, 'get_grid_item_edit_record', {
                uid,
                item_id
            });
        }
    }

    /**
     * Updates a grid item record
     * @param {Object} data - Grid item data to update
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result
     */
    async update_grid_item_record(data, updated_by = null) {

        const UPDATABLE_FIELDS = [
            'repo_uuid', 'thumbnail', 'title', 'caption', 'item_type', 'mime_type',
            'media', 'text', 'wrap_text', 'description', 'type', 'layout',
            'media_width', 'media_padding', 'alt_text', 'is_alt_text_decorative',
            'pdf_open_to_page', 'item_subjects', 'styles', 'order', 'date',
            'is_repo_item', 'is_kaltura_item', 'is_embedded', 'is_published',
            'is_locked', 'locked_by_user', 'locked_at', 'owner'
        ];

        try {
            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('grid_item_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'grid item UUID',
                [data.is_member_of_grid]: 'grid UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            const {sanitized_data} = this._sanitize_data(
                data,
                UPDATABLE_FIELDS,
                ['uuid', 'is_member_of_grid', 'is_member_of_exhibit']
            );

            if (Object.keys(sanitized_data).length === 0) {
                return {
                    success: true,
                    no_change: true,
                    uuid: validated['grid item UUID'],
                    affected_rows: 0,
                    message: 'No fields to update'
                };
            }

            if (updated_by) {
                sanitized_data.updated_by = updated_by;
            }

            // Check record exists
            const existing = await this.DB(this.TABLE.grid_item_records)
                .select('id', 'uuid', 'is_deleted', 'is_locked', 'locked_by_user')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_grid: validated['grid UUID'],
                    uuid: validated['grid item UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error('Grid item record not found');
            }

            if (existing.is_deleted === 1) {
                throw new Error('Cannot update deleted grid item record');
            }

            if (existing.is_locked === 1 && updated_by) {
                if (String(existing.locked_by_user) !== String(updated_by)) {
                    LOGGER.module().warn('Attempting to update locked record', {
                        uuid: validated['grid item UUID'],
                        locked_by: existing.locked_by_user,
                        attempted_by: updated_by
                    });
                }
            }

            const affected_rows = await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_grid: validated['grid UUID'],
                    uuid: validated['grid item UUID'],
                    is_deleted: 0
                })
                .update(sanitized_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Update failed: No rows affected');
            }

            this._log_success('Grid item record updated successfully', {
                uuid: validated['grid item UUID'],
                fields_updated: Object.keys(sanitized_data),
                affected_rows,
                updated_by
            });

            return {
                success: true,
                uuid: validated['grid item UUID'],
                affected_rows,
                fields_updated: Object.keys(sanitized_data),
                message: 'Grid item record updated successfully'
            };

        } catch (error) {
            this._handle_error(error, 'update_grid_item_record', {
                uuid: data?.uuid,
                updated_by
            });
        }
    }

    /**
     * Soft deletes a grid item record
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} grid_id - The grid UUID
     * @param {string} grid_item_id - The grid item UUID
     * @param {string} [deleted_by=null] - User ID performing the deletion
     * @returns {Promise<Object>} Delete result
     */
    async delete_grid_item_record(is_member_of_exhibit, grid_id, grid_item_id, deleted_by = null) {
        try {
            this._validate_database();
            this._validate_table('grid_item_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [grid_id]: 'grid UUID',
                [grid_item_id]: 'grid item UUID'
            });

            const existing = await this.DB(this.TABLE.grid_item_records)
                .select('id', 'uuid', 'title', 'is_deleted')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_grid: validated['grid UUID'],
                    uuid: validated['grid item UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error('Grid item record not found');
            }

            if (existing.is_deleted === 1) {
                return {
                    success: true,
                    already_deleted: true,
                    grid_item_id: validated['grid item UUID'],
                    message: 'Grid item was already deleted'
                };
            }

            const update_data = {
                is_deleted: 1,
                updated: this.DB.fn.now()
            };

            if (deleted_by) {
                update_data.updated_by = deleted_by;
            }

            const affected_rows = await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_grid: validated['grid UUID'],
                    uuid: validated['grid item UUID'],
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Failed to delete grid item record: No rows affected');
            }

            this._log_success('Grid item record deleted successfully', {
                grid_item_id: validated['grid item UUID'],
                affected_rows,
                deleted_by
            });

            return {
                success: true,
                grid_item_id: validated['grid item UUID'],
                affected_rows,
                deleted_by,
                message: 'Grid item record deleted successfully'
            };

        } catch (error) {
            this._handle_error(error, 'delete_grid_item_record', {
                is_member_of_exhibit,
                grid_id,
                grid_item_id,
                deleted_by
            });
        }
    }

    // ==================== PUBLISHING / SUPPRESSING ====================

    /**
     * Publishes all grids for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<Object>} Publish result
     */
    async set_to_publish(uuid, published_by = null) {
        try {
            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'grid_records',
                {is_member_of_exhibit: exhibit_uuid},
                1,
                published_by
            );

            this._log_success('Grid records published', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_to_publish', {uuid});
        }
    }

    /**
     * Publishes a single grid item
     * @param {string} uuid - Grid item UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<Object>} Publish result
     */
    async set_grid_item_to_publish(uuid, published_by = null) {
        try {
            const result = await this._update_single_publish_status(
                'grid_item_records',
                uuid,
                1,
                published_by
            );

            this._log_success('Grid item record published', {
                uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_grid_item_to_publish', {uuid});
        }
    }

    /**
     * Publishes all grid items for a grid
     * @param {string} uuid - Grid UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<Object>} Publish result
     */
    async set_to_publish_grid_items(uuid, published_by = null) {
        try {
            const grid_uuid = this._validate_uuid(uuid, 'grid UUID');
            const result = await this._update_publish_status(
                'grid_item_records',
                {is_member_of_grid: grid_uuid},
                1,
                published_by
            );

            this._log_success('Grid item records published', {
                grid_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_to_publish_grid_items', {uuid});
        }
    }

    /**
     * Publishes a single grid
     * @param {string} uuid - Grid UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<Object>} Publish result
     */
    async set_grid_to_publish(uuid, published_by = null) {
        try {
            const result = await this._update_single_publish_status(
                'grid_records',
                uuid,
                1,
                published_by
            );

            this._log_success('Grid record published', {
                uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_grid_to_publish', {uuid});
        }
    }

    /**
     * Suppresses all grids for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<Object>} Suppress result
     */
    async set_to_suppress(uuid, unpublished_by = null) {
        try {
            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'grid_records',
                {is_member_of_exhibit: exhibit_uuid},
                0,
                unpublished_by
            );

            this._log_success('Grid records suppressed', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_to_suppress', {uuid});
        }
    }

    /**
     * Suppresses a single grid
     * @param {string} uuid - Grid UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<Object>} Suppress result
     */
    async set_grid_to_suppress(uuid, unpublished_by = null) {
        try {
            const result = await this._update_single_publish_status(
                'grid_records',
                uuid,
                0,
                unpublished_by
            );

            this._log_success('Grid record suppressed', {
                uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_grid_to_suppress', {uuid});
        }
    }

    /**
     * Suppresses all grid items for a grid
     * @param {string} uuid - Grid UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<Object>} Suppress result
     */
    async set_to_suppressed_grid_items(uuid, unpublished_by = null) {
        try {
            const grid_uuid = this._validate_uuid(uuid, 'grid UUID');

            const result = await this._update_publish_status(
                'grid_item_records',
                {is_member_of_grid: grid_uuid},
                0,
                unpublished_by
            );

            this._log_success('Grid item records suppressed', {
                grid_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_to_suppressed_grid_items', {uuid});
        }
    }

    // ==================== REORDERING ====================

    /**
     * Reorders grids
     * @param {string} is_member_of_exhibit - Exhibit UUID
     * @param {Object} grids - Grid object with uuid and order
     * @returns {Promise<boolean>} Reorder success status
     */
    async reorder_grids(is_member_of_exhibit, grids) {
        try {
            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            await this._reorder_items(
                'grid_records',
                {is_member_of_exhibit: exhibit_uuid},
                grids
            );

            this._log_success('Grid reordered', {
                exhibit_uuid,
                uuid: grids.uuid,
                order: grids.order
            });

            return true;

        } catch (error) {
            this._handle_error(error, 'reorder_grids', {
                is_member_of_exhibit
            });
        }
    }

    /**
     * Reorders grid items
     * @param {string} is_member_of_grid - Grid UUID
     * @param {Object} grids - Grid item object with uuid and order
     * @returns {Promise<boolean>} Reorder success status
     */
    async reorder_grid_items(is_member_of_grid, grids) {
        console.log('REORDER GRID ITEMS');
        try {
            const grid_uuid = this._validate_uuid(is_member_of_grid, 'grid UUID');
            console.log('GRID UUID', grid_uuid);
            console.log('GRIDS ', grids)
            await this._reorder_items(
                'grid_item_records',
                {is_member_of_grid: grid_uuid},
                grids
            );

            this._log_success('Grid item reordered', {
                grid_uuid,
                uuid: grids.uuid,
                order: grids.order
            });

            return true;

        } catch (error) {
            this._handle_error(error, 'reorder_grid_items', {
                is_member_of_grid
            });
        }
    }
};

module.exports = Exhibit_grid_record_tasks;