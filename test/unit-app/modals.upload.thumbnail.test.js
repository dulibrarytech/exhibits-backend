// @vitest-environment jsdom

/**
 * Unit tests for the upload modal staged-thumbnail preview wiring.
 *
 * The preview must point at the staged thumbnail endpoint (served by
 * on-disk path) — NOT the record-keyed endpoint, which 404s before Save.
 * Falls back to the static placeholder when there is no thumbnail_path,
 * no endpoint, or no auth token for the <img src>.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { load_browser_module } = require('./helpers/load_module');
const { auth_stub, rte_stub } = require('./helpers/stubs');

const STAGED_ENDPOINT = '/exhibits-dashboard/api/v1/media/library/upload/thumbnail';
const PLACEHOLDER = '/exhibits-dashboard/static/images/PLACEHOLDER-tn.png';

function fresh_endpoints() {
    return {
        media_records: { post: { endpoint: '/exhibits-dashboard/api/v1/media/library' } },
        upload: {
            get: { endpoint: STAGED_ENDPOINT },
            delete: { endpoint: '/exhibits-dashboard/api/v1/media/library/upload' },
        },
    };
}

function fresh_helper() {
    return {
        escape_html: (s) => (s == null ? '' : String(s)),
        decode_html_entities: (s) => s,
        get_media_type_icon: () => 'fa-file-image-o',
        get_media_type_label: () => 'Image',
        format_file_size: () => '97.9 KB',
        clean_filename_for_title: (s) => s,
        build_media_url: () => '',
        // The module aliases the helper's staged-thumbnail builder; mirror
        // its contract (path-keyed staged endpoint, null when there is no
        // path) so the preview assertions below exercise the real shape.
        build_uploaded_thumbnail_url: (thumbnail_path) => (
            thumbnail_path ? STAGED_ENDPOINT + '?path=' + encodeURIComponent(thumbnail_path) : null
        ),
        // Sentinel placeholder so fallback is unambiguous in assertions.
        get_thumbnail_url_for_media: () => PLACEHOLDER,
        HTTP_STATUS: { OK: 200, CREATED: 201, BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404 },
        show_bootstrap_modal: () => {},
        hide_bootstrap_modal: () => {},
        wire_image_fallbacks: () => {},
    };
}

const MODAL_DOM =
    '<div id="uploaded-media-modal">' +
    '  <span id="modal-validation-message"></span>' +
    '  <button id="uploaded-media-done-btn" style="display:none"></button>' +
    '  <p id="upload-summary-text"></p>' +
    '  <div id="uploaded-files-forms-container"></div>' +
    '  <input type="hidden" id="modal-all-files">' +
    '</div>';

function make_file(overrides = {}) {
    return Object.assign({
        filename: 'u0.jpg',
        original_name: 'The Ten Commandments.jpg',
        media_type: 'image',
        file_size: 97900,
        mime_type: 'image/jpeg',
        uuid: '015acaca-7811-470e-b8bf-a1ff0f5ad03b',
        storage_path: 'images/01/5a/015acaca-7811-470e-b8bf-a1ff0f5ad03b.jpg',
        thumbnail_path: 'thumbnails/01/5a/015acaca-7811-470e-b8bf-a1ff0f5ad03b_thumb.jpg',
        metadata: {},
    }, overrides);
}

describe('mediaModalsModule — staged thumbnail preview', () => {

    beforeAll(() => {
        globalThis.endpointsModule = { get_media_library_endpoints: () => fresh_endpoints() };
        globalThis.helperMediaLibraryModule = fresh_helper();
        globalThis.authModule = auth_stub('unit-test-token', { logout: () => {} });
        globalThis.httpModule = { req: () => Promise.resolve({ status: 200, data: { success: true } }) };
        /*
         * The subjects block is built by the real repoSubjectsModule now, so
         * load it rather than stub the builder. Its network-bound members are
         * not reached by build_subjects_html.
         */
        load_browser_module(
            'public/app/media-library/helper.repo.subjects.module.js',
            'repoSubjectsModule',
        );
        globalThis.repoSubjectsModule.populate_subjects_dropdowns = () => {};
        globalThis.repoSubjectsModule.validate_required_fields = () => true;

        load_browser_module(
            'public/app/media-library/modals.upload.module.js',
            'mediaModalsModule',
        );
    });

    beforeEach(() => {
        // Rich text fields read through rteModule; back the stub with the
        // same DOM elements the fixtures populate via .value.
        globalThis.rteModule = rte_stub();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});

        globalThis.endpointsModule = { get_media_library_endpoints: () => fresh_endpoints() };
        globalThis.helperMediaLibraryModule = fresh_helper();
        globalThis.authModule = auth_stub('unit-test-token', { logout: () => {} });
        globalThis.httpModule = { req: () => Promise.resolve({ status: 200, data: { success: true } }) };
        globalThis.repoSubjectsModule.populate_subjects_dropdowns = () => {};
        globalThis.repoSubjectsModule.validate_required_fields = () => true;
        document.body.innerHTML = MODAL_DOM;
    });

    const preview_src = () => {
        const img = document.querySelector('.file-form-card[data-file-index="0"] .file-preview img');
        return img ? img.getAttribute('src') : null;
    };

    it('points the preview at the staged endpoint with the encoded path', () => {
        mediaModalsModule.open_uploaded_media_modal([make_file()], () => {});
        const src = preview_src();
        expect(src).not.toBeNull();
        expect(src.startsWith(STAGED_ENDPOINT + '?path=')).toBe(true);
        expect(src).toContain(
            'path=' + encodeURIComponent('thumbnails/01/5a/015acaca-7811-470e-b8bf-a1ff0f5ad03b_thumb.jpg')
        );
        // Must NOT use the record-keyed endpoint (the bug being fixed).
        expect(src).not.toContain('/thumbnail/015acaca');
    });

    /*
     * The route authenticates from the HttpOnly cookie, which the verifier
     * reads before any query parameter, so a token in the <img src> was never
     * used — only leaked into access logs and history. Pin that it stays out
     * even with a session token in localStorage, and that a missing token no
     * longer suppresses the request (a signed-out request 401s into the
     * onerror placeholder instead).
     */
    it('never puts the session JWT in the preview URL', () => {
        mediaModalsModule.open_uploaded_media_modal([make_file()], () => {});
        const src = preview_src();
        expect(src).not.toMatch(/[?&]token=/);
        expect(src).not.toContain('unit-test-token');
    });

    it('still points at the staged endpoint when no token is in localStorage', () => {
        globalThis.authModule = { get_user_token: () => false, logout: () => {} };
        mediaModalsModule.open_uploaded_media_modal([make_file()], () => {});
        expect(preview_src().startsWith(STAGED_ENDPOINT + '?path=')).toBe(true);
    });

    it('falls back to the static placeholder when the file has no thumbnail_path', () => {
        mediaModalsModule.open_uploaded_media_modal([make_file({ thumbnail_path: '' })], () => {});
        expect(preview_src()).toBe(PLACEHOLDER);
    });

    it('uses the staged endpoint for PDFs too', () => {
        mediaModalsModule.open_uploaded_media_modal([make_file({
            media_type: 'pdf',
            mime_type: 'application/pdf',
            original_name: 'doc.pdf',
            thumbnail_path: 'thumbnails/01/5a/doc_thumb.jpg',
        })], () => {});
        const src = preview_src();
        expect(src.startsWith(STAGED_ENDPOINT + '?path=')).toBe(true);
    });
});
