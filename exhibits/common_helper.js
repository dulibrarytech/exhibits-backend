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

const LOGGER = require('../libs/log4');

// ==================== VALIDATION HELPERS ====================

/**
 * Validates UUID format (8-4-4-4-12 hex). Previously this only checked for a
 * non-empty string, so the validation was a no-op — any string passed.
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid
 */
const is_valid_uuid = (uuid) => {
    if (!uuid || typeof uuid !== 'string') {
        return false;
    }
    // Strict RFC shape (version 1-5, variant 8-b), consistent with Base_tasks and the
    // media-library validators.
    const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuid_regex.test(uuid);
};

/**
 * Validates a user id — the numeric tbl_users.id (e.g. the record-lock owner /
 * req.query.uid). Users are keyed by an integer id, NOT a UUID, so is_valid_uuid
 * must not be used on it.
 * @param {string|number} value
 * @returns {boolean} True if a positive integer
 */
const is_valid_user_id = (value) => {
    if (value === null || value === undefined || value === '') {
        return false;
    }
    const n = Number(value);
    return Number.isInteger(n) && n > 0;
};

/**
 * Validates input data against a schema validator.
 * Logs validation errors with module context.
 * @param {Object} data - Data to validate
 * @param {Object} validator - Validator instance with validate() method
 * @param {string} context - Module and function context for error logging (e.g. 'items_model (create_item_record)')
 * @returns {Object|true} True if valid, array of error objects otherwise
 */
const validate_input = (data, validator, context) => {

    if (!data || typeof data !== 'object') {
        LOGGER.module().error(`ERROR: [/exhibits/${context}] Invalid input data format`);
        return [{message: 'Invalid input data format'}];
    }

    const validation_result = validator.validate(data);

    if (validation_result !== true) {
        const error_msg = validation_result[0].message || 'Validation failed';
        LOGGER.module().error(`ERROR: [/exhibits/${context}] ${error_msg}`);
    }

    return validation_result;
};

// ==================== DATA PREPARATION ====================

/**
 * Prepares styles data for storage
 * @param {Object|string|undefined} styles - Styles object or string
 * @returns {string} JSON stringified styles
 */
const prepare_styles = (styles) => {
    if (!styles || (typeof styles === 'object' && Object.keys(styles).length === 0)) {
        return JSON.stringify({});
    }
    return typeof styles === 'string' ? styles : JSON.stringify(styles);
};

// ==================== RESPONSE HELPERS ====================

/**
 * Builds standardized response object
 * @param {number} status - HTTP status code
 * @param {string} message - Response message
 * @param {*} [data=null] - Optional response data
 * @returns {Object} Response object
 */
const build_response = (status, message, data = null) => {
    const response = {status, message};
    if (data !== null) {
        response.data = data;
    }
    return response;
};

// ==================== MEDIA HELPERS ====================

/**
 * Processes uploaded media and thumbnail files (shared between create and update)
 * @param {Object} data - Item data (mutated in place)
 * @param {Object} helper_task - Helper task instance
 * @param {string} storage_path - Storage root path
 */
const process_media_files = (data, helper_task, storage_path) => {

    // Ensure storage path exists
    helper_task.check_storage_path(data.is_member_of_exhibit, storage_path);

    // Process main media
    if (data.media &&
        data.media.length > 0 &&
        data.media !== data.media_prev) {
        data.media = helper_task.process_uploaded_media(
            data.is_member_of_exhibit,
            data.uuid,
            data.media,
            storage_path
        );
    }

    // Process thumbnail
    if (data.thumbnail &&
        data.thumbnail.length > 0 &&
        data.thumbnail !== data.thumbnail_prev) {
        data.thumbnail = helper_task.process_uploaded_media(
            data.is_member_of_exhibit,
            data.uuid,
            data.thumbnail,
            storage_path
        );
    }
};

/**
 * Cleans up temporary media fields after processing
 * @param {Object} data - Item data (mutated in place)
 */
const clean_media_fields = (data) => {
    delete data.kaltura;
    delete data.repo_uuid;
    delete data.media_prev;
    delete data.thumbnail_prev;
};

// ==================== EXPORTS ====================

module.exports = {
    is_valid_uuid,
    is_valid_user_id,
    validate_input,
    prepare_styles,
    build_response,
    process_media_files,
    clean_media_fields
};
