/**
 * RBAC integrity constraints.
 *
 * The role/permission join tables (`ctbl_user_roles`, `ctbl_role_permissions`)
 * shipped with NO foreign keys, NO unique constraints, and nullable id columns.
 * Nothing in the database prevented a user from accruing two role rows, an
 * orphan/NULL role_id, or duplicate permission grants — and the app code
 * (`roles_tasks.update_user_role`) assumes exactly one role row per user.
 *
 * This migration enforces the intended model at the database layer:
 *   - one role per user           -> UNIQUE(ctbl_user_roles.user_id)
 *   - no duplicate grants         -> UNIQUE(ctbl_role_permissions.role_id, permission_id)
 *   - no orphan / NULL references -> NOT NULL + FOREIGN KEYs
 *
 * NOTE: signedness. `tbl_users.id` is INT UNSIGNED while
 * `ctbl_user_roles.user_id` was signed INT — MySQL/MariaDB requires an exact
 * type match (incl. signedness) for a foreign key, so `user_id` is widened to
 * UNSIGNED here. The other id columns already match (`tbl_user_roles.id` and
 * `tbl_user_permissions.id` are signed INT).
 *
 * The defensive de-dupe / orphan-purge steps are no-ops on a clean database
 * (verified against exhibitsv2 on 2026-05-18: 12 users / 12 distinct role rows,
 * zero orphans) but make the migration safe to run on drifted environments.
 * Rows removed by those steps are NOT restored on rollback.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {

  // 1. Defensive de-dupe: keep the lowest id per (user_id) / (role_id,permission_id).
  await knex.schema.raw(`
    DELETE cur FROM \`ctbl_user_roles\` cur
    JOIN \`ctbl_user_roles\` keep
      ON keep.user_id = cur.user_id
     AND keep.id < cur.id;
  `);
  await knex.schema.raw(`
    DELETE rp FROM \`ctbl_role_permissions\` rp
    JOIN \`ctbl_role_permissions\` keep
      ON keep.role_id = rp.role_id
     AND keep.permission_id = rp.permission_id
     AND keep.id < rp.id;
  `);

  // 2. Defensive orphan purge: drop rows that would violate the new FKs.
  await knex.schema.raw(`
    DELETE cur FROM \`ctbl_user_roles\` cur
    LEFT JOIN \`tbl_users\` u ON u.id = cur.user_id
    LEFT JOIN \`tbl_user_roles\` r ON r.id = cur.role_id
    WHERE cur.user_id IS NULL OR cur.role_id IS NULL
       OR u.id IS NULL OR r.id IS NULL;
  `);
  await knex.schema.raw(`
    DELETE rp FROM \`ctbl_role_permissions\` rp
    LEFT JOIN \`tbl_user_roles\` r ON r.id = rp.role_id
    LEFT JOIN \`tbl_user_permissions\` p ON p.id = rp.permission_id
    WHERE rp.role_id IS NULL OR rp.permission_id IS NULL
       OR r.id IS NULL OR p.id IS NULL;
  `);

  // 3. Tighten column definitions (NOT NULL; widen user_id to UNSIGNED for FK).
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_user_roles\`
      MODIFY \`user_id\` int(11) unsigned NOT NULL,
      MODIFY \`role_id\` int(11) NOT NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_role_permissions\`
      MODIFY \`role_id\` int(11) NOT NULL,
      MODIFY \`permission_id\` int(11) NOT NULL;
  `);

  // 4. Uniqueness. The redundant non-unique user_id_index is replaced by the
  //    UNIQUE key; role_id_index is kept (still serves the role_id FK).
  await knex.schema.raw(`ALTER TABLE \`ctbl_user_roles\` DROP INDEX \`user_id_index\`;`);
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_user_roles\`
      ADD UNIQUE KEY \`uq_ctbl_user_roles_user_id\` (\`user_id\`);
  `);
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_role_permissions\`
      ADD UNIQUE KEY \`uq_ctbl_role_permissions_role_perm\` (\`role_id\`, \`permission_id\`);
  `);

  // 5. Foreign keys.
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_user_roles\`
      ADD CONSTRAINT \`fk_cur_user\`
        FOREIGN KEY (\`user_id\`) REFERENCES \`tbl_users\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT \`fk_cur_role\`
        FOREIGN KEY (\`role_id\`) REFERENCES \`tbl_user_roles\` (\`id\`)
        ON DELETE RESTRICT ON UPDATE CASCADE;
  `);
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_role_permissions\`
      ADD CONSTRAINT \`fk_crp_role\`
        FOREIGN KEY (\`role_id\`) REFERENCES \`tbl_user_roles\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT \`fk_crp_permission\`
        FOREIGN KEY (\`permission_id\`) REFERENCES \`tbl_user_permissions\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE;
  `);
};

/**
 * Reverts constraints and column tightening. Rows removed by the up()
 * de-dupe / orphan purge are NOT restored.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {

  await knex.schema.raw(`
    ALTER TABLE \`ctbl_role_permissions\`
      DROP FOREIGN KEY \`fk_crp_role\`,
      DROP FOREIGN KEY \`fk_crp_permission\`;
  `);
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_user_roles\`
      DROP FOREIGN KEY \`fk_cur_user\`,
      DROP FOREIGN KEY \`fk_cur_role\`;
  `);

  await knex.schema.raw(`
    ALTER TABLE \`ctbl_role_permissions\`
      DROP INDEX \`uq_ctbl_role_permissions_role_perm\`;
  `);
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_user_roles\`
      DROP INDEX \`uq_ctbl_user_roles_user_id\`;
  `);
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_user_roles\`
      ADD KEY \`user_id_index\` (\`user_id\`) USING BTREE;
  `);

  await knex.schema.raw(`
    ALTER TABLE \`ctbl_role_permissions\`
      MODIFY \`role_id\` int(11) DEFAULT NULL,
      MODIFY \`permission_id\` int(11) DEFAULT NULL;
  `);
  await knex.schema.raw(`
    ALTER TABLE \`ctbl_user_roles\`
      MODIFY \`user_id\` int(11) DEFAULT NULL,
      MODIFY \`role_id\` int(11) DEFAULT NULL;
  `);
};
