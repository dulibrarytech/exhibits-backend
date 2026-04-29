'use strict';

/**
 * Unit tests for the route-stub helpers in
 * `playwright-proposal/test/e2e/fixtures/api-stubs.js`. The goal is to
 * catch stub-overlap and path-tail-parsing regressions without paying
 * the cost of running the e2e suite.
 *
 * Strategy: register each stub against a mock `page` object that
 * captures route handlers. Then synthesize requests by calling the
 * captured handlers directly with a mock `route` and assert the
 * fulfill/fallback decision.
 *
 * This sidesteps URL-pattern matching (Playwright's responsibility)
 * and focuses on the intra-handler logic — which is where every stub
 * regression in modified-15 through modified-37 actually lived
 * (modified-18 stubExhibitsApi POST→/verify, modified-26 path_tail_after
 * trailing-slash, modified-37 timeline-item .item wrapper).
 */

const path = require('path');

// At runtime the fixture file lives at `test/e2e/fixtures/api-stubs.js`
// (one level up from this test, then into e2e/fixtures). The earlier
// path in modified-40 used the staging-folder layout
// (`playwright-proposal/test/…`) and didn't resolve in the working tree.
const stubs = require(
    path.resolve(__dirname, '../e2e/fixtures/api-stubs.js')
);

// ============================================================
// Mock harness
// ============================================================

function makeMockRequest(method, url, body) {
    return {
        method: () => method,
        url: () => url,
        postDataJSON: () => body ?? null,
    };
}

function makeMockRoute(method, url, body) {
    let action = null;
    let payload = null;
    return {
        request: () => makeMockRequest(method, url, body),
        fulfill: (opts) => { action = 'fulfill'; payload = opts; },
        fallback: () => { action = 'fallback'; },
        getResult: () => ({ action, payload }),
    };
}

function makeMockPage() {
    const handlers = []; // [{ pattern, handler }]
    return {
        async route(pattern, handler) {
            handlers.push({ pattern, handler });
        },
        async addInitScript() {},
        // Synthesize a request and dispatch to the LAST handler that
        // actually claims it (matching Playwright's reverse-order rule).
        // Because we don't replicate Playwright's URL matching, callers
        // pass `handlerIndex` to pick which handler to invoke. For
        // single-handler stubs this is 0; for stubs that register
        // multiple routes (e.g. stubGridItemsApi), tests pick by index.
        async invokeHandler(handlerIndex, method, url, body) {
            if (handlerIndex >= handlers.length) {
                throw new Error(`Handler index ${handlerIndex} out of range; only ${handlers.length} registered`);
            }
            const route = makeMockRoute(method, url, body);
            await handlers[handlerIndex].handler(route);
            return route.getResult();
        },
        getHandlerCount() {
            return handlers.length;
        },
    };
}

// Helper that builds a fully-qualified URL for the seeded APP_PATH.
const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const url = (path) => `http://localhost:3000${APP_PATH}${path}`;

// ============================================================
// stubExhibitsApi — anchored regex; method-discriminated
// ============================================================

describe('stubExhibitsApi', () => {

    test('GET /api/v1/exhibits → fulfills 200 with records array', async () => {
        const page = makeMockPage();
        await stubs.stubExhibitsApi(page, { records: [{ uuid: 'a' }] });
        const result = await page.invokeHandler(0, 'GET', url('/api/v1/exhibits'));
        expect(result.action).toBe('fulfill');
        expect(result.payload.status).toBe(200);
        expect(JSON.parse(result.payload.body)).toEqual({ data: [{ uuid: 'a' }] });
    });

    test('POST /api/v1/exhibits → fulfills 201 with new uuid', async () => {
        const page = makeMockPage();
        await stubs.stubExhibitsApi(page);
        const result = await page.invokeHandler(0, 'POST', url('/api/v1/exhibits'));
        expect(result.action).toBe('fulfill');
        expect(result.payload.status).toBe(201);
    });

    test('PUT or DELETE → falls back (handler does not own these methods)', async () => {
        const page = makeMockPage();
        await stubs.stubExhibitsApi(page);
        for (const method of ['PUT', 'DELETE', 'PATCH']) {
            const result = await page.invokeHandler(0, method, url('/api/v1/exhibits'));
            expect(result.action).toBe('fallback');
        }
    });
});

