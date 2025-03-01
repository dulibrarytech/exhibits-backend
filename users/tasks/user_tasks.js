/**

 Copyright 2025 University of Denver

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
 * User record tasks
 * @type {User_tasks}
 */
const User_tasks = class {

    constructor(DB, TABLE) {
        this.DB = DB;
        this.TABLE = TABLE;
    }

    /**
     * Gets all users
     */
    async get_users() {

        try {
            return await this.DB(this.TABLE).select('*');
        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (get_users)] unable to get users ' + error.message);
        }
    }

    /**
     * Gets one user by id
     * @param id
     */
    async get_user(id) {

        try {

            return await this.DB(this.TABLE).select('*')
            .where({
                id: id
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (get_user)] unable to get user ' + error.message);
        }
    }

    /**
     * Updates user data
     * @param id
     * @param user
     */
    update_user(id, user) {

        try {

            return this.DB(this.TABLE)
            .where({
                id: id
            })
            .update({
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (update_user)] unable to update user ' + error.message);
        }
    }

    /**
     * Saves user data
     * @param user
     */
    async save_user(user) {

        try {

            user.email = user.email.toLowerCase();

            return await this.DB(this.TABLE)
            .insert(user);

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (save_user)] unable to save user data ' + error.message);
        }
    }

    /**
     * Checks if username already exists
     * @param username
     */
    async check_username(username) {

        try {

            let is_duplicate = await this.DB(this.TABLE)
            .count('du_id as du_id')
            .where('du_id', username);

            if (is_duplicate[0].du_id === 1) {
                is_duplicate = true;
            } else {
                is_duplicate = false;
            }

            return is_duplicate;

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (check_username)] unable to check username ' + error.message);
        }
    }

    /**
     * Deletes user data
     * @param user_id
     */
    async delete_user(user_id) {

        try {

            return await this.DB(this.TABLE)
            .where({
                id: user_id
            })
            .del();

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (save_user)] unable to delete user record ' + error.message);
        }
    }

    /**
     * Updates user status
     * @param id
     * @param is_active
     */
    async update_status(id, is_active) {

        try {

            return await this.DB(this.TABLE)
            .where({
                id: id
            })
            .update({
                is_active: is_active
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/users/tasks (update_status)] unable to update user status ' + error.message);
        }
    }
};

module.exports = User_tasks;
