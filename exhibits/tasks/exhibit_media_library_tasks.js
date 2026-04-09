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
const Base_tasks = require('./tasks_helper');

/**
 * Tasks for managing exhibit ↔ media library bindings via tbl_exhibit_media
 * @param DB - Knex database instance
 * @param TABLE - Table name configuration object
 * @type {Exhibit_media_library_tasks}
 */
const Exhibit_media_library_tasks = class extends Base_tasks {

    constructor(DB, TABLE) {
        super(DB, TABLE);
        this.VALID_MEDIA_ROLES = ['hero_image', 'thumbnail'];
    }

    // _validate_database, _validate_table, _validate_uuid, _with_timeout inherited from Base_tasks

    /**
     * Validates media_role against whitelist
     * @param {string} media_role - Role to validate
     * @returns {string} Validated media_role
     * @private
     */
    _validate_media_role(media_role) {
        if (!media_role || typeof media_role !== 'string') {
            throw new Error('Valid media_role is required');
        }

        const trimmed_role = media_role.trim().toLowerCase();

        if (!this.VALID_MEDIA_ROLES.includes(trimmed_role)) {
            throw new Error(`Invalid media_role: ${trimmed_role}. Must be one of: ${this.VALID_MEDIA_ROLES.join(', ')}`);
        }

        return trimmed_role;
    }

    /**
     * Handles error logging and re-throwing (override: module-specific log format)
     * @param {Error} error - Error to handle
     * @param {string} method_name - Name of the method where error occurred
     * @param {Object} context - Additional context for logging
     * @private
     */
    _handle_error(error, method_name, context = {}) {
        LOGGER.module().error(
            `ERROR: [/exhibits/exhibit_media_library_tasks (${method_name})] ${error.message}`,
            {
                method: method_name,
                ...context,
                timestamp: new Date().toISOString(),
                stack: error.stack
            }
        );

        throw error;
    }

    // ==================== CORE OPERATIONS ====================

    /**
     * Binds a media library asset to an exhibit in the given role.
     * If an active binding already exists for that role, soft-deletes it first.
     *
     * @param {string} exhibit_uuid - Exhibit UUID
     * @param {string} media_uuid - Media library asset UUID
     * @param {string} media_role - 'hero_image' | 'thumbnail'
     * @param {string} created_by - Username of the user creating the binding
     * @returns {Promise<Object>} The new binding record
     */
    async bind_media(exhibit_uuid, media_uuid, media_role, created_by) {

        try {
            this._validate_database();
            this._validate_table('exhibit_media_records');
            this._validate_table('exhibit_records');
            this._validate_table('media_library_records');

            const validated_exhibit_uuid = this._validate_uuid(exhibit_uuid, 'exhibit UUID');
            const validated_media_uuid = this._validate_uuid(media_uuid, 'media UUID');
            const validated_role = this._validate_media_role(media_role);

            // 1. Validate exhibit exists and is not deleted
            const exhibit = await this._with_timeout(
                this.DB(this.TABLE.exhibit_records)
                    .select('uuid', 'is_deleted')
                    .where({ uuid: validated_exhibit_uuid })
                    .first()
            );

            if (!exhibit) {
                throw new Error(`Exhibit record not found: ${validated_exhibit_uuid}`);
            }

            if (exhibit.is_deleted === 1) {
                throw new Error(`Cannot bind media to deleted exhibit: ${validated_exhibit_uuid}`);
            }

            // 2. Validate media asset exists and is not deleted
            const media = await this._with_timeout(
                this.DB(this.TABLE.media_library_records)
                    .select('uuid', 'is_deleted', 'name', 'media_type', 'thumbnail_path')
                    .where({ uuid: validated_media_uuid })
                    .first()
            );

            if (!media) {
                throw new Error(`Media library asset not found: ${validated_media_uuid}`);
            }

            if (media.is_deleted === 1) {
                throw new Error(`Cannot bind deleted media asset: ${validated_media_uuid}`);
            }

            // 3. Use transaction to clean up, soft-delete existing binding, and insert new one
            const result = await this.DB.transaction(async (trx) => {

                // Hard-delete any previously soft-deleted bindings for this role
                // (prevents unique constraint violation on exhibit_uuid + media_role + is_deleted)
                await trx(this.TABLE.exhibit_media_records)
                    .where({
                        exhibit_uuid: validated_exhibit_uuid,
                        media_role: validated_role,
                        is_deleted: 1
                    })
                    .del();

                // Soft-delete any existing active binding for this role
                await trx(this.TABLE.exhibit_media_records)
                    .where({
                        exhibit_uuid: validated_exhibit_uuid,
                        media_role: validated_role,
                        is_deleted: 0
                    })
                    .update({
                        is_deleted: 1,
                        updated: trx.fn.now()
                    });

                // Insert new binding
                const insert_data = {
                    exhibit_uuid: validated_exhibit_uuid,
                    media_uuid: validated_media_uuid,
                    media_role: validated_role,
                    is_deleted: 0,
                    created_by: created_by || null
                };

                const [inserted_id] = await trx(this.TABLE.exhibit_media_records).insert(insert_data);

                return {
                    id: inserted_id,
                    ...insert_data
                };
            });

            LOGGER.module().info(
                `INFO: [/exhibits/exhibit_media_library_tasks (bind_media)] Media bound successfully`,
                {
                    exhibit_uuid: validated_exhibit_uuid,
                    media_uuid: validated_media_uuid,
                    media_role: validated_role,
                    created_by
                }
            );

            return result;

        } catch (error) {
            this._handle_error(error, 'bind_media', {
                exhibit_uuid,
                media_uuid,
                media_role
            });
        }
    }

    /**
     * Retrieves all active media bindings for an exhibit, joined with media library metadata.
     *
     * @param {string} exhibit_uuid - Exhibit UUID
     * @returns {Promise<Array>} Array of binding records with media metadata
     */
    async get_exhibit_media_bindings(exhibit_uuid) {

        try {

            this._validate_database();
            this._validate_table('exhibit_media_records');
            this._validate_table('media_library_records');

            const validated_exhibit_uuid = this._validate_uuid(exhibit_uuid, 'exhibit UUID');

            const bindings = await this._with_timeout(
                this.DB(this.TABLE.exhibit_media_records)
                    .select(
                        `${this.TABLE.exhibit_media_records}.id`,
                        `${this.TABLE.exhibit_media_records}.exhibit_uuid`,
                        `${this.TABLE.exhibit_media_records}.media_uuid`,
                        `${this.TABLE.exhibit_media_records}.media_role`,
                        `${this.TABLE.exhibit_media_records}.created`,
                        `${this.TABLE.exhibit_media_records}.created_by`,
                        `${this.TABLE.media_library_records}.name`,
                        `${this.TABLE.media_library_records}.alt_text`,
                        `${this.TABLE.media_library_records}.media_type`,
                        `${this.TABLE.media_library_records}.mime_type`,
                        `${this.TABLE.media_library_records}.filename`,
                        `${this.TABLE.media_library_records}.original_filename`,
                        `${this.TABLE.media_library_records}.ingest_method`,
                        `${this.TABLE.media_library_records}.repo_uuid`,
                        `${this.TABLE.media_library_records}.kaltura_thumbnail_url`,
                        `${this.TABLE.media_library_records}.thumbnail_path`,
                        `${this.TABLE.media_library_records}.storage_path`,
                        `${this.TABLE.media_library_records}.media_width`,
                        `${this.TABLE.media_library_records}.media_height`
                    )
                    .join(
                        this.TABLE.media_library_records,
                        `${this.TABLE.exhibit_media_records}.media_uuid`,
                        '=',
                        `${this.TABLE.media_library_records}.uuid`
                    )
                    .where({
                        [`${this.TABLE.exhibit_media_records}.exhibit_uuid`]: validated_exhibit_uuid,
                        [`${this.TABLE.exhibit_media_records}.is_deleted`]: 0,
                        [`${this.TABLE.media_library_records}.is_deleted`]: 0
                    })
                    .orderBy(`${this.TABLE.exhibit_media_records}.media_role`, 'asc'),
                15000
            );

            return Array.isArray(bindings) ? bindings : [];

        } catch (error) {
            this._handle_error(error, 'get_exhibit_media_bindings', { exhibit_uuid });
        }
    }

    /**
     * Soft-deletes the media binding for a given exhibit and role.
     *
     * @param {string} exhibit_uuid - Exhibit UUID
     * @param {string} media_role - 'hero_image' | 'thumbnail'
     * @returns {Promise<boolean>} True if a binding was deleted
     */
    async unbind_media(exhibit_uuid, media_role) {

        try {

            this._validate_database();
            this._validate_table('exhibit_media_records');

            const validated_exhibit_uuid = this._validate_uuid(exhibit_uuid, 'exhibit UUID');
            const validated_role = this._validate_media_role(media_role);

            const affected_rows = await this.DB.transaction(async (trx) => {

                // Hard-delete any previously soft-deleted bindings for this role
                // (prevents unique constraint violation on exhibit_uuid + media_role + is_deleted)
                await trx(this.TABLE.exhibit_media_records)
                    .where({
                        exhibit_uuid: validated_exhibit_uuid,
                        media_role: validated_role,
                        is_deleted: 1
                    })
                    .del();

                // Soft-delete the active binding
                return trx(this.TABLE.exhibit_media_records)
                    .where({
                        exhibit_uuid: validated_exhibit_uuid,
                        media_role: validated_role,
                        is_deleted: 0
                    })
                    .update({
                        is_deleted: 1,
                        updated: trx.fn.now()
                    });
            });

            if (affected_rows === 0) {
                LOGGER.module().warn(
                    `WARNING: [/exhibits/exhibit_media_library_tasks (unbind_media)] No active binding found`,
                    { exhibit_uuid: validated_exhibit_uuid, media_role: validated_role }
                );
                return false;
            }

            LOGGER.module().info(
                `INFO: [/exhibits/exhibit_media_library_tasks (unbind_media)] Media unbound successfully`,
                {
                    exhibit_uuid: validated_exhibit_uuid,
                    media_role: validated_role,
                    rows_affected: affected_rows
                }
            );

            return true;

        } catch (error) {
            this._handle_error(error, 'unbind_media', { exhibit_uuid, media_role });
        }
    }
};

module.exports = Exhibit_media_library_tasks;
