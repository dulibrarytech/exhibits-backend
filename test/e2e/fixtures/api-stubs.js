'use strict';

/**
 * Route-stub conventions for this file:
 *
 *  1. Playwright matches `page.route` handlers in REVERSE registration
 *     order. The last-registered handler that matches wins unless it
 *     calls `route.fallback()`.
 *
 *  2. Every handler that uses a glob with a trailing `**` or matches a
 *     parent path SHOULD method-guard and SHOULD call `route.fallback()`
 *     for the methods/sub-paths it doesn't own. Otherwise a future stub
 *     registered earlier (and therefore matched later) won't get a
 *     chance — see modified-18 for the bug this caused with
 *     `stubExhibitsApi`'s old `**\/api/v1/exhibits**` glob shadowing
 *     `/api/v1/exhibits/verify`.
 *
 *  3. Anchored regexes (e.g. `…/api/v1/exhibits(?:\?.*)?$`) are stronger
 *     than runtime fallback because they never claim the sibling path
 *     in the first place. Prefer anchoring when the stub owns exactly
 *     one URL.
 *
 *  4. When fallback decisions depend on path-tail parsing, ALWAYS strip
 *     the query string first and use a fixed locator (e.g. `/headings`
 *     without a trailing slash) so the create endpoint URL — which has
 *     no `/<id>` segment — is treated the same as the read endpoint.
 *     `path_tail_after(url, '/headings')` below codifies this.
 */

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

function path_tail_after(full_url, marker) {
    const path = full_url.split('?')[0];
    const idx = path.lastIndexOf(marker);
    if (idx === -1) {
        return null;
    }
    return path.slice(idx + marker.length);
}

function exhibitFixture(overrides = {}) {
    return {
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Exhibit',
        description: 'Test description',
        is_published: 0,
        is_featured: 0,
        type: 'standard',
        created: '2026-04-01T00:00:00Z',
        updated: '2026-04-15T00:00:00Z',
        item_count: 3,
        styles: null,
        ...overrides,
    };
}

function headingFixture(overrides = {}) {
    return {
        uuid: 'heading-uuid-1',
        text: 'Sample heading text',
        type: 'heading',
        is_published: 0,
        is_locked: 0,
        locked_by_user: null,
        styles: '',
        order: 1,
        created_by: 'tester',
        created: '2026-04-01T00:00:00Z',
        updated_by: null,
        updated: null,
        ...overrides,
    };
}

function gridItemFixture(overrides = {}) {
    return {
        uuid: 'g1',
        order: 1,
        title: 'Grid item',
        item_type: 'text',
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: 'exhibit-uuid-1',
        is_member_of_grid: 'grid-uuid-1',
        ...overrides,
    };
}

function gridRecordFixture(overrides = {}) {
    return {
        uuid: 'grid-uuid-1',
        title: '',
        text: 'Sample grid text',
        columns: 4,
        is_published: 0,
        styles: '',
        created_by: 'tester',
        created: '2026-04-01T00:00:00Z',
        updated_by: null,
        updated: null,
        ...overrides,
    };
}

function gridItemRecordFixture(overrides = {}) {
    return {
        uuid: 'grid-item-uuid-1',
        title: '',
        text: 'Sample item text',
        item_type: 'text',
        mime_type: 'text/plain',
        is_published: 0,
        is_locked: 0,
        locked_by_user: null,
        layout: 'text_only',
        media_width: 50,
        styles: '{}',
        is_member_of_exhibit: 'exhibit-uuid-1',
        is_member_of_grid: 'grid-uuid-1',
        media_uuid: null,
        thumbnail_media_uuid: null,
        created_by: 'tester',
        created: '2026-04-01T00:00:00Z',
        updated_by: null,
        updated: null,
        ...overrides,
    };
}

function standardItemRecordFixture(overrides = {}) {
    return {
        uuid: 'standard-item-uuid-1',
        text: 'Sample item text',
        item_type: 'text',
        mime_type: 'text/plain',
        is_published: 0,
        is_locked: 0,
        locked_by_user: null,
        layout: 'text_only',
        media_width: 50,
        styles: '{}',
        is_member_of_exhibit: 'exhibit-uuid-1',
        media_uuid: null,
        thumbnail_media_uuid: null,
        pdf_open_to_page: 1,
        created_by: 'tester',
        created: '2026-04-01T00:00:00Z',
        updated_by: null,
        updated: null,
        ...overrides,
    };
}

function timelineRecordFixture(overrides = {}) {
    return {
        uuid: 'timeline-uuid-1',
        title: '',
        text: 'Sample timeline text',
        is_published: 0,
        styles: '',
        created_by: 'tester',
        created: '2026-04-01T00:00:00Z',
        updated_by: null,
        updated: null,
        ...overrides,
    };
}

/**
 * Single timeline-item record shape (what `timeline_item_record.get`
 * returns for edit/details views). Note `date` is a required field
 * (validated against /^\d{4}-\d{2}-\d{2}$/ in the common form module),
 * so the fixture provides a valid value by default.
 */
function timelineItemRecordFixture(overrides = {}) {
    return {
        uuid: 'timeline-item-uuid-1',
        title: '',
        text: 'Sample timeline item text',
        date: '2026-04-15',
        item_type: 'text',
        mime_type: 'text/plain',
        is_published: 0,
        is_locked: 0,
        locked_by_user: null,
        is_embedded: 0,
        styles: '{}',
        is_member_of_exhibit: 'exhibit-uuid-1',
        is_member_of_timeline: 'timeline-uuid-1',
        media_uuid: null,
        thumbnail_media_uuid: null,
        created_by: 'tester',
        created: '2026-04-01T00:00:00Z',
        updated_by: null,
        updated: null,
        ...overrides,
    };
}

