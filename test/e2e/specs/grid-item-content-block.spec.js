'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubGridItemRecordApi,
    exhibitFixture,
    gridItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440200';
const NEW_ITEM_UUID = '990e8400-e29b-41d4-a716-446655440300';

const IDS = `exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`;
const ADD_URL = `${APP_PATH}/items/grid/item/content-block?${IDS}`;
const EDIT_URL = `${APP_PATH}/items/grid/item/content-block/edit?${IDS}&item_id=${ITEM_UUID}`;
const DETAILS_URL = `${APP_PATH}/items/grid/item/content-block/details?${IDS}&item_id=${ITEM_UUID}`;

const content_block_record = (overrides = {}) => gridItemRecordFixture({
    uuid: ITEM_UUID,
    item_type: 'content_block',
    type: 'content_block',
    mime_type: null,
    layout: 'media_top',
    title: '',
    text: '',
    ...overrides,
});

test.describe('Grid content block item pages', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
        });
    });

    test.describe('add page', () => {

        test('offers Button, Card, Emphasis and Quote, and no Divider', async ({ page }) => {
            await page.goto(ADD_URL);
            await expect(page.locator('#exhibit-title')).not.toBeEmpty();

            await expect(page.locator('#content-type option:not([disabled])')).toHaveText(
                ['Button', 'Card', 'Emphasis', 'Quote']
            );
        });

        test('shows only the fields of the chosen type', async ({ page }) => {
            await page.goto(ADD_URL);
            await expect(page.locator('#exhibit-title')).not.toBeEmpty();

            await page.selectOption('#content-type', 'card');
            await expect(page.locator('#content-block-card')).toBeVisible();
            await expect(page.locator('#content-block-button')).toBeHidden();

            await page.selectOption('#content-type', 'quote');
            await expect(page.locator('#content-block-quote')).toBeVisible();
            await expect(page.locator('#content-block-card')).toBeHidden();
        });

        test('posts a complete button and opens its edit page', async ({ page }) => {
            const state = await stubGridItemRecordApi(page, {
                exhibitId: EXHIBIT_UUID,
                gridId: GRID_UUID,
                newItemId: NEW_ITEM_UUID,
                record: content_block_record({
                    uuid: NEW_ITEM_UUID,
                    content_type: 'button',
                    text: 'Visit',
                    url: 'https://library.du.edu',
                    size: 'small',
                }),
            });

            await page.goto(ADD_URL);
            await expect(page.locator('#exhibit-title')).not.toBeEmpty();

            await page.selectOption('#content-type', 'button');
            await page.fill('#button-text-input .ql-editor', 'Visit');
            await page.fill('#button-url-input', 'https://library.du.edu');
            await page.selectOption('#button-size', 'small');
            await page.click('#save-item-btn');

            await expect.poll(() => state.lastCreatePayload).not.toBeNull();
            expect(state.lastCreatePayload).toMatchObject({
                content_type: 'button',
                url: 'https://library.du.edu',
                size: 'small',
                item_type: 'content_block',
                type: 'content_block',
            });
            expect(state.lastCreatePayload.text).toContain('Visit');

            await page.waitForURL(
                new RegExp(`${APP_PATH}/items/grid/item/content-block/edit\\?.*item_id=${NEW_ITEM_UUID}`),
                { waitUntil: 'commit' }
            );
        });

        test('blocks a card with no heading and names the field', async ({ page }) => {
            const state = await stubGridItemRecordApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID });

            await page.goto(ADD_URL);
            await expect(page.locator('#exhibit-title')).not.toBeEmpty();

            await page.selectOption('#content-type', 'card');
            await page.fill('#card-text-input .ql-editor', 'Card body');
            await page.click('#save-item-btn');

            await expect(page.locator('#message .alert-danger')).toContainText('Please enter card title');
            expect(state.createCount).toBe(0);
        });

        test('refuses to save when no type is chosen', async ({ page }) => {
            const state = await stubGridItemRecordApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID });

            await page.goto(ADD_URL);
            await expect(page.locator('#exhibit-title')).not.toBeEmpty();

            await page.click('#save-item-btn');

            await expect(page.locator('#message .alert-danger')).toContainText('Please select a content block type');
            expect(state.createCount).toBe(0);
        });

        test('marks every missing field of a button at once', async ({ page }) => {
            const state = await stubGridItemRecordApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID });

            await page.goto(ADD_URL);
            await expect(page.locator('#exhibit-title')).not.toBeEmpty();

            await page.selectOption('#content-type', 'button');
            await page.click('#save-item-btn');

            await expect(page.locator('#button-url-input')).toHaveAttribute('aria-invalid', 'true');
            await expect(page.locator('#button-size')).toHaveAttribute('aria-invalid', 'true');
            await expect(page.locator('#button-text-input-error')).toHaveText('Please enter button text');
            expect(state.createCount).toBe(0);
        });

        test('gives every field its own label', async ({ page }) => {
            await page.goto(ADD_URL);
            await expect(page.locator('#exhibit-title')).not.toBeEmpty();

            const report = await page.evaluate(() => {
                const card = document.querySelector('#grid-data-card');
                const ids = Array.from(card.querySelectorAll('[id]')).map((el) => el.id);
                const duplicate_ids = ids.filter((id, index) => ids.indexOf(id) !== index);
                const unresolved_labels = Array.from(card.querySelectorAll('label[for]'))
                    .filter((label) => document.getElementById(label.getAttribute('for')) === null)
                    .map((label) => label.getAttribute('for'));
                const label_text = (id) => {
                    const container = document.getElementById(id);
                    const labelled = container.querySelector('[aria-labelledby]') || container;
                    const label = document.getElementById(labelled.getAttribute('aria-labelledby'));
                    return label === null ? null : label.textContent.replace(/\s+/g, ' ').trim();
                };

                return {
                    duplicate_ids,
                    unresolved_labels,
                    button_text: label_text('button-text-input'),
                    card_title: label_text('card-title-input'),
                    card_text: label_text('card-text-input'),
                    emphasis_text: label_text('emphasis-text-input'),
                    quote_text: label_text('quote-text-input'),
                };
            });

            expect(report.duplicate_ids).toEqual([]);
            expect(report.unresolved_labels).toEqual([]);
            expect(report.button_text).toBe('Text Required');
            expect(report.card_title).toBe('Card Heading Required');
            expect(report.card_text).toBe('Card Body Required');
            expect(report.emphasis_text).toBe('Text Required');
            expect(report.quote_text).toBe('Text Required');
        });
    });

    test.describe('edit page', () => {

        test('fills the form from a quote', async ({ page }) => {
            await stubGridItemRecordApi(page, {
                exhibitId: EXHIBIT_UUID,
                gridId: GRID_UUID,
                record: content_block_record({
                    content_type: 'quote',
                    text: 'Quoted words',
                    attribution: 'A. Person',
                }),
            });

            await page.goto(EDIT_URL);

            await expect(page.locator('#quote-text-input .ql-editor')).toHaveText('Quoted words');
            await expect(page.locator('#content-type')).toHaveValue('quote');
            await expect(page.locator('#quote-attribution-input')).toHaveValue('A. Person');
            await expect(page.locator('#content-block-quote')).toBeVisible();
            await expect(page.locator('#created')).toContainText(/Created by tester/);
        });

        test('fills the form from a button', async ({ page }) => {
            await stubGridItemRecordApi(page, {
                exhibitId: EXHIBIT_UUID,
                gridId: GRID_UUID,
                record: content_block_record({
                    content_type: 'button',
                    text: 'Visit',
                    url: 'https://library.du.edu',
                    size: 'large',
                    transparent: 1,
                }),
            });

            await page.goto(EDIT_URL);

            await expect(page.locator('#button-text-input .ql-editor')).toHaveText('Visit');
            await expect(page.locator('#button-url-input')).toHaveValue('https://library.du.edu');
            await expect(page.locator('#button-size')).toHaveValue('large');
            await expect(page.locator('#button-transparent')).toBeChecked();
        });

        test('saves a changed quote with a PUT', async ({ page }) => {
            const state = await stubGridItemRecordApi(page, {
                exhibitId: EXHIBIT_UUID,
                gridId: GRID_UUID,
                record: content_block_record({
                    content_type: 'quote',
                    text: 'Quoted words',
                    attribution: 'A. Person',
                }),
            });

            await page.goto(EDIT_URL);
            await expect(page.locator('#quote-text-input .ql-editor')).toHaveText('Quoted words');

            await page.fill('#quote-attribution-input', 'B. Person');
            await page.click('#save-item-btn');

            await expect.poll(() => state.lastUpdatePayload).not.toBeNull();
            expect(state.lastUpdatePayload).toMatchObject({ content_type: 'quote', attribution: 'B. Person' });
            expect(state.lastUpdatePayload.text).toContain('Quoted words');
            await expect(page.locator('#message .alert-success')).toBeVisible();
        });

        test('refuses to save an item that has no type until one is chosen', async ({ page }) => {
            const state = await stubGridItemRecordApi(page, {
                exhibitId: EXHIBIT_UUID,
                gridId: GRID_UUID,
                record: content_block_record({ content_type: '' }),
            });

            await page.goto(EDIT_URL);
            await expect(page.locator('#created')).toContainText(/Created by tester/);

            await page.click('#save-item-btn');

            await expect(page.locator('#content-type')).toHaveAttribute('aria-invalid', 'true');
            await expect(page.locator('#content-type-error')).toHaveText('Please select a content block type');
            await expect(page.locator('#message .alert-danger')).toBeVisible();
            expect(state.updateCount).toBe(0);

            await page.selectOption('#content-type', 'quote');
            await page.fill('#quote-text-input .ql-editor', 'Quoted words');
            await page.click('#save-item-btn');

            await expect.poll(() => state.updateCount).toBe(1);
            expect(state.lastUpdatePayload).toMatchObject({ content_type: 'quote' });
            await expect(page.locator('#content-type')).not.toHaveAttribute('aria-invalid', 'true');
        });
    });

    test.describe('details page', () => {

        test('shows a card read-only with an Edit button', async ({ page }) => {
            await stubGridItemRecordApi(page, {
                exhibitId: EXHIBIT_UUID,
                gridId: GRID_UUID,
                record: content_block_record({
                    content_type: 'card',
                    title: 'Card heading',
                    text: 'Card body',
                }),
            });

            await page.goto(DETAILS_URL);

            await expect(page.locator('#card-title-input')).toContainText('Card heading');
            await expect(page.locator('#card-text-input')).toContainText('Card body');
            await expect(page.locator('#content-type')).toBeDisabled();
            await expect(page.locator('#edit-item-btn')).toBeVisible();
            await expect(page.locator('#edit-item-btn')).toBeEnabled();
        });
    });
});
