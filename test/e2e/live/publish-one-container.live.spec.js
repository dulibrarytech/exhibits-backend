'use strict';

const { test, expect } = require('@playwright/test');
const {
    APP_PATH,
    role_headers,
    apiCreateExhibit,
    apiCreateGrid,
    apiCreateGridItem,
    apiCreateTimeline,
    apiCreateTimelineItem,
    apiDeleteExhibit,
    apiSuppressExhibit,
    apiGet
} = require('./fixtures/live-api');

const API = `${APP_PATH}/api/v1`;

test.describe('Publish, unpublish and reorder act on one grid or timeline (live)', () => {

    let exhibit_uuid = null;
    let stamp = null;

    const headers = () => role_headers('administrator');

    const indexed = async (request, uuid) => {
        const res = await request.get(`/api/v1/indexer/${uuid}`, { headers: headers() });

        if (res.status() !== 200) {
            return null;
        }

        return (await res.json())?.source ?? null;
    };

    const indexed_item_ids = async (request, container) => {
        return ((await indexed(request, container.uuid))?.items ?? []).map((item) => item.uuid);
    };

    const saved = async (request, path) => JSON.parse(
        (await apiGet(request, `/exhibits/${exhibit_uuid}/${path}`)).body
    ).data;

    const saved_item = (request, container, item_uuid) => {
        return saved(request, `${container.path}/${container.uuid}/items/${item_uuid}`);
    };

    const item_flags = async (request, container) => {
        const flags = [];

        for (const item_uuid of container.items) {
            flags.push((await saved_item(request, container, item_uuid)).is_published);
        }

        return flags;
    };

    const post = (request, path, data) => {
        return request.post(
            `${API}/exhibits/${exhibit_uuid}/${path}`,
            data === undefined ? { headers: headers() } : { headers: headers(), data }
        );
    };

    const publish = (request, container) => post(request, `publish/${container.uuid}/item?type=${container.type}`);
    const unpublish = (request, container) => post(request, `suppress/${container.uuid}/item?type=${container.type}`);
    const reorder = (request, rows) => post(request, 'items/reorder', rows);

    const swap_in_exhibit = async (request, first, second) => {
        const first_order = Number((await saved(request, `${first.path}/${first.uuid}`)).order);
        const second_order = Number((await saved(request, `${second.path}/${second.uuid}`)).order);
        const res = await reorder(request, [
            { type: first.type, uuid: first.uuid, order: second_order },
            { type: second.type, uuid: second.uuid, order: first_order }
        ]);

        expect(res.status()).toBe(200);

        return { first_order: second_order, second_order: first_order };
    };

    const add_grid = async (request, name) => {
        const uuid = await apiCreateGrid(request, exhibit_uuid, `grid-${name}-${stamp}`, 2);
        const items = [];

        for (const item of ['one', 'two']) {
            items.push(await apiCreateGridItem(request, exhibit_uuid, uuid, `grid-${name}-${item}-${stamp}`));
        }

        return { uuid, items, type: 'grid', path: 'grids' };
    };

    const add_timeline = async (request, name) => {
        const uuid = await apiCreateTimeline(request, exhibit_uuid, `timeline-${name}-${stamp}`);
        const items = [];

        for (const item of ['one', 'two']) {
            items.push(await apiCreateTimelineItem(
                request, exhibit_uuid, uuid, `timeline-${name}-${item}`, `timeline-${name}-${item}-${stamp}`
            ));
        }

        return { uuid, items, type: 'timeline', path: 'timelines' };
    };

    const publish_exhibit = async (request, containers) => {
        const published = await request.post(`${API}/exhibits/${exhibit_uuid}/publish`, { headers: headers() });
        expect(published.status()).toBe(200);

        for (const container of containers) {
            await expect.poll(
                async () => (await indexed_item_ids(request, container)).length,
                { timeout: 15_000 }
            ).toBe(2);
        }
    };

    const indexed_order = async (request, container) => Number((await indexed(request, container.uuid))?.order);

    const swap_and_wait = async (request, first, second) => {
        const orders = await swap_in_exhibit(request, first, second);

        await expect.poll(() => indexed_order(request, first), { timeout: 15_000 }).toBe(orders.first_order);

        if ((await saved(request, `${second.path}/${second.uuid}`)).is_published === 1) {
            await expect.poll(() => indexed_order(request, second), { timeout: 15_000 }).toBe(orders.second_order);
        }
    };

    test.beforeEach(async ({ request }) => {
        stamp = `${Date.now()}-${test.info().workerIndex}`;
        exhibit_uuid = await apiCreateExhibit(request, `pw2-one-container-${stamp}`);
    });

    test.afterEach(async ({ request }) => {
        await apiSuppressExhibit(request, exhibit_uuid);
        await apiDeleteExhibit(request, exhibit_uuid);
        exhibit_uuid = null;
    });

    test('grids: a reorder publishes nothing, and publishing or unpublishing one grid leaves the other alone', async ({ request }) => {
        const grid_a = await add_grid(request, 'a');
        const grid_b = await add_grid(request, 'b');

        await publish_exhibit(request, [grid_a, grid_b]);

        const [one, two] = grid_a.items;
        const late_item = await apiCreateGridItem(request, exhibit_uuid, grid_a.uuid, `late-${stamp}`);
        const late_item_flag = async () => (await saved_item(request, grid_a, late_item)).is_published;

        await test.step('a reorder of the exhibit list moves the grid and publishes nothing in it', async () => {
            const items_before = (await indexed(request, grid_a.uuid)).items;

            await swap_and_wait(request, grid_a, grid_b);

            expect((await indexed(request, grid_a.uuid)).items).toEqual(items_before);
            expect(await late_item_flag()).toBe(0);
        });

        await test.step('reordering the grid\'s items reorders them in its public record and publishes nothing', async () => {
            const other_grid_before = await indexed(request, grid_b.uuid);
            const res = await reorder(request, [
                { type: 'griditem', grid_id: grid_a.uuid, uuid: two, order: 1 },
                { type: 'griditem', grid_id: grid_a.uuid, uuid: one, order: 2 },
                { type: 'griditem', grid_id: grid_a.uuid, uuid: late_item, order: 3 }
            ]);
            expect(res.status()).toBe(200);

            await expect.poll(() => indexed_item_ids(request, grid_a), { timeout: 15_000 }).toEqual([two, one]);
            expect(await late_item_flag()).toBe(0);
            expect(await indexed(request, grid_b.uuid)).toEqual(other_grid_before);
        });

        await test.step('a drag and a settings save in the same second both reach the public record', async () => {
            const res = await reorder(request, [
                { type: 'griditem', grid_id: grid_a.uuid, uuid: one, order: 1 },
                { type: 'griditem', grid_id: grid_a.uuid, uuid: two, order: 2 },
                { type: 'griditem', grid_id: grid_a.uuid, uuid: late_item, order: 3 }
            ]);
            expect(res.status()).toBe(200);

            const put = await request.put(`${API}/exhibits/${exhibit_uuid}/grids/${grid_a.uuid}`, {
                headers: headers(),
                data: {
                    text: `changed-${stamp}`,
                    columns: 2,
                    internal_name: 'PW live grid internal name',
                    styles: {},
                    updated_by: 'pw-e2e-admin'
                }
            });
            expect(put.status()).toBe(201);

            await expect.poll(
                async () => (await indexed(request, grid_a.uuid))?.text ?? '',
                { timeout: 15_000 }
            ).toContain(`changed-${stamp}`);
            await expect.poll(() => indexed_item_ids(request, grid_a), { timeout: 15_000 }).toEqual([one, two]);
            expect(await late_item_flag()).toBe(0);
        });

        await test.step('unpublishing the other grid leaves this grid\'s items published, and a reorder does not bring it back', async () => {
            expect((await unpublish(request, grid_b)).status()).toBe(200);

            await expect.poll(() => indexed(request, grid_b.uuid), { timeout: 15_000 }).toBeNull();
            expect(await item_flags(request, grid_b)).toEqual([0, 0]);
            expect(await item_flags(request, grid_a)).toEqual([1, 1]);

            await swap_and_wait(request, grid_a, grid_b);

            expect(await indexed(request, grid_b.uuid)).toBeNull();
            expect(await item_flags(request, grid_b)).toEqual([0, 0]);
            expect((await saved(request, `grids/${grid_b.uuid}`)).is_published).toBe(0);
            expect(await indexed_item_ids(request, grid_a)).toEqual([one, two]);
        });

        await test.step('publishing this grid publishes its own items and leaves the other grid out of the index', async () => {
            expect((await unpublish(request, grid_a)).status()).toBe(200);
            await expect.poll(() => indexed(request, grid_a.uuid), { timeout: 15_000 }).toBeNull();

            expect((await publish(request, grid_a)).status()).toBe(200);

            await expect.poll(
                async () => (await indexed_item_ids(request, grid_a)).length,
                { timeout: 15_000 }
            ).toBe(3);
            expect(await late_item_flag()).toBe(1);
            expect(await indexed(request, grid_b.uuid)).toBeNull();
            expect(await item_flags(request, grid_b)).toEqual([0, 0]);
        });
    });

    test('timelines: a reorder publishes nothing, and publishing or unpublishing one timeline leaves the other alone', async ({ request }) => {
        const timeline_a = await add_timeline(request, 'a');
        const timeline_b = await add_timeline(request, 'b');

        await publish_exhibit(request, [timeline_a, timeline_b]);

        const late_item = await apiCreateTimelineItem(request, exhibit_uuid, timeline_a.uuid, 'late', `late-${stamp}`);
        const late_item_flag = async () => (await saved_item(request, timeline_a, late_item)).is_published;

        await test.step('a reorder of the exhibit list moves the timeline and publishes nothing in it', async () => {
            const items_before = (await indexed(request, timeline_a.uuid)).items;

            await swap_and_wait(request, timeline_a, timeline_b);

            expect((await indexed(request, timeline_a.uuid)).items).toEqual(items_before);
            expect(await late_item_flag()).toBe(0);
        });

        await test.step('unpublishing the other timeline leaves this timeline\'s items published, and a reorder does not bring it back', async () => {
            expect((await unpublish(request, timeline_b)).status()).toBe(200);

            await expect.poll(() => indexed(request, timeline_b.uuid), { timeout: 15_000 }).toBeNull();
            expect(await item_flags(request, timeline_b)).toEqual([0, 0]);
            expect(await item_flags(request, timeline_a)).toEqual([1, 1]);

            await swap_and_wait(request, timeline_a, timeline_b);

            expect(await indexed(request, timeline_b.uuid)).toBeNull();
            expect(await item_flags(request, timeline_b)).toEqual([0, 0]);
            expect((await saved(request, `timelines/${timeline_b.uuid}`)).is_published).toBe(0);
            expect(await indexed_item_ids(request, timeline_a)).toEqual(timeline_a.items);
        });

        await test.step('publishing this timeline publishes its own items and leaves the other timeline out of the index', async () => {
            expect((await unpublish(request, timeline_a)).status()).toBe(200);
            await expect.poll(() => indexed(request, timeline_a.uuid), { timeout: 15_000 }).toBeNull();

            expect((await publish(request, timeline_a)).status()).toBe(200);

            await expect.poll(
                async () => (await indexed_item_ids(request, timeline_a)).length,
                { timeout: 15_000 }
            ).toBe(3);
            expect(await late_item_flag()).toBe(1);
            expect(await indexed(request, timeline_b.uuid)).toBeNull();
            expect(await item_flags(request, timeline_b)).toEqual([0, 0]);
        });
    });
});