/**
 * Media-library record fixture. Defaults to an upload-ingest record.
 * Pass `ingest_method: 'repository'` or `'kaltura'` (plus the
 * variant-specific fields documented inline) to exercise the other
 * two filename-column branches.
 *
 * Wire-format note: media-library records use numeric `is_active`
 * elsewhere in the app, but this list endpoint returns each record
 * verbatim from the model — the columns the renderer actually reads
 * are documented per-line below. The `exhibits` column may be a JSON
 * string OR an array (display_media_records normalizes both shapes);
 * we pass an array because that's the cleaner happy-path.
 */
function mediaRecordFixture(overrides = {}) {
    return {
        uuid: 'media-uuid-1',
        name: 'Sample image',                  // shown in Name column
        original_filename: 'sample.jpg',       // shown in File Name column for upload ingest
        media_type: 'image',
        mime_type: 'image/jpeg',
        ingest_method: 'upload',               // 'upload' | 'repository' | 'kaltura'
        thumbnail_path: '/path/to/thumb.jpg',  // truthy → server-thumbnail branch
        size: 12345,
        created: '2026-04-01T00:00:00Z',
        created_by: 'tester',
        upload_uuid: 'upload-uuid-1',
        repo_uuid: null,
        repo_handle: null,
        kaltura_thumbnail_url: null,
        kaltura_entry_id: null,
        exhibits: [],
        ...overrides,
    };
}

/**
 * Stubs the media-library list endpoint at
 *   GET /api/v1/media/library
 *
 * Wire-format quirk: every media-library response wraps the payload
 * as `{success: true, data: <records>}` — NOT the bare `{data: …}`
 * the rest of the app uses. `display_media_records` literally checks
 * `response.data?.success` before reading `response.data.data`. If you
 * forget the wrap, the list silently shows the empty-state message
 * because the success branch is skipped.
 *
 * Returns a state object capturing GET hits for assertions.
 */
async function stubMediaLibraryListApi(page, opts = {}) {
    const records = opts.records ?? [mediaRecordFixture()];
    const status = opts.status ?? 200;

    const state = {
        getCount: 0,
        lastUrl: null,
    };

    // Anchored regex: claim only the bare list URL (with optional
    // query string), not /api/v1/media/library/record/<id>, /file/<id>,
    // /thumbnail/<id>, /repo/*, /kaltura/*, /duplicate-check, etc.
    // Single-record / variant stubs in later hops register their own
    // routes against those siblings.
    const pattern = new RegExp(`${APP_PATH}/api/v1/media/library(?:\\?.*)?$`);

    await page.route(pattern, (route) => {
        const req = route.request();
        if (req.method() !== 'GET') {
            return route.fallback();
        }
        state.getCount += 1;
        state.lastUrl = req.url();

        if (status === 200) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: records }),
            });
        }
        return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: `HTTP ${status}` }),
        });
    });

    return state;
}

/**
 * Stubs the single-record media-library endpoints:
 *   GET    /api/v1/media/library/record/<media_id>   (open_edit_media_modal)
 *   PUT    /api/v1/media/library/record/<media_id>   (handle_edit_form_submit)
 *   DELETE /api/v1/media/library/record/<media_id>   (handle_delete_confirm)
 *
 * Anchored regex: claims ONLY `…/record/<id>` URLs, leaving sibling
 * paths (`…/file/<id>`, `…/thumbnail/<id>`, `…/repo/*`, `…/kaltura/*`)
 * to their own future stubs.
 *
 * Wire-format quirk: every media-library endpoint wraps its payload as
 * `{success: true, data: {...}}` — bare `{data: {...}}` skips the
 * success branch in `mediaLibraryModule.get_media_record` /
 * `mediaDeleteModalModule.handle_delete_confirm` and the caller treats
 * it as a load/delete failure.
 *
 * Returns a state object capturing GET/PUT/DELETE traffic for assertions.
 */
async function stubMediaRecordApi(page, opts = {}) {
    const record = opts.record ?? mediaRecordFixture();
    const getStatus = opts.getStatus ?? 200;
    const putStatus = opts.putStatus ?? 200;
    const deleteStatus = opts.deleteStatus ?? 200;

    const state = {
        getCount: 0,
        putCount: 0,
        deleteCount: 0,
        lastPutPayload: null,
        lastPutUrl: null,
        lastDeleteUrl: null,
    };

    const pattern = new RegExp(
        `${APP_PATH}/api/v1/media/library/record/[^/?]+(?:\\?.*)?$`
    );

    await page.route(pattern, (route) => {
        const req = route.request();
        const method = req.method();

        if (method === 'GET') {
            state.getCount += 1;
            if (getStatus === 200) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: record }),
                });
            }
            return route.fulfill({
                status: getStatus,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, message: `HTTP ${getStatus}` }),
            });
        }

        if (method === 'PUT') {
            state.putCount += 1;
            state.lastPutPayload = req.postDataJSON();
            state.lastPutUrl = req.url();
            if (putStatus === 200) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        message: 'Media record updated successfully',
                        data: { ...record, ...(state.lastPutPayload || {}) },
                    }),
                });
            }
            return route.fulfill({
                status: putStatus,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, message: `HTTP ${putStatus}` }),
            });
        }

        if (method === 'DELETE') {
            state.deleteCount += 1;
            state.lastDeleteUrl = req.url();
            if (deleteStatus === 200) {
                // The server returns 200 (NOT 204 like the items
                // /api/v1/exhibits/.../items/<id> delete) and the
                // module checks `response.data?.success`. A bare 204
                // with no body would skip the success branch in
                // handle_delete_confirm and surface a generic
                // "Failed to delete" error.
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        message: 'Media record deleted successfully.',
                    }),
                });
            }
            return route.fulfill({
                status: deleteStatus,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, message: `HTTP ${deleteStatus}` }),
            });
        }

        return route.fallback();
    });

    return state;
}

