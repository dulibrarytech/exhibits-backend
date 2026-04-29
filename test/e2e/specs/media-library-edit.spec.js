'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubExhibitsApi,
    stubMediaLibraryListApi,
    stubMediaRecordApi,
    stubRepoMetadataApi,
    mediaRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const TARGET_UUID = 'media-uuid-target';

// Same lightweight page-deps bundle as media-library-list.spec.js;
// see that file for why we don't reuse stubDashboardDeps.
async function stubMediaPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    await stubExhibitsApi(page, { records: [] });
}

// ── Why dispatchEvent('click') on the dropdown item ──
//
// The action dropdown's `<a class="dropdown-item btn-edit-media">`
// lives inside a Bootstrap `.dropdown-menu` with `display: none` until
// the toggle is clicked. The naive workaround would be to pop the
// dropdown first, but Bootstrap-init timing makes that brittle.
//
// `click({ force: true })` doesn't help here: `force` skips the
// actionability *waits* but Playwright's click pipeline still attempts
// "scroll into view" before the forced click, and `display: none`
// elements have no layout box to scroll to — so the click fails with
// "Element is not visible".
//
// `locator.dispatchEvent('click')` IS visibility-independent (per the
// Playwright docs: "regardless of the visibility state of the element,
// click is dispatched"). `setup_action_handlers` wires the click via
// `addEventListener('click', …)`, so a dispatched click reaches the
// handler exactly the same way a real click would.
//
// (Same modal-text-collision rule as the list spec applies: scope
// every assertion to `#edit-media-modal` or to ID-based selectors,
// not getByText, since modal partials carry overlapping body copy.)

