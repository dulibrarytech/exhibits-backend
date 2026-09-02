'use strict';

/**
 * LIVE RBAC probes — real per-role JWTs against the real API, asserting
 * ENFORCEMENT end-to-end (JWT -> verify -> authorize -> role grants in
 * ctbl_role_permissions -> allow/deny). The exhaustive grant matrix is covered
 * at the model layer by jest (permissions_matrix_integration); these probes
 * prove the HTTP-level wiring for representative grants:
 *
 *   view_users            — universal:      every role reads the users list
 *   add_users             — Admin+Power:    General/Student are denied
 *   delete_users          — Admin only:     Power is denied
 *   update_any_exhibit    — Admin+Power:    Power may edit another's exhibit,
 *                                           Student may not (ownership-scoped)
 *   delete_any_exhibit    — Admin only:     Power may NOT delete another's
 *                                           exhibit
 *   publish_any_exhibit   — Admin+Power:    Power publishes another's exhibit,
 *                                           Student is denied (publish_exhibit
 *                                           is ownership-scoped)
 *
 * (Nav-level gating — Admin Utils visible only to Administrator — is covered
 * per role in auth-roles.live.spec.js.)
 */

const { test, expect } = require('@playwright/test');
const {
    APP_PATH,
    role_auth,
    role_headers,
    apiCreateExhibit,
    apiCreateItem,
    apiDeleteExhibit,
    apiSuppressExhibit,
    apiCreateUser,
    apiFindUserByDuid,
    apiDeleteUser,
    apiGet
} = require('./fixtures/live-api');

const API = `${APP_PATH}/api/v1`;