/**
 * Stubs the two metadata endpoints `populate_subjects_dropdowns`
 * fetches in parallel:
 *   GET /api/v1/media/library/repo/subjects        → {success, data: {subjects: {topical, genre_form, geographic}}}
 *   GET /api/v1/media/library/repo/resource-types  → {success, data: {resource_types: [{value, label}]}}
 *
 * The defaults are minimal-but-functional: one Genre/Form value
 * ("Photographs") so the `data-required="true"` widget validation can
 * pass when the fixture record sets `genre_form_subjects: 'Photographs'`
 * (init_multi_select pre-populates the hidden input from data-selected
 * if a matching option exists), plus one resource-type ("image") so
 * the required `select[name="item_type"]` gets a matching option.
 *
 * Override either via opts.subjects / opts.resourceTypes when a test
 * needs different selections.
 */
async function stubRepoMetadataApi(page, opts = {}) {
    const subjects = opts.subjects ?? {
        topical: [],
        genre_form: [{ value: 'Photographs', label: 'Photographs' }],
        geographic: [],
    };
    const resourceTypes = opts.resourceTypes ?? [
        { value: 'image', label: 'Image' },
        { value: 'pdf', label: 'PDF Document' },
    ];

    await page.route(
        new RegExp(`${APP_PATH}/api/v1/media/library/repo/subjects(?:\\?.*)?$`),
        (route) => {
            if (route.request().method() !== 'GET') return route.fallback();
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { subjects },
                }),
            });
        }
    );

    await page.route(
        new RegExp(`${APP_PATH}/api/v1/media/library/repo/resource-types(?:\\?.*)?$`),
        (route) => {
            if (route.request().method() !== 'GET') return route.fallback();
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { resource_types: resourceTypes },
                }),
            });
        }
    );
}

/**
 * Repository search-result fixture. `repo.service.module`'s renderer
 * reads `uuid`, `title`, `abstract` (or `description`), `object_type`
 * (or `type`), `pid`, `handle`, `creator`, `has_children`,
 * `children_count`. Anything else is ignored.
 *
 * The search request also accepts records under several response
 * shapes (`data.data.records`, `data.data`, `data.results`,
 * `data` as bare array). The stub uses the most-common shape:
 * `{success: true, data: {records: [...], total: N}}`.
 */
function repoSearchItemFixture(overrides = {}) {
    return {
        uuid: 'repo-uuid-1',
        title: 'Sample repository item',
        abstract: 'Sample abstract',
        object_type: 'object',
        pid: 'codu:1234',
        handle: 'http://example.com/handle/1',
        creator: 'Sample Creator',
        has_children: false,
        children_count: 0,
        ...overrides,
    };
}

/**
 * Stubs the repository search endpoint:
 *   GET /api/v1/media/library/repo/search?q=<term>
 *
 * Wire-format details:
 *   - Same `{success: true, data: {…}}` envelope as the rest of the
 *     media-library API.
 *   - Module accepts records under `data.data.records`,
 *     `data.data` (array), `data.results`, or bare `data` (array).
 *     This stub uses `data.data.records` — the canonical shape.
 *   - `repo.service.module.search` filters out records where
 *     `object_type === 'collection'` AFTER the response, so the
 *     stub can return collection records to exercise the filter
 *     branch (set `object_type: 'collection'`).
 *
 * Returns a state object capturing the search URL for assertions.
 */
async function stubRepoSearchApi(page, opts = {}) {
    const records = opts.records ?? [repoSearchItemFixture()];
    const status = opts.status ?? 200;

    const state = {
        getCount: 0,
        lastUrl: null,
        lastQuery: null,
    };

    const pattern = new RegExp(
        `${APP_PATH}/api/v1/media/library/repo/search(?:\\?.*)?$`
    );

    await page.route(pattern, (route) => {
        const req = route.request();
        if (req.method() !== 'GET') return route.fallback();

        state.getCount += 1;
        state.lastUrl = req.url();

        try {
            const u = new URL(req.url());
            state.lastQuery = u.searchParams.get('q');
        } catch (_) {
            state.lastQuery = null;
        }

        if (status === 200) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { records, total: records.length },
                }),
            });
        }
        return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: `HTTP ${status}` }),
        });
    });

    return state;
}

/**
 * Stubs the repo thumbnail endpoint (binary image data in production).
 * In tests the response body doesn't actually need to be a valid
 * image — the page only cares whether the request succeeds (200) or
 * fails (the inline `onerror` handler swaps to a placeholder icon).
 *
 * We return a 200 with empty body so the `<img>` doesn't trigger the
 * onerror fallback. The test layout is then deterministic regardless
 * of how the browser handles broken-image rendering.
 */
async function stubRepoThumbnailApi(page) {
    const pattern = new RegExp(
        `${APP_PATH}/api/v1/media/library/repo/thumbnail(?:\\?.*)?$`
    );

    await page.route(pattern, (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        return route.fulfill({
            status: 200,
            contentType: 'image/png',
            body: '',
        });
    });
}

/**
 * Kaltura-entry fixture mirroring the metadata
 * `kaltura.service.module.get_kaltura_media` reads from the response:
 *   - entry_id      → modal hidden `.kaltura-entry-id` input AND
 *                     the "ID:" badge under the modal preview
 *                     (NOTE: the modal does NOT read the typed value
 *                     from `#audio-video`; it reads `data.entry_id`
 *                     from the response payload, so any spec that
 *                     asserts on the modal's hidden entry-id field
 *                     must override this default to match the value
 *                     it types into the search input.)
 *   - title         → modal Name field (pre-populated, required)
 *   - description   → modal Description field
 *   - item_type     → hidden `#kaltura-item-type` input + icon dispatch
 *   - mime_type     → audio/video icon dispatch in modals.kaltura.module
 *   - thumbnail     → show_thumbnail() AND modal preview <img src>
 *   - media_width / media_height / ms_duration → hidden modal fields
 *
 * Defaults to a video entry with a thumbnail URL.
 */
