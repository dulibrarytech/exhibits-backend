'use strict';

const { test, expect } = require('@playwright/test');
const { seedAuth } = require('../fixtures/auth');
const {
    stubAuthPermissionsApi,
    stubVerifyTokenApi,
    stubDashboardDeps,
    stubExhibitsApi,
    stubMediaLibraryListApi,
    stubMixedItemsListApi,
    stubGridItemsApi,
    stubGridRecordApi,
    exhibitFixture,
    gridItemFixture,
    gridRecordFixture,
    mediaRecordFixture,
    timelineItemRecordFixture,
} = require('../fixtures/api-stubs');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const EXHIBIT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GRID_UUID = '660e8400-e29b-41d4-a716-446655440100';
const TIMELINE_UUID = '770e8400-e29b-41d4-a716-446655440200';

const ROWS = [1, 2, 3, 4];

/*
 * Kebab (⋮) action menus on every list page (#208): one menu open at a time;
 * the ⋮, a click elsewhere and Esc each close it; the open menu doesn't cover
 * its ⋮ and the table's scroll box doesn't hide it. The toggles used to be
 * created with `new bootstrap.Dropdown()`, which Bootstrap 4 never closes.
 *
 * Uses the first and last rows: the last row is where the scroll box clips.
 */
async function expect_one_menu_at_a_time(page, toggle_selector, menu_selector, opts = {}) {
    const toggles = page.locator(toggle_selector);
    const menus = page.locator(menu_selector);
    const last = (await toggles.count()) - 1;

    expect(last).toBeGreaterThan(0);

    await toggles.first().click();
    await expect(menus.first()).toBeVisible();

    await toggles.nth(last).click();
    await expect(menus.nth(last)).toBeVisible();
    await expect(menus.first()).toBeHidden();
    await expect(page.locator(`${menu_selector}.show`)).toHaveCount(1);

    expect(await hit_test(toggles.nth(last), menus.nth(last))).toEqual({
        toggle_covered: false,
        first_item_clipped: false,
    });

    await toggles.nth(last).click();
    await expect(menus.nth(last)).toBeHidden();

    // Click elsewhere: the top-left corner of <main id="main">, which every list page has.
    await toggles.first().click();
    await expect(menus.first()).toBeVisible();
    await page.locator('#main').click({ position: { x: 1, y: 1 } });
    await expect(menus.first()).toBeHidden();

    if (opts.escape !== false) {
        await toggles.first().click();
        await expect(menus.first()).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menus.first()).toBeHidden();
    }
}

/*
 * Checks toBeVisible() can't make: a menu cut off by the table's scroll box
 * still counts as visible, and Playwright's clicks scroll the box for you.
 */
async function hit_test(toggle, menu) {
    return toggle.evaluate((toggle_el, menu_el) => {
        const toggle_box = toggle_el.getBoundingClientRect();
        const hit = document.elementFromPoint(
            toggle_box.left + toggle_box.width / 2,
            toggle_box.top + toggle_box.height / 2
        );
        const item_box = menu_el.querySelector('.dropdown-item').getBoundingClientRect();
        let scroll_box = menu_el.parentElement;
        while (scroll_box !== document.body && getComputedStyle(scroll_box).overflowY === 'visible') {
            scroll_box = scroll_box.parentElement;
        }
        const clip = scroll_box.getBoundingClientRect();
        return {
            toggle_covered: !toggle_el.contains(hit),
            first_item_clipped: item_box.top < clip.top || item_box.bottom > clip.bottom,
        };
    }, await menu.elementHandle());
}

/*
 * Stands in for a sort, page change or search keystroke: each of those runs
 * the module's drawCallback, which is where the row actions get wired.
 */
async function redraw(page, table_selector, times) {
    await page.evaluate(({ selector, count }) => {
        const api = window.jQuery(selector).DataTable();
        for (let i = 0; i < count; i++) {
            api.draw(false);
        }
    }, { selector: table_selector, count: times });
}

