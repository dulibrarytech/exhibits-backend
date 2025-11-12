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

const FS = require('fs');
const {v4: uuidv4} = require('uuid');
const VALIDATOR = require('validator');
const LOGGER = require('../libs/log4');

/**
 * Object contains helper tasks
 * @type {Helper}
 */
const Helper = class {

    constructor() {
    }

    /**
     * Generates uuid
     * @returns Promise string
     */
    create_uuid() {

        try {
            return uuidv4();
        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (create_uuid)] unable to generate uuid ' + error.message);
            return false;
        }
    }

    /**
     * Locks a database record for a specific user with automatic unlock after timeout
     * @param {string} uid - User ID acquiring the lock
     * @param {string} uuid - Record UUID to lock
     * @param {Object} db - Database connection object
     * @param {string} table - Table name
     * @param {Object} [options={}] - Lock options
     * @param {number} [options.timeout_minutes=20] - Lock timeout in minutes
     * @returns {Promise<Object>} Lock information with timer ID
     * @throws {Error} If validation fails or lock fails
     */
    async lock_record(uid, uuid, db, table, options = {}) {

        const { timeout_minutes = 20 } = options;

        try {
            // ===== INPUT VALIDATION =====

            if (!uid || typeof uid !== 'string' || !uid.trim()) {
                throw new Error('Valid user ID is required');
            }

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!db || typeof db !== 'function') {
                throw new Error('Valid database connection is required');
            }

            if (!table || typeof table !== 'string' || !table.trim()) {
                throw new Error('Valid table name is required');
            }

            // Validate timeout
            if (typeof timeout_minutes !== 'number' || timeout_minutes <= 0) {
                throw new Error('Timeout must be a positive number');
            }

            // ===== CHECK RECORD EXISTS AND CURRENT LOCK STATUS =====

            const record = await Promise.race([
                db(table)
                    .select('uuid', 'is_locked', 'locked_by_user')
                    .where({ uuid: uuid.trim() })
                    .first(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 5000)
                )
            ]);

            if (!record) {
                throw new Error(`Record not found: ${uuid}`);
            }

            // Check if already locked by another user
            if (record.is_locked === 1 && record.locked_by_user !== uid.trim()) {
                throw new Error(
                    `Record is locked by another user: ${record.locked_by_user}`
                );
            }

            // Check if already locked by this user
            if (record.is_locked === 1 && record.locked_by_user === uid.trim()) {
                LOGGER.module().info('Record already locked by this user', {
                    uuid: uuid.trim(),
                    uid: uid.trim()
                });

                // Still set up auto-unlock for existing lock
                const timeout_ms = timeout_minutes * 60 * 1000;
                const timer_id = setTimeout(async () => {
                    try {
                        await this.unlock_record(uid.trim(), uuid.trim(), db, table, {force: false});
                    } catch (unlock_error) {
                        LOGGER.module().error('Auto-unlock failed', {
                            uuid: uuid.trim(),
                            error: unlock_error.message
                        });
                    }
                }, timeout_ms);

                return {
                    uuid: uuid.trim(),
                    locked_by: uid.trim(),
                    locked_at: new Date(),
                    timeout_minutes,
                    timer_id: timer_id,
                    already_locked: true
                };
            }

            // ===== PERFORM LOCK =====

            const lock_data = {
                is_locked: 1,
                locked_by_user: uid.trim(),
                locked_at: db.fn.now(),
                updated: db.fn.now()
            };

            const update_count = await Promise.race([
                db(table)
                    .where({ uuid: uuid.trim() })
                    .update(lock_data),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Update timeout')), 10000)
                )
            ]);

            // Verify lock succeeded
            if (update_count === 0) {
                throw new Error('Lock failed: No rows affected');
            }

            LOGGER.module().info('Record locked successfully', {
                uuid: uuid.trim(),
                uid: uid.trim(),
                timeout_minutes,
                timestamp: new Date().toISOString()
            });

            // ===== SET UP AUTO-UNLOCK =====

            const timeout_ms = timeout_minutes * 60 * 1000;
            const timer_id = setTimeout(async () => {
                try {
                    await this.unlock_record(uid.trim(), uuid.trim(), db, table, {force: false});
                    LOGGER.module().info('Record auto-unlocked after timeout', {
                        uuid: uuid.trim(),
                        uid: uid.trim(),
                        timeout_minutes
                    });
                } catch (unlock_error) {
                    LOGGER.module().error('Auto-unlock failed', {
                        uuid: uuid.trim(),
                        uid: uid.trim(),
                        error: unlock_error.message
                    });
                }
            }, timeout_ms);

            // Return lock information with timer reference
            return {
                uuid: uuid.trim(),
                locked_by: uid.trim(),
                locked_at: new Date(),
                timeout_minutes,
                timer_id: timer_id,
                already_locked: false
            };

        } catch (error) {
            const error_context = {
                method: 'lock_record',
                uid,
                uuid,
                table,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to lock record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Unlocks a database record
     * @param {string|number} uid - User ID releasing the lock
     * @param {string} uuid - Record UUID to unlock
     * @param {Object} db - Database connection object
     * @param {string} table - Table name
     * @param {Object} [options={}] - Unlock options
     * @param {boolean} [options.force=false] - Force unlock even if locked by another user
     * @returns {Promise<Object>} Updated record
     * @throws {Error} If validation fails or unlock fails
     */
    async unlock_record(uid, uuid, db, table, options) {

        const { force = false } = options;

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

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid UUID is required');
            }

            // Validate UUID format
            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid UUID format');
            }

            // ===== DATABASE VALIDATION =====

            if (!db || typeof db !== 'function') {
                throw new Error('Valid database connection is required');
            }

            if (!table || typeof table !== 'string' || !table.trim()) {
                throw new Error('Valid table name is required');
            }

            // ===== CHECK RECORD EXISTS AND LOCK STATUS =====

            const record = await Promise.race([
                db(table)
                    .select('uuid', 'is_locked', 'locked_by_user')
                    .where({ uuid: uuid.trim() })
                    .first(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Query timeout')), 5000)
                )
            ]);

            if (!record) {
                throw new Error(`Record not found: ${uuid}`);
            }

            // Check if already unlocked
            if (record.is_locked === 0) {
                LOGGER.module().info('Record already unlocked', {
                    uuid: uuid.trim()
                });
                return record;
            }

            // Convert locked_by_user to number for comparison
            const locked_by_number = Number(record.locked_by_user);

            // Check if locked by another user (and not forcing)
            if (!force && locked_by_number !== uid_number) {
                throw new Error(
                    `Record is locked by another user: ${record.locked_by_user}. ` +
                    `Cannot unlock unless force=true`
                );
            }

            // Warn if force unlocking another user's lock
            if (force && locked_by_number !== uid_number) {
                LOGGER.module().warn('Force unlocking record locked by another user', {
                    uuid: uuid.trim(),
                    locked_by: record.locked_by_user,
                    unlocked_by: uid_number
                });
            }

            // ===== PERFORM UNLOCK =====

            const unlock_data = {
                is_locked: 0,
                locked_by_user: null,
                locked_at: null,
                updated: db.fn.now()
            };

            const update_count = await Promise.race([
                db(table)
                    .where({ uuid: uuid.trim() })
                    .update(unlock_data),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Update timeout')), 10000)
                )
            ]);

            // Verify unlock succeeded
            if (update_count === 0) {
                throw new Error('Unlock failed: No rows affected');
            }

            LOGGER.module().info('Record unlocked successfully', {
                uuid: uuid.trim(),
                uid: uid_number,
                forced: force,
                timestamp: new Date().toISOString()
            });

            // Return updated record
            return await db(table)
                .where({ uuid: uuid.trim() })
                .first();

        } catch (error) {
            const error_context = {
                method: 'unlock_record',
                uid,
                uuid,
                table,
                force,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Failed to unlock record',
                error_context
            );

            throw error;
        }
    }

    /**
     * Validates and sanitizes configuration object
     * @param {Object} config - Configuration object to validate
     * @returns {Object} Sanitized configuration object
     * @throws {Error} If validation fails or required fields are missing
     */
    check_config(config) {

        try {
            // ===== INPUT VALIDATION =====

            if (!config || typeof config !== 'object' || Array.isArray(config)) {
                throw new Error('Config must be a valid object');
            }

            if (Object.keys(config).length === 0) {
                throw new Error('Config object cannot be empty');
            }

            // ===== SANITIZE AND VALIDATE =====

            const sanitized_config = {};
            const missing_fields = [];
            const invalid_fields = [];

            for (const [key, value] of Object.entries(config)) {
                // Prevent prototype pollution
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    LOGGER.module().warn('Skipping dangerous property', { key });
                    continue;
                }

                // Handle string values
                if (typeof value === 'string') {
                    const trimmed_value = VALIDATOR.trim(value);

                    // Check for empty strings
                    if (trimmed_value.length === 0) {
                        LOGGER.module().error(`Missing config value for: ${key}`);
                        missing_fields.push(key);
                        continue;
                    }

                    // Handle URLs - encode if valid URL
                    if (VALIDATOR.isURL(trimmed_value)) {
                        sanitized_config[key] = encodeURI(trimmed_value);
                    } else {
                        sanitized_config[key] = trimmed_value;
                    }
                }
                // Handle non-string values
                else if (value !== null && value !== undefined) {
                    sanitized_config[key] = value;
                }
                // Handle null/undefined
                else {
                    LOGGER.module().warn(`Config value is null/undefined for: ${key}`);
                    invalid_fields.push(key);
                }
            }

            // ===== VALIDATION RESULTS =====

            if (missing_fields.length > 0) {
                throw new Error(
                    `Missing config values for: ${missing_fields.join(', ')}`
                );
            }

            if (invalid_fields.length > 0) {
                LOGGER.module().warn('Config has null/undefined values', {
                    fields: invalid_fields
                });
            }

            LOGGER.module().info('Config validated successfully', {
                fields_count: Object.keys(sanitized_config).length
            });

            return sanitized_config;

        } catch (error) {
            const error_context = {
                method: 'check_config',
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error(
                'Config validation failed',
                error_context
            );

            throw error;
        }
    }

    /**
     * Gets the next order number for a new exhibit item
     * Finds the highest order number across all content types and returns next number
     * @param {string} uuid - The exhibit UUID
     * @param {Object} db - Database connection instance
     * @param {Object} tables - Table names object
     * @returns {Promise<number>} Next available order number
     * @throws {Error} If validation fails or query fails
     */
    async order_exhibit_items(uuid, db, tables) {

        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!db || typeof db !== 'function') {
                throw new Error('Valid database connection is required');
            }

            if (!tables || typeof tables !== 'object') {
                throw new Error('Valid tables object is required');
            }

            // Validate required tables exist
            const required_tables = ['heading_records', 'item_records', 'grid_records', 'timeline_records'];
            for (const table_name of required_tables) {
                if (!tables[table_name]) {
                    throw new Error(`Table "${table_name}" is not defined`);
                }
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            const exhibit_uuid = uuid.trim();

            // ===== QUERY ALL CONTENT ITEMS IN PARALLEL =====

            const where_clause = {
                is_member_of_exhibit: exhibit_uuid,
                is_deleted: 0
            };

            const [heading_order, item_order, grid_order, timeline_order] = await Promise.all([
                db(tables.heading_records)
                    .select('order')
                    .where(where_clause)
                    .timeout(10000),

                db(tables.item_records)
                    .select('order')
                    .where(where_clause)
                    .timeout(10000),

                db(tables.grid_records)
                    .select('order')
                    .where(where_clause)
                    .timeout(10000),

                db(tables.timeline_records)
                    .select('order')
                    .where(where_clause)
                    .timeout(10000)
            ]);

            // ===== MERGE ALL ORDERS =====

            const merged = [...heading_order, ...item_order, ...grid_order, ...timeline_order];

            // ===== GET NEXT ORDER NUMBER =====

            const next_order = this.get_next_order_number(merged);

            LOGGER.module().info('Next order number calculated', {
                exhibit_uuid,
                total_items: merged.length,
                next_order,
                timestamp: new Date().toISOString()
            });

            return next_order;

        } catch (error) {
            const error_context = {
                method: 'order_exhibit_items',
                exhibit_uuid: uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error('Failed to calculate next order number', error_context);
            throw error;
        }
    }

    /**
     * Gets the next order number from an array of items
     * @param {Array<Object>} items - Array of items with order property
     * @returns {number} Next order number (highest + 1, or 1 if empty)
     */
    get_next_order_number(items) {

        try {
            if (!Array.isArray(items)) {
                throw new Error('items must be an array');
            }

            if (items.length === 0) {
                return 1;
            }

            const order_numbers = items
                .map(item => typeof item.order === 'number' ? item.order : 0)
                .filter(order => order >= 0);

            if (order_numbers.length === 0) {
                return 1;
            }

            const highest_order = Math.max(...order_numbers);
            return highest_order + 1;

        } catch (error) {
            LOGGER.module().error('Failed to get next order', {
                error: error.message
            });
            return 1;
        }
    }

    /**
     * Orders grid items
     * @param uuid
     * @param db
     * @param tables
     */
    async order_grid_items(uuid, db, tables) {

        try {

            const item_order = await db(tables.grid_item_records).select('order').where('is_member_of_grid', uuid).andWhere('is_deleted', 0);
            return this.get_next_order_number(item_order);

        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_grid_items)] unable to order items ' + error.message);
            return false;
        }
    }

    /**
     * Orders timeline items
     * @param uuid
     * @param db
     * @param tables
     */
    async order_timeline_items(uuid, db, tables) {

        try {

            const item_order = await db(tables.timeline_item_records).select('order').where('is_member_of_timeline', uuid).andWhere('is_deleted', 0);
            return this.get_next_order_number(item_order);

        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_timeline_items)] unable to order items ' + error.message);
            return false;
        }
    }

    /**
     * Gets all exhibit content items (headings, items, grids, timelines) with normalized order
     * Removes gaps in order sequence and reorders from 1
     * @param {string} uuid - The exhibit UUID
     * @param {Object} db - Database connection instance
     * @param {Object} tables - Table names object
     * @returns {Promise<Array<Object>>} Reordered items array with type, uuid, and order
     * @throws {Error} If validation fails or query fails
     */
    async reorder(uuid, db, tables) {

        try {
            // ===== INPUT VALIDATION =====

            if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
                throw new Error('Valid exhibit UUID is required');
            }

            if (!db || typeof db !== 'function') {
                throw new Error('Valid database connection is required');
            }

            if (!tables || typeof tables !== 'object') {
                throw new Error('Valid tables object is required');
            }

            // Validate required tables exist
            const required_tables = ['heading_records', 'item_records', 'grid_records', 'timeline_records'];
            for (const table_name of required_tables) {
                if (!tables[table_name]) {
                    throw new Error(`Table "${table_name}" is not defined`);
                }
            }

            // ===== UUID VALIDATION =====

            const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid_regex.test(uuid.trim())) {
                throw new Error('Invalid exhibit UUID format');
            }

            const exhibit_uuid = uuid.trim();

            // ===== QUERY ALL CONTENT ITEMS =====

            const where_clause = {
                is_member_of_exhibit: exhibit_uuid,
                is_deleted: 0
            };

            // Query each table with type identifier
            const [heading_order, item_order, grid_order, timeline_order] = await Promise.all([
                db(tables.heading_records)
                    .select('uuid', 'order')
                    .where(where_clause)
                    .timeout(10000)
                    .then(results => results.map(item => ({ ...item, type: 'heading' }))),

                db(tables.item_records)
                    .select('uuid', 'order')
                    .where(where_clause)
                    .timeout(10000)
                    .then(results => results.map(item => ({ ...item, type: 'item' }))),

                db(tables.grid_records)
                    .select('uuid', 'order')
                    .where(where_clause)
                    .timeout(10000)
                    .then(results => results.map(item => ({ ...item, type: 'grid' }))),

                db(tables.timeline_records)
                    .select('uuid', 'order')
                    .where(where_clause)
                    .timeout(10000)
                    .then(results => results.map(item => ({ ...item, type: 'timeline' })))
            ]);

            // ===== COMBINE ALL ITEMS =====

            const all_items = [...heading_order, ...item_order, ...grid_order, ...timeline_order];

            // ===== HANDLE EMPTY RESULT =====

            if (all_items.length === 0) {
                LOGGER.module().info('No items found to reorder', {
                    exhibit_uuid
                });
                return [];
            }

            // ===== SORT BY CURRENT ORDER =====

            const sorted_items = all_items.sort((a, b) => {
                const order_a = typeof a.order === 'number' ? a.order : 0;
                const order_b = typeof b.order === 'number' ? b.order : 0;
                return order_a - order_b;
            });

            // ===== REORDER SEQUENTIALLY FROM 1 =====

            const reordered_items = sorted_items.map((item, index) => {
                return {
                    uuid: item.uuid,
                    type: item.type,
                    old_order: item.order,
                    new_order: index + 1
                };
            });

            // ===== LOG SUMMARY =====

            const counts_by_type = {
                heading: reordered_items.filter(i => i.type === 'heading').length,
                item: reordered_items.filter(i => i.type === 'item').length,
                grid: reordered_items.filter(i => i.type === 'grid').length,
                timeline: reordered_items.filter(i => i.type === 'timeline').length
            };

            LOGGER.module().info('Items reordered successfully', {
                exhibit_uuid,
                total_items: reordered_items.length,
                counts_by_type,
                timestamp: new Date().toISOString()
            });

            return reordered_items;

        } catch (error) {
            const error_context = {
                method: 'reorder',
                exhibit_uuid: uuid,
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            };

            LOGGER.module().error('Failed to reorder items', error_context);
            throw error;
        }
    }

    /**
     * Applies reordered items back to the database
     * @param {string} uuid - Exhibit UUID
     * @param {Array<Object>} reordered_items - Items with type, uuid, new_order
     * @param {Object} db - Database connection
     * @param {Object} tables - Table names object
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     */
    async apply_reorder(uuid, reordered_items, db, tables, updated_by = null) {

        try {

            if (!Array.isArray(reordered_items) || reordered_items.length === 0) {
                return {
                    success: true,
                    updated_count: 0,
                    message: 'No items to update'
                };
            }

            if (!db || !tables) {
                throw new Error('Valid database connection and tables required');
            }

            // Group items by type
            const items_by_type = {
                heading: reordered_items.filter(i => i.type === 'heading'),
                item: reordered_items.filter(i => i.type === 'item'),
                grid: reordered_items.filter(i => i.type === 'grid'),
                timeline: reordered_items.filter(i => i.type === 'timeline')
            };

            const type_to_table = {
                heading: tables.heading_records,
                item: tables.item_records,
                grid: tables.grid_records,
                timeline: tables.timeline_records
            };

            let total_updated = 0;

            // Update in transaction
            await db.transaction(async (trx) => {
                for (const [type, items] of Object.entries(items_by_type)) {
                    if (items.length === 0) continue;

                    const table = type_to_table[type];

                    for (const item of items) {
                        // Only update if order changed
                        if (item.old_order !== item.new_order) {
                            const update_data = {
                                order: item.new_order,
                                updated: trx.fn.now()
                            };

                            if (updated_by) {
                                update_data.updated_by = updated_by;
                            }

                            await trx(table)
                                .where({
                                    uuid: item.uuid,
                                    is_member_of_exhibit: uuid,
                                    is_deleted: 0
                                })
                                .update(update_data);

                            total_updated++;
                        }
                    }
                }
            });

            LOGGER.module().info('Reorder applied to database', {
                exhibit_uuid: uuid,
                total_items: reordered_items.length,
                updated_count: total_updated,
                updated_by
            });

            return {
                success: true,
                total_items: reordered_items.length,
                updated_count: total_updated,
                message: `Updated ${total_updated} item(s)`
            };

        } catch (error) {
            LOGGER.module().error('Failed to apply reorder', {
                exhibit_uuid: uuid,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Checks if item order has gaps
     * @param {Array<Object>} item_order - Array of items with order property
     * @returns {boolean} True if there are gaps in the order sequence
     */
    has_order_gaps(item_order) {

        try {
            if (!Array.isArray(item_order) || item_order.length === 0) {
                return false;
            }

            const order_numbers = item_order
                .map(item => typeof item.order === 'number' ? item.order : 0)
                .sort((a, b) => a - b);

            for (let i = 0; i < order_numbers.length; i++) {
                const expected_order = i + 1;
                if (order_numbers[i] !== expected_order) {
                    return true;
                }
            }

            return false;

        } catch (error) {
            LOGGER.module().error('Failed to check order gaps', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Checks if storage path for exhibit exists
     * @param uuid
     * @param path
     */
    check_storage_path(uuid, path) {

        try {

            if (!FS.existsSync(`${path}/${uuid}`)) {
                FS.mkdirSync(`${path}/${uuid}`);
                LOGGER.module().info('INFO: [/libs/helper (check_storage_path)] Storage path for exhibit ' + uuid + ' created.');
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (check_storage_path)] Error occurred while checking storage path ' + error.message);
        }
    }

    /**
     * Renames and moves uploaded image
     * @param exhibit_id
     * @param item_id
     * @param media
     * @param path
     */
    process_uploaded_media(exhibit_id, item_id, media, path) {

        let storage_path;
        let media_file;

        if (item_id !== null) {
            storage_path = `${exhibit_id}/${item_id}_${media}`;
            media_file = `${item_id}_${media}`;
        } else {
            storage_path = `${exhibit_id}/${exhibit_id}_${media}`;
            media_file = `${exhibit_id}_${media}`;
        }

        FS.rename(`${path}/${media}`, `${path}/${storage_path}`, (error) => {
            if (error) {
                LOGGER.module().error('ERROR: [/libs/helper (process_media)] Error occurred while processing media ' + error);
            }
        });

        return `${media_file}`;
    }

    /**
     * Converts byte size to human readable format
     * @param bytes
     * @param decimals
     * @return {string|{batch_size: number, size_type: string}}
     */
    format_bytes(bytes, decimals = 2) {

        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return {
            size_type: sizes[i],
            batch_size: parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
        };
    }

    /** TODO: deprecate - exhibits are no longer reordered
     * order exhibits
     * @param uuid
     * @param db
     * @param tables
     */
    /*
    async order_exhibits(uuid, db, tables) {

        try {

            let exhibit_order = await db(tables.exhibit_records).select('order').andWhere('is_deleted', 0);
            return this.get_next_order_number(exhibit_order);

        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_exhibits)] unable to order exhibits ' + error.message);
            return false;
        }
    }
    */
};

module.exports = Helper;