function kalturaEntryFixture(overrides = {}) {
    return {
        entry_id: '0_kaltura1',
        title: 'Sample Kaltura video',
        description: 'Sample Kaltura description',
        item_type: 'video',
        mime_type: 'video/mp4',
        thumbnail: 'https://cdnapisec.kaltura.com/p/0/thumb.jpg',
        media_width: 1280,
        media_height: 720,
        ms_duration: 60000,
        ...overrides,
    };
}

/**
 * Stubs the Kaltura entry-lookup endpoint:
 *   GET /api/v1/media/library/kaltura/<entry_id>
 *
 * Wire-format: `{success: true, data: <metadata>}` — same envelope as
 * the rest of the media-library API. On 200 the module:
 *   1. Sets hidden `#kaltura-item-type` from `data.item_type`.
 *   2. Sets hidden `#is-kaltura-item` to '1'.
 *   3. Calls `show_thumbnail(data.thumbnail, data.title)` (makes
 *      `#kaltura-thumbnail-container` visible).
 *   4. Opens the import modal via
 *      `kalturaModalsModule.open_kaltura_media_modal(data, callback)`.
 *
 * Note: the lookup is preceded by a duplicate-check fetch in the
 * service module — register `stubMediaDuplicateCheckApi` (default
 * exists:false) before this stub, or the lookup short-circuits with
 * a "duplicate" warning before the entry GET fires.
 *
 * Returns a state object capturing GET traffic for assertions.
 */
async function stubKalturaEntryApi(page, opts = {}) {
    const data = opts.data ?? kalturaEntryFixture();
    const status = opts.status ?? 200;

    const state = {
        getCount: 0,
        lastUrl: null,
        lastEntryId: null,
    };

    const pattern = new RegExp(
        `${APP_PATH}/api/v1/media/library/kaltura/[^/?]+(?:\\?.*)?$`
    );

    await page.route(pattern, (route) => {
        const req = route.request();
        if (req.method() !== 'GET') return route.fallback();

        state.getCount += 1;
        state.lastUrl = req.url();

        // Module URL-encodes the entry id into the path. Decode it
        // back so specs can assert on the typed value without
        // worrying about percent-encoding.
        try {
            const path = new URL(req.url()).pathname;
            const tail = path.split('/').filter(Boolean).pop() || '';
            state.lastEntryId = decodeURIComponent(tail);
        } catch (_) {
            state.lastEntryId = null;
        }

        if (status === 200) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data }),
            });
        }
        return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: `HTTP ${status}` }),
        });
    });

    return state;
}

/**
 * Stubs the duplicate-check endpoint:
 *   GET /api/v1/media/library/duplicate-check?field=<field>&value=<v>
 *
 * Called by `repo.service.module`'s `handle_item_selection` (with
 * `field=repo_uuid`) AND by `kaltura.service.module.get_kaltura_media`
 * (with `field=kaltura_entry_id`) BEFORE the entry GET fires. If the
 * response says the record already exists, the calling module aborts
 * the import flow and shows a warning. For happy-path tests, default
 * `exists: false`.
 */
async function stubMediaDuplicateCheckApi(page, opts = {}) {
    const exists = opts.exists ?? false;
    const record = opts.record ?? null;

    const pattern = new RegExp(
        `${APP_PATH}/api/v1/media/library/duplicate-check(?:\\?.*)?$`
    );

    await page.route(pattern, (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: { exists, record },
            }),
        });
    });
}

/**
 * User-record fixture. `id` is numeric (the users table is the only
 * record set in this app that exposes integer ids on the wire — every
 * other record is uuid-keyed). `is_active` is 1/0; `role` is the
 * human-readable label ('Administrator' | 'User' | …) the model joins
 * in for the list view.
 */
function userFixture(overrides = {}) {
    return {
        id: 1,
        first_name: 'Alice',
        last_name: 'Admin',
        email: 'alice@example.com',
        du_id: '1000001',
        role: 'Administrator',
        is_active: 1,
        ...overrides,
    };
}

async function stubExhibitsApi(page, opts = {}) {
    const records = opts.records ?? [exhibitFixture()];
    const pattern = new RegExp(`${APP_PATH}/api/v1/exhibits(?:\\?.*)?$`);

    await page.route(pattern, (route) => {
        const req = route.request();
        if (req.method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: records }),
            });
        }
        if (req.method() === 'POST') {
            return route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ data: { uuid: 'new-exhibit-uuid' } }),
            });
        }
        return route.fallback();
    });
}

async function stubMediaApi(page, opts = {}) {
    const items = opts.items ?? [
        {
            uuid: 'media-uuid-1',
            filename: 'sample.jpg',
            mime_type: 'image/jpeg',
            url: '/exhibits-dashboard/static/test/sample.jpg',
        },
    ];

    await page.route(`**${APP_PATH}/api/v1/media**`, (route) => {
        if (route.request().method() !== 'GET') {
            return route.fallback();
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: items }),
        });
    });
}

async function stubAuthPermissionsApi(page, opts = {}) {
    const status = opts.status ?? 200;

    await page.route(`**${APP_PATH}/auth/permissions`, (route) => {
        if (route.request().method() !== 'POST') {
            return route.fallback();
        }
        return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({ authorized: status === 200 }),
        });
    });
}

async function stubVerifyTokenApi(page, opts = {}) {
    const status = opts.status ?? 200;

    await page.route(`**${APP_PATH}/api/v1/exhibits/verify`, (route) => {
        if (route.request().method() !== 'POST') {
            return route.fallback();
        }
        return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({ verified: status === 200 }),
        });
    });
}

async function stubUserRoleApi(page, opts = {}) {
    const role = opts.role ?? 'User';

    await page.route(`**${APP_PATH}/auth/role**`, (route) => {
        if (route.request().method() !== 'GET') {
            return route.fallback();
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ role }]),
        });
    });
}

