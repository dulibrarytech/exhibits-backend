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
     * Row actions are handled by one listener on each table, wired once (#212). These run
     * every action after the table has redrawn (and, for the media library, been destroyed
     * and rebuilt by a refresh): each must run exactly once. The module functions are swapped
     * for recorders so no modal or window opens.
     */
    test.describe('row actions run once per click after redraws', () => {

        test('media library: thumbnail, name and every menu item', async ({ page }) => {
            await seedAuth(page);
            await stubAuthPermissionsApi(page);
            await stubVerifyTokenApi(page);
            await stubExhibitsApi(page, { records: [] });
            await stubMediaLibraryListApi(page, {
                records: [
                    mediaRecordFixture({ uuid: 'media-image', name: 'An image', original_filename: 'photo.jpg', ingest_method: 'upload', media_type: 'image' }),
                    mediaRecordFixture({ uuid: 'media-audio', name: 'An audio file', original_filename: 'clip.mp3', ingest_method: 'upload', media_type: 'audio', thumbnail_path: null }),
                    mediaRecordFixture({ uuid: 'media-kaltura', name: 'A Kaltura clip', original_filename: null, ingest_method: 'kaltura', kaltura_entry_id: 'entry-1', media_type: 'video', mime_type: 'video/mp4' }),
                ],
            });
            await page.goto(`${APP_PATH}/media/library`);
            await expect(page.locator('.media-actions-toggle')).toHaveCount(3);

            await redraw(page, '#items', 3);
            // eslint-disable-next-line no-undef
            await page.evaluate(() => mediaLibraryModule.refresh_media_records());
            await expect(page.locator('.media-actions-toggle')).toHaveCount(3);

            await page.evaluate(() => {
                window.__calls = [];
                const recorder = (action) => (arg) => {
                    window.__calls.push(`${action}:${arg && arg.uuid ? arg.uuid : arg}`);
                };
                /* eslint-disable no-undef */
                mediaModalsModule.open_view_media_modal = recorder('view');
                mediaEditModalModule.open_edit_media_modal = recorder('edit');
                mediaReplaceModalModule.open_replace_media_modal = recorder('replace');
                mediaDeleteModalModule.open_delete_media_modal = recorder('delete');
                kalturaModalsModule.open_kaltura_player_modal = recorder('play');
                /* eslint-enable no-undef */
            });

            const row = (uuid) => page.locator('#items tbody tr', { has: page.locator(`.btn-edit-media[data-uuid="${uuid}"]`) });

            const image_row = row('media-image');
            // The pointer comes from media.library.css, whose rule must follow the .media-name rule
            await expect(image_row.locator('.media-name')).toHaveCSS('cursor', 'pointer');
            await image_row.locator('img.media-thumbnail-clickable').click();
            await image_row.locator('.media-name').click();
            for (const item of ['.btn-edit-media', '.btn-replace-media', '.btn-delete-media']) {
                await image_row.locator('.media-actions-toggle').click();
                await image_row.locator(item).click();
            }

            const kaltura_row = row('media-kaltura');
            await kaltura_row.locator('.media-actions-toggle').click();
            await kaltura_row.locator('.btn-play-kaltura').click();

            // Uploaded audio has no preview, so its name is plain text, not a link
            const audio_name = row('media-audio').locator('.media-name');
            await expect(audio_name).not.toHaveClass(/media-name-clickable/);
            await expect(audio_name).toHaveCSS('cursor', 'default');
            await audio_name.click();

            expect(await page.evaluate(() => window.__calls)).toEqual([
                'view:media-image',
                'view:media-image',
                'edit:media-image',
                'replace:media-image',
                'delete:media-image',
                'play:media-kaltura',
            ]);
            // Bootstrap closed the menus: nothing is left marked open, wrappers included
            await expect(page.locator('.dropdown.show, .dropdown-menu.show')).toHaveCount(0);
        });

        test('media library: on a narrow screen a thumbnail click opens the view without expanding the row', async ({ page }) => {
            await page.setViewportSize({ width: 600, height: 900 });
            await open_media_library(page);

            // Precondition: DataTables Responsive has hidden columns, so first-column clicks expand rows
            await expect(page.locator('#items')).toHaveClass(/collapsed/);

            await page.evaluate(() => {
                window.__views = 0;
                // eslint-disable-next-line no-undef
                mediaModalsModule.open_view_media_modal = () => { window.__views += 1; };
            });

            await page.locator('img.media-thumbnail-clickable').first().click();

            expect(await page.evaluate(() => window.__views)).toBe(1);
            await expect(page.locator('#items tr.child')).toHaveCount(0);
        });

        test('exhibits list: Preview and Share', async ({ page }) => {
            await open_exhibits_list(page);
            await redraw(page, '#exhibits', 3);

            await page.evaluate(() => {
                window.__calls = [];
                /* eslint-disable no-undef */
                exhibitsModule.open_preview = (link) => { window.__calls.push(`preview:${link}`); };
                exhibitsModule.create_shared_preview_url = (uuid) => { window.__calls.push(`share:${uuid}`); };
                /* eslint-enable no-undef */
            });

            const uuid = await page.locator('.btn-preview-exhibit').first().getAttribute('data-uuid');
            await page.locator('.exhibit-actions-toggle').first().click();
            await page.locator('.exhibit-actions-menu').first().locator('.btn-preview-exhibit').click();
            await page.locator('.exhibit-actions-toggle').first().click();
            await page.locator('.exhibit-actions-menu').first().locator('.btn-share-exhibit').click();

            expect(await page.evaluate(() => window.__calls)).toEqual([
                `preview:${APP_PATH}/preview?uuid=${encodeURIComponent(uuid)}`,
                `share:${uuid}`,
            ]);
            await expect(page.locator('.shared-url-modal')).toHaveClass(/show/);
            await expect(page.locator('.dropdown.show, .dropdown-menu.show')).toHaveCount(0);
        });
    });
});