// ============================================================
// stubExhibitRecordApi — handles GET (record) and PUT (update)
// ============================================================

describe('stubExhibitRecordApi', () => {

    test('GET /api/v1/exhibits/<uuid> → fulfills with record', async () => {
        const page = makeMockPage();
        const state = await stubs.stubExhibitRecordApi(page, {
            record: stubs.exhibitFixture({ uuid: 'X', title: 'Test' }),
        });
        const result = await page.invokeHandler(0, 'GET', url('/api/v1/exhibits/X'));
        expect(result.action).toBe('fulfill');
        expect(JSON.parse(result.payload.body).data.title).toBe('Test');
        expect(state.updateCount).toBe(0);
    });

    test('PUT /api/v1/exhibits/<uuid> → captures payload, returns 201', async () => {
        const page = makeMockPage();
        const state = await stubs.stubExhibitRecordApi(page, {
            record: stubs.exhibitFixture({ uuid: 'X' }),
        });
        const result = await page.invokeHandler(
            0,
            'PUT',
            url('/api/v1/exhibits/X'),
            { title: 'Edited' }
        );
        expect(result.action).toBe('fulfill');
        expect(result.payload.status).toBe(201);
        expect(state.updateCount).toBe(1);
        expect(state.lastUpdatePayload).toEqual({ title: 'Edited' });
    });
});

// ============================================================
// stubHeadingRecordsApi — path_tail_after('/headings')
// ============================================================

describe('stubHeadingRecordsApi (path-tail logic)', () => {

    let page;
    beforeEach(async () => {
        page = makeMockPage();
        await stubs.stubHeadingRecordsApi(page, { exhibitId: 'X' });
    });

    test('POST /…/headings (no trailing /<id>) → claim (create) — modified-26 regression', async () => {
        // The modified-25 audit broke this case by splitting on '/headings/'
        // (trailing slash); modified-26 fixed it by using '/headings' as
        // the locator. This test guards against re-introducing the trailing-
        // slash assumption.
        const result = await page.invokeHandler(0, 'POST', url('/api/v1/exhibits/X/headings'), { text: 'new' });
        expect(result.action).toBe('fulfill');
        expect(result.payload.status).toBe(201);
    });

    test('GET /…/headings/<id>?type=edit → claim', async () => {
        const result = await page.invokeHandler(0, 'GET', url('/api/v1/exhibits/X/headings/abc?type=edit'));
        expect(result.action).toBe('fulfill');
        expect(JSON.parse(result.payload.body).data).toBeDefined();
    });

    test('PUT /…/headings/<id> → claim, capture payload', async () => {
        const result = await page.invokeHandler(
            0,
            'PUT',
            url('/api/v1/exhibits/X/headings/abc'),
            { text: 'edited' }
        );
        expect(result.action).toBe('fulfill');
    });

    test('POST /…/headings/<id>/unlock → fallback (nested resource we don\'t own)', async () => {
        const result = await page.invokeHandler(0, 'POST', url('/api/v1/exhibits/X/headings/abc/unlock'));
        expect(result.action).toBe('fallback');
    });
});

// ============================================================
// stubGridItemRecordApi — POST '' / GET-PUT /<id>
// ============================================================

describe('stubGridItemRecordApi (path-tail + method matrix)', () => {

    let page;
    beforeEach(async () => {
        page = makeMockPage();
        await stubs.stubGridItemRecordApi(page, { exhibitId: 'X', gridId: 'G' });
    });

    test('POST on /items (no id) → claim (create)', async () => {
        const result = await page.invokeHandler(
            0,
            'POST',
            url('/api/v1/exhibits/X/grids/G/items'),
            { text: 'new' }
        );
        expect(result.action).toBe('fulfill');
    });

    test('GET on /items/<id> → claim (read)', async () => {
        const result = await page.invokeHandler(0, 'GET', url('/api/v1/exhibits/X/grids/G/items/abc'));
        expect(result.action).toBe('fulfill');
    });

    test('GET on /items (list) → fallback (owned by stubGridItemsApi)', async () => {
        const result = await page.invokeHandler(0, 'GET', url('/api/v1/exhibits/X/grids/G/items'));
        // Single-handler stub doesn't own bare list GET (segments.length === 0
        // doesn't match the GET branch's `segments.length === 1` check).
        expect(result.action).toBe('fallback');
    });

    test('POST on /items/<id>/<sub> → fallback', async () => {
        const result = await page.invokeHandler(0, 'POST', url('/api/v1/exhibits/X/grids/G/items/abc/publish'));
        expect(result.action).toBe('fallback');
    });
});

