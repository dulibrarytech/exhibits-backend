// @vitest-environment jsdom
//
// Unit tests for the record-fetch / form-population / media-picker APIs added
// to public/app/exhibits/exhibits.common.form.module.js, which the exhibit
// edit form, details page and styles form now all share.

'use strict';

const { load_browser_module } = require('./helpers/load_module');

const EXHIBIT_ENDPOINTS = {
    exhibits: {
        exhibit_records: {
            endpoints: { get: { endpoint: '/api/v1/exhibits/:exhibit_id' } },
        },
        exhibit_media_library: {
            get: { endpoint: '/api/v1/exhibits/:exhibit_id/media-library' },
        },
    },
};

function build_form() {
    document.body.innerHTML = `
        <div id="message"></div>
        <h1 id="exhibit-title"></h1>
        <p id="created"></p>
        <input id="is-published" />
        <textarea id="exhibit-title-input"></textarea>
        <textarea id="exhibit-sub-title-input"></textarea>
        <textarea id="exhibit-description-input"></textarea>
        <textarea id="exhibit-about-the-curators-input"></textarea>
        <input id="exhibit-owner" />
        <input type="checkbox" id="is-featured" />
        <input type="checkbox" id="is-student-curated" />
        <input type="checkbox" id="is-content-advisory" />
        <input id="exhibit-alert-text-input" />
        <input type="radio" name="banner_template" value="banner_1" />
        <input type="radio" name="banner_template" value="banner_2" />

        <div id="hero-image-display"></div>
        <div id="hero-image-filename-display"></div>
        <input type="hidden" id="hero-image-media-uuid" />
        <input type="hidden" id="hero-image-media-uuid-prev" />
        <div id="hero-image-media-name-display-group" style="display: none;">
            <input id="hero-image-media-name-display" />
        </div>
        <a id="hero-trash" style="display: none;"></a>
        <input type="hidden" id="hero-image" />
        <input type="hidden" id="hero-image-prev" />
        <div id="hero-legacy-migrate" style="display: none;"></div>
        <button id="pick-hero-image-btn"></button>

        <div id="thumbnail-image-display"></div>
        <div id="thumbnail-filename-display"></div>
        <input type="hidden" id="thumbnail-media-uuid" />
        <input type="hidden" id="thumbnail-media-uuid-prev" />
        <div id="thumbnail-media-name-display-group" style="display: none;">
            <input id="thumbnail-media-name-display" />
        </div>
        <a id="thumbnail-trash" style="display: none;"></a>
        <input type="hidden" id="thumbnail-image" />
        <input type="hidden" id="thumbnail-image-prev" />
        <div id="thumbnail-legacy-migrate" style="display: none;"></div>
        <button id="pick-thumbnail-btn"></button>
    `;
}

