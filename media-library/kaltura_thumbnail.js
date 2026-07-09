'use strict';

/**
 * Reads KALTURA_CDN / KALTURA_PARTNER_ID from `process.env` DIRECTLY (the same values
 * config/kaltura_config maps, and the same approach the backfill migration takes), so
 * this module has NO heavy dependencies — no kaltura_config validator, no kaltura-client
 * SDK. That lets read-path query builders (exhibit item/grid/timeline/hero tasks and
 * media_record_tasks) require it without triggering Kaltura config validation at load
 * time.
 */

// Square thumbnail size requested from Kaltura (px). 400 keeps it crisp; the CSS scales
// it down for the media list and up for the preview/picker.
const KALTURA_THUMBNAIL_SIZE = 400;

/**
 * Build Kaltura's public, on-demand thumbnail URL deterministically from the entry id —
 * the same CDN/partner pattern iiif-service uses for the playManifest/embed URLs. We
 * construct it ourselves instead of snapshotting Kaltura's `response.thumbnailUrl`
 * (frequently empty/stale), so every audio/video entry resolves a thumbnail.
 * @param {string} entry_id - Kaltura entry ID
 * @returns {string} Thumbnail URL, or '' if config/entry_id is missing
 */
const build_kaltura_thumbnail_url = (entry_id) => {

    const cdn = process.env.KALTURA_CDN;
    const partner_id = process.env.KALTURA_PARTNER_ID;

    if (!cdn || !partner_id || !entry_id) {
        return '';
    }

    return `${cdn}/p/${partner_id}/sp/${partner_id}00/thumbnail/entry_id/${entry_id}` +
        `/width/${KALTURA_THUMBNAIL_SIZE}/height/${KALTURA_THUMBNAIL_SIZE}`;
};

/**
 * Returns a knex.raw expression that derives the Kaltura thumbnail URL **at query time**
 * from `<alias>.kaltura_entry_id`, aliased as `out_alias`. Use it in a `.select([...])`
 * in place of a raw `<alias>.kaltura_thumbnail_url as <out_alias>` column so every read
 * path is independent of the stored `kaltura_thumbnail_url` snapshot — which goes stale
 * and gets overwritten by the v1->v2 migration. Mirrors build_kaltura_thumbnail_url's
 * URL format. Non-Kaltura rows (or missing config) fall back to the stored column, so
 * nothing regresses.
 *
 * @param {import('knex')} db - knex instance (for identifier/value escaping)
 * @param {string} alias - the media-library table alias in the query (e.g. 'media_lib')
 * @param {string} out_alias - the output column alias (e.g. 'media_kaltura_thumbnail_url')
 * @returns {import('knex').Knex.Raw}
 */
const kaltura_thumbnail_url_sql = (db, alias, out_alias) => {

    const cdn = process.env.KALTURA_CDN;
    const partner_id = process.env.KALTURA_PARTNER_ID;
    const stored = `${alias}.kaltura_thumbnail_url`;

    if (!cdn || !partner_id) {
        // No config to build from — keep the stored column (legacy behavior).
        return db.raw('?? as ??', [stored, out_alias]);
    }

    const prefix = `${cdn}/p/${partner_id}/sp/${partner_id}00/thumbnail/entry_id/`;
    const suffix = `/width/${KALTURA_THUMBNAIL_SIZE}/height/${KALTURA_THUMBNAIL_SIZE}`;

    return db.raw(
        `CASE WHEN ?? = ? AND ?? IS NOT NULL AND ?? <> ? ` +
        `THEN CONCAT(?, ??, ?) ELSE ?? END as ??`,
        [
            `${alias}.ingest_method`, 'kaltura',
            `${alias}.kaltura_entry_id`,
            `${alias}.kaltura_entry_id`, '',
            prefix, `${alias}.kaltura_entry_id`, suffix,
            stored,
            out_alias
        ]
    );
};

module.exports = {
    KALTURA_THUMBNAIL_SIZE,
    build_kaltura_thumbnail_url,
    kaltura_thumbnail_url_sql
};
