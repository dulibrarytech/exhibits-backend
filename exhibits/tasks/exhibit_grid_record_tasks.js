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

    /**
     * Gets all grid records by exhibit
     * @param is_member_of_exhibit
     */
    async get_grid_records(is_member_of_exhibit) {

        try {

            return await this.DB(this.TABLE.grid_records)
                .select('*')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    is_deleted: 0
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (get_grid_records)] unable to get grid records ' + error.message);
        }
    }

    /**
     * Updates grid record
     * @param data
     */
    async update_grid_record(data) {

        try {

            await this.DB(this.TABLE.grid_records)
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit,
                    uuid: data.uuid
                })
                .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] Grid record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (update_grid_record)] unable to update grid record ' + error.message);
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
                        uid_number,
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

    /**
     * Deletes grid record
     * @param is_member_of_exhibit
     * @param uuid
     */
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

    /**
     * Deletes grid item
     * @param is_member_of_exhibit
     * @param grid_id
     * @param grid_item_id
     */
    async delete_grid_item_record(is_member_of_exhibit, grid_id, grid_item_id) {

        try {

            await this.DB(this.TABLE.grid_item_records)
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    is_member_of_grid: grid_id,
                    uuid: grid_item_id
                })
                .update({
                    is_deleted: 1
                });

            LOGGER.module().info('INFO: [/exhibits/exhibit_grid_record_tasks (delete_grid_item_record)] Grid item record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (delete_grid_item_record)] unable to delete grid item record ' + error.message);
        }
    }

    /**
     * Gets grid record count
     * @param uuid
     */
    async get_record_count(uuid) {

        try {

            const count = await this.DB(this.TABLE.grid_records).count('id as count')
                .where({
                    is_member_of_exhibit: uuid
                });

            return count[0].count;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_grid_record_tasks (get_record_count)] unable to get grid record count ' + error.message);
        }
    }

    /**
     * Sets is_published flogs to true
     * @param uuid
     */
    async set_to_publish(uuid) {

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

    /**
     * Sets is_published flog to true for grid item record
     * @param uuid
     */
    async set_grid_item_to_publish(uuid) {

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

    /**
     * Sets is_published flogs to true for all grid items by grid id
     * @param uuid
     */
    async set_to_publish_grid_items(uuid) {

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

    /**
     * Sets is_published flog to true for grid record
     * @param uuid
     */
    async set_grid_to_publish(uuid) {

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

    /**
     * Sets is_published flogs to false for all grid records by exhibit id
     * @param uuid
     */
    async set_to_suppress(uuid) {

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

    /**
     * Sets is_published flog to false for grid record
     * @param uuid
     */
    async set_grid_to_suppress(uuid) {

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

    /**
     * Sets is_published flogs to false for grid item records by grid id
     * @param uuid
     */
    async set_to_suppressed_grid_items(uuid) {

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
