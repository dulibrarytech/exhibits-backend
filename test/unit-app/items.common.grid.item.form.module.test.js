// @vitest-environment jsdom
//
// Unit tests for public/app/grid-items/items.common.grid.item.form.module.js.
//
// Covers:
//   - obj.populate_media_previews — DOM rewrites for hero/thumbnail areas,
//     keyed off the record's media metadata (kaltura / repository / uploaded
//     paths through build_thumbnail_url, plus the placeholder fallback)
//   - obj.get_common_grid_item_form_fields — text/media path branching,
//     required-field validation, layout/media_width radio extraction,
//     is_embedded checkbox flattening
//
// init() is async + auth/nav-bound and stays in integration coverage.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/grid-items/items.common.grid.item.form.module.js',
);

const APP_PATH = '/exhibits-dashboard';

function build_form() {
    document.body.innerHTML = `
        <div id="message"></div>
        <input type="text" id="item-title-input" />
        <input type="text" id="item-text-input" />
        <select id="is-published">
            <option value=""></option>
            <option value="0">No</option>
            <option value="1">Yes</option>
        </select>

        <input type="hidden" id="item-media-uuid" />
        <input type="hidden" id="item-media-uuid-prev" />
        <input type="hidden" id="item-media-type" />
        <input type="hidden" id="item-mime-type" />
        <input type="hidden" id="thumbnail-media-uuid" />
        <input type="hidden" id="thumbnail-media-uuid-prev" />

        <div id="item-media-display"></div>
        <div id="thumbnail-image-display"></div>
        <span id="item-media-filename-display"></span>
        <span id="thumbnail-filename-display"></span>
        <a href="#" id="item-media-trash" style="display:none;"></a>
        <a href="#" id="thumbnail-trash" style="display:none;"></a>

        <input type="radio" name="layout" value="layout_a" />
        <input type="radio" name="layout" value="layout_b" />
        <input type="radio" name="media_width" value="50" />
        <input type="radio" name="media_width" value="100" />

        <input type="checkbox" id="embed-item" />
    `;
}

function navigate(pathname) {
    window.history.pushState({}, '', pathname);
}

