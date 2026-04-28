'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubDashboardDeps,
    stubMixedItemsListApi,
    exhibitFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';

// items.module.js dispatches by `record.type`. Three standard text items
// is the minimal fixture for "the page renders the items it gets" —
// dispatch coverage of every type isn't useful at this layer (each
// type's render path is exercised transitively through other specs).
function standardTextItem(overrides = {}) {
    return {
        uuid: 'a',
        type: 'item',
        item_type: 'text',
        title: 'Sample item',
        order: 1,
        is_published: 0,
        is_locked: 0,
        is_member_of_exhibit: EXHIBIT_UUID,
        ...overrides,
    };
}

test.describe('Items list page (items.module.js)', () => {

    test.beforeEach(async ({ page }) => {
        await seedAuth(page);
        await stubDashboardDeps(page, {
            exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
        });
    });

    test('renders items returned from the API', async ({ page }) => {
        await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                standardTextItem({ uuid: 'a', title: 'First',  order: 1 }),
                standardTextItem({ uuid: 'b', title: 'Second', order: 2 }),
                standardTextItem({ uuid: 'c', title: 'Third',  order: 3 }),
            ],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);

        await expect(page.locator('table#items tbody tr')).toHaveCount(3);
        await expect(page.getByText('First')).toBeVisible();
        await expect(page.getByText('Second')).toBeVisible();
        await expect(page.getByText('Third')).toBeVisible();
    });

    test('shows empty-state alert when API returns no items', async ({ page }) => {
        await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [],
        });

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);

        // display_items() empties the .card and writes an info alert
        // into #message ending with " exhibit is empty.".
        await expect(page.locator('#message .alert-info')).toContainText(
            /exhibit is empty/i
        );
    });

    test('shows permission-denied alert when status=403 is in the URL', async ({ page }) => {
        await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [standardTextItem()],
        });

        await page.goto(
            `${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}&status=403`
        );

        // init() writes "You do not have permission to add item." (note
        // the wording — the alert is generic to the items-list page,
        // not specific to a delete/publish action that may have caused
        // the redirect).
        await expect(page.locator('#message .alert-danger')).toContainText(
            /do not have permission/i
        );
    });

    test('clicking a publish button POSTs to the publish endpoint', async ({ page }) => {
        await stubMixedItemsListApi(page, {
            exhibitId: EXHIBIT_UUID,
            items: [
                standardTextItem({ uuid: 'a', title: 'Unpublished', order: 1, is_published: 0 }),
            ],
        });

        // Inline route for the publish endpoint — keeps api-stubs.js tight.
        // Factor out to a helper if/when a second spec needs it.
        let publishUrl = null;
        await page.route(
            `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/publish/a/item**`,
            (route) => {
                if (route.request().method() !== 'POST') {
                    return route.fallback();
                }
                publishUrl = route.request().url();
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: '{}',
                });
            }
        );

        await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);
        await expect(page.locator('table#items tbody tr')).toHaveCount(1);

        // The publish button is rendered with class .publish-item and
        // id=<item_uuid> (publish_item finds item_type from the row id
        // by splitting on '_' and reading the last segment, so it gets
        // 'item' from `a_text_item`).
        await page.locator('.publish-item').first().click();

        await expect.poll(() => publishUrl).not.toBeNull();
        // The handler appends ?type=<item_type> derived from the row id
        // ('item' for standard items).
        const u = new URL(publishUrl);
        expect(u.searchParams.get('type')).toBe('item');
    });
});
