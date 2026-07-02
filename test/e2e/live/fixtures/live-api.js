'use strict';

/**
 * API arrange/cleanup helpers for LIVE specs.
 *
 * Live tests reserve the UI for the workflow under test and stage everything
 * else through the real REST API with a minted role JWT ("arrange via API,
 * assert via UI"). All helpers use Playwright's APIRequestContext (`request`
 * fixture), which inherits the project baseURL.
 *
 * Payload notes (verified against the live API):
 *  - The create endpoints 201 with `{ data: '<uuid>' }` — the SERVER's uuid.
 *    Always use the returned uuid (a client-sent uuid is not authoritative).
 *  - The exhibit create schema requires every property present (the client
 *    always posts the full form), so exhibit_payload() fills them all.
 *  - Child creates require is_member_of_* + item_type/mime_type as strings.
 *  - DELETE /api/v1/exhibits/:id is 204 and CASCADES to children — one call
 *    cleans up everything a spec created under its exhibit.
 */

const fs = require('fs');
const path = require('path');

const APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';
const API = `${APP_PATH}/api/v1`;
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'live-auth.json');

function role_auth(role_key) {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    const entry = data.roles[role_key];
    if (!entry) {
        throw new Error(`live-api: unknown role key "${role_key}"`);
    }
    return entry;
}

function admin_headers() {
    return { 'x-access-token': role_auth('administrator').token };
}

async function post_json(request, url, data) {
    const res = await request.post(url, { headers: admin_headers(), data });
    const body = await res.text();
    if (res.status() !== 201) {
        throw new Error(`live-api: POST ${url} → ${res.status()} ${body.slice(0, 200)}`);
    }
    return JSON.parse(body);
}

function exhibit_payload(title) {
    return {
        title,
        subtitle: '',
        alert_text: '',
        description: '',
        hero_image: '',
        thumbnail: '',
        banner_template: '',
        page_layout: '',
        exhibit_template: 'vertical_scroll',
        styles: {},
        created_by: 'pw-e2e-admin'
    };
}

/** @returns {Promise<string>} exhibit uuid */
async function apiCreateExhibit(request, title) {
    const json = await post_json(request, `${API}/exhibits`, exhibit_payload(title));
    return json.data;
}

/** @returns {Promise<string>} item uuid */
async function apiCreateItem(request, exhibit_id, text) {
    const json = await post_json(request, `${API}/exhibits/${exhibit_id}/items`, {
        is_member_of_exhibit: exhibit_id,
        item_type: 'text',
        mime_type: '',
        text,
        styles: {},
        created_by: 'pw-e2e-admin'
    });
    return json.data;
}

/** @returns {Promise<string>} grid uuid */
async function apiCreateGrid(request, exhibit_id, text) {
    const json = await post_json(request, `${API}/exhibits/${exhibit_id}/grids`, {
        is_member_of_exhibit: exhibit_id,
        type: 'grid',
        columns: 4,
        text,
        styles: {},
        created_by: 'pw-e2e-admin'
    });
    return json.data;
}

/** @returns {Promise<string>} grid item uuid */
async function apiCreateGridItem(request, exhibit_id, grid_id, text) {
    const json = await post_json(request, `${API}/exhibits/${exhibit_id}/grids/${grid_id}/items`, {
        is_member_of_grid: grid_id,
        is_member_of_exhibit: exhibit_id,
        item_type: 'text',
        mime_type: '',
        title: '',
        text,
        // Mirror the text-item form's hidden defaults: the edit form echoes
        // `layout` back on PUT and tbl_grid_items.layout is NOT NULL, so an
        // arranged record without it makes every subsequent UI edit 500.
        layout: 'text_only',
        media_width: 50,
        styles: {},
        created_by: 'pw-e2e-admin'
    });
    return json.data;
}

/** @returns {Promise<string>} timeline uuid */
async function apiCreateTimeline(request, exhibit_id, text) {
    const json = await post_json(request, `${API}/exhibits/${exhibit_id}/timelines`, {
        is_member_of_exhibit: exhibit_id,
        type: 'vertical_timeline',
        text,
        styles: {},
        created_by: 'pw-e2e-admin'
    });
    return json.data;
}

/** @returns {Promise<string>} timeline item uuid */
async function apiCreateTimelineItem(request, exhibit_id, timeline_id, title, text) {
    const json = await post_json(request, `${API}/exhibits/${exhibit_id}/timelines/${timeline_id}/items`, {
        is_member_of_timeline: timeline_id,
        is_member_of_exhibit: exhibit_id,
        item_type: 'text',
        mime_type: '',
        title,
        text,
        date: '2026-04-15',
        // Mirror the text-item form's hidden defaults (see apiCreateGridItem).
        layout: 'text_only',
        media_width: 50,
        styles: {},
        created_by: 'pw-e2e-admin'
    });
    return json.data;
}

