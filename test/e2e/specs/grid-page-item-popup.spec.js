'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubAuthPermissionsApi,
    stubUserRoleApi,
    stubGridRecordApi,
    stubGridItemsApi,
    stubGridItemRecordApi,
    stubMediaLibraryListApi,
    exhibitFixture,
    gridRecordFixture,
    gridItemFixture,
    gridItemRecordFixture,
    mediaRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '770e8400-e29b-41d4-a716-446655440100';
const TEXT_ITEM = '880e8400-e29b-41d4-a716-446655440201';
const QUOTE_ITEM = '880e8400-e29b-41d4-a716-446655440202';
const NEW_ITEM = '990e8400-e29b-41d4-a716-446655440300';
const GRID_PAGE_URL = `${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`;
const MEMBERSHIP = { is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID };

const modal = (page) => page.locator('#grid-item-modal');
const modal_message = (page) => page.locator('#grid-item-modal-message');
const row_menu = (page, item_id) => page.locator(`[id="${item_id}-item-actions"] .item-actions-toggle`);
const row_action = (page, item_id, action) => page.locator(`[id="${item_id}-item-actions"] [data-action="${action}"]`);

function listed_items() {
    return [
        gridItemFixture({ uuid: TEXT_ITEM, order: 1, title: 'A text item', item_type: 'text', ...MEMBERSHIP }),
        gridItemFixture({
            uuid: QUOTE_ITEM, order: 2, title: '', text: 'Quoted words', item_type: 'content_block',
            content_type: 'quote', is_published: 1, ...MEMBERSHIP,
        }),
    ];
}

function item_records(overrides = {}) {
    return {
        [TEXT_ITEM]: gridItemRecordFixture({
            uuid: TEXT_ITEM, title: 'A text item', text: 'Saved body', is_locked: 1, locked_by_user: 1,
            ...MEMBERSHIP, ...(overrides[TEXT_ITEM] || {}),
        }),
        [QUOTE_ITEM]: gridItemRecordFixture({
            uuid: QUOTE_ITEM, item_type: 'content_block', type: 'content_block', content_type: 'quote',
            text: 'Quoted words', attribution: 'A. Person', is_published: 1, layout: 'media_top',
            ...MEMBERSHIP, ...(overrides[QUOTE_ITEM] || {}),
        }),
    };
}

async function open_grid_page(page, opts = {}) {
    const items = opts.items ?? listed_items();

    await stubGridRecordApi(page, {
        exhibitId: EXHIBIT_UUID,
        record: gridRecordFixture({ uuid: GRID_UUID, columns: 2 }),
    });
    await stubGridItemsApi(page, { exhibitId: EXHIBIT_UUID, gridId: GRID_UUID, items });

    const state = await stubGridItemRecordApi(page, {
        exhibitId: EXHIBIT_UUID,
        gridId: GRID_UUID,
        records: item_records(opts.records),
        newItemId: NEW_ITEM,
        ...(opts.item_api || {}),
    });

    await page.goto(GRID_PAGE_URL);
    await expect(page.locator('table#grid-items tbody tr')).toHaveCount(items.length);
    await expect(page.locator('#grid-internal-name-input')).toHaveValue('Sample grid internal name');

    return { state, items };
}

async function open_row_action(page, item_id, action) {
    await row_menu(page, item_id).click();
    await row_action(page, item_id, action).click();
    await expect(modal(page)).toBeVisible();
}

