// @vitest-environment jsdom
//
// Unit tests for public/app/items.list.displays.module.js.
//
// The module exposes six `display_*` async functions, each of which
// takes a single record-shaped object and returns the HTML string for
// one `<tr>`. They're pure DOM builders — no network — so jsdom
// coverage is the right layer:
//
//   - faster than the e2e equivalent (no Playwright spin-up)
//   - precise per-branch assertion on URL routing, status-button
//     class, edit/details swap, type label, child cell, etc.
//   - independent of the items.module.js dispatch tested in
//     test/e2e/specs/items-list.spec.js — that spec asserts "the right
//     display_* runs"; this file asserts "what each display_*
//     produces."
//
// Module-load pattern follows the rest of test/unit-app/* — read the
// source, rewrite the top-level `const itemsListDisplayModule = (…)`
// to attach to globalThis, then indirect-eval inside jsdom. The IIFE
// captures `APP_PATH` and `EXHIBITS_ENDPOINTS` at eval time, so the
// global stubs MUST be set up before the eval (in beforeAll, before
// the source is evaluated).

'use strict';

const { load_browser_module } = require('./helpers/load_module');
const { auth_stub } = require('./helpers/stubs');

const APP_PATH = '/exhibits-dashboard';

function setup_module_globals() {
    window.localStorage.setItem('exhibits_app_path', APP_PATH);

    // helperModule — the display_* functions only use these two.
    // Identity functions are sufficient for the assertions; we don't
    // care about HTML escaping in this layer (it's covered by
    // helper.module.test.js).
    globalThis.helperModule = {
        strip_html: (s) => (s == null ? '' : String(s)),
        unescape: (s) => (s == null ? '' : String(s)),
    };

    // authModule — only used by build_media_library_thumbnail_url,
    // which short-circuits to null without a token, so any non-empty
    // string keeps the media-library branch reachable.
    globalThis.authModule = auth_stub('unit-test-token');

    // endpointsModule — captured into EXHIBITS_ENDPOINTS at eval time.
    // Only `exhibits.exhibit_media.get.endpoint` is actually
    // dereferenced (legacy image-thumbnail path); seed it so that
    // branch doesn't TypeError if a future test exercises it.
    globalThis.endpointsModule = {
        get_app_path: () => window.localStorage.getItem('exhibits_app_path') || '/exhibits-dashboard',
        get_exhibits_endpoints: () => ({
            exhibits: {
                exhibit_media: {
                    get: {
                        endpoint: `${APP_PATH}/api/v1/exhibits/:exhibit_id/media/:media`,
                    },
                },
            },
        }),
    };
}

function standard_text_item(overrides = {}) {
    return {
        uuid: 'item-uuid-1',
        type: 'item',
        item_type: 'text',
        title: 'Sample standard item',
        order: 1,
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: 'exhibit-uuid-1',
        ...overrides,
    };
}

function heading_item(overrides = {}) {
    return {
        uuid: 'heading-uuid-1',
        type: 'heading',
        text: 'Section heading',
        order: 1,
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: 'exhibit-uuid-1',
        ...overrides,
    };
}

function grid_item(overrides = {}) {
    return {
        uuid: 'grid-uuid-1',
        type: 'grid',
        internal_name: 'Sample grid',
        order: 2,
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: 'exhibit-uuid-1',
        ...overrides,
    };
}

function grid_member_item(overrides = {}) {
    return {
        uuid: 'grid-item-uuid-1',
        item_type: 'text',
        title: 'Sample grid member',
        order: 3,
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: 'exhibit-uuid-1',
        is_member_of_grid: 'grid-uuid-1',
        ...overrides,
    };
}

function timeline_item(overrides = {}) {
    return {
        uuid: 'timeline-uuid-1',
        type: 'vertical_timeline',
        internal_name: 'Sample timeline',
        order: 4,
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: 'exhibit-uuid-1',
        ...overrides,
    };
}

