'use strict';

/**
 * LIVE standard-item CRUD — the parent exhibit is arranged via the real API;
 * the item workflows run through the real UI and are verified via the API.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const { APP_PATH, apiCreateExhibit, apiCreateItem, apiDeleteExhibit, apiGet } = require('./fixtures/live-api');

test.describe('Standard items CRUD (live)', () => {

    let exhibit_uuid = null;

    test.beforeEach(async ({ context, page, request }) => {
        await loginAs(context, page, 'administrator');
        exhibit_uuid = await apiCreateExhibit(
            request,
            `pw2-items-host-${Date.now()}-${test.info().workerIndex}`
        );
    });

    test.afterEach(async ({ request }) => {
        await apiDeleteExhibit(request, exhibit_uuid);
        exhibit_uuid = null;
    });

    test('creates a standard text item through the item form', async ({ page, request }) => {

        const marker = `pw2-item-create-${Date.now()}-${test.info().workerIndex}`;

        await page.goto(`${APP_PATH}/items/standard/text?exhibit_id=${exhibit_uuid}`);
        await expect(page.locator('#save-item-btn')).toBeEnabled();

        await page.fill('#item-text-input', marker);

        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/items`
                && resp.request().method() === 'POST';
        });

        await page.click('#save-item-btn');

        const resp = await create_response;
        expect(resp.status()).toBe(201);
        const item_uuid = (await resp.json()).data;

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/items/${item_uuid}`);
        expect(check.status).toBe(200);
        expect(check.body).toContain(marker);
    });

    test('updates a standard item through the edit form', async ({ page, request }) => {

        const original = `pw2-item-edit-${Date.now()}-${test.info().workerIndex}`;
        const updated = `${original}-updated`;
        const item_uuid = await apiCreateItem(request, exhibit_uuid, original);

        await page.goto(
            `${APP_PATH}/items/standard/text/edit?exhibit_id=${exhibit_uuid}&item_id=${item_uuid}`
        );

        // Form is populated from the real record before we edit it.
        const text_input = page.locator('#item-text-input');
        await expect(text_input).toHaveValue(new RegExp(original), { timeout: 10_000 });

        await text_input.fill(updated);

        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/items/${item_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#save-item-btn');

        const resp = await put_response;
        expect([200, 201, 204]).toContain(resp.status());

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/items/${item_uuid}`);
        expect(check.status).toBe(200);
        expect(check.body).toContain(updated);
    });

    test('deletes a standard item through the delete confirmation page', async ({ page, request }) => {

        const marker = `pw2-item-delete-${Date.now()}-${test.info().workerIndex}`;
        const item_uuid = await apiCreateItem(request, exhibit_uuid, marker);

        await page.goto(
            `${APP_PATH}/items/delete`
            + `?exhibit_id=${exhibit_uuid}&item_id=${item_uuid}&type=item`
        );
        await expect(page.locator('#delete-item-btn')).toBeEnabled();

        const delete_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/items/${item_uuid}`
                && resp.request().method() === 'DELETE';
        });

        await page.click('#delete-item-btn');

        const resp = await delete_response;
        expect([200, 204]).toContain(resp.status());

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/items/${item_uuid}`);
        expect(check.body).not.toContain(marker);
    });
});
