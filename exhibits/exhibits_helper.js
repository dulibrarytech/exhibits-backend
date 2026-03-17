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

const path = require('path');
const fs = require('fs').promises;

// ==================== VALIDATION HELPERS ====================

/**
 * Validates and sanitizes a required string parameter (UUID, filename, UID, etc.)
 * Returns an object with the sanitized value or an error message.
 * @param {*} value - The value to validate
 * @param {string} field_name - Human-readable field name for error messages
 * @param {number} [max_length=255] - Maximum allowed length after trimming
 * @returns {{ valid: boolean, sanitized: string|null, error_message: string|null }}
 */
const validate_string_param = (value, field_name = 'Parameter', max_length = 255) => {

    if (!value || typeof value !== 'string' || value.trim().length === 0) {
        return {
            valid: false,
            sanitized: null,
            error_message: `Valid ${field_name} is required`
        };
    }

    const sanitized = value.trim();

    if (sanitized.length > max_length) {
        return {
            valid: false,
            sanitized: null,
            error_message: `${field_name} exceeds maximum length`
        };
    }

    return {
        valid: true,
        sanitized,
        error_message: null
    };
};

/**
 * Checks whether a string contains path traversal sequences
 * @param {string} value - The string to check
 * @returns {boolean} True if path traversal characters are detected
 */
const has_path_traversal = (value) => {
    return value.includes('..') || value.includes('/') || value.includes('\\');
};

/**
 * Validates that a request body is present and non-empty
 * @param {*} body - The request body to validate
 * @returns {boolean} True if the body is a non-empty object
 */
const validate_request_body = (body) => {
    return body && typeof body === 'object' && Object.keys(body).length > 0;
};

/**
 * Validates a model result has the expected structure (numeric status)
 * @param {*} result - The result object from a model call
 * @returns {boolean} True if result is an object with a numeric status property
 */
const validate_model_result = (result) => {
    return result && typeof result === 'object' && typeof result.status === 'number';
};

/**
 * Parses and validates an HTTP status code from a model response
 * @param {*} status - The status value to validate
 * @returns {{ valid: boolean, status_code: number|null }}
 */
const validate_status_code = (status) => {
    const status_code = parseInt(status, 10);

    if (isNaN(status_code) || status_code < 100 || status_code > 599) {
        return { valid: false, status_code: null };
    }

    return { valid: true, status_code };
};

// ==================== FILE / PATH HELPERS ====================

/**
 * Validates that storage configuration is properly initialized
 * @param {Object} storage_config - The storage configuration object
 * @returns {boolean} True if config has a storage_path
 */
const validate_storage_config = (storage_config) => {
    return !!(storage_config && storage_config.storage_path);
};

/**
 * Resolves a file path and verifies it is contained within the allowed base directory.
 * Prevents path traversal attacks at the resolved-path level.
 * @param {string} base_storage_path - The resolved base storage directory
 * @param  {...string} segments - Path segments to join onto the base
 * @returns {{ resolved_path: string, is_safe: boolean }}
 */
const resolve_safe_path = (base_storage_path, ...segments) => {
    const joined = path.join(base_storage_path, ...segments);
    const resolved_path = path.resolve(joined);
    const is_safe = resolved_path.startsWith(base_storage_path);
    return { resolved_path, is_safe };
};

/**
 * Checks a filename extension against an allow-list
 * @param {string} filename - The filename (or path) to check
 * @param {string[]} allowed_extensions - Array of allowed extensions, including the dot (e.g. ['.jpg', '.png'])
 * @returns {{ valid: boolean, extension: string }}
 */
const validate_file_extension = (filename, allowed_extensions) => {
    const extension = path.extname(filename).toLowerCase();
    const valid = extension.length > 0 && allowed_extensions.includes(extension);
    return { valid, extension };
};

/**
 * Stats a file path and returns whether it exists and is a regular file.
 * Distinguishes between "not found" and unexpected stat errors.
 * @param {string} resolved_file_path - Absolute path to the file
 * @returns {Promise<{ exists: boolean, is_file: boolean, stats: Object|null, error: Error|null }>}
 */
const check_file_exists = async (resolved_file_path) => {

    try {
        const stats = await fs.stat(resolved_file_path);
        return {
            exists: true,
            is_file: stats.isFile(),
            stats,
            error: null
        };
    } catch (stat_error) {
        if (stat_error.code === 'ENOENT') {
            return {
                exists: false,
                is_file: false,
                stats: null,
                error: null
            };
        }
        // Unexpected stat error — bubble up
        return {
            exists: false,
            is_file: false,
            stats: null,
            error: stat_error
        };
    }
};

// ==================== RESPONSE HELPERS ====================

// build_response moved to common_helper

// ==================== EXPORTS ====================

module.exports = {
    // Validation
    validate_string_param,
    has_path_traversal,
    validate_request_body,
    validate_model_result,
    validate_status_code,
    // File / path
    validate_storage_config,
    resolve_safe_path,
    validate_file_extension,
    check_file_exists
};
