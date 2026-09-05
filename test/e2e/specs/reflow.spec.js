'use strict';

/**
 * WCAG 1.4.10 Reflow — 320 CSS px guard.
 *
 * Success Criterion 1.4.10 asks that content reflow into a single column at
 * 320 px without requiring scrolling in two directions, and without loss of
 * content or functionality. The 2026-09-04 audit found the dashboard failed
 * both halves:
 *
 *   - The listing tables were wider than the content column while their
 *     wrapper was `overflow-x: visible`, so the *document* scrolled sideways.
 *     The heading, the sidebar and the alert region all panned off-screen.
 *   - Below 768px the theme hides the sidebar outright, and this app's only
 *     sidebar toggle lives inside the sidebar — so the panel and the control
 *     that reopens it disappeared together, taking all nine nav links with
 *     them. That is loss of functionality, not reflow.
 *
 * These tests pin both halves. They assert the *document* does not scroll
 * horizontally; a data table that scrolls inside its own wrapper is the
 * explicit exception 1.4.10 allows ("content requiring two-dimensional
 * layout"), so the table's own width is deliberately not asserted.
 */

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubExhibitsApi,
    stubMixedItemsListApi,
    stubMediaLibraryListApi,
    exhibitFixture,
    mediaRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

/* The narrowest viewport 1.4.10 requires support for. */
const REFLOW_WIDTH = 320;

/*
 * Allow a single pixel: sub-pixel layout rounding can put scrollWidth one
 * above clientWidth on an element that does not actually scroll.
 */
async function expectNoDocumentScroll(page, label) {
    const measured = await page.evaluate(() => ({
        scrollWidth: document.scrollingElement.scrollWidth,
        clientWidth: document.scrollingElement.clientWidth,
        innerWidth: window.innerWidth,
    }));

    expect(
        measured.scrollWidth,
        `${label}: the page scrolls horizontally at ${measured.innerWidth}px `
        + `(scrollWidth ${measured.scrollWidth} vs clientWidth ${measured.clientWidth}). `
        + 'A table may scroll inside its wrapper; the document may not.'
    ).toBeLessThanOrEqual(measured.clientWidth + 1);
}

/*
 * PAINT, not geometry.
 *
 * The reflow tests below assert layout: box widths, scroll widths, computed
 * visibility. All of those passed while the dashboard was rendering a
 * completely blank page at every width <= 768px, because the content was
 * laid out perfectly and then covered. The theme's `.navbar { height: 100vh }`
 * in that range is unscoped and also matched the page header in
 * main-header.ejs, which is `.navbar.fixed-top` — fixed, opaque white,
 * z-index 1030. At 100vh it painted over the entire viewport.
 *
 * Neither the DOM measurements nor axe can see that: the content is present,
 * correctly sized and reported `visible`; it is simply underneath something.
 * So these tests use hit-testing, which is the cheapest assertion that
 * actually depends on paint order.
 */
