/**
 * Drop `tbl_user_permissions.has_permission`.
 *
 * `has_permission` is a free-text, hand-maintained column (e.g.
 * 'admin,poweruser,generaluser,student') that NO application code reads — the
 * enforced source of truth is the `ctbl_role_permissions` join table. It had
 * already drifted from the enforced grants and carried delimiter quirks
 * ('.' vs ',', stray spaces). Removing it eliminates the dual source of truth.
 *
 * ORDERING: this migration must run BEFORE `db/seeds/02_user_permissions.js`
 * is (re-)run — the updated seed no longer supplies `has_permission`, and the
 * pre-drop column is `NOT NULL` with no default. Standard knex workflow
 * (`migrate:latest` then `seed:run`) satisfies this.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Idempotent: only drop if the legacy column is still present, so the
  // migration is safe to re-run and safe on a DB where it was already removed.
  if (await knex.schema.hasColumn('tbl_user_permissions', 'has_permission')) {
    await knex.schema.raw(`
      ALTER TABLE \`tbl_user_permissions\` DROP COLUMN \`has_permission\`;
    `);
  }
};

/**
 * Re-adds the column structurally. The original free-text values are NOT
 * restored (they were stale documentation); new rows default to ''.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.raw(`
    ALTER TABLE \`tbl_user_permissions\`
      ADD COLUMN \`has_permission\` varchar(255) NOT NULL DEFAULT '';
  `);
};
