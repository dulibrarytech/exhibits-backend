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

const STORAGE_CONFIG = require('../config/storage_config')();
const HTTP = require('axios');
const KALTURA = require('kaltura-client');
const CONFIG = require('../config/webservices_config')();
const KALTURA_CONFIG = require('../config/kaltura_config')();
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const HELPER = require('../libs/helper');
const MEDIA_TASKS = require('./tasks/media_record_tasks');
const LOGGER = require('../libs/log4');

// Initialize task instances
const helper_task = new HELPER();
const media_task = new MEDIA_TASKS(DB, TABLES);

// Constants for response building
const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
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
 * Creates a new media record
 * @param {Object} data - Media record data
 * @returns {Promise<Object>} Result object with success status
 */
exports.create_media_record = async (data) => {

    try {

        // Validate input data
        if (!data || typeof data !== 'object') {
            return build_response(false, 'Invalid media data provided');
        }

        // Generate UUID for the new record
        data.uuid = helper_task.create_uuid();

        // Set timestamps
        const now = new Date();
        data.created = now;
        data.updated = now;

        // TODO: media_task.get_user(token);
        // TODO: get created by first name and last name from user table
        // TODO: assign first and last name to data.created_by.  data.created_by

        delete data.token;


        // Create the record via task
        const result = await media_task.create_media_record(data);

        if (!result || !result.success) {
            LOGGER.module().error('ERROR: [/media-library/model (create_media_record)] Task returned unsuccessful result');
            return build_response(false, result?.message || 'Failed to create media record');
        }

        LOGGER.module().info('INFO: [/media-library/model (create_media_record)] Media record created successfully with ID: ' + result.id);

        return build_response(true, 'Media record created successfully', {
            id: result.id,
            uuid: data.uuid,
            record: result.record
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (create_media_record)] ' + error.message);
        return build_response(false, 'Error creating media record: ' + error.message);
    }
};

/**
 * Gets all media records
 * @returns {Promise<Object>} Result object with records
 */
exports.get_media_records = async () => {

    try {

        const result = await media_task.get_media_records();

        if (!result || !result.success) {
            return build_response(false, 'Failed to retrieve media records');
        }

        return build_response(true, 'Media records retrieved successfully', {
            records: result.records,
            count: result.count
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (get_media_records)] ' + error.message);
        return build_response(false, 'Error retrieving media records: ' + error.message);
    }
};

/**
 * Gets a single media record by ID
 * @param {string} media_id - Media record UUID
 * @returns {Promise<Object>} Result object with record
 */
exports.get_media_record = async (media_id) => {

    try {

        if (!is_valid_uuid(media_id)) {
            return build_response(false, 'Invalid media ID format');
        }

        const result = await media_task.get_media_record(media_id);

        if (!result || !result.success) {
            return build_response(false, 'Media record not found');
        }

        return build_response(true, 'Media record retrieved successfully', {
            record: result.record
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (get_media_record)] ' + error.message);
        return build_response(false, 'Error retrieving media record: ' + error.message);
    }
};

/**
 * Updates a media record
 * @param {string} media_id - Media record UUID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Result object with updated record
 */
exports.update_media_record = async (media_id, data) => {

    try {

        if (!is_valid_uuid(media_id)) {
            return build_response(false, 'Invalid media ID format');
        }

        if (!data || typeof data !== 'object') {
            return build_response(false, 'Invalid update data provided');
        }

        // Set updated timestamp
        data.updated = new Date();

        const result = await media_task.update_media_record(media_id, data);

        if (!result || !result.success) {
            return build_response(false, result?.message || 'Failed to update media record');
        }

        LOGGER.module().info('INFO: [/media-library/model (update_media_record)] Media record updated successfully: ' + media_id);

        return build_response(true, 'Media record updated successfully', {
            record: result.record
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (update_media_record)] ' + error.message);
        return build_response(false, 'Error updating media record: ' + error.message);
    }
};

/**
 * Deletes a media record (soft delete)
 * @param {string} media_id - Media record UUID
 * @param {string|number} deleted_by - User ID performing deletion
 * @returns {Promise<Object>} Result object
 */
exports.delete_media_record = async (media_id, deleted_by = null) => {

    try {

        if (!is_valid_uuid(media_id)) {
            return build_response(false, 'Invalid media ID format');
        }

        const result = await media_task.delete_media_record(media_id, deleted_by);

        if (!result || !result.success) {
            return build_response(false, result?.message || 'Failed to delete media record');
        }

        LOGGER.module().info('INFO: [/media-library/model (delete_media_record)] Media record deleted successfully: ' + media_id);

        return build_response(true, 'Media record deleted successfully', {
            uuid: media_id
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (delete_media_record)] ' + error.message);
        return build_response(false, 'Error deleting media record: ' + error.message);
    }
};
