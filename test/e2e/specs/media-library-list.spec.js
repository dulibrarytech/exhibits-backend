'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubExhibitsApi,
    stubMediaLibraryListApi,
    mediaRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

// The media-library page boots through a different chain than the
// per-exhibit dashboard pages: mediaLibraryModule.init runs
// authModule.check_auth (POST /api/v1/exhibits/verify), then
// display_media_records (GET /api/v1/media/library), then the
// exhibit-titles fetch for the filter dropdown
// (GET /api/v1/exhibits). No single-exhibit GET, no permissions
// check — so we don't reuse stubDashboardDeps; the three small stubs
// below are exactly what the page touches on the happy path.
async function stubMediaPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    // The exhibit-titles fetch for the filter dropdown is best-effort:
    // the module catches any failure and just hides the filter. Stub
    // with an empty list to keep the console clean and avoid the
    // network-error retry path.
    await stubExhibitsApi(page, { records: [] });
}

// ── Why we scope every assertion to #media-data (and avoid getByText) ──
//
// dashboard-media-home.ejs pre-renders SEVEN modal partials at the
// bottom of the page (upload-review, repo-import, Kaltura-import,
// edit, delete, upload-view, Kaltura-view). The DOM nodes are present
// from page load — just hidden. Their body copy contains many of the
// strings test fixtures naturally use:
//   - "Import Repository Media" / "Repository Items Selected" / etc.
//     all match a regex like /repository/i AND match a substring like
//     "a repository item" under Playwright's whitespace-normalized
//     getByText matching.
//   - "Kaltura media" appears 5+ times across Kaltura modals.
//
// An earlier draft of this spec used `getByText('A repository item')`
// and `getByText(/Kaltura media/)`; both failed with strict-mode
// violations because Playwright matched the modal content alongside
// the data row.
//
// Scoping every assertion to `#media-data` (the list tbody) or to
// classes that only the list renderer emits (`small.media-filename`,
// `a.btn-edit-media[data-uuid=…]`) avoids the collision entirely and
// is also viewport-independent (DataTable column widths don't matter
// when the assertion targets DOM presence rather than text rendering).

