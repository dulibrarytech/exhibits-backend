'use strict';

/**
 * Editor-side vocabulary enforcement (public/app/utils/rte.module.js).
 *
 * These cover the three places where the editor used to accept input the
 * server gate would silently discard on save — the class of bug where staff
 * see one thing in the editor and get another on the page:
 *
 *   - headings outside h2/h3, remapped on paste (HEADING_LEVEL_MAP)
 *   - newlines in a single-line reduced field (Enter binding + flatten)
 *   - scheme-less link URLs (patched Link blot)
 *
 * They drive Quill directly rather than the OS clipboard: `clipboard.convert`
 * is the same path a real paste takes, and is deterministic in CI.
 */

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

/* pastes html into the editor with the given id and returns the serialized value */
async function paste(page, id, html) {
    return page.evaluate(([editorId, markup]) => {
        const quill = window.Quill.find(document.getElementById(editorId));
        quill.setContents(quill.clipboard.convert({ html: markup }), 'user');
        /* rteModule is a top-level const — a lexical global, not a window property */
        return rteModule.get_html(editorId);
    }, [id, html]);
}

test.describe('RTE vocabulary — full profile (standard item text)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: {
                record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'RTE host exhibit' }),
            },
        });
        await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });
        await page.goto(`${APP_PATH}/items/standard/text?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#item-text-input')).toBeVisible();
    });

    /*
     * Quill's header format accepts h1-h6 while the gate allows h2/h3 only,
     * so an unmapped h1 looked like a heading in the editor and saved as
     * plain text.
     */
    test('remaps pasted headings into the h2/h3 the gate allows', async ({ page }) => {
        expect(await paste(page, 'item-text-input', '<h1>Title</h1><p>body</p>'))
            .toBe('<h2>Title</h2><p>body</p>');

        for (const level of ['h4', 'h5', 'h6']) {
            expect(await paste(page, 'item-text-input', `<${level}>Title</${level}>`))
                .toBe('<h3>Title</h3>');
        }
    });

    /*
     * The heading picker was removed from the toolbar on 2026-09-10. `header`
     * stays in `formats` on purpose — dropping it makes Quill strip h2/h3 on
     * LOAD as well as paste, which would destroy the stored headings.
     */
    test('offers no heading control, but still preserves headings', async ({ page }) => {
        const toolbar = await page.evaluate(() => {
            const quill = window.Quill.find(document.getElementById('item-text-input'));
            const container = quill.getModule('toolbar').container;
            return {
                hasHeadingPicker: container.querySelector('.ql-header') !== null,
                controls: [...container.querySelectorAll('button, .ql-picker')]
                    .map((el) => [...el.classList].find((c) => c.startsWith('ql-'))),
            };
        });

        expect(toolbar.hasHeadingPicker).toBe(false);
        expect(toolbar.controls).not.toContain('ql-header');
        /* the rest of the toolbar is unchanged */
        expect(toolbar.controls).toEqual(
            expect.arrayContaining(['ql-bold', 'ql-italic', 'ql-underline', 'ql-color', 'ql-link', 'ql-clean'])
        );

        /* a stored heading still round-trips */
        expect(await paste(page, 'item-text-input', '<h2>Beacon Printing</h2><p>body</p>'))
            .toBe('<h2>Beacon Printing</h2><p>body</p>');
    });

    test('leaves h2 and h3 untouched', async ({ page }) => {
        expect(await paste(page, 'item-text-input', '<h2>Two</h2>')).toBe('<h2>Two</h2>');
        expect(await paste(page, 'item-text-input', '<h3>Three</h3>')).toBe('<h3>Three</h3>');
    });

    test('keeps paragraph structure in the full profile', async ({ page }) => {
        expect(await paste(page, 'item-text-input', '<p>alpha</p><p>beta</p>'))
            .toBe('<p>alpha</p><p>beta</p>');
    });

    /*
     * Quill resolves a scheme-less URL against the dashboard origin, so it
     * used to be stored with no scheme and dropped by the gate on save.
     */
    test('adds a scheme to bare-domain links', async ({ page }) => {
        const href = await page.evaluate(() => {
            return window.Quill.import('formats/link').sanitize('www.example.com');
        });
        expect(href).toBe('https://www.example.com');
    });

    test('leaves usable link values alone and still blocks javascript:', async ({ page }) => {
        const results = await page.evaluate(() => {
            const Link = window.Quill.import('formats/link');
            return {
                https: Link.sanitize('https://du.edu'),
                mailto: Link.sanitize('mailto:a@du.edu'),
                relative: Link.sanitize('/exhibits/1'),
                script: Link.sanitize('javascript:alert(1)'),
            };
        });

        expect(results.https).toBe('https://du.edu');
        expect(results.mailto).toBe('mailto:a@du.edu');
        expect(results.relative).toBe('/exhibits/1');
        expect(results.script).not.toContain('javascript:');
    });
});

test.describe('RTE vocabulary — reduced profile (exhibit title)', () => {

    /*
     * Exhibit title, not heading text: Heading Text lost its editor on
     * 2026-09-09 and is a plain textarea now. Exhibit title/subtitle and the
     * grid/timeline item titles are the remaining reduced-profile editors.
     */
    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await page.goto(`${APP_PATH}/exhibits/exhibit`);
        await expect(page.locator('#exhibit-title-input')).toBeVisible();
    });

    /*
     * The reduced gate strips block tags, so a newline that reached the
     * server joined the words either side of it ("FirstSecond").
     */
    test('flattens pasted blocks to one line, keeping the word boundary', async ({ page }) => {
        expect(await paste(page, 'exhibit-title-input', '<p>First line</p><p>Second line</p>'))
            .toBe('<p>First line Second line</p>');

        expect(await paste(page, 'exhibit-title-input', '<ol><li>one</li><li>two</li></ol>'))
            .toBe('<p>one two</p>');
    });

    test('keeps inline formatting while flattening', async ({ page }) => {
        expect(await paste(page, 'exhibit-title-input', '<p><strong>Bold</strong></p><p>plain</p>'))
            .toBe('<p><strong>Bold</strong> plain</p>');
    });

    test('Enter does not create a second line', async ({ page }) => {
        await page.fill('#exhibit-title-input .ql-editor', 'First line');
        await page.click('#exhibit-title-input .ql-editor');
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
        await page.keyboard.type('Second line');

        const value = await page.evaluate(() => {
            return rteModule.get_html('exhibit-title-input');
        });

        expect(value).toBe('<p>First lineSecond line</p>');
        expect(value).not.toContain('</p><p>');
    });
});
