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
 * Object contains tasks used to manage exhibit records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Creates exhibit record in database with transaction support
     * @param {Object} data - Exhibit record data to insert
     * @returns {Object} - {status: number, message: string, data: Object|null}
     */
    async create_exhibit_record(data) {

        try {

            if (!data || typeof data !== 'object') {
                LOGGER.module().warn('WARNING: [/exhibits/exhibit_record_tasks (create_exhibit_record)] invalid data parameter');
                return {
                    status: 400,
                    message: 'Invalid exhibit record data provided.',
                    data: null
                };
            }

            // Validate data is not an array
            if (Array.isArray(data)) {
                LOGGER.module().warn('WARNING: [/exhibits/exhibit_record_tasks (create_exhibit_record)] data parameter is an array');
                return {
                    status: 400,
                    message: 'Invalid exhibit record data format.',
                    data: null
                };
            }

            // Check if data object has any properties
            if (Object.keys(data).length === 0) {
                LOGGER.module().warn('WARNING: [/exhibits/exhibit_record_tasks (create_exhibit_record)] data object is empty');
                return {
                    status: 400,
                    message: 'No exhibit record data provided.',
                    data: null
                };
            }

            // Validate required dependencies
            if (!this.DB) {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] DB is not defined');
                return {
                    status: 500,
                    message: 'Database configuration error.',
                    data: null
                };
            }

            if (!this.TABLE) {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] TABLE is not defined');
                return {
                    status: 500,
                    message: 'Database configuration error.',
                    data: null
                };
            }

            if (!this.TABLE.exhibit_records) {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] TABLE.exhibit_records is not defined');
                return {
                    status: 500,
                    message: 'Database configuration error.',
                    data: null
                };
            }

            // Validate DB has transaction method
            if (typeof this.DB.transaction !== 'function') {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] DB.transaction is not a function');
                return {
                    status: 500,
                    message: 'Database configuration error.',
                    data: null
                };
            }

            // Create a copy of data to avoid mutation
            const insert_data = { ...data };

            // Perform insert with proper transaction handling
            let result;

            try {
                result = await this.DB.transaction(async (trx) => {
                    // Perform insert within transaction
                    const insert_result = await trx(this.TABLE.exhibit_records).insert(insert_data);

                    // Transaction automatically commits if no error is thrown
                    return insert_result;
                });
            } catch (transaction_error) {
                // Transaction automatically rolls back on error
                LOGGER.module().error(`ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] transaction failed: ${transaction_error.message}`);

                // Check for specific database errors
                if (transaction_error.code === 'ER_DUP_ENTRY' || transaction_error.code === '23505') {
                    return {
                        status: 409,
                        message: 'Duplicate exhibit record.',
                        data: null
                    };
                }

                if (transaction_error.code === 'ER_NO_REFERENCED_ROW' || transaction_error.code === '23503') {
                    return {
                        status: 400,
                        message: 'Invalid foreign key reference.',
                        data: null
                    };
                }

                return {
                    status: 500,
                    message: 'Unable to create exhibit record.',
                    data: null
                };
            }

            // Validate result structure
            if (!result) {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] result is null or undefined');
                return {
                    status: 500,
                    message: 'Unable to create exhibit record.',
                    data: null
                };
            }

            // Validate result is an array (Knex insert returns array of IDs)
            if (!Array.isArray(result)) {
                LOGGER.module().error(`ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] result is not an array: ${typeof result}`);
                return {
                    status: 500,
                    message: 'Unable to create exhibit record.',
                    data: null
                };
            }

            // Check if insert was successful (should have 1 element for single insert)
            if (result.length === 0) {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] result array is empty');
                return {
                    status: 500,
                    message: 'Unable to create exhibit record.',
                    data: null
                };
            }

            if (result.length !== 1) {
                LOGGER.module().warn(`WARNING: [/exhibits/exhibit_record_tasks (create_exhibit_record)] unexpected result length: ${result.length}`);
                // Continue anyway - might be valid for some databases
            }

            // Extract inserted ID
            const inserted_id = result[0];

            // Validate inserted ID
            if (inserted_id === null || inserted_id === undefined) {
                LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] inserted ID is null or undefined');
                return {
                    status: 500,
                    message: 'Unable to create exhibit record.',
                    data: null
                };
            }

            // Validate ID is numeric (for databases that return numeric IDs)
            const numeric_id = Number(inserted_id);
            if (isNaN(numeric_id) || !Number.isInteger(numeric_id) || numeric_id <= 0) {
                // Some databases might return non-numeric IDs (UUIDs, etc.)
                // Log a warning but continue
                LOGGER.module().debug(`DEBUG: [/exhibits/exhibit_record_tasks (create_exhibit_record)] non-standard ID format: ${inserted_id}`);
            }

            LOGGER.module().info(`INFO: [/exhibits/exhibit_record_tasks (create_exhibit_record)] exhibit record created with ID: ${inserted_id}`);

            return {
                status: 201,
                message: 'Exhibit record created.',
                data: {
                    id: inserted_id,
                    ...insert_data
                }
            };

        } catch (error) {
            // Catch any unexpected errors not caught by inner try-catch
            LOGGER.module().error(
                `ERROR: [/exhibits/exhibit_record_tasks (create_exhibit_record)] unable to create exhibit record: ${error.message}`
            );

            // Log stack trace for debugging (only in development)
            if (process.env.NODE_ENV !== 'production') {
                LOGGER.module().debug(`DEBUG: [/exhibits/exhibit_record_tasks (create_exhibit_record)] stack trace: ${error.stack}`);
            }

            return {
                status: 500,
                message: 'Unable to create exhibit record.',
                data: null
            };
        }
    }

    /**
     * Retrieves non-deleted exhibit records from the database
     * @returns {Promise<Array<Object>>} Array of exhibit records
     * @throws {Error} If database query fails
     */
    async get_exhibit_records() {
        // Define columns as a constant for maintainability
        const EXHIBIT_COLUMNS = [
            'uuid',
            'type',
            'title',
            'subtitle',
            'banner_template',
            'about_the_curators',
            'alert_text',
            'hero_image',
            'thumbnail',
            'description',
            'page_layout',
            'exhibit_template',
            'styles',
            'order',
            'is_published',
            'is_preview',
            'is_featured',
            'is_locked',
            'is_student_curated',
            'owner',
            'created',
            'updated',
            'created_by',
            'updated_by'
        ];

        try {
            // Validate database connection exists
            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            // Validate table name exists
            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            // Execute query with timeout protection
            const records = await Promise.race([
                this.DB(this.TABLE.exhibit_records)
                    .select(EXHIBIT_COLUMNS)
                    .where({ is_deleted: 0 })
                    .orderBy('order', 'asc'), // Add explicit ordering for consistency

                // Timeout after 30 seconds
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 30000)
                )
            ]);

            // Return empty array instead of null/undefined for consistency
            return Array.isArray(records) ? records : [];

        } catch (error) {
            // Enhanced error logging with context
            const errorContext = {
                method: 'get_exhibit_records',
                table: this.TABLE?.exhibit_records,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_records)] ' +
                'Unable to retrieve exhibit records',
                errorContext
            );

            // Re-throw error for upstream handling instead of swallowing it
            throw new Error(`Failed to retrieve exhibit records: ${error.message}`);
        }
    }

    /**
     * Retrieves the title of a specific exhibit by UUID
     * @param {string} uuid - The exhibit UUID
     * @returns {Promise<Object|null>} Exhibit object with uuid and title, or null if not found
     * @throws {Error} If database query fails or invalid input
     */
    async get_exhibit_title(uuid) {

        try {

            if (!uuid) {
                throw new Error('UUID parameter is required');
            }

            // Validate UUID format (standard UUID v4 format)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid)) {
                throw new Error('Invalid UUID format');
            }

            // Validate database connection
            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            // Validate table name exists
            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            // Execute query with timeout protection
            const record = await Promise.race([
                this.DB(this.TABLE.exhibit_records)
                    .select('uuid', 'title')
                    .where({
                        uuid: uuid,
                        is_deleted: 0
                    })
                    .first(), // More efficient - returns single object instead of array

                // Timeout after 10 seconds (shorter for single record lookup)
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 10000)
                )
            ]);

            // Return null if not found (consistent with .first() behavior)
            return record || null;

        } catch (error) {
            // Enhanced error logging with context
            const errorContext = {
                method: 'get_exhibit_title',
                table: this.TABLE?.exhibit_records,
                uuid: uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_title)] ' +
                'Unable to retrieve exhibit title',
                errorContext
            );

            // Re-throw error for upstream handling
            throw new Error(`Failed to retrieve exhibit title for UUID ${uuid}: ${error.message}`);
        }
    }

    /**
     * Retrieves a complete exhibit record by UUID
     * @param {string} uuid - The exhibit UUID
     * @returns {Promise<Object|null>} Complete exhibit record or null if not found
     * @throws {Error} If database query fails or invalid input
     */
    async get_exhibit_record(uuid) {

        // Define explicit columns instead of SELECT *
        const EXHIBIT_COLUMNS = [
            'uuid',
            'type',
            'title',
            'subtitle',
            'banner_template',
            'about_the_curators',
            'alert_text',
            'hero_image',
            'thumbnail',
            'description',
            'page_layout',
            'exhibit_template',
            'exhibit_subjects',
            'styles',
            'order',
            'is_published',
            'is_preview',
            'is_featured',
            'is_locked',
            'is_student_curated',
            'owner',
            'created',
            'updated',
            'created_by',
            'updated_by',
            'is_deleted'
        ];

        try {
            // Input validation
            if (!uuid) {
                throw new Error('UUID parameter is required');
            }

            // Validate UUID format (standard UUID v4 format)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid)) {
                throw new Error('Invalid UUID format');
            }

            // Validate database connection
            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            // Validate table name exists
            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            // Execute query with timeout protection
            const record = await Promise.race([
                this.DB(this.TABLE.exhibit_records)
                    .select(EXHIBIT_COLUMNS)
                    .where({
                        uuid: uuid,
                        is_deleted: 0
                    })
                    .first(), // Returns single object instead of array

                // Timeout after 10 seconds
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 10000)
                )
            ]);

            // Return null if not found
            return record || null;

        } catch (error) {
            // Enhanced error logging with context
            const errorContext = {
                method: 'get_exhibit_record',
                table: this.TABLE?.exhibit_records,
                uuid: uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] ' +
                'Unable to retrieve exhibit record',
                errorContext
            );

            // Re-throw error for upstream handling
            throw new Error(`Failed to retrieve exhibit record for UUID ${uuid}: ${error.message}`);
        }
    }

    /**
     * Gets exhibit record by uuid
     * @param uuid
     * @param uid
     */
    async get_exhibit_edit_record(uid, uuid) {

        try {

            let data = await this.DB(this.TABLE.exhibit_records)
            .select('uuid',
                'type',
                'title',
                'subtitle',
                'banner_template',
                'about_the_curators',
                'alert_text',
                'hero_image',
                'thumbnail',
                'description',
                'page_layout',
                'exhibit_template',
                'exhibit_subjects',
                'styles',
                'order',
                'is_published',
                'is_preview',
                'is_featured',
                'is_student_curated',
                'is_locked',
                'locked_by_user',
                'owner',
                'created',
                'updated',
                'created_by',
                'updated_by'
            )
            .where({
                uuid: uuid,
                is_deleted: 0
            });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uid, uuid, this.DB, this.TABLE.exhibit_records);
                    data[0].locked_by_user = uid;
                    data[0].is_locked = 1;
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (get_exhibit_record)] unable to get exhibit record ' + error.message);
        }
    }

    /**
     * Updates an exhibit record with validated data
     * @param {string} uuid - The exhibit UUID
     * @param {Object} data - Object containing fields to update
     * @param {string} [updatedBy=null] - User ID performing the update
     * @returns {Promise<Object>} Updated exhibit record
     * @throws {Error} If validation fails or update fails
     */
    async update_exhibit_record(uuid, data, updatedBy = null) {

        // Define whitelist of allowed updatable fields
        const ALLOWED_UPDATE_FIELDS = [
            'type',
            'title',
            'subtitle',
            'banner_template',
            'about_the_curators',
            'alert_text',
            'hero_image',
            'thumbnail',
            'description',
            'page_layout',
            'exhibit_template',
            'exhibit_subjects',
            'styles',
            'order',
            'is_published',
            'is_preview',
            'is_featured',
            'is_locked',
            'is_student_curated',
            'owner'
        ];

        // Protected fields that should never be updated directly
        const PROTECTED_FIELDS = [
            'uuid',
            'created',
            'created_by',
            'is_deleted'
        ];

        try {
            // ===== INPUT VALIDATION =====

            // Validate UUID
            if (!uuid || typeof uuid !== 'string') {
                throw new Error('UUID is required and must be a string');
            }

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid)) {
                throw new Error('Invalid UUID format');
            }

            // Validate data object
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Data must be a non-null object');
            }

            // Check for empty data
            const dataKeys = Object.keys(data);
            if (dataKeys.length === 0) {
                throw new Error('No data provided for update');
            }

            // Validate database connection
            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            // ===== SECURITY CHECKS =====

            // Check for protected fields
            const protectedFieldsFound = dataKeys.filter(key =>
                PROTECTED_FIELDS.includes(key)
            );
            if (protectedFieldsFound.length > 0) {
                throw new Error(
                    `Cannot update protected fields: ${protectedFieldsFound.join(', ')}`
                );
            }

            // Filter to only allowed fields (whitelist approach)
            const sanitizedData = {};
            const invalidFields = [];

            dataKeys.forEach(key => {
                if (ALLOWED_UPDATE_FIELDS.includes(key)) {
                    sanitizedData[key] = data[key];
                } else {
                    invalidFields.push(key);
                }
            });

            // Warn about invalid fields (don't fail, just ignore)
            if (invalidFields.length > 0) {
                LOGGER.module().warn(
                    'Invalid fields ignored in update',
                    { uuid, invalidFields }
                );
            }

            // Check if we have any valid fields to update
            if (Object.keys(sanitizedData).length === 0) {
                throw new Error('No valid fields provided for update');
            }

            // ===== PERFORM UPDATE =====

            // Add metadata
            sanitizedData.updated = this.DB.fn.now(); // Use database timestamp
            if (updatedBy) {
                sanitizedData.updated_by = updatedBy;
            }

            // Check if record exists first
            const existingRecord = await this.DB(this.TABLE.exhibit_records)
                .select('uuid', 'is_deleted')
                .where({ uuid })
                .first()
                .timeout(5000);

            if (!existingRecord) {
                throw new Error(`Exhibit record not found: ${uuid}`);
            }

            if (existingRecord.is_deleted === 1) {
                throw new Error(`Cannot update deleted exhibit record: ${uuid}`);
            }

            // Perform the update with timeout
            const updateCount = await Promise.race([
                this.DB(this.TABLE.exhibit_records)
                    .where({ uuid })
                    .update(sanitizedData),

                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Update timeout')), 10000)
                )
            ]);

            // Verify update occurred
            if (updateCount === 0) {
                throw new Error('Update failed: No rows affected');
            }

            // Fetch and return the updated record
            const updatedRecord = await this.DB(this.TABLE.exhibit_records)
                .where({ uuid })
                .first();

            LOGGER.module().info(
                'Exhibit record updated successfully',
                {
                    uuid,
                    fieldsUpdated: Object.keys(sanitizedData),
                    updatedBy
                }
            );

            return true;

        } catch (error) {
            const errorContext = {
                method: 'update_exhibit_record',
                uuid,
                dataKeys: Object.keys(data || {}),
                updatedBy,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'ERROR: [/exhibits/exhibit_record_tasks (update_exhibit_record)] ' +
                'Failed to update exhibit record',
                errorContext
            );

            // Re-throw error instead of returning false
            throw error;
        }
    }

    /**
     * Soft deletes an exhibit record (marks as deleted rather than removing)
     * @param {string} uuid - The exhibit UUID to delete
     * @param {string} [deletedBy=null] - User ID performing the deletion
     * @returns {Promise<Object>} The deleted exhibit record
     * @throws {Error} If validation fails or deletion fails
     */
    async delete_exhibit_record(uuid, deletedBy = null) {

        try {

            if (!uuid || typeof uuid !== 'string') {
                throw new Error('UUID is required and must be a string');
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid)) {
                throw new Error('Invalid UUID format');
            }

            // Validate database connection
            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            // ===== CHECK RECORD STATUS =====

            // Check if record exists and get current status
            const existingRecord = await this.DB(this.TABLE.exhibit_records)
                .select('uuid', 'is_deleted', 'title')
                .where({ uuid })
                .first()
                .timeout(5000);

            if (!existingRecord) {
                throw new Error(`Exhibit record not found: ${uuid}`);
            }

            if (existingRecord.is_deleted === 1) {
                throw new Error(`Exhibit record is already deleted: ${uuid}`);
            }

            // ===== PERFORM SOFT DELETE =====
            // Prepare update data with audit trail
            const deleteData = {
                is_deleted: 1,
                updated: this.DB.fn.now()
            };

            // Add deleted_by if provided (assumes column exists)
            if (deletedBy) {
                deleteData.updated_by = deletedBy;
                // If you have a deleted_by column, uncomment:
                // deleteData.deleted_by = deletedBy;
            }

            // Perform the update with timeout
            const updateCount = await Promise.race([
                this.DB(this.TABLE.exhibit_records)
                    .where({ uuid })
                    .update(deleteData),

                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Delete operation timeout')), 10000)
                )
            ]);

            // Verify deletion occurred
            if (updateCount === 0) {
                throw new Error('Delete failed: No rows affected');
            }

            // Fetch the deleted record
            const deletedRecord = await this.DB(this.TABLE.exhibit_records)
                .where({ uuid })
                .first();

            LOGGER.module().info(
                'Exhibit record deleted successfully',
                {
                    uuid,
                    title: existingRecord.title,
                    deletedBy,
                    timestamp: new Date().toISOString()
                }
            );

            return true;

        } catch (error) {
            const errorContext = {
                method: 'delete_exhibit_record',
                uuid,
                deletedBy,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'ERROR: [/exhibits/exhibit_record_tasks (delete_exhibit_record)] ' +
                'Failed to delete exhibit record',
                errorContext
            );

            // Re-throw error instead of returning undefined
            throw error;
        }
    }

    /**
     * Removes a media file reference from an exhibit record
     * @param {string} uuid - The exhibit UUID
     * @param {string} media - Media field identifier (e.g., 'hero_image', 'thumbnail')
     * @param {string} [updatedBy=null] - User ID performing the deletion
     * @returns {Promise<Object>} Updated exhibit record
     * @throws {Error} If validation fails or deletion fails
     */
    async delete_media_value(uuid, media, updatedBy = null) {

        try {

            // ===== INPUT VALIDATION =====
            if (!uuid || typeof uuid !== 'string') {
                throw new Error('UUID is required and must be a string');
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid)) {
                throw new Error('Invalid UUID format');
            }

            if (!media || typeof media !== 'string') {
                throw new Error('Media parameter is required and must be a string');
            }

            // Validate database connection
            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            // ===== PARSE AND VALIDATE MEDIA FIELD =====

            let tmp = media.split('_');
            let file = tmp.pop();
            const sanitized_filename = file.trim().toLowerCase();
            let mediaField = null;

            if (sanitized_filename.includes('hero')) {
                mediaField = 'hero_image';
            } else if (sanitized_filename.includes('thumbnail')) {
                mediaField = 'thumbnail';
            }

            if (!mediaField) {
                throw new Error(
                    `Invalid or unsupported media field: ${media}.`
                );
            }

            // ===== CHECK RECORD EXISTS =====

            const existingRecord = await this.DB(this.TABLE.exhibit_records)
                .select('uuid', 'is_deleted', mediaField)
                .where({ uuid })
                .first()
                .timeout(5000);

            if (!existingRecord) {
                throw new Error(`Exhibit record not found: ${uuid}`);
            }

            if (existingRecord.is_deleted === 1) {
                throw new Error(`Cannot modify deleted exhibit record: ${uuid}`);
            }

            // Check if media field has a value
            if (!existingRecord[mediaField]) {
                LOGGER.module().warn(
                    `Media field already empty: ${mediaField}`,
                    { uuid, mediaField }
                );
                // Return current record without updating
                return existingRecord;
            }

            // ===== PERFORM UPDATE =====

            // Prepare update object
            const updateData = {
                [mediaField]: '',
                updated: this.DB.fn.now()
            };

            if (updatedBy) {
                updateData.updated_by = updatedBy;
            }

            // Perform the update with timeout
            const updateCount = await Promise.race([
                this.DB(this.TABLE.exhibit_records)
                    .where({ uuid })
                    .update(updateData),

                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Update timeout')), 10000)
                )
            ]);

            // Verify update occurred
            if (updateCount === 0) {
                throw new Error('Media deletion failed: No rows affected');
            }

            // Fetch and return updated record
            const updatedRecord = await this.DB(this.TABLE.exhibit_records)
                .where({ uuid })
                .first();

            LOGGER.module().info(
                'Media value deleted successfully',
                {
                    uuid,
                    mediaField,
                    previousValue: existingRecord[mediaField],
                    updatedBy,
                    timestamp: new Date().toISOString()
                }
            );

            return true;

        } catch (error) {
            const errorContext = {
                method: 'delete_media_value',
                uuid,
                media,
                updatedBy,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'ERROR: [/exhibits/exhibit_record_tasks (delete_media_value)] ' +
                'Failed to delete media value',
                errorContext
            );

            // Re-throw error instead of returning false
            throw error;
        }
    }

    /**
     * Sets is_published flog to true
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid UUID is required');
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid.trim())) {
                throw new Error('Invalid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }


            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_preview: 0,
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (set_to_publish)] Exhibit is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (set_to_publish)] unable to set exhibit is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to false
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid UUID is required');
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid.trim())) {
                throw new Error('Invalid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (set_to_suppress)] Exhibit is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (set_to_suppress)] unable to set exhibit is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets preview flag
     * @param uuid
     */
    async set_preview(uuid) {

        try {

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid UUID is required');
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid.trim())) {
                throw new Error('Invalid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_preview: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (set_preview)] Exhibit preview set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (set_preview)] unable to set exhibit preview ' + error.message);
            return false;
        }
    }

    /**
     * Changes preview flag to false
     * @param uuid
     */
    async unset_preview(uuid) {

        try {

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid UUID is required');
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid.trim())) {
                throw new Error('Invalid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                is_preview: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_record_tasks (unset_preview)] Exhibit preview set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (unset_preview)] unable to unset exhibit preview ' + error.message);
            return false;
        }
    }

    /**
     * Reorder exhibits
     * @param uuid
     * @param order
     */
    async reorder_exhibits(uuid, order) {

        try {

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid UUID is required');
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid.trim())) {
                throw new Error('Invalid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.exhibit_records) {
                throw new Error('Table name "exhibit_records" is not defined');
            }

            await this.DB(this.TABLE.exhibit_records)
            .where({
                uuid: uuid
            })
            .update({
                order: order
            });

            LOGGER.module().info('INFO: [/exhibits/item_record_tasks (reorder_exhibits)] Exhibits reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_record_tasks (reorder_exhibits)] unable to reorder exhibits ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_record_tasks;
