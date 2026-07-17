#!/usr/bin/env node

'use strict';

/**
 * Reports published exhibits that currently hold unpublished grid items or
 * timeline items — the footprint of the preview-unpublishes bug (fixed in
 * code-review-modified-135).
 *
 * Read-only: this script never writes. Re-publishing an affected exhibit from
 * the dashboard restores its items (the publish flow republishes children),
 * which is the intended heal — a script cannot distinguish items suppressed by
 * the bug from items a curator suppressed on purpose.
 *
 * Run: node tools/report-unpublished-container-items.js
 */

require('dotenv').config();

const knex = require('knex');

const DB = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
});

const strip_html = (value) => String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

(async () => {

    const rows = await DB.raw(`
        SELECT e.uuid, e.title, e.is_preview,
               COALESCE(g.unpub, 0) AS unpub_grid_items,
               COALESCE(t.unpub, 0) AS unpub_timeline_items
        FROM tbl_exhibits e
        LEFT JOIN (
            SELECT is_member_of_exhibit, COUNT(*) AS unpub
            FROM tbl_grid_items WHERE is_deleted = 0 AND is_published = 0
            GROUP BY is_member_of_exhibit
        ) g ON g.is_member_of_exhibit = e.uuid
        LEFT JOIN (
            SELECT is_member_of_exhibit, COUNT(*) AS unpub
            FROM tbl_timeline_items WHERE is_deleted = 0 AND is_published = 0
            GROUP BY is_member_of_exhibit
        ) t ON t.is_member_of_exhibit = e.uuid
        WHERE e.is_deleted = 0
          AND e.is_published = 1
          AND (COALESCE(g.unpub, 0) + COALESCE(t.unpub, 0)) > 0
        ORDER BY (COALESCE(g.unpub, 0) + COALESCE(t.unpub, 0)) DESC
    `);

    const records = rows[0] || [];

    if (records.length === 0) {
        console.log('No published exhibits are holding unpublished grid/timeline items.');
        await DB.destroy();
        return;
    }

    console.log(`${records.length} published exhibit(s) hold unpublished container items.`);
    console.log('Heal by re-publishing each from the dashboard (Publish republishes child items).\n');

    let grid_total = 0;
    let timeline_total = 0;

    for (const r of records) {
        grid_total += Number(r.unpub_grid_items);
        timeline_total += Number(r.unpub_timeline_items);
        console.log(`  ${strip_html(r.title).slice(0, 52).padEnd(52)}  grid:${String(r.unpub_grid_items).padStart(3)}  timeline:${String(r.unpub_timeline_items).padStart(3)}  preview_flag:${r.is_preview}`);
        console.log(`  ${''.padEnd(52)}  ${r.uuid}`);
    }

    console.log(`\nTotals: ${grid_total} grid item(s), ${timeline_total} timeline item(s) across ${records.length} exhibit(s).`);

    await DB.destroy();
})().catch(async (error) => {
    console.error('FAILED:', error.message);
    await DB.destroy();
    process.exit(1);
});
