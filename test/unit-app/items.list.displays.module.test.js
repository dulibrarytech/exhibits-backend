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

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/items.list.displays.module.js',
);

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
    globalThis.authModule = {
        get_user_token: () => 'unit-test-token',
    };

    // endpointsModule — captured into EXHIBITS_ENDPOINTS at eval time.
    // Only `exhibits.exhibit_media.get.endpoint` is actually
    // dereferenced (legacy image-thumbnail path); seed it so that
    // branch doesn't TypeError if a future test exercises it.
    globalThis.endpointsModule = {
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
        title: 'Sample grid',
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
        title: 'Sample timeline',
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
        const src = readFileSync(MODULE_PATH, 'utf8');
        // Top-level `const` would be scoped to the eval block and
        // discarded; rewrite the IIFE assignment to attach to
        // globalThis so we can call obj.display_* afterwards.
        const patched = src.replace(
            /^const\s+itemsListDisplayModule\s*=/m,
            'globalThis.itemsListDisplayModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
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
                grid_item({ title: 'My grid' })
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
                timeline_item({ title: 'My timeline' })
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
