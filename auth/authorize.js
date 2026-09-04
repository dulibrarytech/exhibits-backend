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

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

'use strict';

const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLE = DB_TABLES.exhibits;
const AUTH = require('../auth/tasks/auth_tasks');
const AUTH_TASKS = new AUTH(DB, TABLE);
const LOGGER = require('../libs/log4');

/**
 * Resolves the numeric tbl_users.id of the request's actor from the JWT
 * subject (du_id). Lets controllers compare "who is calling" with "which
 * record is being changed" without trusting a client-supplied id.
 * @param {Object} req - Express request with req.decoded set by TOKEN.verify
 * @returns {Promise<number|null>} user id, or null when unresolvable
 */
exports.get_actor_id = async function (req) {

    try {

        const username = req?.decoded?.sub;

        if (!username || typeof username !== 'string') {
            return null;
        }

        const user_id = await AUTH_TASKS.get_user_id_by_username(username);
        return Number.isInteger(user_id) && user_id > 0 ? user_id : null;

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/authorize lib (get_actor_id)] unable to resolve actor: ${error.message}`
        );
        return null;
    }
};

/**
 * Decides whether the request's actor may assign a role to a user record.
 *
 * Holders of update_user_role (Administrator) may assign any role. Anyone
 * else may assign a role only if it grants NOTHING the actor does not already
 * hold — i.e. the role's permission set is a subset of the actor's. That lets
 * add_users holders (Power User) create peers and lesser accounts while making
 * escalation (creating an Administrator) impossible without update_user_role.
 * Data-driven from ctbl_role_permissions, so it needs no role-name constants.
 *
 * @param {Object} req    - Express request with req.decoded set by TOKEN.verify
 * @param {number} role_id - Requested tbl_user_roles.id
 * @returns {Promise<boolean>}
 */
exports.can_assign_role = async function (req, role_id) {

    try {

        const username = req?.decoded?.sub;
        const parsed_role_id = Number(role_id);

        if (!username || typeof username !== 'string' || !Number.isInteger(parsed_role_id) || parsed_role_id <= 0) {
            return false;
        }

        const may_assign_any = await exports.check_permission({
            req,
            permissions: ['update_user_role'],
            record_type: null,
            parent_id: null,
            child_id: null,
            users: true
        });

        if (may_assign_any === true) {
            return true;
        }

        const [actor_permissions, role_permission_ids] = await Promise.all([
            AUTH_TASKS.get_user_permissions_by_username(username),
            AUTH_TASKS.get_role_permission_ids(parsed_role_id)
        ]);

        if (!Array.isArray(actor_permissions) || !Array.isArray(role_permission_ids)) {
            return false;
        }

        const actor_permission_ids = new Set(
            actor_permissions.map(p => Number(p.permission_id)).filter(id => Number.isInteger(id) && id > 0)
        );

        const escalates = role_permission_ids.some(id => !actor_permission_ids.has(id));

        if (escalates) {
            LOGGER.module().warn(
                `WARNING: [/auth/authorize lib (can_assign_role)] denied — user: ${username} may not assign role ${parsed_role_id} (grants permissions the actor lacks)`
            );
        }

        return !escalates;

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/authorize lib (can_assign_role)] unable to check role assignment: ${error.message}`
        );
        return false;
    }
};

exports.check_permission = async function (options) {

    try {

        const { req, permissions: actions, record_type, parent_id, child_id, users: users_admin } = options;

        if (!req || !actions || !Array.isArray(actions) || actions.length === 0) {
            return false;
        }

        // Use decoded JWT payload set by TOKEN.verify middleware
        // req.decoded.sub contains the username (du_id) from the JWT
        const username = req.decoded?.sub;
        if (!username || typeof username !== 'string') {
            LOGGER.module().warn('WARNING: [/auth/authorize lib (check_permission)] missing or invalid req.decoded.sub');
            return false;
        }

        // Fetch all required data in parallel using username-based lookups
        const [user_id, user_permissions, all_permissions] = await Promise.all([
            AUTH_TASKS.get_user_id_by_username(username),
            AUTH_TASKS.get_user_permissions_by_username(username),
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

        // Find user permissions
        const user_permissions_found = all_permissions.filter(
            perm => user_permission_ids.has(perm.id)
        );

        // Normalize actions for comparison
        const actions_normalized = new Set(
            actions.map(action => String(action).toLowerCase().trim())
        );

        // Find matching action permissions with normalized comparison
        const matching_permissions = user_permissions_found.filter(perm => {
            const perm_normalized = String(perm.permission).toLowerCase().trim();
            return actions_normalized.has(perm_normalized);
        });

        // No permissions granted
        if (matching_permissions.length === 0) {
            LOGGER.module().warn(
                `WARNING: [/auth/authorize lib (check_permission)] permission denied (no matching grant) — user: ${username}, required: ${actions.join(',')}, record_type: ${record_type || 'n/a'}, parent_id: ${parent_id || 'n/a'}`
            );
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

        // Safely compare IDs (handle string/number conversion)
        const is_owner = String(user_id) === String(record_owner);
        if (!is_owner) {
            // attempts on non-admin partial permissions are auditable.
            LOGGER.module().warn(
                `WARNING: [/auth/authorize lib (check_permission)] permission denied (not record owner) — user: ${username}, record_type: ${record_type || 'n/a'}, parent_id: ${parent_id || 'n/a'}`
            );
        }
        return is_owner;

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/auth/authorize lib (check_permission)] unable to check permission: ${error.message}`
        );
        return false;
    }
};
