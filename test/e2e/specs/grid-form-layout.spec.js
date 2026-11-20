'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridRecordApi,
    stubGridItemsApi,
    exhibitFixture,
    gridRecordFixture,
    gridItemFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const GRID_PAGE_URL = `${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`;
const ADD_GRID_URL = `${APP_PATH}/items/grid?exhibit_id=${EXHIBIT_UUID}`;

const THREE_PRESETS = {
    exhibit: {
        item1: { backgroundColor: '#c2ced5', color: '#303030' },
        item2: { backgroundColor: '#ffffff', color: '#4b0082' },
        item3: { backgroundColor: '#000000', color: '#ffffff' },
    },
};

const LONG_TEXT = `<p>${'The club kept careful records of every outing. '.repeat(40).trim()}</p>`;

const REFUSAL = 'This grid is published and currently contains 3 published items. '
    + 'Publish additional items before changing the grid to 4 columns.';

function grid_items(count) {
    const items = [];
    for (let i = 1; i <= count; i++) {
        items.push(gridItemFixture({
            uuid: `g${i}`, order: i, title: `Item ${i}`,
            is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID,
        }));
    }
    return items;
}

async function box(page, selector) {
    const found = await page.locator(selector).boundingBox();
    expect(found, selector).not.toBeNull();
    return found;
}

const bottom = (found) => found.y + found.height;
const middle = (found) => found.y + found.height / 2;

async function open_grid_page(page, options) {
    const {
        width,
        height,
        text = 'Short grid text',
        presets = THREE_PRESETS,
        is_published = 0,
        update_status = 201,
        update_body,
    } = options;

    await page.setViewportSize({ width, height });
    await seedAuth(page);
    await stubDashboardDeps(page, {
        exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: presets }) },
    });
    await stubGridItemsApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID, items: grid_items(3) });
    await stubGridRecordApi(page, {
        exhibitId: EXHIBIT_UUID,
        record: gridRecordFixture({ uuid: GRID_UUID, text, columns: 3, is_published }),
        updateStatus: update_status,
        updateBody: update_body,
    });

    await page.goto(GRID_PAGE_URL);

    await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);
    await expect(page.locator('#item-style-options .item-style-option')).toHaveCount(presets === null ? 0 : Object.keys(presets.exhibit).length);
    await expect(page.locator('#grid-text-input .ql-editor')).not.toBeEmpty();
}

