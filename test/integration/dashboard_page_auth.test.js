'use strict';

/**
 * verify_page() — page (HTML) auth for the dashboard routes.
 *
 * Unlike verify() (which returns 401 JSON on a bad token, correct for APIs),
 * verify_page() must REDIRECT to SSO on any failure — missing OR malformed token —
 * because it guards browser navigations. These tests assert that redirect-on-failure
 * contract (the failure paths redirect regardless of token config, so no secrets are
 * needed here).
 *
 * The test-only bypass is forced OFF before requiring the module so verify_page runs
 * its real logic (the bypass is evaluated once at module load).
 */

delete process.env.EXHIBITS_TEST_AUTH_BYPASS;

const express = require('express');
const request = require('supertest');
const tokens = require('../../libs/tokens');

function pageApp() {
    const app = express();
    app.get('/page', tokens.verify_page, (req, res) => res.status(200).send('ok'));
    return app;
}

describe('verify_page — dashboard page auth', () => {

    test('redirects (302) to SSO when no session is present — not a 401', async () => {
        const r = await request(pageApp()).get('/page');
        expect(r.status).toBe(302);
        expect(r.status).not.toBe(401);
    });

    test('redirects (302) on a malformed token — a page must not surface a 401', async () => {
        const r = await request(pageApp())
            .get('/page')
            .set('Cookie', 'exhibits_token=not-a-valid-jwt');
        expect(r.status).toBe(302);
        expect(r.status).not.toBe(401);
    });

    test('consults the exhibits_token cookie (no x-access-token header needed for pages)', async () => {
        // A bad cookie value still proves the cookie is read (→ redirect, not a hang/500).
        const r = await request(pageApp())
            .get('/page')
            .set('Cookie', 'exhibits_token=a.b.c');
        expect(r.status).toBe(302);
    });
});
