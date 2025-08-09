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

            const data = await this.DB(this.TABLE.user_records)
                .select('id')
                .where({
                    du_id: username,
                    is_active: 1
                });

            if (data.length === 1) {

                return {
                    auth: true,
                    data: data[0].id
                };

            } else {

                return {
                    auth: false,
                    data: []
                };
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (check_auth_user)] unable to check auth ' + error.message);
        }
    };

    /**
     * Gets user data
     * @param id
     */
    async get_auth_user_data(id) {

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
    };

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
     * @param uuid
     * @param record_type
     */
    async check_ownership(user_id, uuid, record_type) {

        try {
            console.log(user_id);
            console.log(uuid);
            console.log(record_type);
            let table;

            if (record_type === 'exhibit') {
                table = this.TABLE.exhibit_records;
            }

            if (record_type === 'standard_item') {

                table = this.TABLE.item_records;

                const exhibit_data = await this.DB(this.TABLE.exhibit_records)
                    .select('owner')
                    .where({
                        uuid: uuid
                    });

                const standard_item_data = await this.DB(table)
                    .select('owner')
                    .where({
                        owner: exhibit_data[0].owner
                    });

                if (standard_item_data.length > 0) {

                    if (standard_item_data[0].owner === exhibit_data[0].owner) {
                        return standard_item_data[0].owner;
                    } else if (standard_item_data[0].owner !== exhibit_data[0].owner) {
                        return exhibit_data[0].owner;
                    }

                } else if (standard_item_data.length === 0) {
                    return exhibit_data[0].owner;
                }
            }

            if (record_type === 'heading_item') {

                table = this.TABLE.heading_records;

                const exhibit_data = await this.DB(this.TABLE.exhibit_records)
                    .select('owner')
                    .where({
                        uuid: uuid
                    });

                const heading_data = await this.DB(table)
                    .select('owner')
                    .where({
                        owner: exhibit_data[0].owner
                    });

                if (heading_data.length > 0) {

                    if (heading_data[0].owner === exhibit_data[0].owner) {
                        return heading_data[0].owner;
                    } else if (heading_data[0].owner !== exhibit_data[0].owner) {
                        return exhibit_data[0].owner;
                    }

                } else if (heading_data.length === 0) {
                    return exhibit_data[0].owner;
                }
            }

            if (record_type === 'grid') {
                table = this.TABLE.grid_records;
            }

            if (record_type === 'grid_item') {
                table = this.TABLE.grid_item_records;
            }

            if (record_type === 'timeline') {
                table = this.TABLE.timeline_records;
            }

            if (record_type === 'timeline_item') {
                table = this.TABLE.timeline_item_records;
            }

            const data = await this.DB(table)
                .select('owner')
                .where({
                uuid: uuid
            });

            return data[0].owner;

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/tasks (check_ownership)] unable to check ownership ' + error.message);
        }
    }
};

module.exports = Auth_tasks;
