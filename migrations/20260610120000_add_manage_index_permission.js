/**
 * Migration: add the `manage_index` permission and grant it to Administrator.
 *
 * Gates the destructive indexer `/manage` route (search-index create/rebuild),
 * which previously had no auth at all. The route now requires TOKEN.verify +
 * the `manage_index` permission. Because that permission did not exist and no
 * one was granted it, the route would otherwise be reachable by NO role — so
 * this migration is required for the feature to function, not just bookkeeping.
 *
 * Permission grants (`ctbl_role_permissions`) are not part of any seed — they
 * live in the production DB — so a migration is the correct place to add this
 * grant for existing databases. The matching permission DEFINITION is also
 * appended to `db/seeds/02_user_permissions.js` for fresh installs.
 *
 * Idempotent: re-running inserts nothing already present.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

'use strict';

const PERMISSION = 'manage_index';
const DESCRIPTION = 'Allows user to create and rebuild the search index';
const ADMIN_ROLE = 'Administrator';

exports.up = async function (knex) {

    // 1. Permission definition — insert only if absent.
    let perm = await knex('tbl_user_permissions').where({ permission: PERMISSION }).first('id');
    if (!perm) {
        const [id] = await knex('tbl_user_permissions').insert({ permission: PERMISSION, description: DESCRIPTION });
        perm = { id };
    }

    // 2. Grant to Administrator — insert only if absent
    //    (UNIQUE(role_id, permission_id) is a second guard against duplicates).
    const admin = await knex('tbl_user_roles').where({ role: ADMIN_ROLE }).first('id');
    if (admin) {
        const existing = await knex('ctbl_role_permissions')
            .where({ role_id: admin.id, permission_id: perm.id })
            .first('id');
        if (!existing) {
            await knex('ctbl_role_permissions').insert({ role_id: admin.id, permission_id: perm.id });
        }
    }
};

exports.down = async function (knex) {

    const perm = await knex('tbl_user_permissions').where({ permission: PERMISSION }).first('id');
    if (perm) {
        // Remove grants first (FK fk_crp_permission is ON DELETE CASCADE, but be explicit).
        await knex('ctbl_role_permissions').where({ permission_id: perm.id }).del();
        await knex('tbl_user_permissions').where({ id: perm.id }).del();
    }
};
