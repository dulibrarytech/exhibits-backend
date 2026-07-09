'use strict';

/**
 * LIVE Kaltura import @external — talks to the real Kaltura SaaS. Excluded
 * from the default live run; enable with PW_EXTERNAL=1
 * (npm run test:e2e:live:external).
 *
 * Uses an entry id that already exists in the account (imported by the dev
 * instance), so the fire-and-forget exhibits-category assignment on create is
 * a no-op duplicate, and media DELETE performs no Kaltura calls — the account
 * is left exactly as found. Also asserts the read-time thumbnail derivation
 * (kaltura_thumbnail_url built from the entry id).
 */

const { test, expect } = require('@playwright/test');
const { loginAs } = require('./fixtures/live-auth');
const { setSubjectsWidget, ensureSelectValue, fillIfPresent } = require('./fixtures/live-ui');
const { APP_PATH, apiFindMediaByName, apiDeleteMediaRecord } = require('./fixtures/live-api');

// An entry id already present in the account (imported by the dev instance).
const KALTURA_ENTRY_ID = '1_dh2cl63d';

test.describe('Kaltura import (live) @external', () => {

    test.skip(!process.env.PW_EXTERNAL, 'external services (Kaltura) required — run via test:e2e:live:external');

    let media_uuid = null;

    test.afterEach(async ({ request }) => {
        await apiDeleteMediaRecord(request, media_uuid);
        media_uuid = null;
    });

    test('imports a Kaltura entry through the audio/video tab', async ({ context, page, request }) => {

        const marker = `pw3-kaltura-import-${Date.now()}-${test.info().workerIndex}`;

        await loginAs(context, page, 'administrator');
        await page.goto(`${APP_PATH}/media/library`);
        await page.click('#import-audio-video-tab');

        await page.fill('#audio-video', KALTURA_ENTRY_ID);

        // The import button fetches the entry from the real Kaltura API.
        const entry_response = page.waitForResponse((resp) =>
            resp.url().includes(`/media/library/kaltura/${KALTURA_ENTRY_ID}`)
            && resp.request().method() === 'GET'
        );
        await page.click('#kaltura-btn');
        expect((await entry_response).status()).toBe(200);

        // Entry form opens with the Kaltura title prefilled.
        await expect(page.locator('#kaltura-media-modal')).toBeVisible({ timeout: 20_000 });
        const name_input = page.locator('#kaltura-media-modal .kaltura-name');
        await expect(name_input).not.toHaveValue('', { timeout: 15_000 });

        await name_input.fill(marker);
        // Description is required; the Kaltura entry description usually
        // prefills it — fill only when the entry had none.
        await fillIfPresent(page, '#kaltura-media-modal .kaltura-description', 'PW live kaltura import description');
        await setSubjectsWidget(page, '#kaltura-media-modal', 'topics_subjects', 'PW Topic');
        await setSubjectsWidget(page, '#kaltura-media-modal', 'genre_form_subjects', 'PW Genre');
        await ensureSelectValue(page, '#kaltura-media-modal select[name="item_type"]');

        // Per-card Save fires the record POST (Done only appears once every
        // card is saved — same pattern as the upload modal).
        const create_response = page.waitForResponse((resp) => {
            const u = new URL(resp.url());
            return u.pathname === `${APP_PATH}/api/v1/media/library`
                && resp.request().method() === 'POST';
        });

        await page.click('#kaltura-media-modal .btn-save-kaltura-item');
        expect((await create_response).status()).toBe(201);

        await page.click('#kaltura-media-done-btn');

        // Persisted as a Kaltura import; thumbnail URL is DERIVED at read time
        // from the entry id (kaltura_thumbnail.js), independent of any stored
        // snapshot.
        const record = await apiFindMediaByName(request, marker);
        expect(record).not.toBeNull();
        media_uuid = record.uuid;
        expect(record.ingest_method).toBe('kaltura');
        expect(record.kaltura_entry_id).toBe(KALTURA_ENTRY_ID);
        expect(record.kaltura_thumbnail_url).toContain(`/thumbnail/entry_id/${KALTURA_ENTRY_ID}`);
    });
});
