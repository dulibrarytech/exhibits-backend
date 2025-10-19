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

        console.log('checking ownership...');

        try {
            // TODO: account for record type - exhibit
            const record_type_map = {
                'item': this.TABLE.item_records,
                'heading': this.TABLE.heading_records,
                'grid': this.TABLE.grid_records,
                'grid_item': this.TABLE.grid_item_records,
                'timeline': this.TABLE.timeline_records,
                'timeline_item': this.TABLE.timeline_item_records
            };

            // Validate input
            if (!record_type_map[record_type]) {
                LOGGER.module().error(`ERROR: [/auth/tasks (check_ownership)] invalid record_type: ${record_type}`);
                return 0;
            }

            // Fetch exhibit and child record data in parallel
            const [exhibit_data, child_data] = await Promise.all([
                this.DB(this.TABLE.exhibit_records)
                    .select('owner')
                    .where({ uuid: parent_id }),
                this.DB(record_type_map[record_type])
                    .select('owner')
                    .where({ uuid: child_id })
            ]);

            // Validate exhibit exists
            if (exhibit_data.length === 0) {
                LOGGER.module().warn(`WARNING: [/auth/tasks (check_ownership)] exhibit not found: ${parent_id}`);
                return 0;
            }

            const exhibit_owner = exhibit_data[0].owner;

            // If child record doesn't exist, return exhibit owner
            if (child_data.length === 0) {
                return exhibit_owner;
            }

            const child_owner = child_data[0].owner;

            // If child is owned by exhibit owner, return exhibit owner
            if (child_owner === exhibit_owner) {
                return child_owner;
            }

            // If child is owned by current user, return child owner
            if (child_owner === user_id) {
                return child_owner;
            }

            // If current user is exhibit owner, return exhibit owner
            if (exhibit_owner === user_id) {
                return exhibit_owner;
            }

            // No ownership match found
            return 0;

        } catch (error) {
            LOGGER.module().error(`ERROR: [/auth/tasks (check_ownership)] unable to check ownership - ${error.message}`);
            return 0;
        }
    }
};

module.exports = Auth_tasks;
