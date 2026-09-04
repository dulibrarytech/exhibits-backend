// @vitest-environment jsdom
//
// Unit tests for public/app/media-library/helper.media.library.module.js.
//
// helperMediaLibraryModule is the shared utility kit every other
// media-library module pulls from at module-load time:
//
//   const escape_html       = helperMediaLibraryModule.escape_html;
//   const HTTP_STATUS       = helperMediaLibraryModule.HTTP_STATUS;
//   const format_file_size  = helperMediaLibraryModule.format_file_size;
//   const build_thumbnail_url = helperMediaLibraryModule.build_thumbnail_url;
//   …
//
// Bugs here propagate to every list/edit/delete/upload flow, so unit
// coverage at this layer is the highest-ROI starting point for the
// media-library hop sequence (see playwright-proposal/modified-46
// README for the full plan).
//
// Module-load shim follows the same pattern as
// items.list.displays.module.test.js: read the source, rewrite the
// IIFE assignment to attach to globalThis, indirect-eval inside jsdom.
// The IIFE has NO module-load-time global captures (URL builders read
// `endpointsModule` lazily on each call), so the global stubs can be
// swapped between tests freely.

'use strict';

const { load_browser_module } = require('./helpers/load_module');
const { auth_stub, endpoints_stub } = require('./helpers/stubs');

const APP_PATH = '/exhibits-dashboard';
const MEDIA_BASE = `${APP_PATH}/api/v1/media/library`;

function fresh_endpoints() {
    return {
        media_thumbnail: {
            get: { endpoint: `${MEDIA_BASE}/thumbnail/:media_id` },
        },
        media_file: {
            get: { endpoint: `${MEDIA_BASE}/file/:media_id` },
        },
        repo_thumbnail: {
            get: { endpoint: `${MEDIA_BASE}/repo/thumbnail` },
        },
    };
}

// Minimal stand-in for endpointsModule.build (see endpoints.module.js):
// substitutes every :name placeholder with the URL-encoded value.
function build_endpoint(template, params) {
    return Object.entries(params || {}).reduce(
        (url, [key, value]) => url.replace(':' + key, encodeURIComponent(String(value))),
        template,
    );
}

