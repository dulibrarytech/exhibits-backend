'use strict';

const { test, expect } = require('@playwright/test');
const {
    APP_PATH,
    role_auth,
    role_headers,
    exhibit_payload,
    apiDeleteExhibit,
    apiSuppressExhibit
} = require('./fixtures/live-api');

const API = `${APP_PATH}/api/v1`;

const BLOCKS = {
    button: { text: '<p>Visit</p>', size: 'small', url: 'https://library.du.edu', transparent: 0 },
    card: { title: '<p>Card heading</p>', text: '<p>Card body</p>' },
    divider: { size: 'small' },
    emphasis: { text: '<p>Emphasis</p>' },
    quote: { text: '<p>Quote</p>', attribution: 'Attribution' }
};

const block_url = (exhibit_id, block_id = '') => `${API}/exhibits/${exhibit_id}/content-blocks${block_id ? `/${block_id}` : ''}`;

const recycle_url = (exhibit_id, block_id) => `${API}/recycle/${exhibit_id}/${block_id}/content-block`;

async function read_block(request, exhibit_id, block_id) {
    const res = await request.get(block_url(exhibit_id, block_id), { headers: role_headers('administrator') });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    return Array.isArray(data) ? data[0] : data;
}

async function is_indexed(request, block_id) {
    const res = await request.get(`/api/v1/indexer/${block_id}`, { headers: role_headers('administrator') });
    return res.status() === 200;
}

async function recycled_uuids(request) {
    const res = await request.get(`${API}/recycle`, { headers: role_headers('administrator') });
    expect(res.status()).toBe(200);
    return (await res.json()).data.filter((record) => record.type === 'content-block').map((record) => record.uuid);
}

async function create_exhibit_owned_by(request, role_key) {
    const res = await request.post(`${API}/exhibits`, {
        headers: role_headers('administrator'),
        data: {
            ...exhibit_payload(`pw-content-blocks-${role_key}-${Date.now()}`),
            owner: role_auth(role_key).user.id
        }
    });
    expect(res.status()).toBe(201);
    return (await res.json()).data;
}

function create_block(request, role_key, exhibit_id, content_type) {
    return request.post(block_url(exhibit_id), {
        headers: role_headers(role_key),
        data: {
            ...BLOCKS[content_type],
            content_type,
            owner: role_auth(role_key).user.id,
            created_by: 'pw-e2e'
        }
    });
}

test.describe('Content blocks (live)', () => {
    let exhibit_id;

    test.afterEach(async ({ request }) => {
        if (exhibit_id) {
            await apiSuppressExhibit(request, exhibit_id);
            await apiDeleteExhibit(request, exhibit_id);
            exhibit_id = null;
        }
    });

    test('every block type saves', async ({ request }) => {
        exhibit_id = await create_exhibit_owned_by(request, 'administrator');

        for (const content_type of Object.keys(BLOCKS)) {
            const res = await create_block(request, 'administrator', exhibit_id, content_type);
            expect(res.status(), `${content_type} should save`).toBe(201);
        }
    });

    test('a card keeps its heading through create and update', async ({ request }) => {
        exhibit_id = await create_exhibit_owned_by(request, 'administrator');

        const created = await create_block(request, 'administrator', exhibit_id, 'card');
        expect(created.status()).toBe(201);
        const block_id = (await created.json()).data;

        const read_title = async () => {
            const res = await request.get(block_url(exhibit_id, block_id), { headers: role_headers('administrator') });
            expect(res.status()).toBe(200);
            return JSON.stringify((await res.json()).data);
        };

        expect(await read_title()).toContain('Card heading');

        const updated = await request.put(block_url(exhibit_id, block_id), {
            headers: role_headers('administrator'),
            data: { content_type: 'card', title: '<p>New heading</p>', text: '<p>Card body</p>', updated_by: 'pw-e2e' }
        });
        expect(updated.status()).toBe(201);
        expect(await read_title()).toContain('New heading');
    });

    test('publishing and unpublishing an exhibit carries its blocks', async ({ request }) => {
        exhibit_id = await create_exhibit_owned_by(request, 'administrator');

        const created = await create_block(request, 'administrator', exhibit_id, 'quote');
        expect(created.status()).toBe(201);
        const block_id = (await created.json()).data;
        const headers = role_headers('administrator');

        const published = await request.post(`${API}/exhibits/${exhibit_id}/publish`, { headers });
        expect(published.status()).toBe(200);
        expect((await read_block(request, exhibit_id, block_id)).is_published).toBe(1);
        expect(await is_indexed(request, block_id)).toBe(true);

        const suppressed = await request.post(`${API}/exhibits/${exhibit_id}/suppress`, { headers });
        expect(suppressed.status()).toBe(200);
        expect((await read_block(request, exhibit_id, block_id)).is_published).toBe(0);
        expect(await is_indexed(request, block_id)).toBe(false);
    });

    test('deleting an exhibit with no standard items deletes its blocks', async ({ request }) => {
        exhibit_id = await create_exhibit_owned_by(request, 'administrator');

        const created = await create_block(request, 'administrator', exhibit_id, 'quote');
        const block_id = (await created.json()).data;

        await apiDeleteExhibit(request, exhibit_id);
        exhibit_id = null;

        expect(await recycled_uuids(request)).toContain(block_id);
    });

    test('a block owner can restore and purge a deleted block through the Recycle Bin', async ({ request }) => {
        exhibit_id = await create_exhibit_owned_by(request, 'general');
        const headers = role_headers('general');

        const created = await create_block(request, 'general', exhibit_id, 'quote');
        const block_id = (await created.json()).data;
        const delete_url = `${API}/exhibits/${exhibit_id}/items/${block_id}?type=content-block`;

        expect((await request.delete(delete_url, { headers })).status()).toBe(204);
        expect(await recycled_uuids(request)).toContain(block_id);

        expect((await request.put(recycle_url(exhibit_id, block_id), { headers })).status()).toBe(200);
        expect(await recycled_uuids(request)).not.toContain(block_id);
        expect((await read_block(request, exhibit_id, block_id)).uuid).toBe(block_id);

        expect((await request.delete(delete_url, { headers })).status()).toBe(204);
        expect((await request.delete(recycle_url(exhibit_id, block_id), { headers })).status()).toBe(200);
        expect(await recycled_uuids(request)).not.toContain(block_id);
    });

    for (const role_key of ['general', 'student']) {
        test(`a ${role_key} user can manage blocks on an exhibit they own`, async ({ request }) => {
            exhibit_id = await create_exhibit_owned_by(request, role_key);

            const created = await create_block(request, role_key, exhibit_id, 'quote');
            expect(created.status(), 'add').toBe(201);
            const block_id = (await created.json()).data;

            const updated = await request.put(block_url(exhibit_id, block_id), {
                headers: role_headers(role_key),
                data: { content_type: 'quote', text: '<p>Updated quote</p>', attribution: 'Attribution', updated_by: 'pw-e2e' }
            });
            expect(updated.status(), 'update').toBe(201);

            const deleted = await request.delete(`${API}/exhibits/${exhibit_id}/items/${block_id}?type=content-block`, {
                headers: role_headers(role_key)
            });
            expect(deleted.status(), 'delete').toBe(204);
        });
    }
});
