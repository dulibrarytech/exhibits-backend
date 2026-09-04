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

const { Client } = require("@elastic/elasticsearch");
const ES_CONFIG = require('../config/elasticsearch_config')();
const WEBSERVICES_CONFIG = require('../config/webservices_config')();
const HTTP = require('axios');
const LOGGER = require('../libs/log4');
const { is_valid_uuid } = require('../libs/uuid');
const REPO_SERVICE_TASKS = require("../media-library/tasks/repo_service_tasks");
const CLIENT = new Client({
    node: ES_CONFIG.elasticsearch_host
});

const repo_tasks = new REPO_SERVICE_TASKS(CLIENT, ES_CONFIG.repo_elasticsearch_index);

const REPO_TN_TIMEOUT_MS = 15000;

/**
 * Fetches a thumbnail image from the repository thumbnail service
 * @param {string} uuid - Repository item UUID
 * @returns {Promise<Buffer|null>} Thumbnail image data or null
 */
const fetch_repo_tn = async (uuid) => {

    const endpoint = `${WEBSERVICES_CONFIG.tn_service}datastream/${uuid}/tn?key=${WEBSERVICES_CONFIG.tn_service_api_key}`;
    const response = await HTTP.get(endpoint, {
        timeout: REPO_TN_TIMEOUT_MS,
        responseType: 'arraybuffer'
    });

    if (response.status === 200 && response.data) {
        return Buffer.from(response.data);
    }

    return null;
};

/**
 * Builds a standardized response object
 * @param {boolean} success - Whether the operation succeeded
 * @param {string} message - Response message
 * @param {*} data - Response data
 * @returns {Object} Standardized response object
 */
const build_response = (success, message, data = null) => {
    return {
        success,
        message,
        ...data
    };
};

/**
 * Validates search term
 * @param {string} term - Search term to validate
 * @returns {Object} Validation result with sanitized term
 */
const validate_search_term = (term) => {
    if (!term || typeof term !== 'string') {
        return {
            valid: false,
            message: 'Search term is required and must be a string'
        };
    }

    const trimmed_term = term.trim();

    if (trimmed_term.length === 0) {
        return {
            valid: false,
            message: 'Search term cannot be empty'
        };
    }

    if (trimmed_term.length < 2) {
        return {
            valid: false,
            message: 'Search term must be at least 2 characters'
        };
    }

    if (trimmed_term.length > 500) {
        return {
            valid: false,
            message: 'Search term must not exceed 500 characters'
        };
    }

    return {
        valid: true,
        term: trimmed_term
    };
};

/**
 * Searches the digital repository for records matching the search term
 * @param {string} term - Search term
 * @param {Object} [options={}] - Search options
 * @param {number} [options.size=25] - Number of results to return
 * @param {number} [options.from=0] - Starting offset for pagination
 * @returns {Promise<Object>} Search results with success status
 */
