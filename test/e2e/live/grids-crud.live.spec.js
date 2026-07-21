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
    apiDeleteExhibit,
    apiGet
} = require('./fixtures/live-api');

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
        await expect(page.locator('#save-item-btn')).toBeEnabled();

        await page.fill('#grid-text-input', marker);

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

        const text_input = page.locator('#grid-text-input');
        await expect(text_input).toHaveValue(new RegExp(original), { timeout: 10_000 });

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
        await expect(page.locator('#delete-item-btn')).toBeEnabled();

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
        await expect(page.locator('#save-item-btn')).toBeEnabled();

        await page.fill('#item-text-input', marker);

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

        const text_input = page.locator('#item-text-input');
        await expect(text_input).toHaveValue(new RegExp(original), { timeout: 10_000 });

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
        const grid_uuid = await apiCreateGrid(request, exhibit_uuid, 'host grid');
        const item_uuid = await apiCreateGridItem(request, exhibit_uuid, grid_uuid, marker);

        await page.goto(
            `${APP_PATH}/items/grid/item/delete`
            + `?exhibit_id=${exhibit_uuid}&grid_id=${grid_uuid}&item_id=${item_uuid}`
        );
        await expect(page.locator('#delete-item-btn')).toBeEnabled();

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
});
