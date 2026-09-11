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

        // Page-level success alert persists through the post-delete
        // refresh. get_media_records used to call clear_message()
        // unconditionally on a successful list GET, wiping the alert
        // before the user could see it. The fix preserves any
        // alert-success / alert-info already present in #message so
        // the 3-second setTimeout clear can run as intended.
        await expect(page.locator('#message .alert-success')).toBeVisible();
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

    test('409 in-use refusal locks the modal: warning shown, Delete disabled, record kept', async ({ page }) => {
        // The backend refuses to soft-delete media that an item or exhibit
        // still binds (media-library/model.js in-use guard) and answers 409
        // with a staff-facing message naming the dependents. The modal must
        // surface that message as a warning (not a failure), drop the
        // "are you sure / cannot be undone" prompt, and DISABLE Delete for
        // good — a retry cannot succeed until the record is unbound — leaving
        // only Cancel/close. A fresh open starts from the confirm state again.
        const record = mediaRecordFixture({
            uuid: TARGET_UUID,
            name: 'El Corno Emplumado 5',
            original_filename: 'el-corno-5.pdf',
            ingest_method: 'upload',
            media_type: 'pdf',
        });
        const in_use_message = 'This media is still in use and cannot be deleted. '
            + 'It is used by "Latinx Poetry": 3 items. '
            + 'Select different media for those items (or remove it from them) first, then delete it.';
        await stubMediaLibraryListApi(page, { records: [record] });
        const recordState = await stubMediaRecordApi(page, {
            record,
            deleteStatus: 409,
            deleteBody: {
                success: false,
                message: in_use_message,
                data: { in_use: true, references: [{ record_type: 'item', role: 'media', uuid: 'a676c5bb' }] },
            },
        });

        await page.goto(`${APP_PATH}/media/library`);
        await page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#delete-media-confirm-btn')).toBeVisible();

        await page.locator('#delete-media-confirm-btn').click();

        await expect.poll(() => recordState.deleteCount).toBe(1);
        const alert = page.locator('#delete-media-message .alert-warning');
        await expect(alert).toBeVisible();
        await expect(alert).toContainText('"Latinx Poetry": 3 items');
        await expect(page.locator('#delete-media-message .alert-danger')).toHaveCount(0);

        // Locked: modal open, Delete disabled (attribute + aria), prompt and
        // irreversibility notice hidden, the record card still identifies it
        await expect(page.locator('#delete-media-modal')).toBeVisible();
        const confirm_btn = page.locator('#delete-media-confirm-btn');
        await expect(confirm_btn).toBeDisabled();
        await expect(confirm_btn).toHaveAttribute('aria-disabled', 'true');
        await expect(confirm_btn).toHaveText(/Delete/);
        await expect(page.locator('#delete-media-prompt')).toBeHidden();
        await expect(page.locator('#delete-media-irreversible')).toBeHidden();
        await expect(page.locator('#delete-media-name')).toHaveText('El Corno Emplumado 5');
        await expect(page.locator('#delete-media-cancel-btn')).toBeEnabled();

        // Forcing a click on the disabled button must not fire another DELETE
        await confirm_btn.dispatchEvent('click');
        await page.waitForTimeout(300);
        expect(recordState.deleteCount).toBe(1);

        // Nothing was removed from the list
        await expect(page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`)).toHaveCount(1);

        // Cancel, reopen: the lock is per open — the confirm state is back
        await page.locator('#delete-media-cancel-btn').click();
        await expect(page.locator('#delete-media-modal')).toBeHidden();
        await page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#delete-media-confirm-btn')).toBeVisible();
        await expect(page.locator('#delete-media-confirm-btn')).toBeEnabled();
        await expect(page.locator('#delete-media-prompt')).toBeVisible();
        await expect(page.locator('#delete-media-irreversible')).toBeVisible();
        await expect(page.locator('#delete-media-message .alert')).toHaveCount(0);
    });

    test('rapid double-click on confirm fires only one DELETE', async ({ page }) => {
        // Regression for the confirm-button double-click race.
        // setup_delete_modal_handlers clones-and-replaces the confirm
        // button on every modal open, so the button's `disabled` state
        // alone isn't sufficient to block a second click that lands
        // before the first DELETE response. The fix adds a module-scope
        // `is_deleting` guard that survives cloning. Two synchronous
        // clicks should still result in exactly one DELETE.
        const record = mediaRecordFixture({
            uuid: TARGET_UUID,
            name: 'Record to delete',
            original_filename: 'doomed-photo.jpg',
            ingest_method: 'upload',
            media_type: 'image',
        });
        await stubMediaLibraryListApi(page, { records: [record] });

        // Manually intercept the DELETE so we can hold the response
        // open across both clicks. The shared stubMediaRecordApi
        // returns synchronously, which is too fast to reproduce the
        // race window.
        let delete_count = 0;
        let resolve_delete;
        const delete_held = new Promise((resolve) => { resolve_delete = resolve; });
        await page.route(
            new RegExp(`${APP_PATH}/api/v1/media/library/record/[^/?]+(?:\\?.*)?$`),
            async (route) => {
                if (route.request().method() === 'DELETE') {
                    delete_count += 1;
                    await delete_held;
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ success: true, message: 'ok' }),
                    });
                }
                return route.fallback();
            }
        );

        await page.goto(`${APP_PATH}/media/library`);
        await expect(page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`))
            .toHaveCount(1);
        await page.locator(`a.btn-delete-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#delete-media-confirm-btn')).toBeVisible();

        // Fire two clicks back-to-back. dispatchEvent is synchronous
        // and bypasses the `disabled` attribute check, mirroring the
        // worst-case race the in-flight guard must defend against.
        const confirm_btn = page.locator('#delete-media-confirm-btn');
        await confirm_btn.dispatchEvent('click');
        await confirm_btn.dispatchEvent('click');

        // Release the held DELETE. On success the module closes the delete modal —
        // a deterministic settle signal, unlike networkidle (the media page never
        // goes idle because of ongoing thumbnail requests).
        resolve_delete();
        await expect(page.locator('#delete-media-confirm-btn')).toBeHidden();

        expect(delete_count).toBe(1);
    });
});
