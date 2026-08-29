'use strict';

/**
 * LIVE full exhibit lifecycle: create → publish → preview.
 *
 * One continuous scenario through the real stack: the Add Exhibit modal
 * creates the record (real required-styles gate), every component type is
 * arranged via the API — a standard item, a grid with grid items, and a
 * timeline with timeline items — then the exhibits-list Publish control
 * publishes (bulk-flipping the exhibit AND every component, and indexing
 * into the local Elasticsearch index — publish only succeeds if the index
 * write does), and the preview page builds the DB-backed preview and
 * renders the viewer iframe. Every state change is verified per-record
 * against the live API.
 *
 * Teardown suppresses before deleting so the documents publish/preview
 * wrote into the local search index are removed again.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const { fillRequiredStyles } = require('./fixtures/live-ui');
const {
    APP_PATH,
    apiCreateItem,
    apiCreateGrid,
    apiCreateGridItem,
    apiCreateTimeline,
    apiCreateTimelineItem,
    apiDeleteExhibit,
    apiSuppressExhibit,
    apiGet
} = require('./fixtures/live-api');
const { openModal } = require('../helpers/bootstrap');

/*
 * apiGet returns raw text; publish-state assertions need per-record
 * precision (a list body containing one '"is_published":1' must not
 * mask an unpublished sibling), so parse and check every record.
 */
function parse_records(body) {
    const parsed = JSON.parse(body);
    const data = parsed.data ?? parsed;
    return Array.isArray(data) ? data : [data];
}

function expect_all_published(body, expected_count) {
    const records = parse_records(body);
    expect(records.length).toBe(expected_count);
    for (const record of records) {
        expect(record.is_published).toBe(1);
    }
}

test.describe('Exhibit lifecycle (live): create → publish → preview', () => {

    let exhibit_uuid = null;

    test.beforeEach(async ({ context, page }) => {
        await loginAs(context, page, 'administrator');
    });

    test.afterEach(async ({ request }) => {
        // Suppress first: publish/preview indexed into the local ES index,
        // and suppression is what deletes those documents again.
        await apiSuppressExhibit(request, exhibit_uuid);
        await apiDeleteExhibit(request, exhibit_uuid);
        exhibit_uuid = null;
    });

    test('creates, publishes, and previews an exhibit end to end', async ({ page, request }) => {

        const marker = `pw2-lifecycle-${Date.now()}-${test.info().workerIndex}`;

        // ==================== CREATE (through the Add Exhibit modal) ====================

        await page.goto(`${APP_PATH}/exhibits`);
        await openModal(page, 'add-exhibit-modal');

        await page.fill('#exhibit-title-input .ql-editor', marker);
        await page.fill('#exhibit-description-input .ql-editor', 'Lifecycle description');
        await fillRequiredStyles(page);

        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits`
                && resp.request().method() === 'POST';
        });

        await page.click('#save-exhibit-btn');

        const created = await create_response;
        expect(created.status()).toBe(201);
        exhibit_uuid = (await created.json()).data;

        // Persisted, and born unpublished.
        const after_create = await apiGet(request, `/exhibits/${exhibit_uuid}`);
        expect(after_create.status).toBe(200);
        expect(after_create.body).toContain(marker);
        expect(after_create.body).toContain('"is_published":0');

        // ==================== ARRANGE COMPONENTS ====================
        //
        // Populate every container type via the API (each type's UI form flow
        // has its own live CRUD spec) so publish exercises the full bulk
        // state machine: a standard item, a grid with two grid items
        // (columns: 2 — the publish gate requires items >= columns), and a
        // timeline with two timeline items.

        const item_uuid = await apiCreateItem(request, exhibit_uuid, `${marker}-item`);
        expect(typeof item_uuid).toBe('string');

        const grid_uuid = await apiCreateGrid(request, exhibit_uuid, `${marker}-grid`, 2);
        const grid_item_uuids = [
            await apiCreateGridItem(request, exhibit_uuid, grid_uuid, `${marker}-griditem-1`),
            await apiCreateGridItem(request, exhibit_uuid, grid_uuid, `${marker}-griditem-2`)
        ];
        expect(grid_item_uuids.every((uuid) => typeof uuid === 'string')).toBe(true);

        const timeline_uuid = await apiCreateTimeline(request, exhibit_uuid, `${marker}-timeline`);
        const timeline_item_uuids = [
            await apiCreateTimelineItem(request, exhibit_uuid, timeline_uuid, `${marker}-tlitem-1`, 'first event'),
            await apiCreateTimelineItem(request, exhibit_uuid, timeline_uuid, `${marker}-tlitem-2`, 'second event')
        ];
        expect(timeline_item_uuids.every((uuid) => typeof uuid === 'string')).toBe(true);

        // ==================== PUBLISH (through the exhibits list) ====================

        await page.goto(`${APP_PATH}/exhibits`);

        // Parallel live tests share the DB, so the list may hold other rows
        // across DataTable pages — filter down to this exhibit first.
        const search_input = page
            .locator('#exhibits_wrapper input[type="search"], .dt-search input')
            .first();
        await search_input.fill(marker);

        // The status link's id carries a "-status" suffix; the client strips
        // it before POSTing.
        const publish_link = page.locator(`a.publish-exhibit[id="${exhibit_uuid}-status"]`);
        await expect(publish_link).toBeVisible();

        const publish_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits/${exhibit_uuid}/publish`
                && resp.request().method() === 'POST';
        });

        await publish_link.click();

        const published = await publish_response;
        expect(published.status()).toBe(200);

        // The row flips to the suppress control with a Published badge.
        await expect(page.locator(`a.suppress-exhibit[id="${exhibit_uuid}-status"]`)).toBeVisible();

        // Persisted: publish is bulk — the exhibit and EVERY component type
        // must have flipped, containers and their children alike.
        const after_publish = await apiGet(request, `/exhibits/${exhibit_uuid}`);
        expect(after_publish.body).toContain('"is_published":1');

        const item_check = await apiGet(request, `/exhibits/${exhibit_uuid}/items/${item_uuid}`);
        expect_all_published(item_check.body, 1);

        const grid_check = await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}`);
        expect_all_published(grid_check.body, 1);

        const grid_items_check = await apiGet(request, `/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items`);
        expect_all_published(grid_items_check.body, 2);

        const timeline_check = await apiGet(request, `/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}`);
        expect_all_published(timeline_check.body, 1);

        const timeline_items_check = await apiGet(request, `/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}/items`);
        expect_all_published(timeline_items_check.body, 2);

        // ==================== PREVIEW (through the preview page) ====================

        // The sidebar preview link opens this route; cookie auth carries the
        // session. Building the preview sets is_preview and indexes the
        // preview copy — the page only renders after both succeed.
        const preview_nav = await page.goto(`${APP_PATH}/preview?uuid=${exhibit_uuid}`);
        expect(preview_nav.status()).toBe(200);

        // The rendered page embeds the frontend viewer, keyed to this exhibit.
        const iframe = page.locator('#i-frame');
        await expect(iframe).toBeAttached();
        const iframe_src = await iframe.getAttribute('src');
        expect(iframe_src).toContain(exhibit_uuid);
        expect(iframe_src).toContain('key=');

        // Persisted: the preview flag is set on the record.
        const after_preview = await apiGet(request, `/exhibits/${exhibit_uuid}`);
        expect(after_preview.body).toContain('"is_preview":1');
    });
});
