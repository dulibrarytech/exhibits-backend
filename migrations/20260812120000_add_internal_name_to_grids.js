/**
 * Adds `internal_name` to tbl_grids — a required, staff-facing label shown in
 * the dashboard item list. It is intentionally NEVER indexed on publish
 * (see indexer/indexer_helper.js construct_grid_index_record), so it can't
 * surface on the public exhibit.
 *
 * Nullable because pre-existing grids have no value; the dashboard form
 * requires one on the next save.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('tbl_grids', table => {
    table.string('internal_name', 255).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('tbl_grids', table => {
    table.dropColumn('internal_name');
  });
};
