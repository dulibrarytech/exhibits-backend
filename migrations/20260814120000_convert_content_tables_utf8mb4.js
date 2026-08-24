/**
 * Converts the content tables from 3-byte utf8 (utf8mb3) to utf8mb4 so
 * 4-byte characters — emoji, astral-plane CJK, some typographic symbols —
 * can be stored. The rich text editors make pasting from Word/Google Docs
 * routine, and pasted content is where such characters arrive; on utf8mb3
 * they fail the whole save with "Incorrect string value".
 *
 * The RBAC tables (ctbl_*, tbl_user_*) are already utf8mb4 (baseline).
 * Requires InnoDB DYNAMIC row format (the server default here) so existing
 * varchar(255) indexes fit the 3072-byte key limit at 4 bytes/char.
 *
 * The knex connection config must also carry `charset: 'utf8mb4'`
 * (knexfile.js / config/db_config.js) or the driver will negotiate a
 * 3-byte connection and mangle 4-byte characters in transit.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

const TABLES = [
    'tbl_exhibits',
    'tbl_heading_items',
    'tbl_standard_items',
    'tbl_grid_items',
    'tbl_timeline_items',
    'tbl_grids',
    'tbl_timelines',
    'tbl_media_library',
    'tbl_exhibit_media',
    'tbl_users'
];

exports.up = async function(knex) {
  for (const table of TABLES) {
    await knex.raw(`ALTER TABLE ?? CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, [table]);
  }
};

/**
 * Reverts to utf8mb3. Lossy if 4-byte characters were stored after the up
 * migration — MySQL rejects the conversion in that case rather than
 * corrupting data.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  for (const table of TABLES) {
    await knex.raw(`ALTER TABLE ?? CONVERT TO CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci`, [table]);
  }
};
