/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('tbl_grids', table => {
    table.string('text_alignment');
    table.string('margins');
    table.text('title', 'longtext').nullable().alter();
  }).then(() => knex.schema.alterTable('tbl_standard_items', table => {
    table.string('text_alignment');
    table.string('margins');
    table.text('title', 'longtext').nullable().alter();
  }).then(() => knex.schema.alterTable('tbl_heading_items', table => {
    table.string('text_alignment');
    table.string('margins');
  })).then(() => knex.schema.alterTable('tbl_timelines', table => {
    table.string('text_alignment');
    table.string('margins');
    table.text('title', 'longtext').nullable().alter();
  })));
};
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('tbl_grids', table => {
    table.dropColumn('text_alignment');
    table.dropColumn('margins');
  }).then(() => knex.schema.alterTable('tbl_standard_items', table => {
    table.dropColumn('text_alignment');
    table.dropColumn('margins');
  }).then(() => knex.schema.alterTable('tbl_heading_items', table => {
    table.dropColumn('text_alignment');
    table.dropColumn('margins');
  })).then(() => knex.schema.alterTable('tbl_timelines', table => {
    table.dropColumn('text_alignment');
    table.dropColumn('margins');
  })));
};
