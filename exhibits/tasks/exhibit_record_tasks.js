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
        this.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        this.QUERY_TIMEOUT = 10000;
        this.FIELDS = [
            'uuid', 'type', 'title', 'subtitle', 'banner_template', 'about_the_curators',
            'alert_text', 'hero_image', 'thumbnail', 'description', 'page_layout',
            'exhibit_template', 'exhibit_subjects', 'styles', 'order', 'is_published', 'is_preview',
            'is_featured', 'is_locked', 'locked_by_user', 'is_student_curated',
            'owner', 'created', 'updated', 'created_by', 'updated_by'
        ];
        this.UPDATE_FIELDS = [
            'type', 'title', 'subtitle', 'banner_template', 'about_the_curators',
            'alert_text', 'hero_image', 'thumbnail', 'description', 'page_layout',
            'exhibit_template', 'exhibit_subjects', 'styles', 'order', 'is_published',
            'is_preview', 'is_featured', 'is_locked', 'is_student_curated', 'owner'
        ];
        this.PROTECTED_FIELDS = ['uuid', 'created', 'created_by', 'is_deleted'];
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
     * Handles error logging and re-throwing
     * @param {Error} error - Error to handle
     * @param {string} method_name - Name of the method where error occurred
     * @param {Object} context - Additional context for logging
     * @private
     */
    _handle_error(error, method_name, context = {}) {
        const error_context = {
            method: method_name,
            table: this.TABLE?.exhibit_records,
            ...context,
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack
        };

        LOGGER.module().error(
            `ERROR: [/exhibits/exhibit_record_tasks (${method_name})] Failed to ${method_name.replace(/_/g, ' ')}`,
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
     * Checks if a record exists and is not deleted
     * @param {string} uuid - Record UUID
     * @param {Array} select_fields - Fields to select
     * @returns {Promise<Object|null>} Record or null
     * @private
     */
    async _get_existing_record(uuid, select_fields = ['uuid', 'is_deleted']) {
        return await this._with_timeout(
            this.DB(this.TABLE.exhibit_records)
                .select(select_fields)
                .where({uuid})
                .first(),
            5000
        );
    }

    /**
     * Validates that a record exists and is not deleted
     * @param {string} uuid - Record UUID
     * @param {Array} select_fields - Fields to select
     * @returns {Promise<Object>} Existing record
     * @throws {Error} If record not found or deleted
     * @private
     */
    async _validate_record_exists(uuid, select_fields = ['uuid', 'is_deleted']) {
        const record = await this._get_existing_record(uuid, select_fields);

        if (!record) {
            throw new Error(`Exhibit record not found: ${uuid}`);
        }

        if (record.is_deleted === 1) {
            throw new Error(`Cannot modify deleted exhibit record: ${uuid}`);
        }

        return record;
    }

    /**
     * Sanitizes update data against whitelist
     * @param {Object} data - Data to sanitize
     * @param {Array<string>} allowed_fields - Whitelist of allowed fields
     * @returns {Object} Sanitized data
     * @private
     */
    _sanitize_update_data(data, allowed_fields = this.UPDATE_FIELDS) {
        const sanitized_data = {};
        const invalid_fields = [];

        Object.keys(data).forEach(key => {
            // Check for protected fields
            if (this.PROTECTED_FIELDS.includes(key)) {
                throw new Error(`Cannot update protected field: ${key}`);
            }

            // Whitelist check
            if (allowed_fields.includes(key)) {
                sanitized_data[key] = data[key];
            } else {
                invalid_fields.push(key);
            }
        });

        // Warn about invalid fields
        if (invalid_fields.length > 0) {
            LOGGER.module().warn('Invalid fields ignored in update', {
                invalid_fields
            });
        }

        return sanitized_data;
    }

    // ==================== COMMON OPERATIONS ====================

    /**
     * Generic flag update method (for is_published, is_preview, etc.)
     * @param {string} uuid - Record UUID
     * @param {Object} flags - Object with flag names and values
     * @param {string} operation_name - Name of operation for logging
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     * @private
     */
    async _update_flags(uuid, flags, operation_name, updated_by = null) {
        try {
            this._validate_database();
            this._validate_table('exhibit_records');
            const uuid_validated = this._validate_uuid(uuid, 'exhibit UUID');

            const update_data = {...flags};
            if (updated_by) {
                update_data.updated_by = updated_by;
            }

            const affected_rows = await this._with_timeout(
                this.DB(this.TABLE.exhibit_records)
                    .where({uuid: uuid_validated})
                    .update(update_data)
            );

            if (affected_rows === 0) {
                throw new Error(`No rows affected during ${operation_name}`);
            }

            this._log_success(`Exhibit ${operation_name} successful`, {
                uuid: uuid_validated,
                flags: Object.keys(flags)
            });

            return true;

        } catch (error) {
            LOGGER.module().error(`Failed to ${operation_name}: ` + error.message);
            return false;
        }
    }

    /**
     * Generic method to update a single record
     * @param {string} uuid - Record UUID
     * @param {Object} update_data - Data to update
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<number>} Number of affected rows
     * @private
     */
    async _perform_update(uuid, update_data, updated_by = null) {
        // Add metadata
        update_data.updated = this.DB.fn.now();
        if (updated_by) {
            update_data.updated_by = updated_by;
        }

        return await this._with_timeout(
            this.DB(this.TABLE.exhibit_records)
                .where({uuid})
                .update(update_data)
        );
    }

    // ==================== EXHIBIT RECORDS ====================

    /**
     * Creates exhibit record in database with transaction support
     * @param {Object} data - Exhibit record data to insert
     * @returns {Object} - {status: number, message: string, data: Object|null}
     */
    async create_exhibit_record(data) {
        try {
            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('exhibit_records');

            // Validate DB has transaction method
            if (typeof this.DB.transaction !== 'function') {
                throw new Error('Database transaction support not available');
            }

            // Create a copy of data to avoid mutation
            const insert_data = {...data};

            // Perform insert with transaction
            let result;
            try {
                result = await this.DB.transaction(async (trx) => {
                    return await trx(this.TABLE.exhibit_records).insert(insert_data);
                });
            } catch (transaction_error) {
                // Handle specific database errors
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

                throw transaction_error;
            }

            // Validate result
            if (!result || !Array.isArray(result) || result.length === 0) {
                throw new Error('Insert failed: No ID returned');
            }

            const inserted_id = result[0];

            if (inserted_id === null || inserted_id === undefined) {
                throw new Error('Insert failed: Invalid ID returned');
            }

            this._log_success('Exhibit record created', {
                id: inserted_id
            });

            return {
                status: 201,
                message: 'Exhibit record created.',
                data: {
                    id: inserted_id,
                    ...insert_data
                }
            };

        } catch (error) {
            LOGGER.module().error('Failed to create exhibit record: ' + error.message);

            if (process.env.NODE_ENV !== 'production') {
                LOGGER.module().debug('Stack trace: ' + error.stack);
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
     */
    async get_exhibit_records() {
        try {
            this._validate_database();
            this._validate_table('exhibit_records');

            const records = await this._with_timeout(
                this.DB(this.TABLE.exhibit_records)
                    .select(this.FIELDS)
                    .where({is_deleted: 0})
                    .orderBy('order', 'asc'),
                30000
            );

            return Array.isArray(records) ? records : [];

        } catch (error) {
            this._handle_error(error, 'get_exhibit_records');
        }
    }

    /**
     * Retrieves the title of a specific exhibit by UUID
     * @param {string} uuid - The exhibit UUID
     * @returns {Promise<Object|null>} Exhibit object with uuid and title, or null
     */
    async get_exhibit_title(uuid) {
        try {
            this._validate_database();
            this._validate_table('exhibit_records');
            const uuid_validated = this._validate_uuid(uuid, 'exhibit UUID');

            const record = await this._with_timeout(
                this.DB(this.TABLE.exhibit_records)
                    .select('uuid', 'title')
                    .where({
                        uuid: uuid_validated,
                        is_deleted: 0
                    })
                    .first()
            );

            return record || null;

        } catch (error) {
            this._handle_error(error, 'get_exhibit_title', {uuid});
        }
    }

    /**
     * Retrieves a complete exhibit record by UUID
     * @param {string} uuid - The exhibit UUID
     * @returns {Promise<Object|null>} Complete exhibit record or null
     */
    async get_exhibit_record(uuid) {
        try {
            this._validate_database();
            this._validate_table('exhibit_records');
            const uuid_validated = this._validate_uuid(uuid, 'exhibit UUID');

            const record = await this._with_timeout(
                this.DB(this.TABLE.exhibit_records)
                    .select(this.FIELDS)
                    .where({
                        uuid: uuid_validated,
                        is_deleted: 0
                    })
                    .first()
            );

            return record || null;

        } catch (error) {
            this._handle_error(error, 'get_exhibit_record', {uuid});
        }
    }

    /**
     * Retrieves exhibit record with lock validation
     * @param {string} uid - User ID
     * @param {string} uuid - Exhibit UUID
     * @returns {Promise<Object|null>} Exhibit record with lock status
     */
    async get_exhibit_edit_record(uid, uuid) {
        try {
            this._validate_database();
            this._validate_table('exhibit_records');

            if (!uid || typeof uid !== 'string' || !uid.trim()) {
                throw new Error('Valid user ID is required');
            }

            const uuid_validated = this._validate_uuid(uuid, 'exhibit UUID');
            const sanitized_uid = uid.trim();

            const record = await this._with_timeout(
                this.DB(this.TABLE.exhibit_records)
                    .select(this.FIELDS)
                    .where({uuid: uuid_validated, is_deleted: 0})
                    .first()
            );

            if (!record) {
                return null;
            }

            // Handle locking
            if (record.is_locked === 1 && record.locked_by_user === sanitized_uid) {
                this._log_success('Record already locked by this user', {
                    uuid: uuid_validated,
                    uid: sanitized_uid
                });
                return record;
            }

            if (record.is_locked === 1 && record.locked_by_user !== Number(sanitized_uid)) {
                LOGGER.module().warn('Record locked by another user', {
                    uuid: uuid_validated,
                    locked_by: record.locked_by_user,
                    requested_by: sanitized_uid
                });
                return record;
            }

            // Record is not locked, attempt to lock it
            if (record.is_locked === 0) {
                try {
                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(
                        sanitized_uid,
                        uuid_validated,
                        this.DB,
                        this.TABLE.exhibit_records
                    );

                    record.is_locked = 1;
                    record.locked_by_user = sanitized_uid;
                    record.locked_at = new Date();

                    this._log_success('Record locked successfully', {
                        uuid: uuid_validated,
                        locked_by: sanitized_uid
                    });

                } catch (lock_error) {
                    LOGGER.module().error('Lock acquisition failed', {
                        uuid: uuid_validated,
                        uid: sanitized_uid,
                        error: lock_error.message
                    });
                }
            }

            return record;

        } catch (error) {
            this._handle_error(error, 'get_exhibit_edit_record', {uid, uuid});
        }
    }

    /**
     * Updates an exhibit record with validated data
     * @param {string} uuid - The exhibit UUID
     * @param {Object} data - Object containing fields to update
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<boolean>} Success status
     */
    async update_exhibit_record(uuid, data, updated_by = null) {
        try {
            this._validate_database();
            this._validate_table('exhibit_records');
            const uuid_validated = this._validate_uuid(uuid, 'exhibit UUID');
            this._validate_data_object(data);

            // Sanitize data
            const sanitized_data = this._sanitize_update_data(data);

            if (Object.keys(sanitized_data).length === 0) {
                throw new Error('No valid fields provided for update');
            }

            // Validate record exists
            await this._validate_record_exists(uuid_validated);

            // Perform update
            const update_count = await this._perform_update(
                uuid_validated,
                sanitized_data,
                updated_by
            );

            if (update_count === 0) {
                throw new Error('Update failed: No rows affected');
            }

            this._log_success('Exhibit record updated successfully', {
                uuid: uuid_validated,
                fields_updated: Object.keys(sanitized_data),
                updated_by
            });

            return true;

        } catch (error) {
            this._handle_error(error, 'update_exhibit_record', {
                uuid,
                data_keys: Object.keys(data || {}),
                updated_by
            });
        }
    }

    /**
     * Soft deletes an exhibit record
     * @param {string} uuid - The exhibit UUID to delete
     * @param {string} [deleted_by=null] - User ID performing the deletion
     * @returns {Promise<boolean>} Success status
     */
    async delete_exhibit_record(uuid, deleted_by = null) {
        try {
            this._validate_database();
            this._validate_table('exhibit_records');
            const uuid_validated = this._validate_uuid(uuid, 'exhibit UUID');

            // Check record exists and get title
            const existing = await this._validate_record_exists(
                uuid_validated,
                ['uuid', 'is_deleted', 'title']
            );

            // Perform soft delete
            const delete_data = {is_deleted: 1};
            const update_count = await this._perform_update(
                uuid_validated,
                delete_data,
                deleted_by
            );

            if (update_count === 0) {
                throw new Error('Delete failed: No rows affected');
            }

            this._log_success('Exhibit record deleted successfully', {
                uuid: uuid_validated,
                title: existing.title,
                deleted_by
            });

            return true;

        } catch (error) {
            this._handle_error(error, 'delete_exhibit_record', {
                uuid,
                deleted_by
            });
        }
    }

    /**
     * Removes a media file reference from an exhibit record
     * @param {string} uuid - The exhibit UUID
     * @param {string} media - Media field identifier
     * @param {string} [updated_by=null] - User ID performing the deletion
     * @returns {Promise<boolean>} Success status
     */
    async delete_media_value(uuid, media, updated_by = null) {
        try {
            this._validate_database();
            this._validate_table('exhibit_records');
            const uuid_validated = this._validate_uuid(uuid, 'exhibit UUID');

            if (!media || typeof media !== 'string') {
                throw new Error('Media parameter is required and must be a string');
            }

            // Parse media field
            const tmp = media.split('_');
            const file = tmp.pop();
            const sanitized_filename = file.trim().toLowerCase();
            let media_field = null;

            if (sanitized_filename.includes('hero')) {
                media_field = 'hero_image';
            } else if (sanitized_filename.includes('thumbnail')) {
                media_field = 'thumbnail';
            }

            if (!media_field) {
                throw new Error(`Invalid or unsupported media field: ${media}`);
            }

            // Check record exists and get current media value
            const existing = await this._validate_record_exists(
                uuid_validated,
                ['uuid', 'is_deleted', media_field]
            );

            // Check if media field already empty
            if (!existing[media_field]) {
                LOGGER.module().warn(`Media field already empty: ${media_field}`, {
                    uuid: uuid_validated,
                    media_field
                });
                return true;
            }

            // Perform update
            const update_data = {[media_field]: ''};
            const update_count = await this._perform_update(
                uuid_validated,
                update_data,
                updated_by
            );

            if (update_count === 0) {
                throw new Error('Media deletion failed: No rows affected');
            }

            this._log_success('Media value deleted successfully', {
                uuid: uuid_validated,
                media_field,
                previous_value: existing[media_field],
                updated_by
            });

            return true;

        } catch (error) {
            this._handle_error(error, 'delete_media_value', {
                uuid,
                media,
                updated_by
            });
        }
    }

    // ==================== PUBLISHING / PREVIEW / SUPPRESS ====================

    /**
     * Sets exhibit to published status
     * @param {string} uuid - Exhibit UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_to_publish(uuid, updated_by = null) {
        return await this._update_flags(
            uuid,
            {is_preview: 0, is_published: 1},
            'publish',
            updated_by
        );
    }

    /**
     * Sets exhibit to suppressed status
     * @param {string} uuid - Exhibit UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_to_suppress(uuid, updated_by = null) {
        return await this._update_flags(
            uuid,
            {is_published: 0},
            'suppress',
            updated_by
        );
    }

    /**
     * Sets preview flag
     * @param {string} uuid - Exhibit UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_preview(uuid, updated_by = null) {
        return await this._update_flags(
            uuid,
            {is_preview: 1},
            'set preview',
            updated_by
        );
    }

    /**
     * Unsets preview flag
     * @param {string} uuid - Exhibit UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async unset_preview(uuid, updated_by = null) {
        return await this._update_flags(
            uuid,
            {is_preview: 0},
            'unset preview',
            updated_by
        );
    }

    // ==================== REORDERING ====================

    /**
     * Reorders exhibits
     * @param {string} uuid - Exhibit UUID
     * @param {number} order - New order value
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async reorder_exhibits(uuid, order, updated_by = null) {
        return await this._update_flags(
            uuid,
            {order: order},
            'reorder',
            updated_by
        );
    }
};

module.exports = Exhibit_record_tasks;