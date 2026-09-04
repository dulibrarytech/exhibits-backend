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

const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const HELPER = require('../libs/helper');
const MEDIA_TASKS = require('./tasks/media_record_tasks');
const UPLOADS = require('./uploads');
const IIIF_CACHE = require('./iiif-cache');
const REINDEX_COALESCER = require('../exhibits/reindex_coalescer');
const PATH = require('path');
const LOGGER = require('../libs/log4');
const { is_valid_uuid } = require('../libs/uuid');
const VALIDATOR = require('../libs/validate');
const MEDIA_CREATE_SCHEMA = require('./schemas/media_create_record_schema')();
// Initialize task instances
const helper_task = new HELPER();
const media_task = new MEDIA_TASKS(DB, TABLES);
const validate_create_media = new VALIDATOR(MEDIA_CREATE_SCHEMA);

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

// Subject fields that use delimiter-separated values.
// Pipe '|' is the single delimiter end-to-end: the multi-select widget emits
// pipe-joined values, this layer stores them pipe-delimited, and it emits
// pipe-delimited values back to the widget's data-selected. A single subject
// heading can itself contain ", " (e.g. the LCSH term "Vietnam War,
// 1961-1975"), so a comma delimiter would shred such a term; subject headings
// never contain a literal pipe.
const SUBJECT_FIELDS = ['topics_subjects', 'genre_form_subjects', 'places_subjects'];

/*
 * Upload subtrees (relative to STORAGE_PATH) a staged upload may live in.
 * Mirrors uploads.js build_file_path / build_thumbnail_path.
 */
const STORAGE_CONFIG = require('./storage_config')();
const MEDIA_TYPE_DIRS = STORAGE_CONFIG.media_type_dirs || {};
const THUMBNAIL_DIR = MEDIA_TYPE_DIRS.thumbnails || 'thumbnails';
const UPLOAD_DIRS = ['image', 'pdf', 'video', 'audio']
    .map((key) => MEDIA_TYPE_DIRS[key])
    .filter(Boolean);

