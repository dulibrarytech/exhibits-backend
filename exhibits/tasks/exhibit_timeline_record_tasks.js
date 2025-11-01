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
const HELPER = require("../../libs/helper");

/**
 * Object contains tasks used to manage exhibit timeline records
 * @param DB
 * @param TABLE
 * @type {Exhibit_record_tasks}
 */
const Exhibit_timeline_record_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

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

        // Define whitelist of allowed fields based on schema
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
            // ===== INPUT VALIDATION =====

            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Data must be a valid object');
            }

            if (Object.keys(data).length === 0) {
                throw new Error('Data object cannot be empty');
            }

            // ===== VALIDATE REQUIRED FIELDS =====

            if (!data.uuid || typeof data.uuid !== 'string' || !data.uuid.trim()) {
                throw new Error('Valid timeline UUID is required');
            }

            if (!data.is_member_of_exhibit || typeof data.is_member_of_exhibit !== 'string' || !data.is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
                throw new Error('Valid timeline title is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(data.uuid.trim())) {
                throw new Error('Invalid timeline UUID format');
            }

            if (!uuid_regex.test(data.is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.timeline_records) {
                throw new Error('Table name "timeline_records" is not defined');
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

            // ===== ADD METADATA AND DEFAULTS =====

            // Set default type based on schema
            if (!sanitized_data.type) {
                sanitized_data.type = 'vertical_timeline';
            }

            // Set default values
            if (sanitized_data.order === undefined) {
                sanitized_data.order = 0;
            }

            if (sanitized_data.is_deleted === undefined) {
                sanitized_data.is_deleted = 0;
            }

            if (sanitized_data.is_published === undefined) {
                sanitized_data.is_published = 0;
            }

            if (sanitized_data.owner === undefined) {
                sanitized_data.owner = 0;
            }

            // Add created_by and updated_by
            if (created_by) {
                sanitized_data.created_by = created_by;
                sanitized_data.updated_by = created_by;
            }

            // ===== PERFORM INSERT IN TRANSACTION =====

            const created_record = await this.DB.transaction(async (trx) => {
                // Insert the record
                const [insert_id] = await trx(this.TABLE.timeline_records)
                    .insert(sanitized_data)
                    .timeout(10000);

                // Verify insert succeeded
                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                // Fetch and return the created record
                const record = await trx(this.TABLE.timeline_records)
                    .select(
                        'id',
                        'uuid',
                        'is_member_of_exhibit',
                        'type',
                        'title',
                        'text',
                        'styles',
                        'order',
                        'is_deleted',
                        'is_published',
                        'created',
                        'updated',
                        'owner',
                        'created_by',
                        'updated_by'
                    )
                    .where({ id: insert_id })
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                LOGGER.module().info('Timeline record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    title: record.title,
                    type: record.type,
                    is_member_of_exhibit: record.is_member_of_exhibit,
                    created_by,
                    timestamp: new Date().toISOString()
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
            const error_context = {
                method: 'create_timeline_record',
                uuid: data?.uuid,
                exhibit_uuid: data?.is_member_of_exhibit,
                title: data?.title,
                data_keys: Object.keys(data || {}),
                created_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to create timeline record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets all timeline records by exhibit
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @returns {Promise<Array>} Array of timeline records
     * @throws {Error} If validation fails or query fails
     */
    async get_timeline_records(is_member_of_exhibit) {
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

            if (!this.TABLE?.timeline_records) {
                throw new Error('Table name "timeline_records" is not defined');
            }

            // ===== QUERY TIMELINE RECORDS =====

            const timeline_records = await this.DB(this.TABLE.timeline_records)
                .select(
                    'id',
                    'uuid',
                    'is_member_of_exhibit',
                    'type',
                    'title',
                    'text',
                    'styles',
                    'order',
                    'is_deleted',
                    'is_published',
                    'created',
                    'updated',
                    'owner',
                    'created_by',
                    'updated_by'
                )
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(10000);

            LOGGER.module().info('Timeline records retrieved successfully', {
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                count: timeline_records.length,
                timestamp: new Date().toISOString()
            });

            return timeline_records;

        } catch (error) {
            const error_context = {
                method: 'get_timeline_records',
                is_member_of_exhibit,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get timeline records',
                error_context
            );

            throw error;
        }
    }

    /**
     * Updates a timeline record in the database
     * @param {Object} data - Timeline data to update
     * @param {string} data.uuid - Timeline UUID (required)
     * @param {string} data.is_member_of_exhibit - Exhibit UUID (required)
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result with affected rows
     * @throws {Error} If validation fails or update fails
     */
    async update_timeline_record(data, updated_by = null) {

        // Define whitelist of updatable fields based on tbl_timelines schema
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
            // ===== INPUT VALIDATION =====

            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Data must be a valid object');
            }

            if (Object.keys(data).length === 0) {
                throw new Error('Data object cannot be empty');
            }

            // ===== VALIDATE REQUIRED FIELDS =====

            if (!data.uuid || typeof data.uuid !== 'string' || !data.uuid.trim()) {
                throw new Error('Valid timeline UUID is required');
            }

            if (!data.is_member_of_exhibit || typeof data.is_member_of_exhibit !== 'string' || !data.is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(data.uuid.trim())) {
                throw new Error('Invalid timeline UUID format');
            }

            if (!uuid_regex.test(data.is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.timeline_records) {
                throw new Error('Table name "timeline_records" is not defined');
            }

            // ===== SANITIZE UPDATE DATA =====

            const update_data = {};
            const invalid_fields = [];

            for (const [key, value] of Object.entries(data)) {
                // Skip identifier fields
                if (key === 'uuid' || key === 'is_member_of_exhibit') {
                    continue;
                }

                // Security: prevent prototype pollution
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    LOGGER.module().warn('Dangerous property skipped', { key });
                    continue;
                }

                // Whitelist check
                if (UPDATABLE_FIELDS.includes(key)) {
                    update_data[key] = value;
                } else {
                    invalid_fields.push(key);
                }
            }

            // Warn about invalid fields
            if (invalid_fields.length > 0) {
                LOGGER.module().warn('Invalid fields ignored in update', {
                    fields: invalid_fields
                });
            }

            // Check if we have any valid data to update
            if (Object.keys(update_data).length === 0) {
                return {
                    success: true,
                    no_change: true,
                    uuid: data.uuid.trim(),
                    affected_rows: 0,
                    message: 'No fields to update'
                };
            }

            // ===== ADD UPDATED_BY =====

            if (updated_by) {
                update_data.updated_by = updated_by;
            }

            // Note: 'updated' timestamp is automatically set by database ON UPDATE CURRENT_TIMESTAMP

            // ===== CHECK RECORD EXISTS =====

            const existing_record = await this.DB(this.TABLE.timeline_records)
                .select('id', 'uuid', 'title', 'is_deleted')
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                    uuid: data.uuid.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error('Timeline record not found');
            }

            if (existing_record.is_deleted === 1) {
                throw new Error('Cannot update deleted timeline record');
            }

            // ===== PERFORM UPDATE =====

            const affected_rows = await this.DB(this.TABLE.timeline_records)
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                    uuid: data.uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            if (affected_rows === 0) {
                throw new Error('Update failed: No rows affected');
            }

            // ===== LOG SUCCESS =====

            LOGGER.module().info('Timeline record updated successfully', {
                uuid: data.uuid.trim(),
                is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                fields_updated: Object.keys(update_data),
                affected_rows,
                updated_by,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                uuid: data.uuid.trim(),
                affected_rows,
                fields_updated: Object.keys(update_data),
                message: 'Timeline record updated successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'update_timeline_record',
                uuid: data?.uuid,
                exhibit_uuid: data?.is_member_of_exhibit,
                data_keys: Object.keys(data || {}),
                updated_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to update timeline record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets a single timeline record by exhibit and timeline UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} timeline_uuid - The timeline UUID
     * @returns {Promise<Object|null>} Timeline record or null if not found
     * @throws {Error} If validation fails or query fails
     */
    async get_timeline_record(is_member_of_exhibit, timeline_uuid) {
        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!timeline_uuid || typeof timeline_uuid !== 'string' || !timeline_uuid.trim()) {
                throw new Error('Valid timeline UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(timeline_uuid.trim())) {
                throw new Error('Invalid timeline UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.timeline_records) {
                throw new Error('Table name "timeline_records" is not defined');
            }

            // ===== QUERY TIMELINE RECORD =====

            const timeline_record = await this.DB(this.TABLE.timeline_records)
                .select(
                    'id',
                    'uuid',
                    'is_member_of_exhibit',
                    'type',
                    'title',
                    'text',
                    'styles',
                    'order',
                    'is_deleted',
                    'is_published',
                    'created',
                    'updated',
                    'owner',
                    'created_by',
                    'updated_by'
                )
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    uuid: timeline_uuid.trim(),
                    is_deleted: 0
                })
                .first()
                .timeout(10000);

            if (!timeline_record) {
                LOGGER.module().info('Timeline record not found', {
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    timeline_uuid: timeline_uuid.trim()
                });
                return null;
            }

            LOGGER.module().info('Timeline record retrieved successfully', {
                uuid: timeline_record.uuid,
                title: timeline_record.title,
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                timestamp: new Date().toISOString()
            });

            return timeline_record;

        } catch (error) {
            const error_context = {
                method: 'get_timeline_record',
                is_member_of_exhibit,
                timeline_uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get timeline record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets timeline items
     * @param is_member_of_exhibit
     * @param is_member_of_timeline
     */
    async get_timeline_item_records(is_member_of_exhibit, is_member_of_timeline) {

        try {

            return await this.DB(this.TABLE.timeline_item_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_member_of_timeline: is_member_of_timeline,
                is_deleted: 0
            })
            .orderBy('order');

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_timeline_item_records)] unable to get timeline records ' + error.message);
        }
    }

    /**
     * Create timeline item records
     * @param data
     */
    async create_timeline_item_record(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                .into(this.TABLE.timeline_item_records)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (create_timeline_item_record)] ' + result.length + ' Timeline item record created.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (create_timeline_item_record)] unable to create timeline item record ' + error.message);
        }
    }

    /**
     * Gets timeline item record
     * @param is_member_of_exhibit
     * @param timeline_id
     * @param item_id
     */
    async get_timeline_item_record(is_member_of_exhibit, timeline_id, item_id) {

        try {

            return await this.DB(this.TABLE.timeline_item_records)
            .select('*')
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_member_of_timeline: timeline_id,
                uuid: item_id,
                is_deleted: 0
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_timeline_item_record)] unable to get timeline item record ' + error.message);
        }
    }

    async get_timeline_item_edit_record(uid, is_member_of_exhibit, timeline_id, item_id) {

        try {

            const data = await this.DB(this.TABLE.timeline_item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit,
                    is_member_of_timeline: timeline_id,
                    uuid: item_id,
                    is_deleted: 0
                });

            if (data.length !== 0 && data[0].is_locked === 0) {

                try {

                    const HELPER_TASK = new HELPER();
                    await HELPER_TASK.lock_record(uid, item_id, this.DB, this.TABLE.timeline_item_records);
                    return data;

                } catch (error) {
                    LOGGER.module().error('ERROR: [/exhibits/exhibit_item_record_tasks (get_timeline_item_edit_record)] unable to lock record ' + error.message);
                }

            } else {
                return data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_timeline_item_edit_record)] unable to get grid item record ' + error.message);
        }
    }

    /**
     * Update timeline item record
     * @param data
     */
    async update_timeline_item_record(data) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_exhibit: data.is_member_of_exhibit,
                is_member_of_timeline: data.is_member_of_timeline,
                uuid: data.uuid
            })
            .update(data);

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (update_timeline_item_record)] Timeline item record updated.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (update_timeline_item_record)] unable to update timeline item record ' + error.message);
        }
    }

    /**
     * Clears out media value
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

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                uuid: uuid
            })
            .update(update);

            LOGGER.module().info('INFO: [/exhibits/timeline_record_tasks (delete_media_value)] Media value deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/timeline_record_tasks (delete_media_value)] unable to delete media value ' + error.message);
            return false;
        }
    }

    /** * delete occurs in exhibit_item_record_tasks.js
     * Deletes timeline record
     * @param is_member_of_exhibit
     * @param uuid
     */
    async delete_timeline_record(is_member_of_exhibit, uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: uuid
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (delete_timeline_record)] Timeline record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (delete_timeline_record)] unable to delete timeline record ' + error.message);
        }
    }

    /**
     * Deletes timeline item
     * @param is_member_of_exhibit
     * @param timeline_id
     * @param timeline_item_id
     */
    async delete_timeline_item_record(is_member_of_exhibit, timeline_id, timeline_item_id) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                is_member_of_timeline: timeline_id,
                uuid: timeline_item_id
            })
            .update({
                is_deleted: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (delete_timeline_item_record)] Timeline item record deleted.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (delete_timeline_item_record)] unable to delete timeline item record ' + error.message);
        }
    }

    /**
     * Gets timeline record count
     * @param uuid
     */
    async get_record_count(uuid) {

        try {

            const count = await this.DB(this.TABLE.timeline_records).count('id as count')
            .where({
                is_member_of_exhibit: uuid
            });

            return count[0].count;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (get_record_count)] unable to get timeline record count ' + error.message);
        }
    }

    /**
     * Sets is_published flogs to true
     * @param uuid
     */
    async set_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_to_publish)] Timeline is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_to_publish)] unable to set timeline is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to true for each timeline item record
     * @param uuid
     */
    async set_timeline_item_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_timeline_item_to_publish)] Timeline item is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_timeline_item_to_publish)] unable to set timeline item is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to true for timeline record
     * @param uuid
     */
    async set_timeline_to_publish(uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_timeline_to_publish)] Timeline is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_timeline_to_publish)] unable to set timeline is_published ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to true for all timeline by timeline id
     * @param uuid
     */
    async set_to_publish_timeline_items(uuid) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_timeline: uuid
            })
            .update({
                is_published: 1
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_to_publish_timeline_items)] Timeline items is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_to_publish_timeline_items)] unable to set timeline items is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false for all timeline records by exhibit id
     * @param uuid
     */
    async set_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_to_suppress)] Timeline is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_to_suppress)] unable to set timeline is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flog to false for timeline record
     * @param uuid
     */
    async set_timeline_to_suppress(uuid) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                uuid: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_timeline_to_suppress)] Timeline is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_timeline_to_suppress)] unable to set timeline is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Sets is_published flogs to false for timeline item records by timeline id
     * @param uuid
     */
    async set_to_suppressed_timeline_items(uuid) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_timeline: uuid
            })
            .update({
                is_published: 0
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (set_to_suppressed_timeline_items)] Timeline items is_published set.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (set_to_suppressed_timeline_items)] unable to set timeline items is_published. ' + error.message);
            return false;
        }
    }

    /**
     * Reorders timelines
     * @param is_member_of_exhibit
     * @param timelines
     */
    async reorder_timelines(is_member_of_exhibit, timelines) {

        try {

            await this.DB(this.TABLE.timeline_records)
            .where({
                is_member_of_exhibit: is_member_of_exhibit,
                uuid: timelines.uuid
            })
            .update({
                order: timelines.order
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (reorder_timelines)] Timeline reordered.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (reorder_timelines)] unable to reorder timeline ' + error.message);
            return false;
        }
    }

    /**
     * Reorders timeline items
     * @param is_member_of_timeline
     * @param timelines
     */
    async reorder_timeline_items(is_member_of_timeline, timelines) {

        try {

            await this.DB(this.TABLE.timeline_item_records)
            .where({
                is_member_of_timeline: is_member_of_timeline,
                uuid: timelines.uuid
            })
            .update({
                order: timelines.order
            });

            LOGGER.module().info('INFO: [/exhibits/exhibit_timeline_record_tasks (reorder_timeline_items)] Timeline item reordered.');
            return true;


        } catch (error) {
            LOGGER.module().error('ERROR: [/exhibits/exhibit_timeline_record_tasks (reorder_timeline_items)] unable to reorder timeline item ' + error.message);
            return false;
        }
    }
};

module.exports = Exhibit_timeline_record_tasks;
