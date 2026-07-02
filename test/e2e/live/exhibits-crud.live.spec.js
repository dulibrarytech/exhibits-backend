'use strict';

/**
 * LIVE exhibits CRUD — real UI -> real API -> real MySQL.
 *
 * Create drives the Add Exhibit modal (including the real required-styles
 * gate); update drives the edit form; delete drives the delete-confirmation
 * page. Every mutation is verified against the live API afterwards, so a
 * green run means the workflow PERSISTED, not just that the UI accepted it.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const { fillRequiredStyles } = require('./fixtures/live-ui');
const { APP_PATH, apiCreateExhibit, apiDeleteExhibit, apiGet } = require('./fixtures/live-api');
const { openModal } = require('../helpers/bootstrap');

test.describe('Exhibits CRUD (live)', () => {

    let exhibit_uuid = null;

    test.beforeEach(async ({ context, page }) => {
        await loginAs(context, page, 'administrator');
    });

    test.afterEach(async ({ request }) => {
        await apiDeleteExhibit(request, exhibit_uuid);
        exhibit_uuid = null;
    });

    test('creates an exhibit through the Add Exhibit modal', async ({ page, request }) => {

        const marker = `pw2-exhibit-create-${Date.now()}-${test.info().workerIndex}`;

        await page.goto(`${APP_PATH}/exhibits`);
        await openModal(page, 'add-exhibit-modal');

        await page.fill('#exhibit-title-input', marker);
        await page.fill('#exhibit-description-input', 'Live create description');
        await fillRequiredStyles(page);

        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits`
                && resp.request().method() === 'POST';
        });

        await page.click('#save-exhibit-btn');

        const resp = await create_response;
        expect(resp.status()).toBe(201);
        exhibit_uuid = (await resp.json()).data;
        expect(typeof exhibit_uuid).toBe('string');

        // Persisted: the real API serves the record back with our title.
        const check = await apiGet(request, `/exhibits/${exhibit_uuid}`);
        expect(check.status).toBe(200);
        expect(check.body).toContain(marker);
    });

    test('updates an exhibit through the edit form', async ({ page, request }) => {

        const original = `pw2-exhibit-edit-${Date.now()}-${test.info().workerIndex}`;
        const updated = `${original}-updated`;
        exhibit_uuid = await apiCreateExhibit(request, original);

        await page.goto(`${APP_PATH}/exhibits/exhibit/edit?exhibit_id=${exhibit_uuid}`);

        // Form is populated from the real record before we edit it.
        const title_input = page.locator('#exhibit-title-input');
        await expect(title_input).toHaveValue(original, { timeout: 10_000 });

        await title_input.fill(updated);
        await fillRequiredStyles(page);

        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#save-exhibit-btn');

        const resp = await put_response;
        expect([200, 201, 204]).toContain(resp.status());

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}`);
        expect(check.status).toBe(200);
        expect(check.body).toContain(updated);
    });

    test('deletes an exhibit through the delete confirmation page', async ({ page, request }) => {

        const marker = `pw2-exhibit-delete-${Date.now()}-${test.info().workerIndex}`;
        exhibit_uuid = await apiCreateExhibit(request, marker);

        await page.goto(`${APP_PATH}/exhibits/exhibit/delete?exhibit_id=${exhibit_uuid}`);

        const delete_button = page.locator('#delete-exhibit-btn');
        await expect(delete_button).toBeEnabled();

        const delete_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}`
                && resp.request().method() === 'DELETE';
        });

        await delete_button.click();

        const resp = await delete_response;
        expect([200, 204]).toContain(resp.status());

        // Gone from the source of truth.
        const check = await apiGet(request, `/exhibits/${exhibit_uuid}`);
        expect(check.body).not.toContain(marker);
        exhibit_uuid = null; // already deleted — skip cleanup
    });
});
