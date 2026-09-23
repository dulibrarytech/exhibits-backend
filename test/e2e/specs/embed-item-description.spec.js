'use strict';

/**
 * "Embed item" governs "Pop-up Window Description" on the three media forms
 * (helperModule.bind_embed_description + rteModule.set_enabled).
 *
 * Background (2026-09-14): the original wiring set `.disabled` on what had
 * become a Quill <div> — a no-op — and dimmed the field to 50 % opacity. The
 * editor looked disabled, stayed fully editable, and its text failed AA
 * contrast (3.12:1) precisely because the control was still active. The
 * field is now genuinely disabled while the box is checked: contenteditable
 * off, aria-disabled, toolbar out of the tab order, a note under the label,
 * a polite announcement — and the saved text is kept (search results and
 * the index still read it).
 */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    stubGridItemRecordApi,
    stubTimelineItemApi,
    stubMediaApi,
    exhibitFixture,
    standardItemRecordFixture,
    gridItemRecordFixture,
    timelineItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440300';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const GRID_ITEM_UUID = '880e8400-e29b-41d4-a716-446655440200';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440100';
const TIMELINE_ITEM_UUID = '990e8400-e29b-41d4-a716-446655440400';

const DESCRIPTION = '<p>Shown in the pop-up viewer and in search results.</p>';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const CHECKBOX = '#embed-item';
const EDITOR = '#item-description-input .ql-editor';
const NOTE = '#item-description-input-embed-note';
const STATUS = '#embed-item-status';

/* the editor's state as one object, so a form can be asserted in one go */
async function description_state(page) {
    return page.evaluate(() => {
        const container = document.getElementById('item-description-input');
        const editor = container.querySelector('.ql-editor');
        const toolbar = container.previousElementSibling && container.previousElementSibling.classList.contains('ql-toolbar')
            ? container.previousElementSibling
            : null;
        const note = document.getElementById('item-description-input-embed-note');
        const status = document.getElementById('embed-item-status');
        const focusable_toolbar_controls = toolbar
            ? [...toolbar.querySelectorAll('button, [tabindex]')].filter((el) => el.tabIndex >= 0 && !el.disabled && el.offsetParent !== null).length
            : 0;
        return {
            contenteditable: editor.getAttribute('contenteditable'),
            ariaDisabled: editor.getAttribute('aria-disabled'),
            describedBy: editor.getAttribute('aria-describedby'),
            qlDisabled: container.classList.contains('ql-disabled'),
            toolbarHidden: toolbar ? toolbar.hidden : null,
            focusableToolbarControls: focusable_toolbar_controls,
            noteVisible: note ? !note.hidden && note.offsetParent !== null : false,
            noteText: note ? note.textContent : null,
            status: status ? status.textContent : null,
            statusLive: status ? status.getAttribute('aria-live') : null,
            controls: document.getElementById('embed-item').getAttribute('aria-controls'),
            html: editor.innerHTML,
            /* the checkbox group now precedes the description row */
            groupBeforeRow: !!(document.getElementById('embed-item-group').compareDocumentPosition(document.getElementById('is-media-only-description')) & Node.DOCUMENT_POSITION_FOLLOWING),
            opacity: getComputedStyle(container).opacity,
        };
    });
}

async function expect_enabled(page) {
    const s = await description_state(page);
    expect(s.contenteditable).toBe('true');
    expect(s.ariaDisabled).toBe(null);
    expect(s.describedBy).toBe(null);
    expect(s.qlDisabled).toBe(false);
    expect(s.toolbarHidden).toBe(false);
    expect(s.focusableToolbarControls).toBeGreaterThan(0);
    expect(s.noteVisible).toBe(false);
    expect(s.opacity).toBe('1');
    return s;
}

async function expect_disabled(page) {
    const s = await description_state(page);
    expect(s.contenteditable).toBe('false');
    expect(s.ariaDisabled).toBe('true');
    expect(s.describedBy).toBe('item-description-input-embed-note');
    expect(s.qlDisabled).toBe(true);
    expect(s.toolbarHidden).toBe(true);
    expect(s.focusableToolbarControls).toBe(0);
    expect(s.noteVisible).toBe(true);
    expect(s.noteText).toMatch(/not used while embed item is checked/i);
    /* no opacity hack — the state is real, the text stays legible */
    expect(s.opacity).toBe('1');
    return s;
}

