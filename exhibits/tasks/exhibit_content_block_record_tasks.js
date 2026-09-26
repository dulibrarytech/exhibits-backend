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
const HELPER = require('../../libs/helper');
const Base_tasks = require('./tasks_helper');

/**
 * Object contains tasks used to manage exhibit content block records
 * @param DB
 * @param TABLE
 * @type {Exhibit_content_block_record_tasks}
 */
const Exhibit_content_block_record_tasks = class extends Base_tasks {

    constructor(DB, TABLE) {
        super(DB, TABLE);
    }

    // Validation helpers, _handle_error, _log_success, _update_publish_status,
    // _update_single_publish_status, _reorder_items inherited from Base_tasks

    // ==================== CONTENT BLOCK-SPECIFIC HELPERS ====================

    /**
     * Sets default values for content block fields
     * @param {Object} data - Data object to set defaults on
     * @private
     */
    _set_content_block_defaults(data) {
        const defaults = {
            type: 'content block',
            order: 0,
            is_visible: 1,
            is_published: 0,
            is_locked: 0,
            locked_by_user: 0,
            is_deleted: 0,
            owner: 0,
        };

        for (const [key, default_value] of Object.entries(defaults)) {
            if (data[key] === undefined) {
                data[key] = default_value;
            }
        }
    }

    // ==================== CONTENT BLOCK RECORDS ====================

    /**
     * Creates a new content block record in the database
     * @param {Object} data - content block record data
     * @param {string} data.uuid - content block UUID (required)
     * @param {string} data.is_member_of_exhibit - Exhibit UUID (required)
     * @param {string} data.text - content block text content
     * @param {string} data.title - content block title content
     * @param {string} data.url - content block url content
     * @param {string} data.attribution - content block attribution content
     * @param {string} data.transparent - content block transparent content
     * @param {string} data.size - content block size content
     * @param {string} data.content_type - content block content_type content
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created content block record with ID
     */
    async create_content_block_record(data, created_by = null) {

        const ALLOWED_FIELDS = [
            'is_member_of_exhibit', 'uuid', 'type', 'text', 'title', 'attribution', 'size', 'order',
            'is_visible', 'is_published', 'is_locked', 'locked_by_user', 'content_type',
            'locked_at', 'is_deleted', 'owner', 'transparent', 'styles', 'url', 'created_by'
        ];

        try {

            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('content_block_records');

            // Validate required fields
            const validated = this._validate_uuids({
                [data.uuid]: 'content block UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            this._validate_string(data.content_type, 'content block content_type');

            if (data.content_type === 'button') {
                this._validate_string(data.text, 'content block text');
                this._validate_string(data.size, 'content block size');
                this._validate_string(data.url, 'content block url');
            } else if (data.content_type === 'card') {
                this._validate_string(data.text, 'content block text');
                this._validate_string(data.title, 'content block title');
            } else if (data.content_type === 'divider') {
                this._validate_string(data.size, 'content block size');
            } else if (data.content_type === 'emphasis') {
                this._validate_string(data.text, 'content block text');
            } else if (data.content_type === 'quote') {
                this._validate_string(data.text, 'content block text');
                this._validate_string(data.attribution, 'content block attribution');
            }

            // Sanitize data
            const {sanitized_data} = this._sanitize_data(data, ALLOWED_FIELDS);

            // Set defaults
            this._set_content_block_defaults(sanitized_data);

            // Add created_by and updated_by
            if (created_by) {
                sanitized_data.created_by = created_by;
                sanitized_data.updated_by = created_by;
            }

            // Insert in transaction
            const created_record = await this.DB.transaction(async (trx) => {
                const [insert_id] = await trx(this.TABLE.content_block_records)
                    .insert(sanitized_data)
                    .timeout(this.QUERY_TIMEOUT);

                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                const record = await trx(this.TABLE.content_block_records)
                    .select('*')
                    .where({id: insert_id})
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                this._log_success('content block record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    content_type: record.content_type,
                    created_by
                });

                return record;
            });

            return {
                success: true,
                id: created_record.id,
                uuid: created_record.uuid,
                record: created_record,
                message: 'content block record created successfully'
            };

        } catch (error) {
            this._handle_error(error, 'create_content_block_record', {
                uuid: data?.uuid,
                exhibit_uuid: data?.is_member_of_exhibit,
                created_by
            });
        }
    }

    /**
     * Gets all content block records by exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @returns {Promise<Array>} Array of content block records
     */
    async get_content_block_records(is_member_of_exhibit) {
        try {
            this._validate_database();
            this._validate_table('content_block_records');

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            const records = await this.DB(this.TABLE.content_block_records)
                .select('*')
                .where({
                    is_member_of_exhibit: exhibit_uuid,
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('content block records retrieved successfully', {
                is_member_of_exhibit: exhibit_uuid,
                count: records.length
            });

            return records || [];

        } catch (error) {
            this._handle_error(error, 'get_content_block_records', {
                is_member_of_exhibit
            });
        }
    }

    /**
     * Gets a single content block record by exhibit and content block UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} uuid - The content block UUID
     * @returns {Promise<Object|null>} content block record or null
     */
    async get_content_block_record(is_member_of_exhibit, uuid) {

        try {
            this._validate_database();
            this._validate_table('content_block_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [uuid]: 'content block UUID'
            });

            const record = await this.DB(this.TABLE.content_block_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['content block UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('content block record not found', validated);
                return null;
            }

            this._log_success('content block record retrieved', {
                uuid: validated['content block UUID']
            });

            return record;

        } catch (error) {
            this._handle_error(error, 'get_content_block_record', {
                is_member_of_exhibit,
                uuid
            });
        }
    }

    /**
     * Gets a content block record for editing and locks it
     * @param {string|number} uid - User ID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} uuid - The content block UUID
     * @returns {Promise<Object|null>} content block record with lock status
     */
    async get_content_block_edit_record(uid, is_member_of_exhibit, uuid) {

        try {
            this._validate_database();
            this._validate_table('content_block_records');

            if (uid === null || uid === undefined || uid === '') {
                throw new Error('Valid user ID is required');
            }

            const uid_number = Number(uid);
            if (isNaN(uid_number)) {
                throw new Error('User ID must be a valid number');
            }

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [uuid]: 'content block UUID'
            });

            const record = await this.DB(this.TABLE.content_block_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['content block UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('content block record not found', validated);
                return null;
            }

            // Handle locking
            if (record.is_locked === 0) {
                try {
                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(
                        uid,
                        validated['content block UUID'],
                        this.DB,
                        this.TABLE.content_block_records
                    );

                    record.is_locked = 1;
                    record.locked_by_user = uid_number;

                    this._log_success('content block record locked for editing', {
                        uuid: validated['content block UUID'],
                        locked_by: uid_number
                    });

                } catch (lock_error) {
                    LOGGER.module().warn('Failed to lock content block record', {
                        uuid: validated['content block UUID'],
                        error: lock_error.message
                    });
                }
            } else {
                const locked_by_number = Number(record.locked_by_user);
                const status = locked_by_number === uid_number ? 'by this user' : 'by another user';
                this._log_success(`content block record already locked ${status}`, {
                    uuid: validated['content block UUID'],
                    locked_by: record.locked_by_user
                });
            }

            return record;

        } catch (error) {
            this._handle_error(error, 'get_content_block_edit_record', {
                uid,
                uuid
            });
        }
    }

    /**
     * Updates a content block record
     * @param {Object} data - content block data to update
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result
     */
    async update_content_block_record(data, updated_by = null) {

        const UPDATABLE_FIELDS = [
            'type', 'text', 'order', 'styles', 'is_visible', 'title',
            'is_published', 'is_locked', 'locked_by_user', 'locked_at',
            'size', 'owner', 'url', 'content_type', 'transparent', 'updated_by'
        ];

        try {
            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('content_block_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'content block UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            const {sanitized_data} = this._sanitize_data(
                data,
                UPDATABLE_FIELDS,
                ['uuid', 'is_member_of_exhibit']
            );

            if (Object.keys(sanitized_data).length === 0) {
                return {
                    success: true,
                    no_change: true,
                    uuid: validated['content block UUID'],
                    affected_rows: 0,
                    message: 'No fields to update'
                };
            }

            if (updated_by) {
                sanitized_data.updated_by = updated_by;
            }

            // Check record exists
            const existing = await this.DB(this.TABLE.content_block_records)
                .select('id', 'uuid', 'is_deleted')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['content block UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error('content block record not found');
            }

            if (existing.is_deleted === 1) {
                throw new Error('Cannot update deleted content block record');
            }

            const affected_rows = await this.DB(this.TABLE.content_block_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['content block UUID'],
                    is_deleted: 0
                })
                .update(sanitized_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Update failed: No rows affected');
            }

            this._log_success('content block record updated successfully', {
                uuid: validated['content block UUID'],
                fields_updated: Object.keys(sanitized_data),
                affected_rows,
                updated_by
            });

            return {
                success: true,
                uuid: validated['content block UUID'],
                affected_rows,
                fields_updated: Object.keys(sanitized_data),
                message: 'content block record updated successfully'
            };

        } catch (error) {
            this._handle_error(error, 'update_content_block_record', {
                uuid: data?.uuid,
                updated_by
            });
        }
    }

    /**
     * Gets the count of content block records for an exhibit
     * @param {string} uuid - The exhibit UUID
     * @returns {Promise<number>} Count of content block records
     */
    async get_record_count(uuid) {

        try {
            this._validate_database();
            this._validate_table('content_block_records');

            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this.DB(this.TABLE.content_block_records)
                .count('id as count')
                .where({is_member_of_exhibit: exhibit_uuid})
                .timeout(this.QUERY_TIMEOUT);

            const count = result?.[0]?.count ? parseInt(result[0].count, 10) : 0;

            this._log_success('content block record count retrieved', {
                is_member_of_exhibit: exhibit_uuid,
                count
            });

            return count;

        } catch (error) {
            this._handle_error(error, 'get_record_count', {uuid});
        }
    }

    // ==================== PUBLISHING / SUPPRESSING ====================

    /**
     * Publishes all content blocks for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_to_publish(uuid, published_by = null) {

        try {
            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'content_block_records',
                {is_member_of_exhibit: exhibit_uuid},
                1,
                published_by
            );

            this._log_success('content block records published', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to publish content block records: ' + error.message);
            return false;
        }
    }

    /**
     * Publishes a single content block
     * @param {string} uuid - content block UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_content_block_to_publish(uuid, published_by = null) {
        try {
            const result = await this._update_single_publish_status(
                'content_block_records',
                uuid,
                1,
                published_by
            );

            this._log_success('content block record published', {
                uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to publish content block record: ' + error.message);
            return false;
        }
    }

    /**
     * Suppresses all content blocks for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_to_suppress(uuid, unpublished_by = null) {

        try {
            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'content_block_records',
                {is_member_of_exhibit: exhibit_uuid},
                0,
                unpublished_by
            );

            this._log_success('content block records suppressed', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to suppress content block records: ' + error.message);
            return false;
        }
    }

    /**
     * Suppresses a single content block
     * @param {string} uuid - content block UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_content_block_to_suppress(uuid, unpublished_by = null) {

        try {
            const result = await this._update_single_publish_status(
                'content_block_records',
                uuid,
                0,
                unpublished_by
            );

            this._log_success('content block record suppressed', {
                uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to suppress content block record: ' + error.message);
            return false;
        }
    }

    // ==================== REORDERING ====================

    /**
     * Reorders content blocks
     * @param {string} is_member_of_exhibit - Exhibit UUID
     * @param {Object} content block - content block object with uuid and order
     * @returns {Promise<boolean>} Reorder success status
     */
    async reorder_content_blocks(is_member_of_exhibit, content_block) {

        try {

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            await this._reorder_items(
                'content_block_records',
                {is_member_of_exhibit: exhibit_uuid},
                content_block
            );

            this._log_success('content block reordered', {
                exhibit_uuid,
                uuid: content_block.uuid,
                order: content_block.order
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to reorder content block: ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_content_block_record_tasks;
