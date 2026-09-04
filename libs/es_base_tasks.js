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

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

'use strict';

const LOGGER = require('./log4');
const {UUID_REGEX} = require('./uuid');

/**
 * Base class for the Elasticsearch-backed task classes (indexer index tasks,
 * indexer index-utils tasks, media-library repo-service tasks). Holds the
 * client/index pair and the dependency, UUID, timeout, and logging helpers
 * those classes share.
 *
 * Subclasses set their own timeout constants and call
 * `this._validate_dependencies()` at the END of their constructor — the base
 * constructor deliberately does not, because a subclass override may depend
 * on fields the subclass has not assigned yet.
 *
 * @param {Object} CLIENT - Elasticsearch client instance
 * @param {string} INDEX - Elasticsearch index name
 * @param {Object} [options={}]
 * @param {string} [options.log_prefix] - Module path used in error log lines,
 *   e.g. '/indexer/indexer_index_tasks'
 */
const Es_base_tasks = class {

    constructor(CLIENT, INDEX, options = {}) {
        this.CLIENT = CLIENT;
        this.INDEX = INDEX;
        this.LOG_PREFIX = options.log_prefix || '/libs/es_base_tasks';
        this.UUID_REGEX = UUID_REGEX;
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

    // ==================== TIMEOUT / LOGGING HELPERS ====================

    /**
     * Builds the error a timed-out operation rejects with. Overridable so a
     * subclass can keep its historical message text.
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Error}
     * @private
     */
    _timeout_error(timeout) {
        return new Error('Elasticsearch operation timeout');
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
                setTimeout(() => reject(this._timeout_error(timeout)), timeout)
            )
        ]);
    }

    /**
     * Handles error logging with context. Logs only — callers decide whether
     * to re-throw or return a failure envelope.
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

        /* Extract Elasticsearch-specific error details */
        if (error.meta) {
            error_context.status_code = error.meta.statusCode;
            error_context.elasticsearch_error = error.meta.body?.error?.type;
            error_context.reason = error.meta.body?.error?.reason;
        }

        /* Add stack trace in non-production environments */
        if (process.env.NODE_ENV !== 'production') {
            error_context.stack = error.stack;
        }

        LOGGER.module().error(
            `ERROR: [${this.LOG_PREFIX} (${method_name})] Failed to ${method_name.replace(/_/g, ' ')}`,
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
};

module.exports = Es_base_tasks;
