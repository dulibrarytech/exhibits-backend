'use strict';

/**
 * LIVE: deleting (recycling) a PUBLISHED exhibit removes it from the public
 * search index (code review 2026-09-02, H7).
 *
 * Arrange via API: create an exhibit with one item, publish it (which indexes
 * into the LOCAL Elasticsearch index), confirm the exhibit doc is retrievable,
 * then DELETE the exhibit exactly as the dashboard does — a plain DELETE with
 * no prior suppress — and confirm the doc is gone. The indexer record route is
 * mounted without the app-path prefix, so it is addressed from the server
 * root.
 */

const { test, expect } = require('@playwright/test');
const {
    APP_PATH,
    role_headers,
    apiCreateExhibit,
    apiCreateItem,
    apiDeleteExhibit
} = require('./fixtures/live-api');

const API = `${APP_PATH}/api/v1`;

test.describe('Exhibit delete → public index (live)', () => {

    test('a published exhibit leaves the index when it is deleted', async ({ request }) => {

        const exhibit_uuid = await apiCreateExhibit(request, `PW delete-index ${Date.now()}`);
        const headers = role_headers('administrator');

        try {
            await apiCreateItem(request, exhibit_uuid, 'delete-index item');

            const publish = await request.post(`${API}/exhibits/${exhibit_uuid}/publish`, { headers });
            expect(publish.status(), 'publish succeeds').toBe(200);

            const indexed = await request.get(`/api/v1/indexer/${exhibit_uuid}`, { headers });
            expect(indexed.status(), 'exhibit doc is in the index after publish').toBe(200);

            const deleted = await request.delete(`${API}/exhibits/${exhibit_uuid}`, { headers });
            expect(deleted.status(), 'plain DELETE (no prior suppress) succeeds').toBe(204);

            const gone = await request.get(`/api/v1/indexer/${exhibit_uuid}`, { headers });
            expect(gone.status(), 'exhibit doc is gone from the index after delete').toBe(404);

            const record = await request.get(`${API}/exhibits/${exhibit_uuid}`, { headers });
            expect(await record.text(), 'publish flag cleared on the recycled row').not.toContain('"is_published":1');
        } finally {
            await apiDeleteExhibit(request, exhibit_uuid);
        }
    });
});
