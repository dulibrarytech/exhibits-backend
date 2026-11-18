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

const ONE_PRESET = {
    exhibit: {
        item1: THREE_PRESETS.exhibit.item1,
    },
};

const LONG_TEXT = `<p>${'The club kept careful records of every outing. '.repeat(40).trim()}</p>`;

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

async function open_grid_page(page, { width, height, text = 'Short grid text', presets = THREE_PRESETS }) {
    await page.setViewportSize({ width, height });
    await seedAuth(page);
    await stubDashboardDeps(page, {
        exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: presets }) },
    });
    await stubGridItemsApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID, items: grid_items(3) });
    await stubGridRecordApi(page, {
        exhibitId: EXHIBIT_UUID,
        record: gridRecordFixture({ uuid: GRID_UUID, text, columns: 3 }),
    });

    await page.goto(GRID_PAGE_URL);

    await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);
    await expect(page.locator('#item-style-options .item-style-option')).toHaveCount(Object.keys(presets.exhibit).length);
    await expect(page.locator('#grid-text-input .ql-editor')).not.toBeEmpty();
}

test.describe('Grid page — compact grid form', () => {

    test('on a 1366 by 768 screen the two cards share a row and the list starts on the first screen', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768 });

        const data_card = await box(page, '#grid-data-card');
        const styles_card = await box(page, '#item-styles-card');
        const save_bar = await box(page, '#item-submit-card');

        expect(styles_card.y).toBeCloseTo(data_card.y, 0);
        expect(styles_card.height).toBeCloseTo(data_card.height, 0);
        expect(styles_card.x).toBeGreaterThanOrEqual(data_card.x + data_card.width);
        expect(save_bar.y).toBeGreaterThanOrEqual(data_card.y + data_card.height);
        expect(data_card.x).toBeCloseTo(save_bar.x, 0);
        expect(styles_card.x + styles_card.width).toBeCloseTo(save_bar.x + save_bar.width, 0);

        const chooser = await box(page, '#item-style-options');
        expect(chooser.width).toBeGreaterThan(styles_card.width / 2);

        await expect(page.locator('#item-card .card-title')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('table#grid-items thead')).toBeInViewport({ ratio: 1 });

        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sideways).toBeLessThanOrEqual(0);
    });

    test('with a single style preset the Styles card is stretched to the height of Item Data', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768, presets: ONE_PRESET });

        const data_card = await box(page, '#grid-data-card');
        const styles_card = await box(page, '#item-styles-card');
        const last_styles_field = await box(page, '#margins');
        const styles_content_bottom = last_styles_field.y + last_styles_field.height;
        const item_data_bottom = data_card.y + data_card.height;

        expect(styles_content_bottom).toBeLessThan(item_data_bottom - 60);
        expect(styles_card.height).toBeCloseTo(data_card.height, 0);
    });

    test('Internal Name sits beside the text, above Grid Columns', async ({ page }) => {
        await open_grid_page(page, { width: 1366, height: 768 });

        const text = await box(page, '#grid-text-input');
        const internal_name = await box(page, '#grid-internal-name-input');
        const columns = await box(page, '#grid-columns');

        expect(internal_name.x).toBeGreaterThanOrEqual(text.x + text.width);
        expect(internal_name.y + internal_name.height).toBeLessThanOrEqual(columns.y);
        expect(columns.x).toBeCloseTo(internal_name.x, 0);
    });

    test('below 1200 wide the Styles card drops under Item Data', async ({ page }) => {
        await open_grid_page(page, { width: 1199, height: 800 });

        const data_card = await box(page, '#grid-data-card');
        const styles_card = await box(page, '#item-styles-card');

        expect(styles_card.x).toBeCloseTo(data_card.x, 0);
        expect(styles_card.width).toBeCloseTo(data_card.width, 0);
        expect(styles_card.y).toBeGreaterThanOrEqual(data_card.y + data_card.height);
    });

    test('the two style dropdowns stay level when the open side menu squeezes the form', async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('exhibits_sidebar_collapsed', '0');
        });
        await open_grid_page(page, { width: 1200, height: 800 });

        const margins = await box(page, '#margins');
        const text_align = await box(page, '#text-align');

        expect(text_align.x).toBeGreaterThan(margins.x);
        expect(text_align.y).toBeCloseTo(margins.y, 0);
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

    test('the Add Grid page keeps its stacked form', async ({ page }) => {
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

        expect(styles_card.y).toBeGreaterThanOrEqual(data_card.y + data_card.height);
        expect(internal_name.x).toBeCloseTo(text.x, 0);
        expect(internal_name.y).toBeGreaterThanOrEqual(text.y + text.height);
        expect(columns.x).toBeGreaterThanOrEqual(text.x + text.width);
    });
});
