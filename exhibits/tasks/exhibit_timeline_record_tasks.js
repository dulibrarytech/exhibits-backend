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
const Base_tasks = require('./tasks_helper');

/**
 * Object contains tasks used to manage exhibit timeline records
 * @param DB
 * @param TABLE
 * @type {Exhibit_timeline_record_tasks}
 */
const Exhibit_timeline_record_tasks = class extends Base_tasks {

    constructor(DB, TABLE) {
        super(DB, TABLE);
    }

    // Shared methods inherited from Base_tasks

    // ==================== TIMELINE RECORDS ====================

    /**
     * Creates a new timeline record in the database
     * @param {Object} data - Timeline record data
     * @param {string} data.uuid - Timeline UUID (required)
     * @param {string} data.is_member_of_exhibit - Exhibit UUID (required)
     * @param {string} data.title - Timeline title (required)
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created timeline record with ID
     * @throws {Error} If validation fails or creation fails
     */
    async create_timeline_record(data, created_by = null) {

        const ALLOWED_FIELDS = [
            'uuid',
            'is_member_of_exhibit',
            'type',
            'title',
            'text',
            'styles',
            'order',
            'is_deleted',
            'is_published',
            'owner'
        ];

        try {

            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('timeline_records');

            // Validate required fields
            const validated_uuids = this._validate_uuids({
                [data.uuid]: 'timeline UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            const title = this._validate_string(data.title, 'timeline title');

            // Sanitize data
            const {sanitized_data} = this._sanitize_data(data, ALLOWED_FIELDS);

            // Set defaults
            const defaults = {
                type: 'vertical_timeline',
                order: 0,
                is_deleted: 0,
                is_published: 0,
                owner: 0
            };

            for (const [key, default_value] of Object.entries(defaults)) {
                if (sanitized_data[key] === undefined) {
                    sanitized_data[key] = default_value;
                }
            }

            if (created_by) {
                sanitized_data.created_by = created_by;
                sanitized_data.updated_by = created_by;
            }

            // Insert in transaction
            const created_record = await this.DB.transaction(async (trx) => {
                const [insert_id] = await trx(this.TABLE.timeline_records)
                    .insert(sanitized_data)
                    .timeout(this.QUERY_TIMEOUT);

                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                const record = await trx(this.TABLE.timeline_records)
                    .select('*')
                    .where({id: insert_id})
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                this._log_success('Timeline record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    title: record.title,
                    created_by
                });

                return record;
            });

            return {
                success: true,
                id: created_record.id,
                uuid: created_record.uuid,
                record: created_record,
                message: 'Timeline record created successfully'
            };

        } catch (error) {
            this._handle_error(error, 'create_timeline_record', {
                uuid: data?.uuid,
                exhibit_uuid: data?.is_member_of_exhibit,
                created_by
            });
        }
    }

    /**
     * Gets all timeline records by exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @returns {Promise<Array>} Array of timeline records
     */
    async get_timeline_records(is_member_of_exhibit) {

        try {

            this._validate_database();
            this._validate_table('timeline_records');

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            const timeline_records = await this.DB(this.TABLE.timeline_records)
                .select('*')
                .where({
                    is_member_of_exhibit: exhibit_uuid,
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Timeline records retrieved successfully', {
                is_member_of_exhibit: exhibit_uuid,
                count: timeline_records.length
            });

            return timeline_records;

        } catch (error) {
            this._handle_error(error, 'get_timeline_records', {
                is_member_of_exhibit
            });
        }
    }

    /**
     * Gets a single timeline record by exhibit and timeline UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} timeline_uuid - The timeline UUID
     * @returns {Promise<Object|null>} Timeline record or null if not found
     */
    async get_timeline_record(is_member_of_exhibit, timeline_uuid) {

        try {

            this._validate_database();
            this._validate_table('timeline_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [timeline_uuid]: 'timeline UUID'
            });

            const timeline_record = await this.DB(this.TABLE.timeline_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['timeline UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!timeline_record) {
                this._log_success('Timeline record not found', validated);
                return null;
            }

            this._log_success('Timeline record retrieved successfully', {
                uuid: timeline_record.uuid,
                title: timeline_record.title
            });

            return timeline_record;

        } catch (error) {
            this._handle_error(error, 'get_timeline_record', {
                is_member_of_exhibit,
                timeline_uuid
            });
        }
    }

    /**
     * Updates a timeline record in the database
     * @param {Object} data - Timeline data to update
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result
     */
    async update_timeline_record(data, updated_by = null) {

        const UPDATABLE_FIELDS = [
            'type',
            'title',
            'text',
            'styles',
            'order',
            'is_published',
            'owner'
        ];

        try {

            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('timeline_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'timeline UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            // Sanitize update data
            const {sanitized_data} = this._sanitize_data(
                data,
                UPDATABLE_FIELDS,
                ['uuid', 'is_member_of_exhibit']
            );

            if (Object.keys(sanitized_data).length === 0) {
                return {
                    success: true,
                    no_change: true,
                    uuid: validated['timeline UUID'],
                    affected_rows: 0,
                    message: 'No fields to update'
                };
            }

            if (updated_by) {
                sanitized_data.updated_by = updated_by;
            }

            // Check record exists
            const existing = await this.DB(this.TABLE.timeline_records)
                .select('id', 'uuid', 'is_deleted')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['timeline UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error('Timeline record not found');
            }

            if (existing.is_deleted === 1) {
                throw new Error('Cannot update deleted timeline record');
            }

            // Perform update
            const affected_rows = await this.DB(this.TABLE.timeline_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['timeline UUID'],
                    is_deleted: 0
                })
                .update(sanitized_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Update failed: No rows affected');
            }

            this._log_success('Timeline record updated successfully', {
                uuid: validated['timeline UUID'],
                fields_updated: Object.keys(sanitized_data),
                affected_rows,
                updated_by
            });

            return {
                success: true,
                uuid: validated['timeline UUID'],
                affected_rows,
                fields_updated: Object.keys(sanitized_data),
                message: 'Timeline record updated successfully'
            };

        } catch (error) {
            this._handle_error(error, 'update_timeline_record', {
                uuid: data?.uuid,
                updated_by
            });
        }
    }

    // ==================== TIMELINE ITEM RECORDS ====================

    /**
     * Gets all timeline item records by exhibit and timeline
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_timeline - The timeline UUID
     * @returns {Promise<Array>} Array of timeline item records
     */
    async get_timeline_item_records(is_member_of_exhibit, is_member_of_timeline) {

        try {

            this._validate_database();
            this._validate_table('timeline_item_records');
            this._validate_table('media_library_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [is_member_of_timeline]: 'timeline UUID'
            });

            const timeline_items = await this.DB(this.TABLE.timeline_item_records)
                .select(
                    `${this.TABLE.timeline_item_records}.*`,
                    `media_lib.name as media_name`,
                    `media_lib.ingest_method as media_ingest_method`,
                    `media_lib.kaltura_thumbnail_url as media_kaltura_thumbnail_url`,
                    `media_lib.repo_uuid as media_repo_uuid`,
                    `media_lib.thumbnail_path as media_thumbnail_path`,
                    `thumb_lib.name as thumbnail_media_name`,
                    `thumb_lib.ingest_method as thumbnail_ingest_method`,
                    `thumb_lib.kaltura_thumbnail_url as thumbnail_media_kaltura_thumbnail_url`,
                    `thumb_lib.repo_uuid as thumbnail_media_repo_uuid`,
                    `thumb_lib.thumbnail_path as thumbnail_media_thumbnail_path`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as media_lib`,
                    `${this.TABLE.timeline_item_records}.media_uuid`,
                    '=',
                    `media_lib.uuid`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as thumb_lib`,
                    `${this.TABLE.timeline_item_records}.thumbnail_media_uuid`,
                    '=',
                    `thumb_lib.uuid`
                )
                .where({
                    [`${this.TABLE.timeline_item_records}.is_member_of_exhibit`]: validated['exhibit UUID'],
                    [`${this.TABLE.timeline_item_records}.is_member_of_timeline`]: validated['timeline UUID'],
                    [`${this.TABLE.timeline_item_records}.is_deleted`]: 0
                })
                .orderBy(`${this.TABLE.timeline_item_records}.order`, 'asc')
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Timeline item records retrieved successfully', {
                ...validated,
                count: timeline_items.length
            });

            return timeline_items;

        } catch (error) {
            this._handle_error(error, 'get_timeline_item_records', {
                is_member_of_exhibit,
                is_member_of_timeline
            });
        }
    }

    /**
     * Creates a new timeline item record
     * @param {Object} data - Timeline item record data
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created timeline item record
     */
    async create_timeline_item_record(data, created_by = null) {

        const ALLOWED_FIELDS = [
            'uuid', 'is_member_of_timeline', 'is_member_of_exhibit', 'repo_uuid',
            'thumbnail', 'thumbnail_media_uuid', 'title', 'caption', 'item_type',
            'mime_type', 'media', 'media_uuid', 'text', 'wrap_text', 'description',
            'type', 'layout', 'media_width', 'media_padding', 'alt_text',
            'is_alt_text_decorative', 'pdf_open_to_page', 'item_subjects', 'styles',
            'order', 'date', 'is_repo_item', 'is_kaltura_item', 'is_embedded',
            'is_published', 'is_locked', 'locked_by_user', 'locked_at',
            'is_deleted', 'owner'
        ];

        try {

            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('timeline_item_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'timeline item UUID',
                [data.is_member_of_timeline]: 'timeline UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            const {sanitized_data} = this._sanitize_data(data, ALLOWED_FIELDS);

            // Set defaults based on schema
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
                if (sanitized_data[key] === undefined) {
                    sanitized_data[key] = default_value;
                }
            }

            if (created_by) {
                sanitized_data.created_by = created_by;
                sanitized_data.updated_by = created_by;
            }

            const created_record = await this.DB.transaction(async (trx) => {
                const [insert_id] = await trx(this.TABLE.timeline_item_records)
                    .insert(sanitized_data)
                    .timeout(this.QUERY_TIMEOUT);

                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                const record = await trx(this.TABLE.timeline_item_records)
                    .select('*')
                    .where({id: insert_id})
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                this._log_success('Timeline item record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    title: record.title,
                    created_by
                });

                return record;
            });

            return {
                success: true,
                id: created_record.id,
                uuid: created_record.uuid,
                record: created_record,
                message: 'Timeline item record created successfully'
            };

        } catch (error) {
            this._handle_error(error, 'create_timeline_item_record', {
                uuid: data?.uuid,
                created_by
            });
        }
    }

    /**
     * Gets a single timeline item record
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_timeline - The timeline UUID
     * @param {string} item_uuid - The timeline item UUID
     * @returns {Promise<Object|null>} Timeline item record or null
     */
    async get_timeline_item_record(is_member_of_exhibit, is_member_of_timeline, item_uuid) {

        try {

            this._validate_database();
            this._validate_table('timeline_item_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [is_member_of_timeline]: 'timeline UUID',
                [item_uuid]: 'timeline item UUID'
            });

            const timeline_item = await this.DB(this.TABLE.timeline_item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_timeline: validated['timeline UUID'],
                    uuid: validated['timeline item UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!timeline_item) {
                this._log_success('Timeline item record not found', validated);
                return null;
            }

            this._log_success('Timeline item record retrieved successfully', {
                uuid: timeline_item.uuid,
                title: timeline_item.title
            });

            return timeline_item;

        } catch (error) {
            this._handle_error(error, 'get_timeline_item_record', {
                is_member_of_exhibit,
                is_member_of_timeline,
                item_uuid
            });
        }
    }

    /**
     * Gets a timeline item record for editing and locks it
     * @param {string} user_id - The user ID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_timeline - The timeline UUID
     * @param {string} item_uuid - The timeline item UUID
     * @returns {Promise<Object>} Timeline item record with lock information
     */
    async get_timeline_item_edit_record(user_id, is_member_of_exhibit, is_member_of_timeline, item_uuid) {

        try {

            this._validate_database();
            this._validate_table('timeline_item_records');
            this._validate_table('media_library_records');

            const user_id_trimmed = this._validate_string(user_id, 'user ID');
            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [is_member_of_timeline]: 'timeline UUID',
                [item_uuid]: 'timeline item UUID'
            });

            const uid_number = Number(user_id_trimmed);
            if (isNaN(uid_number)) {
                throw new Error('User ID must be a valid number');
            }

            const timeline_item = await this.DB(this.TABLE.timeline_item_records)
                .select(
                    `${this.TABLE.timeline_item_records}.*`,
                    // Media library metadata for the primary media asset
                    `media_lib.name as media_name`,
                    `media_lib.original_filename as media_filename`,
                    `media_lib.ingest_method as media_ingest_method`,
                    `media_lib.kaltura_thumbnail_url as media_kaltura_thumbnail_url`,
                    `media_lib.repo_uuid as media_repo_uuid`,
                    `media_lib.thumbnail_path as media_thumbnail_path`,
                    `media_lib.alt_text as media_alt_text`,
                    `media_lib.is_alt_text_decorative as media_is_alt_text_decorative`,
                    `media_lib.topics_subjects as media_topics_subjects`,
                    `media_lib.genre_form_subjects as media_genre_form_subjects`,
                    `media_lib.places_subjects as media_places_subjects`,
                    // Media library metadata for the thumbnail asset
                    `thumb_lib.name as thumbnail_media_name`,
                    `thumb_lib.original_filename as thumbnail_filename`,
                    `thumb_lib.ingest_method as thumb_ingest_method`,
                    `thumb_lib.kaltura_thumbnail_url as thumb_kaltura_thumbnail_url`,
                    `thumb_lib.repo_uuid as thumbnail_repo_uuid`,
                    `thumb_lib.thumbnail_path as thumb_thumbnail_path`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as media_lib`,
                    `${this.TABLE.timeline_item_records}.media_uuid`,
                    '=',
                    `media_lib.uuid`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as thumb_lib`,
                    `${this.TABLE.timeline_item_records}.thumbnail_media_uuid`,
                    '=',
                    `thumb_lib.uuid`
                )
                .where({
                    [`${this.TABLE.timeline_item_records}.is_member_of_exhibit`]: validated['exhibit UUID'],
                    [`${this.TABLE.timeline_item_records}.is_member_of_timeline`]: validated['timeline UUID'],
                    [`${this.TABLE.timeline_item_records}.uuid`]: validated['timeline item UUID'],
                    [`${this.TABLE.timeline_item_records}.is_deleted`]: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!timeline_item) {
                throw new Error('Timeline item record not found');
            }

            // Handle locking
            if (timeline_item.is_locked === 0) {
                try {
                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(
                        user_id_trimmed,
                        validated['timeline item UUID'],
                        this.DB,
                        this.TABLE.timeline_item_records
                    );

                    timeline_item.is_locked = 1;
                    timeline_item.locked_by_user = uid_number;
                    timeline_item.locked_at = new Date();

                    this._log_success('Timeline item record locked for editing', {
                        item_id: validated['timeline item UUID'],
                        locked_by: uid_number
                    });

                } catch (lock_error) {
                    LOGGER.module().warn('Failed to lock timeline item record', {
                        item_id: validated['timeline item UUID'],
                        error: lock_error.message
                    });
                }
            } else {
                const locked_by_number = Number(timeline_item.locked_by_user);
                if (locked_by_number !== uid_number) {
                    throw new Error(`Timeline item is locked by another user (ID: ${timeline_item.locked_by_user})`);
                }

                this._log_success('Timeline item record already locked by this user', {
                    item_id: validated['timeline item UUID'],
                    locked_by: timeline_item.locked_by_user
                });
            }

            return {
                success: true,
                item: timeline_item,
                locked_by_user: true,
                message: 'Timeline item locked for editing'
            };

        } catch (error) {
            this._handle_error(error, 'get_timeline_item_edit_record', {
                user_id,
                item_uuid
            });
        }
    }

    /**
     * Locks a timeline item record
     * @param {string} item_uuid - The timeline item UUID
     * @param {string} user_id - The user ID locking the record
     * @returns {Promise<Object>} Lock result
     */
    async lock_timeline_item_record(item_uuid, user_id) {

        try {

            this._validate_database();
            this._validate_table('timeline_item_records');

            const lock_data = {
                is_locked: 1,
                locked_by_user: user_id.trim(),
                locked_at: this.DB.fn.now(),
                updated: this.DB.fn.now(),
                updated_by: user_id.trim()
            };

            const affected_rows = await this.DB(this.TABLE.timeline_item_records)
                .where({
                    uuid: item_uuid.trim(),
                    is_deleted: 0,
                    is_locked: 0
                })
                .update(lock_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Failed to lock record - may be locked by another user');
            }

            this._log_success('Timeline item record locked', {
                item_uuid: item_uuid.trim(),
                user_id: user_id.trim()
            });

            return {
                success: true,
                item_uuid: item_uuid.trim(),
                locked_by_user: user_id.trim(),
                message: 'Record locked successfully'
            };

        } catch (error) {
            this._handle_error(error, 'lock_timeline_item_record', {
                item_uuid,
                user_id
            });
        }
    }

    /**
     * Updates a timeline item record
     * @param {Object} data - Timeline item data to update
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result
     */
    async update_timeline_item_record(data, updated_by = null) {

        const UPDATABLE_FIELDS = [
            'repo_uuid', 'thumbnail', 'thumbnail_media_uuid', 'title', 'caption',
            'item_type', 'mime_type', 'media', 'media_uuid', 'text', 'wrap_text',
            'description', 'type', 'layout', 'media_width', 'media_padding', 'alt_text',
            'is_alt_text_decorative', 'pdf_open_to_page', 'item_subjects', 'styles',
            'order', 'date', 'is_repo_item', 'is_kaltura_item', 'is_embedded',
            'is_published', 'is_locked', 'locked_by_user', 'locked_at', 'owner'
        ];

        try {

            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('timeline_item_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'timeline item UUID',
                [data.is_member_of_timeline]: 'timeline UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            const {sanitized_data} = this._sanitize_data(
                data,
                UPDATABLE_FIELDS,
                ['uuid', 'is_member_of_timeline', 'is_member_of_exhibit']
            );

            if (Object.keys(sanitized_data).length === 0) {
                return {
                    success: true,
                    no_change: true,
                    uuid: validated['timeline item UUID'],
                    affected_rows: 0,
                    message: 'No fields to update'
                };
            }

            if (updated_by) {
                sanitized_data.updated_by = updated_by;
            }

            // Check record exists
            const existing = await this.DB(this.TABLE.timeline_item_records)
                .select('id', 'uuid', 'is_deleted', 'is_locked', 'locked_by_user')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_timeline: validated['timeline UUID'],
                    uuid: validated['timeline item UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error('Timeline item record not found');
            }

            if (existing.is_deleted === 1) {
                throw new Error('Cannot update deleted timeline item record');
            }

            if (existing.is_locked === 1 && updated_by) {
                if (String(existing.locked_by_user) !== String(updated_by)) {
                    LOGGER.module().warn('Attempting to update locked record', {
                        uuid: validated['timeline item UUID'],
                        locked_by: existing.locked_by_user,
                        attempted_by: updated_by
                    });
                }
            }

            const affected_rows = await this.DB(this.TABLE.timeline_item_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_timeline: validated['timeline UUID'],
                    uuid: validated['timeline item UUID'],
                    is_deleted: 0
                })
                .update(sanitized_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Update failed: No rows affected');
            }

            this._log_success('Timeline item record updated successfully', {
                uuid: validated['timeline item UUID'],
                fields_updated: Object.keys(sanitized_data),
                affected_rows,
                updated_by
            });

            return {
                success: true,
                uuid: validated['timeline item UUID'],
                affected_rows,
                fields_updated: Object.keys(sanitized_data),
                message: 'Timeline item record updated successfully'
            };

        } catch (error) {
            this._handle_error(error, 'update_timeline_item_record', {
                uuid: data?.uuid,
                updated_by
            });
        }
    }

    /**
     * Soft deletes a timeline item record
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_timeline - The timeline UUID
     * @param {string} item_uuid - The timeline item UUID
     * @param {string} [deleted_by=null] - User ID performing the deletion
     * @returns {Promise<Object>} Delete result
     */
    async delete_timeline_item_record(is_member_of_exhibit, is_member_of_timeline, item_uuid, deleted_by = null) {

        try {

            this._validate_database();
            this._validate_table('timeline_item_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [is_member_of_timeline]: 'timeline UUID',
                [item_uuid]: 'timeline item UUID'
            });

            const existing = await this.DB(this.TABLE.timeline_item_records)
                .select('id', 'uuid', 'title', 'is_deleted', 'is_locked', 'locked_by_user')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_timeline: validated['timeline UUID'],
                    uuid: validated['timeline item UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error('Timeline item record not found');
            }

            if (existing.is_deleted === 1) {
                return {
                    success: true,
                    already_deleted: true,
                    uuid: validated['timeline item UUID'],
                    affected_rows: 0,
                    message: 'Timeline item record is already deleted'
                };
            }

            if (existing.is_locked === 1 && deleted_by) {
                if (String(existing.locked_by_user) !== String(deleted_by)) {
                    LOGGER.module().warn('Attempting to delete locked record', {
                        uuid: validated['timeline item UUID'],
                        locked_by: existing.locked_by_user,
                        attempted_by: deleted_by
                    });
                }
            }

            const update_data = {is_deleted: 1};
            if (deleted_by) {
                update_data.updated_by = deleted_by;
            }

            const affected_rows = await this.DB(this.TABLE.timeline_item_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    is_member_of_timeline: validated['timeline UUID'],
                    uuid: validated['timeline item UUID'],
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Delete failed: No rows affected');
            }

            this._log_success('Timeline item record deleted successfully', {
                uuid: validated['timeline item UUID'],
                title: existing.title,
                affected_rows,
                deleted_by
            });

            return {
                success: true,
                uuid: validated['timeline item UUID'],
                title: existing.title,
                affected_rows,
                deleted_by,
                message: 'Timeline item record deleted successfully'
            };

        } catch (error) {
            this._handle_error(error, 'delete_timeline_item_record', {
                is_member_of_exhibit,
                is_member_of_timeline,
                item_uuid,
                deleted_by
            });
        }
    }

    // ==================== PUBLISHING / SUPPRESSING ====================

    /**
     * Gets timeline record count
     * @param {string} uuid - Exhibit UUID
     * @returns {Promise<number>} Count of timeline records
     */
    async get_record_count(uuid) {

        try {

            this._validate_database();
            this._validate_table('timeline_records');

            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this.DB(this.TABLE.timeline_records)
                .count('id as count')
                .where({is_member_of_exhibit: exhibit_uuid})
                .timeout(this.QUERY_TIMEOUT);

            return parseInt(result[0].count, 10);

        } catch (error) {
            this._handle_error(error, 'get_record_count', {uuid});
        }
    }

    /**
     * Publishes all timelines for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     */
    async set_to_publish(uuid, updated_by = null) {

        try {

            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'timeline_records',
                {is_member_of_exhibit: exhibit_uuid},
                1,
                updated_by
            );

            this._log_success('Timeline is_published set', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_to_publish', {uuid});
        }
    }

    /**
     * Publishes a single timeline item
     * @param {string} uuid - Timeline item UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     */
    async set_timeline_item_to_publish(uuid, updated_by = null) {

        try {

            const item_uuid = this._validate_uuid(uuid, 'timeline item UUID');

            const result = await this._update_publish_status(
                'timeline_item_records',
                {uuid: item_uuid},
                1,
                updated_by
            );

            this._log_success('Timeline item is_published set', {
                item_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_timeline_item_to_publish', {uuid});
        }
    }

    /**
     * Publishes a single timeline
     * @param {string} uuid - Timeline UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     */
    async set_timeline_to_publish(uuid, updated_by = null) {

        try {

            const timeline_uuid = this._validate_uuid(uuid, 'timeline UUID');

            const result = await this._update_publish_status(
                'timeline_records',
                {uuid: timeline_uuid},
                1,
                updated_by
            );

            this._log_success('Timeline is_published set', {
                timeline_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_timeline_to_publish', {uuid});
        }
    }

    /**
     * Publishes all timeline items for a timeline
     * @param {string} uuid - Timeline UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     */
    async set_to_publish_timeline_items(uuid, updated_by = null) {

        try {

            const timeline_uuid = this._validate_uuid(uuid, 'timeline UUID');

            const result = await this._update_publish_status(
                'timeline_item_records',
                {is_member_of_timeline: timeline_uuid},
                1,
                updated_by
            );

            this._log_success('Timeline items is_published set', {
                timeline_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_to_publish_timeline_items', {uuid});
        }
    }

    /**
     * Suppresses all timelines for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     */
    async set_to_suppress(uuid, updated_by = null) {

        try {

            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'timeline_records',
                {is_member_of_exhibit: exhibit_uuid},
                0,
                updated_by
            );

            this._log_success('Timeline is_published suppressed', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_to_suppress', {uuid});
        }
    }

    /**
     * Suppresses a single timeline
     * @param {string} uuid - Timeline UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     */
    async set_timeline_to_suppress(uuid, updated_by = null) {

        try {

            const timeline_uuid = this._validate_uuid(uuid, 'timeline UUID');

            const result = await this._update_publish_status(
                'timeline_records',
                {uuid: timeline_uuid},
                0,
                updated_by
            );

            this._log_success('Timeline is_published suppressed', {
                timeline_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_timeline_to_suppress', {uuid});
        }
    }

    /**
     * Suppresses all timeline items for a timeline
     * @param {string} uuid - Timeline UUID
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     */
    async set_to_suppressed_timeline_items(uuid, updated_by = null) {

        try {

            const timeline_uuid = this._validate_uuid(uuid, 'timeline UUID');

            const result = await this._update_publish_status(
                'timeline_item_records',
                {is_member_of_timeline: timeline_uuid},
                0,
                updated_by
            );

            this._log_success('Timeline items is_published suppressed', {
                timeline_uuid,
                affected_rows: result.affected_rows
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'set_to_suppressed_timeline_items', {uuid});
        }
    }

    // ==================== REORDERING ====================

    /**
     * Reorders timelines
     * @param {string} is_member_of_exhibit - Exhibit UUID
     * @param {Object} timelines - Timeline object with uuid and order
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Reorder result
     */
    async reorder_timelines(is_member_of_exhibit, timelines, updated_by = null) {

        try {

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            const result = await this._reorder_items(
                'timeline_records',
                {is_member_of_exhibit: exhibit_uuid},
                timelines
            );

            this._log_success('Timeline reordered', {
                exhibit_uuid,
                uuid: timelines.uuid,
                order: timelines.order
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'reorder_timelines', {
                is_member_of_exhibit
            });
        }
    }

    /**
     * Reorders timeline items
     * @param {string} is_member_of_timeline - Timeline UUID
     * @param {Object} timelines - Timeline item object with uuid and order
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Reorder result
     */
    async reorder_timeline_items(is_member_of_timeline, timelines, updated_by = null) {

        try {

            const timeline_uuid = this._validate_uuid(is_member_of_timeline, 'timeline UUID');

            const result = await this._reorder_items(
                'timeline_item_records',
                {is_member_of_timeline: timeline_uuid},
                timelines
            );

            this._log_success('Timeline item reordered', {
                timeline_uuid,
                uuid: timelines.uuid,
                order: timelines.order
            });

            return result;

        } catch (error) {
            this._handle_error(error, 'reorder_timeline_items', {
                is_member_of_timeline
            });
        }
    }
};

module.exports = Exhibit_timeline_record_tasks;