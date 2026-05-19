// @vitest-environment jsdom

/**
 * Unit tests for the upload modal Item Type auto-population.
 *
 * The Item Type <select> must carry data-selected derived from the
 * uploaded file's media type so the shared subjects widget pre-selects it
 * (same mechanism as the repo import modal): image → "still image",
 * pdf → "text"; nothing for other media types.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/media-library/modals.upload.module.js',
);

function fresh_endpoints() {
    return {
        media_records: { post: { endpoint: '/exhibits-dashboard/api/v1/media/library' } },
        upload: {
            get: { endpoint: '/exhibits-dashboard/api/v1/media/library/upload/thumbnail' },
            delete: { endpoint: '/exhibits-dashboard/api/v1/media/library/upload' },
        },
    };
}

function fresh_helper() {
    return {
        escape_html: (s) => (s == null ? '' : String(s)),
        decode_html_entities: (s) => s,
        get_media_type_icon: () => 'fa-file-o',
        get_media_type_label: () => 'Type',
        format_file_size: () => '1 KB',
        clean_filename_for_title: (s) => s,
        build_media_url: () => '',
        get_thumbnail_url_for_media: () => '/ph.png',
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

function make_file(media_type, overrides = {}) {
    return Object.assign({
        filename: 'f', original_name: 'f', media_type,
        file_size: 1, mime_type: 'x', uuid: 'u', storage_path: 's', thumbnail_path: '', metadata: {},
    }, overrides);
}

describe('mediaModalsModule — Item Type auto-population', () => {

    beforeAll(() => {
        globalThis.endpointsModule = { get_media_library_endpoints: () => fresh_endpoints() };
        globalThis.helperMediaLibraryModule = fresh_helper();
        globalThis.authModule = { get_user_token: () => 'tok', logout: () => {} };
        globalThis.httpModule = { req: () => Promise.resolve({ status: 200, data: { success: true } }) };
        globalThis.repoSubjectsModule = {
            populate_subjects_dropdowns: () => {},
            validate_required_fields: () => true,
        };
        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(/^const\s+mediaModalsModule\s*=/m, 'globalThis.mediaModalsModule =');
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        globalThis.endpointsModule = { get_media_library_endpoints: () => fresh_endpoints() };
        globalThis.helperMediaLibraryModule = fresh_helper();
        globalThis.authModule = { get_user_token: () => 'tok', logout: () => {} };
        globalThis.repoSubjectsModule = {
            populate_subjects_dropdowns: () => {},
            validate_required_fields: () => true,
        };
        document.body.innerHTML = MODAL_DOM;
    });

    const item_type_select = () =>
        document.querySelector('.file-form-card[data-file-index="0"] select[name="item_type"]');

    it('image → data-selected="still image"', () => {
        mediaModalsModule.open_uploaded_media_modal([make_file('image')], () => {});
        expect(item_type_select().getAttribute('data-selected')).toBe('still image');
    });

    it('pdf → data-selected="text"', () => {
        mediaModalsModule.open_uploaded_media_modal([make_file('pdf')], () => {});
        expect(item_type_select().getAttribute('data-selected')).toBe('text');
    });

    it('other media types get no data-selected (left for the user to choose)', () => {
        for (const mt of ['audio', 'video', 'unknown']) {
            document.body.innerHTML = MODAL_DOM;
            mediaModalsModule.open_uploaded_media_modal([make_file(mt)], () => {});
            expect(item_type_select().hasAttribute('data-selected')).toBe(false);
        }
    });

    it('the Item Type select is still required and present', () => {
        mediaModalsModule.open_uploaded_media_modal([make_file('image')], () => {});
        const sel = item_type_select();
        expect(sel).not.toBeNull();
        expect(sel.hasAttribute('required')).toBe(true);
    });
});