async function expect_no_axe_violations(page) {
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS)
        .include('#is-media-only-description').include('#embed-item-group').analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.describe('Embed item disables the Pop-up Window Description (standard item media edit)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubMediaApi(page);
    });

    test('checking the box disables the editor, explains why, announces it, and keeps the text', async ({ page }) => {
        const state = await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID, item_type: 'video', mime_type: 'video/mp4',
                media_uuid: 'media-uuid-existing', is_embedded: 0, description: DESCRIPTION,
            }),
        });
        await page.goto(`${APP_PATH}/items/standard/media/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`);
        await expect(page.locator(EDITOR)).toContainText('Shown in the pop-up viewer');
        await expect(page.locator(CHECKBOX)).not.toBeChecked();

        const before = await expect_enabled(page);
        expect(before.groupBeforeRow).toBe(true);
        expect(before.controls).toBe('is-media-only-description');
        /* nothing announced on load */
        expect(before.status ?? '').toBe('');

        await page.check(CHECKBOX);
        const after = await expect_disabled(page);
        expect(after.html).toBe(DESCRIPTION);
        /* a real click is announced (a record-driven change is not — see the edit-load test) */
        expect(after.statusLive).toBe('polite');
        expect(after.status).toMatch(/not used while embed item is checked/i);

        /* keyboard: Shift+Tab from the checkbox must not land in the disabled editor or its toolbar */
        await page.focus(CHECKBOX);
        await page.keyboard.press('Shift+Tab');
        const landed = await page.evaluate(() => {
            const a = document.activeElement;
            return { insideDescription: a.closest('#is-media-only-description') !== null, tag: a.tagName, cls: a.className };
        });
        expect(landed.insideDescription).toBe(false);

        /* the saved text is submitted unchanged */
        await page.click('#save-item-btn');
        await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
        expect(state.lastUpdatePayload.is_embedded).toBe(1);
        expect(state.lastUpdatePayload.description).toBe(DESCRIPTION);
    });

    test('unchecking restores the editor and toolbar', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID, item_type: 'video', mime_type: 'video/mp4',
                media_uuid: 'media-uuid-existing', is_embedded: 0, description: DESCRIPTION,
            }),
        });
        await page.goto(`${APP_PATH}/items/standard/media/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`);
        await expect(page.locator(EDITOR)).toContainText('Shown in the pop-up viewer');

        await page.check(CHECKBOX);
        await expect_disabled(page);
        await page.uncheck(CHECKBOX);
        const s = await expect_enabled(page);
        expect(s.status).toMatch(/available again/i);

        /* and it really is editable again */
        await page.click(EDITOR);
        await page.keyboard.press('End');
        await page.keyboard.type(' More.');
        await expect(page.locator(EDITOR)).toContainText('search results. More.');
    });

    test('an item saved as embedded loads with the description disabled, without an announcement', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID, item_type: 'video', mime_type: 'video/mp4',
                media_uuid: 'media-uuid-existing', is_embedded: 1, description: DESCRIPTION,
            }),
        });
        await page.goto(`${APP_PATH}/items/standard/media/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`);
        await expect(page.locator(CHECKBOX)).toBeChecked();
        await expect(page.locator(EDITOR)).toContainText('Shown in the pop-up viewer');

        const s = await expect_disabled(page);
        expect(s.html).toBe(DESCRIPTION);
        expect(s.status ?? '').toBe('');
    });

    test('no axe violations in either state (the old 50 % opacity failed color-contrast)', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID, item_type: 'video', mime_type: 'video/mp4',
                media_uuid: 'media-uuid-existing', is_embedded: 0, description: DESCRIPTION,
            }),
        });
        await page.goto(`${APP_PATH}/items/standard/media/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`);
        await expect(page.locator(EDITOR)).toContainText('Shown in the pop-up viewer');

        await expect_no_axe_violations(page);
        await page.check(CHECKBOX);
        await expect_disabled(page);
        await expect_no_axe_violations(page);
    });

    test('the details page explains an embedded item\'s unused description', async ({ page }) => {
        await stubStandardItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: standardItemRecordFixture({
                uuid: ITEM_UUID, item_type: 'video', mime_type: 'video/mp4',
                media_uuid: 'media-uuid-existing', is_embedded: 1, description: DESCRIPTION,
            }),
        });
        await page.goto(`${APP_PATH}/items/standard/media/details?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`);
        await expect(page.locator('#item-description-input')).toContainText('Shown in the pop-up viewer');
        await expect(page.locator(NOTE)).toBeVisible();
        await expect(page.locator(NOTE)).toContainText(/embedded/i);
    });
});

test.describe('Embed item disables the Pop-up Window Description (grid and timeline item media edit)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID }) },
        });
        await stubMediaApi(page);
    });

    test('grid item', async ({ page }) => {
        await stubGridItemRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            record: gridItemRecordFixture({
                uuid: GRID_ITEM_UUID, item_type: 'video', mime_type: 'video/mp4',
                media_uuid: 'media-uuid-existing', is_embedded: 0, description: DESCRIPTION,
            }),
        });
        await page.goto(
            `${APP_PATH}/items/grid/item/media/edit?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}&item_id=${GRID_ITEM_UUID}`
        );
        await expect(page.locator(EDITOR)).toContainText('Shown in the pop-up viewer');

        const before = await expect_enabled(page);
        expect(before.groupBeforeRow).toBe(true);
        await page.check(CHECKBOX);
        const after = await expect_disabled(page);
        expect(after.html).toBe(DESCRIPTION);
        await page.uncheck(CHECKBOX);
        await expect_enabled(page);
    });

    test('timeline item', async ({ page }) => {
        await stubTimelineItemApi(page, {
            exhibitId: EXHIBIT_UUID,
            timelineId: TIMELINE_UUID,
            record: timelineItemRecordFixture({
                uuid: TIMELINE_ITEM_UUID, item_type: 'video', mime_type: 'video/mp4',
                media_uuid: 'media-uuid-existing', is_embedded: 0, description: DESCRIPTION,
            }),
        });
        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/media/edit`
            + `?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}&item_id=${TIMELINE_ITEM_UUID}`
        );
        await expect(page.locator(EDITOR)).toContainText('Shown in the pop-up viewer');

        const before = await expect_enabled(page);
        expect(before.groupBeforeRow).toBe(true);
        await page.check(CHECKBOX);
        const after = await expect_disabled(page);
        expect(after.html).toBe(DESCRIPTION);
        await page.uncheck(CHECKBOX);
        await expect_enabled(page);
    });
});
