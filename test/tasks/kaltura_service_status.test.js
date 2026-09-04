'use strict';

/**
 * Kaltura service error-status contract (media-library/kaltura-service.js).
 *
 * The controller used to recover the HTTP status for a Kaltura failure by
 * string-matching the service's message — `includes('Unsupported media type')
 * ? 422 : includes('not found') ? 404 : 500` for get_kaltura_media, and
 * `includes('not found') ? 404 : 500` for the two category actions. The
 * service now tags `status` itself, the way iiif-service already did, and the
 * controller returns `result.status || 500` (DRY review 2026-09-03, cluster
 * O6).
 *
 * These tests pin the resulting codes so the move is provably status-for-status
 * identical to the string matching it replaced:
 *   - unsupported media type (get_kaltura_media only)  -> 422
 *   - anything whose message says "not found"          -> 404
 *   - everything else, including a malformed entry id  -> 500
 *
 * The Kaltura SDK is stubbed by replacing the methods on the required module
 * object (the service resolves them at call time), which works regardless of
 * how vi.mock treats a transitive CJS require.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

process.env.KALTURA_SECRET_KEY = process.env.KALTURA_SECRET_KEY || 'test-secret';
process.env.KALTURA_PARTNER_ID = process.env.KALTURA_PARTNER_ID || '1234567';
process.env.KALTURA_USER_ID = process.env.KALTURA_USER_ID || 'test-user';
process.env.KALTURA_CONF_UI_ID = process.env.KALTURA_CONF_UI_ID || '7654321';
process.env.KALTURA_EXHIBIT_CATEGORY_ID = process.env.KALTURA_EXHIBIT_CATEGORY_ID || '99';
process.env.KALTURA_METADATA_PROFILE_ID = process.env.KALTURA_METADATA_PROFILE_ID || '55';
process.env.KALTURA_CDN = process.env.KALTURA_CDN || 'https://cdn.test';

/*
 * The logger is silenced by spying on the shared log4 instance (the service
 * holds the same require-cached object); vi.mock does not intercept a
 * transitive CJS require. restoreMocks resets the spy, hence the re-arm in
 * beforeEach.
 */
const LOGGER = require('../../libs/log4');
const KALTURA = require('kaltura-client');
const KALTURA_SERVICE = require('../../media-library/kaltura-service');

const ENTRY_ID = '1_abc123';

/** Builds a stubbed SDK request whose execute() resolves to `response` */
const responds = (response) => ({ execute: vi.fn().mockResolvedValue(response) });

/** Builds a stubbed SDK request whose execute() rejects */
const rejects = (error) => ({ execute: vi.fn().mockRejectedValue(error) });

let original;

beforeEach(() => {
    vi.spyOn(LOGGER, 'module').mockReturnValue({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() });

    original = {
        session_start: KALTURA.services.session.start,
        media_get: KALTURA.services.media.get,
        category_add: KALTURA.services.categoryEntry.add,
        category_delete: KALTURA.services.categoryEntry.deleteAction
    };

    /* a session that always succeeds, so each test drives one failure only */
    KALTURA.services.session.start = vi.fn(() => responds('fake-ks'));
});

afterEach(() => {
    KALTURA.services.session.start = original.session_start;
    KALTURA.services.media.get = original.media_get;
    KALTURA.services.categoryEntry.add = original.category_add;
    KALTURA.services.categoryEntry.deleteAction = original.category_delete;
});

