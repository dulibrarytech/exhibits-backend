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

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/media-library/helper.media.library.module.js',
);

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

describe('helperMediaLibraryModule', () => {

    beforeAll(() => {
        // Initial global stubs — individual tests override as needed.
        globalThis.endpointsModule = {
            get_media_library_endpoints: () => fresh_endpoints(),
        };
        globalThis.authModule = {
            get_user_token: () => 'unit-test-token',
        };

        const src = readFileSync(MODULE_PATH, 'utf8');
        // Top-level `const helperMediaLibraryModule = (…)` would be
        // scoped to the eval block and discarded; rewrite to attach to
        // globalThis so the test body can call its methods.
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
        vi.spyOn(console, 'debug').mockImplementation(() => {});

        // Reset endpoints + auth stubs to defaults; tests that need
        // alternate behavior re-stub on the global. URL builders read
        // these on every call, so swapping mid-test is safe.
        globalThis.endpointsModule = {
            get_media_library_endpoints: () => fresh_endpoints(),
        };
        globalThis.authModule = {
            get_user_token: () => 'unit-test-token',
        };
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
            // textContent → innerHTML round-trip encodes <, >, &.
            // Single/double quotes are NOT escaped by this implementation
            // (it relies on textContent semantics, which only encodes
            // markup-significant chars); attribute-context callers must
            // not feed unescaped output into bare attribute values.
            expect(out).not.toContain('<script>');
            expect(out).toContain('&lt;script&gt;');
            expect(out).toContain('&lt;/script&gt;');
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
            // Message text must be HTML-escaped — feeding markup-shaped
            // input must not produce live elements inside the alert.
            container.textContent = '';
            helperMediaLibraryModule.display_message('msg-area', 'info', '<b>x</b>');
            expect(container.querySelector('b')).toBeNull();
            expect(container.textContent).toContain('<b>x</b>');
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
});