test.describe('Media library list page (media.library.module.js — display_media_records)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubMediaPageDeps(page);
    });

    test('renders mixed-ingest records with the correct row count', async ({ page }) => {
        await stubMediaLibraryListApi(page, {
            records: [
                mediaRecordFixture({
                    uuid: 'm-1',
                    name: 'An uploaded image',
                    original_filename: 'photo.jpg',
                    ingest_method: 'upload',
                    media_type: 'image',
                }),
                mediaRecordFixture({
                    uuid: 'm-2',
                    name: 'A repository item',
                    original_filename: null,
                    ingest_method: 'repository',
                    repo_uuid: 'repo-uuid-1',
                    repo_handle: 'http://example.com/handle/1',
                    media_type: 'object',
                }),
                mediaRecordFixture({
                    uuid: 'm-3',
                    name: 'A Kaltura clip',
                    original_filename: null,
                    ingest_method: 'kaltura',
                    kaltura_entry_id: 'entry-1',
                    kaltura_thumbnail_url: 'https://cdnapisec.kaltura.com/thumb.jpg',
                    media_type: 'video',
                    mime_type: 'video/mp4',
                }),
            ],
        });

        await page.goto(`${APP_PATH}/media/library`);

        // One edit button per record by construction (build_actions_html
        // emits exactly one `.btn-edit-media[data-uuid=<uuid>]` per row).
        // Count of edit buttons == count of data rows, regardless of
        // any responsive auxiliary rows the DataTable plugin may inject.
        await expect(page.locator('a.btn-edit-media')).toHaveCount(3);
        await expect(page.locator('a.btn-edit-media[data-uuid="m-1"]')).toHaveCount(1);
        await expect(page.locator('a.btn-edit-media[data-uuid="m-2"]')).toHaveCount(1);
        await expect(page.locator('a.btn-edit-media[data-uuid="m-3"]')).toHaveCount(1);
    });

    test('renders the three filename-column variants per ingest method', async ({ page }) => {
        await stubMediaLibraryListApi(page, {
            records: [
                mediaRecordFixture({
                    uuid: 'u-1',
                    name: 'Upload row',
                    original_filename: 'unique-upload-filename.jpg',
                    ingest_method: 'upload',
                }),
                mediaRecordFixture({
                    uuid: 'r-1',
                    name: 'Repo row',
                    original_filename: null,
                    ingest_method: 'repository',
                    repo_uuid: 'repo-uuid-1',
                }),
                mediaRecordFixture({
                    uuid: 'k-1',
                    name: 'Kaltura row',
                    original_filename: null,
                    ingest_method: 'kaltura',
                    kaltura_entry_id: 'entry-1',
                    media_type: 'video',
                    mime_type: 'video/mp4',
                }),
            ],
        });

        await page.goto(`${APP_PATH}/media/library`);
        // Wait for render to complete via the per-row contract.
        await expect(page.locator('a.btn-edit-media')).toHaveCount(3);

        // Upload variant: literal filename rendered inside
        // <small.media-filename>. Use locator-count rather than visibility
        // — the cell content may be collapsed by responsive mode but is
        // still in the DOM.
        await expect(
            page.locator('small.media-filename', { hasText: 'unique-upload-filename.jpg' })
        ).toHaveCount(1);

        // Repository variant: hard-coded "Repository media" label with
        // a unique fa-database icon (only emitted by the repo branch).
        // Counting the icon is the cleanest viewport-independent signal
        // that the repo branch ran.
        await expect(page.locator('#media-data .fa-database')).toHaveCount(1);

        // Kaltura variant: hard-coded "Kaltura media" label. The icon
        // swaps based on mime_type — fa-volume-up for audio, fa-film
        // for video. We seeded video/mp4, so fa-film should appear
        // exactly once.
        await expect(page.locator('#media-data .fa-film')).toHaveCount(1);
    });

    test('shows the DataTable empty-state when the API returns no records', async ({ page }) => {
        await stubMediaLibraryListApi(page, { records: [] });

        await page.goto(`${APP_PATH}/media/library`);

        // `language.emptyTable` configured on the DataTable.
        await expect(page.locator('#items')).toContainText(
            'No media files found in the library'
        );
    });

    test('shows permission-denied alert when the list endpoint returns 403', async ({ page }) => {
        await stubMediaLibraryListApi(page, { status: 403 });

        await page.goto(`${APP_PATH}/media/library`);

        // get_media_records writes the alert into #message and returns
        // false; display_media_records short-circuits without
        // initializing the DataTable.
        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission to view media records/i
        );
    });

    test('renders the action dropdown on each row with edit/delete and Play for Kaltura', async ({ page }) => {
        await stubMediaLibraryListApi(page, {
            records: [
                mediaRecordFixture({
                    uuid: 'u-1',
                    name: 'Upload',
                    ingest_method: 'upload',
                }),
                mediaRecordFixture({
                    uuid: 'k-1',
                    name: 'Kaltura',
                    original_filename: null,
                    ingest_method: 'kaltura',
                    kaltura_entry_id: 'entry-99',
                    media_type: 'video',
                    mime_type: 'video/mp4',
                }),
            ],
        });

        await page.goto(`${APP_PATH}/media/library`);

        // Every row gets an edit + delete dropdown item with the row uuid
        // wired into the data-uuid attribute (the modals later read it
        // via this attribute — locking it down here means the modal hops
        // can rely on the contract).
        await expect(page.locator('a.btn-edit-media[data-uuid="u-1"]')).toHaveCount(1);
        await expect(page.locator('a.btn-delete-media[data-uuid="u-1"]')).toHaveCount(1);
        await expect(page.locator('a.btn-edit-media[data-uuid="k-1"]')).toHaveCount(1);
        await expect(page.locator('a.btn-delete-media[data-uuid="k-1"]')).toHaveCount(1);

        // Only Kaltura rows get the Play action item; upload rows don't.
        await expect(page.locator('a.btn-play-kaltura[data-uuid="k-1"]')).toHaveCount(1);
        await expect(page.locator('a.btn-play-kaltura[data-uuid="u-1"]')).toHaveCount(0);
    });
});