test.describe('Grid page — one Item Data card', () => {

    test('the whole grid form is one card, with Styles and Save inside it', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768 });

        await expect(page.locator('main .card')).toHaveCount(2);
        await expect(page.locator('#item-submit-card')).toHaveCount(0);
        await expect(page.locator('#grid-data-card #item-styles-card')).toBeVisible();
        await expect(page.locator('#grid-data-card #save-item-btn')).toBeVisible();
        await expect(page.locator('#item-card .card-title')).toBeInViewport({ ratio: 1 });

        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sideways).toBeLessThanOrEqual(0);
    });

    test('the Text box spans Internal Name and Grid Columns, with Styles to its right', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768 });

        const text = await box(page, '#grid-text-input');
        const internal_name = await box(page, '#grid-internal-name-input');
        const columns = await box(page, '#grid-columns');
        const styles = await box(page, '#item-styles-card');

        expect(internal_name.x).toBeCloseTo(text.x, 0);
        expect(columns.x + columns.width).toBeCloseTo(text.x + text.width, 0);
        expect(internal_name.y).toBeGreaterThan(bottom(text));
        expect(text.width).toBeGreaterThan(internal_name.width + columns.width);
        expect(styles.x).toBeGreaterThanOrEqual(text.x + text.width);
        expect(styles.y).toBeLessThan(text.y);

        const chooser = await box(page, '#item-style-options');
        expect(chooser.width).toBeGreaterThan(styles.width / 2);

        const text_label = await box(page, 'div.form-text:has(#grid-text-input-label)');
        const styles_label = await box(page, '#item-styles-card > .form-text');
        expect(styles_label.y).toBeCloseTo(text_label.y, 0);
        expect(styles_label.height).toBeCloseTo(text_label.height, 0);
    });

    test('Internal Name and Grid Columns line up, each with its hint above the field', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768 });

        const name_label = await box(page, 'label[for="grid-internal-name-input"]');
        const name_hint = await box(page, '#grid-internal-name-hint');
        const internal_name = await box(page, '#grid-internal-name-input');
        const columns_label = await box(page, 'label[for="grid-columns"]');
        const columns_hint = await box(page, '#grid-columns-hint');
        const columns = await box(page, '#grid-columns');

        expect(bottom(name_hint)).toBeLessThanOrEqual(internal_name.y);
        expect(bottom(columns_hint)).toBeLessThanOrEqual(columns.y);
        expect(columns_hint.y).toBeGreaterThanOrEqual(bottom(columns_label));
        expect(columns_label.y).toBeCloseTo(name_label.y, 0);
        expect(columns.y).toBeCloseTo(internal_name.y, 0);
        expect(columns.x).toBeGreaterThan(internal_name.x + internal_name.width);
        expect(columns.width).toBeLessThan(internal_name.width);

        await expect(page.locator('#grid-columns-hint .fa-exclamation-circle')).toHaveCount(1);
        await expect(page.locator('#grid-columns-hint em')).toHaveText('Select the number of columns to display (2–4).');
    });

    test('at 1,270 wide both hints fit on one line, so labels and fields line up', async ({ page }) => {
        await open_grid_page(page, { width: 1270, height: 800 });

        const name_label = await box(page, 'label[for="grid-internal-name-input"]');
        const name_hint = await box(page, '#grid-internal-name-hint');
        const internal_name = await box(page, '#grid-internal-name-input');
        const columns_label = await box(page, 'label[for="grid-columns"]');
        const columns_hint = await box(page, '#grid-columns-hint');
        const columns = await box(page, '#grid-columns');

        expect(name_hint.height).toBeCloseTo(columns_hint.height, 0);
        expect(columns_label.y).toBeCloseTo(name_label.y, 0);
        expect(columns.y).toBeCloseTo(internal_name.y, 0);
    });

    test('where Internal Name\'s hint wraps, the two fields still line up', async ({ page }) => {
        await open_grid_page(page, { width: 1200, height: 800 });

        const name_hint = await box(page, '#grid-internal-name-hint');
        const columns_hint = await box(page, '#grid-columns-hint');
        const internal_name = await box(page, '#grid-internal-name-input');
        const columns = await box(page, '#grid-columns');

        expect(name_hint.height).toBeGreaterThan(columns_hint.height);
        expect(columns.y).toBeCloseTo(internal_name.y, 0);
        expect(bottom(columns_hint)).toBeLessThanOrEqual(columns.y);
    });

    test('a refusal shows under Grid Columns, below the drop-down', async ({ page }) => {
        await open_grid_page(page, {
            width: 1366,
            height: 768,
            update_status: 422,
            update_body: { message: REFUSAL },
        });

        const columns_before = await box(page, '#grid-columns');

        await page.selectOption('#grid-columns', '4');
        await page.click('#save-item-btn');

        await expect(page.locator('#grid-columns-error')).toHaveText(REFUSAL);

        const columns_hint = await box(page, '#grid-columns-hint');
        const columns = await box(page, '#grid-columns');
        const error = await box(page, '#grid-columns-error');
        const internal_name = await box(page, '#grid-internal-name-input');

        expect(bottom(columns_hint)).toBeLessThanOrEqual(columns.y);
        expect(error.y).toBeGreaterThanOrEqual(bottom(columns));
        expect(columns.width).toBeCloseTo(columns_before.width, 0);
        expect(columns.x).toBeGreaterThan(internal_name.x + internal_name.width);
    });

    test('on a phone the Grid Columns field fits inside the card', async ({ page }) => {
        await open_grid_page(page, { width: 375, height: 812 });

        const card = await box(page, '#grid-data-card');
        const columns = await box(page, '#grid-columns');

        expect(columns.x + columns.width).toBeLessThanOrEqual(card.x + card.width);

        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sideways).toBeLessThanOrEqual(0);
    });

    test('Save sits at the bottom of the card and keeps its button look', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768 });

        const card = await box(page, '#grid-data-card');
        const save = await box(page, '#save-item-btn');
        const internal_name = await box(page, '#grid-internal-name-input');
        const styles = await box(page, '#item-styles-card');

        expect(save.y).toBeGreaterThan(bottom(internal_name));
        expect(save.y).toBeGreaterThanOrEqual(bottom(styles));
        expect(bottom(save)).toBeLessThan(bottom(card));
        expect(save.x).toBeCloseTo(internal_name.x, 0);

        const background = await page.locator('#save-item-btn').evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(background).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('on a published grid Edit and the public warning sit level in the same row', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768, is_published: 1 });

        await expect(page.locator('#grid-published-note')).toBeVisible();

        const edit = await box(page, '#edit-grid-btn');
        const note = await box(page, '#grid-published-note');

        expect(middle(note)).toBeCloseTo(middle(edit), 0);
        expect(note.x).toBeGreaterThan(edit.x + edit.width);
    });

    test('on a narrow screen the public warning wraps under Edit, lined up with it and not touching', async ({ page }) => {
        await open_grid_page(page, { width: 768, height: 1024, is_published: 1 });

        await expect(page.locator('#grid-published-note')).toBeVisible();

        const edit = await box(page, '#edit-grid-btn');
        const note = await box(page, '#grid-published-note');

        expect(note.y).toBeGreaterThan(bottom(edit));
        expect(note.x).toBeCloseTo(edit.x, 0);
    });

    test('with no style presets Margins and Text Alignment still show in Styles', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768, presets: null });

        await expect(page.locator('#item-styles-card')).toBeVisible();
        await expect(page.locator('#item-styles-card #margins')).toBeVisible();
        await expect(page.locator('#item-styles-card #text-align')).toBeVisible();
    });

    test('below 1200 wide Styles drops under the fields, inside the card', async ({ page }) => {
        await open_grid_page(page, { width: 1199, height: 800 });

        const text = await box(page, '#grid-text-input');
        const internal_name = await box(page, '#grid-internal-name-input');
        const styles = await box(page, '#item-styles-card');
        const save = await box(page, '#save-item-btn');

        expect(styles.y).toBeGreaterThan(bottom(internal_name));
        expect(styles.x).toBeLessThanOrEqual(text.x);
        expect(bottom(styles)).toBeLessThanOrEqual(save.y);
    });

    test('a long text scrolls inside a short editor instead of stretching the form', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768, text: LONG_TEXT });

        const editor = await page.locator('#grid-text-input .ql-editor').evaluate((el) => ({
            shown: el.clientHeight,
            full: el.scrollHeight,
        }));

        expect(editor.shown).toBeLessThanOrEqual(240);
        expect(editor.full).toBeGreaterThan(editor.shown);
    });

    test('the Add Grid page keeps its stacked form, with the Grid Columns hint above the field', async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: THREE_PRESETS }) },
        });

        await page.goto(ADD_GRID_URL);

        await expect(page.locator('#item-style-options .item-style-option')).toHaveCount(3);

        const data_card = await box(page, '#grid-data-card');
        const styles_card = await box(page, '#item-styles-card');
        const text = await box(page, '#grid-text-input');
        const internal_name = await box(page, '#grid-internal-name-input');
        const columns = await box(page, '#grid-columns');
        const columns_hint = await box(page, '#grid-columns-hint');

        expect(styles_card.y).toBeGreaterThanOrEqual(bottom(data_card));
        expect(internal_name.x).toBeCloseTo(text.x, 0);
        expect(internal_name.y).toBeGreaterThanOrEqual(bottom(text));
        expect(columns.x).toBeGreaterThanOrEqual(text.x + text.width);
        expect(bottom(columns_hint)).toBeLessThanOrEqual(columns.y);
    });
});