exports.search_repository = async function (term, options = {}) {

    try {

        // Validate search term
        const validation = validate_search_term(term);

        if (!validation.valid) {
            LOGGER.module().warn(`WARNING: [/media-library/repo-service (search_repository)] ${validation.message}`);
            return build_response(false, validation.message);
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (search_repository)] Searching repository for: ${validation.term}`);

        // Perform search via repo_tasks
        const response = await repo_tasks.search(validation.term, options);

        if (!response || !response.success) {
            LOGGER.module().warn(`WARNING: [/media-library/repo-service (search_repository)] Search returned no results or failed`);
            return build_response(false, response?.message || 'Search failed', {
                records: [],
                total: 0
            });
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (search_repository)] Search completed successfully. Found ${response.total} results`);

        return build_response(true, 'Search completed successfully', {
            records: response.records,
            total: response.total
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/repo-service (search_repository)] ${error.message}`);
        return build_response(false, 'Error searching repository: ' + error.message, {
            records: [],
            total: 0
        });
    }
};

/**
 * Gets a repository thumbnail by UUID
 * Returns the binary image data from the repository thumbnail service
 * @param {string} uuid - Repository item UUID
 * @returns {Promise<Object>} Result object with thumbnail buffer data
 */
exports.get_repo_tn = async function (uuid) {

    try {

        // Validate UUID
        if (!uuid || typeof uuid !== 'string') {
            LOGGER.module().warn('WARNING: [/media-library/repo-service (get_repo_tn)] Missing UUID');
            return build_response(false, 'UUID is required', {
                thumbnail: null
            });
        }

        const trimmed_uuid = uuid.trim();

        if (!is_valid_uuid(trimmed_uuid)) {
            LOGGER.module().warn(`WARNING: [/media-library/repo-service (get_repo_tn)] Invalid UUID format: ${trimmed_uuid}`);
            return build_response(false, 'Invalid UUID format', {
                thumbnail: null
            });
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (get_repo_tn)] Fetching thumbnail for UUID: ${trimmed_uuid}`);

        const thumbnail_data = await fetch_repo_tn(trimmed_uuid);

        // Check if we received valid thumbnail data
        if (!thumbnail_data) {
            LOGGER.module().warn(`WARNING: [/media-library/repo-service (get_repo_tn)] Thumbnail not found for UUID: ${trimmed_uuid}`);
            return build_response(false, 'Thumbnail not found', {
                thumbnail: null
            });
        }

        // Validate that we received a Buffer
        if (!Buffer.isBuffer(thumbnail_data)) {
            LOGGER.module().warn(`WARNING: [/media-library/repo-service (get_repo_tn)] Invalid thumbnail data type for UUID: ${trimmed_uuid}`);
            return build_response(false, 'Invalid thumbnail data', {
                thumbnail: null
            });
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (get_repo_tn)] Thumbnail retrieved successfully for UUID: ${trimmed_uuid} (${thumbnail_data.length} bytes)`);

        return build_response(true, 'Thumbnail retrieved successfully', {
            thumbnail: thumbnail_data,
            mime_type: 'image/jpeg',
            uuid: trimmed_uuid
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/repo-service (get_repo_tn)] ${error.message}`);
        return build_response(false, 'Error retrieving thumbnail: ' + error.message, {
            thumbnail: null
        });
    }
};

/*
 * The two corpus-wide aggregate reads below (subjects, resource types) are the
 * same passthrough: log, call the task, re-wrap the envelope, and turn a throw
 * into a failure envelope with an empty payload. They differ only in the noun
 * used in the log strings and the key carrying the payload, so the body lives
 * once in `aggregate_read`.
 */

/**
 * Runs a repo_tasks aggregate read and re-wraps its result in this service's
 * standard envelope.
 * @param {Object} options
 * @param {string} options.method_name - Exported name, used in the log prefix
 * @param {string} options.label - Noun for the log and error strings, e.g. 'subjects'
 * @param {string} options.unit - Counted noun for the success log, e.g. 'subject(s)'
 * @param {string} options.payload_key - Envelope key carrying the payload
 * @param {*} options.empty_payload - Payload value used on every failure path
 * @param {Function} options.run - Zero-arg call returning the task's envelope
 * @returns {Promise<Object>} Standardized response object
 */
const aggregate_read = async ({method_name, label, unit, payload_key, empty_payload, run}) => {

    const empty_fields = {
        [payload_key]: empty_payload,
        total: 0
    };

    try {

        LOGGER.module().info(`INFO: [/media-library/repo-service (${method_name})] Fetching ${label}`);

        const response = await run();

        if (!response || !response.success) {
            LOGGER.module().warn(`WARNING: [/media-library/repo-service (${method_name})] Failed to retrieve ${label}`);
            return build_response(false, response?.message || `Failed to retrieve ${label}`, empty_fields);
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (${method_name})] Retrieved ${response.total} unique ${unit}`);

        return build_response(true, response.message, {
            [payload_key]: response[payload_key],
            total: response.total
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/repo-service (${method_name})] ${error.message}`);
        return build_response(false, `Error retrieving ${label}: ` + error.message, empty_fields);
    }
};

/**
 * Gets all unique subjects from the digital repository, grouped by type
 * Queries across all documents in a single pass and returns deduplicated subjects
 * organized by type (geographic, topical, genre_form, temporal, etc.)
 * @returns {Promise<Object>} Result object with subjects grouped by type
 */
exports.get_subjects = async function () {
    return aggregate_read({
        method_name: 'get_subjects',
        label: 'subjects',
        unit: 'subject(s)',
        payload_key: 'subjects',
        empty_payload: {},
        run: () => repo_tasks.get_subjects()
    });
};

/**
 * Gets all unique resource types from the digital repository
 * Queries across all documents in a single pass and returns deduplicated resource types
 * @returns {Promise<Object>} Result object with resource types array
 */
exports.get_resource_types = async function () {
    return aggregate_read({
        method_name: 'get_resource_types',
        label: 'resource types',
        unit: 'resource type(s)',
        payload_key: 'resource_types',
        empty_payload: [],
        run: () => repo_tasks.get_resource_types()
    });
};