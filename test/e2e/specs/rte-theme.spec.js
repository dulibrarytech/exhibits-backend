'use strict';

/**
 * Rich text surface typography (public/assets/css/rte.css) and item style
 * preset mirroring (rteModule.set_theme + helperModule.bind_item_style_theme).
 *
 * Background (2026-09-11): the dashboard theme styles bare elements — p, a,
 * h1-h6, ul/ol — for page chrome, and those rules matched the elements Quill
 * renders inside the editor. Paragraphs took the theme's Open Sans 16px grey
 * while list items inherited the editor's Helvetica 14px near-black: one
 * field, two fonts. rte.css now gives every rich text surface one typography
 * that its block elements inherit, and the item forms mirror the selected
 * style preset on the editor the way the public site applies it to the item.
 *
 * Assertions read COMPUTED styles — the defect was invisible in the markup.
 */

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    stubGridRecordApi,
    stubGridItemRecordApi,
    stubTimelineRecordApi,
    stubMediaApi,
    exhibitFixture,
    standardItemRecordFixture,
    gridRecordFixture,
    gridItemRecordFixture,
    timelineRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440300';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const GRID_ITEM_UUID = '880e8400-e29b-41d4-a716-446655440200';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440100';

/* paragraph, link, nested list, stored heading — every element type the gate keeps */
const MIXED_TEXT = '<h2>Section</h2><p>Paragraph with <a href="https://du.edu">a link</a>.</p>'
    + '<ul><li>first bullet<ul><li>nested bullet</li></ul></li></ul>';

const TYPOGRAPHY = ['fontFamily', 'fontSize', 'lineHeight', 'color'];

/* computed typography of the first element matching `selector` under `root` */
async function computed(page, root, selector) {
    return page.evaluate(([rootSel, sel, props]) => {
        const el = document.querySelector(rootSel).querySelector(sel);
        const cs = getComputedStyle(el);
        const out = {};
        props.forEach((p) => { out[p] = cs[p]; });
        return out;
    }, [root, selector, TYPOGRAPHY]);
}

/* inline theme currently set on a container (what set_theme writes) */
async function inline_theme(page, id) {
    return page.evaluate((elementId) => {
        const s = document.getElementById(elementId).style;
        return { fontFamily: s.fontFamily, fontSize: s.fontSize, color: s.color, backgroundColor: s.backgroundColor };
    }, id);
}

const PRESETS = {
    exhibit: {
        template: { backgroundColor: '#fdfdfd', color: '#111111', fontFamily: 'Georgia', fontSize: '15px' },
        item1: { backgroundColor: '#c2ced5', color: '#303030', fontFamily: 'IBM Plex Mono', fontSize: '19px' },
        /* fontSize left empty on purpose: it must fall through to the template's */
        item2: { backgroundColor: '#ffffff', color: '#4b0082', fontFamily: 'Courier New', fontSize: '' },
    },
};

