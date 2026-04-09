/**

 Copyright 2026 University of Denver

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

/**
 * Base class providing shared validation, logging, and common database operations
 * for all exhibit task classes.
 *
 * @param DB - Knex database instance
 * @param TABLE - Table name configuration object
 */
const Base_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
        this.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        this.QUERY_TIMEOUT = 10000;
    }

    // ==================== VALIDATION HELPERS ====================

    /**
     * Validates that database connection is available
     * @private
     */
    _validate_database() {
        if (!this.DB || typeof this.DB !== 'function') {
            throw new Error('Database connection is not available');
        }
    }

    /**
     * Validates that a specific table exists in config
     * @param {string} table_name - Name of the table key to validate
     * @private
     */
    _validate_table(table_name) {
        if (!this.TABLE?.[table_name]) {
            throw new Error(`Table name "${table_name}" is not defined`);
        }
    }

    /**
     * Validates a UUID string
     * @param {string} uuid - UUID to validate
     * @param {string} field_name - Name of the field for error message
     * @returns {string} Trimmed UUID
     * @private
     */
    _validate_uuid(uuid, field_name = 'UUID') {
        if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
            throw new Error(`Valid ${field_name} is required`);
        }

        const trimmed_uuid = uuid.trim();

        if (!this.UUID_REGEX.test(trimmed_uuid)) {
            throw new Error(`Invalid ${field_name} format`);
        }

        return trimmed_uuid;
    }

    /**
     * Validates multiple UUIDs at once
     * @param {Object} uuid_map - Object with uuid_value: field_name pairs
     * @returns {Object} Object with validated and trimmed UUIDs
     * @private
     */
    _validate_uuids(uuid_map) {
        const validated = {};
        for (const [value, name] of Object.entries(uuid_map)) {
            validated[name] = this._validate_uuid(value, name);
        }
        return validated;
    }

    /**
     * Validates a required string field
     * @param {string} value - Value to validate
     * @param {string} field_name - Name of the field for error message
     * @returns {string} Trimmed value
     * @private
     */
    _validate_string(value, field_name) {
        if (!value || typeof value !== 'string' || !value.trim()) {
            throw new Error(`Valid ${field_name} is required`);
        }
        return value.trim();
    }

    /**
     * Validates a data object
     * @param {Object} data - Data object to validate
     * @private
     */
    _validate_data_object(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Data must be a valid object');
        }

        if (Object.keys(data).length === 0) {
            throw new Error('Data object cannot be empty');
        }
    }

    /**
     * Sanitizes data against a whitelist of allowed fields
     * @param {Object} data - Data to sanitize
     * @param {Array<string>} allowed_fields - Whitelist of allowed fields
     * @param {Array<string>} skip_fields - Fields to skip during sanitization
     * @returns {Object} Sanitized data and invalid fields
     * @private
     */
    _sanitize_data(data, allowed_fields, skip_fields = []) {
        const sanitized_data = {};
        const invalid_fields = [];

        for (const [key, value] of Object.entries(data)) {
            if (skip_fields.includes(key)) {
                continue;
            }

            // Security: prevent prototype pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                LOGGER.module().warn('Dangerous property skipped', {key});
                continue;
            }

            if (allowed_fields.includes(key)) {
                sanitized_data[key] = value;
            } else {
                invalid_fields.push(key);
            }
        }

        if (invalid_fields.length > 0) {
            LOGGER.module().warn('Invalid fields ignored', {
                fields: invalid_fields
            });
        }

        return {sanitized_data, invalid_fields};
    }

    // ==================== LOGGING HELPERS ====================

    /**
     * Handles error logging and re-throwing
     * @param {Error} error - Error to handle
     * @param {string} method_name - Name of the method where error occurred
     * @param {Object} context - Additional context for logging
     * @private
     */
    _handle_error(error, method_name, context = {}) {
        const error_context = {
            method: method_name,
            ...context,
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack
        };

        LOGGER.module().error(
            `Failed to ${method_name.replace(/_/g, ' ')}`,
            error_context
        );

        throw error;
    }

    /**
     * Logs successful operation
     * @param {string} message - Success message
     * @param {Object} context - Context for logging
     * @private
     */
    _log_success(message, context = {}) {
        LOGGER.module().info(message, {
            ...context,
            timestamp: new Date().toISOString()
        });
    }

    // ==================== COMMON DATABASE OPERATIONS ====================

    /**
     * Wraps a query with timeout protection
     * @param {Promise} query_promise - The query promise
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Query result or timeout error
     * @private
     */
    async _with_timeout(query_promise, timeout = this.QUERY_TIMEOUT) {
        return Promise.race([
            query_promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Query timeout')), timeout)
            )
        ]);
    }

    /**
     * Generic update publish status for multiple records
     * @param {string} table_name - Table name
     * @param {Object} where_clause - Where conditions
     * @param {number} status - 0 or 1
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     * @private
     */
    async _update_publish_status(table_name, where_clause, status, updated_by = null) {
        this._validate_database();
        this._validate_table(table_name);

        if (![0, 1].includes(status)) {
            throw new Error('Status must be 0 or 1');
        }

        const update_data = {is_published: status};
        if (updated_by) {
            update_data.updated_by = updated_by;
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where(where_clause)
            .update(update_data)
            .timeout(this.QUERY_TIMEOUT);

        return {
            success: true,
            affected_rows,
            status: status === 1 ? 'published' : 'suppressed',
            message: `Records ${status === 1 ? 'published' : 'suppressed'} successfully`
        };
    }

    /**
     * Generic update single record publish status
     * @param {string} table_name - Table name
     * @param {string} uuid - Record UUID
     * @param {number} status - 0 or 1
     * @param {string} [updated_by=null] - User ID
     * @returns {Promise<Object>} Update result
     * @private
     */
    async _update_single_publish_status(table_name, uuid, status, updated_by = null) {
        this._validate_database();
        this._validate_table(table_name);

        const uuid_trimmed = this._validate_uuid(uuid, `${table_name} UUID`);

        if (![0, 1].includes(status)) {
            throw new Error('Status must be 0 or 1');
        }

        const update_data = {is_published: status};
        if (updated_by) {
            update_data.updated_by = updated_by;
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({uuid: uuid_trimmed})
            .update(update_data)
            .timeout(this.QUERY_TIMEOUT);

        if (affected_rows === 0) {
            throw new Error(`No ${table_name} record found or updated`);
        }

        return {
            success: true,
            uuid: uuid_trimmed,
            affected_rows,
            updated_by,
            message: `${table_name} record ${status === 1 ? 'published' : 'suppressed'} successfully`
        };
    }

    /**
     * Generic reorder function
     * @param {string} table_name - Table name
     * @param {Object} where_clause - Where conditions
     * @param {Object} item - Item with uuid and order
     * @returns {Promise<Object>} Reorder result
     * @private
     */
    async _reorder_items(table_name, where_clause, item) {

        this._validate_database();
        this._validate_table(table_name);

        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error('Valid item object is required');
        }

        if (!item.uuid || typeof item.order !== 'number') {
            throw new Error('Item must have uuid and order properties');
        }

        const affected_rows = await this.DB(this.TABLE[table_name])
            .where({
                ...where_clause,
                uuid: item.uuid
            })
            .update({order: item.order})
            .timeout(this.QUERY_TIMEOUT);

        return {
            success: true,
            affected_rows,
            uuid: item.uuid,
            order: item.order,
            message: `${table_name} reordered successfully`
        };
    }
};

module.exports = Base_tasks;
