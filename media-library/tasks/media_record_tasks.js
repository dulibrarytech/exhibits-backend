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

/**
 * Object contains tasks used to manage media records
 * @param DB
 * @param TABLE
 * @type {Media_record_tasks}
 */
const Media_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
        this.QUERY_TIMEOUT = 10000;
    }

    /**
     * Validates that database connection is available
     * @private
     * @throws {Error} If database is not configured
     */
    _validate_database() {
        if (!this.DB) {
            throw new Error('Database connection not configured');
        }
    }

    /**
     * Validates that a table exists in configuration
     * @private
     * @param {string} table_name - Table name to validate
     * @throws {Error} If table is not configured
     */
    _validate_table(table_name) {
        if (!this.TABLE || !this.TABLE[table_name]) {
            throw new Error(`Table '${table_name}' not configured`);
        }
    }

    /**
     * Validates UUID format
     * @private
     * @param {string} uuid - UUID to validate
     * @param {string} field_name - Field name for error message
     * @returns {string} Validated UUID
     * @throws {Error} If UUID is invalid
     */
    _validate_uuid(uuid, field_name = 'UUID') {
        if (!uuid || typeof uuid !== 'string') {
            throw new Error(`Invalid ${field_name}: must be a non-empty string`);
        }

        const trimmed = uuid.trim();
        const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuid_regex.test(trimmed)) {
            throw new Error(`Invalid ${field_name} format`);
        }

        return trimmed;
    }

    /**
     * Validates multiple UUIDs
     * @private
     * @param {Object} uuid_map - Map of UUID to field name
     * @returns {Object} Map of field name to validated UUID
     */
    _validate_uuids(uuid_map) {
        const validated = {};
        for (const [uuid, field_name] of Object.entries(uuid_map)) {
            validated[field_name] = this._validate_uuid(uuid, field_name);
        }
        return validated;
    }

    /**
     * Validates a string field
     * @private
     * @param {string} value - Value to validate
     * @param {string} field_name - Field name for error message
     * @returns {string} Validated string
     * @throws {Error} If string is invalid
     */
    _validate_string(value, field_name = 'value') {
        if (!value || typeof value !== 'string' || value.trim() === '') {
            throw new Error(`Invalid ${field_name}: must be a non-empty string`);
        }
        return value.trim();
    }

    /**
     * Logs success message with context
     * @private
     * @param {string} message - Success message
     * @param {Object} context - Additional context
     */
    _log_success(message, context = {}) {
        LOGGER.module().info(`INFO: [/media-library/tasks/media_record_tasks] ${message}`, context);
    }

    /**
     * Handles and logs errors
     * @private
     * @param {Error} error - Error object
     * @param {string} method - Method name where error occurred
     * @param {Object} context - Additional context
     * @throws {Error} Re-throws the error after logging
     */
    _handle_error(error, method, context = {}) {
        LOGGER.module().error(`ERROR: [/media-library/tasks/media_record_tasks (${method})] ${error.message}`, {
            ...context,
            stack: error.stack
        });
        throw error;
    }

    /**
     * Creates a new media record
     * @param {Object} data - Media record data
     * @returns {Promise<Object>} Created media record result
     */
    async create_media_record(data) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            if (!data || typeof data !== 'object') {
                throw new Error('Invalid media data: must be an object');
            }

            const created_record = await this.DB.transaction(async (trx) => {
                const [inserted_id] = await trx(this.TABLE.media_library_records)
                    .insert(data)
                    .timeout(this.QUERY_TIMEOUT);

                const created = await trx(this.TABLE.media_library_records)
                    .select('*')
                    .where({id: inserted_id})
                    .first();

                return created;
            });

            if (!created_record) {
                throw new Error('Failed to retrieve created record');
            }

            this._log_success('Media record created successfully', {
                id: created_record.id,
                uuid: created_record.uuid
            });

            return {
                success: true,
                id: created_record.id,
                uuid: created_record.uuid,
                record: created_record,
                message: 'Media record created successfully'
            };

        } catch (error) {
            this._handle_error(error, 'create_media_record', {data});
        }
    }

    /**
     * Gets all media records
     * @returns {Promise<Object>} Array of media records
     */
    async get_media_records() {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            const records = await this.DB(this.TABLE.media_library_records)
                .select('*')
                .where({is_deleted: 0})
                .orderBy('created', 'desc')
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Media records retrieved successfully', {
                count: records.length
            });

            return {
                success: true,
                records: records || [],
                count: records.length,
                message: 'Media records retrieved successfully'
            };

        } catch (error) {
            this._handle_error(error, 'get_media_records');
        }
    }

    /**
     * Gets media records with optional pagination, search, and media type filtering.
     * Used by the media picker modal browse grid.
     *
     * @param {Object} options - Query options
     * @param {number} [options.page=1] - Page number (1-based)
     * @param {number} [options.limit=20] - Records per page
     * @param {string} [options.q=null] - Search term (matches name, original_filename, description, created_by)
     * @param {string} [options.media_type=null] - Media type filter (image, video, audio, pdf)
     * @returns {Promise<Object>} { success, records, total, page, limit, message }
     */
    async get_media_records_browse(options = {}) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            const page = Math.max(1, parseInt(options.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
            const offset = (page - 1) * limit;
            const search_term = options.q && typeof options.q === 'string' ? options.q.trim() : null;
            const media_type = options.media_type && typeof options.media_type === 'string' ? options.media_type.trim().toLowerCase() : null;

            // Map picker filter values to database media_type values
            const MEDIA_TYPE_MAP = {
                'image': ['image'],
                'video': ['moving image', 'video'],
                'audio': ['sound recording', 'sound', 'audio'],
                'pdf': ['pdf']
            };

            // Build base query conditions
            const build_where = (query) => {
                query.where({is_deleted: 0});

                // Apply media type filter
                if (media_type && MEDIA_TYPE_MAP[media_type]) {
                    query.whereIn('media_type', MEDIA_TYPE_MAP[media_type]);
                }

                // Apply search filter
                if (search_term) {
                    const like_term = `%${search_term}%`;
                    query.where(function () {
                        this.where('name', 'like', like_term)
                            .orWhere('original_filename', 'like', like_term)
                            .orWhere('description', 'like', like_term)
                            .orWhere('created_by', 'like', like_term);
                    });
                }
            };

            // Get total count (for pagination)
            const count_query = this.DB(this.TABLE.media_library_records).count('id as total');
            build_where(count_query);
            const count_result = await count_query.first().timeout(this.QUERY_TIMEOUT);
            const total = count_result ? parseInt(count_result.total, 10) : 0;

            // Get paginated records
            const records_query = this.DB(this.TABLE.media_library_records)
                .select('*')
                .orderBy('created', 'desc')
                .limit(limit)
                .offset(offset);
            build_where(records_query);
            const records = await records_query.timeout(this.QUERY_TIMEOUT);

            this._log_success('Media records browse query completed', {
                page,
                limit,
                total,
                returned: records.length,
                search_term,
                media_type
            });

            return {
                success: true,
                records: records || [],
                total: total,
                page: page,
                limit: limit,
                message: 'Media records retrieved successfully'
            };

        } catch (error) {
            this._handle_error(error, 'get_media_records_browse', {
                options
            });
        }
    }

    /**
     * Gets a single media record by UUID
     * @param {string} uuid - The media record UUID
     * @returns {Promise<Object>} Media record or null
     */
    async get_media_record(uuid) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            const validated_uuid = this._validate_uuid(uuid, 'media UUID');

            const record = await this.DB(this.TABLE.media_library_records)
                .select('*')
                .where({
                    uuid: validated_uuid,
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                return {
                    success: false,
                    record: null,
                    message: 'Media record not found'
                };
            }

            this._log_success('Media record retrieved successfully', {uuid: validated_uuid});

            return {
                success: true,
                record: record,
                message: 'Media record retrieved successfully'
            };

        } catch (error) {
            this._handle_error(error, 'get_media_record', {uuid});
        }
    }

    /**
     * Updates a media record
     * @param {string} uuid - Media record UUID
     * @param {Object} data - Update data
     * @param {string|number} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result
     */
    async update_media_record(uuid, data, updated_by = null) {

        const UPDATABLE_FIELDS = [
            'name', 'title', 'description', 'alt_text', 'caption',
            'media_type', 'mime_type', 'filename', 'original_filename',
            'file_size', 'size', 'topics', 'genre_form', 'places', 'item_type',
            'topics_subjects', 'genre_form_subjects', 'places_subjects',
            'is_published', 'metadata', 'tags', 'updated_by',
            'iiif_manifest', 'media_width', 'media_height', 'media_duration'
        ];

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            const validated_uuid = this._validate_uuid(uuid, 'media UUID');

            if (!data || typeof data !== 'object') {
                throw new Error('Invalid update data: must be an object');
            }

            // Check record exists
            const existing = await this.DB(this.TABLE.media_library_records)
                .select('id', 'uuid', 'is_deleted')
                .where({uuid: validated_uuid})
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                return {
                    success: false,
                    message: 'Media record not found'
                };
            }

            if (existing.is_deleted === 1) {
                return {
                    success: false,
                    message: 'Cannot update deleted media record'
                };
            }

            // Filter to only updatable fields
            const update_data = {};
            for (const field of UPDATABLE_FIELDS) {
                if (data.hasOwnProperty(field) && data[field] !== undefined) {
                    update_data[field] = data[field];
                }
            }

            // Always set updated timestamp
            update_data.updated = this.DB.fn.now();

            if (updated_by) {
                update_data.updated_by = updated_by;
            }

            if (Object.keys(update_data).length === 1) {
                // Only updated timestamp, nothing to update
                return {
                    success: true,
                    no_change: true,
                    uuid: validated_uuid,
                    message: 'No fields to update'
                };
            }

            // Perform update
            const affected_rows = await this.DB(this.TABLE.media_library_records)
                .where({
                    uuid: validated_uuid,
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Update failed: No rows affected');
            }

            // Fetch updated record
            const updated_record = await this.DB(this.TABLE.media_library_records)
                .select('*')
                .where({uuid: validated_uuid})
                .first()
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Media record updated successfully', {
                uuid: validated_uuid,
                fields_updated: Object.keys(update_data),
                affected_rows
            });

            return {
                success: true,
                uuid: validated_uuid,
                record: updated_record,
                affected_rows,
                message: 'Media record updated successfully'
            };

        } catch (error) {
            this._handle_error(error, 'update_media_record', {uuid, data, updated_by});
        }
    }

    /**
     * Deletes a media record (soft delete)
     * @param {string} uuid - Media record UUID
     * @param {string|number} [deleted_by=null] - User ID performing deletion
     * @returns {Promise<Object>} Delete result
     */
    async delete_media_record(uuid, deleted_by = null) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            const validated_uuid = this._validate_uuid(uuid, 'media UUID');

            // Check record exists
            const existing = await this.DB(this.TABLE.media_library_records)
                .select('id', 'uuid', 'is_deleted')
                .where({uuid: validated_uuid})
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                return {
                    success: false,
                    message: 'Media record not found'
                };
            }

            if (existing.is_deleted === 1) {
                return {
                    success: true,
                    already_deleted: true,
                    uuid: validated_uuid,
                    message: 'Media record was already deleted'
                };
            }

            // Perform soft delete
            const delete_data = {
                is_deleted: 1,
                updated: this.DB.fn.now()
            };

            if (deleted_by) {
                delete_data.updated_by = deleted_by;
            }

            const affected_rows = await this.DB(this.TABLE.media_library_records)
                .where({
                    uuid: validated_uuid,
                    is_deleted: 0
                })
                .update(delete_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Delete failed: No rows affected');
            }

            this._log_success('Media record deleted successfully', {
                uuid: validated_uuid,
                deleted_by,
                affected_rows
            });

            return {
                success: true,
                uuid: validated_uuid,
                affected_rows,
                message: 'Media record deleted successfully'
            };

        } catch (error) {
            this._handle_error(error, 'delete_media_record', {uuid, deleted_by});
        }
    }

    /**
     * Adds an exhibit UUID to a media record's exhibits JSON array.
     * Creates the array if null/empty; prevents duplicate entries.
     * Uses a transaction with SELECT ... FOR UPDATE to prevent race conditions.
     *
     * @param {string} media_uuid - Media record UUID
     * @param {string} exhibit_uuid - Exhibit UUID to add
     * @param {string|null} media_role - Role context for logging ('item_media', 'thumbnail', etc.)
     * @returns {Promise<Object>} Result with updated exhibits array
     */
    async add_exhibit_to_media_record(media_uuid, exhibit_uuid, media_role = null) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            const validated_media_uuid = this._validate_uuid(media_uuid, 'media UUID');
            const validated_exhibit_uuid = this._validate_uuid(exhibit_uuid, 'exhibit UUID');

            const result = await this.DB.transaction(async (trx) => {

                // Lock the row to prevent concurrent modifications
                const record = await trx(this.TABLE.media_library_records)
                    .select('id', 'uuid', 'exhibits', 'is_deleted')
                    .where({ uuid: validated_media_uuid })
                    .forUpdate()
                    .first()
                    .timeout(this.QUERY_TIMEOUT);

                if (!record) {
                    return { success: false, message: 'Media record not found' };
                }

                if (record.is_deleted === 1) {
                    return { success: false, message: 'Cannot update deleted media record' };
                }

                // Parse existing exhibits array or initialize empty
                let exhibits = [];

                if (record.exhibits && typeof record.exhibits === 'string') {
                    try {
                        exhibits = JSON.parse(record.exhibits);

                        if (!Array.isArray(exhibits)) {
                            exhibits = [];
                        }
                    } catch (parse_error) {
                        LOGGER.module().warn(`WARNING: [/media-library/tasks/media_record_tasks (add_exhibit_to_media_record)] Invalid JSON in exhibits field for ${validated_media_uuid}, resetting to empty array`);
                        exhibits = [];
                    }
                }

                // Prevent duplicate entries
                if (exhibits.includes(validated_exhibit_uuid)) {
                    return {
                        success: true,
                        already_present: true,
                        exhibits: exhibits,
                        message: 'Exhibit UUID already present in media record'
                    };
                }

                // Append the exhibit UUID
                exhibits.push(validated_exhibit_uuid);

                // Write back
                await trx(this.TABLE.media_library_records)
                    .where({ uuid: validated_media_uuid, is_deleted: 0 })
                    .update({
                        exhibits: JSON.stringify(exhibits),
                        updated: trx.fn.now()
                    })
                    .timeout(this.QUERY_TIMEOUT);

                return {
                    success: true,
                    exhibits: exhibits,
                    message: 'Exhibit UUID added to media record'
                };
            });

            if (result.success && !result.already_present) {
                this._log_success('Exhibit added to media record', {
                    media_uuid: validated_media_uuid,
                    exhibit_uuid: validated_exhibit_uuid,
                    media_role: media_role || 'unknown',
                    exhibits_count: result.exhibits.length
                });
            } else if (result.success && result.already_present) {
                this._log_success('Exhibit already associated with media record (no-op)', {
                    media_uuid: validated_media_uuid,
                    exhibit_uuid: validated_exhibit_uuid,
                    media_role: media_role || 'unknown',
                    exhibits_count: result.exhibits.length
                });
            }

            return result;

        } catch (error) {
            this._handle_error(error, 'add_exhibit_to_media_record', { media_uuid, exhibit_uuid, media_role });
        }
    }

    /**
     * Removes an exhibit UUID from a media record's exhibits JSON array.
     * No-op if the exhibit UUID is not present in the array.
     * Uses a transaction with SELECT ... FOR UPDATE to prevent race conditions.
     *
     * @param {string} media_uuid - Media record UUID
     * @param {string} exhibit_uuid - Exhibit UUID to remove
     * @param {string|null} media_role - Role context for logging ('item_media', 'thumbnail', etc.)
     * @returns {Promise<Object>} Result with updated exhibits array
     */
    async remove_exhibit_from_media_record(media_uuid, exhibit_uuid, media_role = null) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            const validated_media_uuid = this._validate_uuid(media_uuid, 'media UUID');
            const validated_exhibit_uuid = this._validate_uuid(exhibit_uuid, 'exhibit UUID');

            const result = await this.DB.transaction(async (trx) => {

                // Lock the row to prevent concurrent modifications
                const record = await trx(this.TABLE.media_library_records)
                    .select('id', 'uuid', 'exhibits', 'is_deleted')
                    .where({ uuid: validated_media_uuid })
                    .forUpdate()
                    .first()
                    .timeout(this.QUERY_TIMEOUT);

                if (!record) {
                    return { success: false, message: 'Media record not found' };
                }

                if (record.is_deleted === 1) {
                    return { success: false, message: 'Cannot update deleted media record' };
                }

                // Parse existing exhibits array
                let exhibits = [];

                if (record.exhibits && typeof record.exhibits === 'string') {
                    try {
                        exhibits = JSON.parse(record.exhibits);

                        if (!Array.isArray(exhibits)) {
                            exhibits = [];
                        }
                    } catch (parse_error) {
                        LOGGER.module().warn(`WARNING: [/media-library/tasks/media_record_tasks (remove_exhibit_from_media_record)] Invalid JSON in exhibits field for ${validated_media_uuid}, resetting to empty array`);
                        exhibits = [];
                    }
                }

                // Check if UUID is present
                const index = exhibits.indexOf(validated_exhibit_uuid);

                if (index === -1) {
                    return {
                        success: true,
                        not_present: true,
                        exhibits: exhibits,
                        message: 'Exhibit UUID was not present in media record'
                    };
                }

                // Remove the exhibit UUID
                exhibits.splice(index, 1);

                // Write back (store null if empty for clean DB state)
                await trx(this.TABLE.media_library_records)
                    .where({ uuid: validated_media_uuid, is_deleted: 0 })
                    .update({
                        exhibits: exhibits.length > 0 ? JSON.stringify(exhibits) : null,
                        updated: trx.fn.now()
                    })
                    .timeout(this.QUERY_TIMEOUT);

                return {
                    success: true,
                    exhibits: exhibits,
                    message: 'Exhibit UUID removed from media record'
                };
            });

            if (result.success && !result.not_present) {
                this._log_success('Exhibit removed from media record', {
                    media_uuid: validated_media_uuid,
                    exhibit_uuid: validated_exhibit_uuid,
                    media_role: media_role || 'unknown',
                    exhibits_count: result.exhibits.length
                });
            } else if (result.success && result.not_present) {
                this._log_success('Exhibit was not associated with media record (no-op)', {
                    media_uuid: validated_media_uuid,
                    exhibit_uuid: validated_exhibit_uuid,
                    media_role: media_role || 'unknown',
                    exhibits_count: result.exhibits.length
                });
            }

            return result;

        } catch (error) {
            this._handle_error(error, 'remove_exhibit_from_media_record', { media_uuid, exhibit_uuid, media_role });
        }
    }

    /**
     * Checks if a non-deleted media record already exists with the given field value
     * Used to detect duplicate imports for repo_uuid and kaltura_entry_id
     * @param {string} field_name - Column name to check ('repo_uuid' or 'kaltura_entry_id')
     * @param {string} field_value - Value to search for
     * @returns {Promise<Object>} Result with exists flag and matching record summary
     */
    async check_duplicate_by_field(field_name, field_value) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            // Whitelist allowed fields to prevent SQL injection
            const ALLOWED_FIELDS = ['repo_uuid', 'kaltura_entry_id'];

            if (!ALLOWED_FIELDS.includes(field_name)) {
                throw new Error('Invalid field name for duplicate check: ' + field_name);
            }

            if (!field_value || typeof field_value !== 'string' || field_value.trim() === '') {
                throw new Error('Field value is required for duplicate check');
            }

            const trimmed_value = field_value.trim();

            const record = await this.DB(this.TABLE.media_library_records)
                .select('id', 'uuid', 'name', 'created', 'created_by')
                .where(field_name, trimmed_value)
                .andWhere({is_deleted: 0})
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (record) {
                this._log_success('Duplicate found', {
                    field: field_name,
                    value: trimmed_value,
                    existing_uuid: record.uuid
                });

                return {
                    success: true,
                    exists: true,
                    record: {
                        uuid: record.uuid,
                        name: record.name,
                        created: record.created,
                        created_by: record.created_by
                    },
                    message: 'A media record with this ' + field_name + ' already exists'
                };
            }

            return {
                success: true,
                exists: false,
                record: null,
                message: 'No duplicate found'
            };

        } catch (error) {
            this._handle_error(error, 'check_duplicate_by_field', {field_name, field_value});
        }
    }

    /**
     * Gets the count of media records
     * @param {Object} [filters={}] - Optional filters (e.g., media_type)
     * @returns {Promise<number>} Count of media records
     */
    async get_record_count(filters = {}) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            let query = this.DB(this.TABLE.media_library_records)
                .count('id as count')
                .where({is_deleted: 0});

            // Apply optional filters
            if (filters.media_type) {
                query = query.andWhere({media_type: filters.media_type});
            }

            const result = await query.timeout(this.QUERY_TIMEOUT);

            return result?.[0]?.count ? parseInt(result[0].count, 10) : 0;

        } catch (error) {
            LOGGER.module().error('ERROR: [/media-library/tasks/media_record_tasks (get_record_count)] ' + error.message);
            return 0;
        }
    }

    /** TODO: media searches currently occur client-side
     * Searches media records by keyword
     * @param {string} keyword - Search keyword
     * @param {Object} [options={}] - Search options (limit, offset)
     * @returns {Promise<Object>} Search results
     */
    async search_media_records(keyword, options = {}) {

        try {

            this._validate_database();
            this._validate_table('media_library_records');

            const search_term = this._validate_string(keyword, 'search keyword');
            const limit = options.limit || 50;
            const offset = options.offset || 0;

            const records = await this.DB(this.TABLE.media_library_records)
                .select('*')
                .where({is_deleted: 0})
                .andWhere(function() {
                    this.where('name', 'like', `%${search_term}%`)
                        .orWhere('title', 'like', `%${search_term}%`)
                        .orWhere('description', 'like', `%${search_term}%`)
                        .orWhere('alt_text', 'like', `%${search_term}%`)
                        .orWhere('filename', 'like', `%${search_term}%`);
                })
                .orderBy('created', 'desc')
                .limit(limit)
                .offset(offset)
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Media records search completed', {
                keyword: search_term,
                count: records.length
            });

            return {
                success: true,
                records: records || [],
                count: records.length,
                keyword: search_term,
                message: 'Search completed successfully'
            };

        } catch (error) {
            this._handle_error(error, 'search_media_records', {keyword, options});
        }
    }

    /**
     * Gets user's full name by token
     * @param {string} token - User authentication token
     * @returns {Promise<Object>} Result object with user's full name
     */
    async get_user(token) {

        try {

            this._validate_database();
            this._validate_table('user_records');

            if (!token || typeof token !== 'string' || token.trim() === '') {
                return {
                    success: false,
                    full_name: null,
                    message: 'Invalid token provided'
                };
            }

            const user = await this.DB(this.TABLE.user_records)
                .select('first_name', 'last_name')
                .where({token: token.trim()})
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!user) {
                return {
                    success: false,
                    full_name: null,
                    message: 'User not found'
                };
            }

            // Concatenate first and last name
            const first_name = user.first_name || '';
            const last_name = user.last_name || '';
            const full_name = `${first_name} ${last_name}`.trim();

            this._log_success('User retrieved successfully', {
                full_name: full_name
            });

            return {
                success: true,
                full_name: full_name || null,
                first_name: first_name,
                last_name: last_name,
                message: 'User retrieved successfully'
            };

        } catch (error) {
            LOGGER.module().error(`ERROR: [/media-library/tasks/media_record_tasks (get_user)] ${error.message}`);
            return {
                success: false,
                full_name: null,
                message: 'Error retrieving user: ' + error.message
            };
        }
    }

    /**
     * Gets user's full name by username (decoded from JWT sub claim)
     * @param {string} username - Username from decoded JWT (req.decoded.sub)
     * @returns {Promise<Object>} Result object with user's full name
     */
    async get_user_by_username(username) {

        try {

            this._validate_database();
            this._validate_table('user_records');

            if (!username || typeof username !== 'string' || username.trim() === '') {
                return {
                    success: false,
                    full_name: null,
                    message: 'Invalid username provided'
                };
            }

            // Query user_records by du_id (the SSO username stored as JWT sub claim)
            const user = await this.DB(this.TABLE.user_records)
                .select('id', 'first_name', 'last_name')
                .where({du_id: username.trim()})
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!user) {
                LOGGER.module().warn(`WARNING: [/media-library/tasks/media_record_tasks (get_user_by_username)] User not found for username: ${username}`);
                return {
                    success: false,
                    full_name: null,
                    message: 'User not found'
                };
            }

            // Concatenate first and last name
            const first_name = user.first_name || '';
            const last_name = user.last_name || '';
            const full_name = `${first_name} ${last_name}`.trim();

            this._log_success('User retrieved by username successfully', {
                username: username,
                full_name: full_name
            });

            return {
                success: true,
                id: user.id,
                full_name: full_name || null,
                first_name: first_name,
                last_name: last_name,
                message: 'User retrieved successfully'
            };

        } catch (error) {
            LOGGER.module().error(`ERROR: [/media-library/tasks/media_record_tasks (get_user_by_username)] ${error.message}`);
            return {
                success: false,
                full_name: null,
                message: 'Error retrieving user: ' + error.message
            };
        }
    }
};

module.exports = Media_record_tasks;
