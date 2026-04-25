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
const Base_tasks = require('./tasks_helper');

/**
 * Object contains tasks used to manage exhibit item records
 * @param DB
 * @param TABLE
 * @type {Exhibit_item_record_tasks}
 */
const Exhibit_item_record_tasks = class extends Base_tasks {

    constructor(DB, TABLE) {
        super(DB, TABLE);
    }

    // Validation helpers, _handle_error, _log_success inherited from Base_tasks

    /**
     * Sets default values for item fields
     * @param {Object} data - Data object to set defaults on
     * @private
     */
    _set_item_defaults(data) {
        const defaults = {
            type: 'item',
            layout: 'media_right',
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
            locked_at: null,
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
     * Gets the appropriate table name for a given type
     * @param {string} type - Item type
     * @returns {string} Table name
     * @private
     */
    _get_table_for_type(type) {
        const type_map = {
            'item': 'item_records',
            'grid': 'grid_records',
            'heading': 'heading_records',
            'timeline': 'timeline_records',
            'standard_item': 'item_records',
            'grid_item': 'grid_item_records',
            'timeline_item': 'timeline_item_records',
            'vertical_timeline': 'timeline_records'
        };

        const normalized_type = type.toLowerCase().trim();
        const table_name = type_map[normalized_type];

        if (!table_name) {
            throw new Error(`Invalid item type: ${type}`);
        }

        return table_name;
    }

    // _update_publish_status, _update_single_publish_status, _reorder_items inherited from Base_tasks

    // ==================== ITEM RECORDS ====================

    /**
     * Creates a new item record
     * @param {Object} data - Item record data
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created item record
     */
    async create_item_record(data, created_by = null) {

        try {

            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('item_records');

            // Validate required fields
            const validated = this._validate_uuids({
                [data.uuid]: 'item UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            this._validate_string(data.item_type, 'item_type');

            // Build record with defaults
            const record_data = {
                uuid: validated['item UUID'],
                is_member_of_exhibit: validated['exhibit UUID'],
                item_type: data.item_type.trim(),
                mime_type: data.mime_type.trim() || null,
                title: data.title?.trim() || '',
                thumbnail: data.thumbnail || null,
                thumbnail_media_uuid: data.thumbnail_media_uuid || null,
                caption: data.caption || null,
                media: data.media || null,
                media_uuid: data.media_uuid || null,
                text: data.text || null,
                description: data.description || null,
                alt_text: data.alt_text || null,
                item_subjects: data.item_subjects || null,
                styles: data.styles || null,
                created_by: created_by || data.created_by || null,
                updated_by: created_by || data.updated_by || null
            };

            // Set defaults
            this._set_item_defaults(record_data);

            // Override defaults with provided values
            const optional_fields = [
                'wrap_text', 'media_width', 'media_padding', 'is_alt_text_decorative',
                'pdf_open_to_page', 'order', 'is_repo_item', 'is_kaltura_item',
                'is_embedded', 'is_published', 'owner', 'type', 'layout'
            ];

            optional_fields.forEach(field => {
                if (data[field] !== undefined) {
                    record_data[field] = data[field];
                }
            });

            // Create in transaction
            const created_record = await this.DB.transaction(async (trx) => {
                const [inserted_id] = await trx(this.TABLE.item_records)
                    .insert(record_data)
                    .timeout(this.QUERY_TIMEOUT);

                const created = await trx(this.TABLE.item_records)
                    .select('*')
                    .where({id: inserted_id})
                    .first();

                return created;
            });

            this._log_success('Item record created successfully', {
                uuid: validated['item UUID'],
                item_type: data.item_type.trim(),
                created_by
            });

            return {
                success: true,
                uuid: validated['item UUID'],
                id: created_record.id,
                record: created_record,
                message: 'Item record created successfully'
            };

        } catch (error) {
            this._handle_error(error, 'create_item_record', {
                uuid: data?.uuid,
                created_by
            });
        }
    }

    /**
     * Gets item records by exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @returns {Promise<Array>} Array of item records
     */
    async get_item_records(is_member_of_exhibit) {

        try {

            this._validate_database();
            this._validate_table('item_records');
            this._validate_table('media_library_records');

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            const items = await this.DB(this.TABLE.item_records)
                .select(
                    `${this.TABLE.item_records}.*`,
                    // Media library metadata for the primary media asset
                    `media_lib.name as media_name`,
                    `media_lib.ingest_method as media_ingest_method`,
                    `media_lib.kaltura_thumbnail_url as media_kaltura_thumbnail_url`,
                    `media_lib.repo_uuid as media_repo_uuid`,
                    `media_lib.thumbnail_path as media_thumbnail_path`,
                    `media_lib.alt_text as media_alt_text`,
                    `media_lib.is_alt_text_decorative as media_is_alt_text_decorative`,
                    // v2 indexer fields: IIIF, Kaltura, subjects, dimensions
                    `media_lib.uuid as media_lib_uuid`,
                    `media_lib.kaltura_entry_id`,
                    `media_lib.media_width as ml_media_width`,
                    `media_lib.media_height as ml_media_height`,
                    `media_lib.media_type as ml_media_type`,
                    `media_lib.filename as ml_media_filename`,
                    `media_lib.topics_subjects as media_topics_subjects`,
                    `media_lib.genre_form_subjects as media_genre_form_subjects`,
                    `media_lib.places_subjects as media_places_subjects`,
                    // Media library metadata for the thumbnail asset
                    `thumb_lib.name as thumbnail_media_name`,
                    `thumb_lib.ingest_method as thumbnail_ingest_method`,
                    `thumb_lib.kaltura_thumbnail_url as thumbnail_media_kaltura_thumbnail_url`,
                    `thumb_lib.repo_uuid as thumbnail_media_repo_uuid`,
                    `thumb_lib.thumbnail_path as thumbnail_media_thumbnail_path`,
                    `thumb_lib.uuid as thumb_lib_uuid`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as media_lib`,
                    `${this.TABLE.item_records}.media_uuid`,
                    '=',
                    `media_lib.uuid`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as thumb_lib`,
                    `${this.TABLE.item_records}.thumbnail_media_uuid`,
                    '=',
                    `thumb_lib.uuid`
                )
                .where({
                    [`${this.TABLE.item_records}.is_member_of_exhibit`]: exhibit_uuid,
                    [`${this.TABLE.item_records}.is_deleted`]: 0
                })
                .orderBy(`${this.TABLE.item_records}.order`, 'asc')
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Item records retrieved successfully', {
                is_member_of_exhibit: exhibit_uuid,
                count: items.length
            });

            return items || [];

        } catch (error) {
            this._handle_error(error, 'get_item_records', {
                is_member_of_exhibit
            });
        }
    }

    /**
     * Gets a single item record
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} uuid - The item UUID
     * @returns {Promise<Object|null>} Item record or null
     */
    async get_item_record(is_member_of_exhibit, uuid) {

        try {

            this._validate_database();
            this._validate_table('item_records');
            this._validate_table('media_library_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [uuid]: 'item UUID'
            });

            const result = await this.DB(this.TABLE.item_records)
                .select(
                    `${this.TABLE.item_records}.*`,
                    // Media library metadata for the primary media asset
                    `media_lib.name as media_name`,
                    `media_lib.ingest_method as media_ingest_method`,
                    `media_lib.kaltura_thumbnail_url as media_kaltura_thumbnail_url`,
                    `media_lib.repo_uuid as media_repo_uuid`,
                    `media_lib.thumbnail_path as media_thumbnail_path`,
                    `media_lib.alt_text as media_alt_text`,
                    `media_lib.is_alt_text_decorative as media_is_alt_text_decorative`,
                    // v2 indexer fields: IIIF, Kaltura, subjects, dimensions
                    `media_lib.uuid as media_lib_uuid`,
                    `media_lib.kaltura_entry_id`,
                    `media_lib.media_width as ml_media_width`,
                    `media_lib.media_height as ml_media_height`,
                    `media_lib.media_type as ml_media_type`,
                    `media_lib.filename as ml_media_filename`,
                    `media_lib.topics_subjects as media_topics_subjects`,
                    `media_lib.genre_form_subjects as media_genre_form_subjects`,
                    `media_lib.places_subjects as media_places_subjects`,
                    // Media library metadata for the thumbnail asset
                    `thumb_lib.name as thumbnail_media_name`,
                    `thumb_lib.ingest_method as thumbnail_ingest_method`,
                    `thumb_lib.kaltura_thumbnail_url as thumbnail_media_kaltura_thumbnail_url`,
                    `thumb_lib.repo_uuid as thumbnail_media_repo_uuid`,
                    `thumb_lib.thumbnail_path as thumbnail_media_thumbnail_path`,
                    `thumb_lib.uuid as thumb_lib_uuid`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as media_lib`,
                    `${this.TABLE.item_records}.media_uuid`,
                    '=',
                    `media_lib.uuid`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as thumb_lib`,
                    `${this.TABLE.item_records}.thumbnail_media_uuid`,
                    '=',
                    `thumb_lib.uuid`
                )
                .where({
                    [`${this.TABLE.item_records}.is_member_of_exhibit`]: validated['exhibit UUID'],
                    [`${this.TABLE.item_records}.uuid`]: validated['item UUID'],
                    [`${this.TABLE.item_records}.is_deleted`]: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            return result || null;

        } catch (error) {
            LOGGER.module().error('Failed to get item record: ' + error.message);
            return null;
        }
    }

    /**
     * Gets an item record for editing and locks it
     * @param {string|number} uid - User ID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} uuid - The item UUID
     * @returns {Promise<Object|null>} Item record with lock status
     */
    async get_item_edit_record(uid, is_member_of_exhibit, uuid) {

        try {

            this._validate_database();
            this._validate_table('item_records');
            this._validate_table('media_library_records');

            if (uid === null || uid === undefined || uid === '') {
                throw new Error('Valid user ID is required');
            }

            const uid_number = Number(uid);
            if (isNaN(uid_number)) {
                throw new Error('User ID must be a valid number');
            }

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [uuid]: 'item UUID'
            });

            const record = await this.DB(this.TABLE.item_records)
                .select(
                    `${this.TABLE.item_records}.*`,
                    // Media library metadata for the primary media asset
                    `media_lib.name as media_name`,
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
                    `thumb_lib.ingest_method as thumbnail_ingest_method`,
                    `thumb_lib.repo_uuid as thumbnail_repo_uuid`,
                    `thumb_lib.thumbnail_path as thumbnail_media_thumbnail_path`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as media_lib`,
                    `${this.TABLE.item_records}.media_uuid`,
                    '=',
                    `media_lib.uuid`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as thumb_lib`,
                    `${this.TABLE.item_records}.thumbnail_media_uuid`,
                    '=',
                    `thumb_lib.uuid`
                )
                .where({
                    [`${this.TABLE.item_records}.is_member_of_exhibit`]: validated['exhibit UUID'],
                    [`${this.TABLE.item_records}.uuid`]: validated['item UUID'],
                    [`${this.TABLE.item_records}.is_deleted`]: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('Item record not found', validated);
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
                        this.TABLE.item_records
                    );

                    record.is_locked = 1;
                    record.locked_by_user = uid_number;
                    record.locked_at = new Date();

                    this._log_success('Item record locked for editing', {
                        uuid: validated['item UUID'],
                        locked_by: uid_number
                    });

                } catch (lock_error) {
                    LOGGER.module().warn('Failed to lock item record', {
                        uuid: validated['item UUID'],
                        error: lock_error.message
                    });
                }
            } else {
                const locked_by_number = Number(record.locked_by_user);
                const status = locked_by_number === uid_number ? 'by this user' : 'by another user';
                this._log_success(`Item record already locked ${status}`, {
                    uuid: validated['item UUID'],
                    locked_by: record.locked_by_user
                });
            }

            return record;

        } catch (error) {
            this._handle_error(error, 'get_item_edit_record', {
                uid,
                uuid
            });
        }
    }

    /**
     * Gets an item record with media library metadata for read-only details view.
     * Same query as get_item_edit_record but does NOT lock the record.
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} uuid - The item UUID
     * @returns {Promise<Object|null>} Item record with media metadata or null
     */
    async get_item_details_record(is_member_of_exhibit, uuid) {

        try {

            this._validate_database();
            this._validate_table('item_records');
            this._validate_table('media_library_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [uuid]: 'item UUID'
            });

            const record = await this.DB(this.TABLE.item_records)
                .select(
                    `${this.TABLE.item_records}.*`,
                    // Media library metadata for the primary media asset
                    `media_lib.name as media_name`,
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
                    `thumb_lib.ingest_method as thumbnail_ingest_method`,
                    `thumb_lib.repo_uuid as thumbnail_repo_uuid`,
                    `thumb_lib.thumbnail_path as thumbnail_media_thumbnail_path`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as media_lib`,
                    `${this.TABLE.item_records}.media_uuid`,
                    '=',
                    `media_lib.uuid`
                )
                .leftJoin(
                    `${this.TABLE.media_library_records} as thumb_lib`,
                    `${this.TABLE.item_records}.thumbnail_media_uuid`,
                    '=',
                    `thumb_lib.uuid`
                )
                .where({
                    [`${this.TABLE.item_records}.is_member_of_exhibit`]: validated['exhibit UUID'],
                    [`${this.TABLE.item_records}.uuid`]: validated['item UUID'],
                    [`${this.TABLE.item_records}.is_deleted`]: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('Item record not found', validated);
                return null;
            }

            this._log_success('Item details record retrieved successfully', {
                uuid: validated['item UUID'],
                is_member_of_exhibit: validated['exhibit UUID']
            });

            return record;

        } catch (error) {
            this._handle_error(error, 'get_item_details_record', {
                is_member_of_exhibit,
                uuid
            });
        }
    }

    /**
     * Updates an item record
     * @param {Object} data - Item data to update
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result
     */
    async update_item_record(data, updated_by = null) {

        const UPDATABLE_FIELDS = [
            'thumbnail', 'thumbnail_media_uuid', 'title', 'caption', 'item_type', 'mime_type',
            'media', 'media_uuid', 'text', 'wrap_text', 'description', 'type', 'layout',
            'media_width', 'media_padding', 'alt_text', 'is_alt_text_decorative',
            'pdf_open_to_page', 'item_subjects', 'styles', 'order', 'is_repo_item',
            'is_kaltura_item', 'is_embedded', 'is_published', 'is_locked', 'locked_by_user',
            'locked_at', 'owner'
        ];

        try {
            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('item_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'item UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            // Check record exists
            const existing = await this.DB(this.TABLE.item_records)
                .select('id', 'uuid', 'title', 'is_deleted')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['item UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error('Item record not found');
            }

            if (existing.is_deleted === 1) {
                throw new Error('Cannot update deleted item record');
            }

            // Build update data
            const update_data = {};
            UPDATABLE_FIELDS.forEach(field => {
                if (data.hasOwnProperty(field)) {
                    update_data[field] = data[field];
                }
            });

            if (Object.keys(update_data).length === 0) {
                return {
                    success: true,
                    no_change: true,
                    uuid: validated['item UUID'],
                    message: 'No fields to update'
                };
            }

            update_data.updated = this.DB.fn.now();
            if (updated_by) {
                update_data.updated_by = updated_by;
            }

            // Perform update
            const affected_rows = await this.DB(this.TABLE.item_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['item UUID'],
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Failed to update item record: No rows affected');
            }

            // Fetch updated record
            const updated_record = await this.DB(this.TABLE.item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['item UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Item record updated successfully', {
                uuid: validated['item UUID'],
                title: updated_record.title,
                fields_updated: Object.keys(update_data).filter(f => f !== 'updated' && f !== 'updated_by'),
                updated_by
            });

            return {
                success: true,
                uuid: validated['item UUID'],
                affected_rows,
                updated_fields: Object.keys(update_data),
                record: updated_record,
                updated_by,
                message: 'Item record updated successfully'
            };

        } catch (error) {
            this._handle_error(error, 'update_item_record', {
                uuid: data?.uuid,
                updated_by
            });
        }
    }

    /**
     * Soft deletes an item record
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} item_id - The item UUID
     * @param {string} type - The item type
     * @param {string} [deleted_by=null] - User ID performing the deletion
     * @returns {Promise<Object>} Delete result
     */
    async delete_item_record(is_member_of_exhibit, item_id, type, deleted_by = null) {

        try {

            this._validate_database();

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [item_id]: 'item UUID'
            });

            this._validate_string(type, 'item type');

            // Get table for type
            const table_name = this._get_table_for_type(type);
            this._validate_table(table_name);

            // Check record exists
            const existing = await this.DB(this.TABLE[table_name])
                .select('id', 'uuid', 'is_deleted')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['item UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} record not found`);
            }

            if (existing.is_deleted === 1) {
                return {
                    success: true,
                    already_deleted: true,
                    uuid: validated['item UUID'],
                    type,
                    message: `${type} record was already deleted`
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

            const affected_rows = await this.DB(this.TABLE[table_name])
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['item UUID'],
                    is_deleted: 0
                })
                .update(delete_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error(`Failed to delete ${type} record: No rows affected`);
            }

            this._log_success('Record deleted successfully', {
                type,
                uuid: validated['item UUID'],
                deleted_by
            });

            // Reorder
            const HELPER_TASK = new HELPER();
            const new_order = await HELPER_TASK.reorder(validated['exhibit UUID'], this.DB, this.TABLE);
            const new_order_applied = await HELPER_TASK.apply_reorder(validated['exhibit UUID'], new_order, this.DB, this.TABLE);

            if (new_order_applied.success === false) {
                LOGGER.module().error('Failed to reorder records', new_order_applied);
            }

            return {
                success: true,
                uuid: validated['item UUID'],
                type,
                affected_rows,
                deleted_by,
                message: `${type} record deleted successfully`
            };

        } catch (error) {
            this._handle_error(error, 'delete_item_record', {
                is_member_of_exhibit,
                item_id,
                type,
                deleted_by
            });
        }
    }

    /**
     * Deletes media or thumbnail value from an item record
     * @param {string} item_uuid - The item UUID
     * @param {string} media_path - The media path
     * @param {string} item_type - Item type
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Delete result
     */
    async delete_media_value(item_uuid, media_path, item_type, updated_by = null) {

        try {

            this._validate_database();

            const item_uuid_validated = this._validate_uuid(item_uuid, 'item UUID');
            this._validate_string(media_path, 'media path');
            this._validate_string(item_type, 'item type');

            // Determine field from path
            const path_lower = media_path.toLowerCase().trim();
            let field_to_clear = null;

            if (path_lower.includes('thumbnail')) {
                field_to_clear = 'thumbnail';
            } else if (path_lower.includes('media')) {
                field_to_clear = 'media';
            } else {
                const parts = media_path.split('_');
                const last_part = parts[parts.length - 1] || '';

                if (last_part.toLowerCase().includes('thumb')) {
                    field_to_clear = 'thumbnail';
                } else {
                    field_to_clear = 'media';
                }
            }

            if (!field_to_clear) {
                field_to_clear = 'media';
                LOGGER.module().warn('Could not determine field from path, defaulting to media', {
                    media_path
                });
            }

            this._log_success('Determined field to clear from media path', {
                media_path,
                field_to_clear
            });

            // Get table for type
            const table_name = this._get_table_for_type(item_type);
            this._validate_table(table_name);

            // Check record exists
            const existing = await this.DB(this.TABLE[table_name])
                .select('id', 'uuid', 'is_deleted', field_to_clear)
                .where({uuid: item_uuid_validated})
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error(`${item_type} record not found`);
            }

            if (existing.is_deleted === 1) {
                throw new Error(`Cannot update deleted ${item_type} record`);
            }

            if (!existing[field_to_clear]) {
                return {
                    success: true,
                    no_change: true,
                    uuid: item_uuid_validated,
                    item_type,
                    field: field_to_clear,
                    media_path,
                    message: `Field '${field_to_clear}' is already empty`
                };
            }

            // Perform update
            const update_data = {[field_to_clear]: ''};
            if (updated_by) {
                update_data.updated_by = updated_by;
            }

            const affected_rows = await this.DB(this.TABLE[table_name])
                .where({
                    uuid: item_uuid_validated,
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Delete media value failed: No rows affected');
            }

            this._log_success('Media value deleted successfully', {
                uuid: item_uuid_validated,
                item_type,
                table: table_name,
                field: field_to_clear,
                media_path,
                previous_value: existing[field_to_clear],
                affected_rows,
                updated_by
            });

            return {
                success: true,
                uuid: item_uuid_validated,
                item_type,
                table: table_name,
                field: field_to_clear,
                media_path,
                previous_value: existing[field_to_clear],
                affected_rows,
                message: `Media value '${field_to_clear}' deleted successfully from ${item_type}`
            };

        } catch (error) {
            this._handle_error(error, 'delete_media_value', {
                item_uuid,
                media_path,
                item_type,
                updated_by
            });
        }
    }

    /**
     * Gets the count of item records for an exhibit
     * @param {string} uuid - The exhibit UUID
     * @returns {Promise<number>} Count of item records
     */
    async get_record_count(uuid) {

        try {

            this._validate_database();
            this._validate_table('item_records');

            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this.DB(this.TABLE.item_records)
                .count('id as count')
                .where({is_member_of_exhibit: exhibit_uuid})
                .timeout(this.QUERY_TIMEOUT);

            return result?.[0]?.count ? parseInt(result[0].count, 10) : 0;

        } catch (error) {
            LOGGER.module().error('Failed to get record count: ' + error.message);
            return 0;
        }
    }

    // ==================== PUBLISHING / SUPPRESSING ====================

    /**
     * Publishes all items for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_to_publish(uuid, published_by = null) {

        try {

            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'item_records',
                {is_member_of_exhibit: exhibit_uuid},
                1,
                published_by
            );

            this._log_success('Item records published', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to publish item records: ' + error.message);
            return false;
        }
    }

    /**
     * Publishes a single item
     * @param {string} uuid - Item UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_item_to_publish(uuid, published_by = null) {

        try {

            const result = await this._update_single_publish_status(
                'item_records',
                uuid,
                1,
                published_by
            );

            this._log_success('Item record published', {
                uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to publish item record: ' + error.message);
            return false;
        }
    }

    /**
     * Suppresses all items for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_to_suppress(uuid, unpublished_by = null) {

        try {

            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'item_records',
                {is_member_of_exhibit: exhibit_uuid},
                0,
                unpublished_by
            );

            this._log_success('Item records suppressed', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to suppress item records: ' + error.message);
            return false;
        }
    }

    /**
     * Suppresses a single item
     * @param {string} uuid - Item UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_item_to_suppress(uuid, unpublished_by = null) {

        try {

            const result = await this._update_single_publish_status(
                'item_records',
                uuid,
                0,
                unpublished_by
            );

            this._log_success('Item record suppressed', {
                uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to suppress item record: ' + error.message);
            return false;
        }
    }

    // ==================== REORDERING ====================

    /**
     * Reorders items
     * @param {string} is_member_of_exhibit - Exhibit UUID
     * @param {Object} item - Item object with uuid and order
     * @returns {Promise<boolean>} Reorder success status
     */
    async reorder_items(is_member_of_exhibit, item) {

        try {

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            await this._reorder_items(
                'item_records',
                {is_member_of_exhibit: exhibit_uuid},
                item
            );

            this._log_success('Item reordered', {
                exhibit_uuid,
                uuid: item.uuid,
                order: item.order
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to reorder item: ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_item_record_tasks;