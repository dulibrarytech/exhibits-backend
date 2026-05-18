// @vitest-environment jsdom
//
// Unit tests for helperMediaLibraryModule.build_uploaded_thumbnail_url —
// the single shared builder for STAGED (not-yet-saved) upload thumbnail
// URLs. Both the upload modal card preview and the inline item-form
// preview use it; the record-keyed endpoint 404s before Save.
//
// Module-load shim mirrors helper.media.library.module.test.js.
//
// Copyright 2026 University of Denver
// Licensed under the Apache License, Version 2.0

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/media-library/helper.media.library.module.js',
);

const UPLOAD_TN_ENDPOINT = '/exhibits-dashboard/api/v1/media/library/upload/thumbnail';

function endpoints_with_upload() {
    return { upload: { get: { endpoint: UPLOAD_TN_ENDPOINT } } };
}

describe('helperMediaLibraryModule.build_uploaded_thumbnail_url', () => {

    beforeAll(() => {
        globalThis.endpointsModule = { get_media_library_endpoints: () => endpoints_with_upload() };
        globalThis.authModule = { get_user_token: () => 'unit-test-token' };

        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+helperMediaLibraryModule\s*=/m,
            'globalThis.helperMediaLibraryModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        globalThis.endpointsModule = { get_media_library_endpoints: () => endpoints_with_upload() };
        globalThis.authModule = { get_user_token: () => 'unit-test-token' };
    });

    const REL = 'thumbnails/01/5a/015acaca-7811-470e-b8bf-a1ff0f5ad03b_thumb.jpg';

    it('builds the staged URL with the encoded path and token', () => {
        const url = helperMediaLibraryModule.build_uploaded_thumbnail_url(REL);
        expect(url).toBe(
            UPLOAD_TN_ENDPOINT +
            '?path=' + encodeURIComponent(REL) +
            '&token=' + encodeURIComponent('unit-test-token')
        );
        // Must NOT be the record-keyed endpoint (the bug being fixed).
        expect(url).not.toContain('/thumbnail/');
    });

    it('returns null when no thumbnail_path is given', () => {
        expect(helperMediaLibraryModule.build_uploaded_thumbnail_url('')).toBeNull();
        expect(helperMediaLibraryModule.build_uploaded_thumbnail_url(undefined)).toBeNull();
        expect(helperMediaLibraryModule.build_uploaded_thumbnail_url(null)).toBeNull();
    });

    it('returns null when there is no auth token (caller falls back to placeholder)', () => {
        globalThis.authModule = { get_user_token: () => false };
        expect(helperMediaLibraryModule.build_uploaded_thumbnail_url(REL)).toBeNull();
    });

    it('returns null and warns when the upload thumbnail endpoint is not configured', () => {
        globalThis.endpointsModule = { get_media_library_endpoints: () => ({}) };
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(helperMediaLibraryModule.build_uploaded_thumbnail_url(REL)).toBeNull();
        expect(warn).toHaveBeenCalled();
    });

    it('url-encodes a path containing spaces / special characters', () => {
        const tricky = 'thumbnails/a b/c&d/x y_thumb.jpg';
        const url = helperMediaLibraryModule.build_uploaded_thumbnail_url(tricky);
        expect(url).toContain('?path=' + encodeURIComponent(tricky));
        expect(url).not.toContain(' ');
    });
});
