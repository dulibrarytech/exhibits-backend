'use strict';

/**
 * Drop the vestigial `repo_uuid` column from the grid item and timeline item tables.
 *
 * v2 binds items to the media library (`media_uuid`), so a repository import's UUID
 * lives on the media library record (`tbl_media_library.repo_uuid`, indexed) — that is
 * the source of truth the indexer derives from. The item-level `repo_uuid` columns were
 * an unintended deviation: they exist only on grid items and timeline items (standard
 * items never had one), no client ever sends the field, nothing reads it, and every row
 * in both columns is NULL. The repository UUID reaches the search index via the media
 * library join, and `media` carries it for the exhibits-api contract.
 *
 * Guarded: if any row carries a value the migration aborts rather than dropping data,
 * since population would mean an undiscovered writer exists.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

const TABLES = [
    process.env.GRID_ITEM_RECORDS || 'tbl_grid_items',
    process.env.TIMELINE_ITEM_RECORDS || 'tbl_timeline_items'
];

const COLUMN = 'repo_uuid';

exports.up = async function (knex) {

    for (const table of TABLES) {

        if (!await knex.schema.hasColumn(table, COLUMN)) {
            continue;
        }

        const [{ populated }] = await knex(table)
            .count({ populated: COLUMN })
            .whereNotNull(COLUMN)
            .andWhere(COLUMN, '<>', '');

        if (Number(populated) > 0) {
            throw new Error(
                `Refusing to drop ${table}.${COLUMN}: ${populated} row(s) hold a value. ` +
                `The column was expected to be unused — investigate what wrote to it before dropping.`
            );
        }

        await knex.schema.alterTable(table, (t) => {
            t.dropColumn(COLUMN);
        });
    }
};

exports.down = async function (knex) {

    for (const table of TABLES) {

        if (await knex.schema.hasColumn(table, COLUMN)) {
            continue;
        }

        await knex.schema.alterTable(table, (t) => {
            t.string(COLUMN, 255).nullable();
        });
    }
};
