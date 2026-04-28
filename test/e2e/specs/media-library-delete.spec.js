'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubExhibitsApi,
    stubMediaLibraryListApi,
    stubMediaRecordApi,
    mediaRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const TARGET_UUID = 'media-uuid-target';

// Same lightweight page-deps bundle as the list/edit specs;
// see media-library-list.spec.js for why we don't reuse stubDashboardDeps.
async function stubMediaPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    await stubExhibitsApi(page, { records: [] });
}

// ── Recap of the dropdown-click rule (see media-library-edit.spec.js) ──
//
// `.btn-delete-media` lives inside Bootstrap's `.dropdown-menu` which
// is `display: none` until the toggle fires. `click({ force: true })`
// fails (Playwright still tries to scroll-into-view); the right
// primitive is `dispatchEvent('click')` — visibility-independent and
// the click handler is wired via addEventListener so it triggers
// identically.

async function open_list_with_target_record(page, recordOverrides = {}) {
    const record = mediaRecordFixture({
        uuid: TARGET_UUID,
        name: 'Record to delete',
        original_filename: 'doomed-photo.jpg',
        ingest_method: 'upload',
        media_type: 'image',
        ...recordOverrides,
    });

    const listState = await stubMediaLibraryListApi(page, { records: [record] });
    const recordState = await stubMediaRecordApi(page, { record });

    await page.goto(`${APP_PATH}/media/library`);
    await expect(page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`))
        .toHaveCount(1);

    return { record, listState, recordState };
}

test.describe('Media library delete modal (modals.delete.module.js — open_delete_media_modal / handle_delete_confirm)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubMediaPageDeps(page);
    });

    test('clicking the row Delete dropdown item opens the modal populated with the record name + filename', async ({ page }) => {
        await open_list_with_target_record(page);

        await page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');

        // open_delete_media_modal writes the record's name + filename
        // into the modal via textContent. Scope all assertions to the
        // modal's own IDs to avoid the modal-text-collision pattern
        // documented in media-library-list.spec.js.
        await expect(page.locator('#delete-media-name')).toHaveText('Record to delete');
        await expect(page.locator('#delete-media-filename')).toHaveText('doomed-photo.jpg');

        // The hidden uuid input also gets the value (used as a backup
        // by handle_delete_confirm if current_delete_uuid is lost).
        await expect(page.locator('#delete-media-uuid')).toHaveValue(TARGET_UUID);

        // Confirm + Cancel buttons are in the modal footer; locking
        // the selectors so the next test can rely on them.
        await expect(page.locator('#delete-media-confirm-btn')).toBeVisible();
        await expect(page.locator('#delete-media-cancel-btn')).toBeVisible();
    });

    test('clicking Delete fires DELETE, closes the modal, and refreshes the list', async ({ page }) => {
        const { listState, recordState } = await open_list_with_target_record(page);

        // Sanity: list was fetched once during initial display.
        expect(listState.getCount).toBe(1);

        await page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#delete-media-confirm-btn')).toBeVisible();

        await page.locator('#delete-media-confirm-btn').click();

        // DELETE landed at /api/v1/media/library/record/<uuid>.
        await expect.poll(() => recordState.deleteCount).toBeGreaterThan(0);
        expect(recordState.lastDeleteUrl)
            .toContain(`/api/v1/media/library/record/${TARGET_UUID}`);

        // refresh_media_records re-fetches the list. Polling because
        // the refresh is awaited inside the success callback. Reaching
        // this assertion means the `if (success)` branch in
        // handle_delete_click's callback executed — which is the
        // strongest signal that the success path ran.
        await expect.poll(() => listState.getCount).toBeGreaterThan(1);

        // Modal close fires inside the same success branch (in
        // handle_delete_confirm, before the callback). hide_bootstrap_modal
        // schedules `display: none` after a 150ms timeout, so this
        // poll-based visibility check covers the animation window.
        await expect(page.locator('#delete-media-modal')).not.toBeVisible();

        // ── Why we don't assert on the page-level success alert ──
        //
        // handle_delete_click's success callback writes
        // `<div class="alert alert-success">` into `#message` and
        // *then* awaits refresh_media_records. The refresh's first
        // step (get_media_records) calls `clear_message(message_element)`
        // on a successful list GET — which empties `#message`,
        // clobbering the alert we just wrote, before any assertion
        // can observe it.
        //
        // This is a real UX bug (user sees a flicker, not a
        // confirmation); flagged in the README's quirks. The list
        // refresh + modal close above are sufficient evidence the
        // success path ran.
    });

    test('DELETE failure shows danger alert in modal and re-enables the Delete button', async ({ page }) => {
        const record = mediaRecordFixture({
            uuid: TARGET_UUID,
            name: 'Record to delete',
            original_filename: 'doomed-photo.jpg',
            ingest_method: 'upload',
            media_type: 'image',
        });
        await stubMediaLibraryListApi(page, { records: [record] });
        const recordState = await stubMediaRecordApi(page, {
            record,
            deleteStatus: 403,
        });

        await page.goto(`${APP_PATH}/media/library`);
        await expect(page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`))
            .toHaveCount(1);
        await page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#delete-media-confirm-btn')).toBeVisible();

        await page.locator('#delete-media-confirm-btn').click();

        // DELETE fired but came back 403 → handle_delete_confirm writes
        // the danger alert into the modal's own #delete-media-message
        // (NOT the page-level #message), then re-enables the confirm
        // button so the user can retry / cancel without page reload.
        await expect.poll(() => recordState.deleteCount).toBeGreaterThan(0);
        await expect(page.locator('#delete-media-message .alert-danger'))
            .toBeVisible();
        await expect(page.locator('#delete-media-confirm-btn')).toBeEnabled();
    });
});