/**
 * Deletes an exhibit (cascades to all children). Tolerates already-gone.
 */
async function apiDeleteExhibit(request, exhibit_id) {
    if (!exhibit_id) {
        return;
    }
    await request.delete(`${API}/exhibits/${exhibit_id}`, { headers: admin_headers() });
}

/**
 * GET helper for persistence assertions: returns { status, body } with body
 * as raw text — specs assert on status + marker-text presence, which stays
 * robust across response-envelope shapes.
 */
async function apiGet(request, url_path) {
    const res = await request.get(`${API}${url_path}`, { headers: admin_headers() });
    return { status: res.status(), body: await res.text() };
}

// ==================== MEDIA LIBRARY ====================

/**
 * Creates a media-library record for arrange purposes (edit/delete flows that
 * don't need a real file on disk). The create endpoint returns the numeric
 * insert id, not the uuid — resolve the uuid via the browse search (?q=name),
 * so callers should pass a run-unique name.
 * @returns {Promise<string>} media uuid
 */
async function apiCreateMediaRecord(request, name) {
    await post_json(request, `${APP_PATH}/api/v1/media/library`, {
        name,
        item_type: 'still image',
        media_type: 'image',
        mime_type: 'image/png',
        ingest_method: 'upload',
        original_filename: `${name}.png`,
        storage_path: '',
        thumbnail_path: '',
        // The edit modal requires Alt Text for images — arranged records must
        // carry one or the UI save-gate blocks the PUT.
        alt_text: 'PW arranged image',
        size: 1
    });
    const found = await apiFindMediaByName(request, name);
    if (!found) {
        throw new Error(`live-api: created media record "${name}" not found via browse`);
    }
    return found.uuid;
}

/**
 * Finds a media record by exact name via the browse search.
 * @returns {Promise<Object|null>} the record (uuid, ingest_method, …) or null
 */
async function apiFindMediaByName(request, name) {
    const res = await request.get(
        `${APP_PATH}/api/v1/media/library?q=${encodeURIComponent(name)}&limit=50`,
        { headers: admin_headers() }
    );
    if (res.status() !== 200) {
        return null;
    }
    const json = await res.json();
    const records = json.data || json.records || [];
    return records.find((r) => r.name === name) || null;
}

/** Soft-deletes a media record. Tolerates already-gone. */
async function apiDeleteMediaRecord(request, media_uuid) {
    if (!media_uuid) {
        return;
    }
    await request.delete(
        `${APP_PATH}/api/v1/media/library/record/${media_uuid}`,
        { headers: admin_headers() }
    );
}

// ==================== USERS ====================

/** Headers for any seeded role — used by the RBAC probes. */
function role_headers(role_key) {
    return { 'x-access-token': role_auth(role_key).token };
}

/**
 * Creates a user via the real users API (admin token).
 * @returns {Promise<Object>} the created user row ({id, du_id, ...})
 */
async function apiCreateUser(request, { du_id, role_id = 4, first_name = 'PW', last_name = 'Throwaway' }) {
    const res = await request.post(`${APP_PATH}/api/v1/users`, {
        headers: admin_headers(),
        data: {
            du_id,
            email: `${du_id}@du.edu`,
            first_name,
            last_name,
            is_active: 1,
            role_id
        }
    });
    const body = await res.text();
    if (res.status() !== 200 && res.status() !== 201) {
        throw new Error(`live-api: POST users → ${res.status()} ${body.slice(0, 200)}`);
    }
    const user = await apiFindUserByDuid(request, du_id);
    if (!user) {
        throw new Error(`live-api: created user "${du_id}" not found in the users list`);
    }
    return user;
}

/** Finds a user by du_id via the users list API. */
async function apiFindUserByDuid(request, du_id) {
    const res = await request.get(`${APP_PATH}/api/v1/users`, { headers: admin_headers() });
    if (res.status() !== 200) {
        return null;
    }
    const json = await res.json();
    const users = json.data || json.users || [];
    return users.find((u) => u.du_id === du_id) || null;
}

/** Deletes a user by id. Tolerates already-gone. */
async function apiDeleteUser(request, user_id) {
    if (!user_id) {
        return;
    }
    await request.delete(`${APP_PATH}/api/v1/users/${user_id}`, { headers: admin_headers() });
}

module.exports = {
    APP_PATH,
    role_auth,
    role_headers,
    exhibit_payload,
    apiCreateExhibit,
    apiCreateItem,
    apiCreateGrid,
    apiCreateGridItem,
    apiCreateTimeline,
    apiCreateTimelineItem,
    apiDeleteExhibit,
    apiGet,
    apiCreateMediaRecord,
    apiFindMediaByName,
    apiDeleteMediaRecord,
    apiCreateUser,
    apiFindUserByDuid,
    apiDeleteUser
};