async function open_media_library(page) {
    await seedAuth(page);
    await stubAuthPermissionsApi(page);
    await stubVerifyTokenApi(page);
    await stubExhibitsApi(page, { records: [] });
    await stubMediaLibraryListApi(page, {
        records: ROWS.map((i) => mediaRecordFixture({
            uuid: `media-${i}`,
            name: `Media ${i}`,
            original_filename: `photo-${i}.jpg`,
            ingest_method: 'upload',
            media_type: 'image',
        })),
    });

    await page.goto(`${APP_PATH}/media/library`);
    await expect(page.locator('.media-actions-toggle')).toHaveCount(ROWS.length);
}

async function open_exhibits_list(page) {
    await seedAuth(page);
    await stubDashboardDeps(page);
    await stubExhibitsApi(page, {
        records: ROWS.map((i) => exhibitFixture({
            uuid: `0000000${i}-e29b-41d4-a716-446655440000`,
            title: `Exhibit ${i}`,
        })),
    });

    await page.goto(`${APP_PATH}/exhibits`);
    await expect(page.locator('.exhibit-actions-toggle')).toHaveCount(ROWS.length);
}

/*
 * api-stubs has no list stub for timeline items (stubTimelineItemApi owns
 * the single-record routes), so the list GET is answered here.
 */
async function stubTimelineItemsListApi(page, items) {
    await page.route(
        `**${APP_PATH}/api/v1/exhibits/${EXHIBIT_UUID}/timelines/${TIMELINE_UUID}/items`,
        (route) => {
            if (route.request().method() !== 'GET') {
                return route.fallback();
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: items }),
            });
        }
    );
}

