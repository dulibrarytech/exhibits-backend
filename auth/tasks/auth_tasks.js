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
 * Auth record tasks
 * @type {Auth_tasks}
 */
const Auth_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Checks user access
     * @param username
     */
    async check_auth_user(username) {

        try {

            if (!username || typeof username !== 'string') {
                return {
                    auth: false,
                    data: null
                };
            }

            const data = await this.DB(this.TABLE.user_records)
                .select('id')
                .where({
                    du_id: username,
                    is_active: 1
                })
                .limit(1);

            // Check if exactly one user found
            if (data && data.length === 1) {
                return {
                    auth: true,
                    data: data[0].id
                };
            }

            return {
                auth: false,
                data: null
            };

        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/auth/tasks (check_auth_user)] unable to check auth: ${error.message}`
            );

            // Return consistent error response
            return {
                auth: false,
                data: null
            };
        }
    }

    /**
     * Gets user data
     * @param id
     */
    async get_auth_user_data(id) {

        try {

            if (id === null || id === undefined) {
                return null;
            }

            const user_id = Number(id);

            if (!Number.isInteger(user_id) || user_id <= 0) {
                LOGGER.module().warn(`Invalid user ID format: ${id}`);
                return null;
            }

            // Query user data with limited fields for security
            const data = await this.DB(this.TABLE.user_records)
                .select('id', 'du_id', 'email', 'first_name', 'last_name')
                .where({
                    id: user_id,
                    is_active: 1
                })
                .limit(1);

            // Validate result
            if (!data || !Array.isArray(data) || data.length === 0) {
                return null;
            }

            if (data.length !== 1) {
                LOGGER.module().warn(
                    `Unexpected number of records returned for user ID: ${user_id}`
                );
                return null;
            }

            // Extract first record and validate required fields
            const user_record = data[0];

            if (!user_record.id || !user_record.du_id) {
                LOGGER.module().error(
                    `Missing critical fields in user record for ID: ${user_id}`
                );
                return null;
            }

            // Return normalized user data
            return {
                id: user_record.id,
                du_id: user_record.du_id,
                email: user_record.email || null,
                first_name: user_record.first_name || null,
                last_name: user_record.last_name || null
            };

        } catch (error) {
            LOGGER.module().error(
                `ERROR: [/auth/tasks (get_auth_user_data)] unable to get user data: ${error.message}`
            );
            return null;
        }
    }

    async get_auth_user_data__(id) {

        try {

            const data = await this.DB(this.TABLE.user_records)
                .select('id', 'du_id', 'email', 'first_name', 'last_name')
                .where({
                    id: id,
                    is_active: 1
                });

            if (data.length === 1) {

                return {
                    data: data
                };

            } else {
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_auth_user_data)] unable to get user data ' + error.message);
        }
    }

    /**
     * Saves token
     * @param user_id
     * @param token
     */
    async save_token(user_id, token) {

        try {

            await this.DB(this.TABLE.user_records)
                .where({
                    id: user_id
                })
                .update({
                    token: token
                });

            LOGGER.module().info('INFO: [/auth/tasks (save_token)] Token saved.');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (save_token)] unable to save token ' + error.message);
            return false;
        }
    }

    /**
     * Gets user id
     * @param token
     */
    async get_user_id(token) {

        try {

            const data = await this.DB(this.TABLE.user_records)
                .select('id')
                .where({
                    token: token
                });

            return data[0].id;

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_user_id)] unable to get user id ' + error.message);
        }
    }

    /**
     * Gets user permissions
     * @param token
     */
    async get_user_permissions(token) {

        try {

            return await this.DB.select(
                'u.id',
                'ur.role_id',
                'rp.permission_id'
            ).from('tbl_users AS u')
                .leftJoin('ctbl_user_roles AS ur', 'ur.user_id', 'u.id')
                .leftJoin('ctbl_role_permissions AS rp', 'rp.role_id', 'ur.role_id')
                .where('u.token', '=', token);

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_user_permissions)] unable to get user permissions ' + error.message);
        }
    }

    /**
      Gets all role permissions
     */
    async get_permissions() {

        try {

            return await this.DB('tbl_user_permissions')
                .select('id', 'permission');

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (get_permissions)] unable to get permissions ' + error.message);
        }
    }

    /**
     * Checks record ownership
     * @param user_id
     * @param parent_id
     * @param child_id
     * @param record_type
     */
    async check_ownership(user_id, parent_id, child_id, record_type) {

        try {

            console.log('checking ownership...');

            if (user_id === null || user_id === undefined) {
                LOGGER.module().warn('WARNING: [/auth/tasks (check_ownership)] missing user_id');
                return 0;
            }

            const parsed_user_id = Number(user_id);

            if (!Number.isInteger(parsed_user_id) || parsed_user_id <= 0) {
                LOGGER.module().warn(`WARNING: [/auth/tasks (check_ownership)] invalid user_id: ${user_id}`);
                return 0;
            }

            // Validate parent_id (UUID)
            if (!parent_id || typeof parent_id !== 'string') {
                LOGGER.module().warn('WARNING: [/auth/tasks (check_ownership)] missing or invalid parent_id');
                return 0;
            }

            const uuid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            if (!uuid_pattern.test(parent_id)) {
                LOGGER.module().warn(`WARNING: [/auth/tasks (check_ownership)] invalid parent_id UUID: ${parent_id}`);
                return 0;
            }

            // Validate child_id (UUID) if provided
            if (child_id !== null && child_id !== undefined) {
                if (typeof child_id !== 'string' || !uuid_pattern.test(child_id)) {
                    LOGGER.module().warn(`WARNING: [/auth/tasks (check_ownership)] invalid child_id UUID: ${child_id}`);
                    return 0;
                }
            }

            // Record type mapping including exhibit
            const record_type_map = {
                'exhibit': this.TABLE.exhibit_records,
                'item': this.TABLE.item_records,
                'heading': this.TABLE.heading_records,
                'grid': this.TABLE.grid_records,
                'grid_item': this.TABLE.grid_item_records,
                'timeline': this.TABLE.timeline_records,
                'timeline_item': this.TABLE.timeline_item_records
            };

            // Validate record_type
            if (!record_type || typeof record_type !== 'string') {
                LOGGER.module().error('ERROR: [/auth/tasks (check_ownership)] missing or invalid record_type');
                return 0;
            }

            const normalized_record_type = record_type.toLowerCase().trim();
            if (!record_type_map[normalized_record_type]) {
                LOGGER.module().error(`ERROR: [/auth/tasks (check_ownership)] invalid record_type: ${record_type}`);
                return 0;
            }

            // Handle exhibit record type specially (no parent/child hierarchy)
            if (normalized_record_type === 'exhibit') {
                const exhibit_data = await this.DB(this.TABLE.exhibit_records)
                    .select('owner')
                    .where({ uuid: parent_id })
                    .limit(1);

                if (!exhibit_data || exhibit_data.length === 0) {
                    LOGGER.module().warn(`WARNING: [/auth/tasks (check_ownership)] exhibit not found: ${parent_id}`);
                    return 0;
                }

                const exhibit_owner = exhibit_data[0].owner;

                // Validate owner is a valid number
                const parsed_exhibit_owner = Number(exhibit_owner);
                if (!Number.isInteger(parsed_exhibit_owner) || parsed_exhibit_owner <= 0) {
                    LOGGER.module().error(`ERROR: [/auth/tasks (check_ownership)] invalid exhibit owner: ${exhibit_owner}`);
                    return 0;
                }

                return parsed_exhibit_owner;
            }

            // Handle child record types (require both parent and child)
            if (!child_id) {
                LOGGER.module().warn(`WARNING: [/auth/tasks (check_ownership)] child_id required for record_type: ${normalized_record_type}`);
                return 0;
            }

            // Fetch exhibit and child record data in parallel
            const [exhibit_data, child_data] = await Promise.all([
                this.DB(this.TABLE.exhibit_records)
                    .select('owner')
                    .where({ uuid: parent_id })
                    .limit(1),
                this.DB(record_type_map[normalized_record_type])
                    .select('owner')
                    .where({ uuid: child_id })
                    .limit(1)
            ]);

            // Validate exhibit exists
            if (!exhibit_data || exhibit_data.length === 0) {
                LOGGER.module().warn(`WARNING: [/auth/tasks (check_ownership)] exhibit not found: ${parent_id}`);
                return 0;
            }

            const exhibit_owner = Number(exhibit_data[0].owner);

            // Validate exhibit owner
            if (!Number.isInteger(exhibit_owner) || exhibit_owner <= 0) {
                LOGGER.module().error(`ERROR: [/auth/tasks (check_ownership)] invalid exhibit owner: ${exhibit_data[0].owner}`);
                return 0;
            }

            // If child record doesn't exist, return exhibit owner
            if (!child_data || child_data.length === 0) {
                LOGGER.module().debug(`Child record not found, returning exhibit owner: ${exhibit_owner}`);
                return exhibit_owner;
            }

            const child_owner = Number(child_data[0].owner);

            // Validate child owner
            if (!Number.isInteger(child_owner) || child_owner <= 0) {
                LOGGER.module().error(`ERROR: [/auth/tasks (check_ownership)] invalid child owner: ${child_data[0].owner}`);
                return 0;
            }

            // Ownership priority logic:
            // 1. If child is owned by exhibit owner, return exhibit owner
            if (child_owner === exhibit_owner) {
                LOGGER.module().debug(`Child owned by exhibit owner: ${child_owner}`);
                return child_owner;
            }

            // 2. If child is owned by current user, return child owner
            if (child_owner === parsed_user_id) {
                LOGGER.module().debug(`Child owned by current user: ${child_owner}`);
                return child_owner;
            }

            // 3. If current user is exhibit owner, return exhibit owner
            if (exhibit_owner === parsed_user_id) {
                LOGGER.module().debug(`Current user is exhibit owner: ${exhibit_owner}`);
                return exhibit_owner;
            }

            // No ownership match found
            LOGGER.module().warn(`WARNING: [/auth/tasks (check_ownership)] no ownership match for user ${parsed_user_id}`);
            return 0;

        } catch (error) {
            LOGGER.module().error(`ERROR: [/auth/tasks (check_ownership)] unable to check ownership - ${error.message}`);
            return 0;
        }
    }
};

module.exports = Auth_tasks;
