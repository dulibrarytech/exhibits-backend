/**
 * Unit tests for kaltura-service `build_kaltura_thumbnail_url` — the deterministic
 * Kaltura thumbnail URL builder used at import and mirrored by the backfill migration
 * (20260630120000_backfill_kaltura_thumbnail_urls). The exact URL format is load-
 * bearing: a wrong path means every Kaltura thumbnail 404s to the placeholder.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// kaltura_config reads these at module load; vitest doesn't load .env, so set them
// before requiring the service (real config passes them straight through).
process.env.KALTURA_CDN = 'https://cdn.test.kaltura.com';
process.env.KALTURA_PARTNER_ID = '12345';

jest.mock('../../libs/log4', () => ({
    module: () => ({error() {}, warn() {}, info() {}})
}));

// Stub the Kaltura SDK so requiring the service doesn't need the real client.
jest.mock('kaltura-client', () => ({
    Configuration: function () {},
    Client: function () { return {setKs() {}}; },
    enums: {SessionType: {USER: 0, ADMIN: 2}},
    services: {}
}));

const KALTURA_SERVICE = require('../../media-library/kaltura-service');

// Connectionless knex instance — only used to render raw SQL via .toString().
const knex = require('knex')({client: 'mysql2'});

describe('build_kaltura_thumbnail_url', () => {

    test('constructs the Kaltura thumbnail URL deterministically from the entry id', () => {
        expect(KALTURA_SERVICE.build_kaltura_thumbnail_url('1_ewyekww5')).toBe(
            'https://cdn.test.kaltura.com/p/12345/sp/1234500/thumbnail/entry_id/1_ewyekww5/width/400/height/400'
        );
    });

    test('returns an empty string when the entry id is missing', () => {
        expect(KALTURA_SERVICE.build_kaltura_thumbnail_url('')).toBe('');
        expect(KALTURA_SERVICE.build_kaltura_thumbnail_url(null)).toBe('');
        expect(KALTURA_SERVICE.build_kaltura_thumbnail_url(undefined)).toBe('');
    });
});

describe('kaltura_thumbnail_url_sql', () => {

    afterAll(async () => { await knex.destroy(); });

    test('derives the URL at query time from the alias entry id, aliased as out_alias', () => {
        const sql = KALTURA_SERVICE
            .kaltura_thumbnail_url_sql(knex, 'media_lib', 'media_kaltura_thumbnail_url')
            .toString();
        // Only Kaltura rows with an entry id derive; everything else keeps the stored column.
        expect(sql).toContain('`media_lib`.`ingest_method`');
        expect(sql).toContain("'kaltura'");
        expect(sql).toContain('`media_lib`.`kaltura_entry_id`');
        // Canonical URL format, mirroring build_kaltura_thumbnail_url.
        expect(sql).toContain('https://cdn.test.kaltura.com/p/12345/sp/1234500/thumbnail/entry_id/');
        expect(sql).toContain('/width/400/height/400');
        // Fallback to the stored column, output under the requested alias.
        expect(sql).toContain('`media_lib`.`kaltura_thumbnail_url`');
        expect(sql).toContain('`media_kaltura_thumbnail_url`');
    });

    test('uses the supplied alias and output alias verbatim', () => {
        const sql = KALTURA_SERVICE
            .kaltura_thumbnail_url_sql(knex, 'hero_lib', 'hero_kaltura_thumbnail_url')
            .toString();
        expect(sql).toContain('`hero_lib`.`kaltura_entry_id`');
        expect(sql).toContain('as `hero_kaltura_thumbnail_url`');
    });
});
