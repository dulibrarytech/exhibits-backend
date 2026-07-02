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
 *
 * (Nav-level gating — Admin Utils visible only to Administrator — is covered
 * per role in auth-roles.live.spec.js.)
 */

const { test, expect } = require('@playwright/test');
const {
    APP_PATH,
    role_headers,
    apiCreateExhibit,
    apiDeleteExhibit,
    apiCreateUser,
    apiDeleteUser
} = require('./fixtures/live-api');

const API = `${APP_PATH}/api/v1`;

test.describe('RBAC enforcement (live)', () => {

    test('view_users is granted to every role', async ({ request }) => {
        for (const role of ['administrator', 'power', 'general', 'student']) {
            const res = await request.get(`${API}/users`, { headers: role_headers(role) });
            expect(res.status(), `${role} should read the users list`).toBe(200);
        }
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
});