/**
 * Stubs the single-exhibit record endpoint:
 *   GET /api/v1/exhibits/<exhibit_id>     (used by set_exhibit_title and
 *                                          edit/details modules to fetch
 *                                          the record)
 *   PUT /api/v1/exhibits/<exhibit_id>     (used by exhibits-edit on save)
 *
 * Returns a state object capturing PUT payloads for spec-side
 * assertions. Tests that only need the GET (most of them — via
 * stubDashboardDeps) can ignore the return value.
 */
async function stubExhibitRecordApi(page, opts = {}) {
    const record = opts.record ?? exhibitFixture({ uuid: opts.exhibitId ?? 'exhibit-uuid-1' });
    const updateStatus = opts.updateStatus ?? 201;

    const state = {
        lastUpdatePayload: null,
        updateCount: 0,
    };

    const pattern = new RegExp(`${APP_PATH}/api/v1/exhibits/[^/?]+(?:\\?.*)?$`);

    await page.route(pattern, (route) => {
        const req = route.request();
        const method = req.method();

        if (method === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: record }),
            });
        }

        if (method === 'PUT') {
            state.updateCount += 1;
            state.lastUpdatePayload = req.postDataJSON();
            return route.fulfill({
                status: updateStatus,
                contentType: 'application/json',
                body: JSON.stringify({ data: { uuid: record.uuid } }),
            });
        }

        return route.fallback();
    });

    return state;
}

/**
 * Stubs GET /api/v1/exhibits/<exhibit_id>/media-library — used by
 * exhibits-edit and exhibits-details modules' load_media_bindings
 * helper. Defaults to an empty array (no bindings); pass {bindings: [...]}
 * to populate. The modules handle null gracefully but a real GET
 * makes the network log cleaner.
 */
async function stubExhibitMediaBindingsApi(page, opts = {}) {
    const bindings = opts.bindings ?? [];

    // Anchor on "/media-library" with optional query string. Don't
    // match longer tails (e.g. /media-library/<media_role>) — those
    // belong to the DELETE handler.
    const pattern = new RegExp(
        `${APP_PATH}/api/v1/exhibits/[^/?]+/media-library(?:\\?.*)?$`
    );

    await page.route(pattern, (route) => {
        if (route.request().method() !== 'GET') {
            return route.fallback();
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: bindings }),
        });
    });
}

async function stubHeadingRecordsApi(page, opts = {}) {
    const exhibitId = opts.exhibitId ?? 'exhibit-uuid-1';
    const record = opts.record ?? headingFixture();
    const createStatus = opts.createStatus ?? 201;
    const updateStatus = opts.updateStatus ?? 201;
    const newItemId = opts.newItemId ?? 'heading-uuid-new';

    const state = {
        lastCreatePayload: null,
        lastUpdatePayload: null,
        createCount: 0,
        updateCount: 0,
    };

    await page.route(`**${APP_PATH}/api/v1/exhibits/${exhibitId}/headings**`, (route) => {
        const req = route.request();
        const method = req.method();

        const tail = path_tail_after(req.url(), '/headings');
        const segments = (tail || '').split('/').filter(Boolean);
        if (segments.length > 1) {
            return route.fallback();
        }

        if (method === 'POST') {
            state.createCount += 1;
            state.lastCreatePayload = req.postDataJSON();
            return route.fulfill({
                status: createStatus,
                contentType: 'application/json',
                body: JSON.stringify({ data: newItemId }),
            });
        }

        if (method === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: record }),
            });
        }

        if (method === 'PUT') {
            state.updateCount += 1;
            state.lastUpdatePayload = req.postDataJSON();
            return route.fulfill({
                status: updateStatus,
                contentType: 'application/json',
                body: JSON.stringify({ data: { uuid: record.uuid } }),
            });
        }

        return route.fallback();
    });

    return state;
}

async function stubGridRecordApi(page, opts = {}) {
    const exhibitId = opts.exhibitId ?? 'exhibit-uuid-1';
    const record = opts.record ?? gridRecordFixture();
    const createStatus = opts.createStatus ?? 201;
    const updateStatus = opts.updateStatus ?? 201;
    const newGridId = opts.newGridId ?? 'grid-uuid-new';

    const state = {
        lastCreatePayload: null,
        lastUpdatePayload: null,
        createCount: 0,
        updateCount: 0,
    };

    await page.route(`**${APP_PATH}/api/v1/exhibits/${exhibitId}/grids**`, (route) => {
        const req = route.request();
        const method = req.method();

        const tail = path_tail_after(req.url(), '/grids');
        const segments = (tail || '').split('/').filter(Boolean);
        if (segments.length > 1) {
            return route.fallback();
        }

        if (method === 'POST') {
            state.createCount += 1;
            state.lastCreatePayload = req.postDataJSON();
            return route.fulfill({
                status: createStatus,
                contentType: 'application/json',
                body: JSON.stringify({ data: newGridId }),
            });
        }

        if (method === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: record }),
            });
        }

        if (method === 'PUT') {
            state.updateCount += 1;
            state.lastUpdatePayload = req.postDataJSON();
            return route.fulfill({
                status: updateStatus,
                contentType: 'application/json',
                body: JSON.stringify({ data: { uuid: record.uuid } }),
            });
        }

        return route.fallback();
    });

    return state;
}