// ============================================================
// stubStandardItemApi — falls back on /items/reorder
// ============================================================

describe('stubStandardItemApi (reorder defense)', () => {

    let page;
    beforeEach(async () => {
        page = makeMockPage();
        await stubs.stubStandardItemApi(page, { exhibitId: 'X' });
    });

    test('POST on /items (create) → claim', async () => {
        const result = await page.invokeHandler(
            0,
            'POST',
            url('/api/v1/exhibits/X/items'),
            { text: 'new' }
        );
        expect(result.action).toBe('fulfill');
    });

    test('POST on /items/reorder → fallback (owned by reorder stub)', async () => {
        // Defensive guard added in modified-31 because the reorder URL
        // shares the /items/ prefix.
        const result = await page.invokeHandler(0, 'POST', url('/api/v1/exhibits/X/items/reorder'));
        expect(result.action).toBe('fallback');
    });
});

// ============================================================
// stubTimelineItemApi — {data: {item: <record>}} response shape
// ============================================================

describe('stubTimelineItemApi (response-shape)', () => {

    test('GET /…/items/<id> → response is plain {data: <record>}', async () => {
        const page = makeMockPage();
        await stubs.stubTimelineItemApi(page, {
            exhibitId: 'X',
            timelineId: 'T',
            record: stubs.timelineItemRecordFixture({ uuid: 'abc', text: 'hello' }),
        });
        const result = await page.invokeHandler(0, 'GET', url('/api/v1/exhibits/X/timelines/T/items/abc?type=edit&uid=1'));
        expect(result.action).toBe('fulfill');
        const body = JSON.parse(result.payload.body);
        expect(body.data.item).toBeUndefined();
        expect(body.data.text).toBe('hello');
        expect(body.data.uuid).toBe('abc');
    });

    test('PUT /…/items/<id> → response is plain {data: {uuid}}', async () => {
        const page = makeMockPage();
        const state = await stubs.stubTimelineItemApi(page, {
            exhibitId: 'X',
            timelineId: 'T',
            record: stubs.timelineItemRecordFixture({ uuid: 'abc' }),
        });
        const result = await page.invokeHandler(
            0,
            'PUT',
            url('/api/v1/exhibits/X/timelines/T/items/abc'),
            { text: 'edited' }
        );
        expect(result.action).toBe('fulfill');
        const body = JSON.parse(result.payload.body);
        expect(body.data.uuid).toBe('abc');
        expect(state.lastUpdatePayload).toEqual({ text: 'edited' });
    });
});

// ============================================================
// stubVerifyTokenApi + stubAuthPermissionsApi — POST-only guards
// ============================================================

describe('Method-only stubs', () => {

    test('stubVerifyTokenApi: POST → 200', async () => {
        const page = makeMockPage();
        await stubs.stubVerifyTokenApi(page);
        const result = await page.invokeHandler(0, 'POST', url('/api/v1/exhibits/verify'));
        expect(result.action).toBe('fulfill');
        expect(result.payload.status).toBe(200);
    });

    test('stubVerifyTokenApi: GET → fallback', async () => {
        const page = makeMockPage();
        await stubs.stubVerifyTokenApi(page);
        const result = await page.invokeHandler(0, 'GET', url('/api/v1/exhibits/verify'));
        expect(result.action).toBe('fallback');
    });

    test('stubAuthPermissionsApi with status:403 → 403 + authorized:false', async () => {
        const page = makeMockPage();
        await stubs.stubAuthPermissionsApi(page, { status: 403 });
        const result = await page.invokeHandler(0, 'POST', url('/auth/permissions'));
        expect(result.payload.status).toBe(403);
        expect(JSON.parse(result.payload.body)).toEqual({ authorized: false });
    });
});
