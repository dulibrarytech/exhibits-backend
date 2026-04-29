'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubExhibitsApi,
    stubMediaLibraryListApi,
    stubMediaDuplicateCheckApi,
    stubKalturaEntryApi,
    stubRepoMetadataApi,
    kalturaEntryFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

// Same lightweight page-deps bundle as the other media-library specs.
async function stubMediaPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    await stubExhibitsApi(page, { records: [] });
}

// ── Why we switch to the Kaltura tab before interacting ──
//
// Bootstrap 4's `.tab-pane` defaults to `display: none` until
// `.active.show` is applied via the tab plugin. The Kaltura pane is
// the THIRD tab and starts hidden — `#audio-video` and `#kaltura-btn`
// resolve in the DOM but Playwright's actionability checks (visible,
// editable) fail.
//
// `kaltura.service.module.init` wires the click handler on
// `#kaltura-btn` regardless of tab state, so once the pane is
// visible everything works normally. We click `#import-audio-video-tab`
// (which IS always visible as part of the nav row) and then await
// the form input becoming visible before any interaction.
//
// (An earlier draft of this spec assumed the inactive pane stayed
// `display: block` with only opacity changes via `.fade`. That
// turned out to be wrong — Bootstrap 4 fully hides inactive panes;
// the `.fade` class only animates the show/hide transition.)
async function switchToKalturaTab(page) {
    await page.click('#import-audio-video-tab');
    await expect(page.locator('#audio-video')).toBeVisible();
}