const normalize_relative = (p) => String(p).replace(/\\/g, '/').replace(/^\.?\//, '');
const is_in_upload_subtree = (p) => UPLOAD_DIRS.some((dir) => normalize_relative(p).startsWith(`${dir}/`));
const is_in_thumbnail_subtree = (p) => normalize_relative(p).startsWith(`${THUMBNAIL_DIR}/`);

/**
 * Normalizes incoming subject field values to the pipe-delimited storage form.
 * Input arrives pipe-joined from the multi-select widget's hidden input; this
 * trims/de-blanks each term and re-joins with '|'.
 * @param {Object} data - Record data object
 * @returns {Object} Data with subject fields normalized to pipe delimiter
 */
const format_subjects_for_storage = (data) => {
    if (!data || typeof data !== 'object') return data;

    for (const field of SUBJECT_FIELDS) {
        if (data[field] && typeof data[field] === 'string') {
            data[field] = data[field]
                .split('|')
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .join('|');
        }
    }

    return data;
};

/**
 * Normalizes stored subject field values for the API response. The stored
 * form is already pipe-delimited; this trims/de-blanks each term and re-joins
 * with '|' so term boundaries survive to the edit modal's data-selected
 * attribute intact (terms may contain ", ").
 * @param {Object} record - Database record object
 * @returns {Object} Record with subject fields normalized to pipe delimiter
 */
const format_subjects_for_display = (record) => {
    if (!record || typeof record !== 'object') return record;

    for (const field of SUBJECT_FIELDS) {
        if (record[field] && typeof record[field] === 'string') {
            record[field] = record[field]
                .split('|')
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .join('|');
        }
    }

    return record;
};

/**
 * Checks if a media record already exists with the given field value
 * Used to prevent duplicate imports for repo_uuid and kaltura_entry_id
 * @param {string} field_name - Field to check ('repo_uuid' or 'kaltura_entry_id')
 * @param {string} field_value - Value to search for
 * @returns {Promise<Object>} Result with exists flag and matching record info
 */
const RTE_VOCABULARY = require('../libs/rte_vocabulary');

/*
 * Field → rich-text profile map enforced on create/update. Description is
 * rich text (dashboard modals use the shared editor); name and alt text are
 * plain strings.
 */
const MEDIA_RTE_PROFILES = {
    name: 'plain',
    description: 'full',
    alt_text: 'plain'
};

exports.check_duplicate = async (field_name, field_value) => {

    try {

        // Validate inputs
        const allowed_fields = ['repo_uuid', 'kaltura_entry_id'];

        if (!allowed_fields.includes(field_name)) {
            return build_response(false, 'Invalid field name');
        }

        if (!field_value || typeof field_value !== 'string' || field_value.trim().length === 0) {
            return build_response(false, 'Field value is required');
        }

        const result = await media_task.check_duplicate_by_field(field_name, field_value.trim());

        if (!result || !result.success) {
            return build_response(false, result?.message || 'Duplicate check failed');
        }

        return build_response(true, result.message, {
            exists: result.exists,
            record: result.record
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (check_duplicate)] ' + error.message);
        return build_response(false, 'Error checking for duplicates: ' + error.message);
    }
};

/**
 * Creates a new media record
 * @param {Object} data - Media record data
 * @returns {Promise<Object>} Result object with success status
 */
exports.create_media_record = async (data) => {

    RTE_VOCABULARY.apply(data, MEDIA_RTE_PROFILES);

    try {

        // Validate input data
        if (!data || typeof data !== 'object') {
            return build_response(false, 'Invalid media data provided');
        }

        // Validate required fields/types against the create schema (ajv) — parity
        // with the exhibit domains, which validate their create input.
        const validation_result = validate_create_media.validate(data);
        if (validation_result !== true) {
            const message = Array.isArray(validation_result) && validation_result[0]
                ? validation_result[0].message : 'Invalid media data';
            LOGGER.module().warn('WARNING: [/media-library/model (create_media_record)] validation failed: ' + message);
            return build_response(false, 'Invalid media data: ' + message);
        }

        // Generate UUID for the new record
        data.uuid = helper_task.create_uuid();

        // Set timestamps
        const now = new Date();
        data.created = now;
        data.updated = now;

        // Convert subject delimiters from comma to pipe for storage
        format_subjects_for_storage(data);

        // Get user's full name from username and assign to created_by
        if (data.username) {
            const user_result = await media_task.get_user_by_username(data.username);

            if (user_result.success && user_result.full_name) {
                data.created_by = user_result.full_name;
            }

            if (user_result.success && user_result.id) {
                data.owner = user_result.id;
            }

            delete data.username;
        }

        // Create the record via task
        const result = await media_task.create_media_record(data);

        if (!result || !result.success) {
            LOGGER.module().error('ERROR: [/media-library/model (create_media_record)] Task returned unsuccessful result');
            return build_response(false, result?.message || 'Failed to create media record');
        }

        LOGGER.module().info('INFO: [/media-library/model (create_media_record)] Media record created successfully with ID: ' + result.id);

        // Convert subject delimiters from pipe to comma for display in response
        if (result.record) {
            format_subjects_for_display(result.record);
        }

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

        // Convert subject delimiters from pipe to comma for display
        const formatted_records = (result.records || []).map(format_subjects_for_display);

        return build_response(true, 'Media records retrieved successfully', {
            records: formatted_records,
            count: result.count
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (get_media_records)] ' + error.message);
        return build_response(false, 'Error retrieving media records: ' + error.message);
    }
};

/**
 * Gets media records with pagination, search, and media type filtering
 * Used by the media picker modal browse grid
 * @param {Object} options - { page, limit, q, media_type }
 * @returns {Promise<Object>} Result object with records and total
 */
exports.get_media_records_browse = async (options = {}) => {

    try {

        const result = await media_task.get_media_records_browse(options);

        if (!result || !result.success) {
            return build_response(false, 'Failed to retrieve media records');
        }

        // Convert subject delimiters from pipe to comma for display
        const formatted_records = (result.records || []).map(format_subjects_for_display);

        return build_response(true, 'Media records retrieved successfully', {
            records: formatted_records,
            total: result.total,
            page: result.page,
            limit: result.limit
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (get_media_records_browse)] ' + error.message);
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

        // Convert subject delimiters from pipe to comma for display
        format_subjects_for_display(result.record);

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

    RTE_VOCABULARY.apply(data, MEDIA_RTE_PROFILES);

    try {

        if (!is_valid_uuid(media_id)) {
            return build_response(false, 'Invalid media ID format');
        }

        if (!data || typeof data !== 'object') {
            return build_response(false, 'Invalid update data provided');
        }

        // Set updated timestamp
        data.updated = new Date();

        // Resolve username to full name for updated_by
        if (data.username) {
            const user_result = await media_task.get_user_by_username(data.username);

            if (user_result.success && user_result.full_name) {
                data.updated_by = user_result.full_name;
            }

            delete data.username;
        }

        // Convert subject delimiters from comma to pipe for storage
        format_subjects_for_storage(data);

        const result = await media_task.update_media_record(media_id, data);

        if (!result || !result.success) {
            return build_response(false, result?.message || 'Failed to update media record');
        }

        // Invalidate cached IIIF derivatives — the record (and possibly its
        // source file) changed, so superseded derivatives must not be reused.
        await IIIF_CACHE.purge(media_id);

        LOGGER.module().info('INFO: [/media-library/model (update_media_record)] Media record updated successfully: ' + media_id);

        // Convert subject delimiters from pipe to comma for display in response
        if (result.record) {
            format_subjects_for_display(result.record);
        }

        return build_response(true, 'Media record updated successfully', {
            record: result.record
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (update_media_record)] ' + error.message);
        return build_response(false, 'Error updating media record: ' + error.message);
    }
};

/**
 * Schedules a coalesced re-index of every currently published exhibit that
 * references the media record, so publicly indexed copies of file-derived
 * fields (dimensions, mime type) refresh without waiting for the next manual
 * publish. Fire-and-forget: failures are logged, never propagated, and
 * unpublished exhibits are skipped so a replace can never push one into the
 * public index.
 * @param {Object} record - The media record whose exhibits should re-index
 * @returns {Promise<void>}
 */
const schedule_exhibit_reindex = async (record) => {

    try {

        let exhibits = record?.exhibits;

        if (typeof exhibits === 'string') {
            exhibits = JSON.parse(exhibits);
        }

        if (!Array.isArray(exhibits) || exhibits.length === 0) {
            return;
        }

        const published_uuids = await media_task.get_published_exhibit_uuids(exhibits);

        if (published_uuids.length === 0) {
            return;
        }

        // Required lazily: the indexer model validates Elasticsearch config at
        // require time, which must not be a precondition for loading this
        // module (it isn't for any other media-library flow).
        const INDEXER_MODEL = require('../indexer/model');

        for (const exhibit_uuid of published_uuids) {
            REINDEX_COALESCER.schedule_reindex(`exhibit:${exhibit_uuid}`, async () => {
                await INDEXER_MODEL.index_exhibit(exhibit_uuid, 'publish');
            });
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (schedule_exhibit_reindex)] ' + error.message);
    }
};

/**
 * Replaces the stored file behind an uploaded media record while preserving
 * all descriptive metadata (name, alt text, description, subjects, exhibit
 * links). The new file is written under a fresh on-disk uuid first; the DB
 * row is repointed only after the write succeeds, and the superseded file is
 * removed best-effort afterwards (the orphaned-files sweep is the backstop).
 * @param {string} media_id - Media record UUID
 * @param {Object} file - Multer file object (buffer, originalname, mimetype)
 * @param {string|null} username - Username (du_id) performing the replace
 * @returns {Promise<Object>} Result object with the updated record
 */
exports.replace_media_file = async (media_id, file, username = null) => {

    try {

        if (!is_valid_uuid(media_id)) {
            return build_response(false, 'Invalid media ID format');
        }

        if (!file || !file.buffer || !file.originalname || !file.mimetype) {
            return build_response(false, 'No replacement file provided');
        }

        const record_result = await media_task.get_media_record(media_id);

        if (!record_result || !record_result.success || !record_result.record) {
            return build_response(false, 'Media record not found');
        }

        const record = record_result.record;

        if (record.ingest_method !== 'upload') {
            return build_response(false, 'Only uploaded media files can be replaced');
        }

        const new_media_type = UPLOADS.get_media_type(file.mimetype);
        const current_media_type = UPLOADS.get_media_type(record.mime_type);

        if (new_media_type === 'unknown' || new_media_type !== current_media_type) {
            return build_response(false, 'Replacement file must be the same media type as the original (' + (current_media_type === 'pdf' ? 'PDF' : 'image') + ')');
        }

        const store_result = await UPLOADS.store_file(file.buffer, file.originalname, file.mimetype);
        const metadata = await UPLOADS.extract_metadata(store_result.file_path, store_result.media_type);

        let updated_by = null;

        if (username) {
            const user_result = await media_task.get_user_by_username(username);

            if (user_result.success && user_result.full_name) {
                updated_by = user_result.full_name;
            }
        }

        const replace_data = {
            storage_path: store_result.storage_path,
            thumbnail_path: store_result.thumbnail_path,
            mime_type: store_result.mime_type,
            original_filename: store_result.original_name,
            size: store_result.file_size,
            exif_data: JSON.stringify(metadata),
            media_width: store_result.media_width,
            media_height: store_result.media_height
        };

        if (updated_by) {
            replace_data.updated_by = updated_by;
        }

        let result;

        try {
            result = await media_task.replace_media_file(media_id, replace_data);
        } catch (task_error) {
            result = { success: false, message: task_error.message };
        }

        if (!result || !result.success) {
            // The DB row was never repointed, so the freshly written file is
            // the orphan — remove it, keeping the live asset untouched.
            try {
                await UPLOADS.delete_stored_file(store_result.storage_path, store_result.thumbnail_path);
            } catch (cleanup_error) {
                LOGGER.module().warn('WARNING: [/media-library/model (replace_media_file)] Failed to clean up replacement file after aborted replace: ' + cleanup_error.message);
            }

            return build_response(false, result?.message || 'Failed to replace media file');
        }

        // Invalidate cached IIIF derivatives — the source file changed, so
        // superseded derivatives must not be reused.
        await IIIF_CACHE.purge(media_id);

        // The row now points at the new file; the old one is unreferenced.
        // Best-effort removal — on failure the weekly orphaned-files sweep
        // reclaims it.
        if (record.storage_path && record.storage_path !== store_result.storage_path) {
            try {
                await UPLOADS.delete_stored_file(record.storage_path, record.thumbnail_path || null);
            } catch (old_file_error) {
                LOGGER.module().warn('WARNING: [/media-library/model (replace_media_file)] Failed to remove superseded file ' + record.storage_path + ': ' + old_file_error.message);
            }
        }

        await schedule_exhibit_reindex(result.record || record);

        LOGGER.module().info('INFO: [/media-library/model (replace_media_file)] Media file replaced successfully: ' + media_id);

        if (result.record) {
            format_subjects_for_display(result.record);
        }

        return build_response(true, 'File replaced successfully', {
            record: result.record
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (replace_media_file)] ' + error.message);
        return build_response(false, 'Error replacing media file: ' + error.message);
    }
};

/**
 * Adds an exhibit UUID to a media record's exhibits JSON array
 * @param {string} media_id - Media record UUID
 * @param {string} exhibit_uuid - Exhibit UUID to add
 * @param {string|null} media_role - Role context for logging ('item_media', 'thumbnail', etc.)
 * @returns {Promise<Object>} Result object with updated exhibits array
 */
exports.add_exhibit_to_media_record = async (media_id, exhibit_uuid, media_role = null) => {

    try {

        if (!is_valid_uuid(media_id)) {
            return build_response(false, 'Invalid media ID format');
        }

        if (!is_valid_uuid(exhibit_uuid)) {
            return build_response(false, 'Invalid exhibit UUID format');
        }

        const result = await media_task.add_exhibit_to_media_record(media_id, exhibit_uuid, media_role);

        if (!result || !result.success) {
            return build_response(false, result?.message || 'Failed to add exhibit to media record');
        }

        LOGGER.module().info('INFO: [/media-library/model (add_exhibit_to_media_record)] Exhibit added to media: ' + media_id);

        return build_response(true, result.message, {
            exhibits: result.exhibits,
            already_present: result.already_present || false
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (add_exhibit_to_media_record)] ' + error.message);
        return build_response(false, 'Error adding exhibit to media record: ' + error.message);
    }
};

/**
 * Removes an exhibit UUID from a media record's exhibits JSON array
 * @param {string} media_id - Media record UUID
 * @param {string} exhibit_uuid - Exhibit UUID to remove
 * @param {string|null} media_role - Role context for logging ('item_media', 'thumbnail', etc.)
 * @returns {Promise<Object>} Result object with updated exhibits array
 */
exports.remove_exhibit_from_media_record = async (media_id, exhibit_uuid, media_role = null) => {

    try {

        if (!is_valid_uuid(media_id)) {
            return build_response(false, 'Invalid media ID format');
        }

        if (!is_valid_uuid(exhibit_uuid)) {
            return build_response(false, 'Invalid exhibit UUID format');
        }

        const result = await media_task.remove_exhibit_from_media_record(media_id, exhibit_uuid, media_role);

        if (!result || !result.success) {
            return build_response(false, result?.message || 'Failed to remove exhibit from media record');
        }

        LOGGER.module().info('INFO: [/media-library/model (remove_exhibit_from_media_record)] Exhibit removed from media: ' + media_id);

        return build_response(true, result.message, {
            exhibits: result.exhibits,
            not_present: result.not_present || false
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (remove_exhibit_from_media_record)] ' + error.message);
        return build_response(false, 'Error removing exhibit from media record: ' + error.message);
    }
};

/**
 * Deletes a media record (soft delete)
 * @param {string} media_id - Media record UUID
 * @param {string|null} username - Username (du_id) of user performing deletion
 * @returns {Promise<Object>} Result object
 */
exports.delete_media_record = async (media_id, username = null) => {

    try {

        if (!is_valid_uuid(media_id)) {
            return build_response(false, 'Invalid media ID format');
        }

        // Resolve username to full name for audit trail
        let deleted_by = null;

        if (username) {
            const user_result = await media_task.get_user_by_username(username);

            if (user_result.success && user_result.full_name) {
                deleted_by = user_result.full_name;
            }
        }

        const result = await media_task.delete_media_record(media_id, deleted_by);

        if (!result || !result.success) {
            return build_response(false, result?.message || 'Failed to delete media record');
        }

        // Reclaim cached IIIF derivatives for the deleted record.
        await IIIF_CACHE.purge(media_id);

        LOGGER.module().info('INFO: [/media-library/model (delete_media_record)] Media record deleted successfully: ' + media_id);

        return build_response(true, 'Media record deleted successfully', {
            uuid: media_id
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (delete_media_record)] ' + error.message);
        return build_response(false, 'Error deleting media record: ' + error.message);
    }
};

/**
 * Removes an unprocessed (staged, not-yet-saved) uploaded file and its
 * thumbnail from staging storage. Used by the upload modal's per-card
 * Remove action so discarded uploads don't orphan on disk.
 *
 * Safety layers: (1) fast-fail rejection of obviously hostile paths;
 * (2) an "unprocessed" guard that refuses any path already linked to a
 * live media record (that's the saved-record delete flow's job); and
 * (3) uploads.delete_stored_file hard-guards path containment for every
 * caller. ENOENT is treated as success by delete_stored_file.
 *
 * @param {string} storage_path - Relative staged file path
 * @param {string|null} thumbnail_path - Relative staged thumbnail path
 * @returns {Promise<Object>} Standard response object
 */
exports.delete_uploaded_file = async (storage_path, thumbnail_path = null) => {

    try {

        if (!storage_path || typeof storage_path !== 'string' || storage_path.trim() === '') {
            return build_response(false, 'storage_path is required');
        }

        const sp = storage_path.trim();
        const tp = (thumbnail_path && typeof thumbnail_path === 'string' && thumbnail_path.trim() !== '')
            ? thumbnail_path.trim()
            : null;

        const looks_hostile = (p) => p.includes('..') || p.includes('\0') || PATH.isAbsolute(p);

        if (looks_hostile(sp) || (tp && looks_hostile(tp))) {
            return build_response(false, 'Invalid file path');
        }

        /*
         * Each argument may only name a file in the subtree an upload writes
         * to: the original under a media-type dir, the thumbnail under the
         * thumbnails dir. Anything else (iiif_cache/, a thumbnail passed as
         * the original, ...) is not a staged upload and is refused up front.
         */
        if (!is_in_upload_subtree(sp) || (tp && !is_in_thumbnail_subtree(tp))) {
            return build_response(false, 'Invalid file path');
        }

        /*
         * Unprocessed guard: never delete a file that belongs to a saved
         * record — and check BOTH arguments. The thumbnail used to go
         * unchecked, so any live record's thumbnail (or a recycled record's
         * original, passed as the "thumbnail") could be deleted here
         * (review 2026-09-02, media finding 3).
         */
        for (const candidate of [sp, tp].filter(Boolean)) {
            const existing = await media_task.find_by_storage_path(candidate);
            if (existing && existing.exists) {
                return build_response(false, 'This file is linked to a saved media record and cannot be removed here');
            }
        }

        await UPLOADS.delete_stored_file(sp, tp);

        LOGGER.module().info('INFO: [/media-library/model (delete_uploaded_file)] Removed staged upload: ' + sp);

        return build_response(true, 'Uploaded file removed successfully', {
            storage_path: sp
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/media-library/model (delete_uploaded_file)] ' + error.message);
        return build_response(false, 'Error removing uploaded file: ' + error.message);
    }
};