async function stubGridItemsApi(page, opts = {}) {
    const exhibitId = opts.exhibitId ?? 'exhibit-uuid-1';
    const gridId = opts.gridId ?? 'grid-uuid-1';
    const items = opts.items ?? [];

    const state = {
        lastReorderPayload: null,
        reorderCount: 0,
    };

    await page.route(
        `**${APP_PATH}/api/v1/exhibits/${exhibitId}/grids/${gridId}/items**`,
        (route) => {
            const req = route.request();
            if (req.method() !== 'GET') {
                return route.fallback();
            }

            const tail = path_tail_after(req.url(), '/items');
            const segments = (tail || '').split('/').filter(Boolean);
            if (segments.length > 0) {
                return route.fallback();
            }

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: items }),
            });
        }
    );

    await page.route(
        `**${APP_PATH}/api/v1/exhibits/${exhibitId}/items/reorder`,
        (route) => {
            if (route.request().method() !== 'POST') {
                return route.fallback();
            }
            state.reorderCount += 1;
            state.lastReorderPayload = route.request().postDataJSON();
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '{}',
            });
        }
    );

    return state;
}

async function stubGridItemRecordApi(page, opts = {}) {
    const exhibitId = opts.exhibitId ?? 'exhibit-uuid-1';
    const gridId = opts.gridId ?? 'grid-uuid-1';
    const record = opts.record ?? gridItemRecordFixture();
    const createStatus = opts.createStatus ?? 201;
    const updateStatus = opts.updateStatus ?? 201;
    const newItemId = opts.newItemId ?? 'grid-item-uuid-new';

    const state = {
        lastCreatePayload: null,
        lastUpdatePayload: null,
        createCount: 0,
        updateCount: 0,
    };

    await page.route(
        `**${APP_PATH}/api/v1/exhibits/${exhibitId}/grids/${gridId}/items**`,
        (route) => {
            const req = route.request();
            const method = req.method();

            const tail = path_tail_after(req.url(), '/items');
            const segments = (tail || '').split('/').filter(Boolean);

            if (segments.length > 1) {
                return route.fallback();
            }

            if (method === 'POST' && segments.length === 0) {
                state.createCount += 1;
                state.lastCreatePayload = req.postDataJSON();
                return route.fulfill({
                    status: createStatus,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: newItemId }),
                });
            }

            if (method === 'GET' && segments.length === 1) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: record }),
                });
            }

            if (method === 'PUT' && segments.length === 1) {
                state.updateCount += 1;
                state.lastUpdatePayload = req.postDataJSON();
                return route.fulfill({
                    status: updateStatus,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: { uuid: record.uuid } }),
                });
            }

            return route.fallback();
        }
    );

    return state;
}

/**
 * Stubs the mixed-items list page (route /items?exhibit_id=X) routes.
 *
 *   GET  /api/v1/exhibits/<exhibit_id>/items                (list)
 *   POST /api/v1/exhibits/<exhibit_id>/items/reorder        (reorder)
 *
 * Falls through on /items/<id> and /items/<id>/<sub> so the
 * single-record stubs (stubStandardItemApi, etc.) can claim those
 * if they're also installed in the same test.
 *
 * Mirrors stubGridItemsApi — same shape, no /grids/<gid> parent.
 * Returns a state object capturing reorder POST payloads.
 *
 * Fixture caveat: items in the list need `type` set to one of
 * 'item' | 'heading' | 'subheading' | 'grid' | 'vertical_timeline'
 * — items.module.js dispatches to itemsListDisplayModule by that
 * field. Items missing or with unknown `type` get skipped with a
 * console.warn.
 */
async function stubMixedItemsListApi(page, opts = {}) {
    const exhibitId = opts.exhibitId ?? 'exhibit-uuid-1';
    const items = opts.items ?? [];

    const state = {
        lastReorderPayload: null,
        reorderCount: 0,
    };

    await page.route(
        `**${APP_PATH}/api/v1/exhibits/${exhibitId}/items**`,
        (route) => {
            const req = route.request();
            if (req.method() !== 'GET') {
                return route.fallback();
            }

            // Only own the bare list URL (`/items` with optional query
            // string). Nested paths (`/items/<id>`, `/items/reorder`)
            // fall through to the more specific stubs.
            const tail = path_tail_after(req.url(), '/items');
            const segments = (tail || '').split('/').filter(Boolean);
            if (segments.length > 0) {
                return route.fallback();
            }

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: items }),
            });
        }
    );

    await page.route(
        `**${APP_PATH}/api/v1/exhibits/${exhibitId}/items/reorder`,
        (route) => {
            if (route.request().method() !== 'POST') {
                return route.fallback();
            }
            state.reorderCount += 1;
            state.lastReorderPayload = route.request().postDataJSON();
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '{}',
            });
        }
    );

    return state;
}

async function stubStandardItemApi(page, opts = {}) {
    const exhibitId = opts.exhibitId ?? 'exhibit-uuid-1';
    const record = opts.record ?? standardItemRecordFixture();
    const createStatus = opts.createStatus ?? 201;
    const updateStatus = opts.updateStatus ?? 201;
    const newItemId = opts.newItemId ?? 'standard-item-uuid-new';

    const state = {
        lastCreatePayload: null,
        lastUpdatePayload: null,
        createCount: 0,
        updateCount: 0,
    };

    await page.route(
        `**${APP_PATH}/api/v1/exhibits/${exhibitId}/items**`,
        (route) => {
            const req = route.request();
            const method = req.method();

            const tail = path_tail_after(req.url(), '/items');
            const segments = (tail || '').split('/').filter(Boolean);

            if (segments[0] === 'reorder') {
                return route.fallback();
            }

            if (segments.length > 1) {
                return route.fallback();
            }

            if (method === 'POST' && segments.length === 0) {
                state.createCount += 1;
                state.lastCreatePayload = req.postDataJSON();
                return route.fulfill({
                    status: createStatus,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: newItemId }),
                });
            }

            if (method === 'GET' && segments.length === 1) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: record }),
                });
            }

            if (method === 'PUT' && segments.length === 1) {
                state.updateCount += 1;
                state.lastUpdatePayload = req.postDataJSON();
                return route.fulfill({
                    status: updateStatus,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: { uuid: record.uuid } }),
                });
            }

            return route.fallback();
        }
    );

    return state;
}