test.describe('Kebab action menus (#208)', () => {

    test.describe('one menu open at a time, clear of its toggle', () => {

        test('exhibits list', async ({ page }) => {
            await open_exhibits_list(page);
            await expect_one_menu_at_a_time(page, '.exhibit-actions-toggle', '.exhibit-actions-menu');
        });

        test('items list', async ({ page }) => {
            await seedAuth(page);
            await stubDashboardDeps(page, {
                exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Items host exhibit' }) },
            });
            await stubMixedItemsListApi(page, {
                exhibitId: EXHIBIT_UUID,
                items: ROWS.map((i) => ({
                    uuid: `item-${i}`,
                    type: 'item',
                    item_type: 'text',
                    title: `Item ${i}`,
                    order: i,
                    is_published: 0,
                    is_locked: 0,
                    is_member_of_exhibit: EXHIBIT_UUID,
                })),
            });

            await page.goto(`${APP_PATH}/items?exhibit_id=${EXHIBIT_UUID}`);
            await expect(page.locator('table#items .item-actions-toggle')).toHaveCount(ROWS.length);

            await expect_one_menu_at_a_time(page, 'table#items .item-actions-toggle', 'table#items .item-actions-menu');
        });

        test('grid items list', async ({ page }) => {
            await seedAuth(page);
            await stubDashboardDeps(page, {
                exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Grid host exhibit' }) },
            });
            await stubGridItemsApi(page, {
                exhibitId: EXHIBIT_UUID,
                gridId: GRID_UUID,
                items: ROWS.map((i) => gridItemFixture({
                    uuid: `grid-item-${i}`,
                    order: i,
                    title: `Grid item ${i}`,
                    is_member_of_exhibit: EXHIBIT_UUID,
                    is_member_of_grid: GRID_UUID,
                })),
            });
            await stubGridRecordApi(page, {
                exhibitId: EXHIBIT_UUID,
                record: gridRecordFixture({ uuid: GRID_UUID, columns: 3 }),
            });

            await page.goto(`${APP_PATH}/items/grid/items?exhibit_id=${EXHIBIT_UUID}&grid_id=${GRID_UUID}`);
            await expect(page.locator('table#grid-items .item-actions-toggle')).toHaveCount(ROWS.length);

            await expect_one_menu_at_a_time(page, 'table#grid-items .item-actions-toggle', 'table#grid-items .item-actions-menu');
        });

        test('timeline items list', async ({ page }) => {
            await seedAuth(page);
            await stubDashboardDeps(page, {
                exhibit: { record: exhibitFixture({ uuid: EXHIBIT_UUID, title: 'Timeline host exhibit' }) },
            });
            await stubTimelineItemsListApi(page, ROWS.map((i) => timelineItemRecordFixture({
                uuid: `timeline-item-${i}`,
                title: `Timeline item ${i}`,
                date: `2026-04-1${i}`,
                is_member_of_exhibit: EXHIBIT_UUID,
                is_member_of_timeline: TIMELINE_UUID,
            })));

            await page.goto(`${APP_PATH}/items/timeline/items?exhibit_id=${EXHIBIT_UUID}&timeline_id=${TIMELINE_UUID}`);
            await expect(page.locator('table#timeline-items .item-actions-toggle')).toHaveCount(ROWS.length);

            await expect_one_menu_at_a_time(page, 'table#timeline-items .item-actions-toggle', 'table#timeline-items .item-actions-menu');
        });

        test('media library', async ({ page }) => {
            await open_media_library(page);
            await expect_one_menu_at_a_time(page, '.media-actions-toggle', '.media-actions-menu');
        });

        test('recycle bin', async ({ page }) => {
            await seedAuth(page);
            await stubDashboardDeps(page, { role: { role: 'Administrator' } });
            await page.route(`**${APP_PATH}/api/v1/recycle**`, (route) => route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: ROWS.map((i) => ({
                        uuid: `880e8400-e29b-41d4-a716-44665544000${i}`,
                        type: 'item',
                        title: `Recycled item ${i}`,
                        is_member_of_exhibit: EXHIBIT_UUID,
                        created_by: 'tester',
                        is_deleted: 1,
                    })),
                }),
            }));

            await page.goto(`${APP_PATH}/recycle`);
            await expect(page.locator('.recycle-actions-toggle')).toHaveCount(ROWS.length);

            // The recycle bin's menus are hand-rolled (no Bootstrap JS), so no Esc handling.
            await expect_one_menu_at_a_time(page, '.recycle-actions-toggle', '.recycle-actions-menu', { escape: false });
        });
    });

    /*
     * The row actions are wired in drawCallback, and DataTables reuses row
     * nodes, so before the fix every redraw added another click listener: after
     * three redraws one click ran the action four times. The module functions
     * are swapped for counters so no modal or window opens.
     */
    test.describe('row actions run once per click after table redraws', () => {

        test('media library Edit', async ({ page }) => {
            await open_media_library(page);
            await redraw(page, '#items', 3);

            await page.evaluate(() => {
                window.__edit_calls = [];
                // eslint-disable-next-line no-undef
                mediaEditModalModule.open_edit_media_modal = async (uuid) => {
                    window.__edit_calls.push(uuid);
                };
            });

            const first_row_uuid = await page.locator('.btn-edit-media').first().getAttribute('data-uuid');
            await page.locator('.media-actions-toggle').first().click();
            await page.locator('.media-actions-menu').first().locator('.btn-edit-media').click();

            expect(await page.evaluate(() => window.__edit_calls)).toEqual([first_row_uuid]);
            // Bootstrap closed the menu: nothing is left marked open, wrapper included
            await expect(page.locator('.dropdown.show, .dropdown-menu.show')).toHaveCount(0);
        });

        test('exhibits list Preview', async ({ page }) => {
            await open_exhibits_list(page);
            await redraw(page, '#exhibits', 3);

            await page.evaluate(() => {
                window.__preview_calls = [];
                // eslint-disable-next-line no-undef
                exhibitsModule.open_preview = (link) => {
                    window.__preview_calls.push(link);
                };
            });

            await page.locator('.exhibit-actions-toggle').first().click();
            await page.locator('.exhibit-actions-menu').first().locator('.btn-preview-exhibit').click();

            const calls = await page.evaluate(() => window.__preview_calls);
            expect(calls).toHaveLength(1);
            expect(calls[0]).toContain(`${APP_PATH}/preview?uuid=`);
            await expect(page.locator('.dropdown.show, .dropdown-menu.show')).toHaveCount(0);
        });
    });
});