test.describe('Media library Kaltura entry lookup (kaltura.service.module.js — get_kaltura_media)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubMediaPageDeps(page);
        // The list page boots on page load — list endpoint must be
        // stubbed even though this spec only exercises the Kaltura tab.
        await stubMediaLibraryListApi(page, { records: [] });
        // The duplicate-check fetch always runs before the entry GET.
        // Default exists:false so the lookup proceeds. Tests that need
        // the duplicate branch override this.
        await stubMediaDuplicateCheckApi(page, { exists: false });
    });

    test('Get-metadata fires GET /kaltura/<entry_id>, shows the thumbnail, opens the modal pre-populated with title', async ({ page }) => {
        const entryState = await stubKalturaEntryApi(page, {
            data: kalturaEntryFixture({
                // populate_kaltura_modal reads `media_data.entry_id`
                // from the response — NOT the URL or the typed value.
                // Set it explicitly to match what we type into
                // #audio-video below so the modal's hidden
                // `.kaltura-entry-id` field assertion passes.
                entry_id: '0_abc123xy',
                title: 'My Test Video',
                description: 'My test description',
                thumbnail: 'https://cdnapisec.kaltura.com/p/0/thumb-test.jpg',
                item_type: 'video',
                mime_type: 'video/mp4',
            }),
        });
        // The Kaltura import modal calls populate_subjects_dropdowns on
        // open — stub the metadata endpoints so the modal can render
        // without errors.
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await switchToKalturaTab(page);

        await page.fill('#audio-video', '0_abc123xy');
        await page.click('#kaltura-btn');

        // Entry GET landed at /api/v1/media/library/kaltura/<entry_id>.
        await expect.poll(() => entryState.getCount).toBeGreaterThan(0);
        expect(entryState.lastEntryId).toBe('0_abc123xy');

        // Thumbnail container becomes visible (style.display = 'block').
        await expect(page.locator('#kaltura-thumbnail-container')).toBeVisible();

        // Import modal opens with the form. The Name input
        // (.kaltura-name inside #kaltura-media-modal) is pre-populated
        // from the entry's title.
        await expect(page.locator('#kaltura-media-modal')).toBeVisible();
        await expect(page.locator('#kaltura-media-modal .kaltura-name'))
            .toHaveValue('My Test Video');
        // Description textarea also pre-populated.
        await expect(page.locator('#kaltura-media-modal .kaltura-description'))
            .toHaveValue('My test description');
        // Hidden entry-id field carries what the user typed.
        await expect(page.locator('#kaltura-media-modal .kaltura-entry-id'))
            .toHaveValue('0_abc123xy');

        // Dead tab-level hidden inputs were removed. The modal owns
        // the form fields that get serialized on save; the page tab's
        // #kaltura-item-type / #is-kaltura-item used to be written by
        // get_kaltura_media but no consumer ever read them, so they
        // were dropped. Lock that cleanup in.
        await expect(page.locator('#kaltura-item-type')).toHaveCount(0);
        await expect(page.locator('#is-kaltura-item')).toHaveCount(0);
    });

    test('Empty entry id shows a warning without firing the GET', async ({ page }) => {
        const entryState = await stubKalturaEntryApi(page);
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await switchToKalturaTab(page);

        // Don't fill #audio-video. Click direct.
        await page.click('#kaltura-btn');

        // The validation gate writes a warning into #kaltura-item-data
        // (the module's bound message helper container) and returns
        // without firing the entry GET.
        await expect(page.locator('#kaltura-item-data .alert-warning'))
            .toContainText(/enter a Kaltura entry/i);
        // Entry GET never fired.
        expect(entryState.getCount).toBe(0);
        // Modal stayed closed.
        await expect(page.locator('#kaltura-media-modal')).toBeHidden();
    });

    test('Duplicate-check `exists: true` short-circuits with a warning', async ({ page }) => {
        // Override the beforeEach default: simulate the entry already
        // existing in the media library.
        await stubMediaDuplicateCheckApi(page, {
            exists: true,
            record: { name: 'Existing video' },
        });
        const entryState = await stubKalturaEntryApi(page);
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await switchToKalturaTab(page);

        await page.fill('#audio-video', '0_abc123xy');
        await page.click('#kaltura-btn');

        // Module shows the "already exists" warning in the bound
        // message container and returns early — entry GET never fires.
        await expect(page.locator('#kaltura-item-data .alert-warning'))
            .toContainText(/already exists/i);
        expect(entryState.getCount).toBe(0);
        await expect(page.locator('#kaltura-media-modal')).toBeHidden();
    });

    test('Server error (500) shows a danger alert and the modal stays closed', async ({ page }) => {
        await stubKalturaEntryApi(page, { status: 500 });
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await switchToKalturaTab(page);

        await page.fill('#audio-video', '0_abc123xy');
        await page.click('#kaltura-btn');

        // The error path writes the danger alert into #kaltura-item-data
        // (the module's bound message helper container).
        await expect(page.locator('#kaltura-item-data .alert-danger'))
            .toBeVisible();
        await expect(page.locator('#kaltura-media-modal')).toBeHidden();
    });

    test('Modal entry_id falls back to the typed value when the response omits entry_id', async ({ page }) => {
        // Regression: build_kaltura_form_html reads media_data.entry_id
        // when populating the hidden .kaltura-entry-id input. If the
        // server response drops or renames that field, the modal would
        // serialize entry_id: '' on save. The fix injects the typed
        // value into media_data before handing off to the modal.
        const entry = kalturaEntryFixture({
            title: 'Video without entry_id in response',
            description: 'desc',
            thumbnail: 'https://cdnapisec.kaltura.com/p/0/thumb-test.jpg',
            item_type: 'video',
            mime_type: 'video/mp4',
        });
        // Drop entry_id from the response payload to simulate the
        // wire-format divergence the fix protects against.
        delete entry.entry_id;
        await stubKalturaEntryApi(page, { data: entry });
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await switchToKalturaTab(page);

        await page.fill('#audio-video', '0_typedvalue');
        await page.click('#kaltura-btn');

        await expect(page.locator('#kaltura-media-modal')).toBeVisible();
        // Hidden entry-id field carries the typed value, not an
        // empty string from the missing response field.
        await expect(page.locator('#kaltura-media-modal .kaltura-entry-id'))
            .toHaveValue('0_typedvalue');
    });

    test('thumbnail is hidden when the modal-open hop throws after a successful lookup', async ({ page }) => {
        // Regression: the catch block in get_kaltura_media used to
        // call hide_loading() but not hide_thumbnail(). show_thumbnail
        // runs inside the success branch BEFORE the modal-open hop;
        // if that hop throws, the stale thumbnail sits above the
        // danger alert until the next successful lookup.
        await stubKalturaEntryApi(page, {
            data: kalturaEntryFixture({
                entry_id: '0_abc123xy',
                title: 'My Test Video',
                thumbnail: 'https://cdnapisec.kaltura.com/p/0/thumb-test.jpg',
                item_type: 'video',
                mime_type: 'video/mp4',
            }),
        });
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await switchToKalturaTab(page);

        // Force the modal-open hop to throw so we hit the catch path.
        // kalturaModalsModule is declared with `const` at the script
        // top-level, so it's a global lexical binding — not on window.
        // Reach it by name through eval so the override lands inside
        // the same lexical environment.
        await page.evaluate(() => {
            // eslint-disable-next-line no-eval
            eval('kalturaModalsModule').open_kaltura_media_modal = () => {
                throw new Error('Forced modal-open failure for regression test');
            };
        });

        await page.fill('#audio-video', '0_abc123xy');
        await page.click('#kaltura-btn');

        // Danger alert is shown.
        await expect(page.locator('#kaltura-item-data .alert-danger'))
            .toBeVisible();
        // Thumbnail container is hidden again. Without the fix it
        // would still be display:block from show_thumbnail().
        await expect(page.locator('#kaltura-thumbnail-container'))
            .toBeHidden();
    });
});