function timeline_member_item(overrides = {}) {
    return {
        uuid: 'timeline-item-uuid-1',
        item_type: 'text',
        title: 'Sample timeline event',
        // Local-time ISO (no Z) so getFullYear/Month/Date are
        // timezone-stable across CI machines.
        date: '2025-04-15T12:00:00',
        order: 5,
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: 'exhibit-uuid-1',
        is_member_of_timeline: 'timeline-uuid-1',
        ...overrides,
    };
}

describe('itemsListDisplayModule', () => {

    beforeAll(() => {
        setup_module_globals();
        load_browser_module('public/app/items.list.displays.module.js', 'itemsListDisplayModule');
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        // #message is the target for display_error_message, which the
        // catch-paths invoke. Seed an empty container so error-path
        // tests can assert it gets populated.
        document.body.innerHTML = '<div id="message"></div>';
    });

    describe('display_standard_items', () => {

        it('renders a text item with title, type label, and details URL', async () => {
            const html = await itemsListDisplayModule.display_standard_items(
                standard_text_item({ title: 'Hello world' })
            );
            expect(html).toContain('Hello world');
            expect(html).toContain('item-uuid-1_text_item');
            expect(html).toContain(
                `${APP_PATH}/items/standard/text/details?exhibit_id=exhibit-uuid-1&amp;item_id=item-uuid-1`
            );
            expect(html).toContain('publish-item');
        });

        it('routes media item type to the standard/media details URL', async () => {
            const html = await itemsListDisplayModule.display_standard_items(
                standard_text_item({
                    item_type: 'image',
                    media_uuid: 'media-uuid-1',
                    media_thumbnail_path: '/some/path.jpg',
                })
            );
            expect(html).toContain('/items/standard/media/details');
            expect(html).not.toContain('/items/standard/text/details');
            // Media library thumbnail URL should appear (built from the
            // mocked authModule token + media_thumbnail_path branch).
            expect(html).toContain(
                `${APP_PATH}/api/v1/media/library/thumbnail/media-uuid-1`
            );
        });

        it('renders a published item with the suppress button and Details edit link', async () => {
            const html = await itemsListDisplayModule.display_standard_items(
                standard_text_item({ is_published: 1 })
            );
            expect(html).toContain('suppress-item');
            expect(html).toContain('Published');
            // Edit link points to /details when published, with the
            // 'Details' label and folder-open icon.
            expect(html).toContain('/items/standard/text/details');
            expect(html).toContain('Details');
            expect(html).toContain('fa-folder-open');
            // Delete option is disabled for published items.
            expect(html).toContain('Can only delete if unpublished');
        });

        it('returns an empty string and writes an alert when item is invalid', async () => {
            const html = await itemsListDisplayModule.display_standard_items({});
            expect(html).toBe('');
            expect(document.querySelector('#message .alert-danger')).not.toBeNull();
            expect(document.querySelector('#message').textContent).toMatch(
                /Invalid item data/i
            );
        });
    });

    describe('display_heading_items', () => {

        it('renders a heading using item.text as the title with the heading icon', async () => {
            const html = await itemsListDisplayModule.display_heading_items(
                heading_item({ text: 'Chapter 1' })
            );
            expect(html).toContain('Chapter 1');
            expect(html).toContain('fa fa-header');
            expect(html).toContain(
                `${APP_PATH}/items/heading/details?exhibit_id=exhibit-uuid-1&amp;item_id=heading-uuid-1`
            );
            // Delete URL is type=heading.
            expect(html).toContain('/items/delete?exhibit_id=exhibit-uuid-1&amp;item_id=heading-uuid-1&amp;type=heading');
        });

        it('renders a published heading with suppress button and details edit link', async () => {
            const html = await itemsListDisplayModule.display_heading_items(
                heading_item({ is_published: 1 })
            );
            expect(html).toContain('suppress-item');
            expect(html).toContain('/items/heading/details');
            expect(html).toContain('Details');
        });
    });

    describe('display_grids', () => {

        it('renders a grid with a child-items link and type=grid in the delete URL', async () => {
            const html = await itemsListDisplayModule.display_grids(
                grid_item({ internal_name: 'My grid' })
            );
            expect(html).toContain('My grid');
            expect(html).toContain('fa fa-th');
            // Child cell renders the items link.
            expect(html).toContain(
                `${APP_PATH}/items/grid/items?exhibit_id=exhibit-uuid-1&amp;grid_id=grid-uuid-1`
            );
            // Delete URL.
            expect(html).toContain(
                '/items/delete?exhibit_id=exhibit-uuid-1&amp;item_id=grid-uuid-1&amp;type=grid'
            );
        });

        it('uses internal_name (not title) for the row title', async () => {
            // tbl_grids lost `title` in the titles-to-subheadings migration;
            // the staff-facing internal_name fills the title slot.
            const html = await itemsListDisplayModule.display_grids(
                grid_item({ internal_name: 'Internal label', title: 'Stale title' })
            );
            expect(html).toContain('Internal label');
            expect(html).not.toContain('Stale title');
        });

        it('renders without a title for legacy grids that predate internal_name', async () => {
            const html = await itemsListDisplayModule.display_grids(
                grid_item({ internal_name: null })
            );
            expect(html).toContain('fa fa-th');
            expect(html).not.toContain('item-title-link');
        });
    });

    describe('display_grid_items', () => {

        it('renders a text grid member with the grid/item routing and griditem type id', async () => {
            const html = await itemsListDisplayModule.display_grid_items(
                grid_member_item({ title: 'Grid text' })
            );
            // Sets item.type='griditem' as a side effect — the row id
            // reflects that.
            expect(html).toContain('grid-item-uuid-1_griditem_text');
            expect(html).toContain(
                `${APP_PATH}/items/grid/item/text/details?exhibit_id=exhibit-uuid-1&amp;grid_id=grid-uuid-1&amp;item_id=grid-item-uuid-1`
            );
            // Delete URL is the grid-item-specific path (not /items/delete).
            expect(html).toContain(
                `${APP_PATH}/items/grid/item/delete?exhibit_id=exhibit-uuid-1&amp;grid_id=grid-uuid-1&amp;item_id=grid-item-uuid-1`
            );
        });

        it('returns an empty string and writes an alert when grid item is invalid', async () => {
            const html = await itemsListDisplayModule.display_grid_items({});
            expect(html).toBe('');
            expect(document.querySelector('#message').textContent).toMatch(
                /Invalid grid item data/i
            );
        });
    });

    describe('display_timelines', () => {

        it('renders a timeline with a timeline-items link and type=vertical_timeline in delete', async () => {
            const html = await itemsListDisplayModule.display_timelines(
                timeline_item({ internal_name: 'My timeline' })
            );
            expect(html).toContain('My timeline');
            expect(html).toContain('fa fa-clock-o');
            // Child cell links to the timeline items page.
            expect(html).toContain(
                `${APP_PATH}/items/timeline/items?exhibit_id=exhibit-uuid-1&amp;timeline_id=timeline-uuid-1`
            );
            // Delete URL uses type=vertical_timeline (the only place
            // in the codebase where this server-side type label
            // appears in a UI URL).
            expect(html).toContain(
                '/items/delete?exhibit_id=exhibit-uuid-1&amp;item_id=timeline-uuid-1&amp;type=vertical_timeline'
            );
        });

        it('uses internal_name (not title) for the row title', async () => {
            // tbl_timelines lost `title` in the titles-to-subheadings
            // migration; the staff-facing internal_name fills the title slot.
            const html = await itemsListDisplayModule.display_timelines(
                timeline_item({ internal_name: 'Internal label', title: 'Stale title' })
            );
            expect(html).toContain('Internal label');
            expect(html).not.toContain('Stale title');
        });

        it('renders without a title for legacy timelines that predate internal_name', async () => {
            const html = await itemsListDisplayModule.display_timelines(
                timeline_item({ internal_name: null })
            );
            expect(html).toContain('fa fa-clock-o');
            expect(html).not.toContain('item-title-link');
        });
    });

    describe('display_timeline_items', () => {

        it('renders a text timeline event with the deep timeline routing and a sortable date cell', async () => {
            const html = await itemsListDisplayModule.display_timeline_items(
                timeline_member_item({ title: 'Event title' })
            );
            // Sets item.type='timelineitem' as a side effect.
            expect(html).toContain('timeline-item-uuid-1_timelineitem_text');
            expect(html).toContain(
                `${APP_PATH}/items/vertical-timeline/item/text/details?exhibit_id=exhibit-uuid-1&amp;timeline_id=timeline-uuid-1&amp;item_id=timeline-item-uuid-1`
            );
            // Delete URL is the timeline-item-specific path.
            expect(html).toContain(
                `${APP_PATH}/items/timeline/item/delete?exhibit_id=exhibit-uuid-1&amp;timeline_id=timeline-uuid-1&amp;item_id=timeline-item-uuid-1`
            );
            // Date cell formatted YYYY-MM-DD. Local-time ISO input
            // (see fixture comment) keeps this stable across machines.
            expect(html).toContain('<small>2025-04-15</small>');
        });

        it('returns an empty string and writes an alert when timeline item is invalid', async () => {
            const html = await itemsListDisplayModule.display_timeline_items({});
            expect(html).toBe('');
            expect(document.querySelector('#message').textContent).toMatch(
                /Invalid timeline item data/i
            );
        });
    });

    describe('init', () => {
        it('returns true and is safe to call repeatedly', () => {
            expect(itemsListDisplayModule.init()).toBe(true);
            expect(itemsListDisplayModule.init()).toBe(true);
        });
    });
});

