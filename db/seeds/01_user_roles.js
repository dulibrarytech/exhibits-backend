/**
 * Seed: tbl_user_roles
 *
 * Snapshot of the four roles in production `exhibitsv2` as of 2026-04-30.
 * Re-running this seed wipes and reinserts all rows. Run with `knex seed:run`.
 *
 * IDs are omitted so the database assigns them via AUTO_INCREMENT. Row order
 * below is preserved on a fresh DB (Administrator → 1, Power User → 2, etc.).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  const rows = [
    {
      role: 'Administrator',
      description: 'Full access to all features and functionalities, including user management and system settings (Exhibits Librarian, LDT team members)',
    },
    {
      role: 'Power User',
      description: 'Access to specific features related to their team or department, potentially including some administrative tasks. \n(SCA curators or managers, Exhibitions assistant)',
    },
    {
      role: 'General User',
      description: 'Ability to create, modify, and delete content or data (SCA + DCS staffers)',
    },
    {
      role: 'Student',
      description: 'Limited to viewing content or data, with no ability to modify or delete it',
    },
  ];

  await knex('tbl_user_roles').del();
  await knex('tbl_user_roles').insert(rows);
};
