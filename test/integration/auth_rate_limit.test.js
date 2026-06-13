'use strict';

/**
 * Rate-limit behaviour for Phase 1 (auth limiters + the test-harness bypass).
 *
 * Uses fresh limiter instances (each with its own in-memory store) per test for
 * isolation. The identity keyGenerator/skip here mirror the wiring in
 * config/rate_limits_loader.js (`auth_identity_operations`).
 */

jest.mock('../../libs/log4', () => ({
    module: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const express = require('express');
const request = require('supertest');
const { create_rate_limiter } = require('../../config/rate_limits_loader');

// Mirrors the SSO identity limiter wiring in the loader.
const IDENTITY_OPTS = {
    keyGenerator: (req) => 'id:' + String((req.body && req.body.employeeID) || '').trim().toLowerCase(),
    skip: (req) => !(req.body && typeof req.body.employeeID === 'string' && req.body.employeeID.trim() !== '')
};

function build(...middleware) {
    const app = express();
    app.use(express.json());
    const ok = (req, res) => res.status(200).json({ ok: true });
    app.get('/t', ...middleware, ok);
    app.post('/t', ...middleware, ok);
    return app;
}

describe('Rate limiting — auth + bypass (Phase 1)', () => {

    test('auth_operations is IP-keyed and blocks after 5 per window', async () => {
        const app = build(create_rate_limiter('auth_operations'));
        for (let i = 0; i < 5; i++) {
            expect((await request(app).get('/t')).status).toBe(200);
        }
        const blocked = await request(app).get('/t');
        expect(blocked.status).toBe(429);
        expect(blocked.body).toMatchObject({ success: false });
    });

    test('auth_identity_operations keys by employeeID — independent per account', async () => {
        const app = build(create_rate_limiter('auth_identity_operations', IDENTITY_OPTS));
        for (let i = 0; i < 10; i++) {
            expect((await request(app).post('/t').send({ employeeID: 'alice' })).status).toBe(200);
        }
        // 11th attempt for the same account is blocked…
        expect((await request(app).post('/t').send({ employeeID: 'alice' })).status).toBe(429);
        // …but a different account has its own bucket.
        expect((await request(app).post('/t').send({ employeeID: 'bob' })).status).toBe(200);
    });

    test('auth_identity_operations is skipped when no identity is submitted', async () => {
        const app = build(create_rate_limiter('auth_identity_operations', IDENTITY_OPTS));
        // Well beyond max (10): all pass because the limiter skips with no employeeID,
        // leaving the IP-keyed auth_operations as the only bound on such requests.
        for (let i = 0; i < 15; i++) {
            expect((await request(app).post('/t').send({})).status).toBe(200);
        }
    });

    test('EXHIBITS_TEST_AUTH_BYPASS disables limiting (so it never throttles e2e)', async () => {
        const prev = process.env.EXHIBITS_TEST_AUTH_BYPASS;
        process.env.EXHIBITS_TEST_AUTH_BYPASS = '1';
        try {
            const app = build(create_rate_limiter('auth_operations')); // max 5
            for (let i = 0; i < 20; i++) {
                expect((await request(app).get('/t')).status).toBe(200);
            }
        } finally {
            if (prev === undefined) { delete process.env.EXHIBITS_TEST_AUTH_BYPASS; }
            else { process.env.EXHIBITS_TEST_AUTH_BYPASS = prev; }
        }
    });
});
