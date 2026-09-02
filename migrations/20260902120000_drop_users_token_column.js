/**
 * Drop tbl_users.token.
 *
 * The column held each user's LIVE session JWT, written at every login by
 * auth/tasks save_token. Nothing read it back — authorization resolves the
 * user from the verified JWT subject (du_id) on every request — so it was a
 * credential at rest with no purpose: a DB dump or SQL access yielded a valid
 * session for every user until expiry, and the users API leaked it directly
 * until 2026-09-02 (code review C2). The write path is removed in the same
 * change; this migration removes the storage.
 *
 * down() restores the column and its unique index as NULL for every row. The
 * old values are not restorable (and must not be — they were live sessions).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {

    const has_column = await knex.schema.hasColumn('tbl_users', 'token');

    if (!has_column) {
        return;
    }

    await knex.schema.alterTable('tbl_users', (table) => {
        table.dropUnique(['token'], 'token_index');
        table.dropColumn('token');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {

    const has_column = await knex.schema.hasColumn('tbl_users', 'token');

    if (has_column) {
        return;
    }

    await knex.schema.alterTable('tbl_users', (table) => {
        table.string('token', 500).nullable().defaultTo(null);
        table.unique(['token'], 'token_index');
    });
};
