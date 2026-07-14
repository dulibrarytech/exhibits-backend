#!/usr/bin/env node

'use strict';

/**
 * Heals image derivatives generated before the transparency fix: regenerates
 * the library thumbnail for every uploaded PNG from its stored original (the
 * originals keep their alpha channel), and purges the record's IIIF cache
 * entries so JPEG derivatives are re-transcoded with the white-flatten
 * pipeline on next request.
 *
 * Dry run (default):  node tools/regenerate-transparent-derivatives.js
 * Apply:              node tools/regenerate-transparent-derivatives.js --apply
 */

require('dotenv').config();

const FS = require('fs');
const knex = require('knex');
const UPLOADS = require('../media-library/uploads');
const IIIF_CACHE = require('../media-library/iiif-cache');

const APPLY = process.argv.includes('--apply');

const DB = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
});

(async () => {

    const records = await DB('tbl_media_library')
        .select('uuid', 'name', 'storage_path')
        .where({ ingest_method: 'upload', is_deleted: 0 })
        .whereIn('mime_type', ['image/png', 'image/webp', 'image/gif']);

    console.log(`${records.length} uploaded alpha-capable image(s) found${APPLY ? '' : ' (dry run — pass --apply to regenerate)'}\n`);

    let regenerated = 0;
    let purged = 0;
    let skipped = 0;

    for (const record of records) {

        if (!record.storage_path) {
            console.log(`  SKIP  ${record.uuid}  (no storage_path)`);
            skipped++;
            continue;
        }

        let resolved;

        try {
            resolved = await UPLOADS.resolve_storage_path(record.storage_path);
        } catch (error) {
            console.log(`  SKIP  ${record.uuid}  (original not on disk: ${record.storage_path})`);
            skipped++;
            continue;
        }

        if (!APPLY) {
            console.log(`  WOULD regenerate  ${record.uuid}  ${record.name || ''}`);
            continue;
        }

        const buffer = FS.readFileSync(resolved);
        const thumb = await UPLOADS.generate_image_thumbnail(buffer, record.uuid);

        if (thumb) {
            regenerated++;
        } else {
            console.log(`  FAIL  ${record.uuid}  (thumbnail regeneration returned null)`);
            skipped++;
            continue;
        }

        const cache_purged = await IIIF_CACHE.purge(record.uuid);

        if (cache_purged !== false) {
            purged++;
        }

        console.log(`  OK    ${record.uuid}  ${record.name || ''}`);
    }

    console.log(`\nDone. regenerated=${regenerated} cache_purged=${purged} skipped=${skipped}${APPLY ? '' : ' (dry run)'}`);

    await UPLOADS.shutdown_exiftool().catch(() => {});
    await DB.destroy();
})().catch(async (error) => {
    console.error('FAILED:', error.message);
    await DB.destroy();
    process.exit(1);
});