test.describe('RTE typography — one font per surface (4a)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubMediaApi(page);
    });

    test('paragraphs, list items and headings share the editor typography; links are blue', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({ uuid: ITEM_UUID, item_type: 'text', text: MIXED_TEXT }),
        });
        await page.goto(`${APP_PATH}/items/standard/text/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`);
        await expect(page.locator('#item-text-input .ql-editor li')).toHaveCount(2);

        const root = '#item-text-input .ql-editor';
        const p = await computed(page, root, 'p');
        const li = await computed(page, root, 'li');
        /* the editor renders nesting as a flat list with indent classes */
        const nested = await computed(page, root, 'li.ql-indent-1');
        const h2 = await computed(page, root, 'h2');
        const a = await computed(page, root, 'a');

        /* the defect: p and li differed on every one of these */
        expect(li).toEqual(p);
        expect(nested).toEqual(p);

        /* the surface's own typography, not the theme's page-chrome values */
        expect(p.fontFamily).toMatch(/Open Sans/);
        expect(p.fontSize).toBe('14px');
        expect(p.color).toBe('rgb(33, 37, 41)');
        expect(p.color).not.toBe('rgb(90, 90, 90)');

        /* headings keep the surface font/colour at a larger size */
        expect(h2.fontFamily).toBe(p.fontFamily);
        expect(h2.color).toBe(p.color);
        expect(parseFloat(h2.fontSize)).toBeGreaterThan(parseFloat(p.fontSize));

        /* links: same font, visibly links */
        expect(a.fontFamily).toBe(p.fontFamily);
        expect(a.fontSize).toBe(p.fontSize);
        expect(a.color).toBe('rgb(0, 123, 255)');
        expect(await page.evaluate(() => getComputedStyle(document.querySelector('#item-text-input .ql-editor a')).textDecorationLine))
            .toBe('underline');
    });

    test('the static read-only box matches: one typography, blue links, indented lists', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({ uuid: GRID_ITEM_UUID, item_type: 'text', text: MIXED_TEXT }),
        });
        await page.goto(
            `${APP_PATH}/items/grid/item/text/details?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${GRID_ITEM_UUID}`
        );
        await expect(page.locator('#item-text-input li')).toHaveCount(2);
        await expect(page.locator('#item-text-input')).toHaveClass(/rte-readonly/);

        const root = '#item-text-input';
        const p = await computed(page, root, 'p');
        const li = await computed(page, root, 'li');
        const a = await computed(page, root, 'a');

        expect(li).toEqual(p);
        expect(p.fontSize).toBe('14px');
        expect(p.color).toBe('rgb(33, 37, 41)');

        /* the theme's a { color: #5A5A5A } used to win here (no Quill sheet applies) */
        expect(a.color).toBe('rgb(0, 123, 255)');

        /* the theme's ul, ol { padding-left: 0 } pushed bullets outside the box */
        const padding = await page.evaluate(() => {
            const ul = document.querySelector('#item-text-input ul');
            const inner = document.querySelector('#item-text-input ul ul');
            return {
                outer: parseFloat(getComputedStyle(ul).paddingLeft),
                nestedOffset: inner.getBoundingClientRect().left - ul.getBoundingClientRect().left,
            };
        });
        expect(padding.outer).toBeGreaterThan(0);
        expect(padding.nestedOffset).toBeGreaterThan(0);
    });
});