async function stubTimelineRecordApi(page, opts = {}) {
    const exhibitId = opts.exhibitId ?? 'exhibit-uuid-1';
    const record = opts.record ?? timelineRecordFixture();
    const createStatus = opts.createStatus ?? 201;
    const updateStatus = opts.updateStatus ?? 201;
    const newTimelineId = opts.newTimelineId ?? 'timeline-uuid-new';

    const state = {
        lastCreatePayload: null,
        lastUpdatePayload: null,
        createCount: 0,
        updateCount: 0,
    };

    await page.route(`**${APP_PATH}/api/v1/exhibits/${exhibitId}/timelines**`, (route) => {
        const req = route.request();
        const method = req.method();

        const tail = path_tail_after(req.url(), '/timelines');
        const segments = (tail || '').split('/').filter(Boolean);
        if (segments.length > 1) {
            return route.fallback();
        }

        if (method === 'POST') {
            state.createCount += 1;
            state.lastCreatePayload = req.postDataJSON();
            return route.fulfill({
                status: createStatus,
                contentType: 'application/json',
                body: JSON.stringify({ data: newTimelineId }),
            });
        }

        if (method === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: record }),
            });
        }

        if (method === 'PUT') {
            state.updateCount += 1;
            state.lastUpdatePayload = req.postDataJSON();
            return route.fulfill({
                status: updateStatus,
                contentType: 'application/json',
                body: JSON.stringify({ data: { uuid: record.uuid } }),
            });
        }

        return route.fallback();
    });

    return state;
}

/**
 * Stubs CRUD endpoints for a single timeline item record.
 *
 * Owned URL shapes:
 *   POST /…/<exhibit_id>/timelines/<tid>/items              (create, tail = '')
 *   GET  /…/<exhibit_id>/timelines/<tid>/items/<item_id>?…  (single, tail = '/<id>')
 *   PUT  /…/<exhibit_id>/timelines/<tid>/items/<item_id>    (update, tail = '/<id>')
 * Falls through on:
 *   /…/items/<id>/<sub>                                     (publish/suppress, future)
 *
 * Almost a mirror of stubGridItemRecordApi (different parent path), but
 * the GET response shape DIVERGES:
 *
 *   {data: {item: <record>}}    ← timeline-item edit + details modules
 *   {data: <record>}            ← every other module set
 *
 * Both `items.edit.vertical.timeline.item.form.module.js:455` and
 * `items.details.vertical.timeline.item.module.js:212` do
 * `if (!data || !data.item) { throw … }; const record = data.item;`
 * — they unwrap a `.item` key that no other module's response carries.
 * This stub matches the irregular shape on GET; POST and PUT keep the
 * standard shapes (those code paths don't unwrap).
 */
async function stubTimelineItemApi(page, opts = {}) {
    const exhibitId = opts.exhibitId ?? 'exhibit-uuid-1';
    const timelineId = opts.timelineId ?? 'timeline-uuid-1';
    const record = opts.record ?? timelineItemRecordFixture();
    const createStatus = opts.createStatus ?? 201;
    const updateStatus = opts.updateStatus ?? 201;
    const newItemId = opts.newItemId ?? 'timeline-item-uuid-new';

    const state = {
        lastCreatePayload: null,
        lastUpdatePayload: null,
        createCount: 0,
        updateCount: 0,
    };

    await page.route(
        `**${APP_PATH}/api/v1/exhibits/${exhibitId}/timelines/${timelineId}/items**`,
        (route) => {
            const req = route.request();
            const method = req.method();

            const tail = path_tail_after(req.url(), '/items');
            const segments = (tail || '').split('/').filter(Boolean);

            if (segments.length > 1) {
                return route.fallback();
            }

            if (method === 'POST' && segments.length === 0) {
                state.createCount += 1;
                state.lastCreatePayload = req.postDataJSON();
                return route.fulfill({
                    status: createStatus,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: newItemId }),
                });
            }

            if (method === 'GET' && segments.length === 1) {
                // Note the {item: record} wrapper — see header comment.
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: { item: record } }),
                });
            }

            if (method === 'PUT' && segments.length === 1) {
                state.updateCount += 1;
                state.lastUpdatePayload = req.postDataJSON();
                return route.fulfill({
                    status: updateStatus,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: { uuid: record.uuid } }),
                });
            }

            return route.fallback();
        }
    );

    return state;
}

/**
 * Stubs every URL the user-administration pages talk to under
 * `/api/v1/users`:
 *
 *   GET    /api/v1/users                       (list)
 *   POST   /api/v1/users                       (save_user_record)
 *   GET    /api/v1/users/<user_id>             (display_user_record / display_user)
 *   PUT    /api/v1/users/<user_id>             (update_user_record)
 *   DELETE /api/v1/users/<user_id>             (delete_user)
 *   PUT    /api/v1/users/status/<id>/<active>  (status toggle)
 *
 * Wire-format quirks worth knowing (this module set diverges from
 * every other one):
 *
 *   - List GET returns the array DIRECTLY (no `{data: …}` wrapper).
 *     `get_user_records` returns `response.data` and the caller
 *     does `Array.isArray(users)` — so the body must be an array.
 *
 *   - Single GET returns an array containing one user `[{…}]`. Both
 *     the edit module (`record[record.length - 1]`) and the delete
 *     EJS (`user[0]`) index into it. The model returns it that way
 *     in production; controllers `res.json(response.data)` it through
 *     unmodified.
 *
 *   - POST save returns `{user: {data: {id: <int>}}}` — three layers
 *     deep. user.module.js literally reads
 *     `response.data.user.data.id` to redirect to the new edit page.
 *     If you change the wrap shape, the new-user redirect breaks.
 *
 *   - DELETE returns 204 with no body.
 *   - Status PUT returns 200; user.module.js only checks the status
 *     code, body is unused.
 *
 * Returns a state object so specs can assert on POST/PUT/DELETE
 * traffic without re-registering inline routes.
 */