describe('exhibitsCommonFormModule — record fetch and form population', () => {

    let api_calls;
    let record_response;
    let bindings_response;

    beforeAll(() => {
        globalThis.endpointsModule = {
            get_app_path: () => '/exhibits-dashboard',
            get_exhibits_endpoints: () => EXHIBIT_ENDPOINTS,
            build: (template, params) => {
                let out = template;
                for (const [k, v] of Object.entries(params)) {
                    out = out.replace(':' + k, encodeURIComponent(String(v)));
                }
                return out;
            },
        };

        load_browser_module(
            'public/app/exhibits/exhibits.common.form.module.js',
            'exhibitsCommonFormModule',
        );
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});

        build_form();
        window.history.replaceState({}, '', '/exhibits/edit?exhibit_id=abc-123');

        api_calls = [];
        record_response = {
            status: 200,
            data: { data: { uuid: 'abc-123', title: 'A title' } },
        };
        bindings_response = { status: 200, data: { data: [] } };

        globalThis.helperModule = {
            get_parameter_by_name: (name) => new URL(window.location.href).searchParams.get(name),
            unescape: (v) => v,
            format_date: (d) => d.toISOString(),
            render_record_meta: vi.fn(),
        };

        globalThis.domModule = { set_alert: vi.fn() };

        globalThis.authModule = {
            get_user_profile_data: () => ({ uid: 42 }),
            redirect_to_auth: vi.fn(),
        };

        globalThis.rteModule = {
            set_html: (id, html) => {
                const el = document.getElementById(id);
                if (el) el.value = html;
            },
        };

        globalThis.exhibitsModule = {
            get_exhibit_title: () => Promise.resolve('Fetched title'),
        };

        globalThis.httpModule = {
            api: (options) => {
                api_calls.push(options);
                return Promise.resolve(
                    options.url.includes('media-library') ? bindings_response : record_response,
                );
            },
        };
    });

    describe('get_exhibit_record', () => {

        it('reads with ?type=edit&uid= by default and returns the record', async () => {
            const record = await globalThis.exhibitsCommonFormModule.get_exhibit_record();

            expect(record).toEqual({ uuid: 'abc-123', title: 'A title' });
            expect(api_calls[0].method).toBe('GET');
            expect(api_calls[0].url).toBe('/api/v1/exhibits/abc-123?type=edit&uid=42');
        });

        it('reads with ?type=details for the read-only page (no lock acquired)', async () => {
            await globalThis.exhibitsCommonFormModule.get_exhibit_record({ type: 'details' });
            expect(api_calls[0].url).toContain('type=details');
        });

        it('sets the page header title unless set_title is false', async () => {
            await globalThis.exhibitsCommonFormModule.get_exhibit_record();
            await Promise.resolve();
            expect(document.getElementById('exhibit-title').textContent).toBe('Fetched title');

            document.getElementById('exhibit-title').textContent = '';
            await globalThis.exhibitsCommonFormModule.get_exhibit_record({ set_title: false });
            await Promise.resolve();
            expect(document.getElementById('exhibit-title').textContent).toBe('');
        });

        it('returns null and alerts when exhibit_id is missing', async () => {
            window.history.replaceState({}, '', '/exhibits/edit');

            expect(await globalThis.exhibitsCommonFormModule.get_exhibit_record()).toBe(null);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                '#message', 'danger', 'Missing required parameter: exhibit_id',
            );
            expect(api_calls).toHaveLength(0);
        });

        it('redirects through authModule (not helperModule) when the profile is unusable', async () => {
            globalThis.authModule.get_user_profile_data = () => null;

            expect(await globalThis.exhibitsCommonFormModule.get_exhibit_record()).toBe(null);
            expect(globalThis.authModule.redirect_to_auth).toHaveBeenCalled();
        });

        it('reports a non-200, a missing envelope, and an empty result', async () => {
            record_response = { status: 500, data: {} };
            expect(await globalThis.exhibitsCommonFormModule.get_exhibit_record()).toBe(null);
            expect(globalThis.domModule.set_alert).toHaveBeenLastCalledWith(
                '#message', 'danger', 'Server returned status 500',
            );

            record_response = { status: 200, data: {} };
            expect(await globalThis.exhibitsCommonFormModule.get_exhibit_record()).toBe(null);
            expect(globalThis.domModule.set_alert).toHaveBeenLastCalledWith(
                '#message', 'danger', 'Invalid response structure from server',
            );

            record_response = { status: 200, data: { data: [] } };
            expect(await globalThis.exhibitsCommonFormModule.get_exhibit_record()).toBe(null);
            expect(globalThis.domModule.set_alert).toHaveBeenLastCalledWith(
                '#message', 'danger', 'Exhibit record not found',
            );
        });
    });

    describe('apply_record_to_form', () => {

        const full_record = {
            uuid: 'abc-123',
            title: 'Title',
            subtitle: 'Subtitle',
            description: 'Description',
            about_the_curators: 'Curators',
            owner: 7,
            is_published: 1,
            is_featured: 1,
            is_student_curated: 0,
            alert_text: 'Heads up',
            banner_template: 'banner_2',
            created_by: 'alice',
            created: '2026-01-01T00:00:00Z',
        };

        it('writes the text, owner, checkbox, advisory and banner fields', async () => {
            await globalThis.exhibitsCommonFormModule.apply_record_to_form(full_record);

            expect(document.getElementById('exhibit-title-input').value).toBe('Title');
            expect(document.getElementById('exhibit-sub-title-input').value).toBe('Subtitle');
            expect(document.getElementById('exhibit-description-input').value).toBe('Description');
            expect(document.getElementById('exhibit-about-the-curators-input').value).toBe('Curators');
            expect(document.getElementById('exhibit-owner').value).toBe('7');
            expect(document.getElementById('is-published').value).toBe('true');
            expect(document.getElementById('is-featured').checked).toBe(true);
            expect(document.getElementById('is-student-curated').checked).toBe(false);
            expect(document.getElementById('is-content-advisory').checked).toBe(true);
            expect(document.getElementById('exhibit-alert-text-input').value).toBe('Heads up');
            expect(document.querySelector('input[name="banner_template"][value="banner_2"]').checked).toBe(true);
        });

        it('delegates the audit line to helperModule.render_record_meta', async () => {
            await globalThis.exhibitsCommonFormModule.apply_record_to_form(full_record);
            expect(globalThis.helperModule.render_record_meta).toHaveBeenCalledWith('#created', full_record);
        });

        it('renders a media library binding into its slot', async () => {
            bindings_response = {
                status: 200,
                data: {
                    data: [{
                        media_role: 'hero_image',
                        media_uuid: 'media-1',
                        name: 'Hero.jpg',
                        thumbnail_path: 'thumbs/hero.jpg',
                    }],
                },
            };

            await globalThis.exhibitsCommonFormModule.apply_record_to_form(full_record, { editable: true });

            expect(document.getElementById('hero-image-media-uuid').value).toBe('media-1');
            expect(document.getElementById('hero-image-media-uuid-prev').value).toBe('media-1');
            expect(document.getElementById('hero-image-filename-display').textContent).toBe('Hero.jpg');
            expect(document.getElementById('hero-trash').style.display).toBe('inline');
            expect(document.getElementById('hero-image-media-name-display').value).toBe('Hero.jpg');
            expect(document.querySelector('#hero-image-display img').src)
                .toContain('/api/v1/media/library/thumbnail/media-1');
        });

        it('editable: false leaves the -prev tracker, trash and name display alone', async () => {
            bindings_response = {
                status: 200,
                data: {
                    data: [{
                        media_role: 'hero_image',
                        media_uuid: 'media-1',
                        name: 'Hero.jpg',
                        thumbnail_path: 'thumbs/hero.jpg',
                    }],
                },
            };

            await globalThis.exhibitsCommonFormModule.apply_record_to_form(full_record, { editable: false });

            expect(document.getElementById('hero-image-media-uuid').value).toBe('media-1');
            expect(document.getElementById('hero-image-media-uuid-prev').value).toBe('');
            expect(document.getElementById('hero-trash').style.display).toBe('none');
            expect(document.getElementById('hero-image-media-name-display').value).toBe('');
        });

        it('falls back to the legacy filename image, showing the migrate hint only when editable', async () => {
            const legacy = Object.assign({}, full_record, { thumbnail: 'old-thumb.jpg' });

            await globalThis.exhibitsCommonFormModule.apply_record_to_form(legacy, { editable: true });

            expect(document.getElementById('thumbnail-image').value).toBe('old-thumb.jpg');
            expect(document.getElementById('thumbnail-image-prev').value).toBe('old-thumb.jpg');
            expect(document.getElementById('thumbnail-legacy-migrate').style.display).toBe('block');
            expect(document.querySelector('#thumbnail-image-display img').src)
                .toContain('/api/v1/exhibits/abc-123/media/old-thumb.jpg');

            build_form();
            await globalThis.exhibitsCommonFormModule.apply_record_to_form(legacy, { editable: false });
            expect(document.getElementById('thumbnail-legacy-migrate').style.display).toBe('none');
            expect(document.getElementById('thumbnail-trash').style.display).toBe('none');
        });

        it('returns false for a missing record', async () => {
            expect(await globalThis.exhibitsCommonFormModule.apply_record_to_form(null)).toBe(false);
        });
    });

    describe('build_media_thumbnail_url', () => {

        it('prefers the Kaltura URL, then the repo endpoint, then the local thumbnail', () => {
            const build = globalThis.exhibitsCommonFormModule.build_media_thumbnail_url;

            expect(build({ ingest_method: 'kaltura', kaltura_thumbnail_url: 'https://cdn/x.jpg' }))
                .toBe('https://cdn/x.jpg');
            expect(build({ ingest_method: 'repository', repo_uuid: 'r 1' }))
                .toBe('/exhibits-dashboard/api/v1/media/library/repo/thumbnail?uuid=r%201');
            expect(build({ uuid: 'm1', thumbnail_path: 'p.jpg' }))
                .toBe('/exhibits-dashboard/api/v1/media/library/thumbnail/m1');
            expect(build({ uuid: 'm1' })).toBe('');
            expect(build(null)).toBe('');
        });

        it('never embeds a JWT in the URL', () => {
            const url = globalThis.exhibitsCommonFormModule.build_media_thumbnail_url({
                uuid: 'm1', thumbnail_path: 'p.jpg',
            });
            expect(url).not.toContain('token');
        });
    });

    describe('set_media_name_display', () => {

        it('fills the input and reveals its group, hiding it again when empty', () => {
            globalThis.exhibitsCommonFormModule.set_media_name_display('#hero-image-media-name-display', 'A name');
            expect(document.getElementById('hero-image-media-name-display').value).toBe('A name');
            expect(document.getElementById('hero-image-media-name-display-group').style.display).toBe('');

            globalThis.exhibitsCommonFormModule.set_media_name_display('#hero-image-media-name-display', '');
            expect(document.getElementById('hero-image-media-name-display').value).toBe('');
            expect(document.getElementById('hero-image-media-name-display-group').style.display).toBe('none');
        });
    });

    describe('wire_media_picker', () => {

        beforeEach(() => {
            globalThis.mediaPickerModule = { open: vi.fn() };
        });

        it('opens the picker with the slot\'s role, exhibit and previous selection', () => {
            document.getElementById('hero-image-media-uuid-prev').value = 'old-media';

            const wired = globalThis.exhibitsCommonFormModule.wire_media_picker({
                button_selector: '#pick-hero-image-btn',
                role: 'hero_image',
                exhibit_uuid: 'abc-123',
            });

            expect(wired).toBe(true);

            document.getElementById('pick-hero-image-btn').click();

            const opts = globalThis.mediaPickerModule.open.mock.calls[0][0];
            expect(opts.role).toBe('hero_image');
            expect(opts.exhibit_uuid).toBe('abc-123');
            expect(opts.previous_media_uuid).toBe('old-media');
            expect(opts.media_type_filter).toBe('image');
        });

        it('applies the selected asset to the whole slot', () => {
            globalThis.exhibitsCommonFormModule.wire_media_picker({
                button_selector: '#pick-thumbnail-btn',
                role: 'thumbnail',
                exhibit_uuid: null,
            });

            document.getElementById('pick-thumbnail-btn').click();
            document.getElementById('thumbnail-legacy-migrate').style.display = 'block';

            globalThis.mediaPickerModule.open.mock.calls[0][0].on_select({
                uuid: 'media-9',
                name: 'Picked.png',
                thumbnail_path: 'thumbs/picked.png',
            });

            expect(document.getElementById('thumbnail-media-uuid').value).toBe('media-9');
            expect(document.getElementById('thumbnail-media-uuid-prev').value).toBe('media-9');
            expect(document.getElementById('thumbnail-filename-display').textContent).toBe('Picked.png');
            expect(document.getElementById('thumbnail-media-name-display').value).toBe('Picked.png');
            expect(document.getElementById('thumbnail-trash').style.display).toBe('inline');
            expect(document.getElementById('thumbnail-legacy-migrate').style.display).toBe('none');
            expect(document.querySelector('#thumbnail-image-display img')).not.toBe(null);
        });

        it('returns false for an absent button or an unknown role', () => {
            expect(globalThis.exhibitsCommonFormModule.wire_media_picker({
                button_selector: '#nope', role: 'hero_image',
            })).toBe(false);

            expect(globalThis.exhibitsCommonFormModule.wire_media_picker({
                button_selector: '#pick-hero-image-btn', role: 'not-a-role',
            })).toBe(false);
        });
    });

    describe('clear_media_slot_ui / restore_media_placeholder', () => {

        it('empties every field of the slot and restores the placeholder', () => {
            document.getElementById('hero-image-media-uuid').value = 'media-1';
            document.getElementById('hero-image-media-uuid-prev').value = 'media-1';
            document.getElementById('hero-image').value = 'legacy.jpg';
            document.getElementById('hero-image-filename-display').textContent = 'legacy.jpg';
            document.getElementById('hero-image-display').innerHTML = '<img src="x" />';
            document.getElementById('hero-trash').style.display = 'inline';
            document.getElementById('hero-legacy-migrate').style.display = 'block';

            globalThis.exhibitsCommonFormModule.clear_media_slot_ui('hero_image');

            expect(document.getElementById('hero-image-media-uuid').value).toBe('');
            expect(document.getElementById('hero-image-media-uuid-prev').value).toBe('');
            expect(document.getElementById('hero-image').value).toBe('');
            expect(document.getElementById('hero-image-filename-display').textContent).toBe('');
            expect(document.getElementById('hero-trash').style.display).toBe('none');
            expect(document.getElementById('hero-legacy-migrate').style.display).toBe('none');
            expect(document.querySelector('#hero-image-display .media-placeholder span').textContent)
                .toBe('No image selected');
        });

        it('is a no-op for an unknown role or a missing container', () => {
            expect(() => globalThis.exhibitsCommonFormModule.clear_media_slot_ui('nope')).not.toThrow();
            expect(() => globalThis.exhibitsCommonFormModule.restore_media_placeholder('#nope')).not.toThrow();
        });
    });
});