test.describe('Grid page — item pop-up (grid.item.modal.module)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
        });
        await stubMediaLibraryListApi(page, { records: [mediaRecordFixture()] });
    });

    test.describe('side menu', () => {

        test('offers one Add grid item link and no links to item pages', async ({ page }) => {
            await open_grid_page(page);

            await expect(page.locator('#add-grid-item-link')).toHaveAttribute('title', 'Add grid item');
            await expect(page.locator('#back-to-items')).toHaveAttribute('title', 'Back to Exhibit Items');
            await expect(page.locator('#preview-link a')).toHaveCount(1);
            await expect(page.locator('#logout')).toHaveCount(1);
            await expect(page.locator('#main-menu a[href*="/items/grid/item/"]')).toHaveCount(0);
        });
    });

    test.describe('adding', () => {

        test('opens empty on the Media tab', async ({ page }) => {
            await open_grid_page(page);

            await page.click('#add-grid-item-link');

            await expect(modal(page)).toBeVisible();
            await expect(page.locator('#grid-item-modal-label')).toHaveText('Add grid item');
            await expect(page.locator('#grid-item-tab-media')).toHaveAttribute('aria-selected', 'true');
            await expect(page.locator('#item-media-card')).toBeVisible();
            await expect(page.locator('#item-layout-card')).toBeVisible();
            await expect(page.locator('#grid-item-save-btn')).toBeVisible();
            await expect(page.locator('#grid-item-edit-btn')).toBeHidden();
            await expect(page.locator('#grid-item-tab-text')).toBeEnabled();
            await expect(page.locator('#grid-item-tab-content-block')).toBeEnabled();
            await expect(page.locator('#item-title-input .ql-editor')).toHaveText('');
        });

        test('the Text tab shows the text fields only and requires the text', async ({ page }) => {
            await open_grid_page(page);
            await page.click('#add-grid-item-link');

            await page.click('#grid-item-tab-text');

            await expect(page.locator('#item-text-input')).toBeVisible();
            await expect(page.locator('#item-media-card')).toBeHidden();
            await expect(page.locator('#item-layout-card')).toBeHidden();
            await expect(page.locator('#item-media-widths-card')).toBeHidden();
            await expect(page.locator('#is-media-only-description')).toBeHidden();
            await expect(page.locator('#embed-item-group')).toBeHidden();
            await expect(page.locator('#is-required-text .badge-required')).toBeVisible();
        });

        test('the Content block tab shows the content block form', async ({ page }) => {
            await open_grid_page(page);
            await page.click('#add-grid-item-link');

            await page.click('#grid-item-tab-content-block');

            await expect(page.locator('#content-type')).toBeVisible();
            await expect(page.locator('#item-text-input')).toBeHidden();

            await page.selectOption('#content-type', 'card');
            await expect(page.locator('#content-block-card')).toBeVisible();
            await expect(page.locator('#content-block-button')).toBeHidden();
        });

        test('saves a text item, closes, and redraws the list', async ({ page }) => {
            const { state, items } = await open_grid_page(page);

            await page.click('#add-grid-item-link');
            await page.click('#grid-item-tab-text');
            await page.fill('#item-title-input .ql-editor', 'New text item');
            await page.fill('#item-text-input .ql-editor', 'New body');

            items.push(gridItemFixture({ uuid: NEW_ITEM, order: 3, title: 'New text item', item_type: 'text', ...MEMBERSHIP }));
            await page.click('#grid-item-save-btn');

            await expect.poll(() => state.createCount).toBe(1);
            expect(state.lastCreatePayload).toMatchObject({
                item_type: 'text',
                mime_type: 'text/plain',
                layout: 'text_only',
                media_width: '50',
                is_embedded: 0,
            });
            expect(state.lastCreatePayload.text).toContain('New body');
            expect(state.lastCreatePayload.title).toContain('New text item');
            expect(state.lastCreatePayload).not.toHaveProperty('is_published');
            expect(state.lastCreatePayload).not.toHaveProperty('media_uuid');

            await expect(modal(page)).toBeHidden();
            await expect(page.locator('table#grid-items tbody tr')).toHaveCount(3);
            await expect(page.locator(`tr[id^="${NEW_ITEM}_griditem_"]`)).toContainText('New text item');
            await expect(page.locator('#grid-items-message .alert-success')).toContainText('Grid item added');
            await expect(page.locator('#grid-items-message .alert-success')).toBeInViewport({ ratio: 1 });
            await expect(page.locator('#message')).toBeEmpty();
            expect(new URL(page.url()).pathname).toBe(`${APP_PATH}/items/grid/items`);
        });

        test('saves a content block with its type', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await page.click('#add-grid-item-link');
            await page.click('#grid-item-tab-content-block');
            await page.selectOption('#content-type', 'button');
            await page.fill('#button-text-input .ql-editor', 'Visit');
            await page.fill('#button-url-input', 'https://library.du.edu');
            await page.selectOption('#button-size', 'small');
            await page.click('#grid-item-save-btn');

            await expect.poll(() => state.createCount).toBe(1);
            expect(state.lastCreatePayload).toMatchObject({
                type: 'content_block',
                item_type: 'content_block',
                content_type: 'button',
                url: 'https://library.du.edu',
                size: 'small',
                title: '',
            });
            expect(state.lastCreatePayload).not.toHaveProperty('is_published');
            await expect(modal(page)).toBeHidden();
        });

        test('picks media in the media library pop-up, which opens on top', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await page.click('#add-grid-item-link');
            await page.click('#pick-item-media-btn');

            await expect(page.locator('#media-picker-modal')).toBeVisible();
            await expect(page.locator('#media-picker-modal .media-card').first()).toBeVisible();
            await page.locator('#media-picker-modal .media-card').first().click();
            await expect(page.locator('#media-picker-confirm-btn')).toBeEnabled();
            await page.click('#media-picker-confirm-btn');

            await expect(page.locator('#media-picker-modal')).toBeHidden();
            await expect(modal(page)).toBeVisible();
            await expect(page.locator('#item-media-uuid')).toHaveValue('media-uuid-1');
            await expect(page.locator('#pick-item-media-btn')).toBeFocused();
            await expect(page.locator('body')).toHaveClass(/modal-open/);

            await page.evaluate(() => document.querySelector('#sidebar-toggle').focus());
            expect(await page.evaluate(() => document.querySelector('#grid-item-modal').contains(document.activeElement))).toBe(true);

            await page.click('#grid-item-save-btn');

            await expect.poll(() => state.createCount).toBe(1);
            expect(state.lastCreatePayload).toMatchObject({
                media_uuid: 'media-uuid-1',
                item_type: 'image',
                mime_type: 'image/jpeg',
                layout: 'media_top',
            });
            await expect(modal(page)).toBeHidden();
        });

        test('keeps the pop-up open and names the missing field', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await page.click('#add-grid-item-link');
            await page.click('#grid-item-tab-text');
            await page.click('#grid-item-save-btn');

            await expect(modal_message(page).locator('.alert-danger')).toContainText('Please enter "Text" for this item');
            await expect(page.locator('#item-text-input')).toHaveAttribute('aria-invalid', 'true');
            await expect(modal(page)).toBeVisible();
            await expect(page.locator('#message')).toBeEmpty();
            expect(state.createCount).toBe(0);
        });

        test('shows a refusal from the server inside the pop-up', async ({ page }) => {
            const { state } = await open_grid_page(page, {
                item_api: { createStatus: 400, createBody: { status: 400, message: 'Please enter the quote text' } },
            });

            await page.click('#add-grid-item-link');
            await page.click('#grid-item-tab-text');
            await page.fill('#item-text-input .ql-editor', 'Body');
            await page.click('#grid-item-save-btn');

            await expect(modal_message(page).locator('.alert-danger')).toContainText('Please enter the quote text');
            await expect(modal(page)).toBeVisible();
            expect(state.createCount).toBe(1);
            await expect(page.locator('#grid-item-save-btn')).toBeEnabled();
        });

        test('gives a message and no pop-up to a user who may not add items', async ({ page }) => {
            await open_grid_page(page);
            await stubAuthPermissionsApi(page, { status: 403 });

            await page.click('#add-grid-item-link');

            await expect(page.locator('#message .alert-danger')).toContainText('You do not have permission to add item.');
            await expect(modal(page)).toBeHidden();
        });

        test('brings that message into view when the page is scrolled down to the list', async ({ page }) => {
            await open_grid_page(page);
            await stubAuthPermissionsApi(page, { status: 403 });
            await page.locator('table#grid-items tbody tr').last().scrollIntoViewIfNeeded();
            await expect(page.locator('#message')).not.toBeInViewport();

            await page.click('#add-grid-item-link');

            await expect(page.locator('#message .alert-danger')).toContainText('You do not have permission to add item.');
            await expect(page.locator('#message .alert-danger')).toBeInViewport({ ratio: 1 });
        });
    });

    test.describe('editing', () => {

        test('opens the item filled in, with the other kinds unavailable', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await open_row_action(page, TEXT_ITEM, 'edit-item');

            expect(state.getTypes).toEqual(['edit']);
            await expect(page.locator('#grid-item-modal-label')).toHaveText('Edit grid item');
            await expect(page.locator('#item-title-input .ql-editor')).toHaveText('A text item');
            await expect(page.locator('#item-text-input .ql-editor')).toHaveText('Saved body');
            await expect(page.locator('#grid-item-tab-text')).toHaveAttribute('aria-selected', 'true');
            await expect(page.locator('#grid-item-tab-text')).toBeVisible();
            await expect(page.locator('#grid-item-tab-media')).toBeDisabled();
            await expect(page.locator('#grid-item-tab-media')).toBeHidden();
            await expect(page.locator('#grid-item-tab-content-block')).toBeDisabled();
            await expect(page.locator('#grid-item-tab-content-block')).toBeHidden();
            await expect(page.locator('#grid-item-modal-meta')).toContainText('Created by tester');
            await expect(page.locator('#item-media-card')).toBeHidden();
            await expect(page.locator('#grid-item-save-btn')).toBeVisible();
        });

        test('saves the change, releases the item and redraws the list', async ({ page }) => {
            const { state, items } = await open_grid_page(page);

            await open_row_action(page, TEXT_ITEM, 'edit-item');
            await page.fill('#item-text-input .ql-editor', 'Changed body');

            items[0].title = 'A changed text item';
            await page.click('#grid-item-save-btn');

            await expect.poll(() => state.updateCount).toBe(1);
            expect(state.lastUpdatePayload).toMatchObject({ item_type: 'text', is_published: 'false' });
            expect(state.lastUpdatePayload.text).toContain('Changed body');

            await expect(modal(page)).toBeHidden();
            await expect.poll(() => state.unlockCount).toBe(1);
            expect(state.lastUnlockUrl).toContain(`/items/${TEXT_ITEM}/unlock`);
            expect(state.lastUnlockUrl).not.toContain('t=');
            await expect(page.locator(`tr[id^="${TEXT_ITEM}_griditem_"]`)).toContainText('A changed text item');
            await expect(page.locator('#grid-items-message .alert-success')).toContainText('Grid item saved');
        });

        test('releases the item when the pop-up is cancelled', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await open_row_action(page, TEXT_ITEM, 'edit-item');
            await page.click('#grid-item-cancel-btn');

            await expect(modal(page)).toBeHidden();
            await expect.poll(() => state.unlockCount).toBe(1);
            expect(state.updateCount).toBe(0);
        });

        test('releases the item when the page is left with the pop-up open', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await open_row_action(page, TEXT_ITEM, 'edit-item');
            await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`, { waitUntil: 'commit' });

            await expect.poll(() => state.unlockCount).toBe(1);
        });

        test('opens an item someone else is working on read-only with a notice', async ({ page }) => {
            const { state } = await open_grid_page(page, {
                records: { [TEXT_ITEM]: { is_locked: 1, locked_by_user: 99 } },
            });

            await open_row_action(page, TEXT_ITEM, 'edit-item');

            await expect(modal_message(page)).toContainText('This record is currently being worked on by another user.');
            await expect(page.locator('#item-text-input .ql-editor')).toHaveAttribute('contenteditable', 'false');
            await expect(page.locator('#grid-item-save-btn')).toBeHidden();
            await expect(page.locator('#grid-item-unlock-btn')).toBeHidden();

            await page.click('#grid-item-cancel-btn');
            await expect(modal(page)).toBeHidden();
            expect(state.unlockCount).toBe(0);
        });

        test('lets an administrator unlock an item someone else is working on', async ({ page }) => {
            await stubUserRoleApi(page, { role: 'Administrator' });
            const records = { [TEXT_ITEM]: { is_locked: 1, locked_by_user: 99 } };
            const { state } = await open_grid_page(page, { records });

            await open_row_action(page, TEXT_ITEM, 'edit-item');
            await expect(page.locator('#grid-item-unlock-btn')).toBeVisible();

            await page.click('#grid-item-unlock-btn');

            await expect.poll(() => state.unlockCount).toBe(1);
            expect(state.lastUnlockUrl).toContain('force=true');
            await expect.poll(() => state.getTypes).toEqual(['edit', 'edit']);
        });

        test('shows the item read-only with a message to a user who may not edit', async ({ page }) => {
            const { state } = await open_grid_page(page);
            await stubAuthPermissionsApi(page, { status: 403 });

            await open_row_action(page, TEXT_ITEM, 'edit-item');

            expect(state.getTypes).toEqual(['details']);
            await expect(modal_message(page).locator('.alert-danger')).toContainText('You do not have permission to edit this record.');
            await expect(page.locator('#item-text-input .ql-editor')).toHaveAttribute('contenteditable', 'false');
            await expect(page.locator('#grid-item-save-btn')).toBeHidden();
            await expect(page.locator('#grid-item-edit-btn')).toBeHidden();
        });

        test('says so above the list when the item cannot be loaded', async ({ page }) => {
            await open_grid_page(page);
            await page.route(
                `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/grids/${GRID_UUID}/items/${TEXT_ITEM}**`,
                (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
            );

            await row_menu(page, TEXT_ITEM).click();
            await row_action(page, TEXT_ITEM, 'edit-item').click();

            await expect(page.locator('#grid-items-message .alert-danger')).toContainText(
                'Unable to load the grid item. Please try again.'
            );
            await expect(modal(page)).toBeHidden();
        });

        test('returns focus to the saved row when the list is slow to redraw', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await open_row_action(page, TEXT_ITEM, 'edit-item');
            await page.fill('#item-text-input .ql-editor', 'Changed body');

            await page.route(
                `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/grids/${GRID_UUID}/items`,
                async (route) => {
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                    return route.fallback();
                }
            );
            await page.click('#grid-item-save-btn');

            await expect.poll(() => state.updateCount).toBe(1);
            await expect(modal(page)).toBeHidden();
            await expect(page.locator('#grid-items-message .alert-success')).toContainText('Grid item saved');
            await expect(row_menu(page, TEXT_ITEM)).toBeFocused();
        });

        test('brings its confirmation into view after saving a row far down a long list', async ({ page }) => {
            const fillers = Array.from({ length: 28 }, (_, index) => gridItemFixture({
                uuid: `filler-${index + 1}`, order: index + 1, title: `Filler ${index + 1}`, item_type: 'text', ...MEMBERSHIP,
            }));
            const [text_item, quote_item] = listed_items();
            const items = [...fillers, { ...text_item, order: 29 }, { ...quote_item, order: 30 }];

            await page.setViewportSize({ width: 1366, height: 768 });
            await open_grid_page(page, { items });

            await open_row_action(page, TEXT_ITEM, 'edit-item');
            await page.fill('#item-text-input .ql-editor', 'Changed body');
            await page.click('#grid-item-save-btn');

            await expect(modal(page)).toBeHidden();
            await expect(page.locator('#grid-items-message .alert-success')).toContainText('Grid item saved');
            await expect(page.locator('#grid-items-message .alert-success')).toBeInViewport({ ratio: 1 });
            await expect(row_menu(page, TEXT_ITEM)).toBeFocused();
            await expect(row_menu(page, TEXT_ITEM)).toBeInViewport();
        });

        test('starts empty when Add is opened after an edit', async ({ page }) => {
            await open_grid_page(page);

            await open_row_action(page, TEXT_ITEM, 'edit-item');
            await page.click('#grid-item-cancel-btn');
            await expect(modal(page)).toBeHidden();

            await page.click('#add-grid-item-link');
            await expect(modal(page)).toBeVisible();
            await expect(page.locator('#grid-item-modal-label')).toHaveText('Add grid item');
            await expect(page.locator('#grid-item-tab-media')).toBeEnabled();
            await expect(page.locator('#grid-item-tab-media')).toBeVisible();
            await expect(page.locator('#grid-item-tab-content-block')).toBeVisible();
            await expect(page.locator('#grid-item-modal-meta')).toBeEmpty();

            await page.click('#grid-item-tab-text');
            await expect(page.locator('#item-text-input .ql-editor')).toHaveText('');
            await expect(page.locator('#item-title-input .ql-editor')).toHaveText('');
        });
    });

    test.describe('details', () => {

        test('opens a published item read-only with Edit and the public warning', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await open_row_action(page, QUOTE_ITEM, 'details-item');

            expect(state.getTypes).toEqual(['details']);
            await expect(page.locator('#grid-item-modal-label')).toHaveText('Grid item details');
            await expect(page.locator('#grid-item-tab-content-block')).toHaveAttribute('aria-selected', 'true');
            await expect(page.locator('#content-type')).toHaveValue('quote');
            await expect(page.locator('#content-type')).toBeDisabled();
            await expect(page.locator('#quote-text-input .ql-editor')).toHaveText('Quoted words');
            await expect(page.locator('#quote-attribution-input')).toBeDisabled();
            await expect(page.locator('#grid-item-edit-btn')).toBeVisible();
            await expect(page.locator('#grid-item-save-btn')).toBeHidden();
            await expect(page.locator('#grid-item-cancel-btn')).toContainText('Close');
            await expect(page.locator('#grid-item-modal-published-note')).toContainText(
                'Changes made to published exhibit grid items are immediately visible to the public'
            );
        });

        test('Edit switches the pop-up to editing and saving re-publishes the item', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await open_row_action(page, QUOTE_ITEM, 'details-item');
            await page.click('#grid-item-edit-btn');

            await expect(page.locator('#grid-item-save-btn')).toBeVisible();
            expect(state.getTypes).toEqual(['details', 'edit']);
            await expect(page.locator('#grid-item-modal-label')).toHaveText('Edit grid item');
            await expect(page.locator('#quote-attribution-input')).toBeEnabled();
            await expect(page.locator('#grid-item-modal-published-note')).toBeVisible();

            await page.fill('#quote-attribution-input', 'B. Person');
            await page.click('#grid-item-save-btn');

            await expect.poll(() => state.updateCount).toBe(1);
            expect(state.lastUpdatePayload).toMatchObject({
                content_type: 'quote',
                attribution: 'B. Person',
                is_published: 'true',
            });
        });

        test('opens from the item title as well', async ({ page }) => {
            const { state } = await open_grid_page(page);

            await page.locator(`tr[id^="${TEXT_ITEM}_griditem_"] .item-title-link`).click();

            await expect(modal(page)).toBeVisible();
            expect(state.getTypes).toEqual(['details']);
            await expect(page.locator('#grid-item-modal-label')).toHaveText('Grid item details');
            await expect(page.locator('#grid-item-modal-published-note')).toBeHidden();
        });
    });

    test.describe('closing', () => {

        test('closes at once when nothing was entered and returns focus to the link', async ({ page }) => {
            await open_grid_page(page);

            let dialogs = 0;
            page.on('dialog', async (dialog) => {
                dialogs += 1;
                await dialog.accept();
            });

            await page.click('#add-grid-item-link');
            await page.click('#grid-item-tab-content-block');
            await page.click('#grid-item-cancel-btn');

            await expect(modal(page)).toBeHidden();
            await expect(page.locator('#add-grid-item-link')).toBeFocused();
            expect(dialogs).toBe(0);
        });

        test('asks before discarding what was typed and stays open when refused', async ({ page }) => {
            await open_grid_page(page);

            const answers = [false, true];
            const messages = [];
            page.on('dialog', async (dialog) => {
                messages.push(dialog.message());
                if (answers.shift() === true) {
                    await dialog.accept();
                } else {
                    await dialog.dismiss();
                }
            });

            await page.click('#add-grid-item-link');
            await page.click('#grid-item-tab-text');
            await page.fill('#item-text-input .ql-editor', 'Typed but not saved');

            await page.click('#grid-item-modal-close-btn');
            await expect.poll(() => messages.length).toBe(1);
            expect(messages[0]).toBe('Discard the changes to this grid item?');
            await expect(modal(page)).toBeVisible();
            await expect(page.locator('#item-text-input .ql-editor')).toHaveText('Typed but not saved');

            await page.click('#grid-item-cancel-btn');
            await expect(modal(page)).toBeHidden();
            expect(messages.length).toBe(2);
        });

        test('returns focus to the row menu after an edit is cancelled', async ({ page }) => {
            await open_grid_page(page);

            await open_row_action(page, TEXT_ITEM, 'edit-item');
            await page.click('#grid-item-cancel-btn');

            await expect(modal(page)).toBeHidden();
            await expect(row_menu(page, TEXT_ITEM)).toBeFocused();
        });
    });
});