describe('itemsCommonGridItemFormModule', () => {

    beforeAll(() => {
        // The module reads window.localStorage.getItem('exhibits_app_path')
        // at IIFE-definition time. vitest's jsdom env exposes localStorage
        // as a bare {} (no getItem), so install a working stub before eval.
        const fake_storage = (() => {
            const store = new Map([['exhibits_app_path', APP_PATH]]);
            return {
                getItem: (k) => (store.has(k) ? store.get(k) : null),
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: (k) => store.delete(k),
                clear: () => store.clear(),
            };
        })();
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: fake_storage,
        });

        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+itemsCommonGridItemFormModule\s*=/m,
            'globalThis.itemsCommonGridItemFormModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Bare-name dependencies. build_thumbnail_url calls
        // authModule.get_user_token; get_common_grid_item_form_fields uses
        // helperModule.get_checked_radio_button.
        globalThis.authModule = {
            get_user_token: () => 'test-token',
        };
        globalThis.helperModule = {
            get_checked_radio_button: (els) => {
                for (const el of els) {
                    if (el.checked) return el.value;
                }
                return '';
            },
            get_parameter_by_name: () => null,
        };
        // Phase 3b added set_field_error / clear_field_error calls
        // alongside the existing set_alert summary, so the form-fields
        // method can wire aria-invalid + aria-describedby. Stub all three.
        globalThis.domModule = {
            set_alert: vi.fn(),
            set_field_error: vi.fn(),
            clear_field_error: vi.fn(),
        };

        navigate('/');
        build_form();
    });

    describe('populate_media_previews', () => {

        it('is a no-op when record is null or undefined', () => {
            globalThis.itemsCommonGridItemFormModule.populate_media_previews(null);
            globalThis.itemsCommonGridItemFormModule.populate_media_previews(undefined);
            expect(document.querySelector('#item-media-uuid').value).toBe('');
            expect(document.querySelector('#thumbnail-media-uuid').value).toBe('');
        });

        it('is a no-op when neither media_uuid nor thumbnail_media_uuid is present', () => {
            globalThis.itemsCommonGridItemFormModule.populate_media_previews({
                title: 'No media',
            });
            expect(document.querySelector('#item-media-uuid').value).toBe('');
            expect(document.querySelector('#thumbnail-media-uuid').value).toBe('');
        });

        it('writes media metadata into hidden inputs when media_uuid is present', () => {
            globalThis.itemsCommonGridItemFormModule.populate_media_previews({
                media_uuid: 'media-uuid-1',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_thumbnail_path: '/thumbs/abc.jpg',
            });

            expect(document.querySelector('#item-media-uuid').value).toBe('media-uuid-1');
            expect(document.querySelector('#item-media-uuid-prev').value).toBe('media-uuid-1');
            expect(document.querySelector('#item-media-type').value).toBe('image');
            expect(document.querySelector('#item-mime-type').value).toBe('image/jpeg');
        });

        it('renders an <img> + filename + visible trash for an uploaded asset', () => {
            globalThis.itemsCommonGridItemFormModule.populate_media_previews({
                media_uuid: 'media-uuid-1',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_thumbnail_path: '/thumbs/abc.jpg',
                title: 'My photo',
            });

            const display = document.querySelector('#item-media-display');
            const img = display.querySelector('img');
            expect(img).not.toBeNull();
            // Uploaded path uses the media-library thumbnail endpoint with token
            expect(img.src).toContain(`${APP_PATH}/api/v1/media/library/thumbnail/media-uuid-1`);
            expect(img.src).toContain('token=test-token');
            expect(img.alt).toBe('My photo');

            expect(document.querySelector('#item-media-filename-display').textContent)
                .toBe('My photo');
            expect(document.querySelector('#item-media-trash').style.display).toBe('inline');
        });

        it('uses the kaltura thumbnail URL (and upgrades http→https) for kaltura assets', () => {
            globalThis.itemsCommonGridItemFormModule.populate_media_previews({
                media_uuid: 'k-uuid',
                media_ingest_method: 'kaltura',
                media_kaltura_thumbnail_url: 'http://kaltura.example/thumb/abc.jpg',
                title: 'Kaltura clip',
            });

            const img = document.querySelector('#item-media-display img');
            expect(img.src).toBe('https://kaltura.example/thumb/abc.jpg');
        });

        it('uses the repo thumbnail endpoint for repository assets', () => {
            globalThis.itemsCommonGridItemFormModule.populate_media_previews({
                media_uuid: 'r-uuid',
                media_ingest_method: 'repository',
                media_repo_uuid: 'repo-xyz',
                title: 'Repo asset',
            });

            const img = document.querySelector('#item-media-display img');
            expect(img.src).toContain(`${APP_PATH}/api/v1/media/library/repo/thumbnail`);
            expect(img.src).toContain('uuid=repo-xyz');
            expect(img.src).toContain('token=test-token');
        });

        it('falls back to a placeholder icon when no thumbnail URL can be built', () => {
            globalThis.itemsCommonGridItemFormModule.populate_media_previews({
                media_uuid: 'unknown-uuid',
                item_type: 'audio',
            });

            const display = document.querySelector('#item-media-display');
            expect(display.querySelector('img')).toBeNull();
            const placeholder = display.querySelector('.media-placeholder');
            expect(placeholder).not.toBeNull();
            // audio media type → fa-file-audio-o
            expect(placeholder.querySelector('i').className).toContain('fa-file-audio-o');
            expect(placeholder.querySelector('span').textContent).toBe('audio');
        });

        it('populates the thumbnail preview when thumbnail_media_uuid is present', () => {
            globalThis.itemsCommonGridItemFormModule.populate_media_previews({
                thumbnail_media_uuid: 'thumb-uuid',
                thumbnail_media_thumbnail_path: '/thumbs/xyz.jpg',
                thumbnail_media_name: 'Thumb name',
            });

            expect(document.querySelector('#thumbnail-media-uuid').value).toBe('thumb-uuid');
            expect(document.querySelector('#thumbnail-media-uuid-prev').value).toBe('thumb-uuid');
            const img = document.querySelector('#thumbnail-image-display img');
            expect(img).not.toBeNull();
            expect(img.alt).toBe('Thumb name');
            expect(document.querySelector('#thumbnail-trash').style.display).toBe('inline');
        });
    });

    describe('get_common_grid_item_form_fields', () => {

        it('returns false on a text path with empty text', () => {
            navigate('/grid-items/standard/text/edit');

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(),
                'danger',
                'Please enter "Text" for this item',
            );
        });

        it('returns false on a media path with no media_uuid', () => {
            navigate('/grid-items/standard/media/edit');

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(),
                'danger',
                'Please select a media item',
            );
        });

        it('returns the assembled item on a valid text path', () => {
            navigate('/grid-items/standard/text/add');
            document.querySelector('#item-title-input').value = 'A text item';
            document.querySelector('#item-text-input').value = 'Body copy';
            document.querySelector('#is-published').value = '1';
            document.querySelector('input[name="layout"][value="layout_a"]').checked = true;
            document.querySelector('input[name="media_width"][value="50"]').checked = true;
            document.querySelector('#embed-item').checked = true;

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(result).toMatchObject({
                title: 'A text item',
                text: 'Body copy',
                is_published: '1',
                item_type: 'text',
                mime_type: 'text/plain',
                layout: 'layout_a',
                media_width: '50',
                is_embedded: 1,
            });
        });

        it('returns the assembled item on a valid media path', () => {
            navigate('/grid-items/standard/media/add');
            document.querySelector('#item-title-input').value = 'A media item';
            document.querySelector('#item-media-uuid').value = 'media-uuid-1';
            document.querySelector('#item-media-type').value = 'image';
            document.querySelector('#item-mime-type').value = 'image/jpeg';
            document.querySelector('#thumbnail-media-uuid').value = 'thumb-uuid';

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(result).toMatchObject({
                title: 'A media item',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-1',
                thumbnail_media_uuid: 'thumb-uuid',
            });
        });

        it('defaults item_type/mime_type to text/plain on non-text non-media paths', () => {
            navigate('/grid-items/standard/other/edit');
            document.querySelector('#item-title-input').value = 'Other item';

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(result.item_type).toBe('text');
            expect(result.mime_type).toBe('text/plain');
        });

        it('serializes is_embedded as 0 when the checkbox is unchecked', () => {
            navigate('/grid-items/standard/text/add');
            document.querySelector('#item-text-input').value = 'present';
            document.querySelector('#embed-item').checked = false;

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(result.is_embedded).toBe(0);
        });

        it('routes layout/media_width through helperModule.get_checked_radio_button', () => {
            navigate('/grid-items/standard/text/add');
            document.querySelector('#item-text-input').value = 'present';
            const spy = vi.fn(() => 'from-spy');
            globalThis.helperModule.get_checked_radio_button = spy;

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(spy).toHaveBeenCalledTimes(2);
            expect(result.layout).toBe('from-spy');
            expect(result.media_width).toBe('from-spy');
        });

        it('omits is_published when #is-published is missing from the DOM', () => {
            navigate('/grid-items/standard/text/add');
            document.querySelector('#item-text-input').value = 'present';
            document.querySelector('#is-published').remove();

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(result).not.toHaveProperty('is_published');
        });

        it('returns false and renders an alert on an unexpected error', () => {
            navigate('/grid-items/standard/text/add');
            document.querySelector('#item-text-input').value = 'present';
            globalThis.helperModule.get_checked_radio_button = () => {
                throw new Error('boom');
            };

            const result = globalThis.itemsCommonGridItemFormModule
                .get_common_grid_item_form_fields();

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(),
                'danger',
                'boom',
            );
        });
    });
});
