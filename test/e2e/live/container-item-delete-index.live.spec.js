'use strict';

/**
 * LIVE: deleting a grid / timeline ITEM updates the published container's
 * index doc, and a published grid cannot be deleted below its column minimum
 * (code review 2026-09-02, M4).
 *
 * Arrange via API, assert via the indexer record route (mounted without the
 * app-path prefix, so addressed from the server root). Teardown suppresses
 * before deleting so the local index is left clean.
 */

const { test, expect } = require('@playwright/test');
const {
    APP_PATH,
    role_headers,
    apiCreateExhibit,
    apiCreateGrid,
    apiCreateGridItem,
    apiCreateTimeline,
    apiCreateTimelineItem,
    apiSuppressExhibit,
    apiDeleteExhibit
} = require('./fixtures/live-api');

const API = `${APP_PATH}/api/v1`;

async function indexed_item_uuids(request, container_uuid, headers) {
    const res = await request.get(`/api/v1/indexer/${container_uuid}`, { headers });
    expect(res.status(), 'container doc is indexed').toBe(200);
    const body = await res.json();
    /* The record route wraps the task result — { found, source } — in the shared
       {success, message, data} envelope (Phase 3 item 19). The bare-body read is
       kept as a fallback so this spec also runs against an older server. */
    const source = (body.data && body.data.source) || body.source || {};
    return (source.items || []).map((item) => item.uuid);
}

test.describe('Container item delete → public index (live)', () => {

    test('deleting a timeline item drops it from the published timeline doc', async ({ request }) => {

        const headers = role_headers('administrator');
        const exhibit_uuid = await apiCreateExhibit(request, `PW item-delete-index ${Date.now()}`);

        try {
            const timeline_uuid = await apiCreateTimeline(request, exhibit_uuid, 'tl');
            const keep = await apiCreateTimelineItem(request, exhibit_uuid, timeline_uuid, 'keep', 'keep');
            const drop = await apiCreateTimelineItem(request, exhibit_uuid, timeline_uuid, 'drop', 'drop');

            const publish = await request.post(`${API}/exhibits/${exhibit_uuid}/publish`, { headers });
            expect(publish.status(), 'publish succeeds').toBe(200);

            expect(await indexed_item_uuids(request, timeline_uuid, headers)).toEqual(expect.arrayContaining([keep, drop]));

            const deleted = await request.delete(`${API}/exhibits/${exhibit_uuid}/timelines/${timeline_uuid}/items/${drop}`, { headers });
            expect(deleted.status(), 'item delete succeeds').toBe(204);

            const after = await indexed_item_uuids(request, timeline_uuid, headers);
            expect(after, 'deleted item is gone from the timeline doc').not.toContain(drop);
            expect(after, 'sibling item is still there').toContain(keep);
        } finally {
            await apiSuppressExhibit(request, exhibit_uuid);
            await apiDeleteExhibit(request, exhibit_uuid);
        }
    });

    test('a published grid at its column minimum refuses to delete a published item', async ({ request }) => {

        const headers = role_headers('administrator');
        const exhibit_uuid = await apiCreateExhibit(request, `PW grid-min-delete ${Date.now()}`);

        try {
            const grid_uuid = await apiCreateGrid(request, exhibit_uuid, 'grid', 2);
            const first = await apiCreateGridItem(request, exhibit_uuid, grid_uuid, 'one');
            await apiCreateGridItem(request, exhibit_uuid, grid_uuid, 'two');

            const publish = await request.post(`${API}/exhibits/${exhibit_uuid}/publish`, { headers });
            expect(publish.status(), 'publish succeeds').toBe(200);

            const refused = await request.delete(`${API}/exhibits/${exhibit_uuid}/grids/${grid_uuid}/items/${first}`, { headers });
            expect(refused.status(), 'delete below the minimum is refused').toBe(400);
            expect(await refused.text()).toMatch(/needs at least 2 items/);

            expect(await indexed_item_uuids(request, grid_uuid, headers), 'grid doc untouched').toContain(first);
        } finally {
            await apiSuppressExhibit(request, exhibit_uuid);
            await apiDeleteExhibit(request, exhibit_uuid);
        }
    });
});