async function open_list_with_target_record(page, recordOverrides = {}) {
    const record = mediaRecordFixture({
        uuid: TARGET_UUID,
        name: 'Original record name',
        description: 'Original description',
        ingest_method: 'upload',
        media_type: 'image',
        item_type: 'image',
        // Pre-select Genre/Form to a value present in the metadata
        // stub's defaults. init_multi_select picks this up via the
        // widget's data-selected attribute and populates the hidden
        // input — without it, the required-widget validation blocks
        // the save submit (silently).
        genre_form_subjects: 'Photographs',
        // Pre-populate alt_text. build_edit_form_html emits an
        // additional `<input id="edit-file-alt-text" required>` ONLY
        // when media_type === 'image' (alt-text is required for image
        // accessibility). With record.alt_text empty, form.checkValidity()
        // fails on submit and handle_edit_form_submit returns silently
        // without firing the PUT — the failure mode is invisible
        // (no message, no console log) so it's worth the explicit
        // seed even though it's not the field-under-test.
        alt_text: 'Sample alt text',
        ...recordOverrides,
    });

    await stubMediaLibraryListApi(page, { records: [record] });
    const recordState = await stubMediaRecordApi(page, { record });
    await stubRepoMetadataApi(page);

    await page.goto(`${APP_PATH}/media/library`);
    // Wait for the list to render before clicking the row action.
    await expect(page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`))
        .toHaveCount(1);

    return { record, recordState };
}

test.describe('Media library edit modal (modals.edit.module.js — open_edit_media_modal / update_media_record)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubMediaPageDeps(page);
    });

    test('clicking the row Edit dropdown item opens the modal and populates fields from the GET', async ({ page }) => {
        await open_list_with_target_record(page);

        await page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');

        // Form is built dynamically into #edit-media-form-container after
        // the GET resolves — wait for the name input to exist and carry
        // the record value before asserting on anything else.
        await expect(page.locator('#edit-file-name')).toHaveValue('Original record name');
        await expect(page.locator('#edit-file-description'))
            .toHaveValue('Original description');

        // The hidden uuid field is populated from record.uuid; this is
        // what the submit handler reads back via current_edit_uuid.
        await expect(page.locator('#edit-file-uuid')).toHaveValue(TARGET_UUID);

        // The Save button is rendered inside the modal footer (NOT in
        // the dynamically-built form container) — locking that down
        // here means the next test can rely on the selector.
        await expect(page.locator('#edit-media-save-btn')).toBeVisible();
    });

    test('Save fires PUT with the form payload and closes the modal on success', async ({ page }) => {
        const { recordState } = await open_list_with_target_record(page);

        await page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#edit-file-name')).toHaveValue('Original record name');

        // Mutate the name + description so the assertions are concrete.
        await page.fill('#edit-file-name', 'Renamed record');
        await page.fill('#edit-file-description', 'Updated description');

        await page.locator('#edit-media-save-btn').click();

        // PUT lands at /api/v1/media/library/record/<uuid> with the
        // form fields as JSON (handle_edit_form_submit strips `uuid`
        // from the payload — the URL carries it instead).
        await expect.poll(() => recordState.putCount).toBeGreaterThan(0);
        expect(recordState.lastPutUrl).toContain(`/api/v1/media/library/record/${TARGET_UUID}`);
        expect(recordState.lastPutPayload).toMatchObject({
            name: 'Renamed record',
            description: 'Updated description',
        });
        // `uuid` is in the URL path, not the body. Lock that down.
        expect(recordState.lastPutPayload).not.toHaveProperty('uuid');

        // On 200 + success: success message appears in the modal's
        // own message container, then the module schedules a 1500ms
        // close. Assert on the success message rather than waiting for
        // the close (Bootstrap's hide animation makes visibility
        // assertions racy).
        await expect(page.locator('#edit-media-message .alert-success'))
            .toBeVisible();
    });

    test('GET failure shows the load-error alert in the form container', async ({ page }) => {
        // Override the stub with a 404 (the modal's "Failed to load"
        // branch fires for any non-success response).
        const record = mediaRecordFixture({
            uuid: TARGET_UUID,
            ingest_method: 'upload',
        });
        await stubMediaLibraryListApi(page, { records: [record] });
        await stubMediaRecordApi(page, { record, getStatus: 404 });
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await expect(page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`))
            .toHaveCount(1);
        await page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');

        // open_edit_media_modal writes "Failed to load media record."
        // into #edit-media-form-container when get_media_record returns
        // null (which it does for any non-success response).
        await expect(page.locator('#edit-media-form-container .alert-danger'))
            .toContainText(/Failed to load media record/i);
    });

    test('PUT failure shows an error in the modal message area without closing', async ({ page }) => {
        const record = mediaRecordFixture({
            uuid: TARGET_UUID,
            name: 'Original record name',
            ingest_method: 'upload',
            item_type: 'image',
            genre_form_subjects: 'Photographs',
            // See open_list_with_target_record's comment for why
            // alt_text must be seeded for any submit-path test.
            alt_text: 'Sample alt text',
        });
        await stubMediaLibraryListApi(page, { records: [record] });
        await stubMediaRecordApi(page, { record, putStatus: 403 });
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await expect(page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`))
            .toHaveCount(1);
        await page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#edit-file-name')).toHaveValue('Original record name');

        await page.locator('#edit-media-save-btn').click();

        // 403 → update_media_record returns {success: false, message},
        // handle_edit_form_submit writes the danger alert into
        // #edit-media-message and re-enables the save button.
        await expect(page.locator('#edit-media-message .alert-danger'))
            .toBeVisible();
        await expect(page.locator('#edit-media-save-btn')).toBeEnabled();
    });

    test('Save with missing alt_text on an image record surfaces a danger alert instead of silently no-op-ing', async ({ page }) => {
        // Image records render a `required` alt_text input. Submit
        // used to return silently on `!form.checkValidity()` — no
        // message, no console log, no PUT — making the failure
        // indistinguishable from a hung click. After the fix,
        // handle_edit_form_submit surfaces a danger alert in
        // #edit-media-message before bailing out.
        const record = mediaRecordFixture({
            uuid: TARGET_UUID,
            name: 'Original record name',
            ingest_method: 'upload',
            media_type: 'image',
            item_type: 'image',
            genre_form_subjects: 'Photographs',
            // Intentionally omit alt_text so checkValidity() fails.
            alt_text: '',
        });
        const recordState = await stubMediaRecordApi(page, { record });
        await stubMediaLibraryListApi(page, { records: [record] });
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await expect(page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`))
            .toHaveCount(1);
        await page.locator(`a.btn-edit-media[data-uuid="${TARGET_UUID}"]`)
            .dispatchEvent('click');
        await expect(page.locator('#edit-file-name')).toHaveValue('Original record name');

        await page.locator('#edit-media-save-btn').click();

        // Validation fails → danger alert is rendered in
        // #edit-media-message; the PUT is NOT fired.
        await expect(page.locator('#edit-media-message .alert-danger'))
            .toContainText(/required fields/i);
        expect(recordState.putCount).toBe(0);
    });
});
