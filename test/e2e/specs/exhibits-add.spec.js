'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const { stubDashboardDeps, stubExhibitsApi } = require('../fixtures/api-stubs');
const { openModal, waitForModalHidden } = require('../helpers/bootstrap');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

test.describe('Add Exhibit modal', () => {
    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page);
        await stubExhibitsApi(page);
        await page.goto(`${APP_PATH}/exhibits`);
    });

    test('opens modal and initializes the add-form module', async ({ page }) => {
        await openModal(page, 'add-exhibit-modal');

        await expect(page.locator('#add-exhibit-modal')).toBeVisible();
        await expect(page.locator('#save-exhibit-btn')).toBeEnabled();

        // The IIFE modules are declared with top-level `const` in classic
        // scripts, which puts them in the script's lexical scope but NOT on
        // window. Reference them by bare name inside page.evaluate — that
        // executes in the page's main world and the binding resolves.
        const initialized = await page.evaluate(
            () => typeof exhibitsAddFormModule?.reset_form === 'function'
        );
        expect(initialized).toBe(true);
    });

    test('blocks save when required fields are empty', async ({ page }) => {
        await openModal(page, 'add-exhibit-modal');

        await page.click('#save-exhibit-btn');

        // exhibits.common.form.module.js get_common_form_fields() flags the
        // missing title by adding .is-invalid to #exhibit-title-input and
        // inserting a .title-validation-feedback div as a sibling. There is
        // NO alert in #add-exhibit-message on this validation path — that
        // selector was a guess in the original speculative spec.
        await expect(page.locator('#exhibit-title-input')).toHaveClass(/is-invalid/);
        await expect(page.locator('.title-validation-feedback')).toBeVisible();
    });

    test('POSTs payload and closes modal on success', async ({ page }) => {
        await openModal(page, 'add-exhibit-modal');

        // The exhibit form gates submission on a styles-required check
        // covering 5 sections × 4 fields (template/introduction/navigation/
        // heading1/item1 × bg-color/font-color/font-size/font). This test
        // is about the create POST shape, not the styles UI — bypass the
        // gate so we don't have to fill twenty unrelated fields.
        //
        // Bare name reference (not `window.<name>`) — see test 1's note.
        await page.evaluate(() => {
            exhibitsStylesModule.validate_required = () => ({ valid: true });
            exhibitsStylesModule.get_styles = () => ({});
        });

        // The verify POST also lives under /api/v1/exhibits, so match the
        // create POST by exact pathname rather than substring.
        const postPromise = page.waitForRequest((req) => {
            const u = new URL(req.url());
            return u.pathname === `${APP_PATH}/api/v1/exhibits` && req.method() === 'POST';
        });

        await page.fill('#exhibit-title-input', 'My new exhibit');
        await page.fill('#exhibit-description-input', 'A description');
        await page.click('#save-exhibit-btn');

        const request = await postPromise;
        const body = request.postDataJSON();
        expect(body.title).toBe('My new exhibit');
        expect(body.exhibit_template).toBe('vertical_scroll');

        // create_exhibit_record redirects via window.location.href on
        // success rather than calling .modal('hide'); waitForModalHidden
        // resolves either way (the element is gone after navigation).
        await waitForModalHidden(page, 'add-exhibit-modal');
    });
});