async function stubUsersApi(page, opts = {}) {
    const users = opts.users ?? [userFixture()];
    const record = opts.record ?? users[0] ?? userFixture();
    const listStatus = opts.listStatus ?? 200;
    const recordStatus = opts.recordStatus ?? 200;
    const updateStatus = opts.updateStatus ?? 201;
    const createStatus = opts.createStatus ?? 201;
    const deleteStatus = opts.deleteStatus ?? 204;
    const statusUpdateStatus = opts.statusUpdateStatus ?? 200;
    const newUserId = opts.newUserId ?? 99;

    const state = {
        lastCreatePayload: null,
        lastUpdatePayload: null,
        lastDeleteUrl: null,
        lastStatusUrl: null,
        createCount: 0,
        updateCount: 0,
        deleteCount: 0,
        statusCount: 0,
    };

    await page.route(`**${APP_PATH}/api/v1/users**`, (route) => {
        const req = route.request();
        const method = req.method();

        const tail = path_tail_after(req.url(), '/api/v1/users');
        const segments = (tail || '').split('/').filter(Boolean);

        // PUT /api/v1/users/status/<id>/<is_active>
        if (segments[0] === 'status') {
            if (method !== 'PUT') return route.fallback();
            state.statusCount += 1;
            state.lastStatusUrl = req.url();
            return route.fulfill({
                status: statusUpdateStatus,
                contentType: 'application/json',
                body: '{}',
            });
        }

        // /api/v1/users (list / create)
        if (segments.length === 0) {
            if (method === 'GET') {
                return route.fulfill({
                    status: listStatus,
                    contentType: 'application/json',
                    // Note: raw array — no `{data: …}` wrap. See header.
                    body: JSON.stringify(listStatus === 200 ? users : { message: 'Forbidden' }),
                });
            }
            if (method === 'POST') {
                state.createCount += 1;
                state.lastCreatePayload = req.postDataJSON();
                return route.fulfill({
                    status: createStatus,
                    contentType: 'application/json',
                    // Note: triple-nested {user:{data:{id:N}}}. See header.
                    body: JSON.stringify({
                        message: 'User created successfully.',
                        user: { data: { id: newUserId } },
                    }),
                });
            }
            return route.fallback();
        }

        // /api/v1/users/<user_id>
        if (segments.length === 1) {
            if (method === 'GET') {
                return route.fulfill({
                    status: recordStatus,
                    contentType: 'application/json',
                    // Note: array wrap (single-element). See header.
                    body: JSON.stringify(recordStatus === 200 ? [record] : { message: 'Not found' }),
                });
            }
            if (method === 'PUT') {
                state.updateCount += 1;
                state.lastUpdatePayload = req.postDataJSON();
                return route.fulfill({
                    status: updateStatus,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'User updated successfully.',
                        user: { data: { id: Number(segments[0]) } },
                    }),
                });
            }
            if (method === 'DELETE') {
                state.deleteCount += 1;
                state.lastDeleteUrl = req.url();
                return route.fulfill({
                    status: deleteStatus,
                    contentType: 'application/json',
                    body: '',
                });
            }
            return route.fallback();
        }

        return route.fallback();
    });

    return state;
}

/**
 * Stubs `GET /exhibits-dashboard/auth/roles` (plural) — used by
 * `userModule.list_roles` to populate the role dropdown.
 *
 * IMPORTANT: must be registered AFTER `stubUserRoleApi` (or
 * `stubDashboardDeps`, which calls it). `stubUserRoleApi`'s pattern
 * is `**\/auth/role**` which also matches `/auth/roles` — Playwright
 * matches handlers in REVERSE registration order, so the later
 * `stubAuthRolesApi` registration wins. If you call it first, the
 * `/auth/role**` glob shadows it and the dropdown gets a malformed
 * single-role array (`[{role:'User'}]`) with no `id` and `list_roles`
 * silently drops every entry.
 */
async function stubAuthRolesApi(page, opts = {}) {
    const roles = opts.roles ?? [
        { id: 1, role: 'Administrator' },
        { id: 2, role: 'User' },
    ];

    const pattern = new RegExp(`${APP_PATH}/auth/roles(?:\\?.*)?$`);

    await page.route(pattern, (route) => {
        if (route.request().method() !== 'GET') {
            return route.fallback();
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(roles),
        });
    });
}

/**
 * Bundle of dashboard-page bootstrap stubs. Returns the state object
 * from stubExhibitRecordApi so specs can capture PUT payloads when
 * exercising the exhibits-edit form.
 */
async function stubDashboardDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    await stubUserRoleApi(page, opts.role);
    return stubExhibitRecordApi(page, opts.exhibit);
}

const stubHeadingPageDeps = stubDashboardDeps;

module.exports = {
    stubExhibitsApi,
    stubMediaApi,
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubUserRoleApi,
    stubExhibitRecordApi,
    stubExhibitMediaBindingsApi,
    stubHeadingRecordsApi,
    stubGridRecordApi,
    stubGridItemsApi,
    stubMixedItemsListApi,
    stubGridItemRecordApi,
    stubStandardItemApi,
    stubTimelineRecordApi,
    stubTimelineItemApi,
    stubUsersApi,
    stubAuthRolesApi,
    stubDashboardDeps,
    stubHeadingPageDeps,
    exhibitFixture,
    headingFixture,
    gridItemFixture,
    gridRecordFixture,
    gridItemRecordFixture,
    standardItemRecordFixture,
    timelineRecordFixture,
    timelineItemRecordFixture,
    userFixture,
    mediaRecordFixture,
    stubMediaLibraryListApi,
    stubMediaRecordApi,
    stubRepoMetadataApi,
    repoSearchItemFixture,
    stubRepoSearchApi,
    stubRepoThumbnailApi,
    stubMediaDuplicateCheckApi,
    kalturaEntryFixture,
    stubKalturaEntryApi,
};
