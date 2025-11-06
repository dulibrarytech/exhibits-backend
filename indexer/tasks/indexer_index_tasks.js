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

/**
 * Object contains tasks used to index record(s) in Elasticsearch
 * @param {Object} DB - Knex database instance
 * @param {string} TABLE - Database table name
 * @param {Object} CLIENT - Elasticsearch client instance
 * @param {string} INDEX - Elasticsearch index name
 * @type {Indexer_index_tasks}
 */
const Indexer_index_tasks = class {

    constructor(CLIENT, INDEX) {
        this.CLIENT = CLIENT;
        this.INDEX = INDEX;

        // Configuration constants
        this.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        this.INDEX_TIMEOUT = 30000; // 30 seconds for index operations
        this.GET_TIMEOUT = 10000;    // 10 seconds for get operations

        // Validate dependencies on construction
        this._validate_dependencies();

        // Log initialization (replaced console.log)
        LOGGER.module().info('Indexer initialized', {
            index: this.INDEX
        });
    }

    // ==================== VALIDATION HELPERS ====================

    /**
     * Validates constructor dependencies
     * @private
     */
    _validate_dependencies() {

        if (!this.CLIENT) {
            throw new Error('Valid Elasticsearch client is required');
        }

        if (!this.INDEX || typeof this.INDEX !== 'string') {
            throw new Error('Valid index name is required');
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
            throw new Error(`Invalid ${field_name} format: ${trimmed_uuid}`);
        }

        return trimmed_uuid;
    }

    /**
     * Validates a record object
     * @param {Object} record - Record to validate
     * @private
     */
    _validate_record(record) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            throw new Error('Record must be a valid object');
        }

        if (!record.uuid || typeof record.uuid !== 'string' || !record.uuid.trim()) {
            throw new Error('Record must have a valid UUID');
        }
    }

    /**
     * Sanitizes a record for indexing by creating a deep copy and removing dangerous properties
     * @param {Object} record - Record to sanitize
     * @returns {Object} Sanitized record
     * @private
     */
    _sanitize_record(record) {
        // Create deep copy to avoid mutation
        let sanitized;

        try {
            sanitized = JSON.parse(JSON.stringify(record));
        } catch (json_error) {
            throw new Error(`Record contains non-serializable data: ${json_error.message}`);
        }

        // Remove prototype pollution vectors
        const dangerous_keys = ['__proto__', 'constructor', 'prototype'];

        const remove_dangerous_keys = (obj) => {
            if (!obj || typeof obj !== 'object') {
                return;
            }

            for (const key of dangerous_keys) {
                delete obj[key];
            }

            // Recursively sanitize nested objects
            for (const key in obj) {
                if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && obj[key] !== null) {
                    remove_dangerous_keys(obj[key]);
                }
            }
        };

        remove_dangerous_keys(sanitized);

        return sanitized;
    }

    /**
     * Wraps an Elasticsearch operation with timeout protection
     * @param {Promise} operation - Elasticsearch operation promise
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Operation result or timeout error
     * @private
     */
    async _with_timeout(operation, timeout) {
        return Promise.race([
            operation,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Elasticsearch operation timeout')), timeout)
            )
        ]);
    }

    /**
     * Handles error logging with context
     * @param {Error} error - Error to handle
     * @param {string} method_name - Name of the method where error occurred
     * @param {Object} context - Additional context for logging
     * @private
     */
    _handle_error(error, method_name, context = {}) {
        const error_context = {
            method: method_name,
            index: this.INDEX,
            ...context,
            timestamp: new Date().toISOString(),
            message: error.message,
            error_type: error.name
        };

        // Extract Elasticsearch-specific error details
        if (error.meta) {
            error_context.status_code = error.meta.statusCode;
            error_context.elasticsearch_error = error.meta.body?.error?.type;
            error_context.reason = error.meta.body?.error?.reason;
        }

        // Add stack trace in non-production environments
        if (process.env.NODE_ENV !== 'production') {
            error_context.stack = error.stack;
        }

        LOGGER.module().error(
            `ERROR: [/indexer/indexer_index_tasks (${method_name})] Failed to ${method_name.replace(/_/g, ' ')}`,
            error_context
        );
    }

    /**
     * Logs successful operation
     * @param {string} message - Success message
     * @param {Object} context - Context for logging
     * @private
     */
    _log_success(message, context = {}) {
        LOGGER.module().info(message, {
            index: this.INDEX,
            ...context,
            timestamp: new Date().toISOString()
        });
    }

    // ==================== PUBLIC METHODS ====================

    /**
     * Indexes a record in Elasticsearch with validation and error handling
     * @param {Object} record - Record to index (must contain uuid)
     * @param {Object} [options={}] - Indexing options
     * @param {boolean} [options.refresh=false] - Whether to refresh immediately (default: false for efficiency)
     * @param {string} [options.timeout='30s'] - Request timeout
     * @param {number} [options.retry_on_conflict=3] - Number of retries on version conflict
     * @returns {Promise<Object>} Result object with success status and details
     */
    async index_record(record, options = {}) {

        try {
            // Validate input
            this._validate_record(record);
            const uuid_trimmed = this._validate_uuid(record.uuid, 'record UUID');

            // Sanitize record to prevent prototype pollution
            const sanitized_record = this._sanitize_record(record);

            // Prepare index options
            const index_options = {
                index: this.INDEX,
                id: uuid_trimmed,
                body: sanitized_record,
                // Default refresh to false for better performance (10-100x faster)
                refresh: options.refresh === true ? 'true' : 'false',
                timeout: options.timeout || '30s'
                // retry_on_conflict: options.retry_on_conflict !== undefined ? options.retry_on_conflict : 3
            };

            // Perform index operation with timeout protection
            const response = await this._with_timeout(
                this.CLIENT.index(index_options),
                this.INDEX_TIMEOUT
            );

            // Validate response
            if (!response) {
                throw new Error('Empty response from Elasticsearch');
            }

            // Check for successful results
            const success_results = ['created', 'updated'];
            const is_success = success_results.includes(response.result);

            if (is_success) {
                this._log_success('Record indexed successfully', {
                    uuid: uuid_trimmed,
                    result: response.result,
                    version: response._version
                });

                return {
                    success: true,
                    result: response.result,
                    uuid: uuid_trimmed,
                    version: response._version,
                    index: this.INDEX,
                    shards: response._shards
                };
            }

            // Handle unexpected results (noop, etc.)
            LOGGER.module().warn('Unexpected index result', {
                uuid: uuid_trimmed,
                result: response.result,
                index: this.INDEX
            });

            return {
                success: false,
                result: response.result,
                uuid: uuid_trimmed,
                index: this.INDEX,
                message: `Unexpected result: ${response.result}`
            };

        } catch (error) {
            this._handle_error(error, 'index_record', {
                uuid: record?.uuid
            });

            return {
                success: false,
                uuid: record?.uuid,
                index: this.INDEX,
                error: error.message,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }

    /**
     * Retrieves a record by UUID from the index
     * @param {string} uuid - UUID of the record to retrieve
     * @param {Object} [options={}] - Get options
     * @param {string} [options.timeout='5s'] - Request timeout
     * @returns {Promise<Object>} Result object with found status and document
     */
    async get_indexed_record(uuid, options = {}) {

        try {
            // Validate UUID
            const uuid_trimmed = this._validate_uuid(uuid, 'record UUID');

            // Prepare get options
            const get_options = {
                index: this.INDEX,
                id: uuid_trimmed,
                timeout: options.timeout
            };

            // Perform get operation with timeout protection
            const response = await this._with_timeout(
                this.CLIENT.get(get_options),
                this.GET_TIMEOUT
            );

            // Validate response
            if (!response) {
                return {
                    success: false,
                    found: false,
                    uuid: uuid_trimmed,
                    index: this.INDEX,
                    message: 'Empty response from Elasticsearch'
                };
            }

            if (response.found === true) {
                this._log_success('Record retrieved successfully', {
                    uuid: uuid_trimmed,
                    version: response._version
                });

                return {
                    success: true,
                    found: true,
                    uuid: uuid_trimmed,
                    source: response._source,
                    version: response._version,
                    index: response._index
                };
            }

            // Record not found (shouldn't reach here normally, 404 throws error)
            return {
                success: false,
                found: false,
                uuid: uuid_trimmed,
                index: this.INDEX,
                message: 'Record not found'
            };

        } catch (error) {
            // Handle 404 errors gracefully (record not found)
            if (error.meta?.statusCode === 404) {
                LOGGER.module().info('Record not found in index', {
                    uuid,
                    index: this.INDEX
                });

                return {
                    success: false,
                    found: false,
                    uuid,
                    index: this.INDEX,
                    message: 'Record not found'
                };
            }

            this._handle_error(error, 'get_indexed_record', { uuid });

            return {
                success: false,
                found: false,
                uuid,
                index: this.INDEX,
                error: error.message,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }

    /**
     * Deletes a record from the index
     * @param {string} uuid - UUID of the record to delete
     * @param {Object} [options={}] - Delete options
     * @param {boolean} [options.refresh=false] - Whether to refresh immediately (default: false for efficiency)
     * @param {string} [options.timeout='30s'] - Request timeout
     * @returns {Promise<Object>} Result object with success status and details
     */
    async delete_record(uuid, options = {}) {
        try {
            // Validate UUID
            const uuid_trimmed = this._validate_uuid(uuid, 'record UUID');

            // Prepare delete options
            const delete_options = {
                index: this.INDEX,
                id: uuid_trimmed,
                // Default refresh to false for better performance
                refresh: options.refresh === true ? 'true' : 'false',
                timeout: options.timeout || '30s'
            };

            // Perform delete operation with timeout protection
            const response = await this._with_timeout(
                this.CLIENT.delete(delete_options),
                this.INDEX_TIMEOUT
            );
            console.log('UUID ', uuid_trimmed);
            console.log('RESPONSE ', response);
            // Validate response
            if (!response) {
                throw new Error('Empty response from Elasticsearch');
            }

            if (response.result === 'deleted') {
                this._log_success('Record deleted successfully', {
                    uuid: uuid_trimmed,
                    version: response._version
                });

                return {
                    success: true,
                    result: response.result,
                    uuid: uuid_trimmed,
                    version: response._version,
                    index: this.INDEX,
                    shards: response._shards
                };
            }

            // Handle unexpected results (not_found, noop, etc.)
            return {
                success: false,
                result: response.result,
                uuid: uuid_trimmed,
                index: this.INDEX,
                message: `Unexpected result: ${response.result}`
            };

        } catch (error) {
            // Handle 404 errors gracefully (record already deleted or doesn't exist)
            if (error.meta?.statusCode === 404) {
                LOGGER.module().info('Record not found for deletion', {
                    uuid,
                    index: this.INDEX
                });

                return {
                    success: false,
                    result: 'not_found',
                    uuid,
                    index: this.INDEX,
                    message: 'Record not found'
                };
            }

            this._handle_error(error, 'delete_record', { uuid });

            return {
                success: false,
                uuid,
                index: this.INDEX,
                error: error.message,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }
};

module.exports = Indexer_index_tasks;