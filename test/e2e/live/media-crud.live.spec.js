'use strict';

/**
 * LIVE media library CRUD — upload / update / delete against the real stack.
 *
 * Upload is FULLY real: a fixture PNG goes through Dropzone -> the real upload
 * endpoint (multer + sharp thumbnail on disk under STORAGE_PATH) -> the
 * uploaded-media form -> POST media record -> MySQL. The test then asserts the
 * generated thumbnail actually serves — the whole pipeline, no stubs.
 *
 * Subjects note: the Topics/Genre vocab is repository(ES)-backed; specs set the
 * widgets' hidden inputs (the same place the save-gate and payload read) with
 * explicit values so these tests don't depend on the external vocab.
 */

const path = require('path');
const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const { setSubjectsWidget, ensureSelectValue, fillIfPresent } = require('./fixtures/live-ui');
const {
    APP_PATH,
    apiCreateMediaRecord,
    apiFindMediaByName,
    apiDeleteMediaRecord
} = require('./fixtures/live-api');

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'assets', 'pw-e2e-image.png');

test.describe('Media library CRUD (live)', () => {

    let media_uuid = null;

    test.beforeEach(async ({ context, page }) => {
        await loginAs(context, page, 'administrator');
    });

    test.afterEach(async ({ request }) => {
        await apiDeleteMediaRecord(request, media_uuid);
        media_uuid = null;
    });

    test('uploads an image through Dropzone and saves the media record', async ({ page, request }) => {

        const marker = `pw3-upload-${Date.now()}-${test.info().workerIndex}`;

        await page.goto(`${APP_PATH}/media/library`);
        await page.click('#upload-media-tab');

        // Dropzone posts the file to the real upload endpoint as soon as it is
        // added (autoProcessQueue) — sharp writes the thumbnail on disk.
        const upload_response = page.waitForResponse((resp) =>
            resp.url().includes('/media/library/uploads')
            && resp.request().method() === 'POST'
        );

        await page.setInputFiles('#item-dropzone .dz-hidden-input, .dz-hidden-input', FIXTURE_IMAGE);

        expect([200, 201]).toContain((await upload_response).status());

        // queuecomplete opens the uploaded-media form modal (the footer Done
        // button stays hidden until every card is saved).
        await expect(page.locator('#uploaded-media-modal')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('.btn-save-file[data-file-index="0"]')).toBeVisible();

        // Fill the per-file card: Name, Alt Text (required for images), the
        // required Subjects widgets, and Item Type (auto-populated from the
        // media type — ensured non-empty).
        await page.fill('#file-name-0', marker);
        await fillIfPresent(page, '#file-alt-text-0', 'PW live upload fixture image');
        await setSubjectsWidget(page, '#uploaded-media-modal', 'topics_subjects', 'PW Topic');
        await setSubjectsWidget(page, '#uploaded-media-modal', 'genre_form_subjects', 'PW Genre');
        await ensureSelectValue(page, '#file-item-type-0');

        // Each card saves individually (the footer Done button only appears
        // once every file is saved) — the card Save fires the record POST.
        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/media/library`
                && resp.request().method() === 'POST';
        });

        await page.click('.btn-save-file[data-file-index="0"]');
        expect((await create_response).status()).toBe(201);

        // All files saved -> Done appears; close the modal like a user would.
        await page.click('#uploaded-media-done-btn');

        // Persisted with the real storage artifacts.
        const record = await apiFindMediaByName(request, marker);
        expect(record).not.toBeNull();
        media_uuid = record.uuid;
        expect(record.ingest_method).toBe('upload');
        expect(record.storage_path).toBeTruthy();

        // The sharp-generated thumbnail actually serves from disk.
        const thumb = await request.get(
            `${APP_PATH}/api/v1/media/library/thumbnail/${media_uuid}`,
            { headers: { 'x-access-token': require('./fixtures/live-api').role_auth('administrator').token } }
        );
        expect(thumb.status()).toBe(200);
    });

    test('updates a media record through the edit modal', async ({ page, request }) => {

        const original = `pw3-media-edit-${Date.now()}-${test.info().workerIndex}`;
        const updated = `${original}-updated`;
        media_uuid = await apiCreateMediaRecord(request, original);

        await page.goto(`${APP_PATH}/media/library`);

        // Open the row's Actions dropdown, then Edit.
        const row = page.locator('#items tbody tr', { hasText: original });
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.locator('.media-actions-toggle').click();
        await page.locator(`.btn-edit-media[data-uuid="${media_uuid}"]`).click();

        // Modal loads the real record.
        const name_input = page.locator('#edit-file-name');
        await expect(name_input).toHaveValue(original, { timeout: 15_000 });

        await name_input.fill(updated);
        // Genre/Form + Item Type gate the save on the edit form too.
        await setSubjectsWidget(page, '#edit-media-modal', 'genre_form_subjects', 'PW Genre');
        await ensureSelectValue(page, '#edit-file-item-type');

        const put_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/media/library/record/${media_uuid}`
                && resp.request().method() === 'PUT';
        });

        await page.click('#edit-media-save-btn');
        expect([200, 201, 204]).toContain((await put_response).status());

        const record = await apiFindMediaByName(request, updated);
        expect(record).not.toBeNull();
        expect(record.uuid).toBe(media_uuid);
    });

    test('deletes a media record through the delete confirmation modal', async ({ page, request }) => {

        const marker = `pw3-media-delete-${Date.now()}-${test.info().workerIndex}`;
        media_uuid = await apiCreateMediaRecord(request, marker);

        await page.goto(`${APP_PATH}/media/library`);

        const row = page.locator('#items tbody tr', { hasText: marker });
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.locator('.media-actions-toggle').click();
        await page.locator(`.btn-delete-media[data-uuid="${media_uuid}"]`).click();

        await expect(page.locator('#delete-media-confirm-btn')).toBeEnabled({ timeout: 10_000 });

        const delete_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/media/library/record/${media_uuid}`
                && resp.request().method() === 'DELETE';
        });

        await page.click('#delete-media-confirm-btn');
        expect([200, 204]).toContain((await delete_response).status());

        // Soft-deleted: no longer served by the API.
        const gone = await apiFindMediaByName(request, marker);
        expect(gone).toBeNull();
        media_uuid = null; // already deleted
    });
});
