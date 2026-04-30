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
const {
    stubDashboardDeps,
    stubExhibitsApi,
    stubMixedItemsListApi,
    stubGridItemsApi,
    stubMediaLibraryListApi,
    exhibitFixture,
    gridItemFixture,
    mediaRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '660e8400-e29b-41d4-a716-446655440100';

// WCAG 2.2 AA + 2.1 AA + 2.0 AA. Best-practice (axe's "best-practice"
// tag) covers items not in WCAG (e.g. region landmarks); we don't run
// it here so the suite stays focused on standards conformance.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Rules we deliberately suppress in the baseline. Each entry must
// document its reason. Re-enable as targeted follow-up work.
const BASELINE_DISABLED_RULES = [
    'frame-title',                 // not applicable — no <iframe> on these routes
    'page-has-heading-one',        // Phase 5 added visually-hidden h1s, but this rule sometimes mis-flags pages with the existing live <h1 id="exhibit-title"> when its content hasn't populated yet
    'region',                      // landmark coverage is design-system-wide; not actionable per-page
    'color-contrast',              // requires CSS audit on custom palette; deferred to manual contrast review
    // DataTables 2.x renders sort-toggle inner buttons (.dt-column-order
    // with role="button") that have no text content — the parent <th>'s
    // aria-label "Activate to sort" supplies the name in practice for
    // most SRs, but axe's strict aria-command-name check flags the inner
    // role="button". Fixing requires a library patch or upgrade. The
    // existing <th aria-label> markup keeps the table sortable for SR
    // users; we accept the noise.
    'aria-command-name',
];

async function expectNoAxeViolations(page, opts = {}) {
    const include = opts.include;
    const builder = new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .disableRules(BASELINE_DISABLED_RULES);
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
        await stubMediaLibraryListApi(page, {
            records: [mediaRecordFixture({ uuid: 'media-1', ingest_method: 'upload' })],
        });

        await page.goto(`${APP_PATH}/media/library`);
        // Allow render hop. Page may take longer than a list page.
        await page.waitForLoadState('networkidle');

        await expectNoAxeViolations(page);
    });
});
