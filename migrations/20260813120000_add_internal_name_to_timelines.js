/**
 * Adds `internal_name` to tbl_timelines — the timeline counterpart of the
 * tbl_grids column (20260812120000): a required, staff-facing label shown in
 * the dashboard item list. It is intentionally NEVER indexed on publish
 * (see indexer/indexer_helper.js construct_timeline_index_record), so it
 * can't surface on the public exhibit.
 *
 * Nullable because pre-existing timelines have no value; the dashboard form
 * requires one on the next save.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('tbl_timelines', table => {
    table.string('internal_name', 255).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('tbl_timelines', table => {
    table.dropColumn('internal_name');
  });
};
