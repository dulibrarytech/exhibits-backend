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

const KALTURA = require('kaltura-client');
const KALTURA_CONFIG = require('../config/kaltura_config')();
const LOGGER = require('../libs/log4');

// Kaltura media type mapping (video and audio only)
// https://developer.kaltura.com/api-docs/service/media/action/get
const MEDIA_TYPE_MAP = {
    1: 'video',
    5: 'audio'
};

// Kaltura session expiry in seconds
const SESSION_EXPIRY = 86400;

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
 * Validates a Kaltura entry ID
 * Entry IDs are alphanumeric strings with underscores, typically 10 characters
 * @param {string} entry_id - Entry ID to validate
 * @returns {Object} Validation result with sanitized entry_id
 */
const validate_entry_id = (entry_id) => {

    if (!entry_id || typeof entry_id !== 'string') {
        return {
            valid: false,
            message: 'Entry ID is required and must be a string'
        };
    }

    const trimmed_id = entry_id.trim();

    if (trimmed_id.length === 0) {
        return {
            valid: false,
            message: 'Entry ID cannot be empty'
        };
    }

    // Kaltura entry IDs are alphanumeric with underscores
    const entry_id_regex = /^[a-zA-Z0-9_]+$/;

    if (!entry_id_regex.test(trimmed_id)) {
        return {
            valid: false,
            message: 'Invalid entry ID format. Entry IDs must be alphanumeric'
        };
    }

    if (trimmed_id.length > 50) {
        return {
            valid: false,
            message: 'Entry ID must not exceed 50 characters'
        };
    }

    return {
        valid: true,
        entry_id: trimmed_id
    };
};

/**
 * Creates and returns a Kaltura client session
 * @returns {Promise<Object>} Object containing configured Kaltura client
 */
const get_kaltura_session = async () => {

    try {

        const config = new KALTURA.Configuration();
        const client = new KALTURA.Client(config);

        const secret = KALTURA_CONFIG.kaltura_secret_key;
        const user_id = KALTURA_CONFIG.kaltura_user_id;
        const type = KALTURA.enums.SessionType.USER;
        const partner_id = KALTURA_CONFIG.kaltura_partner_id;
        const expiry = SESSION_EXPIRY;
        const privileges = KALTURA.enums.SessionType.ADMIN;

        const session = await KALTURA.services.session.start(secret, user_id, type, partner_id, expiry, privileges)
            .execute(client);

        client.setKs(session);

        return { config, client };

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/kaltura-service (get_kaltura_session)] ${error.message}`, {
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Gets Kaltura media metadata by entry ID
 * Returns standardized media data including entry_id, item_type, title, description, and thumbnail
 * @param {string} entry_id - Kaltura entry ID
 * @returns {Promise<Object>} Result object with media metadata
 */
exports.get_kaltura_media = async function (entry_id) {

    try {

        // Validate entry ID
        const validation = validate_entry_id(entry_id);

        if (!validation.valid) {
            LOGGER.module().warn(`WARNING: [/media-library/kaltura-service (get_kaltura_media)] ${validation.message}`);
            return build_response(false, validation.message, {
                media: null
            });
        }

        LOGGER.module().info(`INFO: [/media-library/kaltura-service (get_kaltura_media)] Fetching media for entry ID: ${validation.entry_id}`);

        // Get authenticated Kaltura client
        const { client } = await get_kaltura_session();

        // Retrieve media entry from Kaltura
        const version = -1;
        const response = await KALTURA.services.media.get(validation.entry_id, version)
            .execute(client);

        // Check for Kaltura API exceptions
        if (response && response.objectType === 'KalturaAPIException') {
            LOGGER.module().warn(`WARNING: [/media-library/kaltura-service (get_kaltura_media)] Kaltura API exception for entry ID: ${validation.entry_id} - ${response.message}`);
            return build_response(false, response.message || 'Kaltura API error', {
                media: null
            });
        }

        // Validate response has required media type
        if (!response || response.mediaType === undefined) {
            LOGGER.module().warn(`WARNING: [/media-library/kaltura-service (get_kaltura_media)] No media metadata found for entry ID: ${validation.entry_id}`);
            return build_response(false, 'Media metadata not found', {
                media: null
            });
        }

        // Look up item type from media type (video and audio only)
        const item_type = MEDIA_TYPE_MAP[response.mediaType];

        if (!item_type) {
            LOGGER.module().warn(`WARNING: [/media-library/kaltura-service (get_kaltura_media)] Unsupported media type ${response.mediaType} for entry ID: ${validation.entry_id}`);
            return build_response(false, 'Unsupported media type. Only video and audio are supported', {
                media: null
            });
        }

        LOGGER.module().info(`INFO: [/media-library/kaltura-service (get_kaltura_media)] Media retrieved successfully for entry ID: ${validation.entry_id} (${item_type})`);

        return build_response(true, 'Kaltura media metadata retrieved successfully', {
            media: {
                entry_id: response.id,
                item_type: item_type,
                title: response.name || '',
                description: response.description || '',
                thumbnail: response.thumbnailUrl || ''
            }
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/kaltura-service (get_kaltura_media)] ${error.message}`, {
            entry_id,
            stack: error.stack
        });
        return build_response(false, 'Error retrieving Kaltura media: ' + error.message, {
            media: null
        });
    }
};
