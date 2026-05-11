/**
 * Seed: tbl_user_permissions
 *
 * Snapshot of the 34 permissions in production `exhibitsv2` as of 2026-04-30.
 * Re-running this seed wipes and reinserts all rows. Run with `knex seed:run`.
 *
 * IDs are omitted so the database assigns them via AUTO_INCREMENT. Row order
 * below matches the production IDs on a fresh DB.
 *
 * Data quirks preserved verbatim from the source DB — see CHANGES.md for the
 * data-quality findings (mistyped delimiters, inconsistent spacing).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  const rows = [
    { permission: 'add_exhibit',                         description: 'Allows user to create an exhibit record',                  has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'add_item',                            description: 'Allows user to create an item record',                     has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'update_item',                         description: 'Allows user to update their item records',                 has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'update_exhibit',                      description: 'Allows user to update their exhibit records',              has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'publish_exhibit',                     description: 'Allows user to publish their exhibit',                     has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'suppress_exhibit',                    description: 'Allows user to suppress their exhibit',                    has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'publish_item',                        description: 'Allows user to publish their items',                       has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'suppress_item',                       description: 'Allows user to suppress their items',                      has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'add_item_to_any_exhibit',             description: 'Allows user to add items to any exhibit',                  has_permission: 'admin,poweruser,generaluser' },
    { permission: 'delete_exhibit',                      description: 'Allows user to delete their exhibit records',              has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'delete_item',                         description: 'Allows user to delete their item records',                 has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'transfer_exhibit',                    description: 'Allows user to transfer their exhibit',                    has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'transfer_any_exhibit',                description: 'Allows user to tranfer any exhibit',                       has_permission: 'admin' },
    { permission: 'delete_any_exhibit',                  description: 'Allows user to delete any exhibit',                        has_permission: 'admin' },
    { permission: 'delete_any_item',                     description: 'Allows user to delete any item',                           has_permission: 'admin,poweruser' },
    { permission: 'add_items_to_any_published_exhibit',  description: 'Allows user to add items to any published exhibit',        has_permission: 'admin,poweruser' },
    { permission: 'publish_any_exhibit',                 description: 'Allows user to publish any exhibit',                       has_permission: 'admin,poweruser' },
    { permission: 'suppress_any_exhibit',                description: 'Allows user to suppress any exhibit',                      has_permission: 'admin,poweruser' },
    { permission: 'update_any_exhibit',                  description: 'Allows user to update any exhibit',                        has_permission: 'admin.poweruser' },
    { permission: 'update_any_item',                     description: 'Allows user to update any item',                           has_permission: 'admin,poweruser' },
    { permission: 'unlock_record',                       description: 'Allows user to unlock any record',                         has_permission: 'admin' },
    { permission: 'update_user_role',                    description: 'Allows user to update user roles',                         has_permission: 'admin' },
    { permission: 'publish_any_item',                    description: 'Allows user to publish any item record',                   has_permission: 'admin, poweruser' },
    { permission: 'suppress_any_item',                   description: 'Allow user to suppress any item record',                   has_permission: 'admin,poweruser' },
    { permission: 'add_users',                           description: 'Allow user to create system account',                      has_permission: 'admin' },
    { permission: 'update_users',                        description: 'Allow user to update system account',                      has_permission: 'admin' },
    { permission: 'delete_users',                        description: 'Allow user to delete system account',                      has_permission: 'admin' },
    { permission: 'view_users',                          description: 'Allow user to view system accounts',                       has_permission: 'admin.poweruser,generaluser,student' },
    { permission: 'update_user',                         description: 'Allows user to update their profile',                      has_permission: 'admin.poweruser,generaluser,student' },
    { permission: 'can_create_media',                    description: 'Allows user to create a media library record',             has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'can_update_media',                    description: 'Allows user to update their media library records',        has_permission: 'admin,poweruser,generaluser,student' },
    { permission: 'can_delete_media',                    description: 'Allows user to delete their media library records',        has_permission: 'admin,poweruser,generaluser' },
    { permission: 'can_update_any_media',                description: 'Allows user to update any media library record',           has_permission: 'admin,poweruser' },
    { permission: 'can_delete_any_media',                description: 'Allows user to delete any media library record',           has_permission: 'admin' },
  ];

  await knex('tbl_user_permissions').del();
  await knex('tbl_user_permissions').insert(rows);
};
