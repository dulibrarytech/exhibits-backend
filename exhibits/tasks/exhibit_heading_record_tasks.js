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
 * Object contains tasks used to manage exhibit heading records
 * @param DB
 * @param TABLE
 * @type {Exhibit_heading_record_tasks}
 */
const Exhibit_heading_record_tasks = class extends Base_tasks {

    constructor(DB, TABLE) {
        super(DB, TABLE);
    }

    // Validation helpers, _handle_error, _log_success, _update_publish_status,
    // _update_single_publish_status, _reorder_items inherited from Base_tasks

    // ==================== HEADING-SPECIFIC HELPERS ====================

    /**
     * Sets default values for heading fields
     * @param {Object} data - Data object to set defaults on
     * @private
     */
    _set_heading_defaults(data) {
        const defaults = {
            type: 'heading',
            order: 0,
            is_visible: 1,
            is_anchor: 1,
            is_published: 0,
            is_locked: 0,
            locked_by_user: 0,
            is_indexed: 0,
            is_deleted: 0,
            owner: 0
        };

        for (const [key, default_value] of Object.entries(defaults)) {
            if (data[key] === undefined) {
                data[key] = default_value;
            }
        }
    }

    // ==================== HEADING RECORDS ====================

    /**
     * Creates a new heading record in the database
     * @param {Object} data - Heading record data
     * @param {string} data.uuid - Heading UUID (required)
     * @param {string} data.is_member_of_exhibit - Exhibit UUID (required)
     * @param {string} data.text - Heading text content (required)
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created heading record with ID
     */
    async create_heading_record(data, created_by = null) {

        const ALLOWED_FIELDS = [
            'is_member_of_exhibit', 'uuid', 'type', 'text', 'order', 'styles',
            'is_visible', 'is_anchor', 'is_published', 'is_locked', 'locked_by_user',
            'locked_at', 'is_indexed', 'is_deleted', 'owner'
        ];

        try {

            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('heading_records');

            // Validate required fields
            const validated = this._validate_uuids({
                [data.uuid]: 'heading UUID',
                [data.is_member_of_exhibit]: 'exhibit UUID'
            });

            this._validate_string(data.text, 'heading text');

            // Sanitize data
            const {sanitized_data} = this._sanitize_data(data, ALLOWED_FIELDS);

            // Set defaults
            this._set_heading_defaults(sanitized_data);

            // Add created_by and updated_by
            if (created_by) {
                sanitized_data.created_by = created_by;
                sanitized_data.updated_by = created_by;
            }

            // Insert in transaction
            const created_record = await this.DB.transaction(async (trx) => {
                const [insert_id] = await trx(this.TABLE.heading_records)
                    .insert(sanitized_data)
                    .timeout(this.QUERY_TIMEOUT);

                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                const record = await trx(this.TABLE.heading_records)
                    .select('*')
                    .where({id: insert_id})
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                this._log_success('Heading record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    text: record.text.substring(0, 50),
                    created_by
                });

                return record;
            });

            return {
                success: true,
                id: created_record.id,
                uuid: created_record.uuid,
                record: created_record,
                message: 'Heading record created successfully'
            };

        } catch (error) {
            this._handle_error(error, 'create_heading_record', {
                uuid: data?.uuid,
                exhibit_uuid: data?.is_member_of_exhibit,
                created_by
            });
        }
    }

    /**
     * Gets all heading records by exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @returns {Promise<Array>} Array of heading records
     */
    async get_heading_records(is_member_of_exhibit) {
        try {
            this._validate_database();
            this._validate_table('heading_records');

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            const records = await this.DB(this.TABLE.heading_records)
                .select('*')
                .where({
                    is_member_of_exhibit: exhibit_uuid,
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(this.QUERY_TIMEOUT);

            this._log_success('Heading records retrieved successfully', {
                is_member_of_exhibit: exhibit_uuid,
                count: records.length
            });

            return records || [];

        } catch (error) {
            this._handle_error(error, 'get_heading_records', {
                is_member_of_exhibit
            });
        }
    }

    /**
     * Gets a single heading record by exhibit and heading UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} uuid - The heading UUID
     * @returns {Promise<Object|null>} Heading record or null
     */
    async get_heading_record(is_member_of_exhibit, uuid) {

        try {
            this._validate_database();
            this._validate_table('heading_records');

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [uuid]: 'heading UUID'
            });

            const record = await this.DB(this.TABLE.heading_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['heading UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('Heading record not found', validated);
                return null;
            }

            this._log_success('Heading record retrieved', {
                uuid: validated['heading UUID']
            });

            return record;

        } catch (error) {
            this._handle_error(error, 'get_heading_record', {
                is_member_of_exhibit,
                uuid
            });
        }
    }

    /**
     * Gets a heading record for editing and locks it
     * @param {string|number} uid - User ID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} uuid - The heading UUID
     * @returns {Promise<Object|null>} Heading record with lock status
     */
    async get_heading_edit_record(uid, is_member_of_exhibit, uuid) {

        try {
            this._validate_database();
            this._validate_table('heading_records');

            if (uid === null || uid === undefined || uid === '') {
                throw new Error('Valid user ID is required');
            }

            const uid_number = Number(uid);
            if (isNaN(uid_number)) {
                throw new Error('User ID must be a valid number');
            }

            const validated = this._validate_uuids({
                [is_member_of_exhibit]: 'exhibit UUID',
                [uuid]: 'heading UUID'
            });

            const record = await this.DB(this.TABLE.heading_records)
                .select('*')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['heading UUID'],
                    is_deleted: 0
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!record) {
                this._log_success('Heading record not found', validated);
                return null;
            }

            // Handle locking
            if (record.is_locked === 0) {
                try {
                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(
                        uid,
                        validated['heading UUID'],
                        this.DB,
                        this.TABLE.heading_records
                    );

                    record.is_locked = 1;
                    record.locked_by_user = uid_number;

                    this._log_success('Heading record locked for editing', {
                        uuid: validated['heading UUID'],
                        locked_by: uid_number
                    });

                } catch (lock_error) {
                    LOGGER.module().warn('Failed to lock heading record', {
                        uuid: validated['heading UUID'],
                        error: lock_error.message
                    });
                }
            } else {
                const locked_by_number = Number(record.locked_by_user);
                const status = locked_by_number === uid_number ? 'by this user' : 'by another user';
                this._log_success(`Heading record already locked ${status}`, {
                    uuid: validated['heading UUID'],
                    locked_by: record.locked_by_user
                });
            }

            return record;

        } catch (error) {
            this._handle_error(error, 'get_heading_edit_record', {
                uid,
                uuid
            });
        }
    }

    /**
     * Updates a heading record
     * @param {Object} data - Heading data to update
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result
     */
    async update_heading_record(data, updated_by = null) {

        const UPDATABLE_FIELDS = [
            'type', 'text', 'order', 'styles', 'is_visible', 'is_anchor',
            'is_published', 'is_locked', 'locked_by_user', 'locked_at',
            'is_indexed', 'owner'
        ];

        try {
            this._validate_data_object(data);
            this._validate_database();
            this._validate_table('heading_records');

            const validated = this._validate_uuids({
                [data.uuid]: 'heading UUID',
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
                    uuid: validated['heading UUID'],
                    affected_rows: 0,
                    message: 'No fields to update'
                };
            }

            if (updated_by) {
                sanitized_data.updated_by = updated_by;
            }

            // Check record exists
            const existing = await this.DB(this.TABLE.heading_records)
                .select('id', 'uuid', 'is_deleted')
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['heading UUID']
                })
                .first()
                .timeout(this.QUERY_TIMEOUT);

            if (!existing) {
                throw new Error('Heading record not found');
            }

            if (existing.is_deleted === 1) {
                throw new Error('Cannot update deleted heading record');
            }

            const affected_rows = await this.DB(this.TABLE.heading_records)
                .where({
                    is_member_of_exhibit: validated['exhibit UUID'],
                    uuid: validated['heading UUID'],
                    is_deleted: 0
                })
                .update(sanitized_data)
                .timeout(this.QUERY_TIMEOUT);

            if (affected_rows === 0) {
                throw new Error('Update failed: No rows affected');
            }

            this._log_success('Heading record updated successfully', {
                uuid: validated['heading UUID'],
                fields_updated: Object.keys(sanitized_data),
                affected_rows,
                updated_by
            });

            return {
                success: true,
                uuid: validated['heading UUID'],
                affected_rows,
                fields_updated: Object.keys(sanitized_data),
                message: 'Heading record updated successfully'
            };

        } catch (error) {
            this._handle_error(error, 'update_heading_record', {
                uuid: data?.uuid,
                updated_by
            });
        }
    }

    /**
     * Gets the count of heading records for an exhibit
     * @param {string} uuid - The exhibit UUID
     * @returns {Promise<number>} Count of heading records
     */
    async get_record_count(uuid) {

        try {
            this._validate_database();
            this._validate_table('heading_records');

            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this.DB(this.TABLE.heading_records)
                .count('id as count')
                .where({is_member_of_exhibit: exhibit_uuid})
                .timeout(this.QUERY_TIMEOUT);

            const count = result?.[0]?.count ? parseInt(result[0].count, 10) : 0;

            this._log_success('Heading record count retrieved', {
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
     * Publishes all headings for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_to_publish(uuid, published_by = null) {

        try {
            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'heading_records',
                {is_member_of_exhibit: exhibit_uuid},
                1,
                published_by
            );

            this._log_success('Heading records published', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to publish heading records: ' + error.message);
            return false;
        }
    }

    /**
     * Publishes a single heading
     * @param {string} uuid - Heading UUID
     * @param {string} [published_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_heading_to_publish(uuid, published_by = null) {
        try {
            const result = await this._update_single_publish_status(
                'heading_records',
                uuid,
                1,
                published_by
            );

            this._log_success('Heading record published', {
                uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to publish heading record: ' + error.message);
            return false;
        }
    }

    /**
     * Suppresses all headings for an exhibit
     * @param {string} uuid - Exhibit UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_to_suppress(uuid, unpublished_by = null) {

        try {
            const exhibit_uuid = this._validate_uuid(uuid, 'exhibit UUID');

            const result = await this._update_publish_status(
                'heading_records',
                {is_member_of_exhibit: exhibit_uuid},
                0,
                unpublished_by
            );

            this._log_success('Heading records suppressed', {
                exhibit_uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to suppress heading records: ' + error.message);
            return false;
        }
    }

    /**
     * Suppresses a single heading
     * @param {string} uuid - Heading UUID
     * @param {string} [unpublished_by=null] - User ID
     * @returns {Promise<boolean>} Success status
     */
    async set_heading_to_suppress(uuid, unpublished_by = null) {

        try {
            const result = await this._update_single_publish_status(
                'heading_records',
                uuid,
                0,
                unpublished_by
            );

            this._log_success('Heading record suppressed', {
                uuid,
                affected_rows: result.affected_rows
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to suppress heading record: ' + error.message);
            return false;
        }
    }

    // ==================== REORDERING ====================

    /**
     * Reorders headings
     * @param {string} is_member_of_exhibit - Exhibit UUID
     * @param {Object} heading - Heading object with uuid and order
     * @returns {Promise<boolean>} Reorder success status
     */
    async reorder_headings(is_member_of_exhibit, heading) {

        try {

            const exhibit_uuid = this._validate_uuid(is_member_of_exhibit, 'exhibit UUID');

            await this._reorder_items(
                'heading_records',
                {is_member_of_exhibit: exhibit_uuid},
                heading
            );

            this._log_success('Heading reordered', {
                exhibit_uuid,
                uuid: heading.uuid,
                order: heading.order
            });

            return true;

        } catch (error) {
            LOGGER.module().error('Failed to reorder heading: ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_heading_record_tasks;