// ───────────────────── get_row_type / build_actions_cell / update_actions_cell ─────────────────────
// Phase 1 DRY (cluster C11): the post-publish/suppress actions-cell rebuild
// the three list modules used to hand-roll (and drift on — bug #17).

describe('itemsListDisplayModule actions-cell API', () => {

    beforeAll(() => {
        setup_module_globals();
        load_browser_module('public/app/items.list.displays.module.js', 'itemsListDisplayModule');
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        document.body.innerHTML = '<div id="message"></div>';
        delete globalThis.reorderModule;
    });

    const mod = () => globalThis.itemsListDisplayModule;

    const render_row = async (fn, item) => {
        const html = await mod()[fn](item);
        const table = document.createElement('table');
        table.id = 'items-table';
        table.innerHTML = `<tbody>${html}</tbody>`;
        document.body.appendChild(table);
        return table;
    };

    describe('get_row_type', () => {

        it('classifies every display_* row id convention', async () => {
            await render_row('display_standard_items', standard_text_item({ uuid: 'u-std-text' }));
            await render_row('display_standard_items', standard_text_item({ uuid: 'u-std-img', item_type: 'image' }));
            await render_row('display_heading_items', heading_item({ uuid: 'u-head' }));
            await render_row('display_grids', grid_item({ uuid: 'u-grid' }));
            await render_row('display_timelines', timeline_item({ uuid: 'u-tl' }));
            await render_row('display_grid_items', grid_member_item({ uuid: 'u-gi', item_type: 'text' }));
            await render_row('display_timeline_items', timeline_member_item({ uuid: 'u-ti', item_type: 'video' }));

            expect(mod().get_row_type('u-std-text')).toMatchObject({ row_type: 'standard', item_type: 'text' });
            expect(mod().get_row_type('u-std-img')).toMatchObject({ row_type: 'standard', item_type: 'image' });
            expect(mod().get_row_type('u-head')).toMatchObject({ row_type: 'heading', item_type: null });
            expect(mod().get_row_type('u-grid')).toMatchObject({ row_type: 'grid', item_type: null });
            expect(mod().get_row_type('u-tl')).toMatchObject({ row_type: 'timeline', item_type: null });
            expect(mod().get_row_type('u-gi')).toMatchObject({ row_type: 'grid_item', item_type: 'text' });
            expect(mod().get_row_type('u-ti')).toMatchObject({ row_type: 'timeline_item', item_type: 'video' });
            expect(mod().get_row_type('u-ti').tr.id).toBe('u-ti_timelineitem_video');
        });

        it('matches on the exact uuid prefix, not a substring', async () => {
            await render_row('display_heading_items', heading_item({ uuid: 'abc-123' }));
            expect(mod().get_row_type('abc')).toBeNull();
            expect(mod().get_row_type('abc-123')).not.toBeNull();
        });

        it('returns null for an unknown uuid or a bad argument', () => {
            expect(mod().get_row_type('nope')).toBeNull();
            expect(mod().get_row_type('')).toBeNull();
            expect(mod().get_row_type(undefined)).toBeNull();
        });

        it('treats a subheading row as heading', () => {
            document.body.innerHTML += '<table><tbody><tr id="sh-1_subheading"><td></td></tr></tbody></table>';
            expect(mod().get_row_type('sh-1')).toMatchObject({ row_type: 'heading' });
        });
    });

    describe('build_actions_cell', () => {

        const parse = (html) => {
            const div = document.createElement('div');
            div.innerHTML = html;
            return div;
        };

        it('published standard text item: Details link, aria-disabled Delete, Move Up/Down present', () => {
            const html = mod().build_actions_cell({
                row_type: 'standard', item_type: 'text', uuid: 'u1', exhibit_id: 'e1', is_published: 1, item_title: 'My "item"',
            });
            const el = parse(html);
            const edit = el.querySelector('a.dropdown-item');
            expect(edit.getAttribute('href')).toBe(`${APP_PATH}/items/standard/text/details?exhibit_id=e1&item_id=u1`);
            expect(edit.textContent.trim()).toBe('Details');
            expect(edit.querySelector('i').className).toContain('fa-folder-open');
            const del = el.querySelector('a.text-muted.disabled');
            expect(del).not.toBeNull();
            expect(del.getAttribute('aria-disabled')).toBe('true');
            expect(del.getAttribute('tabindex')).toBe('-1');
            expect(el.querySelector('a.text-danger')).toBeNull();
            expect(el.querySelector('[data-action="move-up"]').getAttribute('aria-label')).toBe('Move My "item" up');
            expect(el.querySelector('[data-action="move-down"]')).not.toBeNull();
            expect(el.querySelector('.item-actions-toggle')).not.toBeNull();
        });

        it('unpublished standard media item: Edit link and live Delete link with type=item', () => {
            const html = mod().build_actions_cell({
                row_type: 'standard', item_type: 'image', uuid: 'u1', exhibit_id: 'e1', is_published: 0,
            });
            const el = parse(html);
            const edit = el.querySelector('a.dropdown-item');
            expect(edit.getAttribute('href')).toBe(`${APP_PATH}/items/standard/media/edit?exhibit_id=e1&item_id=u1`);
            expect(edit.textContent.trim()).toBe('Edit');
            expect(edit.querySelector('i').className).toContain('fa-edit');
            const del = el.querySelector('a.text-danger');
            expect(del.getAttribute('href')).toBe(`${APP_PATH}/items/delete?exhibit_id=e1&item_id=u1&type=item`);
            expect(el.querySelector('[aria-disabled="true"]')).toBeNull();
            // Default 'item' title in the Move labels
            expect(el.querySelector('[data-action="move-up"]').getAttribute('aria-label')).toBe('Move item up');
        });

        it('routes heading / grid / timeline containers like the display_* builders', () => {
            const head = parse(mod().build_actions_cell({ row_type: 'heading', uuid: 'h', exhibit_id: 'e', is_published: 0 }));
            expect(head.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/heading/edit?exhibit_id=e&item_id=h`);
            expect(head.querySelector('a.text-danger').getAttribute('href')).toBe(`${APP_PATH}/items/delete?exhibit_id=e&item_id=h&type=heading`);

            const grid = parse(mod().build_actions_cell({ row_type: 'grid', uuid: 'g', exhibit_id: 'e', is_published: true }));
            expect(grid.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/grid/details?exhibit_id=e&item_id=g`);
            expect(grid.querySelector('[aria-disabled="true"]')).not.toBeNull();

            const tl = parse(mod().build_actions_cell({ row_type: 'timeline', uuid: 't', exhibit_id: 'e', is_published: 0 }));
            expect(tl.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/vertical-timeline/edit?exhibit_id=e&item_id=t`);
            expect(tl.querySelector('a.text-danger').getAttribute('href')).toBe(`${APP_PATH}/items/delete?exhibit_id=e&item_id=t&type=vertical_timeline`);
        });

        it('grid_item: deep grid routing with grid_id, Move items present', () => {
            const el = parse(mod().build_actions_cell({
                row_type: 'grid_item', item_type: 'text', uuid: 'gi', exhibit_id: 'e', grid_id: 'g', is_published: 1,
            }));
            expect(el.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/grid/item/text/details?exhibit_id=e&grid_id=g&item_id=gi`);
            expect(el.querySelector('[data-action="move-up"]')).not.toBeNull();

            const media = parse(mod().build_actions_cell({
                row_type: 'grid_item', item_type: 'image', uuid: 'gi', exhibit_id: 'e', grid_id: 'g', is_published: 0,
            }));
            expect(media.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/grid/item/media/edit?exhibit_id=e&grid_id=g&item_id=gi`);
            expect(media.querySelector('a.text-danger').getAttribute('href')).toBe(`${APP_PATH}/items/grid/item/delete?exhibit_id=e&grid_id=g&item_id=gi`);
        });

        it('timeline_item: deep timeline routing with timeline_id, no Move items by default', () => {
            const el = parse(mod().build_actions_cell({
                row_type: 'timeline_item', item_type: 'text', uuid: 'ti', exhibit_id: 'e', timeline_id: 't', is_published: 1,
            }));
            expect(el.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/vertical-timeline/item/text/details?exhibit_id=e&timeline_id=t&item_id=ti`);
            expect(el.querySelector('[data-action="move-up"]')).toBeNull();
            expect(el.querySelector('[aria-disabled="true"]')).not.toBeNull();

            const media = parse(mod().build_actions_cell({
                row_type: 'timeline_item', item_type: 'video', uuid: 'ti', exhibit_id: 'e', timeline_id: 't', is_published: 0, show_move: true,
            }));
            expect(media.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/vertical-timeline/item/media/edit?exhibit_id=e&timeline_id=t&item_id=ti`);
            expect(media.querySelector('a.text-danger').getAttribute('href')).toBe(`${APP_PATH}/items/timeline/item/delete?exhibit_id=e&timeline_id=t&item_id=ti`);
            expect(media.querySelector('[data-action="move-up"]')).not.toBeNull();
        });

        it('URL-encodes ids', () => {
            const el = parse(mod().build_actions_cell({ row_type: 'heading', uuid: 'a b', exhibit_id: 'e&x', is_published: 0 }));
            expect(el.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/heading/edit?exhibit_id=e%26x&item_id=a%20b`);
        });

        it('returns "" (and logs) for missing ids, missing container id, or an unknown row_type', () => {
            expect(mod().build_actions_cell({ row_type: 'heading', uuid: 'h', is_published: 0 })).toBe('');
            expect(mod().build_actions_cell({ row_type: 'grid_item', uuid: 'h', exhibit_id: 'e', is_published: 0 })).toBe('');
            expect(mod().build_actions_cell({ row_type: 'timeline_item', uuid: 'h', exhibit_id: 'e', is_published: 0 })).toBe('');
            expect(mod().build_actions_cell({ row_type: 'bogus', uuid: 'h', exhibit_id: 'e', is_published: 0 })).toBe('');
            expect(mod().build_actions_cell()).toBe('');
            expect(console.error).toHaveBeenCalled();
        });

        it('matches the initial display_* render for the same row and state', async () => {
            const table = await render_row('display_grid_items', grid_member_item({ uuid: 'gi-1', item_type: 'text', is_published: 1, title: 'Grid member' }));
            const initial = table.querySelector('#gi-1-item-actions').innerHTML;
            const rebuilt = mod().build_actions_cell({
                row_type: 'grid_item', item_type: 'text', uuid: 'gi-1', exhibit_id: 'exhibit-uuid-1', grid_id: 'grid-uuid-1', is_published: 1, item_title: 'Grid member',
            });
            // Normalise the rebuilt string through the DOM the same way the
            // display_* output was (container.innerHTML round-trip), so
            // attribute entity encoding (& → &amp;) compares like for like.
            const holder = document.createElement('td');
            holder.innerHTML = rebuilt;
            expect(holder.innerHTML).toBe(initial);
        });
    });

    describe('update_actions_cell', () => {

        it('rebuilds the cell after a publish toggle, inferring row type + title from the row', async () => {
            const table = await render_row('display_standard_items', standard_text_item({ uuid: 'u-std', title: 'Row title', is_published: 0 }));
            const cell = table.querySelector('#u-std-item-actions');
            expect(cell.querySelector('a.text-danger')).not.toBeNull();

            const ok = mod().update_actions_cell('u-std', { exhibit_id: 'exhibit-uuid-1', is_published: 1 });

            expect(ok).toBe(true);
            expect(cell.className).toBe('text-center');
            const edit = cell.querySelector('a.dropdown-item');
            expect(edit.getAttribute('href')).toBe(`${APP_PATH}/items/standard/text/details?exhibit_id=exhibit-uuid-1&item_id=u-std`);
            expect(edit.textContent.trim()).toBe('Details');
            expect(cell.querySelector('a.text-danger')).toBeNull();
            expect(cell.querySelector('[aria-disabled="true"]')).not.toBeNull();
            expect(cell.querySelector('[data-action="move-up"]').getAttribute('aria-label')).toBe('Move Row title up');
        });

        it('rebuilds a grid member back to the unpublished state with an explicit grid_id', async () => {
            const table = await render_row('display_grid_items', grid_member_item({ uuid: 'gi-2', item_type: 'image', is_published: 1 }));
            const cell = table.querySelector('#gi-2-item-actions');

            const ok = mod().update_actions_cell('gi-2', { exhibit_id: 'e', grid_id: 'g', is_published: 0 });

            expect(ok).toBe(true);
            expect(cell.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/grid/item/media/edit?exhibit_id=e&grid_id=g&item_id=gi-2`);
            expect(cell.querySelector('a.text-danger').getAttribute('href')).toBe(`${APP_PATH}/items/grid/item/delete?exhibit_id=e&grid_id=g&item_id=gi-2`);
            expect(cell.querySelector('[data-action="move-down"]')).not.toBeNull();
        });

        it('refreshes reorder button states via the enclosing table id (or opts.table_selector)', async () => {
            globalThis.reorderModule = { update_reorder_button_states: vi.fn() };
            await render_row('display_heading_items', heading_item({ uuid: 'h-1' }));

            mod().update_actions_cell('h-1', { exhibit_id: 'e', is_published: 1 });
            expect(globalThis.reorderModule.update_reorder_button_states).toHaveBeenCalledWith('#items-table');

            mod().update_actions_cell('h-1', { exhibit_id: 'e', is_published: 0, table_selector: '#custom' });
            expect(globalThis.reorderModule.update_reorder_button_states).toHaveBeenLastCalledWith('#custom');
        });

        it('honours explicit row_type / item_type / item_title overrides', async () => {
            await render_row('display_standard_items', standard_text_item({ uuid: 'u-ov', title: 'Original' }));
            mod().update_actions_cell('u-ov', {
                exhibit_id: 'e', is_published: 0, row_type: 'standard', item_type: 'image', item_title: 'Override',
            });
            const cell = document.getElementById('u-ov-item-actions');
            expect(cell.querySelector('a.dropdown-item').getAttribute('href')).toBe(`${APP_PATH}/items/standard/media/edit?exhibit_id=e&item_id=u-ov`);
            expect(cell.querySelector('[data-action="move-up"]').getAttribute('aria-label')).toBe('Move Override up');
        });

        it('returns false when the cell is missing or the row type cannot be determined', () => {
            expect(mod().update_actions_cell('ghost', { exhibit_id: 'e', is_published: 1 })).toBe(false);

            document.body.innerHTML += '<table><tbody><tr id="weird"><td id="orphan-item-actions"></td></tr></tbody></table>';
            expect(mod().update_actions_cell('orphan', { exhibit_id: 'e', is_published: 1 })).toBe(false);
            expect(console.error).toHaveBeenCalled();
        });
    });
});
