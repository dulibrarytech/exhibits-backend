/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('tbl_grid_items', table => {
    table.text('alt_text').alter();
  }).then(() => knex.schema.alterTable('tbl_standard_items', table => {
    table.text('alt_text').alter();
  })).then(() => knex.schema.alterTable('tbl_timeline_items', table => {
    table.text('alt_text').alter();
  }));
};
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('tbl_grid_items', table => {
    table.string('alt_text').alter();
  }).then(() => knex.schema.alterTable('tbl_standard_items', table => {
    table.string('alt_text').alter();
  })).then(() => knex.schema.alterTable('tbl_timeline_items', table => {
    table.string('alt_text').alter();
  }));
};