test.describe('RBAC enforcement (live)', () => {

    test('view_users is granted to every role', async ({ request }) => {
        for (const role of ['administrator', 'power', 'general', 'student']) {
            const res = await request.get(`${API}/users`, { headers: role_headers(role) });
            expect(res.status(), `${role} should read the users list`).toBe(200);

            /* C2 (code review 2026-09-02): the list must never carry session JWTs. */
            const users = (await res.json()).data;
            expect(users.length, 'list has the seeded role users').toBeGreaterThan(0);
            for (const user of users) {
                expect(user, `user ${user.id} must not expose token`).not.toHaveProperty('token');
            }
        }
    });

    test('get_user requires view_users and never exposes the session token', async ({ request }) => {
        const admin = role_auth('administrator').user;
        const res = await request.get(`${API}/users/${admin.id}`, { headers: role_headers('student') });
        expect(res.status(), 'student holds view_users').toBe(200);
        expect((await res.json()).data).not.toHaveProperty('token');
    });

    test('add_users is denied to General User and Student', async ({ request }) => {
        for (const role of ['general', 'student']) {
            const res = await request.post(`${API}/users`, {
                headers: role_headers(role),
                data: { du_id: 'pw-rbac-denied', email: 'x@du.edu', first_name: 'X', last_name: 'X', is_active: 1, role_id: 4 }
            });
            expect(res.status(), `${role} must not create users`).toBe(403);
        }
    });

    test('delete_users is denied to Power User (Administrator-only)', async ({ request }) => {

        const throwaway = await apiCreateUser(request, { du_id: `9rbac${String(Date.now()).slice(-6)}` });

        try {
            const res = await request.delete(`${API}/users/${throwaway.id}`, {
                headers: role_headers('power')
            });
            expect(res.status(), 'power must not delete users').toBe(403);
        } finally {
            await apiDeleteUser(request, throwaway.id);
        }
    });

    test('add_users: Power may create a Student but not an Administrator', async ({ request }) => {

        const stamp = String(Date.now()).slice(-6);
        const payload = (du_id, role_id) => ({
            du_id, email: `${du_id}@du.edu`, first_name: 'PW', last_name: 'Throwaway', is_active: 1, role_id
        });

        /* Escalation on create (code review 2026-09-02, H11). */
        const escalate = await request.post(`${API}/users`, {
            headers: role_headers('power'),
            data: payload(`9esc${stamp}`, 1)
        });
        expect(escalate.status(), 'power must not create an Administrator').toBe(403);
        expect(await apiFindUserByDuid(request, `9esc${stamp}`), 'no account was created').toBeNull();

        const ok = await request.post(`${API}/users`, {
            headers: role_headers('power'),
            data: payload(`9std${stamp}`, 4)
        });
        expect(ok.status(), 'power may create a Student').toBe(201);

        const created = await apiFindUserByDuid(request, `9std${stamp}`);
        try {
            expect(created && created.role, 'created with the requested role').toBe('Student');
        } finally {
            await apiDeleteUser(request, created && created.id);
        }
    });

    test('update_user_role: Student cannot promote self; Power cannot change roles; Admin can', async ({ request }) => {

        const student = role_auth('student').user;
        const profile = { first_name: student.name.split(' ')[0], last_name: student.name.split(' ').slice(1).join(' '), email: student.email };

        /* Self-promotion (code review 2026-09-02, C1): own record + role_id=Administrator. */
        const promote = await request.put(`${API}/users/${student.id}`, {
            headers: role_headers('student'),
            data: { ...profile, role_id: 1 }
        });
        expect(promote.status(), 'student must not change own role').toBe(403);

        /* Same PUT with the role UNCHANGED is an ordinary self profile edit. */
        const self_edit = await request.put(`${API}/users/${student.id}`, {
            headers: role_headers('student'),
            data: { ...profile, role_id: 4 }
        });
        expect(self_edit.status(), 'student may edit own profile').toBe(201);

        /* update_user does not reach other users' records. */
        const admin = role_auth('administrator').user;
        const cross_edit = await request.put(`${API}/users/${admin.id}`, {
            headers: role_headers('student'),
            data: { first_name: 'Hijacked', last_name: 'Admin', email: admin.email }
        });
        expect(cross_edit.status(), 'student must not edit another user').toBe(403);

        const throwaway = await apiCreateUser(request, { du_id: `9role${String(Date.now()).slice(-6)}` });

        try {
            const power_promote = await request.put(`${API}/users/${throwaway.id}`, {
                headers: role_headers('power'),
                data: { first_name: 'PW', last_name: 'Throwaway', email: throwaway.email, role_id: 1 }
            });
            expect(power_promote.status(), 'power (no update_user_role) must not change a role').toBe(403);

            const admin_promote = await request.put(`${API}/users/${throwaway.id}`, {
                headers: role_headers('administrator'),
                data: { first_name: 'PW', last_name: 'Throwaway', email: throwaway.email, role_id: 3 }
            });
            expect(admin_promote.status(), 'administrator may change a role').toBe(201);

            const after = await apiFindUserByDuid(request, throwaway.du_id);
            expect(after && after.role, 'role change persisted').toBe('General User');
        } finally {
            await apiDeleteUser(request, throwaway.id);
        }
    });

    test('a shared-preview token is not a session token (C3, review 2026-09-02)', async ({ request }) => {

        const exhibit_id = await apiCreateExhibit(request, `PW share-token ${Date.now()}`);

        try {
            /* Mint a share link as an authenticated user and pull its t= token. */
            const minted = await request.post(`${API.replace('/api/v1', '')}/shared?uuid=${exhibit_id}`, {
                headers: role_headers('administrator')
            });
            expect(minted.status(), 'share link minted').toBe(201);
            const shared_token = new URL((await minted.json()).shared_url).searchParams.get('t');
            expect(shared_token, 'share URL carries a token').toBeTruthy();

            /* The share token must NOT open any session-authenticated API... */
            const as_header = await request.get(`${API}/exhibits`, { headers: { 'x-access-token': shared_token } });
            expect(as_header.status(), 'shared token as x-access-token').toBe(401);

            const as_cookie = await request.get(`${API}/exhibits`, { headers: { cookie: `exhibits_token=${shared_token}` } });
            expect(as_cookie.status(), 'shared token as session cookie').toBe(401);

            /* ...and a session token must not open the share endpoint. */
            const session_as_share = await request.get(`${API.replace('/api/v1', '')}/shared?uuid=${exhibit_id}&t=${role_auth('administrator').token}`);
            expect(session_as_share.status(), 'session token on /shared').toBe(403);
        } finally {
            await apiDeleteExhibit(request, exhibit_id);
        }
    });

    test('exhibit ownership: update_any vs delete_any enforced per role', async ({ request }) => {

        // Admin-owned exhibit — the other roles are NOT the owner.
        const marker = `pw4-rbac-exhibit-${Date.now()}`;
        const exhibit_id = await apiCreateExhibit(request, marker);

        try {
            // The update schema accepts exactly these properties (no styles/uuid/etc).
            const put_payload = {
                title: `${marker}-edited`,
                subtitle: '',
                banner_template: '',
                hero_image: '',
                description: '',
                page_layout: '',
                exhibit_template: 'vertical_scroll',
                updated_by: 'pw-e2e-power'
            };

            // Power User HAS update_any_exhibit — editing another's exhibit is allowed.
            const power_put = await request.put(`${API}/exhibits/${exhibit_id}`, {
                headers: role_headers('power'),
                data: put_payload
            });
            expect([200, 201, 204], 'power may edit any exhibit').toContain(power_put.status());

            // Student's update_exhibit is ownership-scoped — denied on another's exhibit.
            const student_put = await request.put(`${API}/exhibits/${exhibit_id}`, {
                headers: role_headers('student'),
                data: put_payload
            });
            expect(student_put.status(), 'student must not edit another\'s exhibit').toBe(403);

            // Power User has delete_exhibit but NOT delete_any_exhibit — denied.
            const power_delete = await request.delete(`${API}/exhibits/${exhibit_id}`, {
                headers: role_headers('power')
            });
            expect(power_delete.status(), 'power must not delete another\'s exhibit').toBe(403);

        } finally {
            await apiDeleteExhibit(request, exhibit_id);
        }
    });

    test('publish: Student is denied on another\'s exhibit; Power (publish_any_exhibit) succeeds', async ({ request }) => {

        // Admin-owned exhibit WITH an item, so the only thing standing
        // between a publish request and success is authorization — not the
        // no-items gate.
        const marker = `pw4-rbac-publish-${Date.now()}`;
        const exhibit_id = await apiCreateExhibit(request, marker);
        await apiCreateItem(request, exhibit_id, `${marker}-item`);

        try {
            // Student holds ownership-scoped publish_exhibit but NOT
            // publish_any_exhibit — publishing another's exhibit is denied.
            const student_publish = await request.post(`${API}/exhibits/${exhibit_id}/publish`, {
                headers: role_headers('student')
            });
            expect(student_publish.status(), 'student must not publish another\'s exhibit').toBe(403);

            // And the denial had no side effects — the exhibit is still unpublished.
            const after_denied = await apiGet(request, `/exhibits/${exhibit_id}`);
            expect(after_denied.body).toContain('"is_published":0');

            // Power User HAS publish_any_exhibit — the same request succeeds,
            // proving the Student 403 above was the ownership scope and not an
            // unrelated failure of the publish route.
            const power_publish = await request.post(`${API}/exhibits/${exhibit_id}/publish`, {
                headers: role_headers('power')
            });
            expect(power_publish.status(), 'power may publish any exhibit').toBe(200);

            const after_published = await apiGet(request, `/exhibits/${exhibit_id}`);
            expect(after_published.body).toContain('"is_published":1');

        } finally {
            // Publishing indexed into the local ES index — suppress to remove
            // those documents before deleting the exhibit.
            await apiSuppressExhibit(request, exhibit_id);
            await apiDeleteExhibit(request, exhibit_id);
        }
    });
});
