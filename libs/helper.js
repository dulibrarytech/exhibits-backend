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
                        await this.unlock_record(uid.trim(), uuid.trim(), db, table);
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
                    await this.unlock_record(uid.trim(), uuid.trim(), db, table);
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
    async unlock_record(uid, uuid, db, table, options = {}) {

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
            console.log('USER ', record.locked_by_user);
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
     * order exhibits
     * @param uuid
     * @param db
     * @param tables
     */
    async order_exhibits(uuid, db, tables) {

        try {

            let exhibit_order = await db(tables.exhibit_records).select('order');
            return this.order_items(exhibit_order);

        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_exhibits)] unable to order exhibits ' + error.message);
            return false;
        }
    }

    /**
     * Orders exhibit items
     * @param uuid
     * @param db
     * @param tables
     */
    async order_exhibit_items(uuid, db, tables) {

        try {

            let heading_order;
            let item_order;
            let grid_order;
            let timeline_order;

            heading_order = await db(tables.heading_records).select('order').where('is_member_of_exhibit', uuid);
            item_order = await db(tables.item_records).select('order').where('is_member_of_exhibit', uuid);
            grid_order = await db(tables.grid_records).select('order').where('is_member_of_exhibit', uuid);
            timeline_order = await db(tables.timeline_records).select('order').where('is_member_of_exhibit', uuid);

            const merged = [...heading_order, ...item_order, ...grid_order, ...timeline_order];

            return this.order_items(merged);

        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_exhibit_items)] unable to order items ' + error.message);
            return false;
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

            const item_order = await db(tables.grid_item_records).select('order').where('is_member_of_grid', uuid);
            return this.order_items(item_order);

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

            const item_order = await db(tables.timeline_item_records).select('order').where('is_member_of_timeline', uuid);
            return this.order_items(item_order);

        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_timeline_items)] unable to order items ' + error.message);
            return false;
        }
    }

    /**
     * order items
     * @param item_order
     */
    order_items(item_order) {

        try {

            let order = [];

            if (item_order.length === 0) {
                return 1;
            }

            for (let i = 0; i < item_order.length; i++) {
                order.push(item_order[i].order);
            }

            const ordered = order.sort((a, b) => {
                return a - b;
            });

            const order_number = ordered.pop();

            return order_number + 1;

        } catch (error) {
            LOGGER.module().error('ERROR: [/libs/helper (order_items)] unable to order items ' + error.message);
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
    };
};

module.exports = Helper;
