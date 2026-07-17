/**
 * Widen tbl_media_library.original_filename from VARCHAR(500) to TEXT.
 *
 * Repo COMPOUND objects store every part filename joined with '; ' in this one
 * column (see public/app/media-library/modals.repo.module.js get_part_filenames
 * / format_filename_display, which splits the joined value back out to render
 * "Files (N)" and to search by filename). A compound object with ~100 parts
 * produces a ~5,000-char value, which overflowed VARCHAR(500) and failed the
 * insert with "Data too long for column 'original_filename'". TEXT (up to 64KB)
 * comfortably holds large compound objects.
 *
 * The column is made NULLable: this sidesteps the cross-engine incompatibility
 * of literal DEFAULT '' on TEXT (MySQL 8 requires the DEFAULT ('') expression
 * form; MariaDB accepts the literal), and it matches the client, which already
 * posts `original_filename: get_part_filenames(...) || null`. All readers are
 * null-safe (format_filename_display guards non-strings; SELECTs pass it
 * through).
 *
 * TEXT columns cannot be indexed without a prefix length, so the existing
 * `original_filename_index` is recreated as a 191-char prefix index (safe under
 * utf8mb4's 767-byte legacy limit: 191 * 4 = 764).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.raw('ALTER TABLE `tbl_media_library` DROP INDEX `original_filename_index`');
  await knex.schema.raw('ALTER TABLE `tbl_media_library` MODIFY `original_filename` TEXT NULL');
  await knex.schema.raw('ALTER TABLE `tbl_media_library` ADD INDEX `original_filename_index` (`original_filename`(191)) USING BTREE');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Restore the original NOT NULL DEFAULT '' VARCHAR(500). Coalesce NULLs first;
  // any value longer than 500 chars (e.g. large compound objects created while
  // this migration was applied) will be truncated by the narrowing MODIFY —
  // an inherent, accepted cost of rolling this back.
  await knex.schema.raw("UPDATE `tbl_media_library` SET `original_filename` = '' WHERE `original_filename` IS NULL");
  await knex.schema.raw('ALTER TABLE `tbl_media_library` DROP INDEX `original_filename_index`');
  await knex.schema.raw("ALTER TABLE `tbl_media_library` MODIFY `original_filename` VARCHAR(500) NOT NULL DEFAULT ''");
  await knex.schema.raw('ALTER TABLE `tbl_media_library` ADD INDEX `original_filename_index` (`original_filename`) USING BTREE');
};
