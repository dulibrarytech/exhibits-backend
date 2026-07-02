'use strict';

/**
 * LIVE timelines + timeline items CRUD — parents arranged via the real API,
 * workflows driven through the real UI, persistence verified via the API.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const {
    APP_PATH,
    apiCreateExhibit,
    apiCreateTimeline,
    apiCreateTimelineItem,
    apiDeleteExhibit,
    apiGet
} = require('./fixtures/live-api');

test.describe('Timelines and timeline items CRUD (live)', () => {

    let exhibit_uuid = null;

    test.beforeEach(async ({ context, page, request }) => {
        await loginAs(context, page, 'administrator');
        exhibit_uuid = await apiCreateExhibit(
            request,
            `pw2-timelines-host-${Date.now()}-${test.info().workerIndex}`
        );
    });

    test.afterEach(async ({ request }) => {
        await apiDeleteExhibit(request, exhibit_uuid);
        exhibit_uuid = null;
    });

    test('creates a timeline through the timeline form', async ({ page, request }) => {

        const marker = `pw2-timeline-create-${Date.now()}-${test.info().workerIndex}`;

        await page.goto(`${APP_PATH}/items/vertical-timeline?exhibit_id=${exhibit_uuid}`);
        await expect(page.locator('#save-timeline-btn')).toBeEnabled();

        await page.fill('#timeline-text-input', marker);

        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/timelines`
                && resp.request().method() === 'POST';
        });

        await page.click('#save-timeline-btn');

        const resp = await create_response;
        expect(resp.status()).toBe(201);
        const timeline_uuid = (await resp.json()).data;

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}`);
        expect(check.status).toBe(200);
        expect(check.body).toContain(marker);
    });

    test('updates a timeline through the edit form', async ({ page, request }) => {

        const original = `pw2-timeline-edit-${Date.now()}-${test.info().workerIndex}`;
        const updated = `${original}-updated`;
        const timeline_uuid = await apiCreateTimeline(request, exhibit_uuid, original);

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${exhibit_uuid}&item_id=${timeline_uuid}`
        );

        const text_input = page.locator('#timeline-text-input');
        await expect(text_input).toHaveValue(new RegExp(original), { timeout: 10_000 });

        await text_input.fill(updated);

        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#save-timeline-btn');

        const resp = await put_response;
        expect([200, 201, 204]).toContain(resp.status());

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}`);
        expect(check.status).toBe(200);
        expect(check.body).toContain(updated);
    });

    test('deletes a timeline through the delete confirmation page', async ({ page, request }) => {

        const marker = `pw2-timeline-delete-${Date.now()}-${test.info().workerIndex}`;
        const timeline_uuid = await apiCreateTimeline(request, exhibit_uuid, marker);

        await page.goto(
            `${APP_PATH}/items/delete`
            + `?exhibit_id=${exhibit_uuid}&item_id=${timeline_uuid}&type=timeline`
        );
        await expect(page.locator('#delete-item-btn')).toBeEnabled();

        const delete_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/items/${timeline_uuid}`
                && resp.request().method() === 'DELETE';
        });

        await page.click('#delete-item-btn');

        const resp = await delete_response;
        expect([200, 204]).toContain(resp.status());

        const check = await apiGet(request, `/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}`);
        expect(check.body).not.toContain(marker);
    });

    test('creates a timeline item through the timeline item form', async ({ page, request }) => {

        const marker = `pw2-tlitem-create-${Date.now()}-${test.info().workerIndex}`;
        const timeline_uuid = await apiCreateTimeline(request, exhibit_uuid, 'host timeline');

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text`
            + `?exhibit_id=${exhibit_uuid}&timeline_id=${timeline_uuid}`
        );
        await expect(page.locator('#save-item-btn')).toBeEnabled();

        await page.fill('#item-title-input', marker);
        await page.fill('#item-date-input', '2026-04-15');
        await page.fill('#item-text-input', `${marker}-text`);

        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}/items`
                && resp.request().method() === 'POST';
        });

        await page.click('#save-item-btn');

        const resp = await create_response;
        expect(resp.status()).toBe(201);
        const item_uuid = (await resp.json()).data;

        const check = await apiGet(
            request,
            `/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}/items/${item_uuid}`
        );
        expect(check.status).toBe(200);
        expect(check.body).toContain(marker);
    });

    test('updates a timeline item through the edit form', async ({ page, request }) => {

        const original = `pw2-tlitem-edit-${Date.now()}-${test.info().workerIndex}`;
        const updated = `${original}-updated`;
        const timeline_uuid = await apiCreateTimeline(request, exhibit_uuid, 'host timeline');
        const item_uuid = await apiCreateTimelineItem(
            request, exhibit_uuid, timeline_uuid, original, `${original}-text`
        );

        await page.goto(
            `${APP_PATH}/items/vertical-timeline/item/text/edit`
            + `?exhibit_id=${exhibit_uuid}&timeline_id=${timeline_uuid}&item_id=${item_uuid}`
        );

        const title_input = page.locator('#item-title-input');
        await expect(title_input).toHaveValue(new RegExp(original), { timeout: 10_000 });

        await title_input.fill(updated);

        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}/items/${item_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#save-item-btn');

        const resp = await put_response;
        expect([200, 201, 204]).toContain(resp.status());

        const check = await apiGet(
            request,
            `/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}/items/${item_uuid}`
        );
        expect(check.status).toBe(200);
        expect(check.body).toContain(updated);
    });

    test('deletes a timeline item through the delete confirmation page', async ({ page, request }) => {

        const marker = `pw2-tlitem-delete-${Date.now()}-${test.info().workerIndex}`;
        const timeline_uuid = await apiCreateTimeline(request, exhibit_uuid, 'host timeline');
        const item_uuid = await apiCreateTimelineItem(
            request, exhibit_uuid, timeline_uuid, marker, `${marker}-text`
        );

        await page.goto(
            `${APP_PATH}/items/timeline/item/delete`
            + `?exhibit_id=${exhibit_uuid}&timeline_id=${timeline_uuid}&item_id=${item_uuid}`
        );
        await expect(page.locator('#delete-item-btn')).toBeEnabled();

        const delete_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}/items/${item_uuid}`
                && resp.request().method() === 'DELETE';
        });

        await page.click('#delete-item-btn');

        const resp = await delete_response;
        expect([200, 204]).toContain(resp.status());

        const check = await apiGet(
            request,
            `/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}/items/${item_uuid}`
        );
        expect(check.body).not.toContain(marker);
    });
});
