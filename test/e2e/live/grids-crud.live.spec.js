'use strict';

/**
 * LIVE grids + grid items CRUD — parents arranged via the real API, workflows
 * driven through the real UI, persistence verified via the API.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const {
    APP_PATH,
    apiCreateExhibit,
    apiCreateGrid,
    apiCreateGridItem,
    apiCreateMediaRecord,
    apiDeleteExhibit,
    apiDeleteMediaRecord,
    apiGet,
    apiPost
} = require('./fixtures/live-api');

const SAVE_MESSAGE = 'Grids cannot have less items than there are columns. '
    + 'Reduce the amount of columns or add more items before saving.';
const DELETE_MESSAGE = 'Grids cannot contain less items than there are columns. '
    + 'Reduce the amount of columns to delete items.';
const DELETE_ADD_ITEMS_MESSAGE = 'Grids cannot contain less items than there are columns. '
    + 'Add more items before deleting this one, or delete the whole grid.';

test.describe('Grids and grid items CRUD (live)', () => {

    let exhibit_uuid = null;

    test.beforeEach(async ({ context, page, request }) => {
        await loginAs(context, page, 'administrator');
        exhibit_uuid = await apiCreateExhibit(
            request,
            `pw2-grids-host-${Date.now()}-${test.info().workerIndex}`
        );
    });

    test.afterEach(async ({ request }) => {
        await apiDeleteExhibit(request, exhibit_uuid);
        exhibit_uuid = null;
    });

    test('creates a grid through the grid form', async ({ page, request }) => {

        const marker = `pw2-grid-create-${Date.now()}-${test.info().workerIndex}`;

        await page.goto(`${APP_PATH}/items/grid?exhibit_id=${exhibit_uuid}`);
        // The Save listener is attached only after the page's async init
        // resolves (permissions POST, then a synchronous attach before the
        // title fetch can land) — so a populated exhibit title proves the
        // click below will be heard. toBeEnabled is a weak gate: the button
        // is enabled in markup before the listener exists.
        await expect(page.locator('#exhibit-title')).not.toBeEmpty();

        await page.fill('#grid-text-input .ql-editor', marker);
        // Internal name is required — the form blocks the save without it.
        await page.fill('#grid-internal-name-input', `${marker}-internal`);

        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/grids`
                && resp.request().method() === 'POST';
        });

        await page.click('#save-item-btn');

        const resp = await create_response;
        expect(resp.status()).toBe(201);
        const grid_uuid = (await resp.json()).data;

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}`);
        expect(check.status).toBe(200);
        expect(check.body).toContain(marker);
    });

    test('updates a grid through the edit form', async ({ page, request }) => {

        const original = `pw2-grid-edit-${Date.now()}-${test.info().workerIndex}`;
        const updated = `${original}-updated`;
        const grid_uuid = await apiCreateGrid(request, exhibit_uuid, original);

        await page.goto(
            `${APP_PATH}/items/grid/edit?exhibit_id=${exhibit_uuid}&item_id=${grid_uuid}`
        );

        const text_input = page.locator('#grid-text-input .ql-editor');
        await expect(text_input).toHaveText(new RegExp(original), { timeout: 10_000 });

        await text_input.fill(updated);
        await page.selectOption('#grid-columns', '3');

        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/grids/${grid_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#save-item-btn');

        const resp = await put_response;
        expect([200, 201, 204]).toContain(resp.status());

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}`);
        expect(check.status).toBe(200);
        expect(check.body).toContain(updated);
    });

    test('deletes a grid through the delete confirmation page', async ({ page, request }) => {

        const marker = `pw2-grid-delete-${Date.now()}-${test.info().workerIndex}`;
        const grid_uuid = await apiCreateGrid(request, exhibit_uuid, marker);

        await page.goto(
            `${APP_PATH}/items/delete`
            + `?exhibit_id=${exhibit_uuid}&item_id=${grid_uuid}&type=grid`
        );
        // The Delete listener is attached only after the view's async init
        // resolves; show_form() reveals the card strictly after the attach,
        // so a visible card proves the click below will be heard.
        await expect(page.locator('#delete-card')).toBeVisible();

        const delete_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/items/${grid_uuid}`
                && resp.request().method() === 'DELETE';
        });

        await page.click('#delete-item-btn');

        const resp = await delete_response;
        expect([200, 204]).toContain(resp.status());

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}`);
        expect(check.body).not.toContain(marker);
    });

    test('creates a grid item through the grid item form', async ({ page, request }) => {

        const marker = `pw2-griditem-create-${Date.now()}-${test.info().workerIndex}`;
        const grid_uuid = await apiCreateGrid(request, exhibit_uuid, 'host grid');

        await page.goto(
            `${APP_PATH}/items/grid/item/text?exhibit_id=${exhibit_uuid}&grid_id=${grid_uuid}`
        );
        // The Save listener is attached only after the page's async init
        // resolves (permissions POST, then a synchronous attach before the
        // title fetch can land) — so a populated exhibit title proves the
        // click below will be heard. toBeEnabled is a weak gate: the button
        // is enabled in markup before the listener exists.
        await expect(page.locator('#exhibit-title')).not.toBeEmpty();

        await page.fill('#item-text-input .ql-editor', marker);

        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items`
                && resp.request().method() === 'POST';
        });

        await page.click('#save-item-btn');

        const resp = await create_response;
        expect(resp.status()).toBe(201);
        const item_uuid = (await resp.json()).data;

        const check = await apiGet(
            request,
            `/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${item_uuid}`
        );
        expect(check.status).toBe(200);
        expect(check.body).toContain(marker);
    });

    test('updates a grid item through the edit form', async ({ page, request }) => {

        const original = `pw2-griditem-edit-${Date.now()}-${test.info().workerIndex}`;
        const updated = `${original}-updated`;
        const grid_uuid = await apiCreateGrid(request, exhibit_uuid, 'host grid');
        const item_uuid = await apiCreateGridItem(request, exhibit_uuid, grid_uuid, original);

        await page.goto(
            `${APP_PATH}/items/grid/item/text/edit`
            + `?exhibit_id=${exhibit_uuid}&grid_id=${grid_uuid}&item_id=${item_uuid}`
        );

        const text_input = page.locator('#item-text-input .ql-editor');
        await expect(text_input).toHaveText(new RegExp(original), { timeout: 10_000 });

        await text_input.fill(updated);

        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${item_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#save-item-btn');

        const resp = await put_response;
        expect([200, 201, 204]).toContain(resp.status());

        const check = await apiGet(
            request,
            `/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${item_uuid}`
        );
        expect(check.status).toBe(200);
        expect(check.body).toContain(updated);
    });

    test('deletes a grid item through the delete confirmation page', async ({ page, request }) => {

        const marker = `pw2-griditem-delete-${Date.now()}-${test.info().workerIndex}`;
        const grid_uuid = await apiCreateGrid(request, exhibit_uuid, 'host grid', 2);
        await apiCreateGridItem(request, exhibit_uuid, grid_uuid, 'keeper one');
        await apiCreateGridItem(request, exhibit_uuid, grid_uuid, 'keeper two');
        const item_uuid = await apiCreateGridItem(request, exhibit_uuid, grid_uuid, marker);

        await page.goto(
            `${APP_PATH}/items/grid/item/delete`
            + `?exhibit_id=${exhibit_uuid}&grid_id=${grid_uuid}&item_id=${item_uuid}`
        );
        // The Delete listener is attached only after the view's async init
        // resolves; show_form() reveals the card strictly after the attach,
        // so a visible card proves the click below will be heard.
        await expect(page.locator('#delete-card')).toBeVisible();

        const delete_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${item_uuid}`
                && resp.request().method() === 'DELETE';
        });

        await page.click('#delete-item-btn');

        const resp = await delete_response;
        expect([200, 204]).toContain(resp.status());

        const check = await apiGet(
            request,
            `/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${item_uuid}`
        );
        expect(check.body).not.toContain(marker);
    });

    for (const refusal of [
        { columns: 2, message: DELETE_ADD_ITEMS_MESSAGE, advice: 'to add items when fewer columns cannot help' },
        { columns: 3, message: DELETE_MESSAGE, advice: 'to reduce the columns when that would allow it' }
    ]) {

        test(`refuses to delete a grid item below the column count and says ${refusal.advice}`, async ({ page, request }) => {

            const marker = `pw2-griditem-keep-${Date.now()}-${test.info().workerIndex}`;
            const grid_uuid = await apiCreateGrid(request, exhibit_uuid, 'host grid', refusal.columns);

            for (let keeper = 1; keeper < refusal.columns; keeper += 1) {
                await apiCreateGridItem(request, exhibit_uuid, grid_uuid, `keeper ${keeper}`);
            }

            const item_uuid = await apiCreateGridItem(request, exhibit_uuid, grid_uuid, marker);

            await page.goto(
                `${APP_PATH}/items/grid/item/delete`
                + `?exhibit_id=${exhibit_uuid}&grid_id=${grid_uuid}&item_id=${item_uuid}`
            );
            await expect(page.locator('#delete-card')).toBeVisible();

            const delete_response = page.waitForResponse((resp) => {
                const u = new URL(resp.url());
                return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${item_uuid}`
                    && resp.request().method() === 'DELETE';
            });

            await page.click('#delete-item-btn');

            const resp = await delete_response;
            expect(resp.status()).toBe(422);

            await expect(page.locator('#message')).toContainText(refusal.message);
            await expect(page.locator('#delete-card')).toBeVisible();

            const check = await apiGet(
                request,
                `/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${item_uuid}`
            );
            expect(check.status).toBe(200);
            expect(check.body).toContain(marker);
        });
    }

    test('refuses raising grid columns above the item count through the edit form', async ({ page, request }) => {

        const marker = `pw2-grid-columns-${Date.now()}-${test.info().workerIndex}`;
        const grid_uuid = await apiCreateGrid(request, exhibit_uuid, marker, 2);
        await apiCreateGridItem(request, exhibit_uuid, grid_uuid, 'item one');
        await apiCreateGridItem(request, exhibit_uuid, grid_uuid, 'item two');

        await page.goto(
            `${APP_PATH}/items/grid/edit?exhibit_id=${exhibit_uuid}&item_id=${grid_uuid}`
        );
        await expect(page.locator('#grid-text-input .ql-editor'))
            .toHaveText(new RegExp(marker), { timeout: 10_000 });

        await page.selectOption('#grid-columns', '4');

        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/grids/${grid_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#save-item-btn');

        const resp = await put_response;
        expect(resp.status()).toBe(422);
        await expect(page.locator('#message')).toContainText(SAVE_MESSAGE);

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}`);
        expect(JSON.parse(check.body).data.columns).toBe(2);
    });
});

test.describe('Grid with items, one request (live)', () => {

    let exhibit_uuid = null;
    let media_uuid = null;

    const text_item = (text) => ({
        item_type: 'text',
        mime_type: 'text/plain',
        title: '',
        text,
        layout: 'text_only',
        media_width: 50,
        styles: {}
    });

    const grid_payload = (marker, columns) => ({
        internal_name: `${marker} internal`,
        columns,
        text: marker,
        styles: {},
        created_by: 'pw-e2e-admin'
    });

    const exhibit_item_list = async (request) => {
        const list = await apiGet(request, `/exhibits/${exhibit_uuid}/items`);
        expect(list.status).toBe(200);
        return list.body;
    };

    test.beforeEach(async ({ request }) => {
        exhibit_uuid = await apiCreateExhibit(
            request,
            `pw2-grid-with-items-host-${Date.now()}-${test.info().workerIndex}`
        );
    });

    test.afterEach(async ({ request }) => {
        await apiDeleteExhibit(request, exhibit_uuid);
        await apiDeleteMediaRecord(request, media_uuid);
        exhibit_uuid = null;
        media_uuid = null;
    });

    test('creates the grid and every item, in the order sent', async ({ request }) => {

        const marker = `pw2-with-items-${Date.now()}-${test.info().workerIndex}`;
        media_uuid = await apiCreateMediaRecord(request, `${marker}-media`);

        const created = await apiPost(request, `/exhibits/${exhibit_uuid}/grids/with-items`, {
            grid: grid_payload(marker, '3'),
            items: [
                text_item(`${marker}-first`),
                {
                    item_type: 'image',
                    mime_type: 'image/png',
                    title: '',
                    media_uuid,
                    layout: 'media_top',
                    media_width: 50,
                    styles: {}
                },
                {
                    item_type: 'content_block',
                    type: 'content_block',
                    content_type: 'button',
                    text: `${marker}-button`,
                    url: 'library.du.edu',
                    size: 'small',
                    styles: null
                },
                text_item(`${marker}-last`)
            ]
        });

        expect(created.status).toBe(201);
        expect(created.json.data.item_uuids).toHaveLength(4);

        const grid_uuid = created.json.data.grid_uuid;
        const grid = await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}`);
        const grid_record = JSON.parse(grid.body).data;

        expect(grid_record.columns).toBe(3);
        expect(grid_record.is_published).toBe(0);
        expect(grid_record.text).toContain(marker);

        const items = await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items`);
        const item_records = JSON.parse(items.body).data;

        expect(item_records.map((item) => item.uuid)).toEqual(created.json.data.item_uuids);
        expect(item_records.map((item) => item.order)).toEqual([1, 2, 3, 4]);
        expect(item_records.map((item) => item.item_type)).toEqual(['text', 'image', 'content_block', 'text']);
        expect(item_records[2].content_type).toBe('button');
        expect(item_records[2].url).toBe('https://library.du.edu');
        expect(item_records.every((item) => item.is_published === 0)).toBe(true);
    });

    test('saves nothing when one item is incomplete', async ({ request }) => {

        const marker = `pw2-with-items-invalid-${Date.now()}-${test.info().workerIndex}`;

        const refused = await apiPost(request, `/exhibits/${exhibit_uuid}/grids/with-items`, {
            grid: grid_payload(marker, 2),
            items: [
                text_item(`${marker}-first`),
                text_item(`${marker}-second`),
                { item_type: 'content_block', type: 'content_block', content_type: '', styles: null }
            ]
        });

        expect(refused.status).toBe(400);
        expect(refused.json.errors).toEqual([
            { index: 2, field: 'content_type', message: 'Please select a content block type' }
        ]);
        expect(await exhibit_item_list(request)).not.toContain(marker);
    });

    test('refuses a grid with fewer items than columns', async ({ request }) => {

        const marker = `pw2-with-items-short-${Date.now()}-${test.info().workerIndex}`;

        const refused = await apiPost(request, `/exhibits/${exhibit_uuid}/grids/with-items`, {
            grid: grid_payload(marker, 3),
            items: [text_item(`${marker}-first`), text_item(`${marker}-second`)]
        });

        expect(refused.status).toBe(422);
        expect(refused.json.message).toBe(SAVE_MESSAGE);
        expect(await exhibit_item_list(request)).not.toContain(marker);
    });

    test('rolls the grid back when the database rejects an item', async ({ request }) => {

        const marker = `pw2-with-items-rollback-${Date.now()}-${test.info().workerIndex}`;

        const failed = await apiPost(request, `/exhibits/${exhibit_uuid}/grids/with-items`, {
            grid: grid_payload(marker, 2),
            items: [
                text_item(`${marker}-first`),
                text_item(`${marker}-second`),
                { ...text_item(`${marker}-third`), layout: 'x'.repeat(101) }
            ]
        });

        expect(failed.status).toBe(500);
        expect(failed.json.message).toBe('Unable to create grid. Nothing was saved.');
        expect(await exhibit_item_list(request)).not.toContain(marker);
    });
});
