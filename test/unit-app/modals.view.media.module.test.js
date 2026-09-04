// @vitest-environment jsdom
//
// Unit tests for public/app/media-library/modals.view.media.module.js — the
// single owner of the #view-media-modal preview dialog that the upload and
// repository import modal modules used to implement twice against the same
// DOM element.

'use strict';

const { load_browser_module } = require('./helpers/load_module');

const MODAL_DOM = `
    <div id="view-media-modal">
        <h5 id="view-media-modal-title"></h5>
        <div id="view-media-info"></div>
        <div id="view-media-container">
            <img id="view-media-image" />
        </div>
        <div id="view-media-pdf-container" style="display: none;">
            <iframe id="view-media-pdf"></iframe>
        </div>
        <div id="view-media-loading"></div>
        <div id="view-media-error" style="display: none;">
            <span id="view-media-error-text"></span>
        </div>
        <button id="view-media-close-btn"></button>
        <button id="view-media-cancel-btn"></button>
        <button id="view-media-edit-btn"></button>
    </div>`;

describe('viewMediaModalModule', () => {

    let shown;
    let hidden;

    beforeAll(() => {
        globalThis.helperMediaLibraryModule = {
            escape_html: (s) => String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;'),
            decode_html_entities: (s) => s,
            get_media_type_from_filename: (f) => (String(f).endsWith('.pdf') ? 'pdf' : 'unknown'),
            show_bootstrap_modal: (...args) => shown.push(args),
            hide_bootstrap_modal: (el, cb) => {
                hidden.push(el);
                if (typeof cb === 'function') cb();
            },
        };

        load_browser_module(
            'public/app/media-library/modals.view.media.module.js',
            'viewMediaModalModule',
        );
    });

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        document.body.innerHTML = MODAL_DOM;
        shown = [];
        hidden = [];
    });

    const base_ctx = (overrides = {}) => Object.assign({
        uuid: 'media-1',
        name: 'A Photo',
        filename: 'photo.jpg',
        size: '1.2 MB',
        media_type: 'image',
        ingest_method: 'upload',
        strategy: {
            build_info_html: () => '<p>info</p>',
            resolve_media_url: () => 'https://example.test/photo.jpg',
        },
    }, overrides);

    describe('build_tail_rows', () => {

        it('builds the metadata rows every source shares', () => {
            const rows = viewMediaModalModule.build_tail_rows({
                media_type: 'image',
                ingest_method: 'repository',
                record: {
                    exhibit_names: ['Exhibit A', 'Exhibit B'],
                    created_display: '2026-01-01',
                    created_by: 'alice',
                    updated_by: 'bob',
                },
            });

            expect(rows).toEqual([
                ['Media Type', 'image'],
                ['Ingest Method', 'Repository'],
                ['__exhibits__', ['Exhibit A', 'Exhibit B']],
                ['Date Created', '2026-01-01'],
                ['Added By', 'alice'],
                ['Updated By', 'bob'],
            ]);
        });

        it('prefers the record media_type, drops "N/A", and reports a missing ingest method', () => {
            const rows = viewMediaModalModule.build_tail_rows({
                media_type: 'N/A',
                ingest_method: '',
                record: { media_type: 'pdf' },
            });

            expect(rows).toEqual([['Media Type', 'pdf'], ['Ingest Method', 'N/A']]);
        });

        it('omits an empty exhibit list and the placeholder updater values', () => {
            const rows = viewMediaModalModule.build_tail_rows({
                media_type: 'image',
                ingest_method: 'upload',
                record: { exhibit_names: [], updated_by: 'migration_script' },
            });

            expect(rows.map((r) => r[0])).toEqual(['Media Type', 'Ingest Method']);

            const rows2 = viewMediaModalModule.build_tail_rows({
                media_type: 'image', ingest_method: 'upload', record: { updated_by: 'N/A' },
            });
            expect(rows2.map((r) => r[0])).toEqual(['Media Type', 'Ingest Method']);
        });
    });

    describe('render_info_rows', () => {

        it('puts mb-0 on the last row only and escapes values', () => {
            const html = viewMediaModalModule.render_info_rows([
                ['Name', '<b>x</b>'],
                ['Ingest Method', 'Upload'],
            ]);

            expect(html).toContain('<p class="mb-1"><strong>Name:</strong> <span>&lt;b&gt;x&lt;/b&gt;</span></p>');
            expect(html).toContain('<p class="mb-0"><strong>Ingest Method:</strong>');
        });

        it('renders the exhibits pseudo-row as a stacked list', () => {
            const html = viewMediaModalModule.render_info_rows([['__exhibits__', ['One', 'Two']]]);

            expect(html).toContain('<strong>Exhibit(s):</strong>');
            expect(html).toContain('<div>One</div><div>Two</div>');
        });
    });

    describe('open', () => {

        it('sets the title, stashes the uuid, renders the info block and shows the modal', () => {
            expect(viewMediaModalModule.open(base_ctx())).toBe(true);

            expect(document.getElementById('view-media-modal-title').textContent).toBe('A Photo');
            expect(document.getElementById('view-media-modal').dataset.uuid).toBe('media-1');
            expect(document.getElementById('view-media-info').innerHTML).toBe('<p>info</p>');
            expect(shown).toHaveLength(1);
            expect(shown[0][1]).toEqual({ backdrop: true, keyboard: true });
        });

        it('loads an image and reveals it on load', () => {
            viewMediaModalModule.open(base_ctx());

            const img = document.getElementById('view-media-image');
            expect(img.getAttribute('src')).toBe('https://example.test/photo.jpg');
            expect(img.alt).toBe('Preview of A Photo');

            img.onload();
            expect(img.style.display).toBe('block');
            expect(document.getElementById('view-media-loading').style.display).toBe('none');
        });

        it('reports an image load failure', () => {
            viewMediaModalModule.open(base_ctx());
            document.getElementById('view-media-image').onerror();

            expect(document.getElementById('view-media-error').style.display).toBe('block');
            expect(document.getElementById('view-media-error-text').textContent).toBe('Unable to load image.');
        });

        it('falls back to the filename extension when media_type is absent', () => {
            viewMediaModalModule.open(base_ctx({ media_type: 'N/A', filename: 'doc.pdf' }));

            expect(document.getElementById('view-media-pdf-container').style.display).toBe('block');
            expect(document.getElementById('view-media-pdf').getAttribute('src'))
                .toBe('https://example.test/photo.jpg');
        });

        it('reports an unpreviewable type', () => {
            viewMediaModalModule.open(base_ctx({ media_type: 'audio' }));

            expect(document.getElementById('view-media-error-text').textContent)
                .toBe('This media type cannot be previewed.');
        });

        it('errors without showing the modal when no URL can be built', () => {
            const ctx = base_ctx();
            ctx.strategy.resolve_media_url = () => null;

            expect(viewMediaModalModule.open(ctx)).toBe(false);
            expect(shown).toHaveLength(0);
            expect(document.getElementById('view-media-error-text').textContent)
                .toBe('Unable to build media URL.');
        });

        it('renders a non-image type through <img> when the strategy asks for it', () => {
            const ctx = base_ctx({ media_type: 'audio' });
            ctx.strategy.render_as_image = () => true;
            ctx.strategy.image_alt = () => 'Thumbnail for A Photo';
            ctx.strategy.on_image_load = vi.fn();

            viewMediaModalModule.open(ctx);

            const img = document.getElementById('view-media-image');
            expect(img.alt).toBe('Thumbnail for A Photo');

            img.onload();
            expect(ctx.strategy.on_image_load).toHaveBeenCalled();

            img.onerror();
            expect(document.getElementById('view-media-error-text').textContent)
                .toBe('Unable to load thumbnail.');
        });

        it('lets the strategy swallow an image error (placeholder retry)', () => {
            const ctx = base_ctx();
            ctx.strategy.on_image_error = () => true;

            viewMediaModalModule.open(ctx);
            document.getElementById('view-media-image').onerror();

            expect(document.getElementById('view-media-error').style.display).toBe('none');
        });

        it('returns false when the modal element is absent', () => {
            document.body.innerHTML = '';
            expect(viewMediaModalModule.open(base_ctx())).toBe(false);
        });

        it('removes a stale uuid when the record has none', () => {
            document.getElementById('view-media-modal').dataset.uuid = 'stale';
            viewMediaModalModule.open(base_ctx({ uuid: '' }));
            expect(document.getElementById('view-media-modal').dataset.uuid).toBeUndefined();
        });
    });

    describe('close and button wiring', () => {

        it('Close and Cancel both hide the modal and reset the preview elements', () => {
            viewMediaModalModule.open(base_ctx());

            const img = document.getElementById('view-media-image');
            img.style.cursor = 'pointer';
            img.title = 'Click to open in repository';

            document.getElementById('view-media-close-btn').click();

            expect(hidden).toHaveLength(1);
            expect(img.getAttribute('src')).toBe('');
            expect(img.style.display).toBe('none');
            expect(img.style.cursor).toBe('');
            expect(img.title).toBe('');
            expect(document.getElementById('view-media-pdf').getAttribute('src')).toBe('');

            viewMediaModalModule.open(base_ctx());
            document.getElementById('view-media-cancel-btn').click();
            expect(hidden).toHaveLength(2);
        });

        it('removes the repository handle hint on close', () => {
            viewMediaModalModule.open(base_ctx());

            const hint = document.createElement('p');
            hint.className = 'repo-handle-hint';
            document.getElementById('view-media-container').parentNode.appendChild(hint);

            viewMediaModalModule.close();
            expect(document.querySelectorAll('.repo-handle-hint')).toHaveLength(0);
        });

        it('runs the active strategy\'s on_close hook', () => {
            const ctx = base_ctx();
            ctx.strategy.on_close = vi.fn();

            viewMediaModalModule.open(ctx);
            viewMediaModalModule.close();

            expect(ctx.strategy.on_close).toHaveBeenCalledTimes(1);
        });

        it('Edit closes the preview and opens the edit modal for the stashed uuid', async () => {
            vi.useFakeTimers();
            globalThis.mediaEditModalModule = { open_edit_media_modal: vi.fn() };

            viewMediaModalModule.open(base_ctx());
            document.getElementById('view-media-edit-btn').click();

            expect(hidden).toHaveLength(1);
            expect(globalThis.mediaEditModalModule.open_edit_media_modal).not.toHaveBeenCalled();

            vi.advanceTimersByTime(200);
            expect(globalThis.mediaEditModalModule.open_edit_media_modal).toHaveBeenCalledWith('media-1');

            vi.useRealTimers();
        });

        it('re-wires the buttons on each open without stacking listeners', () => {
            viewMediaModalModule.open(base_ctx());
            viewMediaModalModule.open(base_ctx());

            document.getElementById('view-media-close-btn').click();
            expect(hidden).toHaveLength(1);
        });
    });
});
