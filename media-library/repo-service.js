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

const { Client } = require("@elastic/elasticsearch");
const ES_CONFIG = require('../config/elasticsearch_config')();
const LOGGER = require('../libs/log4');
const REPO_SERVICE_TASKS = require("../media-library/tasks/repo_service_tasks");
const ITEM_MODEL = require('../exhibits/items_model');

const CLIENT = new Client({
    node: ES_CONFIG.elasticsearch_host
});

const repo_tasks = new REPO_SERVICE_TASKS(CLIENT, ES_CONFIG.repo_elasticsearch_index);

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
 * Validates if a string is a valid UUID format
 * @param {string} uuid - String to validate
 * @returns {boolean} Whether string is valid UUID
 */
const is_valid_uuid = (uuid) => {
    if (!uuid || typeof uuid !== 'string') {
        return false;
    }
    const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuid_regex.test(uuid);
};

/**
 * Searches the digital repository for records matching the search term
 * @param {string} term - Search term
 * @param {Object} [options={}] - Search options
 * @param {number} [options.size=25] - Number of results to return
 * @param {number} [options.from=0] - Starting offset for pagination
 * @returns {Promise<Object>} Search results with success status
 */
exports.search = async function (term, options = {}) {

    try {

        // Validate search term
        const validation = validate_search_term(term);

        if (!validation.valid) {
            LOGGER.module().warn(`WARNING: [/media-library/repo-service (search)] ${validation.message}`);
            return build_response(false, validation.message);
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (search)] Searching repository for: ${validation.term}`);

        // Perform search via repo_tasks
        const response = await repo_tasks.search(validation.term, options);

        if (!response || !response.success) {
            LOGGER.module().warn(`WARNING: [/media-library/repo-service (search)] Search returned no results or failed`);
            return build_response(false, response?.message || 'Search failed', {
                records: [],
                total: 0
            });
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (search)] Search completed successfully. Found ${response.total} results`);

        return build_response(true, 'Search completed successfully', {
            records: response.records,
            total: response.total
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/repo-service (search)] ${error.message}`);
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

        // Call items model to get repository thumbnail
        // items_model.get_repo_tn returns a Buffer (arraybuffer) containing the image data, or null on failure
        const thumbnail_data = await ITEM_MODEL.get_repo_tn(trimmed_uuid);

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

/**
 * Gets all unique subjects from the digital repository, grouped by type
 * Queries across all documents in a single pass and returns deduplicated subjects
 * organized by type (geographic, topical, genre_form, temporal, etc.)
 * @returns {Promise<Object>} Result object with subjects grouped by type
 */
exports.get_subjects = async function () {

    try {

        LOGGER.module().info('INFO: [/media-library/repo-service (get_subjects)] Fetching all subjects');

        const response = await repo_tasks.get_subjects();

        if (!response || !response.success) {
            LOGGER.module().warn('WARNING: [/media-library/repo-service (get_subjects)] Failed to retrieve subjects');
            return build_response(false, response?.message || 'Failed to retrieve subjects', {
                subjects: {},
                total: 0
            });
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (get_subjects)] Retrieved ${response.total} unique subject(s)`);

        return build_response(true, response.message, {
            subjects: response.subjects,
            total: response.total
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/repo-service (get_subjects)] ${error.message}`);
        return build_response(false, 'Error retrieving subjects: ' + error.message, {
            subjects: {},
            total: 0
        });
    }
};

/**
 * Gets all unique resource types from the digital repository
 * Queries across all documents in a single pass and returns deduplicated resource types
 * @returns {Promise<Object>} Result object with resource types array
 */
exports.get_resource_types = async function () {

    try {

        LOGGER.module().info('INFO: [/media-library/repo-service (get_resource_types)] Fetching resource types');

        const response = await repo_tasks.get_resource_types();

        if (!response || !response.success) {
            LOGGER.module().warn('WARNING: [/media-library/repo-service (get_resource_types)] Failed to retrieve resource types');
            return build_response(false, response?.message || 'Failed to retrieve resource types', {
                resource_types: [],
                total: 0
            });
        }

        LOGGER.module().info(`INFO: [/media-library/repo-service (get_resource_types)] Retrieved ${response.total} unique resource type(s)`);

        return build_response(true, response.message, {
            resource_types: response.resource_types,
            total: response.total
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/repo-service (get_resource_types)] ${error.message}`);
        return build_response(false, 'Error retrieving resource types: ' + error.message, {
            resource_types: [],
            total: 0
        });
    }
};