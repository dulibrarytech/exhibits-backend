'use strict';

/**
 * LIVE repository import @external — requires the DU repository Elasticsearch
 * to be reachable (VPN / dev VM). Excluded from the default live run; enable
 * with PW_EXTERNAL=1 (npm run test:e2e:live:external).
 *
 * Drives the real flow: repo search -> select result -> Import Selected ->
 * per-item form (Name/subjects/Item Type prefilled from the repository
 * payload) -> save -> media record persisted with ingest_method=repository.
 * Read-only against the repository; the created media record is cleaned up.
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const { setSubjectsWidget, ensureSelectValue, fillIfPresent } = require('./fixtures/live-ui');
const { APP_PATH, apiFindMediaByName, apiDeleteMediaRecord } = require('./fixtures/live-api');

// A stable public repository record (image with title + subjects).
const REPO_UUID = 'efea2428-3ab7-4d6c-adaf-f3a68bd73d92';

test.describe('Repository import (live) @external', () => {

    test.skip(!process.env.PW_EXTERNAL, 'external services (repository ES) required — run via test:e2e:live:external');

    let media_uuid = null;

    test.afterEach(async ({ request }) => {
        await apiDeleteMediaRecord(request, media_uuid);
        media_uuid = null;
    });

    test('imports a repository item through search -> select -> import', async ({ context, page, request }) => {

        const marker = `pw3-repo-import-${Date.now()}-${test.info().workerIndex}`;

        await loginAs(context, page, 'administrator');
        await page.goto(`${APP_PATH}/media/library`);

        // Search the real repository by identifier.
        await page.fill('#repo-uuid', REPO_UUID);

        const search_response = page.waitForResponse((resp) =>
            resp.url().includes('/media/library/repo/search')
            && resp.request().method() === 'GET'
        );
        await page.click('#repo-uuid-btn');
        expect((await search_response).status()).toBe(200);

        // Select the result and import.
        const result = page.locator('.repo-result-item').first();
        await expect(result).toBeVisible({ timeout: 20_000 });
        await result.locator('input[type="checkbox"]').first().check();

        await expect(page.locator('#repo-import-btn')).toBeEnabled();
        await page.click('#repo-import-btn');

        // Per-item form opens with the repository metadata prefilled.
        await expect(page.locator('#repo-media-modal')).toBeVisible({ timeout: 20_000 });
        const name_input = page.locator('#repo-name-0');
        await expect(name_input).not.toHaveValue('', { timeout: 15_000 });

        // Rename to the run marker (find/cleanup key); complete required fields
        // defensively — subjects/Item Type are usually prefilled from the repo.
        await name_input.fill(marker);
        await fillIfPresent(page, '#repo-alt-text-0', 'PW live repo import');
        // Description is required; the repo abstract usually prefills it —
        // fill only when the payload had none.
        await fillIfPresent(page, '#repo-description-0', 'PW live repo import description');
        await setSubjectsWidget(page, '#repo-media-modal', 'genre_form_subjects', 'PW Genre');
        await ensureSelectValue(page, '#repo-item-type-0');

        // Per-card Save fires the record POST (Done only appears once every
        // card is saved — same pattern as the upload modal).
        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/media/library`
                && resp.request().method() === 'POST';
        });

        await page.click('.btn-save-repo-item[data-item-index="0"]');
        expect((await create_response).status()).toBe(201);

        await page.click('#repo-media-done-btn');

        // Persisted as a repository import bound to the repo record.
        const record = await apiFindMediaByName(request, marker);
        expect(record).not.toBeNull();
        media_uuid = record.uuid;
        expect(record.ingest_method).toBe('repository');
        expect(record.repo_uuid).toBe(REPO_UUID);
    });
});
