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

            if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
                throw new Error('Valid title is required');
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

            // Build the record with defaults
            const record_data = {
                uuid: item_uuid,
                is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                title: data.title.trim(),
                item_type: data.item_type.trim(),
                mime_type: data.mime_type.trim(),

                // Optional fields with defaults
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
                title: data.title.trim(),
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
     * @param is_member_of_exhibit
     */
    async get_item_records(is_member_of_exhibit) {

        try {

            return await this.DB(this.TABLE.item_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_records)] unable to get item records ' + error.message);
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
     * Gets item record
     * @param is_member_of_exhibit
     * @param uuid
     * @param uid
     */
    async get_item_edit_record__(uid, is_member_of_exhibit, uuid) {

        try {

            const data = await this.DB(this.TABLE.item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    uuid: uuid,
                    is_deleted: 0
                });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uid, uuid, this.DB, this.TABLE.item_records);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_item_record)] unable to get item records ' + error.message);
        }
    }

    /**
     * Updates item record
     * @param data
     */
    async update_item_record(data) {

        try {

            await this.DB(this.TABLE.item_records)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (update_item_record)] Item record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (update_item_record)] unable to update item record ' + error.message);
        }
    }

    /**
     * "Deletes" item record (sets to inactive)
     * @param is_member_of_exhibit
     * @param item_id
     * @param type
     */
    async delete_item_record(is_member_of_exhibit, item_id, type) {

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
     * Deletes item media value
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

            await this.DB(this.TABLE.item_records)
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
