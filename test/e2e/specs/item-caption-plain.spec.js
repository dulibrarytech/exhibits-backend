'use strict';

/**
 * Caption is plain text, not rich text.
 *
 * views/partials/item-caption.ejs is shared by the standard, grid and timeline
 * media forms, so all three are covered here — a regression in the shared
 * partial would otherwise only surface on whichever type happened to be tested.
 *
 * These lock in three things:
 *   - the control is a <textarea>, with no Quill editor mounted on it
 *   - the submitted value is bare text, NOT the `<p>…</p>` a full-profile
 *     editor produces (the server gate holds caption at the `plain` profile)
 *   - the details page renders it as static text
 */

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    stubHeadingRecordsApi,
    stubGridItemRecordApi,
    stubTimelineItemApi,
    stubMediaApi,
    exhibitFixture,
    standardItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440300';
const GRID_UUID = '660e8400-e29b-41d4-a716-446655440100';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440200';

const CAPTION = '#item-caption-input';

async function assert_is_plain_textarea(page) {
    await expect(page.locator(CAPTION)).toHaveCount(1);

    const shape = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return {
            tag: el.tagName,
            hasRteAttr: el.hasAttribute('data-rte'),
            /* a mounted editor leaves a .ql-editor child behind */
            hasQuillChild: el.querySelector('.ql-editor') !== null,
        };
    }, CAPTION);

    expect(shape.tag).toBe('TEXTAREA');
    expect(shape.hasRteAttr).toBe(false);
    expect(shape.hasQuillChild).toBe(false);
}

test.describe('Caption field is plain text, not an RTE', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubMediaApi(page);
    });

    test('standard item media form renders a textarea, not an editor', async ({ page }) => {
        await stubStandardItemApi(page, { exhibitId: EXHIBIT_UUID });
        await page.goto(`${APP_PATH}/items/standard/media?exhibit_id=${EXHIBIT_UUID}`);
        await assert_is_plain_textarea(page);
    });

    test('grid item media form renders a textarea, not an editor', async ({ page }) => {
        await stubGridItemRecordApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID });
        await page.goto(
            `${APP_PATH}/items/grid/item/media?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`
        );
        await assert_is_plain_textarea(page);
    });

    test('timeline item media form renders a textarea, not an editor', async ({ page }) => {
        await stubTimelineItemApi(page, { exhibitId: EXHIBIT_UUID, timelineId: TIMELINE_UUID });
        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`
        );
        await assert_is_plain_textarea(page);
    });

    /*
     * The whole point of the change: a full-profile editor would submit
     * "<p>Plain caption text</p>". A textarea submits the bare string.
     */
    test('submits the caption as bare text, not paragraph-wrapped', async ({ page }) => {
        const state = await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID,
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/media/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`
        );
        await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-existing');

        await page.fill(CAPTION, 'Plain caption text');
        await page.click('#save-item-btn');

        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.caption).toBe('Plain caption text');
        expect(state.lastUpdatePayload.caption).not.toContain('<p>');
    });

    test('populates an existing caption into the textarea on edit', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID,
                caption: 'Stored caption',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/media/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator(CAPTION)).toHaveValue('Stored caption');
    });

    /*
     * The details page must show the caption as TEXT. Setting innerHTML there
     * would render any markup a legacy value still carries.
     */
    test('details page shows the caption as static text', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID,
                caption: 'Read-only caption',
                item_type: 'image',
                mime_type: 'image/jpeg',
                media_uuid: 'media-uuid-existing',
            }),
        });

        await page.goto(
            `${APP_PATH}/items/standard/media/details?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`
        );

        await expect(page.locator(CAPTION)).toHaveText('Read-only caption');
        await expect(page.locator(`${CAPTION} .ql-editor`)).toHaveCount(0);
    });
});

test.describe('Heading Text is a plain textarea, gate keeps its emphasis', () => {

    /*
     * The editor came off Heading Text on 2026-09-09, but the gate stayed at
     * `reduced` — 171 of 300 stored headings carry b/i/u or <br>, and a
     * `plain` gate would have flattened 142 of them, including italicised
     * work titles. So: authored as plain text, existing markup preserved.
     */
    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
    });

    test('renders a textarea, not an editor', async ({ page }) => {
        await stubHeadingRecordsApi(page, { exhibitId: EXHIBIT_UUID });
        await page.goto(`${APP_PATH}/items/heading?exhibit_id=${EXHIBIT_UUID}`);

        const shape = await page.evaluate(() => {
            const el = document.querySelector('#item-heading-text-input');
            return {
                tag: el.tagName,
                hasRteAttr: el.hasAttribute('data-rte'),
                hasQuillChild: el.querySelector('.ql-editor') !== null,
            };
        });

        expect(shape.tag).toBe('TEXTAREA');
        expect(shape.hasRteAttr).toBe(false);
        expect(shape.hasQuillChild).toBe(false);
    });

    test('submits the heading as bare text, not paragraph-wrapped', async ({ page }) => {
        const state = await stubHeadingRecordsApi(page, { exhibitId: EXHIBIT_UUID });
        await page.goto(`${APP_PATH}/items/heading?exhibit_id=${EXHIBIT_UUID}`);
        /* init() is async — wait for the save handler to be wired */
        await expect(page.locator('#save-heading-btn')).toBeEnabled();

        await page.fill('#item-heading-text-input', 'Chapter One');
        await page.selectOption('#item-heading-type-input', 'heading');
        await page.click('#save-heading-btn');

        await expect.poll(() => state.createCount).toBeGreaterThan(0);
        expect(state.lastCreatePayload.text).toBe('Chapter One');
        expect(state.lastCreatePayload.text).not.toContain('<p>');
    });

    test('still blocks submit when the heading text is empty', async ({ page }) => {
        const state = await stubHeadingRecordsApi(page, { exhibitId: EXHIBIT_UUID });
        await page.goto(`${APP_PATH}/items/heading?exhibit_id=${EXHIBIT_UUID}`);

        await page.selectOption('#item-heading-type-input', 'heading');
        await page.click('#save-heading-btn');

        await expect(page.locator('#message .alert-danger')).toContainText(/please enter heading text/i);
        expect(state.createCount).toBe(0);
    });
});
