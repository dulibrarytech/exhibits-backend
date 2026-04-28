'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubExhibitsApi,
    stubMediaLibraryListApi,
    stubRepoSearchApi,
    stubRepoThumbnailApi,
    stubMediaDuplicateCheckApi,
    stubRepoMetadataApi,
    repoSearchItemFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

// Same lightweight page-deps bundle as the other media-library specs.
async function stubMediaPageDeps(page, opts = {}) {
    await stubAuthPermissionsApi(page, opts.permissions);
    await stubVerifyTokenApi(page, opts.verify);
    await stubExhibitsApi(page, { records: [] });
}

// Repo-search-specific deps. These three always travel together:
//   - search endpoint (the "happy path" returns repoSearchItemFixture)
//   - thumbnail endpoint (binary 200 so the inline onerror doesn't fire)
//   - duplicate-check (default exists:false so checkbox selection
//     doesn't get auto-unchecked)
async function stubRepoSearchDeps(page, opts = {}) {
    const searchState = await stubRepoSearchApi(page, opts.search);
    await stubRepoThumbnailApi(page);
    await stubMediaDuplicateCheckApi(page, opts.duplicate);
    return { searchState };
}

// ── Why we don't switch the active tab ──
//
// The "Import Repository Media" tab is the default-active panel on
// page load (per the EJS — it's the first .nav-link with .active).
// `repo.service.module.init` wires the search-button click handler
// regardless of which tab is currently visible. So we can drive the
// repo flow without simulating a Bootstrap tab switch.
// (Tab-switching itself isn't covered yet — out of scope for this hop.)

test.describe('Media library repo-search flow (repo.service.module.js)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubMediaPageDeps(page);
        // The list page still loads (mediaLibraryModule.init runs on
        // page load), so the list endpoint must be stubbed even
        // though this spec only exercises the repo tab.
        await stubMediaLibraryListApi(page, { records: [] });
    });

    test('search button issues GET /repo/search and renders one card per result', async ({ page }) => {
        const { searchState } = await stubRepoSearchDeps(page, {
            search: {
                records: [
                    repoSearchItemFixture({
                        uuid: 'repo-uuid-a',
                        title: 'Alpha record',
                        creator: 'Alice Author',
                    }),
                    repoSearchItemFixture({
                        uuid: 'repo-uuid-b',
                        title: 'Beta record',
                        creator: 'Bob Builder',
                    }),
                    repoSearchItemFixture({
                        uuid: 'repo-uuid-c',
                        title: 'Collection (filtered)',
                        // object_type='collection' is filtered out by
                        // the module; locking that branch in.
                        object_type: 'collection',
                    }),
                ],
            },
        });

        await page.goto(`${APP_PATH}/media/library`);

        await page.fill('#repo-uuid', 'alpha');
        await page.click('#repo-uuid-btn');

        // Search lands at /repo/search?q=<encoded-query>.
        await expect.poll(() => searchState.getCount).toBeGreaterThan(0);
        expect(searchState.lastQuery).toBe('alpha');

        // Two non-collection results render (collection is filtered).
        await expect(page.locator('.repo-result-item')).toHaveCount(2);
        // Each result card carries data-uuid so the next test can
        // target a specific checkbox.
        await expect(page.locator('.repo-result-item[data-uuid="repo-uuid-a"]'))
            .toHaveCount(1);
        await expect(page.locator('.repo-result-item[data-uuid="repo-uuid-b"]'))
            .toHaveCount(1);
        // Filtered collection should NOT render a card.
        await expect(page.locator('.repo-result-item[data-uuid="repo-uuid-c"]'))
            .toHaveCount(0);

        // Import button hidden until something's selected.
        await expect(page.locator('#repo-import-btn')).toBeHidden();
    });

    test('checking a result reveals the Import button with the selected count', async ({ page }) => {
        await stubRepoSearchDeps(page, {
            search: {
                records: [
                    repoSearchItemFixture({ uuid: 'repo-uuid-a', title: 'Alpha' }),
                    repoSearchItemFixture({ uuid: 'repo-uuid-b', title: 'Beta' }),
                ],
            },
        });

        await page.goto(`${APP_PATH}/media/library`);
        await page.fill('#repo-uuid', 'alpha');
        await page.click('#repo-uuid-btn');
        await expect(page.locator('.repo-result-item')).toHaveCount(2);

        // Each result has a checkbox at .repo-item-checkbox[data-uuid=...].
        // handle_item_selection runs the duplicate check (stubbed
        // exists:false), then adds the uuid to selected_items and
        // calls update_import_button.
        await page.locator('.repo-item-checkbox[data-uuid="repo-uuid-a"]').check();

        await expect(page.locator('#repo-import-btn')).toBeVisible();
        await expect(page.locator('#repo-selected-count')).toHaveText('1');

        // Selecting a second item updates the count.
        await page.locator('.repo-item-checkbox[data-uuid="repo-uuid-b"]').check();
        await expect(page.locator('#repo-selected-count')).toHaveText('2');
    });

    test('search returning zero records shows the no-results info message', async ({ page }) => {
        await stubRepoSearchDeps(page, {
            search: { records: [] },
        });

        await page.goto(`${APP_PATH}/media/library`);
        await page.fill('#repo-uuid', 'nothing');
        await page.click('#repo-uuid-btn');

        // `repo.service.module.search` writes the info alert into
        // #repo-search-message via display_message — that's the
        // module's bound message helper (see helperMediaLibraryModule's
        // create_message_helper). The `obj.search` no-results branch
        // is `display_message('info', 'No results found for "<q>"')`.
        await expect(page.locator('#repo-search-message .alert-info'))
            .toContainText(/No results found/i);
    });

    test('Import Selected opens the repo-media-modal with the selected items', async ({ page }) => {
        await stubRepoSearchDeps(page, {
            search: {
                records: [
                    repoSearchItemFixture({ uuid: 'repo-uuid-a', title: 'Alpha' }),
                ],
            },
        });
        // Repo modal fetches subjects/resource-types when it opens.
        await stubRepoMetadataApi(page);

        await page.goto(`${APP_PATH}/media/library`);
        await page.fill('#repo-uuid', 'alpha');
        await page.click('#repo-uuid-btn');
        await expect(page.locator('.repo-result-item')).toHaveCount(1);

        await page.locator('.repo-item-checkbox[data-uuid="repo-uuid-a"]').check();
        await expect(page.locator('#repo-import-btn')).toBeVisible();

        await page.locator('#repo-import-btn').click();

        // repoModalsModule.open_repo_media_modal makes the modal
        // visible via helperMediaLibraryModule.show_bootstrap_modal.
        // Locking down that the import button → modal-open contract
        // works; the modal's own form-build flow is out of scope for
        // this hop (covered transitively when repo-import gets its
        // own dedicated hop, if needed).
        await expect(page.locator('#repo-media-modal')).toBeVisible();
    });
});
