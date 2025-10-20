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

const VALIDATOR = require('validator');
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLE = DB_TABLES.exhibits; // .user_records
const AUTH = require('../auth/tasks/auth_tasks');
const AUTH_TASKS = new AUTH(DB, TABLE);
const LOGGER = require('../libs/log4');

/**
 * Checks user permission
 * @param options
 * req, permissions, record_type
 */
exports.check_permission = async function (options) {

    try {

        const { req, permissions: actions, record_type, parent_id, child_id, users: users_admin } = options;

        if (!req || !actions || !Array.isArray(actions) || actions.length === 0) {
            return false;
        }

        // Extract and validate token
        const token = req.headers?.['x-access-token'];
        if (!token || !VALIDATOR.isJWT(token)) {
            return false;
        }

        // Fetch all required data in parallel
        const [user_id, user_permissions, all_permissions] = await Promise.all([
            AUTH_TASKS.get_user_id(token),
            AUTH_TASKS.get_user_permissions(token),
            AUTH_TASKS.get_permissions()
        ]);

        // Validate critical data
        if (!user_id || !Array.isArray(user_permissions) || !Array.isArray(all_permissions)) {
            return false;
        }

        // Extract user permission IDs efficiently
        const user_permission_ids = new Set(
            user_permissions.map(p => p.permission_id).filter(Boolean)
        );

        // Find user permissions with O(n) lookup using Set
        const user_permissions_found = all_permissions.filter(
            perm => user_permission_ids.has(perm.id)
        );

        // Find matching action permissions
        const actions_set = new Set(actions);
        const matching_permissions = user_permissions_found.filter(
            perm => actions_set.has(perm.permission)
        );

        // No permissions granted
        if (matching_permissions.length === 0) {
            return false;
        }

        // User admin check
        if (users_admin === true) {
            return true;
        }

        // If user has all required permissions, authorization complete
        if (matching_permissions.length === actions.length) {
            return true;
        }

        // Check ownership for partial permissions
        const record_owner = await AUTH_TASKS.check_ownership(
            user_id,
            parent_id,
            child_id,
            record_type
        );
        console.log('RECORD OWNER ', record_owner);
        // Safely compare IDs (handle string/number conversion)
        return String(user_id) === String(record_owner);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/authorize lib (check_permission)] unable to check permission: ${error.message}`
        );
        return false;
    }
};
