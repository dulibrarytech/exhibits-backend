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
 * Object contains tasks used to manage exhibit heading records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_heading_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Creates a new heading record in the database
     * @param {Object} data - Heading record data
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created heading record with ID
     * @throws {Error} If validation fails or creation fails
     */
    async create_heading_record(data, created_by = null) {

        // Define whitelist of allowed fields
        const ALLOWED_FIELDS = [
            'is_member_of_exhibit',
            'uuid',
            'text',
            'styles',
            'owner'
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

            if (!this.TABLE?.heading_records) {
                throw new Error('Table name "heading_records" is not defined');
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
            if (!sanitized_data.is_published) {
                sanitized_data.is_published = 0;
            }
            if (!sanitized_data.is_deleted) {
                sanitized_data.is_deleted = 0;
            }

            // ===== PERFORM INSERT IN TRANSACTION =====
            const created_record = await this.DB.transaction(async (trx) => {
                // Insert the record
                const [insert_id] = await trx(this.TABLE.heading_records)
                    .insert(sanitized_data)
                    .timeout(10000);

                // Verify insert succeeded
                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                // Fetch and return the created record
                const record = await trx(this.TABLE.heading_records)
                    .where({ id: insert_id })
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                LOGGER.module().info('Heading record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    created_by,
                    timestamp: new Date().toISOString()
                });

                return record;
            });

            return created_record;

        } catch (error) {
            const error_context = {
                method: 'create_heading_record',
                data_keys: Object.keys(data || {}),
                created_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to create heading record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Creates exhibit heading record
     * @param data
     */
    /*
    async create_heading_record__(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE.heading_records)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (create_heading_record)] ' + result.length + ' Heading record created.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (create_heading_record)] unable to create heading record ' + error.message);
        }
    }
    */

    /**
     * Gets all heading records by exhibit
     * @param is_member_of_exhibit
     */
    async get_heading_records(is_member_of_exhibit) {

        try {

            return await this.DB(this.TABLE.heading_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (get_heading_records)] unable to get heading records ' + error.message);
        }
    }

    /**
     * Retrieves a single heading record by exhibit UUID and heading UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID this heading belongs to
     * @param {string} uuid - The heading record UUID
     * @returns {Promise<Object|null>} Heading record or null if not found
     * @throws {Error} If validation fails or query fails
     */
    async get_heading_record(is_member_of_exhibit, uuid) {
        // Define columns to select
        const HEADING_COLUMNS = [
            'id',
            'is_member_of_exhibit',
            'uuid',
            'type',
            'text',
            'order',
            'styles',
            'is_visible',
            'is_anchor',
            'is_published',
            'is_locked',
            'locked_by_user',
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

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid heading UUID is required');
            }

            // Validate is_member_of_exhibit format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // Validate uuid format
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid heading UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.heading_records) {
                throw new Error('Table name "heading_records" is not defined');
            }

            // ===== FETCH HEADING RECORD =====

            const record = await Promise.race([
                this.DB(this.TABLE.heading_records)
                    .select(HEADING_COLUMNS)
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
                LOGGER.module().info('Heading record not found', {
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    uuid: uuid.trim()
                });
                return null;
            }

            LOGGER.module().info('Heading record retrieved', {
                uuid: uuid.trim(),
                is_member_of_exhibit: is_member_of_exhibit.trim()
            });

            return record;

        } catch (error) {
            const error_context = {
                method: 'get_heading_record',
                is_member_of_exhibit,
                uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get heading record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets heading record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async get_heading_record__(is_member_of_exhibit, uuid) {

        try {

            return await this.DB(this.TABLE.heading_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (get_heading_record)] unable to get heading records ' + error.message);
        }
    }

    /**
     * Retrieves a heading record for editing and locks it for the user
     * @param {string|number} uid - User ID requesting to edit
     * @param {string} is_member_of_exhibit - The exhibit UUID this heading belongs to
     * @param {string} uuid - The heading record UUID
     * @returns {Promise<Object|null>} Heading record with lock status, or null if not found
     * @throws {Error} If validation fails or retrieval fails
     */
    async get_heading_edit_record(uid, is_member_of_exhibit, uuid) {
        // Define columns to select (avoid SELECT *)
        const HEADING_COLUMNS = [
            'id',
            'is_member_of_exhibit',
            'uuid',
            'type',
            'text',
            'order',
            'styles',
            'is_visible',
            'is_anchor',
            'is_published',
            'is_locked',
            'locked_by_user',
            'is_deleted',
            'is_published',
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
                throw new Error('Valid heading UUID is required');
            }

            // Validate UUID formats
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid heading UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.heading_records) {
                throw new Error('Table name "heading_records" is not defined');
            }

            // ===== FETCH HEADING RECORD =====

            const record = await Promise.race([
                this.DB(this.TABLE.heading_records)
                    .select(HEADING_COLUMNS)
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
                LOGGER.module().info('Heading record not found', {
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    uuid: uuid.trim()
                });
                return null;
            }

            // ===== HANDLE RECORD LOCKING =====

            // If record is not locked, attempt to lock it for this user
            if (record.is_locked === 0) {
                try {
                    const HELPER_TASK = new HELPER(); // _number // TODO normalize
                    await HELPER_TASK.lock_record(
                        uid,
                        uuid.trim(),
                        this.DB,
                        this.TABLE.heading_records
                    );

                    // Update the record object with lock status
                    record.is_locked = 1;
                    record.locked_by_user = uid_number;

                    LOGGER.module().info('Heading record locked for editing', {
                        uuid: uuid.trim(),
                        locked_by: uid_number
                    });

                } catch (lock_error) {
                    LOGGER.module().error('Failed to lock heading record', {
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
                    LOGGER.module().info('Heading record already locked by this user', {
                        uuid: uuid.trim(),
                        uid: uid_number
                    });
                } else {
                    LOGGER.module().info('Heading record already locked by another user', {
                        uuid: uuid.trim(),
                        locked_by: record.locked_by_user,
                        requested_by: uid_number
                    });
                }
            }

            return record;

        } catch (error) {
            const error_context = {
                method: 'get_heading_edit_record',
                uid,
                is_member_of_exhibit,
                uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get heading edit record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets heading edit record
     * @param is_member_of_exhibit
     * @param uuid
     * @param uid
     */
    async get_heading_edit_record__(uid, is_member_of_exhibit, uuid) {

        try {

            const data = await this.DB(this.TABLE.heading_records)
                .select('*')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    uuid: uuid,
                    is_deleted: 0
                });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uid, uuid, this.DB, this.TABLE.heading_records);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR:[/exhibits/exhibit_heading_record_tasks (get_heading_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (get_heading_record)] unable to get heading records ' + error.message);
        }
    }

    /**
     * Updates item record
     * @param data
     */
    async update_heading_record(data) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (update_heading_record)] Heading record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (update_heading_record)] unable to update heading record ' + error.message);
        }
    }

    /**
     * Deletes heading record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async delete_heading_record(is_member_of_exhibit, uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (delete_heading_record)] Heading record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (delete_heading_record)] unable to delete heading record ' + error.message);
        }
    }

    /**
     * Gets heading record count
     * @param uuid
     */
    async get_record_count(uuid) {

        try {

            const count = await this.DB(this.TABLE.heading_records).count('id as count')
            .where({
                is_member_of_exhibit: uuid
            });

            return count[0].count;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (get_record_count)] unable to get heading record count ' + error.message);
        }
    }

    /**
     * Sets is_published flogs to true for heading records
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (set_to_publish)] Heading is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (set_to_publish)] unable to set heading is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to true
     * @param uuid
     */
    async set_heading_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_heading_to_publish)] Heading is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_heading_to_publish)] unable to set heading is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false for heading records
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (set_to_suppress)] Heading is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (set_to_suppress)] unable to set heading is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to false
     * @param uuid
     */
    async set_heading_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_item_record_tasks (set_heading_to_suppress)] Heading is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (set_heading_to_suppress)] unable to set heading is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Reorders headings
     * @param is_member_of_exhibit
     * @param heading
     */
    async reorder_headings(is_member_of_exhibit, heading) {

        try {

            await this.DB(this.TABLE.heading_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: heading.uuid
            })
            .update({
                order: heading.order
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_heading_record_tasks (reorder_headings)] Heading reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_heading_record_tasks (reorder_headings)] unable to reorder heading ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_heading_record_tasks;
