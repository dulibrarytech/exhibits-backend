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
const TARGET_UUID = 'media-uuid-target';
const KALTURA_UUID = 'media-uuid-kaltura';

// Same lightweight page-deps bundle as media-library-edit.spec.js.
async function stubMediaPageDeps(page) {
    await stubAuthPermissionsApi(page);
    await stubVerifyTokenApi(page);
    await stubExhibitsApi(page, { records: [] });
}

/**
 * Stubs POST /api/v1/media/library/record/:media_id/file (the replace-file
 * endpoint Dropzone posts the multipart body to). Returns a state object
 * capturing hits for assertions.
 */
async function stubReplaceFileApi(page, opts = {}) {
    const status = opts.status ?? 200;
    const body = opts.body ?? {
        success: true,
        message: 'File replaced successfully',
        data: mediaRecordFixture({ uuid: TARGET_UUID, original_filename: 'better-version.jpg' }),
    };

    const state = { postCount: 0, lastUrl: null };

    await page.route('**/api/v1/media/library/record/*/file', async (route) => {
        if (route.request().method() !== 'POST') {
            return route.fallback();
        }
        state.postCount += 1;
        state.lastUrl = route.request().url();
        await route.fulfill({ status, contentType: 'application/json', json: body });
    });

    return state;
}

async function open_media_list(page) {
    const upload_record = mediaRecordFixture({
        uuid: TARGET_UUID,
        name: 'Replaceable image',
        original_filename: 'original.jpg',
        ingest_method: 'upload',
        media_type: 'image',
        mime_type: 'image/jpeg',
    });
    const kaltura_record = mediaRecordFixture({
        uuid: KALTURA_UUID,
        name: 'Kaltura video',
        ingest_method: 'kaltura',
        media_type: 'video',
        mime_type: null,
        thumbnail_path: null,
        kaltura_entry_id: '1_abcdefg',
        kaltura_thumbnail_url: 'https://example.test/kaltura-thumb.jpg',
    });

    const listState = await stubMediaLibraryListApi(page, { records: [upload_record, kaltura_record] });

    await page.goto(`${APP_PATH}/media/library`);
    await expect(page.locator(`a.btn-replace-media[data-uuid="${TARGET_UUID}"]`))
        .toHaveCount(1);

    return { listState };
}

test.describe('Media library replace-file modal (modals.replace.module.js — open_replace_media_modal)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubMediaPageDeps(page);
    });

    test('Replace file appears only on uploaded rows', async ({ page }) => {
        await open_media_list(page);

        await expect(page.locator(`a.btn-replace-media[data-uuid="${TARGET_UUID}"]`)).toHaveCount(1);
        // Repository/Kaltura rows have no local file — no Replace entry.
        await expect(page.locator(`a.btn-replace-media[data-uuid="${KALTURA_UUID}"]`)).toHaveCount(0);
    });

    test('clicking Replace file opens the modal with the current file and an upload zone', async ({ page }) => {
        await open_media_list(page);

        // dispatchEvent('click') reaches the addEventListener handler without
        // needing the Bootstrap dropdown to be visibly open (same rationale as
        // media-library-edit.spec.js).
        await page.locator(`a.btn-replace-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');

        await expect(page.locator('#replace-media-modal')).toBeVisible();
        await expect(page.locator('#replace-media-name')).toHaveText('Replaceable image');
        await expect(page.locator('#replace-media-filename')).toHaveText('original.jpg');
        // Image record → image-only accepted types in the hint.
        await expect(page.locator('#replace-media-type-hint-text')).toContainText('image');
        // The Dropzone attached to the modal zone (dropzone.js stamps the
        // dz-clickable class on successful init).
        await expect(page.locator('#replace-media-dropzone')).toHaveClass(/dz-clickable/);
    });

    test('dropping a file POSTs to the replace endpoint, shows success, and refreshes the list', async ({ page }) => {
        const { listState } = await open_media_list(page);
        const replaceState = await stubReplaceFileApi(page);
        const initial_gets = listState.getCount;

        await page.locator(`a.btn-replace-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#replace-media-modal')).toBeVisible();

        // Dropzone appends its own hidden file input per instance; the modal's
        // zone initializes on open, so its input is the LAST one in the DOM
        // (the Upload Media tab's zone initialized at page load).
        await page.locator('.dz-hidden-input').last().setInputFiles({
            name: 'better-version.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-jpeg-bytes'),
        });

        await expect.poll(() => replaceState.postCount).toBeGreaterThan(0);
        expect(replaceState.lastUrl).toContain(`/api/v1/media/library/record/${TARGET_UUID}/file`);

        // Success message inside the modal, then the list refetches behind it.
        await expect(page.locator('#replace-media-message')).toContainText('Success: File replaced');
        await expect.poll(() => listState.getCount).toBeGreaterThan(initial_gets);

        // The modal auto-closes shortly after success.
        await expect(page.locator('#replace-media-modal')).toBeHidden({ timeout: 10_000 });
    });

    test('a server rejection surfaces the error message and keeps the modal open', async ({ page }) => {
        await open_media_list(page);
        await stubReplaceFileApi(page, {
            status: 400,
            body: { success: false, message: 'Only uploaded media files can be replaced', data: null },
        });

        await page.locator(`a.btn-replace-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#replace-media-modal')).toBeVisible();

        await page.locator('.dz-hidden-input').last().setInputFiles({
            name: 'better-version.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-jpeg-bytes'),
        });

        await expect(page.locator('#replace-media-message')).toContainText('Only uploaded media files can be replaced');
        await expect(page.locator('#replace-media-modal')).toBeVisible();
    });
});
