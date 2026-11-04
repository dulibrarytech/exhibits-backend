/**
 * Widens the content block button `url` columns from VARCHAR(255) to TEXT on
 * tbl_content_block_items and tbl_grid_items (both added by
 * 20260901035956_add_content_block_items). The button form accepts any web
 * address, and repository or search URLs with a query string pass 255
 * characters, which failed the save with "Data too long for column 'url'".
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.raw('ALTER TABLE `tbl_content_block_items` MODIFY `url` TEXT NULL');
  await knex.schema.raw('ALTER TABLE `tbl_grid_items` MODIFY `url` TEXT NULL');
};

/**
 * Narrows back to VARCHAR(255). A value longer than that makes the ALTER fail
 * under strict SQL mode rather than silently truncating.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.raw('ALTER TABLE `tbl_content_block_items` MODIFY `url` VARCHAR(255) NULL');
  await knex.schema.raw('ALTER TABLE `tbl_grid_items` MODIFY `url` VARCHAR(255) NULL');
};
