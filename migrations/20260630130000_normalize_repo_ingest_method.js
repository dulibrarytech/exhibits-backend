'use strict';

/**
 * Normalize migrated repository media rows: `ingest_method = 'repo'` -> `'repository'`.
 *
 * The v1->v2 migration (migrate_v1_to_v2.js `get_ingest_method`) wrote `'repo'` for
 * repository items, but v2 uses `'repository'` everywhere — the media-list render, the
 * click dispatch (`handle_view_click`), the repo view modal, and the repo thumbnail
 * path all key off `ingest_method === 'repository'`. So migrated repo media was never
 * recognized as repository: no repo thumbnail, no details modal, not clickable.
 * Newly-imported repo media already stores `'repository'`, so it works.
 *
 * Most migrated rows already carry a valid `repo_uuid`, so once the value is corrected
 * they render via the native repo path. (The migration source is also fixed so future
 * runs write `'repository'` directly.)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

const TABLE = process.env.MEDIA_LIBRARY_RECORDS || 'tbl_media_library';

exports.up = async function (knex) {
    await knex(TABLE)
        .where('ingest_method', 'repo')
        .update({ ingest_method: 'repository' });
};

exports.down = async function () {
    // Not reversibly distinguishable: after `up`, migrated repo rows and natively
    // imported repo rows both read `'repository'`, so reverting all of them to `'repo'`
    // would corrupt the natively-imported ones. `'repository'` is the correct v2 value;
    // nothing to undo.
};
