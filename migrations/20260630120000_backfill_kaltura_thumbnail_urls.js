'use strict';

/**
 * Backfill `kaltura_thumbnail_url` for existing Kaltura media rows.
 *
 * Kaltura thumbnails are now built deterministically from the stored entry id
 * (see media-library/kaltura-service `build_kaltura_thumbnail_url`) instead of a
 * per-import snapshot of Kaltura's API `thumbnailUrl`, which was empty/stale for many
 * rows — leaving the generic placeholder in the media list. This sets every Kaltura
 * row that has an entry id to the canonical constructed URL. The display layer already
 * reads `kaltura_thumbnail_url`, so no view/bundle change is required.
 *
 * URL format mirrors build_kaltura_thumbnail_url (and the playManifest/embed URLs in
 * iiif-service):
 *   {cdn}/p/{pid}/sp/{pid}00/thumbnail/entry_id/{entry_id}/width/N/height/N
 *
 * Reads KALTURA_CDN / KALTURA_PARTNER_ID from env directly (knexfile loads dotenv) to
 * avoid coupling to the kaltura_config validator. If either is absent this is a safe
 * no-op (writes nothing) rather than persisting broken URLs.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

const TABLE = process.env.MEDIA_LIBRARY_RECORDS || 'tbl_media_library';
const THUMBNAIL_SIZE = 400;

exports.up = async function (knex) {

    const cdn = process.env.KALTURA_CDN;
    const partner_id = process.env.KALTURA_PARTNER_ID;

    if (!cdn || !partner_id) {
        return;
    }

    const prefix = `${cdn}/p/${partner_id}/sp/${partner_id}00/thumbnail/entry_id/`;
    const suffix = `/width/${THUMBNAIL_SIZE}/height/${THUMBNAIL_SIZE}`;

    await knex(TABLE)
        .where('ingest_method', 'kaltura')
        .whereNotNull('kaltura_entry_id')
        .andWhere('kaltura_entry_id', '!=', '')
        .update({
            kaltura_thumbnail_url: knex.raw('CONCAT(?, kaltura_entry_id, ?)', [prefix, suffix])
        });
};

exports.down = async function () {
    // Data backfill — the prior per-row snapshot values are not retained, so this is
    // not reversible. The constructed URLs are canonical and safe to keep.
};