test.describe('RTE theme — the selected item style preset is mirrored on the editor (4b)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubMediaApi(page);
    });

    test('standard item: saved preset applied on load, template fills gaps, content inherits it', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: PRESETS }) },
        });
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({ uuid: ITEM_UUID, item_type: 'text', text: MIXED_TEXT, styles: 'item2' }),
        });
        await page.goto(`${APP_PATH}/items/standard/text/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`);
        await expect(page.locator('#item-styles-card')).toBeVisible();
        await expect(page.locator('#item-style-item2')).toBeChecked();

        /* item2 leaves fontSize empty → the template's 15px is the base layer */
        await expect.poll(() => inline_theme(page, 'item-text-input')).toEqual({
            fontFamily: '"Courier New"',
            fontSize: '15px',
            color: 'rgb(75, 0, 130)',
            backgroundColor: 'rgb(255, 255, 255)',
        });

        /* the point of 4a + 4b together: paragraphs AND bullets show the preset */
        const root = '#item-text-input .ql-editor';
        const p = await computed(page, root, 'p');
        const li = await computed(page, root, 'li.ql-indent-1');
        expect(p.fontFamily).toBe('"Courier New"');
        expect(p.fontSize).toBe('15px');
        expect(p.color).toBe('rgb(75, 0, 130)');
        expect(li).toEqual(p);

        /* the description editor is not styled by the preset on the public site */
        expect((await inline_theme(page, 'item-description-input')).fontFamily).toBe('');
    });

    test('changing the preset re-themes the editor immediately', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: PRESETS }) },
        });
        await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });
        await page.goto(`${APP_PATH}/items/standard/text?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#item-styles-card')).toBeVisible();

        /* add form: the first preset is checked by default and already mirrored */
        await expect(page.locator('#item-style-item1')).toBeChecked();
        await expect.poll(() => inline_theme(page, 'item-text-input')).toEqual({
            fontFamily: '"IBM Plex Mono"',
            fontSize: '19px',
            color: 'rgb(48, 48, 48)',
            backgroundColor: 'rgb(194, 206, 213)',
        });

        await page.check('#item-style-item2');
        await expect.poll(() => inline_theme(page, 'item-text-input')).toEqual({
            fontFamily: '"Courier New"',
            fontSize: '15px',
            color: 'rgb(75, 0, 130)',
            backgroundColor: 'rgb(255, 255, 255)',
        });

        /* and back */
        await page.check('#item-style-item1');
        await expect.poll(() => inline_theme(page, 'item-text-input').then((t) => t.fontFamily)).toBe('"IBM Plex Mono"');
    });

    test('an exhibit without item presets leaves the editor on the stylesheet defaults', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: { exhibit: { template: PRESETS.exhibit.template } } }) },
        });
        await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });
        await page.goto(`${APP_PATH}/items/standard/text?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#item-text-input .ql-editor')).toBeVisible();
        /* helperModule.show_form() reveals every .card regardless; the chooser itself stays empty */
        await expect(page.locator('input[name="styles"]')).toHaveCount(0);

        expect(await inline_theme(page, 'item-text-input')).toEqual({ fontFamily: '', fontSize: '', color: '', backgroundColor: '' });
        expect((await computed(page, '#item-text-input .ql-editor', 'p')).fontFamily).toMatch(/Open Sans/);
    });

    /*
     * Details pages run the same common form init, so they fetch the presets
     * too — but render no chooser and a disabled editor. The theme must not
     * reach that box (2026-09-11: the template preset's black background did).
     */
    test('details page: the read-only editor keeps the defaults, presets or not', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: PRESETS }) },
        });
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({ uuid: ITEM_UUID, item_type: 'text', text: MIXED_TEXT, styles: 'item1' }),
        });
        await page.goto(`${APP_PATH}/items/standard/text/details?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`);
        await expect(page.locator('#item-text-input .ql-editor')).toHaveAttribute('contenteditable', 'false');
        await expect(page.locator('#item-text-input .ql-editor li')).toHaveCount(2);
        /* give a late apply every chance to (wrongly) land before asserting */
        await page.waitForTimeout(500);

        expect(await inline_theme(page, 'item-text-input')).toEqual({ fontFamily: '', fontSize: '', color: '', backgroundColor: '' });
        const p = await computed(page, '#item-text-input .ql-editor', 'p');
        expect(p.fontFamily).toMatch(/Open Sans/);
        expect(p.color).toBe('rgb(33, 37, 41)');
        expect(await page.evaluate(() => getComputedStyle(document.getElementById('item-text-input')).backgroundColor))
            .toBe('rgb(233, 236, 239)');
    });

    test('grid form mirrors the grid preset on the grid text editor', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: PRESETS }) },
        });
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, styles: 'item1' }),
        });
        await page.goto(`${APP_PATH}/items/grid/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${GRID_UUID}`);
        await expect(page.locator('#item-style-item1')).toBeChecked();

        await expect.poll(() => inline_theme(page, 'grid-text-input').then((t) => t.fontFamily)).toBe('"IBM Plex Mono"');
        await page.check('#item-style-item2');
        await expect.poll(() => inline_theme(page, 'grid-text-input').then((t) => t.color)).toBe('rgb(75, 0, 130)');
    });

    test('timeline form mirrors the timeline preset on the timeline text editor', async ({ page }) => {
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: PRESETS }) },
        });
        await stubTimelineRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: timelineRecordFixture({ uuid: TIMELINE_UUID, styles: 'item2' }),
        });
        await page.goto(`${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${TIMELINE_UUID}`);
        await expect(page.locator('#item-style-item2')).toBeChecked();

        await expect.poll(() => inline_theme(page, 'timeline-text-input')).toEqual({
            fontFamily: '"Courier New"',
            fontSize: '15px',
            color: 'rgb(75, 0, 130)',
            backgroundColor: 'rgb(255, 255, 255)',
        });
    });
});
