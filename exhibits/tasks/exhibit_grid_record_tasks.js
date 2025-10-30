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

const LOGGER = require('../../libs/log4');
const HELPER = require("../../libs/helper");

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
    }

    /**
     * Creates grid record
     * @param data
     */
    /**
     * Creates a new grid record in the database
     * @param {Object} data - Grid record data
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created grid record with ID
     * @throws {Error} If validation fails or creation fails
     */
    async create_grid_record(data, created_by = null) {
        // Define whitelist of allowed fields
        const ALLOWED_FIELDS = [
            'uuid',
            'is_member_of_exhibit',
            'type',
            'columns',
            'title',
            'text',
            'styles',
            'order',
            'is_published',
            'owner',
            'created_by'
        ];

        try {
            // ===== INPUT VALIDATION =====

            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Data must be a valid object');
            }

            if (Object.keys(data).length === 0) {
                throw new Error('Data object cannot be empty');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_records) {
                throw new Error('Table name "grid_records" is not defined');
            }

            // ===== SANITIZE AND VALIDATE DATA =====

            const sanitized_data = {};
            const invalid_fields = [];

            for (const [key, value] of Object.entries(data)) {
                // Security: prevent prototype pollution
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    LOGGER.module().warn('Dangerous property skipped', { key });
                    continue;
                }

                // Whitelist check
                if (ALLOWED_FIELDS.includes(key)) {
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

            // Check if we have any valid data
            if (Object.keys(sanitized_data).length === 0) {
                throw new Error('No valid fields provided for insert');
            }

            // ===== ADD METADATA =====

            // Add timestamps
            sanitized_data.created = this.DB.fn.now();
            sanitized_data.updated = this.DB.fn.now();

            // Add created_by if provided
            if (created_by) {
                sanitized_data.created_by = created_by;
                sanitized_data.updated_by = created_by;
            }

            // Add default values if not provided
            if (sanitized_data.type === undefined) {
                sanitized_data.type = 'grid';
            }
            if (sanitized_data.columns === undefined) {
                sanitized_data.columns = 4;
            }
            if (sanitized_data.order === undefined) {
                sanitized_data.order = 0;
            }
            if (sanitized_data.is_published === undefined) {
                sanitized_data.is_published = 0;
            }
            if (sanitized_data.is_deleted === undefined) {
                sanitized_data.is_deleted = 0;
            }
            if (sanitized_data.owner === undefined) {
                sanitized_data.owner = 0;
            }

            // ===== PERFORM INSERT IN TRANSACTION =====

            const created_record = await this.DB.transaction(async (trx) => {
                // Insert the record
                const [insert_id] = await trx(this.TABLE.grid_records)
                    .insert(sanitized_data)
                    .timeout(10000);

                // Verify insert succeeded
                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                // Fetch and return the created record
                const record = await trx(this.TABLE.grid_records)
                    .where({ id: insert_id })
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                LOGGER.module().info('Grid record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    is_member_of_exhibit: record.is_member_of_exhibit,
                    created_by,
                    timestamp: new Date().toISOString()
                });

                return record;
            });

            return created_record;

        } catch (error) {
            const error_context = {
                method: 'create_grid_record',
                data_keys: Object.keys(data || {}),
                created_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to create grid record',
                error_context
            );

            throw error;
        }
    }

    async get_grid_records(is_member_of_exhibit) {

        /**
         * Validate exhibit ID format
         */
        const is_valid_exhibit_id = (exhibit_id) => {
            if (typeof exhibit_id !== 'string' && typeof exhibit_id !== 'number') {
                return false;
            }

            // If it's a UUID format
            if (typeof exhibit_id === 'string' && exhibit_id.includes('-')) {
                const uuid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                return uuid_pattern.test(exhibit_id);
            }

            // If it's a numeric ID
            if (typeof exhibit_id === 'number' || /^\d+$/.test(exhibit_id)) {
                return true;
            }

            // For other string formats, ensure it's not empty and has reasonable length
            const exhibit_id_str = String(exhibit_id).trim();
            return exhibit_id_str.length > 0 && exhibit_id_str.length <= 255;
        };

        // Validate required parameter
        if (!is_member_of_exhibit) {
            const error_msg = 'Missing required parameter: is_member_of_exhibit is required';
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_records)] ${error_msg}`);
            return null;
        }

        // Validate exhibit ID format
        if (!is_valid_exhibit_id(is_member_of_exhibit)) {
            const error_msg = `Invalid exhibit ID format: ${is_member_of_exhibit}`;
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_records)] ${error_msg}`);
            return null;
        }

        try {
            // Set query timeout to prevent long-running queries
            const QUERY_TIMEOUT = 10000; // 10 seconds

            // Query with specific columns for better performance
            // Selecting all columns based on schema
            const results = await this.DB(this.TABLE.grid_records)
                .select(
                    'id',
                    'uuid',
                    'is_member_of_exhibit',
                    'type',
                    'columns',
                    'title',
                    'text',
                    'styles',
                    'order',
                    'is_deleted',
                    'is_published',
                    'created',
                    'updated',
                    'owner',
                    'created_by',
                    'updated_by'
                )
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    is_deleted: 0
                })
                .orderBy('order', 'asc') // Order by the 'order' column
                .timeout(QUERY_TIMEOUT);

            // Return results array (empty array if no records found)
            return results || [];

        } catch (error) {
            // Handle specific error types
            if (error.name === 'TimeoutError') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_records)] ` +
                    `Query timeout for exhibit: ${is_member_of_exhibit}`
                );
            } else if (error.code === 'ER_NO_SUCH_TABLE') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_records)] ` +
                    `Table does not exist: ${this.TABLE.grid_records}`
                );
            } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_records)] ` +
                    `Invalid column name in query`
                );
            } else {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_records)] ` +
                    `Unable to get grid records for exhibit: ${is_member_of_exhibit} - ${error.message}`
                );
            }

            // Return empty array instead of null/undefined on error
            return [];
        }
    }

    async update_grid_record(data) {

        /**
         * Validate UUID format (RFC 4122 compliant)
         */
        const is_valid_uuid = (uuid) => {
            if (typeof uuid !== 'string') {
                return false;
            }
            const uuid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuid_pattern.test(uuid);
        };

        /**
         * Validate exhibit ID format
         */
        const is_valid_exhibit_id = (exhibit_id) => {
            if (typeof exhibit_id !== 'string' && typeof exhibit_id !== 'number') {
                return false;
            }

            if (typeof exhibit_id === 'string' && exhibit_id.includes('-')) {
                return is_valid_uuid(exhibit_id);
            }

            if (typeof exhibit_id === 'number' || /^\d+$/.test(exhibit_id)) {
                return true;
            }

            const exhibit_id_str = String(exhibit_id).trim();
            return exhibit_id_str.length > 0 && exhibit_id_str.length <= 255;
        };

        /**
         * Validate and sanitize update data based on schema
         */
        const prepare_update_data = (raw_data) => {
            const update_data = {};

            // Whitelist of allowed updateable columns (based on schema)
            const allowed_columns = [
                'type',
                'columns',
                'title',
                'text',
                'styles',
                'order',
                'is_deleted',
                'is_published',
                'updated_by'
            ];

            // Process each allowed column
            allowed_columns.forEach(column => {
                if (raw_data.hasOwnProperty(column)) {
                    const value = raw_data[column];

                    // Validate and sanitize based on column type
                    switch (column) {
                        case 'columns':
                            // Integer validation (1-12 typical range)
                            const col_num = parseInt(value, 10);
                            if (!isNaN(col_num) && col_num >= 1 && col_num <= 12) {
                                update_data[column] = col_num;
                            }
                            break;

                        case 'order':
                            // Integer validation
                            const order_num = parseInt(value, 10);
                            if (!isNaN(order_num) && order_num >= 0) {
                                update_data[column] = order_num;
                            }
                            break;

                        case 'is_deleted':
                        case 'is_published':
                            // Boolean to tinyint(1)
                            update_data[column] = value ? 1 : 0;
                            break;

                        case 'type':
                            // String validation (max 100 chars per schema)
                            if (typeof value === 'string' && value.length <= 100) {
                                update_data[column] = value.trim();
                            }
                            break;

                        case 'title':
                        case 'text':
                        case 'styles':
                            // Longtext fields - allow null or string
                            if (value === null || value === undefined) {
                                update_data[column] = null;
                            } else if (typeof value === 'string') {
                                update_data[column] = value;
                            }
                            break;

                        case 'updated_by':
                            // String validation (max 255 chars per schema)
                            if (value === null || value === undefined) {
                                update_data[column] = null;
                            } else if (typeof value === 'string' && value.length <= 255) {
                                update_data[column] = value.trim();
                            }
                            break;
                    }
                }
            });

            return update_data;
        };

        // Validate input data object
        if (!data || typeof data !== 'object') {
            const error_msg = 'Invalid data: data object is required';
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ${error_msg}`);
            return null;
        }

        // Validate required fields
        if (!data.is_member_of_exhibit || !data.uuid) {
            const error_msg = 'Missing required fields: is_member_of_exhibit and uuid are required';
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ${error_msg}`);
            return null;
        }

        // Validate UUID format
        if (!is_valid_uuid(data.uuid)) {
            const error_msg = `Invalid UUID format: ${data.uuid}`;
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ${error_msg}`);
            return null;
        }

        // Validate exhibit ID format
        if (!is_valid_exhibit_id(data.is_member_of_exhibit)) {
            const error_msg = `Invalid exhibit ID format: ${data.is_member_of_exhibit}`;
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ${error_msg}`);
            return null;
        }

        // Prepare sanitized update data
        const update_data = prepare_update_data(data);

        // Check if there's any data to update
        if (Object.keys(update_data).length === 0) {
            const error_msg = 'No valid fields to update';
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ${error_msg}`);
            return null;
        }

        try {
            // Set query timeout
            const QUERY_TIMEOUT = 5000; // 5 seconds

            // Perform update
            const rows_affected = await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit,
                    uuid: data.uuid,
                    is_deleted: 0 // Only update non-deleted records
                })
                .update(update_data)
                .timeout(QUERY_TIMEOUT);

            // Check if record was found and updated
            if (rows_affected === 0) {
                LOGGER.module().warn(
                    `WARN: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ` +
                    `No grid record found or updated for exhibit: ${data.is_member_of_exhibit}, UUID: ${data.uuid}`
                );
                return false;
            }

            LOGGER.module().info(
                `INFO: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ` +
                `Grid record updated successfully for exhibit: ${data.is_member_of_exhibit}, UUID: ${data.uuid}`
            );

            return true;

        } catch (error) {
            // Handle specific error types
            if (error.name === 'TimeoutError') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ` +
                    `Query timeout for exhibit: ${data.is_member_of_exhibit}, UUID: ${data.uuid}`
                );
            } else if (error.code === 'ER_NO_SUCH_TABLE') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ` +
                    `Table does not exist: ${this.TABLE.grid_records}`
                );
            } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ` +
                    `Invalid column name in update query`
                );
            } else if (error.code === 'ER_DUP_ENTRY') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ` +
                    `Duplicate entry error for UUID: ${data.uuid}`
                );
            } else {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] ` +
                    `Unable to update grid record for exhibit: ${data.is_member_of_exhibit}, UUID: ${data.uuid} - ${error.message}`
                );
            }

            // Return false on error (operation failed)
            return false;
        }
    }

    /**
     * Retrieves a single grid record by exhibit UUID and grid UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID this grid belongs to
     * @param {string} grid_id - The grid record UUID
     * @returns {Promise<Object|null>} Grid record or null if not found
     * @throws {Error} If validation fails or query fails
     */
    async get_grid_record(is_member_of_exhibit, grid_id) {

        // Define columns to select
        const GRID_COLUMNS = [
            'id',
            'uuid',
            'is_member_of_exhibit',
            'type',
            'columns',
            'title',
            'text',
            'styles',
            'order',
            'is_deleted',
            'is_published',
            'created',
            'updated',
            'owner',
            'created_by',
            'updated_by'
        ];

        try {

            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!grid_id || typeof grid_id !== 'string' || !grid_id.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            // Validate UUID formats
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(grid_id.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_records) {
                throw new Error('Table name "grid_records" is not defined');
            }

            // ===== FETCH GRID RECORD =====

            const record = await Promise.race([
                this.DB(this.TABLE.grid_records)
                    .select(GRID_COLUMNS)
                    .where({
                        is_member_of_exhibit: is_member_of_exhibit.trim(),
                        uuid: grid_id.trim(),
                        is_deleted: 0
                    })
                    .first(),  // Returns single object instead of array
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 10000)
                )
            ]);

            if (!record) {
                LOGGER.module().info('Grid record not found', {
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    grid_id: grid_id.trim()
                });
                return null;
            }

            LOGGER.module().info('Grid record retrieved', {
                uuid: grid_id.trim(),
                is_member_of_exhibit: is_member_of_exhibit.trim()
            });

            return record;

        } catch (error) {
            const error_context = {
                method: 'get_grid_record',
                is_member_of_exhibit,
                grid_id,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get grid record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Retrieves all grid item records for a specific grid
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_grid - The grid UUID
     * @returns {Promise<Array>} Array of grid item records ordered by order field
     * @throws {Error} If validation fails or query fails
     */
    async get_grid_item_records(is_member_of_exhibit, is_member_of_grid) {
        // Define columns to select (avoid SELECT *)
        const GRID_ITEM_COLUMNS = [
            'id',
            'uuid',
            'is_member_of_grid',
            'is_member_of_exhibit',
            'repo_uuid',
            'thumbnail',
            'title',
            'caption',
            'item_type',
            'mime_type',
            'media',
            'text',
            'wrap_text',
            'description',
            'type',
            'layout',
            'media_width',
            'media_padding',
            'alt_text',
            'is_alt_text_decorative',
            'pdf_open_to_page',
            'styles',
            'order',
            'date',
            'is_repo_item',
            'is_kaltura_item',
            'is_embedded',
            'is_published',
            'is_locked',
            'locked_by_user',
            'locked_at',
            'is_deleted',
            'owner',
            'created',
            'updated',
            'created_by',
            'updated_by'
        ];

        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!is_member_of_grid || typeof is_member_of_grid !== 'string' || !is_member_of_grid.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            // Validate UUID formats
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(is_member_of_grid.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_item_records) {
                throw new Error('Table name "grid_item_records" is not defined');
            }

            // ===== FETCH GRID ITEM RECORDS =====

            const records = await this.DB(this.TABLE.grid_item_records)
                .select(GRID_ITEM_COLUMNS)
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_member_of_grid: is_member_of_grid.trim(),
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(10000);

            LOGGER.module().info('Grid item records retrieved', {
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                is_member_of_grid: is_member_of_grid.trim(),
                count: records.length
            });

            return records || [];

        } catch (error) {
            const error_context = {
                method: 'get_grid_item_records',
                is_member_of_exhibit,
                is_member_of_grid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get grid item records',
                error_context
            );

            throw error;
        }
    }

    /**
     * Create grid item records
     * @param data
     */
    async create_grid_item_record(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                    .into(this.TABLE.grid_item_records)
                    .transacting(trx)
                    .then(trx.commit)
                    .catch(trx.rollback);
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (create_grid_item_record)] ' + result.length + ' Grid item record created.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (create_grid_item_record)] unable to create grid item record ' + error.message);
        }
    }

    /**
     * Retrieves a single grid item record by exhibit UUID, grid UUID, and item UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID this grid item belongs to
     * @param {string} grid_id - The grid UUID this item belongs to
     * @param {string} item_id - The grid item UUID
     * @returns {Promise<Object|null>} Grid item record or null if not found
     * @throws {Error} If validation fails or query fails
     */
    async get_grid_item_record(is_member_of_exhibit, grid_id, item_id) {

        // Define columns to select
        const GRID_ITEM_COLUMNS = [
            'id',
            'uuid',
            'is_member_of_grid',
            'is_member_of_exhibit',
            'repo_uuid',
            'thumbnail',
            'title',
            'caption',
            'item_type',
            'mime_type',
            'media',
            'text',
            'wrap_text',
            'description',
            'type',
            'layout',
            'media_width',
            'media_padding',
            'alt_text',
            'is_alt_text_decorative',
            'pdf_open_to_page',
            'styles',
            'order',
            'date',
            'is_repo_item',
            'is_kaltura_item',
            'is_embedded',
            'is_published',
            'is_locked',
            'locked_by_user',
            'locked_at',
            'is_deleted',
            'owner',
            'created',
            'updated',
            'created_by',
            'updated_by'
        ];

        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!grid_id || typeof grid_id !== 'string' || !grid_id.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            if (!item_id || typeof item_id !== 'string' || !item_id.trim()) {
                throw new Error('Valid item UUID is required');
            }

            // Validate UUID formats
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(grid_id.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            if (!uuid_regex.test(item_id.trim())) {
                throw new Error('Invalid item UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_item_records) {
                throw new Error('Table name "grid_item_records" is not defined');
            }

            // ===== FETCH GRID ITEM RECORD =====

            const record = await Promise.race([
                this.DB(this.TABLE.grid_item_records)
                    .select(GRID_ITEM_COLUMNS)
                    .where({
                        is_member_of_exhibit: is_member_of_exhibit.trim(),
                        is_member_of_grid: grid_id.trim(),
                        uuid: item_id.trim(),
                        is_deleted: 0
                    })
                    .first(),  // Returns single object instead of array
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 10000)
                )
            ]);

            if (!record) {
                LOGGER.module().info('Grid item record not found', {
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    grid_id: grid_id.trim(),
                    item_id: item_id.trim()
                });
                return null;
            }

            LOGGER.module().info('Grid item record retrieved', {
                uuid: item_id.trim(),
                is_member_of_grid: grid_id.trim(),
                is_member_of_exhibit: is_member_of_exhibit.trim()
            });

            return record;

        } catch (error) {
            const error_context = {
                method: 'get_grid_item_record',
                is_member_of_exhibit,
                grid_id,
                item_id,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get grid item record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Retrieves a grid item record for editing and locks it for the user
     * @param {string|number} uid - User ID requesting to edit
     * @param {string} is_member_of_exhibit - The exhibit UUID this grid item belongs to
     * @param {string} grid_id - The grid UUID this item belongs to
     * @param {string} item_id - The grid item UUID
     * @returns {Promise<Object|null>} Grid item record with lock status, or null if not found
     * @throws {Error} If validation fails or retrieval fails
     */
    async get_grid_item_edit_record(uid, is_member_of_exhibit, grid_id, item_id) {

        // Define columns to select
        const GRID_ITEM_COLUMNS = [
            'id',
            'uuid',
            'is_member_of_grid',
            'is_member_of_exhibit',
            'repo_uuid',
            'thumbnail',
            'title',
            'caption',
            'item_type',
            'mime_type',
            'media',
            'text',
            'wrap_text',
            'description',
            'type',
            'layout',
            'media_width',
            'media_padding',
            'alt_text',
            'is_alt_text_decorative',
            'pdf_open_to_page',
            'styles',
            'order',
            'date',
            'is_repo_item',
            'is_kaltura_item',
            'is_embedded',
            'is_published',
            'is_locked',
            'locked_by_user',
            'locked_at',
            'is_deleted',
            'owner',
            'created',
            'updated',
            'created_by',
            'updated_by'
        ];

        try {
            // ===== INPUT VALIDATION =====

            if (uid === null || uid === undefined || uid === '') {
                throw new Error('Valid user ID is required');
            }

            // Convert uid to number for comparison
            const uid_number = Number(uid);
            if (isNaN(uid_number)) {
                throw new Error('User ID must be a valid number');
            }

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!grid_id || typeof grid_id !== 'string' || !grid_id.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            if (!item_id || typeof item_id !== 'string' || !item_id.trim()) {
                throw new Error('Valid item UUID is required');
            }

            // Validate UUID formats
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(grid_id.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            if (!uuid_regex.test(item_id.trim())) {
                throw new Error('Invalid item UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_item_records) {
                throw new Error('Table name "grid_item_records" is not defined');
            }

            // ===== FETCH GRID ITEM RECORD =====

            const record = await Promise.race([
                this.DB(this.TABLE.grid_item_records)
                    .select(GRID_ITEM_COLUMNS)
                    .where({
                        is_member_of_exhibit: is_member_of_exhibit.trim(),
                        is_member_of_grid: grid_id.trim(),
                        uuid: item_id.trim(),
                        is_deleted: 0
                    })
                    .first(),  // Returns single object instead of array
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 10000)
                )
            ]);

            if (!record) {
                LOGGER.module().info('Grid item record not found', {
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    grid_id: grid_id.trim(),
                    item_id: item_id.trim()
                });
                return null;
            }

            // ===== HANDLE RECORD LOCKING =====

            // If record is not locked, attempt to lock it for this user
            if (record.is_locked === 0) {
                try {
                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(
                        uid,
                        item_id.trim(),
                        this.DB,
                        this.TABLE.grid_item_records
                    );

                    // Update the record object with lock status
                    record.is_locked = 1;
                    record.locked_by_user = uid_number;
                    record.locked_at = new Date();

                    LOGGER.module().info('Grid item record locked for editing', {
                        item_id: item_id.trim(),
                        grid_id: grid_id.trim(),
                        locked_by: uid_number
                    });

                } catch (lock_error) {
                    LOGGER.module().error('Failed to lock grid item record', {
                        item_id: item_id.trim(),
                        grid_id: grid_id.trim(),
                        uid: uid_number,
                        error: lock_error.message
                    });

                    // Return record without lock if locking fails
                    LOGGER.module().warn('Returning record without lock', {
                        item_id: item_id.trim()
                    });
                }
            } else {
                // Record is already locked
                const locked_by_number = Number(record.locked_by_user);

                if (locked_by_number === uid_number) {
                    LOGGER.module().info('Grid item record already locked by this user', {
                        item_id: item_id.trim(),
                        grid_id: grid_id.trim(),
                        uid: uid_number
                    });
                } else {
                    LOGGER.module().info('Grid item record already locked by another user', {
                        item_id: item_id.trim(),
                        grid_id: grid_id.trim(),
                        locked_by: record.locked_by_user,
                        requested_by: uid_number
                    });
                }
            }

            return record;

        } catch (error) {
            const error_context = {
                method: 'get_grid_item_edit_record',
                uid,
                is_member_of_exhibit,
                grid_id,
                item_id,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get grid item edit record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Update grid item record
     * @param data
     */
    async update_grid_item_record(data) {

        try {

            await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit,
                    is_member_of_grid: data.is_member_of_grid,
                    uuid: data.uuid
                })
                .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (update_grid_item_record)] Grid item record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_item_record)] unable to update grid item record ' + error.message);
        }
    }

    /**
     * Clears out media value
     * @param uuid
     * @param media
     */
    async delete_media_value(uuid, media) {

        try {

            let update = {};
            let tmp = media.split('_');
            let image = tmp.pop();

            if (image.indexOf('media') !== -1) {
                update.media = '';
            } else if (image.indexOf('thumbnail') !== -1) {
                update.thumbnail = '';
            }

            await this.DB(this.TABLE.grid_item_records)
                .where({
                    uuid: uuid
                })
                .update(update);

            LOGGER.module().info('INFO: [/exhibits/item_record_tasks (delete_media_value)] Media value deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/item_record_tasks (delete_media_value)] unable to delete media value ' + error.message);
            return false;
        }
    }

    /** TODO: unused - why?
     * Deletes grid record
     * @param is_member_of_exhibit
     * @param uuid
     */
    /*
    async delete_grid_record(is_member_of_exhibit, uuid) {

        try {

            await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    uuid: uuid
                })
                .update({
                    is_deleted: 1
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (delete_grid_record)] Grid record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (delete_heading_record)] unable to delete grid record ' + error.message);
        }
    }
    */

    /**
     * Soft deletes a grid item record (sets is_deleted flag)
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} grid_id - The grid UUID
     * @param {string} grid_item_id - The grid item UUID to delete
     * @param {string} [deleted_by=null] - User ID performing the deletion
     * @returns {Promise<Object>} Deletion result with success status
     * @throws {Error} If validation fails or deletion fails
     */
    async delete_grid_item_record(is_member_of_exhibit, grid_id, grid_item_id, deleted_by = null) {

        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!grid_id || typeof grid_id !== 'string' || !grid_id.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            if (!grid_item_id || typeof grid_item_id !== 'string' || !grid_item_id.trim()) {
                throw new Error('Valid grid item UUID is required');
            }

            // Validate UUID formats
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(grid_id.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            if (!uuid_regex.test(grid_item_id.trim())) {
                throw new Error('Invalid grid item UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_item_records) {
                throw new Error('Table name "grid_item_records" is not defined');
            }

            // ===== CHECK IF RECORD EXISTS =====

            const existing_record = await this.DB(this.TABLE.grid_item_records)
                .select('id', 'uuid', 'title', 'is_deleted')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_member_of_grid: grid_id.trim(),
                    uuid: grid_item_id.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error('Grid item record not found');
            }

            if (existing_record.is_deleted === 1) {
                LOGGER.module().warn('Grid item record already deleted', {
                    grid_item_id: grid_item_id.trim()
                });
                return {
                    success: true,
                    already_deleted: true,
                    grid_item_id: grid_item_id.trim(),
                    message: 'Grid item was already deleted'
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                is_deleted: 1,
                updated: this.DB.fn.now()
            };

            if (deleted_by) {
                update_data.updated_by = deleted_by;
            }

            // ===== PERFORM SOFT DELETE =====

            const affected_rows = await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_member_of_grid: grid_id.trim(),
                    uuid: grid_item_id.trim(),
                    is_deleted: 0  // Only delete if not already deleted
                })
                .update(update_data)
                .timeout(10000);

            // Verify deletion succeeded
            if (affected_rows === 0) {
                throw new Error('Failed to delete grid item record: No rows affected');
            }

            LOGGER.module().info('Grid item record deleted successfully', {
                grid_item_id: grid_item_id.trim(),
                grid_id: grid_id.trim(),
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                deleted_by,
                affected_rows,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                grid_item_id: grid_item_id.trim(),
                grid_id: grid_id.trim(),
                affected_rows,
                deleted_by,
                message: 'Grid item record deleted successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'delete_grid_item_record',
                is_member_of_exhibit,
                grid_id,
                grid_item_id,
                deleted_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to delete grid item record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets the count of grid records for a specific exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {Object} [options={}] - Count options
     * @param {boolean} [options.include_deleted=false] - Include deleted records in count
     * @param {boolean} [options.include_unpublished=true] - Include unpublished records in count
     * @returns {Promise<number>} Count of grid records
     * @throws {Error} If validation fails or query fails
     */
    async get_record_count(is_member_of_exhibit, options = {}) {

        const {
            include_deleted = false,
            include_unpublished = true
        } = options;

        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_records) {
                throw new Error('Table name "grid_records" is not defined');
            }

            // ===== BUILD QUERY =====

            let query = this.DB(this.TABLE.grid_records)
                .count('id as count')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim()
                });

            // Filter by deleted status
            if (!include_deleted) {
                query = query.where({ is_deleted: 0 });
            }

            // Filter by published status
            if (!include_unpublished) {
                query = query.where({ is_published: 1 });
            }

            // ===== EXECUTE QUERY =====

            const result = await query.timeout(10000);

            // Safely extract count
            const count = result && result[0] && typeof result[0].count !== 'undefined'
                ? parseInt(result[0].count, 10)
                : 0;

            LOGGER.module().info('Grid record count retrieved', {
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                count,
                include_deleted,
                include_unpublished
            });

            return count;

        } catch (error) {
            const error_context = {
                method: 'get_grid_record_count',
                is_member_of_exhibit,
                options,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get grid record count',
                error_context
            );

            throw error;
        }
    }

    /**
     * Sets all grid records for a specific exhibit to published status
     * @param {string} uuid - The exhibit UUID
     * @param {string} [published_by=null] - User ID performing the publish action
     * @returns {Promise<Object>} Publish result with count of affected records
     * @throws {Error} If validation fails or publish fails
     */
    async set_to_publish(uuid, published_by = null) {

        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_records) {
                throw new Error('Table name "grid_records" is not defined');
            }

            // ===== CHECK IF RECORDS EXIST =====

            const existing_count = await this.DB(this.TABLE.grid_records)
                .count('id as count')
                .where({
                    is_member_of_exhibit: uuid.trim(),
                    is_deleted: 0
                })
                .timeout(10000);

            const total_grids = existing_count?.[0]?.count ? parseInt(existing_count[0].count, 10) : 0;

            if (total_grids === 0) {
                LOGGER.module().warn('No grid records found to publish', {
                    is_member_of_exhibit: uuid.trim()
                });
                return {
                    success: true,
                    affected_rows: 0,
                    message: 'No grid records found to publish'
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                is_published: 1,
                updated: this.DB.fn.now()
            };

            if (published_by) {
                update_data.updated_by = published_by;
            }

            // ===== PERFORM PUBLISH =====

            const affected_rows = await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            LOGGER.module().info('Grid records published successfully', {
                is_member_of_exhibit: uuid.trim(),
                affected_rows,
                total_grids,
                published_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                affected_rows,
                total_grids,
                published_by,
                message: `${affected_rows} grid record(s) published successfully`
            };

        } catch (error) {
            const error_context = {
                method: 'set_to_publish',
                uuid,
                published_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to publish grid records',
                error_context
            );

            throw error;
        }
    }

    /**
     * Sets is_published flogs to true
     * @param uuid
     */
    /*
    async set_to_publish__(uuid) {

        try {

            await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: uuid
                })
                .update({
                    is_published: 1
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (set_to_publish)] Grid is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (set_to_publish)] unable to set grid is_published ' + error.message);
            return false;
        }
    }
    */

    /**
     * Sets a single grid item record to published status
     * @param {string} uuid - The grid item UUID
     * @param {string} [published_by=null] - User ID performing the publish action
     * @returns {Promise<Object>} Publish result with affected rows
     * @throws {Error} If validation fails or publish fails
     */
    async set_grid_item_to_publish(uuid, published_by = null) {
        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid grid item UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid grid item UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_item_records) {
                throw new Error('Table name "grid_item_records" is not defined');
            }

            // ===== CHECK IF RECORD EXISTS =====

            const existing_record = await this.DB(this.TABLE.grid_item_records)
                .select('id', 'uuid', 'title', 'is_published', 'is_deleted')
                .where({
                    uuid: uuid.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error('Grid item record not found');
            }

            if (existing_record.is_deleted === 1) {
                throw new Error('Cannot publish deleted grid item record');
            }

            if (existing_record.is_published === 1) {
                LOGGER.module().info('Grid item record already published', {
                    uuid: uuid.trim()
                });
                return {
                    success: true,
                    already_published: true,
                    uuid: uuid.trim(),
                    message: 'Grid item was already published'
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                is_published: 1,
                updated: this.DB.fn.now()
            };

            if (published_by) {
                update_data.updated_by = published_by;
            }

            // ===== PERFORM PUBLISH =====

            const affected_rows = await this.DB(this.TABLE.grid_item_records)
                .where({
                    uuid: uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            // Verify update succeeded
            if (affected_rows === 0) {
                throw new Error('Failed to publish grid item record: No rows affected');
            }

            LOGGER.module().info('Grid item record published successfully', {
                uuid: uuid.trim(),
                title: existing_record.title,
                published_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                uuid: uuid.trim(),
                affected_rows,
                published_by,
                message: 'Grid item record published successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'set_grid_item_to_publish',
                uuid,
                published_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to publish grid item record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Sets is_published flog to true for grid item record
     * @param uuid
     */
    /*
    async set_grid_item_to_publish__(uuid) {

        try {

            await this.DB(this.TABLE.grid_item_records)
                .where({
                    uuid: uuid
                })
                .update({
                    is_published: 1
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (set_grid_item_to_publish)] Grid item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (set_grid_item_to_publish)] unable to set grid item is_published ' + error.message);
            return false;
        }
    }
    */

    /**
     * Sets is_published flag to true for all grid items belonging to a specific grid
     * @param {string} uuid - The grid UUID
     * @param {string} [published_by=null] - User ID performing the publish action
     * @returns {Promise<Object>} Publish result with count of affected records
     * @throws {Error} If validation fails or publish fails
     */
    async set_to_publish_grid_items(uuid, published_by = null) {
        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_item_records) {
                throw new Error('Table name "grid_item_records" is not defined');
            }

            // ===== CHECK IF RECORDS EXIST =====

            const existing_count = await this.DB(this.TABLE.grid_item_records)
                .count('id as count')
                .where({
                    is_member_of_grid: uuid.trim(),
                    is_deleted: 0
                })
                .timeout(10000);

            const total_items = existing_count?.[0]?.count ? parseInt(existing_count[0].count, 10) : 0;

            if (total_items === 0) {
                LOGGER.module().warn('No grid item records found to publish', {
                    is_member_of_grid: uuid.trim()
                });
                return {
                    success: true,
                    affected_rows: 0,
                    message: 'No grid item records found to publish'
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                is_published: 1,
                updated: this.DB.fn.now()
            };

            if (published_by) {
                update_data.updated_by = published_by;
            }

            // ===== PERFORM PUBLISH =====

            const affected_rows = await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_grid: uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            LOGGER.module().info('Grid item records published successfully', {
                is_member_of_grid: uuid.trim(),
                affected_rows,
                total_items,
                published_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                affected_rows,
                total_items,
                published_by,
                message: `${affected_rows} grid item record(s) published successfully`
            };

        } catch (error) {
            const error_context = {
                method: 'set_to_publish_grid_items',
                uuid,
                published_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to publish grid item records',
                error_context
            );

            throw error;
        }
    }

    /**
     * Sets is_published flogs to true for all grid items by grid id
     * @param uuid
     */
    /*
    async set_to_publish_grid_items__(uuid) {

        try {

            await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_grid: uuid
                })
                .update({
                    is_published: 1
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (set_to_publish_grid_items)] Grid items is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (set_to_publish_grid_items)] unable to set grid items is_published. ' + error.message);
            return false;
        }
    }
    */

    /**
     * Sets is_published flag to true for a single grid record
     * @param {string} uuid - The grid UUID
     * @param {string} [published_by=null] - User ID performing the publish action
     * @returns {Promise<Object>} Publish result with affected rows
     * @throws {Error} If validation fails or publish fails
     */
    async set_grid_to_publish(uuid, published_by = null) {
        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_records) {
                throw new Error('Table name "grid_records" is not defined');
            }

            // ===== CHECK IF RECORD EXISTS =====

            const existing_record = await this.DB(this.TABLE.grid_records)
                .select('id', 'uuid', 'title', 'is_published', 'is_deleted')
                .where({
                    uuid: uuid.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error('Grid record not found');
            }

            if (existing_record.is_deleted === 1) {
                throw new Error('Cannot publish deleted grid record');
            }

            if (existing_record.is_published === 1) {
                LOGGER.module().info('Grid record already published', {
                    uuid: uuid.trim()
                });
                return {
                    success: true,
                    already_published: true,
                    uuid: uuid.trim(),
                    message: 'Grid was already published'
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                is_published: 1,
                updated: this.DB.fn.now()
            };

            if (published_by) {
                update_data.updated_by = published_by;
            }

            // ===== PERFORM PUBLISH =====

            const affected_rows = await this.DB(this.TABLE.grid_records)
                .where({
                    uuid: uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            // Verify update succeeded
            if (affected_rows === 0) {
                throw new Error('Failed to publish grid record: No rows affected');
            }

            LOGGER.module().info('Grid record published successfully', {
                uuid: uuid.trim(),
                title: existing_record.title,
                published_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                uuid: uuid.trim(),
                affected_rows,
                published_by,
                message: 'Grid record published successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'set_grid_to_publish',
                uuid,
                published_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to publish grid record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Sets is_published flog to true for grid record
     * @param uuid
     */
    /*
    async set_grid_to_publish__(uuid) {

        try {

            await this.DB(this.TABLE.grid_records)
                .where({
                    uuid: uuid
                })
                .update({
                    is_published: 1
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_grid_to_publish)] Grid is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_grid_to_publish)] unable to set grid is_published ' + error.message);
            return false;
        }
    }
    */

    /**
     * Sets is_published flag to false for all grid records belonging to an exhibit (unpublish/suppress)
     * @param {string} uuid - The exhibit UUID
     * @param {string} [unpublished_by=null] - User ID performing the unpublish action
     * @returns {Promise<Object>} Unpublish result with count of affected records
     * @throws {Error} If validation fails or unpublish fails
     */
    async set_to_suppress(uuid, unpublished_by = null) {
        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_records) {
                throw new Error('Table name "grid_records" is not defined');
            }

            // ===== CHECK IF RECORDS EXIST =====

            const existing_count = await this.DB(this.TABLE.grid_records)
                .count('id as count')
                .where({
                    is_member_of_exhibit: uuid.trim(),
                    is_deleted: 0,
                    is_published: 1  // Only count currently published grids
                })
                .timeout(10000);

            const total_published_grids = existing_count?.[0]?.count ? parseInt(existing_count[0].count, 10) : 0;

            if (total_published_grids === 0) {
                LOGGER.module().warn('No published grid records found to suppress', {
                    is_member_of_exhibit: uuid.trim()
                });
                return {
                    success: true,
                    affected_rows: 0,
                    message: 'No published grid records found to suppress'
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                is_published: 0,
                updated: this.DB.fn.now()
            };

            if (unpublished_by) {
                update_data.updated_by = unpublished_by;
            }

            // ===== PERFORM SUPPRESS/UNPUBLISH =====

            const affected_rows = await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: uuid.trim(),
                    is_deleted: 0,
                    is_published: 1  // Only unpublish currently published grids
                })
                .update(update_data)
                .timeout(10000);

            LOGGER.module().info('Grid records suppressed successfully', {
                is_member_of_exhibit: uuid.trim(),
                affected_rows,
                total_published_grids,
                unpublished_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                affected_rows,
                total_published_grids,
                unpublished_by,
                message: `${affected_rows} grid record(s) suppressed successfully`
            };

        } catch (error) {
            const error_context = {
                method: 'set_to_suppress',
                uuid,
                unpublished_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to suppress grid records',
                error_context
            );

            throw error;
        }
    }

    /**
     * Sets is_published flogs to false for all grid records by exhibit id
     * @param uuid
     */
    /*
    async set_to_suppress__(uuid) {

        try {

            await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: uuid
                })
                .update({
                    is_published: 0
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (set_to_suppress)] Grid is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (set_to_suppress)] unable to set grid is_published. ' + error.message);
            return false;
        }
    }
    */

    /**
     * Sets is_published flag to false for a single grid record (suppress/unpublish)
     * @param {string} uuid - The grid UUID
     * @param {string} [unpublished_by=null] - User ID performing the suppress action
     * @returns {Promise<Object>} Suppress result with affected rows
     * @throws {Error} If validation fails or suppress fails
     */
    async set_grid_to_suppress(uuid, unpublished_by = null) {
        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_records) {
                throw new Error('Table name "grid_records" is not defined');
            }

            // ===== CHECK IF RECORD EXISTS =====

            const existing_record = await this.DB(this.TABLE.grid_records)
                .select('id', 'uuid', 'title', 'is_published', 'is_deleted')
                .where({
                    uuid: uuid.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error('Grid record not found');
            }

            if (existing_record.is_deleted === 1) {
                throw new Error('Cannot suppress deleted grid record');
            }

            if (existing_record.is_published === 0) {
                LOGGER.module().info('Grid record already suppressed', {
                    uuid: uuid.trim()
                });
                return {
                    success: true,
                    already_suppressed: true,
                    uuid: uuid.trim(),
                    message: 'Grid was already suppressed'
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                is_published: 0,
                updated: this.DB.fn.now()
            };

            if (unpublished_by) {
                update_data.updated_by = unpublished_by;
            }

            // ===== PERFORM SUPPRESS =====

            const affected_rows = await this.DB(this.TABLE.grid_records)
                .where({
                    uuid: uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            // Verify update succeeded
            if (affected_rows === 0) {
                throw new Error('Failed to suppress grid record: No rows affected');
            }

            LOGGER.module().info('Grid record suppressed successfully', {
                uuid: uuid.trim(),
                title: existing_record.title,
                unpublished_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                uuid: uuid.trim(),
                affected_rows,
                unpublished_by,
                message: 'Grid record suppressed successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'set_grid_to_suppress',
                uuid,
                unpublished_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to suppress grid record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Sets is_published flog to false for grid record
     * @param uuid
     */
    /*
    async set_grid_to_suppress__(uuid) {

        try {

            await this.DB(this.TABLE.grid_records)
                .where({
                    uuid: uuid
                })
                .update({
                    is_published: 0
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_grid_to_suppress)] Grid is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_grid_to_suppress)] unable to set grid is_published. ' + error.message);
            return false;
        }
    }
    */

    /**
     * Sets is_published flag to false for all grid items belonging to a grid (suppress/unpublish)
     * @param {string} uuid - The grid UUID
     * @param {string} [unpublished_by=null] - User ID performing the suppress action
     * @returns {Promise<Object>} Suppress result with count of affected records
     * @throws {Error} If validation fails or suppress fails
     */
    async set_to_suppressed_grid_items(uuid, unpublished_by = null) {
        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_item_records) {
                throw new Error('Table name "grid_item_records" is not defined');
            }

            // ===== CHECK IF RECORDS EXIST =====

            const existing_count = await this.DB(this.TABLE.grid_item_records)
                .count('id as count')
                .where({
                    is_member_of_grid: uuid.trim(),
                    is_deleted: 0,
                    is_published: 1  // Only count currently published items
                })
                .timeout(10000);

            const total_published_items = existing_count?.[0]?.count ? parseInt(existing_count[0].count, 10) : 0;

            if (total_published_items === 0) {
                LOGGER.module().warn('No published grid item records found to suppress', {
                    is_member_of_grid: uuid.trim()
                });
                return {
                    success: true,
                    affected_rows: 0,
                    message: 'No published grid item records found to suppress'
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                is_published: 0,
                updated: this.DB.fn.now()
            };

            if (unpublished_by) {
                update_data.updated_by = unpublished_by;
            }

            // ===== PERFORM SUPPRESS =====

            const affected_rows = await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_grid: uuid.trim(),
                    is_deleted: 0,
                    is_published: 1  // Only suppress currently published items
                })
                .update(update_data)
                .timeout(10000);

            LOGGER.module().info('Grid item records suppressed successfully', {
                is_member_of_grid: uuid.trim(),
                affected_rows,
                total_published_items,
                unpublished_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                affected_rows,
                total_published_items,
                unpublished_by,
                message: `${affected_rows} grid item record(s) suppressed successfully`
            };

        } catch (error) {
            const error_context = {
                method: 'set_to_suppressed_grid_items',
                uuid,
                unpublished_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to suppress grid item records',
                error_context
            );

            throw error;
        }
    }

    /**
     * Sets is_published flogs to false for grid item records by grid id
     * @param uuid
     */
    async set_to_suppressed_grid_items__(uuid) {

        try {

            await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_grid: uuid
                })
                .update({
                    is_published: 0
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (set_to_suppressed_grid_items)] Grid items is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (set_to_suppressed_grid_items)] unable to set grid items is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Reorders grids
     * @param is_member_of_exhibit
     * @param grids
     */
    async reorder_grids(is_member_of_exhibit, grids) {

        try {

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // Validate UUID formats
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_records) {
                throw new Error('Table name "grid_records" is not defined');
            }

            await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    uuid: grids.uuid
                })
                .update({
                    order: grids.order
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (reorder_grids)] Grid reordered.');
            return true;


        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (reorder_grids)] unable to reorder grid ' + error.message);
            return false;
        }
    }

    /**
     * Reorders grid items
     * @param is_member_of_grid
     * @param grids
     */
    async reorder_grid_items(is_member_of_grid, grids) {

        try {

            if (!is_member_of_grid || typeof is_member_of_grid !== 'string' || !is_member_of_grid.trim()) {
                throw new Error('Valid grid UUID is required');
            }

            // Validate grid UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(is_member_of_grid.trim())) {
                throw new Error('Invalid grid UUID format');
            }

            if (!grids || typeof grids !== 'object' || Array.isArray(grids)) {
                throw new Error('Valid grid item object is required');
            }

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.grid_item_records) {
                throw new Error('Table name "grid_item_records" is not defined');
            }

            await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_grid: is_member_of_grid,
                    uuid: grids.uuid
                })
                .update({
                    order: grids.order
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (reorder_grid_items)] Grid item reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (reorder_grid_items)] unable to reorder grid item ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_grid_record_tasks;
