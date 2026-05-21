/**
 * Seed: tbl_user_permissions
 *
 * Snapshot of the 34 permissions in production `exhibitsv2` as of 2026-04-30.
 * Re-running this seed wipes and reinserts all rows. Run with `knex seed:run`.
 *
 * IDs are omitted so the database assigns them via AUTO_INCREMENT. Row order
 * below matches the production IDs on a fresh DB.
 *
 * The legacy free-text `has_permission` column was dropped by migration
 * `20260518120100_drop_user_permissions_has_permission` — it was read by no
 * code; `ctbl_role_permissions` is the single source of truth for grants.
 * This seed therefore inserts only `permission` + `description`, and MUST run
 * AFTER migrations (the pre-drop column is NOT NULL with no default).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  const rows = [
    { permission: 'add_exhibit',                         description: 'Allows user to create an exhibit record' },
    { permission: 'add_item',                            description: 'Allows user to create an item record' },
    { permission: 'update_item',                         description: 'Allows user to update their item records' },
    { permission: 'update_exhibit',                      description: 'Allows user to update their exhibit records' },
    { permission: 'publish_exhibit',                     description: 'Allows user to publish their exhibit' },
    { permission: 'suppress_exhibit',                    description: 'Allows user to suppress their exhibit' },
    { permission: 'publish_item',                        description: 'Allows user to publish their items' },
    { permission: 'suppress_item',                       description: 'Allows user to suppress their items' },
    { permission: 'add_item_to_any_exhibit',             description: 'Allows user to add items to any exhibit' },
    { permission: 'delete_exhibit',                      description: 'Allows user to delete their exhibit records' },
    { permission: 'delete_item',                         description: 'Allows user to delete their item records' },
    { permission: 'transfer_exhibit',                    description: 'Allows user to transfer their exhibit' },
    { permission: 'transfer_any_exhibit',                description: 'Allows user to tranfer any exhibit' },
    { permission: 'delete_any_exhibit',                  description: 'Allows user to delete any exhibit' },
    { permission: 'delete_any_item',                     description: 'Allows user to delete any item' },
    { permission: 'add_items_to_any_published_exhibit',  description: 'Allows user to add items to any published exhibit' },
    { permission: 'publish_any_exhibit',                 description: 'Allows user to publish any exhibit' },
    { permission: 'suppress_any_exhibit',                description: 'Allows user to suppress any exhibit' },
    { permission: 'update_any_exhibit',                  description: 'Allows user to update any exhibit' },
    { permission: 'update_any_item',                     description: 'Allows user to update any item' },
    { permission: 'unlock_record',                       description: 'Allows user to unlock any record' },
    { permission: 'update_user_role',                    description: 'Allows user to update user roles' },
    { permission: 'publish_any_item',                    description: 'Allows user to publish any item record' },
    { permission: 'suppress_any_item',                   description: 'Allow user to suppress any item record' },
    { permission: 'add_users',                           description: 'Allow user to create system account' },
    { permission: 'update_users',                        description: 'Allow user to update system account' },
    { permission: 'delete_users',                        description: 'Allow user to delete system account' },
    { permission: 'view_users',                          description: 'Allow user to view system accounts' },
    { permission: 'update_user',                         description: 'Allows user to update their profile' },
    { permission: 'can_create_media',                    description: 'Allows user to create a media library record' },
    { permission: 'can_update_media',                    description: 'Allows user to update their media library records' },
    { permission: 'can_delete_media',                    description: 'Allows user to delete their media library records' },
    { permission: 'can_update_any_media',                description: 'Allows user to update any media library record' },
    { permission: 'can_delete_any_media',                description: 'Allows user to delete any media library record' },
  ];

  await knex('tbl_user_permissions').del();
  await knex('tbl_user_permissions').insert(rows);
};