describe('helperMediaLibraryModule', () => {

    beforeAll(() => {
        // Initial global stubs — individual tests override as needed.
        globalThis.endpointsModule = endpoints_stub({
            get_media_library_endpoints: () => fresh_endpoints(),
            build: build_endpoint,
        });
        globalThis.authModule = auth_stub('unit-test-token');

        load_browser_module(
            'public/app/media-library/helper.media.library.module.js',
            'helperMediaLibraryModule',
        );
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});

        // Reset endpoints + auth stubs to defaults; tests that need
        // alternate behavior re-stub on the global. URL builders read
        // these on every call, so swapping mid-test is safe.
        globalThis.endpointsModule = endpoints_stub({
            get_media_library_endpoints: () => fresh_endpoints(),
            build: build_endpoint,
        });
        globalThis.authModule = auth_stub('unit-test-token');
        // repoServiceModule is optional — only get_repo_thumbnail_url's
        // delegation branch reads it. Default to undefined so the
        // fallback branch runs.
        delete globalThis.repoServiceModule;

        document.body.innerHTML = '';
        window.localStorage.clear();
    });

    describe('HTTP_STATUS constants', () => {
        it('exposes the expected codes and is frozen', () => {
            expect(helperMediaLibraryModule.HTTP_STATUS.OK).toBe(200);
            expect(helperMediaLibraryModule.HTTP_STATUS.CREATED).toBe(201);
            expect(helperMediaLibraryModule.HTTP_STATUS.FORBIDDEN).toBe(403);
            expect(helperMediaLibraryModule.HTTP_STATUS.NOT_FOUND).toBe(404);
            // Object.freeze blocks assignment in strict mode and silently
            // drops it otherwise; either way the value must not change.
            const before = helperMediaLibraryModule.HTTP_STATUS.OK;
            try { helperMediaLibraryModule.HTTP_STATUS.OK = 999; } catch (_) {}
            expect(helperMediaLibraryModule.HTTP_STATUS.OK).toBe(before);
        });
    });

    describe('escape_html', () => {
        it('returns empty string for falsy input', () => {
            expect(helperMediaLibraryModule.escape_html(null)).toBe('');
            expect(helperMediaLibraryModule.escape_html(undefined)).toBe('');
            expect(helperMediaLibraryModule.escape_html('')).toBe('');
        });

        it('encodes <, >, & in injected markup', () => {
            const out = helperMediaLibraryModule.escape_html('<script>alert("x")</script>');
            expect(out).not.toContain('<script>');
            expect(out).toContain('&lt;script&gt;');
            expect(out).toContain('&lt;/script&gt;');
        });

        it('encodes double and single quotes for attribute-context safety', () => {
            // Bare attribute values like `<a title="${escape_html(x)}">`
            // break if x contains a literal `"`. The same applies to
            // single-quoted attributes. Both must be encoded.
            expect(helperMediaLibraryModule.escape_html('say "hi"'))
                .toBe('say &quot;hi&quot;');
            expect(helperMediaLibraryModule.escape_html("it's fine"))
                .toBe('it&#39;s fine');
        });

        it('passes plain text through unchanged', () => {
            expect(helperMediaLibraryModule.escape_html('hello world')).toBe('hello world');
        });
    });

    describe('decode_html_entities', () => {
        it('decodes named and numeric entities', () => {
            expect(helperMediaLibraryModule.decode_html_entities('&amp;')).toBe('&');
            expect(helperMediaLibraryModule.decode_html_entities('&#x27;')).toBe("'");
            expect(helperMediaLibraryModule.decode_html_entities('Tom&#39;s &amp; Jerry'))
                .toBe("Tom's & Jerry");
        });

        it('returns empty string for falsy input', () => {
            expect(helperMediaLibraryModule.decode_html_entities(null)).toBe('');
            expect(helperMediaLibraryModule.decode_html_entities('')).toBe('');
        });
    });

    describe('strip_html', () => {
        it('removes tags but keeps text content', () => {
            expect(helperMediaLibraryModule.strip_html('<p>hi <b>there</b></p>')).toBe('hi there');
        });

        it('returns empty string for falsy input', () => {
            expect(helperMediaLibraryModule.strip_html(undefined)).toBe('');
        });
    });

    describe('format_file_size', () => {
        it('returns "0 Bytes" for 0/null/undefined', () => {
            expect(helperMediaLibraryModule.format_file_size(0)).toBe('0 Bytes');
            expect(helperMediaLibraryModule.format_file_size(null)).toBe('0 Bytes');
            expect(helperMediaLibraryModule.format_file_size(undefined)).toBe('0 Bytes');
        });

        it('formats bytes-scale values', () => {
            expect(helperMediaLibraryModule.format_file_size(512)).toBe('512 Bytes');
        });

        it('formats KB / MB scale with two-decimal precision', () => {
            expect(helperMediaLibraryModule.format_file_size(1024)).toBe('1 KB');
            expect(helperMediaLibraryModule.format_file_size(1536)).toBe('1.5 KB');
            expect(helperMediaLibraryModule.format_file_size(1024 * 1024 * 2.5))
                .toBe('2.5 MB');
        });

        it('formats TB-scale values (sizes table extended past GB)', () => {
            const one_tb = Math.pow(1024, 4);
            expect(helperMediaLibraryModule.format_file_size(one_tb)).toBe('1 TB');
        });

        it('clamps oversized inputs to PB instead of producing "undefined"', () => {
            // 1 EB is past the sizes-table tail; clamp index to PB.
            const one_eb = Math.pow(1024, 6);
            expect(helperMediaLibraryModule.format_file_size(one_eb)).toBe('1024 PB');
        });

        it('returns "0 Bytes" for negative, NaN, Infinity, and non-number inputs', () => {
            expect(helperMediaLibraryModule.format_file_size(-1)).toBe('0 Bytes');
            expect(helperMediaLibraryModule.format_file_size(NaN)).toBe('0 Bytes');
            expect(helperMediaLibraryModule.format_file_size(Infinity)).toBe('0 Bytes');
            expect(helperMediaLibraryModule.format_file_size('1024')).toBe('0 Bytes');
        });
    });

    describe('clean_filename_for_title', () => {
        it('strips the extension', () => {
            expect(helperMediaLibraryModule.clean_filename_for_title('photo.jpg')).toBe('photo');
            expect(helperMediaLibraryModule.clean_filename_for_title('archive.tar.gz')).toBe('archive.tar');
        });

        it('replaces underscores and hyphens with spaces and collapses whitespace', () => {
            expect(helperMediaLibraryModule.clean_filename_for_title('first_name-last_name.png'))
                .toBe('first name last name');
        });

        it('returns empty string for falsy input', () => {
            expect(helperMediaLibraryModule.clean_filename_for_title('')).toBe('');
            expect(helperMediaLibraryModule.clean_filename_for_title(null)).toBe('');
        });
    });

    describe('get_app_path', () => {
        it('returns the value seeded in localStorage', () => {
            window.localStorage.setItem('exhibits_app_path', '/custom-base');
            expect(helperMediaLibraryModule.get_app_path()).toBe('/custom-base');
        });

        it('falls back to /exhibits-dashboard when not seeded', () => {
            // localStorage was cleared in beforeEach.
            expect(helperMediaLibraryModule.get_app_path()).toBe('/exhibits-dashboard');
        });

        it('falls back to /exhibits-dashboard when localStorage throws', () => {
            const original = window.localStorage.getItem;
            window.localStorage.getItem = () => { throw new Error('blocked'); };
            try {
                expect(helperMediaLibraryModule.get_app_path()).toBe('/exhibits-dashboard');
            } finally {
                window.localStorage.getItem = original;
            }
        });
    });

    describe('get_media_type_icon', () => {
        it('returns the type-specific Font Awesome icon', () => {
            expect(helperMediaLibraryModule.get_media_type_icon('image')).toBe('fa-file-image-o');
            expect(helperMediaLibraryModule.get_media_type_icon('pdf')).toBe('fa-file-pdf-o');
            expect(helperMediaLibraryModule.get_media_type_icon('video')).toBe('fa-file-video-o');
        });

        it('falls back to the generic file icon for unknown types', () => {
            expect(helperMediaLibraryModule.get_media_type_icon('weird-thing')).toBe('fa-file-o');
            expect(helperMediaLibraryModule.get_media_type_icon(undefined)).toBe('fa-file-o');
        });
    });

    describe('get_media_type_label', () => {
        it('returns the human-readable label', () => {
            expect(helperMediaLibraryModule.get_media_type_label('pdf')).toBe('PDF Document');
            expect(helperMediaLibraryModule.get_media_type_label('audio')).toBe('Audio');
        });

        it('falls back to "Unknown" for unmapped types', () => {
            expect(helperMediaLibraryModule.get_media_type_label('weird-thing')).toBe('Unknown');
        });
    });

    describe('append_cache_version', () => {
        it('appends v=<epoch> derived from the updated timestamp', () => {
            const updated = '2026-08-31T12:00:00.000Z';
            const epoch = new Date(updated).getTime();
            expect(helperMediaLibraryModule.append_cache_version('/x/thumb', updated))
                .toBe(`/x/thumb?v=${epoch}`);
        });

        it('uses & when the URL already has a query string', () => {
            const updated = '2026-08-31T12:00:00.000Z';
            const epoch = new Date(updated).getTime();
            expect(helperMediaLibraryModule.append_cache_version('/x/thumb?token=t', updated))
                .toBe(`/x/thumb?token=t&v=${epoch}`);
        });

        it('is a no-op when the URL or timestamp is missing/unparseable', () => {
            expect(helperMediaLibraryModule.append_cache_version(null, '2026-08-31')).toBeNull();
            expect(helperMediaLibraryModule.append_cache_version('/x', null)).toBe('/x');
            expect(helperMediaLibraryModule.append_cache_version('/x', 'not-a-date')).toBe('/x');
        });
    });

    describe('build_thumbnail_url', () => {
        it('substitutes :media_id and URL-encodes it', () => {
            expect(helperMediaLibraryModule.build_thumbnail_url('abc-123'))
                .toBe(`${MEDIA_BASE}/thumbnail/abc-123`);
            // encodeURIComponent applies to forbidden URI chars in the
            // path segment.
            expect(helperMediaLibraryModule.build_thumbnail_url('a/b'))
                .toBe(`${MEDIA_BASE}/thumbnail/a%2Fb`);
        });

        it('returns null when media_id is missing', () => {
            expect(helperMediaLibraryModule.build_thumbnail_url(null)).toBeNull();
            expect(helperMediaLibraryModule.build_thumbnail_url('')).toBeNull();
        });

        it('returns null and warns when the endpoint is not configured', () => {
            globalThis.endpointsModule = {
                get_media_library_endpoints: () => ({}),
                build: build_endpoint,
            };
            expect(helperMediaLibraryModule.build_thumbnail_url('abc-123')).toBeNull();
            expect(console.warn).toHaveBeenCalled();
        });
    });

    describe('build_media_url', () => {
        it('substitutes :media_id and URL-encodes it', () => {
            expect(helperMediaLibraryModule.build_media_url('uuid-1'))
                .toBe(`${MEDIA_BASE}/file/uuid-1`);
        });

        it('returns null when media_id is missing', () => {
            expect(helperMediaLibraryModule.build_media_url(null)).toBeNull();
        });

        it('returns null and warns when the endpoint is not configured', () => {
            globalThis.endpointsModule = {
                get_media_library_endpoints: () => ({}),
                build: build_endpoint,
            };
            expect(helperMediaLibraryModule.build_media_url('uuid-1')).toBeNull();
        });
    });

    describe('get_repo_thumbnail_url', () => {
        it('delegates to repoServiceModule.get_repo_tn_url when present', () => {
            const spy = vi.fn(() => '/delegated-url');
            globalThis.repoServiceModule = { get_repo_tn_url: spy };

            const out = helperMediaLibraryModule.get_repo_thumbnail_url('repo-uuid');
            expect(out).toBe('/delegated-url');
            expect(spy).toHaveBeenCalledWith('repo-uuid');
        });

        it('falls back to a direct URL build using endpoint + token', () => {
            // No repoServiceModule available — fallback path runs.
            const out = helperMediaLibraryModule.get_repo_thumbnail_url('repo-uuid');
            expect(out).toBe(
                `${MEDIA_BASE}/repo/thumbnail?uuid=repo-uuid&token=unit-test-token`
            );
        });

        it('returns empty string when uuid or token is missing', () => {
            expect(helperMediaLibraryModule.get_repo_thumbnail_url('')).toBe('');

            globalThis.authModule = { get_user_token: () => '' };
            expect(helperMediaLibraryModule.get_repo_thumbnail_url('repo-uuid')).toBe('');
        });
    });

    describe('get_thumbnail_url_for_media', () => {
        it('uses the server-generated thumbnail endpoint for image/pdf with uuid', () => {
            const out = helperMediaLibraryModule.get_thumbnail_url_for_media('image', 'uuid-1');
            expect(out).toBe(`${MEDIA_BASE}/thumbnail/uuid-1?token=unit-test-token`);

            const pdf_out = helperMediaLibraryModule.get_thumbnail_url_for_media('pdf', 'uuid-2');
            expect(pdf_out).toBe(`${MEDIA_BASE}/thumbnail/uuid-2?token=unit-test-token`);
        });

        it('falls back to static placeholders by media type', () => {
            expect(helperMediaLibraryModule.get_thumbnail_url_for_media('video'))
                .toBe('/exhibits-dashboard/static/images/video-tn.png');
            expect(helperMediaLibraryModule.get_thumbnail_url_for_media('audio'))
                .toBe('/exhibits-dashboard/static/images/audio-tn.png');
            // image/pdf without uuid → falls through to the static branch.
            expect(helperMediaLibraryModule.get_thumbnail_url_for_media('image'))
                .toBe('/exhibits-dashboard/static/images/image-tn.png');
        });

        it('falls back to the default placeholder for unknown types', () => {
            expect(helperMediaLibraryModule.get_thumbnail_url_for_media('weird-thing'))
                .toBe('/exhibits-dashboard/static/images/default-tn.png');
        });
    });

    describe('display_message / clear_message', () => {
        beforeEach(() => {
            document.body.innerHTML = '<div id="msg-area"></div>';
        });

        it('renders a Bootstrap alert with the type-specific icon', () => {
            helperMediaLibraryModule.display_message('msg-area', 'danger', 'Boom');

            const container = document.getElementById('msg-area');
            const alert = container.querySelector('.alert.alert-danger');
            expect(alert).not.toBeNull();
            expect(alert.querySelector('i.fa-exclamation-circle')).not.toBeNull();
            // Message markup is stripped to plain text, then HTML-escaped
            // (display_message does escape_html(strip_html(message))). So
            // markup-shaped input must neither produce a live element nor
            // survive as literal "<b>...</b>" text — only the inner text
            // remains, rendered safely.
            container.textContent = '';
            helperMediaLibraryModule.display_message('msg-area', 'info', '<b>x</b>');
            expect(container.querySelector('b')).toBeNull();
            expect(container.textContent).not.toContain('<b>');
            expect(container.textContent).toContain('x');
        });

        it('clear_message empties the container', () => {
            helperMediaLibraryModule.display_message('msg-area', 'info', 'hi');
            expect(document.getElementById('msg-area').innerHTML).not.toBe('');
            helperMediaLibraryModule.clear_message('msg-area');
            expect(document.getElementById('msg-area').innerHTML).toBe('');
        });

        it('display_message and clear_message are no-ops when the container is missing', () => {
            // Should not throw.
            expect(() => helperMediaLibraryModule.display_message('nope', 'info', 'x')).not.toThrow();
            expect(() => helperMediaLibraryModule.clear_message('nope')).not.toThrow();
        });
    });

    describe('create_message_helper', () => {
        beforeEach(() => {
            document.body.innerHTML =
                '<div id="container-a"></div><div id="container-b"></div>';
        });

        it('returns helpers bound to the chosen container', () => {
            const helper_a = helperMediaLibraryModule.create_message_helper('container-a');
            const helper_b = helperMediaLibraryModule.create_message_helper('container-b');

            helper_a.display_message('info', 'A says hi');
            helper_b.display_message('warning', 'B says hi');

            expect(document.getElementById('container-a').textContent).toContain('A says hi');
            expect(document.getElementById('container-b').textContent).toContain('B says hi');

            helper_a.clear_message();
            expect(document.getElementById('container-a').innerHTML).toBe('');
            // B was untouched.
            expect(document.getElementById('container-b').innerHTML).not.toBe('');
        });

        it('exposes escape_html on the bound helper', () => {
            const helper = helperMediaLibraryModule.create_message_helper('container-a');
            expect(helper.escape_html('<x>')).toBe('&lt;x&gt;');
        });
    });

    describe('show_bootstrap_modal / hide_bootstrap_modal — manual fallback', () => {
        // jsdom has no Bootstrap and no jQuery, so both functions take
        // the manual-DOM branch. That branch is the most fragile path
        // in production (it has to undo Bootstrap's body-scroll lock and
        // backdrop manually); pin it down here.

        beforeEach(() => {
            document.body.innerHTML = '<div id="m" class="modal" aria-hidden="true"></div>';
            // Belt-and-suspenders: the IIFE may have been evaluated when
            // bootstrap/jQuery weren't present, but tests for other
            // modules in this folder may have polluted globalThis.
            delete globalThis.bootstrap;
            delete globalThis.$;
        });

        it('show_bootstrap_modal adds .show, sets display:block, and appends a backdrop', () => {
            const modal = document.getElementById('m');
            helperMediaLibraryModule.show_bootstrap_modal(modal);

            expect(modal.classList.contains('show')).toBe(true);
            expect(modal.style.display).toBe('block');
            expect(document.body.classList.contains('modal-open')).toBe(true);
            expect(document.querySelectorAll('.modal-backdrop')).toHaveLength(1);
        });

        it('hide_bootstrap_modal cleans up after the 150ms timeout and runs the callback', async () => {
            // Simulate a previously-shown modal with backdrop + body lock.
            const modal = document.getElementById('m');
            modal.classList.add('show');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);

            const cleanup = vi.fn();
            helperMediaLibraryModule.hide_bootstrap_modal(modal, cleanup);

            // Cleanup runs inside a setTimeout(150). Wait it out.
            await new Promise((r) => setTimeout(r, 200));

            expect(modal.classList.contains('show')).toBe(false);
            expect(modal.style.display).toBe('none');
            expect(modal.getAttribute('aria-hidden')).toBe('true');
            expect(document.body.classList.contains('modal-open')).toBe(false);
            expect(document.querySelectorAll('.modal-backdrop')).toHaveLength(0);
            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        it('hide_bootstrap_modal is a no-op when modal_element is null', () => {
            expect(() => helperMediaLibraryModule.hide_bootstrap_modal(null)).not.toThrow();
        });
    });
    describe('get_media_type_from_filename', () => {

        it('maps image and pdf extensions, case-insensitively', () => {
            expect(helperMediaLibraryModule.get_media_type_from_filename('a.JPG')).toBe('image');
            expect(helperMediaLibraryModule.get_media_type_from_filename('a.jpeg')).toBe('image');
            expect(helperMediaLibraryModule.get_media_type_from_filename('a.png')).toBe('image');
            expect(helperMediaLibraryModule.get_media_type_from_filename('a.gif')).toBe('image');
            expect(helperMediaLibraryModule.get_media_type_from_filename('a.webp')).toBe('image');
            expect(helperMediaLibraryModule.get_media_type_from_filename('a.svg')).toBe('image');
            expect(helperMediaLibraryModule.get_media_type_from_filename('doc.PDF')).toBe('pdf');
        });

        it('returns "unknown" for other extensions and bad input', () => {
            expect(helperMediaLibraryModule.get_media_type_from_filename('a.mp4')).toBe('unknown');
            expect(helperMediaLibraryModule.get_media_type_from_filename('noext')).toBe('unknown');
            expect(helperMediaLibraryModule.get_media_type_from_filename('')).toBe('unknown');
            expect(helperMediaLibraryModule.get_media_type_from_filename(null)).toBe('unknown');
            expect(helperMediaLibraryModule.get_media_type_from_filename(42)).toBe('unknown');
        });
    });

    describe('reset_save_button / mark_card_saved', () => {

        function build_card() {
            document.body.innerHTML = `
                <div class="file-form-card">
                    <div class="card-header bg-light">
                        <span class="file-number">1</span>
                    </div>
                    <div class="file-remove-area"></div>
                    <form class="file-details-form">
                        <input name="name" />
                        <textarea name="description"></textarea>
                        <select name="item_type"><option value="a">a</option></select>
                        <button type="button" class="btn btn-primary btn-save-file">Save</button>
                    </form>
                </div>`;
            return document.querySelector('.file-form-card');
        }

        it('reset_save_button re-enables and restores the idle label', () => {
            const card = build_card();
            const btn = card.querySelector('.btn-save-file');
            btn.disabled = true;
            btn.innerHTML = 'busy';

            helperMediaLibraryModule.reset_save_button(btn);

            expect(btn.disabled).toBe(false);
            expect(btn.innerHTML).toContain('fa-save');
            expect(btn.textContent).toBe('Save');
        });

        it('reset_save_button tolerates a null button', () => {
            expect(() => helperMediaLibraryModule.reset_save_button(null)).not.toThrow();
        });

        it('mark_card_saved greens the header, badges the number and locks the fields', () => {
            const card = build_card();

            helperMediaLibraryModule.mark_card_saved(card, {
                number_selector: '.file-number',
                save_button_selector: '.btn-save-file',
                hide_selectors: ['.file-remove-area'],
            });

            expect(card.classList.contains('saved')).toBe(true);
            expect(card.querySelector('.file-remove-area').style.display).toBe('none');

            const header = card.querySelector('.card-header');
            expect(header.classList.contains('bg-light')).toBe(false);
            expect(header.classList.contains('bg-success')).toBe(true);
            expect(header.classList.contains('text-white')).toBe(true);

            expect(card.querySelector('.file-number').innerHTML).toContain('fa-check');

            expect(card.querySelector('input').getAttribute('readonly')).toBe('true');
            expect(card.querySelector('textarea').getAttribute('readonly')).toBe('true');
            expect(card.querySelector('select').getAttribute('disabled')).toBe('true');

            const btn = card.querySelector('.btn-save-file');
            expect(btn.disabled).toBe(true);
            expect(btn.classList.contains('btn-success')).toBe(true);
            expect(btn.textContent).toBe('Saved');
        });

        it('mark_card_saved is a no-op for a null card', () => {
            expect(() => helperMediaLibraryModule.mark_card_saved(null)).not.toThrow();
        });
    });

    describe('save_media_record', () => {

        let api_calls;
        let api_response;
        let message;
        let card;

        beforeEach(() => {
            api_calls = [];
            api_response = { status: 201, data: { success: true, data: 'new-uuid' } };
            message = vi.fn();

            globalThis.httpModule = {
                api: (options) => {
                    api_calls.push(options);
                    return Promise.resolve(api_response);
                },
            };

            globalThis.endpointsModule = endpoints_stub({
                get_media_library_endpoints: () => ({
                    media_records: { post: { endpoint: `${MEDIA_BASE}/record` } },
                }),
                build: build_endpoint,
            });

            document.body.innerHTML = `
                <div class="file-form-card">
                    <button class="btn btn-primary btn-save-file">Save</button>
                </div>`;
            card = document.querySelector('.file-form-card');
        });

        const btn = () => card.querySelector('.btn-save-file');

        it('POSTs the payload to the create endpoint and reports success', async () => {
            const on_success = vi.fn();

            const ok = await helperMediaLibraryModule.save_media_record(
                card, { name: 'x' }, { message, on_success },
            );

            expect(ok).toBe(true);
            expect(api_calls[0].method).toBe('POST');
            expect(api_calls[0].url).toBe(`${MEDIA_BASE}/record`);
            expect(api_calls[0].data).toEqual({ name: 'x' });
            expect(on_success).toHaveBeenCalledWith(card, 'new-uuid', api_response);
            expect(message).not.toHaveBeenCalled();
        });

        it('puts the button into its busy state before the request', async () => {
            let busy_label = null;

            globalThis.httpModule.api = () => {
                busy_label = btn().innerHTML;
                return Promise.resolve(api_response);
            };

            await helperMediaLibraryModule.save_media_record(card, {}, { message });

            expect(busy_label).toContain('fa-spinner');
        });

        it('reports and restores the button when the endpoint is not configured', async () => {
            globalThis.endpointsModule = endpoints_stub({
                get_media_library_endpoints: () => ({}),
                build: build_endpoint,
            });

            const ok = await helperMediaLibraryModule.save_media_record(card, {}, { message });

            expect(ok).toBe(false);
            expect(message).toHaveBeenCalledWith(card, 'danger', 'API endpoint configuration missing');
            expect(api_calls).toHaveLength(0);
            expect(btn().disabled).toBe(false);
        });

        it('honours a caller-supplied missing-endpoint message', async () => {
            globalThis.endpointsModule = endpoints_stub({
                get_media_library_endpoints: () => ({}),
                build: build_endpoint,
            });

            await helperMediaLibraryModule.save_media_record(card, {}, {
                message,
                missing_endpoint_message: 'Create endpoint not configured',
            });

            expect(message).toHaveBeenCalledWith(card, 'danger', 'Create endpoint not configured');
        });

        it('maps no-response, 403, 400 and a non-created status onto card messages', async () => {
            api_response = undefined;
            expect(await helperMediaLibraryModule.save_media_record(card, {}, { message })).toBe(false);
            expect(message).toHaveBeenLastCalledWith(
                card, 'danger', 'Unable to save media record. Please check your connection and try again.',
            );

            api_response = { status: 403, data: {} };
            await helperMediaLibraryModule.save_media_record(card, {}, { message });
            expect(message).toHaveBeenLastCalledWith(
                card, 'danger', 'You do not have permission to create media records.',
            );

            api_response = { status: 400, data: { message: 'Bad name' } };
            await helperMediaLibraryModule.save_media_record(card, {}, { message });
            expect(message).toHaveBeenLastCalledWith(card, 'danger', 'Bad name');

            api_response = { status: 500, data: {} };
            await helperMediaLibraryModule.save_media_record(card, {}, { message });
            expect(message).toHaveBeenLastCalledWith(card, 'danger', 'Failed to create media record.');

            expect(btn().disabled).toBe(false);
        });

        it('treats a 201 without data.success as a failure', async () => {
            api_response = { status: 201, data: { success: false } };
            expect(await helperMediaLibraryModule.save_media_record(card, {}, { message })).toBe(false);
        });

        it('accept_ok lets a 200 count as created', async () => {
            api_response = { status: 200, data: { success: true } };

            expect(await helperMediaLibraryModule.save_media_record(card, {}, { message })).toBe(false);
            expect(await helperMediaLibraryModule.save_media_record(card, {}, {
                message, accept_ok: true, require_item_id: false,
            })).toBe(true);
        });

        it('rejects a created response with no record id unless require_item_id is false', async () => {
            api_response = { status: 201, data: { success: true } };

            expect(await helperMediaLibraryModule.save_media_record(card, {}, { message })).toBe(false);
            expect(message).toHaveBeenLastCalledWith(card, 'danger', 'Server did not return a valid item ID.');

            expect(await helperMediaLibraryModule.save_media_record(card, {}, {
                message, require_item_id: false,
            })).toBe(true);
        });

        it('catches an unexpected throw, restores the button and reports it', async () => {
            globalThis.httpModule.api = () => Promise.reject(new Error('boom'));

            expect(await helperMediaLibraryModule.save_media_record(card, {}, { message })).toBe(false);
            expect(message).toHaveBeenLastCalledWith(
                card, 'danger', 'An unexpected error occurred while saving the media record.',
            );
            expect(btn().disabled).toBe(false);
        });
    });
});
