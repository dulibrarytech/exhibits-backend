'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubExhibitsApi,
    stubMediaLibraryListApi,
    stubRepoMetadataApi,
} = require('../fixtures/api-stubs');
const { setSubjectsWidget, ensureSelectValue } = require('../live/fixtures/live-ui');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const ORIGINAL_NAME = 'IMG_1234_final-v2.png';
const IMAGE_BUFFER = fs.readFileSync(path.join(__dirname, '../live/fixtures/assets/pw-e2e-image.png'));
const SAVE_BUTTON = '.btn-save-file[data-file-index="0"]';

async function stubUploadApi(page) {
    await page.route(new RegExp(`${APP_PATH}/media/library/uploads(?:\\?.*)?$`), (route) => {
        if (route.request().method() !== 'POST') {
            return route.fallback();
        }
        return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                files: [{
                    uuid: 'staged-uuid-1',
                    filename: 'staged-uuid-1.png',
                    mime_type: 'image/png',
                    media_type: 'image',
                    storage_path: '2026/11/staged-uuid-1.png',
                    thumbnail_path: '',
                    file_size: IMAGE_BUFFER.length,
                }],
            }),
        });
    });
}

async function stubCreateRecordApi(page) {
    const state = { postCount: 0, lastPayload: null };

    await page.route(new RegExp(`${APP_PATH}/api/v1/media/library(?:\\?.*)?$`), (route) => {
        if (route.request().method() !== 'POST') {
            return route.fallback();
        }
        state.postCount += 1;
        state.lastPayload = route.request().postDataJSON();
        return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, message: 'Media record created successfully.', data: 1 }),
        });
    });

    return state;
}

async function upload_file(page) {
    await page.goto(`${APP_PATH}/media/library`);
    await page.click('#upload-media-tab');
    await page.setInputFiles('.dz-hidden-input', {
        name: ORIGINAL_NAME,
        mimeType: 'image/png',
        buffer: IMAGE_BUFFER,
    });
    await expect(page.locator('#uploaded-media-modal')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SAVE_BUTTON)).toBeVisible();
}

async function complete_other_required_fields(page) {
    await page.fill('#file-alt-text-0', 'Train station at dusk');
    await page.fill('#file-description-0-rte .ql-editor', 'Description');
    await setSubjectsWidget(page, '#uploaded-media-modal', 'topics_subjects', 'Railroads');
    await setSubjectsWidget(page, '#uploaded-media-modal', 'genre_form_subjects', 'Photographs');
    await ensureSelectValue(page, '#file-item-type-0');
}

test.describe('Media library upload modal (modals.upload.module.js — Name field)', () => {

    let record_state;

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubAuthPermissionsApi(page);
        await stubVerifyTokenApi(page);
        await stubExhibitsApi(page, { records: [] });
        await stubMediaLibraryListApi(page, { records: [] });
        await stubRepoMetadataApi(page);
        await stubUploadApi(page);
        record_state = await stubCreateRecordApi(page);
    });

    test('Name starts blank and the filename stays on the card', async ({ page }) => {
        await upload_file(page);

        await expect(page.locator('#file-name-0')).toHaveValue('');
        await expect(page.locator('#file-name-0')).toHaveAttribute('placeholder', 'Enter a name');
        await expect(page.locator('.file-form-title')).toHaveText(ORIGINAL_NAME);
        await expect(page.locator('.file-name-display')).toHaveText(ORIGINAL_NAME);
        await expect(page.locator('.file-original-filename')).toHaveValue(ORIGINAL_NAME);
    });

    test('Save is blocked while Name is blank or only spaces', async ({ page }) => {
        await upload_file(page);
        await complete_other_required_fields(page);
        const feedback = page.locator('#file-name-0 ~ .invalid-feedback');

        await page.click(SAVE_BUTTON);
        await expect(feedback).toBeVisible();
        await expect(feedback).toHaveText('Please provide a name.');
        expect(record_state.postCount).toBe(0);

        await page.fill('#file-name-0', '   ');
        await page.click(SAVE_BUTTON);
        await expect(page.locator('#file-name-0')).toHaveValue('');
        await expect(feedback).toBeVisible();
        expect(record_state.postCount).toBe(0);
    });

    test('a blocked Save brings the empty Name into view on a laptop-sized window', async ({ page }) => {
        await page.setViewportSize({ width: 1536, height: 730 });
        await upload_file(page);
        await complete_other_required_fields(page);

        await page.click(SAVE_BUTTON);

        await expect(page.locator('#file-name-0')).toBeFocused();
        await expect(page.locator('#file-name-0 ~ .invalid-feedback')).toBeInViewport();
        expect(record_state.postCount).toBe(0);
    });

    test('Save posts the typed Name, trimmed, with the filename kept apart', async ({ page }) => {
        await upload_file(page);
        await complete_other_required_fields(page);

        await page.fill('#file-name-0', '  Union Station  ');
        await page.click(SAVE_BUTTON);

        await expect.poll(() => record_state.postCount).toBe(1);
        expect(record_state.lastPayload).toMatchObject({
            name: 'Union Station',
            original_filename: ORIGINAL_NAME,
        });
    });
});
