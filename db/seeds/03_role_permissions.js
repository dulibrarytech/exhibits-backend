/**
 * Seed: ctbl_role_permissions  (role → permission GRANTS matrix)  [confirmed 2026-06-22]
 *
 * Establishes which role holds which permission — the missing piece that makes
 * v2 RBAC functional. Knex runs seeds alphabetically, so this runs AFTER
 * 01_user_roles + 02_user_permissions, and resolves role/permission NAMES to ids
 * at runtime (01/02 wipe+reinsert with AUTO_INCREMENT, so ids are not stable).
 * Re-running wipes and reinserts all grants. Run with `knex seed:run`.
 *
 * FK-cascade note: ctbl_role_permissions.permission_id has ON DELETE CASCADE
 * (migration 20260518120000), so 02_user_permissions' del() cascade-wipes these
 * grants — which is exactly why this seed re-creates them right after. Always run
 * the full seed sequence; never run 02 alone.
 *
 * GRANT SOURCES:
 *   • The 29 permissions shared with v1 use v1's PRODUCTION grant matrix verbatim
 *     (exhibitsv1.ctbl_role_permissions as of 2026-06-22 — 79 grants).
 *   • The 7 v2-only permissions (5 media `can_*`, manage_index, manage_recycle_bin)
 *     have NO v1 precedent. The grants in V2_NEW below were reviewed and
 *     CONFIRMED with the v2 owner 2026-06-22:
 *       - media perms mirror each role's item perms
 *         (can_create_media ~ add_item; can_*_any_media ~ *_any_item)
 *       - manage_index / manage_recycle_bin are Administrator-only (system ops;
 *         note: live v2 previously granted these to all roles)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {

  // ── v1-derived grants — verbatim from the exhibitsv1 production matrix ──
  const V1 = {
    'Administrator': [
      'add_exhibit', 'add_item', 'add_items_to_any_published_exhibit', 'add_item_to_any_exhibit', 'add_users',
      'delete_any_exhibit', 'delete_any_item', 'delete_exhibit', 'delete_item', 'delete_users',
      'publish_any_exhibit', 'publish_any_item', 'publish_exhibit', 'publish_item',
      'suppress_any_exhibit', 'suppress_any_item', 'suppress_exhibit', 'suppress_item',
      'transfer_any_exhibit', 'transfer_exhibit', 'unlock_record',
      'update_any_exhibit', 'update_any_item', 'update_exhibit', 'update_item',
      'update_user', 'update_users', 'update_user_role', 'view_users',
    ],
    'Power User': [
      'add_exhibit', 'add_item', 'add_items_to_any_published_exhibit', 'add_item_to_any_exhibit', 'add_users',
      'delete_any_item', 'delete_exhibit', 'delete_item',
      'publish_any_exhibit', 'publish_any_item', 'publish_exhibit', 'publish_item',
      'suppress_any_exhibit', 'suppress_any_item', 'suppress_exhibit', 'suppress_item',
      'transfer_exhibit',
      'update_any_exhibit', 'update_any_item', 'update_exhibit', 'update_item',
      'update_user', 'update_users', 'view_users',
    ],
    'General User': [
      'add_exhibit', 'add_item', 'add_item_to_any_exhibit',
      'delete_exhibit', 'delete_item',
      'publish_exhibit', 'publish_item', 'suppress_exhibit', 'suppress_item',
      'transfer_exhibit', 'update_exhibit', 'update_item', 'update_user', 'view_users',
    ],
    'Student': [
      'add_exhibit', 'add_item', 'delete_exhibit', 'delete_item',
      'publish_exhibit', 'publish_item', 'suppress_exhibit', 'suppress_item',
      'update_exhibit', 'update_item', 'update_user', 'view_users',
    ],
  };

  // ── v2-only permission grants (no v1 precedent) — confirmed 2026-06-22 ──
  const V2_NEW = {
    'Administrator': [
      'can_create_media', 'can_update_media', 'can_delete_media', 'can_update_any_media', 'can_delete_any_media',
      'manage_index', 'manage_recycle_bin',
    ],
    'Power User': [
      'can_create_media', 'can_update_media', 'can_delete_media', 'can_update_any_media', 'can_delete_any_media',
    ],
    'General User': [
      'can_create_media', 'can_update_media', 'can_delete_media',
    ],
    'Student': [
      'can_create_media', 'can_update_media', 'can_delete_media',
    ],
  };

  // Compose the full matrix (v1 grants + proposed v2-only grants).
  const MATRIX = {};
  for (const role of Object.keys(V1)) {
    MATRIX[role] = [...V1[role], ...(V2_NEW[role] || [])];
  }

  // Resolve names → ids (01_user_roles + 02_user_permissions must have run first).
  const roles = await knex('tbl_user_roles').select('id', 'role');
  const perms = await knex('tbl_user_permissions').select('id', 'permission');
  const role_id = new Map(roles.map(r => [r.role, r.id]));
  const perm_id = new Map(perms.map(p => [p.permission, p.id]));

  const rows = [];
  const unresolved = new Set();

  for (const [role, permissions] of Object.entries(MATRIX)) {
    const rid = role_id.get(role);
    if (!rid) { unresolved.add(`role "${role}"`); continue; }
    for (const permission of permissions) {
      const pid = perm_id.get(permission);
      if (!pid) { unresolved.add(`permission "${permission}"`); continue; }
      rows.push({ role_id: rid, permission_id: pid });
    }
  }

  // Fail loudly rather than seed a partial matrix (e.g. if 01/02 didn't run, or
  // a permission name drifted from 02_user_permissions.js).
  if (unresolved.size > 0) {
    throw new Error(`03_role_permissions: unresolved names (run 01/02 first?): ${[...unresolved].join(', ')}`);
  }

  await knex('ctbl_role_permissions').del();
  await knex('ctbl_role_permissions').insert(rows);
};
