'use strict';

/**
 * Standard item forms: the Styles card sits directly above the Item Data card,
 * and its preset swatches are in place when the form appears.
 *
 * The swatches are built from the exhibit record (its item style presets),
 * which arrives after the auth check. The common form module holds the card
 * reveal (helperModule.show_form) until that request settles, so the Styles
 * card does not grow after first paint and push the Exhibit Text editor down.
 * The exhibit GET is delayed here so the race is deterministic.
 */

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubStandardItemApi,
    stubMediaApi,
    exhibitFixture,
    standardItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM_UUID = '880e8400-e29b-41d4-a716-446655440300';

/* well under the module's 1500 ms reveal cap */
const EXHIBIT_GET_DELAY_MS = 600;

const PRESETS = {
    exhibit: {
        item1: { backgroundColor: '#c2ced5', color: '#303030', fontFamily: 'IBM Plex Mono', fontSize: '19px' },
    },
};

const FORMS = [
    {
        name: 'text add',
        path: `/items/standard/text?exhibit_id=${EXHIBIT_UUID}`,
    },
    {
        name: 'text edit',
        path: `/items/standard/text/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`,
        record: { item_type: 'text', styles: 'item1' },
    },
    {
        name: 'media add',
        path: `/items/standard/media?exhibit_id=${EXHIBIT_UUID}`,
    },
    {
        name: 'media edit',
        path: `/items/standard/media/edit?exhibit_id=${EXHIBIT_UUID}&item_id=${ITEM_UUID}`,
        record: {
            item_type: 'image',
            mime_type: 'image/jpeg',
            media_uuid: 'media-uuid-existing',
            layout: 'media_right',
            styles: 'item1',
        },
    },
];

/*
 * Runs in the page before its scripts: when the cards are revealed (the Item
 * Data card's inline visibility turns 'visible'), note how many preset
 * swatches the Styles card already holds.
 */
function record_presets_at_reveal() {
    window.__presets_at_reveal = null;
    new MutationObserver((mutations, observer) => {
        const data_card = document.getElementById('item-data-card');
        if (data_card === null || data_card.style.visibility !== 'visible') {
            return;
        }
        window.__presets_at_reveal = document.querySelectorAll('#item-style-options input[name="styles"]').length;
        observer.disconnect();
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['style'] });
}

test.describe('Standard item forms — Styles card above Item Data', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, styles: PRESETS }) },
        });
        await stubMediaApi(page);

        /* registered last, so it runs first: hold the exhibit GET, then let the stub answer */
        await page.route(new RegExp(`${APP_PATH}/api/v1/exhibits/[^/?]+(?:\\?.*)?$`), async (route) => {
            if (route.request().method() === 'GET') {
                await new Promise((resolve) => setTimeout(resolve, EXHIBIT_GET_DELAY_MS));
            }
            return route.fallback();
        });

        await page.addInitScript(record_presets_at_reveal);
    });

    for (const form of FORMS) {

        test(`${form.name}: Styles sits directly above Item Data, presets in place when the form appears`, async ({ page }) => {
            await stubStandardItemApi(page, {
                exhibitId: EXHIBIT_UUID,
                record: form.record ? standardItemRecordFixture({ uuid: ITEM_UUID, ...form.record }) : undefined,
            });

            await page.goto(`${APP_PATH}${form.path}`);

            await expect(page.locator('#item-styles-card')).toBeVisible();
            await expect(page.locator('#item-data-card')).toBeVisible();
            await expect(page.locator('#item-styles-card + #item-data-card')).toHaveCount(1);

            await expect.poll(() => page.evaluate(() => window.__presets_at_reveal)).toBe(1);
        });
    }
});
