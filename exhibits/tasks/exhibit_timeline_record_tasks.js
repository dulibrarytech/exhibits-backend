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
     * Gets all timeline item records by exhibit and timeline
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_timeline - The timeline UUID
     * @returns {Promise<Array>} Array of timeline item records
     * @throws {Error} If validation fails or query fails
     */
    async get_timeline_item_records(is_member_of_exhibit, is_member_of_timeline) {
        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!is_member_of_timeline || typeof is_member_of_timeline !== 'string' || !is_member_of_timeline.trim()) {
                throw new Error('Valid timeline UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(is_member_of_timeline.trim())) {
                throw new Error('Invalid timeline UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.timeline_item_records) {
                throw new Error('Table name "timeline_item_records" is not defined');
            }

            // ===== QUERY TIMELINE ITEM RECORDS =====

            const timeline_items = await this.DB(this.TABLE.timeline_item_records)
                .select(
                    'id',
                    'uuid',
                    'is_member_of_timeline',
                    'is_member_of_exhibit',
                    'repo_uuid',
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
                    'styles',
                    'order',
                    'date',
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
                )
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_member_of_timeline: is_member_of_timeline.trim(),
                    is_deleted: 0
                })
                .orderBy('order', 'asc')
                .timeout(10000);

            LOGGER.module().info('Timeline item records retrieved successfully', {
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                is_member_of_timeline: is_member_of_timeline.trim(),
                count: timeline_items.length,
                timestamp: new Date().toISOString()
            });

            return timeline_items;

        } catch (error) {
            const error_context = {
                method: 'get_timeline_item_records',
                is_member_of_exhibit,
                is_member_of_timeline,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get timeline item records',
                error_context
            );

            throw error;
        }
    }

    /**
     * Creates a new timeline item record in the database
     * @param {Object} data - Timeline item record data
     * @param {string} data.uuid - Timeline item UUID (required)
     * @param {string} data.is_member_of_timeline - Timeline UUID (required)
     * @param {string} data.is_member_of_exhibit - Exhibit UUID (required)
     * @param {string} data.title - Timeline item title (required)
     * @param {string} [created_by=null] - User ID creating the record
     * @returns {Promise<Object>} Created timeline item record with ID
     * @throws {Error} If validation fails or creation fails
     */
    async create_timeline_item_record(data, created_by = null) {

        // Define whitelist of allowed fields based on tbl_timeline_items schema
        const ALLOWED_FIELDS = [
            'uuid',
            'is_member_of_timeline',
            'is_member_of_exhibit',
            'repo_uuid',
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
            'styles',
            'order',
            'date',
            'is_repo_item',
            'is_kaltura_item',
            'is_embedded',
            'is_published',
            'is_locked',
            'locked_by_user',
            'locked_at',
            'is_deleted',
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
                throw new Error('Valid timeline item UUID is required');
            }

            if (!data.is_member_of_timeline || typeof data.is_member_of_timeline !== 'string' || !data.is_member_of_timeline.trim()) {
                throw new Error('Valid timeline UUID is required');
            }

            if (!data.is_member_of_exhibit || typeof data.is_member_of_exhibit !== 'string' || !data.is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(data.uuid.trim())) {
                throw new Error('Invalid timeline item UUID format');
            }

            if (!uuid_regex.test(data.is_member_of_timeline.trim())) {
                throw new Error('Invalid timeline UUID format');
            }

            if (!uuid_regex.test(data.is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.timeline_item_records) {
                throw new Error('Table name "timeline_item_records" is not defined');
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

            // Set default values based on schema defaults
            if (!sanitized_data.item_type) {
                sanitized_data.item_type = 'image';
            }

            if (!sanitized_data.type) {
                sanitized_data.type = 'item';
            }

            if (!sanitized_data.layout) {
                sanitized_data.layout = 'media_top';
            }

            if (sanitized_data.wrap_text === undefined) {
                sanitized_data.wrap_text = 1;
            }

            if (sanitized_data.media_width === undefined) {
                sanitized_data.media_width = 50;
            }

            if (sanitized_data.media_padding === undefined) {
                sanitized_data.media_padding = 1;
            }

            if (sanitized_data.is_alt_text_decorative === undefined) {
                sanitized_data.is_alt_text_decorative = 0;
            }

            if (sanitized_data.pdf_open_to_page === undefined) {
                sanitized_data.pdf_open_to_page = 1;
            }

            if (sanitized_data.order === undefined) {
                sanitized_data.order = 0;
            }

            if (sanitized_data.is_repo_item === undefined) {
                sanitized_data.is_repo_item = 0;
            }

            if (sanitized_data.is_kaltura_item === undefined) {
                sanitized_data.is_kaltura_item = 0;
            }

            if (sanitized_data.is_embedded === undefined) {
                sanitized_data.is_embedded = 0;
            }

            if (sanitized_data.is_published === undefined) {
                sanitized_data.is_published = 0;
            }

            if (sanitized_data.is_locked === undefined) {
                sanitized_data.is_locked = 0;
            }

            if (sanitized_data.locked_by_user === undefined) {
                sanitized_data.locked_by_user = 0;
            }

            if (sanitized_data.is_deleted === undefined) {
                sanitized_data.is_deleted = 0;
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
                const [insert_id] = await trx(this.TABLE.timeline_item_records)
                    .insert(sanitized_data)
                    .timeout(10000);

                // Verify insert succeeded
                if (!insert_id) {
                    throw new Error('Insert failed: No ID returned');
                }

                // Fetch and return the created record
                const record = await trx(this.TABLE.timeline_item_records)
                    .select('*')
                    .where({ id: insert_id })
                    .first();

                if (!record) {
                    throw new Error('Failed to retrieve created record');
                }

                LOGGER.module().info('Timeline item record created successfully', {
                    id: insert_id,
                    uuid: record.uuid,
                    title: record.title,
                    is_member_of_timeline: record.is_member_of_timeline,
                    is_member_of_exhibit: record.is_member_of_exhibit,
                    item_type: record.item_type,
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
                message: 'Timeline item record created successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'create_timeline_item_record',
                uuid: data?.uuid,
                timeline_uuid: data?.is_member_of_timeline,
                exhibit_uuid: data?.is_member_of_exhibit,
                title: data?.title,
                data_keys: Object.keys(data || {}),
                created_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to create timeline item record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Create timeline item records
     * @param data
     */
    /*
    async create_timeline_item_record__(data) {

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
    */

    /**
     * Gets a single timeline item record by exhibit, timeline, and item UUID
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_timeline - The timeline UUID
     * @param {string} item_uuid - The timeline item UUID
     * @returns {Promise<Object|null>} Timeline item record or null if not found
     * @throws {Error} If validation fails or query fails
     */
    async get_timeline_item_record(is_member_of_exhibit, is_member_of_timeline, item_uuid) {
        try {
            // ===== INPUT VALIDATION =====

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!is_member_of_timeline || typeof is_member_of_timeline !== 'string' || !is_member_of_timeline.trim()) {
                throw new Error('Valid timeline UUID is required');
            }

            if (!item_uuid || typeof item_uuid !== 'string' || !item_uuid.trim()) {
                throw new Error('Valid timeline item UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(is_member_of_timeline.trim())) {
                throw new Error('Invalid timeline UUID format');
            }

            if (!uuid_regex.test(item_uuid.trim())) {
                throw new Error('Invalid timeline item UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.timeline_item_records) {
                throw new Error('Table name "timeline_item_records" is not defined');
            }

            // ===== QUERY TIMELINE ITEM RECORD =====

            const timeline_item = await this.DB(this.TABLE.timeline_item_records)
                .select(
                    'id',
                    'uuid',
                    'is_member_of_timeline',
                    'is_member_of_exhibit',
                    'repo_uuid',
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
                    'styles',
                    'order',
                    'date',
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
                )
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_member_of_timeline: is_member_of_timeline.trim(),
                    uuid: item_uuid.trim(),
                    is_deleted: 0
                })
                .first()
                .timeout(10000);

            if (!timeline_item) {
                LOGGER.module().info('Timeline item record not found', {
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_member_of_timeline: is_member_of_timeline.trim(),
                    item_uuid: item_uuid.trim()
                });
                return null;
            }

            LOGGER.module().info('Timeline item record retrieved successfully', {
                uuid: timeline_item.uuid,
                title: timeline_item.title,
                item_type: timeline_item.item_type,
                is_member_of_timeline: is_member_of_timeline.trim(),
                is_member_of_exhibit: is_member_of_exhibit.trim(),
                timestamp: new Date().toISOString()
            });

            return timeline_item;

        } catch (error) {
            const error_context = {
                method: 'get_timeline_item_record',
                is_member_of_exhibit,
                is_member_of_timeline,
                item_uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get timeline item record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets timeline item record
     * @param is_member_of_exhibit
     * @param timeline_id
     * @param item_id
     */
    /*
    async get_timeline_item_record__(is_member_of_exhibit, timeline_id, item_id) {

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
    */

    /**
     * Gets a timeline item record for editing and locks it for the user
     * @param {string} user_id - The user ID requesting edit access
     * @param {string} is_member_of_exhibit - The exhibit UUID
     * @param {string} is_member_of_timeline - The timeline UUID
     * @param {string} item_uuid - The timeline item UUID
     * @returns {Promise<Object>} Timeline item record with lock information
     * @throws {Error} If validation fails, item not found, or locked by another user
     */
    async get_timeline_item_edit_record(user_id, is_member_of_exhibit, is_member_of_timeline, item_uuid) {

        try {
            // ===== INPUT VALIDATION =====

            if (!user_id || typeof user_id !== 'string' || !user_id.trim()) {
                throw new Error('Valid user ID is required');
            }

            if (!is_member_of_exhibit || typeof is_member_of_exhibit !== 'string' || !is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!is_member_of_timeline || typeof is_member_of_timeline !== 'string' || !is_member_of_timeline.trim()) {
                throw new Error('Valid timeline UUID is required');
            }

            if (!item_uuid || typeof item_uuid !== 'string' || !item_uuid.trim()) {
                throw new Error('Valid timeline item UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            if (!uuid_regex.test(is_member_of_timeline.trim())) {
                throw new Error('Invalid timeline UUID format');
            }

            if (!uuid_regex.test(item_uuid.trim())) {
                throw new Error('Invalid timeline item UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.timeline_item_records) {
                throw new Error('Table name "timeline_item_records" is not defined');
            }

            // ===== GET TIMELINE ITEM RECORD =====

            const timeline_item = await this.DB(this.TABLE.timeline_item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_member_of_timeline: is_member_of_timeline.trim(),
                    uuid: item_uuid.trim(),
                    is_deleted: 0
                })
                .first()
                .timeout(10000);

            if (!timeline_item) {
                throw new Error('Timeline item record not found');
            }

            // ===== CHECK LOCK STATUS =====

            if (timeline_item.is_locked === 1) {
                // Check if locked by current user
                if (String(timeline_item.locked_by_user) === String(user_id.trim())) {
                    LOGGER.module().info('Timeline item already locked by current user', {
                        item_uuid: item_uuid.trim(),
                        user_id: user_id.trim(),
                        locked_at: timeline_item.locked_at
                    });

                    return {
                        success: true,
                        item: timeline_item,
                        already_locked_by_user: true,
                        message: 'Timeline item already locked by you'
                    };
                } else {
                    // Locked by another user
                    throw new Error(`Timeline item is locked by another user (ID: ${timeline_item.locked_by_user})`);
                }
            }

            // ===== LOCK THE RECORD =====

            const lock_result = await this.lock_timeline_item_record(
                item_uuid.trim(),
                user_id.trim()
            );

            if (!lock_result.success) {
                throw new Error('Failed to lock timeline item record');
            }

            // ===== REFETCH RECORD WITH LOCK INFO =====

            const locked_item = await this.DB(this.TABLE.timeline_item_records)
                .select('*')
                .where({
                    is_member_of_exhibit: is_member_of_exhibit.trim(),
                    is_member_of_timeline: is_member_of_timeline.trim(),
                    uuid: item_uuid.trim(),
                    is_deleted: 0
                })
                .first()
                .timeout(10000);

            LOGGER.module().info('Timeline item record retrieved and locked for editing', {
                item_uuid: item_uuid.trim(),
                title: locked_item.title,
                user_id: user_id.trim(),
                locked_at: locked_item.locked_at,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                item: locked_item,
                locked_by_user: true,
                message: 'Timeline item locked for editing'
            };

        } catch (error) {
            const error_context = {
                method: 'get_timeline_item_edit_record',
                user_id,
                is_member_of_exhibit,
                is_member_of_timeline,
                item_uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to get timeline item edit record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Locks a timeline item record for a specific user
     * @param {string} item_uuid - The timeline item UUID
     * @param {string} user_id - The user ID locking the record
     * @returns {Promise<Object>} Lock result
     * @throws {Error} If lock fails
     */
    async lock_timeline_item_record(item_uuid, user_id) {

        try {
            if (!item_uuid || !user_id) {
                throw new Error('Valid item UUID and user ID are required');
            }

            if (!this.DB || !this.TABLE?.timeline_item_records) {
                throw new Error('Database not configured');
            }

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
                    is_locked: 0  // Only lock if not already locked
                })
                .update(lock_data)
                .timeout(10000);

            if (affected_rows === 0) {
                throw new Error('Failed to lock record - may be locked by another user');
            }

            LOGGER.module().info('Timeline item record locked', {
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
            LOGGER.module().error('Failed to lock timeline item record', {
                item_uuid,
                user_id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Unlocks a timeline item record
     * @param {string} item_uuid - The timeline item UUID
     * @param {string} user_id - The user ID unlocking the record
     * @returns {Promise<Object>} Unlock result
     * @throws {Error} If unlock fails
     */
    /*
    async unlock_timeline_item_record(item_uuid, user_id) {
        try {
            if (!item_uuid || !user_id) {
                throw new Error('Valid item UUID and user ID are required');
            }

            if (!this.DB || !this.TABLE?.timeline_item_records) {
                throw new Error('Database not configured');
            }

            const unlock_data = {
                is_locked: 0,
                locked_by_user: 0,
                locked_at: null,
                updated: this.DB.fn.now(),
                updated_by: user_id.trim()
            };

            const affected_rows = await this.DB(this.TABLE.timeline_item_records)
                .where({
                    uuid: item_uuid.trim(),
                    is_deleted: 0,
                    locked_by_user: user_id.trim()  // Only unlock if locked by this user
                })
                .update(unlock_data)
                .timeout(10000);

            if (affected_rows === 0) {
                LOGGER.module().warn('Failed to unlock record - not locked by this user', {
                    item_uuid: item_uuid.trim(),
                    user_id: user_id.trim()
                });
                return {
                    success: false,
                    message: 'Record not locked by this user'
                };
            }

            LOGGER.module().info('Timeline item record unlocked', {
                item_uuid: item_uuid.trim(),
                user_id: user_id.trim()
            });

            return {
                success: true,
                item_uuid: item_uuid.trim(),
                message: 'Record unlocked successfully'
            };

        } catch (error) {
            LOGGER.module().error('Failed to unlock timeline item record', {
                item_uuid,
                user_id,
                error: error.message
            });
            throw error;
        }
    }
    */

    /*
    async get_timeline_item_edit_record__(uid, is_member_of_exhibit, timeline_id, item_id) {

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

     */

    /**
     * Updates a timeline item record in the database
     * @param {Object} data - Timeline item data to update
     * @param {string} data.uuid - Timeline item UUID (required)
     * @param {string} data.is_member_of_timeline - Timeline UUID (required)
     * @param {string} data.is_member_of_exhibit - Exhibit UUID (required)
     * @param {string} [updated_by=null] - User ID performing the update
     * @returns {Promise<Object>} Update result with affected rows
     * @throws {Error} If validation fails or update fails
     */
    async update_timeline_item_record(data, updated_by = null) {

        // Define whitelist of updatable fields based on tbl_timeline_items schema
        const UPDATABLE_FIELDS = [
            'repo_uuid',
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
            'styles',
            'order',
            'date',
            'is_repo_item',
            'is_kaltura_item',
            'is_embedded',
            'is_published',
            'is_locked',
            'locked_by_user',
            'locked_at',
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
                throw new Error('Valid timeline item UUID is required');
            }

            if (!data.is_member_of_timeline || typeof data.is_member_of_timeline !== 'string' || !data.is_member_of_timeline.trim()) {
                throw new Error('Valid timeline UUID is required');
            }

            if (!data.is_member_of_exhibit || typeof data.is_member_of_exhibit !== 'string' || !data.is_member_of_exhibit.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (!uuid_regex.test(data.uuid.trim())) {
                throw new Error('Invalid timeline item UUID format');
            }

            if (!uuid_regex.test(data.is_member_of_timeline.trim())) {
                throw new Error('Invalid timeline UUID format');
            }

            if (!uuid_regex.test(data.is_member_of_exhibit.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!this.DB || typeof this.DB !== 'function') {
                throw new Error('Database connection is not available');
            }

            if (!this.TABLE?.timeline_item_records) {
                throw new Error('Table name "timeline_item_records" is not defined');
            }

            // ===== SANITIZE UPDATE DATA =====

            const update_data = {};
            const invalid_fields = [];

            for (const [key, value] of Object.entries(data)) {
                // Skip identifier fields
                if (key === 'uuid' || key === 'is_member_of_timeline' || key === 'is_member_of_exhibit') {
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

            const existing_record = await this.DB(this.TABLE.timeline_item_records)
                .select('id', 'uuid', 'title', 'is_deleted', 'is_locked', 'locked_by_user')
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                    is_member_of_timeline: data.is_member_of_timeline.trim(),
                    uuid: data.uuid.trim()
                })
                .first()
                .timeout(10000);

            if (!existing_record) {
                throw new Error('Timeline item record not found');
            }

            if (existing_record.is_deleted === 1) {
                throw new Error('Cannot update deleted timeline item record');
            }

            // Optional: Check if locked by another user
            if (existing_record.is_locked === 1 && updated_by) {
                if (String(existing_record.locked_by_user) !== String(updated_by)) {
                    LOGGER.module().warn('Attempting to update locked record', {
                        uuid: data.uuid.trim(),
                        locked_by: existing_record.locked_by_user,
                        attempted_by: updated_by
                    });
                    // You can choose to throw an error here or just warn
                    // throw new Error('Timeline item is locked by another user');
                }
            }

            // ===== PERFORM UPDATE =====

            const affected_rows = await this.DB(this.TABLE.timeline_item_records)
                .where({
                    is_member_of_exhibit: data.is_member_of_exhibit.trim(),
                    is_member_of_timeline: data.is_member_of_timeline.trim(),
                    uuid: data.uuid.trim(),
                    is_deleted: 0
                })
                .update(update_data)
                .timeout(10000);

            if (affected_rows === 0) {
                throw new Error('Update failed: No rows affected');
            }

            // ===== LOG SUCCESS =====

            LOGGER.module().info('Timeline item record updated successfully', {
                uuid: data.uuid.trim(),
                is_member_of_timeline: data.is_member_of_timeline.trim(),
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
                message: 'Timeline item record updated successfully'
            };

        } catch (error) {
            const error_context = {
                method: 'update_timeline_item_record',
                uuid: data?.uuid,
                timeline_uuid: data?.is_member_of_timeline,
                exhibit_uuid: data?.is_member_of_exhibit,
                data_keys: Object.keys(data || {}),
                updated_by,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to update timeline item record',
                error_context
            );

            throw error;
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