test.describe('page content is not covered', () => {

    /* 768 is the theme breakpoint itself, and 750 is a typical half-screen
       window — the width this was first reported at. */
    for (const width of [1280, 768, 750, 320]) {

        test(`content is hittable at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 820 });
            await seedAuth(page);
            await stubDashboardDeps(page);
            await stubExhibitsApi(page, {
                records: [exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Sample exhibit' })],
            });

            await page.goto(`${APP_PATH}/exhibits`);
            await expect(page.locator('table#exhibits tbody tr')).toHaveCount(1);

            const probe = await page.evaluate(() => {
                const header = document.querySelector('header .navbar');
                const main = document.querySelector('main.content');
                const box = main.getBoundingClientRect();

                /* Hit-test the middle of the content column. Whatever is
                   returned is what a click would land on and what the reader
                   actually sees at that point. */
                const x = Math.round(box.left + (box.width / 2));
                const y = Math.round(Math.min(box.top + 120, window.innerHeight - 10));
                const hit = document.elementFromPoint(x, y);

                return {
                    headerHeight: Math.round(header.getBoundingClientRect().height),
                    viewportHeight: window.innerHeight,
                    hitInsideMain: hit ? main.contains(hit) : false,
                    hit: hit ? `${hit.tagName}${hit.id ? '#' + hit.id : ''}.${String(hit.className).split(' ')[0]}` : null,
                };
            });

            expect(
                probe.headerHeight,
                `the fixed page header is ${probe.headerHeight}px tall in a `
                + `${probe.viewportHeight}px viewport — it is covering the page`
            ).toBeLessThan(200);

            expect(
                probe.hitInsideMain,
                `the point at the centre of the content column hits ${probe.hit}, `
                + 'which is outside <main> — something is painted over the content'
            ).toBe(true);
        });
    }
});

test.describe('WCAG 1.4.10 reflow at 320px', () => {

    test.use({ viewport: { width: REFLOW_WIDTH, height: 800 } });

    test('items list does not scroll the page sideways', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
        await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                { uuid: 'a', type: 'item', item_type: 'text', title: 'First',  order: 1, is_published: 0, is_locked: 0, is_member_of_exhibit: EXHIBIT_UUID },
                { uuid: 'b', type: 'item', item_type: 'text', title: 'Second', order: 2, is_published: 0, is_locked: 0, is_member_of_exhibit: EXHIBIT_UUID },
            ],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('table#items tbody tr')).toHaveCount(2);

        await expectNoDocumentScroll(page, 'items list');
    });

    test('exhibits list does not scroll the page sideways', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page);
        await stubExhibitsApi(page, {
            records: [exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Sample exhibit' })],
        });

        await page.goto(`${APP_PATH}/exhibits`);
        await expect(page.locator('table#exhibits tbody tr')).toHaveCount(1);

        await expectNoDocumentScroll(page, 'exhibits list');
    });

    test('media library does not scroll the page sideways', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page);
        await stubExhibitsApi(page, { records: [] });
        await stubMediaLibraryListApi(page, {
            records: [mediaRecordFixture({ uuid: 'media-1', ingest_method: 'upload' })],
        });

        await page.goto(`${APP_PATH}/media/library`);
        await expect(page.locator('a.btn-delete-media')).toHaveCount(1);

        await expectNoDocumentScroll(page, 'media library');
    });

    test('styles form reflows without clipping the required badge', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Styled exhibit' }) },
        });

        await page.goto(`${APP_PATH}/styles?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#exhibit-styles-card')).toBeVisible();

        await expectNoDocumentScroll(page, 'styles form');

        /*
         * The accordion header previously ran past the viewport with the page
         * NOT scrolling, so the "Required" badge and the colour swatches were
         * clipped away entirely — content lost rather than reflowed, and the
         * lost part carried the non-visual required indicator.
         */
        const clipped = await page.evaluate(() => {
            const out = [];
            document.querySelectorAll('#exhibit-styles-card .card-header .btn-link *').forEach(el => {
                const box = el.getBoundingClientRect();
                if (box.width > 0 && box.right > window.innerWidth + 1) {
                    out.push(`${el.tagName}.${el.className} right=${Math.round(box.right)}`);
                }
            });
            return out;
        });

        expect(clipped, `styles accordion header content past the 320px edge: ${clipped.join(', ')}`).toEqual([]);
    });

    test('sidebar navigation stays reachable', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
        await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                { uuid: 'a', type: 'item', item_type: 'text', title: 'First', order: 1, is_published: 0, is_locked: 0, is_member_of_exhibit: EXHIBIT_UUID },
            ],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('table#items tbody tr')).toHaveCount(1);

        /*
         * The regression this guards is total: the panel went `display: none`
         * and every link inside it went with it. Asserting one visible link is
         * enough to catch that, and does not pin the nav's exact contents.
         */
        await expect(page.locator('#left-panel')).toBeVisible();
        await expect(page.locator('#sidebar-toggle')).toBeVisible();
        await expect(page.locator('#exhibits-link')).toBeVisible();

        /* The rail must not eat the content column: the theme left an 83px
           margin behind a 0px-wide sidebar, costing a quarter of the viewport. */
        const gutter = await page.evaluate(() => {
            const rail = document.querySelector('#left-panel').getBoundingClientRect().width;
            const offset = parseFloat(getComputedStyle(document.querySelector('#right-panel')).marginLeft);
            return { rail, offset };
        });

        expect(gutter.offset, 'content offset must match the rail width, not exceed it')
            .toBeLessThanOrEqual(gutter.rail + 1);
    });
});