describe('get_kaltura_media — failure statuses', () => {

    it('unsupported media type -> 422 (only this method carries the 422 rule)', async () => {
        /* mediaType 2 is an image: not in the video/audio map */
        KALTURA.services.media.get = vi.fn(() => responds({ id: ENTRY_ID, mediaType: 2 }));

        const result = await KALTURA_SERVICE.get_kaltura_media(ENTRY_ID);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Unsupported media type');
        expect(result.status).toBe(422);
    });

    it('no media metadata -> 404 (message says "not found")', async () => {
        KALTURA.services.media.get = vi.fn(() => responds({ id: ENTRY_ID }));

        const result = await KALTURA_SERVICE.get_kaltura_media(ENTRY_ID);

        expect(result.message).toBe('Media metadata not found');
        expect(result.status).toBe(404);
    });

    it('a Kaltura API exception whose message says "not found" -> 404', async () => {
        KALTURA.services.media.get = vi.fn(() => responds({
            objectType: 'KalturaAPIException',
            message: 'Entry id "1_abc123" not found'
        }));

        const result = await KALTURA_SERVICE.get_kaltura_media(ENTRY_ID);

        expect(result.status).toBe(404);
    });

    it('any other Kaltura API exception -> 500', async () => {
        KALTURA.services.media.get = vi.fn(() => responds({
            objectType: 'KalturaAPIException',
            message: 'Invalid KS'
        }));

        const result = await KALTURA_SERVICE.get_kaltura_media(ENTRY_ID);

        expect(result.status).toBe(500);
    });

    it('a thrown error -> 500', async () => {
        KALTURA.services.media.get = vi.fn(() => rejects(new Error('socket hang up')));

        const result = await KALTURA_SERVICE.get_kaltura_media(ENTRY_ID);

        expect(result.message).toBe('Error retrieving Kaltura media: socket hang up');
        expect(result.status).toBe(500);
    });

    it('a malformed entry id -> 500, as the string matching always produced', async () => {
        const result = await KALTURA_SERVICE.get_kaltura_media('not a valid id!');

        expect(result.success).toBe(false);
        expect(result.status).toBe(500);
    });

    it('a success envelope carries no status (the controller answers 200)', async () => {
        KALTURA.services.media.get = vi.fn(() => responds({ id: ENTRY_ID, mediaType: 1, name: 'A video' }));

        const result = await KALTURA_SERVICE.get_kaltura_media(ENTRY_ID);

        expect(result.success).toBe(true);
        expect(result.status).toBeUndefined();
    });
});

describe('assign_kaltura_category — failure statuses', () => {

    it('an API exception whose message says "not found" -> 404', async () => {
        KALTURA.services.categoryEntry.add = vi.fn(() => responds({
            objectType: 'KalturaAPIException',
            message: 'Category not found'
        }));

        const result = await KALTURA_SERVICE.assign_kaltura_category(ENTRY_ID);

        expect(result.status).toBe(404);
    });

    it('an unexpected response -> 500', async () => {
        KALTURA.services.categoryEntry.add = vi.fn(() => responds({}));

        const result = await KALTURA_SERVICE.assign_kaltura_category(ENTRY_ID);

        expect(result.message).toBe('Failed to add entry to exhibits gallery');
        expect(result.status).toBe(500);
    });

    it('a thrown error -> 500', async () => {
        KALTURA.services.categoryEntry.add = vi.fn(() => rejects(new Error('boom')));

        const result = await KALTURA_SERVICE.assign_kaltura_category(ENTRY_ID);

        expect(result.status).toBe(500);
    });

    it('does not inherit the 422 rule — "Unsupported media type" is still 500 here', async () => {
        KALTURA.services.categoryEntry.add = vi.fn(() => responds({
            objectType: 'KalturaAPIException',
            message: 'Unsupported media type'
        }));

        const result = await KALTURA_SERVICE.assign_kaltura_category(ENTRY_ID);

        expect(result.status).toBe(500);
    });
});

describe('remove_kaltura_category — failure statuses', () => {

    it('an API exception whose message says "not found" -> 404', async () => {
        KALTURA.services.categoryEntry.deleteAction = vi.fn(() => responds({
            objectType: 'KalturaAPIException',
            message: 'Category entry not found'
        }));

        const result = await KALTURA_SERVICE.remove_kaltura_category(ENTRY_ID);

        expect(result.status).toBe(404);
    });

    it('any other API exception -> 500', async () => {
        KALTURA.services.categoryEntry.deleteAction = vi.fn(() => responds({
            objectType: 'KalturaAPIException',
            message: 'Access denied'
        }));

        const result = await KALTURA_SERVICE.remove_kaltura_category(ENTRY_ID);

        expect(result.status).toBe(500);
    });

    it('a thrown error -> 500', async () => {
        KALTURA.services.categoryEntry.deleteAction = vi.fn(() => rejects(new Error('boom')));

        const result = await KALTURA_SERVICE.remove_kaltura_category(ENTRY_ID);

        expect(result.status).toBe(500);
    });

    it('a success envelope carries no status', async () => {
        KALTURA.services.categoryEntry.deleteAction = vi.fn(() => responds({}));

        const result = await KALTURA_SERVICE.remove_kaltura_category(ENTRY_ID);

        expect(result.success).toBe(true);
        expect(result.status).toBeUndefined();
    });
});
