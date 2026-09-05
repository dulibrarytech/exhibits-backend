'use strict';

/**
 * Phase 5 — axe-core a11y scans on the dashboard's primary routes
 * (WCAG 2.0 AA + WCAG 2.1 AA + WCAG 2.2 AA tags).
 *
 * Each test loads a route under stubbed dashboard deps + a small set
 * of fixture rows, lets the page settle, then runs axe scoped to the
 * page (or to a specific modal/region). Violations cause the test to
 * fail with the rule id, target selectors, and remediation help URL.
 *
 * Baseline rules disabled with `disableRules` are documented inline —
 * each entry justifies why the rule is suppressed (third-party
 * widget, design-system constraint, etc.). Re-enable any of these as
 * follow-up work.
 *
 * Companion to the targeted spec files (items-reorder, exhibits-add,
 * etc.) — those test specific behaviors; this spec is the broad
 * "no a11y violations under axe rules" guarantee.
 */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { seedAuth } = require('../fixtures/auth');
const { openModal } = require('../helpers/bootstrap');
const {
    stubDashboardDeps,
    stubExhibitsApi,
    stubMixedItemsListApi,
    stubGridItemsApi,
    stubGridRecordApi,
    stubMediaLibraryListApi,
    exhibitFixture,
    gridItemFixture,
    gridRecordFixture,
    mediaRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '660e8400-e29b-41d4-a716-446655440100';

// WCAG 2.2 AA + 2.1 AA + 2.0 AA. Best-practice (axe's "best-practice"
// tag) covers items not in WCAG (e.g. region landmarks); we don't run
// it here so the suite stays focused on standards conformance.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/*
 * Rules suppressed in the baseline. Each entry must justify itself, and be
 * re-checked rather than inherited — the 2026-09-04 audit found three of the
 * previous five were unnecessary:
 *   - `frame-title` passed everywhere (every iframe has a title), so
 *     suppressing it only forfeited the regression guard.
 *   - `page-has-heading-one` and `region` are `best-practice`-tagged, so the
 *     WCAG tag set above never selected them. They were dead entries; `region`
 *     reports zero violations across all 49 routes when run explicitly.
 *   - `color-contrast` was suppressed pending a manual review that never
 *     happened, and was hiding 141 failing nodes. The palette has since been
 *     corrected, so the rule is on.
 * What remains is the genuine third-party case, narrowed to it.
 */
const BASELINE_DISABLED_RULES = [];

/*
 * DataTables 2.x renders a sort-toggle inner element (`.dt-column-order` with
 * role="button") carrying no text. The parent `<th aria-label="Activate to
 * sort">` supplies the name in practice, and fixing the inner element needs a
 * library patch. Excluded by SELECTOR rather than by disabling the rule, so
 * `aria-command-name` still guards the rest of the page — the audit found the
 * blanket suppression was also hiding 74 unnamed Quill toolbar buttons, which
 * were real failures and have since been fixed.
 */
const THIRD_PARTY_EXCLUSIONS = ['.dt-column-order'];

async function expectNoAxeViolations(page, opts = {}) {
    const include = opts.include;
    const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
    if (BASELINE_DISABLED_RULES.length > 0) {
        builder.disableRules(BASELINE_DISABLED_RULES);
    }
    for (const selector of THIRD_PARTY_EXCLUSIONS) {
        builder.exclude(selector);
    }
    if (include) {
        builder.include(include);
    }
    const results = await builder.analyze();

    if (results.violations.length > 0) {
        // Surface every violation with rule id, impact, count, and the
        // first 2 affected node selectors so the failing assertion is
        // actionable without opening the trace.
        const summary = results.violations.map(v => {
            const targets = v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ');
            return `[${v.impact}] ${v.id} (${v.nodes.length}): ${v.description}\n  → ${targets}\n  help: ${v.helpUrl}`;
        }).join('\n\n');
        throw new Error(`axe found ${results.violations.length} violations:\n\n${summary}`);
    }

    expect(results.violations).toEqual([]);
}

test.describe('axe-core a11y scans (WCAG 2.0/2.1/2.2 AA)', () => {

    test('Items list page has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
        await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                { uuid: 'a', type: 'item', item_type: 'text', title: 'First',  order: 1, is_published: 0, is_locked: 0, is_member_of_exhibit: EXHIBIT_UUID },
                { uuid: 'b', type: 'item', item_type: 'text', title: 'Second', order: 2, is_published: 0, is_locked: 0, is_member_of_exhibit: EXHIBIT_UUID },
            ],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('table#items tbody tr')).toHaveCount(2);

        await expectNoAxeViolations(page);
    });

    test('Grid items list page has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
        });
        await stubGridItemsApi(page, {
            exhibitId: EXHIBIT_UUID,
            gridId: GRID_UUID,
            items: [
                gridItemFixture({ uuid: 'g1', order: 1, title: 'First',  is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID }),
                gridItemFixture({ uuid: 'g2', order: 2, title: 'Second', is_member_of_exhibit: EXHIBIT_UUID, is_member_of_grid: GRID_UUID }),
            ],
        });
        // The list page fetches the grid record for the min-items advisory;
        // left unstubbed the request escapes to the real server and can stall
        // row rendering past the expect timeout. columns: 2 with 2 items keeps
        // the advisory hidden so the scan covers the plain populated list.
        await stubGridRecordApi(page, {
            exhibitId: EXHIBIT_UUID,
            record: gridRecordFixture({ uuid: GRID_UUID, columns: 2 }),
        });

        await page.goto(`${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`);
        await expect(page.locator('table#grid-items tbody tr')).toHaveCount(2);

        await expectNoAxeViolations(page);
    });

    test('Exhibits list page has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page);
        await stubExhibitsApi(page, {
            records: [exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Sample exhibit' })],
        });

        await page.goto(`${APP_PATH}/exhibits`);
        await expect(page.locator('table#exhibits tbody tr')).toHaveCount(1);

        await expectNoAxeViolations(page);
    });

    test('Media library list page has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page);
        // The media page awaits the exhibit-titles fetch before rendering the
        // table; stub it (like media-library-list.spec does) so the row render
        // is hermetic instead of a real DB query that starves under parallel load.
        await stubExhibitsApi(page, { records: [] });
        await stubMediaLibraryListApi(page, {
            records: [mediaRecordFixture({ uuid: 'media-1', ingest_method: 'upload' })],
        });

        await page.goto(`${APP_PATH}/media/library`);
        // Wait for the row to render (deterministic), not networkidle — the media
        // page keeps loading thumbnail <img>s, so it may never reach network-idle.
        await expect(page.locator('a.btn-delete-media')).toHaveCount(1);

        await expectNoAxeViolations(page);
    });

    /*
     * FORM ROUTES. The audit found the baseline scanned four list pages out of
     * 49 routes, so every add/edit/details form went unchecked — which is where
     * a dashboard's accessibility risk actually lives, and where the labelling
     * and rich-text-editor defects it found were hiding.
     */

    test('Exhibit edit form has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Edited exhibit' }) },
        });

        await page.goto(`${APP_PATH}/exhibits/exhibit/edit?exhibit_id=${EXHIBIT_UUID}`);
        /* The rich-text editors mount asynchronously; scanning before they
           exist would skip the very elements this test is here to guard. */
        await expect(page.locator('.ql-editor').first()).toBeVisible();

        await expectNoAxeViolations(page);
    });

    test('Standard item media form has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Item host exhibit' }) },
        });

        await page.goto(`${APP_PATH}/items/standard/media?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('.ql-editor').first()).toBeVisible();

        await expectNoAxeViolations(page);
    });

    test('Exhibit styles form has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Styled exhibit' }) },
        });

        await page.goto(`${APP_PATH}/styles?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('#exhibit-styles-card')).toBeVisible();

        await expectNoAxeViolations(page);
    });

    /*
     * The user forms need an Administrator role. The default stub role is
     * `User`, which silently redirects these routes to /access-denied — the
     * page then scans clean and the test proves nothing. That trap produced
     * false passes during the audit.
     */
    test('User add form has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, { role: { role: 'Administrator' } });

        await page.goto(`${APP_PATH}/users/add`);
        await expect(page.locator('#user-form')).toBeVisible();
        await expect(page.locator('#first-name-input')).toBeVisible();

        await expectNoAxeViolations(page);
    });

    test('Add Exhibit modal has no axe violations', async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Host' }) },
        });
        await stubExhibitsApi(page, { records: [] });

        await page.goto(`${APP_PATH}/exhibits`);
        await openModal(page, 'add-exhibit-modal');
        await expect(page.locator('#add-exhibit-modal')).toBeVisible();
        /* Bootstrap's fade must settle: scanning mid-transition measures colours
           blended against the backdrop and invents contrast failures. */
        await page.waitForTimeout(600);

        await expectNoAxeViolations(page, { include: '#add-exhibit-modal' });
    });
});
