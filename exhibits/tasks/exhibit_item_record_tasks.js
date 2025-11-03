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

const HELPER = require('../../libs/helper');
const LOGGER = require('../../libs/log4');

/**
 * Object contains tasks used to manage exhibit item records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_item_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Creates a new item record
     * @param {Object} data - Item record data
     * @param {string} data.uuid - Item UUID (required)
     * @param {string} data.is_member_of_exhibit - The exhibit UUID (required)
     * @param {string} data.title - Item title (required)
     * @param {string} data.item_type - Item type (required)
     * @param {string} data.mime_type - MIME type (required)
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created item record with UUID and details
     * @throws {Error} If validation fails or creation fails
     */
    async create_item_record(data, created_by = null) {

        try {
            // ===== INPUT VALIDATION =====

            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Valid item data object is required');
            }

            // Validate required fields
            if (!data.uuid || typeof data.uuid !== 'string' || !data.uuid.trim()) {
                throw new Error('Valid item UUID is required');
            }

            if (!data.is_member_of_exhibit || typeof data.is_member_of_exhibit !== 'string' || !data.is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!data.item_type || typeof data.item_type !== 'string' || !data.item_type.trim()) {
                throw new Error('Valid item_type is required');
            }

            if (!data.mime_type || typeof data.mime_type !== 'string' || !data.mime_type.trim()) {
                throw new Error('Valid mime_type is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(data.uuid.trim())) {
                throw new Error('Invalid item UUID format');
            }

            if (!uuid_regex.test(data.is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.item_records) {
                throw new Error('Table name "item_records" is not defined');
            }

            // ===== PREPARE RECORD DATA =====

            const item_uuid = data.uuid.trim();
            console.log('ITEM DATA ', data);
            // Build the record with defaults
            const record_data = {
                uuid: item_uuid,
                is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                item_type: data.item_type.trim(),
                mime_type: data.mime_type.trim(),

                // Optional fields with defaults
                title: data.title.trim(),
                thumbnail: data.thumbnail || null,
                caption: data.caption || null,
                media: data.media || null,
                text: data.text || null,
                wrap_text: data.wrap_text !== undefined ? data.wrap_text : 1,
                description: data.description || null,
                type: data.type || 'item',
                layout: data.layout || 'media_right',
                media_width: data.media_width !== undefined ? data.media_width : 50,
                media_padding: data.media_padding !== undefined ? data.media_padding : 1,
                alt_text: data.alt_text || null,
                is_alt_text_decorative: data.is_alt_text_decorative || 0,
                pdf_open_to_page: data.pdf_open_to_page || 1,
                item_subjects: data.item_subjects || null,
                styles: data.styles || null,
                order: data.order !== undefined ? data.order : 0,
                is_repo_item: data.is_repo_item || 0,
                is_kaltura_item: data.is_kaltura_item || 0,
                is_embedded: data.is_embedded || 0,
                is_published: data.is_published || 0,
                is_locked: 0,
                locked_by_user: 0,
                locked_at: null,
                is_deleted: 0,
                owner: data.owner || 0,
                created_by: created_by || data.created_by || null,
                updated_by: created_by || data.updated_by || null
            };

            // ===== CREATE RECORD IN TRANSACTION =====

            const created_record = await this.DB.transaction(async (trx) => {
                const [inserted_id] = await trx(this.TABLE.item_records)
                    .insert(record_data)
                    .timeout(10000);

                // Fetch the created record
                const created = await trx(this.TABLE.item_records)
                    .select('*')
                    .where({ id: inserted_id })
                    .first();

                return created;
            });

            LOGGER.module().info('Item record created successfully', {
                uuid: item_uuid,
                item_type: data.item_type.trim(),
                is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                created_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                uuid: item_uuid,
                id: created_record.id,
                record: created_record,
                message: 'Item record created successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'create_item_record',
                uuid: data?.uuid,
                exhibit_uuid: data?.is_member_of_exhibit,
                title: data?.title,
                item_type: data?.item_type,
                created_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to create item record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets item records by exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @returns {Promise<Array>} Array of item records
     * @throws {Error} If validation fails or query fails
     */
    async get_item_records(is_member_of_exhibit) {

        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.item_records) {
                throw new Error('Table name "item_records" is not defined');
            }

            // ===== QUERY ITEM RECORDS =====

            const items = await this.DB(this.TABLE.item_records)
                .select(
                    'id',
                    'uuid',
                    'is_member_of_exhibit',
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
                    'item_subjects',
                    'styles',
                    'order',
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
                )
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(10000);

            LOGGER.module().info('Item records retrieved successfully', {
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                count: items.length,
                timestamp: new Date().toISOString()
            });

            return items;

        } catch (error) {
            const error_context = {
                method: 'get_item_records',
                is_member_of_exhibit,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get item records',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets item record for standard item details page
     * @param is_member_of_exhibit
     * @param uuid
     * @returns {Promise<awaited Knex.QueryBuilder<TRecord, DeferredKeySelection.AddUnionMember<UnwrapArrayMember<TResult>, undefined>>|null>}
     */
    async get_item_record(is_member_of_exhibit, uuid) {

        /**
         * Validate UUID format
         */
        const is_valid_uuid = (uuid) => {
            if (typeof uuid !== 'string') {
                return false;
            }

            // UUID v4 regex pattern
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

            // If it's a UUID format
            if (typeof exhibit_id === 'string' && exhibit_id.includes('-')) {
                return is_valid_uuid(exhibit_id);
            }

            // If it's a numeric ID
            if (typeof exhibit_id === 'number' || /^\d+$/.test(exhibit_id)) {
                return true;
            }

            // For other string formats, ensure it's not empty and has reasonable length
            const exhibit_id_str = String(exhibit_id).trim();
            return exhibit_id_str.length > 0 && exhibit_id_str.length <= 255;
        };

        // Validate required parameters
        if (!is_member_of_exhibit || !uuid) {
            const error_msg = 'Missing required parameters: is_member_of_exhibit and uuid are required';
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ${error_msg}`);
            return null;
        }

        // Validate UUID format (basic check)
        if (!is_valid_uuid(uuid)) {
            const error_msg = `Invalid UUID format: ${uuid}`;
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ${error_msg}`);
            return null;
        }

        // Validate exhibit ID format
        if (!is_valid_exhibit_id(is_member_of_exhibit)) {
            const error_msg = `Invalid exhibit ID format: ${is_member_of_exhibit}`;
            LOGGER.module().error(`ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ${error_msg}`);
            return null;
        }

        try {
            // Set query timeout to prevent long-running queries
            const QUERY_TIMEOUT = 5000; // 5 seconds

            const result = await this.DB(this.TABLE.item_records)
                .select('*') // Consider selecting specific columns: .select('id', 'uuid', 'title', ...)
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    uuid: uuid,
                    is_deleted: 0
                })
                .first() // Get single record instead of array
                .timeout(QUERY_TIMEOUT);

            // Return result or null if not found
            return result || null;

        } catch (error) {
            // Handle specific error types
            if (error.name === 'TimeoutError') {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ` +
                    `Query timeout for exhibit: ${is_member_of_exhibit}, UUID: ${uuid}`
                );
            } else {
                LOGGER.module().error(
                    `ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] ` +
                    `Unable to get item record for exhibit: ${is_member_of_exhibit}, UUID: ${uuid} - ${error.message}`
                );
            }

            // Return null instead of undefined on error
            return null;
        }
    }

    /**
     * Retrieves an item record for editing and locks it for the user
     * @param {string|number} uid - User ID requesting to edit
     * @param {string} is_member_of_exhibit - The exhibit UUID this item belongs to
     * @param {string} uuid - The item record UUID
     * @returns {Promise<Object|null>} Item record with lock status, or null if not found
     * @throws {Error} If validation fails or retrieval fails
     */
    async get_item_edit_record(uid, is_member_of_exhibit, uuid) {
        // Define columns to select (avoid SELECT *)
        const ITEM_COLUMNS = [
            'id',
            'uuid',
            'is_member_of_exhibit',
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
            'item_subjects',
            'styles',
            'order',
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

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid item UUID is required');
            }

            // Validate UUID formats
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid item UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.item_records) {
                throw new Error('Table name "item_records" is not defined');
            }

            // ===== FETCH ITEM RECORD =====

            const record = await Promise.race([
                this.DB(this.TABLE.item_records)
                    .select(ITEM_COLUMNS)
                    .where({
                        is_member_of_exhibit: is_member_of_exhibit.trim(),
                        uuid: uuid.trim(),
                        is_deleted: 0
                    })
                    .first(),  // Returns single object instead of array
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 10000)
                )
            ]);

            if (!record) {
                LOGGER.module().info('Item record not found', {
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    uuid: uuid.trim()
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
                        uuid.trim(),
                        this.DB,
                        this.TABLE.item_records
                    );

                    // Update the record object with lock status
                    record.is_locked = 1;
                    record.locked_by_user = uid_number;
                    record.locked_at = new Date();

                    LOGGER.module().info('Item record locked for editing', {
                        uuid: uuid.trim(),
                        locked_by: uid_number
                    });

                } catch (lock_error) {
                    LOGGER.module().error('Failed to lock item record', {
                        uuid: uuid.trim(),
                        uid: uid_number,
                        error: lock_error.message
                    });

                    // Return record without lock if locking fails
                    LOGGER.module().warn('Returning record without lock', {
                        uuid: uuid.trim()
                    });
                }
            } else {
                // Record is already locked
                const locked_by_number = Number(record.locked_by_user);

                if (locked_by_number === uid_number) {
                    LOGGER.module().info('Item record already locked by this user', {
                        uuid: uuid.trim(),
                        uid: uid_number
                    });
                } else {
                    LOGGER.module().info('Item record already locked by another user', {
                        uuid: uuid.trim(),
                        locked_by: record.locked_by_user,
                        requested_by: uid_number
                    });
                }
            }

            return record;

        } catch (error) {
            const error_context = {
                method: 'get_item_edit_record',
                uid,
                is_member_of_exhibit,
                uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get item edit record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Updates an item record
     * @param {Object} data - Item data to update
     * @param {string} data.uuid - Item UUID (required)
     * @param {string} data.is_member_of_exhibit - Exhibit UUID (required)
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Updated item record with details
     * @throws {Error} If validation fails or update fails
     */
    async update_item_record(data, updated_by = null) {

        try {
            // ===== INPUT VALIDATION =====

            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Valid item data object is required');
            }

            // Validate required fields for identifying the record
            if (!data.uuid || typeof data.uuid !== 'string' || !data.uuid.trim()) {
                throw new Error('Valid item UUID is required');
            }

            if (!data.is_member_of_exhibit || typeof data.is_member_of_exhibit !== 'string' || !data.is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(data.uuid.trim())) {
                throw new Error('Invalid item UUID format');
            }

            if (!uuid_regex.test(data.is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.item_records) {
                throw new Error('Table name "item_records" is not defined');
            }

            // ===== CHECK IF RECORD EXISTS =====

            const existing_record = await this.DB(this.TABLE.item_records)
                .select('id', 'uuid', 'title', 'is_deleted')
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                    uuid: data.uuid.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error('Item record not found');
            }

            if (existing_record.is_deleted === 1) {
                throw new Error('Cannot update deleted item record');
            }

            // ===== PREPARE UPDATE DATA =====

            // Create a clean update object excluding immutable fields
            const update_data = {};

            // Fields that can be updated
            const updatable_fields = [
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
                'item_subjects',
                'styles',
                'order',
                'is_repo_item',
                'is_kaltura_item',
                'is_embedded',
                'is_published',
                'is_locked',
                'locked_by_user',
                'locked_at',
                'owner'
            ];

            // Copy only updatable fields from data
            updatable_fields.forEach(field => {
                if (data.hasOwnProperty(field)) {
                    update_data[field] = data[field];
                }
            });

            // Ensure there's something to update
            if (Object.keys(update_data).length === 0) {
                LOGGER.module().warn('No updatable fields provided', {
                    uuid: data.uuid.trim()
                });
                return {
                    success: true,
                    no_change: true,
                    uuid: data.uuid.trim(),
                    message: 'No fields to update'
                };
            }

            // Add updated timestamp and user
            update_data.updated = this.DB.fn.now();
            if (updated_by) {
                update_data.updated_by = updated_by;
            }

            // ===== PERFORM UPDATE =====

            const affected_rows = await this.DB(this.TABLE.item_records)
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                    uuid: data.uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            if (affected_rows === 0) {
                throw new Error('Failed to update item record: No rows affected');
            }

            // ===== FETCH UPDATED RECORD =====

            const updated_record = await this.DB(this.TABLE.item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                    uuid: data.uuid.trim()
                })
                .first()
                .timeout(10000);

            LOGGER.module().info('Item record updated successfully', {
                uuid: data.uuid.trim(),
                title: updated_record.title,
                fields_updated: Object.keys(update_data).filter(f => f !== 'updated' && f !== 'updated_by'),
                is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                updated_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                uuid: data.uuid.trim(),
                affected_rows,
                updated_fields: Object.keys(update_data),
                record: updated_record,
                updated_by,
                message: 'Item record updated successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'update_item_record',
                uuid: data?.uuid,
                exhibit_uuid: data?.is_member_of_exhibit,
                updated_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to update item record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Soft deletes an item record (sets is_deleted to 1)
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} item_id - The item UUID
     * @param {string} type - The item type ('item', 'grid', 'heading', 'timeline')
     * @param {string} [deleted_by=null] - User ID performing the deletion
     * @returns {Promise<Object>} Deletion result with details
     * @throws {Error} If validation fails or deletion fails
     */
    async delete_item_record(is_member_of_exhibit, item_id, type, deleted_by = null) {

        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!item_id || typeof item_id !== 'string' || !item_id.trim()) {
                throw new Error('Valid item UUID is required');
            }

            if (!type || typeof type !== 'string' || !type.trim()) {
                throw new Error('Valid item type is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(item_id.trim())) {
                throw new Error('Invalid item UUID format');
            }

            // ===== TYPE VALIDATION =====

            const valid_types = ['item', 'grid', 'heading', 'timeline'];
            const normalized_type = type.trim().toLowerCase();

            if (!valid_types.includes(normalized_type)) {
                throw new Error(`Invalid item type. Must be one of: ${valid_types.join(', ')}`);
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            // ===== DETERMINE TABLE =====

            let table;

            if (normalized_type === 'item') {
                if (!this.TABLE?.item_records) {
                    throw new Error('Table name "item_records" is not defined');
                }
                table = this.TABLE.item_records;
            } else if (normalized_type === 'grid') {
                if (!this.TABLE?.grid_records) {
                    throw new Error('Table name "grid_records" is not defined');
                }
                table = this.TABLE.grid_records;
            } else if (normalized_type === 'heading') {
                if (!this.TABLE?.heading_records) {
                    throw new Error('Table name "heading_records" is not defined');
                }
                table = this.TABLE.heading_records;
            } else if (normalized_type === 'timeline') {
                if (!this.TABLE?.timeline_records) {
                    throw new Error('Table name "timeline_records" is not defined');
                }
                table = this.TABLE.timeline_records;
            }

            // ===== CHECK IF RECORD EXISTS =====

            const existing_record = await this.DB(table)
                .select('id', 'uuid', 'is_deleted')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    uuid: item_id.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error(`${normalized_type.charAt(0).toUpperCase() + normalized_type.slice(1)} record not found`);
            }

            if (existing_record.is_deleted === 1) {
                LOGGER.module().warn('Record already deleted', {
                    type: normalized_type,
                    uuid: item_id.trim()
                });
                return {
                    success: true,
                    already_deleted: true,
                    uuid: item_id.trim(),
                    type: normalized_type,
                    message: `${normalized_type.charAt(0).toUpperCase() + normalized_type.slice(1)} record was already deleted`
                };
            }

            // ===== PREPARE DELETE DATA =====

            const delete_data = {
                is_deleted: 1,
                updated: this.DB.fn.now()
            };

            if (deleted_by) {
                delete_data.updated_by = deleted_by;
            }

            // ===== PERFORM SOFT DELETE =====

            const affected_rows = await this.DB(table)
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    uuid: item_id.trim(),
                    is_deleted: 0
                })
                .update(delete_data)
                .timeout(10000);

            if (affected_rows === 0) {
                throw new Error(`Failed to delete ${normalized_type} record: No rows affected`);
            }

            LOGGER.module().info('Record deleted successfully', {
                type: normalized_type,
                uuid: item_id.trim(),
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                deleted_by,
                timestamp: new Date().toISOString()
            });

            const HELPER_TASK = new HELPER();
            let new_order = await HELPER_TASK.reorder(is_member_of_exhibit, this.DB, this.TABLE);
            let new_order_applied = await HELPER_TASK.apply_reorder(is_member_of_exhibit, new_order, this.DB, this.TABLE)

            if (new_order_applied.success === false) {
                LOGGER.module().error(
                    'Failed to reorder records',
                    new_order_applied
                );
            }

            return {
                success: true,
                uuid: item_id.trim(),
                type: normalized_type,
                affected_rows,
                deleted_by,
                message: `${normalized_type.charAt(0).toUpperCase() + normalized_type.slice(1)} record deleted successfully`
            };

        } catch (error) {
            const error_context = {
                method: 'delete_item_record',
                is_member_of_exhibit,
                item_id,
                type,
                deleted_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to delete record',
                error_context
            );

            throw error;
        }
    }

    /**
     * "Deletes" item record (sets to inactive)
     * @param is_member_of_exhibit
     * @param item_id
     * @param type
     */
    /*
    async delete_item_record__(is_member_of_exhibit, item_id, type) {

        try {

            let table;

            if (type === 'item') {
                table = this.TABLE.item_records;
            } else if (type === 'grid') {
                table = this.TABLE.grid_records;
            } else if (type === 'heading') {
                table = this.TABLE.heading_records;
            } else if (type === 'timeline') {
                table = this.TABLE.timeline_records;
            } else {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (delete_item_record)] unable to determine item type');
                return false;
            }

            await this.DB(table)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: item_id
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (delete_item_record)] Item record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (delete_item_record)] unable to delete record ' + error.message);
        }
    }
    */

    /**
     * Gets item record count
     * @param uuid
     */
    async get_record_count(uuid) {

        try {

            const count = await this.DB(this.TABLE.item_records).count('id as count')
            .where({
                is_member_of_exhibit: uuid
            });

            return count[0].count;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_record_count)] unable to get item record count ' + error.message);
        }
    }

    /**
     * Sets is_published flogs to true
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_to_publish)] Item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_to_publish)] unable to set item is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to true
     * @param uuid
     */
    async set_item_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_item_to_publish)] Item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_item_to_publish)] unable to set item is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_to_suppress)] Item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_to_suppress)] unable to set item is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to false
     * @param uuid
     */
    async set_item_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_item_to_suppress)] Item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_item_to_suppress)] unable to set item is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Clears media or thumbnail value from an item record (supports multiple item types)
     * Automatically determines which field to clear based on the media path
     * @param {string} item_uuid - The item UUID
     * @param {string} media_path - The media path to determine which field to clear
     * @param {string} item_type - Item type: 'standard_item', 'grid_item', or 'timeline_item'
     * @param {string} [updated_by=null] - User ID performing the operation
     * @returns {Promise<Object>} Delete result
     * @throws {Error} If validation fails or delete fails
     */
    async delete_media_value(item_uuid, media_path, item_type, updated_by = null) {

        // Define valid item types and their corresponding tables
        const ITEM_TYPE_TABLE_MAP = {
            'standard_item': 'item_records',
            'grid_item': 'grid_item_records',
            'timeline_item': 'timeline_item_records'
        };

        try {
            // ===== INPUT VALIDATION =====

            if (!item_uuid || typeof item_uuid !== 'string' || !item_uuid.trim()) {
                throw new Error('Valid item UUID is required');
            }

            if (!media_path || typeof media_path !== 'string' || !media_path.trim()) {
                throw new Error('Valid media path is required');
            }

            if (!item_type || typeof item_type !== 'string') {
                throw new Error('Valid item type is required');
            }

            // ===== DETERMINE FIELD FROM PATH =====

            const path_lower = media_path.toLowerCase().trim();
            let field_to_clear = null;

            if (path_lower.includes('thumbnail')) {
                field_to_clear = 'thumbnail';
            } else if (path_lower.includes('media')) {
                field_to_clear = 'media';
            } else {
                // Parse using underscore split (fallback logic)
                const parts = media_path.split('_');
                const last_part = parts[parts.length - 1] || '';

                if (last_part.toLowerCase().includes('thumb')) {
                    field_to_clear = 'thumbnail';
                } else {
                    field_to_clear = 'media';
                }
            }

            if (!field_to_clear) {
                // Default to 'media' if we couldn't determine
                field_to_clear = 'media';
                LOGGER.module().warn('Could not determine field from path, defaulting to media', {
                    media_path
                });
            }

            LOGGER.module().info('Determined field to clear from media path', {
                media_path,
                field_to_clear
            });

            // ===== VALIDATE ITEM TYPE AND GET TABLE =====

            const normalized_type = item_type.toLowerCase().trim();

            if (!ITEM_TYPE_TABLE_MAP.hasOwnProperty(normalized_type)) {
                throw new Error(`Invalid item type. Must be 'standard_item', 'grid_item', or 'timeline_item', got: ${item_type}`);
            }

            const table_name = ITEM_TYPE_TABLE_MAP[normalized_type];

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(item_uuid.trim())) {
                throw new Error('Invalid item UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE || !this.TABLE[table_name]) {
                throw new Error(`Table "${table_name}" is not defined in TABLE configuration`);
            }

            // ===== CHECK RECORD EXISTS =====

            const existing_record = await this.DB(this.TABLE[table_name])
                .select('id', 'uuid', 'is_deleted', field_to_clear)
                .where({
                    uuid: item_uuid.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error(`${normalized_type} record not found`);
            }

            if (existing_record.is_deleted === 1) {
                throw new Error(`Cannot update deleted ${normalized_type} record`);
            }

            // Check if field already empty
            if (!existing_record[field_to_clear]) {
                return {
                    success: true,
                    no_change: true,
                    uuid: item_uuid.trim(),
                    item_type: normalized_type,
                    field: field_to_clear,
                    media_path,
                    message: `Field '${field_to_clear}' is already empty`
                };
            }

            // ===== PREPARE UPDATE DATA =====

            const update_data = {
                [field_to_clear]: ''
            };

            if (updated_by) {
                update_data.updated_by = updated_by;
            }

            // ===== PERFORM UPDATE =====

            const affected_rows = await this.DB(this.TABLE[table_name])
                .where({
                    uuid: item_uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            if (affected_rows === 0) {
                throw new Error('Delete media value failed: No rows affected');
            }

            // ===== LOG SUCCESS =====

            LOGGER.module().info('Media value deleted successfully', {
                uuid: item_uuid.trim(),
                item_type: normalized_type,
                table: table_name,
                field: field_to_clear,
                media_path,
                previous_value: existing_record[field_to_clear],
                affected_rows,
                updated_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                uuid: item_uuid.trim(),
                item_type: normalized_type,
                table: table_name,
                field: field_to_clear,
                media_path,
                previous_value: existing_record[field_to_clear],
                affected_rows,
                message: `Media value '${field_to_clear}' deleted successfully from ${normalized_type}`
            };

        } catch (error) {
            const error_context = {
                method: 'delete_media_value',
                item_uuid,
                media_path,
                item_type,
                updated_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to delete media value',
                error_context
            );

            throw error;
        }
    }

    /**
     * Reorders items
     * @param is_member_of_exhibit
     * @param item
     */
    async reorder_items(is_member_of_exhibit, item) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: item.uuid
            })
            .update({
                order: item.order
            });

            LOGGER.module().info('INFO: [/exhibits/item_record_tasks (reorder_items)] Item reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/item_record_tasks (reorder_items)] unable to reorder item ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_item_record_tasks;
